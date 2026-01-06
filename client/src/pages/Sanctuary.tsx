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
