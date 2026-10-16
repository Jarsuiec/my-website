import * as THREE from 'three';
import {memo} from './textures';

// Прямоугольник со скруглёнными углами (для экструзии).
export const roundedRectShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

// Скруглённый брусок: экструзия по Z, центр в нуле.
export const roundedBox = (w: number, h: number, d: number, r = 0.1, bevel = 0.04) =>
  memo(`rbox:${w}:${h}:${d}:${r}:${bevel}`, () => {
    const g = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
      depth: d - bevel * 2,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 6,
    });
    g.translate(0, 0, -(d - bevel * 2) / 2);
    g.computeVertexNormals();
    return g;
  });

// Лопасть вентилятора: изогнутая поверхность с толщиной, со стреловидностью и круткой.
export const bladeGeometry = (rIn: number, rOut: number, depth: number) =>
  memo(`blade:${rIn}:${rOut}:${depth}`, () => {
    const nu = 14;
    const nv = 14;
    const th = 0.07 * (rOut / 5.6);
    const P = (u: number, v: number, side: number): [number, number, number] => {
      const r = rIn + (rOut - rIn) * u;
      const chord = 0.95 - 0.25 * u; // угловая хорда, рад
      const sweep = 0.55 * u * u; // стреловидность к краю
      const th0 = sweep + (v - 0.5) * chord;
      const dz = (v - 0.5) * depth * (1 - 0.35 * u) + 0.25 * depth * Math.sin(Math.PI * v) * 0.35;
      return [r * Math.cos(th0), r * Math.sin(th0), dz + side * th];
    };
    const pos: number[] = [];
    const idx: number[] = [];
    const grid = (side: number) => {
      const base = pos.length / 3;
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pos.push(...P(i / nu, j / nv, side));
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) {
          const a = base + i * (nv + 1) + j;
          const b = a + nv + 1;
          if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
          else idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
    };
    grid(1);
    grid(-1);
    // Боковые кромки
    const edge = (fixed: 'u' | 'v', val: number, n: number) => {
      const base = pos.length / 3;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const [u, v] = fixed === 'u' ? [val, t] : [t, val];
        pos.push(...P(u, v, 1), ...P(u, v, -1));
      }
      for (let k = 0; k < n; k++) {
        const a = base + k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    };
    edge('v', 0, nu);
    edge('v', 1, nu);
    edge('u', 1, nv);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

// Рамка вентилятора: скруглённый квадрат с круглым отверстием и отверстиями под винты.
export const fanFrameGeometry = (size: number, depth: number) =>
  memo(`fanframe:${size}:${depth}`, () => {
    const s = roundedRectShape(size, size, size * 0.07);
    const hole = new THREE.Path();
    hole.absarc(0, 0, size * 0.49, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const off = size * 0.4375;
    for (const [x, y] of [
      [off, off],
      [-off, off],
      [off, -off],
      [-off, -off],
    ]) {
      const h = new THREE.Path();
      h.absarc(x, y, size * 0.022, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 48});
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });

// Кольцо (для LED-подсветки и рамок).
export const ringGeometry = (r: number, tube: number) => memo(`torus:${r}:${tube}`, () => new THREE.TorusGeometry(r, tube, 12, 96));
