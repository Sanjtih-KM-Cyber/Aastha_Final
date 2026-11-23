import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, Reply, ShieldCheck } from 'lucide-react';
import { Icons } from '../../design/icons';

/**
 * Onboarding / product tour, Material You content on a soft spotlight (design standards 2026-11).
 *  - PHONE: the card docks to the top or bottom edge (whichever side the highlighted control isn't on), full width.
 *  - DESKTOP: the card is a popover beside the highlighted control (auto side, kept on screen).
 *  - A step without a target (or whose target isn't on screen) is a centred card.
 *  - Optional `art` gives a step a small illustration (gesture demo, tab row, tools grid…).
 * Keyboard: → / Enter next, ← back, Esc skip. Motion follows the app's lite / reduced-motion setting.
 */
export type TourArt = 'welcome' | 'gestures' | 'tabs' | 'tools' | 'voice' | 'personalise' | 'done';
export interface TourStep {
  targetId?: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right'; // preferred side on desktop (auto if it doesn't fit)
  art?: TourArt;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  isOpen: boolean;
  botName?: string;
}

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 8;

// ── Illustrations ───────────────────────────────────────────────────────────────────────────────────────
const Bubble: React.FC<{ children: React.ReactNode; mine?: boolean }> = ({ children, mine }) => (
  <span className={`inline-block px-3 py-1.5 text-[11px] leading-snug rounded-[14px] ${mine ? 'rounded-br-[4px] bg-md-primary-container text-md-on-primary-container' : 'rounded-bl-[4px] bg-md-surface-container-highest text-md-on-surface'}`}>{children}</span>
);

const GestureDemo: React.FC = () => (
  <div className="grid gap-2.5">
    {/* swipe → reply */}
    <div className="flex items-center gap-3 h-9">
      <span className="w-16 text-[11px] font-medium text-md-on-surface-variant">Swipe →</span>
      <div className="relative flex-1 h-full flex items-center">
        <motion.span className="absolute left-0 w-7 h-7 rounded-full bg-md-secondary-container text-md-on-secondary-container flex items-center justify-center"
          animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.6] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.6, 1] }}><Reply size={14} /></motion.span>
        <motion.span className="relative z-10" animate={{ x: [0, 40, 40, 0] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.6, 1], ease: 'easeInOut' }}>
          <Bubble>Tell me more about that</Bubble>
        </motion.span>
      </div>
      <span className="text-[11px] text-md-primary font-medium">Reply</span>
    </div>
    {/* tap → copy */}
    <div className="flex items-center gap-3 h-9">
      <span className="w-16 text-[11px] font-medium text-md-on-surface-variant">Tap</span>
      <div className="relative flex-1 flex items-center gap-2">
        <span className="relative"><Bubble>Road trip to Gokarna?</Bubble>
          <motion.span className="absolute left-1/2 top-1/2 -ml-3 -mt-3 w-6 h-6 rounded-full bg-md-on-surface/30" animate={{ scale: [0, 1.4, 0], opacity: [0.8, 0.3, 0] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.3, 0.5] }} />
        </span>
        <motion.span className="h-6 px-2 rounded-full bg-md-surface-container-highest text-md-on-surface text-[10px] inline-flex items-center gap-1 whitespace-nowrap shrink-0" animate={{ opacity: [0, 0, 1, 1, 0] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.3, 0.4, 0.85, 1] }}><Copy size={10} /> Copy</motion.span>
      </div>
      <span className="text-[11px] text-md-primary font-medium">Copy</span>
    </div>
    {/* hold → react */}
    <div className="flex items-center gap-3 h-9">
      <span className="w-16 text-[11px] font-medium text-md-on-surface-variant">Hold</span>
      <div className="relative flex-1 flex items-center gap-2">
        <motion.span animate={{ scale: [1, 0.96, 0.96, 1] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.2, 0.5, 0.6] }}><Bubble>Proud of you today</Bubble></motion.span>
        <motion.span className="h-7 px-1.5 rounded-full bg-md-surface-container-highest flex items-center gap-0.5 text-sm whitespace-nowrap shrink-0" animate={{ opacity: [0, 0, 1, 1, 0], y: [4, 4, 0, 0, 4] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.45, 0.85, 1] }}>❤️😂😮</motion.span>
      </div>
      <span className="text-[11px] text-md-primary font-medium">React</span>
    </div>
  </div>
);

const IconTile: React.FC<{ Icon: React.FC<any>; label: string; tone?: 'primary' | 'secondary' | 'tertiary' }> = ({ Icon, label, tone = 'secondary' }) => (
  <div className="flex flex-col items-center gap-1.5 min-w-0">
    <span className={`w-11 h-11 rounded-[16px] flex items-center justify-center ${tone === 'primary' ? 'bg-md-primary-container text-md-on-primary-container' : tone === 'tertiary' ? 'bg-md-tertiary-container text-md-on-tertiary-container' : 'bg-md-secondary-container text-md-on-secondary-container'}`}>
      <Icon size={22} />
    </span>
    <span className="text-[10.5px] text-md-on-surface-variant truncate max-w-full">{label}</span>
  </div>
);

