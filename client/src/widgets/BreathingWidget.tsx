
import React, { useEffect, useState } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind } from 'lucide-react';

interface BreathingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: string;
  zIndex?: number;
  onFocus?: () => void;
}

const MODES = {
  Box: { label: 'Box Focus', pattern: [4000, 4000, 4000, 4000], steps: ['Inhale', 'Hold', 'Exhale', 'Hold'] },
  Relax: { label: '4-7-8 Sleep', pattern: [4000, 7000, 8000], steps: ['Inhale', 'Hold', 'Exhale'] },
  Energy: { label: 'Energy', pattern: [4000, 2000], steps: ['Inhale', 'Exhale'] },
};

export const BreathingWidget: React.FC<BreathingWidgetProps> = ({ isOpen, onClose, initialMode, zIndex, onFocus }) => {
  const [activeMode, setActiveMode] = useState<keyof typeof MODES>('Box');
  const [phaseIndex, setPhaseIndex] = useState(0);
  
  const currentPattern = MODES[activeMode].pattern;
  const currentSteps = MODES[activeMode].steps;
  const phaseLabel = currentSteps[phaseIndex];
  const duration = currentPattern[phaseIndex];

  useEffect(() => {
    if (initialMode && MODES[initialMode as keyof typeof MODES]) {
        setActiveMode(initialMode as keyof typeof MODES);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
        setPhaseIndex((prev) => (prev + 1) % currentPattern.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, phaseIndex, activeMode, duration]);

  const getScale = () => {
      if (phaseLabel === 'Inhale') return 1.5;
      if (phaseLabel === 'Exhale') return 0.8;
      // Hold: maintain previous scale
      const prevIndex = (phaseIndex - 1 + currentSteps.length) % currentSteps.length;
      const prevLabel = currentSteps[prevIndex];
      return prevLabel === 'Inhale' ? 1.5 : 0.8;
  };

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Breathe"
      initialWidth={300} initialHeight={450} defaultPosition={{ x: 400, y: 300 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full">
         
         {/* TOP: Animation */}
         <div className="h-[65%] bg-gradient-to-br from-[#0891b2] via-[#0e7490] to-[#155e75] relative flex items-center justify-center overflow-hidden">
             
             {/* Text Indicator */}
             <div className="absolute top-6 left-0 right-0 text-center z-20">
                 <AnimatePresence mode="wait">
                    <motion.div
                        key={phaseLabel}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <h2 className="font-serif text-3xl text-white tracking-widest">{phaseLabel}</h2>
                    </motion.div>
                 </AnimatePresence>
             </div>

             {/* Breathing Circles */}
             <motion.div
                animate={{ scale: getScale() }}
                transition={{ duration: duration / 1000, ease: "easeInOut" }}
                className="w-32 h-32 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm relative z-10 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
             />
             <motion.div
                animate={{ scale: getScale() * 1.2, opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: duration / 1000, ease: "easeInOut" }}
                className="w-32 h-32 rounded-full bg-white/5 absolute"
             />
         </div>

         {/* BOTTOM: Selector */}
         <div className="h-[35%] bg-[#18181b] p-6 flex flex-col justify-center gap-4">
             <div className="flex items-center gap-2 mb-2">
                 <Wind size={14} className="text-white/40" />
                 <span className="text-xs text-white/40 uppercase tracking-widest">Select Rhythm</span>
             </div>
             <div className="flex gap-2 justify-between">
                {Object.keys(MODES).map((m) => {
                    const isActive = activeMode === m;
                    return (
                        <button
                            key={m}
                            onClick={() => { setActiveMode(m as any); setPhaseIndex(0); }}
                            className={`
                                flex-1 py-2 rounded-lg text-xs font-medium transition-all
                                ${isActive ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}
                            `}
                        >
                            {m}
                        </button>
                    )
                })}
             </div>
         </div>
      </div>
    </DraggableWindow>
  );
};
