/**
 * Minimal Server-Sent-Events parser for the chat stream (`data: {...}\n\n`).
 * Chunk boundaries can fall anywhere (mid-line, mid-JSON), so text is buffered until a blank line.
 * `[DONE]` is reported as `{ done: true }`; malformed JSON lines are skipped.
 */
export type SseEvent = { done: true } | { done: false; data: any };

export const createSseParser = () => {
  let buffer = '';

  const parseBlock = (block: string, out: SseEvent[]) => {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload.trim() === '[DONE]') { out.push({ done: true }); continue; }
      try { out.push({ done: false, data: JSON.parse(payload) }); } catch { /* partial / malformed — ignore */ }
    }
  };

  return {
    push(chunk: string): SseEvent[] {
      buffer += chunk.replace(/\r\n/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      const out: SseEvent[] = [];
      for (const b of blocks) parseBlock(b, out);
      return out;
    },
    /** Anything left when the connection closes without a trailing blank line. */
    flush(): SseEvent[] {
      const out: SseEvent[] = [];
      if (buffer.trim()) parseBlock(buffer, out);
      buffer = '';
      return out;
    },
  };
};

/** Header statuses that only make sense while a reply is in flight. */
export const isTransientStatus = (s: string) => /^(typing|thinking)/i.test(String(s || '').trim());
