import { Platform } from 'react-native';
import { mmkvStorage } from './mmkvStorage';
import { isAndroidTV } from '../utils/tvDetection';

export interface GithubReleaseInfo {
  tag_name: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
}

// GitHub release sources
export const GITHUB_RELEASE_SOURCES = {
  tapframe: {
    label: 'Official (tapframe)',
    apiUrl: 'https://api.github.com/repos/tapframe/NuvioStreaming/releases/latest',
    releasesUrl: 'https://github.com/tapframe/NuvioStreaming/releases',
    contributorsUrl: 'https://api.github.com/repos/tapframe/NuvioStreaming/contributors',
    allReleasesApiUrl: 'https://api.github.com/repos/tapframe/NuvioStreaming/releases',
  },
  crisszollo: {
    label: 'TV Fork (CrissZollo)',
    apiUrl: 'https://api.github.com/repos/CrissZollo/NuvioStreamingTV/releases',
    releasesUrl: 'https://github.com/CrissZollo/NuvioStreamingTV/releases',
    contributorsUrl: 'https://api.github.com/repos/CrissZollo/NuvioStreamingTV/contributors',
    allReleasesApiUrl: 'https://api.github.com/repos/CrissZollo/NuvioStreamingTV/releases',
  },
} as const;

export type GithubReleaseSourceKey = keyof typeof GITHUB_RELEASE_SOURCES;

const GITHUB_SOURCE_STORAGE_KEY = '@github_release_source';

export async function getGithubReleaseSource(): Promise<GithubReleaseSourceKey> {
  try {
    const stored = await mmkvStorage.getItem(GITHUB_SOURCE_STORAGE_KEY);
    if (stored && (stored === 'tapframe' || stored === 'crisszollo')) {
      return stored;
    }
  } catch {}
  // Return platform-specific default: CrissZollo for TV, tapframe for others
  return isAndroidTV() ? 'crisszollo' : 'tapframe';
}

export async function getStoredGithubReleaseSource(): Promise<GithubReleaseSourceKey | null> {
  try {
    const stored = await mmkvStorage.getItem(GITHUB_SOURCE_STORAGE_KEY);
    if (stored && (stored === 'tapframe' || stored === 'crisszollo')) {
      return stored;
    }
  } catch {}
  return null;
}

export async function setGithubReleaseSource(source: GithubReleaseSourceKey): Promise<void> {
  await mmkvStorage.setItem(GITHUB_SOURCE_STORAGE_KEY, source);
}

export async function fetchLatestGithubRelease(sourceOverride?: GithubReleaseSourceKey): Promise<GithubReleaseInfo | null> {
  try {
    const source = sourceOverride || await getGithubReleaseSource();
    const { apiUrl } = GITHUB_RELEASE_SOURCES[source];

    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        // Identify app a bit; avoid user agent blocks
        'User-Agent': `Nuvio/${Platform.OS}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();

    // Handle both array (all releases) and single object (latest) responses
    // Using array endpoint to include pre-releases
    const release = Array.isArray(json) ? json[0] : json;
    if (!release) return null;

    return {
      tag_name: release.tag_name,
      name: release.name,
      body: release.body,
      html_url: release.html_url,
      published_at: release.published_at,
    };
  } catch {
    return null;
  }
}

export function parseSemver(version: string): [number, number, number] | null {
  const m = version.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

// Pre-release type ordering (higher = more stable)
const PRERELEASE_ORDER: Record<string, number> = {
  alpha: 1,
  beta: 2,
  rc: 3,
};

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: { type: string; num: number };
}

/**
 * Parse versions like "v1.0.0-beta-3", "1.0.0 BETA 3", "1.0.0-rc.1"
 */
export function parseVersionWithPrerelease(version: string): ParsedVersion | null {
  // Normalize: remove 'v' prefix, convert to lowercase, replace spaces with dashes
  const normalized = version.trim().replace(/^v/, '').toLowerCase().replace(/\s+/g, '-');

  // Match patterns like "1.0.0-beta-3" or "1.0.0"
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-.]?(alpha|beta|rc)[-.]?(\d+)?)?/);
  if (!match) return null;

  const result: ParsedVersion = {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };

  if (match[4]) {
    result.prerelease = {
      type: match[4],
      num: match[5] ? parseInt(match[5], 10) : 0,
    };
  }

  return result;
}

/**
 * Compare two versions with pre-release support.
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVersionWithPrerelease(a);
  const vb = parseVersionWithPrerelease(b);

  if (!va || !vb) return 0;

  // Compare major.minor.patch
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;

  // Same base version - compare pre-release
  // No pre-release (stable) > any pre-release
  if (!va.prerelease && vb.prerelease) return 1;
  if (va.prerelease && !vb.prerelease) return -1;
  if (!va.prerelease && !vb.prerelease) return 0;

  // Both have pre-release - compare type first (rc > beta > alpha)
  const orderA = PRERELEASE_ORDER[va.prerelease!.type] || 0;
  const orderB = PRERELEASE_ORDER[vb.prerelease!.type] || 0;
  if (orderA !== orderB) return orderA - orderB;

  // Same pre-release type - compare number
  return va.prerelease!.num - vb.prerelease!.num;
}

/**
 * Check if latest version is newer than current (with pre-release support)
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(latest, current) > 0;
}

export function isMajorOrMinorUpgrade(current: string, latest: string): boolean {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  if (!a || !b) return false;
  // Major or minor bump when (b.major > a.major) or (same major and b.minor > a.minor)
  if (b[0] > a[0]) return true;
  if (b[0] === a[0] && b[1] > a[1]) return true;
  return false;
}

// Return true if latest > current for semver including patch
export function isAnyUpgrade(current: string, latest: string): boolean {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  if (!a || !b) return false;
  if (b[0] !== a[0]) return b[0] > a[0];
  if (b[1] !== a[1]) return b[1] > a[1];
  return b[2] > a[2];
}

export async function fetchTotalDownloads(sourceOverride?: GithubReleaseSourceKey): Promise<number | null> {
  try {
    const source = sourceOverride || await getGithubReleaseSource();
    const { allReleasesApiUrl } = GITHUB_RELEASE_SOURCES[source];

    const res = await fetch(allReleasesApiUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `Nuvio/${Platform.OS}`,
      },
    });
    if (!res.ok) return null;
    const releases = await res.json();

    let total = 0;
    releases.forEach((release: any) => {
      if (release.assets && Array.isArray(release.assets)) {
        release.assets.forEach((asset: any) => {
          total += asset.download_count || 0;
        });
      }
    });

    return total;
  } catch {
    return null;
  }
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

export async function fetchContributors(sourceOverride?: GithubReleaseSourceKey): Promise<GitHubContributor[] | null> {
  try {
    const source = sourceOverride || await getGithubReleaseSource();
    const { contributorsUrl } = GITHUB_RELEASE_SOURCES[source];

    const res = await fetch(contributorsUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `Nuvio/${Platform.OS}`,
      },
    });

    if (!res.ok) {
      if (__DEV__) console.error('GitHub API error:', res.status, res.statusText);
      return null;
    }

    const contributors = await res.json();
    return contributors;
  } catch (error) {
    if (__DEV__) console.error('Error fetching contributors:', error);
    return null;
  }
}


