import React, {useMemo} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, TracePulses, V3} from '../three/core';
import {ANCH, CPU, Motherboard, RamStick, TowerCooler} from '../three/parts';
import {M, glow} from '../three/materials';
import {dustDenseTexture} from '../three/textures';
import {roundedBox} from '../three/geometry';
import {Rig} from './S02Problem';
import {E, clamp01, keys, keys3, lerp, ramp, shake} from '../components/anim';
import {FONT} from '../components/fonts';
import {ImpactTitle, RevealTitle} from '../components/type';

// Монтаж сцены (сек от начала). Те же моменты использует саунд-дизайн (audio/sfx.py → COOLING).
export const COOL = {diagEnd: 2.7, airStart: 3.95, pasteStart: 5.1, installStart: 6.7, seat: 7.15};
const CPUP: V3 = [ANCH.cpu[0], ANCH.cpu[1], 0];
const CPU_Z = 0.47;

// Светящийся контур узла (рамка из тонких брусков — читается на телефоне лучше, чем линия в 1 px).
const Outline: React.FC<{c: V3; s: V3; color: string; k: number}> = ({c, s, color, k}) => {
  if (k <= 0.01) return null;
  const m = glow(color, 0.4 + k * 1.4);
  const th = 0.09;
  const [sx, sy, sz] = s;
  const edges: [V3, V3][] = [];
  for (const y of [-sy / 2, sy / 2]) for (const z of [-sz / 2, sz / 2]) edges.push([[0, y, z], [sx, th, th]]);
  for (const x of [-sx / 2, sx / 2]) for (const z of [-sz / 2, sz / 2]) edges.push([[x, 0, z], [th, sy, th]]);
  for (const x of [-sx / 2, sx / 2]) for (const y of [-sy / 2, sy / 2]) edges.push([[x, y, 0], [th, th, sz]]);
  return (
    <group position={c}>
      {edges.map(([p, b], i) => (
        <mesh key={i} position={p} material={m}>
          <boxGeometry args={b} />
        </mesh>
      ))}
    </group>
  );
};

// --- A. Диагностика: холодный свет, скан снизу вверх, контуры узлов, сигналы по дорожкам ------
const SCAN = [0.3, 1.6];
const scanY = (t: number) => lerp(-17, 17, ramp(t, SCAN[0], SCAN[1], E.inOutSine));
// момент, когда скан проходит координату y (обратная функция к inOutSine)
const scannedAt = (y: number) => SCAN[0] + ((SCAN[1] - SCAN[0]) * Math.acos(1 - 2 * clamp01((y + 17) / 34))) / Math.PI;
const NODES: {c: V3; s: V3; warn?: boolean}[] = [
  {c: [ANCH.m2[0], ANCH.m2[1], 0.4], s: [9.4, 3.0, 0.8]},
  {c: [7.4, ANCH.dimmY, 2.6], s: [3.8, 14.4, 4.6]},
  {c: [-1.9, 13.4, 1.5], s: [10.2, 2.4, 2.6]},
  {c: [CPUP[0] + 0.6, CPUP[1], 8.6], s: [7.8, 13.0, 16.8], warn: true},
];
const ShotDiag: React.FC<{t: number}> = ({t}) => {
  const pos = keys3(t, [[0, [27, -42, 50]], [COOL.diagEnd, [20, -35, 43]]], E.inOutSine);
  const y = scanY(t);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={['#081221']} />
      <fog attach="fog" args={['#081221', 40, 110]} />
      <StudioEnv mood="cold" intensity={1.3} />
      <ambientLight intensity={0.25} color="#cfe6ff" />
      <hemisphereLight args={['#bfe3ff', '#0b1220', 1.1]} position={[0, 0, 1]} />
      <directionalLight position={[-14, -16, 34]} intensity={2.4} color="#e6f4ff" />
      <spotLight position={[12, -24, 46]} angle={0.55} penumbra={0.9} intensity={1400} distance={140} color="#dff1ff" />
      <pointLight position={[-20, 10, 20]} intensity={260} distance={90} color={COLORS.blue} />
      <Cam pos={pos} target={[1, 6, 4]} fov={36} />
      <Rig t={t} dust={1} heat={0.35} fanSpeed={1.6} blur={0.4} pulses={1} pulseColor={COLORS.cyan} accent={COLORS.blue} />
      <TracePulses t={t * 1.3 + 3} color={COLORS.cyan} count={80} speed={8} opacity={0.9} />
      {/* сканирующий световой лист и яркая кромка */}
      <mesh position={[0, y, 9]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 20]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.05 * (1 - ramp(t, SCAN[1], SCAN[1] + 0.3))} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, y, 0.2]} material={glow(COLORS.cyan, 2.2)}>
        <boxGeometry args={[26, 0.1, 0.1]} />
      </mesh>
      {NODES.map((n, i) => {
        const ta = scannedAt(n.c[1]);
        const k = ramp(t, ta - 0.05, ta + 0.2, E.outCubic);
        return <Outline key={i} c={n.c} s={n.s} color={n.warn ? COLORS.heat : COLORS.cyan} k={k * (n.warn ? 1 : 0.8)} />;
      })}
      <Post bloom={0.9} threshold={0.72} radius={0.5} />
    </ThreeCanvas>
  );
};

