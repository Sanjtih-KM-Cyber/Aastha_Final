import React, { useState, useEffect, memo } from 'react';
import { WellnessHub } from '../components/wellness/WellnessHub';
import { ChatView } from '../components/chat/ChatView';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { useSync } from '../context/SyncContext';
import { OnboardingTour, TourStep } from '../components/landing/OnboardingTour';
import { useAuth } from '../context/AuthContext';

// ✅ DIRECT IMPORTS (Fix for Widgets Not Opening)
// Lazy load widgets for better error isolation
const Diary = React.lazy(() => import('../components/wellness/Diary').then(m => ({ default: m.Diary })));
const PomodoroWidget = React.lazy(() => import('../components/widgets/PomodoroWidget').then(m => ({ default: m.PomodoroWidget })));
const JamWithAasthaWidget = React.lazy(() => import('../components/widgets/JamWithAasthaWidget').then(m => ({ default: m.JamWithAasthaWidget })));
const Soundscape = React.lazy(() => import('../components/widgets/Soundscape').then(m => ({ default: m.Soundscape })));
const BreathingWidget = React.lazy(() => import('../components/widgets/BreathingWidget').then(m => ({ default: m.BreathingWidget })));
const MoodTracker = React.lazy(() => import('../components/widgets/MoodTracker').then(m => ({ default: m.MoodTracker })));

// Memoized Wrappers to prevent parent re-renders affecting heavy widgets
const MemoDiary = memo(Diary);
const MemoPomodoro = memo(PomodoroWidget);
const MemoJam = memo(JamWithAasthaWidget);
const MemoSoundscape = memo(Soundscape);
const MemoBreathing = memo(BreathingWidget);
const MemoMood = memo(MoodTracker);

const SANCTUARY_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'chat-container-main',
    title: 'Your Personal Companion',
    content: 'Talk to Aastha (or Aastik). Share your thoughts, feelings, or just vent. Everything is encrypted.',
    position: 'right'
  },
  {
    targetId: 'wellness-hub-nav',
    title: 'Wellness Hub',
    content: 'Access all your tools here: Diary, Music, Breathing Exercises, and Mood Tracking.',
    position: 'right'
  },
  {
    targetId: 'voice-mode-btn',
    title: 'Voice Mode',
    content: 'Prefer talking? Tap the headset icon to have a real-time voice conversation.',
    position: 'bottom'
  },
  {
    targetId: 'settings-btn',
    title: 'Customize Everything',
    content: 'Change themes, manage security, or switch personas in the settings.',
    position: 'top'
  }
];

export const Sanctuary: React.FC = () => {
  const { emit, subscribe } = useSync();
  const { user, completeOnboarding } = useAuth();

  // Mobile Sidebar State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Trigger Tour only if user exists and hasn't completed it
  useEffect(() => {
    if (user && user.isOnboardingComplete === false) {
      // Small delay to ensure UI is mounted
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleTourComplete = async () => {
      setShowTour(false);
      await completeOnboarding();
  };

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

  const toggleWidget = (key: string) => {
    setWidgets(prev => {
        const isOpen = !prev[key];
        const newWidgets = { ...prev, [key]: isOpen };
        if (isOpen) bringToFront(key);
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
    } else {
        bringToFront(key);
    }
  };

  const closeWidget = (key: string) => {
    setWidgets(prev => {
        const newWidgets = { ...prev, [key]: false };
        return newWidgets;
    });
  };

  return (
    <div className="relative w-full h-screen flex bg-transparent overflow-hidden">
      
      <OnboardingTour
         isOpen={showTour}
         steps={SANCTUARY_TOUR_STEPS}
         onComplete={handleTourComplete}
         onSkip={handleTourComplete}
      />

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

      {/* 3. Floating Widget Ecosystem - Widget Layer (z-50) */}
      <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0, zIndex: 50 }}>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoDiary
                isOpen={widgets.diary} 
                onClose={() => closeWidget('diary')} 
                zIndex={zIndices.diary}
                onFocus={() => bringToFront('diary')}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoPomodoro
                  isOpen={widgets.pomodoro}
                  onClose={() => closeWidget('pomodoro')}
                  zIndex={zIndices.pomodoro}
                  onFocus={() => bringToFront('pomodoro')}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoJam
                  isOpen={widgets.jam}
                  onClose={() => closeWidget('jam')}
                  zIndex={zIndices.jam}
                  onFocus={() => bringToFront('jam')}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoSoundscape
                  isOpen={widgets.soundscape}
                  onClose={() => closeWidget('soundscape')}
                  zIndex={zIndices.soundscape}
                  onFocus={() => bringToFront('soundscape')}
                  preset={widgetConfigs.soundscape?.preset}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoBreathing
                  isOpen={widgets.breathing}
                  onClose={() => closeWidget('breathing')}
                  zIndex={zIndices.breathing}
                  onFocus={() => bringToFront('breathing')}
                  initialMode={widgetConfigs.breathing?.initialMode || "Box"}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoMood
                  isOpen={widgets.mood}
                  onClose={() => closeWidget('mood')}
                  zIndex={zIndices.mood}
                  onFocus={() => bringToFront('mood')}
              />
            </React.Suspense>
          </div>
      </div>
      
      {/* 4. Global Settings Modal - System Layer (z-100) */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

    </div>
  );
};
