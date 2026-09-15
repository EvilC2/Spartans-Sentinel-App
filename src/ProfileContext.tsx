// Spartans — student profile store.
// Holds what the intro flow collects (name, grade, email, the eight timetable
// slots, extra classes). AsyncStorage is the cache and the offline fallback;
// when .env has Supabase keys the account and profile live on the server
// (src/backend.ts) and the cache is refreshed on sign-in and on save.
// `profile === null` after load means the intro flow has not been completed yet.
//
// Sentinel's timetable has 8 blocks on a Day 1 / Day 2 rotation:
// 1-1 … 1-4 on Day 1 and 2-1 … 2-4 on Day 2. Block 1-1 is homeroom.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword } from './auth';
import { backendConfigured } from './supabase';
import { auth as remoteAuth, profile as remoteProfile, admin as remoteAdmin, Role, RemoteProfile } from './backend';

const KEY = 'sentinel-profile-v2';
const SESSION_KEY = 'sentinel-session-v1';   // "1" while signed in on this device
const ROLES_KEY = 'spartans-roles-v1';       // cached App Club roles

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
  online: boolean;            // last backend call succeeded (false = running on cache)
  roles: Role[];              // App Club Admin roles bound to this account (server-issued)
  save: (p: StudentProfile, password?: string) => Promise<void>;   // sign up / edit; also signs in
  signIn: (identifier: string, password: string) => Promise<string | null>; // null = ok, else error text
  signOut: () => Promise<void>;                         // keeps the account on the device
  clear: () => Promise<void>;                           // deletes the account from the device
  redeemInvite: (code: string) => Promise<Role>;        // App Club Admin: bind a role to this account
  refreshRoles: () => Promise<void>;
};

const ProfileCtx = createContext<Ctx>({
  profile: null, loaded: false, signedIn: false, online: false, roles: [],
  save: async () => {}, signIn: async () => 'Not ready', signOut: async () => {}, clear: async () => {},
  redeemInvite: async () => { throw new Error('Not ready'); }, refreshRoles: async () => {},
});

// Server row → the shape the app already uses. Server wins on conflict; local
// only keeps things the server never sees (password hash, photo file path).
const fromRemote = (r: RemoteProfile, local: StudentProfile | null): StudentProfile => ({
  ...(local || emptyProfile()),
  firstName: r.first_name, lastName: r.last_name, grade: r.grade,
  pronouns: r.pronouns || local?.pronouns, studentId: r.student_id || local?.studentId,
  email: r.email, artonaUrl: r.artona_url || local?.artonaUrl,
  courses: Array.isArray(r.timetable) && r.timetable.length === SLOTS.length ? r.timetable : (local?.courses || emptyCourses()),
  extraCourses: Array.isArray(r.extras) ? r.extras : (local?.extraCourses || []),
});
const toRemote = (p: StudentProfile) => ({
  first_name: p.firstName, last_name: p.lastName, grade: p.grade,
  pronouns: p.pronouns || null, student_id: p.studentId || null, artona_url: p.artonaUrl || null,
  timetable: p.courses, extras: p.extraCourses,
});

