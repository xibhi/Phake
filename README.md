# Phake

[![icon](https://i.ibb.co/21MB24xX/icon.png)](https://ibb.co/21MB24xX)

**Phake** is a lightweight, zero-telemetry Manifest V3 Chrome extension that synthesizes locale-accurate fake identities on the fly, auto-detects form inputs, and locks generated credentials inside a local AES-256 encrypted vault.

---

## Features

- **Synthetic identity engine** — Generates realistic, locale-valid profiles across 15 countries with matching names, phone numbers, addresses, Luhn-valid cards, and national IDs.
- **Framework-aware autofill** — Scans DOM on load and mutation, dispatching native input events directly into React, Vue, and Angular forms.
- **Isolated floating overlay** — Mounts via a closed Shadow DOM (`Alt+Shift+K`) so host page scripts cannot inspect, read, or tamper with extension state.
- **Disposable inboxes** — Built-in GuerrillaMail temp inboxes to catch verification codes and activation links without leaving the page.
- **Zero-knowledge vault** — Credentials encrypt locally with AES-256-GCM and PBKDF2 (100,000 iterations), guarded by a master passphrase and a one-time Secret Recovery Key.

---

## Install

```bash
git clone https://github.com/xibhi/phake.git
cd phake
npm install
npm run build
```

Load into Chrome:
1. Navigate to `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `dist/` directory.

---

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

---

## FAQ

**Does any personal data leave the browser?**  
No. Profile generation, credential storage, and encryption run entirely in local storage. Outgoing network requests are restricted to GuerrillaMail API calls and hourly GitHub release checks.

**How does the overlay protect against malicious host scripts?**  
The overlay renders inside a closed `ShadowRoot`. Host page JavaScript cannot access its internal DOM tree via `element.shadowRoot` or query selectors.

**What happens if I lose the master password?**  
The vault can be recovered using the one-time Secret Recovery Key generated during initial setup. If both the password and recovery key are lost, the vault is cryptographically unrecoverable.

**Will Phake overwrite real saved passwords?**  
No. Phake only generates and injects synthetic test personas. It does not access or store real browser credentials.

**Can I move my vault to another machine?**  
Yes. Export an encrypted `.phake` backup keyed to your Secret Recovery Key and import it on the target machine.

---

## License

This project is licensed under the [MIT License](LICENSE).
