import { describe, it, expect } from 'vitest';
import { tokenize, stripMarkdown, hideDanglingMarkers, parseBlocks } from '../utils/miniMarkdown';

describe('mini markdown (chat bubbles)', () => {
  it('bold / italic / code / strike', () => {
    expect(tokenize('a **b** c')).toEqual([{ type: 'text', text: 'a ' }, { type: 'bold', inner: 'b', href: undefined }, { type: 'text', text: ' c' }]);
    expect(tokenize('*hi*')[0].type).toBe('italic');
    expect(tokenize('`x`')[0].type).toBe('code');
    expect(tokenize('~~no~~')[0].type).toBe('strike');
  });
  it('does not italicise snake_case or 2*3*4', () => {
    expect(tokenize('my_var_name').every(t => t.type === 'text')).toBe(true);
    expect(tokenize('2*3*4 = 24').every(t => t.type === 'text')).toBe(true);
  });
  it('links: https only (no javascript:/http:)', () => {
    expect(tokenize('[x](https://a.com)')[0]).toMatchObject({ type: 'link', href: 'https://a.com' });
    expect(tokenize('[x](javascript:alert(1))').every(t => t.type === 'text')).toBe(true);
    expect(tokenize('[x](http://a.com)').every(t => t.type === 'text')).toBe(true);
  });
  it('strips to plain text', () => {
    expect(stripMarkdown('**Hey** _you_')).toBe('Hey you');
  });
  it('hides a half-typed marker while streaming', () => {
    expect(hideDanglingMarkers('so **bol')).toBe('so bol');
    expect(hideDanglingMarkers('done **ok**')).toBe('done **ok**');
  });
  it('blocks: headings, lists, quotes', () => {
    const b = parseBlocks('# T\n- a\n- b\n1. x\n> q\nplain');
    expect(b.map(x => x.type)).toEqual(['h', 'ul', 'ol', 'quote', 'p']);
  });
  it('no regex lookbehind anywhere (iOS < 16.4 crash)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../utils/miniMarkdown.tsx', import.meta.url), 'utf8');
    expect(/\(\?<[=!]/.test(src)).toBe(false);
  });
});
