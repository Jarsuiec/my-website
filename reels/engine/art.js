// Animated illustrations used instead of footage when a scene has "art" and no clip.
// Each art: build() -> SVG markup (900x600 viewBox), update(svg, lt, dur).
(() => {
const L = '#d4ff3a', R = '#ff4d3a', G = '#3a3d33', D = '#8a8a80';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => 1 - Math.pow(1 - x, 3);
const rnd = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const q = (svg, sel) => svg.querySelector(sel);
const qa = (svg, sel) => svg.querySelectorAll(sel);

function fan(cx, cy, r, cls) {
  let blades = '';
  for (let i = 0; i < 7; i++) blades += `<path d="M0 0 C ${r * .25} ${-r * .2}, ${r * .55} ${-r * .3}, ${r * .9} ${-r * .12} C ${r * .6} ${r * .05}, ${r * .3} ${r * .08}, 0 0Z" transform="rotate(${i * 360 / 7})" fill="none" stroke="${L}" stroke-width="5"/>`;
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#111310" stroke="${G}" stroke-width="6"/>
    <g class="${cls}">${blades}</g><circle r="${r * .16}" fill="${L}"/></g>`;
}
function fins(x, y, w, h, n) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#111310" stroke="${G}" stroke-width="5"/>`;
  for (let i = 1; i < n; i++) s += `<line x1="${x + i * w / n}" y1="${y + 8}" x2="${x + i * w / n}" y2="${y + h - 8}" stroke="${D}" stroke-width="4"/>`;
  return s;
}
function dust(x, y, w, h, n, seed) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle class="dust" data-i="${i}" cx="${x + rnd(i + seed) * w}" cy="${y + rnd(i * 3 + seed) * h}" r="${6 + rnd(i * 7 + seed) * 14}" fill="#9b968a" opacity=".85"/>`;
  return s;
}
function thermo(x, y, cls) {
  return `<g transform="translate(${x} ${y})"><rect x="-26" y="-10" width="52" height="260" rx="26" fill="#111310" stroke="${G}" stroke-width="5"/>
    <rect class="${cls}" x="-14" y="0" width="28" height="0" rx="14" fill="${R}"/><circle cy="262" r="40" fill="#111310" stroke="${G}" stroke-width="5"/>
    <circle class="${cls}-bulb" cy="262" r="28" fill="${R}"/></g>`;
}
function setThermo(svg, cls, frac, color) {
  const bar = q(svg, '.' + cls), hgt = 240 * frac;
  bar.setAttribute('y', 240 - hgt); bar.setAttribute('height', hgt); bar.setAttribute('fill', color);
  q(svg, `.${cls}-bulb`).setAttribute('fill', color);
}
const mix = (a, b, k) => { // hex color lerp
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
};

const ART = {
  hotLaptop: {
    build: () => `
      <g class="lap">
        <rect x="190" y="90" width="460" height="300" rx="20" fill="#111310" stroke="${L}" stroke-width="7"/>
        <text class="temp" x="420" y="270" text-anchor="middle" font-family="DejaVu Sans Mono" font-weight="700" font-size="110" fill="${R}">45°</text>
        <path d="M130 400 H710 L770 460 H70 Z" fill="#111310" stroke="${L}" stroke-width="7"/>
      </g>
      ${[0, 1, 2, 3, 4].map(i => `<path class="heat" data-i="${i}" d="M${250 + i * 85} 80 q -22 -30 0 -60 q 22 -30 0 -60" fill="none" stroke="${R}" stroke-width="7" stroke-linecap="round"/>`).join('')}
      ${fan(790, 160, 70, 'blades')}`,
    update(svg, lt) {
      const k = ease(prog(lt, 0, 1.6));
      q(svg, '.temp').textContent = `${Math.round(45 + 50 * k)}°`;
      q(svg, '.lap').setAttribute('transform', `translate(${(rnd(Math.floor(lt * 40)) - .5) * 8 * k} 0)`);
      qa(svg, '.heat').forEach((h, i) => {
        const ph = (lt * 1.3 + i * .23) % 1;
        h.setAttribute('transform', `translate(0 ${-ph * 70})`); h.setAttribute('opacity', (1 - ph) * k);
      });
      q(svg, '.blades').setAttribute('transform', `rotate(${lt * 1500})`);
    },
  },
  openCover: {
    build: () => {
      const screws = [[180, 140], [450, 120], [720, 140], [180, 440], [450, 460], [720, 440]];
      return `<rect class="cover" x="130" y="90" width="640" height="410" rx="34" fill="#111310" stroke="${L}" stroke-width="7"/>
        ${[0, 1, 2].map(i => `<rect x="${330 + i * 90}" y="250" width="60" height="90" rx="8" fill="none" stroke="${G}" stroke-width="5"/>`).join('')}
        ${screws.map(([x, y], i) => `<g class="screw" data-i="${i}" transform="translate(${x} ${y})"><circle r="24" fill="#1c1f17" stroke="${L}" stroke-width="5"/>
          <g class="cross"><line x1="-12" y1="0" x2="12" y2="0" stroke="${L}" stroke-width="5"/><line x1="0" y1="-12" x2="0" y2="12" stroke="${L}" stroke-width="5"/></g></g>`).join('')}
        <g class="driver"><rect x="-10" y="-200" width="20" height="150" fill="${D}"/><rect x="-28" y="-330" width="56" height="140" rx="20" fill="${L}"/></g>`;
    },
    update(svg, lt, dur) {
      const screws = [...qa(svg, '.screw')], per = (dur - .6) / screws.length;
      screws.forEach((s, i) => {
        const p = prog(lt, i * per, (i + 1) * per);
        const [x, y] = s.getAttribute('transform').match(/-?\d+(\.\d+)?/g).map(Number);
        s.dataset.x ??= x; s.dataset.y ??= y;
        const out = ease(prog(lt, (i + .7) * per, (i + 1.1) * per));
        s.setAttribute('transform', `translate(${s.dataset.x} ${+s.dataset.y - out * 60})`);
        s.setAttribute('opacity', 1 - out);
        q(s, '.cross').setAttribute('transform', `rotate(${p * 720})`);
        if (lt >= i * per && lt < (i + 1) * per)
          q(svg, '.driver').setAttribute('transform', `translate(${s.dataset.x} ${+s.dataset.y - 20 - out * 40})`);
      });
      const lift = ease(prog(lt, dur - .7, dur - .1));
      q(svg, '.cover').setAttribute('transform', `translate(${lift * 80} ${-lift * 60}) rotate(${lift * 6} 450 300)`);
      if (lt > dur - .7) q(svg, '.driver').setAttribute('opacity', 1 - lift);
    },
  },
  dustFan: {
    build: () => `${fins(470, 120, 360, 360, 14)}${fan(260, 300, 190, 'blades')}
      ${dust(480, 130, 340, 340, 60, 1)}${dust(110, 150, 300, 300, 35, 9)}
      <text x="650" y="550" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="34" fill="${D}">РАДИАТОР</text>`,
    update(svg, lt) {
      const zoom = 1 + ease(prog(lt, 0, 3)) * .12;
      svg.style.transform = `scale(${zoom})`;
      q(svg, '.blades').setAttribute('transform', `rotate(${lt * 60})`);
      qa(svg, '.dust').forEach((d, i) => d.setAttribute('transform', `translate(${Math.sin(lt * 2 + i) * 3} ${Math.cos(lt * 1.7 + i) * 3})`));
    },
  },
  dryPaste: {
    build: () => {
      let cracks = '';
      for (let i = 0; i < 9; i++) {
        const x = 300 + rnd(i) * 300, y = 160 + rnd(i + 5) * 280;
        cracks += `<path class="crack" d="M${x} ${y} l ${30 - rnd(i + 2) * 60} ${30 + rnd(i + 3) * 30} l ${30 - rnd(i + 4) * 60} ${20 + rnd(i + 6) * 30}" fill="none" stroke="#0d0d0b" stroke-width="6" stroke-dasharray="200" stroke-dashoffset="200"/>`;
      }
      return `<rect x="230" y="90" width="440" height="420" rx="20" fill="#1c1f17" stroke="${L}" stroke-width="7"/>
        <rect x="290" y="150" width="320" height="300" rx="14" fill="#77736a"/>${cracks}
        <text x="450" y="560" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="34" fill="${D}">CPU · СТАРАЯ ПАСТА</text>
        ${thermo(790, 140, 'th')}`;
    },
    update(svg, lt) {
      qa(svg, '.crack').forEach((c, i) => c.setAttribute('stroke-dashoffset', 200 * (1 - ease(prog(lt, .2 + i * .25, .7 + i * .25)))));
      setThermo(svg, 'th', .55 + .4 * ease(prog(lt, 0, 2.5)), R);
    },
  },
  cleaning: {
    build: () => `${fins(150, 100, 600, 260, 20)}${dust(160, 110, 580, 240, 70, 3)}
      <g class="brush"><rect x="-14" y="-260" width="28" height="170" rx="10" fill="${L}"/>
        <path d="M-50 -90 H50 L40 0 H-40 Z" fill="${D}"/></g>
      <rect x="300" y="420" width="300" height="150" rx="14" fill="#1c1f17" stroke="${G}" stroke-width="5"/>
      <ellipse class="paste" cx="450" cy="495" rx="0" ry="0" fill="#d9dbd2"/>
      <text class="pasteTxt" x="450" y="600" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="30" fill="${L}" opacity="0">НОВАЯ ПАСТА</text>`,
    update(svg, lt, dur) {
      const sweep = prog(lt, 0, dur * .6), bx = 150 + sweep * 620;
      const by = 230 + Math.sin(lt * 18) * 25;
      q(svg, '.brush').setAttribute('transform', `translate(${bx} ${by}) rotate(${Math.sin(lt * 18) * 12})`);
      q(svg, '.brush').setAttribute('opacity', 1 - prog(lt, dur * .6, dur * .65));
      qa(svg, '.dust').forEach((d, i) => {
        const cx = +d.getAttribute('cx');
        if (bx < cx - 20) { d.setAttribute('transform', ''); d.setAttribute('opacity', .85); return; }
        const k = clamp((bx - cx) / 300);
        d.setAttribute('transform', `translate(${k * (200 + rnd(i) * 300)} ${-k * (150 + rnd(i + 1) * 300)})`);
        d.setAttribute('opacity', .85 * (1 - k));
      });
      const p = ease(prog(lt, dur * .62, dur * .9));
      q(svg, '.paste').setAttribute('rx', 20 + p * 100); q(svg, '.paste').setAttribute('ry', 20 + p * 50);
      q(svg, '.paste').setAttribute('opacity', prog(lt, dur * .6, dur * .63));
      q(svg, '.pasteTxt').setAttribute('opacity', p);
    },
  },
  cool: {
    build: () => `${fan(300, 290, 200, 'blades')}${thermo(720, 120, 'th')}
      <text class="temp" x="720" y="560" text-anchor="middle" font-family="DejaVu Sans Mono" font-weight="700" font-size="64" fill="${L}">95°</text>
      ${[0, 1, 2, 3].map(i => `<path class="air" data-i="${i}" d="M520 ${200 + i * 50} h 80" stroke="#8fd4ff" stroke-width="6" stroke-linecap="round"/>`).join('')}
      <path class="check" d="M200 520 l 60 60 l 120 -130" fill="none" stroke="${L}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="320" stroke-dashoffset="320"/>`,
    update(svg, lt, dur) {
      const k = ease(prog(lt, .2, dur * .7));
      q(svg, '.blades').setAttribute('transform', `rotate(${lt * 500})`);
      q(svg, '.temp').textContent = `${Math.round(95 - 40 * k)}°`;
      q(svg, '.temp').setAttribute('fill', mix(R, L, k));
      setThermo(svg, 'th', .95 - .55 * k, mix(R, L, k));
      qa(svg, '.air').forEach((a, i) => {
        const ph = (lt * 1.6 + i * .27) % 1;
        a.setAttribute('transform', `translate(${ph * 60} 0)`); a.setAttribute('opacity', 1 - ph);
      });
      q(svg, '.check').setAttribute('stroke-dashoffset', 320 * (1 - ease(prog(lt, dur * .65, dur * .85))));
    },
  },
};
window.ART = ART;
})();
