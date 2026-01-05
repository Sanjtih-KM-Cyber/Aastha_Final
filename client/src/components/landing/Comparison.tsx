import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { FadeIn } from './FadeIn';

export const Comparison: React.FC = () => {
  return (
    <section id="why-aastha" className="py-24 bg-slate-50 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="text-violet-600 font-semibold tracking-wide uppercase text-sm bg-violet-100 px-3 py-1 rounded-full">The Difference</span>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mt-6 mb-6">Why Choose Aastha?</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Not just another journaling app—a complete wellness companion.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {/* Old Way */}
          <FadeIn delay={100} direction="right">
            <div className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 h-full opacity-80 hover:opacity-100 transition-opacity duration-300">
              <h3 className="text-2xl font-bold text-slate-400 mb-8 border-b border-slate-100 pb-4">Traditional Journaling</h3>
              <ul className="space-y-6">
                {[
                  "Static text with no feedback",
                  "One-way communication",
                  "No emotional insights",
                  "Feels lonely and isolated"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-500 font-medium">
                    <XCircle className="text-slate-300 shrink-0" size={24} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* New Way */}
          <FadeIn delay={200} direction="left">
            <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-violet-500 h-full shadow-2xl shadow-violet-100 relative overflow-hidden transform hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-100 rounded-bl-full -mr-8 -mt-8 opacity-50" />

              <h3 className="text-2xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4 relative z-10">
                The Aastha Way
              </h3>
              <ul className="space-y-6 relative z-10">
                {[
                  "Interactive conversations that evolve",
                  "Two-way empathetic dialogue",
                  "Proactive insights & growth tracking",
                  "Always supported, never alone"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-800 font-medium">
                    <CheckCircle2 className="text-violet-600 shrink-0 fill-violet-50" size={24} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};
