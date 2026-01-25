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
// REPLACED MemoryWall with TheWebWidget
const TheWebWidget = React.lazy(() => import('../components/widgets/TheWebWidget').then(m => ({ default: m.TheWebWidget })));

// Memoized Wrappers to prevent parent re-renders affecting heavy widgets
const MemoDiary = memo(Diary);
const MemoPomodoro = memo(PomodoroWidget);
const MemoJam = memo(JamWithAasthaWidget);
const MemoSoundscape = memo(Soundscape);
const MemoBreathing = memo(BreathingWidget);
const MemoMood = memo(MoodTracker);
const MemoWeb = memo(TheWebWidget); // New Name

const DESKTOP_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'chat-input-area',
    title: 'Say Hello!',
    content: 'This is where the magic happens. Talk to Aastha (or Aastik) about anything—your crush, your boss, or that weird dream you had. No judgment, ever.',
    position: 'top'
  },
  {
    targetId: 'nav-diary',
    title: 'Secret Vault',
    content: 'Your digital diary. It’s encrypted, password-protected, and locked tighter than Fort Knox. Your secrets are safe here.',
    position: 'right'
  },
  {
    targetId: 'nav-mood',
    title: 'Emotional Weather',
    content: 'Feeling sunny or stormy? Log your mood here. It helps us understand you better (and maybe cheer you up).',
    position: 'right'
  },
  {
    targetId: 'nav-breathing',
    title: 'Chill Pill',
    content: 'Anxious? Stressed? Just need a moment? Tap here for guided breathing exercises that actually work.',
    position: 'right'
  },
  {
    targetId: 'nav-jam',
    title: 'Jam Station',
    content: 'Queue up your favorite lo-fi beats or hype tracks from YouTube. Listening together is our love language.',
    position: 'right'
  },
  {
    targetId: 'nav-soundscape',
    title: 'Vibe Creator',
    content: 'Turn your room into a rainforest, a cafe, or a thunderstorm. Perfect for focus or just zoning out.',
    position: 'right'
  },
  {
    targetId: 'nav-pomodoro',
    title: 'Focus Mode',
    content: 'Got work to do? Use the Pomodoro timer to crush your tasks without burning out.',
    position: 'right'
  },
  {
    targetId: 'chat-input-area',
    title: 'It’s Magic (Literally)',
    content: 'Want to change the vibe? Just tell me! Try saying "Change theme to pink" or "Make it dark". I’m a genie, basically.',
    position: 'top'
  },
  {
    targetId: 'voice-mode-btn',
    title: 'No Typing Needed',
    content: 'Tired of typing? Tap the headset to talk to me in real-time. It’s like a phone call, but way less awkward.',
    position: 'bottom'
  },
  {
    targetId: 'center-screen',
    title: 'You’re All Set!',
    content: 'That’s the tour! Thanks for logging in. Your sanctuary awaits—go explore and make yourself at home.',
    position: 'bottom'
  }
];

