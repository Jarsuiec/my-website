import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, TEXT} from '../config/brand';
import {FPS} from '../config/timeline';
import {E, clamp01, ramp} from '../components/anim';
import {FONT} from '../components/fonts';

export const TRUST_AT = [0.35, 1.55];

const IconScan: React.FC<{k: number}> = ({k}) => (
  <svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke={COLORS.cyan} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="22" y="22" width="52" height="52" rx="10" />
    <path d="M10 30V16a6 6 0 0 1 6-6h14M66 10h14a6 6 0 0 1 6 6v14M86 66v14a6 6 0 0 1-6 6H66M30 86H16a6 6 0 0 1-6-6V66" />
    <line x1="28" x2="68" y1={30 + 36 * k} y2={30 + 36 * k} stroke={COLORS.white} />
  </svg>
);
const IconDeal: React.FC<{k: number}> = ({k}) => (
  <svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke={COLORS.cyan} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="18" y="10" width="60" height="76" rx="10" />
    <line x1="30" y1="30" x2="66" y2="30" />
    <line x1="30" y1="44" x2="58" y2="44" />
    <path d="M32 64 l10 10 l22 -22" stroke={COLORS.lime} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - k)} />
  </svg>
);

const Item: React.FC<{t: number; at: number; n: string; label: string; icon: React.ReactNode}> = ({t, at, n, label, icon}) => {
  const k = ramp(t, at, at + 0.6, E.outExpo);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 34, opacity: clamp01(k * 1.4), transform: `translateX(${(1 - k) * 80}px)`, filter: `blur(${(1 - k) * 8}px)`}}>
      <div style={{width: 150, height: 150, borderRadius: 34, background: 'rgba(33,191,255,0.1)', border: '2px solid rgba(103,232,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>{icon}</div>
      <div>
        <div style={{fontFamily: FONT.mono, fontWeight: 700, fontSize: 40, color: COLORS.cyan, letterSpacing: '0.12em'}}>{n} —</div>
        <div style={{fontFamily: FONT.display, fontWeight: 900, fontSize: label.length > 12 ? 62 : 72, lineHeight: 1.05, color: COLORS.white, letterSpacing: '-0.01em', whiteSpace: 'pre-line'}}>{label}</div>
      </div>
    </div>
  );
};

export const S08Trust: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const inK = ramp(t, 0, 0.5, E.outCubic);
  const out = ramp(t, dur - 0.3, dur, E.inCubic);
  const line = ramp(t, TRUST_AT[0] + 0.4, TRUST_AT[1] + 0.2, E.inOutCubic);
  return (
    <AbsoluteFill style={{background: '#0b1626'}}>
      {/* светлее и спокойнее: мягкие световые пятна, тонкая сетка */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 50% at ${40 + t * 4}% 30%, rgba(103,232,255,0.20) 0%, rgba(11,22,38,0) 60%), radial-gradient(ellipse 70% 50% at ${70 - t * 3}% 80%, rgba(33,191,255,0.16) 0%, rgba(11,22,38,0) 60%), linear-gradient(180deg, #12233a 0%, #0b1626 100%)`}} />
      <AbsoluteFill style={{opacity: 0.35, backgroundImage: 'linear-gradient(rgba(103,232,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(103,232,255,0.07) 1px, transparent 1px)', backgroundSize: '60px 60px', transform: `translateY(${t * 10}px)`}} />
      <AbsoluteFill style={{opacity: inK * (1 - out), transform: `scale(${1.04 - 0.04 * inK})`}}>
        <div style={{position: 'absolute', left: 90, right: 90, top: 520, padding: '70px 60px', borderRadius: 40, background: 'rgba(14,28,48,0.7)', border: '1.5px solid rgba(243,248,255,0.12)', boxShadow: '0 40px 120px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'}}>
          <div style={{fontFamily: FONT.mono, fontSize: 28, letterSpacing: '0.3em', color: 'rgba(243,248,255,0.55)', marginBottom: 54}}>КАК Я РАБОТАЮ</div>
          <Item t={t} at={TRUST_AT[0]} n={TEXT.trust[0].n} label={TEXT.trust[0].label} icon={<IconScan k={(t * 0.8) % 1} />} />
          <div style={{marginLeft: 74, width: 3, height: 90, background: `linear-gradient(180deg, ${COLORS.cyan} ${line * 100}%, rgba(103,232,255,0.12) ${line * 100}%)`, margin: '18px 0 18px 74px'}} />
          <Item t={t} at={TRUST_AT[1]} n={TEXT.trust[1].n} label={TEXT.trust[1].label.replace(' ЦЕНЫ', '\nЦЕНЫ')} icon={<IconDeal k={ramp(t, TRUST_AT[1] + 0.4, TRUST_AT[1] + 0.9)} />} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
