import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tap-to-record voice notes (ROADMAP 7.4). MediaRecorder → Blob (webm/opus on Android/Chrome, mp4 on iOS).
 * Capped at 2 minutes (server limit ~2 MB). Microphone is released as soon as recording stops.
 */
export const MAX_RECORD_SECONDS = 120;

export const pickRecorderMime = (isSupported: (t: string) => boolean): string => {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']) {
    try { if (isSupported(t)) return t; } catch { /* ignore */ }
  }
  return '';
};

export const formatClock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const useVoiceRecorder = (onError?: (msg: string) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const autoStopRef = useRef<(() => void) | null>(null);

  const release = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setIsRecording(false);
  };

  const isSupported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined';

  const start = useCallback(async (onAutoStop?: () => void) => {
    if (!isSupported) { onError?.('Voice notes aren\'t supported on this device.'); return false; }
    if (recRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } as any });
      const mimeType = pickRecorderMime((t) => (window as any).MediaRecorder.isTypeSupported?.(t));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0];
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        release();
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };
      streamRef.current = stream;
      recRef.current = rec;
      autoStopRef.current = onAutoStop || null;
      rec.start(250);
      setSeconds(0);
      setIsRecording(true);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const s = (Date.now() - startedAt) / 1000;
        setSeconds(s);
        if (s >= MAX_RECORD_SECONDS) autoStopRef.current?.();
      }, 250);
      return true;
    } catch (e: any) {
      release();
      onError?.(e?.name === 'NotAllowedError' ? 'Microphone access is off, allow it in your phone settings to send voice notes.' : 'Couldn\'t start the microphone.');
      return false;
    }
  }, [isSupported, onError]);

  /** Stops and returns the recording (null if nothing was captured). */
  const stop = useCallback((): Promise<Blob | null> => new Promise((resolve) => {
    const rec = recRef.current;
    if (!rec) return resolve(null);
    resolveRef.current = resolve;
    try { rec.stop(); } catch { release(); resolve(null); }
  }), []);

  const cancel = useCallback(() => {
    resolveRef.current = null;
    const rec = recRef.current;
    if (rec) { rec.onstop = () => release(); try { rec.stop(); } catch { release(); } }
    chunksRef.current = [];
  }, []);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { isSupported, isRecording, seconds, start, stop, cancel };
};
