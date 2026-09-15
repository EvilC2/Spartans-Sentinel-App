// Sentinel — bell schedules, from the "2026-2027 Sentinel Bell Schedule" PDF
// (westvancouverschools.ca, Sep 2026).
// Three timetables: FIT day (Mon/Thu), non-FIT day (Tue/Wed/Fri), and
// Collaboration Day. Which one applies is decided by the calendar day's kind
// and rotation code, not by weekday, so sync days and holidays stay correct.

import { CalDay, parseCode } from './calendar';
import type { Course, Slot } from './ProfileContext';

export type PeriodKind = 'block' | 'fit' | 'break' | 'lunch' | 'collab' | 'transition';

export type Period = {
  kind: PeriodKind;
  label: string;
  start: string; // "HH:MM" 24h
  end: string;
};

export type BellName = 'fit' | 'regular' | 'collab';

export const BELL: Record<BellName, { name: string; periods: Period[] }> = {
  fit: {
    name: 'FIT day',
    periods: [
      { kind: 'block',      label: 'Block',      start: '08:30', end: '09:40' },
      { kind: 'break',      label: 'Break',      start: '09:40', end: '09:55' },
      { kind: 'block',      label: 'Block',      start: '09:55', end: '11:05' },
      { kind: 'fit',        label: 'FIT',        start: '11:05', end: '11:50' },
      { kind: 'block',      label: 'Block',      start: '11:50', end: '13:00' },
      { kind: 'lunch',      label: 'Lunch',      start: '13:00', end: '13:45' },
      { kind: 'block',      label: 'Block',      start: '13:45', end: '14:55' },
    ],
  },
  regular: {
    name: 'Regular day',
    periods: [
      { kind: 'block',      label: 'Block',      start: '08:30', end: '09:50' },
      { kind: 'transition', label: 'Transition', start: '09:50', end: '10:00' },
      { kind: 'block',      label: 'Block',      start: '10:00', end: '11:20' },
      { kind: 'break',      label: 'Break',      start: '11:20', end: '11:35' },
      { kind: 'block',      label: 'Block',      start: '11:35', end: '12:55' },
      { kind: 'lunch',      label: 'Lunch',      start: '12:55', end: '13:40' },
      { kind: 'block',      label: 'Block',      start: '13:40', end: '15:00' },
    ],
  },
  collab: {
    name: 'Collaboration day',
    periods: [
      { kind: 'collab',     label: 'Staff collaboration · students start 9:25', start: '08:30', end: '09:25' },
      { kind: 'block',      label: 'Block',      start: '09:25', end: '10:30' },
      { kind: 'break',      label: 'Break',      start: '10:30', end: '10:35' },
      { kind: 'block',      label: 'Block',      start: '10:35', end: '11:40' },
      { kind: 'break',      label: 'Break',      start: '11:40', end: '11:55' },
      { kind: 'block',      label: 'Block',      start: '11:55', end: '13:00' },
      { kind: 'lunch',      label: 'Lunch',      start: '13:00', end: '13:45' },
      { kind: 'block',      label: 'Block',      start: '13:45', end: '14:55' },
    ],
  },
};

// A period with the student's course attached (for block slots).
export type PlanPeriod = Period & {
  block?: 1 | 2 | 3 | 4;
  slot?: Slot;         // e.g. '2-3' — Day 2, Block 3
  course?: Course;
};

export type DayPlan = {
  bell: BellName;
  bellName: string;
  dayNum: 1 | 2;
  code: string;
  periods: PlanPeriod[];
  blocks: PlanPeriod[]; // only block + fit slots, in order
  early?: string;
  fitStart?: string;    // "HH:MM" when the day has a FIT block
};

export const bellFor = (day: CalDay): BellName | null => {
  if (!day.code) return null;
  if (day.kind === 'collab') return 'collab';
  if (day.code.includes('F')) return 'fit';
  return 'regular';
};

// Lay the rotation code's slots over the bell schedule.
// "2-23F14" on a FIT day → [B2, B3, FIT, B1, B4] fill the block/fit periods in order,
// and Day 2's digits map to the student's 2-x courses (2-2, 2-3, 2-1, 2-4).
export const buildDayPlan = (day: CalDay | undefined, courses: Course[]): DayPlan | null => {
  if (!day || !day.code) return null;
  const bell = bellFor(day)!;
  const { dayNum, slots } = parseCode(day.code);
  const digits = slots.filter(s => s !== 'F');
  let di = 0;
  const periods: PlanPeriod[] = BELL[bell].periods.map(p => {
    if (p.kind === 'block') {
      const block = Number(digits[di++]) as 1 | 2 | 3 | 4;
      const slot = `${dayNum}-${block}` as Slot;
      const course = courses.find(c => c.slot === slot);
      return { ...p, label: `Block ${slot}`, block, slot, course };
    }
    return { ...p };
  });
  // Early-dismissal days: trim everything after the cut-off.
  let out = periods;
  if (day.early) {
    const cut = toMin(day.early);
    out = periods.filter(p => toMin(p.start) < cut).map(p => toMin(p.end) > cut ? { ...p, end: day.early! } : p);
  }
  return {
    bell, bellName: BELL[bell].name, dayNum, code: day.code,
    periods: out,
    blocks: out.filter(p => p.kind === 'block' || p.kind === 'fit'),
    early: day.early,
    fitStart: out.find(p => p.kind === 'fit')?.start,
  };
};

// ── time helpers ────────────────────────────────────────────────
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fmt12 = (hhmm: string, withSuffix = false) => {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, '0');
  return withSuffix ? `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}` : `${h12}:${mm}`;
};

// "mm:ss" countdown from a number of seconds, e.g. 1082 → "18:02".
export const fmtCountdown = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
