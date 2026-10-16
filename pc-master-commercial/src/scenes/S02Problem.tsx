import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, TracePulses} from '../three/core';
import {ANCH, CPU, HDD, Motherboard, RamStick, TowerCooler} from '../three/parts';
import {E, hash, keys, keys3, ramp, shake} from '../components/anim';
import {GlitchBars, ImpactTitle} from '../components/type';
import {FONT} from '../components/fonts';

const CPU_Z = 0.47;
// Компьютер «как есть»: пыльный кулер, перегрев.
export const Rig: React.FC<{t: number; dust: number; heat: number; fanSpeed: number; blur: number; wobble?: number; accent?: string; pulses?: number; pulseColor?: string; paste?: 'old' | 'new' | 'clean' | 'none'; pasteAmount?: number; wipe?: number; coolerLift?: number; coolerLed?: string | null; rpmPhase?: number}> = ({
  t,
  dust,
  heat,
  fanSpeed,
  blur,
  wobble = 0,
  accent = '#21BFFF',
  pulses = 0,
  pulseColor = COLORS.heat,
  paste = 'old',
  pasteAmount = 0,
  wipe = 0,
  coolerLift = 0,
  coolerLed = null,
  rpmPhase = 0,
}) => {
  const ang = -(t * fanSpeed * Math.PI * 2 + rpmPhase);
  return (
    <group>
      <Motherboard accent={accent} accentK={heat > 0.5 ? 0.6 : 1.6} />
      <TracePulses t={t} color={pulseColor} opacity={pulses} count={70} />
      <group position={[ANCH.cpu[0], ANCH.cpu[1], 0.02]}>
        <CPU paste={paste} pasteAmount={pasteAmount} wipe={wipe} />
      </group>
      {[6.2, 8.6].map((x, i) => (
        <group key={i} position={[x, ANCH.dimmY, 0.85]}>
          <RamStick light={heat > 0.5 || dust > 0.5 ? '#ff8a4a' : accent} lightK={heat > 0.5 || dust > 0.5 ? 0.5 : 2.0} />
        </group>
      ))}
      <group position={[ANCH.cpu[0], ANCH.cpu[1], CPU_Z + coolerLift]} rotation={[wobble * Math.sin(t * 41) * 0.004, wobble * Math.cos(t * 37) * 0.004, 0]}>
        <TowerCooler fanAngle={ang} fanBlur={blur} dust={dust} heat={heat} led={coolerLed} />
      </group>
    </group>
  );
};

const ShotFan: React.FC<{t: number}> = ({t}) => {
  // Пике сверху на плату → низкий пролёт к пыльному вентилятору.
  const pos = keys3(
    t,
    [
      [0, [-3, -9, 38]],
      [0.95, [16, -2, 11]],
      [2.1, [15.5, 6.2, 11.2]],
    ],
    E.inOutCubic
  );
  const tgt = keys3(
    t,
    [
      [0, [-1, -4, 0]],
      [0.95, [3, 5, 6]],
      [2.1, [3.9, 7.4, 10.4]],
    ],
    E.inOutCubic
  );
  const [sx, sy] = shake(t, 0.5, 0.18, 6, 50);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}} camera={{fov: 36}}>
      <color attach="background" args={[COLORS.bg]} />
      <fog attach="fog" args={[COLORS.bg, 18, 70]} />
      <StudioEnv mood="hot" intensity={0.8} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[-10, 10, 30]} intensity={1.1} color="#cfe4ff" />
      <pointLight position={[-4, 7.6, 18]} intensity={140} distance={60} color="#ff6a2a" decay={2} />
      <pointLight position={[18, -4, 8]} intensity={70} distance={60} color="#ff9a5a" decay={2} />
      <pointLight position={[16, 3, 19]} intensity={110} distance={50} color="#fff1e4" decay={2} />
      <Cam pos={[pos[0] + sx, pos[1] + sy, pos[2]]} target={tgt} fov={keys(t, [[0, 46], [1.0, 38], [2.1, 34]])} />
      <Rig t={t} dust={1} heat={0.35} fanSpeed={2.3} blur={0.55} wobble={1} pulses={0.7} />
      <Particles t={t} count={140} box={[[-8, -4, 1], [24, 18, 20]]} color="#ffb48a" size={0.22} drift={[-0.6, 0, 0.5]} opacity={0.35} seed={3} />
      <Post bloom={0.7} threshold={0.8} radius={0.5} />
    </ThreeCanvas>
  );
};

