import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv} from '../three/core';
import {HDD, M2SSD} from '../three/parts';
import {E, clamp01, keys, keys3, ramp, shake} from '../components/anim';
import {FONT} from '../components/fonts';
import {ImpactTitle} from '../components/type';

export const SWAP = 2.0; // момент превращения HDD → SSD

const Stage: React.FC<{t: number}> = ({t}) => {
  const ex = ramp(t, 1.35, SWAP, E.inCubic);
  const hddScale = 1 - ramp(t, 1.75, SWAP + 0.05, E.inExpo) * 0.95;
  const ssdIn = ramp(t, SWAP, SWAP + 0.55, E.outBack);
  const ssdRot = -0.6 + (t - SWAP) * 0.22;
  const glowK = Math.exp(-Math.max(0, t - SWAP) * 3) * (t >= SWAP ? 1 : 0);
  const pos = keys3(
    t,
    [
      [0, [-10, -31, 33]],
      [SWAP, [-6, -26, 28]],
      [SWAP + 0.01, [-3, -9, 10]],
      [4.0, [2, -7.5, 8.2]],
      [6.0, [3, -6.5, 7.5]],
    ],
    E.inOutSine
  );
  const fov = keys(t, [[0, 34], [SWAP, 32], [SWAP + 0.01, 34], [6, 30]]);
  const sweep = ((t - SWAP) * 0.6) % 1;
  const [sx, sy] = shake(t, SWAP, 0.25, 8);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={['#04070d']} />
      <fog attach="fog" args={['#04070d', 18, 70]} />
      <StudioEnv mood={t < SWAP ? 'neutral' : 'cold'} intensity={t < SWAP ? 0.7 : 1.1} />
      <ambientLight intensity={0.06} />
      <directionalLight position={[-12, -10, 24]} intensity={t < SWAP ? 1.8 : 1.0} color={t < SWAP ? '#d8d2c8' : '#e4f4ff'} />
      <pointLight position={[10, 6, 10]} intensity={t < SWAP ? 30 : 60} distance={50} color={t < SWAP ? '#ffb68a' : COLORS.blue} />
      {/* световая полоса, скользящая по SSD */}
      {t >= SWAP && <pointLight position={[-8 + sweep * 16, -3, 4]} intensity={40} distance={20} color="#ffffff" />}
      <Cam pos={[pos[0] + sx, pos[1] + sy, pos[2]]} target={t < SWAP ? [0, 0, 1.2] : [0, 0, 0]} fov={fov} />
      {hddScale > 0.06 && (
        <group rotation={[0, 0, 0.35 + t * 0.12]} scale={hddScale} position={[0, 0, 0]}>
          <group position={[0, 0, -1.2]}>
            <HDD explode={ex} />
          </group>
        </group>
      )}
      {t >= SWAP && (
        <group rotation={[0, 0, ssdRot + 1.15]} scale={0.4 + 0.6 * ssdIn}>
          <M2SSD edgeGlow={glowK * 1.2 + 0.15} />
        </group>
      )}
      <Particles t={t} count={140} box={[[-14, -14, -4], [14, 14, 14]]} color={t < SWAP ? '#c9c3b8' : COLORS.cyan} size={0.14} drift={[0.3, 0.4, 0.2]} opacity={0.35} seed={21} />
      <Post bloom={t < SWAP ? 0.6 : 1.0} threshold={0.72} radius={0.55} />
    </ThreeCanvas>
  );
};

