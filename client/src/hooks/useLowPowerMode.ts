import { useState, useEffect } from 'react';

export const useLowPowerMode = () => {
  const [isLowPower, setIsLowPower] = useState(true);

  useEffect(() => {
    // Check if mobile
    const isMobile = window.innerWidth < 768;

    // Check localStorage
    const savedPref = localStorage.getItem('lite-mode-enabled');

    if (savedPref !== null) {
      setIsLowPower(savedPref === 'true');
    } else {
      // Default to TRUE (Lite Mode) on mobile if no preference is set
      setIsLowPower(isMobile);
    }
  }, []);

  const setLowPowerMode = (enabled: boolean) => {
    setIsLowPower(enabled);
    localStorage.setItem('lite-mode-enabled', String(enabled));
  };

  return { isLowPower, setLowPowerMode };
};
