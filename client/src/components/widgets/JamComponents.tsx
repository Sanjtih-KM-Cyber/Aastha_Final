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

// --- Stepper (Material You: tonal pill, 48 px touch targets on phones) ---
interface StepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
    compact?: boolean;
    label?: string;          // what the number means, for screen readers ("times")
    format?: (v: number) => string;
}

export const Stepper: React.FC<StepperProps> = ({ value, onChange, min = 0, max = 100, step = 1, compact = false, label = 'value', format }) => {
    const dec = () => { if (value - step >= min) onChange(value - step); };
    const inc = () => { if (value + step <= max) onChange(value + step); };
    const size = compact ? 'h-9' : 'h-10';
    const btn = `${compact ? 'w-9' : 'w-10'} h-full rounded-full flex items-center justify-center text-md-on-secondary-container hover:bg-md-on-surface/[0.08] active:bg-md-on-surface/[0.12] disabled:opacity-30 disabled:hover:bg-transparent transition-colors`;
    return (
        <div className={`inline-flex items-center ${size} rounded-full bg-md-secondary-container`} role="group" aria-label={label}>
            <button type="button" onClick={dec} disabled={value <= min} className={btn} aria-label={`Fewer ${label}`}>
                <Minus size={compact ? 14 : 16} />
            </button>
            <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-md-on-secondary-container" aria-live="polite">
                {format ? format(value) : value}
            </span>
            <button type="button" onClick={inc} disabled={value >= max} className={btn} aria-label={`More ${label}`}>
                <Plus size={compact ? 14 : 16} />
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
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors bg-md-surface-container-high relative z-10`}
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
                     <div className="w-1 h-6 bg-md-primary rounded-full animate-pulse shrink-0"/>
                ) : (
                     <span className="w-4 text-[10px] text-md-on-surface-variant/70 text-center shrink-0">{index + 1}</span>
                )}

                {/* Track Info */}
                <div className="flex-1 min-w-0" onClick={onPlay}>
                    <div className={`text-xs truncate font-medium ${isActive ? 'text-md-on-surface' : 'text-md-on-surface-variant'}`}>{track.title}</div>
                    <div className="text-[10px] truncate text-md-on-surface-variant/80">{track.artist}</div>
                </div>

                {/* Drag Handle (Right Side) */}
                <div
                    onPointerDown={(e) => controls.start(e)}
                    className="p-2 touch-none cursor-grab active:cursor-grabbing text-md-on-surface-variant/70 hover:text-md-on-surface"
                >
                    <GripVertical size={16} />
                </div>
            </motion.div>

            {/* Trash Background (Revealed on Swipe Left) */}
            <div className="absolute inset-y-0 right-0 w-24 bg-md-error-container flex items-center justify-end px-4 rounded-lg z-0">
                <Trash2 size={16} className="text-md-on-error-container" />
            </div>
        </Reorder.Item>
    );
};

// --- DESKTOP QUEUE ITEM (Arrows, Trash, No Drag) ---
export const DesktopQueueItem = ({ track, index, isActive, onRemove, onPlay, onMoveUp, onMoveDown, isFirst, isLast }: any) => {
    return (
        <div className={`group flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-md-surface-container-highest' : 'hover:bg-md-on-surface/[0.06]'}`}>
             {isActive ? (
                 <div className="w-1 h-8 bg-md-primary rounded-full animate-pulse shrink-0"/>
             ) : (
                 <span className="w-4 text-[10px] text-md-on-surface-variant/70 text-center shrink-0">{index + 1}</span>
             )}

             <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
                 <div className={`text-xs truncate font-medium ${isActive ? 'text-md-on-surface' : 'text-md-on-surface-variant'}`}>{track.title}</div>
                 <div className="text-[10px] truncate text-md-on-surface-variant/80">{track.artist}</div>
             </div>

             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-md-on-surface-variant/70 hover:text-md-on-surface disabled:opacity-0"><ArrowUp size={12}/></button>
                 <button onClick={onMoveDown} disabled={isLast} className="p-1 text-md-on-surface-variant/70 hover:text-md-on-surface disabled:opacity-0"><ArrowDown size={12}/></button>
                 <button onClick={onRemove} className="p-1 text-md-on-surface-variant/70 hover:text-md-error"><Trash2 size={12}/></button>
             </div>
         </div>
    );
};
