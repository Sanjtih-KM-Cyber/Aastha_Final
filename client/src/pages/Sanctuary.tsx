import React, { useState, useEffect } from 'react';
import { WellnessHub } from '../components/wellness/WellnessHub';
import { ChatView } from '../components/chat/ChatView';
import { Diary } from '../components/wellness/Diary';
import { PomodoroWidget } from '../components/widgets/PomodoroWidget';
import { JamWithAasthaWidget } from '../components/widgets/JamWithAasthaWidget';
import { Soundscape } from '../components/widgets/Soundscape';
import { BreathingWidget } from '../components/widgets/BreathingWidget';
import { MoodTracker } from '../components/widgets/MoodTracker';
import { SettingsPanel } from '../components/settings/SettingsPanel';

export const Sanctuary: React.FC = () => {
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
  const [zIndices, setZIndices] = useState<Record<string, number>>({
    diary: 20,
    pomodoro: 20,
    jam: 20,
    soundscape: 20,
    breathing: 20,
    mood: 20,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // FIX: Logic to bring window to front
  const bringToFront = (key: string) => {
    setZIndices(prev => {
        const values = Object.values(prev);
        const maxZ = values.length > 0 ? Math.max(...values) : 20;
        
        // Always increment maxZ to ensure this specific window becomes the highest,
        // even if it was already tied for top place.
        return { ...prev, [key]: maxZ + 1 };
    });
  };

  const toggleWidget = (key: string) => {
    setWidgets(prev => {
        const isOpen = !prev[key];
        if (isOpen) bringToFront(key);
        return { ...prev, [key]: isOpen };
    });
  };

  const openWidget = (key: string, config?: any) => {
    if (config) {
        setWidgetConfigs(prev => ({ ...prev, [key]: config }));
    }
    if (!widgets[key]) {
        setWidgets(prev => ({ ...prev, [key]: true }));
        bringToFront(key);
    } else {
        bringToFront(key);
    }
  };

  const closeWidget = (key: string) => {
    setWidgets(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="relative w-full h-screen flex bg-transparent overflow-hidden">
      
      {/* 1. Left Sidebar (Wellness Hub) */}
      <WellnessHub 
        onToggleWidget={toggleWidget} 
        activeWidgets={widgets} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Area (Chat) */}
      <main className="flex-1 relative md:ml-72 h-full transition-all duration-300">
         <ChatView 
            onMobileMenuClick={() => setIsMobileMenuOpen(true)} 
            onOpenWidget={openWidget}
            isMobile={isMobile}
         />
      </main>

      {/* 3. Floating Widget Ecosystem */}
      <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0, zIndex: 30 }}>
          <div style={{ pointerEvents: 'auto' }}>
              <Diary 
                isOpen={widgets.diary} 
                onClose={() => closeWidget('diary')} 
                zIndex={zIndices.diary}
                onFocus={() => bringToFront('diary')}
              />
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <PomodoroWidget 
                isOpen={widgets.pomodoro} 
                onClose={() => closeWidget('pomodoro')} 
                zIndex={zIndices.pomodoro}
                onFocus={() => bringToFront('pomodoro')}
            />
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <JamWithAasthaWidget 
                isOpen={widgets.jam} 
                onClose={() => closeWidget('jam')} 
                zIndex={zIndices.jam}
                onFocus={() => bringToFront('jam')}
            />
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <Soundscape 
                isOpen={widgets.soundscape} 
                onClose={() => closeWidget('soundscape')} 
                zIndex={zIndices.soundscape}
                onFocus={() => bringToFront('soundscape')}
                preset={widgetConfigs.soundscape?.preset}
            />
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <BreathingWidget 
                isOpen={widgets.breathing} 
                onClose={() => closeWidget('breathing')} 
                zIndex={zIndices.breathing}
                onFocus={() => bringToFront('breathing')}
                initialMode={widgetConfigs.breathing?.initialMode || "Box"}
            />
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <MoodTracker 
                isOpen={widgets.mood} 
                onClose={() => closeWidget('mood')} 
                zIndex={zIndices.mood}
                onFocus={() => bringToFront('mood')}
            />
          </div>
      </div>
      
      {/* 4. Global Settings Modal */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

    </div>
  );
};