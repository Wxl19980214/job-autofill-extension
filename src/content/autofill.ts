// Orchestrates field detection, value resolution, and DOM filling.
// High-confidence fields are filled; low-confidence ones are skipped silently.
// Fill runs in two parallel tracks:
//   Track 1 (Promise.all): text, select, checkbox, radio — instant, no conflicts
//   Track 2 (sequential):  custom dropdowns — must stay sequential to avoid
//                           two overlay menus opening simultaneously

import type { UserProfile, DetectedField, AutofillResult } from '../shared/profileTypes';
import { detectFields } from './fieldDetector';
import {
  highlightFilled,
  highlightSuggested,
  highlightAmbiguous,
  clearHighlights,
} from './highlighter';
import { isCustomDropdown, fillCustomDropdown, handleAutocompleteAfterFill } from './dropdownFiller';
import { CONFIDENCE_THRESHOLD_HIGH, CONFIDENCE_THRESHOLD_LOW } from '../shared/constants';

// ── Value resolution ──────────────────────────────────────────────────────────

function enrichProfile(p: UserProfile): UserProfile {
  const enriched = { ...p };
  if (!enriched.fullName && enriched.firstName && enriched.lastName) {
    enriched.fullName = `${enriched.firstName} ${enriched.lastName}`.trim();
  }
  if (!enriched.location && enriched.city && enriched.state) {
    enriched.location = `${enriched.city}, ${enriched.state}`;
  }
  if (enriched.city && enriched.state && !enriched.city.includes(',')) {
    enriched.city = `${enriched.city}, ${enriched.state}`;
  }
  return enriched;
}

function resolveStringValue(profile: UserProfile, field: DetectedField): string | null {
  if (!field.profileKey) return null;
  const raw = profile[field.profileKey];
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (typeof raw === 'string')  return raw || null;
  return null;
}

// ── DOM filling helpers ───────────────────────────────────────────────────────

function setNativeValue(el: HTMLElement, value: string) {
  el.focus();

  const inputProto    = window.HTMLInputElement.prototype;
  const textareaProto = window.HTMLTextAreaElement.prototype;
  const setter =
    el.tagName === 'TEXTAREA'
      ? Object.getOwnPropertyDescriptor(textareaProto, 'value')?.set
      : Object.getOwnPropertyDescriptor(inputProto, 'value')?.set;

  if (setter) {
    setter.call(el, value);
  } else {
    (el as HTMLInputElement).value = value;
  }

  const lastChar = value.slice(-1);
  el.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, bubbles: true }));
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, bubbles: true }));
}

function fillContentEditable(el: HTMLElement, value: string) {
  el.focus();
  el.textContent = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scoreOption(optText: string, optValue: string, target: string): number {
  const t   = normalizeForMatch(target);
  const txt = normalizeForMatch(optText);
  const val = normalizeForMatch(optValue);

  if (txt === t || val === t) return 100;
  if (txt.startsWith(t) || t.startsWith(txt)) return 80;
  // Skip substring matches for very short targets (≤2 chars) — "no" in "latino", "id" in "disability", etc.
  if (t.length > 2 && (txt.includes(t) || val.includes(t))) return 60;
  if (t.includes(txt) && txt.length > 2) return 40;
  return 0;
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const opts = Array.from(el.options).filter((o) => o.value !== '');

  let bestOpt: HTMLOptionElement | null = null;
  let bestScore = 0;

  for (const opt of opts) {
    const s = scoreOption(opt.text, opt.value, value);
    if (s > bestScore) {
      bestScore = s;
      bestOpt = opt;
    }
  }

  if (bestOpt && bestScore >= 40) {
    // Use native setter so React-controlled selects register the change
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, bestOpt.value);
    else el.value = bestOpt.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    return true;
  }

  return false;
}

function fillCheckbox(el: HTMLInputElement, value: boolean) {
  if (el.checked !== value) {
    el.checked = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click',  { bubbles: true }));
  }
}

// Fill a radio group: score each option's label against the resolved string value,
// then click the best-matching option.
function fillRadioGroup(field: DetectedField, value: string): boolean {
  const options = field.radioOptions;
  if (!options || options.length === 0) return false;

  let bestOption: HTMLInputElement | null = null;
  let bestScore = 0;

  for (const radio of options) {
    const labelEl = radio.id
      ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(radio.id)}"]`)
      : null;
    const optionLabel = labelEl?.textContent?.trim() ?? radio.value ?? '';
    const score = scoreOption(optionLabel, radio.value, value);
    if (score > bestScore) {
      bestScore = score;
      bestOption = radio;
    }
  }

  if (bestOption && bestScore >= 40) {
    if (!bestOption.checked) {
      bestOption.checked = true;
      bestOption.dispatchEvent(new Event('change', { bubbles: true }));
      bestOption.dispatchEvent(new Event('click',  { bubbles: true }));
    }
    return true;
  }

  return false;
}

// If an <input> is nested inside a custom dropdown control (e.g. the search box
// inside a React-select), return the control element so we can open+click the
// option instead of typing into the raw input (which would trigger Escape/blur resets).
function findParentCustomDropdown(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  for (let depth = 0; depth < 5 && node; depth++) {
    if (isCustomDropdown(node)) return node;
    node = node.parentElement;
  }
  return null;
}

