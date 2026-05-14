// Scans the current page DOM for fillable form fields and extracts
// the signals (label, name, id, placeholder, aria-label) used for matching.

import type { DetectedField, FieldType } from '../shared/profileTypes';
import { matchFieldToProfile } from './fieldMatcher';

// Exclude non-fillable input types and disabled elements
const FILLABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
  ':not([type="reset"]):not([type="image"]):not([type="file"])',
  ':not([type="range"]):not([type="color"]):not([disabled])',
].join('');

const ALL_SELECTORS = [
  FILLABLE_SELECTOR,
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
].join(', ');

function getFieldType(el: HTMLElement): FieldType {
  if (el.isContentEditable) return 'contenteditable';
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';
  if (type === 'url') return 'url';
  if (type === 'checkbox') return 'checkbox';
  // radio inputs are skipped (handled via radio-group logic — future work)
  return 'text';
}

function getCurrentValue(el: HTMLElement): string {
  if (el.isContentEditable) return el.textContent?.trim() ?? '';
  return (el as HTMLInputElement).value?.trim() ?? '';
}

// Walk up to find an associated <label> via multiple strategies
function getLabelText(el: HTMLElement): string {
  // 1. <label for="elementId">
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }

  // 2. Wrapping <label>
  const parentLabel = el.closest('label');
  if (parentLabel) return parentLabel.textContent?.trim() ?? '';

  // 3. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy.split(/\s+/).map((id) => {
      return document.getElementById(id)?.textContent?.trim() ?? '';
    });
    const joined = parts.filter(Boolean).join(' ');
    if (joined) return joined;
  }

  // 4. Walk up to find sibling label-like text within the immediate container
  const parent = el.parentElement;
  if (!parent) return '';

  // Sibling <label>, <span>, <div>, <legend> that doesn't contain the field
  const candidates = parent.querySelectorAll('label, span, legend, [class*="label"], [class*="Label"]');
  for (const candidate of Array.from(candidates)) {
    if (!candidate.contains(el)) {
      const text = candidate.textContent?.trim();
      if (text && text.length > 1 && text.length < 120) return text;
    }
  }

  // Grandparent — for deeply nested fields like Workday's custom components
  const gp = parent.parentElement;
  if (gp) {
    const gpLabel = gp.querySelector('label, legend, [data-automation-id*="label"]');
    if (gpLabel && !gpLabel.contains(el)) {
      const text = gpLabel.textContent?.trim();
      if (text && text.length > 1) return text;
    }
  }

  return '';
}

export function extractSignals(el: HTMLElement): string {
  const input = el as HTMLInputElement;
  const parts: string[] = [];

  const label       = getLabelText(el);
  const ariaLabel   = el.getAttribute('aria-label') ?? '';
  const placeholder = input.placeholder ?? '';
  const name        = (input.name ?? '').replace(/[_-]/g, ' ');
  const id          = (el.id ?? '').replace(/[_-]/g, ' ');
  const dataField   = el.getAttribute('data-field') ?? el.getAttribute('data-name') ?? '';

  // Order matters: most-specific signals first for debugging readability
  if (label)       parts.push(label);
  if (ariaLabel)   parts.push(ariaLabel);
  if (placeholder) parts.push(placeholder);
  if (name)        parts.push(name);
  if (id)          parts.push(id);
  if (dataField)   parts.push(dataField);

  return parts.join(' | ').toLowerCase();
}

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

export function detectFields(): DetectedField[] {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(ALL_SELECTORS));
  const fields: DetectedField[] = [];

  for (const el of elements) {
    // Skip radio buttons — group logic is out of MVP scope
    if ((el as HTMLInputElement).type === 'radio') continue;
    if (!isVisible(el)) continue;

    const fieldType    = getFieldType(el);
    const signals      = extractSignals(el);
    const currentValue = getCurrentValue(el);

    // Ignore fields with no detectable identity signals
    if (!signals.trim()) continue;

    const match = matchFieldToProfile(signals, fieldType);

    fields.push({
      element: el,
      fieldType,
      signals,
      profileKey:   match?.key    ?? null,
      confidence:   match?.confidence ?? 0,
      currentValue,
    });
  }

  return fields;
}
