import React, {useMemo} from 'react';
import * as THREE from 'three';
import {M, glow} from './materials';
import {bladeGeometry, fanFrameGeometry, ringGeometry, roundedBox} from './geometry';
import {BOARD_H, BOARD_W, chipTexture, dustTexture, hubTexture, memo, rng, ssdLabelTexture} from './textures';

// «Горошина» термопасты: неровная глянцевая поверхность и хвостик от шприца.
const pasteBlob = () =>
  memo('pasteBlob', () => {
    const g = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const h = y; // 0 у основания, 1 на макушке
      const bump = 1 + 0.025 * Math.sin(a * 5 + h * 7) + 0.012 * Math.sin(a * 11 - h * 13) + 0.008 * Math.sin(h * 23 + a * 3);
      const tail = 1 + 0.55 * Math.pow(Math.max(0, h - 0.82) / 0.18, 2);
      p.setXYZ(i, x * bump * (1 - 0.25 * Math.pow(h, 3)), y * tail, z * bump * (1 - 0.25 * Math.pow(h, 3)));
    }
    g.rotateX(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
import type {V3} from './core';

const Box: React.FC<{s: V3; p?: V3; r?: V3; m: THREE.Material; rad?: number}> = ({s, p = [0, 0, 0], r = [0, 0, 0], m, rad}) => (
  <mesh position={p} rotation={r} material={m} geometry={rad ? roundedBox(s[0], s[1], s[2], rad, Math.min(rad, 0.04)) : memo(`box:${s}`, () => new THREE.BoxGeometry(...s))} />
);

// ===========================================================================
// ВЕНТИЛЯТОР 120 мм (размер настраивается). Ось вращения — локальная +Z.
// angle — угол ротора, blur — сила размытия движения (0..1), dust — запылённость.
// ===========================================================================
export const Fan: React.FC<{
  size?: number;
  angle: number;
  blur?: number;
  dust?: number;
  led?: string | null;
  ledK?: number;
  frame?: boolean;
  bladeColor?: string;
  branded?: boolean;
}> = ({size = 12, angle, blur = 0, dust = 0, led = null, ledK = 2.2, frame = true, bladeColor = '#14181e', branded = false}) => {
  const k = size / 12;
  const rIn = 2.0 * k;
  const rOut = 5.72 * k;
  const blade = bladeGeometry(rIn, rOut, 1.9 * k);
  const bladeMat = useMemo(() => new THREE.MeshStandardMaterial({color: bladeColor, roughness: 0.42, metalness: 0.1}), [bladeColor]);
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({color: bladeColor, roughness: 0.42, metalness: 0.1, transparent: true, depthWrite: false}), [bladeColor]);
  // пыль на лопастях — светлые пятна поверх
  const dustBlade = useMemo(
    () => new THREE.MeshStandardMaterial({color: '#9a9086', roughness: 1, alphaMap: dustTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}),
    []
  );
  dustBlade.opacity = dust;
  const n = 9;
  const hubMat = useMemo(() => [M.plastic(), branded ? new THREE.MeshStandardMaterial({map: hubTexture(), roughness: 0.4}) : M.plasticGray(), M.plastic()], [branded]);
  const ghosts = blur > 0.02 ? 6 : 0;
  ghostMat.opacity = 0.28 * blur;
  const dustPts = useMemo(() => {
    const r = rng(41);
    const pts: number[] = [];
    for (let i = 0; i < 900; i++) {
      const b = Math.floor(r() * n);
      const u = Math.pow(r(), 0.6);
      const rad = rIn + (rOut - rIn) * u;
      const th = (b / n) * Math.PI * 2 + 0.55 * u * u + (r() - 0.5) * (0.9 - 0.25 * u) * 0.95;
      pts.push(rad * Math.cos(th), rad * Math.sin(th), 0.55 * k + r() * 0.25 * k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [k, rIn, rOut]);
  const dustPtsMat = useMemo(() => new THREE.PointsMaterial({color: '#8f877e', size: 0.09 * k, transparent: true, depthWrite: false}), [k]);
  dustPtsMat.opacity = dust;

  const rotor = (a: number, mat: THREE.Material, key: string) => (
    <group key={key} rotation={[0, 0, a]}>
      {Array.from({length: n}, (_, i) => (
        <mesh key={i} geometry={blade} material={mat} rotation={[0, 0, (i / n) * Math.PI * 2]} />
      ))}
    </group>
  );
  return (
    <group>
      {frame && (
        <>
          <mesh geometry={fanFrameGeometry(size, 2.5 * k)} material={M.plastic()} />
          {/* стойки статора сзади */}
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} s={[6.6 * k, 0.32 * k, 0.32 * k]} p={[Math.cos((i * Math.PI) / 2 + 0.785) * 3.6 * k, Math.sin((i * Math.PI) / 2 + 0.785) * 3.6 * k, -1.05 * k]} r={[0, 0, (i * Math.PI) / 2 + 0.785]} m={M.plastic()} />
          ))}
          <mesh position={[0, 0, -1.05 * k]} rotation={[Math.PI / 2, 0, 0]} material={M.plastic()}>
            <cylinderGeometry args={[2.1 * k, 2.1 * k, 0.4 * k, 48]} />
          </mesh>
          {dust > 0 && (
            <mesh position={[0, 0, 1.27 * k]} material={memo('dustRim', () => new THREE.MeshStandardMaterial({color: '#8d857b', roughness: 1, alphaMap: dustTexture(), transparent: true, depthWrite: false}))}>
              <ringGeometry args={[5.6 * k, 5.95 * k, 64]} />
            </mesh>
          )}
        </>
      )}
      {led && (
        <mesh material={glow(led, ledK)} position={[0, 0, 1.0 * k]}>
          <torusGeometry args={[5.86 * k, 0.07 * k, 8, 128]} />
        </mesh>
      )}
      <group rotation={[0, 0, angle]}>
        {rotor(0, bladeMat, 'main')}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1 * k]} material={hubMat}>
          <cylinderGeometry args={[rIn * 1.01, rIn * 1.01, 1.5 * k, 64]} />
        </mesh>
        {dust > 0.01 && (
          <>
            {Array.from({length: n}, (_, i) => (
              <mesh key={i} geometry={blade} material={dustBlade} rotation={[0, 0, (i / n) * Math.PI * 2]} scale={[1, 1, 1.04]} />
            ))}
          </>
        )}
      </group>
      {Array.from({length: ghosts}, (_, g) => rotor(angle - (g + 1) * 0.07 * blur, ghostMat, 'g' + g))}
    </group>
  );
};

