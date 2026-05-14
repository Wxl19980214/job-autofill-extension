# Job Autofill Chrome Extension

## What this is
A Manifest V3 Chrome extension that autofills job application forms (Workday, Greenhouse, Lever, Ashby, etc.) with Xilin's saved profile. Never auto-submits — user must click the button.

## Tech stack
- TypeScript + React 18 + Vite
- `vite-plugin-web-extension` for MV3 bundling
- `chrome.storage.local` for profile persistence
- No external runtime dependencies

## Build commands
```
npm run build       # one-time build → dist/
npm run dev         # watch mode (rebuild on save)
npm run typecheck   # type-check without emitting
```

To load in Chrome: go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `dist/` folder.

## Project structure
```
src/
  background/       # service worker
  content/          # injected into every page
    index.ts        # message listener entry point
    autofill.ts     # orchestrates filling
    fieldDetector.ts
    fieldMatcher.ts
    dropdownFiller.ts
    highlighter.ts
  popup/            # toolbar button UI (React)
  options/          # profile settings page (React)
  shared/
    profileTypes.ts # UserProfile interface, DetectedField, etc.
    matchingRules.ts
    storage.ts
    constants.ts
manifest.json
vite.config.ts
```

## Key constraints
- Never auto-submit forms
- Never fabricate data; never fill SSN, passport, bank fields
- Fill high-confidence fields automatically; highlight low-confidence ones
- `allowOverwrite` flag controls whether already-filled fields get overwritten

## Profile data (Xilin Wang)
Stored in `chrome.storage.local`. Pre-populated defaults live in `src/options/Options.tsx`.
- Name: Xilin Wang | Email: stinsionwang@gmail.com | Phone: +1 734-968-8779
- Location: Austin, Texas | Country: United States
- LinkedIn: https://www.linkedin.com/in/xilin-wang-37652b188/
- Current: Apple (via Infosys), Software Engineer
- Work auth: H1B, requires sponsorship
- Education: M.S. CS UMich 2023, B.S. CS UCSB 2020
- EEO: Asian, Male, not a veteran, no disability

## iframe handling
Many job boards (Greenhouse embeds, etc.) load the form in a cross-origin iframe. The content script runs in all frames (`all_frames: true`). The top frame silently returns `false` when it has no fillable fields so the iframe with the real form can respond.
