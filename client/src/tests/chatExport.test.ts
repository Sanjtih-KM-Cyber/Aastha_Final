import { describe, it, expect } from 'vitest';
import { parseChatExport, scrubMessage, sampleFor } from '../utils/chatExport';
import { buildExport } from '../components/settings/ExportMyData';
import { scrubText } from '../utils/scrub';

describe('chat export parsing (Clone Mode, on device)', () => {
  it('WhatsApp Android + iOS formats, multi-line, system lines dropped', () => {
    const raw = [
      '31/12/23, 9:41 pm - Riya: hey',
      'how are you',
      '31/12/23, 9:42 pm - Me: good!',
      '[01/01/24, 10:00:05 AM] Riya: happy new year',
      '01/01/24, 10:01 am - Riya: <Media omitted>',
    ].join('\n');
    const c = parseChatExport(raw, 'chat.txt');
    expect(c.format).toBe('whatsapp');
    expect(c.messages).toHaveLength(3);
    expect(c.messages[0].text).toBe('hey\nhow are you');
    expect(c.participants[0]).toEqual({ name: 'Riya', count: 2 });
  });
  it('Telegram JSON', () => {
    const c = parseChatExport(JSON.stringify({ messages: [{ type: 'message', from: 'A', text: ['hi ', { text: 'there' }] }, { type: 'service', from: 'A', text: 'x' }] }), 'result.json');
    expect(c.messages).toEqual([{ sender: 'A', text: 'hi there' }]);
  });
  it('scrubs personal data before anything is uploaded', () => {
    const s = scrubMessage('call me 98765 43210 or a@b.com, see https://x.y @rahul, Priya says hi, otp 123456', ['Priya Sharma']);
    expect(s).not.toMatch(/98765|a@b\.com|https|rahul|Priya|123456/);
  });
  it('samples only the chosen person', () => {
    const c = parseChatExport('31/12/23, 9:41 pm - Riya: hey\n31/12/23, 9:42 pm - Me: yo', 'x.txt');
    expect(sampleFor(c, 'Riya')).toEqual(['hey']);
  });
});

describe('export my data (7.5)', () => {
  it('unlocks diary entries with the device key, keeps others locked', () => {
    const out = buildExport({ diary: [{ title: 'T1', content: 'C1', locked: true }, { title: 'bad', content: 'bad', locked: true }] },
      (c) => (c === 'bad' ? '' : `plain:${c}`));
    expect(out.diary[0]).toMatchObject({ title: 'plain:T1', content: 'plain:C1', locked: false });
    expect(out.diary[1].locked).toBe(true);
  });
  it('without a key everything stays locked', () => {
    expect(buildExport({ diary: [{ title: 'x', content: 'y', locked: true }] }).diary[0].locked).toBe(true);
  });
});

describe('crash report scrubbing (client copy)', () => {
  it('removes emails, numbers and tokens', () => {
    expect(scrubText('x@y.com +91 98765 43210 Bearer abc')).toBe('[email] [number] Bearer [token]');
  });
});