const Art: React.FC<{ art: TourArt; botName: string }> = ({ art, botName }) => {
  switch (art) {
    case 'welcome':
      return (
        <div className="flex justify-center py-1">
          <motion.div className="relative" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
            <span className="absolute -inset-3 rounded-[32px] bg-md-primary/20 blur-xl" />
            <img src="/logo.png" alt="" className="relative w-20 h-20 rounded-[26px] object-cover shadow-xl" />
          </motion.div>
        </div>
      );
    case 'gestures': return <GestureDemo />;
    case 'tabs':
      return (
        <div className="grid grid-cols-5 gap-1">
          <IconTile Icon={Icons.chat} label="Chat" tone="primary" />
          <IconTile Icon={Icons.diary} label="Diary" />
          <IconTile Icon={Icons.mood} label="Mood" />
          <IconTile Icon={Icons.relax} label="Relax" tone="tertiary" />
          <IconTile Icon={Icons.me} label="Me" />
        </div>
      );
    case 'tools':
      return (
        <div className="grid grid-cols-4 gap-2">
          <IconTile Icon={Icons.diary} label="Diary" />
          <IconTile Icon={Icons.mood} label="Mood" />
          <IconTile Icon={Icons.web} label="The Web" tone="tertiary" />
          <IconTile Icon={Icons.breathing} label="Breathe" />
          <IconTile Icon={Icons.music} label="Music" tone="primary" />
          <IconTile Icon={Icons.sounds} label="Sounds" />
          <IconTile Icon={Icons.focus} label="Focus" tone="tertiary" />
          <IconTile Icon={Icons.settings} label="Settings" />
        </div>
      );
    case 'voice':
      return (
        <div className="flex justify-center py-2">
          <span className="relative w-16 h-16 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center">
            {[0, 1].map((i) => (
              <motion.span key={i} className="absolute inset-0 rounded-full border-2 border-md-primary" animate={{ scale: [1, 1.8], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i, ease: 'easeOut' }} />
            ))}
            <Icons.voice size={28} />
          </span>
        </div>
      );
    case 'personalise':
      return (
        <div className="flex items-center justify-center gap-4 py-1">
          <span className="w-12 h-12 rounded-full" style={{ background: 'conic-gradient(from 0deg, #ff5f6d, #ffc371, #a8ff78, #43e8d8, #6a8bff, #c56cf0, #ff5f6d)' }} />
          <span className="w-12 h-12 rounded-[16px] bg-md-secondary-container text-md-on-secondary-container flex items-center justify-center font-serif text-xl">Aa</span>
          <span className="h-12 px-3 rounded-[16px] bg-md-surface-container-highest flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </span>
        </div>
      );
    case 'done':
      return (
        <div className="flex flex-col items-center gap-2 py-1">
          <motion.span className="w-16 h-16 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
            <Check size={30} strokeWidth={2.5} />
          </motion.span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-md-on-surface-variant"><ShieldCheck size={13} className="text-md-primary" /> Private by design, {botName} never shares what you say</span>
        </div>
      );
    default: return null;
  }
};

