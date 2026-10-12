// «Напиши Міші» v2 — particle film. 24k glowing particles morph between shapes (words, emoji, portrait, map),
// synced to the voice. Deterministic render(t) for frame capture.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeIn = x => x * x * x;
const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const backOut = (x, c = 1.6) => 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
const rnd = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const N = 24000, SCALE = .75, PX = 1920 / (2 * 10 * Math.tan(25 * Math.PI / 180)); // design px per world unit at z=0
let WORDS = [], CUES = [], TOTAL = 50.4, CFG, KEYS = [], SHAPES = {}, UI = [], BG = [];
const W = (text, after = 0) => {
  const k = text.toLowerCase();
  const w = WORDS.find(w => w.start >= after && w.text.toLowerCase().replace(/[.,!?:—«»…]/g, '').startsWith(k));
  if (!w) throw new Error('word not found: ' + text);
  return w.start;
};

// ---------------- shape sampling ----------------
const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
const cx = cv.getContext('2d', { willReadFrequently: true });
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
function sample(draw, { tint = null, fill = .82, depth = .35, step = 3, glow = 1 } = {}) {
  cx.clearRect(0, 0, 1080, 1920); draw(cx);
  const d = cx.getImageData(0, 0, 1080, 1920).data, cand = [];
  for (let y = 0; y < 1920; y += step) for (let x = 0; x < 1080; x += step) { const i = (y * 1080 + x) * 4; if (d[i + 3] > 110) cand.push(i); }
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), on = new Float32Array(N), use = Math.floor(N * fill);
  for (let p = 0; p < N; p++) {
    if (p < use && cand.length) {
      const i = cand[Math.floor(rnd(p * 1.7 + cand.length) * cand.length)], px = (i / 4) % 1080, py = Math.floor(i / 4 / 1080);
      const jx = px + (rnd(p + 3) - .5) * step, jy = py + (rnd(p + 5) - .5) * step;
      pos[p * 3] = (jx - 540) / PX; pos[p * 3 + 1] = -(jy - 960) / PX; pos[p * 3 + 2] = (rnd(p + 7) - .5) * depth;
      const c = tint || [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
      col[p * 3] = c[0] * glow; col[p * 3 + 1] = c[1] * glow; col[p * 3 + 2] = c[2] * glow; on[p] = 1;
    } else { // ambient dust around the scene
      pos[p * 3] = (rnd(p + 11) - .5) * 9; pos[p * 3 + 1] = (rnd(p + 13) - .5) * 14; pos[p * 3 + 2] = -1 - rnd(p + 17) * 7;
      col[p * 3] = col[p * 3 + 1] = col[p * 3 + 2] = .35; on[p] = .25;
    }
  }
  return { pos, col, on };
}
const textShape = (lines, size, y0, opt = {}) => sample(c => {
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `900 ${size}px Unbounded`;
  lines.forEach((l, i) => c.fillText(l, 540, y0 + i * size * 1.08));
}, { tint: opt.tint || [1, .97, .92], fill: opt.fill ?? .8, step: 2, ...opt });
const emojiShape = (e, size, y, opt = {}) => sample(c => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `${size}px "Noto Color Emoji"`; c.fillText(e, 540, y); }, { fill: .78, step: 3, glow: 1.15, ...opt });

