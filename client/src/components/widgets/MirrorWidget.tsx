import React, { useState, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Ghost, Lock, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface MirrorWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

export const MirrorWidget: React.FC<MirrorWidgetProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { user } = useAuth();
  const { currentTheme } = useTheme();

  // State for Lock Logic
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  // Check Time Logic (3 AM - 6 AM Server Time approx)
  useEffect(() => {
      if (isOpen) {
          const now = new Date();
          const hour = now.getHours();

          // LOCKED WINDOW: 3 AM to 6 AM
          if (hour >= 3 && hour < 6) {
              setIsLocked(true);
              setLockMessage("Shh... I'm still writing. Come back at 6:00 AM.");
          } else {
              setIsLocked(false);
          }
      }
  }, [isOpen]);

  const entries = user?.mirrorEntries || [];
  // Sort by date desc
  const sortedEntries = [...entries].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <DraggableWindow
      isOpen={isOpen} onClose={onClose} title="The Mirror"
      initialWidth={380} initialHeight={550} defaultPosition={{ x: 500, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
      icon={Ghost}
      color="#A855F7" // Purple
    >
      <div className="flex flex-col h-full w-full bg-[#1a1a1a] font-sans relative overflow-hidden text-white">

         {/* HEADER VISUAL */}
         <div className="h-32 relative flex items-center justify-center bg-gradient-to-b from-purple-900/40 to-transparent">
             <Ghost size={48} className="text-purple-400 opacity-80" />
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]" />
         </div>

         {/* CONTENT */}
         <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">

             {isLocked ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                     <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                        <Lock className="text-purple-400" size={24} />
                     </div>
                     <h3 className="font-serif text-xl font-bold mb-2">Secret in Progress</h3>
                     <p className="text-white/50 text-sm leading-relaxed">{lockMessage}</p>
                     <div className="mt-6 flex items-center gap-2 text-xs text-white/30 uppercase tracking-widest">
                        <Clock size={12} /> Unlocks at 6:00 AM
                     </div>
                 </div>
             ) : (
                 sortedEntries.length > 0 ? (
                     <div className="space-y-6">
                         {sortedEntries.map((entry: any, i) => (
                             <div key={i} className="relative pl-6 border-l-2 border-purple-500/30">
                                 <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_10px_#a855f7]" />
                                 <span className="text-[10px] uppercase tracking-widest text-purple-300/60 block mb-2 font-bold">
                                     {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                 </span>
                                 <p className="text-sm font-serif text-white/80 leading-relaxed italic">
                                     "{entry.content}"
                                 </p>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-10 opacity-50">
                         <p className="text-sm">I haven't written anything yet.</p>
                         <p className="text-xs mt-2">Chat with me more today.</p>
                     </div>
                 )
             )}

         </div>
      </div>
    </DraggableWindow>
  );
};
