// Spartans — teachers (migration 0026).
//   useTeacher()   is this a teacher account, is it confirmed, and the classes
//                  it teaches (from the timetable blocks, prep blocks left out).
//   useRosters()   who is in each of those classes: the students who put that
//                  class, in that block, in their own timetable. Name and
//                  grade only, confirmed teachers only (the server checks).
//
// A teacher account is `profile.kind === 'teacher'` (the server sets it from a
// wvschools.ca address). It is *confirmed* once it holds the `teacher` role or
// a top role: an invite code, or a top role confirming it in App Club → Clubs
// & programs → Teachers. Until then it can look around but not post or see
// class lists. The owner's "View as → Teacher" shows the teacher app too.
//
// Demo (no server): confirmed straight away, with sample students.

import { useEffect, useMemo, useState } from 'react';
import { demoBuild } from './supabase';
import { useContent, ContentMode } from './content';
import { useProfile, isTeacher, Course, Slot, SLOTS } from './ProfileContext';
import { isStaff } from './ranks';

export type TeacherClass = { slot: Slot; name: string; room: string; color: string };
export type RosterStudent = { id: string; name: string; grade: number };

export const classesOf = (courses: Course[]): TeacherClass[] =>
  SLOTS.map(s => courses.find(k => k.slot === s))
    .filter((k): k is Course => !!k && !k.spare && !!k.name.trim())
    .map(k => ({ slot: k.slot, name: k.name.trim(), room: k.room, color: k.color }));

export const useTeacher = () => {
  const { profile } = useProfile();
  const { roles, viewAs } = useContent();
  // View as → "Teacher, not in the club": the owner sees what a teacher sees.
  const preview = !!viewAs && viewAs.length === 1 && viewAs[0] === 'teacher';
  const teacher = isTeacher(profile) || preview;
  const classes = useMemo(() => classesOf(profile?.courses || []), [profile?.courses]);
  return { teacher, confirmed: teacher && isStaff(roles), classes };
};

// ── Class lists ─────────────────────────────────────────────────
const FRESH = 5 * 60_000;
type Rosters = Partial<Record<Slot, RosterStudent[]>>;
let cache: { who: string; at: number; data: Rosters } = { who: '', at: 0, data: {} };
let loading: Promise<Rosters> | null = null;
const listeners = new Set<() => void>();

const DEMO_NAMES = [
  'Maya Chen', 'Noah Patel', 'Ava Thompson', 'Liam Nguyen', 'Sofia Rossi', 'Ethan Park', 'Chloe Martin', 'Lucas Brown',
  'Zoe Williams', 'Owen Scott', 'Isla Campbell', 'Mateo Garcia', 'Hannah Lee', 'Daniel Kim', 'Ruby Wilson', 'Felix Wong',
  'Grace Taylor', 'Leo Anderson', 'Nora Singh', 'Jack Murphy', 'Ella Fraser', 'Sam Johal', 'Mila Novak', 'Ben Carter',
];
const gradeIn = (name: string) => { const m = name.match(/\b(8|9|10|11|12)\b/); return m ? Number(m[1]) : 10; };
const demoRosters = (classes: TeacherClass[]): Rosters => Object.fromEntries(classes.map((k, i) => {
  const n = 14 + ((i * 5) % 9);
  return [k.slot, Array.from({ length: n }, (_, j) => {
    const name = DEMO_NAMES[(i * 7 + j) % DEMO_NAMES.length];
    return { id: `demo-${k.slot}-${j}`, name, grade: gradeIn(k.name) };
  }).sort((a, b) => a.name.localeCompare(b.name))];
}));

const load = (mode: ContentMode, who: string, classes: TeacherClass[], force = false): Promise<Rosters> => {
  if (!force && cache.who === who && Date.now() - cache.at < FRESH) return Promise.resolve(cache.data);
  if (loading && cache.who === who) return loading;
  cache = { who, at: cache.who === who ? cache.at : 0, data: cache.who === who ? cache.data : {} };
  loading = (async () => {
    let data: Rosters = {};
    if (mode !== 'live') {
      data = demoBuild ? demoRosters(classes) : {};
    } else {
      const { teachers } = await import('./backend');
      for (const r of await teachers.rosters()) {
        if (!SLOTS.includes(r.slot as Slot)) continue;
        (data[r.slot as Slot] ??= []).push({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim() || 'Student', grade: r.grade });
      }
    }
    cache = { who, at: Date.now(), data };
    listeners.forEach(f => f());
    return data;
  })().finally(() => { loading = null; });
  return loading;
};

// `note`: a sentence to show when the lists could not be loaded.
export const useRosters = () => {
  const { mode } = useContent();
  const { signedIn, profile } = useProfile();
  const { confirmed, classes } = useTeacher();
  const [, bump] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const who = `${mode}:${signedIn}:${profile?.email || ''}:${classes.map(k => `${k.slot}=${k.name}`).join('|')}`;

  useEffect(() => {
    const f = () => bump(x => x + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);

  const run = (force = false) => {
    if (!confirmed || !classes.length) return Promise.resolve();
    return load(mode, who, classes, force).then(() => setNote(null)).catch((e: any) => {
      setNote(/does not exist|schema cache|could not find/i.test(String(e?.message))
        ? 'Class lists need migration 0026 on the server.'
        : 'Could not load your class lists. Pull down to try again.');
    });
  };
  useEffect(() => { run(); }, [who, confirmed]);   // eslint-disable-line react-hooks/exhaustive-deps

  const data = cache.who === who ? cache.data : {};
  return {
    of: (slot: Slot): RosterStudent[] => data[slot] || [],
    count: (slot: Slot) => (data[slot] || []).length,
    loaded: cache.who === who && cache.at > 0,
    note, reload: () => run(true),
  };
};
