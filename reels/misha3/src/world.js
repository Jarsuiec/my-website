// Low-poly monochrome world: Poland map with southern mountains, rain, dancing bear, hotel, people, car, phone.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rnd } from '../../promo/src/kit.js';

export const PAL = { bg: 0x0b1220, navy: 0x121c2e, slate: 0x253247, gray: 0x6f7a8c, light: 0xdfe5ee, neon: 0xb6ff3c, snow: 0xdde4ec };
const flat = (color, rough = .85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });
const glow = (color, i = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: i });
const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };

const PL = [[14.12,53.9],[15.5,54.2],[16.5,54.55],[17.6,54.8],[18.4,54.83],[18.6,54.43],[19.6,54.45],[20.5,54.38],[21.5,54.33],[22.8,54.36],[23.5,54.1],[23.6,53.6],[23.9,53.15],[23.6,52.6],[23.2,52.25],[23.6,51.9],[23.6,51.5],[24.1,50.85],[23.6,50.4],[22.7,49.6],[22.6,49.08],[22.0,49.2],[21.0,49.38],[20.3,49.4],[19.9,49.2],[19.4,49.6],[18.85,49.5],[18.0,50.0],[17.6,50.25],[16.9,50.45],[16.6,50.15],[16.2,50.6],[15.3,50.85],[14.8,50.87],[14.95,51.45],[14.7,52.08],[14.6,52.6],[14.15,52.85],[14.3,53.25]];
const K = 1.1;
export const geo2xz = (lon, lat) => [(lon - 19) * K, -(lat - 52) * K * 1.62];
export const MAP_Y = .25;
export const CITIES = [['Варшава', 21.01, 52.23], ['Гданськ', 18.65, 54.35], ['Краків', 19.94, 50.06], ['Міжздроє', 14.48, 53.93], ['Миколайки', 21.59, 53.80], ['Оструда', 19.96, 53.70]];

function gridTex(size = 1024, step = 32, line = 'rgba(120,150,190,.16)', bg = '#16202f') {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, size, size); x.strokeStyle = line; x.lineWidth = 2;
  for (let i = 0; i <= size; i += step) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, size); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(size, i); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------- characters ----------------
export function makeBear() {
  const g = new THREE.Group(), fur = flat(0x5b4b42), light = flat(0x8a7566), dark = flat(0x1a1513);
  const body = mesh(new THREE.SphereGeometry(.5, 14, 12), fur); body.scale.set(1, 1.15, .85); body.position.y = .75; g.add(body);
  const belly = mesh(new THREE.SphereGeometry(.34, 12, 10), light); belly.position.set(0, .68, .3); belly.scale.set(1, 1.1, .5); g.add(belly);
  const head = new THREE.Group(); head.position.y = 1.42; g.add(head);
  head.add(mesh(new THREE.SphereGeometry(.36, 14, 12), fur));
  const snout = mesh(new THREE.SphereGeometry(.16, 10, 8), light); snout.position.set(0, -.06, .3); snout.scale.set(1.1, .8, 1); head.add(snout);
  const nose = mesh(new THREE.SphereGeometry(.06, 8, 6), dark); nose.position.set(0, -.02, .45); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(.11, 8, 6), fur); ear.position.set(s * .26, .28, 0); head.add(ear);
    const eye = mesh(new THREE.SphereGeometry(.045, 8, 6), dark); eye.position.set(s * .13, .08, .31); head.add(eye);
  }
  const limb = (x, y, len, r) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const l = mesh(new THREE.CapsuleGeometry(r, len, 4, 8), fur); l.position.y = -len / 2; piv.add(l); g.add(piv); return piv; };
  const armL = limb(-.48, 1.05, .45, .12), armR = limb(.48, 1.05, .45, .12), legL = limb(-.22, .38, .3, .14), legR = limb(.22, .38, .3, .14);
  g.userData = { body, head, armL, armR, legL, legR };
  return g;
}
export function danceBear(b, t) {
  const u = b.userData, beat = t * Math.PI * 2 * 1.7;
  b.position.y = b.userData.baseY + Math.abs(Math.sin(beat)) * .12;
  b.rotation.y = Math.sin(beat * .5) * .5;
  u.body.rotation.z = Math.sin(beat) * .12;
  u.head.rotation.z = Math.sin(beat + 1) * .2; u.head.rotation.x = Math.sin(beat * 2) * .08;
  u.armL.rotation.z = -2.2 - Math.sin(beat) * .7; u.armR.rotation.z = 2.2 - Math.sin(beat + Math.PI) * .7;
  u.legL.rotation.x = Math.sin(beat) * .35; u.legR.rotation.x = -Math.sin(beat) * .35;
}

