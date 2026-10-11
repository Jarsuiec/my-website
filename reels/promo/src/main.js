// Promo composition: deterministic render(t) for frame-by-frame capture.
import * as THREE from 'three';
import { makeRenderer, makeComposer, clamp, prog, easeOut, easeIn, rnd, esc, RENDER_SCALE, softDot } from './kit.js';
import { buildScenes } from './scenes.js';

const $ = id => document.getElementById(id);
let SC = [], CUES = [], WORDS = [], TOTAL = 0, gl, composer, renderPass, bloomPass, gradePass, CFG, CUTS = [];

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
  composer = c.composer; bloomPass = c.bloom; gradePass = c.grade; renderPass = composer.passes[0];
  await Promise.all(['900 86px Unbounded', '800 40px Unbounded', '700 40px "JetBrains Mono"', '800 40px Manrope'].map(f => document.fonts.load(f, 'AБВzł')));
  await document.fonts.ready;
  SC = buildScenes({ cfg, W, env: r.env, layers: $('layers'), bg2d: $('bg2d'), clipsPresent: opts.clipsPresent || [] });
  SC.forEach((s, i) => { s.hasClip = !!(opts.clipsPresent || [])[i]; if (s.hasClip) s.layer.classList.add('withclip'); });
  CUTS = cfg.scenes.slice(1).map(s => s.t[0]);
  const dot = softDot();
  for (const s of SC) {
    const scenes3d = s.extraScenes ? [s.scene3d, ...s.extraScenes] : (s.scene3d ? [s.scene3d] : []);
    for (const sc of scenes3d) {
      sc.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        if ((o.isSpotLight || o.isDirectionalLight) && !o.userData.noShadow) {
          o.castShadow = true; o.shadow.mapSize.set(1024, 1024); o.shadow.bias = -.0004; o.shadow.normalBias = .03; o.shadow.radius = 6;
          if (o.isDirectionalLight) { const c = o.shadow.camera; c.left = c.bottom = -8; c.right = c.top = 8; c.near = .5; c.far = 40; }
        }
      });
      // floating dust motes catching the light (depth + atmosphere)
      const n = 140, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (rnd(i) - .5) * 14; pos[i * 3 + 1] = (rnd(i + 1) - .5) * 9; pos[i * 3 + 2] = (rnd(i + 2) - .5) * 14; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const motes = new THREE.Points(g, new THREE.PointsMaterial({ map: dot, size: .06, transparent: true, opacity: .55, depthWrite: false, color: 0xcfe8ff, blending: THREE.AdditiveBlending }));
      motes.castShadow = false; motes.receiveShadow = false; motes.userData.motes = true;
      sc.add(motes); sc.userData.motes = motes;
    }
  }
  // background bokeh behind the 3D (DOM, cheap)
  $('bg2d').innerHTML = Array.from({ length: 18 }, (_, i) => `<div class="bk" style="position:absolute;border-radius:50%;width:${120 + rnd(i) * 260}px;height:${120 + rnd(i) * 260}px;filter:blur(${18 + rnd(i + 4) * 30}px)"></div>`).join('')
    + '<div id="leak" class="fill" style="opacity:0;mix-blend-mode:screen"></div>';
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
  // background bokeh drift, tinted per scene
  const cur = SC.find(s => t >= s.t[0] && t < s.t[1]) || SC.at(-1);
  const tint = cur.tint || ['46,139,255', '34,228,212', '255,122,47'];
  document.querySelectorAll('#bg2d .bk').forEach((b, i) => {
    const x = rnd(i + 20) * 1080 + Math.sin(t * .15 + i) * 60, y = rnd(i + 30) * 1920 + Math.cos(t * .12 + i * 1.7) * 80 - t * 6 * (1 + i % 3);
    b.style.transform = `translate(${x - 150}px, ${((y % 2100) + 2100) % 2100 - 150}px)`;
    b.style.background = `radial-gradient(circle, rgba(${tint[i % tint.length]},.55), rgba(${tint[i % tint.length]},0) 70%)`;
    b.style.opacity = .16 + .12 * Math.sin(t * .7 + i);
  });
  // whip-zoom + light leak on every cut
  let whip = 0, cutAt = 0;
  for (const c of CUTS) { const k = 1 - Math.abs(t - c) / .2; if (k > whip) { whip = k; cutAt = c; } }
  whip = Math.max(0, whip);
  const fr = $('frame');
  fr.style.transform = whip > 0 ? `scale(${1 + .07 * whip * whip})` : '';
  fr.style.filter = whip > .05 ? `blur(${(whip * whip * 9).toFixed(2)}px)` : 'none';
  const leak = $('leak');
  if (leak) { const k = Math.max(0, 1 - Math.abs(t - cutAt) / .35);
    leak.style.opacity = k * .55;
    leak.style.background = `linear-gradient(${110 + (t - cutAt) * 120}deg, transparent 20%, rgba(255,150,80,.55) 45%, rgba(34,228,212,.4) 60%, transparent 80%)`; }
  // 3D
  const glc = $('gl');
  if (active3d) {
    renderPass.scene = active3d.scene3d; renderPass.camera = active3d.camera;
    const m = active3d.scene3d.userData.motes;
    if (m) { m.rotation.y = t * .04; m.position.y = Math.sin(t * .3) * .3; m.position.copy(active3d.camera.position).multiplyScalar(.55).setY(m.position.y); }
    gradePass.uniforms.uWarm.value = active3d.warm ?? 0;
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
