// Cinematic low-poly terrain of Poland: plains in the north, ridged mountains along the southern border,
// neon border draped on the relief, Vistula, glowing cities, rain and clouds over the mountains.
import * as THREE from 'three';
import { rnd } from '../../promo/src/kit.js';

export const PL = [[14.12,53.9],[15.5,54.2],[16.5,54.55],[17.6,54.8],[18.4,54.83],[18.6,54.43],[19.6,54.45],[20.5,54.38],[21.5,54.33],[22.8,54.36],[23.5,54.1],[23.6,53.6],[23.9,53.15],[23.6,52.6],[23.2,52.25],[23.6,51.9],[23.6,51.5],[24.1,50.85],[23.6,50.4],[22.7,49.6],[22.6,49.08],[22.0,49.2],[21.0,49.38],[20.3,49.4],[19.9,49.2],[19.4,49.6],[18.85,49.5],[18.0,50.0],[17.6,50.25],[16.9,50.45],[16.6,50.15],[16.2,50.6],[15.3,50.85],[14.8,50.87],[14.95,51.45],[14.7,52.08],[14.6,52.6],[14.15,52.85],[14.3,53.25]];
const K = 1.1;
export const xz = (lon, lat) => [(lon - 19) * K, -(lat - 52) * K * 1.62];
export const CITIES = [['Варшава', 21.01, 52.23], ['Гданськ', 18.65, 54.35], ['Краків', 19.94, 50.06], ['Міжздроє', 14.48, 53.93], ['Миколайки', 21.59, 53.80], ['Оструда', 19.96, 53.70]];
const VISTULA = [[19.9, 50.05], [20.6, 50.4], [21.6, 51.2], [21.4, 51.8], [21.0, 52.25], [20.4, 52.4], [19.6, 52.6], [18.8, 53.05], [18.7, 53.6], [18.95, 54.3]];

// value noise + fbm (deterministic)
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y, o = 5) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= .5; } return s; };
const ridged = (x, y, o = 5) => { let s = 0, a = .55, f = 1; for (let i = 0; i < o; i++) { s += a * Math.pow(1 - Math.abs(noise(x * f, y * f) * 2 - 1), 2); f *= 2.1; a *= .5; } return s; };