// ===========================================================================
// МАТЕРИНСКАЯ ПЛАТА ATX. Лежит в плоскости XY, лицом к +Z. Ноль — центр платы.
// ===========================================================================
export const ANCH = {
  cpu: [0, 7.6] as [number, number],
  dimmX: [5.0, 6.2, 7.4, 8.6],
  dimmY: 7.0,
  pcie1: [-6.5, -1.0] as [number, number],
  pcie2: [-6.5, -8.0] as [number, number],
  m2: [-2.6, -4.6] as [number, number],
  chipset: [6.4, -7.4] as [number, number],
};

export const Motherboard: React.FC<{accent?: string; accentK?: number; socketOpen?: boolean}> = ({accent = '#21BFFF', accentK = 1.6}) => {
  const smd = useMemo(() => {
    const r = rng(77);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, M.chipBody(), 520);
    const m = new THREE.Matrix4();
    let i = 0;
    const free = (x: number, y: number) =>
      !(x > -3.4 && x < 3.4 && y > 3.8 && y < 11.4) && // сокет
      !(x > 4.4 && x < 9.2 && y > -0.2 && y < 14.2) && // DIMM
      !(x > -12.2 && x < -8.8 && y > 1.2) && // I/O
      !(y > 11.0) && // VRM сверху
      !(Math.abs(y - ANCH.pcie1[1]) < 0.7 && x < -1.8) &&
      !(Math.abs(y - ANCH.pcie2[1]) < 0.7 && x < -1.8) &&
      !(x > 3.6 && x < 9.2 && y > -10 && y < -4.8);
    while (i < 520) {
      const x = -11.8 + r() * 23.6;
      const y = -14.8 + r() * 29.6;
      if (!free(x, y)) continue;
      const big = r() < 0.12;
      const sx = big ? 0.5 + r() * 0.4 : 0.12 + r() * 0.14;
      const sy = big ? 0.5 + r() * 0.4 : 0.07 + r() * 0.08;
      const sz = big ? 0.1 : 0.06;
      m.compose(new THREE.Vector3(x, y, 0.08 + sz / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() < 0.5 ? 0 : Math.PI / 2), new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(i++, m);
    }
    return mesh;
  }, []);

  const caps = useMemo(() => {
    const list: V3[] = [];
    for (let x = -6.0; x <= 2.2; x += 0.62) list.push([x, 11.05, 0]);
    for (let y = 3.2; y <= 10.4; y += 0.62) list.push([-6.35, y, 0]);
    for (let y = -13.8; y <= -10.6; y += 0.62) list.push([2.2, y, 0]);
    return list;
  }, []);
  const chokes = useMemo(() => {
    const list: V3[] = [];
    for (let x = -5.8; x <= 2.4; x += 0.92) list.push([x, 12.0, 0]);
    for (let y = 3.4; y <= 10.8; y += 0.92) list.push([-7.4, y, 0]);
    return list;
  }, []);

  const vrmFins = (len: number, h: number, w: number, axis: 'x' | 'y') => {
    const n = Math.floor(len / 0.42);
    return Array.from({length: n}, (_, i) => {
      const o = -len / 2 + 0.21 + i * 0.42;
      return axis === 'x' ? (
        <Box key={i} s={[0.24, w, h]} p={[o, 0, h / 2]} m={M.gunmetal()} />
      ) : (
        <Box key={i} s={[w, 0.24, h]} p={[0, o, h / 2]} m={M.gunmetal()} />
      );
    });
  };

  return (
    <group>
      {/* плата */}
      <mesh position={[0, 0, -0.08]} material={[M.pcbPlain(), M.pcbPlain(), M.pcbPlain(), M.pcbPlain(), M.pcb(), M.pcbPlain()]}>
        <boxGeometry args={[BOARD_W, BOARD_H, 0.16]} />
      </mesh>
      <primitive object={smd} />

      {/* сокет: подложка, рамка, рычаг */}
      <group position={[ANCH.cpu[0], ANCH.cpu[1], 0]}>
        <Box s={[5.6, 5.6, 0.25]} p={[0, 0, 0.12]} m={M.plastic()} rad={0.15} />
        <Box s={[5.9, 0.5, 0.35]} p={[0, 2.95, 0.3]} m={M.steel()} />
        <Box s={[5.9, 0.5, 0.35]} p={[0, -2.95, 0.3]} m={M.steel()} />
        <Box s={[0.5, 5.9, 0.35]} p={[2.95, 0, 0.3]} m={M.steel()} />
        <Box s={[0.5, 5.9, 0.35]} p={[-2.95, 0, 0.3]} m={M.steel()} />
        <mesh position={[3.45, 0, 0.42]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
          <cylinderGeometry args={[0.09, 0.09, 6.4, 16]} />
        </mesh>
        {/* крепёжные отверстия кулера */}
        {[
          [-3.7, 3.7],
          [3.7, 3.7],
          [-3.7, -3.7],
          [3.7, -3.7],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
            <cylinderGeometry args={[0.35, 0.35, 0.2, 24]} />
          </mesh>
        ))}
      </group>

      {/* VRM: дроссели, конденсаторы, радиаторы */}
      {chokes.map((p, i) => (
        <Box key={'ch' + i} s={[0.78, 0.78, 0.55]} p={[p[0], p[1], 0.28]} m={M.choke()} rad={0.06} />
      ))}
      {caps.map((p, i) => (
        <group key={'cap' + i} position={[p[0], p[1], 0]}>
          <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]} material={M.capAlu()}>
            <cylinderGeometry args={[0.24, 0.24, 0.9, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.905]} material={M.plastic()}>
            <circleGeometry args={[0.15, 16]} />
          </mesh>
        </group>
      ))}
      <group position={[-1.9, 13.4, 0]}>
        <Box s={[9.6, 1.9, 0.35]} p={[0, 0, 0.6]} m={M.gunmetal()} />
        <group position={[0, 0, 0.75]}>{vrmFins(9.6, 2.1, 1.9, 'x')}</group>
        <Box s={[9.6, 0.12, 0.12]} p={[0, -0.98, 2.84]} m={glow(accent, accentK)} />
      </group>
      <group position={[-8.3, 7.3, 0]}>
        <Box s={[1.7, 10.2, 0.35]} p={[0, 0, 0.6]} m={M.gunmetal()} />
        <group position={[0, 0, 0.75]}>{vrmFins(10.2, 2.1, 1.7, 'y')}</group>
      </group>

      {/* кожух задней панели I/O */}
      <group position={[-10.6, 8.3, 0]}>
        <Box s={[3.0, 13.6, 3.4]} p={[0, 0, 1.7]} m={M.gunmetal()} rad={0.25} />
        <Box s={[0.1, 12.6, 0.1]} p={[1.52, 0, 3.0]} m={glow(accent, accentK)} />
        <Box s={[2.2, 11.8, 0.05]} p={[0, 0, 3.42]} m={M.darkAlu()} />
      </group>

      {/* слоты DIMM */}
      {ANCH.dimmX.map((x, i) => (
        <group key={'dimm' + i} position={[x, ANCH.dimmY, 0]}>
          <Box s={[0.72, 13.9, 0.85]} p={[0, 0, 0.42]} m={i % 2 ? M.plasticGray() : M.plastic()} rad={0.06} />
          <Box s={[0.18, 13.3, 0.1]} p={[0, 0, 0.86]} m={M.rubber()} />
          <Box s={[0.8, 0.6, 1.2]} p={[0, 7.1, 0.6]} m={M.plasticGray()} rad={0.08} />
        </group>
      ))}

      {/* PCIe x16 со стальным усилением */}
      {[ANCH.pcie1, ANCH.pcie2].map(([x, y], i) => (
        <group key={'pcie' + i} position={[x, y, 0]}>
          <Box s={[8.9, 0.78, 1.05]} p={[0, 0, 0.53]} m={i === 0 ? M.steelSatin() : M.plastic()} rad={0.06} />
          <Box s={[8.5, 0.18, 0.1]} p={[0, 0, 1.06]} m={M.rubber()} />
          <Box s={[0.9, 1.0, 1.25]} p={[4.75, 0, 0.62]} m={M.plasticGray()} rad={0.08} />
        </group>
      ))}

      {/* M.2 радиатор */}
      <group position={[ANCH.m2[0], ANCH.m2[1], 0]}>
        <Box s={[9.0, 2.6, 0.5]} p={[0, 0, 0.3]} m={M.gunmetal()} rad={0.15} />
        {Array.from({length: 9}, (_, i) => (
          <Box key={i} s={[0.06, 2.3, 0.04]} p={[-3.6 + i * 0.9, 0, 0.56]} m={M.darkAlu()} />
        ))}
        <Box s={[8.6, 0.08, 0.06]} p={[0, -1.32, 0.45]} m={glow(accent, accentK * 0.8)} />
      </group>

      {/* чипсет */}
      <group position={[ANCH.chipset[0], ANCH.chipset[1], 0]}>
        <Box s={[5.0, 5.0, 0.8]} p={[0, 0, 0.42]} m={M.gunmetal()} rad={0.3} />
        <mesh position={[0, 0, 0.83]} material={glow(accent, accentK)}>
          <ringGeometry args={[1.25, 1.36, 64]} />
        </mesh>
        <mesh position={[0, 0, 0.83]} material={M.darkAlu()}>
          <circleGeometry args={[1.2, 64]} />
        </mesh>
      </group>

      {/* разъёмы питания */}
      <group position={[11.4, 5.6, 0]}>
        <Box s={[0.9, 5.4, 1.3]} p={[0, 0, 0.65]} m={M.plastic()} rad={0.08} />
        {Array.from({length: 24}, (_, i) => (
          <Box key={i} s={[0.3, 0.3, 0.05]} p={[(i % 2) * 0.38 - 0.19, -2.4 + Math.floor(i / 2) * 0.43, 1.31]} m={M.rubber()} />
        ))}
      </group>
      <group position={[-9.2, 14.55, 0]}>
        <Box s={[2.0, 0.9, 1.2]} p={[0, 0, 0.6]} m={M.plastic()} rad={0.08} />
      </group>

      {/* батарейка CMOS */}
      <mesh position={[-1.4, -12.6, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
        <cylinderGeometry args={[1.0, 1.0, 0.3, 48]} />
      </mesh>
    </group>
  );
};

