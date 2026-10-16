import React, {useMemo} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {CUES, FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, V3} from '../three/core';
import {HDD, M2SSD} from '../three/parts';
import {E, clamp01, hash, keys, keys3, lerp, ramp, shake} from '../components/anim';
import {FONT} from '../components/fonts';
import {ImpactTitle} from '../components/type';

// Ключевые моменты (timeline.json → cues): SWAP — «SSD» в озвучке, UI — «…настройка Windows».
export const SWAP = CUES.ssdSwap;
export const UI = CUES.ssdUI;
const PUSH = SWAP - 0.5; // начало резкого наезда на HDD (speed ramp)

// Голубые импульсы по периметру и дорожкам SSD (локальные координаты модели M2SSD).
const SSD_PATHS: [number, number][][] = [
  [[-4, -1.1], [4, -1.1], [4, 1.1], [-4, 1.1], [-4, -1.1]],
  [[-3.6, -0.6], [-2.8, -0.6], [-2.2, 0]],
  [[-3.6, 0.6], [-2.8, 0.6], [-2.2, 0]],
  [[-1.6, 0], [-0.6, 0], [0.2, 0.3], [1.2, 0.3], [2.2, 0]],
  [[-1.6, -0.3], [-0.4, -0.7], [1.4, -0.7], [3.2, -0.2]],
];
const plen = (p: [number, number][]) => p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
const at = (p: [number, number][], d: number): [number, number, number] => {
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (acc + l >= d) {
      const u = (d - acc) / l;
      return [lerp(p[i - 1][0], p[i][0], u), lerp(p[i - 1][1], p[i][1], u), Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])];
    }
    acc += l;
  }
  const q = p[p.length - 1];
  return [q[0], q[1], 0];
};
const SSDPulses: React.FC<{t: number; k: number}> = ({t, k}) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({color: new THREE.Color(COLORS.cyan).multiplyScalar(1.15), toneMapped: false, transparent: true}), []);
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.022, 0.22, 4, 8), []);
  mat.opacity = k;
  if (k <= 0.01) return null;
  const items: React.ReactNode[] = [];
  SSD_PATHS.forEach((p, pi) => {
    const L = plen(p);
    const n = pi === 0 ? 4 : 2;
    for (let j = 0; j < n; j++) {
      const d = ((t * (pi === 0 ? 6 : 4.5) + (j / n) * L + pi * 0.7) % L + L) % L;
      const [x, y, a] = at(p, d);
      items.push(<mesh key={`${pi}-${j}`} geometry={geo} material={mat} position={[x, y, 0.2]} rotation={[0, 0, a - Math.PI / 2]} />);
    }
  });
  return <group>{items}</group>;
};

