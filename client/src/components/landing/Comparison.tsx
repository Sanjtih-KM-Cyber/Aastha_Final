import React from 'react';
import { Check, Minus } from 'lucide-react';
import { FadeIn } from './FadeIn';

export const Comparison: React.FC = () => (
  <section id="why-aastha" className="py-20 md:py-28 scroll-mt-24">
    <div className="max-w-5xl mx-auto px-5">
      <FadeIn className="text-center mb-12">
        <span className="inline-flex h-8 px-3 items-center rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium">The difference</span>
        <h2 className="font-serif text-4xl md:text-5xl text-md-on-surface mt-5">Why Aastha?</h2>
        <p className="mt-4 text-lg text-md-on-surface-variant">Not just another journaling app, something that talks back, kindly.</p>
      </FadeIn>

      <div className="grid md:grid-cols-2 gap-4">
        <FadeIn delay={100} direction="right">
          <div className="h-full rounded-[32px] bg-md-surface-container-low border border-md-outline-variant/30 p-8">
            <h3 className="text-xl font-semibold text-md-on-surface-variant mb-6">A plain journal</h3>
            <ul className="space-y-4">
              {['Static text, no reply', 'One-way', 'No sense of your patterns', 'Easy to feel alone with it'].map((t) => (
                <li key={t} className="flex items-center gap-3 text-md-on-surface-variant">
                  <span className="w-7 h-7 rounded-full bg-md-surface-container-highest flex items-center justify-center shrink-0"><Minus size={16} /></span>{t}
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
        <FadeIn delay={200} direction="left">
          <div className="h-full rounded-[32px] bg-md-primary-container text-md-on-primary-container p-8 relative overflow-hidden">
            <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-md-primary/25" />
            <h3 className="relative text-xl font-semibold mb-6">With Aastha</h3>
            <ul className="relative space-y-4">
              {['Conversations that grow with you', 'Remembers what you’ve shared (you can see and delete it)', 'Your week, one honest pattern', 'Checks in, never guilt-trips'].map((t) => (
                <li key={t} className="flex items-center gap-3 font-medium">
                  <span className="w-7 h-7 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center shrink-0"><Check size={16} /></span>{t}
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </div>
    </div>
  </section>
);
