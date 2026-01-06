import React from 'react';
import { Smartphone, Moon, Sun, Heart, Zap } from 'lucide-react';
import { FadeIn } from './FadeIn';

export const MobileExperience: React.FC = () => {
  return (
    <section id="mobile-why-aastha" className="py-20 bg-slate-50 dark:bg-slate-900 relative overflow-hidden scroll-mt-24 transition-colors duration-300">
      {/* Aesthetic Blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-200/40 dark:bg-violet-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-200/40 dark:bg-teal-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <FadeIn className="mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
            Peace in your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">Pocket.</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-lg">
            Designed for the moments in between. Quick check-ins, instant calm, and deep focus wherever you are.
          </p>
        </FadeIn>

        <div className="space-y-6">
          {/* Card 1: Morning */}
          <FadeIn delay={100}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 flex items-center gap-6 relative overflow-hidden group transition-colors duration-300">
               <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-orange-50 to-transparent dark:from-orange-900/20 opacity-50" />
               <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0 relative z-10 transition-colors duration-300">
                 <Sun size={28} />
               </div>
               <div className="relative z-10">
                 <h3 className="font-bold text-slate-900 dark:text-white text-lg">Morning Intention</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-1">Start with a 2-minute gratitude log to set the tone for your day.</p>
               </div>
            </div>
          </FadeIn>

          {/* Card 2: Day */}
          <FadeIn delay={200}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 flex items-center gap-6 relative overflow-hidden group transition-colors duration-300">
               <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-violet-50 to-transparent dark:from-violet-900/20 opacity-50" />
               <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0 relative z-10 transition-colors duration-300">
                 <Zap size={28} />
               </div>
               <div className="relative z-10">
                 <h3 className="font-bold text-slate-900 dark:text-white text-lg">Instant Focus</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-1">One-tap Pomodoro timer to reclaim your attention span.</p>
               </div>
            </div>
          </FadeIn>

          {/* Card 3: Night */}
          <FadeIn delay={300}>
            <div className="bg-[#0B0F17] dark:bg-black rounded-3xl p-6 shadow-xl shadow-slate-900/20 border border-slate-800 flex items-center gap-6 relative overflow-hidden group">
               <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-indigo-900/40 to-transparent" />
               <div className="w-14 h-14 rounded-2xl bg-white/10 text-indigo-300 flex items-center justify-center shrink-0 relative z-10 backdrop-blur-sm border border-white/10">
                 <Moon size={28} />
               </div>
               <div className="relative z-10">
                 <h3 className="font-bold text-white text-lg">Sleep Sanctuary</h3>
                 <p className="text-slate-400 text-sm leading-relaxed mt-1">Unwind with ambient soundscapes and guided reflection.</p>
               </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={400} className="mt-12 text-center">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-sm font-medium transition-colors duration-300">
                <Smartphone size={16} />
                <span>Available on iOS & Android</span>
             </div>
        </FadeIn>
      </div>
    </section>
  );
};
