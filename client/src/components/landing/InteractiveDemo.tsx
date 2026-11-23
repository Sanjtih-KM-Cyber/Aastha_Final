import React, { useState } from 'react';
import { DemoPomodoroWidget } from './demo/DemoPomodoroWidget';
import { FadeIn } from './FadeIn';
import { MousePointer2, Maximize2, Clock, Music, Activity, Grid } from 'lucide-react';

export const InteractiveDemo: React.FC = () => {
  const [showPomodoro, setShowPomodoro] = useState(true);

  return (
    <section id="demo-section" className="py-24 text-md-on-surface relative overflow-hidden min-h-[950px]">
      

      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-md-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-md-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 h-full flex flex-col items-center">
          <FadeIn direction="up" className="mb-12 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-md-primary/10 border border-md-primary/20 text-md-primary text-xs font-bold uppercase tracking-wider mb-6">
                <Maximize2 size={14} /> Sanctuary OS
              </div>
              <h2 className="font-serif text-4xl md:text-5xl text-md-on-surface mb-6">Your own <span className="italic text-md-primary">calm desktop</span></h2>
              <p className="text-md-on-surface-variant max-w-2xl mx-auto text-lg leading-relaxed">
                Experience the floating window interface designed for focus and calm. Try dragging the timer below.
              </p>
          </FadeIn>

          {/* Interactive Area - Increased Height */}
          <div className="relative w-full max-w-6xl h-[750px] bg-md-surface-container-low border border-md-outline-variant/40 rounded-[36px] shadow-2xl overflow-hidden group">

             {/* Desktop Wallpaper Effect */}
             <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
             <div className="absolute inset-0 bg-gradient-to-br from-md-primary/15 via-transparent to-md-tertiary/10 pointer-events-none" />

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
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-3 bg-md-surface-container-highest hover:brightness-110 border border-md-outline-variant/40 rounded-full text-md-on-surface transition-all flex items-center gap-2 backdrop-blur-md"
                        >
                            <Clock size={16} /> Open Timer
                        </button>
                    )}

                    {/* Right Side Widget Tray */}
                    <div className="absolute top-8 right-8 w-64 glass border border-md-outline-variant/40 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl transition-all hover:bg-md-surface-container-lowest/50 z-20">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium tracking-wide text-md-primary">Active Widgets</span>
                            <Grid size={14} className="text-md-on-surface-variant/70" />
                        </div>

                        {/* Widget 1 */}
                        <div className="flex items-center gap-3 p-3 rounded-[16px] bg-md-surface-container border border-md-outline-variant/30 hover:bg-md-on-surface/10 transition-colors cursor-pointer group/w1">
                            <div className="w-10 h-10 rounded-lg bg-md-primary/20 flex items-center justify-center text-md-primary group-hover/w1:scale-110 transition-transform">
                                <Activity size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-md-on-surface">Mood Stats</span>
                                <span className="text-[10px] text-md-on-surface-variant">Weekly Report</span>
                            </div>
                        </div>

                        {/* Widget 2 */}
                        <div className="flex items-center gap-3 p-3 rounded-[16px] bg-md-surface-container border border-md-outline-variant/30 hover:bg-md-on-surface/10 transition-colors cursor-pointer group/w2">
                            <div className="w-10 h-10 rounded-lg bg-md-primary/20 flex items-center justify-center text-md-primary group-hover/w2:scale-110 transition-transform">
                                <Music size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-md-on-surface">Soundscapes</span>
                                <span className="text-[10px] text-md-on-surface-variant">Rain & Thunder</span>
                            </div>
                        </div>

                        {/* +5 More Indicator */}
                        <div className="mt-2 py-2 border-t border-md-outline-variant/30 flex justify-center">
                             <span className="text-xs font-medium text-md-on-surface-variant/80 hover:text-md-on-surface transition-colors cursor-pointer">
                                 + 5 More Widgets
                             </span>
                        </div>
                    </div>

                 </div>
             </div>

             {/* Bottom Hint */}
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass border border-md-outline-variant/40 text-xs text-md-on-surface-variant flex items-center gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-30">
                 <MousePointer2 size={12} />
                 <span>Interactive Preview</span>
             </div>
          </div>
      </div>
    </section>
  );
};