// southern border z(x): interpolate the border points from the east corner to the west corner
const SOUTH = PL.slice(17, 34).map(([lo, la]) => xz(lo, la)).sort((a, b) => a[0] - b[0]);
const southZ = x => { if (x <= SOUTH[0][0]) return SOUTH[0][1]; for (let i = 0; i < SOUTH.length - 1; i++) { const [x0, z0] = SOUTH[i], [x1, z1] = SOUTH[i + 1];
  if (x <= x1) return z0 + (z1 - z0) * (x - x0) / (x1 - x0); } return SOUTH.at(-1)[1]; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const [TX, TZ] = xz(20.0, 49.25); // Tatras
export function height(x, z) {
  const zb = southZ(x);
  const mask = smooth(zb - 1.6, zb + .1, z) * (1 - smooth(zb + 3.5, zb + 6, z));
  const tatra = Math.exp(-((x - TX) ** 2) / 2.2 - ((z - TZ) ** 2) / 1.4);
  const mtn = mask * (ridged(x * .55 + 7, z * .55 + 3) * (1.35 + 1.9 * tatra) - .2);
  const plains = (fbm(x * .35, z * .35) - .45) * .18;
  return Math.max(-.05, plains + Math.max(0, mtn));
}

export function makeTerrainWorld(env) {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = .25;
  scene.fog = new THREE.FogExp2(0x0b1220, .028);
  scene.add(new THREE.HemisphereLight(0x8fa6c8, 0x070b14, .7));
  const moon = new THREE.DirectionalLight(0xd2ddf2, 1.6); moon.position.set(-8, 10, -6); scene.add(moon);
  const rim = new THREE.DirectionalLight(0x6d8fbf, .5); rim.position.set(8, 4, 10); scene.add(rim);

  // terrain mesh, flat-shaded facets, height-based colour
  const SIZE_X = 22, SIZE_Z = 24, SEG = 300;
  const g = new THREE.PlaneGeometry(SIZE_X, SIZE_Z, SEG, SEG); g.rotateX(-Math.PI / 2); g.translate(0, 0, 1.5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  const pos = ng.attributes.position, col = new Float32Array(pos.count * 3), nrm = ng.attributes.normal;
  const c = new THREE.Color(), lowC = new THREE.Color(0x111a28), midC = new THREE.Color(0x26324a), hiC = new THREE.Color(0x56627a), snowC = new THREE.Color(0xcfd7e3);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, slope = 1 - nrm.getY(i);
    if (y < .25) c.copy(lowC).lerp(midC, Math.max(0, y) / .25);
    else if (y < 1.25) c.copy(midC).lerp(hiC, (y - .25) / 1);
    else c.copy(hiC).lerp(snowC, Math.min(1, (y - 1.25) / .45));
    if (y > 1.35 && slope < .45) c.lerp(snowC, .8);
    c.offsetHSL(0, 0, (rnd(i * .13) - .5) * .025);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const terrain = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .92, metalness: 0 }));
  scene.add(terrain);

  // neon border draped on the relief + soft glow copy
  const drape = (pts, lift = .04) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    for (let k = 0; k < 10; k++) { const x = x0 + (x1 - x0) * k / 10, z = z0 + (z1 - z0) * k / 10; out.push(new THREE.Vector3(x, height(x, z) + lift, z)); } }
    const [lx, lz] = pts.at(-1); out.push(new THREE.Vector3(lx, height(lx, lz) + lift, lz)); return out; };
  const border = PL.map(([lo, la]) => xz(lo, la)); border.push(border[0]);
  const bpts = drape(border);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bpts), new THREE.LineBasicMaterial({ color: 0xb6ff3c, toneMapped: false })));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bpts), 900, .007, 4), new THREE.MeshBasicMaterial({ color: 0xb6ff3c, toneMapped: false, transparent: true, opacity: .35 }));
  scene.add(tube);
  // Vistula
  const vpts = drape(VISTULA.map(([lo, la]) => xz(lo, la)), .02);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vpts), new THREE.LineBasicMaterial({ color: 0x7f9cc4, transparent: true, opacity: .7 })));
  // cities: glowing points with soft halos
  const halo = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(182,255,60,1)'); gr.addColorStop(.25, 'rgba(182,255,60,.45)'); gr.addColorStop(1, 'rgba(182,255,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
  const cities = CITIES.map(([n, lo, la]) => { const [x, z] = xz(lo, la), y = height(x, z);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.position.set(x, y + .04, z); s.scale.setScalar(.22); s.material.opacity = .8; scene.add(s);
    // little cluster of city lights
    const lp = new Float32Array(60 * 3); for (let i = 0; i < 60; i++) { const a = rnd(i + x) * 6.28, r = Math.pow(rnd(i * 3 + z), 1.5) * .28; lp.set([x + Math.cos(a) * r, y + .02, z + Math.sin(a) * r], i * 3); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xf2f0e6, size: .025, transparent: true, opacity: .9, toneMapped: false })));
    return { name: n, sprite: s, top: new THREE.Vector3(x, y + .35, z) }; });
  // rain + clouds over the mountains
  const RN = 2600, rp = new Float32Array(RN * 6), base = [];
  for (let i = 0; i < RN; i++) base.push([TX + (rnd(i) - .5) * 14, rnd(i + 1) * 6, TZ - 1.5 + (rnd(i + 2) - .5) * 6]);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  scene.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb0c8, transparent: true, opacity: .4 })));
  const ctex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(140,155,180,.5)'); gr.addColorStop(1, 'rgba(140,155,180,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
  const clouds = []; for (let i = 0; i < 22; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, opacity: .22 }));
    s.scale.set(4 + rnd(i) * 4, 1.2 + rnd(i + 1), 1); s.position.set(TX + (rnd(i + 2) - .5) * 16, 3.4 + rnd(i + 3) * 1.6, TZ - 1 + (rnd(i + 4) - .5) * 7); scene.add(s); clouds.push(s); }
  const update = t => {
    for (let i = 0; i < RN; i++) { const [x, y0, z] = base[i]; const y = ((y0 - t * 6 + 60) % 6) + .1; rp.set([x, y, z, x - .03, y + .25, z], i * 6); }
    rg.attributes.position.needsUpdate = true;
    clouds.forEach((c, i) => { c.position.x += Math.sin(t * .15 + i) * .0015; });
    cities.forEach((c, i) => c.sprite.scale.setScalar(.22 + Math.sin(t * 2.2 + i) * .025));
  };
  return { scene, update, cities, TX, TZ };
}
