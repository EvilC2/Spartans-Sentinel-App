// Spartans — Programs. One list of everything a student is part of: their
// classes (from the timetable), extracurriculars, clubs, sports and real
// programs (French Immersion, exchanges). Programs drive the calendar, the
// announcements filter and homework: a homework due date is a calendar event
// whose source is a program, and an announcement that mentions a program shows
// up on that program's page.
//
//   programsFor(profile)          every program the student is in
//   matchPrograms(q, grade)       search the full catalog for "Add programs"
//   programHomework / programNews / programSchoolEvents   the feed for one page
//
// "Senior year" is deliberately not a program (SCOPE-v3): grad events come
// from the grade instead.

import S from './data';
import { COURSES, ACADEMIES, EXTRAS } from './catalog';
import { REAL_CLUBS } from './clubList';
import { CALENDAR, toISO, fromISO } from './calendar';
import { StudentProfile, Course, ExtraCourse, Slot, SLOT_COLORS } from './ProfileContext';

// Same key the grade book uses (stores.classKey); kept local so this module has no store import.
const classKey = (s: string) => s.trim().toLowerCase();

// Kind is the fine label; group is the section on the Programs tab.
//   Timetable classes          class
//   Outside timetable classes  outside (YELL, Careers, French Immersion…), online
//   Extracurriculars           sport, music (band, choir, orchestra), extra (theatre, dance, yearbook…)
//   Clubs                      club
export type ProgramKind = 'class' | 'outside' | 'online' | 'sport' | 'music' | 'extra' | 'club';
export type ExtraKind = Exclude<ProgramKind, 'class'>;
export type ProgramGroup = 'timetable' | 'outside' | 'extracurricular' | 'club';

export type Program = {
  id: string;            // 'p:' + classKey(name)
  name: string;
  kind: ProgramKind;
  teacher?: string;
  room?: string;
  slots: Slot[];         // timetable blocks (classes only)
  color: string;
  removable: boolean;    // extras can be removed from Programs; classes are edited on the timetable
};

export const GROUP_OF: Record<ProgramKind, ProgramGroup> = {
  class: 'timetable', outside: 'outside', online: 'outside', sport: 'extracurricular', music: 'extracurricular', extra: 'extracurricular', club: 'club',
};
export const GROUP_ORDER: ProgramGroup[] = ['timetable', 'outside', 'extracurricular', 'club'];
export const GROUP_LABEL: Record<ProgramGroup, string> = {
  timetable: 'Timetable classes', outside: 'Outside timetable classes', extracurricular: 'Extracurriculars', club: 'Clubs',
};
// Order inside a group: in-school before online, sports before band before the rest.
export const KIND_ORDER: ProgramKind[] = ['class', 'outside', 'online', 'sport', 'music', 'extra', 'club'];
export const KIND_ONE: Record<ProgramKind, string> = {
  class: 'Class', outside: 'Outside the timetable', online: 'Online course', sport: 'Sport', music: 'Band and music', extra: 'Extracurricular', club: 'Club',
};
export const KIND_COLOR: Record<ExtraKind, string> = {
  outside: '#B68842', online: '#8C5A2A', sport: '#5B7A4E', music: '#2A7A8C', extra: '#4E6B8C', club: '#7A4E8C',
};

// Older rows stored 'program' (French Immersion, exchanges); those are outside-timetable now.
const normalizeKind = (k: string | undefined): ExtraKind | undefined =>
  k === 'program' ? 'outside' : (k && k in KIND_COLOR ? k as ExtraKind : undefined);

export const programId = (name: string) => 'p:' + classKey(name);

// ── Catalog ─────────────────────────────────────────────────────
// Kind for anything outside the timetable. Order matters: "Sr. Boys Rugby"
// is a sport before it is anything else, "Robotics Club" is a club, "Concert
// Band" is music, YELL and French Immersion are classes outside the timetable.
const SPORT_RE = /basketball|soccer|rugby|volleyball|cross country|track|swim|tennis|golf|ultimate|hockey|badminton|ski|snowboard|baseball|fencing|academy|wrestling|rowing|lacrosse|curling|football|cheer/i;
const CLUB_RE = /club|model un|debate|chess|tutoring|newspaper|sentinel sun|interact|yearbook|committee|council|link crew|leadership/i;
const MUSIC_RE = /band|choir|orchestra|strings|jazz|music/i;
const OUTSIDE_RE = /immersion|exchange|yell|entrepreneur|career|ib\b|international|mentorship|work experience|online|distance/i;
const ONLINE_RE = /online|distance|\bdl\b/i;

