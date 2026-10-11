// Brand marks: chip-with-pulse logo (the "PC health" idea) and the Telegram glyph.
export function logoMark(size = 120, id = 'lg') {
  const pins = [];
  for (let i = 0; i < 4; i++) {
    const p = 34 + i * 17.3;
    pins.push(`<rect x="${p}" y="6" width="6" height="16" rx="3"/>`, `<rect x="${p}" y="98" width="6" height="16" rx="3"/>`,
      `<rect x="6" y="${p}" width="16" height="6" rx="3"/>`, `<rect x="98" y="${p}" width="16" height="6" rx="3"/>`);
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22e4d4"/><stop offset="1" stop-color="#2e8bff"/></linearGradient></defs>
    <g fill="url(#${id})">${pins.join('')}</g>
    <rect x="22" y="22" width="76" height="76" rx="16" fill="#0b1016" stroke="url(#${id})" stroke-width="5"/>
    <path d="M30 62 H46 L52 46 L60 78 L67 54 L72 62 H90" fill="none" stroke="#f2f5f7" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
export function logoSVG(width = 560) {
  const s = width / 560;
  return `<div style="display:inline-flex;align-items:center;gap:${26 * s}px">
    ${logoMark(150 * s, 'lg' + Math.round(width))}
    <div style="text-align:left">
      <div style="font-family:Unbounded;font-weight:900;font-size:${74 * s}px;line-height:.95;letter-spacing:-.02em;color:#f2f5f7">PC MASTER</div>
      <div style="font-family:'JetBrains Mono';font-weight:700;font-size:${31 * s}px;letter-spacing:.52em;color:#22e4d4;margin-top:${12 * s}px">WARSZAWA</div>
    </div></div>`;
}
export const TG_ICON = (size = 120) => `<svg width="${size}" height="${size}" viewBox="0 0 240 240" style="flex:none">
  <defs><linearGradient id="tg${size}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#37bbfe"/><stop offset="1" stop-color="#007dbb"/></linearGradient></defs>
  <circle cx="120" cy="120" r="120" fill="url(#tg${size})"/>
  <path d="M54 117l118-46c6-2 11 2 9 10l-20 94c-1 7-6 8-12 5l-31-23-15 14c-2 2-3 3-7 3l2-32 59-53c3-2-1-4-4-2l-73 46-31-10c-7-2-7-7 1-10z" fill="#fff"/></svg>`;
