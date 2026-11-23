/**
 * YouTube search with caching + quota protection (ROADMAP A11).
 *
 * Every YouTube Data API search costs 100 of the default 10,000 daily quota units (~100 searches/day
 * for the WHOLE app). A 10-song "vibe playlist" used to spend ~10% of that. Now:
 *  - results are cached in MongoDB for 30 days (+ an in-memory hot cache), so repeats cost nothing;
 *  - identical concurrent searches share one request;
 *  - when Google reports the quota is exhausted, we stop calling until it resets (midnight Pacific)
 *    and serve cache-only.
 */
import axios from 'axios';
import mongoose from 'mongoose';

export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

const CACHE_TTL_DAYS = 30;
const MEMORY_MAX = 500;

const cacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    results: [{ id: String, title: String, artist: String, thumbnail: String, _id: false }],
    createdAt: { type: Date, default: Date.now, expires: CACHE_TTL_DAYS * 24 * 3600 },
  },
  { versionKey: false }
);
export const YoutubeCache = mongoose.models.YoutubeCache || mongoose.model('YoutubeCache', cacheSchema);

const memory = new Map<string, Track[]>();
const inFlight = new Map<string, Promise<Track[]>>();
let quotaBlockedUntil = 0;

/** Next midnight in America/Los_Angeles (when YouTube quotas reset). */
export const nextPacificMidnight = (now = new Date()): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const secondsIntoDay = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second');
  return now.getTime() + (24 * 3600 - secondsIntoDay) * 1000;
};

export const cacheKey = (q: string, max: number, musicOnly: boolean) =>
  `${musicOnly ? 'm' : 'a'}|${max}|${q.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()}`;

const remember = (key: string, results: Track[]) => {
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value as string);
  memory.set(key, results);
};

const isQuotaError = (err: any) => {
  const reasons = (err?.response?.data?.error?.errors || []).map((e: any) => e.reason);
  return err?.response?.status === 403 && reasons.some((r: string) => /quota|dailyLimit|rateLimit/i.test(r));
};

/** Test hooks */
export const _ytInternals = {
  reset() { memory.clear(); inFlight.clear(); quotaBlockedUntil = 0; },
  get blockedUntil() { return quotaBlockedUntil; },
};

export const searchYouTube = async (
  query: string,
  opts: { max?: number; musicOnly?: boolean } = {}
): Promise<Track[]> => {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  const max = Math.min(Math.max(opts.max || 1, 1), 15);
  const key = cacheKey(q, max, !!opts.musicOnly);

  const hot = memory.get(key);
  if (hot) return hot;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = (async (): Promise<Track[]> => {
    try {
      const cached: any = await YoutubeCache.findOne({ key }).lean();
      if (cached) {
        remember(key, cached.results);
        return cached.results;
      }

      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey || Date.now() < quotaBlockedUntil) return [];

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q,
          type: 'video',
          maxResults: max,
          key: apiKey,
          ...(opts.musicOnly ? { videoCategoryId: '10' } : {}),
        },
        timeout: 8000,
      });

      const results: Track[] = (response.data?.items || [])
        .filter((it: any) => it?.id?.videoId)
        .map((it: any) => ({
          id: it.id.videoId,
          title: it.snippet?.title || '',
          artist: it.snippet?.channelTitle || '',
          thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || '',
        }));

      remember(key, results);
      await YoutubeCache.updateOne({ key }, { $set: { key, results, createdAt: new Date() } }, { upsert: true }).catch(() => {});
      return results;
    } catch (err: any) {
      if (isQuotaError(err)) {
        quotaBlockedUntil = nextPacificMidnight();
        console.warn(`[YouTube] Daily quota exhausted, serving cache only until ${new Date(quotaBlockedUntil).toISOString()}`);
      } else {
        console.warn('[YouTube] search failed:', err?.response?.status || err?.message);
      }
      return [];
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, job);
  return job;
};
