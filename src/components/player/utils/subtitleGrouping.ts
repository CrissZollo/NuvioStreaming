/**
 * Utility functions for grouping subtitles by language
 * Used by TVSubtitlePanel to display subtitles in a more organized manner
 */

import { formatLanguage } from './playerUtils';

export interface SubtitleTrack {
  id: number;
  name: string;
  language?: string;
}

export interface ExternalSubtitle {
  id: string;
  url: string;
  display: string;
  language: string;
  source?: string;
  isHearingImpaired?: boolean;
}

export interface GroupedSubtitle {
  id: string | number;
  name: string;
  language: string;
  displayName: string;
  isExternal: boolean;
  isHearingImpaired?: boolean;
  source?: string;
  // Original data for selection
  originalTrack?: SubtitleTrack;
  originalExternal?: ExternalSubtitle;
}

export interface LanguageGroup {
  language: string;
  displayLanguage: string;
  subtitles: GroupedSubtitle[];
  isExpanded: boolean;
}

/**
 * Format a subtitle for display in the expanded list
 * Shows both source and quality indicators (e.g., "OpenSubtitles - HI")
 */
export function formatSubtitleDisplay(subtitle: GroupedSubtitle): string {
  const parts: string[] = [];

  // Add source if available
  if (subtitle.source) {
    parts.push(subtitle.source);
  } else if (subtitle.isExternal) {
    parts.push('External');
  } else {
    parts.push('Built-in');
  }

  // Add quality indicator (HI = Hearing Impaired)
  if (subtitle.isHearingImpaired) {
    parts.push('HI');
  }

  return parts.join(' - ');
}

/**
 * Group built-in and external subtitles by language
 */
export function groupSubtitlesByLanguage(
  builtInTracks: SubtitleTrack[],
  externalSubtitles: ExternalSubtitle[]
): LanguageGroup[] {
  const groups = new Map<string, GroupedSubtitle[]>();

  // Process built-in tracks
  builtInTracks.forEach((track) => {
    const langCode = (track.language || 'und').toLowerCase();
    const displayLang = formatLanguage(track.language) || 'Unknown';

    const grouped: GroupedSubtitle = {
      id: track.id,
      name: track.name,
      language: langCode,
      displayName: formatSubtitleDisplay({
        id: track.id,
        name: track.name,
        language: langCode,
        displayName: '',
        isExternal: false,
        source: 'Built-in',
      }),
      isExternal: false,
      source: 'Built-in',
      originalTrack: track,
    };

    const key = displayLang;
    const existing = groups.get(key) || [];
    existing.push(grouped);
    groups.set(key, existing);
  });

  // Process external subtitles
  externalSubtitles.forEach((sub) => {
    const langCode = (sub.language || 'und').toLowerCase();
    const displayLang = formatLanguage(sub.language) || 'Unknown';

    // Detect hearing impaired from name or display
    const isHI = /\b(hi|hearing.?impaired|sdh|cc)\b/i.test(sub.display) ||
                 /\b(hi|hearing.?impaired|sdh|cc)\b/i.test(sub.source || '');

    const grouped: GroupedSubtitle = {
      id: sub.id,
      name: sub.display,
      language: langCode,
      displayName: formatSubtitleDisplay({
        id: sub.id,
        name: sub.display,
        language: langCode,
        displayName: '',
        isExternal: true,
        isHearingImpaired: isHI,
        source: sub.source || 'External',
      }),
      isExternal: true,
      isHearingImpaired: isHI,
      source: sub.source || 'External',
      originalExternal: sub,
    };

    const key = displayLang;
    const existing = groups.get(key) || [];
    existing.push(grouped);
    groups.set(key, existing);
  });

  // Convert to array and sort by language
  const result: LanguageGroup[] = Array.from(groups.entries())
    .map(([displayLanguage, subtitles]) => ({
      language: subtitles[0]?.language || 'und',
      displayLanguage,
      subtitles,
      isExpanded: false,
    }))
    .sort((a, b) => {
      // Sort English first, then alphabetically
      if (a.displayLanguage === 'English') return -1;
      if (b.displayLanguage === 'English') return 1;
      return a.displayLanguage.localeCompare(b.displayLanguage);
    });

  return result;
}

/**
 * Check if a language code matches the preferred language
 */
export function languageMatchesPreference(
  trackLanguage: string | undefined,
  preferredLanguage: string
): boolean {
  if (!trackLanguage || !preferredLanguage) return false;

  const trackLower = trackLanguage.toLowerCase();
  const prefLower = preferredLanguage.toLowerCase();

  // Direct match
  if (trackLower === prefLower) return true;

  // Prefix match (e.g., 'en' matches 'eng')
  if (trackLower.startsWith(prefLower) || prefLower.startsWith(trackLower)) return true;

  // Common language code mappings
  const langMappings: { [key: string]: string[] } = {
    'en': ['en', 'eng', 'english'],
    'es': ['es', 'spa', 'spanish'],
    'fr': ['fr', 'fra', 'fre', 'french'],
    'de': ['de', 'deu', 'ger', 'german'],
    'it': ['it', 'ita', 'italian'],
    'pt': ['pt', 'por', 'portuguese'],
    'ru': ['ru', 'rus', 'russian'],
    'ja': ['ja', 'jpn', 'japanese'],
    'ko': ['ko', 'kor', 'korean'],
    'zh': ['zh', 'zho', 'chi', 'chinese'],
  };

  const prefCodes = langMappings[prefLower] || [prefLower];
  return prefCodes.some(code =>
    trackLower.includes(code) || code.includes(trackLower)
  );
}

/**
 * Find the best matching subtitle group for a preferred language
 * Returns null if no match found (user should see "None" selected)
 */
export function findPreferredLanguageGroup(
  groups: LanguageGroup[],
  preferredLanguage: string | undefined
): LanguageGroup | null {
  if (!preferredLanguage || preferredLanguage === 'off') {
    return null;
  }

  return groups.find(group =>
    languageMatchesPreference(group.language, preferredLanguage)
  ) || null;
}
