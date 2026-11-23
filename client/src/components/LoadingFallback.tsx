import React from 'react';

/** App loading screen — logo tile + M3 circular progress in the seed colour. */
export const LoadingFallback: React.FC = () => (
  <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-md-surface text-md-on-surface z-50" role="status" aria-live="polite">
    <div className="relative w-20 h-20 mb-6">
      <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgb(var(--md-surface-container-highest))" strokeWidth="5" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgb(var(--md-primary))" strokeWidth="5" strokeLinecap="round" strokeDasharray="70 226" />
      </svg>
      <img src="/logo.png" alt="" className="absolute inset-3 w-14 h-14 rounded-[18px] object-cover" />
    </div>
    <span className="font-serif text-xl">Opening your sanctuary…</span>
  </div>
);
