// @vitest-environment node
import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('Extension Manifest Commands (Shortcut Registration)', () => {
  it('1. should define _execute_action command for overlay toggle', () => {
    expect(manifest.commands).toBeDefined();
    expect(manifest.commands?._execute_action).toBeDefined();
  });

  it('2. should specify Alt+Shift+K as suggested_key without Ctrl+Alt conflict', () => {
    const suggested = manifest.commands?._execute_action?.suggested_key;
    expect(suggested).toBeDefined();
    expect(suggested?.default).toBe('Alt+Shift+K');
    expect(suggested?.windows).toBe('Alt+Shift+K');
    expect(suggested?.mac).toBe('Alt+Shift+K');
  });

  it('3. complies strictly with Chrome commands API requirements', () => {
    const keys = [
      manifest.commands?._execute_action?.suggested_key?.default,
      manifest.commands?._execute_action?.suggested_key?.windows,
      manifest.commands?._execute_action?.suggested_key?.mac,
    ];

    for (const key of keys) {
      expect(key).toBeDefined();
      const parts = key!.split('+');
      
      // Must contain Ctrl or Alt (or Command/MacCtrl on mac)
      const hasPrimaryModifier = parts.some((p) => ['Ctrl', 'Alt', 'Command', 'MacCtrl'].includes(p));
      expect(hasPrimaryModifier).toBe(true);

      // Must NOT contain BOTH Ctrl and Alt simultaneously (avoids AltGr conflict)
      const hasCtrl = parts.includes('Ctrl');
      const hasAlt = parts.includes('Alt');
      expect(hasCtrl && hasAlt).toBe(false);

      // Final part must be a valid key
      const mainKey = parts[parts.length - 1];
      expect(mainKey).toMatch(/^[A-Z0-9]$|^Comma$|^Period$|^Home$|^End$|^PageUp$|^PageDown$|^Space$|^Insert$|^Delete$|^Up$|^Down$|^Left$|^Right$/);
    }
  });
});
