import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {BRAND, COLORS} from '../config/brand';
import {FPS, VOICE, W, H, scene} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, V3} from '../three/core';
import {GamingPC} from './S06Gaming';
import {E, clamp01, ramp} from '../components/anim';
import {Emblem, Wordmark} from '../components/Logo';
import {FONT} from '../components/fonts';

// Финальная карточка-постер. Контакт стоит неподвижно ≥ 4 секунд.
const PaperPlane = () => (
  <svg width="88" height="88" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="24" fill="#F3F8FF" />
    <path d="M11 23.5 35 14l-4.2 20.5-7.3-5.6-3.7 3.6.5-5.5 9.3-8.4-11.6 7.1L11 23.5Z" fill={COLORS.blue} />
  </svg>
);

export const S10CTA: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const a = (at: number, len = 0.5) => ramp(t, at, at + len, E.outExpo);
  const fade = ramp(t, dur - 0.45, dur, E.inCubic);
  const orbit = -0.55 + t * 0.06;
  const tgt: V3 = [4, -2, 8];
  const pos: V3 = [tgt[0] + Math.sin(orbit) * 120, tgt[1] - 4 + t * 0.6, tgt[2] + Math.cos(orbit) * 120];
  const plate = a(0.35, 0.6);
  // момент слова «Телеграм» в озвучке → блик и мягкое свечение плашки
  const l12 = VOICE.find((v) => v.id === 'L12');
  const wi = l12?.words?.findIndex((w) => w.w.startsWith('Телеграм')) ?? -1;
  const tg = l12 ? l12.start - scene('cta').start + (l12.words && wi >= 0 ? l12.words[wi].s : 1.0) : 3.5;
  const shine = ramp(t, tg - 0.05, tg + 0.55, E.inOutSine);
  const pulse = Math.exp(-Math.max(0, t - tg) * 2.5) * (t >= tg ? 1 : 0);
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <AbsoluteFill style={{filter: 'blur(3px) brightness(0.55) saturate(1.1)', transform: `scale(${1.08 - t * 0.008})`}}>
        <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
          <color attach="background" args={['#03070e']} />
          <fog attach="fog" args={['#03070e', 100, 260]} />
          <StudioEnv mood="cold" intensity={1} />
          <ambientLight intensity={0.06} />
          <spotLight position={[10, 70, 50]} angle={0.45} penumbra={0.8} intensity={1300} distance={220} color="#e8f4ff" />
          <directionalLight position={[30, 20, 90]} intensity={0.7} color="#dcecff" />
          <pointLight position={[-40, -10, 40]} intensity={800} distance={160} color={COLORS.blue} />
          <pointLight position={[50, 0, 20]} intensity={600} distance={160} color={COLORS.cyan} />
          <Cam pos={pos} target={tgt} fov={34} far={600} />
          <GamingPC t={t + 20} power={1} />
          <Particles t={t} count={140} box={[[-50, -30, -10], [50, 30, 40]]} color={COLORS.cyan} size={0.5} drift={[0.3, 0.8, 0]} opacity={0.35} seed={91} />
          <Post bloom={1.2} threshold={0.55} radius={0.7} />
        </ThreeCanvas>
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 85% 55% at 50% 45%, rgba(6,11,20,0.25) 0%, rgba(6,11,20,0.82) 100%)'}} />
      {/* голубая контурная рамка постера */}
      <div style={{position: 'absolute', left: 48, right: 48, top: 200, bottom: 420, borderRadius: 44, border: `2px solid rgba(103,232,255,${0.35 * a(0.1, 0.8)})`, boxShadow: `0 0 60px rgba(33,191,255,${0.25 * a(0.1, 0.8)}), inset 0 0 60px rgba(33,191,255,${0.1 * a(0.1, 0.8)})`}} />
      <AbsoluteFill style={{opacity: 1 - fade}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 255, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: a(0), transform: `translateY(${(1 - a(0)) * 30}px)`}}>
          <Emblem size={140} draw={1} glow={0.8} />
          <div style={{marginTop: 22}}>
            <Wordmark size={126} k={1} />
          </div>
        </div>
        <div style={{position: 'absolute', left: 60, right: 60, top: 640, textAlign: 'center', fontFamily: FONT.display, fontWeight: 800, fontSize: 46, lineHeight: 1.38, letterSpacing: '0.06em', color: COLORS.white, opacity: a(0.15), textShadow: '0 2px 16px rgba(0,0,0,0.7)'}}>
          <div>{BRAND.services.slice(0, 3).join('  •  ')}</div>
          <div>{BRAND.services.slice(3).join('  •  ')}</div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', fontFamily: FONT.display, fontWeight: 700, fontSize: 42, letterSpacing: '0.26em', color: COLORS.cyan, opacity: a(0.25), textShadow: '0 2px 16px rgba(0,0,0,0.7)'}}>{BRAND.geo.join('  •  ')}</div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 892, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 36, letterSpacing: '0.32em', color: 'rgba(243,248,255,0.85)', opacity: a(0.35)}}>TELEGRAM</div>
        {/* плашка Telegram */}
        <div
          style={{
            position: 'absolute',
            left: 130,
            right: 130,
            top: 950,
            height: 196,
            borderRadius: 98,
            background: `linear-gradient(135deg, ${COLORS.blue} 0%, #1590d6 100%)`,
            boxShadow: `0 20px ${70 + pulse * 60}px rgba(33,191,255,${0.45 + pulse * 0.35}), 0 0 0 ${pulse * 10}px rgba(103,232,255,${pulse * 0.25}), inset 0 2px 0 rgba(255,255,255,0.35)`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 30,
            opacity: clamp01(plate * 1.5),
            transform: `scale(${0.9 + 0.1 * plate})`,
          }}
        >
          {shine > 0 && shine < 1 && <div style={{position: 'absolute', top: 0, bottom: 0, width: 160, left: `${-20 + shine * 120}%`, background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)', transform: 'skewX(-18deg)'}} />}
          <PaperPlane />
          <div style={{fontFamily: FONT.display, fontWeight: 900, fontSize: 118, color: '#fff', letterSpacing: '0.005em', lineHeight: 1, textShadow: '0 3px 14px rgba(0,40,80,0.45)'}}>{BRAND.telegram}</div>
        </div>
        <div style={{position: 'absolute', left: 40, right: 40, top: 1200, textAlign: 'center', fontFamily: FONT.display, fontWeight: 900, fontSize: 56, letterSpacing: '0', color: COLORS.white, opacity: a(0.6), textShadow: `0 0 30px ${COLORS.blue}55`}}>
          {BRAND.ctaLine}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: fade * 0.92}} />
    </AbsoluteFill>
  );
};
