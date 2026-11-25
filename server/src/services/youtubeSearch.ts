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

/** Cover art that always exists (YouTube serves hqdefault for every video). */
export const coverFor = (id: string, thumbs?: any) =>
  thumbs?.high?.url || thumbs?.medium?.url || thumbs?.standard?.url || thumbs?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** ISO 8601 duration ("PT3M42S") → seconds. */
export const isoSeconds = (iso: string) => {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ''));
  return m ? (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0)) : 0;
};
// A playable song: not a Short/teaser (Jam used to play an 8 s clip), not a live stream, not a 3-hour mix
export const SONG_MIN_S = 60;
export const SONG_MAX_S = 15 * 60;

export const searchYouTube = async (
  query: string,
  opts: { max?: number; musicOnly?: boolean; songsOnly?: boolean } = {}
): Promise<Track[]> => {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  const max = Math.min(Math.max(opts.max || 1, 1), 15);
  const key = (opts.songsOnly ? 's|' : '') + cacheKey(q, max, !!opts.musicOnly);

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
          // songsOnly: ask for a few extra (same 100-unit cost) so filtering still leaves `max`
          maxResults: opts.songsOnly ? Math.min(max + 4, 15) : max,
          key: apiKey,
          ...(opts.musicOnly ? { videoCategoryId: '10' } : {}),
          ...(opts.songsOnly ? { videoEmbeddable: 'true', safeSearch: 'moderate' } : {}),
        },
        timeout: 8000,
      });

      let items: any[] = (response.data?.items || []).filter((it: any) => it?.id?.videoId);
      if (opts.songsOnly) {
        items = items.filter((it: any) => (it.snippet?.liveBroadcastContent || 'none') === 'none');
        // Lengths need videos.list (1 quota unit for up to 50 ids)
        const ids = items.map((it: any) => it.id.videoId);
        if (ids.length) {
          const details = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: { part: 'contentDetails', id: ids.join(','), key: apiKey }, timeout: 8000,
          });
          const secs = new Map<string, number>((details.data?.items || []).map((v: any) => [v.id, isoSeconds(v.contentDetails?.duration)]));
          items = items.filter((it: any) => { const s = secs.get(it.id.videoId) || 0; return s >= SONG_MIN_S && s <= SONG_MAX_S; });
        }
        items = items.slice(0, max);
      }

      const results: Track[] = items
        .map((it: any) => ({
          id: it.id.videoId,
          title: it.snippet?.title || '',
          artist: it.snippet?.channelTitle || '',
          // some results have no "high" size; every video has i.ytimg.com/vi/<id>/hqdefault.jpg
          thumbnail: coverFor(it.id.videoId, it.snippet?.thumbnails),
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