export function makePerson({ shirt = 0x3a4a62, pants = 0x1c2433, skin = 0xd9b8a0, hair = 0x2a2220, acc = null } = {}) {
  const g = new THREE.Group();
  const leg = x => { const p = new THREE.Group(); p.position.set(x, .42, 0); const l = mesh(new THREE.CapsuleGeometry(.07, .3, 4, 8), flat(pants)); l.position.y = -.2; p.add(l); g.add(p); return p; };
  const legL = leg(-.09), legR = leg(.09);
  const torso = mesh(new THREE.CapsuleGeometry(.15, .28, 4, 10), flat(shirt)); torso.position.y = .66; g.add(torso);
  const head = new THREE.Group(); head.position.y = 1.0; g.add(head);
  head.add(mesh(new THREE.SphereGeometry(.13, 12, 10), flat(skin)));
  const hairM = mesh(new THREE.SphereGeometry(.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55), flat(hair)); hairM.position.y = .02; head.add(hairM);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(.018, 6, 4), flat(0x111111)); e.position.set(s * .045, .01, .12); head.add(e); }
  const smile = mesh(new THREE.TorusGeometry(.04, .009, 4, 10, Math.PI), flat(0x3a2020)); smile.position.set(0, -.04, .123); smile.rotation.z = Math.PI; head.add(smile);
  const arm = x => { const p = new THREE.Group(); p.position.set(x, .8, 0); const a = mesh(new THREE.CapsuleGeometry(.05, .26, 4, 8), flat(shirt)); a.position.y = -.17; p.add(a);
    const h = mesh(new THREE.SphereGeometry(.055, 8, 6), flat(skin)); h.position.y = -.34; p.add(h); g.add(p); return p; };
  const armL = arm(-.21), armR = arm(.21);
  if (acc === 'chef') { const hat = mesh(new THREE.CylinderGeometry(.11, .1, .16, 12), flat(0xf2f4f7)); hat.position.y = .17; head.add(hat);
    const top = mesh(new THREE.SphereGeometry(.14, 12, 8), flat(0xf2f4f7)); top.position.y = .28; top.scale.y = .7; head.add(top); }
  if (acc === 'maid') { const apron = mesh(new RoundedBoxGeometry(.22, .26, .04, 2, .02), flat(0xe8ecf2)); apron.position.set(0, .6, .14); g.add(apron); }
  if (acc === 'night') { const cap = mesh(new THREE.SphereGeometry(.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), flat(0x0f1726)); cap.position.y = .03; head.add(cap);
    const vis = mesh(new THREE.BoxGeometry(.2, .015, .1), flat(0x0f1726)); vis.position.set(0, .03, .14); head.add(vis); const st = mesh(new THREE.BoxGeometry(.06, .06, .01), glow(PAL.neon, 1.6)); st.position.set(.08, .7, .155); g.add(st); }
  if (acc === 'swim') { const ring = mesh(new THREE.TorusGeometry(.2, .05, 8, 16), flat(0xb6ff3c, .6)); ring.rotation.x = Math.PI / 2; ring.position.y = .62; g.add(ring); }
  g.userData = { legL, legR, armL, armR, head, torso };
  return g;
}
export function animPerson(p, t, mode = 'idle', phase = 0) {
  const u = p.userData, s = t * 6 + phase;
  p.position.y = p.userData.baseY || 0;
  u.armL.rotation.z = -.1; u.armR.rotation.z = .1; u.legL.rotation.x = u.legR.rotation.x = 0; u.head.rotation.z = Math.sin(t * 1.3 + phase) * .06;
  if (mode === 'wave') { u.armR.rotation.z = 2.5 + Math.sin(s * 1.4) * .4; }
  if (mode === 'cheer') { const j = Math.max(0, Math.sin(s)); p.position.y += j * .14; u.armL.rotation.z = -2.6 - j * .3; u.armR.rotation.z = 2.6 + j * .3; }
  if (mode === 'walk') { u.legL.rotation.x = Math.sin(s) * .5; u.legR.rotation.x = -Math.sin(s) * .5; u.armL.rotation.x = -Math.sin(s) * .4; u.armR.rotation.x = Math.sin(s) * .4; }
}

