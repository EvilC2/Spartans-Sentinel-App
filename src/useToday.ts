// Sentinel — "now" for the app.
// Uses the device clock while the date falls inside the 2026–2027 school year.
// Outside it (summer, or a later year) it falls back to a demo moment so the
// home screen still has live-looking context: Thu Sep 17 2026, 9:32 AM.
// The TEMPORARY preview offset (src/PreviewTime.tsx) is applied on top.

import { useEffect, useMemo, useState } from 'react';
import { CALENDAR, CalDay, inSchoolYear, toISO } from './calendar';
import { buildDayPlan, DayPlan, PlanPeriod, toMin } from './bell';
import type { Course } from './ProfileContext';
import { usePreviewTime } from './PreviewTime';
import { useDevAccess } from './devAccess';

export const DEMO_NOW = new Date(2026, 8, 17, 9, 32);

export const resolveNow = (real: Date = new Date(), offsetMs = 0) => {
  const shifted = offsetMs ? new Date(real.getTime() + offsetMs) : real;
  return inSchoolYear(toISO(shifted)) ? shifted : DEMO_NOW;
};

// Ticks every second so the countdown can show mm:ss.
export const useNow = () => {
  const { offsetMs } = usePreviewTime();
  const [now, setNow] = useState(() => resolveNow(new Date(), offsetMs));
  useEffect(() => {
    setNow(resolveNow(new Date(), offsetMs));
    const id = setInterval(() => setNow(resolveNow(new Date(), offsetMs)), 1000);
    return () => clearInterval(id);
  }, [offsetMs]);
  return now;
};

// The same clock for screens that only show minutes: it re-renders them once a
// minute, not once a second (which made typing on them stutter).
export const useMinute = () => {
  const { offsetMs } = usePreviewTime();
  const [now, setNow] = useState(() => resolveNow(new Date(), offsetMs));
  useEffect(() => {
    const tick = () => setNow(prev => {
      const next = resolveNow(new Date(), offsetMs);
      return Math.floor(prev.getTime() / 60_000) === Math.floor(next.getTime() / 60_000) ? prev : next;
    });
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offsetMs]);
  return now;
};

export type TodayState = {
  now: Date;
  iso: string;
  isDemo: boolean;
  isPreview: boolean;
  cal: CalDay | undefined;
  plan: DayPlan | null;
  currentIndex: number;         // index into plan.periods, -1 before school, periods.length after
  current: PlanPeriod | null;
  next: PlanPeriod | null;      // next period (any kind)
  nextBlock: PlanPeriod | null; // next block/fit slot after the current one
  minsToChange: number | null;  // whole minutes until current period ends (or first begins)
  secsToChange: number | null;  // same, in seconds — for the mm:ss countdown
  progress: number;             // 0–1 through the current period
  phase: 'before' | 'during' | 'after' | 'none';
};

export const computeToday = (now: Date, courses: Course[], isPreview = false): TodayState => {
  const iso = toISO(now);
  const cal = CALENDAR[iso];
  const plan = buildDayPlan(cal, courses);
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const nowMin = nowSec / 60;
  const isDemo = now === DEMO_NOW;

  if (!plan) {
    return {
      now, iso, isDemo, isPreview, cal, plan: null,
      currentIndex: -1, current: null, next: null, nextBlock: null,
      minsToChange: null, secsToChange: null, progress: 0, phase: 'none',
    };
  }

  const ps = plan.periods;
  let idx = ps.findIndex(p => nowMin >= toMin(p.start) && nowMin < toMin(p.end));
  let phase: TodayState['phase'] = 'during';
  if (idx === -1) {
    if (nowMin < toMin(ps[0].start)) { idx = -1; phase = 'before'; }
    else { idx = ps.length; phase = 'after'; }
  }
  const current = phase === 'during' ? ps[idx] : null;
  const next = phase === 'before' ? ps[0] : ps[idx + 1] || null;
  const nextBlock = ps.slice(phase === 'before' ? 0 : idx + 1).find(p => p.kind === 'block' || p.kind === 'fit') || null;
  const secsToChange =
    phase === 'during' ? toMin(current!.end) * 60 - nowSec
    : phase === 'before' ? toMin(ps[0].start) * 60 - nowSec
    : null;
  const minsToChange = secsToChange === null ? null : Math.ceil(secsToChange / 60);
  const progress = current
    ? (nowMin - toMin(current.start)) / (toMin(current.end) - toMin(current.start))
    : phase === 'after' ? 1 : 0;

  return {
    now, iso, isDemo, isPreview, cal, plan,
    currentIndex: idx, current, next, nextBlock, minsToChange, secsToChange, progress, phase,
  };
};

export const useToday = (courses: Course[]) => {
  const now = useNow();
  const { active } = usePreviewTime();
  const devAccess = useDevAccess();
  return useMemo(() => {
    const t = computeToday(now, courses, active);
    return devAccess ? t : { ...t, isDemo: false };   // the "demo date" label is owner only
  }, [now, courses, active, devAccess]);
};

// ── formatting ───────────────────────────────────────────────────
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtWeekday = (d: Date) => DOW[d.getDay()];
export const fmtMonthDay = (d: Date) => `${MONTH[d.getMonth()]} ${d.getDate()}`;
export const fmtLong = (d: Date) => `${DOW[d.getDay()]} · ${MON[d.getMonth()]} ${d.getDate()}`;
export const fmtShort = (d: Date) => `${DOW[d.getDay()].slice(0, 3)} ${MON[d.getMonth()]} ${d.getDate()}`;
export const fmtClock = (d: Date) => {
  const h = d.getHours(), m = d.getMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const greeting = (d: Date) => {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// The next day with classes after `now`'s date: tomorrow on a school night, Monday
// on a weekend, the first day back after a break. Its state is worked out for
// midnight, so every block reads as still to come. null if none within `max` days.
export type SchoolDayAhead = { date: Date; days: number; when: string; t: TodayState & { plan: DayPlan } };
export const nextSchoolDay = (now: Date, courses: Course[], max = 30): SchoolDayAhead | null => {
  for (let i = 1; i <= max; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const t = computeToday(date, courses);
    if (!t.plan) continue;
    // "Tomorrow", a weekday name within the week, then just "Next".
    const when = i === 1 ? 'Tomorrow' : i < 7 ? DOW[date.getDay()] : 'Next';
    return { date, days: i, when, t: t as SchoolDayAhead['t'] };
  }
  return null;
};
