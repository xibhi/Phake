import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

// Ensure Web Crypto API is available in test environment
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}
