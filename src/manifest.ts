import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Phake — Fake Details & Stay Private',
  version: '1.0.0',
  description: 'The internet doesn’t need the real you.',
  action: {
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
    512: 'icons/icon512.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: [
    'storage',
    'activeTab',
    'scripting',
    'contextMenus',
  ],
  host_permissions: [
    '<all_urls>',
  ],
  web_accessible_resources: [
    {
      resources: ['icons/*', 'assets/*'],
      matches: ['<all_urls>'],
    },
  ],
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Alt+Shift+K',
        windows: 'Alt+Shift+K',
        mac: 'Alt+Shift+K',
      },
      description: 'Toggle Phake Floating Panel',
    },
  },
});
