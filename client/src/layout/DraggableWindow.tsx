
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
  defaultPosition = { x: 100, y: 100 },
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
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            width: isMobile ? '90vw' : size.width,
            height: isMobile ? 'auto' : size.height,
            left: isMobile ? '50%' : defaultPosition.x,
            top: isMobile ? '50%' : defaultPosition.y,
            x: isMobile ? '-50%' : 0,
            y: isMobile ? '-50%' : 0
          }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          drag={!isMobile} 
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={false} 
          onPointerDown={onFocus} // CRITICAL: This brings window to front on click anywhere
          className={`fixed flex flex-col ${isMobile ? '' : 'cursor-auto'}`}
          style={{ 
            zIndex: zIndex,
            position: 'fixed'
          }}
        >
          <div className={`
             relative w-full h-full flex flex-col overflow-hidden
             rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] 
             bg-[#121212]
             ${className}
          `}>
            
            {/* --- Invisible Drag Handle Overlay --- */}
            <div 
              onPointerDown={(e) => !isMobile && dragControls.start(e)}
              className="absolute top-0 left-0 right-0 h-16 z-50 cursor-grab active:cursor-grabbing touch-none"
            >
                {/* Window Controls */}
                <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
                    <button 
                      onClick={handleClose}
                      className="w-8 h-8 rounded-full bg-black/20 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-all border border-white/5"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* --- Window Content --- */}
            <div className="flex-1 flex flex-col h-full w-full">
               {children}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
