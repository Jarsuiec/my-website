import * as THREE from 'three';

// Детерминированный генератор случайных чисел: одинаковый кадр при каждом рендере.
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const cache = new Map<string, unknown>();
export const memo = <T>(key: string, make: () => T): T => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
};

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const toTex = (c: HTMLCanvasElement, srgb = true, repeat = false) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};

// ---------------------------------------------------------------------------
// Материнская плата ATX: 24.4 × 30.5 см. Координаты платы: x ∈ [-12.2, 12.2], y ∈ [-15.25, 15.25].
// ---------------------------------------------------------------------------
export const BOARD_W = 24.4;
export const BOARD_H = 30.5;
export type Trace = {pts: [number, number][]; len: number};

const PX = 84; // пикселей на сантиметр
const bx = (x: number) => (x + BOARD_W / 2) * PX;
const by = (y: number) => (BOARD_H / 2 - y) * PX;

const polyLen = (pts: [number, number][]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};

// Шины дорожек: пучки параллельных линий с изломами под 45°, как у настоящей разводки.
const makeTraces = (): Trace[] => {
  const r = rng(7);
  const traces: Trace[] = [];
  const bus = (start: [number, number], segs: [number, number][], count: number, pitch: number, dir: [number, number]) => {
    for (let k = 0; k < count; k++) {
      const off: [number, number] = [dir[0] * k * pitch, dir[1] * k * pitch];
      const pts: [number, number][] = [[start[0] + off[0], start[1] + off[1]]];
      for (const s of segs) {
        const p = pts[pts.length - 1];
        pts.push([p[0] + s[0], p[1] + s[1]]);
      }
      traces.push({pts, len: polyLen(pts)});
    }
  };
  // CPU → DIMM (широкая шина памяти)
  bus([2.6, 10.5], [[1.2, 0], [0.9, -0.9], [1.4, 0]], 9, 0.16, [0, -1]);
  bus([2.6, 7.2], [[1.0, 0], [1.1, 1.1], [1.3, 0]], 7, 0.16, [0, -1]);
  // CPU → PCIe
  bus([-2.6, 4.3], [[0, -1.6], [-0.9, -0.9], [0, -2.2]], 8, 0.16, [1, 0]);
  // CPU → чипсет
  bus([1.0, 4.3], [[0, -3.0], [2.5, -2.5], [0, -2.4]], 6, 0.17, [1, 0]);
  // M.2 → чипсет
  bus([2.6, -5.0], [[1.4, 0], [0.8, -0.8], [0, -0.6]], 5, 0.16, [0, -1]);
  // VRM → CPU
  bus([-6.2, 11.8], [[1.6, 0], [0.9, -0.9]], 6, 0.17, [0, -1]);
  // Нижняя часть платы: случайные одиночные дорожки
  for (let i = 0; i < 46; i++) {
    const x0 = -11 + r() * 21;
    const y0 = -14.5 + r() * 9;
    const pts: [number, number][] = [[x0, y0]];
    let d = Math.floor(r() * 4);
    for (let s = 0; s < 4; s++) {
      const l = 0.6 + r() * 2.2;
      const dirs: [number, number][] = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071]];
      const v = dirs[d % 4];
      const p = pts[pts.length - 1];
      pts.push([Math.max(-12, Math.min(12, p[0] + v[0] * l)), Math.max(-15, Math.min(-1, p[1] + v[1] * l))]);
      d += r() < 0.5 ? 1 : 3;
    }
    traces.push({pts, len: polyLen(pts)});
  }
  return traces;
};

export const boardTraces = () => memo('traces', makeTraces);

