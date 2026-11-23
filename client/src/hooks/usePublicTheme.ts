import { useEffect, useMemo, useState } from 'react';
import { buildMaterialTokens, DEFAULT_SEED, MdRole } from '../design/materialTheme';

/**
 * Light / dark for the PUBLIC pages (landing, sign-in, Privacy Policy, Terms).
 * Light mode = a real Material You LIGHT scheme generated from the same seed colour, scoped to the page
 * wrapper as CSS variables (the app itself stays dark-first). Remembered on this device; first visit follows
 * the system setting. Both schemes use the BRAND seed, never the user's Sanctuary colour or font.
 */
const KEY = 'aastha_public_theme';
const EVT = 'aastha:public-theme';

const initial = (): 'light' | 'dark' => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch { return 'dark'; }
};

export const usePublicTheme = () => {
  const [mode, setMode] = useState<'light' | 'dark'>(initial);
  useEffect(() => {
    const sync = () => setMode(initial());
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const toggle = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setMode(next);
    window.dispatchEvent(new Event(EVT));
  };
  // ALWAYS the brand seed — the colour a user picks inside the Sanctuary must not repaint the public pages.
  // (ThemeContext writes the user's palette to :root; these variables override it for this page's subtree.)
  const style = useMemo(() => {
    const tokens = buildMaterialTokens(DEFAULT_SEED, mode !== 'light');
    const vars: Record<string, string> = { colorScheme: mode, '--md-seed': DEFAULT_SEED, '--primary-color': DEFAULT_SEED, '--app-font': 'initial' };
    (Object.keys(tokens) as MdRole[]).forEach((r) => { vars[`--md-${r}`] = tokens[r]; });
    return vars as React.CSSProperties;
  }, [mode]);
  return { isLight: mode === 'light', toggle, style };
};
