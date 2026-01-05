import React from 'react';
import { ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { FadeIn } from './FadeIn';

interface HeroProps {
  onLogin: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onLogin }) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-white dark:bg-[#0B0F17] transition-colors duration-500">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-white/[0.05] [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:[mask-image:linear-gradient(0deg,black,rgba(0,0,0,0.6))] bg-[center_top_-1px] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-slate-100 dark:bg-white/5 pointer-events-none" />

      {/* Added pointer-events-none to these blobs so they don't block clicks */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-violet-200/50 dark:bg-violet-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-40 animate-float pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-teal-200/50 dark:bg-teal-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-40 animate-float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        <FadeIn delay={100} direction="up">
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-violet-100 dark:border-white/10 rounded-full px-4 py-1.5 shadow-sm mb-8 hover:border-violet-200 dark:hover:border-white/20 transition-colors cursor-default">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Your Digital Sanctuary</span>
          </div>
        </FadeIn>

        <FadeIn delay={200} direction="up">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-8 leading-[1.15] md:leading-[1.1]">
            Healing Through <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-500 to-teal-400 dark:from-violet-400 dark:via-purple-300 dark:to-teal-300">
              Connection.
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={300} direction="up">
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light px-4">
            Experience the most empathetic AI companion designed to listen, understand, and help you grow.
            A safe space that's always available, right in your pocket.
          </p>
        </FadeIn>

        <FadeIn delay={400} direction="up">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <button
              id="hero-cta"
              onClick={onLogin}
              className="w-full sm:w-auto px-8 py-4 bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500 text-white rounded-full font-semibold transition-all hover:shadow-xl hover:shadow-violet-200 dark:hover:shadow-violet-900/50 hover:-translate-y-1 flex items-center justify-center gap-2 group shadow-lg shadow-violet-500/20 z-20 relative"
            >
              Start Your Journey
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white/80 dark:bg-white/5 backdrop-blur-sm hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-full font-semibold transition-all hover:border-violet-200 dark:hover:border-white/30 flex items-center justify-center gap-2 shadow-sm z-20 relative">
              <ShieldCheck size={20} className="text-violet-600 dark:text-violet-400" />
              Privacy First
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={600} className="mt-12 md:mt-16 flex items-center justify-center gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/10">
            <Heart size={16} className="text-red-400 fill-red-400" />
            <span className="font-medium dark:text-slate-400">Your Wellness Buddy</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
