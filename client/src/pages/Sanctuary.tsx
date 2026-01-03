import React, { useState, useEffect, memo } from 'react';
import { WellnessHub } from '../components/wellness/WellnessHub';
import { ChatView } from '../components/chat/ChatView';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { useSync } from '../context/SyncContext';

// ✅ DIRECT IMPORTS (Fix for Widgets Not Opening)
import { Diary } from '../components/wellness/Diary';
import { PomodoroWidget } from '../components/widgets/PomodoroWidget';
import { JamWithAasthaWidget } from '../components/widgets/JamWithAasthaWidget';
import { Soundscape } from '../components/widgets/Soundscape';
import { BreathingWidget } from '../components/widgets/BreathingWidget';
import { MoodTracker } from '../components/widgets/MoodTracker';

// Memoized Wrappers to prevent parent re-renders affecting heavy widgets
const MemoDiary = memo(Diary);
const MemoPomodoro = memo(PomodoroWidget);
const MemoJam = memo(JamWithAasthaWidget);
const MemoSoundscape = memo(Soundscape);
const MemoBreathing = memo(BreathingWidget);
const MemoMood = memo(MoodTracker);

export const Sanctuary: React.FC = () => {
  const { emit, subscribe } = useSync();
  // Mobile Sidebar State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [widgets, setWidgets] = useState<Record<string, boolean>>({
    diary: false,
    pomodoro: false,
    jam: false,
    soundscape: false,
    breathing: false,
    mood: false,
  });

  // State for widget configurations (passed from Chat)
  const [widgetConfigs, setWidgetConfigs] = useState<Record<string, any>>({});

  // State to track z-indices of windows
  // Widgets layer starts at 40 (above Sidebar's 20)
  const [zIndices, setZIndices] = useState<Record<string, number>>({
    diary: 50,
    pomodoro: 50,
    jam: 50,
    soundscape: 50,
    breathing: 50,
    mood: 50,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // FIX: Logic to bring window to front
  const bringToFront = (key: string) => {
    setZIndices(prev => {
        const values = Object.values(prev);
        const maxZ = values.length > 0 ? Math.max(...values) : 50;
        
        // Always increment maxZ to ensure this specific window becomes the highest
        return { ...prev, [key]: maxZ + 1 };
    });
  };

  // Sync Listeners
  useEffect(() => {
    const unsubWidgets = subscribe('WIDGET_UPDATE', (payload: any) => {
        if (payload.widgets) setWidgets(payload.widgets);
        if (payload.zIndices) setZIndices(payload.zIndices);
    });

    // Sync Settings Logic could go here or in SyncBridge, but Widget state is local to Sanctuary
    return () => {
        unsubWidgets();
    };
  }, [subscribe]);

  const toggleWidget = (key: string) => {
    setWidgets(prev => {
        const isOpen = !prev[key];
        const newWidgets = { ...prev, [key]: isOpen };
        if (isOpen) bringToFront(key);

        emit('WIDGET_UPDATE', { widgets: newWidgets }); // Sync
        return newWidgets;
    });
  };

  const openWidget = (key: string, config?: any) => {
    if (config) {
        setWidgetConfigs(prev => ({ ...prev, [key]: config }));
    }
    if (!widgets[key]) {
        const newWidgets = { ...widgets, [key]: true };
        setWidgets(newWidgets);
        bringToFront(key);
        emit('WIDGET_UPDATE', { widgets: newWidgets }); // Sync
    } else {
        bringToFront(key);
    }
  };

  const closeWidget = (key: string) => {
    setWidgets(prev => {
        const newWidgets = { ...prev, [key]: false };
        emit('WIDGET_UPDATE', { widgets: newWidgets }); // Sync
        return newWidgets;
    });
  };

  return (
    <div className="relative w-full h-screen flex bg-transparent overflow-hidden">
      
      {/* 1. Left Sidebar (Wellness Hub) - Navigation Layer (z-20) */}
      <WellnessHub 
        onToggleWidget={toggleWidget} 
        activeWidgets={widgets} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Area (Chat) - Base Layer (z-10) */}
      <main className="flex-1 relative md:ml-72 h-full transition-all duration-300 z-10">
         <ChatView 
            onMobileMenuClick={() => setIsMobileMenuOpen(true)} 
            onOpenWidget={openWidget}
            isMobile={isMobile}
         />
      </main>

      {/* 3. Floating Widget Ecosystem - Widget Layer (z-40+) */}
      {/* REMOVED SUSPENSE: Direct Rendering for Reliability */}
      <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0 }}>

          <div style={{ pointerEvents: 'auto', willChange: 'transform' }}>
              <MemoDiary
                isOpen={widgets.diary} 
                onClose={() => closeWidget('diary')} 
                zIndex={zIndices.diary}
                onFocus={() => bringToFront('diary')}
              />
          </div>

          <div style={{ pointerEvents: 'auto', willChange: 'transform' }}>
            <MemoPomodoro
                isOpen={widgets.pomodoro} 
                onClose={() => closeWidget('pomodoro')} 
                zIndex={zIndices.pomodoro}
                onFocus={() => bringToFront('pomodoro')}
            />
          </div>

          <div style={{ pointerEvents: 'auto', willChange: 'transform' }}>
            <MemoJam
                isOpen={widgets.jam} 
                onClose={() => closeWidget('jam')} 
                zIndex={zIndices.jam}
                onFocus={() => bringToFront('jam')}
            />
          </div>

          <div style={{ pointerEvents: 'auto', willChange: 'transform' }}>
            <MemoSoundscape
                isOpen={widgets.soundscape} 
                onClose={() => closeWidget('soundscape')} 
                zIndex={zIndices.soundscape}
                onFocus={() => bringToFront('soundscape')}
                preset={widgetConfigs.soundscape?.preset}
            />
          </div>

          <div style={{ pointerEvents: 'auto', willChange: 'transform' }}>
            <MemoBreathing
                isOpen={widgets.breathing} 
                onClose={() => closeWidget('breathing')} 
                zIndex={zIndices.breathing}
                onFocus={() => bringToFront('breathing')}
                initialMode={widgetConfigs.breathing?.initialMode || "Box"}
            />
          </div>

          <div style={{ pointerEvents: 'auto', willChange: 'transform' }}>
            <MemoMood
                isOpen={widgets.mood} 
                onClose={() => closeWidget('mood')} 
                zIndex={zIndices.mood}
                onFocus={() => bringToFront('mood')}
            />
          </div>
      </div>
      
      {/* 4. Global Settings Modal - System Layer (z-100) */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

    </div>
  );
};
