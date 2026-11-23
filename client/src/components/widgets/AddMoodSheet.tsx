import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Loader2 } from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { Button, IconButton, fieldClass } from '../../design/ui';

export interface CustomMood { id: string; label: string; emoji: string; score: number }

/** Level 1 (heavy) … 10 (great) → a colour for charts/tiles (red → amber → green). Pure, tested. */
export const moodColorForScore = (score: number) => {
  const s = Math.max(1, Math.min(10, Number(score) || 5));
  const hue = Math.round(((s - 1) / 9) * 130); // 0 = red, 130 = green
  return `hsl(${hue} 70% 62%)`;
};

export const levelWord = (score: number) =>
  score <= 2 ? 'Very heavy' : score <= 4 ? 'Heavy' : score <= 6 ? 'In between' : score <= 8 ? 'Good' : 'Great';

/** Sheet (inside the Mood window) to add your own mood and remove ones you made. */
export const AddMoodSheet: React.FC<{
  custom: CustomMood[];
  onAdd: (m: { label: string; emoji: string; score: number }) => Promise<string | null>; // returns error text
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}> = ({ custom, onAdd, onDelete, onClose }) => {
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('🌱');
  const [score, setScore] = useState(5);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    const err = await onAdd({ label: label.trim(), emoji, score });
    setBusy(false);
    if (err) setError(err); else { setLabel(''); setScore(5); setEmoji('🌱'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className="absolute inset-0 z-40 rounded-[28px] bg-md-surface-container-high border border-md-outline-variant/30 shadow-2xl flex flex-col"
      role="dialog" aria-label="Add your own mood"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <h3 className="text-lg font-medium text-md-on-surface">Your own mood</h3>
        <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
      </div>

      {picking ? (
        <div className="flex-1 min-h-0 px-2 pb-2">
          <EmojiPicker theme={Theme.DARK} emojiStyle={EmojiStyle.NATIVE} width="100%" height="100%" lazyLoadEmojis
            previewConfig={{ showPreview: false }} onEmojiClick={(e) => { setEmoji(e.emoji); setPicking(false); }} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setPicking(true)} aria-label="Choose emoji"
              className="w-14 h-14 shrink-0 rounded-[18px] bg-md-surface-container-highest text-3xl flex items-center justify-center hover:brightness-110">
              {emoji}
            </button>
            <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 24))} placeholder="Name it — e.g. Homesick"
              aria-label="Mood name" className={fieldClass} maxLength={24} />
          </div>

          <div className="rounded-[20px] bg-md-surface-container p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-md-on-surface">How it feels</span>
              <span className="font-medium" style={{ color: moodColorForScore(score) }}>{levelWord(score)} · {score}/10</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={score} onChange={(e) => setScore(Number(e.target.value))}
              aria-label="Mood level from 1 (heavy) to 10 (great)" className="m3-slider"
              style={{ ['--fill' as any]: `${((score - 1) / 9) * 100}%` } as React.CSSProperties} />
            <div className="flex justify-between text-[11px] text-md-on-surface-variant mt-1"><span>Heavy</span><span>Great</span></div>
          </div>

          {error && <p role="alert" className="text-sm text-md-error">{error}</p>}
          <Button className="w-full" size="lg" onClick={save} disabled={busy || label.trim().length < 2}
            icon={busy ? <Loader2 size={18} className="animate-spin" /> : undefined}>Add mood</Button>

          {custom.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-md-primary mb-2 px-1">Your moods</h4>
              <div className="rounded-[20px] bg-md-surface-container divide-y divide-md-outline-variant/30">
                {custom.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-md-on-surface truncate">{m.label}</span>
                      <span className="block text-[11px]" style={{ color: moodColorForScore(m.score) }}>{levelWord(m.score)} · {m.score}/10</span>
                    </span>
                    <IconButton label={`Remove ${m.label}`} onClick={() => onDelete(m.id)}><Trash2 size={16} /></IconButton>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-md-on-surface-variant mt-2 px-1">Removing a mood keeps the days you already logged.</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