const MOBILE_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'mobile-menu-btn',
    title: 'The Everything Button',
    content: 'Tap here to find all your cool tools: Diary, Music, Breathing, and more. It’s like a wellness Swiss Army knife.',
    position: 'bottom'
  },
  {
    targetId: 'chat-search-bar',
    title: 'Time Machine',
    content: 'Looking for that advice I gave you last week? Search your entire conversation history right here.',
    position: 'bottom'
  },
  {
    targetId: 'chat-input-area',
    title: 'Your Space',
    content: 'Chat with me here. You can type, use voice dictation, or even upload pics from your gallery to show me your world.',
    position: 'top'
  },
  {
    targetId: 'voice-mode-btn',
    title: 'Let’s Talk',
    content: 'Tap the headset for a real voice convo. Perfect for late-night vents or morning pep talks.',
    position: 'top'
  },
  {
    targetId: 'center-screen',
    title: 'You’re Ready!',
    content: 'Thanks for being here. This is your safe space now. Enjoy the vibes!',
    position: 'bottom'
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
    lore: false, // Keeps ID as 'lore' for compatibility with old state, but UI shows "The Web"
  });

  // Derived Status for Smart Header
  const currentActivity = widgets.diary ? 'Journaling' : (widgets.jam ? 'Jamming' : 'Online');

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
    lore: 50,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // FIX: Logic to bring window to front
  const bringToFront = React.useCallback((key: string) => {
    setZIndices(prev => {
        const values = Object.values(prev);
        const maxZ = values.length > 0 ? Math.max(...values) : 50;
        
        // OPTIMIZATION: If already highest, do nothing to prevent re-renders
        if (prev[key] === maxZ) return prev;

        // Always increment maxZ to ensure this specific window becomes the highest
        return { ...prev, [key]: maxZ + 1 };
    });
  }, []);

  const toggleWidget = (key: string) => {
    setWidgets(prev => {
        const isOpen = !prev[key];
        const newWidgets = { ...prev, [key]: isOpen };
        if (isOpen) bringToFront(key);
        return newWidgets;
    });
  };

  const openWidget = (key: string, config?: any) => {
    // If config provided, update it. If not, we might want to keep old or reset.
    // Current behavior: if config is undefined, keep old.
    // If you want to reset, you should pass {} or handle it.
    if (config) {
        setWidgetConfigs(prev => ({ ...prev, [key]: config }));
    }

    if (!widgets[key]) {
        const newWidgets = { ...widgets, [key]: true };
        setWidgets(newWidgets);
        bringToFront(key);
    } else {
        // Even if open, update config (e.g. changing song)
        bringToFront(key);
    }
  };

  const closeWidget = (key: string) => {
    setWidgets(prev => {
        const newWidgets = { ...prev, [key]: false };
        return newWidgets;
    });
  };

  // MEMOIZED HANDLERS
  const focusDiary = React.useCallback(() => bringToFront('diary'), [bringToFront]);
  const focusPomodoro = React.useCallback(() => bringToFront('pomodoro'), [bringToFront]);
  const focusJam = React.useCallback(() => bringToFront('jam'), [bringToFront]);
  const focusSoundscape = React.useCallback(() => bringToFront('soundscape'), [bringToFront]);
  const focusBreathing = React.useCallback(() => bringToFront('breathing'), [bringToFront]);
  const focusMood = React.useCallback(() => bringToFront('mood'), [bringToFront]);
  const focusLore = React.useCallback(() => bringToFront('lore'), [bringToFront]);

  return (
    <div className="relative w-full h-screen flex bg-transparent overflow-hidden">
      
      <OnboardingTour
         isOpen={showTour}
         steps={isMobile ? MOBILE_TOUR_STEPS : DESKTOP_TOUR_STEPS}
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
            currentActivity={currentActivity}
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
                onFocus={focusDiary}
                initialParams={widgetConfigs.diary}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoPomodoro
                  isOpen={widgets.pomodoro}
                  onClose={() => closeWidget('pomodoro')}
                  zIndex={zIndices.pomodoro}
                  onFocus={focusPomodoro}
                  initialParams={widgetConfigs.pomodoro}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoJam
                  isOpen={widgets.jam}
                  onClose={() => closeWidget('jam')}
                  zIndex={zIndices.jam}
                  onFocus={focusJam}
                  initialParams={widgetConfigs.jam}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoSoundscape
                  isOpen={widgets.soundscape}
                  onClose={() => closeWidget('soundscape')}
                  zIndex={zIndices.soundscape}
                  onFocus={focusSoundscape}
                  preset={widgetConfigs.soundscape?.preset}
                  volume={widgetConfigs.soundscape?.volume}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoBreathing
                  isOpen={widgets.breathing}
                  onClose={() => closeWidget('breathing')}
                  zIndex={zIndices.breathing}
                  onFocus={focusBreathing}
                  initialMode={widgetConfigs.breathing?.mode}
              />
            </React.Suspense>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoMood
                  isOpen={widgets.mood}
                  onClose={() => closeWidget('mood')}
                  zIndex={zIndices.mood}
                  onFocus={focusMood}
              />
            </React.Suspense>
          </div>

          {/* UPDATED: THE WEB WIDGET */}
          <div style={{ pointerEvents: 'auto' }}>
            <React.Suspense fallback={null}>
              <MemoWeb
                  isOpen={widgets.lore}
                  onClose={() => closeWidget('lore')}
                  zIndex={zIndices.lore}
                  onFocus={focusLore}
              />
            </React.Suspense>
          </div>
      </div>
      
      {/* 4. Global Settings Modal - System Layer (z-100) */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

    </div>
  );
};
