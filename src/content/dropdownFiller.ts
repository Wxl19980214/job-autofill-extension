// Handles non-native dropdown components: React-select, ARIA comboboxes,
// Greenhouse custom selects, and other click-to-open menus.
//
// Also handles autocomplete dropdowns (Google Places, typeahead, etc.) that
// appear after text is typed into an input field — if a dropdown appears we
// either click the best matching option or dismiss it so our typed value stays.
//
// Strategy for explicit dropdowns:
//  1. Click the trigger to open the dropdown
//  2. Optionally type into a search box to filter options
//  3. Find the best-matching option in the resulting list
//  4. Click it
//
// Strategy for autocomplete-after-type:
//  1. Wait for the suggestion list to appear in the DOM
//  2. Find the best match; click it if score is good enough
//  3. If no good match, dismiss with Escape so our typed text stays

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
  if (opt.includes(t))                         return 60;
  if (t.includes(opt) && opt.length > 2)       return 40;
  return 0;
}

// Returns currently visible option elements from any open dropdown
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
    (el) => el.offsetParent !== null // only visible
  );
}

// Detect if an element is a custom dropdown trigger (not a native <select>)
export function isCustomDropdown(el: HTMLElement): boolean {
  const tag  = el.tagName.toLowerCase();
  const role = el.getAttribute('role') ?? '';
  const cls  = (el.className ?? '').toString();

  if (tag === 'select') return false; // native — handled elsewhere

  if (role === 'combobox' || role === 'listbox') return true;
  if (el.getAttribute('aria-haspopup') === 'listbox') return true;
  if (el.getAttribute('aria-haspopup') === 'true')    return true;

  // React-select and similar component class patterns
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
  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  trigger.click();
  trigger.dispatchEvent(new MouseEvent('mouseup',  { bubbles: true }));

  await sleep(250); // wait for dropdown to render

  // Step 2: if there's a search/filter input, type the value to narrow options
  const searchInput = (
    trigger.querySelector<HTMLInputElement>('input[type="text"]') ??
    trigger.querySelector<HTMLInputElement>('input:not([type])')  ??
    // React-select puts the input in a sibling container
    (trigger.parentElement?.querySelector<HTMLInputElement>('input') ?? null)
  );

  if (searchInput) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (setter) setter.call(searchInput, value);
    else searchInput.value = value;
    searchInput.dispatchEvent(new Event('input',  { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200); // wait for list to filter
  }

  // Step 3: find best option
  const options = getVisibleOptions();
  let bestEl: HTMLElement | null = null;
  let bestScore = 0;

  for (const opt of options) {
    const text  = opt.textContent?.trim() ?? '';
    const score = scoreOption(text, value);
    if (score > bestScore) {
      bestScore = score;
      bestEl    = opt;
    }
  }

  if (bestEl && bestScore >= 40) {
    bestEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    bestEl.click();
    bestEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  }

  // Close the dropdown if nothing matched
  trigger.click();
  return false;
}

// Selectors for autocomplete / suggestion lists that appear after typing
const AUTOCOMPLETE_SELECTORS = [
  '[role="option"]',
  '[role="listitem"]',
  '[role="menuitem"]',
  // Google Places Autocomplete
  '.pac-item',
  '.pac-item span',
  // jQuery UI Autocomplete (used by Greenhouse for school typeahead)
  '.ui-autocomplete li',
  '.ui-menu-item',
  '.ui-menu-item-wrapper',
  // Twitter Typeahead / Bloodhound
  '.tt-suggestion',
  '.tt-selectable',
  // Generic patterns
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
 * If an autocomplete/suggestion dropdown appears, we click the best match.
 * If nothing useful appears, we dismiss it so our typed value stays intact.
 *
 * Retries up to maxRetries times so slow server-side typeaheads (like
 * Greenhouse's school lookup) have enough time to return results.
 */
export async function handleAutocompleteAfterFill(
  input: HTMLElement,
  value: string,
  maxRetries = 3,
  waitPerRetryMs = 500,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(waitPerRetryMs);

    const suggestions = getAutocompleteSuggestions();
    if (suggestions.length === 0) continue; // not appeared yet — retry

    let bestEl: HTMLElement | null = null;
    let bestScore = 0;

    for (const s of suggestions) {
      const text  = s.textContent?.trim() ?? '';
      const score = scoreOption(text, value);
      if (score > bestScore) {
        bestScore = score;
        bestEl    = s;
      }
    }

    if (bestEl && bestScore >= 40) {
      // Good match found — click it and we're done
      bestEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      bestEl.click();
      return;
    }

    // Suggestions appeared but nothing good matched — dismiss and stop
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return;
  }
  // maxRetries reached with no suggestions — field was a plain input, nothing to do
}