// ===========================================================================
// ПРОЦЕССОР (крышка теплораспределителя) + термопаста.
// paste: 'none' | 'old' | 'clean' | 'new'; pasteAmount 0..1 — капля свежей пасты.
// ===========================================================================
export const CPU: React.FC<{paste?: 'none' | 'old' | 'clean' | 'new'; pasteAmount?: number; wipe?: number}> = ({paste = 'none', pasteAmount = 0, wipe = 0}) => {
  const oldGeo = useMemo(() => {
    // неровное пятно высохшей пасты
    const s = new THREE.Shape();
    const r = rng(5);
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = 1.45 + Math.sin(a * 3 + 1) * 0.12 + Math.sin(a * 7) * 0.06 + r() * 0.04;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(s, 4);
  }, []);
  return (
    <group>
      <Box s={[4.0, 4.0, 0.12]} p={[0, 0, 0.06]} m={M.pcbPlain()} />
      <mesh position={[0, 0, 0.12 + 0.17]} geometry={roundedBox(3.5, 3.5, 0.34, 0.12, 0.04)} material={M.nickel()} />
      {/* верх крышки с гравировкой */}
      <mesh position={[0, 0, 0.461]} material={M.ihs()}>
        <planeGeometry args={[3.36, 3.36]} />
      </mesh>
      {paste === 'old' && wipe < 1 && (
        <mesh geometry={oldGeo} material={M.oldPaste()} position={[(wipe * 1.6) / 2, 0, 0.465]} scale={[1 - wipe, 1, 1]} />
      )}
      {paste === 'new' && pasteAmount > 0 && (
        <mesh position={[0, 0, 0.46]} scale={[0.46 * Math.cbrt(pasteAmount), 0.46 * Math.cbrt(pasteAmount), 0.3 * Math.cbrt(pasteAmount)]} geometry={pasteBlob()} material={M.newPaste()} />
      )}
    </group>
  );
};

