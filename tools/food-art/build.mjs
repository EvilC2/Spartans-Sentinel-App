// Render the icons in icons.mjs to PNG with headless Chrome.
//   node tools/food-art/build.mjs                 -> all icons into assets/food
//   node tools/food-art/build.mjs --only a,b      -> just these
//   node tools/food-art/build.mjs --sheet x.png   -> also write a labelled contact sheet
// Needs Google Chrome and ImageMagick (`magick`).
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ICONS from './icons.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const only = arg('--only')?.split(',');
const out = arg('--out') ?? join(here, '../../assets/food');
const sheet = arg('--sheet');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const names = Object.keys(ICONS).filter(n => !only || only.includes(n));
const tmp = join(here, '.build'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp);
mkdirSync(out, { recursive: true });

const COLS = 8, CELL = 256, SCALE = 2;
for (const n of names) writeFileSync(join(tmp, `${n}.svg`), ICONS[n]());
const rows = Math.ceil(names.length / COLS);
writeFileSync(join(tmp, 'grid.html'), `<html><body style="margin:0;background:transparent;display:grid;grid-template-columns:repeat(${COLS},${CELL}px);grid-auto-rows:${CELL}px">${names.map(n => `<img src="${n}.svg" width="${CELL}" height="${CELL}">`).join('')}</body></html>`);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
  '--default-background-color=00000000', `--force-device-scale-factor=${SCALE}`,
  `--window-size=${COLS * CELL},${rows * CELL}`, `--screenshot=${join(tmp, 'grid.png')}`,
  'file://' + join(tmp, 'grid.html')], { stdio: 'ignore' });
execFileSync('magick', [join(tmp, 'grid.png'), '-crop', `${CELL * SCALE}x${CELL * SCALE}`, '+repage', '+adjoin', join(tmp, 'tile-%03d.png')]);
names.forEach((n, i) => {
  execFileSync('magick', [join(tmp, `tile-${String(i).padStart(3, '0')}.png`), '-filter', 'Lanczos', '-resize', `${CELL}x${CELL}`, '-strip', join(out, `${n}.png`)]);
});
if (sheet) {
  execFileSync('magick', ['montage', '-label', '%t', ...names.map(n => join(out, `${n}.png`)), '-tile', '10x', '-geometry', '96x96+6+14', '-pointsize', '11', '-background', '#f4f4f4', sheet]);
}
console.log(`rendered ${names.length} icons -> ${out}`);
