import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS} from './config/brand';
import {W, H} from './config/timeline';
import {Cam, Post, StudioEnv} from './three/core';
import {Rig} from './scenes/S02Problem';
import {HDD, M2SSD, GPU, RamStick, PCCase, Laptop} from './three/parts';
import {useFontsReady} from './components/fonts';

// Служебная композиция для настройки материалов и света (кадр = ракурс).
const VIEWS: {pos: [number, number, number]; target: [number, number, number]; what: string}[] = [
  {pos: [40, -30, 45], target: [0, 2, 4], what: 'rig'},
  {pos: [24, 4, 14], target: [3, 7.6, 9], what: 'rig'},
  {pos: [-14, -6, 22], target: [0, 7.6, 9], what: 'rig'},
  {pos: [0, -22, 22], target: [0, 0, 1], what: 'hdd'},
  {pos: [0, -9, 9], target: [0, 0, 0], what: 'ssd'},
  {pos: [30, -60, 30], target: [4, -6, 6], what: 'gpu'},
  {pos: [70, -20, 90], target: [4, -3, 8], what: 'case'},
  {pos: [0, -45, 30], target: [0, 5, 8], what: 'laptop'},
];
export const LookDev: React.FC = () => {
  const ready = useFontsReady();
  const fr = useCurrentFrame();
  if (!ready) return null;
  const v = VIEWS[fr % VIEWS.length];
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
        <color attach="background" args={[COLORS.bg]} />
        <StudioEnv mood="cold" />
        <ambientLight intensity={0.1} />
        <directionalLight position={[-20, 20, 40]} intensity={1.2} />
        <Cam pos={v.pos} target={v.target} fov={35} />
        {v.what === 'rig' && <Rig t={1} dust={1} heat={0.6} fanSpeed={1} blur={0} />}
        {v.what === 'hdd' && <HDD open platter={0.3} arm={0} />}
        {v.what === 'ssd' && <M2SSD />}
        {v.what === 'gpu' && <GPU fanAngle={0.3} />}
        {v.what === 'case' && <PCCase />}
        {v.what === 'laptop' && <Laptop screen={null} />}
        {v.what === 'ram' && <RamStick />}
        <Post bloom={0.6} threshold={0.8} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
