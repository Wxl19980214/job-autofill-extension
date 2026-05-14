// Handles non-native dropdown components: React-select, ARIA comboboxes,
// Greenhouse custom selects, and other click-to-open menus.
//
// Also handles autocomplete dropdowns (Google Places, typeahead, etc.) that
// appear after text is typed into an input field.
//
// Selection strategy:
//   1. Detect whether the dropdown pre-highlights an item on open (autoFocus).
//   2. Navigate exactly (bestIndex - currentHighlightedIndex) ArrowDowns + Enter.
//      This correctly handles both autoFocus=true and autoFocus=false widgets.
//   3. If the dropdown is still open, click the element the widget highlighted.
//   4. Last resort: direct .click() on the best match element.

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scoreOption(optionText: string, target: string): number {
  const t   = normalize(target);
  const opt = normalize(optionText);
  if (opt === t)                               return 100;
  if (opt.startsWith(t) || t.startsWith(opt)) return 80;
  // Skip substring matches for very short targets (≤2 chars) — "no" in "latino", etc.
  if (t.length > 2 && opt.includes(t))        return 60;
  if (t.includes(opt) && opt.length > 2)       return 40;
  return 0;
}

function deduplicateByText(els: HTMLElement[]): HTMLElement[] {
  const seen = new Set<string>();
  const result: HTMLElement[] = [];
  for (const el of els) {
    const text = el.textContent?.trim() ?? '';
    if (text && !seen.has(text)) { seen.add(text); result.push(el); }
  }
  return result;
}

// Returns the index of whichever option is already highlighted/focused in the list.
// Returns -1 if nothing is pre-highlighted (autoFocus=false).
function getCurrentHighlightedIndex(options: HTMLElement[]): number {
  for (let i = 0; i < options.length; i++) {
    const el = options[i];
    if (
      el.getAttribute('aria-selected') === 'true' ||
      el.getAttribute('aria-current')  === 'true' ||
      el.classList.contains('select__option--is-focused') ||
      el.classList.contains('ui-state-active') ||
      el.classList.contains('is-focused') ||
      el.classList.contains('focused') ||
      el.classList.contains('active')
    ) return i;
  }
  return -1;
}

// Navigate from the current highlight position to bestIndex, then confirm.
// Works for both autoFocus=true (currentIndex ≥ 0) and autoFocus=false (currentIndex = -1).
// All events are fired synchronously so no re-render can happen between ArrowDown and Enter.
function navigateToAndConfirm(keyTarget: HTMLElement, options: HTMLElement[], bestIndex: number) {
  const currentIndex = getCurrentHighlightedIndex(options);
  // If nothing is highlighted: need bestIndex+1 ArrowDowns to land on bestIndex.
  // If item N is already highlighted: need (bestIndex - N) ArrowDowns.
  const arrowCount = bestIndex - currentIndex;

  keyTarget.focus();
  for (let i = 0; i < arrowCount; i++) {
    keyTarget.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown', code: 'ArrowDown', keyCode: 40,
      bubbles: true, cancelable: true,
    }));
  }
  keyTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
  keyTarget.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
}

// Click whatever option the dropdown widget has already marked as focused/active.
function clickActiveOption(): boolean {
  const active = document.querySelector<HTMLElement>([
    'li.ui-state-active',
    '.ui-menu-item-wrapper.ui-state-active',
    '[role="option"][aria-selected="true"]',
    '.select__option--is-focused',
    '[class*="option--is-focused"]',
    '.pac-item-selected',
  ].join(', '));
  if (active && active.offsetParent !== null) { active.click(); return true; }
  return false;
}

// Visible options inside any currently-open custom dropdown
function getVisibleOptions(): HTMLElement[] {
  const OPTION_SELECTORS = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listitem"]',
    '.select__option',
    '[class*="selectOption"]',
    '[class*="Select__option"]',
    '[class*="dropdown__item"]',
    '[class*="dropdownItem"]',
    '[class*="menu-item"]',
    'li[class*="option"]',
    'li[class*="item"]',
  ].join(', ');
  return Array.from(document.querySelectorAll<HTMLElement>(OPTION_SELECTORS)).filter(
    (el) => el.offsetParent !== null
  );
}

// Detect if an element is a custom dropdown TRIGGER (not a native <select> or plain input).
// NOTE: <input> elements with role="combobox" (jQuery UI autocomplete) must NOT be treated
// as custom dropdowns — they go through setNativeValue + handleAutocompleteAfterFill.
export function isCustomDropdown(el: HTMLElement): boolean {
  const tag  = el.tagName.toLowerCase();
  const role = el.getAttribute('role') ?? '';
  const cls  = (el.className ?? '').toString();

  // Native elements handled by their own code paths
  if (tag === 'select' || tag === 'input' || tag === 'textarea') return false;

  if (role === 'combobox' || role === 'listbox') return true;
  if (el.getAttribute('aria-haspopup') === 'listbox') return true;
  if (el.getAttribute('aria-haspopup') === 'true')    return true;

  if (
    cls.includes('select__control') ||
    cls.includes('Select__control') ||
    cls.includes('react-select') ||
    cls.includes('selectControl') ||
    cls.includes('dropdown-toggle') ||
    cls.includes('custom-select')
  ) return true;

  return false;
}

