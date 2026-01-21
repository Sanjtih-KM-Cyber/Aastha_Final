import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FadeIn } from './FadeIn';

const faqs = [
  {
    question: "Is this just for students?",
    answer: "No. Aastha is trained for all life stages. Whether you are debugging code at 2 AM, preparing for competitive exams, or managing a team deadline, Aastha understands the pressure and provides relevant emotional support."
  },
  {
    question: "Is Aastha a replacement for a therapist?",
    answer: "No. Aastha is a wellness tool and emotional companion, not a medical device. It is designed to help with daily stress, anxiety, and self-reflection, but it does not replace professional clinical therapy or psychiatric care."
  },
  {
    question: "Is my data really private?",
    answer: "Absolutely. We use Zero-Knowledge Encryption. Your chats and journals are encrypted on your device before they ever reach our servers. We have no way to read your conversations—your sanctuary is truly private."
  },
  {
    question: "How can Aastha help with professional burnout?",
    answer: "Aastha offers a safe, judgment-free space to decompress after work. You can vent about office stress, practice difficult conversations, or use the focus tools to regain mental clarity without the fear of being judged."
  },
  {
    question: "What makes Aastha different from other AI?",
    answer: "Aastha is specifically fine-tuned for Emotional Intelligence (EQ). Unlike generic assistants, it remembers your emotional history, tracks your mood trends, and responds with deep empathy rather than just facts."
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