const ShotHeat: React.FC<{t: number}> = ({t}) => {
  // Вдоль рёбер радиатора: раскалённые кромки, горячий воздух.
  const pos = keys3(t, [[0, [-11, 0.5, 6.5]], [1.6, [-10.5, 2.5, 13.5]]], E.inOutSine);
  const tgt = keys3(t, [[0, [-2.4, 7.6, 8.5]], [1.6, [-2.4, 7.6, 12.0]]], E.inOutSine);
  const heat = 0.7 + 0.25 * ramp(t, 0, 1.5);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}} camera={{fov: 34}}>
      <color attach="background" args={['#0a0605']} />
      <fog attach="fog" args={['#0a0605', 14, 50]} />
      <StudioEnv mood="hot" intensity={1.1} />
      <ambientLight intensity={0.05} />
      <pointLight position={[-7, 7.6, 10]} intensity={90 * heat} distance={50} color="#ff6a2a" decay={2} />
      <pointLight position={[-6, -6, 20]} intensity={50} distance={60} color="#ffb070" decay={2} />
      <directionalLight position={[10, 10, 30]} intensity={0.4} color="#8fb8ff" />
      <Cam pos={pos} target={tgt} fov={34} roll={0.06} />
      <Rig t={t + 2} dust={1} heat={heat} fanSpeed={2.3} blur={0.55} wobble={1} pulses={0.5} />
      <Particles t={t} count={180} box={[[-9, 1, 2], [0, 14, 24]]} color="#ff8a4a" size={0.2} drift={[-0.4, 0, 3.2]} opacity={0.5} seed={8} />
      <Post bloom={0.8} threshold={0.75} radius={0.55} />
    </ThreeCanvas>
  );
};

const ShotHDD: React.FC<{t: number}> = ({t}) => {
  // Медленно вращающийся диск, головка дёргается в поиске.
  const platter = t * 0.9 + Math.sin(t * 3) * 0.05;
  const seek = Math.floor(t * 7);
  const arm = (hash(seek) - 0.5) * 0.32 + Math.sin(t * 60) * 0.004;
  const pos = keys3(t, [[0, [9, -16, 15]], [2.5, [6, -12, 11]]], E.outCubic);
  return (
    <ThreeCanvas width={W} height={H} gl={{antialias: true}} camera={{fov: 34}}>
      <color attach="background" args={[COLORS.bg]} />
      <fog attach="fog" args={[COLORS.bg, 16, 60]} />
      <StudioEnv mood="neutral" intensity={0.45} />
      <ambientLight intensity={0.06} />
      <pointLight position={[-10, 8, 16]} intensity={70} distance={60} color="#ff8a4a" decay={2} />
      <pointLight position={[12, -8, 18]} intensity={50} distance={60} color="#9fd8ff" decay={2} />
      <Cam pos={pos} target={[0.5, -0.5, 1]} fov={34} roll={-0.12} />
      <group rotation={[0, 0, 0.5]}>
        <HDD open platter={platter} arm={arm} />
      </group>
      <Particles t={t} count={160} box={[[-12, -12, 1], [12, 12, 12]]} color="#cbd8e6" size={0.12} drift={[0.2, 0, 0.1]} opacity={0.4} seed={12} />
      <Post bloom={0.6} threshold={0.8} radius={0.5} />
    </ThreeCanvas>
  );
};

