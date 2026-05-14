// Content script entry point — injected into every page at document_idle.
// Listens for messages from the popup and delegates to autofill / highlighter.

import type { ContentMessage, ContentResponse } from '../shared/profileTypes';
import { autofillPage, highlightAllFields } from './autofill';
import { clearHighlights } from './highlighter';
import { getProfile } from '../shared/storage';

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse({ success: true } satisfies ContentResponse);
      return true;
    }

    if (message.action === 'autofill') {
      getProfile()
        .then((profile) => {
          const result = autofillPage(profile, message.allowOverwrite ?? false);
          sendResponse({ success: true, result } satisfies ContentResponse);
        })
        .catch((err: unknown) => {
          sendResponse({ success: false, error: String(err) } satisfies ContentResponse);
        });
      return true; // keeps the message channel open for the async response
    }

    if (message.action === 'highlight') {
      getProfile()
        .then((profile) => {
          highlightAllFields(profile);
          sendResponse({ success: true } satisfies ContentResponse);
        })
        .catch((err: unknown) => {
          sendResponse({ success: false, error: String(err) } satisfies ContentResponse);
        });
      return true;
    }

    if (message.action === 'clearHighlights') {
      clearHighlights();
      sendResponse({ success: true } satisfies ContentResponse);
      return true;
    }

    return false;
  }
);
