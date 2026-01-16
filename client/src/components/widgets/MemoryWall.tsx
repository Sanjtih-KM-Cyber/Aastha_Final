import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { useAuth } from '../../context/AuthContext';
import { Skull, Heart, Trophy, MapPin, BookOpen, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types derived from backend schema
interface ILore {
  _id: string;
  topic: string;
  category: 'Villain' | 'Bestie' | 'Goal' | 'Place' | 'Lore';
  description?: string;
  mentionCount: number;
  isUnlocked: boolean;
  lastMentioned: Date;
}

interface MemoryWallProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
}

// Visual Configurations
const CATEGORY_STYLES = {
  Villain: { bg: 'bg-red-500', icon: Skull, text: 'text-red-900', border: 'border-red-200' },
  Bestie: { bg: 'bg-pink-500', icon: Heart, text: 'text-pink-900', border: 'border-pink-200' },
  Goal: { bg: 'bg-amber-500', icon: Trophy, text: 'text-amber-900', border: 'border-amber-200' },
  Place: { bg: 'bg-green-500', icon: MapPin, text: 'text-green-900', border: 'border-green-200' },
  Lore: { bg: 'bg-blue-500', icon: BookOpen, text: 'text-blue-900', border: 'border-blue-200' },
};

export const MemoryWall: React.FC<MemoryWallProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { user } = useAuth();
  const [loreItems, setLoreItems] = useState<ILore[]>([]);
  const [selectedItem, setSelectedItem] = useState<ILore | null>(null);

  useEffect(() => {
    if (user?.lore) {
      setLoreItems(user.lore);
    }
  }, [user]);

  // Generate random rotation for polaroid effect only once per mount
  const rotations = useRef<number[]>([]);
  if (rotations.current.length !== loreItems.length) {
    rotations.current = loreItems.map(() => Math.random() * 4 - 2); // -2deg to +2deg
  }

  return (
    <DraggableWindow
      title="Memory Wall"
      isOpen={isOpen}
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
      width="w-full md:w-[800px]"
      height="h-[80vh] md:h-[600px]"
      icon={<BookOpen className="w-5 h-5 text-violet-500" />}
    >
      <div className="p-6 h-full overflow-y-auto bg-stone-50 dark:bg-stone-900 scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700">

        {/* Intro */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-serif text-stone-800 dark:text-stone-100 mb-2">The Lore</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            People, places, and goals that matter. Unlocks as we talk more.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
          {loreItems.map((item, index) => {
            const config = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Lore'];
            const Icon = item.isUnlocked ? config.icon : Lock;
            const rotation = rotations.current[index] || 0;

            return (
              <motion.div
                key={item._id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group cursor-pointer perspective-1000"
                onClick={() => item.isUnlocked && setSelectedItem(item)}
                style={{ rotate: `${rotation}deg` }}
                whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
              >
                {/* Polaroid Card */}
                <div className={`
                   bg-white dark:bg-stone-800 p-3 pb-8 shadow-md border border-stone-200 dark:border-stone-700
                   transition-all duration-300
                   ${!item.isUnlocked ? 'opacity-60 grayscale' : ''}
                `}>
                  {/* Image Placeholder */}
                  <div className={`
                    w-full aspect-square mb-3 flex items-center justify-center
                    ${item.isUnlocked ? config.bg : 'bg-stone-300 dark:bg-stone-700'}
                  `}>
                    <Icon className={`w-8 h-8 ${item.isUnlocked ? 'text-white' : 'text-stone-500'}`} />
                  </div>

                  {/* Caption */}
                  <div className="text-center">
                    <h3 className={`font-serif font-bold text-lg truncate ${item.isUnlocked ? 'text-stone-800 dark:text-white' : 'text-stone-400'}`}>
                      {item.isUnlocked ? item.topic : '???'}
                    </h3>
                    <span className="text-xs font-mono uppercase tracking-wider text-stone-400">
                      {item.isUnlocked ? item.category : 'LOCKED'}
                    </span>
                  </div>
                </div>

                {/* Pin Effect */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-sm border border-red-600 z-20"></div>

              </motion.div>
            );
          })}

          {loreItems.length === 0 && (
            <div className="col-span-full text-center py-10 opacity-50">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-stone-400" />
              <p>No lore unlocked yet. Keep chatting!</p>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedItem(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white dark:bg-stone-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                 {/* Decorative Background Icon */}
                 <div className="absolute -right-10 -top-10 opacity-5 dark:opacity-10 pointer-events-none">
                    {(() => {
                        const Icon = CATEGORY_STYLES[selectedItem.category].icon;
                        return <Icon size={200} />;
                    })()}
                 </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${CATEGORY_STYLES[selectedItem.category].bg}`}>
                        {(() => {
                           const Icon = CATEGORY_STYLES[selectedItem.category].icon;
                           return <Icon className="text-white w-5 h-5" />;
                        })()}
                     </div>
                     <div>
                        <h3 className="text-xl font-serif font-bold text-stone-800 dark:text-white">
                          {selectedItem.topic}
                        </h3>
                        <span className="text-xs font-mono uppercase text-stone-500">
                          Level {Math.min(Math.floor(selectedItem.mentionCount / 3), 10)} • {selectedItem.category}
                        </span>
                     </div>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                    ✕
                  </button>
                </div>

                <div className="prose prose-stone dark:prose-invert">
                  <p className="italic text-stone-600 dark:text-stone-300">
                    "{selectedItem.description || "No description available yet."}"
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center text-xs text-stone-400">
                   <span>Mentions: {selectedItem.mentionCount}</span>
                   <span>Last seen: {new Date(selectedItem.lastMentioned).toLocaleDateString()}</span>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </DraggableWindow>
  );
};
