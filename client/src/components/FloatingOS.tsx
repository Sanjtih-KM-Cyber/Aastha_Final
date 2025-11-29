import React from 'react';
import { motion } from 'framer-motion';
import { GripHorizontal, Play, SkipForward, Rewind, Volume2 } from 'lucide-react';
import { GlassCard } from './GlassCard';

export const FloatingOS: React.FC = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col md:flex-row items-center justify-center px-6 py-24 gap-16 max-w-7xl mx-auto z-10">
      
      {/* Text Side */}
      <div className="flex-1 md:pr-12 text-center md:text-left">
        <h2 className="font-serif text-5xl md:text-6xl mb-8 leading-[1.1] tracking-tight">
          Multitask Your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-violet-200">Healing.</span>
        </h2>
        <p className="text-xl text-white/60 mb-10 leading-relaxed">
          Unlike standard chat bots, Aastha is a fluid OS. Drag your "Guided Practice" or "Jam Session" anywhere on the screen. Keep the vibes flowing while you vent, journal, or reflect.
        </p>
        <div className="flex items-center gap-4 justify-center md:justify-start">
          <div className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/50 uppercase tracking-widest hover:bg-white/10 transition-colors cursor-default shadow-lg">
            Try Dragging The Card
          </div>
          <div className="h-px w-32 bg-gradient-to-r from-white/20 to-transparent"></div>
        </div>
      </div>

      {/* Interactive Side - The "Big Square" Desktop */}
      <div className="flex-1 relative w-full h-[600px] bg-[#0a0e17] rounded-[3rem] border border-white/5 shadow-2xl flex items-center justify-center overflow-hidden group">
        
        {/* Decorative Grid */}
        <div className="absolute inset-0 opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
        </div>
        
        {/* Screen Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />

        {/* Draggable Card */}
        <motion.div
          drag
          // FIX: Use numeric constraints to avoid Ref errors.
          // These values keep the card inside the 600px container.
          dragConstraints={{ left: -160, right: 160, top: -160, bottom: 160 }}
          
          // FIX: Fluid Stoppage Logic
          // power: 0.1 -> Low momentum (feels premium/heavy).
          // timeConstant: 200 -> Slides for a moment then stops gently.
          dragTransition={{ power: 0.1, timeConstant: 200 }}
          
          dragElastic={0.1} // Adds resistance at the edges
          whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
          className="cursor-grab absolute z-20"
        >
          <GlassCard className="w-80 !p-0 overflow-hidden shadow-2xl hover:border-white/30 transition-colors group-hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]">
            {/* Album Art Area */}
            <div className="h-40 bg-gradient-to-br from-indigo-600 to-purple-700 relative p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                 <div className="p-2 rounded-lg bg-black/20 backdrop-blur-md border border-white/10">
                   <GripHorizontal size={16} className="text-white/90" />
                 </div>
                 <div className="text-[10px] font-bold uppercase tracking-wider bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-white/90 border border-white/5">Now Playing</div>
              </div>
              <div>
                <h3 className="text-white font-serif text-2xl">Deep Focus</h3>
                <p className="text-white/80 text-sm font-medium">Ambient Waves • 45m left</p>
              </div>
            </div>

            {/* Controls */}
            <div className="p-6 bg-[#121212]">
               <div className="flex items-center justify-between mb-6 px-2">
                 <Rewind size={24} className="text-white/40 hover:text-white transition-colors cursor-pointer" />
                 <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform cursor-pointer">
                   <Play size={24} fill="currentColor" className="ml-1" />
                 </div>
                 <SkipForward size={24} className="text-white/40 hover:text-white transition-colors cursor-pointer" />
               </div>
               
               <div className="flex items-center gap-4">
                 <Volume2 size={18} className="text-white/30" />
                 <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                   <div className="h-full w-2/3 bg-white/60 rounded-full"></div>
                 </div>
               </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Background Depth Elements (Fake Windows) */}
        <div className="absolute top-16 left-16 w-64 h-20 rounded-2xl bg-white/5 border border-white/5 blur-[1px] pointer-events-none"></div>
        <div className="absolute bottom-24 right-16 w-72 h-24 rounded-3xl bg-teal-500/5 border border-teal-500/10 blur-[1px] pointer-events-none"></div>

      </div>
    </section>
  );
};