// Sentinel's real clubs are clubs (or music) whatever their name says:
// "Football Club" and "Sentinel Badminton Community Club" aren't teams.
const REAL_KIND = new Map(REAL_CLUBS.map(c => [classKey(c.name), (c.kind || 'club') as ExtraKind]));

export const classifyName = (name: string): ExtraKind => {
  const real = REAL_KIND.get(classKey(name));
  if (real) return real;
  if (ONLINE_RE.test(name)) return 'online';
  if (SPORT_RE.test(name)) return 'sport';
  if (OUTSIDE_RE.test(name)) return 'outside';   // before CLUB_RE: "YELL … Leadership Launchpad" is a class
  if (CLUB_RE.test(name)) return 'club';
  if (MUSIC_RE.test(name)) return 'music';
  return 'extra';
};

export type CatalogEntry = { name: string; kind: ExtraKind };

// Extras and academies first (what "Add programs" is for), then every course
// as a class taken outside the timetable (YELL, Careers, an online course…).
// Any course can also be added as online: the kind chip in Add programs and
// the Online toggle in sign-up set that.
const seen = new Set<string>();
export const PROGRAM_CATALOG: CatalogEntry[] = [
  ...EXTRAS.map(n => ({ name: n, kind: classifyName(n) })),
  ...ACADEMIES.map(n => ({ name: n, kind: 'sport' as const })),
  ...COURSES.map(n => ({ name: n, kind: classifyName(n) === 'extra' || classifyName(n) === 'online' ? 'outside' as const : classifyName(n) })),
].filter(e => { const k = classKey(e.name); if (seen.has(k)) return false; seen.add(k); return true; });

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const courseGrade = (c: string) => { const m = c.match(/(\d+)/); return m ? Number(m[1]) : 0; };

