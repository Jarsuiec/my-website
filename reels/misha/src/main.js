// "Напиши Міші" — pop-art sticker promo for Sofius Group. Deterministic render(t) for frame capture.
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeIn = x => x * x * x;
const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const backOut = (x, c = 2.2) => 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
const elastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - .75) * 2.094) + 1;
const rnd = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

let WORDS = [], CUES = [], TOTAL = 54.4, SC = [], CFG;
const W = (text, after = 0) => {
  const k = text.toLowerCase();
  const w = WORDS.find(w => w.start >= after && w.text.toLowerCase().replace(/[.,!?:—«»…]/g, '').startsWith(k));
  if (!w) throw new Error('word not found: ' + text);
  return w.start;
};
// sticker pop: scale/rotate in with overshoot; returns progress
function pop(el, t, at, { dur = .42, rot = 0, from = 0, y = 0, x = 0, out = null, outDur = .25 } = {}) {
  const p = clamp((t - at) / dur), e = elastic(p), o = out != null ? easeIn(prog(t, out, out + outDur)) : 0;
  el.style.opacity = t < at ? 0 : clamp(p * 4) * (1 - o);
  el.style.transform = `translate(${x * (1 - e)}px, ${y * (1 - e) + o * 40}px) scale(${lerp(from, 1, e) * (1 - o * .3)}) rotate(${rot * (1 - e) + (el.dataset.tilt || 0) * 1}deg)`;
  return p;
}
const slam = (el, t, at, tilt = 0) => { const p = prog(t, at, at + .28), e = backOut(p, 1.6);
  el.style.opacity = t < at ? 0 : clamp(p * 3); el.style.transform = `scale(${lerp(2.6, 1, e)}) rotate(${tilt + (1 - e) * -10}deg)`; return p; };

const AV = (size, x, y, extra = '') => `<div class="avatar" style="width:${size}px;height:${size}px;left:${x}px;top:${y}px;${extra}"><img src="assets/avatar.png"></div>`;
const ICONS = {
  tg: s => `<svg width="${s}" height="${s}" viewBox="0 0 240 240"><circle cx="120" cy="120" r="112" fill="#2AABEE" stroke="#111" stroke-width="14"/><path d="M58 117l112-44c6-2 11 2 9 10l-19 90c-1 7-6 8-12 5l-30-22-14 14c-2 2-3 3-7 3l2-31 57-51c3-2-1-4-4-2l-70 44-30-9c-7-2-7-7 1-10z" fill="#fff"/></svg>`,
  wa: s => `<svg width="${s}" height="${s}" viewBox="0 0 240 240"><circle cx="120" cy="120" r="112" fill="#25D366" stroke="#111" stroke-width="14"/><path d="M120 52a66 66 0 0 0-57 99l-9 33 34-9a66 66 0 1 0 32-123z" fill="none" stroke="#fff" stroke-width="13"/><path d="M95 88c3-6 8-6 10-1l7 15c1 3 0 6-2 8l-5 5c5 11 14 20 25 25l5-5c2-2 5-3 8-2l15 7c5 2 5 7-1 10-9 6-20 7-32 0-17-9-30-23-37-38-4-9-1-18 7-24z" fill="#fff"/></svg>`,
  ms: s => `<svg width="${s}" height="${s}" viewBox="0 0 240 240"><defs><linearGradient id="msg${s}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a7cff"/><stop offset=".6" stop-color="#a033ff"/><stop offset="1" stop-color="#ff5c87"/></linearGradient></defs><circle cx="120" cy="120" r="112" fill="url(#msg${s})" stroke="#111" stroke-width="14"/><path d="M62 146l38-60c4-6 10-7 15-3l25 19 33-25c5-4 11 2 7 7l-38 60c-4 6-10 7-15 3l-25-19-33 25c-5 4-11-2-7-7z" fill="#fff"/></svg>`,
};

