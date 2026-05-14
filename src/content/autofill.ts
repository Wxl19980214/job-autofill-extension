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

// Tries exact then partial option matching; returns true on success
function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const norm = value.toLowerCase().trim();

  for (const opt of Array.from(el.options)) {
    if (opt.value.toLowerCase() === norm || opt.text.toLowerCase() === norm) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Partial match — e.g. profile "H1B" matching option "H-1B Visa"
  for (const opt of Array.from(el.options)) {
    const optNorm = opt.text.toLowerCase();
    if (optNorm.includes(norm) || norm.includes(opt.value.toLowerCase())) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
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

export function autofillPage(profile: UserProfile, allowOverwrite = false): AutofillResult {
  clearHighlights();
  const enriched = enrichProfile(profile);
  const fields   = detectFields();
  const result: AutofillResult = { filled: 0, suggested: 0, skipped: 0 };

  for (const field of fields) {
    // Respect existing user-entered content unless overwrite is explicitly requested
    if (field.currentValue && !allowOverwrite) {
      result.skipped++;
      continue;
    }

    const { confidence, profileKey, fieldType, element } = field;

    if (confidence >= CONFIDENCE_THRESHOLD_HIGH && profileKey) {
      const rawVal = enriched[profileKey];

      if (fieldType === 'select') {
        const strVal = resolveStringValue(enriched, field);
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
        const strVal = resolveStringValue(enriched, field);
        if (strVal) {
          fillContentEditable(element, strVal);
          highlightFilled(element, profileKey);
          result.filled++;
        } else {
          result.skipped++;
        }
      } else {
        const strVal = resolveStringValue(enriched, field);
        if (strVal) {
          setNativeValue(element, strVal);
          highlightFilled(element, profileKey);
          result.filled++;
        } else {
          result.skipped++;
        }
      }
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
