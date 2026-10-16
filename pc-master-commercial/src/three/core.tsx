import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/examples/jsm/postprocessing/BokehPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {boardTraces, BOARD_W, BOARD_H, softDot, rng} from './textures';

export type V3 = [number, number, number];

// Камера задаётся покадрово: позиция, точка взгляда, фокусное, крен.
export const Cam: React.FC<{pos: V3; target: V3; fov?: number; roll?: number; near?: number; far?: number; up?: V3}> = ({
  pos,
  target,
  fov = 35,
  roll = 0,
  near = 0.1,
  far = 400,
  up,
}) => {
  const {camera} = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...pos);
    if (up) cam.up.set(...up);
    else cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(...target);
    cam.fov = fov;
    cam.near = near;
    cam.far = far;
    cam.updateProjectionMatrix();
  });
  return null;
};

// Студийное окружение для отражений: тёмная комната с софтбоксами.
// mood: cold — голубые полосы света, hot — оранжевые (перегрев), neutral — белые.
export type Mood = 'cold' | 'hot' | 'neutral' | 'studio';
export const StudioEnv: React.FC<{mood?: Mood; intensity?: number}> = ({mood = 'cold', intensity = 1}) => {
  const {gl, scene} = useThree();
  const tex = useMemo(() => {
    const s = new THREE.Scene();
    s.background = new THREE.Color('#020306');
    const panel = (w: number, h: number, color: string, k: number, pos: V3, look: V3 = [0, 0, 0]) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k * intensity), side: THREE.DoubleSide})
      );
      m.position.set(...pos);
      m.lookAt(...look);
      s.add(m);
    };
    // Мир сцены — Z вверх (плата лежит в плоскости XY), поэтому софтбоксы расставлены относительно +Z.
    const key = mood === 'hot' ? '#ffd2b0' : mood === 'cold' ? '#e6f6ff' : '#ffffff';
    // studio — нейтральная предметная съёмка: без цветных полос, металл остаётся серебристым
    const rim = mood === 'hot' ? '#ff6a2a' : mood === 'studio' ? '#d9dee6' : '#21bfff';
    const rim2 = mood === 'hot' ? '#ffb070' : mood === 'studio' ? '#f2f2f2' : '#67e8ff';
    panel(9, 4, key, 0.85, [0, 0, 10]); // верхний софтбокс
    panel(16, 1.6, '#ffffff', 1.3, [0, -10, 5]); // полоса спереди-сверху — блики на горизонтальном металле
    panel(16, 1.6, key, 0.9, [0, 10, 5]);
    panel(2.2, 14, rim, 4.0, [-10, 0, 3]); // цветной контровой слева
    panel(2.2, 14, rim2, 2.6, [10, 0, 3]);
    panel(30, 30, '#0d1726', 0.6, [0, 0, -10]); // пол
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(s, 0.02);
    pm.dispose();
    return rt.texture;
  }, [gl, mood, intensity]);
  useLayoutEffect(() => {
    scene.environment = tex;
    return () => {
      scene.environment = null;
    };
  }, [scene, tex]);
  return null;
};

