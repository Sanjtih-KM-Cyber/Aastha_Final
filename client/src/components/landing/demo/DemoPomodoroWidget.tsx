import React, { useState, useEffect } from 'react';
import { LandingDraggableWindow } from './LandingDraggableWindow';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';
// Removing ThemeContext dependency as it's not strictly needed for this demo widget to function visually,
// and we want to avoid complex dependencies for the landing page demo.
// If needed, we can mock or use a simple prop.

interface PomodoroWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  defaultPosition?: { x: number; y: number };
}

export const DemoPomodoroWidget: React.FC<PomodoroWidgetProps> = ({ isOpen, onClose, zIndex, onFocus, defaultPosition }) => {
  // Hardcoded for demo consistency
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [isEditing, setIsEditing] = useState(false);
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);

  const totalTime = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
        setIsActive(false);
        setMode(mode === 'focus' ? 'break' : 'focus');
        setTimeLeft(mode === 'focus' ? breakDuration * 60 : focusDuration * 60);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => { setIsActive(false); setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60); };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <LandingDraggableWindow
      isOpen={isOpen}
      onClose={onClose}
      title="Focus Timer"
      initialWidth={320}
      initialHeight={460}
      defaultPosition={defaultPosition || { x: 80, y: 100 }}
      zIndex={zIndex}
      onFocus={onFocus}
      resizable={true}
    >
      <div className="flex flex-col h-full bg-md-surface relative font-sans overflow-hidden">
         {/* Background Glow */}
         <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 ${isActive ? 'bg-md-primary/10' : 'bg-md-on-surface/5'} rounded-full blur-[60px] transition-colors duration-1000`} />

         <button onClick={() => setIsEditing(!isEditing)} className="absolute top-4 right-4 z-20 text-md-on-surface-variant/50 hover:text-md-on-surface transition-colors">
            <Settings size={18}/>
         </button>

         {!isEditing ? (
             <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-6">

                {/* Timer Circle - Responsive */}
                <div className="relative w-full h-auto max-w-[85%] aspect-square flex items-center justify-center mb-8 shrink-0">
                    {/* SVG Progress Ring */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 260 260">
                        {/* Track */}
                        <circle
                            cx="130"
                            cy="130"
                            r={radius}
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="4"
                        />
                        {/* Progress */}
                        <circle
                            cx="130"
                            cy="130"
                            r={radius}
                            fill="none"
                            stroke={mode === 'focus' ? 'rgb(var(--md-primary))' : 'rgb(var(--md-tertiary))'}
                            strokeWidth="4"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                        />
                    </svg>

                    <div className="text-center absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-5xl md:text-6xl lg:text-7xl font-light font-mono text-md-on-surface mb-2 tracking-tighter tabular-nums drop-shadow-lg">
                            {formatTime(timeLeft)}
                        </div>
                        <p className={`text-xs md:text-sm uppercase tracking-[0.3em] font-bold ${mode === 'focus' ? 'text-md-primary' : 'text-md-primary'}`}>
                            {isActive ? 'Running' : mode}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-8 mb-4">
                    <button onClick={resetTimer} className="p-4 rounded-full text-md-on-surface-variant/70 hover:text-md-on-surface hover:bg-md-on-surface/[0.06] transition-all">
                        <RotateCcw size={20}/>
                    </button>
                    <button
                        onClick={toggleTimer}
                        className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all ${
                            isActive
                                ? 'bg-md-surface-container-highest text-md-on-surface border border-md-outline-variant'
                                : 'bg-white text-black'
                        }`}
                    >
                        {isActive ? <Pause size={28} fill="currentColor"/> : <Play size={28} fill="currentColor" className="ml-1"/>}
                    </button>
                    <div className="w-[52px]" /> {/* Spacer for centering */}
                </div>
             </div>
         ) : (
             <div className="flex-1 flex flex-col p-8 z-10 overflow-y-auto custom-scrollbar">
                 <h4 className="text-md-on-surface font-medium text-lg mb-8 flex items-center gap-2">
                    <Settings size={18} className="text-violet-500"/>
                    Timer Settings
                 </h4>

                 <div className="space-y-8">
                     <div className="bg-md-surface-container p-6 rounded-2xl border border-md-outline-variant/30">
                         <div className="flex justify-between items-center mb-4">
                             <span className="text-sm font-medium text-md-on-surface-variant">Focus Duration</span>
                             <span className="text-sm font-bold text-md-primary">{focusDuration} min</span>
                         </div>
                         <input
                            type="range"
                            min="1"
                            max="90"
                            value={focusDuration}
                            onChange={e => setFocusDuration(Number(e.target.value))}
                            className="w-full h-1.5 bg-md-surface-container-lowest rounded-full accent-violet-500 appearance-none cursor-pointer"
                         />
                         <div className="flex justify-between text-[10px] text-md-on-surface-variant/50 mt-2 font-mono">
                             <span>1m</span>
                             <span>90m</span>
                         </div>
                     </div>

                     <div className="bg-md-surface-container p-6 rounded-2xl border border-md-outline-variant/30">
                         <div className="flex justify-between items-center mb-4">
                             <span className="text-sm font-medium text-md-on-surface-variant">Break Duration</span>
                             <span className="text-sm font-bold text-md-primary">{breakDuration} min</span>
                         </div>
                         <input
                            type="range"
                            min="1"
                            max="30"
                            value={breakDuration}
                            onChange={e => setBreakDuration(Number(e.target.value))}
                            className="w-full h-1.5 bg-md-surface-container-lowest rounded-full accent-teal-500 appearance-none cursor-pointer"
                         />
                         <div className="flex justify-between text-[10px] text-md-on-surface-variant/50 mt-2 font-mono">
                             <span>1m</span>
                             <span>30m</span>
                         </div>
                     </div>
                 </div>

                 <button
                    onClick={() => { setIsEditing(false); resetTimer(); }}
                    className="w-full py-4 bg-md-primary text-md-on-primary hover:brightness-110 rounded-xl font-bold text-md-on-surface mt-8 transition-colors shadow-lg shadow-violet-900/20"
                >
                    Save Changes
                </button>
             </div>
         )}
      </div>
    </LandingDraggableWindow>
  );
};
