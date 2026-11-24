import React, { useEffect, useState } from 'react';
import { Icons } from '../../design/icons';
import { useSpecular } from '../../design/LiquidGlass';

/**
 * Phone-first navigation (Phase 5): a floating Liquid Glass pill with Material 3 nav semantics.
 * - Active item gets a tonal "indicator pill" (secondary-container), like M3's NavigationBar.
 * - Shrinks to a compact icon pill while you scroll through chat (up OR down), expands again when you're back at
 *   the latest messages or tap it. (ChatView dispatches `aastha:chat-scroll` with { direction: 'up' | 'down' | 'bottom' }.)
 */
export type TabKey = 'chat' | 'diary' | 'mood' | 'relax' | 'me';

interface Props {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: React.FC<any> }[] = [
  { key: 'chat', label: 'Chat', Icon: Icons.chat },
  { key: 'diary', label: 'Diary', Icon: Icons.diary },
  { key: 'mood', label: 'Mood', Icon: Icons.mood },
  { key: 'relax', label: 'Relax', Icon: Icons.relax },
  { key: 'me', label: 'Me', Icon: Icons.me },
];

export const SCROLL_EVENT = 'aastha:chat-scroll';

export const MobileTabBar: React.FC<Props> = ({ active, onSelect }) => {
  const [compact, setCompact] = useState(false);
  const specular = useSpecular();
  const activeIndex = TABS.findIndex((t) => t.key === active);
  // Pill geometry from the bar's own spacing (px-2/gap-1/60px buttons expanded, px-1.5/gap-0.5/44px compact)
  const pill: React.CSSProperties = compact
    ? { left: 6 + activeIndex * 46 + 4, top: 4 + 4, width: 36, height: 36 }
    : { left: 8 + activeIndex * 64 + 2, top: 6 + 6, width: 56, height: 32 };

  useEffect(() => {
    const onScroll = (e: Event) => {
      const dir = (e as CustomEvent).detail?.direction;
      if (dir === 'down' || dir === 'up') setCompact(true);
      else if (dir === 'bottom') setCompact(false);
    };
    window.addEventListener(SCROLL_EVENT, onScroll);
    return () => window.removeEventListener(SCROLL_EVENT, onScroll);
  }, []);

  return (
    <nav
      id="mobile-tab-bar"
      aria-label="Main"
      className="mobile-tab-bar fixed inset-x-0 z-[60] flex flex-col justify-end items-center pointer-events-none"
      // A full-height frame pinned to the VISIBLE screen (--vv-top/--vv-height, set by ChatView, same as the chat),
      // with the bar at its bottom. `bottom: 0` alone sits below the visible screen in mobile Chrome while the
      // address bar shows (the gap between the message bar and the tabs).
      style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100dvh)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      {/* Same look + motion as before (bar shrinks/grows, the highlight pill slides between tabs with a little
          spring), but with plain CSS transitions instead of framer-motion `layout`/`layoutId`: on Android Chrome
          that FLIP animation could get stuck mid-way on this fixed bar and leave it shifted half off the screen
          (only with animations on, Lite mode never showed it). Positions are computed, not measured. */}
      <div
        onPointerMove={specular}
        onClick={() => compact && setCompact(false)}
        className={`relative glass glass-clear glass-pill glass-specular glass-refract pointer-events-auto flex items-center transition-[padding,gap] duration-300 ease-md-emphasized ${compact ? 'gap-0.5 px-1.5 py-1' : 'gap-1 px-2 py-1.5'}`}
      >
        {/* sliding active pill (springy ease = the old layoutId feel) */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute bg-md-secondary-container rounded-full pointer-events-none"
            style={{
              ...pill,
              transition: 'left 420ms cubic-bezier(0.34, 1.45, 0.64, 1), top 300ms cubic-bezier(0.2, 0, 0, 1), width 300ms cubic-bezier(0.2, 0, 0, 1), height 300ms cubic-bezier(0.2, 0, 0, 1)',
            }}
          />
        )}
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => { e.stopPropagation(); onSelect(key); }}
              className={`relative flex flex-col items-center justify-center rounded-full transition-all duration-300 ease-md-emphasized ${compact ? 'w-11 h-11' : 'w-[3.75rem] h-14'} ${isActive ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant hover:text-md-on-surface'}`}
            >
              <Icon size={compact ? 22 : 24} className={`relative transition-[margin] duration-300 ${compact ? '' : 'mt-0.5'}`} />
              {/* label folds away instead of popping */}
              <span className={`relative text-[11px] leading-none overflow-hidden transition-all duration-300 ease-md-emphasized ${compact ? 'max-h-0 mt-0 opacity-0' : 'max-h-4 mt-1.5 opacity-100'} ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
