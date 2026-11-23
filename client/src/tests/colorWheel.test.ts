import { describe, it, expect } from 'vitest';
import { hslToHex, hexToHs } from '../design/ColorWheel';

describe('colour wheel maths', () => {
  it('converts the primaries', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    expect(hslToHex(240, 100, 50)).toBe('#0000ff');
  });
  it('round-trips hue and saturation', () => {
    for (const h of [0, 45, 130, 210, 300]) {
      const back = hexToHs(hslToHex(h, 80, 62));
      expect(Math.abs(back.h - h)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.s - 80)).toBeLessThanOrEqual(3);
    }
  });
  it('greys have no saturation and junk falls back', () => {
    expect(hexToHs('#9e9e9e').s).toBe(0);
    expect(hexToHs('not a colour')).toEqual({ h: 260, s: 85 });
  });
});
