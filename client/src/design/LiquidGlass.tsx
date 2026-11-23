import React, { useCallback, useEffect } from 'react';

/**
 * Liquid Glass support pieces (Phase 5).
 *
 * <LiquidGlassDefs/>mount once. Provides the SVG displacement filter used by `.glass-refract`
 * and flags `html.refract-ok` on engines that support SVG filters in backdrop-filter (Chromium /
 * Android WebView). Safari/iOS and Firefox simply keep the plain frosted blur.
 */
export const LiquidGlassDefs: React.FC = () => {
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isChromium = /Chrome|Chromium|CriOS|Edg\//.test(ua) && !/Firefox/.test(ua);
    document.documentElement.classList.toggle('refract-ok', isChromium && !isIOS);
  }, []);

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <filter id="aastha-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        {/* Low-frequency noise → gentle lens-like bending of whatever scrolls under the glass */}
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="1" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="10" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
};

/**
 * Pointer/touch-following specular highlight for `.glass-specular` elements.
 * Usage: const onPointerMove = useSpecular(); <div className="glass glass-specular" onPointerMove={onPointerMove} />
 */
export const useSpecular = () =>
  useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--gx', `${e.clientX - r.left}px`);
    el.style.setProperty('--gy', `${e.clientY - r.top}px`);
  }, []);
