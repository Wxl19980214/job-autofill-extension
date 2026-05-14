// Orchestrates field detection, value resolution, and DOM filling.
// Only fills high-confidence fields; highlights low-confidence ones.

import type { UserProfile, DetectedField, AutofillResult } from '../shared/profileTypes';
import { detectFields } from './fieldDetector';
import {
  highlightFilled,
  highlightSuggested,
  highlightAmbiguous,
  clearHighlights,
} from './highlighter';
import { isCustomDropdown, fillCustomDropdown } from './dropdownFiller';
import { CONFIDENCE_THRESHOLD_HIGH, CONFIDENCE_THRESHOLD_LOW } from '../shared/constants';

// ── Value resolution ──────────────────────────────────────────────────────────

// Before filling, derive missing composite fields from atomic ones
function enrichProfile(p: UserProfile): UserProfile {
  const enriched = { ...p };
  if (!enriched.fullName && enriched.firstName && enriched.lastName) {
    enriched.fullName = `${enriched.firstName} ${enriched.lastName}`.trim();
  }
  if (!enriched.location && enriched.city && enriched.state) {
    enriched.location = `${enriched.city}, ${enriched.state}`;
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

// Use the native value setter so React's synthetic event system picks up the change
function setNativeValue(el: HTMLElement, value: string) {
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

  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur',   { bubbles: true }));
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

// Score how well an option matches the target value (0 = no match, higher = better)
function scoreOption(optText: string, optValue: string, target: string): number {
  const t   = normalizeForMatch(target);
  const txt = normalizeForMatch(optText);
  const val = normalizeForMatch(optValue);

  if (txt === t || val === t) return 100;           // exact
  if (txt.startsWith(t) || t.startsWith(txt)) return 80; // prefix
  if (txt.includes(t) || val.includes(t)) return 60;     // contains
  if (t.includes(txt) && txt.length > 2) return 40;      // target contains option text
  return 0;
}

// Tries to find the best-matching option using fuzzy scoring; returns true on success
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
    el.value = bestOpt.value;
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

// ── Main exports ──────────────────────────────────────────────────────────────

async function fillHighConfidenceField(
  field: DetectedField,
  enriched: UserProfile,
  result: AutofillResult
): Promise<void> {
  const { profileKey, fieldType, element } = field;
  if (!profileKey) return;

  const rawVal = enriched[profileKey];
  const strVal = resolveStringValue(enriched, field);

  // Custom (non-native) dropdown — click-to-open approach
  if (fieldType !== 'select' && fieldType !== 'checkbox' && isCustomDropdown(element)) {
    if (strVal) {
      const ok = await fillCustomDropdown(element, strVal);
      if (ok) {
        highlightFilled(element, profileKey);
        result.filled++;
      } else {
        highlightAmbiguous(element);
        result.skipped++;
      }
    }
    return;
  }

  if (fieldType === 'select') {
    if (strVal && fillSelect(element as HTMLSelectElement, strVal)) {
      highlightFilled(element, profileKey);
      result.filled++;
    } else {
      highlightAmbiguous(element);
      result.skipped++;
    }
  } else if (fieldType === 'checkbox') {
    if (typeof rawVal === 'boolean') {
      fillCheckbox(element as HTMLInputElement, rawVal);
      highlightFilled(element, profileKey);
      result.filled++;
    } else {
      result.skipped++;
    }
  } else if (fieldType === 'contenteditable') {
    if (strVal) {
      fillContentEditable(element, strVal);
      highlightFilled(element, profileKey);
      result.filled++;
    } else {
      result.skipped++;
    }
  } else {
    if (strVal) {
      setNativeValue(element, strVal);
      highlightFilled(element, profileKey);
      result.filled++;
    } else {
      result.skipped++;
    }
  }
}

export async function autofillPage(profile: UserProfile, allowOverwrite = false): Promise<AutofillResult> {
  clearHighlights();
  const enriched = enrichProfile(profile);
  const fields   = detectFields();
  const result: AutofillResult = { filled: 0, suggested: 0, skipped: 0 };

  for (const field of fields) {
    if (field.currentValue && !allowOverwrite) {
      result.skipped++;
      continue;
    }

    const { confidence, profileKey, element } = field;

    if (confidence >= CONFIDENCE_THRESHOLD_HIGH && profileKey) {
      await fillHighConfidenceField(field, enriched, result);
    } else if (confidence >= CONFIDENCE_THRESHOLD_LOW && profileKey) {
      const strVal = resolveStringValue(enriched, field);
      if (strVal) {
        highlightSuggested(element, profileKey, strVal);
        result.suggested++;
      } else {
        result.skipped++;
      }
    } else if (profileKey) {
      highlightAmbiguous(element);
      result.skipped++;
    }
  }

  return result;
}

export function highlightAllFields(profile: UserProfile): void {
  // Synchronous preview — shows what would be filled without actually filling
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
