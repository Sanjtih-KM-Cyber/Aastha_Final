import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion';
import { X, Minus, Maximize2 } from 'lucide-react';
import { useWindowControls } from '../../hooks/useWindowControls';

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
  const controlsStyle = useWindowControls(); // 'mac' (traffic lights, left) | 'windows' (– ✕, right), user setting, synced
  // Drag offset lives in motion values so it is zeroed in the SAME frame top/left are committed.
  // (Animating it back to 0 with a spring is what made windows bounce after you let go.)
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const bubbleDragged = useRef(false);
  
  // Size State
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [centerPos, setCenterPos] = useState({ x: 100, y: 100 });
  const [position, setPosition] = useState<{x: number, y: number} | null>(null);
  
  // Minimize State
  const [isMinimized, setIsMinimized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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
                // Enforce Center-Left opening by IGNORING saved x/y
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
              x: position?.x ?? (defaultPosition?.x || centerPos.x),
              y: position?.y ?? (defaultPosition?.y || centerPos.y),
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

      // Calculate "Center Left" for desktop
      if (!mobile) {
         const cy = (window.innerHeight - initialHeight) / 2;
         // Set X to 100px from left (or just enough to clear sidebar if any, but 100 is safe "Center Left")
         // Assuming Sidebar is ~280px-320px based on ChatView pl-80 (320px).
         // Let's position it at x=350 to be just right of sidebar, or truly "Center Left" of the remaining space?
         // User said "Centre Left". Let's assume standard "Left-ish Center".
         // 360px is a good safe zone if sidebar is active.
         setCenterPos({ x: 360, y: Math.max(60, cy) });
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
  const minimizedHeight = 64; // glass title bar (48) + 8px inset top and bottom
  const currentHeight = isMinimized ? minimizedHeight : (isMobile ? 'calc(100% - 8px)' : size.height);

  // MAXIMIZE FIX FOR MOBILE: Ensure position resets to 0,0 when un-minimizing
  const mobileStyle = isMobile && !isMinimized ? { top: 0, left: 0, x: 0, y: 0 } : {};

  // Use lite mode hook if available, otherwise fallback to mobile check
  // (Assuming context is not passed, using simple check for now)
  const isLiteMode = isMobile; // Can extend this later

  // Handle Drag End to Save Position (With Explicit Boundary Check)
  const onDragEnd = (event: any, info: any) => {
      if (isMobile) return;

      let newX = effectivePos.x + info.offset.x;
      let newY = effectivePos.y + info.offset.y;

      // EXPLICIT BOUNDARY ENFORCEMENT (Manual Clamp)
      // This prevents the "rubber band" effect by calculating the legal bounds
      // and setting the position there, effectively stopping it dead.
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      const minY = 60; // Header Height

      if (newX < 0) newX = 0;
      if (newX > maxX) newX = maxX;
      if (newY < minY) newY = minY;
      if (newY > maxY) newY = maxY;

      setPosition({ x: newX, y: newY });
      dragX.set(0);
      dragY.set(0);
      // We do NOT save state if we want it to reset on next open (per previous request)
      // But user said "sit where i leave it" during usage.
      // The previous logic ignored 'x/y' from localStorage on mount, but we set 'position' state here.
      // So it persists during the session, but resets on reload. Correct.
  };

  return (
    <>
      <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          // REMOVED constraintsRef to fix "rubber band" / snapping issues.
          // We handle bounds manually in onDragEnd or allow free drag with manual clamp.
          // Actually, purely free drag + manual clamp on release is the smoothest "OS-like" feel.
          initial={isLiteMode ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{
            opacity: 1, 
            scale: 1, 
            width: isMobile ? '100%' : (isMinimized ? 300 : size.width),
            height: currentHeight,
            top: isMobile ? 8 : effectivePos.y,
            left: isMobile ? 0 : effectivePos.x,
            borderRadius: isMobile ? '28px 28px 0 0' : 24,
            ...mobileStyle // Force reset on mobile maximize
          }}
          // --- MOBILE OPTIMIZATION 1: Fast Transitions & Simple Exit ---
          // Further reduced duration for even snappier feel
          // Smooth, no bounce (Material "emphasized" easing); position changes apply instantly
          transition={isLiteMode
            ? { duration: 0.1, ease: "linear", top: { duration: 0 }, left: { duration: 0 } }
            : { type: "tween", duration: 0.22, ease: [0.2, 0, 0, 1], top: { duration: 0 }, left: { duration: 0 } }
          }
          exit={isLiteMode
            ? { opacity: 0, transition: { duration: 0.05 } }
            : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }
          }
          drag={!isMobile && !isResizing}
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0}
          // Hard stop at the screen edges while dragging: no rubber band, no snap on release
          dragConstraints={isMobile ? undefined : {
            left: -effectivePos.x,
            right: Math.max(0, window.innerWidth - (isMinimized ? 300 : size.width) - effectivePos.x),
            top: 60 - effectivePos.y,
            bottom: Math.max(0, window.innerHeight - (isMinimized ? 64 : size.height) - effectivePos.y),
          }}
          dragListener={false}
          onDragEnd={onDragEnd} // SAVE POSITION
          onPointerDownCapture={onFocus}
          onMouseDownCapture={onFocus}
          onTouchStartCapture={onFocus}
          className={`fixed flex flex-col ${isMobile ? '' : 'cursor-auto'}`}
          // --- MOBILE OPTIMIZATION 2: Hardware Acceleration ---
          // FIX: Don't unmount on mobile minimize, just hide visibility to keep background processes (audio) alive
          style={{ 
            x: isMobile ? 0 : dragX,
            y: isMobile ? 0 : dragY,
            zIndex: zIndex,
            position: 'fixed',
            willChange: isMobile ? 'transform, opacity' : undefined,
            visibility: isMobile && isMinimized ? 'hidden' : 'visible',
            pointerEvents: isMobile && isMinimized ? 'none' : 'auto'
          }}
        >
          <div className={`
             relative w-full h-full flex flex-col overflow-hidden text-md-on-surface
             ${isMobile ? 'rounded-t-[28px] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)]' : 'rounded-[28px] border border-md-outline-variant/30 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]'}
             bg-md-surface-container-low
             ${className}
          `}>
            
            {/* --- Window Header: Liquid Glass title bar (control layer) --- */}
            <div
              onPointerDown={(e) => !isMobile && dragControls.start(e)}
              className={`absolute z-50 ${isMobile ? 'top-2 left-2 right-2' : 'top-2 left-2 right-2 cursor-grab active:cursor-grabbing touch-none'}`}
            >
              <div className={`glass rounded-[20px] h-12 flex items-center gap-2 ${controlsStyle === 'mac' ? 'pl-3.5 pr-2' : 'pl-2 pr-1.5'}`}>
                {isMobile && <span aria-hidden className="absolute -top-1 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-md-on-surface-variant/40" />}

                {/* macOS style: traffic lights on the LEFT, centred title */}
                {controlsStyle === 'mac' && (
                  <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-2 shrink-0 group/tl">
                    <button onClick={handleClose} aria-label="Close" title="Close"
                      className="w-3.5 h-3.5 rounded-full bg-[#FF5F57] flex items-center justify-center ring-1 ring-black/20">
                      <X size={9} strokeWidth={3} className="text-black/60 opacity-0 group-hover/tl:opacity-100" />
                    </button>
                    <button onClick={toggleMinimize} aria-label={isMinimized ? 'Expand' : 'Minimise'} title={isMinimized ? 'Expand' : 'Minimise'}
                      className="w-3.5 h-3.5 rounded-full bg-[#FEBC2E] flex items-center justify-center ring-1 ring-black/20">
                      <Minus size={9} strokeWidth={3} className="text-black/60 opacity-0 group-hover/tl:opacity-100" />
                    </button>
                    <button onClick={isMinimized ? toggleMinimize : undefined} disabled={!isMinimized} aria-label="Expand" title="Expand"
                      className="w-3.5 h-3.5 rounded-full bg-[#28C840] flex items-center justify-center ring-1 ring-black/20 disabled:opacity-40">
                      <Maximize2 size={8} strokeWidth={3} className="text-black/60 opacity-0 group-hover/tl:opacity-100" />
                    </button>
                  </div>
                )}

                {controlsStyle !== 'mac' && Icon && (
                  <span className="shrink-0 w-8 h-8 rounded-[12px] bg-md-primary-container text-md-on-primary-container flex items-center justify-center">
                    <Icon size={16} />
                  </span>
                )}
                <div className={`flex-1 min-w-0 flex items-center ${controlsStyle === 'mac' ? 'justify-center' : ''}`}>
                  {!isMobile && isMinimized && minimizedContent ? (
                    <div onPointerDown={(e) => e.stopPropagation()} className="w-full flex items-center">{minimizedContent}</div>
                  ) : (
                    <span className={`text-sm font-medium text-md-on-surface truncate px-1 inline-flex items-center gap-2 ${controlsStyle === 'mac' ? 'pr-12' : ''}`}>
                      {controlsStyle === 'mac' && Icon && <Icon size={14} className="text-md-primary shrink-0" />}{title}
                    </span>
                  )}
                </div>

                {/* Windows style: minimise + close on the RIGHT */}
                {controlsStyle !== 'mac' && (
                  <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={toggleMinimize}
                      aria-label={isMinimized ? 'Expand' : 'Minimise'}
                      title={isMinimized ? 'Expand' : 'Minimise'}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10 hover:text-md-on-surface transition-colors"
                    >
                      {isMinimized ? <Maximize2 size={16} /> : <Minus size={18} />}
                    </button>
                    <button
                      onClick={handleClose}
                      aria-label="Close"
                      title="Close"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-error/15 hover:text-md-error transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* --- Window Content --- */}
            <div
               // content starts under the floating glass bar (it stays visible over scrolled content)
               className={`flex-1 flex flex-col w-full overflow-hidden ${isMobile ? 'pt-16 pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'pt-16'}`}
               style={{ display: isMinimized ? 'none' : 'flex' }}
            >
               {children}
            </div>

            {/* --- Resize Handles (Desktop Only) --- */}
            {!isMobile && !isMinimized && (
              <>
                 <div onPointerDown={startResize} className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 hover:bg-md-on-surface/10 rounded-tl-lg" />
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
                dragElastic={0}
                whileDrag={{ scale: 1.05 }}
                onDragStart={() => { bubbleDragged.current = true; }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (bubbleDragged.current) { bubbleDragged.current = false; return; } // a drag, not a tap
                    toggleMinimize(e);
                }}
                className="fixed z-[100] cursor-pointer shadow-2xl flex items-center justify-center overflow-hidden bg-md-primary-container text-md-on-primary-container ring-1 ring-md-outline-variant/40"
                style={{
                    // DYNAMIC STYLE BASED ON TYPE
                    width: mobileMinimizedType === 'squircle' ? 'auto' : '48px', // Auto width for content
                    height: '48px',
                    minWidth: '48px',
                    bottom: '5rem',
                    right: '1.5rem',
                    // SQUIRCLE or CIRCLE logic
                    borderRadius: mobileMinimizedType === 'squircle' ? '16px' : '50%',
                    touchAction: 'none',
                    padding: mobileMinimizedType === 'squircle' ? '0 12px' : '0'
                }}
            >
                {/* Icon Always Visible */}
                <Icon size={24} className="shrink-0" />

                {/* Optional Content for Squircle Mode */}
                {mobileMinimizedType === 'squircle' && minimizedContent && (
                    <div className="ml-3">
                        {minimizedContent}
                    </div>
                )}
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
