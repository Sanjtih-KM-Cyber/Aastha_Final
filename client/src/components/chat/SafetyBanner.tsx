import React from 'react';
import { motion } from 'framer-motion';
import { X, Phone } from 'lucide-react';

export interface SafetyInfo {
  level: 'concern' | 'crisis';
  helplines: { name: string; number: string }[];
}

/**
 * Support banner shown when the server flags a message as concern/crisis (ROADMAP S9).
 * Tap-to-call helplines. Crisis banners can only be hidden with an explicit "I'm safe" tap.
 *
 * Centred with a full-width flex wrapper, framer-motion's `y` animation overwrites CSS transforms,
 * so `left-1/2 -translate-x-1/2` on the animated element pushed the banner off-screen on phones.
 */
export const SafetyBanner: React.FC<{ info: SafetyInfo; botName: string; onDismiss: () => void }> = ({ info, botName, onDismiss }) => {
  const crisis = info.level === 'crisis';
  return (
    <div className="absolute inset-x-0 top-20 z-40 flex justify-center px-3 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        role={crisis ? 'alert' : 'region'}
        aria-label="Support options"
        className={`pointer-events-auto w-full max-w-[30rem] rounded-[20px] border px-4 py-3 shadow-xl ${
          crisis ? 'bg-rose-950/95 border-rose-300/30' : 'bg-md-tertiary-container text-md-on-tertiary-container border-md-outline-variant/40'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-white/90">
            {crisis
              ? "You don't have to go through this alone. Talk to someone right now, it's free and confidential:"
              : `If things feel heavy, real people are always there to talk, ${botName} is here too.`}
          </p>
          {!crisis && (
            <button onClick={onDismiss} aria-label="Dismiss" className="text-white/60 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {info.helplines.map((h) => (
            <a
              key={h.number}
              href={`tel:${h.number.replace(/[^0-9+]/g, '')}`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15"
            >
              <Phone size={12} /> {h.name}: <span className="font-semibold">{h.number}</span>
            </a>
          ))}
        </div>
        {crisis && (
          <button onClick={onDismiss} className="mt-2 text-[11px] text-white/60 hover:text-white/90 underline">
            I'm safe right now, hide this
          </button>
        )}
      </motion.div>
    </div>
  );
};