export const pcbTextures = () =>
  memo('pcb', () => {
    const W = Math.round(BOARD_W * PX);
    const H = Math.round(BOARD_H * PX);
    const c = canvas(W, H);
    const g = c.getContext('2d')!;
    const rc = canvas(W, H); // карта шероховатости
    const gr = rc.getContext('2d')!;
    const r = rng(3);

    // Матовая чёрная паяльная маска с лёгким шумом
    g.fillStyle = '#0c1118';
    g.fillRect(0, 0, W, H);
    gr.fillStyle = '#b8b8b8';
    gr.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.03})`;
      g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3);
    }

    // Внутренние слои: еле заметная сетка заливок
    g.strokeStyle = 'rgba(40,70,100,0.07)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 14) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }

    // Дорожки
    const traces = boardTraces();
    for (const t of traces) {
      g.beginPath();
      gr.beginPath();
      t.pts.forEach(([x, y], i) => {
        if (i === 0) {
          g.moveTo(bx(x), by(y));
          gr.moveTo(bx(x), by(y));
        } else {
          g.lineTo(bx(x), by(y));
          gr.lineTo(bx(x), by(y));
        }
      });
      g.lineCap = gr.lineCap = 'round';
      g.lineJoin = gr.lineJoin = 'round';
      g.strokeStyle = '#1b2633';
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = 'rgba(120,170,220,0.10)';
      g.lineWidth = 1.5;
      g.stroke();
      gr.strokeStyle = '#6a6a6a';
      gr.lineWidth = 6;
      gr.stroke();
      // переходные отверстия на концах
      for (const p of [t.pts[0], t.pts[t.pts.length - 1]]) {
        g.fillStyle = '#9a8a62';
        g.beginPath();
        g.arc(bx(p[0]), by(p[1]), 4.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#0a0d12';
        g.beginPath();
        g.arc(bx(p[0]), by(p[1]), 2, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Россыпь переходных отверстий
    for (let i = 0; i < 700; i++) {
      const x = r() * W;
      const y = r() * H;
      g.fillStyle = 'rgba(160,145,110,0.55)';
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }

    // Шелкография
    const silk = (txt: string, x: number, y: number, size = 0.32, rot = 0) => {
      g.save();
      g.translate(bx(x), by(y));
      g.rotate(rot);
      g.fillStyle = 'rgba(225,232,240,0.78)';
      g.font = `600 ${size * PX}px "JetBrains Mono", monospace`;
      g.fillText(txt, 0, 0);
      g.restore();
    };
    const outline = (x0: number, y0: number, x1: number, y1: number) => {
      g.strokeStyle = 'rgba(225,232,240,0.55)';
      g.lineWidth = 2.5;
      g.strokeRect(bx(x0), by(y1), (x1 - x0) * PX, (y1 - y0) * PX);
    };
    silk('CPU1', -2.4, 4.6);
    silk('DIMM_A1', 5.0, 1.0, 0.26, -Math.PI / 2);
    silk('DIMM_A2', 6.2, 1.0, 0.26, -Math.PI / 2);
    silk('DIMM_B1', 7.4, 1.0, 0.26, -Math.PI / 2);
    silk('DIMM_B2', 8.6, 1.0, 0.26, -Math.PI / 2);
    silk('PCIEX16_1', -10.5, -0.6);
    silk('PCIEX16_2', -10.5, -7.6);
    silk('M2_1', -5.6, -3.4);
    silk('CPU_FAN', 1.5, 14.2, 0.26);
    silk('ATX_24P', 10.3, 1.0, 0.26, -Math.PI / 2);
    silk('EPS_8P', -10.6, 13.0, 0.26);
    silk('BIOS', 8.0, -12.6, 0.26);
    silk('SYS_FAN1', 8.8, -14.4, 0.24);
    silk('REV 1.02', -11.4, -14.6, 0.24);
    outline(-3.0, 4.3, 3.0, 10.9);
    outline(-11.5, -14.9, -2.0, -12.6);

    // Монтажные отверстия ATX
    for (const [x, y] of [[-11.4, 14.5], [10.6, 14.5], [-11.4, -1.1], [10.6, 1.2], [-11.4, -13.6], [10.6, -13.6], [3.8, -1.1]]) {
      const grad = g.createRadialGradient(bx(x), by(y), 6, bx(x), by(y), 24);
      grad.addColorStop(0, '#c9c3b4');
      grad.addColorStop(1, '#6f6a5e');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx(x), by(y), 24, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#05070a';
      g.beginPath();
      g.arc(bx(x), by(y), 11, 0, Math.PI * 2);
      g.fill();
      gr.fillStyle = '#303030';
      gr.beginPath();
      gr.arc(bx(x), by(y), 24, 0, Math.PI * 2);
      gr.fill();
    }

    // Контактные площадки разъёма CPU (LGA) — под сокетом видны края
    return {map: toTex(c), roughnessMap: toTex(rc, false)};
  });

// Шлифованный металл: тонкие продольные полосы для roughness/bump.
export const brushedTexture = () =>
  memo('brushed', () => {
    const c = canvas(512, 512);
    const g = c.getContext('2d')!;
    const r = rng(11);
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2200; i++) {
      const y = r() * 512;
      const v = Math.floor(100 + r() * 70);
      g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`;
      g.lineWidth = 0.5 + r() * 1.2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y + (r() - 0.5) * 2);
      g.stroke();
    }
    return toTex(c, false, true);
  });

// Шлифовка по кругу для кнопки питания.
export const radialBrushedTexture = () =>
  memo('radialBrushed', () => {
    const c = canvas(1024, 1024);
    const g = c.getContext('2d')!;
    const r = rng(19);
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, 1024, 1024);
    g.translate(512, 512);
    for (let i = 0; i < 2600; i++) {
      const rad = r() * 512;
      const v = Math.floor(95 + r() * 80);
      g.strokeStyle = `rgba(${v},${v},${v},${0.2 + r() * 0.4})`;
      g.lineWidth = 0.6 + r();
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.stroke();
    }
    return toTex(c, false);
  });

