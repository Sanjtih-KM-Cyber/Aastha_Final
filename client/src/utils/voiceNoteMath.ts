/** Pure maths behind the WhatsApp-style voice-note player (unit-tested in src/tests/voiceNoteMath.test.ts). */

export const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};

/** Pointer x on the waveform → time in seconds (clamped to 0…total). */
export const seekTimeFromX = (clientX: number, left: number, width: number, total: number) => {
  if (!(width > 0) || !(total > 0) || !isFinite(total)) return 0;
  return Math.max(0, Math.min(1, (clientX - left) / width)) * total;
};

/** Keyboard ←/→ step (default 5 s), clamped. */
export const stepTime = (current: number, total: number, direction: 1 | -1, step = 5) =>
  Math.max(0, Math.min(total > 0 ? total : 0, (isFinite(current) ? current : 0) + direction * step));

export const progressOf = (current: number, total: number) => (total > 0 ? Math.min(1, Math.max(0, current / total)) : 0);
