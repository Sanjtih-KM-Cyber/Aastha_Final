import React, { useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { useTheme } from '../context/ThemeContext';

export const SyncBridge: React.FC = () => {
  const { subscribe } = useSync();
  const { setTheme, setWallpaper } = useTheme();

  useEffect(() => {
    // Subscribe to theme updates
    const unsubscribe = subscribe('THEME_UPDATE', (payload: any) => {
        if (payload.theme) setTheme(payload.theme, true);
        if (payload.wallpaper !== undefined) setWallpaper(payload.wallpaper);
    });

    return () => {
        unsubscribe();
    };
  }, [subscribe, setTheme, setWallpaper]);

  return null; // This component renders nothing
};
