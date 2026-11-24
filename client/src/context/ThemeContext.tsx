import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSync } from './SyncContext';
import { MotionConfig } from 'framer-motion';
import { PerfMode, readPerfMode, savePerfMode, perfClasses } from '../utils/perfMode';
import { applyMaterialTheme, DEFAULT_SEED, seedFromImage } from '../design/materialTheme';

/** Converts any CSS colour ("blue", "rgb(...)", "#abc") to #rrggbb for the Material seed. */
const normalizeToHex = (color: string): string => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return DEFAULT_SEED;
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    const v = String(ctx.fillStyle);
    return /^#[0-9a-f]{6}$/i.test(v) ? v : DEFAULT_SEED;
  } catch {
    return DEFAULT_SEED;
  }
};

/**
 * Auto lite mode (P3): small screens, low-memory / low-core devices, Data Saver, or the OS
 * "reduce motion" preference. The user can still override it in Settings.
 */
const detectLowEndDevice = (): boolean => {
  try {
    const nav: any = navigator;
    if (window.innerWidth < 768) return true;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
    if (nav.connection?.saveData) return true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch { /* ignore */ }
  return false;
};

export interface Theme {
  id: string;
  name: string;
  primaryColor: string;
  accentGlow: string;
  gradient: string;
}

interface ThemeContextType {
  currentTheme: Theme;
  wallpaper: string | null;
  isLowPowerMode: boolean; // Lite OR Lite Plus
  isLitePlus: boolean;
  perfMode: PerfMode;
  setPerfMode: (m: PerfMode) => void;
  setTheme: (themeId: string, fromSync?: boolean) => void;
  setWallpaper: (file: File | null) => void;
  setLowPowerMode: (enabled: boolean) => void;
  resetTheme: () => void;
}

const defaultThemes: Record<string, Theme> = {
  lotus: { id: 'lotus', name: 'Lotus', primaryColor: '#8B7CF6', accentGlow: 'shadow-violet-500/50', gradient: 'from-violet-400 to-fuchsia-400' },
  aurora: { id: 'aurora', name: 'Aurora', primaryColor: '#2dd4bf', accentGlow: 'shadow-teal-500/50', gradient: 'from-teal-400 to-violet-500' },
  sunset: { id: 'sunset', name: 'Sunset', primaryColor: '#fb7185', accentGlow: 'shadow-rose-500/50', gradient: 'from-orange-400 to-rose-500' },
  ocean: { id: 'ocean', name: 'Ocean', primaryColor: '#38bdf8', accentGlow: 'shadow-sky-500/50', gradient: 'from-cyan-400 to-blue-500' },
  midnight: { id: 'midnight', name: 'Midnight', primaryColor: '#a78bfa', accentGlow: 'shadow-violet-500/50', gradient: 'from-indigo-400 to-purple-500' },
  custom: { id: 'custom', name: 'Custom', primaryColor: '#ffffff', accentGlow: 'shadow-white/50', gradient: 'from-gray-500 to-slate-500' }
};

// ✅ HELPER: Validate Color to prevent "Shitty" UI breaks
const isValidColor = (color: string | null | undefined): boolean => {
    if (!color) return false;
    const s = new Option().style;
    s.color = color;
    // Check if it's a valid hex or standard color, and not 'undefined' string
    return s.color !== '' && !color.includes('undefined') && !color.includes('null');
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateUser } = useAuth() as any;
  const { emit } = useSync();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('user_theme_id');
    const savedCustom = localStorage.getItem('user_custom_theme_color');
    
    // ✅ FIX: Strict validation before applying custom theme
    if (saved === 'custom' && isValidColor(savedCustom)) {
      return { ...defaultThemes.custom, primaryColor: savedCustom!, gradient: 'from-white/20 to-black/20' };
    }
    
    // Fallback to Aurora if saved data is corrupt
    return defaultThemes[saved?.toLowerCase() || 'lotus'] || defaultThemes.lotus;
  });

  const [wallpaper, setWallpaperState] = useState<string | null>(() => {
      const w = localStorage.getItem('user_wallpaper');
      return w !== 'undefined' && w !== 'null' ? w : null;
  });

  // --- PERFORMANCE MODE (full / lite / Lite Plus), utils/perfMode.ts ---
  const [perfMode, setPerfModeState] = useState<PerfMode>(() => readPerfMode(detectLowEndDevice()));
  const isLowPowerMode = perfMode !== 'full'; // Lite Plus includes everything Lite does
  const isLitePlus = perfMode === 'plus';

  // Apply GLOBALLY (P3): CSS classes turn off blur / animations everywhere, including components that don't
  // read the flag themselves. Lite Plus adds html.lite-plus on top of html.lite.
  useEffect(() => {
      const c = perfClasses(perfMode);
      document.documentElement.classList.toggle('lite', c.lite);
      document.documentElement.classList.toggle('lite-plus', c['lite-plus']);
  }, [perfMode]);

  useEffect(() => {
    if (user) {
      // ✅ FIX: Sanitize server data before applying
      const serverWallpaper = (user as any).wallpaper;
      const validWallpaper = (serverWallpaper && serverWallpaper !== 'undefined' && serverWallpaper.length > 50) ? serverWallpaper : null;

      if (validWallpaper !== wallpaper) {
        setWallpaperState(validWallpaper);
        if (validWallpaper) {
          localStorage.setItem('user_wallpaper', validWallpaper);
          extractThemeFromImage(validWallpaper);
        } else {
          localStorage.removeItem('user_wallpaper');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // ✅ FIX: Ensure CSS variable is never invalid
    const safeColor = isValidColor(currentTheme.primaryColor) ? currentTheme.primaryColor : '#2dd4bf';
    document.documentElement.style.setProperty('--primary-color', safeColor);
    // Material You: derive the whole tonal palette (surfaces, containers, outlines) from the seed
    applyMaterialTheme(normalizeToHex(safeColor));
    
    localStorage.setItem('user_theme_id', currentTheme.id);
    if (currentTheme.id === 'custom') {
        localStorage.setItem('user_custom_theme_color', safeColor);
    }
  }, [currentTheme]);

  const setTheme = (themeId: string, fromSync = false) => {
    if (themeId.startsWith('#')) {
      if (isValidColor(themeId)) {
          setCurrentTheme({ ...defaultThemes.custom, primaryColor: themeId, id: 'custom', gradient: `from-[${themeId}]/20 to-black/50` });
      }
    } else {
      const key = themeId.toLowerCase();
      if (defaultThemes[key]) setCurrentTheme(defaultThemes[key]);
    }

    if (!fromSync && user) {
        emit('THEME_UPDATE', { theme: themeId });
        saveThemeToAccount(themeId);
    }
  };

  /** Saved on the account (debounced, the colour wheel fires many changes while dragging) so every device matches. */
  const saveThemeToAccount = (themeId: string) => {
    const value = themeId.startsWith('#') ? normalizeToHex(themeId).toLowerCase() : themeId.toLowerCase();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateUser?.({ themeColor: value });
      api.put('/users/preferences', { themeColor: value }).catch(() => { /* stays on this device; retried next change */ });
    }, 700);
  };

  // The account's colour wins on sign-in / when changed on another device. An account with none adopts this device's.
  const accountColor = (user as any)?.themeColor as string | null | undefined;
  useEffect(() => {
    if (!user) return;
    const local = currentTheme.id === 'custom' ? normalizeToHex(currentTheme.primaryColor).toLowerCase() : currentTheme.id;
    if (!accountColor) { saveThemeToAccount(local); return; }
    if (accountColor !== local) setTheme(accountColor, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountColor, !!user]);

  const setPerfMode = (m: PerfMode) => { setPerfModeState(m); savePerfMode(m); };
  // Old switch API: Lite on/off (turning Lite on also turns Lite Plus off)
  const setLowPowerMode = (enabled: boolean) => setPerfMode(enabled ? 'lite' : 'full');

  // Wallpaper → Material You seed, computed ON THE DEVICE with Material's own algorithm.
  // (The old server endpoint always returned the same violet, so wallpapers never changed the theme.)
  const extractThemeFromImage = async (base64Image: string) => {
    const seed = await seedFromImage(base64Image);
    if (seed && isValidColor(seed)) setTheme(seed);
    else fallbackLocalExtraction(base64Image);
  };

  const fallbackLocalExtraction = (imageSrc: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        if (isValidColor(hex)) setTheme(hex);
      };
    } catch (err) {
      console.error('Fallback extraction error', err);
    }
  };

  const setWallpaper = (file: File | null) => {
    if (!file) {
      setWallpaperState(null);
      localStorage.removeItem('user_wallpaper');
      if (user) api.put('/users/profile', { wallpaper: '' }).catch(console.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        const MAX_WIDTH = 1024;
        const ratio = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedData = canvas.toDataURL('image/jpeg', 0.6);
        setWallpaperState(compressedData);
        try {
          localStorage.setItem('user_wallpaper', compressedData);
          extractThemeFromImage(compressedData);
          if (user) await api.put('/users/profile', { wallpaper: compressedData });
        } catch (err) {
          console.error('Error saving wallpaper', err);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const resetTheme = () => {
    setCurrentTheme(defaultThemes.lotus);
    setWallpaperState(null);
    localStorage.removeItem('user_theme_id');
    localStorage.removeItem('user_custom_theme_color');
    localStorage.removeItem('user_wallpaper');
    if (user) api.put('/users/profile', { wallpaper: '' }).catch(console.error);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, wallpaper, isLowPowerMode, isLitePlus, perfMode, setPerfMode, setTheme, setWallpaper, setLowPowerMode, resetTheme }}>
      {/* Lite: framer-motion skips transform/loop animations. Lite Plus: every framer animation is instant too.
          Otherwise follow the OS "reduce motion" setting. */}
      <MotionConfig reducedMotion={isLowPowerMode ? 'always' : 'user'} transition={isLitePlus ? { duration: 0 } : undefined}>
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
