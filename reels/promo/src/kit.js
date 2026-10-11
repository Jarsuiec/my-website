// Shared helpers: easing, timing, three.js renderer with reflections + bloom, materials, canvas textures.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = x => 1 - Math.pow(1 - x, 3);
export const easeIn = x => x * x * x;
export const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const expoOut = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
export const backOut = (x, c = 1.7) => 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
export const rnd = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
// value that pops in at a, out at b (with fade lengths)
export const win = (t, a, b, fi = .25, fo = .25) => t < a || t > b ? 0 : Math.min(easeOut(prog(t, a, a + fi)), 1 - easeIn(prog(t, b - fo, b)));
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const COL = { blue: 0x2e8bff, cyan: 0x22e4d4, orange: 0xff7a2f, green: 0x36f28b, red: 0xff3b3b, white: 0xf2f5f7 };

// ---------- three.js ----------
export const RENDER_SCALE = .6; // internal resolution (UI text stays crisp in DOM)
export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(1080 * RENDER_SCALE, 1920 * RENDER_SCALE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  return { renderer, env };
}
export function makeComposer(renderer, scene, camera, bloom = { strength: .9, radius: .55, threshold: .82 }) {
  const size = new THREE.Vector2(1080 * RENDER_SCALE, 1920 * RENDER_SCALE);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const bp = new UnrealBloomPass(size, bloom.strength, bloom.radius, bloom.threshold);
  composer.addPass(bp);
  composer.addPass(new OutputPass());
  return { composer, bloom: bp };
}

export const mat = {
  metal: (color = 0x9aa3ad, rough = .32) => new THREE.MeshStandardMaterial({ color, metalness: .9, roughness: rough }),
  dark: (color = 0x15191f, rough = .55) => new THREE.MeshStandardMaterial({ color, metalness: .35, roughness: rough }),
  plastic: (color = 0x1b1f25, rough = .45) => new THREE.MeshStandardMaterial({ color, metalness: .05, roughness: rough }),
  glow: (color, intensity = 3) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xaecbe6, metalness: 0, roughness: .05, transparent: true, opacity: .12, clearcoat: 1 }),
};

// canvas → texture helper
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, ctx, canvas: c };
}

// deterministic camera shake (smooth, so motion blur blends cleanly)
export const shake = (t, amp) => [Math.sin(t * 31) * amp, Math.cos(t * 27) * amp * .8];
