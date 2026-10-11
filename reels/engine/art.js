// Animated laptop-repair illustrations (900x600 viewBox) for scenes without footage.
// Each art: build() -> SVG markup, update(svg, lt, dur), labels -> technical callouts.
(() => {
const L = '#c6ff3d', R = '#ff5a36', I = '#5fd4ff', G = '#2b2f24', D = '#8d8c82', P = '#111310';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => 1 - Math.pow(1 - x, 3);
const rnd = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const q = (svg, sel) => svg.querySelector(sel);
const qa = (svg, sel) => svg.querySelectorAll(sel);
const mix = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };

function fan(cx, cy, r, cls, color = L) {
  let blades = '';
  for (let i = 0; i < 9; i++) blades += `<path d="M0 0 C ${r * .22} ${-r * .18}, ${r * .55} ${-r * .3}, ${r * .88} ${-r * .1} C ${r * .6} ${r * .06}, ${r * .28} ${r * .08}, 0 0Z"
    transform="rotate(${i * 40})" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-width="3.5"/>`;
  return `<g transform="translate(${cx} ${cy})"><circle r="${r + 14}" fill="${P}" stroke="${G}" stroke-width="5"/>
    <circle r="${r + 4}" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="2" stroke-dasharray="6 10"/>
    <g class="${cls}" filter="url(#glow)">${blades}</g><circle r="${r * .17}" fill="${P}" stroke="${color}" stroke-width="4"/></g>`;
}
function fins(x, y, w, h, n) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${P}" stroke="${G}" stroke-width="4"/>`;
  for (let i = 1; i < n; i++) s += `<line x1="${x + i * w / n}" y1="${y + 10}" x2="${x + i * w / n}" y2="${y + h - 10}" stroke="#4a4d42" stroke-width="3"/>`;
  return s + `<rect x="${x - 30}" y="${y + h / 2 - 9}" width="${w + 60}" height="18" rx="9" fill="#b08a4a" opacity=".55"/>`; // heat pipe
}
function dust(x, y, w, h, n, seed) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const r = 5 + rnd(i * 7 + seed) * 13;
    s += `<circle class="dust" cx="${(x + rnd(i + seed) * w).toFixed(1)}" cy="${(y + rnd(i * 3 + seed) * h).toFixed(1)}" r="${r.toFixed(1)}" fill="${['#a39d8f', '#8f8a7d', '#b8b2a3'][i % 3]}" opacity=".9"/>`;
  }
  return s;
}
function thermo(x, y, cls) {
  return `<g transform="translate(${x} ${y})"><rect x="-24" y="-10" width="48" height="270" rx="24" fill="${P}" stroke="${G}" stroke-width="4"/>
    ${[0, 1, 2, 3, 4].map(k => `<line x1="30" x2="44" y1="${20 + k * 52}" y2="${20 + k * 52}" stroke="${D}" stroke-width="3"/>`).join('')}
    <rect class="${cls}" x="-12" y="0" width="24" height="0" rx="12" fill="${R}" filter="url(#glow)"/>
    <circle cy="270" r="38" fill="${P}" stroke="${G}" stroke-width="4"/><circle class="${cls}-bulb" cy="270" r="26" fill="${R}" filter="url(#glow)"/></g>`;
}
function setThermo(svg, cls, frac, color) {
  const bar = q(svg, '.' + cls), h = 250 * frac;
  bar.setAttribute('y', 250 - h); bar.setAttribute('height', h); bar.setAttribute('fill', color);
  q(svg, `.${cls}-bulb`).setAttribute('fill', color);
}