// ── Track helpers ─────────────────────────────────────────────────────────────

// Track 1: fill a single non-custom-dropdown field. Async only because text inputs
// may trigger autocomplete handling; all other types return immediately.
async function fillTrack1Field(
  field: DetectedField,
  enriched: UserProfile,
  result: AutofillResult
): Promise<void> {
  const { profileKey, fieldType, element } = field;
  if (!profileKey) return;

  const rawVal = enriched[profileKey];
  const strVal = resolveStringValue(enriched, field);

  if (fieldType === 'radio') {
    if (strVal && fillRadioGroup(field, strVal)) result.filled++;
    else result.skipped++;
    return;
  }

  if (fieldType === 'select') {
    if (strVal && fillSelect(element as HTMLSelectElement, strVal)) result.filled++;
    else result.skipped++;
    return;
  }

  if (fieldType === 'checkbox') {
    if (typeof rawVal === 'boolean') {
      fillCheckbox(element as HTMLInputElement, rawVal);
      result.filled++;
    } else {
      result.skipped++;
    }
    return;
  }

  if (fieldType === 'contenteditable') {
    if (strVal) { fillContentEditable(element, strVal); result.filled++; }
    else result.skipped++;
    return;
  }

  // Plain text inputs — but first check if this input is nested inside a custom
  // dropdown control (e.g. the search input inside a React-select).  If so, delegate
  // to fillCustomDropdown on the control element instead of typing into the input,
  // which would open the dropdown and then wrongly reset it on blur/Escape.
  if (strVal) {
    const parentControl = findParentCustomDropdown(element);
    if (parentControl) {
      const ok = await fillCustomDropdown(parentControl, strVal);
      if (ok) result.filled++;
      else result.skipped++;
      return;
    }
    setNativeValue(element, strVal);
    await handleAutocompleteAfterFill(element, strVal);
    result.filled++;
  } else {
    result.skipped++;
  }
}

// Track 2: fill a single custom dropdown widget (called one at a time).
async function fillTrack2Field(
  field: DetectedField,
  enriched: UserProfile,
  result: AutofillResult
): Promise<void> {
  const { profileKey, element } = field;
  if (!profileKey) return;

  const strVal = resolveStringValue(enriched, field);

  // If there's a native <select> inside the same container, Track 1 will handle it.
  // Skip the custom overlay to avoid opening a menu that can't be cleanly closed.
  const container = element.closest('.field, .form-group, [class*="field-wrapper"], [class*="fieldWrapper"]')
    ?? element.parentElement?.parentElement;
  const siblingSelect = container?.querySelector<HTMLSelectElement>('select');
  if (siblingSelect) {
    result.skipped++;
    return;
  }

  if (strVal) {
    const ok = await fillCustomDropdown(element, strVal);
    if (ok) result.filled++;
    else     result.skipped++;
  } else {
    result.skipped++;
  }
}

async function fillSequentially(
  fields: DetectedField[],
  enriched: UserProfile,
  result: AutofillResult
): Promise<void> {
  for (const field of fields) {
    await fillTrack2Field(field, enriched, result);
  }
}

// ── Main exports ──────────────────────────────────────────────────────────────

export async function autofillPage(profile: UserProfile, allowOverwrite = false): Promise<AutofillResult> {
  clearHighlights();
  const enriched = enrichProfile(profile);
  const fields   = detectFields();
  const result: AutofillResult = { filled: 0, suggested: 0, skipped: 0 };

  const track1: DetectedField[] = [];
  const track2: DetectedField[] = [];

  for (const field of fields) {
    if (field.currentValue && !allowOverwrite) {
      result.skipped++;
      continue;
    }

    const { confidence, profileKey, fieldType, element } = field;

    if (confidence < CONFIDENCE_THRESHOLD_HIGH || !profileKey) {
      result.skipped++;
      continue;
    }

    // Route to Track 2 only for non-native custom dropdown widgets
    if (fieldType !== 'select' && fieldType !== 'checkbox' && fieldType !== 'radio' && isCustomDropdown(element)) {
      track2.push(field);
    } else {
      track1.push(field);
    }
  }

  // Both tracks start concurrently. Track 1 finishes near-instantly.
  // Track 2 runs its custom dropdown queue while Track 1 is already done.
  await Promise.all([
    Promise.all(track1.map((f) => fillTrack1Field(f, enriched, result))),
    fillSequentially(track2, enriched, result),
  ]);

  return result;
}

export function highlightAllFields(profile: UserProfile): void {
  clearHighlights();
  const enriched = enrichProfile(profile);
  const fields   = detectFields();

  for (const field of fields) {
    const { confidence, profileKey, element } = field;
    if (confidence >= CONFIDENCE_THRESHOLD_HIGH && profileKey) {
      highlightFilled(element, profileKey);
    } else if (confidence >= CONFIDENCE_THRESHOLD_LOW && profileKey) {
      const strVal = resolveStringValue(enriched, field);
      highlightSuggested(element, profileKey, strVal ?? '');
    } else {
      highlightAmbiguous(element);
    }
  }
}
