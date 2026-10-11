// Promo composition: deterministic render(t) for frame-by-frame capture.
import * as THREE from 'three';
import { makeRenderer, makeComposer, clamp, prog, easeOut, easeIn, rnd, esc, RENDER_SCALE } from './kit.js';
import { buildScenes } from './scenes.js';

const $ = id => document.getElementById(id);
let SC = [], CUES = [], WORDS = [], TOTAL = 0, gl, composer, renderPass, bloomPass, CFG;

// time of a spoken word (first match at/after `after` seconds); keeps visuals synced to the real voice
export function W(text, after = 0) {
  const k = text.toLowerCase();
  const w = WORDS.find(w => w.start >= after && w.text.toLowerCase().replace(/[.,!?:—«»]/g, '').startsWith(k));
  if (!w) throw new Error(`word not found: ${text}`);
  return w.start;
}

window.setup = async function (cfg, opts = {}) {
  CFG = cfg;
  const wj = await (await fetch('words.json')).json();
  WORDS = wj.words; CUES = wj.cues;
  TOTAL = cfg.scenes.at(-1).t[1];
  if (opts.transparent) document.body.classList.add('clip');
  if (opts.clean) document.body.classList.add('clean'); // stills for the cover: 3D only
  const r = makeRenderer($('gl'));
  gl = r;
  const dummyScene = new THREE.Scene(), dummyCam = new THREE.PerspectiveCamera();
  const c = makeComposer(r.renderer, dummyScene, dummyCam);
  composer = c.composer; bloomPass = c.bloom; renderPass = composer.passes[0];
  await Promise.all(['900 86px Unbounded', '800 40px Unbounded', '700 40px "JetBrains Mono"', '800 40px Manrope'].map(f => document.fonts.load(f, 'AБВzł')));
  await document.fonts.ready;
  SC = buildScenes({ cfg, W, env: r.env, layers: $('layers'), bg2d: $('bg2d'), clipsPresent: opts.clipsPresent || [] });
  SC.forEach((s, i) => { s.hasClip = !!(opts.clipsPresent || [])[i]; if (s.hasClip) s.layer.classList.add('withclip'); });
  // warm up every 3D scene once so shader compilation does not land on a random frame
  for (const s of SC) if (s.scene3d) { renderPass.scene = s.scene3d; renderPass.camera = s.camera; s.update(s.t[0] + .01, .01); composer.render(); }
  window.TOTAL = TOTAL;
  return TOTAL;
};

const grainCtx = $('grain').getContext('2d'), grainImg = grainCtx.createImageData(270, 480);

function renderSubs(t) {
  const cue = CUES.find(c => t >= c.start && t < c.end);
  const box = $('subs');
  if (!cue) { box.innerHTML = ''; return; }
  const k = cue.start;
  if (box.dataset.k != k) {
    box.dataset.k = k;
    box.innerHTML = `<div class="cue">${cue.lines.map(l => `<span class="line">${l.map(w => `<span class="w ${w.tone || ''}" data-s="${w.start}">${esc(w.text)}</span>`).join(' ')}</span>`).join('')}</div>`;
  }
  const inK = easeOut(prog(t, cue.start, cue.start + .14));
  box.firstChild.style.transform = `translateY(${(1 - inK) * 16}px)`;
  box.firstChild.style.opacity = inK;
  box.querySelectorAll('.w').forEach(el => {
    const s = +el.dataset.s, p = easeOut(prog(t, s - .04, s + .12));
    el.style.opacity = .38 + .62 * p;             // spoken words light up
    el.style.transform = `scale(${1 + .06 * Math.max(0, 1 - Math.abs(t - s - .08) * 6)})`;
  });
}

window.render = function (t) {
  const frame = Math.round(t * 60);
  let flash = 0, active3d = null;
  for (const s of SC) {
    const [a, b] = s.t, last = b >= TOTAL;
    const on = t >= a && (t < b || last);
    s.layer.style.opacity = on ? 1 : 0;
    if (s.bgLayer) s.bgLayer.style.opacity = on ? 1 : 0;
    if (on) {
      const r = s.update(t, t - a) || {};
      s._fx = r;
      if (s.scene3d && r.show3d !== false && !s.hasClip) active3d = s; // a real clip replaces the 3D background
      flash = Math.max(flash, r.flash || 0);
    }
    if (a > 0) flash = Math.max(flash, Math.max(0, 1 - Math.abs(t - a) * 9) * .5); // soft flash on every cut
  }
  // 3D
  const glc = $('gl');
  if (active3d) {
    renderPass.scene = active3d.scene3d; renderPass.camera = active3d.camera;
    bloomPass.strength = active3d.bloom ?? .9;
    gl.renderer.toneMappingExposure = active3d.exposure ?? 1;
    composer.render();
    glc.style.opacity = 1;
    glc.style.filter = active3d._fx?.glFilter || 'none';
    glc.style.transform = active3d._fx?.glTransform || '';
  } else glc.style.opacity = 0;
  $('flash').style.opacity = clamp(flash) * .6;
  renderSubs(t);
  const d = grainImg.data;
  for (let i = 0; i < d.length; i += 4) { const v = rnd(i * .13 + frame * 77.7) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  grainCtx.putImageData(grainImg, 0, 0);
};
