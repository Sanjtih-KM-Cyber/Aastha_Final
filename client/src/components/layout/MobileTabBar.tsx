import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
      aria-label="Main"
      className="mobile-tab-bar fixed inset-x-0 z-[60] flex justify-center pointer-events-none"
      // --vv-bottom (set by ChatView) keeps the bar on the VISIBLE screen even if Chrome pans the page
      style={{ bottom: 'calc(var(--vv-bottom, 0px) + env(safe-area-inset-bottom) + 12px)' }}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        onPointerMove={specular}
        onClick={() => compact && setCompact(false)}
        className={`glass glass-clear glass-pill glass-specular glass-refract pointer-events-auto flex items-center ${compact ? 'gap-0.5 px-1.5 py-1' : 'gap-1 px-2 py-1.5'}`}
      >
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => { e.stopPropagation(); onSelect(key); }}
              className={`relative flex flex-col items-center justify-center rounded-full transition-colors duration-200 ease-md-emphasized ${compact ? 'w-11 h-11' : 'w-[3.75rem] h-14'} ${isActive ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant hover:text-md-on-surface'}`}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className={`absolute bg-md-secondary-container rounded-full ${compact ? 'inset-1' : 'top-1.5 h-8 w-14'}`}
                />
              )}
              <Icon size={compact ? 22 : 24} className={`relative ${compact ? '' : 'mt-0.5'}`} />
              {!compact && <span className={`relative text-[11px] leading-none mt-1.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>}
            </button>
          );
        })}
      </motion.div>
    </nav>
  );
};
