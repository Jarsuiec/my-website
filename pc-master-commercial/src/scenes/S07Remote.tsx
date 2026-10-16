import React, {useMemo} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {COLORS, TEXT} from '../config/brand';
import {FPS, W, H} from '../config/timeline';
import {Cam, Particles, Post, StudioEnv, V3} from '../three/core';
import {Laptop} from '../three/parts';
import {GamingPC} from './S06Gaming';
import {E, clamp01, keys3, lerp, ramp} from '../components/anim';
import {FONT} from '../components/fonts';
import {ImpactTitle, RevealTitle} from '../components/type';

export const REMOTE = {beam: 0.7, dialog: 1.0, click: 1.9, steps: [2.45, 2.95, 3.45], done: 3.95};

// Интерфейс удалённой помощи на экране ноутбука — рисуется в canvas каждый кадр.
const drawScreen = (g: CanvasRenderingContext2D, t: number) => {
  const Wc = 1600;
  const Hc = 1015;
  const bg = g.createRadialGradient(1100, 200, 50, 800, 500, 1100);
  bg.addColorStop(0, '#123a66');
  bg.addColorStop(1, '#050b16');
  g.fillStyle = bg;
  g.fillRect(0, 0, Wc, Hc);
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };
  const connected = t >= REMOTE.click + 0.1;
  if (!connected) {
    // диалог-запрос
    const k = E.outExpo(clamp01((t - REMOTE.dialog) / 0.35));
    if (k <= 0) return;
    g.save();
    g.globalAlpha = k;
    g.translate(800, 520);
    g.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
    rr(-560, -300, 1120, 600, 34);
    g.fillStyle = 'rgba(12,22,38,0.97)';
    g.fill();
    g.strokeStyle = 'rgba(103,232,255,0.35)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#F3F8FF';
    g.font = '800 76px "Inter Display"';
    g.fillText('Удалённая помощь', -490, -170);
    g.font = '500 48px "Inter"';
    g.fillStyle = 'rgba(243,248,255,0.8)';
    g.fillText('PC MASTER запрашивает доступ', -490, -78);
    g.fillText('для диагностики. Разрешить?', -490, -14);
    // кнопки
    const pressed = t > REMOTE.click - 0.05 && t < REMOTE.click + 0.1;
    rr(-490, 90, 460, 130, 26);
    g.fillStyle = 'rgba(243,248,255,0.1)';
    g.fill();
    g.fillStyle = 'rgba(243,248,255,0.8)';
    g.font = '700 54px "Inter"';
    g.textAlign = 'center';
    g.fillText('Отклонить', -260, 172);
    rr(30, 90, 460, 130, 26);
    g.fillStyle = pressed ? '#8fd63f' : COLORS.lime;
    g.fill();
    g.fillStyle = '#0a1405';
    g.fillText('Разрешить', 260, 172);
    g.textAlign = 'left';
    g.restore();
    // курсор
    const cx = lerp(1250, 1060, E.inOutCubic(clamp01((t - REMOTE.dialog - 0.2) / 0.6)));
    const cy = lerp(900, 690, E.inOutCubic(clamp01((t - REMOTE.dialog - 0.2) / 0.6)));
    g.save();
    g.translate(cx, cy);
    g.scale(pressed ? 0.9 : 1, pressed ? 0.9 : 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 64);
    g.lineTo(16, 50);
    g.lineTo(28, 76);
    g.lineTo(38, 71);
    g.lineTo(26, 46);
    g.lineTo(46, 44);
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
    g.strokeStyle = '#000';
    g.lineWidth = 3;
    g.stroke();
    g.restore();
    return;
  }
  // подключено: шапка сеанса и шаги
  rr(60, 50, 1480, 110, 28);
  g.fillStyle = 'rgba(180,255,89,0.14)';
  g.fill();
  g.fillStyle = COLORS.lime;
  g.beginPath();
  g.arc(120, 105, 16, 0, Math.PI * 2);
  g.fill();
  g.font = '700 52px "Inter"';
  g.fillText('Подключено · с вашего согласия', 160, 124);
  g.fillStyle = 'rgba(243,248,255,0.7)';
  g.font = '600 34px "Inter"';
  g.textAlign = 'right';
  g.fillText('Стоп ✕', 1500, 118);
  g.textAlign = 'left';
  const steps = ['Диагностика системы', 'Проверка драйверов', 'Настройка системы'];
  steps.forEach((s, i) => {
    const at = REMOTE.steps[i];
    const k = E.outExpo(clamp01((t - (at - 0.45)) / 0.3));
    if (k <= 0) return;
    const y = 280 + i * 190;
    const done = t >= at;
    g.globalAlpha = k;
    rr(60, y, 1480, 150, 26);
    g.fillStyle = 'rgba(12,22,38,0.92)';
    g.fill();
    g.fillStyle = done ? COLORS.lime : COLORS.cyan;
    g.font = '700 54px "Inter"';
    g.fillText(done ? '✓' : '…', 110, y + 95);
    g.fillStyle = '#F3F8FF';
    g.font = '700 58px "Inter"';
    g.fillText(s, 200, y + 96);
    // полоса прогресса
    const p = clamp01((t - (at - 0.45)) / 0.45);
    rr(1140, y + 62, 340, 24, 12);
    g.fillStyle = 'rgba(243,248,255,0.1)';
    g.fill();
    rr(1140, y + 62, 340 * p, 24, 12);
    g.fillStyle = done ? COLORS.lime : COLORS.blue;
    g.fill();
    g.globalAlpha = 1;
  });
  if (t > REMOTE.done) {
    g.globalAlpha = clamp01((t - REMOTE.done) / 0.3);
    g.fillStyle = COLORS.lime;
    g.font = '800 70px "Inter Display"';
    g.textAlign = 'center';
    g.fillText('✓ Готово', 800, 935);
    g.textAlign = 'left';
    g.globalAlpha = 1;
  }
};