// Зависший интерфейс: окно «Не отвечает» со спиннером — без логотипов ОС.
const FrozenWindow: React.FC<{t: number}> = ({t}) => {
  const k = ramp(t, 0, 0.25, E.outExpo);
  const frozen = t > 0.9; // спиннер замирает
  const spin = frozen ? 0.9 * 400 : t * 400;
  const dim = ramp(t, 0.9, 1.2);
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        top: 960,
        height: 340,
        borderRadius: 22,
        background: `rgba(14,20,30,${0.86})`,
        border: '1px solid rgba(243,248,255,0.14)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        transform: `scale(${0.92 + 0.08 * k})`,
        opacity: k,
        overflow: 'hidden',
        fontFamily: FONT.text,
        color: COLORS.white,
      }}
    >
      <div style={{height: 76, display: 'flex', alignItems: 'center', padding: '0 30px', borderBottom: '1px solid rgba(243,248,255,0.1)', fontSize: 34, fontWeight: 600}}>
        <span style={{opacity: 0.9}}>Проводник</span>
        <span style={{marginLeft: 12, color: COLORS.heat}}>(Не отвечает)</span>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 34, padding: '50px 40px'}}>
        <svg width="86" height="86" viewBox="0 0 86 86" style={{transform: `rotate(${spin}deg)`}}>
          <circle cx="43" cy="43" r="34" stroke="rgba(243,248,255,0.15)" strokeWidth="8" fill="none" />
          <path d="M43 9 A34 34 0 0 1 77 43" stroke={COLORS.blue} strokeWidth="8" strokeLinecap="round" fill="none" />
        </svg>
        <div>
          <div style={{fontSize: 44, fontWeight: 700}}>Подождите…</div>
          <div style={{marginTop: 22, width: 470, height: 14, borderRadius: 6, background: 'rgba(243,248,255,0.1)'}}>
            <div style={{width: '37%', height: '100%', borderRadius: 6, background: COLORS.heat}} />
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.08)', opacity: dim}} />
    </div>
  );
};

export const S02Problem: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const glitch = ramp(t, dur - 0.9, dur - 0.05, E.inCubic);
  const [jx, jy] = glitch > 0.3 ? [(hash(Math.floor(t * 30)) - 0.5) * 40 * glitch, (hash(Math.floor(t * 30) + 5) - 0.5) * 16 * glitch] : [0, 0];
  const [kx, ky] = shake(t, 0.5, 8);
  const [kx2, ky2] = shake(t, 2.0, 10);
  const [kx3, ky3] = shake(t, 3.5, 12);
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <AbsoluteFill style={{transform: `translate(${jx + kx + kx2 + kx3}px, ${jy + ky + ky2 + ky3}px) scale(1.03)`}}>
        <Sequence durationInFrames={Math.round(2.0 * FPS)} layout="none">
          <ShotFan t={t} />
        </Sequence>
        <Sequence from={Math.round(2.0 * FPS)} durationInFrames={Math.round(1.5 * FPS)} layout="none">
          <ShotHeat t={t - 2.0} />
        </Sequence>
        <Sequence from={Math.round(3.5 * FPS)} layout="none">
          <ShotHDD t={t - 3.5} />
          <FrozenWindow t={t - 4.15} />
        </Sequence>
      </AbsoluteFill>
      {/* тёплая дымка снизу во время перегрева */}
      <AbsoluteFill style={{background: `linear-gradient(0deg, rgba(255,118,59,${0.18 * ramp(t, 1.8, 2.2) * (1 - ramp(t, 3.4, 3.6))}) 0%, rgba(0,0,0,0) 45%)`}} />
      <ImpactTitle text={TEXT.problem[0]} t={t} at={0.5} out={1.85} y={330} size={150} glow={COLORS.blue} exit="cut" />
      <ImpactTitle text={TEXT.problem[1]} t={t} at={2.0} out={3.35} y={330} size={150} glow={COLORS.heat} color="#FFE9DD" exit="cut" />
      <ImpactTitle text={TEXT.problem[2]} t={t} at={3.5} out={dur} y={330} size={140} glow={COLORS.heat} exit="cut" rgbSplit />
      <GlitchBars t={t} amount={glitch * 0.9} seed={4} />
    </AbsoluteFill>
  );
};