const Stage: React.FC<{t: number; dur: number}> = ({t, dur}) => {
  const before = t < SWAP;
  // A: медленная система — диск крутится лениво, головка дёргается в поиске
  const platter = t * 0.75;
  const arm = (hash(Math.floor(t * 5)) - 0.5) * 0.3 + Math.sin(t * 50) * 0.003;
  // камера: медленный наезд → резкий разгон (speed ramp) в механику диска → проводка вдоль SSD
  const pos = before
    ? keys3(t, [[0, [12.5, -19, 12.5]], [PUSH, [9.5, -14.5, 9.6]], [SWAP, [1.0, -0.2, 1.55]]], E.inExpo)
    : t < UI
      ? keys3(t, [[SWAP, [-9.5, -6.2, 5.0]], [UI, [6.6, -6.6, 5.2]]], E.outExpo)
      : keys3(t, [[UI, [6.6, -6.6, 5.2]], [dur, [2.5, -8.0, 7.0]]], E.inOutSine);
  const tgt: V3 = before
    ? keys3(t, [[0, [0.6, 0.6, 1.0]], [PUSH, [0.6, 1.0, 1.1]], [SWAP, [0, 2.2, 1.05]]], E.inExpo)
    : t < UI
      ? keys3(t, [[SWAP, [-2.2, 0, 0.1]], [UI, [2.2, 0, 0.1]]], E.outExpo)
      : [0.6, 0, 0];
  const zoom = before ? ramp(t, PUSH + 0.1, SWAP, E.inCubic) * 0.24 : (1 - ramp(t, SWAP, SWAP + 0.4, E.outCubic)) * 0.2;
  const ssdIn = ramp(t, SWAP, SWAP + 0.35, E.outBack);
  const glowK = t >= SWAP ? Math.exp(-(t - SWAP) * 3) : 0;
  const [sx, sy] = shake(t, SWAP, 0.08, 9);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={[before ? '#070504' : '#03070e']} />
      <fog attach="fog" args={[before ? '#070504' : '#03070e', 14, 60]} />
      <StudioEnv mood={before ? 'hot' : 'cold'} intensity={before ? 0.6 : 1.1} />
      <ambientLight intensity={0.06} />
      {before ? (
        <>
          <pointLight position={[-9, 6, 12]} intensity={70} distance={60} color="#ffa36a" decay={2} />
          <spotLight position={[10, -12, 14]} angle={0.5} penumbra={0.9} intensity={160} distance={60} color="#ffd6b0" />
          {/* скользящий блик по зеркальной пластине */}
          <pointLight position={[-3 + t * 2, 9, 6]} intensity={16} distance={30} color="#ffe2c4" />
        </>
      ) : (
        <>
          <directionalLight position={[-8, -10, 16]} intensity={1.7} color="#e8f6ff" />
          <pointLight position={[6, 4, 6]} intensity={70} distance={40} color={COLORS.blue} />
          <pointLight position={[-6, -4, 4]} intensity={40} distance={30} color={COLORS.cyan} />
        </>
      )}
      <Cam pos={[pos[0] + sx, pos[1] + sy, pos[2]]} target={tgt} fov={before ? 34 : 38} near={0.05} />
      {before && (
        <group rotation={[0, 0, 0.18]}>
          <HDD open platter={platter} arm={arm} />
        </group>
      )}
      {!before && (
        <group rotation={[0, 0, 0.06 + (t - SWAP) * 0.05]} scale={0.55 + 0.45 * ssdIn}>
          <M2SSD edgeGlow={glowK * 1.4 + 0.25} />
          <SSDPulses t={t} k={ramp(t, SWAP + 0.05, SWAP + 0.3)} />
        </group>
      )}
      <Particles t={t} count={120} box={[[-12, -12, -2], [12, 12, 10]]} color={before ? '#d8c3aa' : COLORS.cyan} size={0.1} drift={before ? [0.1, 0.1, 0.05] : [2.5, 0, 0.2]} opacity={0.35} seed={21} />
      <Post bloom={before ? 0.45 : 0.75} threshold={before ? 0.85 : 0.78} radius={0.5} zoom={zoom} zoomCenter={before ? [0.5, 0.48] : [0.5, 0.5]} />
    </ThreeCanvas>
  );
};

