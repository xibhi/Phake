import { UpdateCheckInfo } from './types';
import { storage } from './storage';

export const GITHUB_REPO = 'xibhi/Phake';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RAW_FALLBACK = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Parse standard semver string (e.g. "v1.0.0", "1.2.3", "v2.1.0-beta.1")
 */
export function parseSemver(versionStr: string): [number, number, number] | null {
  if (!versionStr || typeof versionStr !== 'string') return null;
  const cleaned = versionStr.trim().replace(/^v/i, '').split('-')[0];
  const parts = cleaned.split('.').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n)) || parts.length < 1) return null;
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  return [major, minor, patch];
}

/**
 * Compare two semver strings:
 *  1 if remote is newer than current (update available)
 *  0 if equal
 * -1 if current is newer than remote (up to date)
 */
export function compareSemver(current: string, remote: string): number {
  const c = parseSemver(current);
  const r = parseSemver(remote);
  if (!c || !r) return 0;

  for (let i = 0; i < 3; i++) {
    if (r[i] > c[i]) return 1;
    if (r[i] < c[i]) return -1;
  }
  return 0;
}

export interface RemoteVersionResult {
  version: string;
  releaseUrl: string;
}

/**
 * Query GitHub unauthenticated public APIs to determine latest released version.
 * Preferred: GitHub Releases API (/releases/latest)
 * Fallback: Default branch package.json raw content
 * Strict security: Never sends or embeds any personal access token or credential.
 */
export async function fetchRemoteVersion(): Promise<RemoteVersionResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // 1. Try Releases API
    const releaseRes = await fetch(GITHUB_RELEASES_API, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      signal: controller.signal,
    });

    if (releaseRes.ok) {
      const data = await releaseRes.json();
      const tag = data.tag_name || data.name || '';
      if (tag && parseSemver(tag)) {
        return {
          version: tag.trim().replace(/^v/i, ''),
          releaseUrl: data.html_url || GITHUB_REPO_URL,
        };
      }
    }

    // 2. Fallback if no releases exist (e.g. 404)
    const fallbackRes = await fetch(GITHUB_RAW_FALLBACK, {
      method: 'GET',
      signal: controller.signal,
    });

    if (fallbackRes.ok) {
      const pkg = await fallbackRes.json();
      if (pkg?.version && parseSemver(pkg.version)) {
        return {
          version: pkg.version.trim().replace(/^v/i, ''),
          releaseUrl: GITHUB_REPO_URL,
        };
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Execute update check (with throttling or force bypass)
 */
export async function checkForExtensionUpdates(
  currentVersion: string,
  force: boolean = false
): Promise<UpdateCheckInfo> {
  const cached = await storage.getUpdateCheckInfo();

  // If not forced and cached within throttle interval (1 hr), return cached result
  if (!force && cached && cached.lastCheckedAt) {
    const elapsed = Date.now() - cached.lastCheckedAt;
    if (elapsed < UPDATE_CHECK_INTERVAL_MS) {
      return cached;
    }
  }

  // Perform real fetch
  const remote = await fetchRemoteVersion();

  if (!remote) {
    // If fetch failed, gracefully keep cached status or report neutral failed state
    const fallbackInfo: UpdateCheckInfo = {
      status: cached ? cached.status : 'failed',
      updateAvailable: cached ? cached.updateAvailable : false,
      lastCheckedAt: cached?.lastCheckedAt ?? Date.now(),
      lastKnownRemoteVersion: cached?.lastKnownRemoteVersion ?? null,
      updateUrl: cached?.updateUrl ?? GITHUB_REPO_URL,
    };
    if (!cached) {
      await storage.setUpdateCheckInfo(fallbackInfo);
    }
    return fallbackInfo;
  }

  const isNewer = compareSemver(currentVersion, remote.version) > 0;
  const newInfo: UpdateCheckInfo = {
    status: isNewer ? 'update_available' : 'up_to_date',
    updateAvailable: isNewer,
    lastCheckedAt: Date.now(),
    lastKnownRemoteVersion: remote.version,
    updateUrl: remote.releaseUrl || GITHUB_REPO_URL,
  };

  await storage.setUpdateCheckInfo(newInfo);
  return newInfo;
}
