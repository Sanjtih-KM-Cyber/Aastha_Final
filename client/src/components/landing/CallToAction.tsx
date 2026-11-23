import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { FadeIn } from './FadeIn';

/**
 * "Enter your sanctuary", a person (seen from behind, hoodie + headphones, deliberately gender-neutral)
 * stands before a doorway. When the scene scrolls into view the door swings open, light spills out and they
 * walk in. Works on phones (no hover needed), replays on hover/tap, respects reduced motion.
 * All colours come from the Material You tokens, so it follows the user's theme (and light mode).
 */
export const DoorScene: React.FC<{ open: boolean }> = ({ open }) => (
  <svg viewBox="0 0 400 500" className={`door-scene w-full h-full ${open ? 'is-open' : ''}`} role="img"
    aria-label="A person with headphones walking towards an open, glowing doorway">
    <defs>
      <linearGradient id="ds-portal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgb(var(--md-primary-container))" />
        <stop offset="55%" stopColor="rgb(var(--md-primary))" />
        <stop offset="100%" stopColor="rgb(var(--md-on-primary-container))" />
      </linearGradient>
      <radialGradient id="ds-glow" cx="50%" cy="55%" r="60%">
        <stop offset="0%" stopColor="rgb(var(--md-primary))" stopOpacity="0.55" />
        <stop offset="100%" stopColor="rgb(var(--md-primary))" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ds-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgb(var(--md-primary))" stopOpacity="0.55" />
        <stop offset="100%" stopColor="rgb(var(--md-primary))" stopOpacity="0" />
      </linearGradient>
      <clipPath id="ds-arch"><path d="M130 400 V150 a70 70 0 0 1 140 0 V400 Z" /></clipPath>
    </defs>

    {/* ambient glow + floor */}
    <ellipse className="ds-glow" cx="200" cy="260" rx="190" ry="210" fill="url(#ds-glow)" />
    <ellipse cx="200" cy="470" rx="170" ry="16" fill="rgb(var(--md-on-surface))" opacity="0.06" />

    {/* light spilling onto the floor */}
    <path className="ds-beam" d="M132 400 L268 400 L340 490 L60 490 Z" fill="url(#ds-beam)" />

    {/* doorway: frame, portal light, door leaf (swings open toward the hinge) */}
    <path d="M122 404 V150 a78 78 0 0 1 156 0 V404" fill="none" stroke="rgb(var(--md-outline-variant))" strokeWidth="8" strokeLinecap="round" />
    <g clipPath="url(#ds-arch)">
      <rect x="130" y="70" width="140" height="340" fill="url(#ds-portal)" />
      <g className="ds-sparkles" fill="rgb(var(--md-on-primary))">
        <circle cx="170" cy="170" r="2.2" /><circle cx="228" cy="140" r="1.6" /><circle cx="205" cy="220" r="1.8" />
        <circle cx="160" cy="290" r="1.4" /><circle cx="240" cy="260" r="2" />
      </g>
      <g className="ds-door">
        <path d="M130 400 V150 a70 70 0 0 1 140 0 V400 Z" fill="rgb(var(--md-surface-container-high))" />
        <path d="M146 392 V160 a54 54 0 0 1 108 0 V392 Z" fill="none" stroke="rgb(var(--md-outline-variant))" strokeWidth="2" opacity="0.7" />
        <circle cx="252" cy="285" r="6" fill="rgb(var(--md-primary))" />
      </g>
    </g>

    {/* the person, back view, hoodie + headphones, no gendered features */}
    <g className="ds-person">
      <g className="ds-bob">
        {/* legs + shoes */}
        <rect x="176" y="414" width="20" height="54" rx="9" fill="var(--ds-figure)" />
        <rect x="204" y="414" width="20" height="54" rx="9" fill="var(--ds-figure)" />
        <rect x="172" y="460" width="27" height="12" rx="6" fill="rgb(var(--md-surface-container-highest))" />
        <rect x="201" y="460" width="27" height="12" rx="6" fill="rgb(var(--md-surface-container-highest))" />
        {/* arms */}
        <rect x="150" y="318" width="20" height="92" rx="10" fill="var(--ds-figure)" />
        <rect x="230" y="318" width="20" height="92" rx="10" fill="var(--ds-figure)" />
        {/* hoodie body */}
        <path d="M162 312 Q200 296 238 312 Q250 350 246 420 L154 420 Q150 350 162 312 Z" fill="var(--ds-figure)" />
        {/* hood folded on the back */}
        <path d="M176 306 Q200 300 224 306 Q226 330 200 338 Q174 330 176 306 Z" fill="var(--ds-figure-2)" />
        {/* rim light from the doorway */}
        <path d="M162 312 Q200 296 238 312" fill="none" stroke="rgb(var(--md-primary))" strokeWidth="2.5" strokeLinecap="round" className="ds-rim" />
        {/* head */}
        <circle cx="200" cy="276" r="26" fill="var(--ds-figure)" />
        <path d="M176 270 A24 24 0 0 1 224 270" fill="none" stroke="rgb(var(--md-primary))" strokeWidth="2" opacity="0.6" className="ds-rim" />
        {/* headphones */}
        <path d="M172 280 C170 238 230 238 228 280" fill="none" stroke="var(--ds-figure)" strokeWidth="11" strokeLinecap="round" />
        <path d="M172 280 C170 238 230 238 228 280" fill="none" stroke="rgb(var(--md-tertiary))" strokeWidth="6" strokeLinecap="round" />
        <rect x="163" y="267" width="16" height="28" rx="8" fill="rgb(var(--md-tertiary))" stroke="var(--ds-figure)" strokeWidth="2.5" />
        <rect x="221" y="267" width="16" height="28" rx="8" fill="rgb(var(--md-tertiary))" stroke="var(--ds-figure)" strokeWidth="2.5" />
      </g>
      {/* music notes drifting from the headphones */}
      <g className="ds-notes" fill="rgb(var(--md-tertiary))">
        <text x="236" y="252" fontSize="18">♪</text>
        <text x="150" y="240" fontSize="14">♫</text>
      </g>
    </g>
  </svg>
);

export const CallToAction: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOpen(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setOpen(true), 350); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const replay = () => { setOpen(false); setTimeout(() => setOpen(true), 450); };

  return (
    <section className="py-24 md:py-32 px-5 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
        <FadeIn delay={100}>
          <h2 className="font-serif text-4xl md:text-6xl text-md-on-surface">Enter your sanctuary</h2>
          <p className="mt-4 text-md-on-surface-variant text-lg max-w-xl mx-auto">Leave the noise behind. Step into a space that gets you.</p>
        </FadeIn>

        <div ref={ref} onMouseEnter={replay} className="mt-10 mx-auto w-64 h-80 md:w-80 md:h-[400px]">
          <DoorScene open={open} />
        </div>

        <span className="mt-6 inline-flex h-14 px-7 items-center gap-2 rounded-full bg-md-primary text-md-on-primary font-semibold shadow-lg">
          Step inside <ArrowRight size={20} />
        </span>
      </div>
    </section>
  );
};
