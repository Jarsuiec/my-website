import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, V3} from '../three/core';
import {ANCH} from '../three/parts';
import {M} from '../three/materials';
import {project} from '../three/project';
import {Rig} from './S02Problem';
import {E, keys, keys3, lerp, ramp, shake} from '../components/anim';
import {FONT} from '../components/fonts';
import {ImpactTitle, RevealTitle} from '../components/type';

const CPU: V3 = [ANCH.cpu[0], ANCH.cpu[1], 0];

// --- A. Диагностика: скан платы, метки на узлах ------------------------------------------
const diagCam = (t: number) => ({
  pos: keys3(t, [[0, [30, -50, 60]], [2.0, [22, -44, 54]]], E.inOutSine),
  target: [1, 9, 4] as V3,
  fov: 36,
});
const ShotDiag: React.FC<{t: number}> = ({t}) => {
  const c = diagCam(t);
  const scanY = lerp(-18, 18, ramp(t, 0.15, 1.6, E.inOutSine));
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={[COLORS.bg]} />
      <fog attach="fog" args={[COLORS.bg, 30, 90]} />
      <StudioEnv mood="neutral" intensity={1.1} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#cfe6ff', '#0a0f18', 0.6]} position={[0, 0, 1]} />
      <directionalLight position={[-14, -10, 30]} intensity={2.2} color="#e4f2ff" />
      <spotLight position={[10, -20, 50]} angle={0.5} penumbra={0.9} intensity={900} distance={120} color="#ffffff" />
      <pointLight position={[2, 7.6, 22]} intensity={60} distance={60} color="#ff6a2a" />
      <Cam pos={c.pos} target={c.target} fov={c.fov} />
      <Rig t={t} dust={1} heat={0.55} fanSpeed={1.6} blur={0.4} />
      {/* плоскость сканирования */}
      <mesh position={[0, scanY, 9]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 20]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh position={[0, scanY, 0.15]}>
        <boxGeometry args={[26, 0.08, 0.08]} />
        <meshBasicMaterial color={COLORS.cyan} toneMapped={false} />
      </mesh>
      <Post bloom={0.9} threshold={0.7} radius={0.5} />
    </ThreeCanvas>
  );
};
const DiagHUD: React.FC<{t: number}> = ({t}) => {
  const c = diagCam(t);
  const tags: {p: V3; label: string; at: number; warn?: boolean}[] = [
    {p: [CPU[0] + 2.5, CPU[1], 16], label: 'КУЛЕР CPU', at: 0.35, warn: true},
    {p: [7.4, 12.5, 4], label: 'ПАМЯТЬ', at: 0.6},
    {p: [-6.5, -1, 1], label: 'PCIe', at: 0.85},
    {p: [ANCH.m2[0], ANCH.m2[1], 0.6], label: 'НАКОПИТЕЛЬ', at: 1.05},
  ];
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {tags.map((g, i) => {
        if (t < g.at) return null;
        const k = ramp(t, g.at, g.at + 0.3, E.outExpo);
        const [x, y] = project(g.p, c.pos, c.target, c.fov);
        const dx = x > W / 2 ? -1 : 1;
        const lx = x + dx * 120 * k;
        const ly = Math.max(y - 70 * k, 500); // не залезать на заголовок
        const col = g.warn ? COLORS.heat : COLORS.cyan;
        return (
          <g key={i} opacity={k}>
            <circle cx={x} cy={y} r={10} fill="none" stroke={col} strokeWidth={3} />
            <circle cx={x} cy={y} r={4} fill={col} />
            <polyline points={`${x},${y} ${x + dx * 40 * k},${ly} ${lx},${ly}`} fill="none" stroke={col} strokeWidth={2.5} />
            <text x={lx + dx * 12} y={ly + 10} textAnchor={dx > 0 ? 'start' : 'end'} fill={col} fontFamily="JetBrains Mono" fontWeight={700} fontSize={30} letterSpacing="2">
              {g.label}
            </text>
            {g.warn && (
              <text x={lx + dx * 12} y={ly + 48} textAnchor={dx > 0 ? 'start' : 'end'} fill={COLORS.white} fontFamily="JetBrains Mono" fontSize={24} opacity={0.85}>
                ПЕРЕГРЕВ · ПЫЛЬ
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// --- B. Чистка и новая термопаста --------------------------------------------------------
const Syringe: React.FC<{z: number}> = ({z}) => (
  <group position={[CPU[0], CPU[1], z]} rotation={[0.25, 0, 0]}>
    <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
      <cylinderGeometry args={[0.07, 0.16, 0.9, 16]} />
    </mesh>
    <mesh position={[0, 0, 4.9]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.45, 0.45, 8, 32]} />
      <meshPhysicalMaterial color="#c9d4de" transparent opacity={0.35} roughness={0.15} clearcoat={1} />
    </mesh>
    <mesh position={[0, 0, 3.4]} rotation={[Math.PI / 2, 0, 0]} material={M.newPaste()}>
      <cylinderGeometry args={[0.36, 0.36, 5, 32]} />
    </mesh>
  </group>
);

const ShotClean: React.FC<{t: number}> = ({t}) => {
  // 0.0–0.5 продувка пыли · 0.5–1.0 кулер снят · 1.0–1.4 старая паста стёрта · 1.4–1.9 новая капля · 1.9–2.5 кулер на место
  const dust = 1 - ramp(t, 0.05, 0.55, E.inOutCubic);
  const lift = ramp(t, 0.55, 1.0, E.inOutCubic) * (1 - ramp(t, 1.95, 2.45, E.inOutCubic)) * 26;
  const wipe = ramp(t, 1.0, 1.35, E.inOutCubic);
  const paste = t < 1.4 ? 'old' : 'new';
  const amount = ramp(t, 1.5, 1.85, E.outCubic);
  const syringeZ = keys(t, [[1.3, 14], [1.5, 1.05], [1.85, 1.05], [2.0, 14]], E.inOutCubic);
  const cool = ramp(t, 1.0, 2.5, E.inOutSine);
  const heat = 0.6 * (1 - cool);
  const pos = keys3(
    t,
    [
      [0, [16, -3, 13]],
      [0.6, [14, -7, 16]],
      [1.05, [6.5, 0.5, 10]],
      [1.9, [6.0, 1.5, 9.5]],
      [2.5, [17, -6, 15]],
    ],
    E.inOutCubic
  );
  const tgt = keys3(
    t,
    [
      [0, [3.5, 7.4, 9.5]],
      [0.6, [2, 7.6, 8]],
      [1.05, [0, 7.6, 0.6]],
      [1.9, [0, 7.6, 0.8]],
      [2.5, [2, 7.6, 7]],
    ],
    E.inOutCubic
  );
  const [sx, sy] = shake(t, 2.45, 0.2, 9, 40);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={[cool > 0.5 ? '#050a12' : '#090706']} />
      <fog attach="fog" args={['#060810', 22, 70]} />
      <StudioEnv mood={cool > 0.5 ? 'cold' : 'hot'} intensity={0.9} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[-10, -12, 30]} intensity={0.9} color="#eaf4ff" />
      <pointLight position={[-4, 7.6, 18]} intensity={120 * (1 - cool)} distance={60} color="#ff6a2a" />
      <pointLight position={[-4, 7.6, 18]} intensity={140 * cool} distance={60} color={COLORS.blue} />
      <spotLight position={[6, 0, 20]} angle={0.4} penumbra={0.9} intensity={300} distance={60} color="#ffffff" />
      <Cam pos={[pos[0] + sx, pos[1] + sy, pos[2]]} target={tgt} fov={34} />
      <Rig t={t + 4} dust={dust} heat={heat} fanSpeed={1.0} blur={0.2} paste={paste} wipe={wipe} pasteAmount={amount} coolerLift={lift} accent={COLORS.blue} pulses={cool * 0.6} pulseColor={COLORS.cyan} />
      {t > 1.25 && t < 2.05 && <Syringe z={syringeZ} />}
      {/* пыль, сдуваемая воздухом */}
      <Particles t={t} count={260} box={[[0, -2, 2], [30, 18, 18]]} color="#c9bfb2" size={0.22} drift={[16, -3, 2]} opacity={0.8 * (ramp(t, 0.05, 0.15) - ramp(t, 0.5, 0.75))} seed={31} />
      <Post bloom={0.8} threshold={0.75} radius={0.5} />
    </ThreeCanvas>
  );
};

// --- C. Чистый, холодный результат --------------------------------------------------------
const ShotResult: React.FC<{t: number}> = ({t}) => {
  const pos = keys3(t, [[0, [36, -4, 18]], [2.5, [30, 18, 20]]], E.inOutSine);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={['#040912']} />
      <fog attach="fog" args={['#040912', 24, 80]} />
      <StudioEnv mood="cold" intensity={1.1} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[-10, -12, 30]} intensity={0.8} color="#eaf4ff" />
      <pointLight position={[14, 4, 18]} intensity={140} distance={60} color={COLORS.cyan} />
      <pointLight position={[-6, 12, 16]} intensity={160} distance={60} color={COLORS.blue} />
      <Cam pos={pos} target={[2, 7.6, 9]} fov={34} />
      <Rig t={t} dust={0} heat={0} fanSpeed={1.2} blur={0.35} paste="new" pasteAmount={1} accent={COLORS.blue} coolerLed={COLORS.cyan} pulses={0.8} pulseColor={COLORS.cyan} />
      <Particles t={t} count={120} box={[[-4, -4, 2], [26, 20, 20]]} color={COLORS.cyan} size={0.18} drift={[-1.5, 0, 0.4]} opacity={0.4} seed={44} />
      <Post bloom={1.0} threshold={0.65} radius={0.55} />
    </ThreeCanvas>
  );
};

export const S04Cooling: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const A = 2.0;
  const B = A + 2.5;
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <Sequence durationInFrames={Math.round(A * FPS)} layout="none">
        <ShotDiag t={t} />
        <DiagHUD t={t} />
      </Sequence>
      <Sequence from={Math.round(A * FPS)} durationInFrames={Math.round((B - A) * FPS)} layout="none">
        <ShotClean t={t - A} />
      </Sequence>
      <Sequence from={Math.round(B * FPS)} layout="none">
        <ShotResult t={t - B} />
      </Sequence>
      {/* холодная волна в момент установки кулера */}
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, rgba(33,191,255,${0.35 * Math.exp(-Math.max(0, t - (A + 2.45)) * 5) * (t > A + 2.45 ? 1 : 0)}) 0%, rgba(0,0,0,0) 65%)`, mixBlendMode: 'screen'}} />
      {/* вход: короткий световой переход из логотипа */}
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.25)}} />
      <RevealTitle text={TEXT.diagnostics} t={t} at={0.2} out={A - 0.25} y={300} size={104} color={COLORS.white} glow={COLORS.cyan} weight={900} tracking={0.04} />
      <ImpactTitle text={'ЧИСТКА\nИ ОХЛАЖДЕНИЕ'} t={t} at={A + 0.1} out={dur - 0.3} y={270} size={112} glow={COLORS.blue} exit="blur" />
      {t > B && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 568, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 32, letterSpacing: '0.3em', color: COLORS.lime, opacity: ramp(t, B + 0.2, B + 0.5) * (1 - ramp(t, dur - 0.3, dur))}}>
          ✓ НОВАЯ ТЕРМОПАСТА
        </div>
      )}
    </AbsoluteFill>
  );
};
