import React, {useMemo} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Post, StudioEnv} from '../three/core';
import {GameWorld} from '../three/game';
import {M, glow} from '../three/materials';
import {roundedBox} from '../three/geometry';
import {memo} from '../three/textures';
import {E, clamp01, hash, keys, ramp, shake} from '../components/anim';
import {GlitchBars, ImpactTitle} from '../components/type';
import {FONT} from '../components/fonts';

// Кнопка питания на передней панели корпуса — макро.
const powerIcon = () =>
  memo('powerIcon', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.strokeStyle = '#fff';
    g.lineWidth = 34;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(256, 270, 140, -Math.PI / 2 + 0.62, -Math.PI / 2 - 0.62 + Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(256, 90);
    g.lineTo(256, 250);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    return t;
  });

const ShotButton: React.FC<{t: number}> = ({t}) => {
  const press = ramp(t, 0.3, 0.38, E.outCubic) * (1 - ramp(t, 0.42, 0.6, E.outCubic));
  const led = ramp(t, 0.42, 0.62, E.outExpo);
  const iconMat = useMemo(() => new THREE.MeshBasicMaterial({map: powerIcon(), transparent: true, toneMapped: false, depthWrite: false}), []);
  iconMat.color.set(new THREE.Color(COLORS.cyan).multiplyScalar(0.25 + led * 1.6));
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({toneMapped: false}), []);
  ringMat.color.set(new THREE.Color(COLORS.blue).multiplyScalar(0.05 + led * 2.2));
  const pos = keys(t, [[0, 9.5], [1.05, 7.2]], E.outCubic);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={['#030509']} />
      <StudioEnv mood="cold" intensity={0.45} />
      <ambientLight intensity={0.05} />
      <spotLight position={[-6, 8, 9]} angle={0.5} penumbra={0.8} intensity={45} distance={60} color="#dbeeff" />
      <pointLight position={[5, -4, 3]} intensity={18 * led} distance={20} color={COLORS.blue} />
      <Cam pos={[2.2, -3.4 + (1 - led) * 0.3, pos]} target={[0, 0, 0]} fov={30} roll={0.18} />
      {/* передняя панель корпуса */}
      <mesh geometry={roundedBox(14, 24, 0.6, 0.3, 0.1)} position={[0, 0, -0.3]} material={M.gunmetal()} />
      <mesh position={[0, 0, 0.01]} material={M.rubber()}>
        <ringGeometry args={[1.5, 1.72, 96]} />
      </mesh>
      <mesh position={[0, 0, 0.02]} material={ringMat}>
        <ringGeometry args={[1.52, 1.6, 96]} />
      </mesh>
      <group position={[0, 0, 0.12 - press * 0.16]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={M.buttonMetal()}>
          <cylinderGeometry args={[1.42, 1.42, 0.3, 96]} />
        </mesh>
        <mesh position={[0, 0, 0.16]} material={iconMat}>
          <planeGeometry args={[1.25, 1.25]} />
        </mesh>
      </group>
      {/* вентиляционные прорези */}
      {Array.from({length: 9}, (_, i) => (
        <mesh key={i} position={[0, -4 - i * 0.7, 0.01]} material={M.rubber()}>
          <planeGeometry args={[8, 0.22]} />
        </mesh>
      ))}
      <mesh position={[0, 4.2, 0.02]} material={glow(COLORS.blue, 0.3 + led * 1.4)}>
        <planeGeometry args={[0.6, 0.08]} />
      </mesh>
      <Post bloom={1.1} threshold={0.6} radius={0.55} />
    </ThreeCanvas>
  );
};

// Игра запускается, едет — и замирает.
const FREEZE = 0.55; // момент зависания (от начала кадра игры)
const ShotGame: React.FC<{t: number}> = ({t}) => {
  // зависание: короткое «заикание» (кадр дёргается между двумя состояниями), затем полный стоп
  const fr = Math.floor(t * 30);
  const stutter = t > FREEZE && t < FREEZE + 0.27 && fr % 4 < 2;
  const tt = stutter ? FREEZE - 0.07 : Math.min(t, FREEZE);
  const gl = t < FREEZE ? 0 : t < FREEZE + 0.3 ? 0.95 : t < FREEZE + 0.4 ? 0.35 : hash(fr) > 0.93 && t < 1.75 ? 0.4 : 0;
  const y = 40 + tt * 60 + tt * tt * 10;
  const sway = Math.sin(tt * 2.2) * 0.6;
  const glitch = t > FREEZE && t < FREEZE + 0.35 ? 1 : 0;
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <fog attach="fog" args={['#3a2440', 40, 420]} />
      <ambientLight intensity={0.25} color="#7a86c8" />
      <directionalLight position={[0, 200, 60]} intensity={1.6} color="#ff9a5c" />
      <Cam pos={[sway, y, 2.2]} target={[sway * 0.6, y + 40, 1.6]} fov={62} roll={Math.sin(tt * 1.6) * 0.04 + glitch * (hash(Math.floor(t * 30)) - 0.5) * 0.1} far={1500} />
      <GameWorld y={y} />
      <Post bloom={0.6} threshold={0.85} radius={0.5} glitch={gl} glitchSeed={fr * 0.37} />
    </ThreeCanvas>
  );
};

