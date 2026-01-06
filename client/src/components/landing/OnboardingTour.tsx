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

// Helper to calculate doodle arrow path
const getArrowPath = (startX: number, startY: number, endX: number, endY: number) => {
    // Determine vector
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Control points for a "loopy" curve
    // We create a cubic bezier that loops out
    // M startX startY C cp1x cp1y, cp2x cp2y, endX endY

    // Offset perpendicular to direction to creating looping
    const angle = Math.atan2(dy, dx);
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    // Loop magnitude
    const loopSize = Math.min(distance * 0.5, 100);

    const cp1x = startX + dx * 0.2 + perpX * loopSize;
    const cp1y = startY + dy * 0.2 + perpY * loopSize;

    const cp2x = startX + dx * 0.8 - perpX * (loopSize * 0.5);
    const cp2y = startY + dy * 0.8 - perpY * (loopSize * 0.5);

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ steps, onComplete, onSkip, isOpen }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // --- MOBILE ARROW LOGIC ---
  let arrowPath = '';
  let arrowRotation = 0;
  if (isMobile && coords) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Target Center
      const targetX = coords.x + coords.width / 2;
      const targetY = coords.y + coords.height / 2;

      // Box Edge Estimate (assuming box is ~320x300 centered)
      // We want arrow to start from edge of box towards target
      // Simple approximation: Start from center, but push out
      // Actually, standardizing on a dynamic path from center screen (behind box) to target
      // with a higher Z-index for the box will hide the start of the arrow, giving the illusion it comes from the box.

      arrowPath = getArrowPath(centerX, centerY, targetX, targetY);
  }

  // --- POSITIONING LOGIC ---
  const tooltipStyle = isMobile ? {
      left: '50%',
      top: '50%',
      x: '-50%',
      y: '-50%'
  } : (coords ? {
      left: currentStep.position === 'left' ? coords.x - 340 :
            currentStep.position === 'right' ? coords.x + coords.width + 20 :
            Math.max(20, Math.min(window.innerWidth - 340, coords.x)),
      top: currentStep.position === 'top' ? coords.y - 200 :
           currentStep.position === 'bottom' ? coords.y + coords.height + 20 :
           coords.y + coords.height + 20,
      x: 0,
      y: 0
  } : {});

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

        {/* Mobile Doodle Arrow */}
        {isMobile && coords && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-[101]">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
                    </marker>
                </defs>
                <motion.path
                    d={arrowPath}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    strokeDasharray="10,5"
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                />
            </svg>
        )}

        {/* Tooltip Box */}
        {coords && (
            <motion.div
                className="absolute pointer-events-auto z-[102]"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, ...tooltipStyle }}
                transition={{ duration: 0.3 }}
            >
                <div className="w-[85vw] md:w-[90vw] max-w-[320px] bg-slate-900 border border-violet-500/30 rounded-2xl p-6 shadow-2xl relative">
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

                    <div className="flex flex-col gap-3 mt-4">
                        <button
                            onClick={handleNext}
                            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-900/20"
                        >
                            {isLastStep ? 'Start My Journey' : 'Next'}
                            {isLastStep ? <Check size={16}/> : <ChevronRight size={16}/>}
                        </button>

                        {!isLastStep && (
                            <button
                                onClick={onSkip}
                                className="text-slate-500 hover:text-white text-xs font-medium py-2 transition-colors"
                            >
                                I will explore by myself
                            </button>
                        )}
                    </div>

                    {/* Arrow (Desktop Only Visual decoration) */}
                    {!isMobile && <div className="absolute w-4 h-4 bg-slate-900 border-l border-t border-violet-500/30 transform rotate-45 -top-2 left-8" />}
                </div>
            </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};
