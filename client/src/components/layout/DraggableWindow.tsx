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
  icon?: React.ElementType; // New Prop for Floating Bubble Icon
  color?: string; // New Prop for Brand Color
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
  onFocus,
  icon: Icon,
  color
}) => {
  const dragControls = useDragControls();
  
  // Size State
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [centerPos, setCenterPos] = useState({ x: 100, y: 100 });
  
  // Minimize State
  const [isMinimized, setIsMinimized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Resize State
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);

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

  // Resize Handlers
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: size.width,
      h: size.height
    };

    document.addEventListener('pointermove', handleResizeMove);
    document.addEventListener('pointerup', stopResize);
  };

  const handleResizeMove = (e: PointerEvent) => {
    if (!resizeStartRef.current) return;
    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;

    setSize({
      width: Math.max(minWidth, resizeStartRef.current.w + dx),
      height: Math.max(minHeight, resizeStartRef.current.h + dy)
    });
  };

  const stopResize = () => {
    setIsResizing(false);
    resizeStartRef.current = null;
    document.removeEventListener('pointermove', handleResizeMove);
    document.removeEventListener('pointerup', stopResize);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    setTimeout(() => setIsMinimized(false), 500);
  };

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  const effectivePos = defaultPosition || centerPos;
  // If not minimized, Mobile height is 100%. If minimized, desktop is 48px.
  // Note: logic below is for the MAIN window. The bubble is handled separately.
  const minimizedHeight = isMobile ? 64 : 48;
  const currentHeight = isMinimized ? minimizedHeight : (isMobile ? '100%' : size.height);

  // --- FLOATING BUBBLE RENDER (Mobile + Minimized) ---
  // STRICT IMPLEMENTATION AS REQUESTED
  if (isMobile && isMinimized && Icon) {
      return (
          <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    drag
                    dragMomentum={false}
                    whileDrag={{ scale: 1.1 }}
                    onClick={() => setIsMinimized(false)}
                    className="fixed z-[100] cursor-pointer shadow-2xl flex items-center justify-center rounded-full"
                    style={{
                        width: '3rem', // w-12 (12 * 0.25rem = 3rem = 48px)
                        height: '3rem', // h-12
                        bottom: '5rem', // bottom-20 (20 * 0.25 = 5rem)
                        right: '1.5rem', // right-6 (6 * 0.25 = 1.5rem)
                        backgroundColor: color || '#333',
                        touchAction: 'none',
                        border: '2px solid rgba(255,255,255,0.2)'
                    }}
                >
                    <Icon size={24} className="text-white" />
                </motion.div>
            )}
          </AnimatePresence>
      );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{
            opacity: 1, 
            scale: 1, 
            width: isMobile ? '100%' : size.width,
            height: currentHeight,
            top: isMobile ? 0 : effectivePos.y,
            left: isMobile ? 0 : effectivePos.x,
            x: 0,
            y: 0,
            borderRadius: isMobile ? 0 : 24,
          }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          drag={!isMobile && !isResizing}
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={false}
          onPointerDown={onFocus}
          className={`fixed flex flex-col ${isMobile ? '' : 'cursor-auto'}`}
          style={{ 
            zIndex: isMobile ? 9999 : zIndex,
            position: 'fixed'
          }}
        >
          <div className={`
             relative w-full h-full flex flex-col overflow-hidden transition-all duration-300
             ${isMobile ? 'rounded-none' : 'rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]'}
             bg-[#121212]
             ${className}
          `}>
            
            {/* --- Window Header (Controls & Title) --- */}
            <div 
              onPointerDown={(e) => !isMobile && dragControls.start(e)}
              className={`
                 ${isMobile ? 'absolute top-0 left-0 right-0 h-16 bg-black/20 backdrop-blur-sm' : 'relative h-12 cursor-grab active:cursor-grabbing touch-none bg-transparent'}
                 z-50 flex items-center justify-between px-4 shrink-0
              `}
            >
                {/* macOS Controls (Left) - RED & YELLOW ONLY */}
                <div
                   onPointerDown={(e) => e.stopPropagation()}
                   className="flex items-center gap-2 group pointer-events-auto pl-2 z-10"
                >
                    {/* Red (Close) */}
                    <button
                       onClick={handleClose}
                       className="w-3 h-3 rounded-full flex items-center justify-center bg-[#FF5F57] shadow-inner active:brightness-75 transition-all"
                       title="Close"
                    >
                        <X size={8} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
                    </button>

                    {/* Yellow (Minimize) */}
                    <button
                       onClick={toggleMinimize}
                       className="w-3 h-3 rounded-full flex items-center justify-center bg-[#FEBC2E] shadow-inner active:brightness-75 transition-all"
                       title={isMinimized ? "Expand" : "Minimize"}
                    >
                        <Minus size={8} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
                    </button>

                    {/* GREEN BUTTON EXCLUDED PER STRICT REQUIREMENT */}
                </div>

                {/* Title (Centered) */}
                <div className="absolute inset-x-0 mx-auto text-center pointer-events-none flex items-center justify-center h-full">
                    <span className="font-serif text-white/60 text-sm font-medium tracking-wide">
                        {title}
                    </span>
                </div>
            </div>

            {/* --- Window Content --- */}
            <div
               className={`flex-1 flex flex-col w-full overflow-hidden ${isMobile ? 'pt-16' : ''}`}
               style={{ display: isMinimized ? 'none' : 'flex' }}
            >
               {children}
            </div>

            {/* --- Resize Handles (Desktop Only) --- */}
            {!isMobile && !isMinimized && (
              <>
                 <div onPointerDown={startResize} className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 hover:bg-white/10 rounded-tl-lg" />
                 <div onPointerDown={startResize} className="absolute top-10 bottom-6 right-0 w-2 cursor-ew-resize z-40 hover:bg-white/5" />
                 <div onPointerDown={startResize} className="absolute bottom-0 left-10 right-6 h-2 cursor-ns-resize z-40 hover:bg-white/5" />
              </>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
