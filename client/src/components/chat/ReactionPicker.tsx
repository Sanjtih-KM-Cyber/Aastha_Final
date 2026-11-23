import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Plus, Reply, Copy, X } from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';

/**
 * WhatsApp-style reactions (7.4 follow-up). Long-press a message (phone) or the 🙂 button (desktop):
 * a glass bar with 6 quick emojis + "+" for ANY emoji, and Reply / Copy underneath.
 * Rendered in a portal with fixed positioning so the chat's scroll container / motion transforms can't clip it.
 */
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'] as const;

/** Clamp the bar inside the viewport, above the bubble when there's room, else below. Pure → unit-tested. */
export const placeBar = (anchor: { top: number; bottom: number; left: number; right: number }, bar: { width: number; height: number },
  viewport: { width: number; height: number }, align: 'left' | 'right', gap = 8, margin = 8) => {
  const above = anchor.top - gap - bar.height >= margin + 48; // keep clear of the header
  const top = above ? anchor.top - gap - bar.height : Math.min(anchor.bottom + gap, viewport.height - bar.height - margin);
  const rawLeft = align === 'left' ? anchor.left : anchor.right - bar.width;
  const left = Math.max(margin, Math.min(rawLeft, viewport.width - bar.width - margin));
  return { top: Math.max(margin, top), left, above };
};

interface Props {
  anchor: DOMRect;
  align: 'left' | 'right';
  current?: string | null;
  canReact: boolean;
  onPick: (emoji: string | null) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onClose: () => void;
}

export const ReactionPicker: React.FC<Props> = ({ anchor, align, current, canReact, onPick, onReply, onCopy, onClose }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [full, setFull] = useState(false);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(placeBar(anchor, { width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight }, align));
  }, [anchor, align]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (e: string) => { onPick(current === e ? null : e); onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[150]" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onPointerUp={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      {!full && (
        <motion.div
          ref={barRef}
          role="dialog"
          aria-label="React to message"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, transformOrigin: align === 'left' ? 'left bottom' : 'right bottom' }}
          className="flex flex-col gap-2 items-stretch"
        >
          {canReact && (
            <div className="glass glass-pill flex items-center gap-0.5 px-1.5 py-1 shadow-2xl">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => pick(e)}
                  aria-label={`React ${e}`}
                  aria-pressed={current === e}
                  className={`w-10 h-10 rounded-full text-[22px] leading-none flex items-center justify-center transition-transform active:scale-90 hover:scale-110 ${current === e ? 'bg-md-secondary-container' : ''}`}
                >
                  {e}
                </button>
              ))}
              <button
                onClick={() => setFull(true)}
                aria-label="More emojis"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-md-surface-container-highest text-md-on-surface-variant hover:brightness-110"
              >
                <Plus size={18} />
              </button>
            </div>
          )}
          <div className={`flex gap-1.5 ${align === 'left' ? 'justify-start' : 'justify-end'}`}>
            {onReply && (
              <button onClick={() => { onReply(); onClose(); }} className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-md-surface-container-high text-md-on-surface text-xs font-medium shadow-lg border border-md-outline-variant/40">
                <Reply size={14} /> Reply
              </button>
            )}
            {onCopy && (
              <button onClick={() => { onCopy(); onClose(); }} className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-md-surface-container-high text-md-on-surface text-xs font-medium shadow-lg border border-md-outline-variant/40">
                <Copy size={14} /> Copy
              </button>
            )}
            {current && canReact && (
              <button onClick={() => { onPick(null); onClose(); }} className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-md-surface-container-high text-md-on-surface-variant text-xs font-medium shadow-lg border border-md-outline-variant/40">
                <X size={14} /> Remove {current}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {full && (
        <div className="fixed inset-0 flex items-end md:items-center justify-center bg-black/50" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="w-full md:w-auto rounded-t-[28px] md:rounded-[28px] bg-md-surface-container-high p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mx-auto mb-1 h-1 w-8 rounded-full bg-md-on-surface-variant/40 md:hidden" />
            <EmojiPicker
              theme={Theme.DARK}
              emojiStyle={EmojiStyle.NATIVE}
              onEmojiClick={(e) => pick(e.emoji)}
              lazyLoadEmojis
              width={typeof window !== 'undefined' ? Math.min(window.innerWidth - 16, 380) : 340}
              height={380}
              skinTonesDisabled={false}
              previewConfig={{ showPreview: false }}
            />
          </motion.div>
        </div>
      )}
    </div>,
    document.body
  );
};
