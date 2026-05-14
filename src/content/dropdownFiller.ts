// Handles non-native dropdown components: React-select, ARIA comboboxes,
// Greenhouse custom selects, and other click-to-open menus.
//
// Strategy:
//  1. Click the trigger to open the dropdown
//  2. Optionally type into a search box to filter options
//  3. Find the best-matching option in the resulting list
//  4. Click it

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