export function makeCar() {
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(.9, .22, .42, 3, .06), flat(0xdfe5ee, .4, .3)); body.position.y = .2; g.add(body);
  const cab = mesh(new RoundedBoxGeometry(.48, .2, .38, 3, .06), flat(0x2a3446, .3, .2)); cab.position.set(-.05, .38, 0); g.add(cab);
  for (const [x, z] of [[-.3, .21], [.3, .21], [-.3, -.21], [.3, -.21]]) { const w = mesh(new THREE.CylinderGeometry(.1, .1, .08, 14), flat(0x111418)); w.rotation.x = Math.PI / 2; w.position.set(x, .1, z); g.add(w); }
  for (const z of [-.13, .13]) { const h = mesh(new THREE.BoxGeometry(.02, .05, .08), glow(0xffffff, 3)); h.position.set(.46, .22, z); g.add(h);
    const r = mesh(new THREE.BoxGeometry(.02, .05, .08), glow(PAL.neon, 2)); r.position.set(-.46, .22, z); g.add(r); }
  const strip = mesh(new THREE.BoxGeometry(.9, .02, .43), glow(PAL.neon, 1.2)); strip.position.y = .14; g.add(strip);
  return g;
}

export function makeHotel() {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#1b2433'; x.fillRect(0, 0, 256, 512);
  for (let r = 0; r < 12; r++) for (let k = 0; k < 5; k++) { const lit = rnd(r * 7 + k) < .55; x.fillStyle = lit ? (rnd(r + k * 3) < .25 ? '#b6ff3c' : '#f1efe6') : '#0e141e';
    x.globalAlpha = lit ? .85 : 1; x.fillRect(18 + k * 46, 30 + r * 38, 30, 22); }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .55, roughness: .8 });
  const main = mesh(new THREE.BoxGeometry(.9, 1.7, .6), [mat, mat, flat(0x2a3446), flat(0x2a3446), mat, mat]); main.position.y = .85; g.add(main);
  const wing = mesh(new THREE.BoxGeometry(1.3, .8, .55), [mat, mat, flat(0x2a3446), flat(0x2a3446), mat, mat]); wing.position.set(.9, .4, .05); g.add(wing);
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; const sx = sc.getContext('2d');
  sx.fillStyle = '#b6ff3c'; sx.font = '900 92px Unbounded'; sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText('HOTEL', 256, 68);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.8, .2), new THREE.MeshBasicMaterial({ map: st, transparent: true, toneMapped: false })); sign.position.set(0, 1.82, .31); g.add(sign);
  return g;
}

export function makePhone() {
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(1.0, 2.05, .1, 6, .12), flat(0x12161d, .35, .6)); g.add(body);
  const c = document.createElement('canvas'); c.width = 540; c.height = 1110;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.92, 1.9), new THREE.MeshBasicMaterial({ map: tex, color: 0xa8a8a8 })); scr.position.z = .052; g.add(scr);
  g.userData = { canvas: c, ctx: c.getContext('2d'), tex };
  return g;
}

