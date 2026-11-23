/**
 * GIF / meme reactions. The model ends a playful reply with "[GIF: happy dance]"; the stream extractor
 * strips the tag and we resolve it here to one safe-rated GIF.
 *
 * Off unless a key is set: GIPHY_API_KEY (rating=pg) or TENOR_API_KEY (contentfilter=high).
 * Only the 2–5 word search phrase is sent to the provider — never the user's message or any user data.
 */
export interface Gif {
  url: string;      // animated GIF / WebP to display
  preview?: string; // small still/animated preview
  width?: number;
  height?: number;
  title: string;    // alt text
  source: 'giphy' | 'tenor';
}

const TIMEOUT_MS = 3000;
const CACHE_MS = 60 * 60_000;
const cache = new Map<string, { at: number; gifs: Gif[] }>();

export const gifsEnabled = () => !!(process.env.GIPHY_API_KEY || process.env.TENOR_API_KEY);

/** Cleans the model's tag text into a short, safe search phrase (or '' if unusable). */
export const cleanGifQuery = (raw: string): string => {
  const q = String(raw || '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .slice(0, 5)
    .join(' ');
  return q.length >= 2 && q.length <= 50 ? q : '';
};

const isHttps = (u: any): u is string => typeof u === 'string' && /^https:\/\//.test(u);

const fetchJson = async (url: string) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } finally { clearTimeout(t); }
};

const fromGiphy = async (q: string, key: string): Promise<Gif[]> => {
  const u = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=12&rating=pg&lang=en`;
  const j: any = await fetchJson(u);
  return (j?.data || []).map((g: any) => {
    const img = g?.images?.fixed_height || g?.images?.downsized;
    return { url: img?.webp || img?.url, preview: g?.images?.fixed_height_small?.url, width: +img?.width || undefined, height: +img?.height || undefined, title: String(g?.title || q).slice(0, 80), source: 'giphy' as const };
  }).filter((g: Gif) => isHttps(g.url));
};

const fromTenor = async (q: string, key: string): Promise<Gif[]> => {
  const u = `https://tenor.googleapis.com/v2/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=12&contentfilter=high&media_filter=tinygif,gif&client_key=aastha`;
  const j: any = await fetchJson(u);
  return (j?.results || []).map((g: any) => {
    const m = g?.media_formats?.tinygif || g?.media_formats?.gif;
    return { url: m?.url, width: m?.dims?.[0], height: m?.dims?.[1], title: String(g?.content_description || q).slice(0, 80), source: 'tenor' as const };
  }).filter((g: Gif) => isHttps(g.url));
};

/** One GIF for the phrase (random among the top results so repeats feel fresh), or null. Never throws. */
export const searchGif = async (raw: string): Promise<Gif | null> => {
  const q = cleanGifQuery(raw);
  if (!q || !gifsEnabled()) return null;
  try {
    let hit = cache.get(q);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      const gifs = process.env.GIPHY_API_KEY
        ? await fromGiphy(q, process.env.GIPHY_API_KEY)
        : await fromTenor(q, process.env.TENOR_API_KEY as string);
      hit = { at: Date.now(), gifs };
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
      cache.set(q, hit);
    }
    const pool = hit.gifs.slice(0, 6);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  } catch (e: any) {
    console.warn('[GIF] search failed:', e?.message || e);
    return null;
  }
};

export const GIF_PROMPT_LINE =
  '- GIF / meme reaction: end the message with [GIF: <2–4 word search, e.g. "happy dance", "facepalm", "mind blown">]. Only in light, playful moments (jokes, celebrations, banter) — at most once every few messages, never when they are sad, anxious, upset or talking about something serious.';
