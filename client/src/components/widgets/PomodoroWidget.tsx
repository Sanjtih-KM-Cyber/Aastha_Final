import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Play, Pause, RotateCcw, Settings, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

interface PomodoroWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
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

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { currentTheme } = useTheme();
  
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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Calculate total time based on current mode settings
  const totalTime = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) : 0;

  useEffect(() => {
      audioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c153e1.mp3?filename=service-bell-ring-14610.mp3');
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
           const newVal = prev - 1;
           checkMilestones(newVal); // Check for cheer messages
           return newVal;
        });
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Timer Finished Logic
      audioRef.current?.play().catch(e => console.log(e));
      
      if (mode === 'focus') {
          // Focus Finished -> Auto-Start Break
          const nextDuration = breakDuration * 60;
          setMode('break');
          setTimeLeft(nextDuration);
          setLastMilestone(0);
          setCurrentMessage("Break started automatically. Relax! 🍃");
          setIsActive(true); // Keep running for break
      } else {
          // Break Finished -> Stop and Wait
          const nextDuration = focusDuration * 60;
          setMode('focus');
          setTimeLeft(nextDuration);
          setLastMilestone(0);
          setCurrentMessage("Break over. Ready to focus? 🚀");
          setIsActive(false); // Stop running
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode, focusDuration, breakDuration]);

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

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
    setLastMilestone(0);
    setCurrentMessage("");
  };

  const handleSaveSettings = () => {
      setIsEditing(false);
      resetTimer();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Circular Progress Calculation
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

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