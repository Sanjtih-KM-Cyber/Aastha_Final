/**
 * Parses exported chats ON THE DEVICE for Clone Mode (nothing here touches the network).
 * Supported:
 *  - WhatsApp .txt (Android "31/12/23, 9:41 pm - Name: msg", iOS "[31/12/23, 9:41:05 PM] Name: msg",
 *    12h/24h, dd/mm or mm/dd, "." or "/" or "-" date separators, multi-line messages)
 *  - Telegram Desktop "Export chat history" → result.json
 * Then `sampleFor()` keeps ONLY the chosen person's messages and scrubs personal data before upload.
 */

export interface ParsedMessage { sender: string; text: string }
export interface ParsedChat { messages: ParsedMessage[]; participants: { name: string; count: number }[]; format: 'whatsapp' | 'telegram' }

// [31/12/23, 9:41:05 PM] Name: text    |    31/12/2023, 21:41 - Name: text
const WA_LINE = /^‎?\[?(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:-|–|:)?\s*([^:]{1,60}?):\s([\s\S]*)$/;
const WA_SYSTEM = /(messages and calls are end-to-end encrypted|created group|added|left|removed|changed the (subject|group|icon)|security code changed|joined using this group|This message was deleted|You deleted this message|Missed (voice|video) call|<Media omitted>|image omitted|video omitted|sticker omitted|audio omitted|GIF omitted|document omitted|\(file attached\)|null$)/i;

export const parseWhatsApp = (raw: string): ParsedMessage[] => {
  const out: ParsedMessage[] = [];
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const m = WA_LINE.exec(line);
    if (m) {
      out.push({ sender: m[4].replace(/^‎/, '').trim(), text: m[5] });
    } else if (out.length && line.trim()) {
      out[out.length - 1].text += '\n' + line; // continuation of a multi-line message
    }
  }
  return out.filter((x) => x.text.trim() && !WA_SYSTEM.test(x.text.trim()));
};

const telegramText = (t: any): string =>
  typeof t === 'string' ? t : Array.isArray(t) ? t.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('') : '';

export const parseTelegram = (raw: string): ParsedMessage[] => {
  const data = JSON.parse(raw);
  const msgs: any[] = Array.isArray(data?.messages) ? data.messages : [];
  return msgs
    .filter((m) => m?.type === 'message' && m.from && !m.media_type && !m.photo)
    .map((m) => ({ sender: String(m.from), text: telegramText(m.text) }))
    .filter((m) => m.text.trim());
};

export const parseChatExport = (raw: string, fileName = ''): ParsedChat => {
  const trimmed = raw.trim();
  const isJson = fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{');
  const messages = isJson ? parseTelegram(trimmed) : parseWhatsApp(raw);
  const counts = new Map<string, number>();
  messages.forEach((m) => counts.set(m.sender, (counts.get(m.sender) || 0) + 1));
  const participants = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { messages, participants, format: isJson ? 'telegram' : 'whatsapp' };
};

/** Removes personal data so only *how* someone writes is shared, not private details. */
export const scrubMessage = (text: string, otherNames: string[] = []): string => {
  let t = text
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?\d[\d\s-]{8,}\d)/g, '[number]')       // phone / account numbers
    .replace(/\b\d{4,}\b/g, '[number]')                    // OTPs, pins, card fragments
    .replace(/@\w{2,}/g, '@[user]');
  for (const n of otherNames) {
    const first = n.split(/\s+/)[0];
    if (first && first.length >= 3) t = t.split(first).join('[name]');
  }
  return t.trim();
};

export const MAX_SAMPLE_MESSAGES = 400;
export const MAX_SAMPLE_CHARS = 20_000;

/** Most recent messages from ONE person, scrubbed and size-capped, ready to send for style learning. */
export const sampleFor = (chat: ParsedChat, person: string): string[] => {
  const others = chat.participants.map((p) => p.name).filter((n) => n !== person);
  const mine = chat.messages.filter((m) => m.sender === person).slice(-MAX_SAMPLE_MESSAGES);
  const out: string[] = [];
  let total = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    const s = scrubMessage(mine[i].text, others).slice(0, 300);
    if (!s || /^\[(link|email|number)\]$/.test(s)) continue;
    if (total + s.length > MAX_SAMPLE_CHARS) break;
    out.unshift(s);
    total += s.length;
  }
  return out;
};