// Word-prefix matches rank above substring matches; within a tier, extras and
// the student's own grade come first.
export const matchPrograms = (q: string, grade?: number, exclude: Set<string> = new Set()): CatalogEntry[] => {
  const s = norm(q.trim());
  const pool = PROGRAM_CATALOG.filter(e => !exclude.has(classKey(e.name)));
  if (!s) return pool.filter(e => e.kind !== 'outside' || !/\d/.test(e.name)).slice(0, 40);
  const starts: CatalogEntry[] = [], contains: CatalogEntry[] = [];
  for (const e of pool) {
    const n = norm(e.name);
    if (n.startsWith(s) || n.split(/[\s(]+/).some(w => w.startsWith(s))) starts.push(e);
    else if (n.includes(s)) contains.push(e);
  }
  const rank = (arr: CatalogEntry[]) => grade
    ? [...arr.filter(e => !courseGrade(e.name) || courseGrade(e.name) === grade), ...arr.filter(e => courseGrade(e.name) && courseGrade(e.name) !== grade)]
    : arr;
  return [...rank(starts), ...rank(contains)];
};

// ── The student's programs ──────────────────────────────────────
export const programsFor = (p: StudentProfile | null): Program[] => {
  if (!p) return [];
  const out: Program[] = [];
  const byKey = new Map<string, Program>();
  for (const k of p.courses) {
    if (k.spare || !k.name.trim()) continue;
    const key = classKey(k.name);
    const have = byKey.get(key);
    if (have) { have.slots.push(k.slot); continue; }
    const pr: Program = { id: 'p:' + key, name: k.name.trim(), kind: 'class', teacher: k.teacher, room: k.room, slots: [k.slot], color: k.color || SLOT_COLORS[k.slot], removable: false };
    byKey.set(key, pr);
    out.push(pr);
  }
  for (const x of p.extraCourses) {
    if (!x.name.trim()) continue;
    const key = classKey(x.name);
    if (byKey.has(key)) continue;
    const kind = normalizeKind(x.kind) || classifyName(x.name);
    const pr: Program = { id: 'p:' + key, name: x.name.trim(), kind, teacher: x.teacher, slots: [], color: KIND_COLOR[kind], removable: true };
    byKey.set(key, pr);
    out.push(pr);
  }
  return out;
};

export const programById = (p: StudentProfile | null, id: string) => programsFor(p).find(x => x.id === id) || null;

export const groupPrograms = (list: Program[]) =>
  GROUP_ORDER.map(group => ({
    group,
    label: GROUP_LABEL[group],
    items: list.filter(x => GROUP_OF[x.kind] === group).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
  })).filter(g => g.items.length);

// Adding: an ExtraCourse the profile can store (extras sync to the backend as-is).
export const toExtra = (name: string, kind?: ExtraKind, teacher = ''): ExtraCourse =>
  ({ name: name.trim(), teacher, kind: kind || classifyName(name) });

// ── Matching text to a program ──────────────────────────────────
// Keywords: words of the name that carry meaning. "Sr. Boys Rugby" → rugby,
// "Chemistry 11" → chemistry, "Robotics Club" → robotics.
const STOP = new Set(['sr', 'jr', 'boys', 'girls', 'club', 'team', 'the', 'and', 'academy', 'program', 'programme', 'studies', 'education', 'company', 'production', 'introductory', 'honours', 'pre', 'ap', 'efp']);
export const programKeywords = (name: string): string[] =>
  norm(name).replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(w => w.length >= 4 && !STOP.has(w));

export const matchesProgram = (text: string, pr: Program) => {
  const kws = programKeywords(pr.name);
  if (!kws.length) return false;
  const t = norm(text);
  return kws.some(k => t.includes(k));
};

// ── Feed: homework, announcements, school events ────────────────
// Everything here is typed by the student (src/stores.tsx); there is no sample
// homework. Items carry the `program` name. `program: ''` is Unsorted. `slot` is
// a timetable block, only on rows saved with one. `time` is "HH:MM" (24h),
// optional; `doneOn` is the date it was ticked off (set by the homework store).
// `kind` is optional: plain homework has none. It is guessed from the title
// ("Unit 3 quiz" → quiz) until the student picks one (`kindPicked`), and after
// that the title no longer changes it.
export type HomeworkKind = 'quiz' | 'test' | 'project' | 'presentation' | 'essay';
export type HomeworkItem = { id: string; slot?: Slot; program?: string; title: string; due: string; time?: string; notes?: string; priority: 'high' | 'med' | 'low'; done: boolean; doneOn?: string; own?: boolean; kind?: HomeworkKind; kindPicked?: boolean };

export const HW_KINDS: HomeworkKind[] = ['quiz', 'test', 'project', 'presentation', 'essay'];
export const HW_KIND_LABEL: Record<HomeworkKind, string> = { quiz: 'Quiz', test: 'Test', project: 'Project', presentation: 'Presentation', essay: 'Essay' };

// "Chem test", "Unit 4 Quiz", "French oral exam", "Science fair project".
// A test wins over a quiz ("quiz on the practice test" is still a test), and a
// presentation over the project or essay it is about.
export const guessKind = (title: string): HomeworkKind | undefined => {
  const t = title.toLowerCase();
  if (/\b(tests?|exams?|midterms?|finals?)\b/.test(t)) return 'test';
  if (/\b(quiz|quizzes|pop quiz)\b/.test(t)) return 'quiz';
  if (/\b(presentations?|presenting|slideshows?)\b/.test(t)) return 'presentation';
  if (/\bessays?\b/.test(t)) return 'essay';
  if (/\bprojects?\b/.test(t)) return 'project';
  return undefined;
};

// Quizzes and tests get the early reminders and their own calendar dot.
export const isAssessment = (h: Pick<HomeworkItem, 'kind'>) => h.kind === 'quiz' || h.kind === 'test';

export const programHomework = (pr: Program, items: HomeworkItem[]) =>
  items.filter(h => (h.slot && pr.slots.includes(h.slot)) || (h.program && classKey(h.program) === classKey(pr.name)));

// Kinds that are real courses: they get homework and grades.
export const hasCoursework = (pr: Program) => pr.kind === 'class' || pr.kind === 'outside' || pr.kind === 'online';

// App Club news posts that mention this program.
export const programNews = <N extends { title: string; body: string }>(pr: Program, news: N[]) =>
  news.filter(n => matchesProgram(`${n.title} ${n.body}`, pr));

export type SchoolEvent = { id: string; iso: string; title: string; time: string };

// Dated school-calendar events that mention the program, `days` ahead of `fromIso`.
export const programSchoolEvents = (pr: Program, fromIso: string, days = 90): SchoolEvent[] => {
  const out: SchoolEvent[] = [];
  const start = fromISO(fromIso);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    for (const ev of CALENDAR[iso]?.events || []) {
      if (!matchesProgram(ev, pr)) continue;
      const [title, ...rest] = ev.split(' · ');
      out.push({ id: iso + ':' + title, iso, title, time: rest.join(' · ') });
    }
  }
  return out;
};

// Course helper for the class card: the timetable rows behind a class program.
export const coursesOf = (p: StudentProfile | null, pr: Program): Course[] =>
  (p?.courses || []).filter(k => pr.slots.includes(k.slot));
