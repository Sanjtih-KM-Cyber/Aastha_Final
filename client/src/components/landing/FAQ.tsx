import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FadeIn } from './FadeIn';

const faqs = [
  {
    question: "Is my data really private?",
    answer: "Absolutely. We use end-to-end encryption for all your journals and conversations. Your private key is stored only on your device, meaning even our engineering team cannot access your personal thoughts."
  },
  {
    question: "Is Aastha a replacement for a therapist?",
    answer: "No, Aastha is a wellness companion designed to support your mental health journey, but it is not a replacement for professional clinical therapy. We recommend using Aastha alongside professional care if needed."
  },
  {
    question: "How does voice mode work?",
    answer: "Simply tap the microphone icon and speak naturally. Aastha listens, understands context, and responds with a warm, empathetic voice. It's like having a conversation with a caring friend."
  },
  {
    question: "What makes Aastha different?",
    answer: "Unlike passive journaling apps, Aastha actively engages with you, provides insights, tracks your mood patterns, and adapts to your emotional state in real-time. It's a complete wellness ecosystem."
  }
];

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <div className="absolute -left-20 top-40 w-64 h-64 bg-violet-900/40 rounded-full blur-[80px]" />
      <div className="absolute -right-20 bottom-40 w-64 h-64 bg-teal-900/40 rounded-full blur-[80px]" />

      <div className="max-w-3xl mx-auto px-6 relative z-10">
        <FadeIn className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-violet-400 mb-6 ring-1 ring-slate-700">
            <HelpCircle size={24} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-400">Everything you need to know about your new sanctuary.</p>
        </FadeIn>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <FadeIn key={idx} delay={idx * 50}>
              <div className={`rounded-2xl border transition-all duration-300 ${
                openIndex === idx
                  ? 'bg-slate-800/50 border-violet-500/30 shadow-lg shadow-violet-900/10'
                  : 'bg-slate-800/20 border-slate-700 hover:border-slate-600'
              }`}>
                <button
                  onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className={`font-medium text-lg transition-colors ${openIndex === idx ? 'text-violet-200' : 'text-slate-300'}`}>
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`text-slate-500 transition-transform duration-300 ${openIndex === idx ? 'rotate-180 text-violet-400' : ''}`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    openIndex === idx ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-slate-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};
