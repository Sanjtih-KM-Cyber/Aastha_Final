
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
  minWidth = 240,
  minHeight = 180,
  className = "",
  zIndex,
  onFocus
}) => {
  const dragControls = useDragControls();
  
  // Size State
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [lastSize, setLastSize] = useState({ width: initialWidth, height: initialHeight }); 
  const [isMinimized, setIsMinimized] = useState(false);
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

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocus(); 

    if (isMinimized) {
        setSize(lastSize);
        setIsMinimized(false);
    } else {
        setLastSize(size); 
        setIsMinimized(true);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // --- Resize Logic ---
  const startResize = (e: React.PointerEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const onMove = (moveEvent: PointerEvent) => {
        if (isMinimized) return; 
        
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction.includes('right')) newWidth = Math.max(minWidth, startWidth + deltaX);
        if (direction.includes('left')) newWidth = Math.max(minWidth, startWidth - deltaX);
        if (direction.includes('bottom')) newHeight = Math.max(minHeight, startHeight + deltaY);
        if (direction.includes('top')) newHeight = Math.max(minHeight, startHeight - deltaY);

        setSize({ width: newWidth, height: newHeight });
    };

    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
          animate={isMobile ? {
            opacity: 1,
            y: isMinimized ? 'calc(100% - 60px)' : 0,
            scale: 1,
            width: '100%',
            height: '92%', // Sheet-like height
            left: 0,
            top: '8%', // Start from 8% down
            bottom: 0,
            borderRadius: '24px 24px 0 0',
            x: 0
          } : {
            opacity: 1, 
            scale: 1, 
            width: isMinimized ? 220 : size.width,
            height: isMinimized ? 48 : size.height,
            left: defaultPosition.x,
            top: defaultPosition.y,
            x: 0,
            y: 0,
            bottom: 'auto',
            borderRadius: '12px'
          }}
          exit={isMobile ? { y: '100%', opacity: 1 } : { opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}

          // Drag Logic
          drag={isMobile ? "y" : true} // Allow Y drag on mobile for closing
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={isMobile ? true : false} // On mobile, drag whole window. On Desktop, only header.
          dragConstraints={isMobile ? { top: 0, bottom: 0 } : undefined} // Snap back on mobile
          dragElastic={isMobile ? { top: 0, bottom: 0.5 } : undefined} // Resist dragging up
          onDragEnd={(e, { offset, velocity }) => {
              if (isMobile) {
                  // Swipe down threshold
                  if (offset.y > 150 || velocity.y > 200) {
                      onClose();
                  }
              }
          }}
          onPointerDown={onFocus}

          className={`fixed flex flex-col overflow-hidden ${isMobile ? 'touch-none' : 'cursor-auto'}`}
          style={{ 
            zIndex: zIndex,
            position: 'fixed'
          }}
        >
          <div className={`
             relative w-full h-full flex flex-col
             rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] 
             border border-white/10 bg-[#0a0e17]/95 backdrop-blur-2xl ring-1 ring-white/5
             transition-colors duration-300
             ${className}
             ${isMobile ? 'rounded-t-3xl border-b-0' : ''}
          `}>
            
            {/* --- Window Header (Drag Target) --- */}
            <div 
              onPointerDown={(e) => !isMobile && dragControls.start(e)}
              className={`h-12 flex items-center justify-between px-3 border-b border-white/5 select-none shrink-0 bg-white/5 ${isMobile ? 'cursor-grab active:cursor-grabbing py-6' : 'cursor-grab active:cursor-grabbing'}`}
            >
               {/* Mobile Pull Handle */}
               {isMobile && (
                   <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/20" />
               )}
               {/* Controls */}
              <div className="flex items-center gap-2 z-10">
                <button 
                  onClick={handleClose}
                  className="group w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500 border border-red-500/50 flex items-center justify-center transition-all md:w-3 md:h-3"
                >
                    <X size={12} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-200 md:text-black/60 md:size-[8px]" />
                </button>
                <button 
                  onClick={toggleMinimize} 
                  className="group w-6 h-6 rounded-full bg-yellow-400/20 hover:bg-yellow-400 border border-yellow-400/50 flex items-center justify-center transition-all md:w-3 md:h-3"
                >
                    <Minus size={12} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-yellow-200 md:text-black/60 md:size-[8px]" />
                </button>
              </div>
              
              {/* Title */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50 pt-2 md:pt-0">
                    {title}
                 </span>
              </div>
            </div>

            {/* --- Window Body --- */}
            <div className={`flex-1 relative overflow-hidden flex flex-col ${isMinimized ? 'hidden' : 'block'}`}>
               {children}
            </div>

            {/* --- Resize Handles (Only when not minimized AND not mobile) --- */}
            {!isMinimized && !isMobile && (
                <>
                    {/* Edges */}
                    <div onPointerDown={(e) => startResize(e, 'right')} className="absolute top-0 right-0 w-2 h-full cursor-e-resize z-40 hover:bg-white/5" />
                    <div onPointerDown={(e) => startResize(e, 'left')} className="absolute top-0 left-0 w-2 h-full cursor-w-resize z-40 hover:bg-white/5" />
                    <div onPointerDown={(e) => startResize(e, 'bottom')} className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize z-40 hover:bg-white/5" />
                    <div onPointerDown={(e) => startResize(e, 'top')} className="absolute top-0 left-0 w-full h-2 cursor-n-resize z-40 hover:bg-white/5" />
                    
                    {/* Corners */}
                    <div onPointerDown={(e) => startResize(e, 'bottom-right')} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 hover:bg-white/10" />
                    <div onPointerDown={(e) => startResize(e, 'bottom-left')} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50 hover:bg-white/10" />
                    <div onPointerDown={(e) => startResize(e, 'top-right')} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50 hover:bg-white/10" />
                    <div onPointerDown={(e) => startResize(e, 'top-left')} className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50 hover:bg-white/10" />
                </>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