// Радиальное размытие движения (zoom blur) для резких наездов камеры и speed ramp.
const ZoomBlurShader = {
  uniforms: {tDiffuse: {value: null}, strength: {value: 0}, center: {value: new THREE.Vector2(0.5, 0.5)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float strength; uniform vec2 center; varying vec2 vUv;
    void main(){
      vec2 dir = vUv - center;
      vec4 acc = vec4(0.0); float tot = 0.0;
      for (int i = 0; i < 20; i++) {
        float t = float(i) / 19.0;
        float w = 1.0 - t * 0.6;
        acc += texture2D(tDiffuse, vUv - dir * strength * t) * w;
        tot += w;
      }
      gl_FragColor = acc / tot;
    }`,
};

// Постобработка: bloom для свечения и, при необходимости, глубина резкости и zoom blur.
export const Post: React.FC<{
  bloom?: number;
  radius?: number;
  threshold?: number;
  focus?: number; // расстояние фокуса в см (0 = без DOF)
  aperture?: number;
  maxblur?: number;
  zoom?: number; // сила радиального размытия 0..~0.25
  zoomCenter?: [number, number];
}> = ({bloom = 0.9, radius = 0.55, threshold = 0.62, focus = 0, aperture = 0.0025, maxblur = 0.012, zoom = -1, zoomCenter = [0.5, 0.5]}) => {
  const {gl, scene, camera, size} = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    if (focus > 0) {
      const b = new BokehPass(scene, camera, {focus, aperture, maxblur});
      c.addPass(b);
    }
    const bp = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), bloom, radius, threshold);
    c.addPass(bp);
    if (zoom >= 0) c.addPass(new ShaderPass(ZoomBlurShader));
    c.addPass(new OutputPass());
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, focus > 0, zoom >= 0]);
  useLayoutEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(1);
  }, [composer, size]);
  useLayoutEffect(() => {
    for (const p of composer.passes) {
      if (p instanceof UnrealBloomPass) {
        p.strength = bloom;
        p.radius = radius;
        p.threshold = threshold;
      }
      if (p instanceof ShaderPass && (p.uniforms as Record<string, {value: unknown}>).strength) {
        const u = p.uniforms as Record<string, {value: unknown}>;
        u.strength.value = Math.max(0, zoom);
        (u.center.value as THREE.Vector2).set(zoomCenter[0], zoomCenter[1]);
        p.enabled = zoom > 0.002;
      }
      if (p instanceof BokehPass) {
        const u = (p as unknown as {uniforms: Record<string, {value: number}>}).uniforms;
        u.focus.value = focus;
        u.aperture.value = aperture;
        u.maxblur.value = maxblur;
      }
    }
  });
  useFrame(() => composer.render(), 1);
  return null;
};

// Импульсы энергии, бегущие по дорожкам платы. t — время в секундах.
export const TracePulses: React.FC<{t: number; color?: string; count?: number; speed?: number; opacity?: number; z?: number}> = ({
  t,
  color = '#67E8FF',
  count = 60,
  speed = 6,
  opacity = 1,
  z = 0.03,
}) => {
  const traces = boardTraces();
  const r = useMemo(() => rng(99), []);
  const seeds = useMemo(() => Array.from({length: count}, () => ({tr: Math.floor(r() * traces.length), ph: r(), sp: 0.6 + r() * 0.8})), [count, r, traces.length]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(3),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color]
  );
  mat.opacity = opacity;
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.035, 0.5, 4, 8), []);
  if (opacity <= 0.001) return null;
  return (
    <group>
      {seeds.map((s, i) => {
        const tr = traces[s.tr];
        const d = ((s.ph * tr.len + t * speed * s.sp) % (tr.len + 3)) - 0.5;
        if (d < 0 || d > tr.len) return null;
        // точка на ломаной
        let acc = 0;
        for (let k = 1; k < tr.pts.length; k++) {
          const [x0, y0] = tr.pts[k - 1];
          const [x1, y1] = tr.pts[k];
          const l = Math.hypot(x1 - x0, y1 - y0);
          if (acc + l >= d) {
            const u = (d - acc) / l;
            const ang = Math.atan2(y1 - y0, x1 - x0);
            return (
              <mesh key={i} geometry={geo} material={mat} position={[x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z]} rotation={[0, 0, ang - Math.PI / 2]} />
            );
          }
          acc += l;
        }
        return null;
      })}
    </group>
  );
};

// Частицы: пыль в луче света / тёплые искры / холодная взвесь.
export const Particles: React.FC<{
  t: number;
  count?: number;
  box?: [V3, V3];
  color?: string;
  size?: number;
  drift?: V3;
  opacity?: number;
  seed?: number;
}> = ({t, count = 300, box = [[-15, -15, 0], [15, 15, 12]], color = '#9fb4c8', size = 0.25, drift = [0, 0, 0.3], opacity = 0.6, seed = 5}) => {
  const base = useMemo(() => {
    const r = rng(seed);
    return Array.from({length: count}, () => [r(), r(), r(), r()]);
  }, [count, seed]);
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const pos = useMemo(() => new Float32Array(count * 3), [count]);
  const [a, b] = box;
  for (let i = 0; i < count; i++) {
    const [u, v, w, p] = base[i];
    const sx = b[0] - a[0];
    const sy = b[1] - a[1];
    const sz = b[2] - a[2];
    const wob = Math.sin(t * (0.7 + p) + p * 20) * 0.3;
    pos[i * 3] = a[0] + ((u * sx + drift[0] * t * (0.5 + p) + wob) % sx + sx) % sx;
    pos[i * 3 + 1] = a[1] + ((v * sy + drift[1] * t * (0.5 + p)) % sy + sy) % sy;
    pos[i * 3 + 2] = a[2] + ((w * sz + drift[2] * t * (0.5 + p) + wob * 0.5) % sz + sz) % sz;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.attributes.position.needsUpdate = true;
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: softDot(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    []
  );
  mat.color.set(color);
  mat.size = size;
  mat.opacity = opacity;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};

export const BOARD = {W: BOARD_W, H: BOARD_H};