const ScreenTex: React.FC<{t: number; children: (tex: THREE.Texture) => React.ReactNode}> = ({t, children}) => {
  const {canvas, tex} = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1015;
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 8;
    return {canvas: c, tex: tx};
  }, []);
  drawScreen(canvas.getContext('2d')!, t);
  tex.needsUpdate = true;
  return <>{children(tex)}</>;
};

// Световая линия связи ПК → ноутбук.
const Beam: React.FC<{t: number; from: V3; to: V3}> = ({t, from, to}) => {
  const curve = useMemo(() => {
    const mid = new THREE.Vector3((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, Math.max(from[2], to[2]) + 30);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), mid, new THREE.Vector3(...to));
  }, [from, to]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 200, 0.18, 8, false), [curve]);
  const k = ramp(t, REMOTE.beam, REMOTE.beam + 0.6, E.inOutCubic);
  const segs = 200 * 8 * 6;
  geo.setDrawRange(0, Math.floor(segs * k));
  const mat = useMemo(() => new THREE.MeshBasicMaterial({color: new THREE.Color(COLORS.cyan).multiplyScalar(1.6), toneMapped: false}), []);
  const pulses = [0, 0.33, 0.66].map((o) => curve.getPoint(((t * 0.8 + o) % 1)));
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      {k >= 1 &&
        pulses.map((p, i) => (
          <mesh key={i} position={p} material={mat}>
            <sphereGeometry args={[0.6, 16, 16]} />
          </mesh>
        ))}
    </group>
  );
};

export const S07Remote: React.FC<{dur: number}> = ({dur}) => {
  const t = useCurrentFrame() / FPS;
  const pcPos: V3 = [-70, 150, 0];
  const pos = keys3(
    t,
    [
      [0, [-55, 60, 30]],
      [0.9, [12, -80, 44]],
      [2.0, [0, -64, 33]],
      [dur, [0, -60, 31.5]],
    ],
    E.inOutCubic
  );
  const tgt = keys3(
    t,
    [
      [0, [-68, 150, 12]],
      [0.9, [0, 8, 9]],
      [2.0, [0, 12.6, 10.6]],
      [dur, [0, 12.8, 10.8]],
    ],
    E.inOutCubic
  );
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <ThreeCanvas width={W} height={H} gl={{antialias: true}}>
        <color attach="background" args={['#050a14']} />
        <fog attach="fog" args={['#050a14', 60, 260]} />
        <StudioEnv mood="cold" intensity={0.9} />
        <ambientLight intensity={0.08} />
        <directionalLight position={[-20, -30, 40]} intensity={0.8} color="#e4f2ff" />
        <pointLight position={[0, 4, 26]} intensity={160} distance={80} color={COLORS.blue} />
        <Cam pos={pos} target={tgt} fov={36} far={800} />
        <group position={pcPos} scale={0.9} rotation={[Math.PI / 2, 0, 0]}>
          <GamingPC t={t + 6} power={1} />
        </group>
        <ScreenTex t={t}>{(tex) => <Laptop screen={tex} edge={COLORS.cyan} />}</ScreenTex>
        <Beam t={t} from={[pcPos[0] + 3, pcPos[1], 26]} to={[0, 16, 22]} />
        <Particles t={t} count={160} box={[[-60, -20, 0], [40, 150, 50]]} color={COLORS.cyan} size={0.5} drift={[0.6, 0.8, 0.2]} opacity={0.3} seed={71} />
        <Post bloom={0.8} threshold={0.88} radius={0.55} />
      </ThreeCanvas>
      <AbsoluteFill style={{background: COLORS.bg, opacity: 1 - ramp(t, 0, 0.25)}} />
      <ImpactTitle text={'УДАЛЁННАЯ\nПОМОЩЬ'} t={t} at={0.3} out={dur - 0.3} y={230} size={118} glow={COLORS.cyan} exit="blur" />
      <RevealTitle text={TEXT.remoteSub} t={t} at={REMOTE.click} out={dur - 0.3} y={500} size={50} color={COLORS.lime} weight={800} tracking={0.16} glow={COLORS.lime} font={FONT.display} />
    </AbsoluteFill>
  );
};
