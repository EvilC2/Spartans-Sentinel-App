// Sentinel — student ID card scanning helpers.
//
// The physical card (Artona, 2024/25 layout) reads:
//   ÉCOLE SECONDAIRE SENTINEL SECONDARY SCHOOL / PRINCIPAL: MR. M. FINCH
//   BROWNHILL, CLIVE
//   GR: 10   HR: TAKJ-262   STU #: 1284456
//   STUDENT IDENTIFICATION 2024/2025
//   Code-39 barcode of the student number along the bottom.
// Back: QR code → artona.com portrait page, "ID: 1284456".
//
// Three free pieces:
//   1. Student number — barcode via expo-camera (works in Expo Go).
//   2. Name / grade / homeroom — on-device OCR via expo-text-extractor
//      (Apple Vision on iOS, ML Kit on Android). Needs a dev build; in Expo Go
//      the native module is missing, so `ocrAvailable` is false and we only
//      get the barcode.
//   3. Photo — expo-image-picker, copied into the document directory.

import { Platform } from 'react-native';
import { TEACHERS, Teacher, teacherLabel } from './catalog';

// ── OCR (optional native module) ─────────────────────────────────
type OcrModule = { isSupported: boolean; extractTextFromImage: (uri: string) => Promise<string[]> };
let ocr: OcrModule | null = null;
try {
  // Throws in Expo Go / on web, where the native module is not bundled.
  const m = require('expo-text-extractor');
  if (m && typeof m.extractTextFromImage === 'function' && m.isSupported) ocr = m;
} catch { ocr = null; }

export const ocrAvailable = !!ocr;

/** Recognised text lines, or null when OCR is not available on this build. */
export async function recognizeText(uri: string): Promise<string[] | null> {
  if (!ocr) return null;
  try { return await ocr.extractTextFromImage(uri); } catch { return null; }
}

// ── Parsing ──────────────────────────────────────────────────────
export type ScannedCard = {
  studentId?: string;
  lastName?: string;
  firstName?: string;
  grade?: number;
  hrCode?: string;      // "TAKJ"
  hrRoom?: string;      // "262"
  hrTeacher?: string;   // "Takahashi, Julie" when the code maps to the catalog
  year?: string;        // "2024/2025"
};

export const isStudentNumber = (s: string) => /^\d{6,8}$/.test(s.trim());

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

// Fix the OCR confusions that matter for the fields we read.
const fixDigits = (s: string) => s.replace(/[OoDQ]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');

export function parseCardText(lines: string[]): ScannedCard {
  const out: ScannedCard = {};
  const text = lines.map(l => l.trim()).filter(Boolean);
  const joined = text.join('\n');

  // "STU #: 1284456" — tolerate "STU#", "STU  # :", "5TU", "STU N".
  const stu = joined.match(/S?TU\s*[#N№]?\s*[:.]?\s*([0-9OoDQIl|SsB]{6,8})\b/i);
  if (stu) { const d = fixDigits(stu[1]); if (isStudentNumber(d)) out.studentId = d; }

  // "GR: 10"
  const gr = joined.match(/\bGR\s*[:.]?\s*([0-9OoIl|]{1,2})\b/i);
  if (gr) { const g = Number(fixDigits(gr[1])); if (g >= 8 && g <= 12) out.grade = g; }

  // "HR: TAKJ-262"
  const hr = joined.match(/\bHR\s*[:.]?\s*([A-Z]{2,6})\s*[-–—]?\s*([0-9OoIl|]{2,4})\b/i);
  if (hr) {
    out.hrCode = hr[1].toUpperCase();
    out.hrRoom = fixDigits(hr[2]);
    const t = teacherFromCode(out.hrCode);
    if (t) out.hrTeacher = teacherLabel(t);
  }

  // "2024/2025"
  const yr = joined.match(/\b(20\d{2})\s*\/\s*(20\d{2})\b/);
  if (yr) out.year = `${yr[1]}/${yr[2]}`;

  // "BROWNHILL, CLIVE" — the one all-caps "LAST, FIRST" line that is not the school name.
  for (const l of text) {
    const m = l.match(/^([A-ZÀ-Ý][A-ZÀ-Ý' -]{1,30}),\s*([A-ZÀ-Ý][A-ZÀ-Ý' -]{0,30})$/);
    if (!m) continue;
    if (/SCHOOL|SECONDARY|PRINCIPAL|SENTINEL|IDENTIFICATION/.test(l)) continue;
    out.lastName = titleCase(m[1].trim());
    out.firstName = titleCase(m[2].trim().split(/\s+/)[0]);
    break;
  }
  return out;
}

// Homeroom code on the card is the teacher's last-name prefix + first initial:
// "TAKJ" → Takahashi, Julie. Try 3-letter + initial first, then shorter/longer.
export function teacherFromCode(code: string): Teacher | undefined {
  const c = code.toUpperCase().replace(/[^A-Z]/g, '');
  if (c.length < 2) return undefined;
  const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
  for (const n of [c.length - 1, c.length - 2, c.length]) {
    if (n < 2 || n > c.length) continue;
    const prefix = c.slice(0, n);
    const initial = c[n];
    const hits = TEACHERS.filter(t => norm(t.last).startsWith(prefix) && (!initial || norm(t.first)[0] === initial));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1 && !initial) return hits[0];
  }
  return undefined;
}

// The reverse: what the card would print for a saved homeroom teacher.
export function codeForTeacher(teacher: string): string {
  const t = teacher.trim();
  if (!t) return '';
  const [last, first] = t.includes(',') ? t.split(',').map(s => s.trim()) : [t.split(/\s+/).pop() || t, ''];
  const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
  return norm(last).slice(0, 3) + (norm(first)[0] || '');
}

// ── Photo persistence ────────────────────────────────────────────
// Picker results live in a cache the OS may purge; copy into the app's
// document directory so the card still has a face after a restart.
export async function persistPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return uri;
  try {
    const { File, Paths } = require('expo-file-system');
    const dest = new File(Paths.document, `id-photo-${Date.now()}.jpg`);
    new File(uri).copy(dest);
    return dest.uri as string;
  } catch {
    return uri;
  }
}

// ── Code 39 ──────────────────────────────────────────────────────
// Real, scannable Code 39 (what the physical card uses). Each symbol is 9
// elements, 3 wide; "1" = wide. Returns bar/space widths in module units.
const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', '*': '010010100', '-': '010000101',
  ' ': '011000000', '.': '110000100', '$': '010101000', '/': '010100010',
  '+': '010001010', '%': '000101010',
  A: '100001001', B: '001001001', C: '101000001', D: '000011001', E: '100010001',
  F: '001010001', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
  K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010',
  P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
  U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
  Z: '011010000',
};

export type BarcodeBar = { x: number; w: number };

/** Bars (x, width) for `*value*` in module units, plus total width. */
export function code39(value: string, narrow = 1, wide = 2.6): { bars: BarcodeBar[]; width: number } {
  const v = `*${value.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '')}*`;
  const bars: BarcodeBar[] = [];
  let x = 0;
  for (const ch of v) {
    const pat = CODE39[ch] || CODE39['-'];
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === '1' ? wide : narrow;
      if (i % 2 === 0) bars.push({ x, w });   // even index = bar, odd = space
      x += w;
    }
    x += narrow; // inter-character gap
  }
  return { bars, width: x - narrow };
}
