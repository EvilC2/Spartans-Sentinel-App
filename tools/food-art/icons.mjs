// Spartans food art: one function per icon (file name = key). See lib.mjs.
import { readFileSync } from 'node:fs';
import { Svg, shade, gloss, blob, spline, ring, rng, wave } from './lib.mjs';

// Embed a Fluent Emoji 3D piece from ./fluent (square, w px wide, centred on x,y).
const fl = (name, x, y, w, rot = 0) =>
  `<image href="data:image/png;base64,${readFileSync(new URL(`./fluent/${name}.png`, import.meta.url)).toString('base64')}" x="${x - w / 2}" y="${y - w / 2}" width="${w}" height="${w}" transform="rotate(${rot} ${x} ${y})"/>`;
const plain = (body) => { const s = new Svg(); return s.render(typeof body === 'function' ? body(s) : body); };

// ───────────────────────── Burgers ─────────────────────────
// One template, five builds. The layers themselves tell them apart.
function burger({ patty = 'beef', cheese = false, bacon = false, lettuce = true, tomato = true, onion = false } = {}) {
  const s = new Svg();
  const P = s.puff({ d: 6, blur: 6, dark: '#5A1636', darkOp: 0.3 });
  const Pb = s.puff({ d: 10, blur: 11, dark: '#6A1A2A', darkOp: 0.32, lightOp: 0.45 });
  let g = '';
  // Stack (top to bottom): bun 44-118, lettuce, tomato, onion, cheese, bacon, patty, bun 196-222
  // bottom bun
  g += `<path d="M36,194 Q36,226 70,226 L186,226 Q220,226 220,194 Q220,186 206,186 L50,186 Q36,186 36,194Z" fill="${s.lin(['#FFC47E', '#F29350', '#D06A3A'], 0, 0, 0.2, 1)}" filter="${Pb}"/>`;
  // patty
  const pc = {
    beef: ['#8C5A58', '#6A3D40', '#4C272C'],
    chicken: ['#FFC766', '#F2A03C', '#D0772A'],
    veggie: ['#A4C45A', '#7DA23E', '#5C7F2C'],
  }[patty];
  const top = 150, bot = 194;
  if (patty === 'chicken') {
    const pts = [];
    const r = rng(9);
    for (let i = 0; i <= 16; i++) pts.push([26 + i * 12.75, top - 4 + (r() - 0.5) * 10]);
    pts.push([232, (top + bot) / 2]);
    for (let i = 16; i >= 0; i--) pts.push([26 + i * 12.75, bot + 2 + (r() - 0.5) * 10]);
    pts.push([22, (top + bot) / 2]);
    g += `<path d="${blob(pts, 0.9)}" fill="${s.lin(pc, 0, 0, 0.1, 1)}" filter="${Pb}"/>`;
    const tr = rng(3);
    for (let i = 0; i < 16; i++) { const x = 40 + tr() * 176, y = top + 6 + tr() * 30; g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3 + tr() * 3).toFixed(1)}" ry="2.4" fill="#FFE2A0" opacity=".75"/>`; }
  } else {
    g += `<rect x="28" y="${top}" width="200" height="${bot - top}" rx="22" fill="${s.lin(pc, 0, 0, 0.1, 1)}" filter="${Pb}"/>`;
    const tr = rng(patty === 'veggie' ? 5 : 11);
    for (let i = 0; i < (patty === 'veggie' ? 18 : 10); i++) {
      const x = 46 + tr() * 164, y = top + 10 + tr() * 24;
      if (patty === 'veggie') g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${['#FFD84A', '#E8584A', '#4FA83A'][i % 3]}"/>`;
      else g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(4 + tr() * 4).toFixed(1)}" ry="2" fill="#3A1C22" opacity=".35"/>`;
    }
    g += gloss(s, 80, top + 10, 30, 4, 0, 0.35);
  }
  if (bacon) {
    for (const [x, y, rot] of [[14, top - 2, -10], [132, top - 6, 8]]) {
      g += `<g transform="rotate(${rot} ${x + 56} ${y + 8})"><path d="M${x},${y} q14,-10 28,0 t28,0 t28,0 t28,0 l0,18 q-14,-10 -28,0 t-28,0 t-28,0 t-28,0 z" fill="${s.lin(['#F2706A', '#C7394A'])}" filter="${P}"/>
<path d="M${x + 2},${y + 8} q13,-10 27,0 t28,0 t28,0 t27,0" fill="none" stroke="#FFD6C4" stroke-width="4" stroke-linecap="round"/></g>`;
    }
  }
  if (cheese) {
    const cy = top - 6;
    g += `<path d="M30,${cy} L226,${cy} Q230,${cy} 228,${cy + 8} L206,${cy + 34} Q202,${cy + 40} 198,${cy + 34} L184,${cy + 14} L142,${cy + 14} L126,${cy + 42} Q122,${cy + 48} 118,${cy + 42} L102,${cy + 14} L66,${cy + 14} L54,${cy + 32} Q50,${cy + 38} 46,${cy + 32} L28,${cy + 8} Q26,${cy} 30,${cy}Z"
      fill="${s.lin(['#FFE68A', '#FFCB2E', '#F7A51C'], 0, 0, 0.1, 1)}" filter="${P}"/>`;
  }
  let ly = cheese ? top - 20 : top - 14;
  if (onion) { g += `<rect x="46" y="${ly - 2}" width="164" height="12" rx="6" fill="${s.lin(['#E6A7E0', '#B560B0'])}" filter="${P}"/>`; ly -= 8; }
  if (tomato) { g += `<rect x="40" y="${ly - 6}" width="176" height="16" rx="8" fill="${s.lin(['#FF7A7A', '#E8364E'])}" filter="${P}"/>`; ly -= 12; }
  if (lettuce) g += `<path d="${wave(24, 232, ly - 4, 6, 10, 14, 5)}" fill="${s.lin(['#A6E36A', '#5DBB3F', '#3E9A34'])}" filter="${P}"/>`;
  // top bun
  const bb = ly - 2;
  g += `<path d="M30,${bb - 6} C28,64 76,40 128,40 C180,40 228,64 226,${bb - 6} Q226,${bb + 4} 212,${bb + 4} L44,${bb + 4} Q30,${bb + 4} 30,${bb - 6}Z"
    fill="${s.rad(['#FFD08A', '#F7A45A', '#E0743E'], 0.38, 0.22, 0.9)}" filter="${Pb}"/>`;
  g += gloss(s, 92, 66, 36, 12, -14, 0.7);
  const sr = rng(4);
  for (const [x, y] of [[100, 58], [134, 52], [166, 62], [80, 80], [116, 70], [150, 70], [186, 78], [98, 96], [134, 92], [170, 98], [62, 98], [202, 100]]) {
    if (y > bb - 14) continue;
    const rot = (sr() - 0.5) * 70;
    g += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="3.2" fill="#FFF6E2" transform="rotate(${rot} ${x} ${y})"/>`;
  }
  return s.render(g);
}

// ───────────────────────── Chip bags ─────────────────────────
function bagShape(x0 = 50, x1 = 206, y0 = 26, y1 = 230) {
  // Pillow bag with flat crimped seals at top and bottom.
  const bulge = 10;
  return {
    body: `M${x0 + 4},${y0 + 16} Q${(x0 + x1) / 2},${y0 + 22} ${x1 - 4},${y0 + 16} Q${x1 + bulge},${(y0 + y1) / 2} ${x1 - 4},${y1 - 16} Q${(x0 + x1) / 2},${y1 - 10} ${x0 + 4},${y1 - 16} Q${x0 - bulge},${(y0 + y1) / 2} ${x0 + 4},${y0 + 16}Z`,
    top: `M${x0 + 2},${y0} L${x1 - 2},${y0} L${x1 - 4},${y0 + 18} Q${(x0 + x1) / 2},${y0 + 24} ${x0 + 4},${y0 + 18}Z`,
    bot: `M${x0 + 4},${y1 - 18} Q${(x0 + x1) / 2},${y1 - 12} ${x1 - 4},${y1 - 18} L${x1 - 2},${y1} L${x0 + 2},${y1}Z`,
    x0, x1, y0, y1,
  };
}
function crimp(x0, x1, y, h, col) {
  let d = '';
  for (let x = x0 + 8; x < x1 - 4; x += 7) d += `M${x},${y + 3} l0,${h - 6} `;
  return `<path d="${d}" stroke="${col}" stroke-width="1.6" opacity=".35"/>`;
}
function chipBag(s, { color, seal = shade(color, -0.12) }, content, tilt = -7) {
  const b = bagShape();
  const P = s.puff({ d: 10, blur: 12, darkOp: 0.35, lightOp: 0.35 });
  const Ps = s.puff({ d: 4, blur: 4, darkOp: 0.25 });
  const clip = s.clip(`<path d="${b.body}"/>`);
  let g = `<g transform="rotate(${tilt} 128 128)">`;
  g += `<path d="${b.body}" fill="${s.lin([shade(color, 0.22), color, shade(color, -0.3)], 0, 0, 1, 1)}" filter="${P}"/>`;
  g += `<g clip-path="${clip}">${content}</g>`;
  // folds + shine
  g += `<g clip-path="${clip}">${gloss(s, 78, 128, 10, 80, 0, 0.45)}${gloss(s, 186, 70, 6, 26, 0, 0.35)}
    <path d="M${b.x0 + 12},${b.y0 + 30} Q128,${b.y0 + 40} ${b.x1 - 12},${b.y0 + 30}" stroke="#fff" stroke-width="3" fill="none" opacity=".25" filter="${s.blur(1.5)}"/></g>`;
  g += `<path d="${b.top}" fill="${s.lin([shade(seal, 0.2), seal])}" filter="${Ps}"/>${crimp(b.x0, b.x1, b.y0, 18, '#000')}`;
  g += `<path d="${b.bot}" fill="${s.lin([seal, shade(seal, -0.2)])}" filter="${Ps}"/>${crimp(b.x0, b.x1, b.y1 - 18, 18, '#000')}`;
  return g + '</g>';
}
// Chip shapes
function potatoChip(s, x, y, r, rot, col = '#F6CF6A', seed = 1) {
  // thin, wavy, slightly curled crisp
  const P = s.puff({ d: 3, blur: 3, darkOp: 0.28, dark: '#8a4b00', lightOp: 0.5 });
  const pts = ring(x, y, r, r * 0.66, 12, 0.07, seed, rot);
  const deg = (rot * 57.3) % 180;
  return `<path d="${blob(pts)}" fill="${s.lin([shade(col, 0.45), col, shade(col, -0.12)], 0, 0, 1, 1)}" filter="${P}"/>
<g transform="rotate(${deg.toFixed(0)} ${x} ${y})"><path d="M${x - r * 0.75},${y + r * 0.05} q${r * 0.4},${-r * 0.5} ${r * 0.8},${-r * 0.1} t${r * 0.6},${-r * 0.05}" stroke="#fff" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>
<path d="M${x - r * 0.6},${y + r * 0.35} q${r * 0.6},${-r * 0.25} ${r * 1.2},${r * 0.05}" stroke="${shade(col, -0.3)}" stroke-width="1.8" fill="none" opacity=".35" stroke-linecap="round"/></g>
<circle cx="${x - r * 0.2}" cy="${y + r * 0.1}" r="1.3" fill="${shade(col, -0.35)}" opacity=".5"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.15}" r="1.1" fill="${shade(col, -0.35)}" opacity=".5"/>`;
}
function tortillaChip(s, x, y, size, rot, col = '#F59A2B') {
  const P = s.puff({ d: 3, blur: 3, darkOp: 0.3, dark: '#6b2a00' });
  const h = size * 0.9;
  const d = `M${x},${y - h * 0.6} Q${x + size * 0.18},${y - h * 0.05} ${x + size * 0.55},${y + h * 0.4} Q${x},${y + h * 0.52} ${x - size * 0.55},${y + h * 0.4} Q${x - size * 0.18},${y - h * 0.05} ${x},${y - h * 0.6}Z`;
  const r = rng(Math.round(x * 3 + y));
  let dots = '';
  for (let i = 0; i < 7; i++) dots += `<circle cx="${(x + (r() - 0.5) * size * 0.6).toFixed(1)}" cy="${(y + (r() - 0.2) * h * 0.4).toFixed(1)}" r="1.6" fill="#D2451A" opacity=".7"/>`;
  return `<g transform="rotate(${rot} ${x} ${y})"><path d="${d}" fill="${s.lin([shade(col, 0.25), col, shade(col, -0.15)], 0, 0, 0.6, 1)}" stroke="${shade(col, -0.1)}" stroke-width="1.5" stroke-linejoin="round" filter="${P}"/>${dots}</g>`;
}
const txt = (x, y, str, size, fill, { font = 'Arial Black', weight = 900, style = 'normal', stroke, sw = 3, rot = 0, ls = 0, anchor = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${font}" font-weight="${weight}" font-style="${style}" font-size="${size}" letter-spacing="${ls}" text-anchor="${anchor}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round"` : ''} transform="rotate(${rot} ${x} ${y})">${str}</text>`;

function laysLogo(s, x, y) {
  return `<circle cx="${x}" cy="${y}" r="30" fill="${s.rad(['#FFF08A', '#FFD21F', '#F2A900'], 0.4, 0.35, 0.8)}" filter="${s.puff({ d: 3, blur: 3 })}"/>
<path d="M${x - 44},${y - 10} L${x + 44},${y - 14} L${x + 46},${y + 10} L${x - 42},${y + 14}Z" fill="${s.lin(['#F2413A', '#C3161C'])}" filter="${s.puff({ d: 3, blur: 3 })}"/>
${txt(x, y + 8, "Lay's", 21, '#fff', { font: 'Arial Rounded MT Bold', weight: 700, rot: -3 })}`;
}

function kettleChip(s, x, y, r, rot, seed) { return potatoChip(s, x, y, r, rot, '#E9B04E', seed); }
function missVickies(s, color, extra = '') {
  // cream top panel with a lace edge, script logo, coloured lower field with kettle chips
  const c = `<path d="M30,20 H226 V108 ${(() => { let d = ''; for (let x = 216; x >= 40; x -= 11) d += ` Q${x - 5.5},122 ${x - 11},108`; return d; })()} H30 Z" fill="${s.lin(['#FFFBEF', '#F3E6C8'])}"/>
<path d="M30,108 ${(() => { let d = ''; for (let x = 30; x < 226; x += 11) d += ` Q${x + 5.5},122 ${x + 11},108`; return d; })()}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="2 3" opacity=".9"/>
${txt(128, 78, "Miss Vickie's", 25, shade(color, -0.35), { font: 'Snell Roundhand', weight: 900, rot: -4 })}
${txt(128, 98, 'KETTLE COOKED', 9, shade(color, -0.2), { font: 'Arial', weight: 700, ls: 1 })}
${kettleChip(s, 96, 176, 30, 0.5, 5)}${kettleChip(s, 158, 180, 30, 1.7, 6)}${kettleChip(s, 128, 156, 28, 2.5, 7)}${extra}`;
  return s.render(chipBag(s, { color }, c));
}
function puffCurl(s, x, y, rot, len = 40) {
  // curved cheese puff as a filled banana shape
  const w = 8, h = len / 2;
  const d = `M${x - h},${y} Q${x},${y - len * 0.5 - w} ${x + h},${y} Q${x + h + w * 0.6},${y + w * 1.2} ${x + h - w * 0.4},${y + w * 1.4} Q${x},${y - len * 0.5 + w * 1.6} ${x - h + w * 0.4},${y + w * 1.4} Q${x - h - w * 0.6},${y + w * 1.2} ${x - h},${y}Z`;
  return `<path d="${d}" transform="rotate(${rot} ${x} ${y})" fill="${s.lin(['#FFC25A', '#F58A1A', '#D96A0A'])}" filter="${s.puff({ d: 3, blur: 3, dark: '#7a2a00', lightOp: 0.5 })}"/>`;
}
function popcorn(s, x, y, r, seed) {
  const pts = ring(x, y, r, r * 0.85, 7, 0.28, seed);
  return `<path d="${blob(pts)}" fill="${s.rad(['#FFFFFF', '#FFF6D8', '#F2D98E'], 0.35, 0.3, 0.9)}" filter="${s.puff({ d: 3, blur: 3, dark: '#8a6a10', darkOp: 0.35 })}"/>`;
}
function stick(s, x, y, len, rot) {
  return `<rect x="${x - len / 2}" y="${y - 3.5}" width="${len}" height="7" rx="3.5" transform="rotate(${rot} ${x} ${y})" fill="${s.lin(['#F2A24A', '#B8561C'])}"/>`;
}
function ridgedChip(s, x, y, w, rot) {
  let d = `M${x - w / 2},${y - w * 0.35}`;
  for (let i = 0; i < 4; i++) d += ` q${w / 8},-6 ${w / 4},0`;
  d += ` l0,${w * 0.7}`;
  for (let i = 0; i < 4; i++) d += ` q${-w / 8},6 ${-w / 4},0`;
  d += 'Z';
  let ridges = '';
  for (let i = 1; i < 6; i++) ridges += `<path d="M${x - w / 2 + (w / 6) * i},${y - w * 0.3} l0,${w * 0.6}" stroke="#B87A2A" stroke-width="1.6" opacity=".45"/>`;
  return `<g transform="rotate(${rot} ${x} ${y})"><path d="${d}" fill="${s.lin(['#F6D089', '#E1A24B'])}" filter="${s.puff({ d: 3, blur: 3, dark: '#6b3a00' })}"/>${ridges}</g>`;
}


// ───────────────────────── Sandwiches ─────────────────────────
// Triangle half seen from the front: bread top face + a side face showing the layers.
// layers: bottom-to-top list of { c: [light, dark], t: thickness, kind?: 'lettuce'|'cheese'|'bumpy', dots?: color }
function sandwich(layers, { toast = false, marks = false } = {}) {
  const s = new Svg();
  const P = s.puff({ d: 5, blur: 5, dark: '#5A2A10', darkOp: 0.28 });
  const Pb = s.puff({ d: 9, blur: 10, dark: '#6A3A10', darkOp: 0.3, lightOp: 0.5 });
  const breadT = 15;
  const all = [{ c: toast ? ['#FFE0A0', '#F2B25A'] : ['#FFF7E2', '#F4DDB0'], t: breadT, bread: true }, ...layers, { c: toast ? ['#FFE0A0', '#F2B25A'] : ['#FFF7E2', '#F4DDB0'], t: breadT, bread: true }];
  const H = all.reduce((a, l) => a + l.t, 0);
  const A = [24, 214 - H], B = [230, 226 - H], C = [118, 214 - H - 74];
  let g = '';
  let y = H; // offset below AB line, drawing bottom-up
  const band = (y0, y1, over) => `M${A[0] - over},${A[1] + y0} L${B[0] + over},${B[1] + y0} L${B[0] + over},${B[1] + y1} L${A[0] - over},${A[1] + y1}Z`;
  for (let i = 0; i < all.length; i++) {
    const L = all[i]; const y1 = y, y0 = y - L.t; y = y0;
    const over = L.bread ? 0 : (L.over ?? 5);
    const fill = s.lin(L.c, 0, 0, 0, 1);
    if (L.kind === 'lettuce') {
      g += `<path d="M${A[0] - 12},${A[1] + y0 + 4} ${(() => { let d = ''; const n = 9; for (let k = 1; k <= n; k++) { const x = A[0] - 12 + (B[0] - A[0] + 24) * k / n, yy = A[1] + (B[1] - A[1]) * k / n + y0 + 4; d += ` Q${x - 11},${yy - 10} ${x},${yy}`; } return d; })()} L${B[0] + 10},${B[1] + y1 + 6} ${(() => { let d = ''; const n = 9; for (let k = n - 1; k >= 0; k--) { const x = A[0] - 12 + (B[0] - A[0] + 24) * k / n, yy = A[1] + (B[1] - A[1]) * k / n + y1 + 2; d += ` Q${x + 11},${yy + 9} ${x},${yy}`; } return d; })()}Z" fill="${fill}" filter="${P}"/>`;
    } else if (L.kind === 'cheese') {
      const drips = [[0.18, 18], [0.5, 26], [0.8, 16]];
      let d = `M${A[0] - over},${A[1] + y0} L${B[0] + over},${B[1] + y0} L${B[0] + over},${B[1] + y1}`;
      for (const [f, dl] of [...drips].reverse()) {
        const x = A[0] + (B[0] - A[0]) * f, yy = A[1] + (B[1] - A[1]) * f + y1;
        d += ` L${x + 9},${yy} Q${x + 7},${yy + dl} ${x},${yy + dl} Q${x - 7},${yy + dl} ${x - 9},${yy}`;
      }
      d += ` L${A[0] - over},${A[1] + y1}Z`;
      g += `<path d="${d}" fill="${fill}" filter="${P}"/>`;
    } else {
      g += `<path d="${band(y0, y1, over)}" fill="${fill}" filter="${P}"${L.bread ? '' : ` stroke-linejoin="round"`}/>`;
      if (L.bread) g += `<path d="M${A[0]},${A[1] + (i === 0 ? y1 : y0)} L${B[0]},${B[1] + (i === 0 ? y1 : y0)}" stroke="${toast ? '#B8641E' : '#D39A4E'}" stroke-width="5" stroke-linecap="round"/>`;
    }
    if (L.dots) {
      const r = rng(i * 13 + 5);
      for (let k = 0; k < (L.nd ?? 14); k++) {
        const f = 0.05 + r() * 0.9, x = A[0] + (B[0] - A[0]) * f, yy = A[1] + (B[1] - A[1]) * f + y0 + 3 + r() * (L.t - 6);
        g += `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${(L.dr ?? 2.4)}" fill="${Array.isArray(L.dots) ? L.dots[k % L.dots.length] : L.dots}"/>`;
      }
    }
  }
  // top face with crust
  const top = `M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]}Z`;
  g += `<path d="${top}" fill="${toast ? s.lin(['#F9C56E', '#E8963E'], 0, 0, 1, 1) : s.lin(['#FFF4DA', '#F6DDB0'], 0, 0, 1, 1)}" stroke="${toast ? '#B8641E' : '#D9954A'}" stroke-width="12" stroke-linejoin="round" filter="${Pb}"/>`;
  if (marks) for (let k = 0; k < 4; k++) g += `<path d="M${66 + k * 34},${A[1] - 4 + k * 2} L${96 + k * 22},${C[1] + 26 + k * 4}" stroke="#9A4E14" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
  g += gloss(s, 104, A[1] - 24, 28, 8, -25, 0.55);
  return s.render(g);
}
const LET = { c: ['#A6E36A', '#4FAE3A'], t: 16, kind: 'lettuce' };
const TOM = { c: ['#FF7A7A', '#E0364A'], t: 16 };
const HAM = { c: ['#FFB0B8', '#F07A8C'], t: 20 };
const TURKEY = { c: ['#F7E6D0', '#E2BE98'], t: 18 };
const CHEESE = { c: ['#FFE27A', '#FFBE1E'], t: 14, kind: 'cheese' };
const BACON = { c: ['#F2706A', '#B8303E'], t: 15, dots: '#FFD2BE', nd: 14, dr: 3 };

// ───────────────────────── Wraps ─────────────────────────
// Two halves standing up, cut faces showing the filling. foil = breakfast wraps.
function wrap(fill, { foil = false, grill = false } = {}) {
  const s = new Svg();
  const Pb = s.puff({ d: 9, blur: 10, dark: '#6A3A10', darkOp: 0.28, lightOp: 0.45 });
  const P = s.puff({ d: 3, blur: 3, dark: '#3a1a00', darkOp: 0.25 });
  let g = '';
  const half = (cx, cy, h, rot, seed) => {
    const rx = 44, ry = 30;
    let o = `<g transform="rotate(${rot} ${cx} ${cy + h / 2})">`;
    // body
    o += `<path d="M${cx - rx},${cy} L${cx - rx},${cy + h} A${rx},${ry * 0.7} 0 0 0 ${cx + rx},${cy + h} L${cx + rx},${cy}Z" fill="${s.lin(['#E9C07A', '#F8E2B0', '#F2D092', '#C98E48'], 0, 0, 1, 0)}" filter="${Pb}"/>`;
    const r = rng(seed);
    for (let k = 0; k < 9; k++) o += `<ellipse cx="${(cx - rx + 10 + r() * (rx * 2 - 20)).toFixed(1)}" cy="${(cy + 14 + r() * (h - 10)).toFixed(1)}" rx="${(3 + r() * 4).toFixed(1)}" ry="2.2" fill="#B87434" opacity="${grill ? 0.7 : 0.4}"/>`;
    if (foil) {
      const fy = cy + h * 0.42;
      let crinkle = `M${cx - rx - 3},${fy}`;
      for (let k = 1; k <= 8; k++) crinkle += ` L${cx - rx - 3 + (rx * 2 + 6) * k / 8},${fy + (k % 2 ? -7 : 3)}`;
      o += `<path d="${crinkle} L${cx + rx + 3},${cy + h} A${rx + 3},${ry * 0.72} 0 0 1 ${cx - rx - 3},${cy + h}Z" fill="${s.lin(['#9AA3AD', '#F4F7FA', '#C9D0D8', '#EEF2F6', '#8C95A0'], 0, 0, 1, 0)}" filter="${P}"/>`;
      for (let k = 0; k < 5; k++) o += `<path d="M${cx - rx + 10 + k * 17},${fy + 8} l${6 - k * 2},${h * 0.5}" stroke="#fff" stroke-width="2" opacity=".6"/>`;
    }
    // cut face
    o += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.lin(['#FFF4D8', '#EFCF96'])}"/>`;
    o += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 7}" ry="${ry - 6}" fill="${fill.base}"/>`;
    const clip = s.clip(`<ellipse cx="${cx}" cy="${cy}" rx="${rx - 7}" ry="${ry - 6}"/>`);
    o += `<g clip-path="${clip}">`;
    const r2 = rng(seed + 3);
    for (let k = 0; k < fill.bits.length * 4; k++) {
      const [col, sz] = fill.bits[k % fill.bits.length];
      const x = cx - rx + 8 + r2() * (rx * 2 - 16), y = cy - ry + 6 + r2() * (ry * 2 - 12);
      o += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${sz}" ry="${(sz * 0.75).toFixed(1)}" fill="${col}" transform="rotate(${(r2() * 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" filter="${P}"/>`;
    }
    // spiral hint of tortilla inside
    o += `<path d="M${cx - 14},${cy + 4} q10,-16 26,-6" stroke="#FFF1CF" stroke-width="4" fill="none" opacity=".85"/></g>`;
    o += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 7}" ry="${ry - 6}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="3"/>`;
    return o + '</g>';
  };
  g += half(92, 86, 118, -10, 3);
  g += half(166, 110, 104, 9, 7);
  return s.render(g);
}
const EGG = ['#FFD84A', 11], SAUS = ['#9A5A3A', 9], BAC = ['#E0584A', 8], CHS = ['#FFB72E', 7], LETb = ['#6CC444', 9], CHK = ['#F2DDB8', 10], BUFF = ['#F07A2A', 10], PARM = ['#FFFFFF', 4], RANCH = ['#FFFFFF', 6];

// ───────────────────────── Quesadilla ─────────────────────────
function quesadilla(chicken = false) {
  const s = new Svg();
  const Pb = s.puff({ d: 8, blur: 9, dark: '#6A3A10', darkOp: 0.3, lightOp: 0.45 });
  const P = s.puff({ d: 3, blur: 3, dark: '#6a3a00', darkOp: 0.25 });
  let g = '';
  const wedge = (x, y, rot, seed) => {
    let o = `<g transform="rotate(${rot} ${x} ${y})">`;
    // cheese ooze along the cut edge
    o += `<path d="M${x - 70},${y + 26} Q${x - 40},${y + 44} ${x - 10},${y + 32} Q${x + 20},${y + 48} ${x + 50},${y + 30} Q${x + 72},${y + 40} ${x + 76},${y + 22} L${x + 70},${y + 12} L${x - 66},${y + 14}Z" fill="${s.lin(['#FFE680', '#FFB820'])}" filter="${P}"/>`;
    if (chicken) {
      const r = rng(seed);
      for (let k = 0; k < 6; k++) { const bx = x - 60 + k * 22 + r() * 6, by = y + 22 + r() * 8; o += `<rect x="${bx}" y="${by}" width="${16 + r() * 6}" height="13" rx="5" fill="${k % 3 === 2 ? '#5CB84A' : '#F4E0C0'}" filter="${P}"/>`; }
    }
    // tortilla wedge (half-moon slice seen from above-front)
    o += `<path d="M${x - 74},${y + 18} Q${x - 30},${y - 70} ${x + 4},${y - 74} Q${x + 44},${y - 64} ${x + 78},${y + 16} Q${x},${y + 30} ${x - 74},${y + 18}Z" fill="${s.rad(['#FFE2A6', '#F4C06A', '#DD9440'], 0.4, 0.35, 0.8)}" filter="${Pb}"/>`;
    const r = rng(seed + 9);
    for (let k = 0; k < 12; k++) o += `<ellipse cx="${(x - 50 + r() * 100).toFixed(1)}" cy="${(y - 40 + r() * 52).toFixed(1)}" rx="${(4 + r() * 5).toFixed(1)}" ry="${(3 + r() * 2).toFixed(1)}" fill="#B8702E" opacity=".45"/>`;
    for (let k = 0; k < 3; k++) o += `<path d="M${x - 44 + k * 32},${y + 6} L${x - 16 + k * 28},${y - 50}" stroke="#A0581E" stroke-width="5" stroke-linecap="round" opacity=".45"/>`;
    return o + '</g>';
  };
  g += wedge(104, 150, -8, 2);
  g += wedge(150, 176, 6, 5);
  g += gloss(s, 116, 100, 26, 8, -20, 0.5);
  return s.render(g);
}

// ───────────────────────── Breakfast sandwich (English muffin) ─────────────────────────
function breakfastSandwich() {
  const s = new Svg();
  const Pb = s.puff({ d: 9, blur: 10, dark: '#6A3A10', darkOp: 0.28, lightOp: 0.5 });
  const P = s.puff({ d: 5, blur: 5, dark: '#6A3A10', darkOp: 0.25 });
  let g = '';
  const muffin = (y, h, dome) => {
    let o = `<path d="M44,${y} Q44,${y - dome} 128,${y - dome - 6} Q212,${y - dome} 212,${y} L212,${y + h} Q212,${y + h + 12} 128,${y + h + 14} Q44,${y + h + 12} 44,${y + h}Z" fill="${s.lin(['#FFF0D2', '#F2D5A0', '#D8A86A'])}" filter="${Pb}"/>`;
    const r = rng(y);
    for (let k = 0; k < 26; k++) o += `<circle cx="${(56 + r() * 144).toFixed(1)}" cy="${(y - dome * 0.6 + r() * (h + dome * 0.6)).toFixed(1)}" r="1.6" fill="#E8C088"/>`;
    return o;
  };
  g += muffin(178, 26, 6);
  // egg
  g += `<path d="M34,168 Q30,150 60,146 L196,146 Q226,150 222,168 Q224,184 196,186 L60,186 Q30,184 34,168Z" fill="${s.lin(['#FFFFFF', '#F2EEE6'])}" filter="${P}"/>`;
  g += `<rect x="54" y="150" width="148" height="30" rx="15" fill="${s.lin(['#FFE066', '#FFB81E'])}" filter="${P}"/>`;
  // cheese corners
  g += `<path d="M40,142 L216,142 L204,168 L190,150 L66,150 L52,170Z" fill="${s.lin(['#FFD85A', '#F8A41A'])}" filter="${P}"/>`;
  // top muffin
  g += `<path d="M42,138 Q40,86 128,80 Q216,86 214,138 Q214,148 128,150 Q42,148 42,138Z" fill="${s.rad(['#FFF4DE', '#F4D6A0', '#D29A5A'], 0.4, 0.3, 0.85)}" filter="${Pb}"/>`;
  const r = rng(21);
  for (let k = 0; k < 34; k++) g += `<circle cx="${(62 + r() * 132).toFixed(1)}" cy="${(90 + r() * 50).toFixed(1)}" r="1.8" fill="#E6BA80"/>`;
  g += gloss(s, 100, 98, 30, 9, -12, 0.55);
  return s.render(g);
}


// ───────────────────────── Bakery ─────────────────────────
function box3d(s, { x, y, w, d, h, top, front, side, dx = 0.55, dy = 0.42 }) {
  // simple 3/4 box: top face parallelogram, front face, right face
  const ox = d * dx, oy = d * dy;
  const T = `M${x},${y} L${x + w},${y} L${x + w + ox},${y - oy} L${x + ox},${y - oy}Z`;
  const F = `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h}Z`;
  const R = `M${x + w},${y} L${x + w + ox},${y - oy} L${x + w + ox},${y + h - oy} L${x + w},${y + h}Z`;
  const P = s.puff({ d: 6, blur: 7, darkOp: 0.25, lightOp: 0.35 });
  return { T, F, R, svg: `<path d="${R}" fill="${side}" filter="${P}"/><path d="${F}" fill="${front}" filter="${P}"/><path d="${T}" fill="${top}" filter="${P}"/>` };
}
function muffin() {
  const s = new Svg();
  let g = '';
  const cup = `M60,150 L196,150 L182,224 Q128,232 74,224Z`;
  g += `<path d="${cup}" fill="${s.lin(['#E9EEF7', '#FFFFFF', '#D6DDEA', '#FFFFFF', '#C8D0DE'], 0, 0, 1, 0)}" filter="${s.puff({ d: 6, blur: 6, darkOp: 0.2 })}"/>`;
  for (let k = 0; k < 11; k++) { const t = k / 10; g += `<path d="M${64 + t * 128},152 L${77 + t * 102},224" stroke="#9FB0CC" stroke-width="2" opacity=".6"/>`; }
  const top = blob(ring(128, 118, 96, 62, 16, 0.07, 4));
  g += `<path d="${top}" fill="${s.rad(['#F7C27A', '#E0924A', '#B8642A'], 0.35, 0.3, 0.8)}" filter="${s.puff({ d: 10, blur: 11, dark: '#5a2a00', darkOp: 0.3, lightOp: 0.45 })}"/>`;
  const r = rng(7);
  for (let k = 0; k < 14; k++) { const x = 56 + r() * 144, y = 78 + r() * 76; g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(6 + r() * 3).toFixed(1)}" fill="${s.rad(['#8A7AD8', '#4A3A9A', '#2A1E60'], 0.35, 0.3, 0.8)}"/><circle cx="${(x - 2).toFixed(1)}" cy="${(y - 2).toFixed(1)}" r="1.6" fill="#fff" opacity=".7"/>`; }
  for (let k = 0; k < 20; k++) g += `<rect x="${(56 + r() * 144).toFixed(1)}" y="${(70 + r() * 70).toFixed(1)}" width="3" height="3" fill="#FFF6E0" opacity=".85" transform="rotate(45)"/>`;
  g += gloss(s, 96, 84, 30, 10, -18, 0.5);
  return s.render(g);
}
function scone() {
  const s = new Svg();
  const Pb = s.puff({ d: 9, blur: 10, dark: '#6a3000', darkOp: 0.3, lightOp: 0.5 });
  let g = '';
  // wedge: front face then top face
  g += `<path d="M34,168 Q30,208 60,210 L200,222 Q228,222 226,190 L224,176 Z" fill="${s.lin(['#F9D9A0', '#E8B066'])}" filter="${Pb}"/>`;
  g += `<path d="${blob([[40, 170], [120, 60], [150, 52], [226, 176], [210, 194], [130, 186], [50, 184]], 0.6)}" fill="${s.rad(['#FBD08A', '#E9A14E', '#C8742E'], 0.45, 0.35, 0.85)}" filter="${Pb}"/>`;
  const r = rng(3);
  for (let k = 0; k < 9; k++) { const x = 80 + r() * 110, y = 100 + r() * 70; g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6" ry="4.5" fill="${s.rad(['#E8566A', '#9A1A30'])}"/>`; }
  for (let k = 0; k < 40; k++) g += `<rect x="${(70 + r() * 130).toFixed(1)}" y="${(80 + r() * 96).toFixed(1)}" width="3.2" height="3.2" fill="#FFFFFF" opacity=".9"/>`;
  g += gloss(s, 118, 96, 24, 8, -40, 0.5);
  return s.render(g);
}
function fritter() {
  const s = new Svg();
  let g = '';
  const body = blob(ring(128, 134, 104, 80, 14, 0.14, 11));
  g += `<path d="${body}" fill="${s.rad(['#F4B868', '#D2843A', '#9E5420'], 0.4, 0.35, 0.85)}" filter="${s.puff({ d: 10, blur: 11, dark: '#4a2000', darkOp: 0.32, lightOp: 0.4 })}"/>`;
  const r = rng(5);
  for (let k = 0; k < 7; k++) { const x = 60 + r() * 136, y = 84 + r() * 100; g += `<path d="${blob(ring(x, y, 20 + r() * 12, 12 + r() * 8, 8, 0.2, k + 2))}" fill="${s.lin(['#C06A2A', '#8A4418'])}" opacity=".55"/>`; }
  for (let k = 0; k < 8; k++) { const x = 64 + r() * 128, y = 88 + r() * 90; g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="13" height="11" rx="3" fill="${s.lin(['#FFF6C8', '#F2D680'])}" transform="rotate(${(r() * 60).toFixed(0)} ${x} ${y})" filter="${s.puff({ d: 2, blur: 2, darkOp: 0.2 })}"/>`; }
  // glaze
  g += `<path d="${blob(ring(124, 128, 90, 64, 12, 0.18, 21))}" fill="#FFFFFF" opacity=".28"/>`;
  g += gloss(s, 90, 96, 34, 11, -20, 0.6) + gloss(s, 160, 150, 20, 6, -20, 0.4);
  return s.render(g);
}
function cinnamonBun() {
  const s = new Svg();
  let g = '';
  const Pb = s.puff({ d: 9, blur: 10, dark: '#5a2600', darkOp: 0.3, lightOp: 0.4 });
  g += `<path d="M28,120 L28,168 Q28,222 128,224 Q228,222 228,168 L228,120Z" fill="${s.lin(['#F2B46A', '#D9883E', '#B8662A'])}" filter="${Pb}"/>`;
  for (let k = 0; k < 4; k++) g += `<path d="M${40 + k * 50},136 q10,40 -2,82" stroke="#9A4E1E" stroke-width="4" fill="none" opacity=".5"/>`;
  g += `<ellipse cx="128" cy="120" rx="100" ry="58" fill="${s.rad(['#F8C888', '#E49A50', '#C8763A'], 0.45, 0.4, 0.8)}" filter="${Pb}"/>`;
  // spiral
  let d = 'M128,120'; let a = 0, rr = 4;
  while (rr < 90) { a += 0.35; rr += 2.3; d += ` L${(128 + Math.cos(a) * rr).toFixed(1)},${(120 + Math.sin(a) * rr * 0.58).toFixed(1)}`; }
  g += `<path d="${d}" stroke="#8A3E14" stroke-width="7" fill="none" stroke-linecap="round" opacity=".75"/>`;
  // icing
  g += `<path d="M52,98 q20,-22 40,0 t40,0 t40,0 t30,-6 M60,130 q20,-18 40,0 t40,0 t40,0 t20,-4" stroke="#FFFFFF" stroke-width="9" fill="none" stroke-linecap="round" filter="${s.puff({ d: 2, blur: 2, darkOp: 0.2 })}"/>`;
  g += gloss(s, 90, 90, 26, 8, -14, 0.45);
  return s.render(g);
}
function brownie() {
  const s = new Svg();
  const b = box3d(s, { x: 34, y: 116, w: 150, d: 90, h: 76, top: s.lin(['#8A5040', '#5E3024'], 0, 0, 1, 1), front: s.lin(['#5A2E20', '#3E1C12']), side: s.lin(['#4A2418', '#301208']) });
  let g = b.svg;
  const r = rng(6);
  for (let k = 0; k < 9; k++) { const x = 50 + r() * 150, y = 84 + r() * 26; g += `<path d="M${x},${y} l${10 + r() * 14},${(r() - 0.5) * 8} l${8 + r() * 10},${(r() - 0.5) * 8}" stroke="#B07A64" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>`; }
  for (let k = 0; k < 18; k++) g += `<circle cx="${(44 + r() * 132).toFixed(1)}" cy="${(126 + r() * 60).toFixed(1)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="#2A0E06" opacity=".6"/>`;
  g += gloss(s, 100, 96, 40, 7, -8, 0.4);
  return s.render(g);
}
function riceCrispy() {
  const s = new Svg();
  const b = box3d(s, { x: 30, y: 116, w: 156, d: 96, h: 74, top: s.lin(['#FFF3D2', '#F2DAA2'], 0, 0, 1, 1), front: s.lin(['#F4DDAA', '#E2C184']), side: s.lin(['#E6C88E', '#CFA86A']) });
  let g = b.svg;
  const r = rng(9);
  const dot = (x, y) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3.4 + r() * 1.6).toFixed(1)}" ry="${(2.4 + r()).toFixed(1)}" fill="${r() > 0.5 ? '#FFFBEE' : '#D9B070'}" opacity=".9" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  for (let k = 0; k < 70; k++) { const u = r(), v = r(); g += dot(30 + u * 156 + v * 53, 116 - v * 40); }
  for (let k = 0; k < 60; k++) g += dot(34 + r() * 148, 120 + r() * 66);
  for (let k = 0; k < 30; k++) { const v = r(); g += dot(188 + v * 50, 110 - v * 38 + r() * 70); }
  g += gloss(s, 96, 96, 36, 7, -8, 0.4);
  return s.render(g);
}

// ───────────────────────── Hot snacks ─────────────────────────
function samosa() {
  const s = new Svg();
  let g = '';
  const Pb = s.puff({ d: 9, blur: 10, dark: '#5a2600', darkOp: 0.3, lightOp: 0.45 });
  const tri = (x, y, sz, rot) => {
    let o = `<g transform="rotate(${rot} ${x} ${y})">`;
    o += `<path d="${blob([[x - sz, y + sz * 0.55], [x - sz * 0.15, y - sz * 0.9], [x + sz * 0.15, y - sz * 0.9], [x + sz, y + sz * 0.55], [x, y + sz * 0.72]], 0.35)}" fill="${s.rad(['#FAD08A', '#E8A34E', '#C0702A'], 0.4, 0.3, 0.9)}" filter="${Pb}"/>`;
    o += `<path d="M${x - sz * 0.05},${y - sz * 0.8} L${x - sz * 0.1},${y + sz * 0.6}" stroke="#B8682A" stroke-width="3" opacity=".5"/>`;
    const r = rng(Math.round(x));
    for (let k = 0; k < 10; k++) o += `<circle cx="${(x - sz * 0.6 + r() * sz * 1.2).toFixed(1)}" cy="${(y - sz * 0.3 + r() * sz * 0.8).toFixed(1)}" r="${(2 + r() * 2.4).toFixed(1)}" fill="#FFE6B0" opacity=".7"/>`;
    return o + '</g>';
  };
  g += tri(90, 130, 70, -10);
  g += tri(158, 146, 64, 12);
  // chutney bowl
  g += `<ellipse cx="188" cy="206" rx="46" ry="22" fill="${s.lin(['#FFFFFF', '#D8DEE8'])}" filter="${s.puff({ d: 4, blur: 4, darkOp: 0.2 })}"/>`;
  g += `<ellipse cx="188" cy="200" rx="36" ry="13" fill="${s.rad(['#FFD060', '#F59A1A', '#D8700A'])}"/>`;
  g += `<rect x="176" y="196" width="8" height="6" rx="2" fill="#FFE68A"/><rect x="194" y="200" width="7" height="5" rx="2" fill="#FFE68A"/>`;
  return s.render(g);
}
function perogies() {
  const s = new Svg();
  let g = '';
  g += `<ellipse cx="128" cy="170" rx="116" ry="56" fill="${s.lin(['#FFFFFF', '#DCE2EC'])}" filter="${s.puff({ d: 6, blur: 7, darkOp: 0.2 })}"/>`;
  g += `<ellipse cx="128" cy="164" rx="92" ry="40" fill="#EEF1F6"/>`;
  const Pb = s.puff({ d: 7, blur: 8, dark: '#6a3a00', darkOp: 0.28, lightOp: 0.5 });
  const half = (x, y, rot) => {
    let o = `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x - 46},${y + 12} Q${x - 44},${y - 40} ${x},${y - 42} Q${x + 44},${y - 40} ${x + 46},${y + 12} Q${x},${y + 22} ${x - 46},${y + 12}Z" fill="${s.rad(['#FFF3D6', '#F4D494', '#E0AC5E'], 0.4, 0.3, 0.9)}" filter="${Pb}"/>`;
    for (let k = 0; k < 9; k++) { const t = k / 8, a = Math.PI * (1 - t); o += `<circle cx="${(x + Math.cos(a) * 42).toFixed(1)}" cy="${(y - Math.sin(a) * 37 + 2).toFixed(1)}" r="4" fill="#F9E4B8"/>`; }
    o += `<ellipse cx="${x - 8}" cy="${y - 14}" rx="12" ry="7" fill="#D99A48" opacity=".45"/>`;
    return o + '</g>';
  };
  g += half(84, 150, -12) + half(172, 150, 10) + half(128, 186, 0);
  g += `<path d="${blob(ring(170, 116, 22, 14, 9, 0.18, 3))}" fill="${s.rad(['#FFFFFF', '#E8EEF2'])}" filter="${s.puff({ d: 3, blur: 3, darkOp: 0.18 })}"/>`;
  const r = rng(5);
  for (let k = 0; k < 9; k++) g += `<rect x="${(90 + r() * 90).toFixed(1)}" y="${(120 + r() * 60).toFixed(1)}" width="7" height="4" rx="2" fill="#4FB23A" transform="rotate(${(r() * 90).toFixed(0)} 128 150)"/>`;
  return s.render(g);
}
function pizzaPretzel() {
  const s = new Svg();
  let g = '';
  const knot = 'M60,186 C20,150 30,70 96,62 C150,56 160,120 128,150 C96,120 106,56 160,62 C226,70 236,150 196,186 M78,188 C104,150 152,150 178,188';
  g += `<path d="${knot}" stroke="${s.lin(['#E8A050', '#B8622A', '#8A4418'])}" stroke-width="34" fill="none" stroke-linecap="round" filter="${s.puff({ d: 8, blur: 9, dark: '#3a1600', darkOp: 0.35, lightOp: 0.4 })}"/>`;
  g += `<path d="${knot}" stroke="#E0442E" stroke-width="18" fill="none" stroke-linecap="round" stroke-dasharray="70 26" opacity=".95"/>`;
  g += `<path d="${knot}" stroke="${s.lin(['#FFE680', '#FFC21E'])}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="46 50" stroke-dashoffset="20"/>`;
  for (const [x, y] of [[56, 118], [96, 64], [158, 64], [204, 118], [128, 150], [80, 186], [176, 186]]) g += `<circle cx="${x}" cy="${y}" r="9" fill="${s.rad(['#F2566A', '#B8202E'])}" stroke="#8A1420" stroke-width="1.5"/><circle cx="${x - 2}" cy="${y - 2}" r="1.4" fill="#FFD2C0"/>`;
  g += gloss(s, 84, 78, 22, 6, -30, 0.5);
  return s.render(g);
}
function pepperoniStick() {
  const s = new Svg();
  let g = '<g transform="rotate(-38 128 128)">';
  g += `<rect x="12" y="98" width="232" height="60" rx="30" fill="${s.lin(['#F9D08A', '#E4A04E', '#B8682A'])}" filter="${s.puff({ d: 9, blur: 10, dark: '#4a2000', darkOp: 0.32, lightOp: 0.45 })}"/>`;
  for (let k = 0; k < 7; k++) g += `<path d="M${38 + k * 30},100 q10,28 -4,56" stroke="#B8682A" stroke-width="3" fill="none" opacity=".5"/>`;
  g += `<path d="M40,112 q20,-6 40,2 t40,0 t40,0 t40,-2" stroke="#FFD24A" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/>`;
  for (let k = 0; k < 6; k++) { const x = 44 + k * 34, y = 124 + (k % 2 ? -4 : 6); g += `<ellipse cx="${x}" cy="${y}" rx="14" ry="11" fill="${s.rad(['#F2566A', '#B8202E'])}" filter="${s.puff({ d: 2, blur: 2, darkOp: 0.3 })}"/><circle cx="${x + 3}" cy="${y + 2}" r="1.6" fill="#FFD2C0"/><circle cx="${x - 4}" cy="${y - 2}" r="1.3" fill="#FFD2C0"/>`; }
  g += gloss(s, 90, 108, 60, 5, 0, 0.4);
  return s.render(g + '</g>');
}
function pizzaRolls() {
  const s = new Svg();
  let g = '';
  const Pb = s.puff({ d: 6, blur: 7, dark: '#5a2600', darkOp: 0.3, lightOp: 0.5 });
  const roll = (x, y, rot, broken = false) => {
    let o = `<g transform="rotate(${rot} ${x} ${y})"><rect x="${x - 38}" y="${y - 26}" width="76" height="52" rx="18" fill="${s.rad(['#FCD89A', '#EDA75A', '#CC7A34'], 0.4, 0.35, 0.8)}" filter="${Pb}"/>`;
    for (let k = 0; k < 8; k++) o += `<path d="M${x - 32 + k * 9},${y - 26} l0,6 M${x - 32 + k * 9},${y + 26} l0,-6" stroke="#B8682A" stroke-width="2.4" opacity=".6"/>`;
    if (broken) o += `<ellipse cx="${x + 30}" cy="${y + 4}" rx="10" ry="14" fill="#E0442E"/><ellipse cx="${x + 38}" cy="${y + 14}" rx="7" ry="5" fill="#E0442E"/>`;
    return o + '</g>';
  };
  g += roll(82, 104, -18) + roll(170, 96, 14) + roll(64, 174, 8) + roll(150, 176, -10, true) + roll(118, 138, 4);
  return s.render(g);
}
function tenders() {
  const s = new Svg();
  let g = '';
  const Pb = s.puff({ d: 8, blur: 9, dark: '#5a2600', darkOp: 0.32, lightOp: 0.45 });
  const strip = (x, y, rot, seed) => {
    const pts = [];
    const r = rng(seed);
    for (let k = 0; k <= 8; k++) pts.push([x - 74 + k * 18.5, y - 28 + (r() - 0.5) * 7 - Math.sin(k / 8 * Math.PI) * 5]);
    pts.push([x + 84, y]);
    for (let k = 8; k >= 0; k--) pts.push([x - 74 + k * 18.5, y + 28 + (r() - 0.5) * 7 - Math.sin(k / 8 * Math.PI) * 5]);
    pts.push([x - 84, y]);
    let o = `<g transform="rotate(${rot} ${x} ${y})"><path d="${blob(pts, 0.8)}" fill="${s.lin(['#FFD27A', '#F0A240', '#C8701E'], 0, 0, 0.2, 1)}" filter="${Pb}"/>`;
    for (let k = 0; k < 14; k++) o += `<ellipse cx="${(x - 64 + r() * 128).toFixed(1)}" cy="${(y - 14 + r() * 26).toFixed(1)}" rx="${(3 + r() * 4).toFixed(1)}" ry="2.4" fill="#FFE6A8" opacity=".75"/>`;
    return o + '</g>';
  };
  g += strip(112, 80, -22, 3) + strip(118, 136, -12, 5) + strip(104, 190, -2, 8);
  g += `<ellipse cx="200" cy="200" rx="40" ry="20" fill="${s.lin(['#FFFFFF', '#D0D8E4'])}" filter="${s.puff({ d: 4, blur: 4, darkOp: 0.2 })}"/>`;
  g += `<path d="M160,196 L166,222 Q200,236 234,222 L240,196Z" fill="${s.lin(['#F4F6FA', '#C8D0DC'], 0, 0, 1, 0)}"/>`;
  g += `<ellipse cx="200" cy="196" rx="36" ry="14" fill="${s.rad(['#FFE08A', '#F2B230'])}"/>`;
  return s.render(g);
}
function tots() {
  const s = new Svg();
  let g = '';
  const Pb = s.puff({ d: 5, blur: 5, dark: '#5a2600', darkOp: 0.3, lightOp: 0.45 });
  const tot = (x, y, rot) => `<g transform="rotate(${rot} ${x} ${y})"><rect x="${x - 17}" y="${y - 22}" width="34" height="44" rx="12" fill="${s.lin(['#C8782E', '#F6C470', '#E49A44', '#B8682A'], 0, 0, 1, 0)}" filter="${Pb}"/><ellipse cx="${x}" cy="${y - 18}" rx="15" ry="7" fill="${s.rad(['#FFE6A8', '#F2B660'])}"/></g>`;
  const r = rng(4);
  for (const [x, y] of [[80, 92], [120, 80], [160, 88], [196, 98], [60, 120], [100, 116], [140, 112], [180, 122]]) g += tot(x, y, (r() - 0.5) * 70);
  // paper boat
  g += `<path d="M26,120 L230,120 L206,214 Q128,228 50,214Z" fill="${s.lin(['#FF5A5A', '#D8202E'])}" filter="${s.puff({ d: 7, blur: 8, darkOp: 0.28 })}"/>`;
  for (let k = 0; k < 6; k++) g += `<path d="M${46 + k * 34},122 L${60 + k * 28},216" stroke="#FFFFFF" stroke-width="12" opacity=".9"/>`;
  g += `<path d="M26,120 L230,120 L206,214 Q128,228 50,214Z" fill="none" stroke="#fff" stroke-width="3" opacity=".4"/>`;
  g += gloss(s, 70, 150, 8, 36, 12, 0.35);
  return s.render(g);
}
function cloche() {
  const s = new Svg();
  let g = '';
  g += `<ellipse cx="128" cy="194" rx="118" ry="34" fill="${s.lin(['#FFFFFF', '#CCD4E0'])}" filter="${s.puff({ d: 5, blur: 6, darkOp: 0.2 })}"/>`;
  g += `<path d="M36,184 C36,90 90,64 128,64 C166,64 220,90 220,184Z" fill="${s.rad(['#FFFFFF', '#D6DEE8', '#8E9AAE'], 0.35, 0.3, 0.9)}" filter="${s.puff({ d: 10, blur: 11, darkOp: 0.3, lightOp: 0.5 })}"/>`;
  g += `<rect x="30" y="178" width="196" height="12" rx="6" fill="${s.lin(['#E6ECF2', '#A8B2C2'])}"/>`;
  g += `<ellipse cx="128" cy="56" rx="16" ry="12" fill="${s.rad(['#FFFFFF', '#B8C2D2', '#7E8AA0'])}"/>`;
  g += gloss(s, 88, 110, 16, 34, 20, 0.7);
  g += fl('sparkles', 190, 64, 76);
  return s.render(g);
}


// ───────────────────────── Clear cups (cold case) ─────────────────────────
// contents(s) draws inside the cup (clipped). lid: 'flat' | 'dome' | 'none'. extra: drawn after (sticks, straws).
function clearCup(contents, { lid = 'flat', top = 76, extra = '', over = '' } = {}) {
  const s = new Svg();
  const body = `M52,${top} L204,${top} L188,214 Q186,226 172,226 L84,226 Q70,226 68,214Z`;
  const clip = s.clip(`<path d="${body}"/>`);
  let g = '';
  g += `<ellipse cx="128" cy="228" rx="64" ry="8" fill="#000" opacity=".12" filter="${s.blur(4)}"/>`;
  g += `<g clip-path="${clip}"><rect x="40" y="${top - 60}" width="180" height="260" fill="#F4F7FA"/>${typeof contents === 'function' ? contents(s) : contents}</g>`;
  g += extra;
  // plastic
  g += `<path d="${body}" fill="${s.lin([[0, '#FFFFFF', 0.35], [0.18, '#FFFFFF', 0.05], [0.8, '#FFFFFF', 0.0], [1, '#B8C8DA', 0.35]], 0, 0, 1, 0)}" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="3"/>`;
  g += `<path d="M66,${top + 14} L78,212" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".55" filter="${s.blur(2)}"/>`;
  g += `<path d="M184,${top + 18} L178,160" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45" filter="${s.blur(1.5)}"/>`;
  if (lid === 'flat') {
    g += `<ellipse cx="128" cy="${top}" rx="80" ry="14" fill="${s.lin([[0, '#FFFFFF', 0.55], [1, '#C8D6E6', 0.55]])}" stroke="#FFFFFF" stroke-width="3" stroke-opacity=".9"/>`;
  } else if (lid === 'dome') {
    g += `<path d="M48,${top} C48,${top - 70} 208,${top - 70} 208,${top}Z" fill="${s.lin([[0, '#FFFFFF', 0.45], [1, '#C8D6E6', 0.25]])}" stroke="#FFFFFF" stroke-width="3" stroke-opacity=".9"/>`;
    g += `<ellipse cx="128" cy="${top}" rx="80" ry="10" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-opacity=".9"/>`;
    g += `<path d="M84,${top - 30} Q100,${top - 48} 128,${top - 50}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`;
  } else {
    g += `<ellipse cx="128" cy="${top}" rx="76" ry="10" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-opacity=".9"/>`;
  }
  return s.render(g + over);
}
// layer band inside a cup (y0..y1), wavy top
const layer = (s, y0, y1, cols, dots) => {
  let o = `<path d="M30,${y0} q24,-8 48,0 t48,0 t48,0 t48,0 L222,${y1} L30,${y1}Z" fill="${s.lin(cols)}"/>`;
  if (dots) { const r = rng(y0); for (let k = 0; k < dots.n; k++) o += `<circle cx="${(50 + r() * 156).toFixed(1)}" cy="${(y0 + 4 + r() * (y1 - y0 - 6)).toFixed(1)}" r="${dots.r}" fill="${dots.c[k % dots.c.length]}" opacity="${dots.o ?? 1}"/>`; }
  return o;
};

// ───────────────────────── Salad bowls ─────────────────────────
function saladBowl(fill, { bowl = ['#FFFFFF', '#D6DEE8'] } = {}) {
  const s = new Svg();
  let g = '';
  const mound = `M26,146 C30,70 80,44 128,44 C176,44 226,70 230,146Z`;
  const clip = s.clip(`<path d="${mound}"/>`);
  g += `<path d="${mound}" fill="${s.rad(['#9EE06A', '#5CB840', '#3A8A2A'], 0.4, 0.4, 0.8)}" filter="${s.puff({ d: 6, blur: 7, dark: '#123a00', darkOp: 0.3 })}"/>`;
  g += `<g clip-path="${clip}">${fill(s)}</g>`;
  g += `<path d="M18,140 Q24,218 128,220 Q232,218 238,140 Q128,160 18,140Z" fill="${s.lin(bowl)}" filter="${s.puff({ d: 9, blur: 10, darkOp: 0.22, lightOp: 0.6 })}"/>`;
  g += `<path d="M18,140 Q128,160 238,140" stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  g += gloss(s, 64, 180, 7, 18, 40, 0.6);
  return s.render(g);
}
const leaf = (s, x, y, w, rot, cols = ['#B6EC7A', '#58B83C']) => `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x - w},${y} Q${x - w * 0.4},${y - w * 0.8} ${x + w},${y - w * 0.1} Q${x},${y + w * 0.6} ${x - w},${y}Z" fill="${s.lin(cols)}" filter="${s.puff({ d: 3, blur: 3, dark: '#123a00', darkOp: 0.3 })}"/><path d="M${x - w * 0.9},${y} Q${x},${y - w * 0.2} ${x + w * 0.9},${y - w * 0.1}" stroke="#E8FFD0" stroke-width="2.4" fill="none" opacity=".8"/></g>`;
const leaves = (s, n, seed, cols) => { const r = rng(seed); let o = ''; for (let k = 0; k < n; k++) o += leaf(s, 40 + r() * 176, 60 + r() * 84, 22 + r() * 12, (r() - 0.5) * 120, cols); return o; };
const chickenSlices = (s, pts) => pts.map(([x, y, rot]) => `<g transform="rotate(${rot} ${x} ${y})"><rect x="${x - 22}" y="${y - 10}" width="44" height="20" rx="8" fill="${s.lin(['#FBE6C4', '#E2B880'])}" filter="${s.puff({ d: 3, blur: 3, darkOp: 0.25 })}"/><path d="M${x - 12},${y - 9} l6,18 M${x},${y - 9} l6,18 M${x + 12},${y - 9} l6,18" stroke="#A8662A" stroke-width="3" opacity=".6"/></g>`).join('');
const cubes = (s, pts, cols, sz = 14) => pts.map(([x, y, rot]) => `<rect x="${x - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}" rx="3" fill="${s.lin(cols)}" transform="rotate(${rot} ${x} ${y})" filter="${s.puff({ d: 2, blur: 2, darkOp: 0.3 })}"/>`).join('');


// ───────────────────────── Drinks ─────────────────────────
const cyl = (s, c) => s.lin([shade(c, -0.35), shade(c, 0.1), shade(c, 0.35), c, shade(c, -0.25), shade(c, -0.45)], 0, 0, 1, 0);
function can({ color, x0 = 74, x1 = 182, top = 46, bot = 222, art = () => '', foil = false, rot = -6 }) {
  const s = new Svg();
  const w = x1 - x0, cx = (x0 + x1) / 2, ry = w * 0.16;
  let g = `<g transform="rotate(${rot} 128 128)">`;
  const body = `M${x0},${top + 10} L${x0},${bot} A${w / 2},${ry} 0 0 0 ${x1},${bot} L${x1},${top + 10}Z`;
  const clip = s.clip(`<path d="${body}"/>`);
  g += `<path d="${body}" fill="${cyl(s, color)}"/>`;
  g += `<g clip-path="${clip}">${art(s, { x0, x1, cx, top, bot })}</g>`;
  g += `<path d="${body}" fill="${s.lin([[0, '#000', 0.25], [0.2, '#fff', 0.0], [0.3, '#fff', 0.35], [0.42, '#fff', 0], [0.85, '#000', 0.05], [1, '#000', 0.35]], 0, 0, 1, 0)}"/>`;
  // bottom rim
  g += `<path d="M${x0},${bot - 6} A${w / 2},${ry} 0 0 0 ${x1},${bot - 6} L${x1 - 4},${bot + 4} A${w / 2 - 4},${ry} 0 0 1 ${x0 + 4},${bot + 4}Z" fill="${cyl(s, '#C8CED6')}"/>`;
  // shoulder + lid
  g += `<path d="M${x0},${top + 12} L${x0 + 8},${top} L${x1 - 8},${top} L${x1},${top + 12} A${w / 2},${ry} 0 0 1 ${x0},${top + 12}Z" fill="${cyl(s, '#D6DCE4')}"/>`;
  g += `<ellipse cx="${cx}" cy="${top}" rx="${w / 2 - 8}" ry="${ry - 2}" fill="${s.lin(['#F4F6FA', '#A8B2C0'])}"/><ellipse cx="${cx}" cy="${top}" rx="${w / 2 - 14}" ry="${ry - 6}" fill="${s.lin(['#C8D0DA', '#EEF2F6'])}"/>`;
  g += `<rect x="${cx - 12}" y="${top - 6}" width="24" height="10" rx="5" fill="none" stroke="#9AA4B2" stroke-width="3"/>`;
  if (foil) {
    let d = `M${x0 - 3},${top + 34}`;
    const r = rng(5);
    for (let k = 1; k <= 8; k++) d += ` L${x0 - 3 + (w + 6) * k / 8},${top + 30 + r() * 10}`;
    d += ` L${x1 + 1},${top + 6} Q${cx},${top - ry - 6} ${x0 - 1},${top + 6}Z`;
    g += `<path d="${d}" fill="${cyl(s, '#DDE3EA')}"/>`;
    for (let k = 0; k < 6; k++) g += `<path d="M${x0 + 8 + k * (w - 16) / 5},${top + 4} l${(r() - 0.5) * 8},${22 + r() * 6}" stroke="#fff" stroke-width="2" opacity=".7"/>`;
  }
  return s.render(g + '</g>');
}
// Bottle from a profile of [y, halfWidth] points, cap drawn over the top.
function bottle({ prof, liquid, liquidTop, clear = true, cap, capY, capH, capW, label, rot = -6, glass = false, ribs = [] }) {
  const s = new Svg();
  const cx = 128;
  const L = prof.map(([y, w]) => [cx - w, y]), R = prof.map(([y, w]) => [cx + w, y]).reverse();
  const body = spline(L, 0.7) + spline(R, 0.7).replace(/^M/, ' L') + 'Z';
  const clip = s.clip(`<path d="${body}"/>`);
  let g = `<g transform="rotate(${rot} 128 128)">`;
  if (clear) {
    g += `<path d="${body}" fill="${s.lin([[0, glass ? '#8AA890' : '#D6E6F4', 0.5], [1, glass ? '#B8D0BC' : '#EEF6FC', 0.35]], 0, 0, 1, 0)}"/>`;
    g += `<g clip-path="${clip}"><rect x="40" y="${liquidTop}" width="176" height="240" fill="${cyl(s, liquid)}"/><ellipse cx="${cx}" cy="${liquidTop}" rx="80" ry="5" fill="${shade(liquid, 0.3)}" opacity=".8"/></g>`;
  } else {
    g += `<path d="${body}" fill="${cyl(s, liquid)}"/>`;
  }
  for (const y of ribs) g += `<g clip-path="${clip}"><rect x="40" y="${y}" width="176" height="4" fill="#fff" opacity=".35"/></g>`;
  if (label) g += `<g clip-path="${clip}"><rect x="40" y="${label.y0}" width="176" height="${label.y1 - label.y0}" fill="${cyl(s, label.fill)}"/>${label.art ? label.art(s) : ''}</g>`;
  g += `<path d="${body}" fill="${s.lin([[0, '#000', 0.2], [0.18, '#fff', 0.0], [0.27, '#fff', 0.55], [0.36, '#fff', 0.0], [0.8, '#fff', 0.1], [1, '#000', 0.25]], 0, 0, 1, 0)}" stroke="#fff" stroke-opacity="${clear ? 0.6 : 0.15}" stroke-width="2"/>`;
  g += `<rect x="${cx - capW}" y="${capY}" width="${capW * 2}" height="${capH}" rx="5" fill="${cyl(s, cap)}"/>`;
  for (let k = 1; k < 8; k++) g += `<path d="M${cx - capW + (capW * 2) * k / 8},${capY + 3} l0,${capH - 6}" stroke="#000" stroke-width="1.5" opacity=".15"/>`;
  g += `<ellipse cx="${cx}" cy="${capY}" rx="${capW}" ry="4" fill="${shade(cap, 0.3)}"/>`;
  return s.render(g + '</g>');
}
function paperCup({ sleeve, lid = '#FFFFFF', drink, top = 70, art = () => '' }) {
  const s = new Svg();
  let g = '';
  const body = `M66,${top} L190,${top} L172,222 Q128,230 84,222Z`;
  g += `<path d="${body}" fill="${s.lin(['#D8DEE6', '#FFFFFF', '#F4F6F8', '#C8D0DA'], 0, 0, 1, 0)}" filter="${s.puff({ d: 6, blur: 7, darkOp: 0.2 })}"/>`;
  g += `<path d="M71,${top + 50} L185,${top + 50} L178,${top + 110} L78,${top + 110}Z" fill="${cyl(s, sleeve)}"/>${art(s)}`;
  if (drink) {
    g += `<ellipse cx="128" cy="${top}" rx="64" ry="16" fill="#FFFFFF"/><ellipse cx="128" cy="${top + 1}" rx="56" ry="12" fill="${s.rad([shade(drink, 0.3), drink])}"/>`;
    g += drink === '#E8D2B0' ? '' : '';
  } else {
    g += `<path d="M58,${top + 2} L198,${top + 2} L194,${top - 12} Q128,${top - 26} 62,${top - 12}Z" fill="${cyl(s, lid)}"/><ellipse cx="128" cy="${top - 14}" rx="64" ry="12" fill="${s.lin([shade(lid, 0.2), shade(lid, -0.1)])}"/><ellipse cx="150" cy="${top - 18}" rx="12" ry="4" fill="${shade(lid, -0.35)}"/>`;
  }
  g += gloss(s, 90, top + 70, 6, 50, 6, 0.55);
  return s.render(g);
}
const logoTxt = (x, y, str, size, fill, o = {}) => txt(x, y, str, size, fill, o);
const steam = (s, x, y) => `<path d="M${x},${y} q-10,-14 0,-26 t0,-26 M${x + 22},${y + 6} q-10,-14 0,-26 t0,-26" stroke="#C8D2DE" stroke-width="7" fill="none" stroke-linecap="round" opacity=".8"/>`;

const ICONS = {
  // burgers
  'burger-beef': () => burger({ patty: 'beef' }),
  'burger-cheese': () => burger({ patty: 'beef', cheese: true }),
  'burger-bacon': () => burger({ patty: 'beef', cheese: true, bacon: true, tomato: false }),
  'burger-chicken': () => burger({ patty: 'chicken', tomato: false }),
  'burger-veggie': () => burger({ patty: 'veggie', onion: true }),

  // chips
  'chips-doritos': () => {
    const s = new Svg();
    const c = `${txt(128, 96, 'DORITOS', 30, '#fff', { stroke: '#3A0A0A', sw: 5, style: 'italic', rot: -4, ls: -1 })}
<path d="M84,104 L172,100 L170,118 L86,122Z" fill="#FF9E1B"/>${txt(128, 116, 'NACHO CHEESE', 11, '#3A0A0A', { font: 'Arial', weight: 800 })}
${tortillaChip(s, 96, 170, 62, -18)}${tortillaChip(s, 158, 176, 62, 16)}${tortillaChip(s, 126, 150, 58, 4)}`;
    return s.render(chipBag(s, { color: '#D6232C' }, c));
  },
  'chips-lays': () => {
    const s = new Svg();
    const c = `${laysLogo(s, 128, 84)}${potatoChip(s, 98, 168, 30, 0.3, '#F8D878', 2)}${potatoChip(s, 156, 172, 32, 1.2, '#F8D878', 3)}${potatoChip(s, 126, 148, 30, 2, '#FBE08E', 4)}`;
    return s.render(chipBag(s, { color: '#FFC61A' }, c));
  },
  'chips-lays-bbq': () => {
    const s = new Svg();
    const c = `${laysLogo(s, 128, 84)}${txt(128, 128, 'BBQ', 16, '#FFB23E', { font: 'Arial Black' })}${potatoChip(s, 98, 176, 30, 0.3, '#E89A45', 2)}${potatoChip(s, 156, 180, 32, 1.2, '#E08A3A', 3)}${potatoChip(s, 126, 158, 28, 2, '#EFA552', 4)}`;
    return s.render(chipBag(s, { color: '#2E2A2E', seal: '#3A3438' }, c));
  },
  'chips-lays-ketchup': () => {
    const s = new Svg();
    const c = `${laysLogo(s, 128, 84)}${txt(128, 128, 'KETCHUP', 14, '#FFE3C4', { font: 'Arial Black' })}${potatoChip(s, 98, 176, 30, 0.3, '#E2704E', 2)}${potatoChip(s, 156, 180, 32, 1.2, '#D9623E', 3)}${potatoChip(s, 126, 158, 28, 2, '#E97E58', 4)}`;
    return s.render(chipBag(s, { color: '#C21E2E' }, c));
  },
  'chips-mv-jalapeno': () => { const s = new Svg(); return missVickies(s, '#3F9A3A', `<g transform="rotate(20 190 140)"><path d="M168,140 q20,-18 44,-4 q-18,14 -44,4z" fill="${s.lin(['#6FD35A', '#2E8B2A'])}"/><path d="M210,136 l10,-8" stroke="#4E7A2A" stroke-width="4" stroke-linecap="round"/></g>`); },
  'chips-mv-sour-cream': () => { const s = new Svg(); return missVickies(s, '#1E6A45', `<ellipse cx="186" cy="146" rx="18" ry="11" fill="${s.rad(['#FFFFFF', '#E6EEF0'])}"/><circle cx="182" cy="142" r="2" fill="#3E9A34"/><circle cx="190" cy="146" r="2" fill="#3E9A34"/>`); },
  'chips-mv-original': () => { const s = new Svg(); return missVickies(s, '#2F62B3'); },
  'chips-mv-vinegar': () => { const s = new Svg(); return missVickies(s, '#127A78', `<rect x="180" y="126" width="16" height="30" rx="5" fill="${s.lin(['#A8D8F0', '#5AA8D0'], 0, 0, 1, 0)}" opacity=".95"/><rect x="184" y="118" width="8" height="10" rx="2" fill="#D8B040"/>`); },
  'chips-hickory': () => {
    const s = new Svg();
    let grain = '';
    for (let y = 40; y < 220; y += 9) grain += `<path d="M30,${y} q50,-5 100,0 t100,0" stroke="#4A2A12" stroke-width="2" fill="none" opacity=".25"/>`;
    let sticks = '';
    const r = rng(8);
    for (let i = 0; i < 16; i++) sticks += stick(s, 80 + r() * 96, 158 + r() * 40, 44 + r() * 16, -40 + r() * 80);
    const c = `${grain}${txt(128, 80, 'HICKORY', 28, '#FFE12E', { stroke: '#4A1F0A', sw: 5, rot: -4 })}${txt(128, 108, 'STICKS', 28, '#FFE12E', { stroke: '#4A1F0A', sw: 5, rot: -4 })}
<rect x="92" y="114" width="72" height="16" rx="3" fill="#E23A2A" transform="rotate(-4 128 122)"/>${txt(128, 127, 'ORIGINAL', 11, '#fff', { font: 'Arial Black', rot: -4 })}${sticks}`;
    return s.render(chipBag(s, { color: '#8A5328' }, c));
  },
  'chips-sunchips': () => {
    const s = new Svg();
    let rays = '';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rays += `<path d="M${128 + Math.cos(a) * 24},${74 + Math.sin(a) * 24} L${128 + Math.cos(a + 0.13) * 36},${74 + Math.sin(a + 0.13) * 36} L${128 + Math.cos(a - 0.13) * 36},${74 + Math.sin(a - 0.13) * 36}Z" fill="#FFD23A"/>`; }
    const c = `${rays}<circle cx="128" cy="74" r="24" fill="${s.rad(['#FFF3A0', '#FFC81E'])}"/>${txt(128, 128, 'SunChips', 24, '#2F7A2A', { font: 'Arial Rounded MT Bold', weight: 700, stroke: '#FFF4D0', sw: 4 })}
${ridgedChip(s, 98, 178, 50, -14)}${ridgedChip(s, 158, 182, 50, 12)}${ridgedChip(s, 128, 162, 46, 2)}`;
    return s.render(chipBag(s, { color: '#EE6B2C' }, c));
  },
  'chips-cheetos': () => {
    const s = new Svg();
    const c = `${txt(128, 96, 'Cheetos', 34, '#FF9A1A', { font: 'Arial Rounded MT Bold', weight: 700, stroke: '#fff', sw: 6, rot: -6 })}
${txt(128, 120, 'PUFFS', 14, '#fff', { font: 'Arial Black', rot: -6 })}
${puffCurl(s, 96, 168, -20)}${puffCurl(s, 158, 160, 25)}${puffCurl(s, 124, 190, 5)}${puffCurl(s, 174, 196, -30, 34)}${puffCurl(s, 80, 200, 40, 30)}`;
    return s.render(chipBag(s, { color: '#1F5FC4' }, c));
  },
  'popcorn-smartfood': () => {
    const s = new Svg();
    let pops = '';
    const r = rng(12);
    for (let i = 0; i < 12; i++) pops += popcorn(s, 76 + r() * 104, 150 + r() * 50, 12 + r() * 6, i + 1);
    const c = `${txt(128, 88, 'smartfood', 27, '#1B1B1B', { font: 'Arial Rounded MT Bold', weight: 700, rot: -4 })}
<rect x="84" y="100" width="88" height="18" rx="9" fill="#FFFFFF" transform="rotate(-4 128 109)"/>${txt(128, 113, 'WHITE CHEDDAR', 9.5, '#333', { font: 'Arial Black', rot: -4 })}${pops}`;
    return s.render(chipBag(s, { color: '#F5E27A' }, c));
  },
  pringles: () => {
    const s = new Svg();
    const P = s.puff({ d: 8, blur: 10, darkOp: 0.3 });
    const body = s.lin(['#9E0E14', '#E8323A', '#F2555A', '#D11A22', '#8E0A10'], 0, 0, 1, 0);
    let g = `<g transform="rotate(-6 128 128)">`;
    g += `<rect x="72" y="42" width="112" height="186" rx="12" fill="${body}" filter="${P}"/>`;
    g += `<ellipse cx="128" cy="226" rx="56" ry="10" fill="#7E0A10"/>`;
    // lid
    g += `<ellipse cx="128" cy="44" rx="58" ry="14" fill="${s.lin(['#F4F4F4', '#C8C8C8'])}"/><ellipse cx="128" cy="40" rx="54" ry="11" fill="${s.rad(['#FFFFFF', '#E6E6E6'])}"/>`;
    g += `<rect x="72" y="46" width="112" height="10" fill="#EDEDED" opacity=".9"/>`;
    // Mr P
    g += `<ellipse cx="128" cy="118" rx="30" ry="36" fill="${s.rad(['#FFFFFF', '#F2E6DA'])}"/>`;
    g += `<path d="M100,98 Q108,72 128,74 Q150,72 156,98 Q140,86 128,90 Q114,86 100,98Z" fill="#2A1A14"/>`;
    g += `<circle cx="117" cy="112" r="3.2" fill="#2A1A14"/><circle cx="139" cy="112" r="3.2" fill="#2A1A14"/>`;
    g += `<path d="M104,128 Q116,120 128,126 Q140,120 152,128 Q144,140 128,132 Q112,140 104,128Z" fill="#2A1A14"/>`;
    g += `<path d="M114,160 L128,168 L142,160 L142,174 L128,168 L114,174Z" fill="#E8323A" stroke="#fff" stroke-width="2"/>`;
    g += txt(128, 206, 'Pringles', 22, '#fff', { font: 'Arial Rounded MT Bold', weight: 700 });
    g += gloss(s, 90, 130, 6, 70, 0, 0.5);
    return s.render(g + '</g>');
  },
  'sand-ham-turkey': () => sandwich([HAM, TURKEY, LET]),
  'sand-chicken-salad': () => sandwich([LET, { c: ['#FFF6DE', '#EFD9AC'], t: 42, dots: ['#7CC45A', '#F4C88A', '#7CC45A'], nd: 34, dr: 3.4 }]),
  'sand-egg-salad': () => sandwich([LET, { c: ['#FFEE8A', '#F7C83A'], t: 42, dots: ['#FFFFFF', '#FFFFFF', '#6CB84A'], nd: 34, dr: 3.4 }]),
  'sand-blt': () => sandwich([TOM, LET, BACON, { ...BACON }]),
  'grilled-cheese': () => sandwich([{ ...CHEESE, t: 26 }], { toast: true, marks: true }),
  'grilled-ham-cheese': () => sandwich([{ ...CHEESE, t: 16 }, HAM], { toast: true, marks: true }),
  'breakfast-sandwich': () => breakfastSandwich(),
  'wrap-bacon-sausage': () => wrap({ base: '#FFD84A', bits: [EGG, SAUS, BAC, CHS] }, { foil: true }),
  'wrap-sausage': () => wrap({ base: '#FFD84A', bits: [EGG, SAUS, SAUS, CHS] }, { foil: true }),
  'wrap-egg': () => wrap({ base: '#FFD84A', bits: [EGG, CHS, EGG] }, { foil: true }),
  'wrap-buffalo': () => wrap({ base: '#8BD05A', bits: [BUFF, LETb, RANCH, BUFF] }),
  'wrap-caesar': () => wrap({ base: '#9AD86A', bits: [CHK, LETb, PARM, CHK] }),
  'quesadilla-cheese': () => quesadilla(false),
  'quesadilla-chicken': () => quesadilla(true),
  'croissant-choc': () => plain(s => {
    const m = s.id('m');
    s.defs.push(`<mask id="${m}" mask-type="alpha">${fl('croissant', 128, 128, 240)}</mask>`);
    const z = spline([[24, 140], [50, 96], [62, 150], [88, 84], [104, 160], [128, 80], [142, 164], [166, 86], [180, 160], [204, 98], [214, 150], [236, 116]], 1.4);
    return fl('croissant', 128, 128, 240) + `<g mask="url(#${m})"><path d="${z}" stroke="#4A2012" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="${s.puff({ d: 2, blur: 2, darkOp: 0.3, lightOp: 0.6 })}"/></g>`;
  }),
  muffin: () => muffin(),
  scone: () => scone(),
  'apple-fritter': () => fritter(),
  'cinnamon-bun': () => cinnamonBun(),
  brownie: () => brownie(),
  'rice-crispy': () => riceCrispy(),
  samosa: () => samosa(),
  perogies: () => perogies(),
  'pizza-pretzel': () => pizzaPretzel(),
  'pepperoni-stick': () => pepperoniStick(),
  'pizza-rolls': () => pizzaRolls(),
  tenders: () => tenders(),
  tots: () => tots(),
  special: () => cloche(),
  'pizza-cheese': () => plain(fl('pizza_cheese', 128, 128, 256)),
  'ice-cream': () => plain(fl('soft_ice_cream', 128, 128, 256)),
  'fruit-cup': () => clearCup(s => `<rect x="40" y="70" width="180" height="170" fill="#FFE6C8"/>` +
    fl('grapes', 170, 206, 96, 10) + fl('pineapple', 84, 200, 96, -20) + fl('kiwi_fruit', 128, 168, 84, 0) + fl('melon', 188, 142, 84, 0) +
    fl('strawberry', 70, 130, 84, -15) + fl('tangerine', 132, 110, 72, 0) + fl('blueberries', 190, 92, 60, 0) + fl('strawberry', 88, 88, 60, 20)),
  'veggie-cup': () => {
    const t = new Svg('v');
    const stickC = (x, y, h, rot) => `<g transform="rotate(${rot} ${x} ${y + h / 2})"><rect x="${x - 9}" y="${y}" width="18" height="${h}" rx="8" fill="${t.lin(['#FFB050', '#F27A1A', '#D8600A'], 0, 0, 1, 0)}" filter="${t.puff({ d: 3, blur: 3, darkOp: 0.25 })}"/><path d="M${x - 8},${y + 30} l8,2 M${x},${y + 56} l8,2 M${x - 6},${y + 84} l8,2" stroke="#C8580A" stroke-width="2" opacity=".6"/></g>`;
    const stickG = (x, y, h, rot) => `<g transform="rotate(${rot} ${x} ${y + h / 2})"><rect x="${x - 10}" y="${y}" width="20" height="${h}" rx="7" fill="${t.lin(['#D4F29A', '#9ED45A', '#6AAE3A'], 0, 0, 1, 0)}" filter="${t.puff({ d: 3, blur: 3, darkOp: 0.25 })}"/><path d="M${x - 4},${y + 6} l0,${h - 12} M${x + 4},${y + 6} l0,${h - 12}" stroke="#F0FFD8" stroke-width="2" opacity=".8"/></g>`;
    const sticks = stickG(84, 30, 170, -12) + stickC(110, 22, 180, -4) + stickG(146, 26, 176, 6) + stickC(172, 34, 168, 14) + stickC(128, 44, 160, 2);
    return clearCup(s => `<rect x="40" y="110" width="180" height="130" fill="#F2F6EE"/>` + fl('cucumber', 86, 200, 70, 30) + fl('broccoli', 166, 200, 64, 0), { lid: 'none', top: 110, extra: sticks }).replace('<defs>', `<defs>${t.defs.join('')}`);
  },
  'yogurt-parfait': () => clearCup(s => layer(s, 196, 240, ['#FFFFFF', '#EEF0F4']) + layer(s, 172, 198, ['#D8A058', '#B87A34'], { n: 30, r: 3, c: ['#8A5018', '#F2CE8A'] }) +
    layer(s, 136, 174, ['#FFFFFF', '#F2F2F6']) + layer(s, 118, 140, ['#E8566A', '#B82A4E'], { n: 14, r: 4, c: ['#5A3A9A'] }) + layer(s, 84, 120, ['#FFFFFF', '#F2F2F6']) +
    layer(s, 76, 92, ['#E0A85E', '#C07E3A'], { n: 26, r: 3, c: ['#8A5018', '#F8D89A'] }), { lid: 'dome', top: 84, extra: fl('strawberry', 100, 62, 66, -20) + fl('blueberries', 158, 64, 58, 0) }),
  'chia-pudding': () => clearCup(s => layer(s, 170, 240, ['#FFC94A', '#F59A1A']) + layer(s, 90, 172, ['#F4F0EA', '#E2DCD2'], { n: 110, r: 1.8, c: ['#2A2A30', '#6A6A70'] }) +
    '', { lid: 'dome', top: 90, extra: fl('mango', 96, 72, 62, -10) + fl('blueberries', 156, 70, 60, 0) }),
  'salad-caesar': () => saladBowl(s => leaves(s, 16, 4, ['#D8F4A0', '#6CC24A']) + cubes(s, [[74, 84, 10], [168, 70, -20], [132, 110, 30], [196, 104, 5]], ['#F6C870', '#C8842E'], 18) +
    chickenSlices(s, [[108, 72, -20], [150, 96, 15], [80, 112, 5]]) + `<path d="M96,58 l14,-4 l2,8z M180,86 l12,2 l-4,8z M122,98 l10,-6 l3,9z" fill="#FFFDF2"/>`),
  'salad-southwest': () => saladBowl(s => leaves(s, 16, 9, ['#7ACB4A', '#2E8A2A']) + (() => { const r = rng(3); let o = ''; for (let k = 0; k < 22; k++) o += `<circle cx="${(44 + r() * 170).toFixed(1)}" cy="${(64 + r() * 60).toFixed(1)}" r="5" fill="${k % 2 ? '#FFD83A' : '#2E1E2E'}" filter="${s.puff({ d: 1.5, blur: 1.5, darkOp: 0.3 })}"/>`; return o; })() +
    cubes(s, [[70, 90, 10], [176, 76, -20], [140, 116, 30]], ['#FF6A5A', '#D0283A'], 16) + chickenSlices(s, [[112, 70, -10], [196, 106, 20]]) +
    `<path d="M60,70 l40,-10 M150,62 l36,8 M90,118 l30,-4" stroke="#F4A23A" stroke-width="7" stroke-linecap="round"/>`),
  'salad-pasta': () => saladBowl(s => { let o = `<rect x="0" y="0" width="256" height="140" fill="${s.rad(['#FFE08A', '#F2BE4A'])}"/>`; const r = rng(6);
    for (let k = 0; k < 18; k++) { const x = 40 + r() * 176, y = 56 + r() * 70, rot = r() * 180; o += `<g transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"><path d="M${x - 16},${y} q4,-8 8,0 t8,0 t8,0 t8,0" stroke="${s.lin(['#FFE9A0', '#F0B640'])}" stroke-width="10" fill="none" stroke-linecap="round" filter="${s.puff({ d: 2, blur: 2, darkOp: 0.3 })}"/></g>`; }
    o += cubes(s, [[80, 80, 10], [170, 100, -20]], ['#FF6A5A', '#D0283A'], 14) + cubes(s, [[120, 70, 5], [196, 76, 30]], ['#8EDB5A', '#4A9A2A'], 12) + cubes(s, [[100, 112, 12], [150, 64, -8]], ['#FFFFFF', '#E6E6EC'], 14);
    o += `<circle cx="140" cy="98" r="7" fill="#2A2A2A"/><circle cx="140" cy="98" r="3" fill="#F4E0A0"/><circle cx="64" cy="108" r="7" fill="#2A2A2A"/><circle cx="64" cy="108" r="3" fill="#F4E0A0"/>`; return o; }),
  'whole-fruit': () => plain(fl('banana', 140, 92, 160, -30) + fl('red_apple', 84, 160, 130) + fl('tangerine', 180, 178, 110)),
  'hot-drink': () => paperCup({ sleeve: '#8A5A3A', drink: '#C89A6A', art: (s) => `<path d="M96,158 q16,-12 32,0 t32,0" stroke="#F4E6D6" stroke-width="5" fill="none" stroke-linecap="round"/>` }).replace('</svg>', `${steam(null, 110, 52)}</svg>`),
  'coffee-tea': () => paperCup({ sleeve: '#3E6A4A', art: (s) => `<path d="M186,68 C212,80 214,120 204,150" stroke="#F4F4F4" stroke-width="2.5" fill="none"/><rect x="194" y="150" width="22" height="26" rx="3" fill="#FFB547" transform="rotate(8 205 163)"/><circle cx="128" cy="150" r="14" fill="none" stroke="#F4E6D6" stroke-width="4"/>` }),
  'iced-coffee': () => clearCup(s => layer(s, 90, 240, ['#C8925A', '#8A5428']) + `<path d="M40,140 q40,-20 80,4 t90,-6 L210,160 q-50,14 -90,-4 t-80,8Z" fill="#F4E2C8" opacity=".75"/>` +
    [[84, 108, 12], [132, 100, -8], [168, 118, 20], [104, 150, -15], [156, 164, 8]].map(([x, y, r]) => `<rect x="${x - 17}" y="${y - 17}" width="34" height="34" rx="7" fill="#FFFFFF" opacity=".45" stroke="#fff" stroke-width="2" transform="rotate(${r} ${x} ${y})"/>`).join(''),
    { lid: 'dome', top: 82, extra: `<rect x="138" y="4" width="14" height="120" rx="6" fill="#2E7A4A" transform="rotate(14 145 64)"/>` }),
  smoothie: () => clearCup(s => layer(s, 86, 240, ['#FF8AB0', '#E0407A']) + (() => { const r = rng(2); let o = ''; for (let k = 0; k < 30; k++) o += `<circle cx="${(50 + r() * 156).toFixed(1)}" cy="${(100 + r() * 120).toFixed(1)}" r="2" fill="#6A1A3A" opacity=".5"/>`; return o; })(),
    { lid: 'dome', top: 82, extra: `<rect x="138" y="4" width="14" height="120" rx="6" fill="#FFD23A" transform="rotate(14 145 64)"/>` + fl('strawberry', 84, 54, 60, -20) }),
  'can-pop': () => can({ color: '#D8202E', art: (s, b) => `<path d="M${b.x0},150 C${b.cx - 20},120 ${b.cx + 20},180 ${b.x1},130 L${b.x1},146 C${b.cx + 20},196 ${b.cx - 20},136 ${b.x0},166Z" fill="#FFFFFF"/>` + [[100, 90], [150, 100], [120, 200], [160, 190], [96, 196]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff" opacity=".35"/>`).join('') }),
  'pellegrino': () => can({ color: '#F4A21A', x0: 86, x1: 170, top: 40, bot: 224, foil: true, art: (s, b) => `<rect x="${b.x0}" y="112" width="${b.x1 - b.x0}" height="46" fill="#FFFFFF"/>${fl('tangerine', b.cx, 184, 64)}${txt(b.cx, 140, 'Sanpellegrino', 11, '#C8102E', { font: 'Georgia', weight: 700, style: 'italic' })}` }),
  'juice-can': () => can({ color: '#FFFFFF', x0: 70, x1: 186, top: 60, bot: 218, art: (s, b) => `<rect x="${b.x0}" y="60" width="${b.x1 - b.x0}" height="160" fill="${cyl(s, '#FFF8E6')}"/><rect x="${b.x0}" y="74" width="${b.x1 - b.x0}" height="26" fill="#2E8A3A"/>${txt(b.cx, 93, 'JUICE', 17, '#fff', { font: 'Arial Black' })}${fl('tangerine', 104, 160, 70)}${fl('pineapple', 156, 156, 72)}` }),
  'water-bottle': () => bottle({ prof: [[40, 18], [52, 18], [74, 40], [92, 44], [210, 44], [224, 38], [226, 30]], liquid: '#9AD4F8', liquidTop: 70, cap: '#1E7AE0', capY: 22, capH: 20, capW: 20,
    ribs: [100, 190], label: { y0: 118, y1: 170, fill: '#1E88E5', art: (s) => `<path d="M60,150 q34,-16 68,0 t68,0" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>${txt(128, 140, 'WATER', 14, '#fff', { font: 'Arial Black' })}` } }),
  'bottled-pop': () => bottle({ prof: [[40, 16], [56, 17], [80, 34], [104, 40], [140, 34], [166, 42], [212, 42], [226, 32]], liquid: '#5A2A1A', liquidTop: 58, cap: '#D8202E', capY: 22, capH: 20, capW: 19,
    label: { y0: 112, y1: 150, fill: '#D8202E', art: (s) => `<path d="M60,138 q34,-16 68,0 t68,0" stroke="#fff" stroke-width="4" fill="none"/>` } }),
  gatorade: () => bottle({ prof: [[44, 22], [60, 24], [84, 44], [120, 46], [140, 38], [160, 46], [212, 46], [226, 38]], liquid: '#FF8A1E', liquidTop: 66, cap: '#FF7A00', capY: 20, capH: 26, capW: 26,
    label: { y0: 92, y1: 140, fill: '#1A1A1A', art: (s) => `<path d="M118,98 L140,98 L130,112 L142,112 L114,136 L122,118 L110,118Z" fill="#FF7A00"/>` } }),
  'pure-leaf': () => bottle({ prof: [[40, 16], [52, 16], [90, 36], [110, 42], [214, 42], [226, 36]], liquid: '#A8561E', liquidTop: 56, cap: '#1E1E1E', capY: 22, capH: 20, capW: 18, glass: true,
    label: { y0: 118, y1: 184, fill: '#FFFFFF', art: (s) => `<path d="M112,152 q16,-34 34,-26 q-4,34 -34,26z" fill="#2E8A3A"/><path d="M112,152 q14,-14 28,-22" stroke="#8ADB6A" stroke-width="2" fill="none"/>${txt(128, 176, 'PURE LEAF', 11, '#1E1E1E', { font: 'Georgia', weight: 700 })}` } }),
  snapple: () => bottle({ prof: [[50, 30], [62, 32], [96, 46], [214, 46], [228, 40]], liquid: '#F2A444', liquidTop: 66, cap: '#E8EAF0', capY: 30, capH: 26, capW: 32, glass: true,
    label: { y0: 118, y1: 178, fill: '#FFFFFF', art: (s) => `<circle cx="128" cy="148" r="22" fill="#FFD84A"/>${txt(128, 153, 'Snapple', 12, '#1E4A9A', { font: 'Georgia', weight: 700, style: 'italic' })}` } }),
  'sparkling-ice': () => bottle({ prof: [[36, 14], [50, 14], [90, 30], [110, 34], [216, 34], [228, 28]], liquid: '#C8388A', liquidTop: 60, cap: '#1A1A1A', capY: 18, capH: 20, capW: 16,
    label: { y0: 126, y1: 184, fill: '#1A1A1A', art: (s) => `${fl('blueberries', 128, 150, 40)}${txt(128, 178, 'SPARKLING ICE', 7.5, '#fff', { font: 'Arial Black' })}` } })
    .replace('</svg>', '') + (() => { const r = rng(3); let o = ''; for (let k = 0; k < 10; k++) o += `<circle cx="${(112 + r() * 32).toFixed(1)}" cy="${(70 + r() * 50).toFixed(1)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="#fff" opacity=".7"/>`; return o; })() + '</svg>',
  'milk-to-go': () => {
    const a = bottle({ prof: [[56, 22], [70, 24], [96, 44], [212, 44], [226, 36]], liquid: '#8A5A3A', liquidTop: 0, clear: false, cap: '#C8202E', capY: 34, capH: 24, capW: 24, rot: 8,
      label: { y0: 120, y1: 190, fill: '#FFFFFF', art: (s) => `${txt(128, 158, 'MILK', 16, '#8A5A3A', { font: 'Arial Black' })}<path d="M96,172 q16,-8 32,0 t32,0" stroke="#8A5A3A" stroke-width="3" fill="none"/>` } });
    return a;
  },
  gum: () => plain(s => {
    let g = '<g transform="rotate(-12 128 128)">';
    for (let k = 0; k < 3; k++) g += `<rect x="${92 + k * 18}" y="${40 + k * 10}" width="30" height="120" rx="4" fill="${cyl(s, '#E6EAF0')}"/>`;
    g += `<rect x="54" y="96" width="148" height="124" rx="12" fill="${s.lin(['#4ADB9A', '#1A9A6A'], 0, 0, 1, 1)}" filter="${s.puff({ d: 8, blur: 9, darkOp: 0.28 })}"/>`;
    g += `<rect x="54" y="140" width="148" height="34" fill="#FFFFFF" opacity=".95"/>${txt(128, 164, 'GUM', 20, '#1A9A6A', { font: 'Arial Black' })}`;
    return g + gloss(s, 80, 150, 6, 40, 0, 0.5) + '</g>';
  }),
  mints: () => plain(s => {
    let g = '';
    g += `<ellipse cx="128" cy="170" rx="100" ry="46" fill="${s.lin(['#D8DEE6', '#8A96A6'])}"/>`;
    g += `<rect x="28" y="120" width="200" height="50" fill="${cyl(s, '#C8D0DA')}"/>`;
    g += `<ellipse cx="128" cy="120" rx="100" ry="46" fill="${s.rad(['#8AE0F8', '#2A9AD8', '#1A6AA8'], 0.4, 0.35, 0.8)}" filter="${s.puff({ d: 6, blur: 7, darkOp: 0.25 })}"/>`;
    g += `<ellipse cx="128" cy="120" rx="80" ry="34" fill="none" stroke="#FFFFFF" stroke-width="4" opacity=".8"/>${txt(128, 128, 'MINTS', 24, '#FFFFFF', { font: 'Arial Black' })}`;
    g += `<circle cx="196" cy="206" r="18" fill="${s.rad(['#FFFFFF', '#DDE8F0'])}" filter="${s.puff({ d: 3, blur: 3, darkOp: 0.2 })}"/><circle cx="160" cy="218" r="16" fill="${s.rad(['#FFFFFF', '#DDE8F0'])}" filter="${s.puff({ d: 3, blur: 3, darkOp: 0.2 })}"/>`;
    return g + gloss(s, 90, 100, 30, 9, -10, 0.6);
  }),
  halls: () => plain(s => {
    let g = '<g transform="rotate(-30 128 128)">';
    g += `<rect x="30" y="92" width="196" height="72" rx="30" fill="${cyl(s, '#1A1A2A')}" filter="${s.puff({ d: 6, blur: 7, darkOp: 0.25 })}"/>`;
    g += `<rect x="30" y="92" width="44" height="72" rx="30" fill="${cyl(s, '#C8202E')}"/><rect x="182" y="92" width="44" height="72" rx="30" fill="${cyl(s, '#C8202E')}"/>`;
    g += txt(128, 138, 'HALLS', 26, '#FFFFFF', { font: 'Arial Black' });
    g += gloss(s, 128, 104, 70, 5, 0, 0.45);
    g += '</g>';
    g += `<ellipse cx="190" cy="200" rx="26" ry="20" fill="${s.rad(['#FF8A8A', '#C8202E', '#8A0A1A'])}" filter="${s.puff({ d: 3, blur: 3, darkOp: 0.25 })}"/><ellipse cx="184" cy="194" rx="8" ry="4" fill="#fff" opacity=".6"/>`;
    return g;
  }),
};
export default ICONS;