// ===========================================================================
// БАШЕННЫЙ КУЛЕР. Основание в z=0 (на крышке CPU), рёбра параллельны плате,
// вентилятор на грани +X, поток воздуха к задней панели (−X).
// ===========================================================================
export const TowerCooler: React.FC<{fanAngle: number; fanBlur?: number; dust?: number; heat?: number; led?: string | null; fan?: boolean}> = ({
  fanAngle,
  fanBlur = 0,
  dust = 0,
  heat = 0,
  led = null,
  fan = true,
}) => {
  const fins = useMemo(() => {
    const n = 46;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(5.0, 12.0, 0.045), M.alu(), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(0, 0, 3.7 + i * 0.26);
      mesh.setMatrixAt(i, m);
    }
    return mesh;
  }, []);
  const heatEdges = useMemo(() => {
    const n = 46;
    const mat = new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: false});
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 12.02, 0.05), mat, n * 2);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++)
      for (let s = 0; s < 2; s++) {
        m.makeTranslation(s ? 2.5 : -2.5, 0, 3.7 + i * 0.26);
        mesh.setMatrixAt(i * 2 + s, m);
      }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 2 * 3), 3);
    return mesh;
  }, []);
  {
    const n = 46;
    const c = new THREE.Color('#ff5a1a');
    for (let i = 0; i < n; i++) {
      const k = heat * (1.6 - (i / n) * 1.3);
      for (let s = 0; s < 2; s++) heatEdges.setColorAt(i * 2 + s, c.clone().multiplyScalar(k));
    }
    if (heatEdges.instanceColor) heatEdges.instanceColor.needsUpdate = true;
  }
  const pipeGeo = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.3, 0, 16.6),
      new THREE.Vector3(-1.3, 0, 3.0),
      new THREE.Vector3(-1.2, 0, 1.4),
      new THREE.Vector3(0, 0, 0.9),
      new THREE.Vector3(1.2, 0, 1.4),
      new THREE.Vector3(1.3, 0, 3.0),
      new THREE.Vector3(1.3, 0, 16.6),
    ]);
    return new THREE.TubeGeometry(path, 120, 0.3, 16, false);
  }, []);
  const pipeYs = [-3.9, -1.3, 1.3, 3.9];
  return (
    <group>
      {/* основание и прижимная планка */}
      <Box s={[4.2, 4.2, 0.6]} p={[0, 0, 0.3]} m={M.nickel()} rad={0.1} />
      <Box s={[4.4, 4.6, 1.0]} p={[0, 0, 1.1]} m={M.darkAlu()} rad={0.15} />
      <Box s={[1.2, 9.4, 0.3]} p={[0, 0, 1.75]} m={M.steel()} rad={0.08} />
      {[-4.4, 4.4].map((y, i) => (
        <mesh key={i} position={[0, y, 1.95]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
          <cylinderGeometry args={[0.32, 0.32, 0.5, 24]} />
        </mesh>
      ))}
      {/* тепловые трубки */}
      {pipeYs.map((y, i) => (
        <mesh key={i} geometry={pipeGeo} material={M.nickel()} position={[i % 2 ? 0.25 : -0.25, y, 0]} />
      ))}
      {/* рёбра */}
      <primitive object={fins} />
      {/* верхняя крышка */}
      <Box s={[5.3, 12.3, 0.45]} p={[0, 0, 15.95]} m={M.coolerCap()} rad={0.2} />
      {led && <Box s={[5.0, 0.12, 0.12]} p={[0, -6.1, 15.95]} m={glow(led, 2.4)} />}
      {/* перегрев: раскалённые кромки рёбер, ярче у основания */}
      {heat > 0.01 && <primitive object={heatEdges} />}
      {/* пыль на входной стороне рёбер */}
      {dust > 0.01 && (
        <mesh position={[2.53, 0, 9.6]} rotation={[0, Math.PI / 2, 0]} material={M.dust()}>
          <planeGeometry args={[12, 12]} />
        </mesh>
      )}
      {fan && (
        <group position={[3.85, 0, 9.6]} rotation={[0, Math.PI / 2, 0]}>
          <Fan angle={fanAngle} blur={fanBlur} dust={dust} led={led} />
        </group>
      )}
    </group>
  );
};

