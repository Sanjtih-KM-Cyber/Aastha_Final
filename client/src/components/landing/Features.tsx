import React from 'react';
import { FadeIn } from './FadeIn';
import { Icons, IconTile, Tone } from '../../design/icons';

// Every line here must stay TRUE (ROADMAP S8): no "end-to-end", no "therapy", no unverifiable numbers.
const features: { icon: React.FC<any>; tone: Tone; title: string; desc: string }[] = [
  { icon: Icons.security, tone: 'primary', title: 'Private by design', desc: 'Chats, diary and moods are encrypted on our servers, your diary has its own lock, and you can export or permanently delete everything any time.' },
  { icon: Icons.chat, tone: 'secondary', title: 'Talks like a friend', desc: 'Remembers what you share, follows how you text, replies in your language, and gently checks in about things you mentioned.' },
  { icon: Icons.voice, tone: 'tertiary', title: 'Voice notes & calls', desc: 'Send a voice note or talk it out. Aastha can reply with a warm voice when you’d rather listen than read.' },
  { icon: Icons.mood, tone: 'primary', title: 'Mood over time', desc: 'Log how you feel in a tap, even moods you invent. See your week and one honest pattern, never a diagnosis.' },
  { icon: Icons.focus, tone: 'secondary', title: 'Focus & calm tools', desc: 'Focus timer, breathing exercises, ambient sounds and music you can play together, all in one place.' },
  { icon: Icons.diary, tone: 'tertiary', title: 'A diary that’s yours', desc: 'Write freely with its own password. Forget it? Reset it safely without losing a single entry.' },
];

export const Features: React.FC = () => (
  <section id="features-section" className="py-20 md:py-28 relative scroll-mt-24">
    <div className="max-w-6xl mx-auto px-5">
      <FadeIn className="text-center mb-14">
        <span className="inline-flex h-8 px-3 items-center rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium">What’s inside</span>
        <h2 className="font-serif text-4xl md:text-5xl text-md-on-surface mt-5">Made for the hard days and the ordinary ones</h2>
        <p className="mt-4 text-lg text-md-on-surface-variant max-w-2xl mx-auto">Everything you need to feel a little lighter, in one calm app.</p>
      </FadeIn>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, idx) => (
          <FadeIn key={f.title} delay={idx * 80} className="h-full">
            <div className="h-full rounded-[28px] bg-md-surface-container border border-md-outline-variant/30 p-6 hover:bg-md-surface-container-high transition-colors">
              <IconTile icon={f.icon} tone={f.tone} size="md" className="!w-14 !h-14 !rounded-[18px]" />
              <h3 className="mt-5 text-xl font-semibold text-md-on-surface">{f.title}</h3>
              <p className="mt-2 text-md-on-surface-variant leading-relaxed">{f.desc}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);
