import { describe, it, expect } from 'vitest';
import { resolvePerfMode, perfClasses } from '../utils/perfMode';

describe('performance mode (Lite / Lite Plus)', () => {
  it('saved choice wins, then the old Lite switch, then auto-detect', () => {
    expect(resolvePerfMode('plus', 'false', false)).toBe('plus');
    expect(resolvePerfMode(null, 'true', false)).toBe('lite');
    expect(resolvePerfMode(null, 'false', true)).toBe('full');
    expect(resolvePerfMode(null, null, true)).toBe('lite');
    expect(resolvePerfMode('junk', null, false)).toBe('full');
  });
  it('Lite Plus is never chosen automatically', () => {
    expect(resolvePerfMode(null, null, true)).not.toBe('plus');
  });
  it('Lite Plus keeps every Lite rule (both classes), Lite alone has only one', () => {
    expect(perfClasses('plus')).toEqual({ lite: true, 'lite-plus': true });
    expect(perfClasses('lite')).toEqual({ lite: true, 'lite-plus': false });
    expect(perfClasses('full')).toEqual({ lite: false, 'lite-plus': false });
  });
});
