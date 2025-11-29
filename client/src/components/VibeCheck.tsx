import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionVibe, VibeState } from '../types';
import { CloudRain, Zap, Coffee, Music2 } from 'lucide-react';
import { GlassCard } from './GlassCard';

const vibes: Record<SectionVibe, VibeState> = {
  [SectionVibe.SAD]: {
    emoji: '🌧️',
    color: 'from-blue-900/40 to-slate-900/40',
    label: 'Heavy Heart',
    track: 'Gentle Rain on Window',
    artist: 'Nature Sounds'
  },
  [SectionVibe.ANGRY]: {
    emoji: '😡',
    color: 'from-red-900/40 to-orange-900/40',
    label: 'Burn it Out',
    track: 'Intense Breathwork',
    artist: 'Guided Release'
  },
  [SectionVibe.BORED]: {
    emoji: '😴',
    color: 'from-emerald-900/40 to-teal-900/40',
    label: 'Spark Creativity',
    track: 'Playful Jazz',
    artist: 'Coffee Shop Vibes'
  },
  [SectionVibe.NEUTRAL]: {
    emoji: '😐',
    color: 'from-transparent to-transparent',
    label: '',
    track: '',
    artist: ''
  }
};

export const VibeCheck: React.FC = () => {
  const [activeVibe, setActiveVibe] = useState<SectionVibe | null>(null);

  const handleVibeClick = (vibe: SectionVibe) => {
    setActiveVibe(activeVibe === vibe ? null : vibe);
  };

  return (
    <section className="relative py-24 px-6 z-10 transition-colors duration-1000">
      
      {/* Dynamic Background Overlay for this section */}
      <motion.div 
        className="absolute inset-0 z-0 pointer-events-none"
        animate={{ 
          background: activeVibe 
            ? `linear-gradient(180deg, transparent 0%, rgba(var(--color-${activeVibe}), 0.2) 50%, transparent 100%)` // Simplifying for demo with direct classes below
            : 'none'
        }}
      >
        {/* We use a workaround for Tailwind dynamic classes in JS by using inline styles or a wrapper */}
        <div className={`absolute inset-0 bg-gradient-to-b ${activeVibe ? vibes[activeVibe].color : 'from-transparent to-transparent'} transition-all duration-1000 ease-in-out opacity-60`} />
      </motion.div>

      <div className="max-w-4xl mx-auto relative z-10 text-center">
        <h2 className="font-serif text-3xl md:text-4xl mb-4">How are you feeling right now?</h2>
        <p className="text-white/60 mb-12">Tap an emoji to see how Aastha adapts the environment.</p>

        <div className="flex justify-center gap-8 md:gap-16 mb-12">
          {[SectionVibe.SAD, SectionVibe.ANGRY, SectionVibe.BORED].map((vibeKey) => {
            const vibe = vibes[vibeKey];
            const isActive = activeVibe === vibeKey;

            return (
              <motion.button
                key={vibeKey}
                onClick={() => handleVibeClick(vibeKey)}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                className={`text-6xl md:text-7xl transition-all duration-300 filter ${isActive ? 'grayscale-0 scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
              >
                {vibe.emoji}
              </motion.button>
            );
          })}
        </div>

        {/* Pop-up Recommendation */}
        <div className="h-32 relative flex justify-center items-center">
          <AnimatePresence mode="wait">
            {activeVibe && (
              <motion.div
                key={activeVibe}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute"
              >
                <GlassCard className="flex items-center gap-4 pr-12 min-w-[300px] border-l-4 border-l-teal-400">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    {activeVibe === SectionVibe.SAD && <CloudRain className="text-blue-300" />}
                    {activeVibe === SectionVibe.ANGRY && <Zap className="text-orange-300" />}
                    {activeVibe === SectionVibe.BORED && <Coffee className="text-emerald-300" />}
                  </div>
                  <div className="text-left">
                    <span className="text-xs uppercase tracking-wider text-white/50 block mb-1">Recommended for {vibes[activeVibe].label}</span>
                    <h4 className="font-serif text-lg leading-none">{vibes[activeVibe].track}</h4>
                    <span className="text-sm text-white/60">{vibes[activeVibe].artist}</span>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Music2 size={16} className="text-white/30 animate-pulse" />
                  </div>
                </GlassCard>
              </motion.div>
            )}
            {!activeVibe && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-white/30 text-sm italic"
              >
                Select a vibe above...
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};