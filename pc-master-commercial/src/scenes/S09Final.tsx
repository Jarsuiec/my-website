import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Post, StudioEnv} from '../three/core';
import {GamingPC} from './S06Gaming';
import {E, clamp01, hash, keys3, ramp, shake} from '../components/anim';
import {Emblem, Wordmark} from '../components/Logo';
import {FONT} from '../components/fonts';

export const CARD = 1.0; // удар: центральная композиция

// Световые «скоростные» штрихи.
const Streaks: React.FC<{t: number}> = ({t}) => (
  <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
    {Array.from({length: 26}, (_, i) => {
      const y = hash(i * 3.1) * H;
      const len = 200 + hash(i * 7.7) * 600;
      const sp = 2400 + hash(i * 1.3) * 3000;
      const x = ((hash(i) * (W + len) + t * sp) % (W + len * 2)) - len;
      const col = i % 4 === 0 ? COLORS.lime : i % 2 ? COLORS.cyan : COLORS.blue;
      return <rect key={i} x={x} y={y} width={len} height={i % 5 === 0 ? 4 : 2} rx={2} fill={col} opacity={0.15 + hash(i * 9) * 0.35} />;
    })}
  </svg>
);

export const S09Final: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  // отлёт камеры от чистого вентилятора — сквозь стекло корпуса — наружу
  const pos = keys3(
    t,
    [
      [0, [22, 9, 13]],
      [CARD, [80, 40, 170]],
    ],
    E.inCubic
  );
  const tgt = keys3(
    t,
    [
      [0, [3.8, 7.6, 10]],
      [CARD, [4, -2, 8]],
    ],
    E.inCubic
  );
  const d = t - CARD;
  const flash = d >= 0 ? Math.exp(-d * 8) : 0;
  const [sx, sy] = shake(t, CARD, 14, 7);
  const k = ramp(t, CARD, CARD + 0.45, E.outExpo);
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {t < CARD && (
        <AbsoluteFill style={{filter: `blur(${ramp(t, 0.3, CARD, E.inCubic) * 6}px)`}}>
          <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
            <color attach="background" args={['#040912']} />
            <StudioEnv mood="cold" intensity={1} />
            <ambientLight intensity={0.08} />
            <spotLight position={[10, 70, 50]} angle={0.5} penumbra={0.8} intensity={1300} distance={220} color="#e8f4ff" />
            <directionalLight position={[30, 20, 90]} intensity={0.9} color="#dcecff" />
            <pointLight position={[20, 6, 20]} intensity={160} distance={80} color={COLORS.cyan} />
            <Cam pos={pos} target={tgt} fov={36} far={800} />
            <GamingPC t={t + 10} power={1} />
            <Post bloom={0.9} threshold={0.72} radius={0.6} />
          </ThreeCanvas>
        </AbsoluteFill>
      )}
      {d >= 0 && (
        <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px)`}}>
          <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 45% at 50% 46%, rgba(33,191,255,0.28) 0%, rgba(6,11,20,0) 70%), ${COLORS.bg}`}} />
          <Streaks t={t} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${1.25 - 0.25 * k})`, filter: `blur(${(1 - k) * 14}px)`, opacity: clamp01(k * 2)}}>
            <Emblem size={190} draw={1} glow={0.6 + flash * 2} />
            <div style={{marginTop: 36}}>
              <Wordmark size={140} k={1} />
            </div>
          </div>
          <div style={{position: 'absolute', left: 60, right: 60, top: 1010, textAlign: 'center', fontFamily: FONT.display, fontWeight: 900, fontSize: 84, lineHeight: 1.05, letterSpacing: '-0.01em', color: COLORS.white, opacity: ramp(t, CARD + 0.2, CARD + 0.5), transform: `translateY(${(1 - ramp(t, CARD + 0.2, CARD + 0.6, E.outExpo)) * 40}px)`, textShadow: `0 0 30px ${COLORS.blue}66`}}>
            {TEXT.finalLine.replace('СВОЕМУ ', 'СВОЕМУ\n').split('\n').map((l, i) => (
              <div key={i}>{i === 1 ? <>{l.replace('СКОРОСТЬ', '')}<span style={{color: COLORS.lime}}>СКОРОСТЬ</span></> : l}</div>
            ))}
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: '#fff', opacity: flash * 0.55, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.15)}} />
      <AbsoluteFill style={{background: '#000', opacity: ramp(t, dur - 0.12, dur) * 0.6}} />
    </AbsoluteFill>
  );
};