// "johnd907" → full address; a full address passes through; a student number
// resolves only against the account cached on this device.
const toEmail = (identifier: string, local: StudentProfile | null): string | null => {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  if (id.includes('@')) return id;
  if (/^\d+$/.test(id)) return id === (local?.studentId || '') ? (local?.email || null) : null;
  return `${id}@${EMAIL_DOMAIN}`;
};

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  const cacheRoles = (r: Role[]) => { setRoles(r); AsyncStorage.setItem(ROLES_KEY, JSON.stringify(r)).catch(() => {}); };

  // Pull the server copy of the profile + roles; quietly keep the cache if offline.
  const sync = async (local: StudentProfile | null) => {
    if (!backendConfigured) return;
    try {
      const r = await remoteProfile.me();
      if (r) {
        const merged = fromRemote(r, local);
        setProfile(merged);
        await AsyncStorage.setItem(KEY, JSON.stringify(merged));
      }
      cacheRoles(await remoteAdmin.myRoles());
      setOnline(true);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(ROLES_KEY)])
      .then(async ([v, s, r]) => {
        let local: StudentProfile | null = null;
        if (v) {
          const p = JSON.parse(v) as StudentProfile;
          if (p && Array.isArray(p.courses) && p.courses.length === SLOTS.length) {
            local = { ...p, extraCourses: p.extraCourses || [] };
            setProfile(local);
            setSignedIn(s === '1');
          }
        }
        if (r) { try { setRoles(JSON.parse(r)); } catch {} }
        if (s === '1' && backendConfigured && (await remoteAuth.session())) await sync(local);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Sign up (no session yet) or update (session exists). Throws with a
  // readable message if the server refuses; the local copy is saved first so
  // nothing typed is lost.
  const save = async (p: StudentProfile, password?: string) => {
    setProfile(p);
    setSignedIn(true);
    await AsyncStorage.multiSet([[KEY, JSON.stringify(p)], [SESSION_KEY, '1']]);
    if (!backendConfigured || !p.email) return;
    try {
      const session = await remoteAuth.session();
      if (!session) {
        if (!password) throw new Error('Password required to create the account.');
        const res = await remoteAuth.signUp(p.email, password, {
          first_name: p.firstName, last_name: p.lastName, grade: p.grade,
          pronouns: p.pronouns, student_id: p.studentId,
        });
        // Email confirmation still on → no session yet. The account exists;
        // the timetable is pushed on first sign-in.
        if (!res.session) { setOnline(true); return; }
      } else if (password) {
        await remoteAuth.updatePassword(password);
      }
      await remoteProfile.update(toRemote(p));
      await sync(p);
    } catch (e) {
      setOnline(false);
      throw e;
    }
  };

  const localSignIn = async (identifier: string, password: string) => {
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

  const signIn = async (identifier: string, password: string) => {
    if (!backendConfigured) return localSignIn(identifier, password);
    const email = toEmail(identifier, profile);
    if (!email) return 'Use your school email (johnd907 or the full address).';
    try {
      await remoteAuth.signIn(email, password);
    } catch (e: any) {
      const msg = String(e?.message || '');
      // Server reachable but said no → real error. Unreachable → cached account.
      if (/network|fetch|timeout/i.test(msg)) return localSignIn(identifier, password);
      return /invalid login/i.test(msg) ? 'Wrong email or password.' : msg;
    }
    const same = (profile?.email || '').toLowerCase() === email;
    const base = { ...(same && profile ? profile : emptyProfile()), email, passwordHash: hashPassword(password) };
    setProfile(base);
    setSignedIn(true);
    await AsyncStorage.multiSet([[KEY, JSON.stringify(base)], [SESSION_KEY, '1']]);
    // Account made on this device before the server had it (or while email
    // confirmation was pending): push the timetable up once.
    if (same && base.courses.some(k => k.name)) {
      const r = await remoteProfile.me().catch(() => null);
      if (r && (!Array.isArray(r.timetable) || r.timetable.length === 0)) await remoteProfile.update(toRemote(base)).catch(() => {});
    }
    await sync(base);
    return null;
  };

  const signOut = async () => {
    setSignedIn(false);
    await AsyncStorage.removeItem(SESSION_KEY);
    if (backendConfigured) await remoteAuth.signOut().catch(() => {});
  };
  const clear = async () => {
    setProfile(null);
    setSignedIn(false);
    cacheRoles([]);
    await AsyncStorage.multiRemove([KEY, SESSION_KEY, ROLES_KEY]);
    if (backendConfigured) await remoteAuth.signOut().catch(() => {});
  };

  const redeemInvite = async (code: string) => {
    if (!backendConfigured) throw new Error('Backend not configured on this build.');
    const role = await remoteAdmin.redeemInvite(code);
    cacheRoles(await remoteAdmin.myRoles());
    return role;
  };
  const refreshRoles = async () => { await sync(profile); };

  return (
    <ProfileCtx.Provider value={{ profile, loaded, signedIn, online, roles, save, signIn, signOut, clear, redeemInvite, refreshRoles }}>
      {children}
    </ProfileCtx.Provider>
  );
};

export const useProfile = () => useContext(ProfileCtx);
