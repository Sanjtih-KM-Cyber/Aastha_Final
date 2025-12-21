
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Minus } from 'lucide-react';

interface DraggableWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  zIndex: number;
  onFocus: () => void;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  defaultPosition,
  initialWidth = 320,
  initialHeight = 400,
  minWidth = 280,
  minHeight = 350,
  className = "",
  zIndex,
  onFocus
}) => {
  const dragControls = useDragControls();
  
  // Size State
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [centerPos, setCenterPos] = useState({ x: 100, y: 100 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Calculate center for desktop
      if (!mobile) {
         const cx = (window.innerWidth - initialWidth) / 2;
         const cy = (window.innerHeight - initialHeight) / 2;
         setCenterPos({ x: Math.max(20, cx), y: Math.max(20, cy) });
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialWidth, initialHeight]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Determine effective position
  // If defaultPosition is explicitly provided, use it. Otherwise use calculated center.
  const effectivePos = defaultPosition || centerPos;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{
            opacity: 1, 
            scale: 1, 
            // Mobile: Full Screen, Fixed. Desktop: Dynamic Size, Positioned.
            width: isMobile ? '100%' : size.width,
            height: isMobile ? '100%' : size.height,
            top: isMobile ? 0 : effectivePos.y,
            left: isMobile ? 0 : effectivePos.x,
            // Reset transforms on mobile to avoid centering issues with "50%" logic
            x: 0,
            y: 0,
            borderRadius: isMobile ? 0 : 24, // Rounded-3xl (24px) for Desktop
          }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          drag={!isMobile}
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={false}
          onPointerDown={onFocus}
          className={`fixed flex flex-col ${isMobile ? '' : 'cursor-auto'}`}
          style={{ 
            zIndex: isMobile ? 9999 : zIndex, // Force top on mobile
            position: 'fixed'
          }}
        >
          <div className={`
             relative w-full h-full flex flex-col overflow-hidden
             ${isMobile ? 'rounded-none' : 'rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]'}
             bg-[#121212]
             ${className}
          `}>
            
            {/* --- Drag Handle & Controls --- */}
            <div 
              onPointerDown={(e) => !isMobile && dragControls.start(e)}
              className={`
                 absolute top-0 left-0 right-0 z-50 flex items-center justify-end px-4
                 ${isMobile ? 'h-16 bg-black/20 backdrop-blur-sm' : 'h-16 cursor-grab active:cursor-grabbing touch-none'}
              `}
            >
                {/* Title (Mobile Only - Optional Context) */}
                {isMobile && (
                    <div className="absolute left-6 font-serif text-white/80 text-lg pointer-events-none">
                        {title}
                    </div>
                )}

                {/* Window Controls */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* Minimize (Optional) */}
                    {/* <button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"><Minus size={14} /></button> */}

                    <button
                      onClick={handleClose}
                      className={`
                        flex items-center justify-center text-white/50 hover:text-white transition-all border border-white/5
                        ${isMobile ? 'w-10 h-10 rounded-full bg-black/40 backdrop-blur-md' : 'w-8 h-8 rounded-full bg-black/20 hover:bg-white/20 backdrop-blur-md'}
                      `}
                    >
                        <X size={isMobile ? 20 : 14} />
                    </button>
                </div>
            </div>

            {/* --- Window Content --- */}
            <div className={`flex-1 flex flex-col h-full w-full ${isMobile ? 'pt-16' : ''}`}>
               {children}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
