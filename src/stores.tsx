// Spartans — small persisted stores that several screens share.
//   PinsProvider    — which More pages are pinned to Quick links on Home
//   GradesProvider  — per-class, per-term marks entered on the class card
//   HomeworkProvider — which homework items are checked off
//   EventsProvider  — personal calendar events added with the + button, plus
//                     homework due dates (read-only events sourced from a class)
// All four are AsyncStorage-backed and local to the device (no backend yet).

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from './ProfileContext';
import { ALL_HOMEWORK, HomeworkItem } from './programs';
import { pageById } from './pages';
import { earnXp, XP } from './xp';

export const usePersisted = <T,>(key: string, initial: T): [T, (next: T | ((v: T) => T)) => void, boolean] => {
  const [v, setV] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then(s => { if (s) setV(JSON.parse(s)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [key]);
  const set = (next: T | ((v: T) => T)) => {
    setV(prev => {
      const out = typeof next === 'function' ? (next as (v: T) => T)(prev) : next;
      AsyncStorage.setItem(key, JSON.stringify(out)).catch(() => {});
      return out;
    });
  };
  return [v, set, loaded];
};

// ── Pins ────────────────────────────────────────────────────────
export const DEFAULT_PINS = ['contacts', 'lunch', 'homework', 'map'];

type PinsCtx = { pins: string[]; isPinned: (id: string) => boolean; toggle: (id: string) => void };
const Pins = createContext<PinsCtx>({ pins: DEFAULT_PINS, isPinned: () => false, toggle: () => {} });

export const PinsProvider = ({ children }: { children: React.ReactNode }) => {
  const [stored, setPins] = usePersisted<string[]>('spartans-pins-v1', DEFAULT_PINS);
  // Drop ids for pages no longer listed on More (e.g. old 'badges' pin).
  const pins = useMemo(() => stored.filter(id => !!pageById(id)), [stored]);
  const value = useMemo<PinsCtx>(() => ({
    pins,
    isPinned: id => pins.includes(id),
    toggle: id => setPins(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]),
  }), [pins]);
  return <Pins.Provider value={value}>{children}</Pins.Provider>;
};
export const usePins = () => useContext(Pins);

// ── Grades ──────────────────────────────────────────────────────
// Term 1, Term 2 and the final mark.
export const TERMS = ['Term 1', 'Term 2', 'Final'] as const;
export type Term = typeof TERMS[number];
export type GradeBook = Record<string, Partial<Record<Term, string>>>;   // classKey → term → "87"

export const classKey = (name: string) => name.trim().toLowerCase();

type GradesCtx = {
  grades: GradeBook;
  gradesFor: (name: string) => Partial<Record<Term, string>>;
  setGrade: (name: string, term: Term, value: string) => void;
};
const Grades = createContext<GradesCtx>({ grades: {}, gradesFor: () => ({}), setGrade: () => {} });

export const GradesProvider = ({ children }: { children: React.ReactNode }) => {
  const [grades, setGrades] = usePersisted<GradeBook>('spartans-grades-v1', {});
  const value = useMemo<GradesCtx>(() => ({
    grades,
    gradesFor: name => grades[classKey(name)] || {},
    setGrade: (name, term, v) => setGrades(g => {
      const k = classKey(name);
      const clean = v.replace(/[^0-9.]/g, '').slice(0, 5);
      return { ...g, [k]: { ...(g[k] || {}), [term]: clean } };
    }),
  }), [grades]);
  return <Grades.Provider value={value}>{children}</Grades.Provider>;
};
export const useGrades = () => useContext(Grades);

// Average of the numeric term marks (Final excluded), or null.
export const termAverage = (t: Partial<Record<Term, string>>) => {
  const xs = TERMS.filter(k => k !== 'Final').map(k => Number(t[k])).filter(n => Number.isFinite(n) && t !== undefined && n > 0);
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
};

// ── Homework ────────────────────────────────────────────────────
// Sample items come from src/data.ts (keyed by block). Students can also add
// their own to any program, or to Unsorted (no program), which is how classes
// outside the timetable get homework: those are stored here, tagged with the
// program name. Sample items can be edited too: the changes sit in `edits`
// and are laid over the sample on read.
//
// Done state is the date it was ticked off ('2026-09-23'), so the Homework
// page can keep it in the list for the rest of that day before it moves to
// the Completed part of its section. Old rows stored `true` (no date).
export type HomeworkPatch = Partial<Pick<HomeworkItem, 'title' | 'due' | 'time' | 'notes' | 'program'>>;
type HomeworkEdit = HomeworkPatch & { deleted?: boolean };

type HomeworkCtx = {
  items: HomeworkItem[];                 // sample + own, with edits and `done` / `doneOn` applied
  isDone: (id: string) => boolean;
  toggle: (id: string, todayIso?: string) => void;
  add: (program: string, title: string, due: string, extra?: Pick<HomeworkItem, 'time' | 'notes' | 'slot'>) => void;
  update: (id: string, patch: HomeworkPatch) => void;
  remove: (id: string) => void;
};
const Homework = createContext<HomeworkCtx>({ items: [], isDone: () => false, toggle: () => {}, add: () => {}, update: () => {}, remove: () => {} });

const localIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const HomeworkProvider = ({ children }: { children: React.ReactNode }) => {
  const [done, setDone] = usePersisted<Record<string, boolean | string>>('spartans-homework-done-v1', {});
  const [own, setOwn] = usePersisted<HomeworkItem[]>('spartans-homework-own-v1', []);
  const [edits, setEdits] = usePersisted<Record<string, HomeworkEdit>>('spartans-homework-edits-v1', {});
  const value = useMemo<HomeworkCtx>(() => {
    // An edit that sets `program` moves a sample item off its block.
    const sample = ALL_HOMEWORK.filter(h => !edits[h.id]?.deleted).map(h => {
      const e = edits[h.id];
      if (!e) return h;
      const { deleted, ...patch } = e;
      const out: HomeworkItem = { ...h, ...patch };
      if (patch.program !== undefined) delete out.slot;
      return out;
    });
    const all = [...sample, ...own];
    const mark = (id: string) => id in done ? done[id] : !!all.find(h => h.id === id)?.done;
    const isDone = (id: string) => !!mark(id);
    return {
      items: all.map(h => { const m = mark(h.id); return { ...h, done: !!m, doneOn: typeof m === 'string' ? m : undefined }; }),
      isDone,
      toggle: (id, todayIso) => {
        // Finishing homework pays XP once per item (see xp.ts for the daily cap).
        if (!isDone(id)) earnXp('homework', id, XP.homework, `Finished: ${all.find(h => h.id === id)?.title || 'homework'}`);
        setDone(d => ({ ...d, [id]: isDone(id) ? false : (todayIso || localIso()) }));
      },
      add: (program, title, due, extra) => setOwn(list => [...list, {
        id: `own-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        program: program.trim(), title: title.trim(), due, priority: 'med', done: false, own: true,
        ...(extra?.slot ? { slot: extra.slot } : {}),
        ...(extra?.time ? { time: extra.time } : {}), ...(extra?.notes?.trim() ? { notes: extra.notes.trim() } : {}),
      }]),
      update: (id, patch) => {
        if (id.startsWith('own-')) setOwn(list => list.map(h => h.id === id ? { ...h, ...patch } : h));
        else setEdits(m => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));
      },
      remove: id => {
        if (id.startsWith('own-')) setOwn(list => list.filter(h => h.id !== id));
        else setEdits(m => ({ ...m, [id]: { ...(m[id] || {}), deleted: true } }));
      },
    };
  }, [done, own, edits]);
  return <Homework.Provider value={value}>{children}</Homework.Provider>;
};
export const useHomework = () => useContext(Homework);

// ── Personal events ─────────────────────────────────────────────
export type PersonalEvent = {
  id: string;
  iso: string;        // YYYY-MM-DD
  title: string;
  time?: string;      // "HH:MM" 24h, optional
  className?: string; // tag to a class / program, optional
  source?: 'homework'; // derived from a program, not editable here
  done?: boolean;
};

type EventsCtx = {
  events: PersonalEvent[];
  eventsOn: (iso: string) => PersonalEvent[];
  add: (e: Omit<PersonalEvent, 'id'>) => void;
  update: (id: string, patch: Partial<PersonalEvent>) => void;
  remove: (id: string) => void;
};
const Events = createContext<EventsCtx>({ events: [], eventsOn: () => [], add: () => {}, update: () => {}, remove: () => {} });

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  const [stored, setEvents] = usePersisted<PersonalEvent[]>('spartans-events-v1', []);
  const { profile } = useProfile();
  const { items } = useHomework();
  // Homework due dates become read-only events tagged with the class name, so
  // the calendar (dots, day sheet, month list) shows them without knowing
  // where they came from. One data model: a due date is an event whose
  // source is a program.
  const derived = useMemo<PersonalEvent[]>(() => items.map(h => {
    const k = h.slot ? profile?.courses.find(x => x.slot === h.slot) : undefined;
    return { id: 'hw:' + h.id, iso: h.due, time: h.time, title: h.title, className: h.program || k?.name || (h.slot ? `Block ${h.slot}` : undefined), source: 'homework' as const, done: h.done };
  }), [items, profile?.courses]);
  const events = useMemo(() => [...stored, ...derived], [stored, derived]);
  const value = useMemo<EventsCtx>(() => ({
    events,
    eventsOn: iso => events.filter(e => e.iso === iso).sort((a, b) => (a.time || '99').localeCompare(b.time || '99')),
    add: e => setEvents(list => [...list, { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]),
    update: (id, patch) => setEvents(list => list.map(e => e.id === id ? { ...e, ...patch } : e)),
    remove: id => setEvents(list => list.filter(e => e.id !== id)),
  }), [events]);
  return <Events.Provider value={value}>{children}</Events.Provider>;
};
export const useEvents = () => useContext(Events);
