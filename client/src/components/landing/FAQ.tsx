import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FadeIn } from './FadeIn';

// Every answer must stay TRUE to the code (ROADMAP S8 / Privacy Center).
const faqs = [
  {
    question: 'Is this just for students?',
    answer: 'No. Aastha is designed for every stage — exam pressure, a first job, a heavy week at work, or just a lonely evening. It adapts to how you talk and what you share.',
  },
  {
    question: 'Is Aastha a replacement for a therapist?',
    answer: 'No. Aastha is an AI wellness companion, not a medical service. It helps with everyday stress and reflection, but it doesn’t replace a therapist or doctor. If you’re in crisis, call Tele-MANAS 14416 (free, 24/7) or 112.',
  },
  {
    question: 'Is my data really private?',
    answer: 'We’ll be straight with you. Your chats, diary entries and moods are encrypted (AES-256) whenever they’re stored on our servers, and your diary has its own password. To reply to you, your messages are processed by our AI providers — so this is not end-to-end encryption. Data donation is strictly opt-in, and you can export or permanently delete everything from Settings at any time.',
  },
  {
    question: 'How does Aastha help with burnout?',
    answer: 'It gives you a judgment-free place to decompress, rehearse a difficult conversation, or reset with a focus round, breathing or ambient sound — and it remembers what’s been weighing on you so you don’t have to start over each time.',
  },
  {
    question: 'What makes Aastha different from a general AI chat?',
    answer: 'It’s built around being a good friend rather than an assistant: it remembers what you tell it (you can see and delete it), mirrors how you text, grows closer over time, follows up on things you mentioned, and always puts your safety first.',
  },
];

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section id="faq-section" className="py-20 md:py-28 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-5">
        <FadeIn className="text-center mb-12">
          <span className="inline-flex h-8 px-3 items-center rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium">FAQ</span>
          <h2 className="font-serif text-4xl md:text-5xl text-md-on-surface mt-5">Questions, answered honestly</h2>
        </FadeIn>
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const open = openIndex === idx;
            return (
              <FadeIn key={idx} delay={idx * 50}>
                <div className={`rounded-[24px] transition-colors ${open ? 'bg-md-surface-container-high' : 'bg-md-surface-container hover:bg-md-surface-container-high'}`}>
                  <button onClick={() => setOpenIndex(open ? null : idx)} aria-expanded={open}
                    className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left">
                    <span className="font-semibold text-lg text-md-on-surface">{faq.question}</span>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${open ? 'bg-md-primary text-md-on-primary rotate-180' : 'bg-md-surface-container-highest text-md-on-surface-variant'}`}>
                      <ChevronDown size={18} />
                    </span>
                  </button>
                  <div className={`grid transition-all duration-300 ease-md-emphasized ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <p className="px-5 md:px-6 pb-6 text-md-on-surface-variant leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
};
