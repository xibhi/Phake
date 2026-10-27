# Phake Architecture

This covers how Phake's pieces fit together, in more depth than the README. Read this before touching `crypto.ts`, `background/index.ts`, or the overlay.

## The three execution contexts

A Manifest V3 extension runs in three isolated JS contexts that can only talk to each other through message passing:

- **Background service worker** (`background/index.ts`) — no DOM, no page access, runs as long as it's needed and is killed/restarted by Chrome otherwise. Owns the CORS proxy to GuerrillaMail and cross-tab session state.
- **Content script** (`content/index.ts`, `detector.ts`, `filler.ts`, `overlay.tsx`) — injected into every page (`matches: ["<all_urls>"]`), runs in the page's own origin and DOM, subject to that page's CSP.
- **Popup** (`popup/`) — the toolbar UI, a fully separate page context, torn down every time it closes (state doesn't survive a close unless it's persisted).

Nothing here can call another context's functions directly — everything crosses these boundaries as serialized messages (`chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`).

## Data flow: a fill action

1. Content script (`detector.ts`) scans the page's DOM for form fields on load, and re-scans on `MutationObserver` events for dynamically-injected forms.
2. It reports a field manifest to the popup/overlay — field types and CSS selectors only, never the page's actual content or values.
3. `lib/generator.ts` produces a locale-matched synthetic identity from that manifest, using the country set in Settings (or overridden for the session).
4. You review/edit the generated preview in the popup or overlay.
5. On Fill, the values are sent back to the content script, which maps them to the original selectors.
6. `filler.ts` writes each value using the native input property setter (not `.value =`, which controlled React/Vue/Angular inputs will silently reject) and dispatches `input`, `change`, and `blur` events so the page's own framework picks up the change.
7. On success, the filled entry is encrypted (`lib/crypto.ts`) and persisted to the vault (`lib/storage.ts`).

## Vault & encryption model