// Зависший интерфейс до апгрейда: загрузка застряла.
const SlowUI: React.FC<{t: number}> = ({t}) => {
  const k = ramp(t, 0.15, 0.45, E.outExpo) * (1 - ramp(t, PUSH, PUSH + 0.25));
  if (k <= 0.01) return null;
  const spin = Math.min(t, 0.7) * 300; // спиннер замирает
  return (
    <div style={{position: 'absolute', left: 150, right: 150, top: 360, padding: '26px 34px', borderRadius: 24, background: 'rgba(22,16,12,0.82)', border: '1px solid rgba(255,190,140,0.25)', opacity: k, transform: `translateY(${(1 - k) * 20}px)`, fontFamily: FONT.text, color: '#F6E7DA', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <svg width="56" height="56" viewBox="0 0 56 56" style={{transform: `rotate(${spin}deg)`}}>
          <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
          <path d="M28 6 A22 22 0 0 1 50 28" stroke={COLORS.heat} strokeWidth="6" fill="none" strokeLinecap="round" />
        </svg>
        <div style={{fontSize: 40, fontWeight: 700}}>Загрузка системы…</div>
      </div>
      <div style={{marginTop: 20, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.1)'}}>
        <div style={{width: `${18 + ramp(t, 0.2, 0.6) * 5}%`, height: '100%', borderRadius: 7, background: COLORS.heat}} />
      </div>
    </div>
  );
};

// Новая скорость: быстрая установка Windows и отзывчивый рабочий стол. Без логотипов, только интерфейс.
const FastUI: React.FC<{t: number}> = ({t}) => {
  if (t < 0) return null;
  const k = ramp(t, 0, 0.18, E.outExpo);
  const prog = ramp(t, 0.08, 0.5, E.inOutCubic);
  const desk = ramp(t, 0.5, 0.62, E.outExpo);
  const icons = ['Документы', 'Браузер', 'Игры', 'Фото', 'Музыка', 'Настройки'];
  const click1 = 1.15;
  const click2 = 1.7;
  const win1 = ramp(t, click1 + 0.04, click1 + 0.16, E.outBack);
  const win2 = ramp(t, click2 + 0.04, click2 + 0.16, E.outBack);
  const cur = keys3(t, [[0.7, [700, 520, 0]], [click1, [318, 84, 0]], [click1 + 0.2, [318, 84, 0]], [click2, [122, 84, 0]]], E.inOutCubic);
  const pressed = (Math.abs(t - click1) < 0.06 || Math.abs(t - click2) < 0.06) ? 0.85 : 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: 80,
        right: 80,
        top: 600,
        height: 660,
        borderRadius: 30,
        overflow: 'hidden',
        transform: `perspective(1600px) rotateX(${(1 - k) * 24}deg) scale(${0.86 + 0.14 * k})`,
        opacity: k,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(103,232,255,0.3), 0 0 90px rgba(33,191,255,0.3)`,
        background: '#071224',
        fontFamily: FONT.text,
        color: COLORS.white,
      }}
    >
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 1 - desk}}>
        <svg width="210" height="210" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" stroke="rgba(243,248,255,0.12)" strokeWidth="12" fill="none" />
          <circle cx="100" cy="100" r="80" stroke={COLORS.cyan} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={503} strokeDashoffset={503 * (1 - prog)} transform="rotate(-90 100 100)" />
        </svg>
        <div style={{marginTop: 30, fontSize: 52, fontWeight: 800}}>Установка Windows</div>
        <div style={{marginTop: 12, fontSize: 34, opacity: 0.7, fontFamily: FONT.mono}}>{prog < 1 ? 'настройка системы…' : 'готово'}</div>
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: desk, background: `radial-gradient(ellipse 90% 70% at 70% 30%, #1d6fb8 0%, #0b2a52 45%, #050d1c 100%)`}}>
        <div style={{position: 'absolute', left: 40, top: 40, display: 'grid', gridTemplateColumns: 'repeat(2, 172px)', gap: 24}}>
          {icons.map((n, i) => {
            const ik = ramp(t, 0.55 + i * 0.035, 0.7 + i * 0.035, E.outBack);
            return (
              <div key={n} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: `scale(${ik})`, opacity: clamp01(ik)}}>
                <div style={{width: 84, height: 84, borderRadius: 22, background: i % 2 ? 'linear-gradient(135deg, #67E8FF, #21BFFF)' : 'linear-gradient(135deg, #F3F8FF, #9fd6ff)', boxShadow: '0 8px 20px rgba(0,0,0,0.35)'}} />
                <div style={{fontSize: 30, fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.5)'}}>{n}</div>
              </div>
            );
          })}
        </div>
        {/* окна открываются мгновенно — отзывчивость */}
        {[{w: win2, title: 'Документы', x: 460, y: 200}, {w: win1, title: 'Браузер', x: 440, y: 50}].map((o) =>
          o.w > 0.01 ? (
            <div key={o.title} style={{position: 'absolute', left: o.x, top: o.y, width: 430, height: 300, borderRadius: 18, background: 'rgba(8,20,38,0.95)', border: '1.5px solid rgba(103,232,255,0.35)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', transform: `scale(${0.85 + 0.15 * o.w})`, opacity: clamp01(o.w), overflow: 'hidden'}}>
              <div style={{height: 54, display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: 28, fontWeight: 700, background: 'rgba(33,191,255,0.18)'}}>{o.title}</div>
              <div style={{padding: 22, display: 'grid', gap: 14}}>
                {[0.9, 0.7, 0.8, 0.5].map((w, i) => (
                  <div key={i} style={{height: 18, width: `${w * 100}%`, borderRadius: 9, background: 'rgba(243,248,255,0.16)'}} />
                ))}
              </div>
            </div>
          ) : null
        )}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, background: 'rgba(5,12,24,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{width: 48, height: 48, borderRadius: 13, background: i === 0 ? COLORS.blue : 'rgba(243,248,255,0.22)', transform: `translateY(${(1 - ramp(t, 0.55 + i * 0.03, 0.75 + i * 0.03, E.outBack)) * 90}px)`}} />
          ))}
        </div>
        <div style={{position: 'absolute', right: 34, bottom: 104, fontSize: 36, fontWeight: 800, color: COLORS.lime, opacity: ramp(t, 2.0, 2.2), textShadow: '0 2px 10px rgba(0,0,0,0.6)'}}>✓ Система готова</div>
        {/* курсор */}
        <svg width="46" height="64" viewBox="0 0 46 64" style={{position: 'absolute', left: cur[0], top: cur[1], transform: `scale(${pressed})`, opacity: ramp(t, 0.65, 0.75)}}>
          <path d="M0 0 L0 50 L13 39 L22 60 L31 56 L22 36 L38 35 Z" fill="#fff" stroke="#000" strokeWidth="2.5" />
        </svg>
      </div>
    </div>
  );
};

