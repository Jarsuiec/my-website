import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, TracePulses, V3} from '../three/core';
import {ANCH, CPU, GPU, Motherboard, PCCase, RamStick, TowerCooler} from '../three/parts';
import {E, keys, ramp, shake} from '../components/anim';
import {ImpactTitle, RevealTitle} from '../components/type';

// Моменты установки (локальное время сцены) — по ним же расставлены щелчки в звуке.
export const ASSEMBLY = {cpu: 0.95, ram1: 1.35, ram2: 1.55, gpu: 2.05, cooler: 2.55, case: 3.05, power: 3.35};

// Деталь «въезжает» по оси установки и останавливается с механической точностью.
const ins = (t: number, at: number, dist: number, dur = 0.42) => (1 - ramp(t, at - dur, at, E.outCubic)) * dist + (t < at - dur ? 1e3 : 0);

// Готовая система: используется и в финальных сценах.
export const GamingPC: React.FC<{t: number; power: number; assemble?: number; glassIn?: number; partsT?: number; fanSpin?: number}> = ({
  t,
  power,
  assemble = 1,
  glassIn = 1,
  partsT = 99,
  fanSpin = 1,
}) => {
  const pt = partsT;
  const lk = 0.04 + power * 1.15;
  const spin = fanSpin * power;
  const fanA = -(t * 1.6 * Math.PI * 2) * spin;
  const zCpu = ins(pt, ASSEMBLY.cpu, 9);
  const zR1 = ins(pt, ASSEMBLY.ram1, 12);
  const zR2 = ins(pt, ASSEMBLY.ram2, 12);
  const zG = ins(pt, ASSEMBLY.gpu, 16, 0.5);
  const zC = ins(pt, ASSEMBLY.cooler, 18, 0.5);
  return (
    <group>
      <Motherboard accent={COLORS.blue} accentK={0.05 + power * 1.6} />
      <TracePulses t={t} color={COLORS.cyan} opacity={power * 0.9} count={60} />
      {zCpu < 500 && (
        <group position={[ANCH.cpu[0], ANCH.cpu[1], 0.02 + zCpu]}>
          <CPU paste={zC < 500 || pt > ASSEMBLY.cpu ? 'new' : 'none'} pasteAmount={pt > ASSEMBLY.cpu + 0.1 ? 1 : 0} />
        </group>
      )}
      {zR1 < 500 && (
        <group position={[6.2, ANCH.dimmY, 0.85 + zR1]}>
          <RamStick light={COLORS.cyan} lightK={lk} />
        </group>
      )}
      {zR2 < 500 && (
        <group position={[8.6, ANCH.dimmY, 0.85 + zR2]}>
          <RamStick light={COLORS.cyan} lightK={lk} />
        </group>
      )}
      {zG < 500 && (
        <group position={[ANCH.pcie1[0] - 0.2, ANCH.pcie1[1], 0.95 + zG]}>
          <GPU fanAngle={fanA * 0.8} fanBlur={spin * 0.5} light={COLORS.blue} lightK={lk} />
        </group>
      )}
      {zC < 500 && (
        <group position={[ANCH.cpu[0], ANCH.cpu[1], 0.47 + zC]}>
          <TowerCooler fanAngle={fanA} fanBlur={spin * 0.5} led={power > 0.05 ? COLORS.cyan : null} />
        </group>
      )}
      {assemble > 0.001 && <PCCase assemble={assemble} glassIn={glassIn} light={COLORS.blue} lightK={lk} fanAngle={fanA} />}
    </group>
  );
};

export const S06Gaming: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const power = ramp(t, ASSEMBLY.power, ASSEMBLY.power + 0.5, E.outCubic);
  const assemble = ramp(t, ASSEMBLY.case - 0.5, ASSEMBLY.case, E.outCubic);
  const glassIn = ramp(t, ASSEMBLY.case - 0.3, ASSEMBLY.case + 0.1, E.outCubic);
  // камера: фронтальный 3/4 на сборку → облёт готового корпуса
  const orbit = keys(t, [[0, 0.62], [ASSEMBLY.power, 0.45], [dur, -0.12]], E.inOutSine);
  const rad = keys(t, [[0, 72], [ASSEMBLY.case - 0.4, 84], [ASSEMBLY.power, 122], [dur, 116]], E.inOutCubic);
  const elev = keys(t, [[0, 14], [dur, 6]]);
  const tgt: V3 = [keys(t, [[0, 1], [ASSEMBLY.case, 4]]), keys(t, [[0, 2], [ASSEMBLY.case, -3]]), keys(t, [[0, 4], [ASSEMBLY.case, 9]])];
  const pos: V3 = [tgt[0] + Math.sin(orbit) * rad, tgt[1] + elev, tgt[2] + Math.cos(orbit) * rad];
  const clicks = Object.values(ASSEMBLY).slice(0, 6);
  let sx = 0;
  let sy = 0;
  for (const c of clicks) {
    const [a, b] = shake(t, c, 0.18, 14, 60);
    sx += a;
    sy += b;
  }
  const flash = t > ASSEMBLY.power ? Math.exp(-(t - ASSEMBLY.power) * 6) : 0;
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 45% at 50% 55%, rgba(33,191,255,${0.06 + power * 0.16}) 0%, rgba(6,11,20,0) 70%)`}} />
      <ThreeCanvas width={W} height={H} gl={{antialias: true, alpha: true}}>
        <fog attach="fog" args={[COLORS.bg, 90, 220]} />
        <StudioEnv mood="cold" intensity={0.9} />
        <ambientLight intensity={0.06} />
        <spotLight position={[10, 70, 50]} angle={0.45} penumbra={0.8} intensity={1300} distance={220} color="#e8f4ff" />
        <directionalLight position={[30, 20, 90]} intensity={1.3} color="#dcecff" />
        <pointLight position={[9, -9, 11]} intensity={90 * power} distance={45} color={COLORS.cyan} />
        <pointLight position={[-40, -10, 40]} intensity={700 * (0.4 + power)} distance={160} color={COLORS.blue} />
        <pointLight position={[50, 0, 20]} intensity={600 * (0.4 + power)} distance={160} color={COLORS.cyan} />
        <Cam pos={[pos[0] + sx, pos[1] + sy, pos[2]]} target={tgt} fov={34} roll={0} far={600} />
        <GamingPC t={t} power={power} assemble={assemble} glassIn={glassIn} partsT={t} />
        <Particles t={t} count={160} box={[[-40, -30, -10], [40, 30, 40]]} color={COLORS.cyan} size={0.35} drift={[0.5, 1.2, 0]} opacity={0.25 + power * 0.25} seed={61} />
        <Post bloom={0.65 + power * 0.2} threshold={0.82} radius={0.55} />
      </ThreeCanvas>
      <AbsoluteFill style={{background: COLORS.cyan, opacity: flash * 0.22, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.3)}} />
      <ImpactTitle text={'ТВОЙ\nИГРОВОЙ ПК'} t={t} at={0.25} out={dur - 0.3} y={240} size={122} glow={COLORS.blue} exit="blur" />
      <RevealTitle text={TEXT.gamingSub} t={t} at={1.9} out={dur - 0.3} y={1205} size={60} color={COLORS.lime} weight={800} tracking={0.18} glow={COLORS.lime} />
    </AbsoluteFill>
  );
};
