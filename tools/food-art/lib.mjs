// Spartans food art: tiny SVG toolkit that imitates the Microsoft Fluent Emoji
// 3D look (soft gradients, puffy inner shading, light from the top left).
// Every icon is a 256x256 SVG built by a function in icons.mjs; build.mjs
// renders them with headless Chrome into assets/food/*.png.

export class Svg {
  constructor(prefix = '') { this.defs = []; this.n = 0; this.pre = prefix; }
  id(p = 'd') { return `${this.pre}${p}${++this.n}`; }

  // Linear gradient. stops = ['#fff', '#000'] or [[0,'#fff'],[1,'#000',0.5]]
  lin(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
    const id = this.id('g');
    this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml(stops)}</linearGradient>`);
    return `url(#${id})`;
  }
  // Radial gradient in bounding-box units.
  rad(stops, cx = 0.35, cy = 0.3, r = 0.8, fx = cx, fy = cy) {
    const id = this.id('r');
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stopsXml(stops)}</radialGradient>`);
    return `url(#${id})`;
  }
  // Inner 3D shading: dark rim bottom-right, light rim top-left.
  puff({ d = 7, blur = 7, dark = '#000', darkOp = 0.28, light = '#fff', lightOp = 0.4 } = {}) {
    const id = this.id('p');
    this.defs.push(`<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>
<feOffset in="b" dx="${-d}" dy="${-d}" result="o1"/><feComposite in="SourceAlpha" in2="o1" operator="out" result="s"/>
<feFlood flood-color="${dark}" flood-opacity="${darkOp}"/><feComposite in2="s" operator="in" result="sc"/>
<feOffset in="b" dx="${d * 0.8}" dy="${d * 0.8}" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="h"/>
<feFlood flood-color="${light}" flood-opacity="${lightOp}"/><feComposite in2="h" operator="in" result="hc"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sc"/><feMergeNode in="hc"/></feMerge></filter>`);
    return `url(#${id})`;
  }
  blur(sd = 4) {
    const id = this.id('b');
    this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
    return `url(#${id})`;
  }
  // Soft contact shadow under a layer (drop shadow only, no graphic).
  drop(dy = 4, sd = 4, op = 0.3, color = '#000') {
    const id = this.id('ds');
    this.defs.push(`<filter id="${id}" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${sd}" flood-color="${color}" flood-opacity="${op}"/></filter>`);
    return `url(#${id})`;
  }
  clip(inner) {
    const id = this.id('c');
    this.defs.push(`<clipPath id="${id}">${inner}</clipPath>`);
    return `url(#${id})`;
  }
  render(body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256" viewBox="0 0 256 256"><defs>${this.defs.join('')}</defs>${body}</svg>`;
  }
}

function stopsXml(stops) {
  return stops.map((s, i) => {
    const [o, c, a = 1] = Array.isArray(s) ? s : [i / (stops.length - 1), s];
    return `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`;
  }).join('');
}

// Colour helpers.
export function shade(hex, amt) {
  // amt > 0 lighter, < 0 darker (-1..1)
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// A soft white specular streak.
export const gloss = (s, x, y, rx, ry, rot = -20, op = 0.55) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${x} ${y})" filter="${s.blur(Math.max(2, Math.min(rx, ry) * 0.45))}"/>`;

// Smooth closed blob through points (Catmull-Rom → cubic Bézier).
export function blob(pts, tension = 1) {
  const n = pts.length; let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}
// Open smooth path through points.
export function spline(pts, tension = 1) {
  const n = pts.length; let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
// Ellipse polygon points (for wobbly shapes).
export function ring(cx, cy, rx, ry, n, wobble = 0, seed = 1, rot = 0) {
  const r = rng(seed); const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
// Deterministic random.
export function rng(seed = 1) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
// Wavy band path (lettuce etc.) between x0..x1 around y, amplitude a.
export function wave(x0, x1, y, a, n, thick, seed = 3) {
  const r = rng(seed); const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    top.push([x, y - (i % 2 ? a : -a * 0.3) * (0.7 + r() * 0.5)]);
    bot.push([x, y + thick + (i % 2 ? a * 0.9 : -a * 0.2) * (0.7 + r() * 0.5)]);
  }
  return spline(top) + spline(bot.reverse()).replace(/^M/, ' L') + 'Z';
}
