import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion';

interface DraggableWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  defaultPosition?: { x: number; y: number };
  zIndex?: number;
  onFocus?: () => void;
  resizable?: boolean;
}

export const LandingDraggableWindow: React.FC<DraggableWindowProps> = ({
  isOpen, onClose, title, children, initialWidth = 360, initialHeight = 520, defaultPosition = { x: 100, y: 100 }, zIndex = 10, onFocus, resizable = true
}) => {
  const dragControls = useDragControls();
  const [isMinimized, setIsMinimized] = useState(false);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });

  // Use MotionValues for high-performance updates without re-renders for position
  const x = useMotionValue(defaultPosition.x);
  const y = useMotionValue(defaultPosition.y);

  useEffect(() => {
    setSize({ width: initialWidth, height: initialHeight });
  }, [initialWidth, initialHeight]);

  // Handle Drag constraints manually to prevent header from going off-screen (top)
  const handleDrag = () => {
    const currentY = y.get();
    if (currentY < 0) {
      y.set(0);
    }
  };

  const startResize = (direction: 'se' | 'sw' | 'ne' | 'nw') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus?.();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = x.get();
    const startPosY = y.get();

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      // Calculate new dimensions and position based on direction
      if (direction.includes('e')) {
        newWidth = Math.max(300, startWidth + deltaX);
      }
      if (direction.includes('s')) {
        newHeight = Math.max(400, startHeight + deltaY);
      }
      if (direction.includes('w')) {
        const proposedWidth = Math.max(300, startWidth - deltaX);
        newWidth = proposedWidth;
        if (proposedWidth !== 300) {
             newX = startPosX + deltaX;
        } else {
             newX = startPosX + (startWidth - 300);
        }
      }
      if (direction.includes('n')) {
        const proposedHeight = Math.max(400, startHeight - deltaY);
        newHeight = proposedHeight;
        if (proposedHeight !== 400) {
            newY = startPosY + deltaY;
        } else {
            newY = startPosY + (startHeight - 400);
        }
      }

      setSize({ width: newWidth, height: newHeight });
      if (direction.includes('w')) x.set(newX);
      if (direction.includes('n')) {
          // Constrain Y to not go below 0 during resize
          y.set(Math.max(0, newY));
      }
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
          drag={!isMinimized}
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          onDrag={handleDrag}
          initial={{ opacity: 0, scale: 0.9, x: defaultPosition.x, y: defaultPosition.y }}
          animate={{
             opacity: 1,
             scale: 1,
             width: isMinimized ? 240 : size.width,
             height: isMinimized ? 48 : size.height
          }}
          style={{
            x,
            y,
            position: 'absolute',
            zIndex: zIndex,
          }}
          exit={{ opacity: 0, scale: 0.9 }}
          onPointerDown={onFocus}
          className="bg-[#0B0F17]/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/5 transition-[box-shadow] duration-200"
        >
          {/* Header */}
          <div
            className="h-12 bg-white/5 border-b border-white/5 flex items-center justify-between px-4 cursor-move shrink-0 select-none group"
            onPointerDown={(e) => {
              onFocus?.();
              dragControls.start(e);
            }}
          >
             <div className="flex items-center gap-2">
                <div className="flex gap-1.5 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50 hover:bg-red-500 transition-colors"
                    />
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50 hover:bg-yellow-500 transition-colors"
                    />
                </div>
                <span className="text-xs font-bold text-white/40 uppercase tracking-wider ml-2">{title}</span>
             </div>
          </div>

          {/* Content */}
          <div className={`flex-1 overflow-hidden relative flex flex-col ${isMinimized ? 'hidden' : 'block'}`}>
            {children}

            {/* Resize Handles */}
            {resizable && !isMinimized && (
                <>
                    {/* Bottom Right */}
                    <div
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 flex items-center justify-center text-white/10 hover:text-white/40 transition-colors"
                        onPointerDown={startResize('se')}
                    >
                         <div className="w-2 h-2 border-b-2 border-r-2 border-current" />
                    </div>

                    {/* Bottom Left */}
                    <div
                        className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-50 flex items-center justify-center text-white/10 hover:text-white/40 transition-colors"
                        onPointerDown={startResize('sw')}
                    >
                         {/* Invisible hit area */}
                    </div>

                    {/* Top Right */}
                    <div
                        className="absolute top-0 right-0 w-6 h-6 cursor-ne-resize z-50 flex items-center justify-center text-white/10 hover:text-white/40 transition-colors"
                        onPointerDown={startResize('ne')}
                    >
                        {/* Invisible hit area */}
                    </div>

                    {/* Top Left */}
                    <div
                        className="absolute top-0 left-0 w-6 h-6 cursor-nw-resize z-50 flex items-center justify-center text-white/10 hover:text-white/40 transition-colors"
                        onPointerDown={startResize('nw')}
                    >
                        {/* Invisible hit area */}
                    </div>
                </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
