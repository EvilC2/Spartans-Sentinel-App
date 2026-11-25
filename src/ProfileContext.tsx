// Spartans — student profile store.
// Holds what the intro flow collects (name, grade, email, the eight timetable
// slots, extra classes). AsyncStorage is the cache and the offline fallback;
// when .env has Supabase keys the account and profile live on the server
// (src/backend.ts) and the cache is refreshed on sign-in and on save.
// `profile === null` after load means the intro flow has not been completed yet.
//
// Sentinel's timetable has 8 blocks on a Day 1 / Day 2 rotation:
// 1-1 … 1-4 on Day 1 and 2-1 … 2-4 on Day 2. Block 1-1 is homeroom.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword, MIN_PASSWORD } from './auth';
import { setXpGrade } from './xp';
import { AvatarSpec, avatarOf } from './components/Avatar';
import { backendConfigured } from './supabase';
import { auth as remoteAuth, profile as remoteProfile, admin as remoteAdmin, badges as remoteBadges, catchUp as remoteCatchUp, Role, RemoteProfile } from './backend';
import { Badge } from './badges';
import { catchUpBadgeIds, clearEarned, earnCatchUp, mergeServerAwards, revokeBadges } from './earned';
import type { Answers } from './catchUp';

const KEY = 'sentinel-profile-v2';
const SESSION_KEY = 'sentinel-session-v1';   // "1" while signed in on this device
const ROLES_KEY = 'spartans-roles-v1';       // cached App Club roles

export type Slot = '1-1' | '1-2' | '1-3' | '1-4' | '2-1' | '2-2' | '2-3' | '2-4';
export const SLOTS: Slot[] = ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4'];
export const HOMEROOM_SLOT: Slot = '1-1';
export const EMAIL_DOMAIN = 'edu.sd45.bc.ca';
export const TEACHER_DOMAIN = 'wvschools.ca';   // staff addresses; these accounts are teachers (migration 0026)

export type Course = {
  slot: Slot;
  name: string;
  teacher: string;   // "Last, First" from the catalog, or free text
  room: string;
  color: string;
  spare?: boolean;   // no class this block; name is "Spare", teacher/room empty
};

// `kind` is set by Add programs or the sign-up Online toggle; rows without it
// are classified by name (src/programs.ts). 'program' is the old spelling of
// 'outside' and still reads.
export type ExtraKind = 'outside' | 'online' | 'sport' | 'music' | 'extra' | 'club' | 'program';
export type ExtraCourse = { name: string; teacher: string; kind?: ExtraKind };

// Catch Up (src/catchUp.ts). The server copy decides, except while `pending`:
// finished on this phone, not yet accepted by the server. `claimed` is what to
// send it, kept until it has been.
export type CatchUpState = { score: number; doneAt?: string; answers?: Answers; claimed?: string[]; pending?: boolean };

