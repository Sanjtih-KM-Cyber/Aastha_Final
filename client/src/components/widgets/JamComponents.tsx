import React from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import {
  ArrowUp, ArrowDown, Trash2, Minus, Plus, GripVertical
} from 'lucide-react';

export interface Track {
  id: string; // The YouTube ID
  uuid: string; // Unique ID for Drag & Drop
  title: string;
  artist: string;
  thumbnail?: string;
}

// --- Reusable Stepper Component ---
interface StepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
    compact?: boolean;
}

export const Stepper: React.FC<StepperProps> = ({ value, onChange, min = 0, max = 100, step = 1, compact = false }) => {
    const handleDecrement = () => {
        if (value - step >= min) onChange(value - step);
    };

    const handleIncrement = () => {
        if (value + step <= max) onChange(value + step);
    };

    const containerClass = compact
        ? "flex items-center bg-[#1F2937] rounded-lg border border-white/10 h-8 w-24 justify-between px-1"
        : "flex items-center bg-[#1F2937] rounded-lg border border-white/10 h-10 w-[120px] justify-between px-1";

    const btnClass = compact
        ? "w-6 h-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
        : "w-8 h-8 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors";

    return (
        <div className={containerClass}>
            <button
                onClick={handleDecrement}
                disabled={value <= min}
                className={btnClass}
            >
                <Minus size={compact ? 12 : 14} />
            </button>

            <span className={`text-sm font-medium text-white font-mono min-w-[20px] text-center ${compact ? 'text-xs' : ''}`}>
                {value}
            </span>

            <button
                onClick={handleIncrement}
                disabled={value >= max}
                className={btnClass}
            >
                <Plus size={compact ? 12 : 14} />
            </button>
        </div>
    );
};

// --- MOBILE QUEUE ITEM (Drag Handle Right, Swipe Left to Delete) ---
export const MobileQueueItem = ({ track, index, isActive, onRemove, onPlay }: any) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={track}
            id={track.uuid} // STABLE KEY
            dragListener={false} // Only use handle
            dragControls={controls}
            className="relative overflow-hidden mb-2"
            // Layout prop handles the reordering animation for siblings
            layout="position"
        >
            <motion.div
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors bg-[#111827] border-b border-white/5 relative z-10`}
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                dragElastic={0.1}
                onDragEnd={(_, info) => {
                    if (info.offset.x < -80) { // Swipe Left threshold
                        onRemove();
                    }
                }}
                style={{ touchAction: 'pan-y' }} // Allow vertical scroll, handle handles vertical drag
            >
                {/* Active Indicator */}
                {isActive ? (
                     <div className="w-1 h-6 bg-teal-400 rounded-full animate-pulse shrink-0"/>
                ) : (
                     <span className="w-4 text-[10px] text-white/30 text-center shrink-0">{index + 1}</span>
                )}

                {/* Track Info */}
                <div className="flex-1 min-w-0" onClick={onPlay}>
                    <div className={`text-xs truncate font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>{track.title}</div>
                    <div className="text-[10px] truncate text-white/40">{track.artist}</div>
                </div>

                {/* Drag Handle (Right Side) */}
                <div
                    onPointerDown={(e) => controls.start(e)}
                    className="p-2 touch-none cursor-grab active:cursor-grabbing text-white/30 hover:text-white"
                >
                    <GripVertical size={16} />
                </div>
            </motion.div>

            {/* Trash Background (Revealed on Swipe Left) */}
            <div className="absolute inset-y-0 right-0 w-24 bg-red-500/20 flex items-center justify-end px-4 rounded-lg z-0">
                <Trash2 size={16} className="text-red-500" />
            </div>
        </Reorder.Item>
    );
};

// --- DESKTOP QUEUE ITEM (Arrows, Trash, No Drag) ---
export const DesktopQueueItem = ({ track, index, isActive, onRemove, onPlay, onMoveUp, onMoveDown, isFirst, isLast }: any) => {
    return (
        <div className={`group flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
             {isActive ? (
                 <div className="w-1 h-8 bg-teal-400 rounded-full animate-pulse shrink-0"/>
             ) : (
                 <span className="w-4 text-[10px] text-white/30 text-center shrink-0">{index + 1}</span>
             )}

             <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
                 <div className={`text-xs truncate font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>{track.title}</div>
                 <div className="text-[10px] truncate text-white/40">{track.artist}</div>
             </div>

             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-white/30 hover:text-white disabled:opacity-0"><ArrowUp size={12}/></button>
                 <button onClick={onMoveDown} disabled={isLast} className="p-1 text-white/30 hover:text-white disabled:opacity-0"><ArrowDown size={12}/></button>
                 <button onClick={onRemove} className="p-1 text-white/30 hover:text-red-400"><Trash2 size={12}/></button>
             </div>
         </div>
    );
};
