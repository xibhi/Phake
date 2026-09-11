# Phake

[![icon](https://i.ibb.co/21MB24xX/icon.png)](https://ibb.co/21MB24xX)

A Chrome extension (Manifest V3) that fills forms with fake identity data instead of your real information. Also ships an encrypted local vault and disposable email inboxes.

## Features

- Fake identity generation across 15 countries (US, IN, GB, CA, AU, DE, FR, JP, BR, ES, IT, NL, SE, CH, SG)
- Locale-accurate names, emails, phone numbers, addresses, usernames, passwords, birthdates
- Luhn-valid test credit card numbers, country-specific national ID formats
- Automatic form field detection on page load and DOM mutation
- One-click autofill that works on React/Vue/Angular forms, not just plain HTML
- Editable, refreshable identity preview before filling
- Encrypted local credential vault — AES-256-GCM, PBKDF2-SHA256, 100,000 iterations
- One-time Secret Recovery Key for vault recovery if the password's forgotten
- Lose both the password and the key and the vault is unrecoverable, by anyone
- Configurable vault auto-lock (1 / 5 / 15 / 30 min / Never)
- Disposable temp-mail inboxes via GuerrillaMail
- Inboxes persist until you delete them
- Toolbar popup or a draggable in-page overlay (closed Shadow DOM)
- Open the overlay with `Alt+Shift+K` or right-click → "Open Phake here"
- Encrypted `.phake` export/import, keyed off the Secret Recovery Key
- Capped import file size, blocks oversized-file attacks
- "Kaboom" — full local data wipe, gated behind password re-entry
- Adjustable UI density (Comfortable / Compact)
- Update check in Settings → About, compares against the latest release
- Zero analytics, zero telemetry, zero third-party trackers

## Installation

Browser extension, not a package — load it as unpacked from source.

### From source

```bash
git clone https://github.com/xibhi/phake
cd phake
npm install
npm run build
```

Then load it into Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory produced by the build

Requires Node.js `^18.0.0 || ^20.0.0 || >=22.0.0` (Vite 6's own `engines` requirement). Works on any Chromium-based browser.

### Chrome Web Store

Not published yet — planned for a future release. Use the from-source steps for now.

## Quick Start

1. Load the extension (see Installation)
2. Open Phake — toolbar icon, `Alt+Shift+K`, or right-click → "Open Phake here"
3. Visit a page with a form — Phake scans it automatically and reports the field count
4. First time only: set a master password, save the Secret Recovery Key it shows you
5. Review the generated identity, edit or refresh if needed, click Fill
6. The entry saves to your vault automatically, under the Vault tab
7. Any generated email routes to a live inbox under the Inbox tab

## Permissions

No CLI flags to document, so here's the manifest's declared permissions instead:

| Permission | Purpose |
|---|---|
| `storage` | Persist vault, settings, and mailbox data locally |
| `activeTab` | Scan the current tab's DOM for form fields on demand |
| `scripting` | Inject the content script responsible for detection/fill/overlay |
| `contextMenus` | Register the right-click "Open Phake here" entry |
| `host_permissions: <all_urls>` | Form detection/fill on any site; lets the background worker proxy GuerrillaMail requests around page-level CORS |

## Architecture

Full internals, data flow, and security model live in [ARCHITECTURE.md](ARCHITECTURE.md). Short version:

```bash
src/
├── background/
│   └── index.ts               # service worker: messaging, CORS proxy (GuerrillaMail-only allowlisted), auto-lock session state
├── content/
│   ├── index.ts                # content script entry, MutationObserver-driven rescanning
│   ├── detector.ts              # form field detection heuristics
│   ├── filler.ts                 # native-setter + dispatched-event autofill
│   └── overlay.tsx                # closed-Shadow-DOM in-page floating panel
├── lib/
│   ├── crypto.ts                   # AES-256-GCM, PBKDF2, Secret Recovery Key logic
│   ├── storage.ts                    # chrome.storage.local / .session adapters
│   ├── generator.ts                   # locale-aware identity generator
│   ├── guerrillamail.ts                # temp-mail API client
│   ├── phake-export.ts                  # .phake backup export
│   ├── phake-import.ts                   # .phake backup import
│   ├── design-tokens.ts                   # density (Comfortable/Compact) token system
│   ├── types.ts                            # shared TypeScript types
│   ├── logo.ts                              # inline logo/icon rendering
│   ├── version-check.ts                      # update check: semver compare, GitHub Releases + package.json fallback
│   └── locales/                              # per-country identity data
├── manifest.ts                    # Manifest V3 definition
├── assets/                          # icon.png, logo.png
└── popup/
    ├── App.tsx / main.tsx / index.css
    ├── components/                # Card, Header, Modal, Row, SectionHeader, SegmentedControl, BottomNav, AuthVerificationModal
    ├── store/useStore.ts            # Zustand store, auto-lock polling loop
    └── tabs/{Filler,Vault,Inbox,Settings}/
```

Fill flow: content script detects fields → sends a field manifest (selectors only, no page content) → `generator.ts` builds fake values → you review/edit → native fill events dispatch on Fill → entry encrypted (`crypto.ts`) and saved (`storage.ts`).

A few decisions worth a one-liner each:

- CORS proxy lives in the background worker because content scripts are bound by the page's own CSP — hardcoded to GuerrillaMail's endpoint only, not a general proxy
- Overlay uses a closed Shadow DOM so the host page's own scripts can't read it via `element.shadowRoot`
- Vault data is encrypted twice — once under the master password, once under the Secret Recovery Key — so either one alone can unlock it
- `.phake` exports are keyed off the Recovery Key, not the master password, since it's already a high-entropy secret meant to be the last resort
- Master password lives in `chrome.storage.session`, not just a derived key — a deliberate, evaluated tradeoff, not an oversight
- Update check compares version numbers (GitHub Releases, falling back to the default branch's `package.json`), not raw commit activity — a typo-fix commit shouldn't flag as an update
- Update check runs from the background worker, throttled to once an hour, and fails quietly if GitHub's unreachable

## Development

```bash
git clone https://github.com/xibhi/phake
cd phake
npm install
npm run dev         # vite
npm run test        # vitest run
npm run test:watch  # vitest, watch mode
npm run build       # tsc && vite build
npm run preview     # vite preview
```

No CI pipeline or tag-driven release process yet.

## FAQs

**Q. Does any of my data leave my device?**

A. Only two things leave: temp-mail traffic through GuerrillaMail, and a version check against GitHub once an hour. The vault, generated identities, and everything else stay local in `chrome.storage` — no analytics, no telemetry, no third-party trackers.

**Q. What happens if I lose my master password and my Secret Recovery Key?**

A. The vault can't be recovered, by anyone, including the developer.

**Q. Will Phake autofill my real saved passwords into sites I didn't intend?**

A. No — the Filler only generates and fills new synthetic identities, never previously-saved real credentials.

**Q. Do my temp inboxes expire?**

A. Not on Phake's side. GuerrillaMail itself doesn't guarantee indefinite retention, so very old messages may become unreachable.

**Q. Can I move my vault to a new device?**

A. Yes — `.phake` export (master password) / import (Secret Recovery Key of the source vault).

**Q. Does Phake auto-update?**

A. No. Settings → About checks for a newer version (throttled to once an hour) and links to the repo if one's out — you still update manually via `git pull` and rebuild.

## License

This project is licensed under the [MIT License](LICENSE).
