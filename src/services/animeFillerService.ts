import * as dotenv from 'dotenv';
dotenv.config();
// animeFillerService.ts
// Service to fetch filler episode data from AnimeFiller API

import axios from 'axios';

// Use port from .env
const API_PORT = process.env.CHAIWALA_PORT || 8080;
const API_BASE = `http://localhost:${API_PORT}`;


export interface FillerEpisode {
  episode: number;
  type: 'filler' | 'mixed' | 'canon';
}

export async function fetchFillerEpisodes(animeName: string): Promise<FillerEpisode[]> {
  try {
    // Format anime name: replace spaces with dashes, lowercase
    const formattedName = animeName.trim().toLowerCase().replace(/\s+/g, '-');
    const url = `${API_BASE}/${encodeURIComponent(formattedName)}`;
    const res = await axios.get(url);
    // Response: { animeName, fillerEpisodes: ["1, 2, 3"], cannonEpisodes: ["4, 5, 6"] }
    const { fillerEpisodes, cannonEpisodes } = res.data;
    const result: FillerEpisode[] = [];

    // Parse filler episodes
    if (Array.isArray(fillerEpisodes)) {
      fillerEpisodes.forEach((str: string) => {
        str.split(',').forEach((ep: string) => {
          const num = parseInt(ep.trim(), 10);
          if (!isNaN(num)) {
            result.push({ episode: num, type: 'filler' });
          }
        });
      });
    }

    // Parse mixed/canon episodes (API calls them cannonEpisodes, treat as 'mixed')
    if (Array.isArray(cannonEpisodes)) {
      cannonEpisodes.forEach((str: string) => {
        str.split(',').forEach((ep: string) => {
          const num = parseInt(ep.trim(), 10);
          if (!isNaN(num)) {
            result.push({ episode: num, type: 'mixed' });
          }
        });
      });
    }

    return result;
  } catch (e) {
    console.warn('[AnimeFiller] Failed to fetch filler data:', e);
    return [];
  }
}
