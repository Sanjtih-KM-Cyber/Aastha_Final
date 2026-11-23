/**
 * Material You (Material 3) dynamic colour for Aastha, ROADMAP Phase 5.
 *
 * One seed colour → a full tonal palette (Google's TonalSpot algorithm, same as Android's Monet).
 * Seed sources (already wired in ThemeContext): the user's wallpaper → the AI "<color>" tag → a preset →
 * default lotus lavender from the logo.
 *
 * Tokens are exposed as CSS variables holding "R G B" triplets so Tailwind can apply opacity:
 *   bg-md-surface-container-high, text-md-on-surface, bg-md-primary/20, border-md-outline-variant …
 */
import {
  Hct,
  SchemeTonalSpot,
  MaterialDynamicColors,
  argbFromHex,
  hexFromArgb,
  sourceColorFromImage,
} from '@material/material-color-utilities';

export const DEFAULT_SEED = '#8B7CF6'; // lotus lavender (logo)

const ROLES = {
  primary: MaterialDynamicColors.primary,
  'on-primary': MaterialDynamicColors.onPrimary,
  'primary-container': MaterialDynamicColors.primaryContainer,
  'on-primary-container': MaterialDynamicColors.onPrimaryContainer,
  secondary: MaterialDynamicColors.secondary,
  'secondary-container': MaterialDynamicColors.secondaryContainer,
  'on-secondary-container': MaterialDynamicColors.onSecondaryContainer,
  tertiary: MaterialDynamicColors.tertiary,
  'tertiary-container': MaterialDynamicColors.tertiaryContainer,
  'on-tertiary-container': MaterialDynamicColors.onTertiaryContainer,
  surface: MaterialDynamicColors.surface,
  'surface-dim': MaterialDynamicColors.surfaceDim,
  'surface-bright': MaterialDynamicColors.surfaceBright,
  'surface-container-lowest': MaterialDynamicColors.surfaceContainerLowest,
  'surface-container-low': MaterialDynamicColors.surfaceContainerLow,
  'surface-container': MaterialDynamicColors.surfaceContainer,
  'surface-container-high': MaterialDynamicColors.surfaceContainerHigh,
  'surface-container-highest': MaterialDynamicColors.surfaceContainerHighest,
  'on-surface': MaterialDynamicColors.onSurface,
  'on-surface-variant': MaterialDynamicColors.onSurfaceVariant,
  outline: MaterialDynamicColors.outline,
  'outline-variant': MaterialDynamicColors.outlineVariant,
  error: MaterialDynamicColors.error,
  'on-error': MaterialDynamicColors.onError,
  'error-container': MaterialDynamicColors.errorContainer,
  'on-error-container': MaterialDynamicColors.onErrorContainer,
  'on-secondary': MaterialDynamicColors.onSecondary,
  'on-tertiary': MaterialDynamicColors.onTertiary,
} as const;

export type MdRole = keyof typeof ROLES;
export const MD_ROLES = Object.keys(ROLES) as MdRole[];

const triplet = (argb: number) => `${(argb >> 16) & 255} ${(argb >> 8) & 255} ${argb & 255}`;

const normalizeSeed = (seed?: string | null): string => {
  if (!seed) return DEFAULT_SEED;
  const s = seed.trim();
  if (/^#([0-9a-f]{3}){1,2}$/i.test(s)) return s.length === 4 ? '#' + [...s.slice(1)].map((c) => c + c).join('') : s;
  return DEFAULT_SEED;
};

/** Returns { role: "R G B" } for every Material 3 role. Dark scheme by default (Aastha is dark-first). */
export const buildMaterialTokens = (seedHex?: string | null, dark = true): Record<MdRole, string> => {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(normalizeSeed(seedHex))), dark, 0);
  const out = {} as Record<MdRole, string>;
  (Object.keys(ROLES) as MdRole[]).forEach((role) => {
    out[role] = triplet(ROLES[role].getArgb(scheme));
  });
  return out;
};

/** Hex value of one role (handy for places that need a plain colour, e.g. Razorpay theme). */
export const roleHex = (seedHex: string | null | undefined, role: MdRole, dark = true) => {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(normalizeSeed(seedHex))), dark, 0);
  return hexFromArgb(ROLES[role].getArgb(scheme));
};

/**
 * Wallpaper → seed colour with Material's own algorithm (quantize + score, what Android's Monet does).
 * Runs entirely on the device: free, private, no AI call. Returns null if the image can't be read.
 */
export const seedFromImage = async (src: string): Promise<string | null> => {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    return hexFromArgb(await sourceColorFromImage(img));
  } catch {
    return null;
  }
};

/** Writes the tokens to :root as --md-<role> CSS variables. */
export const applyMaterialTheme = (seedHex?: string | null, dark = true) => {
  const tokens = buildMaterialTokens(seedHex, dark);
  const root = document.documentElement;
  (Object.keys(tokens) as MdRole[]).forEach((role) => root.style.setProperty(`--md-${role}`, tokens[role]));
  root.style.setProperty('--md-seed', normalizeSeed(seedHex));
  return tokens;
};

// ---------------------------------------------------------------------------
// WCAG contrast helpers (used by tests to guarantee readable pairs for any seed)
// ---------------------------------------------------------------------------
const lum = (rgb: string) => {
  const [r, g, b] = rgb.split(' ').map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrastRatio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
