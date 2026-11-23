/**
 * Removes voice-director tags ([STYLE: …], [TTS: …]) and the GIF tag ([GIF: …]) from a token stream *as it streams*,
 * so users never see them, while capturing their contents for the TTS engine.
 * Any other "[…]" text passes through untouched.
 */
const TAGS = ['STYLE', 'TTS', 'GIF'];
const MAX_TAG_LEN = 4000; // safety valve: an unclosed "[TTS:" longer than this is released as text

export const createVoiceTagExtractor = () => {
  let buffer = '';
  const captured: Record<string, string> = {};

  const couldBeTagStart = (s: string) => {
    // s starts with "[" — is it (or could it still become) "[STYLE:" / "[TTS:"?
    const body = s.slice(1).toUpperCase();
    return TAGS.some((t) => {
      const head = `${t}:`;
      return body.length < head.length ? head.startsWith(body) : body.startsWith(head);
    });
  };

  const push = (chunk: string): string => {
    buffer += chunk;
    let out = '';
    while (buffer.length) {
      const open = buffer.indexOf('[');
      if (open === -1) {
        out += buffer;
        buffer = '';
        break;
      }
      out += buffer.slice(0, open);
      buffer = buffer.slice(open);

      if (!couldBeTagStart(buffer)) {
        out += '[';
        buffer = buffer.slice(1);
        continue;
      }
      const close = buffer.indexOf(']');
      if (close === -1) {
        if (buffer.length > MAX_TAG_LEN) {
          out += buffer;
          buffer = '';
        }
        break; // wait for more text
      }
      const inner = buffer.slice(1, close);
      const colon = inner.indexOf(':');
      const name = inner.slice(0, colon).trim().toUpperCase();
      if (TAGS.includes(name)) captured[name] = inner.slice(colon + 1).trim();
      buffer = buffer.slice(close + 1);
    }
    return out;
  };

  const flush = (): string => {
    const rest = buffer;
    buffer = '';
    return rest;
  };

  return { push, flush, captured };
};