// Итог диагностики: спокойная карточка без лишних цифр — понятно, что найдена причина.
const DiagPanel: React.FC<{t: number}> = ({t}) => {
  const k = ramp(t, 0.45, 0.8, E.outExpo) * (1 - ramp(t, COOL.diagEnd - 0.25, COOL.diagEnd, E.inCubic));
  if (k <= 0.01) return null;
  const rows = [
    {n: 'Накопитель', v: 'норма', at: 0.8},
    {n: 'Память', v: 'норма', at: 1.0},
    {n: 'Процессор', v: 'норма', at: 1.2},
    {n: 'Охлаждение', v: 'перегрев', at: 1.4, warn: true},
  ];
  return (
    <div style={{position: 'absolute', left: 90, right: 90, top: 905, padding: '26px 34px 24px', borderRadius: 30, background: 'rgba(8,18,33,0.84)', border: '1.5px solid rgba(103,232,255,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 50px rgba(33,191,255,0.15)', opacity: k, transform: `translateY(${(1 - k) * 30}px)`, fontFamily: FONT.text, color: COLORS.white}}>
      <div style={{fontFamily: FONT.mono, fontWeight: 700, fontSize: 30, letterSpacing: '0.18em', color: COLORS.cyan, marginBottom: 14}}>РЕЗУЛЬТАТ ДИАГНОСТИКИ</div>
      {rows.map((r) => {
        const rk = ramp(t, r.at, r.at + 0.25, E.outExpo);
        return (
          <div key={r.n} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 58, opacity: rk, transform: `translateX(${(1 - rk) * 40}px)`, borderTop: '1px solid rgba(243,248,255,0.08)'}}>
            <span style={{fontSize: 40, fontWeight: 600}}>{r.n}</span>
            <span style={{fontSize: 38, fontWeight: 800, color: r.warn ? COLORS.heat : COLORS.lime}}>{r.warn ? '▲ ' : '✓ '}{r.v}</span>
          </div>
        );
      })}
      <div style={{marginTop: 12, fontFamily: FONT.mono, fontWeight: 700, fontSize: 29, letterSpacing: '0.06em', color: COLORS.heat, opacity: ramp(t, 1.7, 1.95)}}>ПРИЧИНА: ПЫЛЬ И СТАРАЯ ТЕРМОПАСТА</div>
    </div>
  );
};

