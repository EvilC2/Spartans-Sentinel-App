// Sentinel — student profile store.
// Holds what the intro flow collects (name, grade, email, the eight timetable
// slots, extra classes) and persists it to AsyncStorage. `profile === null`
// after load means the intro flow has not been completed yet.
//
// Sentinel's timetable has 8 blocks on a Day 1 / Day 2 rotation:
// 1-1 … 1-4 on Day 1 and 2-1 … 2-4 on Day 2. Block 1-1 is homeroom.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword } from './auth';

const KEY = 'sentinel-profile-v2';
const SESSION_KEY = 'sentinel-session-v1';   // "1" while signed in on this device

export type Slot = '1-1' | '1-2' | '1-3' | '1-4' | '2-1' | '2-2' | '2-3' | '2-4';
export const SLOTS: Slot[] = ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4'];
export const HOMEROOM_SLOT: Slot = '1-1';
export const EMAIL_DOMAIN = 'edu.sd45.bc.ca';

export type Course = {
  slot: Slot;
  name: string;
  teacher: string;   // "Last, First" from the catalog, or free text
  room: string;
  color: string;
  spare?: boolean;   // no class this block; name is "Spare", teacher/room empty
};

export type ExtraCourse = { name: string; teacher: string };

export type StudentProfile = {
  firstName: string;
  lastName: string;
  grade: number;          // 8–12
  pronouns?: string;
  studentId?: string;
  email?: string;         // full address, e.g. johnd907@edu.sd45.bc.ca
  passwordHash?: string;  // salted SHA-256, see auth.ts
  photoUri?: string;      // ID photo (copied into the document directory)
  artonaUrl?: string;     // portrait link from the QR on the back of the card
  courses: Course[];      // exactly one per slot
  extraCourses: ExtraCourse[];  // outside the timetable (Theatre Company, Choir, academies…)
};

export const SLOT_COLORS: Record<Slot, string> = {
  '1-1': '#A23E3E', '1-2': '#1A3A5C', '1-3': '#5B7A4E', '1-4': '#B68842',
  '2-1': '#7A4E8C', '2-2': '#2A7A8C', '2-3': '#8C5A2A', '2-4': '#4E6B8C',
};

export const emptyCourses = (): Course[] =>
  SLOTS.map(s => ({ slot: s, name: '', teacher: '', room: '', color: SLOT_COLORS[s] }));

export const emptyProfile = (): StudentProfile => ({
  firstName: '', lastName: '', grade: 8, pronouns: 'he/him', studentId: '', email: '', passwordHash: '', photoUri: '', artonaUrl: '',
  courses: emptyCourses(), extraCourses: [],
});

// ── derived bits ─────────────────────────────────────────────────
export const fullName = (p: StudentProfile) => [p.firstName, p.lastName].filter(Boolean).join(' ');
export const initials = (p: StudentProfile) =>
  ((p.firstName[0] || '') + (p.lastName[0] || '')).toUpperCase() || '?';
export const gradeLabel = (p: StudentProfile) => `Grade ${p.grade}`;
export const courseAt = (p: StudentProfile, slot: Slot) => p.courses.find(c => c.slot === slot);
export const homeroom = (p: StudentProfile) => courseAt(p, HOMEROOM_SLOT)?.room || '';

// School email local part: first name + last initial + 3 digits, e.g. "johnd907".
export const EMAIL_LOCAL_RE = /^[a-z]+\d{3}$/i;
export const isValidEmailLocal = (v: string) => EMAIL_LOCAL_RE.test(v);

// Rooms are 3 digits starting with the floor (1, 2 or 3), optionally with a
// letter (149A, 149B), or one of the named spaces below. The named list is a
// best guess until the posted school map is checked; add to it, don't regex it.
export const ROOM_NAMES = [
  'PORT', 'PORT 1', 'PORT 2', 'GYM', 'SMALL GYM', 'LIB', 'THEATRE', 'CAF', 'FOODS', 'TEXTILES',
  'WOOD', 'DRAFTING', 'ART', 'MUSIC', 'BAND', 'DANCE', 'SCI-2', 'CRC', 'COUNSELLING', 'WEIGHT ROOM',
  'FIELD', 'TRACK', 'POOL', 'OFF SITE',
];
export const ROOM_RE = /^[123]\d{2}[A-Z]?$/;
export const normalizeRoom = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').slice(0, 12);
export const isValidRoom = (v: string) => ROOM_RE.test(v) || ROOM_NAMES.includes(v);
export const matchRooms = (q: string): string[] => {
  const s = normalizeRoom(q).trim();
  if (!s || /^\d/.test(s)) return [];
  return ROOM_NAMES.filter(r => r.startsWith(s));
};
// "213" → "Room 213", "149A" → "Room 149A", "PORT" → "Portable", "GYM" → "Gym".
const ROOM_PRETTY: Record<string, string> = {
  PORT: 'Portable', 'PORT 1': 'Portable 1', 'PORT 2': 'Portable 2', GYM: 'Gym', 'SMALL GYM': 'Small gym', LIB: 'Library',
  THEATRE: 'Theatre', CAF: 'Cafeteria', FOODS: 'Foods room', TEXTILES: 'Textiles', WOOD: 'Woodwork shop', DRAFTING: 'Drafting',
  ART: 'Art room', MUSIC: 'Music room', BAND: 'Band room', DANCE: 'Dance studio', 'SCI-2': 'Sci-2', CRC: 'Career Resources Centre',
  COUNSELLING: 'Counselling', 'WEIGHT ROOM': 'Weight room', FIELD: 'Field', TRACK: 'Track', POOL: 'Pool', 'OFF SITE': 'Off site',
};
export const roomLabel = (r: string) => /^\d/.test(r) ? `Room ${r}` : (ROOM_PRETTY[r] || r);
export const roomShort = (r: string) => /^\d/.test(r) ? `Rm ${r}` : (ROOM_PRETTY[r] || r);

