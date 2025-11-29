
import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Play, Pause, RotateCcw, Zap, Coffee, Brain, Check } from 'lucide-react';
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
    "Okay, let's get into the flow 🌊",
    "Starting is the hardest part, and you did it!",
    "Breathe. Focus. You got this.",
    "Let's crush this task.",
    "Setting the vibe... 🎧"
  ],
  50: [
    "Look at that, halfway through!",
    "You're doing amazing, honestly.",
    "Keep this rhythm going. 🕯️",
    "Don't break the streak now!",
    "Solid focus so far."
  ],
  75: [
    "Home stretch! Finish strong 🏁",
    "Almost time for a break.",
    "Last push, make it count.",
    "You're killing it today.",
    "So close! Don't stop now."
  ],
  100: [
    "You did it! Take a breather 🍃",
    "So proud of you. Rest up.",
    "Task complete! Vibes: Immaculate ✨",
    "And... exhale. You earned this break.",
    "Great session. Go stretch your legs!"
  ]
};

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { currentTheme } = useTheme();
  
  // Timer State
  const [totalDuration, setTotalDuration] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'short' | 'long' | 'custom'>('focus');
  
  // Custom Input State
  const [isEditing, setIsEditing] = useState(false);
  const [customInput, setCustomInput] = useState('25');
  const inputRef = useRef<HTMLInputElement>(null);

  // Motivation State
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [lastMilestone, setLastMilestone] = useState<number>(0); // 0, 25, 50, 75, 100

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
      audioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c153e1.mp3?filename=service-bell-ring-14610.mp3');
  }, []);

  // Timer Tick & Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          const newItem = prev - 1;
          checkMilestones(newItem);
          return newItem;
        });
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      checkMilestones(0); // Ensure 100% message triggers
      audioRef.current?.play().catch(e => console.log(e));
    }
    
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const checkMilestones = (currentSeconds: number) => {
    if (totalDuration === 0) return;
    
    // Calculate progress (0 to 100)
    // At start: (Total - Total)/Total = 0%
    // At end: (Total - 0)/Total = 100%
    const progress = ((totalDuration - currentSeconds) / totalDuration) * 100;
    
    let milestoneToCheck = 0;

    if (progress >= 100) milestoneToCheck = 100;
    else if (progress >= 75) milestoneToCheck = 75;
    else if (progress >= 50) milestoneToCheck = 50;
    else if (progress >= 25) milestoneToCheck = 25;

    // Only trigger if we hit a NEW milestone higher than the last one
    if (milestoneToCheck > lastMilestone && MESSAGES[milestoneToCheck as keyof typeof MESSAGES]) {
       const msgs = MESSAGES[milestoneToCheck as keyof typeof MESSAGES];
       const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
       setCurrentMessage(randomMsg);
       setLastMilestone(milestoneToCheck);
    }
  };

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(totalDuration);
    setLastMilestone(0);
    setCurrentMessage("");
  };

  const handlePreset = (presetMode: 'focus' | 'short' | 'long', minutes: number) => {
    setMode(presetMode);
    setTotalDuration(minutes * 60);
    setTimeLeft(minutes * 60);
    setLastMilestone(0);
    setCurrentMessage(presetMode === 'focus' ? "Ready to focus?" : "Time to relax.");
    setIsActive(false);
    setIsEditing(false);
  };

  const handleCustomTimeSubmit = () => {
    const mins = parseInt(customInput, 10);
    if (!isNaN(mins) && mins > 0) {
      setMode('custom');
      setTotalDuration(mins * 60);
      setTimeLeft(mins * 60);
      setLastMilestone(0);
      setCurrentMessage("Custom timer set.");
      setIsActive(false);
    }
    setIsEditing(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DraggableWindow 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Deep Work" 
      initialWidth={360}
      initialHeight={500}
      defaultPosition={{ x: 80, y: 150 }}
      zIndex={zIndex || 10}
      onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full rounded-3xl overflow-hidden font-sans">
        
        {/* --- TOP 60%: Dynamic Gradient --- */}
        <div 
          className="h-[60%] flex flex-col items-center justify-center relative p-6 transition-colors duration-700 ease-in-out"
          style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)` }}
        >
           {/* Custom Time Input or Display */}
           <div className="relative z-10 flex flex-col items-center justify-center w-full">
              {isEditing ? (
                <div className="flex items-center justify-center border-b-2 border-white/50 mb-4">
                  <input
                    ref={inputRef}
                    type="number"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onBlur={handleCustomTimeSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomTimeSubmit()}
                    className="w-48 bg-transparent text-center text-7xl font-serif text-white focus:outline-none placeholder-white/30"
                  />
                  <button onClick={handleCustomTimeSubmit} className="text-white hover:text-white/80 ml-2">
                    <Check size={32} />
                  </button>
                </div>
              ) : (
                <motion.div 
                  layoutId="timer-display"
                  onClick={() => {
                    setIsEditing(true);
                    setCustomInput(Math.floor(timeLeft / 60).toString());
                  }}
                  className="text-7xl md:text-8xl font-serif text-white tracking-tight cursor-pointer hover:opacity-90 transition-opacity drop-shadow-lg tabular-nums text-center select-none"
                >
                  {formatTime(timeLeft)}
                </motion.div>
              )}
              
              {/* Persona Message */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMessage || "default"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 text-white/80 text-sm font-medium text-center h-6 px-4"
                >
                  {currentMessage}
                </motion.div>
              </AnimatePresence>
           </div>

           {/* Optional: Subtle background pulse when active */}
           {isActive && (
             <motion.div 
                animate={{ opacity: [0, 0.2, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-white mix-blend-overlay pointer-events-none"
             />
           )}
        </div>

        {/* --- BOTTOM 40%: Solid Dark Controls --- */}
        <div className="h-[40%] bg-gray-900 flex flex-col items-center justify-between p-6">
            
            {/* Main Action Buttons */}
            <div className="flex items-center gap-8 w-full justify-center">
                <button 
                  onClick={resetTimer} 
                  className="p-4 rounded-full text-white/30 hover:text-white hover:bg-white/5 transition-all"
                  title="Reset"
                >
                    <RotateCcw size={20} />
                </button>
                
                <button 
                    onClick={toggleTimer}
                    className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-transform z-20"
                >
                    {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1"/>}
                </button>

                <div className="w-12 h-12"></div> {/* Spacer for balance */}
            </div>

            {/* Presets */}
            <div className="flex gap-3 w-full justify-center mt-2">
                <button 
                  onClick={() => handlePreset('focus', 25)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${mode === 'focus' ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Brain size={12} /> Focus
                </button>
                <button 
                  onClick={() => handlePreset('short', 5)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${mode === 'short' ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Coffee size={12} /> Short
                </button>
                <button 
                  onClick={() => handlePreset('long', 15)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${mode === 'long' ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Zap size={12} /> Long
                </button>
            </div>

        </div>
      </div>
    </DraggableWindow>
  );
};