// --- B. Макро: радиатор в пыли → продувка сжатым воздухом ------------------------------------
const STRIPS = 14;
// Насадка баллона со сжатым воздухом: трубка идёт по диагонали кадра к кромкам рёбер.
const NOZZLE_DIR = new THREE.Vector3(0.45, 0.62, 0.64).normalize();
const AirNozzle: React.FC<{p: V3}> = ({p}) => {
  const rot = useMemo(() => new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), NOZZLE_DIR)), []);
  return (
    <group position={p} rotation={rot}>
      <mesh position={[2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 4.4, 16]} />
        <meshStandardMaterial color="#c8322b" roughness={0.35} />
      </mesh>
      <mesh position={[4.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={M.plasticGray()}>
        <cylinderGeometry args={[0.36, 0.45, 1.4, 24]} />
      </mesh>
    </group>
  );
};
const ShotRadiator: React.FC<{t: number}> = ({t}) => {
  const air = COOL.airStart - COOL.diagEnd;
  const nozZ = keys(t, [[air - 0.2, 17], [air + 0.1, 14.8], [air + 1.0, 5.0]], E.inOutSine);
  const nozOn = t > air - 0.2;
  const fx = CPUP[0] + 2.5;
  const cool = ramp(t, air + 0.3, air + 1.2);
  const heat = 0.3 - 0.22 * cool;
  // камера ведёт насадку: смотрим почти в лоб на входную сторону рёбер, где лежит пыль
  const follow = t < air - 0.2 ? keys(t, [[0, 13.5], [air - 0.2, 14.4]], E.inOutSine) : Math.max(7, Math.min(14.4, nozZ - 0.3));
  const pos: V3 = [fx + keys(t, [[0, 8.8], [2.4, 7.4]]), keys(t, [[0, 3.6], [2.4, 5.6]]), follow + 1.4];
  const tgt: V3 = [fx, 7.6, follow];
  const focus = Math.hypot(pos[0] - fx, pos[1] - tgt[1], pos[2] - tgt[2]);
  const strips = useMemo(
    () => Array.from({length: STRIPS}, () => new THREE.MeshStandardMaterial({color: '#a89d90', roughness: 1, alphaMap: dustDenseTexture(), transparent: true, depthWrite: false})),
    []
  );
  const z0 = CPU_Z + 3.7;
  const z1 = CPU_Z + 15.6;
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={['#0a0705']} />
      <fog attach="fog" args={['#0a0705', 14, 50]} />
      <StudioEnv mood="studio" intensity={0.8} />
      <ambientLight intensity={0.1} />
      {/* скользящий направленный свет вдоль кромок рёбер */}
      <directionalLight position={[fx + 3, 7.6, 30]} intensity={2.6} color="#fff1e2" />
      <pointLight position={[fx + 6, 16, 10]} intensity={80} distance={40} color={cool > 0.5 ? '#dff2ff' : '#ffc9a0'} />
      <pointLight position={[fx - 3, 7.6, 10]} intensity={45 * (0.3 + heat)} distance={30} color="#ff6a2a" />
      <Cam pos={pos} target={tgt} fov={32} near={0.05} up={[0, 0, 1]} />
      <Motherboard accent={COLORS.blue} accentK={0.3} />
      <group position={[CPUP[0], CPUP[1], 0.02]}>
        <CPU paste="old" />
      </group>
      {[6.2, 8.6].map((x) => (
        <group key={x} position={[x, ANCH.dimmY, 0.85]}>
          <RamStick light="#ff8a4a" lightK={0.4} />
        </group>
      ))}
      <group position={[CPUP[0], CPUP[1], CPU_Z]}>
        <TowerCooler fanAngle={0} dust={0} heat={heat * 0.4} fan={false} />
      </group>
      {/* слой пыли на входной стороне рёбер — уходит полосами за насадкой */}
      {strips.map((m, i) => {
        const zc = lerp(z0, z1, (i + 0.5) / STRIPS);
        const cleared = nozOn ? ramp(nozZ, zc + 0.9, zc - 0.3) : 0;
        m.opacity = 0.95 * (1 - cleared);
        if (m.opacity < 0.01) return null;
        return (
          <mesh key={i} material={m} position={[fx + 0.04, CPUP[1], zc]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[(z1 - z0) / STRIPS + 0.02, 12]} />
          </mesh>
        );
      })}
      {nozOn && <AirNozzle p={[fx + 0.35, CPUP[1] - 0.6, nozZ]} />}
      {/* облачко пыли, выдуваемое воздухом */}
      {nozOn && t > air && <Particles t={t * 2} count={220} box={[[fx + 0.2, CPUP[1] - 6, nozZ - 1.2], [fx + 6, CPUP[1] + 6, nozZ + 1.5]]} color="#d8cbbb" size={0.12} drift={[4, 1.5, 0.8]} opacity={0.7 * (1 - ramp(t, 2.25, 2.4))} seed={31} />}
      <Particles t={t} count={120} box={[[-6, 0, 2], [8, 14, 20]]} color="#ff9a5c" size={0.14} drift={[0, 0, 2.2]} opacity={0.45 * heat} seed={8} />
      <Post bloom={0.55} threshold={0.85} radius={0.45} focus={focus} aperture={0.0018} maxblur={0.009} />
    </ThreeCanvas>
  );
};

