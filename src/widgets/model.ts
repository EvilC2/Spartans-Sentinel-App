// Spartans — what the widgets and the class Live Activity show, worked out in
// the app. Widget code runs in an isolated runtime with no access to the
// calendar, bell schedule or the student's courses, so everything is resolved
// here into plain JSON props.
//
// The rotation and bell times are fixed and known ahead, so the Today and
// Class widgets get a timeline with one entry per bell change for the next
// couple of weeks: they keep stepping through the day on their own, even if
// the app isn't opened. Timers inside an entry (the mm:ss countdown, the
// progress bar) are drawn live by iOS.

import { CALENDAR, toISO, fromISO, upcomingEvents } from '../calendar';
import { fmt12, toMin, PlanPeriod } from '../bell';
import { computeToday } from '../useToday';
import { shortName, teacherShort, roomLabel, roomShort, Course } from '../ProfileContext';
import type { HomeworkItem } from '../programs';

// ── Today / Class / Live Activity ────────────────────────────────

export type TodayMode = 'class' | 'gap' | 'before' | 'after' | 'off';

export type TodayProps = {
  date: string;            // "Tuesday · Nov 17"
  headline: string;        // "Day 2", or the day's label ("Weekend", "Remembrance Day")
  dayNum: number;          // 1 | 2, 0 when there are no classes
  code: string;            // rotation code "2-23F14", '' when none
  mode: TodayMode;
  // The one square left from the home card: the class that is on, or the one
  // coming up. null after school and on days off.
  tile: null | { top: string; name: string; time: string; now: boolean };
  eyebrow: string;         // "In progress", "Lunch · up next", "First up", "School's out"
  title: string;           // "Chemistry 11"
  short: string;           // "Chem 11" (lock screen, Dynamic Island)
  sub: string;             // "Room 213 · Smith"
  room: string;            // "Rm 213"
  start: number;           // ms; countdown / progress bar run start → end. 0 = no timer
  end: number;
  until: string;           // "11:05" — when the countdown runs out
  footer: string;          // "Next · Eng 12 at 11:50" / next school day
  later: { time: string; name: string; sub: string }[]; // rest of the day (large widget)
  // Every block of the day, like the Home card's row of tiles.
  tiles: { top: string; name: string; state: 'done' | 'now' | 'next' }[];
  // Friends in the focus block: "with Alex & Sam", "Spare with Alex". '' = none.
  together: string;
};

// Who you share a block with (a class, or a spare you both have). Worked out
// by the app from friends (src/social.ts → togetherLabel), passed in here.
export type TogetherFor = (p: PlanPeriod) => string;
const nobody: TogetherFor = () => '';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d: Date) => `${DOW[d.getDay()]} · ${MON[d.getMonth()]} ${d.getDate()}`;
const shortDate = (d: Date) => `${DOW[d.getDay()].slice(0, 3)} ${MON[d.getMonth()]} ${d.getDate()}`;

const at = (day: Date, hhmm: string) => {
  const m = toMin(hhmm);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60, 0, 0);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const courseName = (p: PlanPeriod) =>
  p.kind === 'fit' ? 'FIT' : p.course?.name || `Block ${p.slot || p.block}`;
const courseShort = (p: PlanPeriod) =>
  p.kind === 'fit' ? 'FIT' : (p.course ? shortName(p.course.name) : '') || `Blk ${p.slot || p.block}`;
const courseSub = (p: PlanPeriod) =>
  p.kind === 'fit' ? 'Flexible instructional time'
  : [p.course?.room ? roomLabel(p.course.room) : null, p.course?.teacher ? teacherShort(p.course.teacher) : null].filter(Boolean).join(' · ');
const periodName = (p: PlanPeriod) =>
  p.kind === 'block' || p.kind === 'fit' ? courseShort(p) : p.kind === 'collab' ? 'Late start' : p.label;

// First class of the next school day after `day`, for evenings and days off.
const nextSchoolDay = (day: Date, courses: Course[]) => {
  for (let i = 1; i <= 30; i++) {
    const d = addDays(day, i);
    const t = computeToday(at(d, '00:00'), courses);
    if (!t.plan) continue;
    const first = t.plan.blocks[0];
    const when = i === 1 ? 'Tomorrow' : DOW[d.getDay()];
    return {
      title: `${when} · Day ${t.plan.dayNum}`,
      sub: first ? `First up ${courseShort(first)} at ${fmt12(first.start)}` : '',
    };
  }
  return null;
};

