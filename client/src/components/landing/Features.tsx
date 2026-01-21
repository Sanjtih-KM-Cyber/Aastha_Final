import React from 'react';
import { Lock, Mic, BarChart3, Timer, MessageCircle, Sparkles } from 'lucide-react';
import { FadeIn } from './FadeIn';

const features = [
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    desc: "Your thoughts are completely private. Password-protected diary ensures your data stays locked away from everyone—including us."
  },
  {
    icon: Mic,
    title: "Voice Conversations",
    desc: "Speak freely with natural voice mode. Aastha listens and responds with a soothing, empathetic voice for hands-free therapy."
  },
  {
    icon: BarChart3,
    title: "Mood Analytics",
    desc: "Visualize your emotional patterns over time. Understand triggers, celebrate wins, and track your growth journey."
  },
  {
    icon: Timer,
    title: "Mindful Focus Tools",
    desc: "Manage exam stress and work deadlines. Integrated Pomodoro timer with ambient soundscapes helps you enter deep work states."
  },
  {
    icon: MessageCircle,
    title: "Always Available",
    desc: "Combat loneliness and anxiety 24/7. Whether it's 3 AM study burnout or post-work decompression, Aastha is here."
  },
  {
    icon: Sparkles,
    title: "Personalized Insights",
    desc: "Receive proactive guidance tailored to academic pressure, professional growth, and emotional balance."
  }
];

export const Features: React.FC = () => {
  return (
    <section id="features-section" className="py-24 bg-white dark:bg-[#0B0F17] relative overflow-hidden scroll-mt-16 transition-colors duration-500">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-white/[0.05] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] dark:[mask-image:linear-gradient(180deg,black,rgba(0,0,0,0))]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <FadeIn className="text-center mb-16">
          <span className="text-violet-600 dark:text-violet-300 font-semibold tracking-wide uppercase text-sm bg-violet-50 dark:bg-violet-900/20 px-3 py-1 rounded-full border border-violet-100 dark:border-violet-500/20">Features</span>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mt-6 mb-6">Built for Your Wellbeing</h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Everything you need for a safe, private, and transformative mental wellness journey.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <FadeIn key={idx} delay={idx * 100} className="h-full">
              <div className="group h-full p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-500/30 shadow-sm hover:shadow-2xl hover:shadow-violet-100 dark:hover:shadow-violet-900/20 transition-all duration-300 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-50 to-transparent dark:from-violet-500/10 rounded-bl-full -mr-4 -mt-4 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 mb-6 group-hover:scale-110 group-hover:bg-violet-600 dark:group-hover:bg-violet-600 group-hover:text-white transition-all duration-300 shadow-sm relative z-10">
                  <feature.icon size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 relative z-10">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed relative z-10">{feature.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};
