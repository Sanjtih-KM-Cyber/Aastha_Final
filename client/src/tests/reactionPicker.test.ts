import { describe, it, expect } from 'vitest';
import { placeBar, QUICK_REACTIONS } from '../components/chat/ReactionPicker';

const vp = { width: 375, height: 812 };
const bar = { width: 330, height: 100 };

describe('reaction bar placement (WhatsApp-style, phone)', () => {
  it('sits above the bubble when there is room', () => {
    const p = placeBar({ top: 400, bottom: 460, left: 16, right: 260 }, bar, vp, 'left');
    expect(p.above).toBe(true);
    expect(p.top).toBe(400 - 8 - 100);
  });
  it('drops below a bubble near the top (never under the header)', () => {
    const p = placeBar({ top: 90, bottom: 150, left: 16, right: 260 }, bar, vp, 'left');
    expect(p.above).toBe(false);
    expect(p.top).toBe(158);
  });
  it('never leaves the screen horizontally', () => {
    const right = placeBar({ top: 400, bottom: 460, left: 200, right: 370 }, bar, vp, 'left');
    expect(right.left + bar.width).toBeLessThanOrEqual(vp.width - 8);
    const left = placeBar({ top: 400, bottom: 460, left: 0, right: 100 }, bar, vp, 'right');
    expect(left.left).toBeGreaterThanOrEqual(8);
  });
  it('quick bar has 6 emojis (+ full picker)', () => {
    expect(QUICK_REACTIONS).toHaveLength(6);
  });
});