// ── Tour ────────────────────────────────────────────────────────────────────────────────────────────────
export const OnboardingTour: React.FC<OnboardingTourProps> = ({ steps, onComplete, onSkip, isOpen, botName = 'Aastha' }) => {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 1024, h: typeof window !== 'undefined' ? window.innerHeight : 768 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ w: 360, h: 260 });
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const phone = vp.w < 768;

  useEffect(() => { if (isOpen) setI(0); }, [isOpen]);

  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const el = step?.targetId ? document.getElementById(step.targetId) : null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && getComputedStyle(el).visibility !== 'hidden';
    setRect(visible ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
  }, [step?.targetId]);

  useEffect(() => {
    if (!isOpen) return;
    const el = step?.targetId ? document.getElementById(step.targetId) : null;
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    measure();
    const t1 = setTimeout(measure, 120), t2 = setTimeout(measure, 400); // after layout / scroll settles
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); ro?.disconnect(); };
  }, [isOpen, i, measure, step?.targetId]);

  useLayoutEffect(() => {
    const c = cardRef.current;
    if (c) { const r = c.getBoundingClientRect(); if (Math.abs(r.width - cardSize.w) > 1 || Math.abs(r.height - cardSize.h) > 1) setCardSize({ w: r.width, h: r.height }); }
  });

  const next = useCallback(() => (last ? onComplete() : setI((v) => v + 1)), [last, onComplete]);
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), []);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON')) { e.preventDefault(); next(); } // Enter on a button = its own click
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, next, back, onSkip]);

  if (!isOpen || !step) return null;

  // Spotlight shape: pills stay pills, panels get a soft 24 px corner
  const spot = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;
  const radius = spot ? (spot.h <= 96 ? spot.h / 2 : 24) : 0;

  // Card placement
  const M = 12;
  let cardStyle: React.CSSProperties;
  if (phone) {
    const targetInTop = spot ? spot.y + spot.h / 2 < vp.h / 2 : false;
    cardStyle = !spot
      ? { left: M, right: M, top: '50%', transform: 'translateY(-50%)' }
      : targetInTop
        ? { left: M, right: M, bottom: `calc(${M}px + env(safe-area-inset-bottom))` }
        : { left: M, right: M, top: `calc(${M}px + env(safe-area-inset-top))` };
  } else if (!spot) {
    cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 440 };
  } else {
    const W = 360, H = cardSize.h, gap = 16;
    const room = { right: vp.w - (spot.x + spot.w), left: spot.x, bottom: vp.h - (spot.y + spot.h), top: spot.y };
    const order = [step.position, 'right', 'left', 'bottom', 'top'].filter(Boolean) as Array<'top' | 'bottom' | 'left' | 'right'>;
    const side = order.find((s) => (s === 'left' || s === 'right' ? room[s] >= W + gap + M : room[s] >= H + gap + M)) || 'bottom';
    let left = side === 'right' ? spot.x + spot.w + gap : side === 'left' ? spot.x - W - gap : spot.x + spot.w / 2 - W / 2;
    let top = side === 'bottom' ? spot.y + spot.h + gap : side === 'top' ? spot.y - H - gap : spot.y + spot.h / 2 - H / 2;
    left = Math.max(M, Math.min(left, vp.w - W - M));
    top = Math.max(M, Math.min(top, vp.h - H - M));
    cardStyle = { left, top, width: W };
  }

  return createPortal(
    <div className="fixed inset-0 z-[140]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* Scrim + rounded spotlight (one element: the hole is its box, the dim is a huge shadow) */}
      {spot ? (
        <motion.div
          aria-hidden
          className="absolute pointer-events-none"
          initial={false}
          animate={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h, borderRadius: radius }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          style={{ boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.62), 0 0 0 2px rgb(var(--md-primary) / 0.9), 0 0 32px 6px rgb(var(--md-primary) / 0.35)' }}
        />
      ) : (
        <motion.div aria-hidden className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      )}
      {/* clicks outside the card do nothing (no accidental skips), but the highlighted control is not clickable either */}
      <div className="absolute inset-0" />

      {/* Positioning lives on a plain wrapper, framer-motion owns `transform` on the animated card, so centring
          with translate() there would be overwritten (the card slid off-screen on phones). */}
      <div ref={cardRef} className="absolute" style={cardStyle}>
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: phone ? 12 : 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: phone ? -8 : -4, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        >
          <div className="rounded-[28px] bg-md-surface-container-high border border-md-outline-variant/40 shadow-2xl p-5 sm:p-6 max-h-[calc(100dvh-24px)] overflow-y-auto">
            {/* top row: progress + skip */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>
                {steps.map((_, k) => (
                  <span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? 'w-6 bg-md-primary' : k < i ? 'w-1.5 bg-md-primary/60' : 'w-1.5 bg-md-on-surface/20'}`} />
                ))}
              </div>
              {!last && (
                <button onClick={onSkip} className="h-8 px-3 -mr-2 rounded-full text-xs font-medium text-md-on-surface-variant hover:bg-md-on-surface/[0.08] hover:text-md-on-surface">
                  Skip tour
                </button>
              )}
            </div>

            {step.art && <div className="mb-4 rounded-[20px] bg-md-surface-container p-4"><Art art={step.art} botName={botName} /></div>}

            <h3 id="tour-title" className="font-serif text-[22px] leading-tight text-md-on-surface mb-2">{step.title}</h3>
            <p id="tour-body" className="text-sm leading-relaxed text-md-on-surface-variant">{step.content}</p>

            <div className="mt-5 flex items-center gap-2">
              {i > 0 ? (
                <button onClick={back} aria-label="Back" className="w-11 h-11 shrink-0 rounded-full border border-md-outline-variant/60 text-md-on-surface flex items-center justify-center hover:bg-md-on-surface/[0.06]">
                  <ArrowLeft size={18} />
                </button>
              ) : null}
              <button onClick={next} autoFocus
                className="flex-1 h-11 rounded-full bg-md-primary text-md-on-primary font-semibold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition">
                {last ? <>Let’s go <Check size={17} /></> : i === 0 ? <>Show me around <ArrowRight size={17} /></> : <>Next <ArrowRight size={17} /></>}
              </button>
            </div>
            {i === 0 && (
              <button onClick={onSkip} className="mt-2 w-full h-10 rounded-full text-sm text-md-on-surface-variant hover:bg-md-on-surface/[0.06]">I’ll explore on my own</button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      </div>
    </div>,
    document.body
  );
};
