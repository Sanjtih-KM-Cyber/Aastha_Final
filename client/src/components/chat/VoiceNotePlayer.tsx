import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, seekTimeFromX, stepTime, progressOf } from '../../utils/voiceNoteMath';
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * WhatsApp-style voice note: waveform bars that fill as it plays, drag/tap anywhere on the
 * waveform to seek, a scrub dot, 1× / 1.5× / 2× speed, and only one note plays at a time.
 *
 * Playback uses a plain <audio> element (works in the app, the browser and lite mode).
 * The waveform is the note's real loudness, decoded once and cached; in lite mode, or if
 * decoding isn't possible, it falls back to a stable pseudo-waveform so nothing heavy runs.
 */
interface VoiceNotePlayerProps {
  src: string;
  accentColor?: string;
}

const BARS = 36;
const SPEEDS = [1, 1.5, 2];
const peakCache = new Map<string, { peaks: number[]; duration: number }>();
const PLAY_EVENT = 'aastha:voice-note-play';

const fmt = formatTime;

/** Stable "looks like speech" bars from the URL (no decoding needed). */
const pseudoPeaks = (seed: string): number[] => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    const envelope = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI); // louder in the middle
    return Math.max(0.15, Math.min(1, r * envelope + 0.12));
  });
};

/** Real loudness per bar from the decoded audio. */
const decodePeaks = async (src: string, signal: AbortSignal) => {
  const cached = peakCache.get(src);
  if (cached) return cached;
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.arrayBuffer();
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(data);
    const ch = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / BARS));
    const raw: number[] = [];
    for (let b = 0; b < BARS; b++) {
      let sum = 0;
      const from = b * step;
      const to = Math.min(ch.length, from + step);
      for (let i = from; i < to; i += 16) sum += ch[i] * ch[i]; // sampled RMS, cheap
      raw.push(Math.sqrt(sum / Math.max(1, (to - from) / 16)));
    }
    const max = Math.max(...raw, 1e-6);
    const out = { peaks: raw.map((v) => Math.max(0.12, Math.min(1, v / max))), duration: audio.duration };
    peakCache.set(src, out);
    return out;
  } finally {
    ctx.close?.();
  }
};

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, accentColor = '#ffffff' }) => {
  const { isLowPowerMode } = useTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const scrubbing = useRef(false);
  const id = useMemo(() => Math.random().toString(36).slice(2), []);

  const [peaks, setPeaks] = useState<number[]>(() => peakCache.get(src)?.peaks || pseudoPeaks(src));
  const [duration, setDuration] = useState(() => peakCache.get(src)?.duration || 0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);

  // Real waveform (skipped in lite mode)
  useEffect(() => {
    if (isLowPowerMode || !src) return;
    const ctrl = new AbortController();
    decodePeaks(src, ctrl.signal)
      .then((r) => { setPeaks(r.peaks); if (r.duration && isFinite(r.duration)) setDuration((d) => d || r.duration); })
      .catch(() => { /* keep pseudo-waveform */ });
    return () => ctrl.abort();
  }, [src, isLowPowerMode]);

  // Only one voice note plays at a time
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, [id]);

  // Smooth progress while playing
  const tick = useCallback(() => {
    const a = audioRef.current;
    if (a && !scrubbing.current) setCurrent(a.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => {
    if (playing) rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    setFailed(false);
    try {
      setLoading(a.readyState < 3);
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id }));
      if (duration && a.currentTime >= duration - 0.05) a.currentTime = 0;
      a.playbackRate = SPEEDS[speedIdx];
      await a.play();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const total = duration || audioRef.current?.duration || 0;
  const progress = progressOf(current, total);

  const seekToClientX = (clientX: number) => {
    const el = barsRef.current;
    const a = audioRef.current;
    if (!el || !a || !total) return;
    const rect = el.getBoundingClientRect();
    const t = seekTimeFromX(clientX, rect.left, rect.width, total);
    setCurrent(t);
    a.currentTime = t;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!total) return;
    e.stopPropagation();
    scrubbing.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    seekToClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => { if (scrubbing.current) seekToClientX(e.clientX); };
  const onPointerUp = () => { scrubbing.current = false; };

  const onKey = (e: React.KeyboardEvent) => {
    const a = audioRef.current;
    if (!a || !total) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const t = stepTime(a.currentTime, total, e.key === 'ArrowRight' ? 1 : -1);
      a.currentTime = t;
      setCurrent(t);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const started = current > 0 || playing;

  return (
    <div className="flex items-center gap-2.5 w-full rounded-2xl py-2 pl-2 pr-3 bg-black/20 border border-white/10 min-w-[220px] select-none">
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-white transition-colors"
        style={{ backgroundColor: playing ? accentColor : 'rgba(255,255,255,0.12)' }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" />
          : failed ? <AlertCircle size={18} className="text-red-300" />
          : playing ? <Pause size={18} fill="currentColor" />
          : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        {/* Waveform = seek bar */}
        <div
          ref={barsRef}
          role="slider"
          tabIndex={0}
          aria-label="Voice note position"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${fmt(current)} of ${fmt(total)}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKey}
          className="relative h-9 flex items-center gap-[2px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
          style={{ touchAction: 'none' }}
        >
          {peaks.map((p, i) => {
            const filled = (i + 0.5) / peaks.length <= progress;
            return (
              <span
                key={i}
                className="flex-1 rounded-full"
                style={{
                  height: `${Math.round(p * 100)}%`,
                  minHeight: 3,
                  backgroundColor: filled ? accentColor : 'rgba(255,255,255,0.32)',
                }}
              />
            );
          })}
          {/* scrub dot */}
          <span
            aria-hidden
            className="absolute top-1/2 w-3 h-3 -mt-1.5 -ml-1.5 rounded-full shadow"
            style={{ left: `${progress * 100}%`, backgroundColor: accentColor }}
          />
        </div>

        <div className="flex items-center justify-between mt-0.5 text-[10px] text-white/55 font-medium tabular-nums">
          <span>{started ? fmt(current) : fmt(total)}</span>
          <button
            onClick={cycleSpeed}
            aria-label={`Playback speed ${SPEEDS[speedIdx]}x`}
            className="px-1.5 py-[1px] rounded-full bg-white/10 text-white/80 hover:bg-white/20"
          >
            {SPEEDS[speedIdx]}×
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDuration(d); }}
        onDurationChange={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDuration(d); }}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setCurrent(audioRef.current?.currentTime || 0); }}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
    </div>
  );
};
