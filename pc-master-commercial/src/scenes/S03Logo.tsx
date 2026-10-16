import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS} from '../config/brand';
import {CUES, FPS, W, H} from '../config/timeline';
import {Cam, Post, TracePulses} from '../three/core';
import {Motherboard} from '../three/parts';
import {StudioEnv} from '../three/core';
import {E, clamp01, ramp, shake} from '../components/anim';
import {Emblem, LogoLockup} from '../components/Logo';

export const DROP = CUES.logoDrop; // сильная доля: появление PC MASTER (timeline.json → cues.logoDrop)

// Линия-импульс рисует схему: путь с изломами под 45°, сходящийся к знаку.
const CircuitDraw: React.FC<{t: number}> = ({t}) => {
  // Каждая линия приходит точно в вывод микросхемы знака (центр знака 540×790, выводы на ±130 px).
  const paths = [
    'M -40 1650 L 250 1650 L 330 1570 L 330 915 L 410 835',
    'M 1120 300 L 860 300 L 760 400 L 760 655 L 670 745',
    'M 1120 1500 L 900 1500 L 820 1420 L 820 1150 L 585 1150 L 585 920',
    'M -40 420 L 180 420 L 300 540 L 495 540 L 495 660',
  ];
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {paths.map((d, i) => {
        const k = ramp(t, 0.25 + i * 0.12, 1.35 + i * 0.05, E.inOutCubic);
        const fade = 1 - ramp(t, DROP + 0.2, DROP + 1.4);
        return (
          <g key={i} opacity={fade}>
            <path d={d} pathLength={1000} fill="none" stroke={COLORS.blue} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1000} strokeDashoffset={1000 * (1 - k)} style={{filter: `drop-shadow(0 0 10px ${COLORS.blue})`}} />
            <path d={d} pathLength={1000} fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" strokeDasharray="22 1000" strokeDashoffset={-1000 * k + 22} opacity={k > 0 && k < 1 ? 1 : 0} style={{filter: `drop-shadow(0 0 14px ${COLORS.cyan})`}} />
          </g>
        );
      })}
    </svg>
  );
};

export const S03Logo: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const drop = t - DROP;
  const flash = drop >= 0 ? Math.exp(-drop * 7) : 0;
  const [sx, sy] = shake(t, DROP, 12, 7);
  const bg = ramp(t, DROP - 0.05, DROP + 0.6, E.outCubic);
  const emDraw = ramp(t, 0.9, DROP + 0.05, E.inOutCubic);
  const exit = ramp(t, dur - 0.35, dur, E.inCubic);
  const lockY = 1060;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* фон: плата сверху, импульсы по дорожкам */}
      <AbsoluteFill style={{opacity: bg * 0.75, filter: 'blur(1.5px)'}}>
        {bg > 0 && (
          <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
            <color attach="background" args={['#020409']} />
            <StudioEnv mood="cold" intensity={0.5} />
            <directionalLight position={[0, -20, 30]} intensity={0.35} />
            <Cam pos={[0, -2 + drop * 0.6, 34 - drop * 1.2]} target={[0, 0 + drop * 0.6, 0]} fov={50} roll={0.3} />
            <Motherboard accent={COLORS.blue} accentK={1.2} />
            <TracePulses t={t * 1.4} color={COLORS.cyan} count={110} opacity={1} speed={9} />
            <Post bloom={1.1} threshold={0.5} radius={0.6} />
          </ThreeCanvas>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 40% at 50% 46%, rgba(33,191,255,${0.18 * bg + flash * 0.4}) 0%, rgba(6,11,20,0.0) 60%), linear-gradient(180deg, rgba(6,11,20,0.75) 0%, rgba(6,11,20,0.35) 40%, rgba(6,11,20,0.85) 100%)`}} />
      <CircuitDraw t={t} />
      <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px) scale(${1 + exit * 0.08})`, filter: `blur(${exit * 10}px)`, opacity: 1 - exit}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', transform: `scale(${0.9 + 0.1 * ramp(t, DROP, DROP + 0.4, E.outBack)})`}}>
          <Emblem size={300} draw={emDraw} glow={0.6 + flash * 2} />
        </div>
        {drop >= 0 && (
          <div style={{position: 'absolute', left: 0, right: 0, top: lockY, display: 'flex', justifyContent: 'center'}}>
            <LogoLockup t={drop} />
          </div>
        )}
      </AbsoluteFill>
      {/* вспышка на ударе */}
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 42%, rgba(103,232,255,${flash * 0.9}) 0%, rgba(33,191,255,${flash * 0.4}) 30%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: '#fff', opacity: clamp01(flash * 1.4 - 0.9) * 0.6, mixBlendMode: 'screen'}} />
    </AbsoluteFill>
  );
};