// ===========================================================================
// МОДУЛЬ ПАМЯТИ DDR5 с радиатором и световой планкой. Длина по Y, высота по Z.
// ===========================================================================
export const RamStick: React.FC<{light?: string; lightK?: number}> = ({light = '#67E8FF', lightK = 2.2}) => (
  <group>
    <Box s={[0.1, 13.3, 3.1]} p={[0, 0, 1.55]} m={M.pcbPlain()} />
    <Box s={[0.12, 12.6, 0.35]} p={[0, 0, 0.18]} m={M.gold()} />
    {[-1, 1].map((s) => (
      <group key={s}>
        <Box s={[0.18, 13.3, 3.3]} p={[s * 0.16, 0, 2.0]} m={M.gunmetal()} rad={0.06} />
        <Box s={[0.04, 11.6, 0.08]} p={[s * 0.26, 0, 2.6]} m={M.darkAlu()} />
      </group>
    ))}
    <Box s={[0.42, 13.1, 0.5]} p={[0, 0, 3.85]} m={glow(light, lightK)} rad={0.08} />
  </group>
);

// ===========================================================================
// ВИДЕОКАРТА. Плата в плоскости XZ, контакты внизу (z=0), вентиляторы смотрят в −Y.
// ===========================================================================
export const GPU: React.FC<{fanAngle: number; fanBlur?: number; light?: string; lightK?: number}> = ({fanAngle, fanBlur = 0, light = '#21BFFF', lightK = 2.4}) => (
  <group>
    <Box s={[28.5, 0.16, 11.6]} p={[5.2, 0, 6.6]} m={M.pcbPlain()} />
    <Box s={[8.4, 0.18, 0.9]} p={[0.2, 0, 0.45]} m={M.gold()} />
    {/* бэкплейт */}
    <Box s={[28.5, 0.3, 11.4]} p={[5.2, 0.28, 6.7]} m={M.gunmetal()} rad={0.2} />
    {/* кожух с вентиляторами */}
    <Box s={[29.0, 4.4, 11.8]} p={[5.2, -2.4, 6.7]} m={M.gunmetal()} rad={0.5} />
    {[-4.2, 5.2, 14.6].map((x, i) => (
      <group key={i} position={[x, -4.65, 7.0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={M.rubber()}>
          <circleGeometry args={[4.55, 64]} />
        </mesh>
        <group position={[0, 0, 0.1]} rotation={[0, 0, 0]}>
          <Fan size={9.0} angle={fanAngle + i * 0.7} blur={fanBlur} frame={false} />
        </group>
        <mesh position={[0, 0, 0.05]} material={M.steel()}>
          <ringGeometry args={[4.45, 4.62, 64]} />
        </mesh>
      </group>
    ))}
    {/* световая полоса на верхней кромке (видна через стекло) */}
    <Box s={[26.0, 0.14, 0.14]} p={[5.2, -2.4, 12.63]} m={glow(light, lightK)} />
    <Box s={[26.0, 2.8, 0.06]} p={[5.2, -2.4, 12.6]} m={M.darkAlu()} />
    {/* планка крепления */}
    <Box s={[0.12, 4.6, 12.2]} p={[-9.6, -1.8, 6.4]} m={M.steel()} />
  </group>
);

// ===========================================================================
// M.2 2280 NVMe SSD. Длина по X (контакты в −X), ширина по Y.
// ===========================================================================
export const M2SSD: React.FC<{edgeGlow?: number}> = ({edgeGlow = 0}) => {
  const label = useMemo(() => new THREE.MeshStandardMaterial({map: ssdLabelTexture(), roughness: 0.35, metalness: 0.2}), []);
  const ctrl = useMemo(() => new THREE.MeshStandardMaterial({map: chipTexture('PCM-C5'), roughness: 0.45}), []);
  const nand = useMemo(() => new THREE.MeshStandardMaterial({map: chipTexture('3D-NAND'), roughness: 0.45}), []);
  return (
    <group>
      <mesh material={M.pcbPlain()}>
        <boxGeometry args={[8.0, 2.2, 0.08]} />
      </mesh>
      {/* золотые контакты с ключом M */}
      {Array.from({length: 30}, (_, i) => {
        const y = -1.0 + i * 0.068;
        if (y > 0.33 && y < 0.55) return null;
        return <Box key={i} s={[0.4, 0.04, 0.09]} p={[-3.78, y, 0]} m={M.gold()} />;
      })}
      <mesh position={[4.0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.gold()}>
        <cylinderGeometry args={[0.22, 0.22, 0.09, 24, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh position={[-2.2, 0, 0.1]} material={ctrl}>
        <boxGeometry args={[1.2, 1.2, 0.12]} />
      </mesh>
      {[0.2, 2.2].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.11]} material={nand}>
          <boxGeometry args={[1.6, 1.8, 0.14]} />
        </mesh>
      ))}
      <mesh position={[0.9, 0, 0.19]} material={label}>
        <planeGeometry args={[5.8, 1.6]} />
      </mesh>
      {edgeGlow > 0 && (
        <mesh position={[0, 0, -0.05]} material={glow('#21BFFF', 2.5 * edgeGlow)}>
          <boxGeometry args={[8.06, 2.26, 0.02]} />
        </mesh>
      )}
    </group>
  );
};

// ===========================================================================
// ЖЁСТКИЙ ДИСК 3.5". open=true — без крышки (видна пластина и головка).
// ===========================================================================
export const HDD: React.FC<{open?: boolean; platter?: number; arm?: number; explode?: number}> = ({open = false, platter = 0, arm = 0, explode = 0}) => {
  const ex = explode;
  const L = 14.7;
  const W = 10.16;
  const H = 2.61;
  return (
    <group>
      {/* литой корпус: закрытый — монолит, открытый — ванна со стенками */}
      {!open ? (
        <Box s={[W, L, H - 0.3]} p={[0, 0, (H - 0.3) / 2]} m={M.castAlu()} rad={0.3} />
      ) : (
        <>
          <Box s={[W, L, 0.7]} p={[0, 0, 0.35]} m={M.castAlu()} rad={0.3} />
          <Box s={[W, 0.45, H - 0.3]} p={[0, L / 2 - 0.22, (H - 0.3) / 2]} m={M.castAlu()} />
          <Box s={[W, 0.45, H - 0.3]} p={[0, -L / 2 + 0.22, (H - 0.3) / 2]} m={M.castAlu()} />
          <Box s={[0.45, L, H - 0.3]} p={[W / 2 - 0.22, 0, (H - 0.3) / 2]} m={M.castAlu()} />
          <Box s={[0.45, L, H - 0.3]} p={[-W / 2 + 0.22, 0, (H - 0.3) / 2]} m={M.castAlu()} />
        </>
      )}
      {/* плата электроники снизу */}
      <Box s={[W - 1.2, L - 4.0, 0.12]} p={[0, -1.0, -0.06 - ex * 5]} m={M.pcbPlain()} />
      {!open && (
        <group position={[0, 0, H - 0.3 + ex * 4]}>
          <Box s={[W - 0.3, L - 0.3, 0.12]} p={[0, 0, 0.06]} m={M.alu()} rad={0.25} />
          {/* штамповка крышки */}
          <mesh position={[0, 2.2, 0.13]} rotation={[Math.PI / 2, 0, 0]} material={M.alu()}>
            <cylinderGeometry args={[4.7, 4.7, 0.06, 96]} />
          </mesh>
          <mesh position={[0, 2.2, 0.19]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
            <cylinderGeometry args={[0.7, 0.7, 0.08, 48]} />
          </mesh>
          {/* нейтральная наклейка без брендов */}
          <Box s={[7.6, 4.2, 0.02]} p={[0, -4.6, 0.13 + ex * 3]} m={memo('hddLabel', () => new THREE.MeshStandardMaterial({color: '#d9dde2', roughness: 0.7}))} />
          {Array.from({length: 26}, (_, i) => (
            <Box key={i} s={[i % 3 ? 0.06 : 0.12, 1.0, 0.01]} p={[-2.0 + i * 0.16, -5.6, 0.145 + ex * 3]} m={M.rubber()} />
          ))}
          {/* винты */}
          {[
            [-4.6, 6.9],
            [4.6, 6.9],
            [-4.6, -6.9],
            [4.6, -6.9],
            [-4.6, 0],
            [4.6, 0],
          ].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.16 + ex * 6]} rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
              <cylinderGeometry args={[0.24, 0.24, 0.1, 6]} />
            </mesh>
          ))}
        </group>
      )}
      {open && (
        <group position={[0, 0, 0.8]}>
          <Box s={[W - 0.8, L - 0.8, 0.05]} p={[0, 0, 0]} m={M.darkAlu()} />
          {/* пластина */}
          <group position={[0, 2.2, 0.3]} rotation={[0, 0, platter]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={M.chrome()}>
              <cylinderGeometry args={[4.75, 4.75, 0.12, 128]} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]} material={M.steel()}>
              <cylinderGeometry args={[1.3, 1.3, 0.14, 48]} />
            </mesh>
            {Array.from({length: 6}, (_, i) => (
              <mesh key={i} position={[Math.cos((i * Math.PI) / 3) * 0.85, Math.sin((i * Math.PI) / 3) * 0.85, 0.22]} rotation={[Math.PI / 2, 0, 0]} material={M.chipBody()}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 6]} />
              </mesh>
            ))}
          </group>
          {/* блок головок */}
          <group position={[3.6, -4.4, 0.45]} rotation={[0, 0, 2.05 + arm]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={M.steel()}>
              <cylinderGeometry args={[0.55, 0.55, 0.6, 32]} />
            </mesh>
            <Box s={[5.6, 0.7, 0.08]} p={[2.8, 0, 0.1]} m={M.steel()} />
            <Box s={[1.4, 0.35, 0.06]} p={[6.1, 0, 0.1]} m={M.steel()} />
            <Box s={[0.25, 0.2, 0.1]} p={[6.75, 0, 0.0]} m={M.chipBody()} />
            <Box s={[1.6, 1.6, 0.3]} p={[-1.2, 0, 0]} m={M.copper()} />
          </group>
          <Box s={[2.8, 2.4, 0.6]} p={[3.4, -6.3, 0.3]} m={M.nickel()} rad={0.2} />
        </group>
      )}
    </group>
  );
};

