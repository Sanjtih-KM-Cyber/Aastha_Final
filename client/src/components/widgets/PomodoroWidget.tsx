import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Play, Pause, RotateCcw, Settings, Check, AlertCircle, Clock } from 'lucide-react';
import { Icons } from '../../design/icons';
import { Button, IconButton } from '../../design/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NOTIF_IDS, CHANNELS, cancelIds, scheduleOne } from '../../services/notifications';
import { App as CapacitorApp } from '@capacitor/app';
import { backgroundService } from '../../services/backgroundService';

interface PomodoroWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  persistenceKey?: string;
  initialParams?: {
      mode?: 'focus' | 'break';
      focusDuration?: number;
      breakDuration?: number;
  };
}

const MESSAGES = {
  25: [
    "Great start! You've broken the inertia. 🚀",
    "You're in the groove now. Keep flowing. 🌊",
    "First quarter down. You got this! 💪",
    "Focus is building up. Stay with it. 🧱",
    "The hardest part is over. Keep going. ✨"
  ],
  50: [
    "Halfway there! You're crushing it. 🔥",
    "Look at that focus! 50% done. 👀",
    "You are unstoppable right now. ⚡",
    "Solid progress. Keep this energy. 🔋",
    "Middle of the mountain. Enjoy the view! 🏔️"
  ],
  75: [
    "Home stretch! Finish strong. 🏁",
    "Almost there. Don't stop now! 🚫",
    "Final push! You're doing amazing. 🌟",
    "So close to the finish line. 🏃",
    "Keep pushing, reward coming soon! 🎁"
  ],
  100: [
    "You did it! Take a well-earned break. 🍃",
    "Session complete! Awesome work. 🎉",
    "Time to recharge. You earned it. 🔋",
    "Great focus session! Relax now. 😌",
    "Goal smashed! Go stretch your legs. 🚶"
  ]
};

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ isOpen, onClose, zIndex, onFocus, persistenceKey, initialParams }) => {
  const { currentTheme } = useTheme();
  const { setPreventAutoLock } = useAuth();
  
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  
  const [isEditing, setIsEditing] = useState(false);
  
  // Time Settings
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);

  // Motivation State
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [lastMilestone, setLastMilestone] = useState<number>(0);

  // Persistence State
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Calculate total time based on current mode settings
  const totalTime = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) : 0;

  useEffect(() => {
      // Use a reliable CDN for a simple bell.
      audioRef.current = new Audio('https://codeskulptor-demos.commondatastorage.googleapis.com/assets/sound/bell.mp3');
  }, []);

  // AUTO-LOCK PREVENTION
  useEffect(() => {
      setPreventAutoLock('pomodoro-widget', isActive);
      return () => setPreventAutoLock('pomodoro-widget', false);
  }, [isActive, setPreventAutoLock]);

  // ✅ FIXED: Force Stop when Closed (User clicks X)
  // This ensures the background service is KILLED if you close the widget explicitly.
  useEffect(() => {
      if (!isOpen && isActive) {
          setIsActive(false);
          setTargetEndTime(null);
          backgroundService.disable('pomodoro');
      }
  }, [isOpen]); 

  // --- PERSISTENCE: LOAD ---
  useEffect(() => {
      const saved = localStorage.getItem('pomodoro_state');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (parsed.focusDuration) setFocusDuration(parsed.focusDuration);
              if (parsed.breakDuration) setBreakDuration(parsed.breakDuration);
              if (parsed.mode) setMode(parsed.mode);

              if (parsed.isActive && parsed.targetEndTime) {
                  const now = Date.now();
                  const remaining = Math.floor((parsed.targetEndTime - now) / 1000);

                  if (remaining > 0) {
                      setTimeLeft(remaining);
                      setIsActive(true);
                      setTargetEndTime(parsed.targetEndTime);
                      // Resume background service if it was active
                      backgroundService.enable(
                          'pomodoro', 
                          parsed.mode === 'focus' ? "Focus Mode Active 🧠" : "Break Time 🍃",
                          "Resuming session..."
                      );
                  } else {
                      // Timer finished while away
                      setTimeLeft(0);
                      setIsActive(false); // It finished
                      setTargetEndTime(null);
                      setCurrentMessage(parsed.mode === 'focus' ? "Focus session completed while away!" : "Break finished!");
                  }
              } else if (parsed.timeLeft) {
                  // Not active, just restore paused time
                  setTimeLeft(parsed.timeLeft);
              }
          } catch (e) { console.error("Failed to load pomodoro state", e); }
      }
  }, []);

  // --- PERSISTENCE: SAVE ---
  useEffect(() => {
      const state = {
          isActive,
          targetEndTime,
          timeLeft,
          mode,
          focusDuration,
          breakDuration
      };
      localStorage.setItem('pomodoro_state', JSON.stringify(state));
  }, [isActive, targetEndTime, timeLeft, mode, focusDuration, breakDuration]);


  // --- BACKGROUND HANDLING ---
  useEffect(() => {
      // Re-sync time on app resume (failsafe)
      const handleAppStateChange = async (state: any) => {
          if (state.isActive) {
              if (isActive && targetEndTime) {
                  const now = Date.now();
                  const remaining = Math.floor((targetEndTime - now) / 1000);
                  if (remaining > 0) {
                      setTimeLeft(remaining);
                  } else {
                      setTimeLeft(0);
                  }
              }
          }
      };

      const listener = CapacitorApp.addListener('appStateChange', handleAppStateChange);
      return () => { listener.then(l => l.remove()); };
  }, [isActive, targetEndTime]);

  // Update Background Notification periodically
  useEffect(() => {
    // ✅ ADDED CHECK: Only update if widget is actually OPEN and ACTIVE
    if (isOpen && isActive && timeLeft > 0) {
       const title = mode === 'focus' ? `Focusing` : `Break`; // Short title
       const timeStr = formatTime(timeLeft);
       // Use currentMessage or a default one
       const msg = currentMessage || (mode === 'focus' ? "Stay in the flow" : "Recharge");

       const body = `${timeStr} - ${msg}`;

       backgroundService.updateReason('pomodoro', title, body);
    }
  }, [timeLeft, isActive, mode, currentMessage, isOpen]);


  // GOD MODE: Apply AI Instructions (Full Control)
  useEffect(() => {
      if (isOpen && initialParams) {
          // 1. Handle explicit commands (Start, Stop, Pause, Resume, Reset)
          // The 'action' param takes precedence over simple state updates
          const action = (initialParams as any).action;

          if (action) {
              if (action === 'stop' || action === 'pause') {
                  if (isActive) {
                      setIsActive(false);
                      setTargetEndTime(null);
                      backgroundService.disable('pomodoro');
                  }
                  return; // Exit early
              }

              if (action === 'resume' || action === 'start') {
                  if (!isActive) {
                      const now = Date.now();
                      const end = now + (timeLeft * 1000);
                      setTargetEndTime(end);
                      setIsActive(true);
                      backgroundService.enable(
                          'pomodoro',
                          mode === 'focus' ? "Focus Mode Active 🧠" : "Break Time 🍃",
                          "Resuming..."
                      );
                  }
                  return; // Exit early
              }

              if (action === 'reset') {
                   setIsActive(false);
                   const duration = mode === 'focus' ? focusDuration : breakDuration;
                   setTimeLeft(duration * 60);
                   setLastMilestone(0);
                   setCurrentMessage("");
                   setTargetEndTime(null);
                   backgroundService.disable('pomodoro');
                   return; // Exit early
              }
          }

          // 2. Handle Configuration Updates (Mode/Duration)
          let shouldReset = false;
          if (initialParams.focusDuration && initialParams.focusDuration !== focusDuration) {
             setFocusDuration(initialParams.focusDuration);
             shouldReset = true;
          }
          if (initialParams.breakDuration && initialParams.breakDuration !== breakDuration) {
             setBreakDuration(initialParams.breakDuration);
             shouldReset = true;
          }

          if (initialParams.mode) {
              setMode(initialParams.mode);
              shouldReset = true;
          }

          // Auto-start if duration/mode changed significantly
          if (shouldReset) {
              const duration = (initialParams.mode || mode) === 'focus'
                 ? (initialParams.focusDuration || focusDuration)
                 : (initialParams.breakDuration || breakDuration);

              // Only reset if duration changed significantly or user asked for it
              if (Math.abs(timeLeft - duration * 60) > 10) {
                  setTimeLeft(duration * 60);
                  const newTarget = Date.now() + (duration * 60 * 1000);
                  setTargetEndTime(newTarget);
                  setIsActive(true);
                  // Enable background immediately for AI
                  backgroundService.enable(
                      'pomodoro',
                      mode === 'focus' ? "Focus Mode Active 🧠" : "Break Time 🍃",
                      "AI Started Session"
                  );
              }
          }
      }
  }, [isOpen, initialParams]);

  // Pre-schedule the end-of-session alert with the OS. JS timers pause when the app is backgrounded
  // or the screen is locked, so a notification sent "when timeLeft hits 0" never arrived on phones.
  useEffect(() => {
    if (isActive && targetEndTime && targetEndTime > Date.now() + 1000) {
      scheduleOne({
        id: NOTIF_IDS.POMODORO_DONE,
        title: mode === 'focus' ? "Session complete! 🎉" : "Break over! 🚀",
        body: mode === 'focus' ? "Great work. Time to recharge." : "Ready to focus again?",
        at: new Date(targetEndTime),
        channel: CHANNELS.TIMERS,
      }).catch(console.error);
    } else if (!isActive) {
      cancelIds([NOTIF_IDS.POMODORO_DONE]);
    }
  }, [isActive, targetEndTime, mode]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    // ✅ ADDED CHECK: Only tick if Open AND Active
    if (isOpen && isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
           // Self-correction using targetEndTime if available
           if (targetEndTime) {
               const now = Date.now();
               const remaining = Math.floor((targetEndTime - now) / 1000);
               // If deviation is large, sync. Else smooth decrement.
               if (Math.abs(remaining - prev) > 2) {
                   checkMilestones(remaining);
                   return remaining;
               }
           }

           const newVal = prev - 1;
           checkMilestones(newVal);
           return newVal;
        });
      }, 1000);
    } else if (timeLeft <= 0 && isActive) { 
      // Timer Finished Logic
      audioRef.current?.play().catch(e => console.log(e));

      // The "finished" notification is pre-scheduled with the OS for targetEndTime (see effect below),
      // so it also fires when the phone is locked / app is in the background (M3).

      if (mode === 'focus') {
          // Focus Finished -> Auto-Start Break
          const nextDuration = breakDuration * 60;
          setMode('break');
          setTimeLeft(nextDuration);
          setLastMilestone(0);
          setCurrentMessage("Break started automatically. Relax! 🍃");
          // Update Target for Break
          setTargetEndTime(Date.now() + nextDuration * 1000);
          setIsActive(true);
      } else {
          // Break Finished -> Stop and Wait
          const nextDuration = focusDuration * 60;
          setMode('focus');
          setTimeLeft(nextDuration);
          setLastMilestone(0);
          setCurrentMessage("Break over. Ready to focus? 🚀");
          setIsActive(false);
          setTargetEndTime(null);
          backgroundService.disable('pomodoro'); // Stop background mode
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode, focusDuration, breakDuration, targetEndTime, isOpen]); // Added isOpen dependency

  const checkMilestones = (currentSeconds: number) => {
    if (totalTime === 0) return; 
    
    // Calculate percentage complete (0 to 100)
    const percentDone = ((totalTime - currentSeconds) / totalTime) * 100;
    
    let milestoneToCheck = 0;
    if (percentDone >= 100) milestoneToCheck = 100;
    else if (percentDone >= 75) milestoneToCheck = 75;
    else if (percentDone >= 50) milestoneToCheck = 50;
    else if (percentDone >= 25) milestoneToCheck = 25;

    // Trigger only once per milestone crossing
    if (milestoneToCheck > lastMilestone) {
       const msgs = MESSAGES[milestoneToCheck as keyof typeof MESSAGES];
       if (msgs) {
           const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
           setCurrentMessage(randomMsg);
       }
       setLastMilestone(milestoneToCheck);
    }
  };

  const toggleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop propagation for Minimized button
    if (!isActive) {
        // Request permissions first
        await LocalNotifications.requestPermissions();

        // Start
        const now = Date.now();
        const end = now + (timeLeft * 1000);
        setTargetEndTime(end);
        setIsActive(true);
        backgroundService.enable(
            'pomodoro',
            mode === 'focus' ? "Focus Mode Active 🧠" : "Break Time 🍃",
            "Starting..."
        );
    } else {
        // Pause
        setTargetEndTime(null);
        setIsActive(false);
        backgroundService.disable('pomodoro');
    }
  };
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
    setLastMilestone(0);
    setCurrentMessage("");
    setTargetEndTime(null);
    backgroundService.disable('pomodoro');
  };

  const handleSaveSettings = () => {
      setIsEditing(false);
      resetTimer();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Circular Progress Calculation (M3 circular progress: thick track + rounded active arc)
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const fill = (v: number, min: number, max: number) => ({ ['--fill' as any]: `${Math.round(((v - min) / (max - min)) * 100)}%` } as React.CSSProperties);

  // --- MINIMIZED CONTENT (lives inside the glass title bar) ---
  const MinimizedContent = (
      <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-md-on-surface tabular-nums tracking-tight">{formatTime(timeLeft)}</span>
          <span className={`text-[11px] font-medium px-2 h-6 inline-flex items-center rounded-full ${mode === 'focus' ? 'bg-md-primary-container text-md-on-primary-container' : 'bg-md-tertiary-container text-md-on-tertiary-container'}`}>
              {mode === 'focus' ? 'Focus' : 'Break'}
          </span>
          <button
                onClick={toggleTimer}
                aria-label={isActive ? 'Pause' : 'Start'}
                className="w-8 h-8 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center shrink-0"
          >
              {isActive ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
          </button>
      </div>
  );

  return (
    <DraggableWindow
      isOpen={isOpen}
      onClose={onClose}
      title="Focus"
      initialWidth={360}
      initialHeight={540}
      defaultPosition={{ x: 80, y: 500 }}
      zIndex={zIndex || 10}
      onFocus={onFocus || (() => {})}
      icon={Icons.focus}
      minimizedContent={MinimizedContent}
      mobileMinimizedType="squircle"
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col h-full w-full font-sans px-3 pb-3 gap-3">
        <AnimatePresence mode="wait">
        {!isEditing ? (
            <motion.div
                key="timer"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 min-h-0 flex flex-col gap-3"
            >
                <div className="flex-1 min-h-0 rounded-[28px] bg-md-surface-container relative flex flex-col items-center justify-center py-4">
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium ${mode === 'focus' ? 'bg-md-primary-container text-md-on-primary-container' : 'bg-md-tertiary-container text-md-on-tertiary-container'}`}>
                            {mode === 'focus' ? '🧠 Focus' : '🍃 Break'}
                        </span>
                        <IconButton label="Timer settings" onClick={() => setIsEditing(true)}><Settings size={18} /></IconButton>
                    </div>

                    <div className="relative w-60 h-60 flex items-center justify-center mt-6">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
                            <circle cx="128" cy="128" r={radius} stroke="rgb(var(--md-surface-container-highest))" strokeWidth="12" fill="transparent" />
                            <motion.circle
                                cx="128" cy="128" r={radius}
                                stroke="rgb(var(--md-primary))"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={circumference}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 1, ease: 'linear' }}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="text-center">
                            <div className="text-[56px] leading-none font-light text-md-on-surface tabular-nums tracking-tight">{formatTime(timeLeft)}</div>
                            <p className="text-xs text-md-on-surface-variant mt-2">{mode === 'focus' ? `${focusDuration} min focus` : `${breakDuration} min break`}</p>
                        </div>
                    </div>

                    <div className="h-8 mt-2 w-full px-6 text-center">
                        <AnimatePresence mode="wait">
                            {currentMessage && (
                                <motion.p
                                    key={currentMessage}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="text-sm font-medium text-md-on-surface"
                                >
                                    {currentMessage}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                    <IconButton variant="tonal" size="lg" label="Reset timer" onClick={resetTimer}><RotateCcw size={20}/></IconButton>
                    <Button size="lg" className="flex-1" onClick={toggleTimer} icon={isActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}>
                        {isActive ? 'Pause' : timeLeft < (mode === 'focus' ? focusDuration : breakDuration) * 60 ? 'Resume' : 'Start'}
                    </Button>
                </div>
            </motion.div>
        ) : (
            <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex-1 flex flex-col gap-3"
            >
                <div className="rounded-[28px] bg-md-surface-container p-5 space-y-6">
                    <h4 className="text-md-on-surface text-lg font-medium">Timer lengths</h4>
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-md-on-surface">Focus</span>
                            <span className="text-md-primary font-medium tabular-nums">{focusDuration} min</span>
                        </div>
                        <input
                            type="range" min="1" max="120" step="1"
                            value={focusDuration}
                            aria-label="Focus minutes"
                            onChange={(e) => setFocusDuration(Number(e.target.value))}
                            className="m3-slider"
                            style={fill(focusDuration, 1, 120)}
                        />
                        <AnimatePresence>
                            {focusDuration < 10 && (
                                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-1.5 mt-2 text-xs text-md-on-surface-variant">
                                    <AlertCircle size={12} /> 10+ minutes usually works better for deep focus.
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-md-on-surface">Break</span>
                            <span className="text-md-primary font-medium tabular-nums">{breakDuration} min</span>
                        </div>
                        <input
                            type="range" min="1" max="30" step="1"
                            value={breakDuration}
                            aria-label="Break minutes"
                            onChange={(e) => setBreakDuration(Number(e.target.value))}
                            className="m3-slider"
                            style={fill(breakDuration, 1, 30)}
                        />
                        <AnimatePresence>
                            {breakDuration < 5 && (
                                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-1.5 mt-2 text-xs text-md-on-surface-variant">
                                    <AlertCircle size={12} /> 5+ minutes helps you actually recover.
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <div className="mt-auto flex gap-2">
                    <Button variant="text" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button size="lg" className="flex-1" onClick={handleSaveSettings} icon={<Check size={18} />}>Save</Button>
                </div>
            </motion.div>
        )}
        </AnimatePresence>
      </div>
    </DraggableWindow>
  );
};