export const roomProblem = (v: string): string | null => {
  if (!v) return null;
  const r = v.trim();
  if (/^\d/.test(r)) {
    if (!/^\d{3}[A-Z]?$/.test(r)) return '3 digits, then an optional letter (213, 149A)';
    if (!/^[123]/.test(r)) return 'Must start with 1, 2 or 3';
    return null;
  }
  if (!ROOM_NAMES.includes(r)) return 'Not a known room. Try 213, 149A or PORT';
  return null;
};

// "Last, First" → "Ms. Last" is not knowable; show "Last" for compact rows.
export const teacherShort = (t: string) => t.includes(',') ? t.split(',')[0].trim() : t;

// Short tag for the hero tiles: "Chemistry 11" → "CHEM", "Pre-Calculus 12" → "PREC".
export const shortName = (name: string) => {
  if (/^spare$/i.test(name.trim())) return 'SPARE';
  const w = name.replace(/\(.*?\)/g, '').replace(/\d+[AB]?/g, '').trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '—';
  if (w.length === 1) return w[0].replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || '—';
  return w.map(x => x.replace(/[^A-Za-z]/g, '')[0] || '').join('').slice(0, 4).toUpperCase();
};

type Ctx = {
  profile: StudentProfile | null;
  loaded: boolean;
  signedIn: boolean;
  save: (p: StudentProfile) => Promise<void>;          // sign up / edit; also signs in
  signIn: (identifier: string, password: string) => Promise<string | null>; // null = ok, else error text
  signOut: () => Promise<void>;                         // keeps the account on the device
  clear: () => Promise<void>;                           // deletes the account from the device
};

const ProfileCtx = createContext<Ctx>({
  profile: null, loaded: false, signedIn: false,
  save: async () => {}, signIn: async () => 'Not ready', signOut: async () => {}, clear: async () => {},
});

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(SESSION_KEY)])
      .then(([v, s]) => {
        if (v) {
          const p = JSON.parse(v) as StudentProfile;
          if (p && Array.isArray(p.courses) && p.courses.length === SLOTS.length) {
            setProfile({ ...p, extraCourses: p.extraCourses || [] });
            setSignedIn(s === '1');
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async (p: StudentProfile) => {
    setProfile(p);
    setSignedIn(true);
    await AsyncStorage.multiSet([[KEY, JSON.stringify(p)], [SESSION_KEY, '1']]);
  };
  const signIn = async (identifier: string, password: string) => {
    if (!profile) return 'No account on this device yet. Sign up first.';
    const id = identifier.trim().toLowerCase();
    const idOk = id && (
      id === (profile.email || '').toLowerCase()
      || id === (profile.email || '').toLowerCase().split('@')[0]
      || id === (profile.studentId || '')
    );
    if (!idOk) return 'That email or student number does not match the account on this device.';
    if (!profile.passwordHash || hashPassword(password) !== profile.passwordHash) return 'Wrong password.';
    setSignedIn(true);
    await AsyncStorage.setItem(SESSION_KEY, '1');
    return null;
  };
  const signOut = async () => {
    setSignedIn(false);
    await AsyncStorage.removeItem(SESSION_KEY);
  };
  const clear = async () => {
    setProfile(null);
    setSignedIn(false);
    await AsyncStorage.multiRemove([KEY, SESSION_KEY]);
  };

  return (
    <ProfileCtx.Provider value={{ profile, loaded, signedIn, save, signIn, signOut, clear }}>
      {children}
    </ProfileCtx.Provider>
  );
};

export const useProfile = () => useContext(ProfileCtx);
