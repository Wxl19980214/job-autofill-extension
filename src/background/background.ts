// Manifest V3 service worker — handles installation lifecycle only.
// All active logic runs in the content script; the background is kept minimal
// to avoid MV3 service-worker lifetime pitfalls.

import { saveProfile, getProfile, DEFAULT_PROFILE } from '../shared/storage';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    // Seed storage with the default profile on first install
    const existing = await getProfile();
    const isEmpty = Object.entries(existing).every(([k, v]) => {
      const def = DEFAULT_PROFILE[k as keyof typeof DEFAULT_PROFILE];
      return v === def;
    });
    if (isEmpty) {
      await saveProfile(DEFAULT_PROFILE);
    }
    // Open profile settings page so the user can review/update defaults
    chrome.runtime.openOptionsPage();
  }
});