// Скоростные штрихи во время проводки вдоль SSD.
const SpeedLines: React.FC<{t: number; k: number}> = ({t, k}) => {
  if (k <= 0.01) return null;
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: k, mixBlendMode: 'screen'}}>
      {Array.from({length: 22}, (_, i) => {
        const y = hash(i * 5.3) * H;
        const len = 160 + hash(i * 2.1) * 520;
        const x = W - (((hash(i) * (W + len) + t * (2600 + hash(i * 3) * 2400)) % (W + len * 2)) - len);
        return <rect key={i} x={x} y={y} width={len} height={i % 4 === 0 ? 3 : 1.5} rx={1.5} fill={i % 3 ? COLORS.cyan : COLORS.white} opacity={0.18 + hash(i * 7) * 0.3} />;
      })}
    </svg>
  );
};

export const S05SSD: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const flash = t >= SWAP - 0.06 ? Math.exp(-Math.max(0, t - SWAP) * 10) * ramp(t, SWAP - 0.06, SWAP) : 0;
  const warm = 1 - ramp(t, SWAP - 0.05, SWAP);
  const uiK = ramp(t, UI, UI + 0.3);
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <AbsoluteFill style={{filter: `saturate(${1 - warm * 0.35}) sepia(${warm * 0.18}) brightness(${(1 - warm * 0.08) * (1 - uiK * 0.45)}) blur(${uiK * 6}px)`}}>
        <Stage t={t} dur={dur} />
      </AbsoluteFill>
      <SpeedLines t={t} k={ramp(t, SWAP, SWAP + 0.15) * (1 - ramp(t, UI - 0.3, UI + 0.2)) + uiK * 0.35} />
      <SlowUI t={t} />
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, rgba(220,250,255,${flash}) 0%, rgba(103,232,255,${flash * 0.6}) 35%, rgba(0,0,0,0) 75%)`, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.2)}} />
      <FastUI t={t - UI} />
      <ImpactTitle text={TEXT.ssd} t={t} at={SWAP} out={UI - 0.15} y={280} size={138} glow={COLORS.blue} exit="up" />
      <ImpactTitle text={TEXT.windows} t={t} at={UI} out={dur - 0.25} y={290} size={124} glow={COLORS.cyan} exit="blur" />
    </AbsoluteFill>
  );
};