// --- C. Макро: старая паста стирается, наносится новая «горошина» ---------------------------
const Syringe: React.FC<{z: number}> = ({z}) => (
  <group position={[CPUP[0], CPUP[1], z]} rotation={[0.22, 0, 0]}>
    <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
      <cylinderGeometry args={[0.06, 0.14, 0.9, 16]} />
    </mesh>
    <mesh position={[0, 0, 4.9]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.45, 0.45, 8, 32]} />
      <meshPhysicalMaterial color="#c9d4de" transparent opacity={0.3} roughness={0.12} clearcoat={1} />
    </mesh>
    <mesh position={[0, 0, 3.4]} rotation={[Math.PI / 2, 0, 0]} material={M.newPaste()}>
      <cylinderGeometry args={[0.36, 0.36, 5, 32]} />
    </mesh>
  </group>
);
const WipePad: React.FC<{x: number; z: number}> = ({x, z}) => (
  // безворсовая салфетка с изопропиловым спиртом
  <mesh position={[CPUP[0] + x, CPUP[1], z]} rotation={[0.05, 0.12, 0.1]} geometry={roundedBox(1.9, 2.6, 0.22, 0.35, 0.08)}>
    <meshStandardMaterial color="#e9edf1" roughness={1} />
  </mesh>
);
const ShotPaste: React.FC<{t: number}> = ({t}) => {
  const wipe = ramp(t, 0.18, 0.55, E.inOutSine);
  const padX = lerp(-3.2, 3.6, wipe);
  const padZ = t < 0.12 || t > 0.62 ? 6 : 0.6;
  const amount = ramp(t, 0.78, 1.15, E.outCubic);
  const syrZ = keys(t, [[0.55, 12], [0.75, 1.0], [1.15, 1.0], [1.45, 12]], E.inOutCubic);
  const pos = keys3(t, [[0, [3.6, 2.4, 7.4]], [1.6, [2.6, 3.8, 5.8]]], E.inOutSine);
  const tgt: V3 = [CPUP[0], CPUP[1], 0.5];
  const focus = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={['#06080c']} />
      <StudioEnv mood="studio" intensity={1.0} />
      <ambientLight intensity={0.12} />
      <pointLight position={[CPUP[0] - 4, CPUP[1] + 5, 6]} intensity={40} distance={30} color="#fff4e8" />
      <pointLight position={[CPUP[0] + 5, CPUP[1] - 2, 4]} intensity={18} distance={30} color="#dfeeff" />
      <Cam pos={pos} target={tgt} fov={30} near={0.05} />
      <Motherboard accent={COLORS.blue} accentK={0.5} />
      <group position={[CPUP[0], CPUP[1], 0.02]}>
        <CPU paste={amount > 0 ? 'new' : 'old'} wipe={wipe} pasteAmount={amount} />
      </group>
      {t < 0.66 && <WipePad x={padX} z={padZ} />}
      {t > 0.5 && t < 1.5 && <Syringe z={syrZ} />}
      <Post bloom={0.3} threshold={0.95} radius={0.4} focus={focus} aperture={0.003} maxblur={0.012} />
    </ThreeCanvas>
  );
};

