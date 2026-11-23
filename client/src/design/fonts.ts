/**
 * App fonts the user can pick (Settings → Appearance). Applies to the SANCTUARY only: Sanctuary.tsx writes
 * --app-font / --app-font-display on <html> while it is mounted and removes them when it unmounts, and the
 * public pages (landing, sign-in, legal) reset them (hooks/usePublicTheme.ts). Tailwind's font-sans / font-serif
 * read these variables with the brand fonts as fallback (tailwind.config.js).
 *
 * Fonts are self-hosted (@fontsource) and lazy-loaded: only the chosen ones are downloaded.
 * Keep the ids in sync with server/src/controllers/meController.ts (APP_FONTS / HEADING_FONTS).
 */
export interface FontOption { id: string; label: string; hint: string; family: string; load?: () => Promise<unknown> }

export const TEXT_FONTS: FontOption[] = [
  { id: 'jakarta', label: 'Jakarta', hint: 'Default · warm and modern', family: '"Plus Jakarta Sans Variable"' },
  { id: 'inter', label: 'Inter', hint: 'Clean and neutral', family: '"Inter Variable"', load: () => import('@fontsource-variable/inter') },
  { id: 'nunito', label: 'Nunito', hint: 'Rounded and friendly', family: '"Nunito Variable"', load: () => import('@fontsource-variable/nunito') },
  { id: 'quicksand', label: 'Quicksand', hint: 'Soft and light', family: '"Quicksand Variable"', load: () => import('@fontsource-variable/quicksand') },
  { id: 'outfit', label: 'Outfit', hint: 'Geometric', family: '"Outfit Variable"', load: () => import('@fontsource-variable/outfit') },
  { id: 'dmsans', label: 'DM Sans', hint: 'Compact and crisp', family: '"DM Sans Variable"', load: () => import('@fontsource-variable/dm-sans') },
  { id: 'lexend', label: 'Lexend', hint: 'Made for easy reading', family: '"Lexend Variable"', load: () => import('@fontsource-variable/lexend') },
  { id: 'atkinson', label: 'Atkinson', hint: 'Hyperlegible · low vision', family: '"Atkinson Hyperlegible"', load: () => Promise.all([import('@fontsource/atkinson-hyperlegible/400.css'), import('@fontsource/atkinson-hyperlegible/700.css')]) },
  { id: 'lora', label: 'Lora', hint: 'Bookish serif', family: '"Lora Variable"', load: () => import('@fontsource-variable/lora') },
  { id: 'system', label: 'System', hint: "Your device's own font", family: 'system-ui, -apple-system, "Segoe UI", Roboto' },
];

export const HEADING_FONTS: FontOption[] = [
  { id: 'fraunces', label: 'Fraunces', hint: 'Default · soft serif', family: '"Fraunces Variable"' },
  { id: 'playfair', label: 'Playfair', hint: 'Elegant, high contrast', family: '"Playfair Display Variable"', load: () => import('@fontsource-variable/playfair-display') },
  { id: 'lora', label: 'Lora', hint: 'Calm serif', family: '"Lora Variable"', load: () => import('@fontsource-variable/lora') },
  { id: 'same', label: 'Same as text', hint: 'One font everywhere', family: '' },
];

export const DEFAULT_TEXT_FONT = 'jakarta';
export const DEFAULT_HEADING_FONT = 'fraunces';

export const textFont = (id?: string | null) => TEXT_FONTS.find(f => f.id === id) || TEXT_FONTS[0];
export const headingFont = (id?: string | null) => HEADING_FONTS.find(f => f.id === id) || HEADING_FONTS[0];

const loaded = new Set<string>();
export const loadFont = (f: FontOption) => {
  if (!f.load || loaded.has(f.family)) return Promise.resolve();
  loaded.add(f.family);
  return f.load().catch(() => { loaded.delete(f.family); });
};
/** Preload every option (used by the picker so each name previews in its own face). */
export const loadAllFonts = () => Promise.all([...TEXT_FONTS, ...HEADING_FONTS].map(loadFont));

/** Write the Sanctuary font variables to <html>. Returns a cleanup that removes them. */
export const applyAppFonts = (textId?: string | null, headingId?: string | null) => {
  const t = textFont(textId), h = headingFont(headingId);
  loadFont(t); loadFont(h);
  const root = document.documentElement;
  if (t.id === DEFAULT_TEXT_FONT) root.style.removeProperty('--app-font'); else root.style.setProperty('--app-font', t.family);
  const display = h.id === 'same' ? t.family : h.family;
  if (h.id === DEFAULT_HEADING_FONT) root.style.removeProperty('--app-font-display'); else root.style.setProperty('--app-font-display', display);
  root.dataset.appFont = t.id;
  return () => { root.style.removeProperty('--app-font'); root.style.removeProperty('--app-font-display'); delete root.dataset.appFont; };
};
