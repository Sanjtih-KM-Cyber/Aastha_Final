import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

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
  setTheme: (themeId: string) => void;
  setWallpaper: (file: File | null) => void;
  resetTheme: () => void;
}

const defaultThemes: Record<string, Theme> = {
  aurora: { id: 'aurora', name: 'Aurora', primaryColor: '#2dd4bf', accentGlow: 'shadow-teal-500/50', gradient: 'from-teal-400 to-violet-500' },
  sunset: { id: 'sunset', name: 'Sunset', primaryColor: '#fb7185', accentGlow: 'shadow-rose-500/50', gradient: 'from-orange-400 to-rose-500' },
  ocean: { id: 'ocean', name: 'Ocean', primaryColor: '#38bdf8', accentGlow: 'shadow-sky-500/50', gradient: 'from-cyan-400 to-blue-500' },
  midnight: { id: 'midnight', name: 'Midnight', primaryColor: '#a78bfa', accentGlow: 'shadow-violet-500/50', gradient: 'from-indigo-400 to-purple-500' },
  custom: { id: 'custom', name: 'Custom', primaryColor: '#ffffff', accentGlow: 'shadow-white/50', gradient: 'from-gray-500 to-slate-500' }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('user_theme_id');
    const savedCustom = localStorage.getItem('user_custom_theme_color');
    if (saved === 'custom' && savedCustom) {
      return { ...defaultThemes.custom, primaryColor: savedCustom, gradient: 'from-white/20 to-black/20' };
    }
    return defaultThemes[saved?.toLowerCase() || 'aurora'] || defaultThemes.aurora;
  });

  const [wallpaper, setWallpaperState] = useState<string | null>(() => localStorage.getItem('user_wallpaper'));

  useEffect(() => {
    // sync when user changes (from server)
    if (user) {
      const serverWallpaper = (user as any).wallpaper || null;
      if (serverWallpaper !== wallpaper) {
        setWallpaperState(serverWallpaper);
        if (serverWallpaper) {
          localStorage.setItem('user_wallpaper', serverWallpaper);
          extractThemeFromImage(serverWallpaper); // best-effort theme extraction
        } else {
          localStorage.removeItem('user_wallpaper');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', currentTheme.primaryColor);
    localStorage.setItem('user_theme_id', currentTheme.id);
    if (currentTheme.id === 'custom') localStorage.setItem('user_custom_theme_color', currentTheme.primaryColor);
  }, [currentTheme]);

  const setTheme = (themeId: string) => {
    if (themeId.startsWith('#')) {
      setCurrentTheme({ ...defaultThemes.custom, primaryColor: themeId, id: 'custom', gradient: `from-[${themeId}]/20 to-black/50` });
    } else {
      const key = themeId.toLowerCase();
      if (defaultThemes[key]) setCurrentTheme(defaultThemes[key]);
    }
  };

  // Tries backend AI then falls back to local canvas sampling.
  const extractThemeFromImage = async (base64Image: string) => {
    try {
      // backend AI extraction endpoint (mounted under /api)
      const res = await api.post('/ai/theme', { image: base64Image });
      const { primaryColor } = res.data || {};
      if (primaryColor) {
        setTheme(primaryColor);
      } else {
        fallbackLocalExtraction(base64Image);
      }
    } catch (error: any) {
      console.warn('AI theme extraction failed, falling back to local extraction', error);
      fallbackLocalExtraction(base64Image);
    }
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
        setTheme(hex);
      };
      img.onerror = () => {
        console.warn('Image load error for local theme extraction');
      };
    } catch (err) {
      console.error('Fallback extraction error', err);
    }
  };

  const setWallpaper = (file: File | null) => {
    if (!file) {
      setWallpaperState(null);
      localStorage.removeItem('user_wallpaper');
      if (user) {
        // Clear on server if user exists
        api.put('/users/profile', { wallpaper: '' }).catch(console.error);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      // Resize/compress to keep payload small
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
          if (user) {
            // Persist on server
            await api.put('/users/profile', { wallpaper: compressedData });
          }
        } catch (err) {
          console.error('Error saving wallpaper', err);
          alert('Failed to save wallpaper to server.');
        }
      };
      img.onerror = () => {
        alert('Invalid image file.');
      };
    };
    reader.readAsDataURL(file);
  };

  const resetTheme = () => {
    setCurrentTheme(defaultThemes.aurora);
    setWallpaperState(null);
    localStorage.removeItem('user_theme_id');
    localStorage.removeItem('user_custom_theme_color');
    localStorage.removeItem('user_wallpaper');
    // Optionally clear on server
    if (user) {
      api.put('/users/profile', { wallpaper: '' }).catch(console.error);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, wallpaper, setTheme, setWallpaper, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
