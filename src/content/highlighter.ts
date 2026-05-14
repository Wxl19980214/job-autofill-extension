// Injects CSS into the page and applies color-coded outlines + tooltips to fields.
// Green = filled, Yellow = suggested (low confidence), Red = ambiguous/unsupported.

import { AUTOFILL_ATTR, TOOLTIP_ATTR, STYLE_ELEMENT_ID } from '../shared/constants';

const HIGHLIGHT_CSS = `
  [${AUTOFILL_ATTR}="filled"] {
    outline: 2px solid #22c55e !important;
    outline-offset: 2px !important;
    background-color: rgba(34, 197, 94, 0.06) !important;
  }
  [${AUTOFILL_ATTR}="suggested"] {
    outline: 2px solid #eab308 !important;
    outline-offset: 2px !important;
    background-color: rgba(234, 179, 8, 0.06) !important;
  }
  [${AUTOFILL_ATTR}="ambiguous"] {
    outline: 2px solid #ef4444 !important;
    outline-offset: 2px !important;
    background-color: rgba(239, 68, 68, 0.06) !important;
  }
  [${TOOLTIP_ATTR}] {
    position: fixed;
    z-index: 2147483647;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 600;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    letter-spacing: 0.01em;
  }
  [${TOOLTIP_ATTR}="filled"]    { background: #22c55e; color: #fff; }
  [${TOOLTIP_ATTR}="suggested"] { background: #eab308; color: #fff; }
  [${TOOLTIP_ATTR}="ambiguous"] { background: #ef4444; color: #fff; }
`;

function ensureStyles() {
  if (!document.getElementById(STYLE_ELEMENT_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = HIGHLIGHT_CSS;
    document.head.appendChild(style);
  }
}

function attachTooltip(
  el: HTMLElement,
  text: string,
  type: 'filled' | 'suggested' | 'ambiguous',
  autoDismissMs?: number
) {
  const tip = document.createElement('div');
  tip.setAttribute(TOOLTIP_ATTR, type);
  tip.textContent = text;
  document.body.appendChild(tip);

  // Position relative to the field using fixed coordinates
  const rect = el.getBoundingClientRect();
  tip.style.top  = `${Math.max(0, rect.top - tip.offsetHeight - 4)}px`;
  tip.style.left = `${rect.left}px`;

  if (autoDismissMs) {
    setTimeout(() => tip.remove(), autoDismissMs);
  }
}

export function highlightFilled(el: HTMLElement, key: string) {
  ensureStyles();
  el.setAttribute(AUTOFILL_ATTR, 'filled');
  attachTooltip(el, `✓ ${key}`, 'filled', 3000);
}

export function highlightSuggested(el: HTMLElement, key: string, previewValue: string) {
  ensureStyles();
  el.setAttribute(AUTOFILL_ATTR, 'suggested');
  const preview = previewValue.length > 28
    ? previewValue.slice(0, 28) + '…'
    : previewValue;
  attachTooltip(el, `? ${key}: "${preview}"`, 'suggested');
}

export function highlightAmbiguous(el: HTMLElement) {
  ensureStyles();
  el.setAttribute(AUTOFILL_ATTR, 'ambiguous');
  attachTooltip(el, '✗ Ambiguous', 'ambiguous');
}

export function clearHighlights() {
  document.querySelectorAll(`[${AUTOFILL_ATTR}]`).forEach((el) =>
    el.removeAttribute(AUTOFILL_ATTR)
  );
  document.querySelectorAll(`[${TOOLTIP_ATTR}]`).forEach((el) => el.remove());
}
