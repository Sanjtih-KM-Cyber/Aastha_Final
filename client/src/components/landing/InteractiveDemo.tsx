import React, { useState } from 'react';
import { DemoPomodoroWidget } from './demo/DemoPomodoroWidget';
import { FadeIn } from './FadeIn';
import { MousePointer2, Maximize2, Clock, Music, Activity, Grid } from 'lucide-react';

export const InteractiveDemo: React.FC = () => {
  const [showPomodoro, setShowPomodoro] = useState(true);

  return (
    <section id="demo-section" className="py-24 bg-slate-900 text-white relative overflow-hidden min-h-[950px]">
      <div className="absolute inset-0 bg-grid-white opacity-[0.05]" />

      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 h-full flex flex-col items-center">
          <FadeIn direction="up" className="mb-12 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold uppercase tracking-wider mb-6">
                <Maximize2 size={14} /> Sanctuary OS
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Your Personal <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-teal-400">Digital Space</span></h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Experience the floating window interface designed for focus and calm. Try dragging the timer below.
              </p>
          </FadeIn>

          {/* Interactive Area - Increased Height */}
          <div className="relative w-full max-w-6xl h-[750px] bg-[#0B0F17]/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden group ring-1 ring-white/5">

             {/* Desktop Wallpaper Effect */}
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
             <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-teal-900/20 pointer-events-none" />

             {/* Mock OS Interface */}
             <div className="absolute inset-0 overflow-hidden">

                 {/* Widgets Layer */}
                 <div className="relative w-full h-full p-8">
                    <DemoPomodoroWidget
                        isOpen={showPomodoro}
                        onClose={() => setShowPomodoro(false)}
                        defaultPosition={{ x: 60, y: 60 }}
                    />

                    {!showPomodoro && (
                        <button
                            onClick={() => setShowPomodoro(true)}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white transition-all flex items-center gap-2 backdrop-blur-md"
                        >
                            <Clock size={16} /> Open Timer
                        </button>
                    )}

                    {/* Right Side Widget Tray */}
                    <div className="absolute top-8 right-8 w-64 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl transition-all hover:bg-black/50 z-20">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Active Widgets</span>
                            <Grid size={14} className="text-white/30" />
                        </div>

                        {/* Widget 1 */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group/w1">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-300 group-hover/w1:scale-110 transition-transform">
                                <Activity size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">Mood Stats</span>
                                <span className="text-[10px] text-slate-500">Weekly Report</span>
                            </div>
                        </div>

                        {/* Widget 2 */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group/w2">
                            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300 group-hover/w2:scale-110 transition-transform">
                                <Music size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">Soundscapes</span>
                                <span className="text-[10px] text-slate-500">Rain & Thunder</span>
                            </div>
                        </div>

                        {/* +5 More Indicator */}
                        <div className="mt-2 py-2 border-t border-white/5 flex justify-center">
                             <span className="text-xs font-medium text-white/40 hover:text-white transition-colors cursor-pointer">
                                 + 5 More Widgets
                             </span>
                        </div>
                    </div>

                 </div>
             </div>

             {/* Bottom Hint */}
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs text-white/50 flex items-center gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-30">
                 <MousePointer2 size={12} />
                 <span>Interactive Preview</span>
             </div>
          </div>
      </div>
    </section>
  );
};