// ---------------- the map world ----------------
export function makeWorld(env) {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = .35;
  scene.fog = new THREE.FogExp2(PAL.bg, .014);
  scene.add(new THREE.HemisphereLight(0x8fa6c8, 0x0b1220, .55));
  const moon = new THREE.DirectionalLight(0xc8d6ee, 1.4); moon.position.set(-6, 12, 4); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); moon.shadow.bias = -.0005; scene.add(moon);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: (() => { const t = gridTex(1024, 64, 'rgba(110,140,180,.10)', '#0d1522'); t.repeat.set(20, 20); return t; })(), roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // map slab
  const shape = new THREE.Shape(PL.map(([lo, la]) => { const [x, z] = geo2xz(lo, la); return new THREE.Vector2(x, z); }));
  const slab = new THREE.ExtrudeGeometry(shape, { depth: MAP_Y, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2 });
  slab.rotateX(Math.PI / 2); slab.translate(0, MAP_Y, 0);
  const top = gridTex(1024, 40, 'rgba(160,190,230,.14)', '#1a2536'); top.repeat.set(.12, .12);
  const map = new THREE.Mesh(slab, [new THREE.MeshStandardMaterial({ map: top, roughness: .8 }), flat(0x0f1724)]); map.receiveShadow = map.castShadow = true; scene.add(map);
  const edgePts = PL.map(([lo, la]) => { const [x, z] = geo2xz(lo, la); return new THREE.Vector3(x, MAP_Y + .045, z); }); edgePts.push(edgePts[0].clone());
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineBasicMaterial({ color: PAL.neon, toneMapped: false, transparent: true, opacity: .9 }));
  scene.add(edge);
  // mountains along the southern border
  const mts = new THREE.Group(); scene.add(mts);
  const peaks = [];
  for (let i = 0; i < 46; i++) {
    const lon = 15.8 + rnd(i) * 7.2, latB = 49.25 + (lon < 18 ? .9 : lon < 21 ? .1 : .05) + rnd(i + 3) * .6;
    const near = Math.exp(-Math.pow((lon - 20.0) / 1.2, 2));
    const h = .35 + rnd(i + 5) * .5 + near * 1.6, r = .25 + h * .3;
    const [x, z] = geo2xz(lon, latB); const m = mesh(new THREE.ConeGeometry(r, h, 6 + (i % 3)), flat(0x283244)); m.position.set(x, MAP_Y + h / 2, z); m.rotation.y = rnd(i) * 3; mts.add(m);
    if (h > .9) { const cap = mesh(new THREE.ConeGeometry(r * .38, h * .38, 6 + (i % 3)), flat(0xb9c3d1, .7)); cap.position.set(x, MAP_Y + h - h * .19 + .01, z); cap.rotation.y = m.rotation.y; mts.add(cap); }
    peaks.push({ x, z, h });
  }
  const best = peaks.reduce((a, b) => (b.h > a.h ? b : a));
  const bear = makeBear(); bear.scale.setScalar(.36); bear.position.set(best.x, MAP_Y + best.h - .06, best.z); bear.userData.baseY = bear.position.y; scene.add(bear);
  // rain over the mountains + clouds
  const RN = 1800, rp = new Float32Array(RN * 6), rainBase = [];
  for (let i = 0; i < RN; i++) rainBase.push([best.x + (rnd(i) - .5) * 9, rnd(i + 1) * 5, best.z + (rnd(i + 2) - .5) * 5]);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: .35 })); scene.add(rain);
  const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(120,135,160,.35)'); g.addColorStop(1, 'rgba(150,165,190,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const clouds = [];
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: .28 }));
    s.scale.set(3 + rnd(i) * 3, 1.4 + rnd(i + 1), 1); s.position.set(best.x + (rnd(i + 2) - .5) * 10, MAP_Y + 4.2 + rnd(i + 3) * 1.4, best.z + 1 + (rnd(i + 4) - .5) * 4); scene.add(s); clouds.push(s); }
  // cities
  const pins = CITIES.map(([n, lo, la]) => { const [x, z] = geo2xz(lo, la); const g = new THREE.Group(); g.position.set(x, MAP_Y, z);
    const stick = mesh(new THREE.CylinderGeometry(.015, .015, .35, 6), flat(0xdfe5ee)); stick.position.y = .175; g.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), glow(PAL.neon, 2.4)); head.position.y = .38; g.add(head);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.1, .13, 32), new THREE.MeshBasicMaterial({ color: PAL.neon, transparent: true, toneMapped: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .01; g.add(ring);
    g.userData = { ring, name: n, top: new THREE.Vector3(x, MAP_Y + .5, z) }; scene.add(g); return g; });
  // road + car (Gdańsk → Warszawa → Kraków)
  const road = new THREE.CatmullRomCurve3([['Гданськ'], ['Оструда'], ['Варшава'], ['Краків']].map(([n]) => { const c = CITIES.find(c => c[0] === n); const [x, z] = geo2xz(c[1], c[2]); return new THREE.Vector3(x, MAP_Y + .02, z); }));
  const roadMesh = new THREE.Mesh(new THREE.TubeGeometry(road, 120, .03, 6), flat(0x4a5568)); roadMesh.scale.y = .3; roadMesh.position.y = MAP_Y * .7; scene.add(roadMesh);
  const car = makeCar(); car.scale.setScalar(.38); scene.add(car);
  // hotel + people near Warsaw
  const [wx, wz] = geo2xz(21.01, 52.23);
  const hotel = makeHotel(); hotel.position.set(wx + .55, MAP_Y, wz - .55); hotel.scale.setScalar(.75); scene.add(hotel);
  const crew = [{ shirt: 0x4a5a74, acc: 'maid' }, { shirt: 0xe8ecf2, acc: 'chef' }, { shirt: 0x26324a, acc: 'night' }, { shirt: 0x3e5068, acc: 'swim', hair: 0x6b4a2a }, { shirt: 0x55627a, hair: 0x8a6a3a }, { shirt: 0x2f3c52, skin: 0xb48a6e }]
    .map((o, i) => { const p = makePerson(o); p.scale.setScalar(.42); p.position.set(wx + .1 + i * .32, MAP_Y, wz + .35 + (i % 2) * .12); p.userData.baseY = MAP_Y; p.rotation.y = -.25; scene.add(p); return p; });
  const neonLight = new THREE.PointLight(PAL.neon, 1.2, 3); neonLight.position.set(wx + .55, MAP_Y + 1.6, wz - .1); scene.add(neonLight);
  const warm = new THREE.PointLight(0xfff3dd, 1.1, 4); warm.position.set(wx + .6, MAP_Y + 1, wz + .9); scene.add(warm);
  const update = t => {
    danceBear(bear, t);
    for (let i = 0; i < RN; i++) { const [x, y0, z] = rainBase[i]; const y = MAP_Y + .2 + ((y0 - t * 7 + 50) % 5); rp.set([x, y, z, x - .02, y + .22, z], i * 6); }
    rainGeo.attributes.position.needsUpdate = true;
    clouds.forEach((c, i) => { c.position.x += Math.sin(t * .2 + i) * .002; });
    pins.forEach((p, i) => { const k = (t * .8 + i * .17) % 1; p.userData.ring.scale.setScalar(1 + k * 2.5); p.userData.ring.material.opacity = (1 - k) * .9; });
    const u = (t * .045) % 1, pos = road.getPointAt(u), tan = road.getTangentAt(u);
    car.position.copy(pos); car.position.y = MAP_Y + .005; car.rotation.y = Math.atan2(-tan.z, tan.x);
    crew.forEach((p, i) => p.lookAt(p.position.x - .2, p.position.y, p.position.z + 3));
  };
  return { scene, update, bear, best, pins, crew, car, hotel, warsaw: [wx, wz], road };
}

// ---------------- phone scene ----------------
export function makePhoneScene(env) {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = .4; scene.fog = new THREE.FogExp2(PAL.bg, .02);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x141b27, roughness: .55, metalness: .2 })); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);
  const phone = makePhone(); phone.position.set(0, 1.12, 0); phone.rotation.x = -.12; scene.add(phone);
  const key = new THREE.SpotLight(0xdfe8ff, 18, 20, .5, .7); key.position.set(3, 6, 4); key.target = phone; key.castShadow = true; scene.add(key);
  const rim = new THREE.PointLight(PAL.neon, 6, 6); rim.position.set(-2, 2.2, -1.5); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x2a3446, .6));
  const N = 260, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(rnd(i) - .5) * 6, rnd(i + 1) * 4, (rnd(i + 2) - .5) * 5], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9fb0c8, size: .02, transparent: true, opacity: .6 })); scene.add(dust);
  return { scene, phone, dust };
}
