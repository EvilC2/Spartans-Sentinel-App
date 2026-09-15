// Spartans — small persisted stores that several screens share.
//   PinsProvider    — which More pages are pinned to Quick links on Home
//   GradesProvider  — per-class, per-term marks entered on the class card
//   EventsProvider  — personal calendar events added with the + button
// All three are AsyncStorage-backed and local to the device (no backend yet).

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const usePersisted = <T,>(key: string, initial: T): [T, (next: T | ((v: T) => T)) => void, boolean] => {
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
export const DEFAULT_PINS = ['dayview', 'contacts', 'lunch', 'homework', 'badges', 'map'];

type PinsCtx = { pins: string[]; isPinned: (id: string) => boolean; toggle: (id: string) => void };
const Pins = createContext<PinsCtx>({ pins: DEFAULT_PINS, isPinned: () => false, toggle: () => {} });

export const PinsProvider = ({ children }: { children: React.ReactNode }) => {
  const [pins, setPins] = usePersisted<string[]>('spartans-pins-v1', DEFAULT_PINS);
  const value = useMemo<PinsCtx>(() => ({
    pins,
    isPinned: id => pins.includes(id),
    toggle: id => setPins(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]),
  }), [pins]);
  return <Pins.Provider value={value}>{children}</Pins.Provider>;
};
export const usePins = () => useContext(Pins);

// ── Grades ──────────────────────────────────────────────────────
export const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Final'] as const;
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

// ── Personal events ─────────────────────────────────────────────
export type PersonalEvent = {
  id: string;
  iso: string;        // YYYY-MM-DD
  title: string;
  time?: string;      // "HH:MM" 24h, optional
  className?: string; // tag to a class, optional
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
  const [events, setEvents] = usePersisted<PersonalEvent[]>('spartans-events-v1', []);
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
