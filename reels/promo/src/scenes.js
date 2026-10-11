// The ten scenes of the PC MASTER WARSZAWA promo. Every beat is anchored to a spoken word via W().
import * as THREE from 'three';
import { clamp, prog, lerp, easeOut, easeIn, easeInOut, expoOut, backOut, rnd, win, esc, COL, shake, mat } from './kit.js';
import { makeLaptop, drawLaptopScreen, makeTurbine, makeHDD, makeSSD, makeCoolerRig, makeCPU, drawPaste, makeGamingPC, makeMug, makeNote, makeBin, makeDesk, makeFan } from './models.js';
import { logoSVG, TG_ICON } from './brand.js';

export function buildScenes({ cfg, W, env, layers }) {
  const T = Object.fromEntries(cfg.scenes.map(s => [s.id, s.t]));
  const mkLayer = html => { const d = document.createElement('div'); d.className = 'layer'; d.innerHTML = html; layers.appendChild(d); return d; };
  const new3d = (fov = 40) => {
    const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = .28;
    const camera = new THREE.PerspectiveCamera(fov, 1080 / 1920, .05, 300);
    return { scene, camera };
  };
  const set = (el, o, tf = '', filter = '') => { el.style.opacity = o; el.style.transform = tf; el.style.filter = filter; };
  const pop = (t, at, dur = .35) => backOut(prog(t, at, at + dur));
  const scenes = [];

  // =====================================================================================
  // 1. INTRO — Warsaw at night → workshop → name
  // =====================================================================================
  {
    const [A, B] = T.intro;
    const warsaw = buildWarsaw(), city = warsaw.el;
    const layer = mkLayer(`
      <div class="fill" id="cityWrap" style="overflow:hidden">
        <div class="fill" id="cityCan"></div>
        ${Array.from({ length: 16 }, (_, i) => `<div class="abs bokeh" style="width:${60 + rnd(i) * 140}px;height:${60 + rnd(i) * 140}px;border-radius:50%;
          background:radial-gradient(circle, ${['rgba(255,200,120,.55)', 'rgba(120,200,255,.5)', 'rgba(255,140,90,.45)'][i % 3]}, transparent 70%);filter:blur(${4 + rnd(i + 3) * 10}px)"></div>`).join('')}
        <div class="abs kicker center-x" id="i_k1" style="top:250px">Warszawa · 52.23° N 21.01° E</div>
      </div>
      <div class="abs center-x" id="i_title" style="top:300px">
        <div class="display sweep" id="i_name" style="font-size:150px">${esc(cfg.name)}</div>
        <div class="display glow-blue" id="i_brand" style="font-size:48px;margin-top:26px;letter-spacing:.05em;color:#d9e9ff">${esc(cfg.brand)}</div>
        <div id="i_line" style="height:3px;width:520px;margin:30px auto 0;background:linear-gradient(90deg,transparent,#22e4d4,transparent)"></div>
        <div class="kicker" id="i_city" style="margin-top:22px;font-size:30px;color:#bfefff;letter-spacing:.2em">${esc(cfg.cities)}</div>
      </div>`);
    layer.querySelector('#cityCan').appendChild(city);
    city.style.cssText = 'position:absolute;inset:0;transform-origin:72% 40%';
    const bokeh = [...layer.querySelectorAll('.bokeh')];
    const { scene, camera } = new3d(40);
    const pc = makeGamingPC(); scene.add(pc);
    const desk = makeDesk(); desk.position.y = -2.25; scene.add(desk);
    scene.add(new THREE.AmbientLight(0x223344, .4));
    const key = new THREE.SpotLight(0xffffff, 78.0, 30, .5, .6); key.position.set(5, 7, 4); key.target = pc; scene.add(key);
    const rim = new THREE.PointLight(COL.cyan, 18.0, 14); rim.position.set(-3, 2, -4); scene.add(rim);
    const fill = new THREE.PointLight(COL.blue, 12.0, 14); fill.position.set(4, -1, 5); scene.add(fill);
    scene.fog = new THREE.FogExp2(0x07090c, .045);
    const tName = W('Ярослав'), tCity = W('Варшаве');
    scenes.push({
      id: 'intro', t: [A, B], layer, scene3d: scene, camera, bloom: .6, tint: ['46,139,255', '34,228,212', '120,170,255'],
      update(t, lt) {
        const cityOn = t < 2.12;
        const z = lerp(1, 1.1, easeInOut(prog(t, 0, 1.75))) * lerp(1, 7, easeIn(prog(t, 1.72, 2.12)));
        set(layer.querySelector('#cityWrap'), cityOn ? 1 : 0);
        city.style.transform = `scale(${z}) translateY(${-prog(t, 0, 1.75) * 30}px)`;
        city.style.filter = t > 1.72 ? `blur(${prog(t, 1.72, 2.12) * 18}px)` : 'none';
        if (cityOn) warsaw.update(t);
        bokeh.forEach((b, i) => { const x = rnd(i + 7) * 1080, y = 1100 + rnd(i + 11) * 800;
          b.style.transform = `translate(${x - 80 + Math.sin(t * .6 + i) * 30 - t * 40 * (i % 3 + 1)}px, ${y + Math.cos(t * .5 + i) * 20}px) scale(${z * .6 + .4})`; });
        set(layer.querySelector('#i_k1'), win(t, .25, 1.7, .4, .3));
        // workshop camera: slow dolly out from the motherboard
        const k = easeInOut(prog(t, 2.05, B));
        camera.position.set(lerp(8.2, 11.5, k), lerp(2.2, 1.4, k), lerp(2.2, 5.2, k));
        camera.lookAt(0, lerp(1.4, 1.0, k), lerp(-.2, 0, k));
        pc.userData.parts.fans.forEach((f, i) => f.userData.rotor.rotation.z = t * (6 + i));
        pc.userData.cfan.userData.rotor.rotation.z = t * 7;
        pc.userData.parts.gpu.children.forEach(c => c.userData.rotor && (c.userData.rotor.rotation.z = t * 5));
        pc.userData.rgbMats.forEach((m, i) => m.emissiveIntensity = 1.3 + Math.sin(t * 2 + i) * .25);
        // titles
        const n = pop(t, 2.3, .5), sweep = prog(t, 2.35, 3.4);
        const name = layer.querySelector('#i_name');
        set(name, clamp(n * 2) * (1 - easeIn(prog(t, B - .3, B))), `scale(${lerp(.86, 1, n)})`, n < 1 ? `blur(${(1 - n) * 10}px)` : 'none');
        name.style.backgroundPosition = `${lerp(100, -20, sweep)}% 0`;
        set(layer.querySelector('#i_brand'), easeOut(prog(t, 2.7, 3.1)) * (1 - easeIn(prog(t, B - .3, B))), `translateY(${(1 - easeOut(prog(t, 2.7, 3.1))) * 30}px)`);
        layer.querySelector('#i_line').style.width = `${easeOut(prog(t, 3.0, 3.7)) * 560}px`;
        layer.querySelector('#i_line').style.opacity = 1 - easeIn(prog(t, B - .3, B));
        set(layer.querySelector('#i_city'), easeOut(prog(t, tCity - .1, tCity + .3)) * (1 - easeIn(prog(t, B - .3, B))));
        return { show3d: !cityOn, flash: Math.max(0, 1 - Math.abs(t - 2.1) * 6) };
      },
    });
  }

  // =====================================================================================
  // 2. THE LAPTOP THAT WANTED TO BE A PLANE
  // =====================================================================================
  {
    const [A, B] = T.plane;
    const tNoise = W('ШУМИТ'), tPlane = W('самолёт'), tSlow = W('тормозит');
    const tTurbIn = tPlane - .12, tTurbOut = tSlow - .1;
    // desk scene
    const d1 = new3d(40);
    const desk = makeDesk(); d1.scene.add(desk);
    const lap = makeLaptop(); d1.scene.add(lap);
    const mug = makeMug(); mug.position.set(2.4, 0, .6); mug.scale.setScalar(.9); d1.scene.add(mug);
    const notes = [0xffd23d, 0x6fd0ff, 0xff9a5c, 0xffd23d].map((c, i) => { const n = makeNote(c); n.position.set(-1.9 + i * .5, .01 + i * .002, .9 + (i % 2) * .3); n.rotation.x = -Math.PI / 2; n.rotation.z = (rnd(i) - .5) * .5; d1.scene.add(n); return n; });
    d1.scene.add(new THREE.AmbientLight(0x334455, .5));
    const k1 = new THREE.SpotLight(0xfff1dd, 66.0, 30, .55, .7); k1.position.set(-3, 7, 5); k1.target = lap; d1.scene.add(k1);
    const r1 = new THREE.PointLight(COL.blue, 9.0, 12); r1.position.set(3, 2, -3); d1.scene.add(r1);
    const heatL = new THREE.PointLight(COL.orange, 0.0, 8); heatL.position.set(1.8, .4, 0); d1.scene.add(heatL);
    // turbine scene
    const d2 = new3d(44);
    const turb = makeTurbine(); d2.scene.add(turb);
    d2.scene.add(new THREE.AmbientLight(0x404a55, .6));
    const tk = new THREE.DirectionalLight(0xffffff, 1.3); tk.position.set(3, 4, 6); d2.scene.add(tk);
    const tr = new THREE.PointLight(COL.orange, 9.0, 10); tr.position.set(0, 0, -.2); d2.scene.add(tr);
    const layer = mkLayer(`
      <div class="abs center-x display glow-orange" id="p_noise" style="top:300px;font-size:170px;color:#ff8a45">ШУМИТ?!</div>
      <div class="fill" id="p_runway" style="overflow:hidden">${Array.from({ length: 22 }, (_, i) => `<div class="abs rw" style="width:6px;height:120px;border-radius:3px;background:${i % 4 ? '#ffd9a0' : '#ff5a36'};box-shadow:0 0 18px ${i % 4 ? '#ffb45c' : '#ff3b3b'}"></div>`).join('')}</div>
      <div class="abs center-x" id="p_boeing" style="top:270px">
        <div class="chip orange" style="font-size:40px;padding:20px 34px"><span class="dot" style="color:#ff7a2f"></span>Режим Boeing: включён ✈️</div>
        <div class="note" style="margin-top:20px;color:#ffcfae">ВЗЛЁТ РАЗРЕШЁН · ПОЛОСА 33</div>
      </div>
      <div class="fill" id="p_screen" style="background:#05070a">
        <div class="screen" style="left:40px;right:40px;top:300px;height:880px">
          <div class="win" style="left:70px;right:70px;top:70px;height:640px">
            <div class="bar"><i></i><i></i><i></i><span id="p_title">Документ.docx</span></div>
            <div style="padding:40px">${Array.from({ length: 9 }, (_, i) => `<div style="height:20px;border-radius:6px;background:#c9d3de;margin-bottom:26px;width:${50 + (i * 37) % 45}%"></div>`).join('')}</div>
            <div class="fill" id="p_veil" style="background:rgba(255,255,255,.6)"></div>
          </div>
          <svg class="spinner" id="p_spin" viewBox="0 0 120 120" style="left:50%;top:330px;margin-left:-60px">${Array.from({ length: 8 }, (_, i) => `<circle cx="${60 + Math.cos(i / 8 * 6.283) * 40}" cy="${60 + Math.sin(i / 8 * 6.283) * 40}" r="9" fill="#2e8bff"/>`).join('')}</svg>
          <svg class="cursor" id="p_cursor" viewBox="0 0 40 56"><path d="M2 2 L2 46 L13 36 L21 54 L28 51 L20 33 L35 33 Z" fill="#fff" stroke="#000" stroke-width="2.5"/></svg>
          <div class="taskbar"><span id="p_clock">14:02</span></div>
        </div>
        <div class="abs center-x display glow-orange" id="p_slow" style="top:150px;font-size:96px;color:#ff8a45">ТОРМОЗИТ…</div>
        <div class="abs" id="p_coffee" style="left:90px;top:1000px"><div class="chip glass" style="font-size:32px">☕ Пока грузится…</div></div>
        <div class="abs" id="p_plus" style="right:90px;top:1000px"><div class="chip red" style="font-size:32px">+15 минут</div></div>
      </div>`);
    const rw = [...layer.querySelectorAll('.rw')];
    const screenState = { clock: '14:02' };
    scenes.push({
      id: 'plane', t: [A, B], layer, scene3d: d1.scene, camera: d1.camera, bloom: .8, extraScenes: [d2.scene], tint: ['255,122,47', '255,170,90', '46,139,255'],
      update(t, lt) {
        const turbOn = t >= tTurbIn && t < tTurbOut, screenOn = t >= tTurbOut;
        this.scene3d = turbOn ? d2.scene : d1.scene; this.camera = turbOn ? d2.camera : d1.camera;
        this.bloom = turbOn ? .4 : .7; this.exposure = turbOn ? .8 : 1;
        this.warm = turbOn ? 1 : prog(t, tNoise - .2, tNoise + .4) * .8;
        // --- desk: calm → noise ---
        const noise = prog(t, tNoise - .15, tNoise + .3);
        const [sx, sy] = shake(t, .012 * noise);
        lap.position.set(sx, 0, sy);
        lap.userData.lid.rotation.x = -.32 + Math.sin(t * 40) * .004 * noise;
        heatL.intensity = 12.0 * noise;
        drawLaptopScreen(lap.userData.screen, { clock: '14:02', heat: noise });
        notes.forEach((n, i) => {
          const f = easeOut(prog(t, tNoise + i * .07, tNoise + .9 + i * .07));
          n.position.set(-1.9 + i * .5 - f * (2 + i), .01 + f * (1.8 + i * .4) * (1 - f * .4), .9 + (i % 2) * .3 - f * 1.5);
          n.rotation.set(-Math.PI / 2 + f * (3 + i), f * 2, (rnd(i) - .5) * .5 + f * 4);
        });
        // camera: slow push, then rush to the side vent before the cut
        const push = easeInOut(prog(t, A, tNoise)), rush = easeIn(prog(t, tPlane - .45, tTurbIn));
        const c0 = new THREE.Vector3(lerp(1.4, .9, push), lerp(5.4, 4.3, push), lerp(10.2, 8.2, push));
        const c1 = new THREE.Vector3(2.9, .3, .1);
        d1.camera.position.lerpVectors(c0, c1, rush);
        d1.camera.position.x += sx * 3; d1.camera.position.y += sy * 3;
        d1.camera.lookAt(lerp(0, 1.6, rush), lerp(.9, .08, rush), lerp(-.5, -.1, rush));
        // --- turbine ---
        const tl = t - tTurbIn;
        turb.userData.rotor.rotation.z = -tl * 38;
        turb.userData.glowMat.emissiveIntensity = .45 + Math.sin(t * 20) * .08;
        const tz = lerp(9.8, 7.6, easeOut(prog(tl, 0, .9)));
        const [ts, tsy] = shake(t, .03);
        d2.camera.position.set(ts, tsy, tz); d2.camera.lookAt(0, 0, 0);
        turb.rotation.z = tl * .2;
        rw.forEach((r, i) => { const ph = (tl * 1.8 + rnd(i)) % 1, side = i % 2 ? 1 : -1;
          r.style.transform = `translate(${540 + side * (80 + ph * 620)}px, ${1100 + ph * 900}px) rotate(${side * -58}deg) scale(${.3 + ph * 1.4})`;
          r.style.opacity = turbOn ? Math.sin(ph * Math.PI) : 0; });
        set(layer.querySelector('#p_boeing'), turbOn ? easeOut(prog(tl, 0, .2)) : 0, `scale(${pop(t, tTurbIn + .02, .3)})`);
        const nz = pop(t, tNoise - .02, .3);
        const [nsx, nsy] = shake(t, 14 * (1 - prog(t, tNoise, tNoise + .5)));
        set(layer.querySelector('#p_noise'), t < tTurbIn ? clamp(nz * 2) : 0, `translate(${nsx}px,${nsy}px) scale(${lerp(2.2, 1, nz)}) rotate(${(1 - nz) * -8}deg)`, nz < 1 ? `blur(${(1 - nz) * 12}px)` : 'none');
        // --- frozen screen gag ---
        const sl = t - tTurbOut;
        set(layer.querySelector('#p_screen'), screenOn ? 1 : 0, `scale(${lerp(1.08, 1, easeOut(prog(sl, 0, .35)))})`);
        layer.querySelector('#p_spin').style.transform = `rotate(${Math.floor(sl * 12) * 45}deg)`;
        const cx = 420 + Math.sin(sl * 3.1) * 220 + Math.sin(sl * 7.3) * 40, cy = 500 + Math.cos(sl * 2.3) * 160;
        layer.querySelector('#p_cursor').style.cssText += `;left:${cx}px;top:${cy}px`;
        layer.querySelector('#p_veil').style.opacity = easeOut(prog(sl, .15, .5));
        layer.querySelector('#p_title').textContent = sl > .6 ? 'Документ.docx (не отвечает)' : 'Документ.docx';
        const tJump = tSlow + 1.35;
        layer.querySelector('#p_clock').textContent = t > tJump ? '14:17' : '14:02';
        set(layer.querySelector('#p_slow'), easeOut(prog(sl, .05, .35)));
        layer.querySelector('#p_slow').textContent = 'ТОРМОЗИТ' + '.'.repeat(1 + Math.floor(Math.max(0, sl) * 3) % 3);
        set(layer.querySelector('#p_coffee'), screenOn ? pop(t, tSlow + .55) : 0, `scale(${pop(t, tSlow + .55)}) rotate(-3deg)`);
        set(layer.querySelector('#p_plus'), screenOn ? pop(t, tJump) : 0, `scale(${pop(t, tJump)}) rotate(3deg)`);
        return { show3d: !screenOn, flash: Math.max(Math.max(0, 1 - Math.abs(t - tTurbIn) * 8), Math.max(0, 1 - Math.abs(t - tNoise) * 6) * .7) };
      },
    });
  }

  // =====================================================================================
  // 3. CULPRIT FOUND — dust, old paste, cleaning, done
  // =====================================================================================
  {
    const [A, B] = T.dust;
    const tDust = W('пыль'), tPaste = W('термопаста'), tHour = W('Час'), tNew = W('новый');
    const tCpuIn = tPaste - .1, tClean = tHour - .05, tRig2 = tHour + .85;
    const d1 = new3d(30);
    const rig = makeCoolerRig(); d1.scene.add(rig);
    const dustGeo = new THREE.BufferGeometry(), N = 900, pos = new Float32Array(N * 3), base = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const onFan = i < 300;
      base[i * 3] = onFan ? -.93 : -.6 + rnd(i) * 1.2; base[i * 3 + 1] = onFan ? .45 + (rnd(i + 1) - .5) * 1.0 : rnd(i + 1) * .9;
      base[i * 3 + 2] = onFan ? (rnd(i + 2) - .5) * 1.0 : (rnd(i + 2) - .5) * 1.2; }
    pos.set(base); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x8f846f, size: .05, transparent: true, opacity: .95, sizeAttenuation: true });
    const dust = new THREE.Points(dustGeo, dustMat); rig.add(dust);
    d1.scene.add(new THREE.AmbientLight(0x221a14, .6));
    const hot = new THREE.PointLight(COL.orange, 21.0, 10); hot.position.set(1.5, 1.6, 2); d1.scene.add(hot);
    const cool = new THREE.PointLight(COL.cyan, 0.0, 10); cool.position.set(-1.5, 1.6, 2.4); d1.scene.add(cool);
    const top = new THREE.DirectionalLight(0xffffff, 1.4); top.position.set(0, 5, 3); d1.scene.add(top);
    const d2 = new3d(30);
    const cpu = makeCPU(); d2.scene.add(cpu);
    d2.scene.add(new THREE.AmbientLight(0x222222, .6));
    const c2hot = new THREE.PointLight(COL.orange, 12.0, 8); c2hot.position.set(1.2, 1.5, 1); d2.scene.add(c2hot);
    const c2cool = new THREE.PointLight(COL.blue, 0.0, 8); c2cool.position.set(-1.2, 1.5, 1); d2.scene.add(c2cool);
    const c2key = new THREE.DirectionalLight(0xffffff, .55); c2key.position.set(0, 4, 2); d2.scene.add(c2key);
    const layer = mkLayer(`
      <div class="fill" id="d_scan" style="pointer-events:none">
        ${[['left:90px;top:520px', 'border-left-width:4px;border-top-width:4px'], ['right:90px;top:520px', 'border-right-width:4px;border-top-width:4px'],
           ['left:90px;top:1180px', 'border-left-width:4px;border-bottom-width:4px'], ['right:90px;top:1180px', 'border-right-width:4px;border-bottom-width:4px']]
          .map(([p, b]) => `<div class="abs" style="${p};width:70px;height:70px;border:0 solid rgba(255,160,90,.8);${b}"></div>`).join('')}
        <div class="abs" id="d_line" style="left:90px;right:90px;height:3px;background:#ff9a5c;box-shadow:0 0 24px 4px rgba(255,122,47,.6)"></div>
        <div class="abs kicker" style="left:96px;top:470px;color:#ffb98c">● ДИАГНОСТИКА</div>
      </div>
      <div class="abs" id="d_chips" style="left:90px;top:250px;display:flex;gap:18px;flex-wrap:wrap;width:900px">
        <div class="chip orange d_c">Перегрев</div><div class="chip orange d_c">Троттлинг</div><div class="chip orange d_c">Пыль</div>
      </div>
      <div class="abs center-x" id="d_found" style="top:360px"><div class="chip red" style="font-size:40px;padding:20px 36px">⚠ Проблема обнаружена</div></div>
      <div class="abs center-x" id="d_old" style="top:470px"><div class="note" style="color:#ffcfae;font-size:26px">СТАРАЯ ТЕРМОПАСТА</div></div>
      <div class="abs" id="d_temp" style="left:90px;top:1080px;width:420px;padding:20px 24px;border-radius:24px;background:rgba(10,14,18,.75);border:1.5px solid rgba(220,235,255,.14)">
        <div class="note" style="font-size:19px">ТЕМПЕРАТУРА · ИЛЛЮСТРАЦИЯ</div>
        <svg width="372" height="90" viewBox="0 0 372 90" style="margin-top:10px"><path id="d_path" fill="none" stroke-width="5" stroke-linecap="round"/></svg>
      </div>
      <div class="abs center-x display glow-green" id="d_done" style="top:300px;font-size:150px;color:#5dffa6">ГОТОВО!</div>`);
    const chips = [...layer.querySelectorAll('.d_c')];
    const tChips = [tDust - 1.0, tDust - .5, tDust];
    scenes.push({
      id: 'dust', t: [A, B], layer, scene3d: d1.scene, camera: d1.camera, bloom: .9, extraScenes: [d2.scene],
      update(t, lt) {
        const cpuOn = t >= tCpuIn && t < tRig2;
        this.scene3d = cpuOn ? d2.scene : d1.scene; this.camera = cpuOn ? d2.camera : d1.camera;
        const clean = prog(t, tClean, tNew), cool01 = easeInOut(clean);
        this.warm = 1 - cool01; this.tint = cool01 > .5 ? ['34,228,212', '54,242,139', '46,139,255'] : ['255,122,47', '255,90,60', '255,170,90'];
        // rig (dirty → cleaned)
        const fanSpin = t < tClean ? t * 2.2 : t > tNew - .3 ? (t - tNew) * 9 : 0; // fan stopped while cleaning (device off)
        rig.userData.fan.userData.rotor.rotation.z = fanSpin;
        const blow = easeIn(prog(t, tRig2, tRig2 + .6));
        for (let i = 0; i < N; i++) {
          const j = i * 3;
          pos[j] = base[j] + blow * (2 + rnd(i) * 3); pos[j + 1] = base[j + 1] + blow * (rnd(i + 5) * 2.5); pos[j + 2] = base[j + 2] + blow * (rnd(i + 9) - .3) * 3;
        }
        dustGeo.attributes.position.needsUpdate = true;
        dustMat.opacity = .95 * (1 - prog(t, tRig2 + .3, tRig2 + .8));
        hot.intensity = 21.0 * (1 - cool01); cool.intensity = 21.0 * cool01;
        const dk = prog(t, A, tCpuIn);
        d1.camera.position.set(lerp(-3.6, -2.9, dk) + (t > tRig2 ? -.5 : 0), lerp(1.9, 1.5, dk), lerp(4.6, 3.9, dk) + (t > tRig2 ? .9 : 0));
        d1.camera.lookAt(-.5, .45, 0);
        // cpu paste: crack → wipe → fresh
        const crack = prog(t, tCpuIn, tCpuIn + .7), wipe = prog(t, tClean, tClean + .45), fresh = prog(t, tClean + .45, tRig2 - .1);
        drawPaste(cpu.userData.pasteTex, wipe < 1 ? 0 : .6 + fresh * .4, crack);
        const p = cpu.userData.paste;
        p.scale.setScalar(wipe < 1 ? 1 - easeIn(wipe) * .98 : .05 + easeOut(fresh) * .95);
        p.material.roughness = wipe < 1 ? .9 : .25;
        c2hot.intensity = 12.0 * (1 - cool01); c2cool.intensity = 15.0 * cool01;
        d2.camera.position.set(Math.sin(t * .4) * .3, 3.0 - prog(t, tCpuIn, tRig2) * .3, 2.5); d2.camera.lookAt(0, .02, 0);
        // overlays
        const scanOn = t < tCpuIn + .9;
        set(layer.querySelector('#d_scan'), scanOn ? win(t, A, tCpuIn + .9, .3, .3) : 0);
        layer.querySelector('#d_line').style.top = `${560 + ((t - A) * .7 % 1) * 600}px`;
        chips.forEach((c, i) => set(c, t < tClean ? pop(t, tChips[i]) : 1 - prog(t, tClean, tClean + .2), `scale(${pop(t, tChips[i])})`));
        set(layer.querySelector('#d_found'), win(t, tPaste + .35, tClean, .2, .2), `scale(${pop(t, tPaste + .35)})`);
        set(layer.querySelector('#d_old'), win(t, tCpuIn + .1, tClean, .2, .2));
        const tempOn = win(t, tClean, B, .25, .2);
        set(layer.querySelector('#d_temp'), tempOn, `translateY(${(1 - tempOn) * 20}px)`);
        let pth = ''; const n = 40, k = prog(t, tClean, tNew + .3);
        for (let i = 0; i <= n * k; i++) { const x = i / n * 372, y = 14 + easeInOut(clamp(i / n * 1.4 - .2)) * 62 + Math.sin(i * 1.3) * 3; pth += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
        const path = layer.querySelector('#d_path'); path.setAttribute('d', pth || 'M0 14');
        path.setAttribute('stroke', cool01 > .5 ? '#22e4d4' : '#ff7a2f');
        const dn = pop(t, tNew - .05, .4);
        set(layer.querySelector('#d_done'), clamp(dn * 2), `scale(${lerp(1.8, 1, dn)})`, dn < 1 ? `blur(${(1 - dn) * 10}px)` : 'none');
        return { flash: Math.max(0, 1 - Math.abs(t - tNew) * 5) * .8 + Math.max(0, 1 - Math.abs(t - tCpuIn) * 8) * .5 + Math.max(0, 1 - Math.abs(t - tRig2) * 8) * .4 };
      },
    });
  }

  // =====================================================================================
  // 4. HDD vs SSD
  // =====================================================================================
  {
    const [A, B] = T.ssd;
    const tOld = W('старый', A), tSSD = W('Поставил'), tFast = W('секунды'), tMin = W('минуту');
    const { scene, camera } = new3d(32);
    const hdd = makeHDD(); scene.add(hdd);
    const ssd = makeSSD(); ssd.scale.setScalar(.62); scene.add(ssd);
    scene.add(new THREE.AmbientLight(0x223040, .5));
    const key = new THREE.SpotLight(0xffffff, 54.0, 20, .5, .6); key.position.set(2, 5, 3); scene.add(key); key.target.position.set(0, 0, 0); scene.add(key.target);
    const rimO = new THREE.PointLight(COL.orange, 7.5, 8); rimO.position.set(-2, 1, -2); scene.add(rimO);
    const rimB = new THREE.PointLight(COL.cyan, 0.0, 8); rimB.position.set(2, 1, -2); scene.add(rimB);
    const burst = new THREE.PointLight(COL.cyan, 0.0, 10); burst.position.set(0, 1, 1.5); scene.add(burst);
    const miniScreen = (id, label, cls) => `<div class="abs" id="${id}" style="width:430px;top:820px;${id === 's_l' ? 'left:90px' : 'right:90px'}">
        <div class="screen" style="position:relative;height:280px">
          <div class="s_load fill" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px">
            <svg class="spinner s_sp" viewBox="0 0 120 120" style="position:relative;width:84px;height:84px">${Array.from({ length: 8 }, (_, i) => `<circle cx="${60 + Math.cos(i / 8 * 6.283) * 40}" cy="${60 + Math.sin(i / 8 * 6.283) * 40}" r="9" fill="#9fc6ff" opacity="${.2 + i / 10}"/>`).join('')}</svg>
            <div style="width:300px;height:10px;border-radius:5px;background:#1d2733;overflow:hidden"><div class="s_bar" style="height:100%;width:0;background:#2e8bff"></div></div>
          </div>
          <div class="s_desk fill" style="opacity:0;background:linear-gradient(160deg,#1c4f8a,#0f2a4a)">
            ${Array.from({ length: 6 }, (_, i) => `<div style="position:absolute;left:${24 + (i % 3) * 70}px;top:${24 + Math.floor(i / 3) * 76}px;width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.85)"></div>`).join('')}
            <div style="position:absolute;right:20px;top:24px;width:200px;height:150px;border-radius:12px;background:#f2f5f7"></div>
            <div style="position:absolute;left:0;right:0;bottom:0;height:34px;background:rgba(8,14,22,.85)"></div>
          </div>
        </div>
        <div style="margin-top:20px;text-align:center"><span class="chip ${cls}" style="font-size:30px">${label}</span></div>
      </div>`;
    const layer = mkLayer(`
      <div class="abs center-x" id="s_hddlbl" style="top:300px"><div class="display" style="font-size:96px;color:#ffb98c">HDD</div>
        <div class="note" style="margin-top:16px;font-size:26px;color:#ffcfae">СТАРЫЙ ЖЁСТКИЙ ДИСК</div>
        <div class="chip glass" id="s_turtle" style="margin-top:28px;font-size:30px">🐢 Загрузка… <span id="s_pct">3</span>%</div></div>
      <div class="abs center-x display glow-cyan" id="s_up" style="top:260px;font-size:110px;color:#bff8f2">SSD UPGRADE</div>
      ${miniScreen('s_l', 'HDD — медленно', 'orange')}${miniScreen('s_r', 'SSD — быстро', 'green')}
      <div class="abs center-x note" id="s_note" style="top:1212px">Результат зависит от характеристик компьютера</div>`);
    const L = layer.querySelector('#s_l'), R = layer.querySelector('#s_r');
    scenes.push({
      id: 'ssd', t: [A, B], layer, scene3d: scene, camera, bloom: 1.0, tint: ['34,228,212', '46,139,255', '255,122,47'],
      update(t, lt) {
        const out = easeIn(prog(t, tSSD - .1, tSSD + .3)), inn = expoOut(prog(t, tSSD + .1, tSSD + .55));
        hdd.userData.platters.forEach(p => p.rotation.y = t * 30);
        hdd.userData.arm.rotation.y = -.15 - .35 * (Math.sin(t * 3.2) * .5 + .5) + (Math.floor(t * 4) % 2) * .06;
        hdd.position.set(lerp(0, -5, out), lerp(.4, .8, out) + Math.sin(t) * .03, 0);
        hdd.rotation.set(lerp(.55, .2, prog(t, A, tSSD)), lerp(-.5, .4, prog(t, A, tSSD)) + out * 2, out * .6);
        const ssdY = 1.0;
        ssd.position.set(lerp(5, 0, inn), ssdY + (1 - inn) * .4 + Math.sin(t * 1.2) * .03, 0);
        ssd.rotation.set(.75 + Math.sin(t * .8) * .05, lerp(1.4, -.35, inn) + (t - tSSD) * .12, lerp(.3, 0, inn));
        ssd.visible = t > tSSD;
        rimO.intensity = 7.5 * (1 - out); rimB.intensity = 12.0 * inn;
        burst.intensity = 36.0 * Math.max(0, 1 - Math.abs(t - tSSD - .35) * 3);
        camera.position.set(Math.sin(t * .3) * .4, 3.1, 5.9); camera.lookAt(0, .25, 0);
        const lblOn = t < tSSD;
        set(layer.querySelector('#s_hddlbl'), lblOn ? easeOut(prog(t, A + .1, A + .5)) * (1 - prog(t, tSSD - .2, tSSD)) : 0);
        set(layer.querySelector('#s_turtle'), pop(t, tOld + .1), `scale(${pop(t, tOld + .1)})`);
        layer.querySelector('#s_pct').textContent = Math.min(9, 3 + Math.floor((t - tOld) * 1.5));
        const up = pop(t, tSSD + .3, .4);
        set(layer.querySelector('#s_up'), clamp(up * 2), `scale(${lerp(1.6, 1, up)})`, up < 1 ? `blur(${(1 - up) * 10}px)` : 'none');
        // split comparison
        const cmp = easeOut(prog(t, tSSD + .7, tSSD + 1.1));
        set(L, cmp, `translateY(${(1 - cmp) * 60}px)`); set(R, cmp, `translateY(${(1 - cmp) * 60}px)`);
        L.querySelector('.s_sp').style.transform = `rotate(${Math.floor(t * 8) * 45}deg)`;
        R.querySelector('.s_sp').style.transform = `rotate(${Math.floor(t * 8) * 45}deg)`;
        L.querySelector('.s_bar').style.width = `${prog(t, tSSD + .8, B + 6) * 100}%`;
        R.querySelector('.s_bar').style.width = `${easeOut(prog(t, tSSD + .8, tFast)) * 100}%`;
        const ready = easeOut(prog(t, tFast, tFast + .25));
        R.querySelector('.s_desk').style.opacity = ready; R.querySelector('.s_load').style.opacity = 1 - ready;
        set(layer.querySelector('#s_note'), cmp * .9);
        return { flash: Math.max(0, 1 - Math.abs(t - tSSD - .35) * 4) };
      },
    });
  }

  // =====================================================================================
  // 5. HONEST PRICE
  // =====================================================================================
  {
    const [A, B] = T.price;
    const tAlways = W('всегда', A), tAdv = W('заранее', A), tNo = W('Никаких');
    const layer = mkLayer(`
      <div class="fill scbg" style="background:radial-gradient(900px 700px at 50% 40%, #0f1e2e, #07090c 70%)"></div>
      <div class="phone" id="r_phone" style="left:220px;top:250px;transform-origin:50% 0">
        <div class="notch"></div>
        <div class="head"><div class="avatar" style="background:#22e4d4;color:#062b28">PM</div><div><div class="who">${esc(cfg.brand)}</div><div class="st">в сети</div></div></div>
        <div class="msgs">
          <div class="msg in r_m">${esc(cfg.chat.client)}<span class="time">14:20</span></div>
          <div class="typing r_typ"><i></i><i></i><i></i></div>
          <div class="msg out r_m">${esc(cfg.chat.master)}<span class="time">14:21</span></div>
        </div>
      </div>
      <div class="abs" id="r_bill" style="left:170px;top:380px;width:740px;padding:44px 48px;border-radius:30px;background:#fbfbf7;color:#1b1d20;box-shadow:0 50px 120px rgba(0,0,0,.6)">
        <div style="font-family:var(--display);font-weight:900;font-size:58px">СЧЁТ</div>
        ${['Диагностика', 'Что-то ещё', 'Срочность', 'Просто так'].map(s => `<div style="display:flex;justify-content:space-between;font-size:36px;font-weight:800;margin-top:22px"><span>${s}</span><span>??? zł</span></div>`).join('')}
        <div style="border-top:3px dashed #999;margin-top:26px;padding-top:20px;display:flex;justify-content:space-between;font-family:var(--display);font-weight:900;font-size:50px;color:#d22"><span>ИТОГО</span><span>?????</span></div>
        <svg class="abs" viewBox="0 0 740 560" style="left:0;top:0;width:740px;height:100%"><path id="r_x1" d="M60 60 L680 500" stroke="#ff3b3b" stroke-width="34" stroke-linecap="round" stroke-dasharray="760" stroke-dashoffset="760"/><path id="r_x2" d="M680 60 L60 500" stroke="#ff3b3b" stroke-width="34" stroke-linecap="round" stroke-dasharray="760" stroke-dashoffset="760"/></svg>
      </div>
      <div class="abs center-x" id="r_ok" style="top:300px">
        <div class="chip green" style="font-size:40px;padding:22px 36px">✓ Цена согласована заранее</div>
        <div style="margin-top:22px"><span class="chip glass" style="font-size:34px">Без неожиданных доплат</span></div>
      </div>`);
    const msgs = [...layer.querySelectorAll('.r_m')], typ = layer.querySelector('.r_typ'), phone = layer.querySelector('#r_phone');
    scenes.push({
      id: 'price', t: [A, B], layer,
      update(t, lt) {
        const ph = easeOut(prog(lt, 0, .45));
        const okT = tNo - .02, settle = easeInOut(prog(t, okT, okT + .4));
        set(phone, ph, `translateY(${(1 - ph) * 200 + settle * 260}px) scale(${lerp(1, .78, settle)})`);
        set(msgs[0], pop(t, A + .2), `scale(${pop(t, A + .2)})`);
        typ.style.display = t > A + .55 && t < tAlways + .25 ? 'flex' : 'none';
        typ.querySelectorAll('i').forEach((d, i) => d.style.transform = `translateY(${Math.sin(t * 12 - i) * 5}px)`);
        msgs[1].style.display = t >= tAlways + .25 ? 'block' : 'none';
        set(msgs[1], pop(t, tAlways + .25), `scale(${pop(t, tAlways + .25)})`);
        const bill = layer.querySelector('#r_bill'), bIn = pop(t, tAdv - .05, .3), bOut = easeIn(prog(t, tNo - .2, tNo + .05));
        set(bill, t > tAdv - .05 ? clamp(bIn * 2) * (1 - bOut) : 0, `scale(${lerp(1.6, 1, bIn) * (1 - bOut * .3)}) rotate(${-4 + bOut * 14}deg)`);
        layer.querySelector('#r_x1').setAttribute('stroke-dashoffset', 760 * (1 - easeOut(prog(t, tAdv + .25, tAdv + .4))));
        layer.querySelector('#r_x2').setAttribute('stroke-dashoffset', 760 * (1 - easeOut(prog(t, tAdv + .38, tAdv + .53))));
        const ok = pop(t, okT + .1, .4);
        set(layer.querySelector('#r_ok'), clamp(ok * 2), `scale(${lerp(.7, 1, ok)})`);
        return { flash: Math.max(0, 1 - Math.abs(t - tAdv) * 7) * .6 };
      },
    });
  }

  // =====================================================================================
  // 6. THREE LANGUAGES
  // =====================================================================================
  {
    const [A, B] = T.lang;
    const times = cfg.greetings.map(g => W(g[2]));
    const tEnd = W('как', W('по-польски'));
    const layer = mkLayer(`
      <div class="fill scbg" style="background:radial-gradient(900px 700px at 50% 40%, #0f2430, #07090c 70%)"></div>
      <div class="phone" id="l_phone" style="left:220px;top:250px;transform-origin:50% 0">
        <div class="notch"></div>
        <div class="head"><div class="avatar" style="background:#2e8bff">💬</div><div><div class="who">Новый клиент</div><div class="st">печатает…</div></div></div>
        <div class="msgs" style="justify-content:center;gap:34px">
          ${cfg.greetings.map(([f, txt]) => `<div class="msg in big l_m"><span style="font-size:58px">${f}</span>${esc(txt)}</div>`).join('')}
        </div>
      </div>
      <div class="abs center-x" id="l_end" style="top:250px">
        <div class="display glow-cyan" style="font-size:96px;letter-spacing:.04em;color:#c8fbf6">RU • UA • PL</div>
        <div class="display" style="font-size:44px;margin-top:26px;color:#f2f5f7">Говорим на вашем языке</div>
      </div>`);
    const msgs = [...layer.querySelectorAll('.l_m')], phone = layer.querySelector('#l_phone');
    scenes.push({
      id: 'lang', t: [A, B], layer,
      update(t, lt) {
        const ph = easeOut(prog(lt, 0, .4)), settle = easeInOut(prog(t, tEnd - .1, tEnd + .35));
        set(phone, ph, `translateY(${(1 - ph) * 200 + settle * 330}px) scale(${lerp(1, .74, settle)})`);
        msgs.forEach((m, i) => { const p = pop(t, times[i] - .05, .35);
          set(m, clamp(p * 2), `translateX(${(1 - p) * -80}px) scale(${lerp(.6, 1, p)})`);
          m.style.boxShadow = `0 0 ${40 * Math.max(0, 1 - Math.abs(t - times[i] - .2) * 2)}px rgba(34,228,212,.6)`; });
        const e = pop(t, tEnd, .45);
        set(layer.querySelector('#l_end'), clamp(e * 2), `scale(${lerp(.8, 1, e)})`, e < 1 ? `blur(${(1 - e) * 8}px)` : 'none');
      },
    });
  }

  // =====================================================================================
  // 7. CUSTOM GAMING PC
  // =====================================================================================
  {
    const [A, B] = T.gaming;
    const tStart = W('Собрать'), tEasy = W('Легко'), tBudget = W('Подобрать'), tB2 = W('бюджет');
    const { scene, camera } = new3d(30);
    const pc = makeGamingPC(); scene.add(pc);
    const desk = makeDesk(0x111317); desk.position.y = -2.25; scene.add(desk);
    scene.add(new THREE.AmbientLight(0x1a2230, .35));
    const key = new THREE.SpotLight(0xffffff, 60.0, 30, .45, .6); key.position.set(6, 8, 5); key.target = pc; scene.add(key);
    const rim = new THREE.PointLight(COL.blue, 15.0, 14); rim.position.set(-4, 3, -5); scene.add(rim);
    const inner = new THREE.PointLight(COL.cyan, 0.0, 6); inner.position.set(.3, .4, 0); scene.add(inner);
    scene.fog = new THREE.FogExp2(0x07090c, .04);
    const P = pc.userData.parts;
    const home = { cpu: P.cpu.position.clone(), cooler: P.cooler.position.clone(), gpu: P.gpu.position.clone(), ram: P.ram.map(r => r.position.clone()) };
    const steps = [['cpu', tStart + .05], ['cooler', tStart + .45], ['ram0', tStart + .75], ['ram1', tStart + .9], ['gpu', tStart + 1.15]];
    const layer = mkLayer(`
      <div class="abs center-x" id="g_title" style="top:270px">
        <div class="display glow-cyan" style="font-size:88px;color:#dff">Custom<br>Gaming PC</div>
      </div>
      <div class="abs center-x" id="g_budget" style="top:1060px">
        <div class="chip blue" style="font-size:34px">Сборка под твой бюджет</div>
        <div style="width:640px;margin:26px auto 0;height:12px;border-radius:6px;background:rgba(255,255,255,.12);position:relative">
          <div id="g_fill" style="position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#2e8bff,#22e4d4)"></div>
          <div id="g_knob" style="position:absolute;top:-12px;width:36px;height:36px;border-radius:50%;background:#fff;box-shadow:0 0 24px #22e4d4"></div>
        </div>
      </div>
      <div class="abs kicker" id="g_parts" style="left:90px;top:250px;line-height:2;color:#9fdcff"></div>`);
    const partNames = ['CPU', 'COOLER', 'RAM', 'RAM', 'GPU'];
    scenes.push({
      id: 'gaming', t: [A, B], layer, scene3d: scene, camera, bloom: .7, tint: ['46,139,255', '34,228,212', '160,110,255'],
      update(t, lt) {
        const fly = (obj, from, to, at) => { const k = expoOut(prog(t, at, at + .38)); obj.position.lerpVectors(from, to, k); obj.visible = t >= at - .02; return k; };
        fly(P.cpu, home.cpu.clone().add(new THREE.Vector3(3, 1.5, 0)), home.cpu, steps[0][1]);
        fly(P.cooler, home.cooler.clone().add(new THREE.Vector3(3, 2.5, 0)), home.cooler, steps[1][1]);
        P.ram.forEach((r, i) => fly(r, home.ram[i].clone().add(new THREE.Vector3(2.5, 2, 0)), home.ram[i], steps[2 + i][1]));
        fly(P.gpu, home.gpu.clone().add(new THREE.Vector3(3.5, -.5, 1)), home.gpu, steps[4][1]);
        const on = prog(t, tEasy - .05, tEasy + .4);
        const hue = (t - tEasy) * .25;
        pc.userData.rgbMats.forEach((m, i) => { m.emissiveIntensity = on * (1.4 + Math.sin(t * 3 + i) * .3); m.emissive.setHSL((.55 + hue + i * .04) % 1, 1, .55); });
        inner.intensity = 9.0 * on;
        const spin = on * (t - tEasy);
        P.fans.forEach((f, i) => f.userData.rotor.rotation.z = spin * (7 + i));
        pc.userData.cfan.userData.rotor.rotation.z = spin * 8;
        P.gpu.children.forEach(c => c.userData.rotor && (c.userData.rotor.rotation.z = spin * 6));
        // camera: close during assembly, orbit after power-on
        const orbit = easeInOut(prog(t, tEasy, B)) * 1.3;
        const r = lerp(13.5, 15.5, prog(t, A, B));
        camera.position.set(Math.cos(.35 + orbit) * r * .9 + 1.5, lerp(2.4, 3.4, prog(t, A, B)), Math.sin(.35 + orbit) * r);
        camera.position.x = Math.max(camera.position.x, 3.5);
        camera.lookAt(0, .9, 0);
        const ti = pop(t, tEasy, .45);
        set(layer.querySelector('#g_title'), clamp(ti * 2), `scale(${lerp(1.5, 1, ti)})`, ti < 1 ? `blur(${(1 - ti) * 10}px)` : 'none');
        const b = easeOut(prog(t, tBudget - .1, tBudget + .3));
        set(layer.querySelector('#g_budget'), b, `translateY(${(1 - b) * 40}px)`);
        const v = .25 + .5 * easeInOut(prog(t, tB2 - .3, tB2 + .5)) - .15 * easeInOut(prog(t, tB2 + .6, tB2 + 1.1));
        layer.querySelector('#g_fill').style.width = `${v * 640}px`; layer.querySelector('#g_knob').style.left = `${v * 640 - 18}px`;
        const shown = steps.filter(s => t >= s[1]).length;
        layer.querySelector('#g_parts').innerHTML = partNames.slice(0, shown).map(p => `✓ ${p}`).join('<br>');
        set(layer.querySelector('#g_parts'), 1 - prog(t, tEasy - .1, tEasy + .1));
        return { flash: Math.max(0, 1 - Math.abs(t - tEasy) * 4) * .9 };
      },
    });
  }

  // =====================================================================================
  // 8. REMOTE HELP
  // =====================================================================================
  {
    const [A, B] = T.remote;
    const tWin = W('Windows'), tOk = W('Тоже');
    const dev = (x, label, icon) => `<div class="abs" style="left:${x}px;top:600px;width:330px;text-align:center">
        <div style="width:330px;height:230px;border-radius:26px;background:linear-gradient(160deg,#16314d,#0b1622);border:3px solid #2a3a4c;display:grid;place-items:center;font-size:90px;box-shadow:0 30px 80px rgba(0,0,0,.5)">${icon}</div>
        <div style="width:400px;height:20px;margin:-2px -35px 0;border-radius:0 0 18px 18px;background:#3a4553"></div>
        <div class="kicker" style="margin-top:26px;font-size:24px;color:#cfe3ff">${label}</div></div>`;
    const layer = mkLayer(`
      <div class="fill scbg" style="background:radial-gradient(900px 700px at 50% 45%, #0f2238, #07090c 70%)"></div>
      <div class="abs center-x display glow-blue" id="m_title" style="top:290px;font-size:84px;color:#dbeaff">Удалённая<br>помощь</div>
      ${dev(80, 'ВАШ НОУТБУК', '💻')}${dev(670, 'МАСТЕР', '🛠️')}
      <svg class="abs" viewBox="0 0 1080 300" style="left:0;top:560px;width:1080px;height:300px">
        <path id="m_path" d="M410 150 C 500 40, 580 40, 670 150" fill="none" stroke="#22e4d4" stroke-width="6" stroke-dasharray="14 14" stroke-linecap="round"/>
        ${[0, 1, 2].map(i => `<circle class="m_pk" r="10" fill="#bff8f2"/>`).join('')}
      </svg>
      <div class="abs center-x" id="m_lock" style="top:960px"><div class="chip glass" style="font-size:30px">🔒 Только с вашего согласия</div></div>
      <div class="abs center-x" id="m_ok" style="top:1080px"><div class="chip green" style="font-size:32px">✓ Без визита мастера</div></div>`);
    const path = layer.querySelector('#m_path'), pks = [...layer.querySelectorAll('.m_pk')];
    scenes.push({
      id: 'remote', t: [A, B], layer,
      update(t, lt) {
        const ti = pop(t, tWin - .2, .45);
        set(layer.querySelector('#m_title'), clamp(ti * 2), `scale(${lerp(.8, 1, ti)})`);
        const L = path.getTotalLength(), draw = easeOut(prog(t, A + .2, A + .8));
        path.style.strokeDashoffset = `${-t * 60}`; path.style.opacity = draw;
        pks.forEach((p, i) => { const k = ((t - A) * .9 + i / 3) % 1, pt = path.getPointAtLength(k * L); p.setAttribute('cx', pt.x); p.setAttribute('cy', pt.y); p.style.opacity = draw * Math.sin(k * Math.PI); });
        set(layer.querySelector('#m_lock'), easeOut(prog(t, A + .6, A + 1)));
        set(layer.querySelector('#m_ok'), pop(t, tOk), `scale(${pop(t, tOk)})`);
      },
    });
  }

  // =====================================================================================
  // 9. DON'T THROW IT AWAY — freeze frame + rewind
  // =====================================================================================
  {
    const [A, B] = T.trash;
    const tStop = W('выбрасывайте') - .1, tRew = tStop + .62;
    const { scene, camera } = new3d(36);
    const floor = makeDesk(0x15171b); scene.add(floor);
    const bin = makeBin(); bin.position.set(.9, 0, 0); bin.scale.setScalar(.85); scene.add(bin);
    const lap = makeLaptop(); lap.userData.lid.rotation.x = -1.48; lap.scale.setScalar(.8); scene.add(lap);
    scene.add(new THREE.AmbientLight(0x2a3340, .6));
    const key = new THREE.SpotLight(0xffffff, 66.0, 30, .5, .6); key.position.set(-3, 9, 5); key.target = bin; scene.add(key);
    const rim = new THREE.PointLight(COL.blue, 9.0, 12); rim.position.set(4, 3, -3); scene.add(rim);
    const path = k => new THREE.Vector3(lerp(-3.2, .9, k), 2.2 + Math.sin(k * Math.PI) * 1.6 + (1 - k) * .4 + k * .6, lerp(1.4, 0, k));
    const layer = mkLayer(`
      <div class="abs center-x display" id="t_stop" style="top:330px;font-size:230px;color:#ff3b3b;text-shadow:0 0 50px rgba(255,59,59,.7)">СТОП!</div>
      <div class="abs kicker" id="t_rew" style="left:90px;top:250px;font-size:40px;color:#fff">◀◀ REWIND</div>
      <div class="abs center-x" id="t_save" style="top:1060px"><div class="display" style="font-size:52px;line-height:1.2;color:#f2f5f7">Может, его ещё<br><span style="color:#5dffa6">можно спасти?</span></div></div>
      <div class="fill" id="t_lines" style="background:repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 2px, transparent 2px 7px);mix-blend-mode:screen"></div>`);
    scenes.push({
      id: 'trash', t: [A, B], layer, scene3d: scene, camera, bloom: .7, tint: ['46,139,255', '255,122,47', '120,170,255'],
      update(t, lt) {
        // throw: A → tStop (frozen at k≈.72), rewind: back to start
        let k;
        if (t < tStop) k = easeIn(prog(t, A + .2, tStop + .9)) ; else if (t < tRew) k = easeIn(prog(tStop, A + .2, tStop + .9)); else k = easeIn(prog(tStop, A + .2, tStop + .9)) * (1 - easeInOut(prog(t, tRew, tRew + .55)));
        lap.position.copy(path(k));
        lap.rotation.set(k * 2.2, k * 1.4, k * 1.1);
        const frozen = t >= tStop && t < tRew;
        const pull = frozen ? easeOut(prog(t, tStop, tStop + .25)) : 0;
        camera.position.set(lerp(.8, .2, pull), lerp(4.6, 4.0, pull), lerp(15.5, 11.5, pull)); camera.lookAt(lerp(-.45, lap.position.x, pull * .6), 2.3, 0);
        const s = pop(t, tStop, .3);
        set(layer.querySelector('#t_stop'), frozen ? clamp(s * 2) : 0, `scale(${lerp(2, 1, s)}) rotate(-6deg)`);
        const rew = t >= tRew;
        set(layer.querySelector('#t_rew'), rew ? (Math.floor(t * 6) % 2 ? 1 : .4) : 0);
        set(layer.querySelector('#t_lines'), rew ? .9 : 0, `translateY(${(t * 400) % 7}px)`);
        const sv = easeOut(prog(t, tRew + .1, tRew + .4));
        set(layer.querySelector('#t_save'), sv, `translateY(${(1 - sv) * 30}px)`);
        return {
          flash: Math.max(0, 1 - Math.abs(t - tStop) * 8) * .9,
          glFilter: frozen ? `grayscale(${pull}) contrast(1.15)` : rew ? 'saturate(.6) hue-rotate(-10deg)' : 'none',
          glTransform: frozen ? `scale(${1 + pull * .04})` : rew ? `translateX(${Math.sin(t * 90) * 4}px)` : '',
        };
      },
    });
  }

  // =====================================================================================
  // 10. FINAL OFFER
  // =====================================================================================
  {
    const [A, B] = T.final;
    const tTg = W('Телеграм'), tSer = W('Серьёзно'), tDeal = W('договорились'), voiceEnd = tDeal + .85;
    const { scene, camera } = new3d(30);
    const pc = makeGamingPC(); pc.scale.setScalar(.82); scene.add(pc);
    const desk = makeDesk(0x0d0f12); desk.position.y = -1.85; scene.add(desk);
    scene.add(new THREE.AmbientLight(0x111a24, .3));
    const sweepL = new THREE.SpotLight(0xffffff, 90.0, 30, .25, .5); scene.add(sweepL); sweepL.target = pc;
    const rim = new THREE.PointLight(COL.cyan, 12.0, 14); rim.position.set(-4, 3, -4); scene.add(rim);
    scene.fog = new THREE.FogExp2(0x07090c, .05);
    const layer = mkLayer(`
      <div class="abs center-x" id="f_logo" style="top:200px">${logoSVG(560)}</div>
      <div class="abs center-x" id="f_sub" style="top:470px"><div class="display" style="font-size:34px;letter-spacing:.06em;color:#cfe3ff">${esc(cfg.subtitle)}</div>
        <div class="kicker" style="margin-top:14px;font-size:26px;color:#9fe8e0">${esc(cfg.cities)}</div></div>
      <div class="abs" id="f_list" style="left:150px;right:150px;top:575px">
        ${cfg.services.map((s, i) => `<div class="f_row" style="display:flex;align-items:center;gap:24px;padding:15px 28px;margin-bottom:12px;border-radius:22px;background:rgba(15,19,24,.86);border:1.5px solid rgba(220,235,255,.14);font-family:var(--display);font-weight:800;font-size:31px;text-transform:uppercase">
          <span style="color:#22e4d4;font-family:var(--mono);font-size:26px">0${i + 1}</span>${esc(s)}</div>`).join('')}
      </div>
      <div class="abs" id="f_tg" style="left:110px;right:110px;top:1010px;padding:30px 36px;border-radius:36px;display:flex;align-items:center;gap:30px;
        background:linear-gradient(135deg, rgba(46,139,255,.22), rgba(34,228,212,.12));border:2px solid rgba(34,228,212,.6);box-shadow:0 0 80px rgba(34,228,212,.25)">
        ${TG_ICON(130)}<div><div class="display" style="font-size:30px;color:#cfe3ff">Напиши мне в Telegram</div>
        <div class="display" style="font-size:66px;margin-top:10px;color:#fff;letter-spacing:-.02em">${esc(cfg.telegram)}</div></div>
      </div>
      <div class="abs center-x" id="f_deal" style="top:640px"><div style="font-size:200px;line-height:1">😉</div><div class="chip green" style="margin-top:20px;font-size:38px">🤝 Договорились?</div></div>
      <div class="fill" id="f_end" style="background:#07090c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px">
        ${logoSVG(640)}
        <div class="display" style="font-size:44px;text-align:center;line-height:1.25;color:#f2f5f7;max-width:860px">${esc(cfg.tagline)}</div>
        <div style="display:flex;align-items:center;gap:20px">${TG_ICON(70)}<span class="display" style="font-size:52px">${esc(cfg.telegram)}</span></div>
      </div>`);
    const rows = [...layer.querySelectorAll('.f_row')];
    scenes.push({
      id: 'final', t: [A, B], layer, scene3d: scene, camera, bloom: .65, tint: ['34,228,212', '46,139,255', '120,170,255'],
      update(t, lt) {
        const a = (t - A) * .6;
        sweepL.position.set(Math.cos(a) * 6, 5, Math.sin(a) * 6 + 2);
        pc.rotation.y = -.6 + (t - A) * .08;
        pc.userData.rgbMats.forEach((m, i) => { m.emissiveIntensity = 1.3 + Math.sin(t * 2 + i) * .25; m.emissive.setHSL((.52 + Math.sin(t * .3 + i * .1) * .05) % 1, 1, .55); });
        pc.userData.parts.fans.forEach((f, i) => f.userData.rotor.rotation.z = t * (6 + i));
        camera.position.set(9.5, 2.2, 11); camera.lookAt(0, -.2, 0);
        const lg = pop(t, A + .1, .5);
        set(layer.querySelector('#f_logo'), clamp(lg * 2), `scale(${lerp(.85, 1, lg)})`, lg < 1 ? `blur(${(1 - lg) * 10}px)` : 'none');
        set(layer.querySelector('#f_sub'), easeOut(prog(t, A + .45, A + .85)));
        const tg = pop(t, tTg - .1, .45);
        set(layer.querySelector('#f_tg'), clamp(tg * 2), `translateY(${(1 - tg) * 80}px) scale(${1 + Math.sin(Math.max(0, t - tTg) * 5) * .012})`);
        const listOn = t >= tSer - .2 && t < tDeal - .15;
        rows.forEach((r, i) => { const p = pop(t, tSer - .2 + i * .17, .35); set(r, listOn ? clamp(p * 2) * (1 - prog(t, tDeal - .35, tDeal - .15)) : 0, `translateX(${(1 - p) * 200}px)`); });
        const dl = pop(t, tDeal - .2, .45);
        set(layer.querySelector('#f_deal'), t > tDeal - .2 && t < voiceEnd + .1 ? clamp(dl * 2) : 0, `scale(${dl}) rotate(${Math.sin(Math.max(0, t - tDeal) * 9) * 6 * (1 - prog(t, tDeal, tDeal + .8))}deg)`);
        const end = easeInOut(prog(t, voiceEnd, voiceEnd + .45));
        set(layer.querySelector('#f_end'), end, `scale(${lerp(1.06, 1, end)})`);
        return { show3d: end < 1, glFilter: listOn || (t > tDeal - .2) ? 'brightness(.45) blur(4px)' : 'none' };
      },
    });
  }

  scenes.forEach(s => { s.layer.dataset.id = s.id; });
  return scenes;
}

// ---------- Warsaw at night: layered parallax skyline (drawn once) + animated traffic and shimmer ----------
function buildWarsaw() {
  const W = 1080, H = 1920, HZ = 1230;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.style.cssText = 'position:absolute;inset:0'; return c; };
  const sky = mk(), far = mk(), mid = mk(), water = mk(), traffic = mk();
  // sky: gradient, stars, moon, clouds
  let c = sky.getContext('2d');
  let g = c.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#02040a'); g.addColorStop(.5, '#081627'); g.addColorStop(.85, '#123049'); g.addColorStop(1, '#1d5466');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) { const a = .15 + rnd(i) * .7; c.fillStyle = `rgba(220,235,255,${a * (1 - rnd(i + 2) * .7)})`; const r = .6 + rnd(i + 3) * 1.4; c.beginPath(); c.arc(rnd(i + 1) * W, rnd(i + 2) * 760, r, 0, 7); c.fill(); }
  g = c.createRadialGradient(180, 560, 0, 180, 560, 260); g.addColorStop(0, 'rgba(200,225,255,.35)'); g.addColorStop(1, 'rgba(200,225,255,0)'); c.fillStyle = g; c.fillRect(0, 200, W, 700);
  c.fillStyle = '#e8f1ff'; c.shadowColor = 'rgba(200,225,255,.9)'; c.shadowBlur = 40; c.beginPath(); c.arc(180, 560, 34, 0, 7); c.fill(); c.shadowBlur = 0;
  c.filter = 'blur(26px)';
  for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(90,120,150,${.10 + rnd(i + 40) * .12})`; c.beginPath(); c.ellipse(rnd(i + 41) * W, 180 + rnd(i + 42) * 420, 220 + rnd(i + 43) * 260, 40 + rnd(i + 44) * 50, 0, 0, 7); c.fill(); }
  c.filter = 'none';
  g = c.createRadialGradient(560, HZ, 30, 560, HZ, 820); g.addColorStop(0, 'rgba(70,190,210,.45)'); g.addColorStop(1, 'rgba(70,190,210,0)'); c.fillStyle = g; c.fillRect(0, 0, W, HZ);
  // shared building painter: gradient body, rim light, glowing windows
  const building = (ctx, x, top, w, base, seed, opt = {}) => {
    const bg = ctx.createLinearGradient(x, top, x + w, base); bg.addColorStop(0, opt.c1 || '#17263b'); bg.addColorStop(1, opt.c2 || '#0a1220');
    ctx.fillStyle = bg;
    if (opt.path) { ctx.beginPath(); opt.path(ctx); ctx.fill(); } else ctx.fillRect(x, top, w, base - top);
    ctx.fillStyle = `rgba(120,220,235,${opt.rim ?? .22})`; ctx.fillRect(x, top, 2, base - top);
    const cols = Math.max(2, Math.round(w / (opt.cw || 20))), rows = Math.round((base - top) / (opt.rh || 24));
    const cw = (w - 12) / cols, rh = (base - top - 16) / rows;
    for (let r = 0; r < rows; r++) {
      const floorLit = rnd(seed + r * 3.1) < (opt.floor ?? .12);
      for (let k = 0; k < cols; k++) {
        const on = floorLit || rnd(seed + r * 31 + k * 7) < (opt.lit ?? .38); if (!on) continue;
        const warm = rnd(seed + r + k * 13) < (opt.warm ?? .6);
        ctx.fillStyle = warm ? `rgba(255,${190 + rnd(r + k) * 40 | 0},120,${.55 + rnd(seed + r * k) * .45})` : `rgba(150,215,255,${.45 + rnd(seed + k * r + 2) * .45})`;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.fillRect(x + 6 + k * cw + cw * .2, top + 10 + r * rh + rh * .25, cw * .6, rh * .45);
      }
    }
    ctx.shadowBlur = 0;
  };
  // far layer: hazy city
  c = far.getContext('2d');
  for (let i = 0; i < 46; i++) { const w = 40 + rnd(i) * 80, h = 80 + rnd(i + 1) * 240, x = rnd(i + 2) * W - 30;
    building(c, x, HZ - h, w, HZ, 300 + i, { c1: '#162a3c', c2: '#0d1a29', rim: .08, lit: .22, cw: 16, rh: 20 }); }
  g = c.createLinearGradient(0, HZ - 360, 0, HZ); g.addColorStop(0, 'rgba(40,110,130,0)'); g.addColorStop(1, 'rgba(40,110,130,.35)'); c.fillStyle = g; c.fillRect(0, HZ - 360, W, 360);
  // mid layer: landmarks
  c = mid.getContext('2d');
  building(c, 60, 700, 130, HZ, 11, { warm: .7 }); building(c, 200, 820, 100, HZ, 12, { warm: .5 });
  // Palace of Culture and Science
  const px = 470, tiers = [[310, 150], [236, 150], [176, 170], [126, 150], [90, 120], [60, 80]];
  let y = HZ;
  tiers.forEach(([tw, th], i) => { y -= th; building(c, px - tw / 2, y, tw, y + th, 40 + i * 9, { warm: .92, lit: .5, floor: .2, rim: .3 });
    c.fillStyle = '#1b2c42'; for (let k = 0; k < 5; k++) c.fillRect(px - tw / 2 + k * (tw - 8) / 4, y - 14, 8, 14); });
  c.fillStyle = '#1b2c42'; c.beginPath(); c.moveTo(px - 22, y); c.lineTo(px, y - 200); c.lineTo(px + 22, y); c.fill();
  c.fillStyle = 'rgba(255,214,140,.9)'; c.shadowColor = '#ffcf7a'; c.shadowBlur = 20; c.beginPath(); c.arc(px, y + 40, 12, 0, 7); c.fill(); c.shadowBlur = 0;
  building(c, px - 220, HZ - 130, 64, HZ, 61, { warm: .9 }); building(c, px + 156, HZ - 130, 64, HZ, 62, { warm: .9 });
  // Złota 44-like curve
  building(c, 610, 560, 100, HZ, 77, { warm: .25, lit: .45, path: k => { k.moveTo(610, HZ); k.lineTo(610, 600); k.quadraticCurveTo(660, 480, 710, 610); k.lineTo(710, HZ); } });
  // Varso-like tower with lit spire
  building(c, 730, 380, 124, HZ, 91, { warm: .2, lit: .5, floor: .25, c1: '#1a2d46' });
  c.strokeStyle = 'rgba(120,230,240,.9)'; c.lineWidth = 3; c.shadowColor = '#22e4d4'; c.shadowBlur = 16;
  c.beginPath(); c.moveTo(750, 380); c.lineTo(792, 150); c.lineTo(834, 380); c.stroke(); c.shadowBlur = 0;
  building(c, 880, 560, 112, HZ, 13, { warm: .4 }); building(c, 1000, 690, 90, HZ, 14, { warm: .5 }); building(c, -10, 830, 80, HZ, 15, { warm: .6 });
  for (const [x, yy] of [[792, 150], [px, y - 200], [660, 488], [125, 700]]) { const gg = c.createRadialGradient(x, yy, 0, x, yy, 34);
    gg.addColorStop(0, 'rgba(255,60,60,.9)'); gg.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = gg; c.fillRect(x - 34, yy - 34, 68, 68); }
  // bridge deck
  c.fillStyle = '#060a10'; c.fillRect(0, HZ - 6, W, 22);
  for (let i = 0; i < 24; i++) { c.fillStyle = 'rgba(255,200,120,.8)'; c.shadowColor = '#ffc97a'; c.shadowBlur = 14; c.beginPath(); c.arc(20 + i * 46, HZ - 14, 3, 0, 7); c.fill(); }
  c.shadowBlur = 0;
  // water: blurred reflection of the skyline + streaks
  c = water.getContext('2d');
  g = c.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, '#0b2231'); g.addColorStop(1, '#02050a'); c.fillStyle = g; c.fillRect(0, HZ + 16, W, H);
  c.save(); c.globalAlpha = .38; c.filter = 'blur(6px)'; c.translate(0, 2 * HZ + 32); c.scale(1, -1); c.drawImage(far, 0, 0); c.drawImage(mid, 0, 0); c.restore();
  g = c.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, 'rgba(2,5,10,0)'); g.addColorStop(.6, 'rgba(2,5,10,.85)'); c.fillStyle = g; c.fillRect(0, HZ + 16, W, H);
  const streaks = mk(); const sc = streaks.getContext('2d');
  for (let i = 0; i < 320; i++) { const x = rnd(i + 50) * W, yy = HZ + 24 + Math.pow(rnd(i + 51), 1.6) * 560, len = 16 + rnd(i + 52) * 90;
    sc.fillStyle = rnd(i + 53) < .6 ? `rgba(255,200,120,${.10 + rnd(i) * .25})` : `rgba(140,215,255,${.08 + rnd(i) * .22})`; sc.fillRect(x, yy, len, 2); }
  const el = document.createElement('div'); el.className = 'fill';
  const wrap = n => { const d = document.createElement('div'); d.className = 'fill'; d.appendChild(n); el.appendChild(d); return d; };
  const L = { sky: wrap(sky), far: wrap(far), mid: wrap(mid), water: wrap(water), streaks: wrap(streaks), traffic: wrap(traffic) };
  const tc = traffic.getContext('2d');
  return {
    el,
    update(t) {
      L.sky.style.transform = `translateY(${t * 4}px)`;
      L.far.style.transform = `translateY(${-t * 6}px) scale(${1 + t * .004})`;
      L.mid.style.transform = `translateY(${-t * 12}px) scale(${1 + t * .01})`;
      L.streaks.style.transform = `translateX(${Math.sin(t * 2.2) * 6}px)`;
      L.streaks.style.opacity = .75 + Math.sin(t * 3.1) * .25;
      // light trails on the bridge (white one way, red the other)
      tc.clearRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) {
        const dir = i % 2 ? 1 : -1, sp = 220 + rnd(i) * 160, x = ((rnd(i + 9) * 1400 + dir * t * sp) % 1400 + 1400) % 1400 - 160;
        const gr = tc.createLinearGradient(x, 0, x + 140 * dir, 0);
        const col = dir > 0 ? '255,240,220' : '255,70,60';
        gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},.95)`);
        tc.fillStyle = gr; tc.shadowColor = `rgb(${col})`; tc.shadowBlur = 10;
        tc.fillRect(Math.min(x, x + 140 * dir), HZ - 2 + (dir > 0 ? 0 : 6), 140, 3);
      }
      tc.shadowBlur = 0;
      L.traffic.style.transform = L.mid.style.transform;
    },
  };
}