// ---------- Poland map (simplified outline, lon/lat → px) ----------
const PL = [[14.12,53.9],[15.5,54.2],[16.5,54.55],[17.6,54.8],[18.4,54.83],[18.6,54.43],[19.6,54.45],[20.5,54.38],[21.5,54.33],[22.8,54.36],[23.5,54.1],[23.6,53.6],[23.9,53.15],[23.6,52.6],[23.2,52.25],[23.6,51.9],[23.6,51.5],[24.1,50.85],[23.6,50.4],[22.7,49.6],[22.6,49.08],[22.0,49.2],[21.0,49.38],[20.3,49.4],[19.9,49.2],[19.4,49.6],[18.85,49.5],[18.0,50.0],[17.6,50.25],[16.9,50.45],[16.6,50.15],[16.2,50.6],[15.3,50.85],[14.8,50.87],[14.95,51.45],[14.7,52.08],[14.6,52.6],[14.15,52.85],[14.3,53.25]];
const K = 84, proj = ([lo, la]) => [(lo - 13.9) * K, (55.05 - la) * K * 1.62];
const PL_PATH = 'M' + PL.map(p => proj(p).map(v => v.toFixed(1)).join(' ')).join(' L') + ' Z';
const CITIES = [['Варшава', 21.01, 52.23, 'Варшава', 'r', 0], ['Гданськ', 18.65, 54.35, 'Гданськ', 'l', 0], ['Краків', 19.94, 50.06, 'Краків', 'r', 0],
  ['Міжздроє', 14.48, 53.93, 'Міжздроє', 'd', 0], ['Миколайки', 21.59, 53.80, 'Миколайки', 'r', -20], ['Оструда', 19.96, 53.70, 'Оструда', 'd', 0]];
const MAP_W = proj([24.2, 0])[0], MAP_H = proj([0, 48.9])[1];
const mapSVG = (id, fill = '#ffe11a') => `<svg id="${id}" class="abs" width="${MAP_W + 40}" height="${MAP_H + 40}" viewBox="-20 -20 ${MAP_W + 40} ${MAP_H + 40}" style="overflow:visible">
  <path d="${PL_PATH}" transform="translate(14 16)" fill="#111"/>
  <path d="${PL_PATH}" fill="${fill}" stroke="#111" stroke-width="9" stroke-linejoin="round"/></svg>`;

