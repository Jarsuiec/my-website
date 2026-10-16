import React from 'react';
import {BRAND, COLORS} from '../config/brand';
import {E, clamp01, ramp} from './anim';
import {FONT} from './fonts';

// Фирменный знак: контур микросхемы с выводами + круговая стрелка «вторая жизнь» + узел в центре.
// draw 0..1 — прорисовка линий, fill 0..1 — заливка/свечение.
export const Emblem: React.FC<{size?: number; draw?: number; glow?: number}> = ({size = 220, draw = 1, glow = 1}) => {
  const d = clamp01(draw);
  const L = 1000;
  const dash = (k: number) => ({strokeDasharray: L, strokeDashoffset: L * (1 - clamp01(k))});
  const pins = [-36, -12, 12, 36];
  return (
    <svg width={size} height={size} viewBox="-120 -120 240 240" style={{overflow: 'visible', filter: `drop-shadow(0 0 ${8 + glow * 18}px ${COLORS.blue}${Math.round(80 + glow * 120).toString(16)})`}}>
      <defs>
        <linearGradient id="emG" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0" stopColor={COLORS.cyan} />
          <stop offset="1" stopColor={COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="-78" y="-78" width="156" height="156" rx="26" fill="rgba(6,11,20,0.85)" stroke="url(#emG)" strokeWidth="7" pathLength={L} style={dash(d * 1.4)} />
      {pins.map((p, i) => (
        <g key={i} stroke="url(#emG)" strokeWidth="7" strokeLinecap="round" style={{opacity: clamp01(d * 3 - 1.2 - i * 0.15)}}>
          <line x1={p} y1="-82" x2={p} y2="-104" />
          <line x1={p} y1="82" x2={p} y2="104" />
          <line x1="-82" y1={p} x2="-104" y2={p} />
          <line x1="82" y1={p} x2="104" y2={p} />
        </g>
      ))}
      {/* круговая стрелка */}
      <path d="M 38 -26 A 46 46 0 1 0 44 14" fill="none" stroke={COLORS.white} strokeWidth="11" strokeLinecap="round" pathLength={L} style={dash(d * 1.6 - 0.45)} />
      <path d="M 22 -34 L 41 -27 L 46 -48" fill="none" stroke={COLORS.white} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" style={{opacity: clamp01(d * 4 - 3)}} />
      <circle r="10" fill={COLORS.cyan} style={{opacity: clamp01(d * 4 - 3)}} />
    </svg>
  );
};

export const Wordmark: React.FC<{size?: number; k?: number; tracking?: number}> = ({size = 132, k = 1, tracking = 0.04}) => (
  <div
    style={{
      fontFamily: FONT.display,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1,
      letterSpacing: `${tracking + (1 - k) * 0.3}em`,
      whiteSpace: 'nowrap',
      color: COLORS.white,
      opacity: clamp01(k * 1.5),
      filter: `blur(${(1 - k) * 12}px)`,
      textShadow: `0 0 30px ${COLORS.blue}55`,
    }}
  >
    <span style={{background: `linear-gradient(180deg, ${COLORS.cyan}, ${COLORS.blue})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>PC</span> MASTER
  </div>
);

// Полный логотип: знак + надпись + подпись. t — локальное время с начала появления.
export const LogoLockup: React.FC<{t: number; sub?: string; scale?: number; subAt?: number}> = ({t, sub = `${BRAND.master} | ${BRAND.city}`, scale = 1, subAt = 0.45}) => {
  const k = ramp(t, 0, 0.5, E.outExpo);
  const ks = ramp(t, subAt, subAt + 0.6, E.outExpo);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${scale})`}}>
      <Wordmark k={k} />
      <div style={{marginTop: 34, display: 'flex', alignItems: 'center', gap: 22, opacity: ks}}>
        <div style={{width: 70 * ks, height: 2, background: COLORS.blue}} />
        <div style={{fontFamily: FONT.display, fontWeight: 700, fontSize: 42, letterSpacing: `${0.24 + (1 - ks) * 0.2}em`, color: COLORS.white, textShadow: '0 2px 16px rgba(0,0,0,0.7)'}}>{sub}</div>
        <div style={{width: 70 * ks, height: 2, background: COLORS.blue}} />
      </div>
    </div>
  );
};
