import React, { useState, useEffect, memo } from 'react';
import { WellnessHub } from '../components/wellness/WellnessHub';
import { ChatView } from '../components/chat/ChatView';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { useSync } from '../context/SyncContext';
import { OnboardingTour, TourStep } from '../components/landing/OnboardingTour';
import { SafetyIntroCard } from '../components/SafetyIntroCard';
import { LegalConsentDialog } from '../components/LegalConsentDialog';
import { useSanctuaryFonts } from '../hooks/useAppFonts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MobileTabBar, TabKey } from '../components/layout/MobileTabBar';

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

/**
 * First-run tour — different on phone and desktop because the app is different there:
 * phone = bottom tabs + gestures; desktop = sidebar toolkit with draggable windows + hover actions.
 * Targets are real element ids (chat-input-area, mobile-tab-bar, voice-mode-btn, sidebar-toolkit, sidebar-settings).
 */
const buildTourSteps = (bot: string, firstName: string, phone: boolean): TourStep[] => {
  const hi = firstName ? `Hi ${firstName}, I’m ${bot}` : `Hi, I’m ${bot}`;
  const welcome: TourStep = { art: 'welcome', title: hi, content: `Think of me as the friend who’s always around — to listen, joke about nothing, or help you think something through. Want a quick look around? It takes 30 seconds.` };
  const done: TourStep = { art: 'done', title: 'You’re all set', content: `This is your space. Say hi whenever you’re ready — I’ll be right here.` };
  if (phone) return [
    welcome,
    { targetId: 'chat-input-area', title: 'Talk your way', content: `Type, tap the mic for a voice note, or share a photo. Write in any language — I’ll follow you.` },
    { art: 'gestures', title: 'Little gestures', content: 'Swipe a message to the right to reply, tap it to copy, and press and hold one of mine to react.' },
    { targetId: 'mobile-tab-bar', art: 'tabs', title: 'Everything is one tap away', content: 'Diary is your locked journal, Mood tracks how you feel, Relax has breathing, music and sounds, and Me is where you make the app yours.' },
    { targetId: 'voice-mode-btn', title: 'Rather talk?', content: 'Tap the headphones for a real voice conversation — made for late-night vents and long walks.' },
    done,
  ];
  return [
    welcome,
    { targetId: 'sidebar-toolkit', position: 'right', title: 'Your toolkit', content: 'Diary, Mood, The Web, Breathing, Music, Sounds and Focus open as windows. Drag them anywhere, resize them, or minimise them while we chat.' },
    { targetId: 'chat-input-area', position: 'top', title: 'Talk your way', content: 'Type and press Enter, record a voice note with the mic, or drop in a photo. Hover any message to reply, copy or react.' },
    { targetId: 'voice-mode-btn', position: 'bottom', art: 'voice', title: 'Rather talk?', content: 'Click the headphones for a real voice conversation.' },
    { targetId: 'sidebar-settings', position: 'right', art: 'personalise', title: 'Make it yours', content: 'Pick any colour from the wheel, change the fonts, choose Mac or Windows window buttons, and decide how close we are.' },
    done,
  ];
};

export const Sanctuary: React.FC = () => {
  const { emit, subscribe } = useSync();
  const { user, completeOnboarding, updateUser, logout } = useAuth();
  useSanctuaryFonts(); // user's font choice — Sanctuary only (removed again on the public pages)

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

  // "How Aastha keeps you safe" — once per account, after the tour (7.5)
  const safetyKey = user?._id ? `aastha_safety_intro_seen:${user._id}` : '';
  const [showSafetyIntro, setShowSafetyIntro] = useState(false);
  useEffect(() => {
    if (!user || showTour || user.isOnboardingComplete === false || user.safetyIntroSeen) return;
    let seen = false;
    try { seen = !!safetyKey && localStorage.getItem(safetyKey) === '1'; } catch { /* ignore */ }
    if (seen) return;
    const t = setTimeout(() => setShowSafetyIntro(true), 800);
    return () => clearTimeout(t);
  }, [user, showTour, safetyKey]);
  const closeSafetyIntro = () => {
    setShowSafetyIntro(false);
    try { if (safetyKey) localStorage.setItem(safetyKey, '1'); } catch { /* ignore */ }
    updateUser({ safetyIntroSeen: true });
    api.post('/users/safety-intro').catch(() => {});
  };

  const [widgets, setWidgets] = useState<Record<string, boolean>>({
    diary: false,
    pomodoro: false,
    jam: false,
    soundscape: false,
    breathing: false,
    mood: false,
    lore: false,
  });

  // --- PERSISTENCE: Load & Save Widget State ---
  useEffect(() => {
      try {
          const savedWidgets = localStorage.getItem('sanctuary_active_widgets');
          if (savedWidgets) {
              setWidgets(JSON.parse(savedWidgets));
          }
      } catch (e) {
          console.warn("Failed to load active widgets", e);
      }
  }, []);

  useEffect(() => {
      localStorage.setItem('sanctuary_active_widgets', JSON.stringify(widgets));
  }, [widgets]);

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

  // --- PHONE TAB BAR (Phase 5) ---
  const RELAX_WIDGETS = ['pomodoro', 'jam', 'soundscape', 'breathing', 'lore'];
  const topOpenWidget = Object.keys(widgets)
    .filter((k) => widgets[k])
    .sort((a, b) => (zIndices[b] || 0) - (zIndices[a] || 0))[0];
  const activeTab: TabKey = isSettingsOpen ? 'me'
    : isMobileMenuOpen ? 'relax'
    : topOpenWidget === 'diary' ? 'diary'
    : topOpenWidget === 'mood' ? 'mood'
    : topOpenWidget && RELAX_WIDGETS.includes(topOpenWidget) ? 'relax'
    : 'chat';

  const handleTabSelect = (tab: TabKey) => {
    if (tab === 'chat') {
      // back to the conversation: close every full-screen widget sheet
      setWidgets(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false])) as typeof prev);
      return;
    }
    if (tab === 'diary') return openWidget('diary');
    if (tab === 'mood') return openWidget('mood');
    if (tab === 'relax') return setIsMobileMenuOpen(true);
    if (tab === 'me') return setIsSettingsOpen(true);
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
      
      {user && user.legalConsentCurrent === false && (
        <LegalConsentDialog onAccepted={() => updateUser({ legalConsentCurrent: true })} onLogout={() => logout()} />
      )}
      {showSafetyIntro && user?.legalConsentCurrent !== false && <SafetyIntroCard botName={user?.persona === 'aarav' ? 'Aastik' : 'Aastha'} onClose={closeSafetyIntro} />}

      <OnboardingTour
         isOpen={showTour}
         steps={buildTourSteps(user?.persona === 'aarav' ? 'Aastik' : 'Aastha', String(user?.name || '').split(' ')[0], isMobile)}
         botName={user?.persona === 'aarav' ? 'Aastik' : 'Aastha'}
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
                persistenceKey="diary"
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
                  persistenceKey="pomodoro"
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
                  persistenceKey="jam"
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
                  persistenceKey="soundscape"
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
                  persistenceKey="breathing"
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
                  persistenceKey="mood"
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
                  persistenceKey="lore"
              />
            </React.Suspense>
          </div>
      </div>
      
      {/* 4. Global Settings Modal - System Layer (z-100) */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 5. Phone-first navigation (Phase 5) — hidden while full-screen overlays are open */}
      {isMobile && !isSettingsOpen && !isMobileMenuOpen && (
        <div className="relative z-[200]">
          <MobileTabBar active={activeTab} onSelect={handleTabSelect} />
        </div>
      )}

    </div>
  );
};