// ---------- scenes ----------
function build(cfg) {
  const root = $('scenes'); const scenes = [];
  const add = (id, t, bg, html, update) => {
    const el = document.createElement('div'); el.className = 'scene'; el.style.background = bg; el.innerHTML = html; root.appendChild(el);
    const q = s => el.querySelector(s), qa = s => [...el.querySelectorAll(s)];
    scenes.push({ id, t, el, bg, update: update(q, qa) });
  };
  const T = Object.fromEntries(cfg.scenes.map(s => [s.id, s.t]));

  // 1. HOOK ------------------------------------------------------------
  add('hook', T.hook, 'var(--y)', `<div class="dots"></div><div class="stripes"></div>
    <div class="abs" id="h_words" style="left:0;right:0;top:330px;text-align:center">
      <div class="big outline h_w" style="font-size:132px;color:#fff">Шукаєш</div>
      <div class="big outline h_w" style="font-size:132px;color:#fff;margin-top:10px">роботу</div>
      <div class="big outline h_w" style="font-size:118px;color:var(--c);margin-top:10px">в Польщі</div>
    </div>
    <div class="abs big outline" id="h_q" style="right:40px;top:930px;font-size:420px;color:var(--b)">?</div>
    <div class="abs" id="h_bag" style="left:70px;top:1010px;font-size:190px">🧳</div>
    <div class="bubble tail-b" id="h_known" style="left:120px;top:1060px;font-size:64px;background:var(--p)">Знайоме,<br>правда? 🙃</div>`,
  (q, qa) => {
    const ws = qa('.h_w'), times = [0, W('роботу'), W('Польщі')];
    return t => {
      ws.forEach((w, i) => i === 0 ? (w.style.opacity = 1, w.style.transform = `scale(${1 + .04 * Math.sin(t * 6)}) rotate(-3deg)`) : slam(w, t, times[i], i % 2 ? 3 : -2));
      const qp = prog(t, 0, .45);
      q('#h_q').style.opacity = qp > 0 ? 1 : 0;
      q('#h_q').style.transform = `scale(${elastic(qp)}) rotate(${12 + Math.sin(t * 7) * 8}deg) translateY(${Math.abs(Math.sin(t * 6)) * -30}px)`;
      pop(q('#h_bag'), t, .15, { rot: -30, y: 200 });
      q('#h_bag').style.transform += ` rotate(${Math.sin(t * 5) * 8}deg)`;
      const k = W('Знайоме');
      pop(q('#h_known'), t, k - .05, { rot: -12 });
      const up = easeInOut(prog(t, k - .1, k + .3));
      q('#h_words').style.transform = `translateY(${-up * 60}px) scale(${1 - up * .1})`;
    };
  });

  // 2. PAIN GAG: the call -----------------------------------------------
  add('pain', T.pain, 'var(--c)', `<div class="dots"></div>
    <div class="phone" style="left:60px;top:200px;height:980px"><div class="notch"></div><div class="scr">
      <div class="fill" id="p_call" style="background:linear-gradient(#2a2f3a,#14171d);color:#fff;display:flex;flex-direction:column;align-items:center;padding-top:150px">
        <div style="width:200px;height:200px;border-radius:50%;background:var(--s);border:7px solid #fff;display:grid;place-items:center;font-size:110px">🏨</div>
        <div style="font-family:var(--d);font-weight:900;font-size:40px;margin-top:34px">Готель «Сонечко»</div>
        <div id="p_state" style="font-family:var(--t);font-weight:800;font-size:34px;margin-top:16px;opacity:.75">Виклик…</div>
        <div id="p_rings" class="abs" style="left:50%;top:250px"></div>
        <div style="position:absolute;bottom:90px;width:150px;height:150px;border-radius:50%;background:#ff3b30;display:grid;place-items:center;font-size:70px;border:6px solid #111">📞</div>
      </div>
    </div></div>
    <div class="bubble tail-l" id="p_bub" style="left:560px;top:420px;font-size:40px;width:470px">Ой, вакансія вже неактуальна…</div>
    <div class="abs" id="p_cal" style="left:640px;top:760px;width:360px;background:#fff;border:7px solid #111;border-radius:26px;box-shadow:12px 12px 0 #111;overflow:hidden;text-align:center">
      <div style="background:#111;color:#fff;font-family:var(--d);font-weight:900;font-size:32px;padding:12px">ОГОЛОШЕННЯ</div>
      <div id="p_year" style="font-family:var(--d);font-weight:900;font-size:120px;padding:10px 0 4px">2026</div>
      <div style="font-family:var(--t);font-weight:800;font-size:28px;padding-bottom:18px">опубліковано</div>
      <div class="abs" style="right:-18px;top:-30px;font-size:84px">🕸️</div>
    </div>
    <div class="abs stk" id="p_stamp" style="left:120px;top:1150px;font-size:76px;color:var(--c);background:#fff;border-color:var(--c);box-shadow:12px 12px 0 #111">Неактуально</div>`,
  (q, qa) => {
    const tCall = W('Дзвониш'), tThere = W('там'), tOj = W('Ой'), tLast = W('минулого');
    const rings = q('#p_rings');
    rings.innerHTML = [0, 1, 2].map(() => '<div style="position:absolute;width:220px;height:220px;margin:-110px;border-radius:50%;border:6px solid rgba(127,211,255,.8)"></div>').join('');
    return (t, lt) => {
      const ph = easeOut(prog(lt, 0, .35));
      q('.phone').style.transform = `translateY(${(1 - ph) * 500}px) rotate(${(1 - ph) * 10 - 2}deg)`;
      const connected = t > tThere;
      q('#p_state').textContent = connected ? '00:0' + Math.min(9, Math.floor(t - tThere + 1)) : 'Виклик…';
      [...rings.children].forEach((r, i) => { const k = ((t * 1.3 + i / 3) % 1); r.style.transform = `scale(${1 + k * 1.2})`; r.style.opacity = connected ? 0 : 1 - k; });
      pop(q('#p_bub'), t, tOj - .1, { rot: 8, x: 200 });
      const yr = t < tLast ? 2026 : 2026 - (t > tLast + .25 ? 1 : 0);
      q('#p_year').textContent = yr;
      q('#p_year').style.color = t > tLast + .25 ? 'var(--c)' : '#111';
      pop(q('#p_cal'), t, tLast - .25, { rot: -25, y: 300 });
      q('#p_cal').style.transform += ` rotate(${-6 + Math.sin(t * 3) * 1.5}deg)`;
      slam(q('#p_stamp'), t, tLast + .2, -8);
      return { shake: Math.max(0, 1 - Math.abs(t - tLast - .3) * 4) };
    };
  });

  // 3. MEET MISHA ---------------------------------------------------------
  add('meet', T.meet, 'var(--b)', `<div class="rays" id="m_rays"></div><div class="dots" style="opacity:.6"></div>
    ${AV(560, 260, 200)}
    <div class="abs" id="m_wave" style="left:740px;top:240px;font-size:150px">👋</div>
    <div class="abs stk" id="m_name" style="left:300px;top:690px;font-size:120px;background:var(--y);padding:10px 50px">Міша</div>
    <div class="abs stk" id="m_role" style="left:110px;top:900px;font-size:40px;background:#fff">Рекрутер · Sofius Group</div>
    <div class="abs stk" id="m_hotel" style="left:150px;top:1035px;font-size:40px;background:var(--s)">🏨 Готелі Польщі</div>
    <div class="abs stk" id="m_n1" style="left:60px;top:1170px;font-size:40px;background:var(--m)">✓ Без нервів</div>
    <div class="abs stk" id="m_n2" style="left:540px;top:1170px;font-size:40px;background:var(--m)">✓ Без сюрпризів</div>`,
  (q) => {
    const tHi = W('Привіт'), tName = W('Міша'), tRole = W('рекрутер'), tHotel = W('готелях'), tN1 = W('без', W('Польщі', 12)), tN2 = W('без', tN1 + .1);
    const av = q('.avatar');
    return t => {
      q('#m_rays').style.transform = `rotate(${t * 12}deg)`;
      pop(av, t, tHi - .15, { rot: -20, from: .2 });
      av.style.transform += ` translateY(${Math.sin(t * 2.4) * 8}px)`;
      pop(q('#m_wave'), t, tHi, { rot: 40 }); q('#m_wave').style.transform += ` rotate(${Math.sin(t * 14) * 18}deg)`;
      q('#m_name').dataset.tilt = -4; pop(q('#m_name'), t, tName - .05, { rot: 12 });
      q('#m_role').dataset.tilt = 2; pop(q('#m_role'), t, tRole, { x: -300 });
      q('#m_hotel').dataset.tilt = -2; pop(q('#m_hotel'), t, tHotel - .05, { x: 300 });
      q('#m_n1').dataset.tilt = -3; pop(q('#m_n1'), t, tN1, { rot: -15 });
      q('#m_n2').dataset.tilt = 3; pop(q('#m_n2'), t, tN2, { rot: 15 });
    };
  });

  // 4. "NO GOLDEN MOUNTAINS" GAG ------------------------------------------------
  const goldMtn = `<svg class="abs" id="g_gold" width="900" height="520" viewBox="0 0 900 520" style="left:90px;top:330px;overflow:visible">
    <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a8"/><stop offset=".4" stop-color="#ffd23d"/><stop offset="1" stop-color="#d89a10"/></linearGradient></defs>
    <path d="M20 500 L230 150 L360 330 L470 60 L640 330 L730 210 L880 500 Z" transform="translate(14 14)" fill="#111"/>
    <path d="M20 500 L230 150 L360 330 L470 60 L640 330 L730 210 L880 500 Z" fill="url(#gold)" stroke="#111" stroke-width="9" stroke-linejoin="round"/>
    <path d="M430 128 L470 60 L512 128 L488 116 L470 140 L452 116 Z M205 192 L230 150 L256 192 L240 184 L230 200 L220 184 Z" fill="#fff"/>
    ${[[300, 120], [600, 160], [800, 250], [140, 300]].map(([x, y], i) => `<text class="g_sp" x="${x}" y="${y}" font-size="70">✨</text>`).join('')}
    <path id="g_x1" d="M60 40 L860 500" stroke="#ff3b30" stroke-width="44" stroke-linecap="round" stroke-dasharray="930" stroke-dashoffset="930"/>
    <path id="g_x2" d="M860 40 L60 500" stroke="#ff3b30" stroke-width="44" stroke-linecap="round" stroke-dasharray="930" stroke-dashoffset="930"/></svg>`;
  const south = [[16.0, 50.55], [16.5, 50.32], [19.5, 49.45], [19.95, 49.3], [20.4, 49.42], [22.3, 49.2]].map(p => proj(p));
  add('gold', T.gold, 'var(--s)', `<div class="dots"></div>
    <div class="abs big outline" id="g_title" style="left:0;right:0;top:200px;text-align:center;font-size:96px;color:var(--y)">Золоті гори?</div>
    ${goldMtn}
    <div class="abs stk" id="g_no" style="left:250px;top:880px;font-size:58px;background:#fff;color:#ff3b30">Не обіцяю</div>
    ${AV(230, 780, 820)}<div class="abs" id="g_lol" style="left:940px;top:800px;font-size:100px">😄</div>
    <div class="abs" id="g_map" style="left:90px;top:260px">${mapSVG('g_pl', '#9be7c4')}
      <svg class="abs" width="${MAP_W + 40}" height="${MAP_H + 60}" viewBox="-20 -20 ${MAP_W + 40} ${MAP_H + 60}" style="left:0;top:0;overflow:visible">
        ${south.map(([x, y], i) => `<path class="g_m" d="M${x - 62} ${y + 18} L${x} ${y - 100} L${x + 62} ${y + 18} Z" fill="#8a6a44" stroke="#111" stroke-width="7" stroke-linejoin="round"/>`).join('')}
      </svg>
      <div class="abs stk" id="g_here" style="left:${south[3][0] - 210}px;top:${south[3][1] + 70}px;font-size:46px;background:#fff">👆 Гори тільки тут</div>
      <div class="abs big" id="g_flat" style="left:220px;top:300px;font-size:44px;color:#111;opacity:.6">рівнина…</div>
    </div>
    <div class="abs stk" id="g_honest" style="left:110px;top:200px;font-size:62px;background:var(--y)">✓ Чесно про умови</div>
    <div class="abs stk" id="g_trip" style="left:250px;top:1200px;font-size:42px;background:#fff">🧳 Ще до поїздки</div>`,
  (q, qa) => {
    const tGold = W('Золотих'), tNo = W('не', tGold), tMtn = W('гори'), tSouth = W('півдні'), tHonest = W('чесно'), tTrip = W('поїдеш') - .45;
    const mts = qa('.g_m'), sp = qa('.g_sp');
    return t => {
      const goldOn = t < tMtn - .05;
      const rise = backOut(prog(t, tGold - .1, tGold + .45), 1.3), sink = easeIn(prog(t, tMtn - .45, tMtn - .05));
      q('#g_gold').style.opacity = goldOn ? 1 : 0;
      q('#g_gold').style.transform = `translateY(${(1 - rise) * 600 + sink * 700}px)`;
      sp.forEach((s, i) => s.setAttribute('opacity', .5 + .5 * Math.sin(t * 8 + i * 2)));
      q('#g_x1').setAttribute('stroke-dashoffset', 930 * (1 - easeOut(prog(t, tNo, tNo + .2))));
      q('#g_x2').setAttribute('stroke-dashoffset', 930 * (1 - easeOut(prog(t, tNo + .15, tNo + .35))));
      q('#g_title').style.opacity = goldOn ? 1 : 0; pop(q('#g_title'), t, tGold - .15, { rot: -8 }); if (!goldOn) q('#g_title').style.opacity = 0;
      q('#g_no').dataset.tilt = -6; pop(q('#g_no'), t, tNo + .3, { rot: 20, out: tMtn - .3 });
      const av = q('.avatar'); pop(av, t, tNo + .6, { x: 300, out: tMtn - .2 }); av.style.transform += ` rotate(${Math.sin(t * 16) * 6}deg)`;
      pop(q('#g_lol'), t, tNo + .8, { out: tMtn - .2 }); q('#g_lol').style.transform += ` rotate(${Math.sin(t * 18) * 15}deg)`;
      // map gag
      const mp = easeOut(prog(t, tMtn - .05, tMtn + .35)), up = easeInOut(prog(t, tHonest - .3, tHonest + .2));
      const map = q('#g_map'); map.style.opacity = t > tMtn - .05 ? 1 : 0;
      map.style.transform = `translateY(${(1 - mp) * 900 + up * 260}px) scale(${1 - up * .25})`;
      mts.forEach((m, i) => { const p = elastic(prog(t, tSouth - .15 + i * .06, tSouth + .3 + i * .06)); m.style.transformOrigin = 'center bottom'; m.style.transformBox = 'fill-box'; m.style.transform = `scaleY(${p})`; });
      q('#g_here').dataset.tilt = 3; pop(q('#g_here'), t, tSouth + .15, { y: 120 });
      q('#g_flat').style.opacity = t > tMtn + .2 && t < tSouth ? .6 : 0;
      q('#g_honest').dataset.tilt = -3; slam(q('#g_honest'), t, tHonest - .05, -3);
      q('#g_trip').dataset.tilt = 2; pop(q('#g_trip'), t, tTrip, { x: 400 });
      return { shake: Math.max(0, 1 - Math.abs(t - tHonest) * 4) * .7 };
    };
  });

  // 5. VACANCIES -------------------------------------------------------------
  const vac = cfg.vacancies;
  add('jobs', T.jobs, 'var(--y)', `<div class="stripes"></div><div class="dots"></div>
    <div class="abs big outline" id="j_head" style="left:0;right:0;top:190px;text-align:center;font-size:120px;color:var(--b)">Шукаємо:</div>
    ${vac.map((v, i) => `<div class="abs stk j_c" style="left:${i % 2 ? 150 : 70}px;top:${370 + i * 225}px;width:860px;font-size:${v.label.length > 18 ? 42 : 54}px;background:${v.color};white-space:normal">
      <span style="font-size:96px;line-height:1">${v.icon}</span><span>${esc(v.label)}</span></div>`).join('')}`,
  (q, qa) => {
    const cards = qa('.j_c'), times = vac.map(v => W(v.word)), tHead = W('Зараз');
    return t => {
      slam(q('#j_head'), t, tHead, -2);
      cards.forEach((c, i) => { c.dataset.tilt = i % 2 ? 2.5 : -2.5; pop(c, t, times[i] - .05, { y: -500, rot: i % 2 ? 25 : -25 }); });
    };
  });

  // 6. CITIES ---------------------------------------------------------------------
  add('cities', T.cities, 'var(--b)', `<div class="rays" style="opacity:.6"></div><div class="dots" style="opacity:.5"></div>
    <div class="abs big outline" style="left:0;right:0;top:170px;text-align:center;font-size:84px;color:#fff">Міста</div>
    <div class="abs" id="c_map" style="left:80px;top:300px">${mapSVG('c_pl')}
      ${CITIES.map(([n, lo, la], i) => { const [x, y] = proj([lo, la]); return `<div class="abs c_pin" style="left:${x - 30}px;top:${y - 84}px">
        <svg width="60" height="84" viewBox="0 0 60 84"><path d="M30 82 C30 82 4 48 4 30 A26 26 0 1 1 56 30 C56 48 30 82 30 82Z" fill="#ff5a4e" stroke="#111" stroke-width="6"/><circle cx="30" cy="30" r="10" fill="#fff" stroke="#111" stroke-width="5"/></svg>
        <div class="stk c_lbl" style="position:absolute;${{ r: 'left:62px;top:6px', l: 'right:62px;top:6px', u: 'left:-40px;top:-62px', d: 'left:-20px;top:92px' }[CITIES[i][4]]};margin-top:${CITIES[i][5]}px;font-size:30px;padding:8px 18px;border-width:5px;border-radius:18px;box-shadow:6px 6px 0 #111;background:#fff">${esc(n)}</div></div>`; }).join('')}
    </div>
    <div class="abs stk" id="c_more" style="left:200px;top:1185px;font-size:44px;background:var(--m)">+ та інші міста</div>`,
  (q, qa) => {
    const pins = qa('.c_pin'); let last = -1;
    const times = CITIES.map(c => { const tw = Math.max(W(c[3]) - .05, last + .32); last = tw; return tw; });
    const tMore = W('не', W('ще', W('Оструда')));
    return t => {
      const mp = easeOut(prog(t, T.cities[0] - .05, T.cities[0] + .35));
      q('#c_map').style.transform = `scale(${lerp(.6, 1, backOut(mp, 1.4))}) rotate(${(1 - mp) * -8}deg)`;
      pins.forEach((p, i) => pop(p, t, times[i], { y: -260, dur: .38 }));
      q('#c_more').dataset.tilt = -3; pop(q('#c_more'), t, tMore - .2, { rot: 18 });
    };
  });

  // 7. CONDITIONS ---------------------------------------------------------------------
  add('terms', T.terms, 'var(--m)', `<div class="dots"></div>
    <div class="abs stk t_c" style="left:70px;top:280px;width:940px;font-size:52px;background:#fff;white-space:normal"><span style="font-size:100px">🆓</span><span>Підбір —<br>безкоштовний</span></div>
    <div class="abs stk t_c" style="left:70px;top:610px;width:940px;font-size:44px;background:var(--y);white-space:normal"><span style="font-size:100px">📄</span><span>Офіційне<br>працевлаштування</span></div>
    <div class="abs stk t_c" style="left:70px;top:940px;width:940px;font-size:50px;background:var(--p);white-space:normal"><span style="font-size:100px">🏠</span><span>Аванс і житло<br>від компанії</span></div>
    <div class="abs stk" id="t_note" style="left:330px;top:1190px;font-size:36px;background:#111;color:#fff;box-shadow:8px 8px 0 #fff">*у деяких містах</div>`,
  (q, qa) => {
    const cards = qa('.t_c'), times = [W('безкоштовний'), W('офіційне'), W('аванс')], tSome = W('деяких');
    return t => {
      cards.forEach((c, i) => { c.dataset.tilt = [-2, 2, -1.5][i]; pop(c, t, times[i] - .25, { x: i % 2 ? 900 : -900, rot: i % 2 ? 10 : -10 }); });
      q('#t_note').dataset.tilt = 3; pop(q('#t_note'), t, Math.min(tSome, times[2] - .1), { rot: -15 });
      return { shake: times.reduce((m, tt) => Math.max(m, Math.max(0, 1 - Math.abs(t - tt + .1) * 6) * .5), 0) };
    };
  });

  // 8. CONTACTS ---------------------------------------------------------------------
  add('contact', T.contact, 'var(--y)', `<div class="stripes"></div><div class="dots"></div>
    <div class="abs big outline" style="left:0;right:0;top:180px;text-align:center;font-size:92px;color:#fff">Пиши<br>або дзвони</div>
    <div class="phone" style="left:240px;top:430px;height:900px"><div class="notch"></div><div class="scr" style="background:#fff">
      <div id="k_apps" class="fill" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;padding:40px">
        ${[['tg', 'Telegram', '#2AABEE'], ['wa', 'WhatsApp', '#25D366'], ['ms', 'Messenger', '#8b3dff']].map(([k, n, c]) => `<div class="k_app" style="display:flex;align-items:center;gap:26px;width:470px;padding:18px 24px;border:6px solid #111;border-radius:30px;background:#fff;box-shadow:8px 8px 0 #111">
          ${ICONS[k](110)}<span style="font-family:var(--d);font-weight:900;font-size:40px">${n}</span></div>`).join('')}
      </div>
      <div id="k_dial" class="fill" style="background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;padding-top:120px">
        <div style="font-family:var(--t);font-weight:800;font-size:30px;opacity:.7">Дзвонити Міші</div>
        <div id="k_num" style="font-family:var(--d);font-weight:900;font-size:46px;margin-top:30px;white-space:nowrap"></div>
        <div style="display:grid;grid-template-columns:repeat(3,110px);gap:22px;margin-top:60px">${'123456789*0#'.split('').map(d => `<div class="k_key" style="width:110px;height:110px;border-radius:50%;background:#2a2f3a;display:grid;place-items:center;font-family:var(--d);font-weight:800;font-size:44px">${d}</div>`).join('')}</div>
        <div id="k_callbtn" style="margin-top:46px;width:140px;height:140px;border-radius:50%;background:#25D366;display:grid;place-items:center;font-size:66px;border:6px solid #fff">📞</div>
      </div>
    </div></div>`,
  (q, qa) => {
    const apps = qa('.k_app'), tApps = [W('Телеграм'), W('Вотсап'), W('Месенджер')], tCall = W('дзвони', 40);
    const groups = ['+48', '731', '292', '633'], gt = groups.map((g, i) => W(g.replace('+', '+')));
    const keys = qa('.k_key');
    return (t, lt) => {
      const ph = easeOut(prog(lt, 0, .35));
      q('.phone').style.transform = `translateY(${(1 - ph) * 700}px) rotate(${(1 - ph) * -8 + 1}deg)`;
      apps.forEach((a, i) => { pop(a, t, tApps[i] - .1, { x: 500 }); const glow = Math.max(0, 1 - Math.abs(t - tApps[i] - .2) * 2.5);
        a.style.background = glow > .05 ? `rgba(255,225,26,${glow})` : '#fff'; });
      const dial = t > tCall - .1; q('#k_dial').style.opacity = dial ? 1 : 0;
      q('#k_dial').style.transform = `translateY(${(1 - easeOut(prog(t, tCall - .1, tCall + .2))) * 900}px)`;
      const shown = gt.filter(g => t >= g - .05).length;
      q('#k_num').textContent = groups.slice(0, shown).join(' ');
      keys.forEach((k, i) => { const hit = gt.some(g => t > g - .05 && t < g + .18) && (i * 7 + Math.floor(t * 10)) % 5 === 0; k.style.background = hit ? '#ffe11a' : '#2a2f3a'; k.style.color = hit ? '#111' : '#fff'; });
      const pulse = t > gt[3] ? 1 + Math.sin((t - gt[3]) * 9) * .07 : 1;
      q('#k_callbtn').style.transform = `scale(${pulse})`;
    };
  });

  // 9. FINAL ---------------------------------------------------------------------
  add('final', T.final, 'var(--b)', `<div class="rays" id="f_rays"></div><div class="dots" style="opacity:.5"></div>
    ${AV(520, 280, 330)}
    <div class="bubble tail-b" id="f_bub" style="left:110px;top:150px;font-size:86px;background:var(--y)">Напиши Міші!</div>
    <div class="abs stk" id="f_fit" style="left:120px;top:900px;font-size:46px;background:var(--m)">✓ Вакансія, яка підходить</div>
    <div class="abs" id="f_card" style="left:60px;top:1060px;width:960px;padding:24px 30px;background:#fff;border:7px solid #111;border-radius:34px;box-shadow:12px 12px 0 #111;display:flex;align-items:center;justify-content:space-between">
      <div style="font-family:var(--d);font-weight:900;font-size:58px;white-space:nowrap">${esc(cfg.phone)}</div>
      <div style="display:flex;gap:12px">${ICONS.tg(84)}${ICONS.wa(84)}${ICONS.ms(84)}</div>
    </div>
    <div id="f_conf" class="fill"></div>`,
  (q) => {
    const tWrite = W('Напиши'), tFit = W('ПІДХОДИТЬ'), conf = q('#f_conf');
    conf.innerHTML = Array.from({ length: 60 }, (_, i) => `<div style="position:absolute;width:${18 + rnd(i) * 22}px;height:${10 + rnd(i + 1) * 14}px;border:3px solid #111;background:${['#ffe11a', '#ff5a4e', '#1fe0a8', '#ff7ad9', '#fff'][i % 5]}"></div>`).join('');
    const parts = [...conf.children];
    return t => {
      q('#f_rays').style.transform = `rotate(${t * 14}deg)`;
      const av = q('.avatar'); pop(av, t, T.final[0] - .02, { from: .3, rot: 15 }); av.style.transform += ` translateY(${Math.sin(t * 2.6) * 10}px)`;
      q('#f_bub').dataset.tilt = -3; pop(q('#f_bub'), t, tWrite - .1, { rot: -20 });
      q('#f_bub').style.transform += ` scale(${1 + Math.max(0, Math.sin((t - tWrite) * 6)) * .03})`;
      q('#f_fit').dataset.tilt = 2; slam(q('#f_fit'), t, tFit - .05, 2);
      const card = q('#f_card'); pop(card, t, T.final[0] + .25, { y: 300 });
      const ct = t - tFit;
      parts.forEach((p, i) => { if (ct < 0) { p.style.opacity = 0; return; }
        const a = rnd(i + 5) * Math.PI * 2, v = 900 + rnd(i + 6) * 900, x = 540 + Math.cos(a) * v * ct, y = 700 + Math.sin(a) * v * ct * .7 + 1400 * ct * ct;
        p.style.opacity = clamp(2.2 - ct); p.style.transform = `translate(${x}px, ${y}px) rotate(${ct * 720 * (rnd(i) - .5)}deg)`; });
      return { shake: Math.max(0, 1 - Math.abs(t - tFit) * 4) * .6 };
    };
  });
  return scenes;
}

