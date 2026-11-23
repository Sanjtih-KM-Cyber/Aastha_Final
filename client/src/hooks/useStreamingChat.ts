import { useCallback, useEffect, useRef } from 'react';
import { createSseParser } from '../utils/sseParser';

/**
 * Transport for the chat reply stream (split out of ChatView, ROADMAP 7.2 / P5).
 * Owns: fetch + abort, SSE parsing, ≤50 ms render batching (P2), and a guaranteed `onSettled`
 * (so the header can never stay on "Typing…" after a reply ends, fails or is stopped, 7.1).
 * ChatView decides what each event means.
 */
export class StreamHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface StreamContext {
  /** Append text to the raw reply (e.g. proposal tags from the brain event). */
  append: (text: string) => void;
  readonly raw: string;
}

export interface StreamHandlers {
  onContent: (raw: string) => void;               // batched: full raw text so far
  onEvent: (data: any, ctx: StreamContext) => void; // every non-content event
  onDone?: (raw: string) => void;                 // finished normally ([DONE] or connection closed)
  onError?: (err: Error | StreamHttpError) => void;
  onAbort?: () => void;
  /** Always called last. `superseded` = a newer stream already started (don't reset UI for it). */
  onSettled?: (info: { superseded: boolean }) => void;
}

export const BATCH_MS = 50;

export const useStreamingChat = () => {
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const stream = useCallback(async (url: string, token: string, body: unknown, h: StreamHandlers) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    let raw = '';
    let lastFlushed = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (raw === lastFlushed) return;
      lastFlushed = raw;
      h.onContent(raw);
    };
    const ctx: StreamContext = {
      append: (t) => { raw += t; },
      get raw() { return raw; },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: ac.signal,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({} as any));
        throw new StreamHttpError(res.status, errData?.message || '');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      const handle = (events: ReturnType<typeof parser.push>) => {
        for (const ev of events) {
          if (ev.done) return true;
          const d = (ev as { data: any }).data;
          if (d && typeof d.content === 'string' && !d.type) {
            raw += d.content;
            if (!timer) timer = setTimeout(flush, BATCH_MS);
          } else if (d) {
            h.onEvent(d, ctx);
          }
        }
        return false;
      };

      if (reader) {
        let finished = false;
        while (!finished) {
          const { done, value } = await reader.read();
          if (done) { handle(parser.flush()); break; }
          finished = handle(parser.push(decoder.decode(value, { stream: true })));
        }
        if (finished) reader.cancel().catch(() => {});
      }

      if (timer) clearTimeout(timer);
      flush();
      h.onDone?.(raw);
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      if (err?.name === 'AbortError') h.onAbort?.();
      else h.onError?.(err);
    } finally {
      const superseded = abortRef.current !== null && abortRef.current !== ac;
      if (abortRef.current === ac) abortRef.current = null;
      h.onSettled?.({ superseded });
    }
  }, []);

  return { stream, stop };
};
