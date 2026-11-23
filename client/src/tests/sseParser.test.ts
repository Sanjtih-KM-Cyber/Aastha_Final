import { describe, it, expect } from 'vitest';
import { createSseParser, isTransientStatus } from '../utils/sseParser';

describe('SSE parser (chat stream)', () => {
  it('parses whole events', () => {
    const p = createSseParser();
    const ev = p.push('data: {"content":"Hi"}\n\ndata: {"type":"thought","content":{"mood":"happy"}}\n\n');
    expect(ev).toEqual([{ done: false, data: { content: 'Hi' } }, { done: false, data: { type: 'thought', content: { mood: 'happy' } } }]);
  });

  it('handles chunks split mid-JSON and mid-line', () => {
    const p = createSseParser();
    expect(p.push('data: {"cont')).toEqual([]);
    expect(p.push('ent":"Hel')).toEqual([]);
    expect(p.push('lo"}\n')).toEqual([]);
    expect(p.push('\ndata: {"content":" there"}\n\n')).toEqual([
      { done: false, data: { content: 'Hello' } },
      { done: false, data: { content: ' there' } },
    ]);
  });

  it('reports [DONE] and skips malformed lines', () => {
    const p = createSseParser();
    expect(p.push('data: {oops}\n\ndata: [DONE]\n\n')).toEqual([{ done: true }]);
  });

  it('normalises CRLF and flushes a trailing event without blank line', () => {
    const p = createSseParser();
    expect(p.push('data: {"content":"a"}\r\n\r\n')).toEqual([{ done: false, data: { content: 'a' } }]);
    p.push('data: {"content":"b"}');
    expect(p.flush()).toEqual([{ done: false, data: { content: 'b' } }]);
    expect(p.flush()).toEqual([]);
  });

  it('knows which header statuses must reset after a reply (stuck "TYPING…" bug)', () => {
    expect(isTransientStatus('Typing...')).toBe(true);
    expect(isTransientStatus('Thinking it through...')).toBe(true);
    expect(isTransientStatus('Listening...')).toBe(false);
    expect(isTransientStatus('Online')).toBe(false);
  });
});
