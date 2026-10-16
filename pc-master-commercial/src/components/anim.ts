// Детерминированные функции анимации: всё зависит только от времени кадра.
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

export const E = {
  linear: (t: number) => t,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  outBack: (t: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

// 0..1 на отрезке времени [a, b] с кривой.
export const ramp = (t: number, a: number, b: number, ease: (x: number) => number = E.inOutCubic) => ease(clamp01((t - a) / (b - a)));

// Окно видимости: появление за fin, исчезновение за fout.
export const win = (t: number, a: number, b: number, fin = 0.25, fout = 0.25) => Math.min(ramp(t, a, a + fin, E.outCubic), 1 - ramp(t, b - fout, b, E.inCubic));

// Затухающая тряска камеры после удара.
export const shake = (t: number, at: number, amp = 14, decay = 9, freq = 38) => {
  const d = t - at;
  if (d < 0 || d > 1.2) return [0, 0];
  const k = amp * Math.exp(-decay * d);
  return [Math.sin(d * freq * 1.3 + 1.7) * k, Math.cos(d * freq + 0.3) * k * 0.8];
};

// Псевдослучайное значение по целому числу (для глитчей).
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Плавная кривая по ключевым точкам [время, значение] (кусочно, с easing между ключами).
export const keys = (t: number, k: [number, number][], ease: (x: number) => number = E.inOutCubic) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], ease((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
  }
  return k[k.length - 1][1];
};
export const keys3 = (t: number, k: [number, [number, number, number]][], ease: (x: number) => number = E.inOutCubic) =>
  [0, 1, 2].map((i) => keys(t, k.map(([tt, v]) => [tt, v[i]] as [number, number]), ease)) as [number, number, number];
