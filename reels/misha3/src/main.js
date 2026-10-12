// «Напиши Міші» v3 — one continuous cinematic flight over Poland to the mountains and through them,
// with clean typography on top. Navy / graphite / grey / white + a touch of neon green.
import * as THREE from 'three';
import { makeRenderer, makeComposer, clamp, prog, lerp, easeOut, easeIn, rnd, esc } from '../../promo/src/kit.js';
import { makeTerrainWorld, height } from './terrain.js';

const $ = id => document.getElementById(id);
let WORDS = [], CUES = [], TOTAL = 50.4, R, composer, WORLD, cam, UI = [], PATH, LOOK, KT, T = {};
const W = (text, after = 0) => { const k = text.toLowerCase();
  const w = WORDS.find(w => w.start >= after && w.text.toLowerCase().replace(/[.,!?:—«»…]/g, '').startsWith(k));
  if (!w) throw new Error('word not found: ' + text); return w.start; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ICON = {
  bed: `<path d="M8 40V18M8 32h48v8M56 40V30a6 6 0 0 0-6-6H26v8M14 26a5 5 0 1 0 10 0 5 5 0 0 0-10 0"/>`,
  chef: `<path d="M20 44h24v-12a10 10 0 0 0 2-19 10 10 0 0 0-14-5 10 10 0 0 0-14 5 10 10 0 0 0 2 19zM20 38h24"/>`,
  moon: `<path d="M40 10a18 18 0 1 0 14 28A16 16 0 0 1 40 10z"/>`,
  wave: `<path d="M6 40c6-6 10-6 16 0s10 6 16 0 10-6 16 0M6 28c6-6 10-6 16 0s10 6 16 0 10-6 16 0"/>`,
  check: `<path d="M12 32l12 12 28-28"/>`, doc: `<path d="M18 6h20l12 12v38H18zM38 6v12h12M24 34h20M24 42h20"/>`,
  home: `<path d="M10 30L32 12l22 18M16 26v26h32V26M28 52V38h8v14"/>`, pin: `<path d="M32 56s18-16 18-30a18 18 0 0 0-36 0c0 14 18 30 18 30zM32 32a6 6 0 1 0 0-12 6 6 0 0 0 0 12"/>`,
  mtn: `<path d="M4 52l18-30 10 14 8-10 20 26z"/>`, heart: `<path d="M32 52S8 38 8 22a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z"/>`,
  phone: `<path d="M18 10h10l4 12-6 4a30 30 0 0 0 12 12l4-6 12 4v10a4 4 0 0 1-4 4C28 50 14 36 14 14a4 4 0 0 1 4-4z"/>`,
  tg: `<path d="M8 30l46-18-8 40-14-10-8 8 2-12 18-16-24 14z"/>`, wa: `<path d="M32 8a22 22 0 0 0-19 33l-3 13 13-3A22 22 0 1 0 32 8zM24 22c2 8 8 14 16 18"/>`,
  ms: `<path d="M32 8C18 8 8 18 8 30c0 7 3 13 8 17v9l8-5c2 1 5 1 8 1 14 0 24-10 24-22S46 8 32 8zM18 36l10-10 6 6 10-10"/>`,
};
const icon = (k, s = 64, c = '#b6ff3c', w = 4) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const card = (inner, extra = '') => `<div class="card" style="${extra}">${inner}</div>`;
function ui(html, [a, b], style = {}) { const el = document.createElement('div'); el.className = 'el'; el.innerHTML = html; Object.assign(el.style, style); $('ui').appendChild(el); UI.push({ el, a, b }); return el; }
function updateUI(t) {
  for (const u of UI) { const i = easeOut(prog(t, u.a, u.a + .6)), o = easeIn(prog(t, u.b - .45, u.b)), v = i * (1 - o);
    u.el.style.opacity = v; u.el.style.transform = `translateY(${(1 - i) * 36 - o * 16}px)`;
    u.el.style.filter = i < 1 || o > 0 ? `blur(${(1 - i) * 12 + o * 10}px)` : 'none'; }
}
function renderCaption(t) {
  const box = $('cap'), cue = CUES.find(c => t >= c.start && t < c.end + .3);
  if (!cue) { box.innerHTML = ''; box.dataset.k = ''; return; }
  if (box.dataset.k != cue.start) { box.dataset.k = cue.start;
    box.innerHTML = `<div class="cue">${cue.lines.map(l => `<span class="line">${l.map(w => `<span class="w ${w.tone ? 'hi' : ''}" data-s="${w.start}">${esc(w.text)}</span>`).join(' ')}</span>`).join('')}</div>`; }
  const out = easeIn(prog(t, cue.end, cue.end + .3));
  box.firstChild.style.opacity = 1 - out; box.firstChild.style.filter = out > 0 ? `blur(${out * 8}px)` : 'none';
  box.querySelectorAll('.w').forEach(el => { const s = +el.dataset.s, p = prog(t, s - .08, s + .25), e = easeOut(p);
    el.style.opacity = .12 + .88 * e; el.style.filter = p < 1 ? `blur(${(1 - e) * 6}px)` : 'none'; });
}

function build(cfg) {
  const t = (w, a = 0) => W(w, a);
  Object.assign(T, { oj: t('Ой'), last: t('минулого'), hi: t('Привіт'), misha: t('Міша'), hotel: t('готелях'), nerv: t('без', t('Польщі', 12)),
    gold: t('Золотих'), ne: t('не', t('Золотих')), mtn: t('гори'), south: t('півдні'), zate: t('Зате'), honest: t('чесно'),
    jobs: t('Зараз'), cities: t('Варшава'), more: t('не', t('ще', t('Оструда'))), terms: t('Підбір'), free: t('безкоштовний'), off: t('офіційне'), some: t('деяких'), avans: t('аванс'),
    write: t('Пиши'), num: t('+48'), fin: t('Напиши', 44), together: t('разом'), fit: t('ПІДХОДИТЬ') });
  const vt = cfg.vacancies.map(v => W(v.word));
  // the flight: north coast → Warsaw lights → south → into the mountains → through the valleys → up over the map
  const KEYS = [
    [0, [-0.6, 3.4, -9.0], [0.2, 0, -3.6]],
    [3.2, [-0.3, 2.7, -6.8], [0.8, 0, -2.2]],
    [7.8, [0.7, 2.1, -4.4], [2.1, 0, -0.7]],
    [12.4, [1.7, 1.55, -2.3], [2.2, .05, -0.2]],
    [15.4, [2.1, 1.9, -0.3], [1.4, .7, 3.6]],
    [18.6, [1.6, 1.85, 2.2], [1.1, 1.3, 5.0]],
    [21.4, [0.9, 1.75, 3.7], [1.6, 1.25, 6.4]],
    [24.8, [1.9, 1.85, 5.1], [3.2, 1.2, 7.4]],
    [28.6, [3.3, 2.3, 6.2], [2.4, 1.0, 3.0]],
    [31.6, [2.6, 5.6, 8.6], [1.0, 0, 0]],
    [34.0, [1.8, 6.2, 9.0], [0.8, 0, -0.6]],
    [38.8, [-1.4, 3.2, 6.6], [0.4, 1.0, 4.0]],
    [43.0, [-3.0, 2.5, 4.2], [-1.8, .8, 2.6]],
    [46.5, [-2.8, 4.0, 6.5], [-0.6, .4, 2.0]],
    [50.4, [-1.8, 7.8, 9.8], [0.4, 0, 0.6]],
  ];
  KT = KEYS.map(k => k[0]);
  PATH = new THREE.CatmullRomCurve3(KEYS.map(k => V(...k[1])), false, 'centripetal');
  LOOK = new THREE.CatmullRomCurve3(KEYS.map(k => V(...k[2])), false, 'centripetal');

  const L = { left: '80px', top: '1190px', width: '920px' };
  ui(card(`${icon('phone', 56)}<div><div class="kick">оголошення</div><div class="big">«Ой, вже неактуально…»</div></div>`), [T.oj - .1, T.hi - .3], L);
  ui(`<div class="stamp">Неактуально<i></i></div>`, [T.last, T.hi - .3], { left: '230px', top: '1420px' });
  ui(card(`<img src="assets/avatar.png" class="ava"><div><div class="big" style="font-size:56px">Міша</div><div class="kick" style="margin-top:8px">рекрутер · Sofius Group</div></div>`), [T.misha - .1, T.hotel - .1], L);
  ui(card(`${icon('home', 56)}<div class="big">Готелі Польщі</div>`), [T.hotel, T.nerv - .1], L);
  ui(`<div class="row">${card(`${icon('check', 44)}<div class="big" style="font-size:34px">Без нервів</div>`)}${card(`${icon('heart', 44)}<div class="big" style="font-size:34px">Без сюрпризів</div>`)}</div>`, [T.nerv, T.gold - .1], L);
  ui(`<div class="gold">Золоті гори?<i id="strike"></i></div>`, [T.gold, T.mtn + .25], { left: '0', top: '1210px', width: '1080px' });
  ui(card(`${icon('mtn', 56)}<div class="big">Гори — тільки на півдні</div>`), [T.south - .4, T.zate], L);
  ui(card(`${icon('check', 56)}<div><div class="big">Чесно про умови</div><div class="kick" style="margin-top:8px">ще до поїздки</div></div>`), [T.honest - .1, T.jobs - .1], L);
  cfg.vacancies.forEach((v, i) => ui(card(`${icon(v.icon, 60)}<div><div class="kick">шукаємо · 0${i + 1}</div><div class="big">${esc(v.label)}</div></div>`), [vt[i] - .15, i < 3 ? vt[i + 1] - .2 : T.cities - .2], L));
  ui(card(`${icon('pin', 56)}<div class="big">+ та інші міста</div>`), [T.more - .2, T.terms - .15], L);
  [[T.free, 'check', 'Підбір — безкоштовний'], [T.off, 'doc', 'Офіційне працевлаштування'], [T.avans, 'home', 'Аванс і житло від компанії']].forEach(([at, ic, txt], i, arr) =>
    ui(card(`${icon(ic, 56)}<div class="big" style="font-size:${txt.length > 22 ? 38 : 44}px">${txt}</div>`), [at - .2, i < 2 ? arr[i + 1][0] - .25 : T.write - .2], L));
  ui(`<div class="note">* у деяких містах</div>`, [T.some, T.write - .2], { left: '330px', top: '1420px' });
  ui(card(`<div style="display:flex;gap:26px">${icon('tg', 58, '#e6ebf2')}${icon('wa', 58, '#e6ebf2')}${icon('ms', 58, '#e6ebf2')}</div><div class="big" style="font-size:40px">Пиши або дзвони</div>`), [T.write, T.num - .1], L);
  ui(card(`${icon('phone', 56)}<div class="big" style="font-size:62px;color:#b6ff3c;white-space:nowrap">${esc(cfg.phone)}</div>`, 'justify-content:center'), [T.num, T.fin - .2], L);
  ui(`<div class="final">Напиши Міші!</div>`, [T.fin, TOTAL + 1], { left: '0', top: '1060px', width: '1080px' });
  ui(card(`<img src="assets/avatar.png" class="ava" style="width:118px;height:118px"><div style="flex:1"><div class="big" style="font-size:50px;color:#b6ff3c;white-space:nowrap">${esc(cfg.phone)}</div>
      <div style="display:flex;gap:18px;margin-top:10px;align-items:center">${icon('tg', 40, '#e6ebf2', 5)}${icon('wa', 40, '#e6ebf2', 5)}${icon('ms', 40, '#e6ebf2', 5)}<span class="kick">Telegram · WhatsApp · Messenger</span></div></div>`), [T.together, TOTAL + 1], { left: '60px', top: '1290px', width: '960px' });
  WORLD.cities.forEach((c, i) => { c.el = ui(`<div class="city">${esc(c.name)}</div>`, [Math.max(W(c.name) - .05, T.cities + i * .05), T.terms - .15]); });
}

window.setup = async cfg => {
  const wj = await (await fetch('words.json')).json(); WORDS = wj.words; CUES = wj.cues; TOTAL = cfg.total;
  await Promise.all(['900 80px Unbounded', '800 40px Unbounded', '700 30px "JetBrains Mono"', '800 40px Manrope'].map(f => document.fonts.load(f, 'АБВіїєzł')));
  await document.fonts.ready;
  R = makeRenderer($('gl'));
  WORLD = makeTerrainWorld(R.env);
  cam = new THREE.PerspectiveCamera(46, 1080 / 1920, .05, 200);
  const c = makeComposer(R.renderer, WORLD.scene, cam, { strength: .5, radius: .5, threshold: .85 });
  composer = c.composer; c.grade.uniforms.uVig.value = .45; c.grade.uniforms.uCA.value = .001;
  build(cfg); composer.render();
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const sc = $('stars').getContext('2d'); for (let i = 0; i < 260; i++) { sc.fillStyle = `rgba(220,230,255,${.15 + rnd(i) * .6})`; sc.fillRect(rnd(i + 1) * 1080, rnd(i + 2) * 900, 1.6, 1.6); }
  window.TOTAL = TOTAL; return TOTAL;
};

const grainCtx = $('grain').getContext('2d'), grainImg = grainCtx.createImageData(270, 480);
window.render = t => {
  let i = 0; while (i < KT.length - 2 && t >= KT[i + 1]) i++;
  const u = clamp((i + clamp((t - KT[i]) / (KT[i + 1] - KT[i]))) / (KT.length - 1));
  const p = PATH.getPoint(u), l = LOOK.getPoint(u);
  p.y = Math.max(p.y, height(p.x, p.z) + .55);
  p.x += Math.sin(t * .7) * .03; p.y += Math.sin(t * .9) * .02;
  cam.position.copy(p); cam.lookAt(l);
  const ahead = PATH.getPoint(clamp(u + .01)); cam.rotateZ(clamp(-(ahead.x - p.x) * .6, -.12, .12));
  WORLD.update(t);
  composer.render();
  const st = document.getElementById('strike'); if (st) st.style.width = `${easeOut(prog(t, T.ne, T.ne + .35)) * 100}%`;
  WORLD.cities.forEach(c => { const v = c.top.clone().project(cam); c.el.style.left = `${(v.x * .5 + .5) * 1080 + 16}px`; c.el.style.top = `${(-v.y * .5 + .5) * 1920 - 24}px`; });
  updateUI(t); renderCaption(t);
  $('progress').style.width = `${t / TOTAL * 1080}px`;
  const d = grainImg.data, f = Math.round(t * 60);
  for (let k = 0; k < d.length; k += 4) { const v = rnd(k * .13 + f * 77.7) * 255; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255; }
  grainCtx.putImageData(grainImg, 0, 0);
};
