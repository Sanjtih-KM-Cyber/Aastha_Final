/**
 * Performance mode (owner, 2026-11-24): one setting, three values.
 *  full  - all glass, blur and motion
 *  lite  - no blur / looping animations (turns on by itself on slower phones)
 *  plus  - "Lite Plus", chosen by hand for older phones: everything Lite does + no animations, transitions,
 *          shadows, fade masks or colour aura. Turning it on turns Lite off (they're one setting).
 */
export type PerfMode = 'full' | 'lite' | 'plus';

export const PERF_KEY = 'perf-mode';
const LEGACY_LITE_KEY = 'lite-mode-enabled';

/** Saved choice → legacy Lite switch → auto-detect (slow phone = lite). Lite Plus is never automatic. */
export const resolvePerfMode = (saved: string | null, legacyLite: string | null, lowEnd: boolean): PerfMode => {
  if (saved === 'full' || saved === 'lite' || saved === 'plus') return saved;
  if (legacyLite !== null) return legacyLite === 'true' ? 'lite' : 'full';
  return lowEnd ? 'lite' : 'full';
};

export const readPerfMode = (lowEnd: boolean): PerfMode => {
  try { return resolvePerfMode(localStorage.getItem(PERF_KEY), localStorage.getItem(LEGACY_LITE_KEY), lowEnd); }
  catch { return lowEnd ? 'lite' : 'full'; }
};

export const savePerfMode = (m: PerfMode) => {
  try {
    localStorage.setItem(PERF_KEY, m);
    localStorage.setItem(LEGACY_LITE_KEY, String(m !== 'full')); // older code paths still read this
  } catch { /* ignore */ }
};

/** <html> classes: Lite Plus keeps every Lite rule and adds its own. */
export const perfClasses = (m: PerfMode) => ({ lite: m !== 'full', 'lite-plus': m === 'plus' });
