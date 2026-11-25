/**
 * Jam with Aastha helpers (2026-11-25), pure so they can be tested.
 */
export const coverUrls = (t?: { id?: string; thumbnail?: string }) => {
    if (!t) return [];
    const yt = t.id ? [`https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`, `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`] : [];
    return [t.thumbnail, ...yt].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
};
export type RequestMode = 'play' | 'queue' | 'auto';
/** Aastha's proposal says what they asked for: "play"/"replace" = now, "queue"/"add"/"next" = after, else unsure. */
export const requestMode = (action: unknown): RequestMode => {
    const a = String(action || '').toLowerCase();
    return a === 'play' || a === 'replace' || a === 'now' ? 'play' : a === 'queue' || a === 'add' || a === 'next' || a === 'append' ? 'queue' : 'auto';
};