// ---------------- three.js ----------------
let renderer, scene, camera, composer, bloom, geo, mat, cur, colr;
function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1080 * SCALE, 1920 * SCALE, false); renderer.setClearColor(0, 0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1080 / 1920, .1, 100); camera.position.set(0, 0, 10);
  geo = new THREE.BufferGeometry();
  cur = new Float32Array(N * 3); colr = new Float32Array(N * 3);
  const size = new Float32Array(N), alpha = new Float32Array(N);
  for (let i = 0; i < N; i++) size[i] = .5 + Math.pow(rnd(i + 99), 4) * 1.5;
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 1920 * SCALE / 2 / Math.tan(25 * Math.PI / 180) * .028 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / -mv.z; vC = color; vA = alpha; }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ vec2 p = gl_PointCoord - .5; float r = length(p); if (r > .5) discard;
        float a = smoothstep(.5, .0, r); a = a * vA * .85; gl_FragColor = vec4(vC * (0.65 + 0.8 * smoothstep(.2, .0, r)), a); }`,
  });
  scene.add(new THREE.Points(geo, mat));
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1080 * SCALE, 1920 * SCALE, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1); composer.setSize(1080 * SCALE, 1920 * SCALE);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(1080 * SCALE, 1920 * SCALE), .6, .4, .6); composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// ---------------- UI overlay helpers ----------------
function ui(html, show, opts = {}) { // show: [in, out]
  const el = document.createElement('div'); el.className = 'el'; el.innerHTML = html; $('ui').appendChild(el);
  Object.assign(el.style, opts.style || {});
  UI.push({ el, a: show[0], b: show[1], from: opts.from || 'up', delay: 0 });
  return el;
}
function updateUI(t) {
  for (const u of UI) {
    const pin = easeOut(prog(t, u.a, u.a + .45)), pout = easeIn(prog(t, u.b - .3, u.b));
    const v = pin * (1 - pout);
    u.el.style.opacity = v;
    const off = (1 - pin) * 60 + pout * -30;
    u.el.style.transform = u.from === 'up' ? `translateY(${off}px) scale(${lerp(.92, 1, pin)})` : u.from === 'left' ? `translateX(${-(1 - pin) * 120}px)` : `translateX(${(1 - pin) * 120}px)`;
    u.el.style.filter = pin < 1 || pout > 0 ? `blur(${(1 - pin) * 12 + pout * 10}px)` : 'none';
  }
}

// ---------------- background (gradient + glow), crossfaded per scene ----------------
function setBG(t) {
  let i = 0; while (i < BG.length - 1 && t >= BG[i + 1].t) i++;
  const A = BG[i], B = BG[Math.min(i + 1, BG.length - 1)];
  const k = B === A ? 0 : easeInOut(prog(t, B.t - .6, B.t + .2));
  const paint = (el, g, gl, tt) => { el.style.background = `linear-gradient(170deg, ${g[0]} 0%, ${g[1]} 55%, ${g[2]} 100%)`;
    gl.style.background = `radial-gradient(circle, ${g[3]}, transparent 65%)`; gl.style.transform = `translate(${Math.sin(tt * .3) * 80}px, ${Math.cos(tt * .25) * 60}px)`; };
  paint($('bgA'), A.g, $('glowA'), t); paint($('bgB'), B.g, $('glowB'), t + 3); $('bgB').style.opacity = k;
}

// ---------------- particle timeline ----------------
const FLIGHT = .58;
function updateParticles(t) {
  let bi = 0; while (bi < KEYS.length - 1 && t >= KEYS[bi + 1].t) bi++;
  const B = KEYS[bi], A = KEYS[Math.max(0, bi - 1)];
  const SA = SHAPES[A.shape], SB = SHAPES[B.shape];
  const al = geo.attributes.alpha.array, lt = t - B.t;
  const swirlAmp = B.swirl ?? .9, mode = B.mode || 'morph';
  for (let i = 0; i < N; i++) {
    const j = i * 3;
    const delay = rnd(i * 3.1) * .16 + (SB.pos[j + 1] + 4.5) / 9 * .08;
    const k = clamp((lt - delay) / (B.dur ?? FLIGHT)), e = easeInOut(k), arc = Math.sin(k * Math.PI);
    let x, y, z;
    if (mode === 'crumble') { // the previous shape falls apart like dust
      const kk = clamp((lt - rnd(i) * .5) / 1.2);
      x = SA.pos[j] + (rnd(i + 1) - .5) * kk * 1.5; y = SA.pos[j + 1] - 6 * kk * kk - rnd(i + 2) * kk; z = SA.pos[j + 2] + kk * (rnd(i + 3) - .5) * 2;
      colr[j] = lerp(SA.col[j], .45, kk); colr[j + 1] = lerp(SA.col[j + 1], .42, kk); colr[j + 2] = lerp(SA.col[j + 2], .5, kk);
      al[i] = SA.on[i] * (1 - kk * .85);
    } else {
      const sw = swirlAmp * arc;
      x = lerp(SA.pos[j], SB.pos[j], e) + Math.sin(i * .37 + t * 2.1) * sw;
      y = lerp(SA.pos[j + 1], SB.pos[j + 1], e) + Math.cos(i * .53 + t * 1.7) * sw;
      z = lerp(SA.pos[j + 2], SB.pos[j + 2], e) + Math.sin(i * .71 + t * 1.3) * sw * 1.6;
      if (mode === 'burst' && lt >= 0) { const r = easeOut(clamp(lt / 1.4)) * (2 + rnd(i) * 6), a = rnd(i + 4) * 6.283;
        x = SA.pos[j] + Math.cos(a) * r; y = SA.pos[j + 1] + Math.sin(a) * r - lt * lt * 1.2; z = SA.pos[j + 2] + (rnd(i + 8) - .5) * r; }
      colr[j] = lerp(SA.col[j], SB.col[j], e); colr[j + 1] = lerp(SA.col[j + 1], SB.col[j + 1], e); colr[j + 2] = lerp(SA.col[j + 2], SB.col[j + 2], e);
      al[i] = lerp(SA.on[i], SB.on[i], e) * (mode === 'burst' ? 1 - clamp(lt / 1.6) * .6 : 1);
    }
    // idle life: gentle breathing + twinkle; ambient dust drifts upward
    const amb = SB.on[i] < .5 && mode !== 'crumble';
    cur[j] = x + Math.sin(t * 1.3 + i) * .012 + (amb ? Math.sin(t * .2 + i) * .3 : 0);
    cur[j + 1] = y + Math.cos(t * 1.1 + i * 1.3) * .012 + (amb ? ((t * .15 + rnd(i + 20) * 14) % 14) - 7 - y + y * 0 : 0);
    cur[j + 2] = z;
    al[i] *= .75 + .25 * Math.sin(t * 3 + i * 7.3);
  }
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.alpha.needsUpdate = true;
  // flash when a new shape lands
  return Math.max(0, 1 - Math.abs(lt - .55) * 4) * (B.flash ?? .25);
}

// ---------------- subtitles ----------------
function renderSubs(t) {
  const box = $('subs'), cue = CUES.find(c => t >= c.start && t < c.end);
  if (!cue) { box.innerHTML = ''; box.dataset.k = ''; return; }
  if (box.dataset.k != cue.start) { box.dataset.k = cue.start;
    box.innerHTML = `<div class="cue">${cue.lines.map(l => `<span class="line">${l.map(w => `<span class="w ${w.tone || ''}" data-s="${w.start}">${esc(w.text)}</span>`).join(' ')}</span>`).join('')}</div>`; }
  const e = easeOut(prog(t, cue.start, cue.start + .2));
  box.firstChild.style.opacity = e; box.firstChild.style.transform = `translateY(${(1 - e) * 18}px)`;
  box.querySelectorAll('.w').forEach(el => { const s = +el.dataset.s, p = easeOut(prog(t, s - .04, s + .14));
    el.style.opacity = .55 + .45 * p; el.style.filter = p < 1 ? `blur(${(1 - p) * 3}px)` : 'none'; });
}

// ---------------- the film ----------------
async function buildFilm(cfg) {
  const av = await loadImg('assets/avatar.png');
  const icon = async svg => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  const TG = await icon(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><circle cx="120" cy="120" r="118" fill="#2AABEE"/><path d="M58 117l112-44c6-2 11 2 9 10l-19 90c-1 7-6 8-12 5l-30-22-14 14c-2 2-3 3-7 3l2-31 57-51c3-2-1-4-4-2l-70 44-30-9c-7-2-7-7 1-10z" fill="#fff"/></svg>`);
  const WA = await icon(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><circle cx="120" cy="120" r="118" fill="#25D366"/><path d="M120 52a66 66 0 0 0-57 99l-9 33 34-9a66 66 0 1 0 32-123z" fill="none" stroke="#fff" stroke-width="13"/><path d="M95 88c3-6 8-6 10-1l7 15c1 3 0 6-2 8l-5 5c5 11 14 20 25 25l5-5c2-2 5-3 8-2l15 7c5 2 5 7-1 10-9 6-20 7-32 0-17-9-30-23-37-38-4-9-1-18 7-24z" fill="#fff"/></svg>`);
  const MS = await icon(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a7cff"/><stop offset=".6" stop-color="#a033ff"/><stop offset="1" stop-color="#ff5c87"/></linearGradient></defs><circle cx="120" cy="120" r="118" fill="url(#g)"/><path d="M62 146l38-60c4-6 10-7 15-3l25 19 33-25c5-4 11 2 7 7l-38 60c-4 6-10 7-15 3l-25-19-33 25c-5 4-11-2-7-7z" fill="#fff"/></svg>`);

  const PL = [[14.12,53.9],[15.5,54.2],[16.5,54.55],[17.6,54.8],[18.4,54.83],[18.6,54.43],[19.6,54.45],[20.5,54.38],[21.5,54.33],[22.8,54.36],[23.5,54.1],[23.6,53.6],[23.9,53.15],[23.6,52.6],[23.2,52.25],[23.6,51.9],[23.6,51.5],[24.1,50.85],[23.6,50.4],[22.7,49.6],[22.6,49.08],[22.0,49.2],[21.0,49.38],[20.3,49.4],[19.9,49.2],[19.4,49.6],[18.85,49.5],[18.0,50.0],[17.6,50.25],[16.9,50.45],[16.6,50.15],[16.2,50.6],[15.3,50.85],[14.8,50.87],[14.95,51.45],[14.7,52.08],[14.6,52.6],[14.15,52.85],[14.3,53.25]];
  const MK = 86, MX = 100, MY = 330, mp = ([lo, la]) => [MX + (lo - 14) * MK, MY + (54.9 - la) * MK * 1.62];
  const mapPath = c => { c.beginPath(); PL.forEach((p, i) => { const [x, y] = mp(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); };
  const CITIES = [['Варшава', 21.01, 52.23], ['Гданськ', 18.65, 54.35], ['Краків', 19.94, 50.06], ['Міжздроє', 14.48, 53.93], ['Миколайки', 21.59, 53.80], ['Оструда', 19.96, 53.70]];

  const S = SHAPES;
  S.vortex = sample(c => { for (let i = 0; i < 3000; i++) { const a = i * .07, r = 40 + i * .14; c.fillStyle = '#fff'; c.fillRect(540 + Math.cos(a) * r, 760 + Math.sin(a) * r, 3, 3); } }, { tint: [1, .85, .95], fill: .9, depth: 3 });
  S.hook = textShape(['ШУКАЄШ', 'РОБОТУ', 'В ПОЛЬЩІ?'], 150, 520, { tint: [1, .95, .9] });
  S.phone = emojiShape('📱', 640, 700);
  S.dead = textShape(['ВАКАНСІЯ', 'НЕАКТУАЛЬНА'], 96, 640, { tint: [1, .45, .42] });
  S.portrait = sample(c => { c.save(); c.beginPath(); c.arc(540, 640, 330, 0, 7); c.clip(); c.drawImage(av, 210, 310, 660, 660); c.restore(); }, { fill: .9, step: 3, glow: 1.25 });
  S.ring = sample(c => { c.strokeStyle = '#fff'; c.lineWidth = 16; c.beginPath(); c.arc(540, 640, 352, 0, 7); c.stroke(); }, { tint: [1, .9, .7], fill: .55, depth: .6 });
  S.hotel = emojiShape('🏨', 560, 720);
  S.heart = sample(c => { c.fillStyle = '#ff6aa8'; c.beginPath(); c.moveTo(540, 980);
    c.bezierCurveTo(140, 700, 260, 360, 540, 560); c.bezierCurveTo(820, 360, 940, 700, 540, 980); c.fill(); }, { fill: .8, glow: 1.2 });
  S.gold = sample(c => { const g = c.createLinearGradient(0, 380, 0, 1000); g.addColorStop(0, '#fff6b0'); g.addColorStop(.5, '#ffd23d'); g.addColorStop(1, '#ff9a1a'); c.fillStyle = g;
    c.beginPath(); c.moveTo(110, 1000); c.lineTo(330, 560); c.lineTo(450, 760); c.lineTo(560, 400); c.lineTo(720, 760); c.lineTo(820, 600); c.lineTo(980, 1000); c.closePath(); c.fill(); }, { fill: .85, glow: 1.2 });
  S.poland = sample(c => { mapPath(c); c.fillStyle = 'rgba(160,240,255,.55)'; c.fill(); c.lineWidth = 10; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = '#ffffff'; [[16.0, 50.55], [16.6, 50.3], [19.6, 49.42], [20.0, 49.28], [20.4, 49.42], [22.3, 49.2]].forEach(p => { const [x, y] = mp(p); c.beginPath(); c.moveTo(x - 50, y + 16); c.lineTo(x, y - 80); c.lineTo(x + 50, y + 16); c.fill(); }); }, { fill: .82, glow: 1.1, step: 3 });
  S.shake = emojiShape('🤝', 560, 720);
  S.bed = emojiShape('🛏️', 560, 680); S.chef = emojiShape('👨‍🍳', 560, 680); S.night = emojiShape('🌗', 520, 680); S.wave = emojiShape('🌊', 560, 680);
  S.cities = sample(c => { mapPath(c); c.lineWidth = 8; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill();
    CITIES.forEach(([, lo, la]) => { const [x, y] = mp([lo, la]); const g = c.createRadialGradient(x, y, 0, x, y, 46); g.addColorStop(0, '#ffe45c'); g.addColorStop(1, 'rgba(255,228,92,0)'); c.fillStyle = g; c.fillRect(x - 46, y - 46, 92, 92); }); }, { fill: .85, glow: 1.15, step: 3 });
  S.free = emojiShape('✅', 520, 680); S.doc = emojiShape('📄', 540, 680); S.home = emojiShape('🏠', 540, 680);
  S.apps = sample(c => { c.drawImage(TG, 70, 520, 280, 280); c.drawImage(WA, 400, 520, 280, 280); c.drawImage(MS, 730, 520, 280, 280); }, { fill: .85, glow: 1.15 });
  S.phoneNum = emojiShape('📞', 520, 640);
  S.portrait2 = S.portrait; S.ring2 = S.ring;

  const t = (w, after = 0) => W(w, after);
  const K0 = [
    { t: -1, shape: 'vortex' }, { t: .0, shape: 'hook', dur: .55, swirl: 2.2, flash: .5 },
    { t: t('Знайоме') - .1, shape: 'phone' }, { t: t('Ой') - .1, shape: 'dead', flash: .4 },
    { t: t('минулого') - .25, shape: 'dead', mode: 'crumble' },
    { t: t('Привіт') - .3, shape: 'portrait', dur: 1.2, swirl: 2, flash: .6 }, { t: t('рекрутер') + .2, shape: 'ring', dur: .8, swirl: .6 },
    { t: t('готелях') - .1, shape: 'hotel' }, { t: t('без', t('Польщі', 12)) - .05, shape: 'heart' },
    { t: t('Золотих') - .1, shape: 'gold', flash: .5 }, { t: t('не', t('Золотих')), shape: 'gold', mode: 'burst' },
    { t: t('гори') - .05, shape: 'poland' }, { t: t('чесно') - .1, shape: 'shake' },
    { t: t('покоївок') - .2, shape: 'bed' }, { t: t('кухарів') - .15, shape: 'chef' }, { t: t('денного') - .1, shape: 'night' }, { t: t('прибирання') - .1, shape: 'wave' },
    { t: t('Варшава') - .25, shape: 'cities', dur: 1.1 },
    { t: t('безкоштовний') - .2, shape: 'free' }, { t: t('офіційне') - .25, shape: 'doc' }, { t: t('аванс') - .2, shape: 'home' },
    { t: t('Телеграм') - .3, shape: 'apps' }, { t: t('+48') - .2, shape: 'phoneNum' },
    { t: t('Напиши', 44) - .25, shape: 'portrait2', dur: 1, swirl: 2, flash: .5 }, { t: t('разом') + .1, shape: 'ring2', dur: .7, swirl: .6 },
    { t: t('ПІДХОДИТЬ') - .05, shape: 'ring2', mode: 'burst', flash: .9 },
  ];
  KEYS = K0.map(k => (k.mode || k.t <= 0 ? k : { ...k, t: k.t - .18 }));
  // scene colours (top, mid, bottom, glow)
  BG = [
    { t: 0, g: ['#2a0b52', '#7a1d8f', '#ff3d7f', '#ff8ad0'] },
    { t: t('Дзвониш'), g: ['#1f1638', '#3d2c5c', '#6a4a7a', '#9a7ab8'] },
    { t: t('Привіт') - .3, g: ['#ff5f6d', '#ff9a5a', '#ffc371', '#fff1a8'] },
    { t: t('Золотих') - .1, g: ['#0b8fb0', '#19c3c9', '#7be0c3', '#e9fff4'] },
    { t: t('Зараз'), g: ['#7b1fa2', '#e0307a', '#ff8a3d', '#ffd36b'] },
    { t: t('Варшава') - .25, g: ['#123fd6', '#2f7bff', '#29d3ff', '#bff3ff'] },
    { t: t('Підбір') - .2, g: ['#0a8f6c', '#18b98a', '#a6e86a', '#f4ffc0'] },
    { t: t('Пиши') - .2, g: ['#5b2bd6', '#9b3cf0', '#ff4ecd', '#ffc0f0'] },
    { t: t('Напиши', 44) - .25, g: ['#ff3d6e', '#ff7a45', '#ffb347', '#fff1a8'] },
  ];

  // ---- crisp UI overlays ----
  const card = (inner, extra = '') => `<div class="glass" style="padding:26px 40px;display:flex;align-items:center;gap:24px;${extra}">${inner}</div>`;
  ui(`<div class="lbl" style="font-size:40px;text-align:center;width:960px;opacity:.95">🙃 Знайоме, правда?</div>`, [t('Знайоме'), t('Дзвониш') + .3], { style: { left: '60px', top: '1180px' } });
  ui(card(`<span style="font-size:60px">📞</span><div><div class="lbl" style="font-size:30px;opacity:.7">Оголошення</div><div class="lbl" style="font-size:44px">«Ой, вже неактуально…»</div></div>`),
    [t('Ой') - .05, t('Привіт') - .4], { style: { left: '70px', top: '1110px' } });
  ui(`<div class="lbl" style="font-size:36px;padding:14px 28px;border-radius:999px;background:rgba(0,0,0,.35)">🕸️ опубліковано: минулого року</div>`, [t('минулого'), t('Привіт') - .4], { style: { left: '190px', top: '1260px' } });
  ui(`<div style="text-align:center;width:960px"><div class="ttl" style="font-size:110px">Міша</div>
      <div class="lbl" style="font-size:34px;margin-top:16px;opacity:.95">рекрутер · Sofius Group</div></div>`, [t('Міша') - .1, t('готелях') - .2], { style: { left: '60px', top: '1060px' } });
  ui(card(`<span style="font-size:58px">🏨</span><span class="lbl" style="font-size:42px">Готелі Польщі</span>`), [t('готелях'), t('без', t('Польщі', 12)) - .1], { style: { left: '230px', top: '1120px' } });
  ui(`<div style="display:flex;gap:18px;justify-content:center;width:960px">${card('<span class="lbl" style="font-size:36px">✓ Без нервів</span>')}${card('<span class="lbl" style="font-size:36px">✓ Без сюрпризів</span>')}</div>`,
    [t('без', t('Польщі', 12)), t('Золотих') - .1], { style: { left: '60px', top: '1120px' } });
  ui(`<div class="ttl" style="font-size:84px;text-align:center;width:960px">Золоті гори?</div>`, [t('Золотих'), t('гори') - .1], { style: { left: '60px', top: '220px' } });
  ui(`<div class="lbl" style="font-size:54px;text-align:center;width:960px;color:#fff">❌ Не обіцяю 😄</div>`, [t('не', t('Золотих')) + .1, t('гори') - .1], { style: { left: '60px', top: '1130px' } });
  ui(card(`<span class="lbl" style="font-size:38px">⛰️ Гори — тільки на півдні</span>`), [t('півдні') - .3, t('чесно') - .15], { style: { left: '130px', top: '1180px' } });
  ui(`<div style="text-align:center;width:960px"><div class="ttl" style="font-size:86px">Чесно<br>про умови</div>
      <div class="lbl" style="font-size:34px;margin-top:22px;opacity:.95">ще до поїздки</div></div>`, [t('чесно'), t('Зараз') - .1], { style: { left: '60px', top: '1050px' } });
  ui(`<div class="ttl" style="font-size:78px;text-align:center;width:960px">Шукаємо</div>`, [t('Зараз'), t('Варшава') - .3], { style: { left: '60px', top: '220px' } });
  cfg.vacancies.forEach((v, i) => ui(card(`<span class="lbl" style="font-size:${v.label.length > 16 ? 40 : 52}px">${esc(v.label)}</span>`, 'justify-content:center'),
    [W(v.word) - .1, i < 3 ? W(cfg.vacancies[i + 1].word) - .15 : t('Варшава') - .3], { style: { left: '90px', top: '1110px', width: '900px' } }));
  ui(`<div class="ttl" style="font-size:72px;text-align:center;width:960px">Міста</div>`, [t('Варшава') - .2, t('Підбір') - .2], { style: { left: '60px', top: '200px' } });
  let lastC = 0;
  CITIES.forEach(([n, lo, la], i) => { const [x, y] = mp([lo, la]); const at = Math.max(t(n) - .05, lastC + .3); lastC = at;
    const right = x < 800 && n !== 'Миколайки' ? true : n === 'Миколайки';
    ui(`<div class="lbl" style="font-size:30px;padding:8px 18px;border-radius:999px;background:rgba(0,0,0,.4);white-space:nowrap">${esc(n)}</div>`,
      [at, t('Підбір') - .2], { from: 'left', style: { left: `${n === 'Гданськ' ? x - 230 : n === 'Міжздроє' ? x - 20 : x + 34}px`, top: `${n === 'Міжздроє' ? y + 34 : n === 'Оструда' ? y + 26 : y - 22}px` } }); });
  ui(card(`<span class="lbl" style="font-size:38px">+ та інші міста</span>`), [t('не', t('ще', t('Оструда'))) - .2, t('Підбір') - .2], { style: { left: '280px', top: '1210px' } });
  const terms = [['Підбір — безкоштовний', 'безкоштовний'], ['Офіційне працевлаштування', 'офіційне'], ['Аванс і житло від компанії', 'аванс']];
  terms.forEach(([l, w], i) => ui(card(`<span class="lbl" style="font-size:${l.length > 22 ? 38 : 46}px">${esc(l)}</span>`, 'justify-content:center'),
    [W(w) - .15, i < 2 ? W(terms[i + 1][1]) - .25 : t('Пиши') - .2], { style: { left: '90px', top: '1110px', width: '900px' } }));
  ui(`<div class="lbl" style="font-size:34px;padding:12px 26px;border-radius:999px;background:rgba(0,0,0,.35)">* у деяких містах</div>`, [t('деяких'), t('Пиши') - .2], { style: { left: '330px', top: '1260px' } });
  ui(`<div class="ttl" style="font-size:72px;text-align:center;width:960px">Пиши<br>або дзвони</div>`, [t('Пиши') - .1, t('Напиши', 44) - .3], { style: { left: '60px', top: '190px' } });
  ui(`<div style="display:flex;gap:110px;justify-content:center;width:960px">${['Telegram', 'WhatsApp', 'Messenger'].map(n => `<div class="lbl" style="font-size:28px">${n}</div>`).join('')}</div>`,
    [t('Телеграм'), t('+48') - .25], { style: { left: '60px', top: '850px' } });
  ui(card(`<span class="ttl" style="font-size:72px;white-space:nowrap">${esc(cfg.phone)}</span>`, 'justify-content:center'), [t('+48') + .3, t('Напиши', 44) - .3], { style: { left: '90px', top: '1130px', width: '900px' } });
  ui(`<div class="ttl" style="font-size:104px;text-align:center;width:960px">Напиши<br>Міші!</div>`, [t('Напиши', 44), TOTAL + 1], { style: { left: '60px', top: '1040px' } });
  ui(card(`<span class="ttl" style="font-size:54px;white-space:nowrap">${esc(cfg.phone)}</span><span style="display:flex;gap:10px"><img src="${TG.src}" width="70"><img src="${WA.src}" width="70"><img src="${MS.src}" width="70"></span>`, 'justify-content:space-between'),
    [t('разом') + .2, TOTAL + 1], { style: { left: '60px', top: '1700px', width: '960px', padding: '0' } });
  // crisp portrait inside the particle ring
  const face = ui(`<div style="width:640px;height:640px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px rgba(255,255,255,.85), 0 30px 120px rgba(0,0,0,.35)"><img src="assets/avatar.png" style="width:100%;height:100%;object-fit:cover"></div>`,
    [t('Міша') + .35, t('готелях') - .2], { style: { left: '220px', top: '320px' } });
  ui(face.innerHTML, [t('разом') - .2, TOTAL + 1], { style: { left: '220px', top: '320px' } });
}

const grainCtx = $('grain').getContext('2d'), grainImg = grainCtx.createImageData(270, 480);
window.setup = async cfg => {
  CFG = cfg;
  const wj = await (await fetch('words.json')).json(); WORDS = wj.words; CUES = wj.cues;
  TOTAL = cfg.total;
  await Promise.all(['900 150px Unbounded', '800 40px Unbounded', '800 40px Manrope', '120px "Noto Color Emoji"'].map(f => document.fonts.load(f, 'АБВіїє📱')));
  await document.fonts.ready;
  initGL();
  await buildFilm(cfg);
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  window.TOTAL = TOTAL; return TOTAL;
};
window.render = t => {
  setBG(t);
  const fl = updateParticles(t);
  camera.position.set(Math.sin(t * .23) * .35, Math.cos(t * .19) * .25, 10 - Math.sin(t * .11) * .3); camera.lookAt(0, 0, 0);
  bloom.strength = .6;
  composer.render();
  updateUI(t);
  renderSubs(t);
  $('flash').style.opacity = fl * .6;
  const d = grainImg.data, f = Math.round(t * 60);
  for (let i = 0; i < d.length; i += 4) { const v = rnd(i * .13 + f * 77.7) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  grainCtx.putImageData(grainImg, 0, 0);
};
