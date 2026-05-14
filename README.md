# Job Autofill Chrome Extension

A Manifest V3 Chrome extension that detects and fills job application form fields using your saved profile. Works on Workday, Greenhouse, Lever, Ashby, SmartRecruiters, LinkedIn, and most standard HTML forms.

**Key safety rules:**
- Never auto-submits anything — you always review before clicking Submit
- Only fills after you click a button
- Never fabricates information
- Never stores sensitive data (SSN, passport, bank details, passwords)

---

## Architecture

```
src/
├── shared/
│   ├── profileTypes.ts   — TypeScript interfaces (UserProfile, DetectedField, etc.)
│   ├── constants.ts      — Confidence thresholds, storage keys, CSS attr names
│   ├── matchingRules.ts  — Regex rules mapping field signals → profile keys
│   └── storage.ts        — chrome.storage.local helpers + default profile
│
├── content/
│   ├── index.ts          — Entry point; listens for popup messages
│   ├── fieldDetector.ts  — Scans DOM for fillable fields, extracts label/name/placeholder signals
│   ├── fieldMatcher.ts   — Scores signal strings against matching rules → confidence (0–1)
│   ├── autofill.ts       — Orchestrates detection → filling → highlighting
│   └── highlighter.ts    — Injects CSS outlines and tooltips onto matched fields
│
├── popup/
│   ├── index.html        — Extension popup entry point
│   ├── main.tsx          — React root mount
│   └── Popup.tsx         — Three action buttons + status banner
│
├── options/
│   ├── index.html        — Full-page settings entry point
│   ├── main.tsx          — React root mount
│   └── Options.tsx       — Editable form for all profile fields
│
└── background/
    └── background.ts     — MV3 service worker; seeds storage on install
```

### How field detection works

1. `fieldDetector.ts` queries all `input`, `textarea`, `select`, and `[contenteditable]` elements
2. For each element it builds a **signals string** from: associated `<label>` text, `aria-label`, `placeholder`, `name`, `id`, and `data-*` attributes
3. `fieldMatcher.ts` tests each signal string against the regex rules in `matchingRules.ts`
4. Each matched rule returns a **confidence score** (0–1)
5. Confidence ≥ 0.70 → fill automatically; 0.30–0.69 → highlight yellow (review); < 0.30 → skip

### Visual feedback

| Color  | Meaning                                      |
|--------|----------------------------------------------|
| 🟢 Green  | Field was filled automatically              |
| 🟡 Yellow | Detected but low confidence — review before submitting |
| 🔴 Red    | Detected but ambiguous — not filled         |

---

## Prerequisites

- [Node.js](https://nodejs.org) v18+ (LTS recommended)
- Google Chrome

---

## Installation & Development

```bash
# 1. Install dependencies
npm install

# 2. Build (one-time)
npm run build

# 3. Watch mode for development (rebuilds on save)
npm run dev
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder inside this project
5. The "Job Autofill" extension icon appears in your toolbar

After each `npm run build` / `npm run dev` rebuild, click the **↺ refresh** icon on the extension card in `chrome://extensions` to reload it.

---

## Usage

1. Navigate to a job application page
2. Click the **Job Autofill** toolbar icon
3. Choose an action:
   - **Autofill Current Page** — fills high-confidence fields immediately
   - **Highlight Detected Fields** — shows color-coded detection results without filling
   - **Clear Highlights** — removes all overlays
   - **Open Profile Settings** — edit your profile data

4. Review yellow-highlighted fields manually before submitting

---

## Editing Your Profile

Open **Profile Settings** (from the popup or `chrome://extensions` → Details → Extension options).

Your data is stored with `chrome.storage.local` — it never leaves your browser.

---

## Future Enhancements (not yet implemented)

- Per-company saved answers
- Resume file upload support
- LLM-assisted free-text answer generation
- Site-specific adapters (Workday shadow DOM, Greenhouse React forms, Lever)
- Export / import profile as JSON
- Local encryption / passphrase protection

---

## Supported Profile Fields

| Category   | Fields |
|------------|--------|
| Personal   | First/Last/Full name, Email, Phone, City, State, Location, LinkedIn, Website, Portfolio |
| Work       | Current company, Title, Years exp, Desired role, Locations, Relocation, Work auth, Sponsorship |
| Education  | School, Degree, Major, Graduation year |
| Answers    | About yourself, Why interested, How you use AI |
