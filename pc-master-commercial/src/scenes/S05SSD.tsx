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

// Новая скорость: узнаваемая установка Windows и отзывчивый рабочий стол в стиле Windows 11.
// Только интерфейс и собственная графика — без логотипов и чужих обоев.
const WinDots: React.FC<{t: number; size?: number}> = ({t, size = 130}) => {
  // классический «бегущий» индикатор загрузки: точки догоняют друг друга по кругу
  const dots = Array.from({length: 5}, (_, i) => {
    const ph = ((t * 0.9 - i * 0.07) % 1 + 1) % 1;
    const a = -Math.PI / 2 + E.inOutCubic(ph) * Math.PI * 2;
    return {x: Math.cos(a) * size * 0.4, y: Math.sin(a) * size * 0.4, o: ph < 0.92 ? 1 : 0};
  });
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={size * 0.055} fill="#fff" opacity={d.o} />
      ))}
    </svg>
  );
};
const Bloom: React.FC = () => (
  // собственные абстрактные обои: мягкие голубые «лепестки»
  <svg width="100%" height="100%" viewBox="0 0 940 690" preserveAspectRatio="xMidYMid slice" style={{position: 'absolute', inset: 0}}>
    <defs>
      <radialGradient id="wbg" cx="50%" cy="55%" r="70%">
        <stop offset="0" stopColor="#1b5fc4" />
        <stop offset="0.55" stopColor="#0a2a63" />
        <stop offset="1" stopColor="#050f26" />
      </radialGradient>
      <linearGradient id="pet" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#bfe6ff" stopOpacity="0.95" />
        <stop offset="1" stopColor="#2f8cff" stopOpacity="0.35" />
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>
    <rect width="940" height="690" fill="url(#wbg)" />
    <g transform="translate(470 360)" filter="url(#soft)">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={i} rx="230" ry="78" fill="url(#pet)" opacity={0.42 - i * 0.04} transform={`rotate(${-20 + i * 28}) translate(110 0)`} />
      ))}
    </g>
  </svg>
);
const Ic: React.FC<{k: string; s?: number}> = ({k, s = 40}) => {
  const c = {width: s, height: s, viewBox: '0 0 40 40'} as const;
  if (k === 'start') return (<svg {...c}><rect x="4" y="4" width="32" height="32" rx="8" fill="#3aa0ff" /><rect x="10" y="12" width="20" height="16" rx="2.5" fill="none" stroke="#fff" strokeWidth="2.5" /><rect x="10" y="12" width="20" height="4.5" rx="2" fill="#fff" /></svg>);
  if (k === 'folder') return (<svg {...c}><path d="M5 12a3 3 0 0 1 3-3h8l3 3h13a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#f2c14e" /><path d="M5 16h30v13a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#ffd772" /></svg>);
  if (k === 'globe') return (<svg {...c}><circle cx="20" cy="20" r="14" fill="#1fb6d6" /><path d="M6 20h28M20 6c5 4 5 24 0 28M20 6c-5 4-5 24 0 28" stroke="#fff" strokeWidth="2" fill="none" /></svg>);
  if (k === 'gear') return (<svg {...c}><circle cx="20" cy="20" r="14" fill="#6b7a90" /><circle cx="20" cy="20" r="5.5" fill="none" stroke="#fff" strokeWidth="3" />{Array.from({length: 8}, (_, i) => <rect key={i} x="18.5" y="6.5" width="3" height="5" rx="1" fill="#fff" transform={`rotate(${i * 45} 20 20)`} />)}</svg>);
  if (k === 'pc') return (<svg {...c}><rect x="5" y="7" width="30" height="20" rx="2.5" fill="#4aa8ff" /><rect x="8" y="10" width="24" height="14" rx="1" fill="#0d3b7a" /><rect x="15" y="29" width="10" height="3" fill="#9fb4c8" /><rect x="11" y="32" width="18" height="2.5" rx="1" fill="#9fb4c8" /></svg>);
  if (k === 'bin') return (<svg {...c}><path d="M11 13h18l-1.6 20a2 2 0 0 1-2 1.8H14.6a2 2 0 0 1-2-1.8z" fill="#cfe3f5" /><rect x="9" y="9" width="22" height="4" rx="1.5" fill="#e8f2fb" /></svg>);
  return null;
};
const FastUI: React.FC<{t: number}> = ({t}) => {
  if (t < 0) return null;
  const k = ramp(t, 0, 0.18, E.outExpo);
  const prog = Math.round(ramp(t, 0.06, 0.62, E.inOutCubic) * 100);
  const welcome = ramp(t, 0.66, 0.74) * (1 - ramp(t, 0.9, 0.98));
  const setupOut = ramp(t, 0.62, 0.7);
  const desk = ramp(t, 0.92, 1.04, E.outExpo);
  const click = 1.15;
  const win = ramp(t, click + 0.04, click + 0.16, E.outBack);
  const toast = ramp(t, 1.75, 1.95, E.outExpo);
  const cur = keys3(t, [[0.95, [640, 560, 0]], [click, [598, 618, 0]], [2.5, [598, 618, 0]]], E.inOutCubic);
  const pressed = Math.abs(t - click) < 0.06 ? 0.85 : 1;
  const rows = [
    {n: 'Обновления', v: 'установлены', at: 1.3},
    {n: 'Драйверы устройств', v: 'установлены', at: 1.42},
    {n: 'Автозагрузка', v: 'настроена', at: 1.54},
  ];
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top: 590, height: 690, borderRadius: 26, overflow: 'hidden', transform: `perspective(1600px) rotateX(${(1 - k) * 22}deg) scale(${0.86 + 0.14 * k})`, opacity: k, boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 10px #0a0d12, 0 0 0 12px rgba(103,232,255,0.35), 0 0 90px rgba(33,191,255,0.3)', background: '#0b1f3d', fontFamily: '"Inter", "Segoe UI", sans-serif', color: '#fff'}}>
      {/* 1. установка */}
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #0d2b57 0%, #071a38 100%)', opacity: 1 - setupOut}}>
        <WinDots t={t} />
        <div style={{marginTop: 34, fontSize: 46, fontWeight: 600}}>Установка Windows</div>
        <div style={{marginTop: 14, fontSize: 34, opacity: 0.9}}>Ход выполнения: {prog}%</div>
        <div style={{marginTop: 26, fontSize: 26, opacity: 0.6}}>Компьютер может перезагрузиться несколько раз</div>
      </div>
      {/* 2. приветствие */}
      {welcome > 0.01 && (
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a2350', opacity: welcome}}>
          <div style={{fontSize: 60, fontWeight: 600}}>Добро пожаловать</div>
          <div style={{marginTop: 30}}><WinDots t={t} size={100} /></div>
        </div>
      )}
      {/* 3. рабочий стол */}
      {desk > 0.01 && (
        <div style={{position: 'absolute', inset: 0, opacity: desk}}>
          <Bloom />
          <div style={{position: 'absolute', left: 26, top: 24, display: 'grid', gap: 22}}>
            {[['pc', 'Этот компьютер'], ['bin', 'Корзина'], ['folder', 'Документы']].map(([ic, n], i) => (
              <div key={n} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140, gap: 6, transform: `scale(${ramp(t, 1.0 + i * 0.04, 1.14 + i * 0.04, E.outBack)})`}}>
                <Ic k={ic} s={58} />
                <div style={{fontSize: 22, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'center'}}>{n}</div>
              </div>
            ))}
          </div>
          {/* окно «Параметры» открывается мгновенно */}
          {win > 0.01 && (
            <div style={{position: 'absolute', left: 190, top: 40, width: 700, height: 470, borderRadius: 14, overflow: 'hidden', background: 'rgba(32,38,52,0.94)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', transform: `scale(${0.88 + 0.12 * win})`, transformOrigin: '60% 90%', opacity: clamp01(win)}}>
              <div style={{height: 48, display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 22}}>
                <span style={{opacity: 0.9}}>Параметры</span>
                <span style={{marginLeft: 'auto', letterSpacing: 22, opacity: 0.8}}>— ▢ ✕</span>
              </div>
              <div style={{display: 'flex', height: 422}}>
                <div style={{width: 210, padding: '8px 12px', fontSize: 20, display: 'grid', alignContent: 'start', gap: 8, opacity: 0.85}}>
                  {['Система', 'Устройства', 'Сеть и Интернет', 'Центр обновления'].map((n, i) => (
                    <div key={n} style={{padding: '9px 12px', borderRadius: 8, background: i === 3 ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: i === 3 ? '4px solid #4cc2ff' : '4px solid transparent'}}>{n}</div>
                  ))}
                </div>
                <div style={{flex: 1, padding: '6px 22px 20px 6px'}}>
                  <div style={{fontSize: 30, fontWeight: 700}}>Центр обновления Windows</div>
                  <div style={{marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.06)'}}>
                    <div style={{width: 46, height: 46, borderRadius: 23, background: COLORS.lime, color: '#0b1a05', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900}}>✓</div>
                    <div style={{fontSize: 24, fontWeight: 600, lineHeight: 1.25}}>У вас установлены все последние обновления</div>
                  </div>
                  {rows.map((r) => {
                    const rk = ramp(t, r.at, r.at + 0.12, E.outExpo);
                    return (
                      <div key={r.n} style={{marginTop: 12, display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 23, opacity: rk, transform: `translateX(${(1 - rk) * 30}px)`}}>
                        <span>{r.n}</span>
                        <span style={{color: COLORS.lime, fontWeight: 700}}>✓ {r.v}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {/* уведомление */}
          {toast > 0.01 && (
            <div style={{position: 'absolute', right: 18, bottom: 92, width: 420, padding: '18px 22px', borderRadius: 14, background: 'rgba(32,38,52,0.96)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', transform: `translateX(${(1 - toast) * 460}px)`}}>
              <div style={{fontSize: 26, fontWeight: 700}}><span style={{color: COLORS.lime}}>✓</span> Система готова к работе</div>
              <div style={{marginTop: 6, fontSize: 21, opacity: 0.7}}>Windows установлена и настроена</div>
            </div>
          )}
          {/* панель задач по центру */}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, background: 'rgba(22,27,38,0.88)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16}}>
            {['start', 'search', 'folder', 'globe', 'gear'].map((ic, i) => {
              const ik = ramp(t, 0.98 + i * 0.03, 1.12 + i * 0.03, E.outBack);
              return ic === 'search' ? (
                <div key={ic} style={{height: 44, padding: '0 18px', borderRadius: 22, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 21, opacity: 0.85, transform: `translateY(${(1 - ik) * 80}px)`}}>⌕ Поиск</div>
              ) : (
                <div key={ic} style={{width: 52, height: 52, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ic === 'gear' && t > click ? 'rgba(255,255,255,0.12)' : 'transparent', transform: `translateY(${(1 - ik) * 80}px)`}}>
                  <Ic k={ic} s={40} />
                </div>
              );
            })}
            <div style={{position: 'absolute', right: 20, fontSize: 21, opacity: 0.85}}>RU</div>
          </div>
          <svg width="40" height="56" viewBox="0 0 46 64" style={{position: 'absolute', left: cur[0], top: cur[1], transform: `scale(${pressed})`, opacity: ramp(t, 0.98, 1.06)}}>
            <path d="M0 0 L0 50 L13 39 L22 60 L31 56 L22 36 L38 35 Z" fill="#fff" stroke="#000" strokeWidth="2.5" />
          </svg>
        </div>
      )}
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