const tilesOf = (t: ReturnType<typeof computeToday>): TodayProps['tiles'] => {
  if (!t.plan) return [];
  return t.plan.blocks.map(b => {
    const idx = t.plan!.periods.indexOf(b);
    const state = t.phase === 'after' || idx < t.currentIndex ? 'done' : idx === t.currentIndex ? 'now' : 'next';
    return { top: b.kind === 'fit' ? 'FLEX' : String(b.slot || ''), name: courseShort(b), state };
  });
};

export const todayProps = (now: Date, courses: Course[], together: TogetherFor = nobody): TodayProps => {
  const t = computeToday(now, courses);
  const { plan, cal } = t;
  const base = { date: dayLabel(now), later: [] as TodayProps['later'], tiles: tilesOf(t), together: '' };

  if (!plan || t.phase === 'after') {
    const ahead = nextSchoolDay(now, courses);
    const after = !!plan;
    return {
      ...base,
      headline: plan ? `Day ${plan.dayNum}` : (cal?.label || (cal?.kind === 'weekend' ? 'Weekend' : 'No school')),
      dayNum: plan?.dayNum || 0,
      code: plan?.code || '',
      mode: after ? 'after' : 'off',
      tile: null,
      eyebrow: after ? "School's out" : 'No classes today',
      title: ahead?.title || 'Enjoy the break',
      short: ahead?.title || '',
      sub: ahead?.sub || '',
      room: '',
      start: 0, end: 0, until: '',
      footer: cal?.events?.[0] || '',
    };
  }

  const inClass = !!t.current && (t.current.kind === 'block' || t.current.kind === 'fit');
  const focus = inClass ? t.current! : t.nextBlock;
  const mode: TodayMode = inClass ? 'class' : t.phase === 'before' ? 'before' : 'gap';
  const gapName = t.current ? (t.current.kind === 'collab' ? 'Late start' : t.current.label) : '';
  const eyebrow = mode === 'class' ? 'In progress' : mode === 'before' ? 'First up' : `${gapName} · up next`;

  // Countdown: end of the period that is on, or the first bell before school.
  const target = t.phase === 'during' ? t.current! : plan.periods[0];
  const day = midnight(now);
  const endAt = at(day, t.phase === 'before' ? target.start : target.end).getTime();
  const startAt = t.phase === 'before' ? now.getTime() : at(day, target.start).getTime();

  // What follows: during class, the next period of any kind (like Home);
  // in a gap, the block after the one coming up.
  let footer = '';
  if (mode === 'class') {
    // The 10-minute transition isn't worth a line: name what comes after it.
    const i = plan.periods.indexOf(t.current!);
    const next = plan.periods.slice(i + 1).find(p => p.kind !== 'transition');
    footer = !next ? 'Last block of the day' : `Next · ${periodName(next)} at ${fmt12(next.start)}`;
  } else if (focus) {
    const i = plan.periods.indexOf(focus);
    const then = plan.periods.slice(i + 1).find(p => p.kind === 'block' || p.kind === 'fit');
    footer = then ? `Then · ${periodName(then)} at ${fmt12(then.start)}` : 'Last block of the day';
  }

  const fromIdx = focus ? plan.periods.indexOf(focus) + 1 : plan.periods.length;
  const later = plan.periods.slice(fromIdx).map(p => ({
    time: fmt12(p.start),
    name: p.kind === 'block' || p.kind === 'fit' ? courseName(p) : periodName(p),
    sub: p.kind === 'block' && p.course?.room ? roomShort(p.course.room) : '',
  }));

  return {
    ...base,
    headline: `Day ${plan.dayNum}`,
    dayNum: plan.dayNum,
    code: plan.code,
    mode,
    tile: focus ? {
      top: focus.kind === 'fit' ? 'FLEX' : String(focus.slot || ''),
      name: courseShort(focus),
      time: fmt12(focus.start),
      now: mode === 'class',
    } : null,
    eyebrow,
    title: focus ? courseName(focus) : gapName,
    short: focus ? courseShort(focus) : gapName,
    sub: focus ? courseSub(focus) : '',
    room: focus?.course?.room ? roomShort(focus.course.room) : '',
    start: startAt,
    end: endAt,
    until: fmt12(t.phase === 'before' ? target.start : target.end),
    footer,
    later,
    together: focus ? together(focus) : '',
  };
};

// Every moment the Today card changes over the next `days` days: midnight,
// and each bell (start and end of every period).
export const todayTimeline = (now: Date, courses: Course[], together: TogetherFor = nobody, days = 10) => {
  const stamps = new Set<number>([now.getTime()]);
  for (let i = 0; i < days; i++) {
    const d = addDays(now, i);
    if (i > 0) stamps.add(midnight(d).getTime());
    const plan = computeToday(at(d, '00:00'), courses).plan;
    plan?.periods.forEach(p => {
      stamps.add(at(d, p.start).getTime());
      stamps.add(at(d, p.end).getTime());
    });
  }
  return [...stamps]
    .filter(s => s >= now.getTime())
    .sort((a, b) => a - b)
    .map(s => ({ date: new Date(s), props: todayProps(new Date(s), courses, together) }));
};

