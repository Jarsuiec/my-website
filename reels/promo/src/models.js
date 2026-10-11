// Procedural 3D models (no external assets). Units: 1 ≈ 10 cm.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, canvasTex, rnd, COL } from './kit.js';

const box = (w, h, d, m, r = 0) => new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

// ---------------- fan ----------------
export function makeFan(r = .5, blades = 9, color = 0x1d232b, ring = null) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * .06, 12, 64), mat.dark(0x101317, .5));
  g.add(frame);
  const rotor = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0); bladeShape.bezierCurveTo(r * .25, r * .05, r * .6, r * .25, r * .95, r * .12);
  bladeShape.bezierCurveTo(r * .7, r * .38, r * .3, r * .32, 0, r * .16); bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: r * .02, bevelEnabled: false });
  const bladeMat = mat.plastic(color, .5);
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.rotation.z = i / blades * Math.PI * 2; b.rotation.x = .35; rotor.add(b);
  }
  const hub = cyl(r * .26, r * .26, r * .12, mat.dark(0x14181d, .4)); hub.rotation.x = Math.PI / 2; rotor.add(hub);
  g.add(rotor);
  let ringMat = null;
  if (ring != null) {
    ringMat = mat.glow(ring, 1.4);
    const rr = new THREE.Mesh(new THREE.TorusGeometry(r * .98, r * .025, 8, 80), ringMat); rr.position.z = r * .03; g.add(rr);
  }
  g.userData = { rotor, ringMat };
  return g;
}