function renderSubs(t) {
  const box = $('subs');
  const cue = CUES.find(c => t >= c.start && t < c.end);
  if (!cue || CFG.noSubs.some(([a, b]) => t >= a && t < b)) { box.innerHTML = ''; box.dataset.k = ''; return; }
  if (box.dataset.k != cue.start) {
    box.dataset.k = cue.start;
    box.innerHTML = `<div class="cue">${cue.lines.map(l => `<span class="line">${l.map(w => `<span class="w ${w.tone || ''}" data-s="${w.start}">${esc(w.text)}</span>`).join(' ')}</span>`).join('')}</div>`;
  }
  const e = elastic(prog(t, cue.start, cue.start + .3));
  box.firstChild.style.transform = `scale(${lerp(.7, 1, e)})`;
  box.querySelectorAll('.w').forEach(el => { const s = +el.dataset.s, p = prog(t, s - .03, s + .1);
    el.style.opacity = .78 + .22 * p; el.style.transform = `translateY(${-10 * Math.max(0, 1 - Math.abs(t - s - .06) * 7)}px)`; });
}

const grainCtx = $('grain').getContext('2d'), grainImg = grainCtx.createImageData(270, 480);
window.setup = async cfg => {
  CFG = cfg;
  const wj = await (await fetch('words.json')).json(); WORDS = wj.words; CUES = wj.cues;
  TOTAL = cfg.scenes.at(-1).t[1];
  await Promise.all(['900 80px Unbounded', '800 40px Unbounded', '800 40px Manrope'].map(f => document.fonts.load(f, 'АБВіїєґ')));
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  SC = build(cfg);
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  await document.fonts.ready;
  window.TOTAL = TOTAL; return TOTAL;
};