// ===========================================================================
// КОРПУС MID-TOWER вокруг платы (плата в плоскости XY, z=0).
// ===========================================================================
export const CASE = {x0: -14.6, x1: 24, y0: -23, y1: 17.5, z0: -2.6, z1: 21};
export const PCCase: React.FC<{glass?: number; light?: string; lightK?: number; fanAngle?: number; assemble?: number; glassIn?: number}> = ({
  glass = 1,
  light = '#21BFFF',
  lightK = 2.2,
  fanAngle = 0,
  assemble = 1,
  glassIn = 1,
}) => {
  const o = 1 - assemble; // смещение панелей при сборке
  const gz = (1 - glassIn) * 40;
  const {x0, x1, y0, y1, z0, z1} = CASE;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const b = 0.8; // сечение рамы
  const beams: [V3, V3][] = [];
  for (const y of [y0, y1]) for (const z of [z0, z1]) beams.push([[cx, y, z], [w, b, b]]);
  for (const x of [x0, x1]) for (const z of [z0, z1]) beams.push([[x, cy, z], [b, h, b]]);
  for (const x of [x0, x1]) for (const y of [y0, y1]) beams.push([[x, y, cz], [b, b, d]]);
  const glassMat = useMemo(() => (M.glass() as THREE.MeshPhysicalMaterial).clone(), []);
  glassMat.opacity = 0.16 * glass;
  return (
    <group>
      {beams.map(([p, s], i) => (
        <Box key={i} s={s} p={[p[0], p[1], p[2] - o * 30]} m={M.gunmetal()} />
      ))}
      {/* задняя стенка (поддон платы) */}
      <Box s={[w, h, 0.2]} p={[cx, cy, z0 - o * 30]} m={M.plastic()} />
      {/* верх и низ */}
      <Box s={[w, 0.2, d]} p={[cx, y1 + o * 30, cz]} m={M.plastic()} />
      <Box s={[w, 0.2, d]} p={[cx, y0 - o * 30, cz]} m={M.plastic()} />
      {/* кожух блока питания */}
      <Box s={[w - 0.4, 6.4, d - 0.4]} p={[cx, y0 + 3.3 - o * 24, cz]} m={M.gunmetal()} rad={0.3} />
      <Box s={[w - 2, 0.1, 0.1]} p={[cx, y0 + 6.52 - o * 24, z1 - 0.4]} m={glow(light, lightK * 0.7)} />
      {/* фронтальная сетка с тремя вентиляторами */}
      <Box s={[0.3, h, d]} p={[x1 + o * 30, cy, cz]} m={M.plastic()} />
      {[-9.5, 2.5, 14.5].map((y, i) => (
        <group key={i} position={[x1 - 1.6 + o * 30, y - 3, cz]} rotation={[0, -Math.PI / 2, 0]}>
          <Fan angle={fanAngle + i} led={light} ledK={lightK} blur={0} />
        </group>
      ))}
      {/* задний вентилятор */}
      <group position={[x0 + 1.5 - o * 30, 9.5, 8]} rotation={[0, Math.PI / 2, 0]}>
        <Fan angle={-fanAngle} led={light} ledK={lightK * 0.8} />
      </group>
      {/* вертикальная световая линия фронта */}
      <Box s={[0.12, h - 3, 0.12]} p={[x1 + 0.2 + o * 30, cy, z1 - 0.2]} m={glow(light, lightK)} />
      {/* стеклянная боковина */}
      {glass > 0.01 && (
        <mesh position={[cx, cy, z1 + 0.45 + gz]} material={glassMat}>
          <boxGeometry args={[w, h, 0.4]} />
        </mesh>
      )}
    </group>
  );
};

