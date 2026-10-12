// «Напиши Міші» v3 — dark monochrome 3D film: map fly-through, mountains with rain and a dancing bear,
// hotel crew, car, phone. Navy / graphite / grey / white + a touch of neon green.
import * as THREE from 'three';
import { makeRenderer, makeComposer, clamp, prog, lerp, easeOut, easeIn, easeInOut, rnd, esc } from '../../promo/src/kit.js';
import { makeWorld, makePhoneScene, animPerson, PAL, MAP_Y } from './world.js';

const $ = id => document.getElementById(id);
let WORDS = [], CUES = [], TOTAL = 50.4, CFG, R, composer, renderPass, bloomPass, gradePass, WORLD, PHONE, camW, camP, SEG = [], UI = [];
const W = (text, after = 0) => { const k = text.toLowerCase();
  const w = WORDS.find(w => w.start >= after && w.text.toLowerCase().replace(/[.,!?:—«»…]/g, '').startsWith(k));
  if (!w) throw new Error('word not found: ' + text); return w.start; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- line icons (white / neon) ----------------
const ICON = {
  bed: `<path d="M8 40V18M8 32h48v8M56 40V30a6 6 0 0 0-6-6H26v8M14 26a5 5 0 1 0 10 0 5 5 0 0 0-10 0"/>`,
  chef: `<path d="M20 44h24v-12a10 10 0 0 0 2-19 10 10 0 0 0-14-5 10 10 0 0 0-14 5 10 10 0 0 0 2 19zM20 38h24"/>`,
  moon: `<path d="M40 10a18 18 0 1 0 14 28A16 16 0 0 1 40 10zM50 12v6M47 15h6"/>`,
  wave: `<path d="M6 40c6-6 10-6 16 0s10 6 16 0 10-6 16 0M6 28c6-6 10-6 16 0s10 6 16 0 10-6 16 0M24 18a8 8 0 1 1 16 0"/>`,
  check: `<path d="M12 32l12 12 28-28"/>`, doc: `<path d="M18 6h20l12 12v38H18zM38 6v12h12M24 34h20M24 42h20"/>`,
  home: `<path d="M10 30L32 12l22 18M16 26v26h32V26M28 52V38h8v14"/>`, pin: `<path d="M32 56s18-16 18-30a18 18 0 0 0-36 0c0 14 18 30 18 30zM32 32a6 6 0 1 0 0-12 6 6 0 0 0 0 12"/>`,
  mtn: `<path d="M4 52l18-30 10 14 8-10 20 26zM18 28l4 6 4-4"/>`, heart: `<path d="M32 52S8 38 8 22a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z"/>`,
  tg: `<path d="M8 30l46-18-8 40-14-10-8 8 2-12 18-16-24 14z"/>`, wa: `<path d="M32 8a22 22 0 0 0-19 33l-3 13 13-3A22 22 0 1 0 32 8zM24 22c2 8 8 14 16 18"/>`,
  ms: `<path d="M32 8C18 8 8 18 8 30c0 7 3 13 8 17v9l8-5c2 1 5 1 8 1 14 0 24-10 24-22S46 8 32 8zM18 36l10-10 6 6 10-10"/>`,
  phone: `<path d="M20 8h24v48H20zM28 50h8"/>`,
};
const icon = (k, s = 64, c = '#b6ff3c', w = 4) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

// ---------------- UI helpers ----------------
function ui(html, [a, b], style = {}, from = 'up') {
  const el = document.createElement('div'); el.className = 'el'; el.innerHTML = html; Object.assign(el.style, style); $('ui').appendChild(el);
  UI.push({ el, a, b, from }); return el;
}
function updateUI(t) {
  for (const u of UI) {
    const i = easeOut(prog(t, u.a, u.a + .5)), o = easeIn(prog(t, u.b - .35, u.b)), v = i * (1 - o);
    u.el.style.opacity = v;
    u.el.style.transform = u.from === 'up' ? `translateY(${(1 - i) * 50 - o * 20}px)` : `translateX(${(1 - i) * (u.from === 'left' ? -90 : 90)}px)`;
    u.el.style.filter = i < 1 || o > 0 ? `blur(${(1 - i) * 14 + o * 12}px)` : 'none';
  }
}
const card = (inner, extra = '') => `<div class="card" style="${extra}">${inner}</div>`;

// ---------------- captions (kinetic, top) ----------------
function renderCaption(t) {
  const box = $('cap'), cue = CUES.find(c => t >= c.start && t < c.end + .25);
  if (!cue) { box.innerHTML = ''; box.dataset.k = ''; return; }
  if (box.dataset.k != cue.start) { box.dataset.k = cue.start;
    box.innerHTML = `<div class="cue">${cue.lines.map(l => `<span class="line">${l.map(w => `<span class="w ${w.tone ? 'hi' : ''}" data-s="${w.start}">${esc(w.text)}</span>`).join(' ')}</span>`).join('')}</div>`; }
  const out = easeIn(prog(t, cue.end, cue.end + .25));
  box.firstChild.style.opacity = 1 - out; box.firstChild.style.filter = out > 0 ? `blur(${out * 10}px)` : 'none';
  box.querySelectorAll('.w').forEach(el => { const s = +el.dataset.s, p = prog(t, s - .06, s + .2), e = easeOut(p);
    el.style.opacity = e; el.style.transform = `translateY(${(1 - e) * 34}px) scale(${lerp(.86, 1, e)})`; el.style.filter = p < 1 ? `blur(${(1 - e) * 8}px)` : 'none'; });
}

// ---------------- phone screen ----------------
function drawPhone(mode, t, tt) {
  const { ctx: c, tex } = PHONE.phone.userData, w = 540, h = 1110;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#121a28'); g.addColorStop(1, '#0a0f18'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.textAlign = 'center'; c.fillStyle = '#e6ebf2';
  c.font = '700 26px "JetBrains Mono"'; c.fillText('14:20', 270, 50);
  if (mode === 'call') {
    c.strokeStyle = '#b6ff3c'; c.lineWidth = 6; const ringK = tt.connected ? 0 : (t * 1.2) % 1;
    for (let i = 0; i < 3; i++) { const k = (ringK + i / 3) % 1; c.globalAlpha = tt.connected ? 0 : (1 - k) * .7; c.beginPath(); c.arc(270, 300, 110 + k * 120, 0, 7); c.stroke(); }
    c.globalAlpha = 1; c.fillStyle = '#1e2838'; c.beginPath(); c.arc(270, 300, 104, 0, 7); c.fill();
    c.strokeStyle = '#e6ebf2'; c.lineWidth = 7; c.strokeRect(232, 252, 76, 96); c.beginPath(); c.moveTo(270, 250); c.lineTo(270, 232); c.stroke();
    c.fillStyle = '#e6ebf2'; c.font = '800 40px Unbounded'; c.fillText('Готель «Сонечко»', 270, 480);
    c.fillStyle = '#8a94a6'; c.font = '700 30px Manrope'; c.fillText(tt.connected ? `00:0${Math.min(9, Math.floor(tt.since + 1))}` : 'Виклик…', 270, 530);
    if (tt.bubble > 0) { c.globalAlpha = tt.bubble; c.fillStyle = '#e6ebf2'; const y = 640 + (1 - tt.bubble) * 30;
      c.beginPath(); c.roundRect(50, y, 440, 170, 34); c.fill(); c.fillStyle = '#0d1420'; c.font = '800 36px Manrope'; c.textAlign = 'left';
      c.fillText('Ой, вакансія вже', 84, y + 70); c.fillText('неактуальна…', 84, y + 122); c.textAlign = 'center'; c.globalAlpha = 1; }
    c.fillStyle = '#c0392b'; c.globalAlpha = .9; c.beginPath(); c.arc(270, 960, 66, 0, 7); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.arc(270, 975, 34, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  } else {
    c.fillStyle = '#e6ebf2'; c.font = '800 36px Unbounded'; c.fillText('Міша · Sofius Group', 270, 140);
    const rows = [['Telegram', tt.a0], ['WhatsApp', tt.a1], ['Messenger', tt.a2]];
    rows.forEach(([n, a], i) => { if (a <= 0) return; c.globalAlpha = a; const y = 220 + i * 150 + (1 - a) * 30;
      c.fillStyle = a > .99 && tt.hot === i ? '#b6ff3c' : '#1e2838'; c.beginPath(); c.roundRect(50, y, 440, 120, 28); c.fill();
      c.fillStyle = tt.hot === i ? '#0d1420' : '#e6ebf2'; c.font = '800 40px Unbounded'; c.textAlign = 'left'; c.fillText(n, 100, y + 74); c.textAlign = 'center'; c.globalAlpha = 1; });
    if (tt.num) { c.fillStyle = '#b6ff3c'; c.font = '900 52px Unbounded'; c.fillText(tt.num, 270, 760);
      c.fillStyle = '#8a94a6'; c.font = '700 28px Manrope'; c.fillText('дзвонити Міші', 270, 700);
      c.fillStyle = '#2ecc71'; c.beginPath(); c.arc(270, 930, 70 * (1 + tt.pulse * .08), 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.arc(270, 945, 34, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
  }
  tex.needsUpdate = true;
}

// ---------------- film ----------------
function build(cfg) {
  const t = (w, a = 0) => W(w, a);
  const [wx, wz] = WORLD.warsaw, B = WORLD.best, crew = WORLD.crew;
  const T = {
    known: t('Знайоме'), call: t('Дзвониш'), oj: t('Ой'), last: t('минулого'), hi: t('Привіт'), misha: t('Міша'), hotel: t('готелях'), nerv: t('без', t('Польщі', 12)),
    gold: t('Золотих'), ne: t('не', t('Золотих')), mtn: t('гори'), south: t('півдні'), zate: t('Зате'), honest: t('чесно'), trip: t('поїдеш') - .4,
    jobs: t('Зараз'), cities: t('Варшава'), more: t('не', t('ще', t('Оструда'))), terms: t('Підбір'), free: t('безкоштовний'), off: t('офіційне'), some: t('деяких'), avans: t('аванс'),
    write: t('Пиши'), num: t('+48'), fin: t('Напиши', 44), together: t('разом'), fit: t('ПІДХОДИТЬ'),
  };
  const vt = cfg.vacancies.map(v => W(v.word));
  const hotelC = V(wx + .45, MAP_Y + .45, wz + .1);
  const crewC = () => { const c = V(0, 0, 0); crew.forEach(p => c.add(p.position)); return c.multiplyScalar(1 / crew.length); };
  const CC = crewC();
  // segments: which scene, camera pose function (absolute time)
  SEG = [
    { a: 0, b: T.call - .12, s: 'world', cam: x => { const k = easeInOut(prog(x, 0, T.call)); return [V(lerp(0, .6, k), lerp(13, 9.5, k), lerp(7.5, 5.6, k)), V(.4, 0, .3)]; } },
    { a: T.call - .12, b: T.hi - .25, s: 'phone', cam: x => { const k = easeInOut(prog(x, T.call, T.hi)); return [V(lerp(-.4, .25, k), lerp(1.4, 1.2, k), lerp(4.3, 3.6, k)), V(0, 1.05, 0)]; } },
    { a: T.hi - .25, b: T.gold - .15, s: 'world', cam: x => { const k = prog(x, T.hi, T.gold), ang = lerp(.35, 1.05, easeInOut(k)), r = lerp(2.6, 1.7, easeInOut(k));
        return [V(hotelC.x + Math.sin(ang) * r, lerp(1.25, .85, k), hotelC.z + Math.cos(ang) * r), hotelC.clone().add(V(0, .05, 0))]; } },
    { a: T.gold - .15, b: T.jobs - .1, s: 'world', fly: 1.6, cam: x => {
        if (x < T.mtn) { const k = easeInOut(prog(x, T.gold - .15, T.mtn)); return [V(lerp(wx + .8, B.x + .4, k), lerp(3.2, MAP_Y + B.h + 1.5, k), lerp(wz + 2.6, B.z + 3.2, k)), V(lerp(wx, B.x, k), lerp(.3, MAP_Y + B.h, k), lerp(wz, B.z, k))]; }
        if (x < T.zate) { const k = prog(x, T.mtn, T.zate), ang = lerp(.15, -.55, easeInOut(k)), r = lerp(3.4, 2.1, easeOut(k));
          return [V(B.x + Math.sin(ang) * r, MAP_Y + B.h + lerp(1.2, .45, easeOut(k)), B.z + Math.cos(ang) * r), V(B.x, MAP_Y + B.h + .2, B.z)]; }
        const k = easeInOut(prog(x, T.zate, T.jobs)); const ang = -.55;
        return [V(B.x + Math.sin(ang) * lerp(1.6, 4.5, k), MAP_Y + B.h + lerp(.35, 3.2, k), B.z + Math.cos(ang) * lerp(1.6, 4.5, k)), V(B.x, MAP_Y + B.h * lerp(1, .4, k), B.z - k * 1.5)]; } },
    { a: T.jobs - .1, b: T.cities - .3, s: 'world', fly: 1.2, cam: x => {
        let i = 0; while (i < vt.length - 1 && x >= vt[i + 1] - .45) i++;
        const focus = j => { const p = crew[j].position; return [V(p.x + .25, p.y + .55, p.z + 1.25), V(p.x, p.y + .32, p.z)]; };
        if (x < vt[0] - .45) { const [p, l] = focus(0); return [p.clone().add(V(0, .4, .9)), l]; }
        const prev = focus(Math.max(0, i - 1)), cur = focus(i), k = easeInOut(prog(x, vt[i] - .45, vt[i] + .05));
        return [prev[0].clone().lerp(cur[0], k), prev[1].clone().lerp(cur[1], k)]; } },
    { a: T.cities - .3, b: T.terms - .15, s: 'world', fly: 1.3, cam: x => { const k = easeInOut(prog(x, T.cities - .3, T.terms)); return [V(lerp(.4, 1.0, k), lerp(10.5, 8.8, k), lerp(6.8, 5.6, k)), V(.6, 0, -.2)]; } },
    { a: T.terms - .15, b: T.write - .2, s: 'world', fly: 1.3, cam: x => { const k = prog(x, T.terms, T.write), ang = lerp(-.3, .4, easeInOut(k));
        return [V(CC.x + Math.sin(ang) * 2.1, MAP_Y + .95, CC.z + Math.cos(ang) * 2.1), V(CC.x, MAP_Y + .35, CC.z)]; } },
    { a: T.write - .2, b: T.fin - .25, s: 'phone', cam: x => { const k = easeInOut(prog(x, T.write, T.fin)); return [V(lerp(.35, -.15, k), lerp(1.3, 1.15, k), lerp(4.1, 3.5, k)), V(0, 1.05, 0)]; } },
    { a: T.fin - .25, b: TOTAL + 1, s: 'world', cam: x => { const k = easeOut(prog(x, T.fin, TOTAL)); return [V(CC.x + .3, MAP_Y + lerp(.75, 1.6, k), CC.z + lerp(1.6, 3.4, k)), V(CC.x, MAP_Y + lerp(.45, .7, k), CC.z - k * .4)]; } },
  ];
  SEG.T = T; SEG.vt = vt;

  // ---- UI cards (bottom zone) ----
  const L = { left: '80px', top: '1180px', width: '920px' };
  ui(card(`${icon('pin', 56)}<div><div class="kick">оголошення</div><div class="big">«Ой, вже неактуально…»</div></div>`), [T.oj, T.hi - .3], L);
  ui(`<div class="stamp">Неактуально<i></i></div>`, [T.last, T.hi - .3], { left: '230px', top: '1390px' });
  ui(card(`<img src="assets/avatar.png" class="ava"><div><div class="big" style="font-size:52px">Міша</div><div class="kick" style="margin-top:6px">рекрутер · Sofius Group</div></div>`), [T.misha - .05, T.hotel - .1], L);
  ui(card(`${icon('home', 56)}<div class="big">Готелі Польщі</div>`), [T.hotel, T.nerv - .1], L);
  ui(`<div class="row">${card(`${icon('check', 44)}<div class="big" style="font-size:36px">Без нервів</div>`)}${card(`${icon('heart', 44)}<div class="big" style="font-size:36px">Без сюрпризів</div>`)}</div>`, [T.nerv, T.gold - .15], L);
  ui(`<div class="gold">Золоті гори?<i id="strike"></i></div>`, [T.gold, T.mtn + .2], { left: '0', top: '1200px', width: '1080px' });
  ui(card(`${icon('mtn', 56)}<div class="big">Гори — тільки на півдні</div>`), [T.south - .35, T.zate], L);
  ui(card(`${icon('check', 56)}<div><div class="big">Чесно про умови</div><div class="kick" style="margin-top:6px">ще до поїздки</div></div>`), [T.honest - .1, T.jobs - .1], L);
  cfg.vacancies.forEach((v, i) => ui(card(`${icon(v.icon, 60)}<div><div class="kick">шукаємо · 0${i + 1}</div><div class="big">${esc(v.label)}</div></div>`), [vt[i] - .1, i < 3 ? vt[i + 1] - .2 : T.cities - .3], L, 'right'));
  ui(card(`${icon('pin', 56)}<div class="big">+ та інші міста</div>`), [T.more - .2, T.terms - .15], L);
  [[T.free, 'check', 'Підбір — безкоштовний'], [T.off, 'doc', 'Офіційне працевлаштування'], [T.avans, 'home', 'Аванс і житло від компанії']].forEach(([at, ic, txt], i, arr) =>
    ui(card(`${icon(ic, 56)}<div class="big" style="font-size:${txt.length > 22 ? 38 : 44}px">${txt}</div>`), [at - .15, i < 2 ? arr[i + 1][0] - .25 : T.write - .2], L, i % 2 ? 'left' : 'right'));
  ui(`<div class="note">* у деяких містах</div>`, [T.some, T.write - .2], { left: '330px', top: '1390px' });
  ui(card(`<div style="display:flex;gap:26px">${icon('tg', 58, '#e6ebf2')}${icon('wa', 58, '#e6ebf2')}${icon('ms', 58, '#e6ebf2')}</div><div class="big" style="font-size:40px">Пиши або дзвони</div>`), [T.write, T.num - .1], L);
  ui(card(`<div class="big" style="font-size:66px;color:#b6ff3c;white-space:nowrap">${esc(cfg.phone)}</div>`, 'justify-content:center'), [T.num, T.fin - .25], L);
  ui(`<div class="final">Напиши Міші!</div>`, [T.fin, TOTAL + 1], { left: '0', top: '1110px', width: '1080px' });
  ui(card(`<img src="assets/avatar.png" class="ava" style="width:118px;height:118px"><div style="flex:1"><div class="big" style="font-size:50px;color:#b6ff3c;white-space:nowrap">${esc(cfg.phone)}</div>
      <div style="display:flex;gap:18px;margin-top:10px;align-items:center">${icon('tg', 40, '#e6ebf2', 5)}${icon('wa', 40, '#e6ebf2', 5)}${icon('ms', 40, '#e6ebf2', 5)}<span class="kick">Telegram · WhatsApp · Messenger</span></div></div>`), [T.together, TOTAL + 1], { left: '60px', top: '1330px', width: '960px' });
  // city labels (projected from 3D each frame)
  WORLD.pins.forEach((p, i) => { p.userData.el = ui(`<div class="city">${esc(p.userData.name)}</div>`, [Math.max(W(p.userData.name) - .05, T.cities + i * .05), T.terms - .15], {}, 'left'); });
}

function cameraAt(t) {
  let i = 0; while (i < SEG.length - 1 && t >= SEG[i + 1].a) i++;
  const s = SEG[i], [p, l] = s.cam(t);
  // fly transition inside the same 3D world: blend from where the previous segment ended
  if (s.fly && i > 0 && SEG[i - 1].s === s.s) { const k = easeInOut(prog(t, s.a, s.a + s.fly));
    if (k < 1) { const [pp, pl] = SEG[i - 1].cam(s.a); const lift = Math.sin(k * Math.PI) * 1.2; return { s, p: pp.clone().lerp(p, k).add(V(0, lift, 0)), l: pl.clone().lerp(l, k), i }; } }
  return { s, p, l, i };
}

const grainCtx = $('grain').getContext('2d'), grainImg = grainCtx.createImageData(270, 480);
window.setup = async cfg => {
  CFG = cfg; const wj = await (await fetch('words.json')).json(); WORDS = wj.words; CUES = wj.cues; TOTAL = cfg.total;
  await Promise.all(['900 80px Unbounded', '800 40px Unbounded', '700 30px "JetBrains Mono"', '800 40px Manrope'].map(f => document.fonts.load(f, 'АБВіїєzł')));
  await document.fonts.ready;
  R = makeRenderer($('gl'));
  WORLD = makeWorld(R.env); PHONE = makePhoneScene(R.env);
  camW = new THREE.PerspectiveCamera(42, 1080 / 1920, .05, 200); camP = new THREE.PerspectiveCamera(36, 1080 / 1920, .05, 100);
  const c = makeComposer(R.renderer, WORLD.scene, camW, { strength: .45, radius: .45, threshold: .9 });
  composer = c.composer; bloomPass = c.bloom; gradePass = c.grade; renderPass = composer.passes[0];
  gradePass.uniforms.uVig.value = .42; gradePass.uniforms.uCA.value = .0012;
  WORLD.crew.forEach((p, i) => animPerson(p, 0));
  build(cfg);
  for (const [sc, cam] of [[WORLD.scene, camW], [PHONE.scene, camP]]) { renderPass.scene = sc; renderPass.camera = cam; composer.render(); }
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  window.TOTAL = TOTAL; return TOTAL;
};

window.render = t => {
  const T = SEG.T, { s, p, l, i } = cameraAt(t);
  // world life
  WORLD.update(t);
  const crewMode = (j) => {
    if (t >= T.jobs - .1 && t < T.cities - .3) { const vi = SEG.vt.findIndex((v, k) => t >= v - .45 && (k === 3 || t < SEG.vt[k + 1] - .45)); return vi === j ? 'wave' : 'idle'; }
    if ((t >= T.terms && t < T.write) || t >= T.fit - .1) return 'cheer';
    if (t >= T.hi - .3 && t < T.gold) return j % 2 ? 'wave' : 'idle';
    if (t >= T.fin) return j % 3 === 0 ? 'cheer' : 'wave';
    return 'idle';
  };
  WORLD.crew.forEach((pp, j) => animPerson(pp, t, crewMode(j), j * 1.3));
  // phone screen
  if (s.s === 'phone') {
    if (t < T.write - .3) drawPhone('call', t, { connected: t > W('там'), since: t - W('там'), bubble: easeOut(prog(t, T.oj - .1, T.oj + .3)) });
    else { const aw = ['Телеграм', 'Вотсап', 'Месенджер'].map(w => W(w)); const groups = ['+48', '731', '292', '633'], gt = groups.map(g => W(g));
      const shown = gt.filter(g => t >= g - .05).length, hot = aw.findIndex((a, k) => t >= a - .1 && (k === 2 || t < aw[k + 1] - .1));
      drawPhone('apps', t, { a0: easeOut(prog(t, aw[0] - .2, aw[0] + .2)), a1: easeOut(prog(t, aw[1] - .2, aw[1] + .2)), a2: easeOut(prog(t, aw[2] - .2, aw[2] + .2)),
        hot: t < gt[0] - .2 ? hot : -1, num: shown ? groups.slice(0, shown).join(' ') : '', pulse: Math.max(0, Math.sin((t - gt[3]) * 8)) * (t > gt[3] ? 1 : 0) }); }
    PHONE.phone.rotation.y = Math.sin(t * .6) * .12; PHONE.dust.rotation.y = t * .03;
    camP.position.copy(p); camP.lookAt(l); renderPass.scene = PHONE.scene; renderPass.camera = camP;
  } else { camW.position.copy(p); camW.lookAt(l); renderPass.scene = WORLD.scene; renderPass.camera = camW; }
  bloomPass.strength = .45;
  composer.render();
  // whip transition between world and phone, soft light leak
  let whip = 0; for (let k = 1; k < SEG.length; k++) if (SEG[k].s !== SEG[k - 1].s) whip = Math.max(whip, 1 - Math.abs(t - SEG[k].a) / .22);
  $('stage').style.transform = whip > 0 ? `scale(${1 + .06 * whip * whip})` : '';
  $('stage').style.filter = whip > .05 ? `blur(${whip * whip * 10}px)` : 'none';
  let leak = 0, leakAt = 0; for (let k = 1; k < SEG.length; k++) { const v = 1 - Math.abs(t - SEG[k].a) / .5; if (v > leak) { leak = v; leakAt = SEG[k].a; } }
  $('leak').style.opacity = Math.max(0, leak) * .45;
  $('leak').style.background = `linear-gradient(${120 + (t - leakAt) * 90}deg, transparent 25%, rgba(182,255,60,.35) 48%, rgba(230,240,255,.25) 56%, transparent 75%)`;
  // golden mountains strike
  const st = document.getElementById('strike'); if (st) st.style.width = `${easeOut(prog(t, T.ne, T.ne + .3)) * 100}%`;
  // project city labels
  WORLD.pins.forEach(pin => { const v = pin.userData.top.clone().project(camW); const el = pin.userData.el;
    el.style.left = `${(v.x * .5 + .5) * 1080 + 18}px`; el.style.top = `${(-v.y * .5 + .5) * 1920 - 24}px`; });
  updateUI(t);
  renderCaption(t);
  $('progress').style.width = `${t / TOTAL * 1080}px`;
  $('tc').textContent = `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor(t % 1 * 30)).padStart(2, '0')}`;
  const d = grainImg.data, f = Math.round(t * 60);
  for (let i2 = 0; i2 < d.length; i2 += 4) { const v = rnd(i2 * .13 + f * 77.7) * 255; d[i2] = d[i2 + 1] = d[i2 + 2] = v; d[i2 + 3] = 255; }
  grainCtx.putImageData(grainImg, 0, 0);
};