// Быстрая установка Windows → рабочий стол. Без логотипов, только интерфейс.
const SetupUI: React.FC<{t: number}> = ({t}) => {
  if (t < 0) return null;
  const k = ramp(t, 0, 0.35, E.outExpo);
  const prog = ramp(t, 0.15, 0.95, E.inOutCubic);
  const desk = ramp(t, 0.95, 1.3, E.outExpo);
  const icons = ['Документы', 'Браузер', 'Игры', 'Фото', 'Музыка', 'Настройки'];
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: 640,
        height: 620,
        borderRadius: 28,
        overflow: 'hidden',
        transform: `perspective(1600px) rotateX(${(1 - k) * 18}deg) scale(${0.9 + 0.1 * k})`,
        opacity: k,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(103,232,255,0.25), 0 0 80px rgba(33,191,255,0.25)`,
        background: '#071224',
        fontFamily: FONT.text,
        color: COLORS.white,
      }}
    >
      {/* экран установки */}
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 1 - desk}}>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" stroke="rgba(243,248,255,0.12)" strokeWidth="12" fill="none" />
          <circle cx="100" cy="100" r="80" stroke={COLORS.cyan} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={503} strokeDashoffset={503 * (1 - prog)} transform="rotate(-90 100 100)" />
        </svg>
        <div style={{marginTop: 34, fontSize: 46, fontWeight: 700}}>Установка Windows</div>
        <div style={{marginTop: 12, fontSize: 30, opacity: 0.6, fontFamily: FONT.mono}}>{prog < 1 ? 'настройка системы…' : 'готово'}</div>
      </div>
      {/* рабочий стол */}
      <div style={{position: 'absolute', inset: 0, opacity: desk, background: `radial-gradient(ellipse 90% 70% at 70% 30%, #1d6fb8 0%, #0b2a52 45%, #050d1c 100%)`}}>
        <div style={{position: 'absolute', left: 40, top: 40, display: 'grid', gridTemplateColumns: 'repeat(2, 150px)', gap: 26}}>
          {icons.map((n, i) => {
            const ik = ramp(t, 1.0 + i * 0.06, 1.25 + i * 0.06, E.outBack);
            return (
              <div key={n} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: `scale(${ik})`, opacity: clamp01(ik)}}>
                <div style={{width: 76, height: 76, borderRadius: 20, background: i % 2 ? 'linear-gradient(135deg, #67E8FF, #21BFFF)' : 'linear-gradient(135deg, #F3F8FF, #9fd6ff)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)'}} />
                <div style={{fontSize: 24, fontWeight: 600}}>{n}</div>
              </div>
            );
          })}
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, background: 'rgba(5,12,24,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{width: 44, height: 44, borderRadius: 12, background: i === 0 ? COLORS.blue : 'rgba(243,248,255,0.22)', transform: `translateY(${(1 - ramp(t, 1.0 + i * 0.05, 1.3 + i * 0.05, E.outBack)) * 80}px)`}} />
          ))}
        </div>
        <div style={{position: 'absolute', right: 40, top: 46, fontSize: 30, fontWeight: 700, color: COLORS.lime, opacity: ramp(t, 1.3, 1.5)}}>✓ Система готова</div>
      </div>
    </div>
  );
};

export const S05SSD: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const ui = 3.9;
  const flash = t >= SWAP ? Math.exp(-(t - SWAP) * 9) : 0;
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <AbsoluteFill style={{filter: `blur(${ramp(t, ui, ui + 0.4) * 6}px) brightness(${1 - ramp(t, ui, ui + 0.4) * 0.45})`}}>
        <Stage t={t} />
      </AbsoluteFill>
      {/* «сканирующие» слои при разборе HDD */}
      <AbsoluteFill style={{opacity: ramp(t, 1.4, 1.8) * (1 - ramp(t, SWAP, SWAP + 0.3)), background: 'repeating-linear-gradient(0deg, rgba(103,232,255,0.0) 0 22px, rgba(103,232,255,0.16) 22px 24px)', mixBlendMode: 'screen', transform: `translateY(${(t * 400) % 24}px)`}} />
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, rgba(103,232,255,${flash}) 0%, rgba(33,191,255,${flash * 0.5}) 35%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.2)}} />
      <SetupUI t={t - ui} />
      <ImpactTitle text={TEXT.ssd} t={t} at={SWAP} out={ui - 0.2} y={300} size={128} glow={COLORS.blue} exit="up" />
      <ImpactTitle text={TEXT.windows} t={t} at={ui + 0.05} out={dur - 0.25} y={300} size={118} glow={COLORS.cyan} exit="blur" />
    </AbsoluteFill>
  );
};
