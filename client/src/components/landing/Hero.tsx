import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { FadeIn } from './FadeIn';
import { Icons } from '../../design/icons';

interface HeroProps {
  onLogin: () => void;
}

/** Hero — Material You: big Fraunces headline, tonal "app preview" card, glass chips. */
export const Hero: React.FC<HeroProps> = ({ onLogin }) => {
  const scrollToPrivacy = () => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-28 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-md-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-60 -right-40 w-[500px] h-[500px] rounded-full bg-md-tertiary/10 blur-3xl" />

      <div className="max-w-6xl mx-auto px-5 relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div className="text-center lg:text-left">
          <FadeIn delay={100} direction="up">
            <span className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium">
              <Icons.relax size={18} /> A calm space that's yours
            </span>
          </FadeIn>

          <FadeIn delay={200} direction="up">
            <h1 className="mt-6 font-serif text-[44px] sm:text-6xl md:text-7xl leading-[1.05] text-md-on-surface">
              A friend who listens, <span className="italic text-md-primary">any hour.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={300} direction="up">
            <p className="mt-6 text-lg md:text-xl text-md-on-surface-variant max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Aastha is an AI companion for students and working people — talk it out, journal, track your mood,
              breathe, focus. It remembers what matters to you and checks in gently.
            </p>
          </FadeIn>

          <FadeIn delay={400} direction="up">
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <button id="hero-cta" onClick={onLogin}
                className="w-full sm:w-auto h-14 px-7 rounded-full bg-md-primary text-md-on-primary font-semibold text-base inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition shadow-lg group">
                Start for free <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={scrollToPrivacy}
                className="w-full sm:w-auto h-14 px-6 rounded-full border border-md-outline text-md-on-surface font-semibold inline-flex items-center justify-center gap-2 hover:bg-md-on-surface/[0.06]">
                <ShieldCheck size={20} className="text-md-primary" /> How your data is handled
              </button>
            </div>
            <p className="mt-4 text-xs text-md-on-surface-variant">Free to start · Not a therapist — in crisis call Tele-MANAS 14416</p>
          </FadeIn>
        </div>

        {/* App preview — tonal card with a glass composer, like the real chat */}
        <FadeIn delay={300} direction="up" className="hidden sm:block">
          <div className="relative mx-auto max-w-md rounded-[36px] bg-md-surface-container-low border border-md-outline-variant/30 p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <img src="/logo.png" alt="" className="w-10 h-10 rounded-[14px] object-cover" />
              <div>
                <p className="text-sm font-semibold text-md-on-surface">Aastha</p>
                <p className="text-xs text-md-primary">● here for you</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="ml-auto w-fit max-w-[80%] rounded-[22px] rounded-br-md bg-md-primary-container text-md-on-primary-container px-4 py-2.5 text-sm">exams next week and I can't focus 😩</div>
              <div className="w-fit max-w-[85%] rounded-[22px] rounded-bl-md bg-md-surface-container-high text-md-on-surface px-4 py-2.5 text-sm">That pre-exam slump is so real. Want to try one tiny 25-minute round together? No pressure — just one.</div>
              <div className="flex gap-2">
                <span className="h-8 px-3 rounded-[8px] bg-md-secondary-container text-md-on-secondary-container text-xs font-medium inline-flex items-center gap-1.5"><Icons.focus size={16} /> Start focus</span>
                <span className="h-8 px-3 rounded-[8px] border border-md-outline-variant text-md-on-surface-variant text-xs font-medium inline-flex items-center gap-1.5"><Icons.sounds size={16} /> Rain sounds</span>
              </div>
            </div>
            <div className="glass rounded-full h-12 mt-5 flex items-center px-4 text-sm text-md-on-surface-variant">Type a message…</div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