// ===========================================================================
// НОУТБУК. Основание в плоскости XY, экран — текстура screen.
// ===========================================================================
export const Laptop: React.FC<{screen: THREE.Texture | null; lid?: number; edge?: string}> = ({screen, lid = 1.29, edge = '#21BFFF'}) => {
  const keys = useMemo(() => {
    const mesh = new THREE.InstancedMesh(roundedBox(1.55, 1.55, 0.2, 0.18, 0.04), M.plastic(), 78);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 13; c++) {
        m.makeTranslation(-11.4 + c * 1.9, 3.6 - r * 1.85 + 4.0, 0.95);
        mesh.setMatrixAt(i++, m);
      }
    return mesh;
  }, []);
  const scrMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#d8dde4'}), []);
  scrMat.map = screen;
  scrMat.needsUpdate = true;
  return (
    <group>
      <mesh geometry={roundedBox(31, 22, 1.6, 0.9, 0.25)} position={[0, 0, 0.0]} material={M.darkAlu()} />
      <Box s={[26, 12, 0.08]} p={[0, 4.5, 0.8]} m={M.rubber()} />
      <primitive object={keys} />
      <Box s={[11, 6.8, 0.04]} p={[0, -6.6, 0.81]} m={M.gunmetal()} rad={0.4} />
      <group position={[0, 11, 0.8]} rotation={[lid, 0, 0]}>
        <mesh geometry={roundedBox(31, 21, 0.6, 0.9, 0.2)} position={[0, 10.5, -0.3]} material={M.darkAlu()} />
        <Box s={[30.2, 20.2, 0.02]} p={[0, 10.5, 0.01]} m={M.rubber()} />
        <mesh position={[0, 10.8, 0.03]} material={scrMat}>
          <planeGeometry args={[29, 18.4]} />
        </mesh>
        <Box s={[29, 0.06, 0.03]} p={[0, 1.4, 0.03]} m={glow(edge, 1.6)} />
      </group>
    </group>
  );
};

export const BOARD_SIZE = {W: BOARD_W, H: BOARD_H};
