// animeTitleUtils.ts
// Utility to normalize anime titles for AnimeFiller API

export function normalizeAnimeTitleForFillerApi(title: string): string {
  // Remove special chars, lowercase, trim, and replace spaces with dashes
  return title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}