// HUD игры: мини-карта и спидометр без цифр-обещаний (это игровой интерфейс).
const GameHUD: React.FC<{t: number}> = ({t}) => {
  const tt = Math.min(t, FREEZE);
  const sp = clamp01(0.25 + tt * 1.1);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <g transform="translate(860 1640)" opacity={0.92}>
          <circle r="120" fill="rgba(5,8,16,0.45)" stroke="rgba(243,248,255,0.25)" strokeWidth="3" />
          <path d={describeArc(0, 0, 100, -130, -130 + 260 * sp)} stroke={COLORS.heat} strokeWidth="12" fill="none" strokeLinecap="round" />
          <text y="18" textAnchor="middle" fill={COLORS.white} fontFamily="Inter Display" fontWeight={800} fontSize="56">
            {Math.round(120 + sp * 140)}
          </text>
          <text y="56" textAnchor="middle" fill="rgba(243,248,255,0.6)" fontFamily="JetBrains Mono" fontSize="20">
            KM/H
          </text>
        </g>
        <g transform="translate(200 1650)" opacity={0.9}>
          <circle r="110" fill="rgba(5,8,16,0.45)" stroke="rgba(243,248,255,0.25)" strokeWidth="3" />
          <path d="M-20 90 C -10 20, 30 0, 10 -90" stroke="rgba(243,248,255,0.55)" strokeWidth="10" fill="none" />
          <circle cx="-14" cy="50" r="9" fill={COLORS.cyan} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
function describeArc(x: number, y: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [x + r * Math.cos(((a - 90) * Math.PI) / 180), y + r * Math.sin(((a - 90) * Math.PI) / 180)];
  const [sx, sy] = p(a0);
  const [ex, ey] = p(a1);
  return `M ${sx} ${sy} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${ex} ${ey}`;
}

// Субпиксели LCD при «проваливании» в экран.
const Subpixels: React.FC<{k: number}> = ({k}) => {
  if (k <= 0.01) return null;
  const cell = 6 + k * 60;
  return (
    <AbsoluteFill
      style={{
        opacity: clamp01(k * 1.6) * 0.45,
        mixBlendMode: 'multiply',
        backgroundImage: `linear-gradient(90deg, #ff4060 0 30%, #000 30% 34%, #40ff70 34% 64%, #000 64% 68%, #4080ff 68% 98%, #000 98%), linear-gradient(0deg, #000 0 8%, transparent 8%)`,
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: 'center',
      }}
    />
  );
};

export const S01Hook: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const G0 = 1.05; // начало кадра с игрой
  const freezeAt = G0 + FREEZE;
  const titleAt = freezeAt + 0.3; // 1.9 с: после обрыва звука — удар
  // проваливание в экран
  const push = ramp(t, 2.85, dur, E.inExpo);
  const scale = 1 + push * 14;
  const glitch = t > freezeAt && t < freezeAt + 0.32 ? 1 : 0;
  const [sx, sy] = shake(t, titleAt, 16, 8);
  const gx = glitch ? (hash(Math.floor(t * 30)) - 0.5) * 60 : 0;
  const freezeTint = ramp(t, freezeAt, freezeAt + 0.4);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Sequence durationInFrames={Math.round(G0 * FPS)} layout="none">
        <AbsoluteFill style={{opacity: ramp(t, 0.05, 0.3)}}>
          <ShotButton t={t} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={Math.round(G0 * FPS)} layout="none">
        <AbsoluteFill style={{transform: `translate(${sx + gx}px, ${sy}px) scale(${scale})`, filter: `saturate(${1 - freezeTint * 0.55}) brightness(${1 - freezeTint * 0.25})`}}>
          <ShotGame t={t - G0} />
          <GameHUD t={t - G0} />
          <Subpixels k={ramp(t, 3.0, dur, E.inCubic)} />
        </AbsoluteFill>
        {/* курсор-ожидание поверх зависшей игры */}
        {t > freezeAt + 0.3 && t < 2.95 && (
          <div style={{position: 'absolute', left: 520, top: 1060, width: 64, height: 64}}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="24" stroke="rgba(243,248,255,0.25)" strokeWidth="6" fill="none" />
              <path d="M32 8 A24 24 0 0 1 56 32" stroke={COLORS.white} strokeWidth="6" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <GlitchBars t={t} amount={glitch * 0.45} seed={9} />
        <ImpactTitle text={TEXT.hook.replace(' ТОРМОЗИТ', '\nТОРМОЗИТ')} t={t} at={titleAt} out={2.85} y={540} size={136} glow={COLORS.heat} rgbSplit exit="blur" />
        {/* «сигнал» — тонкая подпись */}
        {t > titleAt + 0.4 && t < 2.85 && (
          <div style={{position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 44, letterSpacing: '0.28em', color: COLORS.heat, textShadow: '0 0 20px rgba(255,118,59,0.6)', opacity: (1 - ramp(t, 2.6, 2.85)) * ramp(t, titleAt + 0.4, titleAt + 0.6)}}>
            ● НЕ ОТВЕЧАЕТ
          </div>
        )}
      </Sequence>
      {/* вспышка в конце проваливания */}
      <AbsoluteFill style={{background: COLORS.cyan, opacity: ramp(t, dur - 0.12, dur, E.inCubic) * 0.85, mixBlendMode: 'screen'}} />
      {/* затемнение-фронт ДО включения */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - ramp(t, 0.0, 0.18)}} />
    </AbsoluteFill>
  );
};
