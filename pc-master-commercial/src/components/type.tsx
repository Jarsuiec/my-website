import React from 'react';
import {COLORS} from '../config/brand';
import {E, clamp01, hash, ramp} from './anim';
import {FONT} from './fonts';

// Крупный заголовок с «физическим ударом»: быстрое приближение, расфокус → резкость, вспышка.
// t — локальное время сцены, at — момент удара, out — момент ухода.
export const ImpactTitle: React.FC<{
  text: string;
  t: number;
  at: number;
  out?: number;
  y: number;
  size?: number;
  color?: string;
  glow?: string;
  tracking?: number;
  weight?: number;
  rgbSplit?: boolean;
  exit?: 'up' | 'blur' | 'cut';
  maxWidth?: number;
}> = ({text, t, at, out = 1e9, y, size = 120, color = COLORS.white, glow = COLORS.blue, tracking = -0.02, weight = 900, rgbSplit = false, exit = 'blur', maxWidth = 960}) => {
  if (t < at - 0.01 || t > out + 0.5) return null;
  const k = ramp(t, at, at + 0.22, E.outExpo);
  const flash = 1 - ramp(t, at, at + 0.35, E.outCubic);
  const o = exit === 'cut' ? (t < out ? 1 : 0) : 1 - ramp(t, out, out + 0.3, E.inCubic);
  const scale = 1.32 - 0.32 * k + (exit === 'blur' ? 0.06 * ramp(t, out, out + 0.3) : 0);
  const blur = (1 - k) * 18 + (exit === 'blur' ? ramp(t, out, out + 0.3) * 16 : 0);
  const dy = exit === 'up' ? -60 * ramp(t, out, out + 0.3, E.inCubic) : 0;
  const op = clamp01(k * 2.2) * o;
  const split = rgbSplit ? (1 - ramp(t, at, at + 0.4)) * 14 : 0;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: y,
    margin: '0 auto',
    maxWidth,
    textAlign: 'center',
    fontFamily: FONT.display,
    fontWeight: weight,
    fontSize: size,
    lineHeight: 1.0,
    letterSpacing: `${tracking}em`,
    color,
    transform: `translateY(${dy}px) scale(${scale})`,
    filter: `blur(${blur}px)`,
    opacity: op,
    whiteSpace: 'pre-line',
  };
  return (
    <>
      {split > 0.3 && (
        <>
          <div style={{...style, color: '#ff3b5c', transform: `translate(${-split}px, ${dy}px) scale(${scale})`, opacity: op * 0.55, mixBlendMode: 'screen'}}>{text}</div>
          <div style={{...style, color: '#21BFFF', transform: `translate(${split}px, ${dy}px) scale(${scale})`, opacity: op * 0.55, mixBlendMode: 'screen'}}>{text}</div>
        </>
      )}
      <div
        style={{
          ...style,
          textShadow: `0 0 ${18 + flash * 50}px ${glow}${Math.round(40 + flash * 160)
            .toString(16)
            .padStart(2, '0')}, 0 6px 30px rgba(0,0,0,0.65), 0 0 60px rgba(2,5,10,0.55)`,
        }}
      >
        {text}
      </div>
    </>
  );
};

// Спокойное появление: маска снизу вверх + разлёт трекинга.
export const RevealTitle: React.FC<{
  text: string;
  t: number;
  at: number;
  out?: number;
  y: number;
  size?: number;
  color?: string;
  weight?: number;
  tracking?: number;
  font?: string;
  dur?: number;
  glow?: string;
}> = ({text, t, at, out = 1e9, y, size = 72, color = COLORS.white, weight = 800, tracking = 0.02, font = FONT.display, dur = 0.55, glow}) => {
  if (t < at || t > out + 0.45) return null;
  const k = ramp(t, at, at + dur, E.outExpo);
  const o = 1 - ramp(t, out, out + 0.4, E.inCubic);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', overflow: 'hidden', paddingBottom: 6}}>
      <div
        style={{
          display: 'inline-block',
          fontFamily: font,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 1.08,
          color,
          letterSpacing: `${tracking + (1 - k) * 0.25}em`,
          transform: `translateY(${(1 - k) * size * 0.9}px)`,
          opacity: o * clamp01(k * 1.5),
          filter: `blur(${(1 - o) * 10}px)`,
          textShadow: glow ? `0 0 24px ${glow}88, 0 4px 24px rgba(0,0,0,0.7), 0 0 50px rgba(2,5,10,0.5)` : '0 4px 24px rgba(0,0,0,0.7), 0 0 50px rgba(2,5,10,0.5)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// Техническая подпись (моноширинный шрифт) с эффектом набора.
export const TypeLabel: React.FC<{text: string; t: number; at: number; out?: number; x?: number; y: number; size?: number; color?: string; align?: 'left' | 'center'; cps?: number}> = ({
  text,
  t,
  at,
  out = 1e9,
  x,
  y,
  size = 30,
  color = COLORS.cyan,
  align = 'center',
  cps = 40,
}) => {
  if (t < at || t > out + 0.3) return null;
  const n = Math.min(text.length, Math.floor((t - at) * cps));
  const o = 1 - ramp(t, out, out + 0.3);
  const caret = Math.floor(t * 4) % 2 === 0 && n < text.length;
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'center' ? 0 : x,
        right: align === 'center' ? 0 : undefined,
        top: y,
        textAlign: align,
        fontFamily: FONT.mono,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: '0.12em',
        color,
        opacity: o,
        textShadow: `0 0 14px ${color}66`,
      }}
    >
      {text.slice(0, n)}
      <span style={{opacity: caret ? 1 : 0}}>▍</span>
    </div>
  );
};

// Глитч-полосы поверх кадра (DOM-слой, без перерисовки 3D).
export const GlitchBars: React.FC<{t: number; amount: number; seed?: number}> = ({t, amount, seed = 1}) => {
  if (amount <= 0.01) return null;
  const fr = Math.floor(t * 30);
  const bars = Array.from({length: 9}, (_, i) => {
    const h = hash(fr * 13 + i * 7 + seed);
    if (h > amount) return null;
    const top = hash(fr * 3 + i * 11 + seed) * 1920;
    const ht = 6 + hash(fr + i * 5) * 70;
    const col = i % 3 === 0 ? 'rgba(33,191,255,0.55)' : i % 3 === 1 ? 'rgba(255,118,59,0.45)' : 'rgba(243,248,255,0.35)';
    return <div key={i} style={{position: 'absolute', left: 0, right: 0, top, height: ht, background: col, mixBlendMode: 'screen', transform: `translateX(${(hash(fr * 7 + i) - 0.5) * 120}px)`}} />;
  });
  return <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>{bars}</div>;
};
