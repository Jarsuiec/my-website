import React, {useMemo} from 'react';
import * as THREE from 'three';
import {rng} from './textures';

// «Игра» на мониторе: ночная гонка по горной трассе на закате. Мир Z-вверх, дорога вдоль +Y.
const noise2 = (x: number, y: number) => {
  const s = Math.sin(x * 0.11 + Math.cos(y * 0.07) * 2.1) * Math.cos(y * 0.09 + Math.sin(x * 0.05) * 1.7);
  const d = Math.sin(x * 0.31 + y * 0.17) * 0.35 + Math.sin(x * 0.67 - y * 0.41) * 0.15;
  return s + d;
};

export const GameWorld: React.FC<{y: number}> = ({y}) => {
  const terrain = useMemo(() => {
    const g = new THREE.PlaneGeometry(600, 900, 150, 220);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const yy = p.getY(i);
      const valley = Math.min(1, Math.max(0, (Math.abs(x) - 14) / 60));
      const h = (noise2(x, yy) * 0.5 + 0.6) * 38 * valley * valley + Math.max(0, Math.abs(x) - 140) * 0.4;
      p.setZ(i, h - 0.3);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const terrainMat = useMemo(() => new THREE.MeshStandardMaterial({color: '#141a33', roughness: 0.9, flatShading: true}), []);
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({color: '#0c0f16', roughness: 0.55, metalness: 0.2}), []);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({color: new THREE.Color('#ffd9a0').multiplyScalar(1.6), toneMapped: false}), []);
  const postMat = useMemo(() => new THREE.MeshBasicMaterial({color: new THREE.Color('#ff6a3b').multiplyScalar(2.2), toneMapped: false}), []);
  const postMatB = useMemo(() => new THREE.MeshBasicMaterial({color: new THREE.Color('#67E8FF').multiplyScalar(2.2), toneMapped: false}), []);
  const skyMat = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#05081a');
    gr.addColorStop(0.55, '#1b2350');
    gr.addColorStop(0.8, '#7a3a48');
    gr.addColorStop(0.93, '#e0704a');
    gr.addColorStop(1, '#ffb070');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({map: t, fog: false, side: THREE.BackSide});
  }, []);
  const posts = useMemo(() => {
    const r = rng(4);
    return Array.from({length: 120}, (_, i) => ({yy: i * 7.5, side: i % 2 ? 1 : -1, h: 0.9 + r() * 0.2}));
  }, []);
  // Повторяем мир по кругу, чтобы ехать бесконечно
  const loop = 900;
  const off = Math.floor(y / loop) * loop;
  return (
    <group>
      <mesh material={skyMat} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[700, 32, 16]} />
      </mesh>
      {[off - loop, off, off + loop].map((o) => (
        <group key={o} position={[0, o + 450, 0]}>
          <mesh geometry={terrain} material={terrainMat} />
          <mesh material={roadMat} position={[0, 0, 0.02]}>
            <planeGeometry args={[14, 900]} />
          </mesh>
          {Array.from({length: 150}, (_, i) => (
            <mesh key={i} material={lineMat} position={[0, -450 + i * 6, 0.05]}>
              <planeGeometry args={[0.18, 2.6]} />
            </mesh>
          ))}
          {posts.map((p, i) => (
            <mesh key={'p' + i} material={p.side > 0 ? postMat : postMatB} position={[p.side * 7.6, -450 + p.yy, p.h / 2]}>
              <boxGeometry args={[0.12, 0.12, p.h]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
