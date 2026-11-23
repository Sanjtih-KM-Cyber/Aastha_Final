import { createPortal } from 'react-dom';
import React from 'react';
import { ShieldCheck, LifeBuoy, HeartHandshake, X } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * "How Aastha keeps you safe" (ROADMAP 7.5). Shown once after sign-in (and any time from Settings → Data & Privacy).
 * Every sentence must stay true to the code — see PrivacyCenter.tsx and utils/safety.ts on the server.
 */
export const SafetyIntroContent: React.FC<{ botName: string }> = ({ botName }) => (
  <div className="space-y-4 text-sm text-md-on-surface-variant leading-relaxed">
    <div className="flex gap-3">
      <ShieldCheck size={20} className="shrink-0 text-md-primary mt-0.5" />
      <p><strong className="text-md-on-surface">Private, but not end-to-end.</strong> Your chats, diary and moods are encrypted when stored.
        To reply, our server decrypts your message and sends it to an AI provider — so it's private, not secret from the app itself.
        Your diary also has its own lock, and you can export or delete everything in Settings.</p>
    </div>
    <div className="flex gap-3">
      <LifeBuoy size={20} className="shrink-0 text-md-primary mt-0.5" />
      <p><strong className="text-md-on-surface">If things get really hard.</strong> Every message is checked for signs of crisis before any AI sees it.
        If it looks serious, {botName} stays with you and shows free helplines — Tele-MANAS <a className="underline" href="tel:14416">14416</a> (24/7),
        and <a className="underline" href="tel:112">112</a> in an emergency. Nobody is alerted or told — it's just for you.</p>
    </div>
    <div className="flex gap-3">
      <HeartHandshake size={20} className="shrink-0 text-md-primary mt-0.5" />
      <p><strong className="text-md-on-surface">A friend, not a therapist.</strong> {botName} is an AI companion for everyday support. It can be wrong,
        and it isn't a doctor, counsellor or emergency service.</p>
    </div>
  </div>
);

export const SafetyIntroCard: React.FC<{ botName: string; onClose: () => void }> = ({ botName, onClose }) => createPortal(
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="safety-intro-title">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className="w-full max-w-md max-h-full overflow-y-auto overscroll-contain rounded-[28px] bg-md-surface-container-high border border-md-outline-variant/40 p-6 shadow-2xl"
    >
      <div className="flex items-start justify-between mb-4">
        <h2 id="safety-intro-title" className="text-lg font-semibold text-md-on-surface">How {botName} keeps you safe</h2>
        <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 rounded-full text-md-on-surface-variant hover:bg-white/10"><X size={18} /></button>
      </div>
      <SafetyIntroContent botName={botName} />
      <button onClick={onClose} className="mt-6 w-full py-3 rounded-full bg-md-primary text-md-on-primary font-medium">Got it</button>
    </motion.div>
  </div>
  , document.body);