export async function fillCustomDropdown(trigger: HTMLElement, value: string): Promise<boolean> {
  // Step 1: open the dropdown
  const openOpts: MouseEventInit = { bubbles: true, cancelable: true, button: 0, buttons: 1 };
  trigger.dispatchEvent(new MouseEvent('mousedown', openOpts));
  trigger.dispatchEvent(new MouseEvent('mouseup',   openOpts));
  trigger.click();
  await sleep(150);

  // Step 2: look for options WITHOUT typing first.
  // Typing the full value into React-Select's search causes "No options" when
  // apostrophe style or casing differs.  Short-list dropdowns (disability, gender,
  // race …) show all options immediately on open.
  let options = deduplicateByText(getVisibleOptions());

  // Step 3: only type a short keyword if the list is empty (lazy-load / async fields)
  const searchInput = (
    trigger.querySelector<HTMLInputElement>('input[type="text"]') ??
    trigger.querySelector<HTMLInputElement>('input:not([type])')  ??
    (trigger.parentElement?.querySelector<HTMLInputElement>('input') ?? null)
  );

  if (options.length === 0 && searchInput) {
    const keyword = value.split(/[\s,]/)[0].trim(); // first word only — keeps filter broad
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(searchInput, keyword);
    else searchInput.value = keyword;
    searchInput.dispatchEvent(new Event('input',  { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
    options = deduplicateByText(getVisibleOptions());
  }

  // Step 4: find best-matching option
  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < options.length; i++) {
    const score = scoreOption(options[i].textContent?.trim() ?? '', value);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }

  if (bestIndex >= 0 && bestScore >= 40) {
    const keyTarget = searchInput ?? trigger;

    // Attempt 1: smart keyboard navigation accounting for autoFocus state
    navigateToAndConfirm(keyTarget, options, bestIndex);
    await sleep(150);
    if (getVisibleOptions().length === 0) return true;

    // Attempt 2: click whatever the widget visually highlighted
    if (clickActiveOption()) return true;

    // Attempt 3: direct click on best element
    const bestEl = options[bestIndex];
    if (bestEl && bestEl.offsetParent !== null) { bestEl.click(); return true; }
  }

  // Nothing matched — close
  trigger.click();
  return false;
}

// Selectors for autocomplete / suggestion lists that appear after typing
const AUTOCOMPLETE_SELECTORS = [
  '[role="option"]',
  '[role="listitem"]',
  '[role="menuitem"]',
  '.pac-item',
  '.pac-item span',
  '.ui-autocomplete li',
  '.ui-menu-item',
  '.ui-menu-item-wrapper',
  '.tt-suggestion',
  '.tt-selectable',
  '[class*="suggestion"]',
  '[class*="Suggestion"]',
  '[class*="autocomplete-item"]',
  '[class*="AutocompleteItem"]',
  '[class*="typeahead"]',
  '[class*="combobox-option"]',
  '[class*="dropdown-item"]',
  '[class*="DropdownItem"]',
  'ul[class*="results"] li',
  'ul[class*="options"] li',
  'ul[class*="autocomplete"] li',
].join(', ');

function getAutocompleteSuggestions(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(AUTOCOMPLETE_SELECTORS)).filter(
    (el) => el.offsetParent !== null
  );
}

/**
 * Call this after setting the value of a text input.
 * Waits for an autocomplete suggestion list, then navigates to the best match
 * using smart ArrowDown navigation that accounts for pre-highlighted items.
 */
export async function handleAutocompleteAfterFill(
  input: HTMLElement,
  value: string,
  maxRetries = 6,
  waitPerRetryMs = 250,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(waitPerRetryMs);

    const raw = getAutocompleteSuggestions();
    if (raw.length === 0) continue;

    const suggestions = deduplicateByText(raw);
    let bestIndex = -1;
    let bestScore = 0;
    for (let i = 0; i < suggestions.length; i++) {
      const score = scoreOption(suggestions[i].textContent?.trim() ?? '', value);
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    }

    if (bestIndex < 0 || bestScore < 40) {
      // Suggestions appeared but nothing matched — dismiss and keep typed value
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Escape', bubbles: true }));
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1 }));
      return;
    }

    input.focus();

    // Attempt 1: smart keyboard navigation (accounts for autoFocus pre-highlighting)
    navigateToAndConfirm(input, suggestions, bestIndex);
    await sleep(150);
    if (getAutocompleteSuggestions().length === 0) return;

    // Attempt 2: click the widget's own highlighted element
    if (clickActiveOption()) return;

    // Attempt 3: direct click on best element
    const bestEl = suggestions[bestIndex];
    if (bestEl && bestEl.offsetParent !== null) { bestEl.click(); return; }

    return;
  }
}
