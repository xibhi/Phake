import { BackgroundMessage } from '../lib/types';
import { storage } from '../lib/storage';
import { GUERRILLA_BASE } from '../lib/guerrillamail';
import { checkForExtensionUpdates } from '../lib/version-check';

// In-memory session key store for active vault session
let sessionKey: CryptoKey | null = null;
let lastSessionActivity: number = Date.now();
let autoLockMinutes: number = 5;

// Listen for messages across the extension
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse) => {
    // Check auto-lock expiration
    if (autoLockMinutes > 0 && sessionKey) {
      const elapsedMinutes = (Date.now() - lastSessionActivity) / 60000;
      if (elapsedMinutes >= autoLockMinutes) {
        sessionKey = null;
      }
    }

    switch (message.type) {
      case 'SET_VAULT_SESSION_KEY': {
        sessionKey = message.payload?.key || null;
        autoLockMinutes = message.payload?.autoLockMinutes ?? 5;
        lastSessionActivity = Date.now();
        sendResponse({ success: true });
        return true;
      }

      case 'GET_VAULT_SESSION_KEY': {
        lastSessionActivity = Date.now();
        sendResponse({
          hasActiveKey: Boolean(sessionKey),
          key: sessionKey,
        });
        return true;
      }

      case 'CLEAR_VAULT_SESSION_KEY': {
        sessionKey = null;
        sendResponse({ success: true });
        return true;
      }

      case 'NAVIGATE_TO': {
        chrome.runtime.sendMessage(message).catch(() => {});
        sendResponse({ success: true });
        return true;
      }

      case 'API_PROXY_REQUEST': {
        const { url, options } = message.payload || {};

        // SEC-01: Strictly validate that destination URL matches the Guerrilla Mail endpoint
        if (typeof url !== 'string' || !url.startsWith(GUERRILLA_BASE)) {
          sendResponse({ success: false, error: 'Destination URL not permitted' });
          return true;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        fetch(url, { ...options, signal: controller.signal })
          .then(async (res) => {
            clearTimeout(timeoutId);
            const status = res.status;
            const ok = res.ok;
            const statusText = res.statusText;
            let data: any = null;
            if (status !== 204) {
              const text = await res.text();
              try {
                data = JSON.parse(text);
              } catch {
                data = text;
              }
            }
            sendResponse({ success: true, status, ok, statusText, data });
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            sendResponse({ success: false, error: err.message || 'Fetch failed' });
          });
        return true;
      }

      case 'CHECK_FOR_UPDATES': {
        const force = Boolean(message.payload?.force);
        const currentVersion =
          typeof chrome !== 'undefined' && chrome.runtime?.getManifest
            ? chrome.runtime.getManifest().version
            : '1.0.0';

        checkForExtensionUpdates(currentVersion, force)
          .then((info) => {
            sendResponse({ success: true, info });
          })
          .catch((err) => {
            sendResponse({
              success: false,
              error: err?.message || 'Update check failed',
              info: {
                status: 'failed',
                updateAvailable: false,
                lastCheckedAt: Date.now(),
                lastKnownRemoteVersion: null,
                updateUrl: 'https://github.com/xibhi/phake',
              },
            });
          });
        return true;
      }

      default:
        break;
    }

    return false;
  }
);

/**
 * Robust overlay toggler that auto-injects compiled scripts if not already present on the tab.
 * Uses retry logic with increasing delays to handle race conditions where the content script
 * may not have fully registered its message listener yet.
 */
async function toggleOverlayOnTab(tabId: number, tabUrl?: string) {
  if (
    tabUrl &&
    (tabUrl.startsWith('chrome://') ||
      tabUrl.startsWith('edge://') ||
      tabUrl.startsWith('chrome-extension://') ||
      tabUrl.startsWith('about:') ||
      tabUrl.startsWith('view-source:'))
  ) {
    return;
  }

  // Helper to send toggle message with a single attempt
  const sendToggle = async (): Promise<boolean> => {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PHAKE_OVERLAY' });
      return response !== undefined;
    } catch {
      return false;
    }
  };

  // 1. Try sending toggle message to already running content script
  if (await sendToggle()) return;

  // 2. Fallback: dynamically inject compiled manifest content scripts
  try {
    const manifest = chrome.runtime.getManifest();
    const contentScripts = manifest.content_scripts;
    if (contentScripts && contentScripts.length > 0) {
      for (const cs of contentScripts) {
        if (cs.js) {
          for (const file of cs.js) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: [file],
            });
          }
        }
      }

      // Retry with increasing delays to handle slow script initialization
      const delays = [100, 200, 400];
      for (const delay of delays) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (await sendToggle()) return;
      }

      console.warn('Phake: All retry attempts to toggle overlay failed');
    }
  } catch (injectErr) {
    console.warn('Dynamic script injection failed', injectErr);
  }
}

// Toggle floating in-page overlay when toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await toggleOverlayOnTab(tab.id, tab.url);
});

// Handle context menu clicks to toggle overlay on active tab
if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'phake_toggle_overlay' && tab?.id) {
      await toggleOverlayOnTab(tab.id, tab.url);
    }
  });
}

// Auto-inject into all open web tabs on extension install or reload, and register context menu
chrome.runtime.onInstalled.addListener(async () => {
  // Create context menu item
  try {
    if (typeof chrome !== 'undefined' && chrome.contextMenus) {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'phake_toggle_overlay',
          title: 'Open Phake here',
          contexts: ['all'],
        });
      });
    }
  } catch (menuErr) {
    console.warn('Context menu creation failed', menuErr);
  }

  try {
    const manifest = chrome.runtime.getManifest();
    const contentScripts = manifest.content_scripts;
    if (!contentScripts) return;

    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      for (const cs of contentScripts) {
        if (cs.js) {
          for (const file of cs.js) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: [file],
              });
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn('Auto-injection on install failed', err);
  }
});
