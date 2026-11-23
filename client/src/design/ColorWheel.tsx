import React, { useEffect, useRef, useState } from 'react';

/**
 * Colour wheel for the Sanctuary seed colour (Settings → Appearance).
 * Angle = hue, distance from the centre = saturation (lightness is fixed — Material You derives the light/dark
 * tones itself, so only hue + colourfulness matter). Drag or tap; arrow keys nudge the hue (accessibility).
 * `onChange` fires while dragging (cheap: CSS variables only); `onCommit` fires on release.
 */

export const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
};

export const hexToHs = (hex: string): { h: number; s: number } => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 260, s: 85 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(Math.min(1, s) * 100) };
};

const LIGHTNESS = 62;

export const ColorWheel: React.FC<{ value: string; onChange: (hex: string) => void; onCommit?: (hex: string) => void; size?: number }> = ({ value, onChange, onCommit, size = 220 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hs, setHs] = useState(() => hexToHs(value));
  const dragging = useRef(false);
  useEffect(() => { if (!dragging.current) setHs(hexToHs(value)); }, [value]);

  const fromPointer = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const h = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360); // 0° at the top
    const s = Math.round(Math.min(1, Math.hypot(x, y) / (r.width / 2)) * 100);
    const next = { h, s };
    setHs(next);
    const hex = hslToHex(h, s, LIGHTNESS);
    onChange(hex);
    return hex;
  };

  const rad = ((hs.h - 90) * Math.PI) / 180;
  const knobX = 50 + Math.cos(rad) * (hs.s / 2), knobY = 50 + Math.sin(rad) * (hs.s / 2);
  const current = hslToHex(hs.h, hs.s, LIGHTNESS);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Colour wheel — hue"
      aria-valuemin={0} aria-valuemax={359} aria-valuenow={hs.h} aria-valuetext={`hue ${hs.h}°, ${hs.s}% colourful`}
      className="relative rounded-full touch-none select-none cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-surface-container"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle closest-side, hsl(0 0% ${LIGHTNESS}%), hsl(0 0% ${LIGHTNESS}% / 0) 100%),
          conic-gradient(from 0deg, ${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 100% ${LIGHTNESS}%)`).join(', ')})`,
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.18), 0 10px 30px -10px rgb(0 0 0 / 0.6)',
      }}
      onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); fromPointer(e); }}
      onPointerMove={(e) => { if (dragging.current) fromPointer(e); }}
      onPointerUp={(e) => { if (!dragging.current) return; dragging.current = false; onCommit?.(fromPointer(e)); }}
      onPointerCancel={() => { dragging.current = false; onCommit?.(current); }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 15 : 5;
        let { h, s } = hs;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h = (h + step) % 360;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h = (h - step + 360) % 360;
        else return;
        e.preventDefault();
        if (s < 30) s = 85;
        setHs({ h, s });
        const hex = hslToHex(h, s, LIGHTNESS);
        onChange(hex); onCommit?.(hex);
      }}
    >
      <span
        className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-[3px] border-white pointer-events-none"
        style={{ left: `${knobX}%`, top: `${knobY}%`, background: current, boxShadow: '0 2px 10px rgb(0 0 0 / 0.5)' }}
      />
    </div>
  );
};