// One shape for students and teachers. A teacher (`kind: 'teacher'`) has no
// grade (0), no student number, and `courses` holds the blocks they teach,
// with a prep block stored the way a student's spare is.
export type StudentProfile = {
  kind?: 'student' | 'teacher';   // missing = student
  dept?: string;          // teachers: "Science"
  firstName: string;
  lastName: string;
  grade: number;          // 8–12; 0 for a teacher
  pronouns?: string;
  studentId?: string;
  email?: string;         // full address, e.g. johnd907@edu.sd45.bc.ca
  passwordHash?: string;  // salted SHA-256, see auth.ts
  photoUri?: string;      // ID photo (copied into the document directory); also your profile photo
  photoUrl?: string;      // that photo on the server, what friends see (migration 0015)
  photoFrom?: string;     // the photoUri photoUrl was uploaded from; differs → upload again
  artonaUrl?: string;     // portrait link from the QR on the back of the card
  friendCode?: string;    // server-issued, 8 chars; the only way friends add you
  pinnedBadges?: string[]; // up to four badge ids shown under your name on Social
  avatar?: AvatarSpec;     // colour + emoji friends see when there is no photo
  courses: Course[];      // exactly one per slot
  extraCourses: ExtraCourse[];  // outside the timetable (Theatre Company, Choir, academies…)
  catchUp?: CatchUpState;
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
export const isTeacher = (p: StudentProfile | null | undefined) => p?.kind === 'teacher';
export const gradeLabel = (p: StudentProfile) => isTeacher(p) ? (p.dept ? `Teacher · ${p.dept}` : 'Teacher') : `Grade ${p.grade}`;
// A teacher's prep block: no class. Stored like a spare so every screen skips it.
export const PREP = 'Prep';
// "Last, First", the way students' timetables name a teacher (src/catalog.ts).
export const teacherName = (p: StudentProfile) => [p.lastName.trim(), p.firstName.trim()].filter(Boolean).join(', ');
export const courseAt = (p: StudentProfile, slot: Slot) => p.courses.find(c => c.slot === slot);
export const homeroom = (p: StudentProfile) => courseAt(p, HOMEROOM_SLOT)?.room || '';

// School email local part: first name + last initial + 3 digits, e.g. "johnd907".
export const EMAIL_LOCAL_RE = /^[a-z]+\d{3}$/i;
export const isValidEmailLocal = (v: string) => EMAIL_LOCAL_RE.test(v);
// Staff addresses are a first initial and last name ("dgrant"), sometimes with
// a dot or a hyphen. Never three digits at the end: that is a student.
export const TEACHER_LOCAL_RE = /^[a-z][a-z.'-]*[a-z]$/i;
export const isValidTeacherLocal = (v: string) => TEACHER_LOCAL_RE.test(v);

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

// Short tag for the hero tiles: "Chemistry 11" → "Chem 11", "Economic Theory 12" → "Econ T", "French 12" → "Frnch 12".
// Word part is 5 letters max so the tag fits a quarter-width tile at 15pt. Courses that only run
// once (English, French, Socials) share a tag on purpose: you never carry two at the same time.
// Key = course name with grade digits and (parenthesised) notes removed, lower-cased.
const SHORT_TAGS: Record<string, string> = {
  // English
  'english': 'Eng', 'english studies': 'Eng', 'english first peoples': 'Eng', 'literary studies': 'Eng',
  'pre-ap literary studies': 'Eng', 'ap literary studies': 'AP Lit', 'efp literary studies & writing': 'Eng',
  'pre-ap efp literary studies & writing': 'Eng', 'academic writing': 'Writ', 'composition & production': 'C&P',
  'creative writing': 'CrWri', 'ap english language & composition': 'AP Lang', 'ap english literature & composition': 'AP Lit',
  'english language development': 'ELD', 'language & cultural literacy': 'LCL', 'self-efficacy': 'Self',
  // Math
  'mathematics': 'Math', 'mathematics enriched': 'Math+', 'mathématiques': 'Math', 'workplace mathematics': 'Math',
  'apprenticeship mathematics': 'Math', 'foundations of mathematics': 'Found', 'foundations of mathematics & pre-calculus': 'Math',
  'pre-ap foundations of mathematics & pre-calculus': 'Math', 'pre-calculus': 'PreC', 'pre-calculus honours': 'PreC',
  'pre-ap pre-calculus': 'PreC', 'ap pre-calculus': 'AP PreC', 'calculus': 'Calc', 'ap calculus ab': 'AP Calc',
  'ap calculus bc': 'AP Calc', 'ap statistics': 'AP Stat',
  // Science
  'science': 'Sci', 'sciences': 'Sci', 'chemistry': 'Chem', 'ap chemistry': 'AP Chem', 'physics': 'Phys',
  'ap physics honours': 'AP Phys', 'life sciences': 'Bio', 'ap life sciences': 'AP Bio', 'ap biology': 'AP Bio',
  'earth science': 'Earth', 'anatomy & physiology': 'Anat', 'geology': 'Geol', 'ap psychology': 'AP Psy',
  // Socials
  'social studies': 'SS', 'sciences humaines': 'SH', 'explorations en sciences humaines et sociales': 'SH',
  '20th century world history': 'Hist', 'bc first peoples': 'BCFP', 'comparative cultures': 'Cult', 'economics': 'Econ',
  'economic theory': 'Econ T', 'genocide studies': 'Geno', 'human geography': 'HGeo', 'law studies': 'Law',
  'études du droit': 'Droit', 'philosophy': 'Phil', 'social justice': 'SJ',
  // Languages
  'french': 'Frnch', 'français langue': 'FRAL', 'langue et culture de la francophonie': 'FRAL',
  'ap french language & culture': 'AP Fr', 'spanish': 'Span', 'introductory spanish': 'Span', 'japanese': 'Jpn',
  'introductory japanese': 'Jpn', 'ap japanese language & culture': 'AP Jpn', 'mandarin': 'Mand',
  'introductory mandarin': 'Mand', 'ap chinese language & culture': 'AP Chin', 'introductory farsi': 'Farsi',
  // PE
  'physical & health education': 'PE', 'physical education: girls fitness': 'PE', 'active living': 'Activ',
  'fitness & conditioning': 'Fit',
  // Careers
  'career education': 'CE', 'career life education': 'CLE', 'éducation au choix de carrière et de vie': 'CLE',
  'career life connections': 'CLC', 'work experience': 'Work', 'senior mentorship': 'Mentr', 'student leadership': 'Lead',
  'study block': 'Study',
  // Business / tech / ADST
  'applied design, skills & technology': 'ADST', 'entrepreneurship & marketing': 'Entre', 'marketing & promotion': 'Mktg',
  'accounting': 'Acct', 'e-commerce': 'ECom', 'computers & communication devices': 'Comp', 'computer studies': 'Comp',
  'computer information systems': 'CIS', 'computer programming': 'Prog', 'ap computer science a': 'AP CSA',
  'ap computer science principles': 'AP CSP', 'ap capstone seminar': 'AP Cap', 'ap capstone research': 'AP Cap',
  'textiles': 'Tex', 'woodwork': 'Wood', 'drafting': 'Draft', 'food studies': 'Foods',
  // Arts
  'arts education': 'Art', 'arts education: visual arts': 'Art', 'arts education: ceramics & sculpture': 'Ceram',
  'arts education: media arts': 'Media', 'visual arts': 'Art', 'media arts': 'Media', 'media arts: yearbook': 'Yrbk',
  'photography': 'Photo', 'ceramics': 'Ceram', 'studio arts 2-d': 'Art2D', 'studio arts 3-d': 'Art3D',
  'art studio': 'AP Art', 'ap drawing': 'AP Draw', 'ap 2-d art & design': 'AP 2D', 'ap 3-d art & design': 'AP 3D',
  'drama': 'Drama', 'theatre company': 'TheCo', 'theatre production': 'ThPro', 'directing & script development': 'Direc',
  'dance': 'Dance', 'dance technique & performance': 'Dance', 'music': 'Music', 'concert band': 'Band', 'jazz band': 'Jazz',
  'jazz stage band': 'Jazz', 'orchestra': 'Orch', 'orchestral strings': 'Orch', 'concert choir': 'Choir',
  // Academies
  'badminton academy': 'Bdmtn', 'baseball academy': 'Bsbl', 'basketball academy': 'Bball', 'fencing academy': 'Fence',
  'field hockey academy': 'FHock', 'volleyball academy': 'Vball', 'mechatronics robotics academy': 'Robot',
  'soccer academy': 'Soccr', 'tennis academy': 'Tenis',
  // Extras (clubs, teams)
  'yell': 'YELL', 'student council': 'StuCo', 'grad committee': 'Grad', 'yearbook': 'Yrbk', 'sentinel sun': 'Sun',
  'multicultural club': 'Multi', 'rotary interact club': 'Rotry', 'science club': 'Sci', 'robotics club': 'Robot',
  'debate club': 'Debat', 'model un': 'MUN', 'chess club': 'Chess', 'math club': 'Math', 'peer tutoring': 'Tutor',
  'leadership': 'Lead', 'link crew': 'Link', 'basketball': 'Bball', 'soccer': 'Soccr', 'rugby': 'Rugby',
  'volleyball': 'Vball', 'cross country': 'XC', 'track & field': 'Track', 'swimming': 'Swim', 'tennis': 'Tenis',
  'golf': 'Golf', 'ultimate': 'Ulti', 'field hockey': 'FHock', 'badminton': 'Bdmtn', 'ski & snowboard': 'Ski',
  'french immersion': 'FI', 'exchange program': 'Exchg',
};

const GRADE_RE = /\b\d{1,2}[AB]?(?:\/\d{1,2})*\b(?!-)/g;   // "12", "12A", "8/9", "10/11/12"; not "2-D"
const NOISE_RE = /^(sr\.?|jr\.?|boys|girls|the)\s+/i;   // "Sr. Boys Basketball" → "Basketball"

export const shortName = (name: string, opts: { grade?: boolean } = {}): string => {
  const withGrade = opts.grade !== false;
  if (/^spare$/i.test(name.trim())) return 'Spare';
  const noParen = name.replace(/\(.*?\)/g, '');
  const grades = [...new Set(noParen.match(/\b\d{1,2}[AB]?\b(?!-)/g) || [])];
  // Only a single plain grade goes on the tag; "8/9" and "10/11/12" are left off.
  const grade = withGrade && grades.length === 1 ? grades[0] : '';
  let base = noParen.replace(GRADE_RE, ' ').replace(/\s+/g, ' ').replace(/\s+:/, ':').replace(/[\s:]+$/, '').trim();
  while (NOISE_RE.test(base)) base = base.replace(NOISE_RE, '');
  const key = base.toLowerCase();
  let tag = SHORT_TAGS[key];
  if (!tag) {
    // Unknown course (typed by hand): first real word, 5 letters, title case.
    const w = base.split(/\s+/).map(x => x.replace(/[^A-Za-z&+]/g, '')).filter(Boolean);
    if (w.length === 0) return '—';
    const first = w[0].slice(0, 5);
    tag = /^[A-Z]{2,5}$/.test(first) ? first : first[0].toUpperCase() + first.slice(1).toLowerCase();
  }
  // Two-word tags ("AP Chem", "Econ T") are already full width; no grade on those.
  return grade && !tag.includes(' ') ? `${tag} ${grade}` : tag;
};

type Ctx = {
  profile: StudentProfile | null;
  loaded: boolean;
  signedIn: boolean;
  online: boolean;            // last backend call succeeded (false = running on cache)
  roles: Role[];              // App Club Admin roles bound to this account (server-issued)
  // sign up / edit; also signs in. `serverFirst` (teacher sign-up): make the
  // server account before anything is kept here, so a refusal leaves no account
  // that only exists on this phone.
  save: (p: StudentProfile, password?: string, opts?: { serverFirst?: boolean }) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<string | null>; // null = ok, else error text
  signOut: () => Promise<void>;                         // keeps the account on the device
  clear: () => Promise<void>;                           // deletes the account from the device
  changePassword: (current: string, next: string) => Promise<string | null>; // null = ok, else error text
  deleteAccount: () => Promise<string | null>;          // server account + everything on this device
  redeemInvite: (code: string) => Promise<Role>;        // App Club Admin: bind a role to this account
  refreshRoles: () => Promise<void>;
  setPinnedBadges: (ids: string[]) => Promise<void>;   // Social: up to four badges under your name
  setAvatar: (a: AvatarSpec) => Promise<void>;          // Social: what friends see instead of a photo
  catchUpOpen: boolean;                                 // the Catch Up flow is on screen (App.tsx)
  openCatchUp: () => void;
  closeCatchUp: () => void;
  saveCatchUpProgress: (answers: Answers, score: number) => void;
  finishCatchUp: (answers: Answers, badgeIds: string[]) => Promise<Badge[]>;   // the badges this really unlocked
  resetCatchUp: () => Promise<string | null>;           // null = ok, else error text
};

const ProfileCtx = createContext<Ctx>({
  profile: null, loaded: false, signedIn: false, online: false, roles: [],
  save: async () => {}, setPinnedBadges: async () => {}, setAvatar: async () => {}, signIn: async () => 'Not ready', signOut: async () => {}, clear: async () => {},
  changePassword: async () => 'Not ready', deleteAccount: async () => 'Not ready',
  redeemInvite: async () => { throw new Error('Not ready'); }, refreshRoles: async () => {},
  catchUpOpen: false, openCatchUp: () => {}, closeCatchUp: () => {}, saveCatchUpProgress: () => {},
  finishCatchUp: async () => [], resetCatchUp: async () => 'Not ready',
});

// Server row → the shape the app already uses. Server wins on conflict; local
// only keeps things the server never sees (password hash, photo file path).
const fromRemote = (r: RemoteProfile, local: StudentProfile | null): StudentProfile => ({
  ...(local || emptyProfile()),
  firstName: r.first_name, lastName: r.last_name, grade: r.grade,
  // A server without 0026 sends no kind: keep what this phone knows.
  ...(r.kind ? { kind: r.kind } : {}), ...(r.kind === 'teacher' ? { dept: r.dept || local?.dept || '' } : {}),
  pronouns: r.pronouns || local?.pronouns, studentId: r.student_id || local?.studentId,
  email: r.email, artonaUrl: r.artona_url || local?.artonaUrl, friendCode: r.friend_code || local?.friendCode,
  courses: Array.isArray(r.timetable) && r.timetable.length === SLOTS.length ? r.timetable : (local?.courses || emptyCourses()),
  extraCourses: Array.isArray(r.extras) ? r.extras : (local?.extraCourses || []),
  pinnedBadges: Array.isArray(r.pinned_badges) ? r.pinned_badges : (local?.pinnedBadges || []),
  ...(r.avatar ? { avatar: avatarOf(r.avatar) } : local?.avatar ? { avatar: local.avatar } : {}),
  photoUrl: r.photo_url || undefined,
  catchUp: catchUpFrom(r, local?.catchUp),
});
// A server without migration 0019 sends no catch_up_score: keep the phone's copy.
const catchUpFrom = (r: RemoteProfile, local?: CatchUpState): CatchUpState | undefined => {
  if (r.catch_up_score === undefined || local?.pending) return local;
  const answers = r.catch_up_answers && Object.keys(r.catch_up_answers).length ? r.catch_up_answers : local?.answers;
  return { score: r.catch_up_score, doneAt: r.catch_up_done_at || undefined, answers };
};
const toRemote = (p: StudentProfile) => ({
  first_name: p.firstName, last_name: p.lastName, grade: p.grade,
  pronouns: p.pronouns || null, student_id: p.studentId || null, artona_url: p.artonaUrl || null,
  timetable: p.courses, extras: p.extraCourses, pinned_badges: p.pinnedBadges || [],
  ...(isTeacher(p) ? { dept: p.dept?.trim() || null } : {}),   // only teachers: the column arrives with 0026
});   // avatar goes up on its own (setAvatar), so a server without 0014 can't fail a save

// A photo on this phone as bytes for upload. Native: the file in the app's
// documents; web: a blob: or data: URL.
const readPhoto = async (uri: string): Promise<{ bytes: ArrayBuffer | Blob; type: string }> => {
  const type = /\.png($|\?)/i.test(uri) ? 'image/png' : 'image/jpeg';
  if (uri.startsWith('file:')) {
    const { File } = await import('expo-file-system');
    return { bytes: await new File(uri).arrayBuffer(), type };
  }
  const blob = await (await fetch(uri)).blob();
  return { bytes: blob, type: blob.type || type };
};

// "johnd907" → full address; a full address passes through; a student number
// resolves only against the account cached on this device.
const toEmail = (identifier: string, local: StudentProfile | null): string | null => {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  if (id.includes('@')) return id;
  if (/^\d+$/.test(id)) return id === (local?.studentId || '') ? (local?.email || null) : null;
  // "johnd907" is a student; "dgrant" (no digits) is a teacher.
  return `${id}@${EMAIL_LOCAL_RE.test(id) ? EMAIL_DOMAIN : TEACHER_DOMAIN}`;
};

// Everything the app keeps on the device for one student. Theme stays: it is
// a device preference, not account data.
const isAccountKey = (k: string) => /^(spartans|sentinel)-/.test(k) && k !== 'sentinel-theme';

// `onReset` lets the app remount the stores below this provider after a wipe,
// so no grades, pins or events from the deleted account linger in memory.
export const ProfileProvider = ({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const latest = useRef<StudentProfile | null>(null);
  latest.current = profile;
  const lastProgress = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => { setXpGrade(profile?.grade || 8); }, [profile?.grade]);

  const cacheRoles = (r: Role[]) => { setRoles(r); AsyncStorage.setItem(ROLES_KEY, JSON.stringify(r)).catch(() => {}); };

  const patchCatchUp = (fn: (c: CatchUpState | undefined) => CatchUpState | undefined) =>
    setProfile(p => {
      if (!p) return p;
      const next = { ...p, catchUp: fn(p.catchUp) };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  // Send a Catch Up finished on this phone. A failure stays pending and is
  // tried again on the next sync, so the badges and the "done" are never lost.
  const pushCatchUp = async (c?: CatchUpState) => {
    if (!backendConfigured || !c?.pending || !c.doneAt) return;
    try {
      if (!(await remoteAuth.session())) return;
      await lastProgress.current.catch(() => {});
      await remoteCatchUp.finish(c.answers || {}, c.claimed || []);
      patchCatchUp(x => x ? { score: x.score, doneAt: x.doneAt, answers: x.answers } : x);
    } catch { /* offline, or 0019 not run yet */ }
  };

  // Pull the server copy of the profile + roles; quietly keep the cache if offline.
  const sync = async (local: StudentProfile | null) => {
    if (!backendConfigured) return;
    try {
      // No server session (offline sign-in): running on the device copy.
      if (!(await remoteAuth.session())) { setOnline(false); return; }
      await pushCatchUp((latest.current ?? local)?.catchUp);
      const [r, myRoles] = await Promise.all([remoteProfile.me(), remoteAdmin.myRoles()]);
      if (r) {
        // Merged onto the latest copy: this call may have started before a
        // change made on this phone, and must not undo it.
        setProfile(prev => {
          const merged = fromRemote(r, prev ?? local);
          AsyncStorage.setItem(KEY, JSON.stringify(merged)).catch(() => {});
          return merged;
        });
        remoteBadges.of(r.id).then(mergeServerAwards).catch(() => {});
      }
      cacheRoles(myRoles);
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
        // Not awaited: the app opens on the device copy straight away and the
        // server copy lands a moment later. Waiting here held the splash up
        // for three round trips on every launch.
        if (s === '1') sync(local);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Sign up (no session yet) or update (session exists). Throws with a
  // readable message if the server refuses; the local copy is saved first so
  // nothing typed is lost.
  const save = async (p: StudentProfile, password?: string, opts?: { serverFirst?: boolean }) => {
    const signUp = (pw: string) => remoteAuth.signUp(p.email!, pw, {
      first_name: p.firstName, last_name: p.lastName, grade: p.grade,
      pronouns: p.pronouns, student_id: p.studentId,
      ...(isTeacher(p) ? { dept: p.dept } : {}),
    });
    let made = false;
    if (opts?.serverFirst && backendConfigured && p.email && password && !(await remoteAuth.session().catch(() => null))) {
      await signUp(password);
      made = true;
    }
    setProfile(p);
    setSignedIn(true);
    await AsyncStorage.multiSet([[KEY, JSON.stringify(p)], [SESSION_KEY, '1']]);
    if (!backendConfigured || !p.email) return;
    try {
      const session = await remoteAuth.session();
      if (!session) {
        // Editing while signed in on the cached account only (offline sign-in):
        // the change is saved on this device; nothing to send yet.
        // `made`: the account exists but email confirmation is on, so there
        // is no session yet; the timetable is pushed on first sign-in.
        if (made) { setOnline(true); return; }
        if (!password) { setOnline(false); return; }
        const res = await signUp(password);
        // Email confirmation still on → no session yet. The account exists;
        // the timetable is pushed on first sign-in.
        if (!res.session) { setOnline(true); return; }
      } else if (password && !made) {
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
    const teacherEmail = email.endsWith(`@${TEACHER_DOMAIN}`);
    try {
      await remoteAuth.signIn(email, password);
    } catch (e: any) {
      const msg = String(e?.message || '');
      // Server reachable but said no → real error. Unreachable → cached account.
      if (/network|fetch|timeout/i.test(msg)) return localSignIn(identifier, password);
      return /invalid login/i.test(msg) ? 'Wrong email or password.' : msg;
    }
    const same = (profile?.email || '').toLowerCase() === email;
    if (!same) await clearEarned();
    const base: StudentProfile = {
      ...(same && profile ? profile : { ...emptyProfile(), ...(teacherEmail ? { kind: 'teacher' as const, grade: 0, pronouns: '' } : {}) }),
      email, passwordHash: hashPassword(password),
    };
    setProfile(base);
    setSignedIn(true);
    await AsyncStorage.multiSet([[KEY, JSON.stringify(base)], [SESSION_KEY, '1']]);
    // Account made on this device before the server had it (or while email
    // confirmation was pending): push the timetable up once.
    const hasLocal = same && base.courses.some(k => k.name);
    const finish = async () => {
      if (hasLocal) {
        const r = await remoteProfile.me().catch(() => null);
        if (r && (!Array.isArray(r.timetable) || r.timetable.length === 0)) await remoteProfile.update(toRemote(base)).catch(() => {});
      }
      await sync(base);
    };
    // This device already has the timetable: go straight in and let the server
    // copy catch up behind. A new device has nothing to show, so it waits.
    if (hasLocal) finish().catch(() => {}); else await finish();
    return null;
  };

  const signOut = async () => {
    setSignedIn(false);
    cacheRoles([]);   // the next person on this phone must not inherit them
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

  // Settings → Account & privacy. The current password is checked against the
  // device copy (always set after sign-in), or against the server if missing.
  const changePassword = async (current: string, next: string) => {
    if (!profile) return 'Not signed in.';
    if (next.length < MIN_PASSWORD) return `New password needs at least ${MIN_PASSWORD} characters.`;
    if (profile.passwordHash) {
      if (hashPassword(current) !== profile.passwordHash) return 'Current password is wrong.';
    } else if (backendConfigured && profile.email) {
      try { await remoteAuth.signIn(profile.email, current); } catch { return 'Current password is wrong.'; }
    }
    if (backendConfigured && profile.email && (await remoteAuth.session().catch(() => null))) {
      try { await remoteAuth.updatePassword(next); }
      catch (e: any) { return String(e?.message || 'Could not reach the server. Try again when you are online.'); }
    } else if (backendConfigured) {
      return 'Sign out and back in while online, then try again.';
    }
    const p = { ...profile, passwordHash: hashPassword(next) };
    setProfile(p);
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
    return null;
  };

  // Server first: if that fails nothing local is touched, so the student is
  // never left with a server account they can no longer see.
  const deleteAccount = async () => {
    if (backendConfigured) {
      if (!(await remoteAuth.session().catch(() => null))) return 'Sign out and back in while online, then try again.';
      try { await remoteAuth.deleteAccount(); }
      catch (e: any) {
        const msg = String(e?.message || '');
        return /network|fetch|timeout/i.test(msg) || !msg
          ? 'Could not reach the server. Connect to the internet and try again.'
          : msg;
      }
    }
    await clearEarned();
    const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(isAccountKey);
    await AsyncStorage.multiRemove(keys).catch(() => {});
    setProfile(null);
    setSignedIn(false);
    setRoles([]);
    setOnline(false);
    onReset?.();
    return null;
  };

  const redeemInvite = async (code: string) => {
    if (!backendConfigured) throw new Error('Backend not configured on this build.');
    const role = await remoteAdmin.redeemInvite(code);
    cacheRoles(await remoteAdmin.myRoles());
    return role;
  };
  const refreshRoles = async () => { await sync(profile); };

  // Pins are a profile field, saved here and pushed to the server when there
  // is a session. Never signs anyone in or up.
  const setPinnedBadges = async (ids: string[]) => {
    if (!profile) return;
    const next = { ...profile, pinnedBadges: ids.slice(0, 4) };   // MAX_PINNED in social.ts
    setProfile(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    if (!backendConfigured) return;
    try {
      if (await remoteAuth.session()) await remoteProfile.update({ pinned_badges: next.pinnedBadges });
    } catch { /* offline: pushed with the next save */ }
  };

  // Profile photo → friends. Uploads when the photo on this phone changes
  // (or was never sent), clears the server copy when it's removed. A failure
  // just waits for the next launch or change.
  useEffect(() => {
    if (!backendConfigured || !profile || !online) return;
    const local = profile.photoUri || '';
    // Only a change made on this phone counts, so signing in on a phone with
    // no photo never wipes the one friends already see.
    if (local === (profile.photoFrom || '')) return;
    let stale = false;
    (async () => {
      try {
        if (!(await remoteAuth.session())) return;
        let url: string | null = null;
        if (local) {
          const { bytes, type } = await readPhoto(local);
          url = await remoteProfile.uploadPhoto(bytes, type);
        } else {
          await remoteProfile.removePhoto().catch(() => {});
        }
        await remoteProfile.update({ photo_url: url });
        if (stale) return;
        setProfile(p => {
          if (!p || (p.photoUri || '') !== local) return p;
          const next = { ...p, photoUrl: url || undefined, photoFrom: local };
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      } catch { /* offline or 0015 not run yet */ }
    })();
    return () => { stale = true; };
  }, [online, profile?.photoUri, profile?.photoFrom]);   // eslint-disable-line react-hooks/exhaustive-deps

  const setAvatar = async (a: AvatarSpec) => {
    if (!profile) return;
    const next = { ...profile, avatar: avatarOf(a) };
    setProfile(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    if (!backendConfigured) return;
    try {
      if (await remoteAuth.session()) await remoteProfile.update({ avatar: next.avatar });
    } catch { /* offline: pushed with the next save */ }
  };

  // ── Catch Up ──
  // Progress goes up as they answer, so the account's score stays true even if
  // they stop halfway.
  const saveCatchUpProgress = (answers: Answers, score: number) => {
    patchCatchUp(c => (c?.doneAt ? c : { score, answers }));
    if (!backendConfigured) return;
    lastProgress.current = remoteAuth.session()
      .then(s => (s ? remoteProfile.update({ catch_up_score: score, catch_up_answers: answers }) : null))
      .catch(() => {});
  };

  // Badges land straight away, on this phone, and the server catches up behind.
  const finishCatchUp = async (answers: Answers, badgeIds: string[]) => {
    await revokeBadges(catchUpBadgeIds());   // a redo replaces the last answers
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fresh = await earnCatchUp(badgeIds, iso, now.getTime());
    const done: CatchUpState = { score: 100, doneAt: now.toISOString(), answers, claimed: badgeIds, pending: true };
    patchCatchUp(() => done);
    pushCatchUp(done);
    return fresh;
  };

  const resetCatchUp = async () => {
    const mine = latest.current?.catchUp;
    let gone = catchUpBadgeIds();
    if (backendConfigured && !mine?.pending) {
      try {
        if (!(await remoteAuth.session())) return 'Sign out and back in while online, then try again.';
        gone = [...new Set([...gone, ...(await remoteCatchUp.reset())])];
      } catch { return 'Could not reach the server. Connect to the internet and try again.'; }
    }
    await revokeBadges(gone);
    patchCatchUp(c => ({ score: 0, answers: c?.answers }));
    return null;
  };

  return (
    <ProfileCtx.Provider value={{
      profile, loaded, signedIn, online, roles, save, signIn, signOut, clear, changePassword, deleteAccount, redeemInvite, refreshRoles, setPinnedBadges, setAvatar,
      catchUpOpen, openCatchUp: () => setCatchUpOpen(true), closeCatchUp: () => setCatchUpOpen(false), saveCatchUpProgress, finishCatchUp, resetCatchUp,
    }}>
      {children}
    </ProfileCtx.Provider>
  );
};

export const useProfile = () => useContext(ProfileCtx);
