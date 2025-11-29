import React from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { SkipBack, SkipForward, Play, Pause, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

interface JamWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

export const JamWidget: React.FC<JamWidgetProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  // Mock State
  const isPlaying = true;
  const track = {
    title: "Weightless",
    artist: "Marconi Union",
    cover: "bg-gradient-to-br from-blue-900 to-slate-800"
  };

  return (
    <DraggableWindow 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Jam with Aastha"
      initialWidth={300}
      defaultPosition={{ x: 50, y: window.innerHeight - 350 }}
      zIndex={zIndex || 10}
      onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col gap-4">
        {/* Cover Art & Visualizer */}
        <div className={`h-40 w-full rounded-xl ${track.cover} relative overflow-hidden flex items-end justify-center pb-2`}>
           <div className="absolute inset-0 bg-black/20" />
           
           {/* Visualizer Bars */}
           <div className="flex gap-1 items-end h-1/2 z-10">
             {[...Array(12)].map((_, i) => (
               <motion.div
                 key={i}
                 animate={{ height: isPlaying ? [10, 30 + Math.random() * 20, 10] : 5 }}
                 transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity }}
                 className="w-1.5 bg-white/70 rounded-full"
               />
             ))}
           </div>
        </div>

        {/* Track Info */}
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-lg">{track.title}</h4>
            <p className="text-xs text-white/60">{track.artist}</p>
          </div>
          <Heart size={20} className="text-teal-400" fill="currentColor" />
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center px-4 pt-2">
           <SkipBack size={24} className="text-white/50 hover:text-white cursor-pointer" />
           <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)]">
             {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
           </div>
           <SkipForward size={24} className="text-white/50 hover:text-white cursor-pointer" />
        </div>
      </div>
    </DraggableWindow>
  );
};