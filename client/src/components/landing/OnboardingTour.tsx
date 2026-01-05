import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  isOpen: boolean;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ steps, onComplete, onSkip, isOpen }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateCoords = () => {
      const step = steps[currentStepIndex];
      const element = document.getElementById(step.targetId);

      if (element) {
        const rect = element.getBoundingClientRect();
        setCoords({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
      } else {
        // Fallback or center if element not found
        setCoords({ x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 });
      }
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    // Allow a small delay for UI to settle
    const timer = setTimeout(updateCoords, 100);

    return () => {
      window.removeEventListener('resize', updateCoords);
      clearTimeout(timer);
    };
  }, [currentStepIndex, isOpen, steps]);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">

        {/* Dark Overlay with Hole */}
        {coords && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 transition-all duration-300 ease-out"
                style={{
                    clipPath: `polygon(
                        0% 0%,
                        0% 100%,
                        100% 100%,
                        100% 0%,
                        ${coords.x}px 0%,
                        ${coords.x}px ${coords.y}px,
                        ${coords.x + coords.width}px ${coords.y}px,
                        ${coords.x + coords.width}px ${coords.y + coords.height}px,
                        ${coords.x}px ${coords.y + coords.height}px,
                        ${coords.x}px 0%
                    )`
                }}
            />
        )}

        {/* Highlight Border */}
        {coords && (
            <motion.div
                className="absolute border-2 border-violet-500 rounded-xl shadow-[0_0_30px_rgba(139,92,246,0.5)] pointer-events-none"
                initial={false}
                animate={{
                    left: coords.x - 4,
                    top: coords.y - 4,
                    width: coords.width + 8,
                    height: coords.height + 8
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
        )}

        {/* Tooltip Box */}
        {coords && (
            <motion.div
                className="absolute pointer-events-auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    left: currentStep.position === 'left' ? coords.x - 340 :
                          currentStep.position === 'right' ? coords.x + coords.width + 20 :
                          Math.max(20, Math.min(window.innerWidth - 340, coords.x)),
                    top: currentStep.position === 'top' ? coords.y - 200 :
                         currentStep.position === 'bottom' ? coords.y + coords.height + 20 :
                         coords.y + coords.height + 20 // Default to bottom
                }}
                transition={{ duration: 0.3 }}
            >
                <div className="w-[90vw] max-w-[320px] bg-slate-900 border border-violet-500/30 rounded-2xl p-6 shadow-2xl relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold">
                                {currentStepIndex + 1}
                            </span>
                            <span className="text-xs text-violet-300 font-medium uppercase tracking-wider">
                                {steps.length} Steps
                            </span>
                        </div>
                        <button onClick={onSkip} className="text-slate-500 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{currentStep.title}</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        {currentStep.content}
                    </p>

                    <div className="flex items-center justify-between">
                        <button
                            onClick={onSkip}
                            className="text-slate-500 hover:text-slate-300 text-sm font-medium"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-medium text-sm transition-all flex items-center gap-2"
                        >
                            {isLastStep ? 'Finish' : 'Next'}
                            {isLastStep ? <Check size={14}/> : <ChevronRight size={14}/>}
                        </button>
                    </div>

                    {/* Arrow (Visual decoration) */}
                    <div className="absolute w-4 h-4 bg-slate-900 border-l border-t border-violet-500/30 transform rotate-45 -top-2 left-8" />
                </div>
            </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
