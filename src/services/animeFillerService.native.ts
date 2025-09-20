// animeFillerService.native.ts
// Directly fetch and parse filler data from animefillerlist.com in React Native (no Node server required)

import axios from 'axios';
// @ts-ignore
import { load as loadHTML } from 'cheerio-without-node-native';

export interface FillerEpisode {
  episode: number;
  type: 'filler' | 'mixed' | 'canon';
}

export async function fetchFillerEpisodes(animeName: string): Promise<FillerEpisode[]> {
  try {
    // Format anime name: replace spaces with dashes, lowercase
    const formattedName = animeName.trim().toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.animefillerlist.com/shows/${encodeURIComponent(formattedName)}`;
    const response = await axios.get(url);
    const html = response.data;
    const $ = loadHTML(html);

    const result: FillerEpisode[] = [];

    // Filler Episodes
    $('div.filler span.Label').each((_: any, element: any) => {
      if ($(element).text().trim() === 'Filler Episodes:') {
        const fillerEpisode = $(element).next().text().trim();
        const episodes = fillerEpisode.split(',').map((ep: string) => ep.includes('-') ? expandRange(ep.trim()) : ep.trim());
        episodes.join(', ').split(',').forEach((ep: string) => {
          const num = parseInt(ep.trim(), 10);
          if (!isNaN(num)) result.push({ episode: num, type: 'filler' });
        });
      }
    });

    // Mixed Canon/Filler Episodes
    $('div.mixed_canon\/filler span.Label').each((_: any, element: any) => {
      if ($(element).text().trim() === 'Mixed Canon/Filler Episodes:') {
        const mixedEpisode = $(element).next().text().trim();
        const episodes = mixedEpisode.split(',').map((ep: string) => ep.includes('-') ? expandRange(ep.trim()) : ep.trim());
        episodes.join(', ').split(',').forEach((ep: string) => {
          const num = parseInt(ep.trim(), 10);
          if (!isNaN(num)) result.push({ episode: num, type: 'mixed' });
        });
      }
    });

    return result;
  } catch (e) {
    console.warn('[AnimeFiller] Failed to fetch filler data:', e);
    return [];
  }
}

function expandRange(range: string): string {
  const [start, end] = range.split('-').map(Number);
  const expandedRange = [];
  for (let i = start; i <= end; i++) {
    expandedRange.push(i);
  }
  return expandedRange.join(', ');
}
