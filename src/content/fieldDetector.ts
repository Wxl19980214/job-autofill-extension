// Scans the current page DOM for fillable form fields and extracts
// the signals (label, name, id, placeholder, aria-label) used for matching.

import type { DetectedField, FieldType } from '../shared/profileTypes';
import { matchFieldToProfile } from './fieldMatcher';

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
  return 'text';
}

const PLACEHOLDER_PATTERN = /^(select\.{0,3}|choose\.{0,3}|--+|please select|pick one)$/i;

function getCurrentValue(el: HTMLElement): string {
  if (el.isContentEditable) return el.textContent?.trim() ?? '';
  const val = (el as HTMLInputElement).value?.trim() ?? '';
  // Some selects have placeholder options with non-empty values (e.g. value="Select ...")
  // Treat these as unset so the field isn't skipped by the allowOverwrite check.
  if (el.tagName === 'SELECT' && PLACEHOLDER_PATTERN.test(val)) return '';
  return val;
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

  const candidates = parent.querySelectorAll('label, span, legend, [class*="label"], [class*="Label"]');
  for (const candidate of Array.from(candidates)) {
    if (!candidate.contains(el)) {
      const text = candidate.textContent?.trim();
      if (text && text.length > 1 && text.length < 120) return text;
    }
  }

  // 5. Grandparent — for deeply nested fields like Workday's custom components
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
  const normAttr = (raw: string) =>
    raw
      .replace(/\[([^\]]+)\]/g, ' $1')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ');
  const name        = normAttr(input.name ?? '');
  const id          = normAttr(el.id ?? '');
  const dataField   = el.getAttribute('data-field') ?? el.getAttribute('data-name') ?? '';

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

function isButtonLike(el: HTMLElement): boolean {
  const role = el.getAttribute('role') ?? '';
  if (role === 'button' || role === 'link' || role === 'menuitem') return true;

  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a') return true;

  const cls = (el.className ?? '').toString().toLowerCase();
  if (
    cls.includes('btn') ||
    cls.includes('button') ||
    cls.includes('attach') ||
    cls.includes('upload') ||
    cls.includes('dropbox') ||
    cls.includes('google-drive') ||
    cls.includes('cloud')
  ) return true;

  return false;
}

// Extract the question text for a radio group by walking up the DOM from one member.
function getRadioGroupLabel(anyMember: HTMLInputElement): string {
  // Strategy 1: enclosing <fieldset> → <legend>
  const fieldset = anyMember.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const text = legend.textContent?.trim() ?? '';
      if (text) return text;
    }
  }

  // Strategy 2: closest [role="group"] with aria-labelledby or aria-label
  const group = anyMember.closest('[role="group"]');
  if (group) {
    const labelledBy = group.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      const text = labelEl?.textContent?.trim() ?? '';
      if (text) return text;
    }
    const ariaLabel = group.getAttribute('aria-label') ?? '';
    if (ariaLabel) return ariaLabel;
  }

  // Strategy 3: walk up looking for a sibling/ancestor that contains the question text.
  // Stop after 5 levels to avoid capturing unrelated page text.
  let el: HTMLElement | null = anyMember.parentElement;
  for (let depth = 0; depth < 5 && el; depth++) {
    const prev = el.previousElementSibling as HTMLElement | null;
    if (prev) {
      const text = prev.textContent?.trim() ?? '';
      if (text && text.length > 4 && text.length < 200) return text;
    }
    const heading = el.querySelector('h1,h2,h3,h4,h5,h6,label,p');
    if (heading && !heading.contains(anyMember)) {
      const text = heading.textContent?.trim() ?? '';
      if (text && text.length > 4 && text.length < 200) return text;
    }
    el = el.parentElement;
  }

  return '';
}

// Detect all radio groups on the page. Returns one DetectedField per group.
function detectRadioGroups(): DetectedField[] {
  const allRadios = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]:not([disabled])')
  ).filter(isVisible);

  const groups = new Map<string, HTMLInputElement[]>();
  for (const radio of allRadios) {
    const name = radio.name || radio.id || Math.random().toString();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(radio);
  }

  const results: DetectedField[] = [];

  for (const [, options] of groups) {
    if (options.length < 2) continue;

    const firstOption = options[0];
    const questionText = getRadioGroupLabel(firstOption);
    if (!questionText) continue;

    const signals = questionText.toLowerCase();
    const match = matchFieldToProfile(signals, 'radio');

    const container: HTMLElement =
      (firstOption.closest('fieldset') as HTMLElement | null) ??
      (firstOption.closest('[role="group"]') as HTMLElement | null) ??
      firstOption.parentElement ??
      firstOption;

    const checkedOption = options.find((r) => r.checked);
    const checkedLabel = checkedOption
      ? (getLabelText(checkedOption) || checkedOption.value)
      : '';

    results.push({
      element: container,
      fieldType: 'radio',
      signals,
      profileKey:   match?.key    ?? null,
      confidence:   match?.confidence ?? 0,
      currentValue: checkedLabel,
      radioOptions: options,
    });
  }

  return results;
}

export function detectFields(): DetectedField[] {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(ALL_SELECTORS));
  const fields: DetectedField[] = [];

  for (const el of elements) {
    if ((el as HTMLInputElement).type === 'radio') continue; // handled by detectRadioGroups below
    if (isButtonLike(el)) continue;

    const tag = el.tagName.toLowerCase();
    if (tag !== 'select' && !isVisible(el)) continue;

    const fieldType    = getFieldType(el);
    const signals      = extractSignals(el);
    const currentValue = getCurrentValue(el);

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

  // Append radio groups after the regular fields
  fields.push(...detectRadioGroups());

  return fields;
}