const ART = {
  hotLaptop: {
    labels: [{ x: 640, y: 160, dx: 120, dy: -80, text: 'CPU 95°C', tone: 'hot', at: .5 }, { x: 735, y: 395, dx: 60, dy: 70, text: 'FAN MAX', at: .8 }],
    build: () => `
      <g class="lap">
        <rect x="180" y="70" width="480" height="320" rx="22" fill="${P}" stroke="${L}" stroke-width="5" filter="url(#glow)"/>
        <rect x="204" y="94" width="432" height="272" rx="10" fill="#0b0c08"/>
        <rect class="screenHeat" x="204" y="94" width="432" height="272" rx="10" fill="${R}" opacity="0"/>
        <text class="temp" x="420" y="262" text-anchor="middle" font-family="Unbounded" font-weight="900" font-size="104" fill="${R}">45°</text>
        <path d="M120 400 H720 L790 470 H50 Z" fill="${P}" stroke="${L}" stroke-width="5" filter="url(#glow)"/>
        <rect x="360" y="420" width="120" height="30" rx="8" fill="none" stroke="${G}" stroke-width="4"/>
      </g>
      ${[0, 1, 2, 3, 4, 5].map(i => `<path class="heat" d="M${235 + i * 74} 60 q -20 -28 0 -56 q 20 -28 0 -56" fill="none" stroke="${R}" stroke-width="6" stroke-linecap="round" filter="url(#glow)"/>`).join('')}
      ${fan(770, 400, 54, 'blades', R)}`,
    update(svg, lt) {
      const k = ease(prog(lt, 0, 1.4));
      q(svg, '.temp').textContent = `${Math.round(45 + 50 * k)}°`;
      q(svg, '.screenHeat').setAttribute('opacity', .12 * k + .06 * Math.sin(lt * 8) * k);
      q(svg, '.lap').setAttribute('transform', `translate(${Math.sin(lt * 47) * 3 * k} ${Math.cos(lt * 39) * 2 * k})`);
      qa(svg, '.heat').forEach((h, i) => {
        const ph = (lt * 1.2 + i * .19) % 1;
        h.setAttribute('transform', `translate(0 ${-ph * 60})`); h.setAttribute('opacity', Math.sin(ph * Math.PI) * k);
      });
      q(svg, '.blades').setAttribute('transform', `rotate(${lt * 1700})`);
    },
  },
  openCover: {
    labels: [{ x: 160, y: 120, dx: -40, dy: -70, text: 'ВИНТ M2 ×6', at: .3 }],
    build: () => {
      const screws = [[160, 120], [450, 104], [740, 120], [160, 470], [450, 486], [740, 470]];
      let vents = '';
      for (let i = 0; i < 14; i++) vents += `<rect x="${300 + i * 22}" y="230" width="10" height="130" rx="5" fill="none" stroke="${G}" stroke-width="3"/>`;
      return `<g class="cover"><rect x="110" y="70" width="680" height="450" rx="38" fill="${P}" stroke="${L}" stroke-width="5" filter="url(#glow)"/>${vents}
        ${screws.map(([x, y]) => `<g class="screw" data-x="${x}" data-y="${y}" transform="translate(${x} ${y})"><circle r="24" fill="#1a1d15" stroke="${L}" stroke-width="4"/>
          <g class="cross"><line x1="-11" x2="11" stroke="${L}" stroke-width="5"/><line y1="-11" y2="11" stroke="${L}" stroke-width="5"/></g></g>`).join('')}</g>
        <g class="driver"><rect x="-8" y="-210" width="16" height="170" rx="4" fill="#c9c8bf"/><rect x="-30" y="-350" width="60" height="150" rx="22" fill="${L}" filter="url(#glow)"/>
          ${[0, 1, 2].map(k => `<rect x="${-18 + k * 14}" y="-330" width="6" height="110" rx="3" fill="#0b0c08" opacity=".3"/>`).join('')}</g>`;
    },
    update(svg, lt, dur) {
      const screws = [...qa(svg, '.screw')], per = (dur - .7) / screws.length, drv = q(svg, '.driver');
      let active = null;
      screws.forEach((s, i) => {
        const x = +s.dataset.x, y = +s.dataset.y, p = prog(lt, i * per, (i + 1) * per);
        const out = ease(prog(lt, (i + .75) * per, (i + 1.15) * per));
        s.setAttribute('transform', `translate(${x} ${y - out * 70}) scale(${1 + out * .3})`);
        s.setAttribute('opacity', 1 - out);
        q(s, '.cross').setAttribute('transform', `rotate(${p * 900})`);
        if (lt >= i * per && lt < (i + 1) * per) active = { x, y, out, p };
      });
      if (active) drv.setAttribute('transform', `translate(${active.x} ${active.y - 18 - active.out * 50}) rotate(${Math.sin(active.p * 40) * 3})`);
      const lift = ease(prog(lt, dur - .75, dur - .1));
      q(svg, '.cover').setAttribute('transform', `translate(${lift * 90} ${-lift * 70}) rotate(${lift * 7} 450 300)`);
      drv.setAttribute('opacity', 1 - prog(lt, dur - .75, dur - .5));
    },
  },
  dustFan: {
    labels: [{ x: 640, y: 160, dx: 110, dy: -90, text: 'ПЫЛЬ 80%', tone: 'hot', at: .7 }, { x: 260, y: 300, dx: -110, dy: 220, text: '900 RPM', at: 1.2 }],
    build: () => `${fins(480, 110, 340, 380, 15)}${fan(250, 300, 175, 'blades', D)}
      ${dust(490, 120, 320, 360, 70, 1)}${dust(110, 150, 290, 300, 40, 9)}
      <text x="650" y="560" text-anchor="middle" font-family="JetBrains Mono" font-size="26" letter-spacing="4" fill="${D}">РАДИАТОР</text>`,
    update(svg, lt) {
      svg.style.transformOrigin = '60% 40%';
      svg.style.transform = `scale(${1 + ease(prog(lt, 0, 3.5)) * .14})`;
      q(svg, '.blades').setAttribute('transform', `rotate(${lt * 55})`);
      qa(svg, '.dust').forEach((d, i) => d.setAttribute('transform', `translate(${Math.sin(lt * 2 + i) * 2.5} ${Math.cos(lt * 1.7 + i) * 2.5})`));
    },
  },
  dryPaste: {
    labels: [{ x: 450, y: 300, dx: -160, dy: -200, text: 'ПАСТА ВЫСОХЛА', tone: 'hot', at: 1.0 }],
    build: () => {
      let cracks = '';
      for (let i = 0; i < 11; i++) {
        const x = 310 + rnd(i) * 230, y = 165 + rnd(i + 5) * 160;
        cracks += `<path class="crack" d="M${x.toFixed(0)} ${y.toFixed(0)} l ${(30 - rnd(i + 2) * 60).toFixed(0)} ${(30 + rnd(i + 3) * 30).toFixed(0)} l ${(30 - rnd(i + 4) * 60).toFixed(0)} ${(20 + rnd(i + 6) * 30).toFixed(0)} l ${(20 - rnd(i + 8) * 40).toFixed(0)} ${(14 + rnd(i + 9) * 20).toFixed(0)}"
          fill="none" stroke="#2a2822" stroke-width="5" stroke-linecap="round" stroke-dasharray="260" stroke-dashoffset="260"/>`;
      }
      let pins = '';
      for (let i = 0; i < 12; i++) pins += `<rect x="${250 + i * 34}" y="62" width="14" height="26" rx="3" fill="#b08a4a"/><rect x="${250 + i * 34}" y="512" width="14" height="26" rx="3" fill="#b08a4a"/>`;
      return `${pins}<rect x="220" y="86" width="460" height="428" rx="22" fill="#171a12" stroke="${L}" stroke-width="5" filter="url(#glow)"/>
        <rect x="285" y="150" width="330" height="300" rx="16" fill="#7a766b"/>
        <rect x="285" y="150" width="330" height="300" rx="16" fill="url(#pasteShade)"/>${cracks}
        <defs><linearGradient id="pasteShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
        ${thermo(800, 130, 'th')}`;
    },
    update(svg, lt) {
      qa(svg, '.crack').forEach((c, i) => c.setAttribute('stroke-dashoffset', 260 * (1 - ease(prog(lt, .2 + i * .2, .7 + i * .2)))));
      setThermo(svg, 'th', .6 + .38 * ease(prog(lt, 0, 2.5)), R);
    },
  },
  cleaning: {
    labels: [{ x: 450, y: 495, dx: 180, dy: 50, text: 'НОВАЯ ПАСТА', at: 2.9 }],
    build: () => `${fins(130, 80, 640, 270, 22)}${dust(140, 90, 620, 250, 80, 3)}
      <g class="brush"><rect x="-13" y="-280" width="26" height="180" rx="10" fill="${L}" filter="url(#glow)"/><rect x="-22" y="-112" width="44" height="22" rx="4" fill="#c9c8bf"/>
        <path d="M-52 -90 H52 L42 0 H-42 Z" fill="#6b675d"/>${[...Array(9)].map((_, k) => `<line x1="${-40 + k * 10}" y1="-86" x2="${-36 + k * 9}" y2="-4" stroke="#8d897d" stroke-width="2"/>`).join('')}</g>
      <rect x="290" y="410" width="320" height="170" rx="16" fill="#171a12" stroke="${G}" stroke-width="4"/>
      <ellipse class="paste" cx="450" cy="495" rx="0" ry="0" fill="#e2e4dc"/>
      <ellipse class="pasteHi" cx="430" cy="480" rx="0" ry="0" fill="#fff" opacity=".5"/>`,
    update(svg, lt, dur) {
      const sweep = prog(lt, 0, dur * .6), bx = 130 + sweep * 660, by = 220 + Math.sin(lt * 18) * 24;
      const br = q(svg, '.brush');
      br.setAttribute('transform', `translate(${bx} ${by}) rotate(${Math.sin(lt * 18) * 12})`);
      br.setAttribute('opacity', 1 - prog(lt, dur * .6, dur * .66));
      qa(svg, '.dust').forEach((d, i) => {
        const cx = +d.getAttribute('cx');
        if (bx < cx - 20) { d.setAttribute('transform', ''); d.setAttribute('opacity', .9); return; }
        const k = clamp((bx - cx) / 320);
        d.setAttribute('transform', `translate(${k * (220 + rnd(i) * 320)} ${-k * (160 + rnd(i + 1) * 320)})`);
        d.setAttribute('opacity', .9 * (1 - k));
      });
      const p = ease(prog(lt, dur * .62, dur * .9)), show = prog(lt, dur * .6, dur * .63);
      q(svg, '.paste').setAttribute('rx', 18 + p * 110); q(svg, '.paste').setAttribute('ry', 18 + p * 55); q(svg, '.paste').setAttribute('opacity', show);
      q(svg, '.pasteHi').setAttribute('rx', 6 + p * 40); q(svg, '.pasteHi').setAttribute('ry', 3 + p * 12); q(svg, '.pasteHi').setAttribute('opacity', show * .5);
    },
  },
  cool: {
    labels: [{ x: 290, y: 290, dx: -120, dy: 230, text: '2400 RPM · ТИХО', tone: 'ice', at: .9 }],
    build: () => `${fan(290, 290, 190, 'blades', L)}${thermo(720, 110, 'th')}
      <text class="temp" x="720" y="570" text-anchor="middle" font-family="Unbounded" font-weight="900" font-size="58" fill="${L}">95°</text>
      ${[0, 1, 2, 3, 4].map(i => `<path class="air" d="M500 ${170 + i * 55} h 90" stroke="${I}" stroke-width="6" stroke-linecap="round" filter="url(#glow)"/>`).join('')}
      <path class="check" d="M820 470 l 40 40 l 70 -86" fill="none" stroke="${L}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="220" stroke-dashoffset="220" filter="url(#glow)"/>`,
    update(svg, lt, dur) {
      const k = ease(prog(lt, .2, dur * .7));
      q(svg, '.blades').setAttribute('transform', `rotate(${lt * 420})`);
      q(svg, '.temp').textContent = `${Math.round(95 - 43 * k)}°`;
      const col = k < .5 ? mix(R, '#ffd23d', k * 2) : mix('#ffd23d', I, (k - .5) * 2);
      q(svg, '.temp').setAttribute('fill', col);
      setThermo(svg, 'th', .96 - .58 * k, col);
      qa(svg, '.air').forEach((a, i) => {
        const ph = (lt * 1.5 + i * .23) % 1;
        a.setAttribute('transform', `translate(${ph * 70} 0)`); a.setAttribute('opacity', Math.sin(ph * Math.PI));
      });
      q(svg, '.check').setAttribute('stroke-dashoffset', 220 * (1 - ease(prog(lt, dur * .62, dur * .82))));
    },
  },
};
window.ART = ART;
})();
