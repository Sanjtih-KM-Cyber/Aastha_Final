
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
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            width: isMinimized ? 220 : (isMobile ? '90vw' : size.width),
            height: isMinimized ? 48 : (isMobile ? 'auto' : size.height),
            // Mobile specific centering overrides
            left: isMobile ? '50%' : defaultPosition.x,
            top: isMobile ? '50%' : defaultPosition.y,
            x: isMobile ? '-50%' : 0,
            y: isMobile ? '-50%' : 0
          }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          drag={!isMobile} // Disable drag on mobile
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={false} 
          onPointerDown={onFocus}
          className={`fixed flex flex-col overflow-hidden ${isMobile ? '' : 'cursor-auto'}`}
          style={{ 
            zIndex: zIndex,
            position: 'fixed'
          }}
        >
          <div className={`
             relative w-full h-full flex flex-col
             rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] 
             border border-white/10 bg-[#0a0e17]/90 backdrop-blur-2xl ring-1 ring-white/5
             transition-colors duration-300
             ${className}
          `}>
            
            {/* --- Window Header (Drag Target) --- */}
            <div 
              onPointerDown={(e) => !isMobile && dragControls.start(e)}
              className={`h-12 flex items-center justify-between px-3 border-b border-white/5 select-none shrink-0 bg-white/5 ${isMobile ? '' : 'cursor-grab active:cursor-grabbing'}`}
            >
               {/* Controls */}
              <div className="flex items-center gap-2 z-10">
                <button 
                  onClick={handleClose}
                  className="group w-3 h-3 rounded-full bg-red-500/20 hover:bg-red-500 border border-red-500/50 flex items-center justify-center transition-all"
                >
                    <X size={8} className="opacity-0 group-hover:opacity-100 text-black/60" />
                </button>
                <button 
                  onClick={toggleMinimize} 
                  className="group w-3 h-3 rounded-full bg-yellow-400/20 hover:bg-yellow-400 border border-yellow-400/50 flex items-center justify-center transition-all"
                >
                    <Minus size={8} className="opacity-0 group-hover:opacity-100 text-black/60" />
                </button>
              </div>
              
              {/* Title */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">
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