// --- D. Установка кулера: камера вдоль трубок, контакт, вентилятор раскручивается, холодный свет ---
const ShotInstall: React.FC<{t: number}> = ({t}) => {
  const seat = COOL.seat - COOL.installStart;
  const lift = (1 - ramp(t, 0, seat, E.outCubic)) * 13;
  // вентилятор раскручивается после установки (угол = интеграл скорости)
  const sMax = 1.3;
  const u = Math.max(0, t - seat - 0.05);
  const ang = u < 0.5 ? (sMax * u * u) / (2 * 0.5) : sMax * (0.25 + (u - 0.5));
  const cool = ramp(t, seat, seat + 0.5);
  const pos = keys3(t, [[0, [24, -14, 30]], [seat, [19, -10, 14]], [1.3, [24, -5, 15]]], E.inOutSine);
  const tgt = keys3(t, [[0, [0, 7.6, 15]], [seat, [1, 7.6, 6]], [1.3, [3, 7.6, 9]]], E.inOutSine);
  const [sx, sy] = shake(t, seat, 0.12, 12, 40);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
      <color attach="background" args={[cool > 0.5 ? '#040a14' : '#0a0706']} />
      <fog attach="fog" args={[cool > 0.5 ? '#040a14' : '#0a0706', 22, 70]} />
      <StudioEnv mood={cool > 0.5 ? 'cold' : 'hot'} intensity={1.3} />
      <ambientLight intensity={0.14} />
      <directionalLight position={[-10, -12, 30]} intensity={2.4} color="#eaf4ff" />
      <directionalLight position={[20, -10, 10]} intensity={0.9} color="#ffffff" />
      <pointLight position={[-4, 7.6, 18]} intensity={110 * (1 - cool)} distance={60} color="#ff6a2a" />
      <pointLight position={[-4, 7.6, 18]} intensity={150 * cool} distance={60} color={COLORS.blue} />
      <pointLight position={[14, 4, 16]} intensity={120 * cool} distance={60} color={COLORS.cyan} />
      <Cam pos={[pos[0] + sx, pos[1] + sy, pos[2]]} target={tgt} fov={34} />
      <Rig t={t} dust={0} heat={0} fanSpeed={0} rpmPhase={ang * Math.PI * 2} blur={clamp01(u * 0.8) * 0.35} paste="new" pasteAmount={1} coolerLift={lift} accent={COLORS.blue} coolerLed={cool > 0.3 ? COLORS.cyan : null} pulses={cool * 0.8} pulseColor={COLORS.cyan} />
      <Particles t={t} count={100} box={[[-4, -4, 2], [26, 20, 20]]} color={COLORS.cyan} size={0.16} drift={[-1.5, 0, 0.4]} opacity={0.4 * cool} seed={44} />
      <Post bloom={0.9} threshold={0.68} radius={0.55} />
    </ThreeCanvas>
  );
};

export const S04Cooling: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const {diagEnd, airStart, pasteStart, installStart, seat} = COOL;
  const wave = t > seat ? Math.exp(-(t - seat) * 4) : 0;
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <Sequence durationInFrames={Math.round(diagEnd * FPS)} layout="none">
        <ShotDiag t={t} />
        <DiagPanel t={t} />
      </Sequence>
      <Sequence from={Math.round(diagEnd * FPS)} durationInFrames={Math.round((pasteStart - diagEnd) * FPS)} layout="none">
        <ShotRadiator t={t - diagEnd} />
      </Sequence>
      <Sequence from={Math.round(pasteStart * FPS)} durationInFrames={Math.round((installStart - pasteStart) * FPS)} layout="none">
        <ShotPaste t={t - pasteStart} />
      </Sequence>
      <Sequence from={Math.round(installStart * FPS)} layout="none">
        <ShotInstall t={t - installStart} />
      </Sequence>
      {/* холодная волна в момент установки кулера */}
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 55%, rgba(33,191,255,${0.4 * wave}) 0%, rgba(0,0,0,0) 65%)`, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.2)}} />
      <RevealTitle text="ДИАГНОСТИКА" t={t} at={0.2} out={diagEnd - 0.25} y={290} size={118} color={COLORS.white} glow={COLORS.cyan} weight={900} tracking={0.03} />
      {t > diagEnd + 0.1 && t < airStart + 0.1 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', opacity: ramp(t, diagEnd + 0.15, diagEnd + 0.4) * (1 - ramp(t, airStart - 0.15, airStart + 0.05)), textShadow: '0 0 24px rgba(255,118,59,0.5), 0 2px 12px rgba(0,0,0,0.8)'}}>
          <div style={{fontFamily: FONT.display, fontWeight: 900, fontSize: 96, letterSpacing: '0.02em', color: '#FFE3D4'}}>ПЕРЕГРЕВ</div>
          <div style={{marginTop: 10, fontFamily: FONT.mono, fontWeight: 700, fontSize: 36, letterSpacing: '0.18em', color: COLORS.heat}}>▲ ПЫЛЬ В РАДИАТОРЕ</div>
        </div>
      )}
      <ImpactTitle text={'ЧИСТКА\nИ ОХЛАЖДЕНИЕ'} t={t} at={airStart} out={dur - 0.3} y={265} size={116} glow={COLORS.blue} exit="blur" />
      {t > pasteStart + 0.9 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 545, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 40, letterSpacing: '0.2em', color: COLORS.lime, opacity: ramp(t, pasteStart + 0.9, pasteStart + 1.2) * (1 - ramp(t, dur - 0.3, dur)), textShadow: '0 0 20px rgba(180,255,89,0.4), 0 2px 12px rgba(0,0,0,0.8)'}}>
          ✓ НОВАЯ ТЕРМОПАСТА
        </div>
      )}
    </AbsoluteFill>
  );
};