// ---------------- laptop ----------------
export function makeLaptop() {
  const g = new THREE.Group();
  const shell = mat.metal(0x5b636d, .38);
  const base = box(3.2, .16, 2.2, shell, .06); base.position.y = .08; g.add(base);
  // keyboard
  const keyGeo = new THREE.BoxGeometry(.17, .03, .17), keyMat = mat.plastic(0x0e1115, .6);
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, 14 * 5);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) { m4.makeTranslation(-1.3 + c * .2, .17, -.75 + r * .2); keys.setMatrixAt(k++, m4); }
  g.add(keys);
  const pad = box(1.0, .005, .62, mat.dark(0x3b424b, .3)); pad.position.set(0, .162, .62); g.add(pad);
  // side vents (where the "turbine" lives)
  for (let i = 0; i < 9; i++) { const v = box(.02, .07, .09, mat.plastic(0x050607, .9)); v.position.set(1.601, .08, -.6 + i * .13); g.add(v); }
  // lid on a hinge
  const lid = new THREE.Group(); lid.position.set(0, .16, -1.08); g.add(lid);
  const lidShell = box(3.2, 2.1, .07, shell, .05); lidShell.position.set(0, 1.05, -.02); lid.add(lidShell);
  const bezel = box(3.08, 1.98, .01, mat.plastic(0x050608, .4)); bezel.position.set(0, 1.05, .018); lid.add(bezel);
  const screen = canvasTex(1024, 640, (c, w, h) => { c.fillStyle = '#0d1520'; c.fillRect(0, 0, w, h); });
  const scrMat = new THREE.MeshBasicMaterial({ map: screen.tex, color: 0x8a8a8a });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.92, 1.82), scrMat); scr.position.set(0, 1.07, .025); lid.add(scr);
  lid.rotation.x = -.32;
  g.userData = { lid, screen, scrMat };
  return g;
}
export function drawLaptopScreen({ ctx, tex }, state) {
  const w = 1024, h = 640;
  const grd = ctx.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#16304a'); grd.addColorStop(1, '#0a1622');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  // window
  ctx.fillStyle = '#eef2f6'; ctx.beginPath(); ctx.roundRect(110, 70, 800, 470, 18); ctx.fill();
  ctx.fillStyle = '#dbe2ea'; ctx.fillRect(110, 70, 800, 46);
  ctx.fillStyle = '#9fb0c2'; for (let i = 0; i < 9; i++) ctx.fillRect(150, 150 + i * 38, 420 + (i * 97 % 260), 14);
  ctx.fillStyle = '#2e8bff'; ctx.fillRect(620, 150, 250, 150);
  if (state.frozen) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(110, 70, 800, 470); }
  if (state.spin != null) { // loading spinner
    ctx.save(); ctx.translate(510, 305);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(30,60,100,${.15 + .85 * (((i + Math.floor(state.spin * 12)) % 8) / 8)})`;
      ctx.beginPath(); ctx.arc(Math.cos(i / 8 * 6.283) * 46, Math.sin(i / 8 * 6.283) * 46, 10, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(8,14,22,.9)'; ctx.fillRect(0, h - 44, w, 44);
  ctx.fillStyle = '#cfe3ff'; ctx.font = '700 24px "JetBrains Mono"'; ctx.textAlign = 'right'; ctx.fillText(state.clock || '14:02', w - 20, h - 14);
  if (state.heat) { ctx.fillStyle = `rgba(255,90,40,${state.heat * .25})`; ctx.fillRect(0, 0, w, h); }
  tex.needsUpdate = true;
}

// ---------------- jet turbine (visual metaphor) ----------------
export function makeTurbine() {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; prof.push(new THREE.Vector2(1.55 + Math.sin(t * Math.PI) * .22 - t * .1, -1.6 + t * 3.2)); }
  const cowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: .95, roughness: .22, side: THREE.DoubleSide }));
  cowl.rotation.x = Math.PI / 2; g.add(cowl);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.55, .09, 16, 96), mat.metal(0xe4e8ec, .18)); lip.position.z = 1.6; g.add(lip);
  const inner = cyl(1.45, 1.45, 2.8, new THREE.MeshStandardMaterial({ color: 0x0b0d10, metalness: .6, roughness: .6, side: THREE.BackSide }), 64);
  inner.rotation.x = Math.PI / 2; g.add(inner);
  const rotor = new THREE.Group(); rotor.position.z = .7; g.add(rotor);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x8e979f, metalness: .95, roughness: .25 });
  for (let i = 0; i < 24; i++) {
    const b = box(.07, 1.25, .34, bladeMat); b.geometry.translate(0, .62, 0);
    const piv = new THREE.Group(); piv.rotation.z = i / 24 * Math.PI * 2; b.rotation.y = .62; piv.add(b); rotor.add(piv);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(.38, .9, 48), mat.metal(0xdfe3e7, .15)); spinner.rotation.x = Math.PI / 2; spinner.position.z = 1.05; rotor.add(spinner);
  const swirl = new THREE.Mesh(new THREE.RingGeometry(.05, .3, 32, 1, 0, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide }));
  swirl.visible = false;
  const glowMat = mat.glow(COL.orange, 0);
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), glowMat); core.position.z = -.4; g.add(core);
  g.userData = { rotor, glowMat };
  return g;
}

// ---------------- HDD (3.5") ----------------
export function makeHDD() {
  const g = new THREE.Group();
  const alu = mat.metal(0x737b84, .45);
  const base = box(1.46, .14, 1.02, alu, .03); g.add(base);
  const well = box(1.32, .02, .9, mat.metal(0x6f7780, .55)); well.position.y = .065; g.add(well);
  const platter = cyl(.44, .44, .018, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: .14 }), 96);
  platter.position.set(-.18, .09, 0); g.add(platter);
  const p2 = platter.clone(); p2.position.y = .11; g.add(p2);
  const hub = cyl(.11, .11, .06, mat.metal(0xcfd5db, .2)); hub.position.set(-.18, .12, 0); g.add(hub);
  // marking on the platter so rotation reads
  const mark = box(.36, .002, .012, mat.metal(0x8892a0, .3)); mark.position.set(.18, .0105, 0);
  const spin = new THREE.Group(); spin.position.copy(p2.position); spin.add(mark); g.add(spin);
  const arm = new THREE.Group(); arm.position.set(.5, .13, .34); g.add(arm);
  const beam = box(.72, .02, .07, mat.metal(0xb9c0c8, .3)); beam.geometry.translate(-.36, 0, 0); arm.add(beam);
  const head = box(.06, .03, .05, mat.dark(0x202429)); head.position.set(-.72, -.005, 0); arm.add(head);
  const pivot = cyl(.08, .08, .08, mat.metal(0x8e979f, .3)); arm.add(pivot);
  const magnet = box(.3, .05, .22, mat.metal(0x6c737b, .4)); magnet.position.set(.58, .1, .38); g.add(magnet);
  for (const [x, z] of [[-.68, -.46], [.68, -.46], [-.68, .46], [.68, .46]]) { const s = cyl(.03, .03, .02, mat.metal(0x50565d, .3), 16); s.position.set(x, .08, z); g.add(s); }
  const pcb = box(1.4, .03, .96, mat.dark(0x0f2a1c, .6)); pcb.position.y = -.085; g.add(pcb);
  g.userData = { platters: [platter, p2, spin], arm };
  return g;
}

// ---------------- SSD (M.2 2280) ----------------
export function makeSSD() {
  const g = new THREE.Group();
  const pcbTex = canvasTex(1024, 280, (c, w, h) => {
    c.fillStyle = '#0d1116'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(214,170,80,.35)'; c.lineWidth = 2;
    for (let i = 0; i < 40; i++) { c.beginPath(); const y = 20 + rnd(i) * 240; c.moveTo(0, y); c.lineTo(w * rnd(i + 3), y); c.lineTo(w * rnd(i + 3) + 30, y + (rnd(i + 5) > .5 ? 30 : -30)); c.stroke(); }
  });
  const board = box(2.2, .03, .6, new THREE.MeshStandardMaterial({ map: pcbTex.tex, metalness: .3, roughness: .5 })); g.add(board);
  const label = canvasTex(1024, 256, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#11161c'); grd.addColorStop(1, '#1b2430'); c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.fillStyle = '#22e4d4'; c.fillRect(0, 0, 12, h);
    c.fillStyle = '#f2f5f7'; c.font = '900 86px Unbounded'; c.fillText('NVMe', 60, 130);
    c.fillStyle = '#7f8b99'; c.font = '700 40px "JetBrains Mono"'; c.fillText('SOLID STATE DRIVE', 64, 200);
  });
  const sticker = box(1.6, .012, .5, new THREE.MeshStandardMaterial({ map: label.tex, metalness: .2, roughness: .35 })); sticker.position.set(-.1, .045, 0); g.add(sticker);
  for (let i = 0; i < 26; i++) { const f = box(.035, .005, .14, mat.metal(0xd8b25a, .25)); f.position.set(1.06, .018, -.25 + i * .02); g.add(f); }
  const notch = box(.06, .04, .05, mat.dark(0x07090c)); notch.position.set(1.08, 0, .12); g.add(notch);
  const edge = box(2.22, .006, .02, mat.glow(COL.cyan, 1.1)); edge.position.set(0, .02, .31); g.add(edge);
  const edge2 = edge.clone(); edge2.position.z = -.31; g.add(edge2);
  return g;
}

// ---------------- CPU cooler block (for macro cleaning) ----------------
export function makeCoolerRig() {
  const g = new THREE.Group();
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(.012, .9, 1.2), mat.metal(0xb7bec6, .35), 40);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { m4.makeTranslation(-.6 + i * .03, .45, 0); fins.setMatrixAt(i, m4); }
  g.add(fins);
  for (let i = 0; i < 3; i++) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.8, .25 + i * .2, -.45 + i * .45), new THREE.Vector3(0, .25 + i * .2, -.45 + i * .45), new THREE.Vector3(.8, .25 + i * .2, -.45 + i * .45)]);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .04, 12), mat.metal(0xc8834e, .25)); g.add(pipe);
  }
  const fan = makeFan(.55, 9, 0x2a3038); fan.position.set(-.95, .45, 0); fan.rotation.y = Math.PI / 2; g.add(fan);
  g.userData = { fan, fins };
  return g;
}
export function makeCPU() {
  const g = new THREE.Group();
  const sub = box(1.2, .06, 1.2, mat.dark(0x123122, .6)); g.add(sub);
  const ihs = box(1.0, .08, 1.0, mat.metal(0x7d848b, .42), .02); ihs.position.y = .07; g.add(ihs);
  const pasteTex = canvasTex(512, 512, () => {});
  const paste = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .015, 64), new THREE.MeshStandardMaterial({ map: pasteTex.tex, metalness: .1, roughness: .9 }));
  paste.position.y = .12; g.add(paste);
  g.userData = { paste, pasteTex };
  return g;
}
export function drawPaste({ ctx, tex }, cleanK, cracks) {
  const w = 512;
  ctx.clearRect(0, 0, w, w);
  const old = `rgb(${120 - cleanK * 0},${116},${104})`;
  ctx.fillStyle = cleanK > .5 ? '#b9bdb8' : old; ctx.fillRect(0, 0, w, w);
  if (cleanK <= .5) {
    ctx.strokeStyle = 'rgba(40,36,30,.85)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) { const n = Math.floor(cracks * 18); if (i >= n) break;
      ctx.beginPath(); let x = 80 + rnd(i) * 350, y = 80 + rnd(i + 9) * 350; ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd(i * 4 + k) - .5) * 120; y += (rnd(i * 4 + k + 2) - .5) * 120; ctx.lineTo(x, y); } ctx.stroke(); }
  } else {
    const grd = ctx.createRadialGradient(200, 200, 10, 256, 256, 300); grd.addColorStop(0, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, w);
  }
  tex.needsUpdate = true;
}

// ---------------- gaming PC ----------------
export function makeGamingPC() {
  const g = new THREE.Group();
  const frameMat = mat.metal(0x22272e, .4), rgbMats = [];
  const W = 2.1, H = 4.4, D = 4.4;
  const back = box(W, H, .05, mat.dark(0x0c0f13, .7)); back.position.z = -D / 2; g.add(back);
  for (const [x, y, z, w, h, d] of [[0, H / 2, 0, W, .08, D], [0, -H / 2, 0, W, .08, D], [-W / 2, 0, 0, .06, H, D], [0, 0, D / 2, W, H, .05]]) {
    if (z === D / 2) continue;
    const b = box(w, h, d, frameMat); b.position.set(x, y, z); g.add(b);
  }
  const front = box(.1, H, D, mat.dark(0x0f1318, .5)); front.position.x = -W / 2 - .02; // side panel opposite the glass
  g.add(front);
  // motherboard
  const moboTex = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#0c1014'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(46,139,255,.22)'; c.lineWidth = 3;
    for (let i = 0; i < 70; i++) { const x = rnd(i) * w, y = rnd(i + 1) * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd(i + 2) - .5) * 400, y); c.lineTo(x + (rnd(i + 2) - .5) * 400, y + (rnd(i + 3) - .5) * 300); c.stroke(); }
    c.fillStyle = '#1a2028'; c.fillRect(380, 200, 260, 260);
    c.fillStyle = '#20262e'; for (let i = 0; i < 4; i++) c.fillRect(700 + i * 40, 160, 22, 420);
    c.fillStyle = '#20262e'; c.fillRect(120, 620, 760, 40); c.fillRect(120, 760, 760, 40);
  });
  const mobo = box(.06, 3.2, 3.2, new THREE.MeshStandardMaterial({ map: moboTex.tex, metalness: .4, roughness: .5 }));
  mobo.position.set(-W / 2 + .1, .35, -.3); g.add(mobo);
  const parts = {};
  const mx = -W / 2 + .14;
  // CPU (small) and tower cooler
  parts.cpu = box(.04, .42, .42, mat.metal(0xc6cdd4, .3)); parts.cpu.position.set(mx, .95, -.3); g.add(parts.cpu);
  const cooler = new THREE.Group(); cooler.position.set(mx + .55, .95, -.3); g.add(cooler);
  const cfins = new THREE.InstancedMesh(new THREE.BoxGeometry(.9, .01, .9), mat.metal(0xb8bfc7, .3), 34); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) { m4.makeTranslation(0, -.6 + i * .036, 0); cfins.setMatrixAt(i, m4); } cooler.add(cfins);
  const cfan = makeFan(.46, 9, 0x1b2026, COL.cyan); cfan.rotation.y = Math.PI / 2; cfan.position.x = 0; cfan.position.z = .5; cfan.rotation.y = 0; cooler.add(cfan);
  rgbMats.push(cfan.userData.ringMat); parts.cooler = cooler;
  // RAM sticks
  parts.ram = [];
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Group(); r.position.set(mx + .2, .95, .55 + i * .18); g.add(r);
    const body = box(.28, 1.1, .06, mat.dark(0x181d23, .4)); r.add(body);
    const m = mat.glow(COL.blue, 1.4); rgbMats.push(m);
    const strip = box(.06, 1.1, .065, m); strip.position.x = .16; r.add(strip);
    parts.ram.push(r);
  }
  // GPU
  const gpu = new THREE.Group(); gpu.position.set(mx + .6, -.35, -.2); g.add(gpu);
  gpu.add(box(1.0, .5, 2.9, mat.dark(0x15191f, .35), .04));
  for (let i = 0; i < 3; i++) { const f = makeFan(.36, 11, 0x20252c); f.rotation.x = Math.PI / 2; f.position.set(0, -.26, -.95 + i * .95); gpu.add(f); gpu.userData['f' + i] = f; }
  const gm = mat.glow(COL.cyan, 1.3); rgbMats.push(gm);
  const gstrip = box(.02, .05, 2.6, gm); gstrip.position.set(.51, .2, 0); gpu.add(gstrip);
  parts.gpu = gpu;
  // PSU shroud + front fans
  const shroud = box(W - .1, .7, D - .1, mat.dark(0x0f1318, .6)); shroud.position.set(0, -H / 2 + .4, 0); g.add(shroud);
  parts.fans = [];
  for (let i = 0; i < 3; i++) {
    const f = makeFan(.55, 9, 0x1b2026, COL.blue); f.rotation.y = Math.PI / 2; f.position.set(-.2, 1.3 - i * 1.15, D / 2 - .25);
    f.rotation.y = 0; g.add(f); rgbMats.push(f.userData.ringMat); parts.fans.push(f);
  }
  const rear = makeFan(.5, 9, 0x1b2026, COL.cyan); rear.position.set(0, 1.4, -D / 2 + .15); g.add(rear); rgbMats.push(rear.userData.ringMat); parts.fans.push(rear);
  // detail: VRM + chipset heatsinks, M.2 shield, sleeved cables
  const hs = mat.metal(0x3a4048, .35);
  for (const [y, z, h, d] of [[1.55, -.3, .22, 1.0], [.95, -1.0, .9, .22], [-.55, .9, .5, .5]]) { const b2 = box(.12, h, d, hs, .02); b2.position.set(mx + .02, y, z); g.add(b2); }
  for (let i = 0; i < 9; i++) { const fin = box(.13, .2, .02, hs); fin.position.set(mx + .03, 1.55, -.75 + i * .11); g.add(fin); }
  const m2 = box(.05, .16, .9, mat.metal(0x2a3038, .3)); m2.position.set(mx + .03, .1, .2); g.add(m2);
  const cable = (pts, color, r = .045) => { const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, r, 10), mat.plastic(color, .7)); g.add(tube); };
  for (let i = 0; i < 4; i++) cable([[-.2, -H / 2 + .75, 1.5 + i * .08], [-.4, -.9, 1.7 + i * .08], [mx + .08, .2, 1.45 + i * .06]], i % 2 ? 0x1a1d22 : 0x2a2f36);
  for (let i = 0; i < 2; i++) cable([[0, -H / 2 + .75, -.4 + i * .1], [.3, -.85, -.5 + i * .1], [mx + .6, -.12, -1.3 + i * .1]], 0xd9dde2, .04);
  cable([[-.3, H / 2 - .2, -1.6], [mx + .1, 1.75, -1.2]], 0x1a1d22, .05);
  const glass = box(.02, H - .1, D - .1, mat.glass()); glass.position.x = W / 2; g.add(glass);
  // glass edge light strip
  const edgeMat = mat.glow(COL.blue, 1.2); rgbMats.push(edgeMat);
  const edge = box(.03, .03, D - .2, edgeMat); edge.position.set(W / 2, H / 2 - .1, 0); g.add(edge);
  g.userData = { parts, rgbMats, cfan };
  return g;
}

// ---------------- props ----------------
export function makeMug() {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(.32 + i * .006, i * .07));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: .35, metalness: 0, side: THREE.DoubleSide }));
  g.add(body);
  const bottom = cyl(.32, .32, .02, body.material); bottom.position.y = .01; g.add(bottom);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.18, .045, 12, 32, Math.PI * 1.3), body.material); handle.position.set(.4, .38, 0); handle.rotation.z = -Math.PI * .65; g.add(handle);
  const coffee = cyl(.35, .35, .01, new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: .2 })); coffee.position.y = .62; g.add(coffee);
  g.userData = { coffee };
  return g;
}
export function makeNote(color = 0xffd23d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshStandardMaterial({ color, roughness: .8, side: THREE.DoubleSide }));
  return m;
}
export function makeBin() {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector2(.95 + i * .03, i * .22));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: .7, roughness: .45, side: THREE.DoubleSide }));
  g.add(body);
  for (let i = 0; i < 24; i++) { const rib = box(.03, 2.6, .04, mat.metal(0x566070, .4)); const a = i / 24 * Math.PI * 2; rib.position.set(Math.cos(a) * 1.13, 1.3, Math.sin(a) * 1.13); rib.rotation.y = -a; rib.rotation.z = .03; g.add(rib); }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.31, .05, 10, 64), mat.metal(0x7c8796, .3)); rim.rotation.x = Math.PI / 2; rim.position.y = 2.64; g.add(rim);
  return g;
}
export function makeDesk(color = 0x1a1d22) {
  const tex = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#1b1e23'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(255,255,255,${.012 + rnd(i) * .02})`; c.lineWidth = 1 + rnd(i + 1) * 3; c.beginPath(); const y = rnd(i + 2) * h; c.moveTo(0, y); c.bezierCurveTo(w * .3, y + 8, w * .6, y - 8, w, y + 4); c.stroke(); }
  });
  tex.tex.wrapS = tex.tex.wrapT = THREE.RepeatWrapping; tex.tex.repeat.set(2, 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: tex.tex, color, roughness: .55, metalness: .15 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
