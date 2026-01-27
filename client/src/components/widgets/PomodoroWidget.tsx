import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Play, Pause, RotateCcw, Settings, Check, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
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

      // Schedule a distinct "Finished" notification
      LocalNotifications.schedule({
        notifications: [{
            id: 3001,
            title: mode === 'focus' ? "Session Complete! 🎉" : "Break Over! 🚀",
            body: mode === 'focus' ? "Great work. Time to recharge." : "Ready to focus again?",
            schedule: { at: new Date() },
            sound: 'res_bell.mp3'
        }]
      }).catch(console.error);
      
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

  const toggleTimer = (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop propagation for Minimized button
    if (!isActive) {
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

  // Circular Progress Calculation
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // --- MINIMIZED CONTENT ---
  const MinimizedContent = (
      <div className="flex items-center gap-3">
          {/* Time */}
          <span className="text-xl font-mono font-bold text-white tabular-nums tracking-tight">
              {formatTime(timeLeft)}
          </span>

          {/* Mode Badge */}
          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${mode === 'focus' ? 'bg-red-500/20 text-red-200' : 'bg-green-500/20 text-green-200'}`}>
              {mode}
          </span>

          {/* Control */}
          <button
                onClick={toggleTimer}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 ml-1"
          >
              {isActive ? <Pause size={14} className="text-white"/> : <Play size={14} className="text-white ml-0.5"/>}
          </button>
      </div>
  );

  return (
    <DraggableWindow 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Flow Timer" 
      initialWidth={340}
      initialHeight={480}
      defaultPosition={{ x: 80, y: 500 }}
      zIndex={zIndex || 10}
      onFocus={onFocus || (() => {})}
      icon={Clock}
      color="#F43F5E"
      minimizedContent={MinimizedContent}
      mobileMinimizedType="squircle"
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col items-center justify-center py-6 bg-black/80 h-full relative overflow-hidden font-sans">
        
        {/* Subtle Glow Background */}
        <motion.div 
            animate={{ opacity: isActive ? [0.1, 0.2, 0.1] : 0.05 }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-t from-transparent to-transparent via-white/5 pointer-events-none"
            style={{ background: `radial-gradient(circle at center, ${currentTheme.primaryColor}30 0%, transparent 70%)` }}
        />

        <button onClick={() => setIsEditing(!isEditing)} className="absolute top-3 right-3 text-white/30 hover:text-white transition-colors z-20">
            <Settings size={16} />
        </button>

        <AnimatePresence mode="wait">
        {!isEditing ? (
            <motion.div 
                key="timer"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center z-10 w-full"
            >
                <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                    {/* SVG Ring */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
                        <circle 
                            cx="128" cy="128" r={radius} 
                            stroke="rgba(255,255,255,0.05)" 
                            strokeWidth="4" 
                            fill="transparent" 
                        />
                        <motion.circle 
                            cx="128" cy="128" r={radius}
                            stroke={currentTheme.primaryColor}
                            strokeWidth="4" 
                            fill="transparent"
                            strokeDasharray={circumference}
                            animate={{ strokeDashoffset }}
                            transition={{ duration: 1, ease: "linear" }}
                            strokeLinecap="round"
                            className="filter drop-shadow-[0_0_8px_currentColor]"
                        />
                    </svg>
                    
                    {/* Time Display */}
                    <div className="text-center">
                        <motion.div 
                            key={formatTime(timeLeft)}
                            className="text-6xl font-light font-mono tracking-tighter text-white tabular-nums"
                        >
                            {formatTime(timeLeft)}
                        </motion.div>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/40 mt-2 font-medium">{mode}</p>
                    </div>
                </div>
                
                {/* Cheering Message Area */}
                <div className="h-8 mb-4 w-full px-6 text-center">
                    <AnimatePresence mode="wait">
                        {currentMessage && (
                            <motion.p 
                                key={currentMessage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-sm font-medium text-white/90"
                            >
                                {currentMessage}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6">
                    <button onClick={resetTimer} className="p-3 rounded-full text-white/30 hover:text-white hover:bg-white/5 transition-all"><RotateCcw size={20}/></button>
                    <button 
                        onClick={toggleTimer}
                        className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95"
                        style={{ backgroundColor: isActive ? 'white' : currentTheme.primaryColor, color: isActive ? 'black' : 'black' }}
                    >
                        {isActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                    <div className="w-12"></div> {/* Spacer for balance */}
                </div>
            </motion.div>
        ) : (
            <motion.div 
                key="settings"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="w-full px-8 z-10"
            >
                <h4 className="text-white font-serif text-xl mb-6 text-center">Timer Settings</h4>
                
                <div className="space-y-8">
                    {/* Focus Slider */}
                    <div>
                        <div className="flex justify-between text-xs text-white/50 uppercase tracking-widest mb-2">
                            <span>Focus</span>
                            <span>{focusDuration} min</span>
                        </div>
                        <input 
                            type="range" min="1" max="120" step="1"
                            value={focusDuration} 
                            onChange={(e) => setFocusDuration(Number(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer hover:bg-white/20 accent-white"
                        />
                        {/* Warning for low time */}
                        <AnimatePresence>
                            {focusDuration < 10 && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-1.5 mt-2 text-amber-400/80"
                                >
                                    <AlertCircle size={10} />
                                    <span className="text-[10px] font-medium">Recommendation: &gt; 10 mins for deep flow</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Break Slider */}
                    <div>
                        <div className="flex justify-between text-xs text-white/50 uppercase tracking-widest mb-2">
                            <span>Break</span>
                            <span>{breakDuration} min</span>
                        </div>
                        <input 
                            type="range" min="1" max="30" step="1"
                            value={breakDuration} 
                            onChange={(e) => setBreakDuration(Number(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer hover:bg-white/20 accent-white"
                        />
                         {/* Warning for low break time */}
                         <AnimatePresence>
                            {breakDuration < 5 && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-1.5 mt-2 text-amber-400/80"
                                >
                                    <AlertCircle size={10} />
                                    <span className="text-[10px] font-medium">Recommendation: &gt; 5 mins for recovery</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <button 
                    onClick={handleSaveSettings}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-10 text-black shadow-lg hover:brightness-110 transition-all"
                    style={{ backgroundColor: currentTheme.primaryColor }}
                >
                    <Check size={16} /> Save Changes
                </button>
            </motion.div>
        )}
        </AnimatePresence>
      </div>
    </DraggableWindow>
  );
};