- **Key derivation**: PBKDF2-SHA256, 100,000 iterations, unique random salt per vault.
- **Encryption**: AES-256-GCM, unique random IV per entry — never a reused IV under the same key.
- **Two independently-encrypted copies of vault data** exist: one keyed off the day-to-day master password, one keyed off the Secret Recovery Key. This is what makes password recovery possible without ever storing the master password in a recoverable form.
- **Secret Recovery Key**: a 24-character key (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`), generated once at vault setup, shown exactly once. It's hashed separately for verification, and encrypted-at-rest for the Settings "reveal" screen. Losing both the master password and this key makes the vault permanently unrecoverable — there is no backdoor.
- **Master password storage**: held in `chrome.storage.session`, not just a derived key. MV3 session storage is process-isolated to the extension's own contexts and cleared on browser restart. Storing only a derived, non-extractable key would be marginally stronger defense-in-depth; this was evaluated and not treated as a required fix.
- **Auto-lock**: a 2000ms polling loop in `popup/store/useStore.ts` checks elapsed idle time against the configured timeout (1/5/15/30 min/Never). "Never" still locks on a full browser restart, since the session key doesn't survive that regardless.

## `.phake` backup format

- Export/import is keyed off the **Secret Recovery Key**, not the master password — the Recovery Key is already a high-entropy random secret meant to be the last resort, so reusing it avoids forcing a second password just for backups.
- Encrypted with the same AES-256-GCM scheme as the vault itself.
- Includes an HMAC signature — used only for fast file-format identification (rejecting a corrupt/wrong file quickly), **not** as a security mechanism. The real protection is the AES-256-GCM encryption underneath.
- Import file size is capped before parsing, to prevent an oversized file from being used as a denial-of-service vector against the parser.

## The GuerrillaMail CORS proxy

Content scripts run in the page's own origin and are bound by that page's CSP/CORS rules — they can't freely call an arbitrary third-party API. The background service worker has `<all_urls>` host permission and isn't subject to page CSP, so it proxies GuerrillaMail requests on the content script/popup's behalf.

This proxy is **hardcoded to GuerrillaMail's exact API endpoint only** — it does not forward arbitrary URLs. An earlier version did forward arbitrary URLs, which is a real SSRF pattern for any extension doing CORS proxying (a malicious page could potentially get the extension's elevated background context to make requests on its behalf). That was identified and fixed; keep this constraint in mind if the proxy is ever extended to a second mail provider.

## The overlay's Shadow DOM

The in-page floating overlay (`content/overlay.tsx`) renders inside a Shadow DOM with `mode: 'closed'`. An `open` shadow root can be read by the host page's own scripts via `element.shadowRoot`, which would let any page's JS inspect Phake's overlay DOM. Closed mode blocks that — the tradeoff is that Phake's own code has to hold its own internal reference to the shadow root, since it can't be looked up externally either.

The overlay is draggable, clamped so it can't be dragged off-screen, and Escape closes it — but Escape first cancels any active inline edit or open modal before closing the overlay itself, so you don't lose in-progress input by accident.

## The update check

`lib/version-check.ts`, invoked from the background worker (`background/index.ts`), not the popup — so a check can run without the popup being open, and doesn't need a new manifest permission since the worker already has `<all_urls>`.

- Compares actual version numbers, not commit activity: primary source is GitHub Releases, falling back to the default branch's `package.json` if no release exists yet. A typo-fix commit landing on `main` shouldn't make Phake think there's an update.
- Throttled to once an hour, tracked in extension storage, so opening the popup repeatedly doesn't hammer GitHub's API.
- Fails quietly on any network error or non-200 response — surfaces as a neutral "couldn't check" state in Settings → About, never a scary error.
- Clicking an available update in Settings → About opens the GitHub repo in a new tab. Phake never downloads or applies anything itself — there's no auto-update.

## Known tradeoffs / not-yet-hardened areas

- Test coverage exists for `crypto.ts`, `generator.ts`, `detector.ts`, `version-check.ts`, and `manifest.ts` (`npm run test`); nothing yet for `filler.ts`, the overlay, or popup/vault flows end-to-end (see `CONTRIBUTING.md`).
- No ESLint config.
- The internal security pass that found and fixed the SSRF-proxy, open-Shadow-DOM, weak email-HTML-sanitization, unbounded-import-size, non-constant-time-comparison, and `Math.random()`-in-password-generation issues was done internally — not by an independent third-party auditor.

## Directory reference

```
src/
├── background/index.ts        # service worker: GuerrillaMail CORS proxy, cross-tab session state
├── content/
│   ├── index.ts                 # entry point, MutationObserver-driven rescanning
│   ├── detector.ts               # form field detection heuristics
│   ├── filler.ts                  # native-setter + dispatched-event autofill
│   └── overlay.tsx                 # closed-Shadow-DOM in-page floating panel
├── lib/
│   ├── crypto.ts                    # AES-256-GCM, PBKDF2, Secret Recovery Key logic
│   ├── storage.ts                     # chrome.storage.local / .session adapters
│   ├── generator.ts                    # locale-aware identity generator
│   ├── guerrillamail.ts                  # temp-mail API client
│   ├── phake-export.ts                    # .phake backup export
│   ├── phake-import.ts                     # .phake backup import
│   ├── design-tokens.ts                     # density (Comfortable/Compact) token system
│   ├── types.ts                              # shared TypeScript types
│   ├── logo.ts                                # inline logo/icon rendering
│   ├── version-check.ts                        # update check: semver compare, GitHub Releases + package.json fallback
│   └── locales/                                 # per-country identity data
├── manifest.ts                    # Manifest V3 definition
├── assets/                          # icon.png, logo.png
└── popup/
    ├── App.tsx / main.tsx / index.css
    ├── components/                 # Card, Header, Modal, Row, SectionHeader, SegmentedControl, BottomNav, AuthVerificationModal
    ├── store/useStore.ts            # Zustand store, auto-lock polling loop
    └── tabs/
        ├── Filler/
        ├── Vault/
        ├── Inbox/
        └── Settings/
```
