import { useEffect } from 'react';

export const useSecurity = () => {
  useEffect(() => {
    // Disable Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Disable Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element Inspector), Ctrl+Shift+K (Firefox Console), Ctrl+Shift+U (Source)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey &&
          ['I', 'J', 'C', 'K', 'U', 'i', 'j', 'c', 'k', 'u'].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Mac specific: Cmd+Option+I (Inspect), Cmd+Option+C (Inspect), Cmd+Option+U (Source)
      if (e.metaKey && e.altKey && ['I', 'C', 'U', 'i', 'c', 'u'].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Ctrl+U (View Source), Ctrl+S (Save), Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && ['U', 'S', 'P', 'u', 's', 'p'].includes(e.key)) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
};
