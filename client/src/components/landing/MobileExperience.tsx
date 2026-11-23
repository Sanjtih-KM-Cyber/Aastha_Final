import React from 'react';
import { FadeIn } from './FadeIn';
import { Icons, IconTile, Tone } from '../../design/icons';

const moments: { icon: React.FC<any>; tone: Tone; title: string; desc: string }[] = [
  { icon: Icons.mood, tone: 'tertiary', title: 'Morning check-in', desc: 'Log how you feel in one tap, or write a line in your diary.' },
  { icon: Icons.focus, tone: 'primary', title: 'Instant focus', desc: 'One-tap focus timer with rain or café sounds in the background.' },
  { icon: Icons.relax, tone: 'secondary', title: 'Wind down', desc: 'Breathing, ambient sounds and a friend to talk the day out with.' },
];

export const MobileExperience: React.FC = () => (
  <section id="mobile-why-aastha" className="py-16 scroll-mt-24">
    <div className="max-w-xl mx-auto px-4">
      <FadeIn className="mb-8 px-1">
        <h2 className="font-serif text-4xl text-md-on-surface leading-tight">Peace in your <span className="italic text-md-primary">pocket.</span></h2>
        <p className="mt-3 text-md-on-surface-variant text-lg">For the moments in between, quick check-ins, instant calm, deep focus.</p>
      </FadeIn>
      <div className="rounded-[28px] bg-md-surface-container divide-y divide-md-outline-variant/30 overflow-hidden">
        {moments.map((m, i) => (
          <FadeIn key={m.title} delay={i * 100}>
            <div className="flex items-center gap-4 p-5">
              <IconTile icon={m.icon} tone={m.tone} className="!w-12 !h-12 !rounded-[16px]" />
              <div>
                <h3 className="font-semibold text-md-on-surface">{m.title}</h3>
                <p className="text-sm text-md-on-surface-variant mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-md-on-surface-variant">Works on your phone and in your browser.</p>
    </div>
  </section>
);
