// Single source of truth for the app version displayed in Settings
// Update this when bumping app version

export const APP_VERSION = '1.3.0';

// Nuvio TV release version - update this for each release
export const NUVIO_TV_VERSION = 'v1.0.0-beta-4';

export function getDisplayedAppVersion(): string {
  return APP_VERSION;
}

export function getNuvioTVVersion(): string {
  return NUVIO_TV_VERSION;
}


