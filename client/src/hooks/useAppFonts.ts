import { useEffect } from 'react';
import { useAuth } from './useAuth';
import api from '../services/api';
import { applyAppFonts, DEFAULT_HEADING_FONT, DEFAULT_TEXT_FONT } from '../design/fonts';

/**
 * The user's Sanctuary fonts. Saved on the account (PUT /users/preferences) so the phone and the web match;
 * cached on the device for an instant first paint.
 */
const KEY = 'aastha_app_fonts';
const readLocal = (): { text?: string; heading?: string } => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};

export const useAppFontChoice = () => {
  const { user } = useAuth();
  const local = readLocal();
  return {
    text: (user as any)?.appFont || local.text || DEFAULT_TEXT_FONT,
    heading: (user as any)?.headingFont || local.heading || DEFAULT_HEADING_FONT,
  };
};

/** Mount inside the Sanctuary only: applies the fonts there and removes them when you leave (public pages keep the brand fonts). */
export const useSanctuaryFonts = () => {
  const { text, heading } = useAppFontChoice();
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ text, heading })); } catch { /* ignore */ }
    return applyAppFonts(text, heading);
  }, [text, heading]);
};

export const saveAppFonts = async (change: { appFont?: string; headingFont?: string }, updateUser?: (u: any) => void) => {
  const cur = readLocal();
  try { localStorage.setItem(KEY, JSON.stringify({ text: change.appFont ?? cur.text, heading: change.headingFont ?? cur.heading })); } catch { /* ignore */ }
  updateUser?.(change);
  await api.put('/users/preferences', change);
};
