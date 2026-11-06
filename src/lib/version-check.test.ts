import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSemver,
  compareSemver,
  checkForExtensionUpdates,
  fetchRemoteVersion,
  UPDATE_CHECK_INTERVAL_MS,
  GITHUB_REPO_URL,
} from './version-check';
import { storage } from './storage';
import { UpdateCheckInfo } from './types';

describe('Version Comparison and Update Check (src/lib/version-check.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseSemver', () => {
    it('1. correctly parses standard semver strings and strips v prefix', () => {
      expect(parseSemver('1.0.0')).toEqual([1, 0, 0]);
      expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
      expect(parseSemver('V0.15.9')).toEqual([0, 15, 9]);
      expect(parseSemver('2.1.0-beta.1')).toEqual([2, 1, 0]);
      expect(parseSemver('v3.0.0-rc.2')).toEqual([3, 0, 0]);
    });

    it('2. returns null for invalid semver strings', () => {
      expect(parseSemver('')).toBeNull();
      expect(parseSemver('invalid')).toBeNull();
      expect(parseSemver('v.x.y')).toBeNull();
      expect(parseSemver(null as any)).toBeNull();
    });
  });

  describe('compareSemver', () => {
    it('3. returns 1 when remote is strictly newer than current', () => {
      // Patch newer
      expect(compareSemver('1.0.0', '1.0.1')).toBe(1);
      expect(compareSemver('v1.0.0', 'v1.0.1')).toBe(1);
      // Minor newer
      expect(compareSemver('1.0.0', '1.1.0')).toBe(1);
      // Major newer
      expect(compareSemver('1.0.0', '2.0.0')).toBe(1);
      expect(compareSemver('1.9.9', '2.0.0')).toBe(1);
    });

    it('4. returns 0 when versions are equal', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('1.0.0', 'v1.0.0')).toBe(0);
      expect(compareSemver('2.4.1', '2.4.1')).toBe(0);
    });

    it('5. returns -1 when current installed version is newer than remote', () => {
      expect(compareSemver('1.0.1', '1.0.0')).toBe(-1);
      expect(compareSemver('1.1.0', '1.0.0')).toBe(-1);
      expect(compareSemver('2.0.0', '1.0.0')).toBe(-1);
      expect(compareSemver('v2.0.0', '1.9.9')).toBe(-1);
    });
  });

  describe('checkForExtensionUpdates', () => {
    it('6. respects throttle interval and uses cached result without network fetch', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 mins ago (< 1 hr)
      const cachedInfo: UpdateCheckInfo = {
        status: 'up_to_date',
        updateAvailable: false,
        lastCheckedAt: recentTimestamp,
        lastKnownRemoteVersion: '1.0.0',
        updateUrl: GITHUB_REPO_URL,
      };

      vi.spyOn(storage, 'getUpdateCheckInfo').mockResolvedValue(cachedInfo);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await checkForExtensionUpdates('1.0.0', false);
      expect(result).toEqual(cachedInfo);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('7. bypasses throttle when force is true', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000;
      const cachedInfo: UpdateCheckInfo = {
        status: 'up_to_date',
        updateAvailable: false,
        lastCheckedAt: recentTimestamp,
        lastKnownRemoteVersion: '1.0.0',
        updateUrl: GITHUB_REPO_URL,
      };

      vi.spyOn(storage, 'getUpdateCheckInfo').mockResolvedValue(cachedInfo);
      const setSpy = vi.spyOn(storage, 'setUpdateCheckInfo').mockResolvedValue();

      // Mock GitHub releases API returning newer version 1.1.0
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.1.0',
          html_url: 'https://github.com/xibhi/phake/releases/tag/v1.1.0',
        }),
      } as any);

      const result = await checkForExtensionUpdates('1.0.0', true);
      expect(result.updateAvailable).toBe(true);
      expect(result.status).toBe('update_available');
      expect(result.lastKnownRemoteVersion).toBe('1.1.0');
      expect(setSpy).toHaveBeenCalled();
    });

    it('8. falls back to package.json when releases API returns 404', async () => {
      vi.spyOn(storage, 'getUpdateCheckInfo').mockResolvedValue(null);
      vi.spyOn(storage, 'setUpdateCheckInfo').mockResolvedValue();

      // Mock first call (releases) returning 404, second call (raw package.json) returning 1.0.0
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            version: '1.0.0',
          }),
        } as any);

      const result = await checkForExtensionUpdates('1.0.0', true);
      expect(result.updateAvailable).toBe(false);
      expect(result.status).toBe('up_to_date');
      expect(result.lastKnownRemoteVersion).toBe('1.0.0');
    });

    it('9. degrades gracefully on complete network failure without throwing errors', async () => {
      vi.spyOn(storage, 'getUpdateCheckInfo').mockResolvedValue(null);
      vi.spyOn(storage, 'setUpdateCheckInfo').mockResolvedValue();

      // Simulate network disconnection
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      const result = await checkForExtensionUpdates('1.0.0', true);
      expect(result.status).toBe('failed');
      expect(result.updateAvailable).toBe(false);
      expect(result.updateUrl).toBe(GITHUB_REPO_URL);
    });
  });
});
