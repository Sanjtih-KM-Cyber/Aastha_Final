import React, { useEffect, useState } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Play, Pause, RotateCcw, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface BreathingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: string;
  zIndex?: number;
  onFocus?: () => void;
}

const MODES = {
  Box: { 
      label: 'Box Focus', 
      pattern: [4000, 4000, 4000, 4000], 
      steps: ['Inhale', 'Hold', 'Exhale', 'Hold'],
      description: "Heighten performance and concentration."
  },
  Relax: { 
      label: '4-7-8 Sleep', 
      pattern: [4000, 7000, 8000], 
      steps: ['Inhale', 'Hold', 'Exhale'],
      description: "Natural tranquilizer for sleep & anxiety."
  },
  Resonance: { 
      label: 'Coherence', 
      pattern: [6000, 6000], 
      steps: ['Inhale', 'Exhale'],
      description: "Sync heart rate variability for balance."
  },
  Energy: { 
      label: 'Energy', 
      pattern: [4000, 2000], 
      steps: ['Inhale', 'Exhale'],
      description: "Quick rhythm to wake up your brain."
  },
  Grounding: { 
      label: '5-5-5 Calm', 
      pattern: [5000, 5000, 5000], 
      steps: ['Inhale', 'Hold', 'Exhale'],
      description: "Slows a racing heart during overwhelm."
  }
};

export const BreathingWidget: React.FC<BreathingWidgetProps> = ({ isOpen, onClose, initialMode, zIndex, onFocus }) => {
  const { currentTheme } = useTheme();
  const [activeMode, setActiveMode] = useState<keyof typeof MODES>('Box');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  const currentPattern = MODES[activeMode].pattern;
  const currentSteps = MODES[activeMode].steps;
  const phaseLabel = currentSteps[phaseIndex];
  const duration = currentPattern[phaseIndex];

  // Handle AI Pre-selection
  useEffect(() => {
    if (initialMode && isOpen) {
        const match = Object.keys(MODES).find(k => k.toLowerCase() === initialMode.toLowerCase() || MODES[k as keyof typeof MODES].label.toLowerCase().includes(initialMode.toLowerCase()));
        if (match) {
            setActiveMode(match as keyof typeof MODES);
            setPhaseIndex(0);
            setIsActive(false);
        }
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen || !isActive) return;
    
    const timer = setTimeout(() => {
        setPhaseIndex((prev) => (prev + 1) % currentPattern.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [isOpen, isActive, phaseIndex, activeMode, duration]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const reset = () => {
      setIsActive(false);
      setPhaseIndex(0);
  };

  const getScale = () => {
      if (!isActive) return 1; 
      if (phaseLabel === 'Inhale') return 1.6;
      if (phaseLabel === 'Exhale') return 1.0;
      
      const prevIndex = (phaseIndex - 1 + currentSteps.length) % currentSteps.length;
      const prevLabel = currentSteps[prevIndex];
      return prevLabel === 'Inhale' ? 1.6 : 1.0;
  };

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Breathe"
      initialWidth={340} initialHeight={520} defaultPosition={{ x: 400, y: 200 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full bg-[#0a0a0a] font-sans relative overflow-hidden">
         
         {/* VISUALIZER (Top 65%) */}
         <div className="h-[65%] relative flex items-center justify-center overflow-hidden">
             
             {/* Dynamic Aurora Background */}
             <div className="absolute inset-0 opacity-30 pointer-events-none">
                 <motion.div 
                    animate={{ 
                        scale: isActive ? [1, 1.2, 1] : 1,
                        opacity: isActive ? [0.3, 0.6, 0.3] : 0.2 
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-20%] left-[-20%] w-full h-full rounded-full blur-[80px]"
                    style={{ backgroundColor: currentTheme.primaryColor }}
                 />
             </div>

             {/* Main Breathing Circle Container */}
             <div className="relative z-10 flex items-center justify-center">
                 
                 {/* Outer Glow Ring (Breath Indicator) */}
                 <motion.div
                    animate={{ 
                        scale: getScale(),
                        opacity: phaseLabel === 'Hold' ? 0.6 : 0.3,
                        borderColor: currentTheme.primaryColor
                    }}
                    transition={{ duration: duration / 1000, ease: "easeInOut" }}
                    className="absolute w-40 h-40 rounded-full border-2 blur-sm"
                 />

                 {/* Glass Bubble (The Core) */}
                 <motion.div 
                    animate={{
                        scale: getScale(),
                        boxShadow: isActive 
                            ? `0 0 40px ${currentTheme.primaryColor}40, inset 0 0 20px ${currentTheme.primaryColor}20`
                            : `0 0 0px transparent`
                    }}
                    transition={{ duration: duration / 1000, ease: "easeInOut" }}
                    className="w-40 h-40 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center relative shadow-2xl"
                 >
                     {/* Centered Text */}
                     <AnimatePresence mode="wait">
                        {!isActive ? (
                             <motion.button
                                key="play"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={toggleTimer}
                                className="text-white/50 hover:text-white transition-colors"
                             >
                                <Play size={48} fill="currentColor" className="ml-2"/>
                             </motion.button>
                        ) : (
                            <motion.span 
                                key={phaseLabel}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className="font-serif text-2xl text-white tracking-widest font-medium drop-shadow-lg absolute"
                            >
                                {phaseLabel}
                            </motion.span>
                        )}
                     </AnimatePresence>
                 </motion.div>
             </div>
         </div>

         {/* CONTROLS (Bottom 35%) */}
         <div className="h-[35%] bg-[#121212]/90 backdrop-blur-xl border-t border-white/5 p-6 flex flex-col justify-between relative z-20">
             
             {/* Mode Selection */}
             <div className="space-y-2">
                 <div className="relative">
                     <select 
                        value={activeMode}
                        onChange={(e) => { setActiveMode(e.target.value as any); reset(); }}
                        className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer hover:bg-white/10"
                     >
                        {Object.keys(MODES).map(m => (
                            <option key={m} value={m} className="bg-gray-900 text-white">
                                {MODES[m as keyof typeof MODES].label}
                            </option>
                        ))}
                     </select>
                     <ChevronDown className="absolute right-4 top-3.5 text-white/40 pointer-events-none" size={16} />
                 </div>

                 {/* Contextual Description */}
                 <AnimatePresence mode="wait">
                    <motion.p 
                        key={activeMode}
                        initial={{ opacity: 0, y: 5 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }}
                        className="text-[11px] text-white/40 text-center leading-relaxed px-2 h-8"
                    >
                        {MODES[activeMode].description}
                    </motion.p>
                 </AnimatePresence>
             </div>

             {/* Action Bar */}
             <div className="flex items-center gap-3">
                 <button 
                    onClick={toggleTimer}
                    className="flex-1 py-3.5 rounded-xl text-black font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
                    style={{ backgroundColor: currentTheme.primaryColor }}
                 >
                    {isActive ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}
                    {isActive ? "Pause Session" : "Start Session"}
                 </button>

                 <button 
                    onClick={reset}
                    className="p-3.5 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors border border-white/5"
                    title="Reset"
                 >
                    <RotateCcw size={20} />
                 </button>
             </div>

         </div>
      </div>
    </DraggableWindow>
  );
};