// Пыль: пятнистая серая маска.
export const dustTexture = () =>
  memo('dust', () => {
    const c = canvas(512, 512);
    const g = c.getContext('2d')!;
    const r = rng(23);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1600; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 2 + r() * 14;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(255,255,255,${0.15 + r() * 0.3})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // волокна
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 260; i++) {
      g.lineWidth = 0.6 + r();
      g.beginPath();
      let x = r() * 512;
      let y = r() * 512;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (r() - 0.5) * 22;
        y += (r() - 0.5) * 22;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return toTex(c, false, true);
  });

// Плотный слой пыли (войлок на входной стороне радиатора).
export const dustDenseTexture = () =>
  memo('dustDense', () => {
    const c = canvas(512, 512);
    const g = c.getContext('2d')!;
    const r = rng(29);
    g.fillStyle = 'rgb(150,150,150)';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 3 + r() * 18;
      const v = r() < 0.5 ? 255 : 40;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(${v},${v},${v},${0.18 + r() * 0.25})`);
      grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 500; i++) {
      g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath();
      let x = r() * 512;
      let y = r() * 512;
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.5) * 26;
        y += (r() - 0.5) * 26;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return toTex(c, false, true);
  });

// Наклейка на M.2 SSD — без чужих брендов, только формат.
export const ssdLabelTexture = () =>
  memo('ssdLabel', () => {
    const c = canvas(1600, 440);
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 1600, 0);
    grad.addColorStop(0, '#0d1520');
    grad.addColorStop(1, '#0a0f17');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1600, 440);
    g.strokeStyle = 'rgba(33,191,255,0.9)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(60, 330);
    g.lineTo(560, 330);
    g.lineTo(620, 270);
    g.lineTo(1540, 270);
    g.stroke();
    g.fillStyle = '#F3F8FF';
    g.font = '800 120px "Inter Display", sans-serif';
    g.fillText('NVMe', 60, 190);
    g.fillStyle = 'rgba(103,232,255,0.95)';
    g.font = '600 64px "JetBrains Mono", monospace';
    g.fillText('M.2 2280  ·  PCIe', 420, 186);
    g.fillStyle = 'rgba(243,248,255,0.45)';
    g.font = '500 34px "JetBrains Mono", monospace';
    g.fillText('SOLID STATE DRIVE', 60, 400);
    return toTex(c);
  });

// Мелкая маркировка чипа (контроллер/NAND) — нейтральные коды без брендов.
export const chipTexture = (code: string) =>
  memo('chip' + code, () => {
    const c = canvas(512, 512);
    const g = c.getContext('2d')!;
    g.fillStyle = '#16191e';
    g.fillRect(0, 0, 512, 512);
    const r = rng(code.length * 31);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.04})`;
      g.fillRect(r() * 512, r() * 512, 2, 2);
    }
    g.fillStyle = 'rgba(200,205,210,0.55)';
    g.font = '600 46px "JetBrains Mono", monospace';
    g.fillText(code, 40, 230);
    g.font = '500 32px "JetBrains Mono", monospace';
    g.fillText('2611 A3', 40, 300);
    g.beginPath();
    g.arc(60, 60, 14, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fill();
    return toTex(c);
  });

// Наклейка на втулку вентилятора: фирменный знак PC MASTER.
export const hubTexture = () =>
  memo('hub', () => {
    const c = canvas(512, 512);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, '#111823');
    grad.addColorStop(1, '#070b11');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(33,191,255,0.85)';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(256, 256, 200, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#F3F8FF';
    g.font = '800 70px "Inter Display", sans-serif';
    g.textAlign = 'center';
    g.fillText('PC', 256, 245);
    g.font = '700 46px "Inter Display", sans-serif';
    g.fillText('MASTER', 256, 305);
    return toTex(c);
  });

// Крышка процессора: светлый никель с лазерной гравировкой (нейтральные обозначения, без брендов).
export const ihsTexture = () =>
  memo('ihs', () => {
    const c = canvas(1024, 1024);
    const g = c.getContext('2d')!;
    const r = rng(41);
    g.fillStyle = '#dfe2e6';
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1800; i++) {
      const y = r() * 1024;
      const v = Math.floor(200 + r() * 40);
      g.strokeStyle = `rgba(${v},${v},${v + 4},${0.25 + r() * 0.3})`;
      g.lineWidth = 0.6 + r();
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(1024, y + (r() - 0.5) * 3);
      g.stroke();
    }
    g.fillStyle = 'rgba(70,74,80,0.55)';
    g.font = '600 64px "JetBrains Mono", monospace';
    g.fillText('PCM-8C16T', 120, 260);
    g.font = '500 44px "JetBrains Mono", monospace';
    g.fillText('X3-2611  4.6GHz', 120, 340);
    g.fillText('8A20F17  SAMPLE', 120, 410);
    g.strokeStyle = 'rgba(70,74,80,0.45)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(120, 820);
    g.lineTo(200, 900);
    g.lineTo(120, 900);
    g.closePath();
    g.stroke();
    return toTex(c);
  });

// Мягкое круглое пятно для частиц и «боке».
export const softDot = () =>
  memo('softDot', () => {
    const c = canvas(128, 128);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return toTex(c);
  });
