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
  minimizedContent?: React.ReactNode; // New Prop for Minimized Content (Nano View)
  mobileMinimizedType?: 'bubble' | 'squircle'; // New Prop for custom mobile view type
  persistenceKey?: string; // New Prop for Persistence
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
  color,
  minimizedContent,
  mobileMinimizedType = 'bubble',
  persistenceKey
}) => {
  const dragControls = useDragControls();
  
  // Size State
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [centerPos, setCenterPos] = useState({ x: 100, y: 100 });
  const [position, setPosition] = useState<{x: number, y: number} | null>(null);
  
  // Minimize State
  const [isMinimized, setIsMinimized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // DRAG CONSTRAINTS REF
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Resize State
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    if (persistenceKey) {
        try {
            const saved = localStorage.getItem(`window_${persistenceKey}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.width && parsed.height) setSize({ width: parsed.width, height: parsed.height });
                // FIX: Always open at center, do not restore previous position
                // if (parsed.x !== undefined && parsed.y !== undefined) setPosition({ x: parsed.x, y: parsed.y });
                if (parsed.isMinimized !== undefined) setIsMinimized(parsed.isMinimized);
            }
        } catch (e) {
            console.warn("Failed to load window state", e);
        }
    }
  }, [persistenceKey]);

  const saveState = (updates: Partial<{ width: number, height: number, x: number, y: number, isMinimized: boolean }>) => {
      if (!persistenceKey) return;
      try {
          // Get current state to merge
          const current = {
              width: size.width,
              height: size.height,
              // FIX: Do not persist position (always center on open)
              // x: position?.x ?? (defaultPosition?.x || centerPos.x),
              // y: position?.y ?? (defaultPosition?.y || centerPos.y),
              isMinimized: isMinimized,
              ...updates
          };
          localStorage.setItem(`window_${persistenceKey}`, JSON.stringify(current));
      } catch (e) {
          console.warn("Failed to save window state", e);
      }
  };

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

  const stopResize = (e: PointerEvent) => {
    setIsResizing(false);

    // Calculate final size to avoid stale closure state
    if (resizeStartRef.current) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        const finalWidth = Math.max(minWidth, resizeStartRef.current.w + dx);
        const finalHeight = Math.max(minHeight, resizeStartRef.current.h + dy);

        saveState({ width: finalWidth, height: finalHeight });
    }

    resizeStartRef.current = null;
    document.removeEventListener('pointermove', handleResizeMove);
    document.removeEventListener('pointerup', stopResize);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    // Don't save "closed" state here, parent handles open/close.
    // But we should probably reset minimized state for next open?
    // Actually, user might want it to re-open minimized?
    // Let's assume on close we DON'T reset persistence, so it remembers preference.
    // BUT we do animate out.
    // NOTE: If we want "reset on close", we'd clear storage. But goal is persistence.
  };

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !isMinimized;
    setIsMinimized(newState);
    saveState({ isMinimized: newState });
  };

  // Determine effective position: Saved > Default > Center
  // Note: On mobile, we force 0,0 usually.
  const effectivePos = position || defaultPosition || centerPos;

  // If not minimized, Mobile height is 100%. If minimized, desktop is 48px.
  // Note: logic below is for the MAIN window. The bubble is handled separately.
  const minimizedHeight = isMobile ? 64 : 48;
  const currentHeight = isMinimized ? minimizedHeight : (isMobile ? '100%' : size.height);

  // MAXIMIZE FIX FOR MOBILE: Ensure position resets to 0,0 when un-minimizing
  const mobileStyle = isMobile && !isMinimized ? { top: 0, left: 0, x: 0, y: 0 } : {};

  // Use lite mode hook if available, otherwise fallback to mobile check
  // (Assuming context is not passed, using simple check for now)
  const isLiteMode = isMobile; // Can extend this later

  // Handle Drag End to Save Position
  const onDragEnd = (event: any, info: any) => {
      if (isMobile) return;
      // Framer motion 'drag' uses transform. We need to calculate the new "top/left"
      // effectively if we want to persist "absolute" position, OR we just persist the offset?
      // "effectivePos" is passed to 'top/left'. 'drag' modifies x/y.
      // So newPos = oldPos + offset.
      const newX = effectivePos.x + info.offset.x;
      const newY = effectivePos.y + info.offset.y;

      setPosition({ x: newX, y: newY });
      saveState({ x: newX, y: newY });
  };

  return (
    <>
      {/* Invisible Constraints Container with Top Boundary */}
      {!isMobile && isOpen && (
          <div
            ref={constraintsRef}
            className="fixed inset-0 pointer-events-none z-0"
            style={{
                left: 0,
                top: '60px', // Boundary below header
                right: 0,
                bottom: 0
            }}
          />
      )}

      <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          dragConstraints={constraintsRef}
          dragElastic={0} // No rubber band effect
          initial={isLiteMode ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          animate={{
            opacity: 1, 
            scale: 1, 
            width: isMobile ? '100%' : (isMinimized ? 250 : size.width),
            height: currentHeight,
            top: isMobile ? 0 : effectivePos.y,
            left: isMobile ? 0 : effectivePos.x,
            // We set x/y to 0 because we update 'top/left' onDragEnd.
            // This prevents "double" movement (transform + top/left).
            x: 0,
            y: 0,
            borderRadius: isMobile ? 0 : 24,
            ...mobileStyle // Force reset on mobile maximize
          }}
          // --- MOBILE OPTIMIZATION 1: Fast Transitions & Simple Exit ---
          // Further reduced duration for even snappier feel
          transition={isLiteMode
            ? { duration: 0.1, ease: "linear" }
            : { type: "spring", damping: 25, stiffness: 300 }
          }
          exit={isLiteMode
            ? { opacity: 0, transition: { duration: 0.05 } }
            : { opacity: 0, scale: 0.9, y: 20 }
          }
          drag={!isMobile && !isResizing}
          dragControls={dragControls}
          dragMomentum={false}
          dragListener={false}
          onDragEnd={onDragEnd} // SAVE POSITION
          onPointerDownCapture={onFocus}
          onMouseDownCapture={onFocus}
          onTouchStartCapture={onFocus}
          className={`fixed flex flex-col ${isMobile ? '' : 'cursor-auto'}`}
          // --- MOBILE OPTIMIZATION 2: Hardware Acceleration ---
          // FIX: Don't unmount on mobile minimize, just hide visibility to keep background processes (audio) alive
          style={{ 
            zIndex: zIndex,
            position: 'fixed',
            willChange: isMobile ? 'transform, opacity' : undefined,
            visibility: isMobile && isMinimized ? 'hidden' : 'visible',
            pointerEvents: isMobile && isMinimized ? 'none' : 'auto'
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
              // --- MOBILE OPTIMIZATION 3: Opaque Header (No Blur) ---
              className={`
                 ${isMobile
                     ? 'absolute top-0 left-0 right-0 h-16 bg-[#121212] border-b border-white/10'
                     : 'relative h-12 cursor-grab active:cursor-grabbing touch-none bg-transparent'
                 }
                 z-50 flex items-center justify-between px-4 shrink-0
              `}
            >
                {/* macOS Controls (Left) - RED & YELLOW ONLY */}
                <div
                   onPointerDown={(e) => e.stopPropagation()}
                   className="flex items-center gap-2 group pointer-events-auto pl-2 z-10 shrink-0"
                >
                    {/* Red (Close) */}
                    <button
                       onClick={handleClose}
                       className="w-3 h-3 rounded-full flex items-center justify-center bg-[#FF5F57] shadow-inner active:brightness-75 transition-all"
                       title="Close"
                    >
                        <X size={8} className="text-black/60 transition-opacity" strokeWidth={3} />
                    </button>

                    {/* Yellow (Minimize) */}
                    <button
                       onClick={toggleMinimize}
                       className="w-3 h-3 rounded-full flex items-center justify-center bg-[#FEBC2E] shadow-inner active:brightness-75 transition-all"
                       title={isMinimized ? "Expand" : "Minimize"}
                    >
                        <Minus size={8} className="text-black/60 transition-opacity" strokeWidth={3} />
                    </button>
                </div>

                {/* Title (Centered) OR Minimized Content (If Desktop & Minimized) */}
                <div className="absolute inset-x-0 mx-auto text-center pointer-events-none flex items-center justify-center h-full pl-16 pr-4">
                    {!isMobile && isMinimized && minimizedContent ? (
                        <div className="pointer-events-auto w-full h-full flex items-center justify-center">
                            {minimizedContent}
                        </div>
                    ) : (
                        <span className="font-serif text-white/60 text-sm font-medium tracking-wide">
                            {title}
                        </span>
                    )}
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

      {/* --- SEPARATE MOBILE MINIMIZED VIEW --- */}
      {/*
          Rendered outside the main window div so it stays visible while main window is "hidden"
          This keeps the DOM structure of the main window alive (critical for Audio/YouTube).
      */}
      <AnimatePresence>
        {isOpen && isMobile && isMinimized && Icon && (
            <motion.div
                initial={isLiteMode ? { scale: 0.8, opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={isLiteMode ? { duration: 0.1 } : undefined}
                drag
                dragMomentum={false}
                whileDrag={{ scale: 1.1 }}
                onClick={(e) => { e.stopPropagation(); toggleMinimize(e); }} // Update to toggle logic
                className="fixed z-[100] cursor-pointer shadow-2xl flex items-center justify-center overflow-hidden"
                style={{
                    // DYNAMIC STYLE BASED ON TYPE
                    width: mobileMinimizedType === 'squircle' ? 'auto' : '48px', // Auto width for content
                    height: '48px',
                    minWidth: '48px',
                    bottom: '5rem',
                    right: '1.5rem',
                    // SQUIRCLE or CIRCLE logic
                    borderRadius: mobileMinimizedType === 'squircle' ? '16px' : '50%',
                    backgroundColor: color || '#333',
                    touchAction: 'none',
                    border: '2px solid rgba(255,255,255,0.2)',
                    padding: mobileMinimizedType === 'squircle' ? '0 12px' : '0'
                }}
            >
                {/* Icon Always Visible */}
                <Icon size={24} className="text-white shrink-0" />

                {/* Optional Content for Squircle Mode */}
                {mobileMinimizedType === 'squircle' && minimizedContent && (
                    <div className="ml-3 text-white">
                        {minimizedContent}
                    </div>
                )}
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
