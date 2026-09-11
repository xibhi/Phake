# Contributing to Phake

## Getting set up

```
git clone https://github.com/xibhi/phake
cd phake
npm install
npm run dev
```

`npm run dev` starts Vite. For the actual extension behavior (background service worker, content script injection, `chrome.storage`), you need to build and load it as an unpacked extension:

```
npm run build
```

Then `chrome://extensions` → Developer mode → Load unpacked → select `dist/`. Reload the extension from that page after each rebuild.

Requires Node.js `^18.0.0 || ^20.0.0 || >=22.0.0` (Vite 6's own engines requirement).

## Before you open a PR

- Run `npm run build` and confirm it completes without TypeScript errors (`tsc && vite build` — the build itself is the type check, since there's no separate `tsc --noEmit` step wired up yet).
- Run `npm run test` and make sure everything's green before you push.
- Load the built extension and manually verify the flow you touched (Filler / Vault / Inbox / Settings) — the test suite covers crypto, the identity generator, and form detection, but there's no end-to-end coverage of the actual popup/overlay flows yet.
- Keep PRs scoped to one thing. A vault fix and a UI tweak in the same PR is harder to review.

## Coding conventions

- TypeScript throughout `src/`, functional React components, Zustand for state (`popup/store/useStore.ts`).
- Match the file's existing patterns before introducing a new one — e.g. new vault-related logic goes through `lib/crypto.ts` and `lib/storage.ts`, not a fresh ad hoc encryption call.
- No new dependencies for something a few lines of code can do. Check what's already in `package.json` first.
- Follow the existing dark/monochrome UI system (`lib/design-tokens.ts`) rather than hardcoding new colors or spacing.

## Where to help

- **Test coverage** — `crypto.ts`, `generator.ts`, `detector.ts`, `version-check.ts`, and `manifest.ts` are covered (`npm run test`). `filler.ts`, the overlay, and popup/vault flows aren't yet — end-to-end coverage of an actual fill or vault unlock is the next high-value addition.
- **Linting** — no ESLint config exists yet. Adding one (and fixing what it flags) is welcome.
- **New locales** — the identity generator (`lib/locales/`) currently covers 15 countries; adding more follows the existing pattern.
- **Security review** — see `ARCHITECTURE.md` for the current threat model and known tradeoffs. If you find something, see "Reporting a vulnerability" below before opening a public issue.

## Reporting a bug

Open a GitHub issue with:
- What you did, what you expected, what happened instead
- Browser + version
- Console errors from the extension's background service worker and/or content script context (`chrome://extensions` → Phake → "service worker" → Inspect)

## Reporting a vulnerability

Vault encryption, the Secret Recovery Key, and the background CORS proxy are the sensitive surfaces. If you find a real security issue in any of these, please don't open a public issue first — reach out privately so it can be fixed before it's disclosed.

## License

By contributing, you agree your contribution is licensed under the same license as the rest of the repo (MIT — see `LICENSE`).
