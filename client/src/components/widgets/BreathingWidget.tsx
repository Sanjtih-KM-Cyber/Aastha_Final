import React, { useEffect, useState } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Play, Pause, RotateCcw, ChevronDown } from 'lucide-react';
import { Icons } from '../../design/icons';
import { useTheme } from '../../context/ThemeContext';
import { Button, IconButton, Chip } from '../../design/ui';

interface BreathingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: string;
  zIndex?: number;
  onFocus?: () => void;
  persistenceKey?: string;
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

export const BreathingWidget: React.FC<BreathingWidgetProps> = ({ isOpen, onClose, initialMode, zIndex, onFocus, persistenceKey }) => {
  const { currentTheme } = useTheme();
  const [activeMode, setActiveMode] = useState<keyof typeof MODES>('Box');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  const currentPattern = MODES[activeMode].pattern;
  const currentSteps = MODES[activeMode].steps;
  const phaseLabel = currentSteps[phaseIndex];
  const duration = currentPattern[phaseIndex];

  // PERSISTENCE: Load
  useEffect(() => {
      const saved = localStorage.getItem('breathing_mode');
      if (saved && MODES[saved as keyof typeof MODES]) {
          setActiveMode(saved as keyof typeof MODES);
      }
  }, []);

  // PERSISTENCE: Save
  useEffect(() => {
      localStorage.setItem('breathing_mode', activeMode);
  }, [activeMode]);

  // Handle AI Pre-selection & Control (Full God Mode)
  useEffect(() => {
    if (isOpen) {
        // 1. Handle Explicit Actions (start, stop, reset) via initialMode overloading or new props
        // Since initialMode is a string, we check if it contains commands or is a JSON string
        // But the cleanest way is if 'initialMode' comes in as an object from the parent,
        // OR we parse specific command strings.
        // Assuming current architecture passes 'initialMode' as string from 'widgetConfigs.breathing?.mode'
        // If we want FULL control, we need to handle 'action' too.
        // Let's check 'initialMode' for action keywords if simpler,
        // OR rely on the parent component passing an object cast to string?
        // No, in Sanctuary.tsx: initialMode={widgetConfigs.breathing?.mode}
        // We should probably rely on 'initialParams' pattern like Pomodoro if we could change props,
        // but 'BreathingWidgetProps' has 'initialMode?: string'.
        // Let's parse 'initialMode' strictly.

        // However, if the AI sends { widget: 'breathing', params: { action: 'stop' } }
        // The Sanctuary wrapper passes `initialMode` from `config.mode`.
        // So the AI must send { widget: 'breathing', params: { mode: 'stop' } } for this to work without prop changes.
        // Let's support that!

        if (!initialMode) return;

        const term = initialMode.toLowerCase().trim();

        // COMMANDS
        if (term === 'stop' || term === 'pause') {
            setIsActive(false);
            return;
        }
        if (term === 'reset') {
            setIsActive(false);
            setPhaseIndex(0);
            return;
        }
        if (term === 'start' || term === 'resume') {
            setIsActive(true);
            return;
        }

        // MODE SELECTION (Auto-Start)
        // 1. Direct Match (e.g., 'box', 'relax')
        const directMatch = Object.keys(MODES).find(k => k.toLowerCase() === term);
        if (directMatch) {
            setActiveMode(directMatch as keyof typeof MODES);
            setPhaseIndex(0);
            setIsActive(true);
            return;
        }

        // 2. Semantic Mapping (Brain terms -> Internal Modes)
        if (term.includes('sleep') || term.includes('insomnia')) setActiveMode('Relax');
        else if (term.includes('anxiety') || term.includes('stress') || term.includes('panic')) setActiveMode('Grounding');
        else if (term.includes('focus') || term.includes('work')) setActiveMode('Box');
        else if (term.includes('energy') || term.includes('awake')) setActiveMode('Energy');
        else if (term.includes('balance') || term.includes('reset')) setActiveMode('Resonance');

        // If mapped, auto-start
        setPhaseIndex(0);
        setIsActive(true);
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

  const modeKeys = Object.keys(MODES) as (keyof typeof MODES)[];
  return (
    <DraggableWindow
      isOpen={isOpen} onClose={onClose} title="Breathe"
      initialWidth={360} initialHeight={580} defaultPosition={{ x: 400, y: 200 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
      icon={Icons.breathing}
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col h-full w-full font-sans px-3 pb-3 gap-3">

         {/* VISUALIZER, tonal stage, breathing orb in the seed colour */}
         <div className="flex-1 min-h-[220px] rounded-[28px] bg-md-surface-container relative flex items-center justify-center overflow-hidden">
             <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-md-primary/10 to-transparent" />

             <div className="relative z-10 flex items-center justify-center">
                 {/* Outer ring = breath indicator */}
                 <motion.div
                    animate={{ scale: getScale(), opacity: phaseLabel === 'Hold' ? 0.7 : 0.35 }}
                    transition={{ duration: duration / 1000, ease: 'easeInOut' }}
                    className="absolute w-36 h-36 rounded-full border-2 border-md-primary"
                 />
                 {/* Orb */}
                 <motion.div
                    animate={{ scale: getScale() }}
                    transition={{ duration: duration / 1000, ease: 'easeInOut' }}
                    className={`w-36 h-36 rounded-full flex items-center justify-center relative transition-colors duration-500 ${isActive ? 'bg-md-primary-container' : 'bg-md-surface-container-highest'}`}
                 >
                     <AnimatePresence mode="wait">
                        {!isActive ? (
                             <motion.button
                                key="play"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={toggleTimer}
                                aria-label="Start breathing"
                                className="w-16 h-16 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center shadow-lg"
                             >
                                <Play size={28} fill="currentColor" className="ml-1"/>
                             </motion.button>
                        ) : (
                            <motion.span
                                key={phaseLabel}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                aria-live="polite"
                                className="font-serif text-2xl text-md-on-primary-container tracking-wide absolute"
                            >
                                {phaseLabel}
                            </motion.span>
                        )}
                     </AnimatePresence>
                 </motion.div>
             </div>

             {/* step dots */}
             <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
               {currentSteps.map((st, i) => (
                 <span key={i} title={st} className={`h-1.5 rounded-full transition-all duration-300 ${isActive && i === phaseIndex ? 'w-6 bg-md-primary' : 'w-1.5 bg-md-on-surface-variant/40'}`} />
               ))}
             </div>
         </div>

         {/* MODE PICKER, M3 filter chips */}
         <div className="shrink-0">
           <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
             {modeKeys.map((m) => (
               <Chip key={m} selected={activeMode === m} onClick={() => { setActiveMode(m); reset(); }}>{MODES[m].label}</Chip>
             ))}
           </div>
           <AnimatePresence mode="wait">
             <motion.p
               key={activeMode}
               initial={{ opacity: 0, y: 4 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0 }}
               className="mt-2 px-1 text-xs text-md-on-surface-variant leading-relaxed min-h-[32px]"
             >
               {MODES[activeMode].description} <span className="opacity-70">· {MODES[activeMode].pattern.map(p => p / 1000).join('-')} s</span>
             </motion.p>
           </AnimatePresence>
         </div>

         {/* ACTIONS */}
         <div className="shrink-0 flex items-center gap-2">
             <Button size="lg" className="flex-1" onClick={toggleTimer} icon={isActive ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}>
                {isActive ? 'Pause' : 'Start'}
             </Button>
             <IconButton variant="tonal" size="lg" label="Reset" onClick={reset}><RotateCcw size={20} /></IconButton>
         </div>
      </div>
    </DraggableWindow>
  );
};