window.render = t => {
  let shake = 0;
  const cuts = SC.slice(1).map(s => s.t[0]);
  SC.forEach(s => {
    const [a, b] = s.t, last = b >= TOTAL, on = t >= a && (t < b || last);
    s.el.style.opacity = on ? 1 : 0;
    if (on) { const r = s.update(t, t - a) || {}; shake = Math.max(shake, r.shake || 0); }
  });
  // diagonal colour wipe across each cut (next scene's colour)
  let wipe = $('wipe');
  if (!wipe) { wipe = document.createElement('div'); wipe.id = 'wipe'; wipe.style.cssText = 'position:absolute;left:-50%;top:-20%;width:200%;height:140%;border-left:14px solid #111;border-right:14px solid #111;pointer-events:none'; $('frame').insertBefore(wipe, $('subs')); }
  const c = cuts.find(c => Math.abs(t - c) < .2);
  if (c != null) { const k = (t - c + .2) / .4, nxt = SC.find(s => s.t[0] === c);
    wipe.style.background = nxt.bg; wipe.style.display = 'block';
    wipe.style.transform = `translateX(${lerp(-110, 110, easeInOut(k))}%) skewX(-18deg)`; }
  else wipe.style.display = 'none';
  $('frame').style.transform = shake > 0 ? `translate(${Math.sin(t * 60) * 14 * shake}px, ${Math.cos(t * 47) * 10 * shake}px)` : '';
  $('flash').style.opacity = 0;
  renderSubs(t);
  const d = grainImg.data, f = Math.round(t * 60);
  for (let i = 0; i < d.length; i += 4) { const v = 150 + rnd(i * .13 + f * 77.7) * 105; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  grainCtx.putImageData(grainImg, 0, 0);
};