// When the Live Activity should be on the Lock Screen: from an hour before
// the first bell until the last class ends.
export const LIVE_LEAD_MIN = 60;
export const liveWindow = (now: Date, courses: Course[]) => {
  const plan = computeToday(now, courses).plan;
  if (!plan) return null;
  const day = midnight(now);
  const open = at(day, plan.periods[0].start).getTime() - LIVE_LEAD_MIN * 60_000;
  const close = at(day, plan.periods[plan.periods.length - 1].end).getTime();
  return { open, close, on: now.getTime() >= open && now.getTime() < close };
};

// ── Homework ─────────────────────────────────────────────────────

export type HomeworkProps = {
  open: number;     // not done
  urgent: number;   // overdue or due today
  items: { title: string; cls: string; due: string; tone: 'late' | 'today' | 'soon' | 'later' }[];
};

const dueLabel = (iso: string, todayIso: string, today: Date): { due: string; tone: HomeworkProps['items'][number]['tone'] } => {
  if (iso < todayIso) return { due: 'Overdue', tone: 'late' };
  if (iso === todayIso) return { due: 'Today', tone: 'today' };
  const d = fromISO(iso);
  const diff = Math.round((d.getTime() - midnight(today).getTime()) / 86_400_000);
  if (diff === 1) return { due: 'Tomorrow', tone: 'soon' };
  if (diff < 7) return { due: DOW[d.getDay()].slice(0, 3), tone: 'later' };
  return { due: `${MON[d.getMonth()]} ${d.getDate()}`, tone: 'later' };
};

export const homeworkProps = (now: Date, items: HomeworkItem[], courses: Course[]): HomeworkProps => {
  const iso = toISO(now);
  const open = items
    .filter(h => !h.done)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.time || '99').localeCompare(b.time || '99'));
  return {
    open: open.length,
    urgent: open.filter(h => h.due <= iso).length,
    items: open.slice(0, 5).map(h => {
      const k = h.slot ? courses.find(c => c.slot === h.slot) : undefined;
      const cls = h.program || k?.name || '';
      return { title: h.title, cls: cls ? shortName(cls) : 'Unsorted', ...dueLabel(h.due, iso, now) };
    }),
  };
};

// "Today" / "Tomorrow" / "Overdue" shift at midnight, so one entry per day.
export const homeworkTimeline = (now: Date, items: HomeworkItem[], courses: Course[], days = 7) =>
  Array.from({ length: days }, (_, i) => (i === 0 ? now : midnight(addDays(now, i))))
    .map(d => ({ date: d, props: homeworkProps(d, items, courses) }));

// ── Up ahead: next day off and the next few school events ────────

export type UpAheadProps = {
  today: string;   // "Day 2" or "No school"
  off: null | { title: string; when: string; date: string; days: number };
  events: { date: string; title: string }[];
};

const OFF_KINDS = new Set(['holiday', 'prod', 'break', 'noclass']);
const OFF_NAMES: Record<string, string> = { holiday: 'Holiday', prod: 'Pro-D Day', break: 'Break', noclass: 'No classes' };

export const upAheadProps = (now: Date, courses: Course[]): UpAheadProps => {
  const t = computeToday(at(now, '00:00'), courses);
  let off: UpAheadProps['off'] = null;
  for (let i = 1; i <= 120 && !off; i++) {
    const d = addDays(now, i);
    const cal = CALENDAR[toISO(d)];
    if (!cal || !OFF_KINDS.has(cal.kind)) continue;
    const title = (cal.label || cal.events?.[0]?.split(' · ')[0] || OFF_NAMES[cal.kind]).replace(/ · .*/, '');
    off = { title, days: i, when: i === 1 ? 'Tomorrow' : `in ${i} days`, date: shortDate(d) };
  }
  const tomorrow = toISO(addDays(now, 1));
  return {
    today: t.plan ? `Day ${t.plan.dayNum}` : 'No school',
    off,
    // FIT times repeat twice a week; they're not news.
    events: upcomingEvents(tomorrow, 12, 30).filter(e => !/^FIT\b/.test(e.title)).slice(0, 4).map(e => ({ date: e.date, title: e.title })),
  };
};

export const upAheadTimeline = (now: Date, courses: Course[], days = 14) =>
  Array.from({ length: days }, (_, i) => (i === 0 ? now : midnight(addDays(now, i))))
    .map(d => ({ date: d, props: upAheadProps(d, courses) }));
