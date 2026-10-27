import { detectFormFields } from './detector';
import { executeFill } from './filler';
import { togglePhakeOverlay, hidePhakeOverlay } from './overlay';
import { BackgroundMessage, FillRequest } from '../lib/types';
import { storage } from '../lib/storage';

// Lock vault session when the user actually refreshes or leaves this webpage
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    storage.clearVaultSession().catch(() => {});
  });
}

// Guard against multiple injections - if already initialized, skip re-registration
if ((window as any).__PHAKE_CONTENT_SCRIPT_LOADED__) {
  // Script was already injected; just ensure overlay toggle still works
  // by re-binding if needed (message listener is idempotent via chrome API)
} else {
  (window as any).__PHAKE_CONTENT_SCRIPT_LOADED__ = true;
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delayMs: number) {
  let timeoutId: any = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

// Initial analysis and cache
let lastAnalysis = detectFormFields();

// Debounced mutation observer to re-analyze on dynamic form loading (e.g. single-page apps)
const notifyAnalysisUpdate = debounce(() => {
  lastAnalysis = detectFormFields();
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'PAGE_ANALYSIS_RESULT',
        payload: lastAnalysis,
      }).catch(() => {});
    }
  } catch {}
}, 400);

const observer = new MutationObserver(() => {
  notifyAnalysisUpdate();
});

if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  });
} else {
  window.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
      });
    }
  });
}

// Listen for messages from popup or background script
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: any, _sender, sendResponse) => {
      if (message.type === 'PAGE_ANALYSIS_REQUEST') {
        lastAnalysis = detectFormFields();
        sendResponse(lastAnalysis);
        return true;
      }

      if (message.type === 'EXECUTE_FILL') {
        const result = executeFill(message.payload as FillRequest);
        sendResponse(result);
        return true;
      }

      if (message.type === 'TOGGLE_PHAKE_OVERLAY') {
        const isVisible = togglePhakeOverlay();
        sendResponse({ success: true, isVisible });
        return true;
      }

      if (message.type === 'HIDE_PHAKE_OVERLAY') {
        hidePhakeOverlay();
        sendResponse({ success: true });
        return true;
      }

      return false;
    }
  );
}
