// Spartans — the school's real clubs, and announcements inside a program
// (migration 0021).
//   useClubs()             Sentinel's club list, kept by staff in App Club →
//                          Clubs & programs. "Add programs" shows it first
//                          (src/screens/ProgramsScreen.tsx), and a club's page
//                          shows its blurb, meeting time, room and sponsor.
//                          Adding a club is still just an extra by name
//                          (toExtra in src/programs.ts), so the built-in
//                          catalog keeps working offline and in demo.
//   useProgramPosts(name)  one program's own announcements, pinned first then
//                          newest, above the App Club news that mentions it
//                          (src/components/ProgramBody.tsx).
//   useCanPost(name)       staff (Owner, President, Teacher Sponsor, teacher)
//                          post anywhere; a program's managers post in theirs.
//   useProgramManagers()   staff: who runs each program.
// A program is its name lowercased and trimmed (programKey, the same as
// classKey in src/programs.ts and program_key on the server).
//
// Module-level stores with listeners (like badgeDesigns.ts), so the Programs
// tab, every open program and the admin page share one copy. Live mode reads
// the server and keeps the last copy on this phone for offline; demo keeps
// everything on this phone (starting from the built-in clubs); a release
// build with no server shows no club list and no posts, never an error.
// The server checks every write (RLS + can_post_program in 0021).

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { demoBuild } from './supabase';
import { useContent, ContentMode } from './content';
import { useProfile, fullName } from './ProfileContext';
import { REAL_CLUBS } from './clubList';
import { isStaff } from './ranks';
import type { ClubKind, ClubRow, ManagerRow, ProgramPostRow } from './backend';

export type { ClubKind } from './backend';
export const programKey = (name: string) => name.trim().toLowerCase();

const CLUBS_KEY = 'spartans-clubs-v1';                 // live: last server copy
const CLUBS_DEMO_KEY = 'spartans-clubs-demo-v1';       // demo: the list itself
const POSTS_KEY = 'spartans-program-posts-v1';         // live: last copy per program
const POSTS_DEMO_KEY = 'spartans-program-posts-demo-v1';
const MANAGERS_DEMO_KEY = 'spartans-program-managers-demo-v1';
const FRESH = 5 * 60_000;
const NEEDS = 'Clubs and program posts need migration 0021 on the server.';
const needs0021 = (e: any) => /does not exist|schema cache|could not find/i.test(String(e?.message));
const errText = (e: any, fallback: string) => needs0021(e) ? NEEDS
  : /duplicate key|clubs_key/i.test(String(e?.message)) ? 'There is already a club with that name.'
  : String(e?.message || fallback);

// ── Tiny shared store ───────────────────────────────────────────
const createStore = <T extends object>(init: T) => {
  let v = init;
  const ls = new Set<() => void>();
  return {
    get: () => v,
    set: (patch: Partial<T>) => { v = { ...v, ...patch }; ls.forEach(f => f()); },
    listen: (f: () => void) => { ls.add(f); return () => { ls.delete(f); }; },
  };
};
type Store<T> = { get: () => T; set: (patch: Partial<T>) => void; listen: (f: () => void) => () => void };
const useStore = <T extends object>(s: Store<T>): T => {
  const [, bump] = useState(0);
  useEffect(() => s.listen(() => bump(x => x + 1)), [s]);
  return s.get();
};

const readJSON = async <T,>(key: string, fallback: T): Promise<T> => {
  try { const v = await AsyncStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
};
const writeJSON = (key: string, v: unknown) => { AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {}); };
const localId = () => `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── Clubs ───────────────────────────────────────────────────────
export type Club = {
  id: string; name: string; kind: ClubKind; blurb: string; meets: string; room: string; sponsor: string; active: boolean;
  gc: string;       // Google Classroom code to join ('' = none yet)
  isNew: boolean;   // new this year
};
export const CLUB_KINDS: ClubKind[] = ['club', 'sport', 'music', 'extra', 'outside'];
export const newClub = (): Club => ({ id: '', name: '', kind: 'club', blurb: '', meets: '', room: '', sponsor: '', active: true, gc: '', isNew: false });

const fromClubRow = (r: ClubRow): Club => ({
  id: r.id, name: r.name, kind: CLUB_KINDS.includes(r.kind) ? r.kind : 'club', blurb: r.blurb || '', meets: r.meets || '',
  room: r.room || '', sponsor: r.sponsor || '', active: r.active, gc: r.gc_code || '', isNew: !!r.is_new,
});
const byName = (a: Club, b: Club) => a.name.localeCompare(b.name);

// Sentinel's real club sheet (src/clubList.ts, the same rows as migration
// 0023 / supabase/seed/clubs.sql). Demo starts with these.
export const builtInClubs = (): Club[] => REAL_CLUBS.map(r => ({
  ...newClub(), id: localId(), name: r.name, kind: r.kind || 'club', blurb: r.blurb, meets: r.meets,
  room: r.room, sponsor: r.sponsor, gc: r.gc, isNew: !!r.isNew,
}));

type ClubsState = { list: Club[] | null; server: boolean; note: string | null; at: number; mode: ContentMode | null; signedIn: boolean };
const clubsS = createStore<ClubsState>({ list: null, server: false, note: null, at: 0, mode: null, signedIn: false });
let clubsLoading: Promise<void> | null = null;

export const loadClubs = (mode: ContentMode, signedIn: boolean, force = false): Promise<void> => {
  const s = clubsS.get();
  const same = s.mode === mode && s.signedIn === signedIn;
  if (!force && same && s.list && Date.now() - s.at < FRESH) return Promise.resolve();
  if (clubsLoading && same) return clubsLoading;
  clubsLoading = (async () => {
    if (mode !== 'live') {
      const list = demoBuild ? (await readJSON<Club[] | null>(CLUBS_DEMO_KEY, null)) ?? builtInClubs() : [];
      clubsS.set({ list: list.sort(byName), server: false, note: null, at: Date.now(), mode, signedIn });
      return;
    }
    try {
      const { clubs } = await import('./backend');
      const list = (await clubs.list()).map(fromClubRow).sort(byName);
      clubsS.set({ list, server: true, note: null, at: Date.now(), mode, signedIn });
      writeJSON(CLUBS_KEY, list);
    } catch (e: any) {
      // Offline (or 0021 not run): the last copy, and try again next time.
      clubsS.set({ list: await readJSON<Club[]>(CLUBS_KEY, []), server: false, note: errText(e, 'Could not load the club list.'), at: 0, mode, signedIn });
    }
  })().finally(() => { clubsLoading = null; });
  return clubsLoading;
};

export const useClubs = () => {
  const { mode } = useContent();
  const { signedIn } = useProfile();
  const s = useStore(clubsS);
  useEffect(() => { loadClubs(mode, signedIn); }, [mode, signedIn]);
  const all = s.list || [];

  const keepDemo = (list: Club[]) => { clubsS.set({ list: [...list].sort(byName) }); writeJSON(CLUBS_DEMO_KEY, list); };

  // Staff. Throws with a sentence to show.
  const save = async (c: Club): Promise<Club> => {
    const clean = {
      name: c.name.trim().replace(/\s+/g, ' '), kind: c.kind, blurb: c.blurb.trim() || null, meets: c.meets.trim() || null,
      room: c.room.trim() || null, sponsor: c.sponsor.trim() || null, active: c.active,
      gc_code: c.gc.trim() || null, is_new: c.isNew,
    };
    if (clean.name.length < 2) throw new Error('Give the club a name.');
    const dup = (clubsS.get().list || []).find(x => x.id !== c.id && programKey(x.name) === programKey(clean.name));
    if (dup) throw new Error('There is already a club with that name.');
    if (mode === 'live') {
      try {
        const { clubs } = await import('./backend');
        const row = c.id && !c.id.startsWith('local-') ? await clubs.update(c.id, clean) : await clubs.add(clean);
        const saved = fromClubRow(row);
        const list = [...(clubsS.get().list || []).filter(x => x.id !== saved.id), saved].sort(byName);
        clubsS.set({ list }); writeJSON(CLUBS_KEY, list);
        return saved;
      } catch (e: any) { throw new Error(errText(e, 'Could not save the club.')); }
    }
    if (!demoBuild) throw new Error('The club list needs the server.');
    const saved: Club = {
      id: c.id || localId(), name: clean.name, kind: clean.kind, blurb: clean.blurb || '', meets: clean.meets || '',
      room: clean.room || '', sponsor: clean.sponsor || '', active: clean.active,
      gc: clean.gc_code || '', isNew: clean.is_new,
    };
    keepDemo([...(clubsS.get().list || []).filter(x => x.id !== saved.id), saved]);
    return saved;
  };

  const remove = async (id: string) => {
    if (mode === 'live') {
      try { const { clubs } = await import('./backend'); await clubs.remove(id); }
      catch (e: any) { throw new Error(errText(e, 'Could not delete the club.')); }
      const list = (clubsS.get().list || []).filter(x => x.id !== id);
      clubsS.set({ list }); writeJSON(CLUBS_KEY, list);
      return;
    }
    keepDemo((clubsS.get().list || []).filter(x => x.id !== id));
  };

  return {
    clubs: all.filter(x => x.active),   // what students see
    all,                                // staff: hidden ones too
    loaded: s.list !== null, server: s.server, note: s.note,
    reload: () => loadClubs(mode, signedIn, true), save, remove,
  };
};

// The club row behind a program, if staff added one.
export const clubFor = (list: Club[], name: string) => {
  const k = programKey(name);
  return list.find(x => programKey(x.name) === k) || null;
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Name word-prefix matches first, then anywhere in the name, blurb or sponsor.
export const matchClubs = (q: string, list: Club[], exclude: Set<string> = new Set()): Club[] => {
  const pool = list.filter(x => !exclude.has(programKey(x.name)));
  const s = norm(q.trim());
  if (!s) return pool;
  const starts: Club[] = [], contains: Club[] = [];
  for (const x of pool) {
    const n = norm(x.name);
    if (n.startsWith(s) || n.split(/[\s(]+/).some(w => w.startsWith(s))) starts.push(x);
    else if (n.includes(s) || norm(`${x.blurb} ${x.sponsor}`).includes(s)) contains.push(x);
  }
  return [...starts, ...contains];
};

// "Tuesdays at lunch · Room 214 · Ms. Rivera"
export const clubLine = (x: Club) => [x.meets, x.room, x.sponsor].map(s => s.trim()).filter(Boolean).join(' · ');

// ── Program posts ───────────────────────────────────────────────
export type ProgramPost = {
  id: string; key: string; title: string; body: string; pinned: boolean;
  author: string | null; authorName: string; createdAt: string;
};
const fromPostRow = (r: ProgramPostRow): ProgramPost => ({
  id: r.id, key: r.program_key, title: r.title, body: r.body || '', pinned: r.pinned,
  author: r.author, authorName: r.author_name || '', createdAt: r.created_at,
});
const sortPosts = (a: ProgramPost, b: ProgramPost) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt);

type PostEntry = { list: ProgramPost[]; at: number; note: string | null };
const postsS = createStore<{ byKey: Record<string, PostEntry>; mode: ContentMode | null }>({ byKey: {}, mode: null });
const postsLoading = new Map<string, Promise<void>>();

const setEntry = (key: string, patch: Partial<PostEntry>) => {
  const s = postsS.get();
  const prev = s.byKey[key] || { list: [], at: 0, note: null };
  const next = { ...prev, ...patch, list: [...(patch.list ?? prev.list)].sort(sortPosts) };
  postsS.set({ byKey: { ...s.byKey, [key]: next } });
  return next;
};
// Live: the last copy of each program, for offline. Demo: the posts themselves.
const persistPosts = (mode: ContentMode) => {
  const byKey = postsS.get().byKey;
  const out: Record<string, ProgramPost[]> = {};
  for (const k of Object.keys(byKey).slice(-40)) out[k] = byKey[k].list;
  writeJSON(mode === 'live' ? POSTS_KEY : POSTS_DEMO_KEY, out);
};

const loadPosts = (mode: ContentMode, key: string, force = false): Promise<void> => {
  const s = postsS.get();
  if (s.mode !== mode) postsS.set({ byKey: {}, mode });
  const have = postsS.get().byKey[key];
  if (!force && have && Date.now() - have.at < FRESH) return Promise.resolve();
  const running = postsLoading.get(key);
  if (running) return running;
  const p = (async () => {
    if (mode !== 'live') {
      const saved = demoBuild ? await readJSON<Record<string, ProgramPost[]>>(POSTS_DEMO_KEY, {}) : {};
      setEntry(key, { list: saved[key] || [], at: Date.now(), note: null });
      return;
    }
    try {
      const { programPosts } = await import('./backend');
      setEntry(key, { list: (await programPosts.list(key)).map(fromPostRow), at: Date.now(), note: null });
      persistPosts(mode);
    } catch (e: any) {
      const saved = await readJSON<Record<string, ProgramPost[]>>(POSTS_KEY, {});
      setEntry(key, { list: have?.list.length ? have.list : saved[key] || [], at: 0, note: needs0021(e) ? NEEDS : null });
    }
  })().finally(() => { postsLoading.delete(key); });
  postsLoading.set(key, p);
  return p;
};

// This account's id, to know which posts are yours (demo: 'me').
let myId: string | null = null;
const useMyId = (mode: ContentMode, signedIn: boolean) => {
  const [id, setId] = useState<string | null>(mode === 'live' ? myId : 'me');
  useEffect(() => {
    if (mode !== 'live') { setId('me'); return; }
    if (!signedIn) { myId = null; setId(null); return; }
    import('./backend').then(b => b.auth.userId()).then(v => { myId = v; setId(v); }).catch(() => {});
  }, [mode, signedIn]);
  return id;
};

export const useProgramPosts = (name: string) => {
  const key = programKey(name);
  const { mode, roles } = useContent();
  const { signedIn, profile } = useProfile();
  const s = useStore(postsS);
  const me = useMyId(mode, signedIn);
  useEffect(() => { loadPosts(mode, key); }, [mode, key, signedIn]);
  const entry = s.mode === mode ? s.byKey[key] : undefined;
  const list = entry?.list || [];
  const staff = isStaff(roles);

  const add = async (p: { title: string; body: string; pinned: boolean }) => {
    const clean = { title: p.title.trim(), body: p.body.trim(), pinned: p.pinned };
    if (!clean.title) throw new Error('Give the post a title.');
    if (mode === 'live') {
      try {
        const { programPosts } = await import('./backend');
        const row = await programPosts.add({ program_key: key, ...clean });
        setEntry(key, { list: [fromPostRow(row), ...list.filter(x => x.id !== row.id)] });
        persistPosts(mode);
        return;
      } catch (e: any) {
        throw new Error(needs0021(e) ? NEEDS : /row-level security|violates/i.test(String(e?.message)) ? 'Only staff and this program\'s managers can post here.' : String(e?.message || 'Could not post.'));
      }
    }
    if (!demoBuild) throw new Error('Posting needs the server.');
    const post: ProgramPost = { id: localId(), key, ...clean, author: 'me', authorName: profile ? fullName(profile) : '', createdAt: new Date().toISOString() };
    setEntry(key, { list: [post, ...list] });
    persistPosts(mode);
  };

  const update = async (id: string, patch: Partial<Pick<ProgramPost, 'title' | 'body' | 'pinned'>>) => {
    if (mode === 'live') {
      const { programPosts } = await import('./backend');
      const row = await programPosts.update(id, patch);
      setEntry(key, { list: list.map(x => x.id === id ? fromPostRow(row) : x) });
    } else {
      setEntry(key, { list: list.map(x => x.id === id ? { ...x, ...patch } : x) });
    }
    persistPosts(mode);
  };

  const remove = async (id: string) => {
    if (mode === 'live') { const { programPosts } = await import('./backend'); await programPosts.remove(id); }
    setEntry(key, { list: list.filter(x => x.id !== id) });
    persistPosts(mode);
  };

  return {
    posts: list, loaded: !!entry, note: entry?.note ?? null,
    // the author, or staff (the server checks again)
    canChange: (p: ProgramPost) => staff || (!!me && p.author === me),
    reload: () => loadPosts(mode, key, true), add, update, remove,
  };
};

// ── Who may post ────────────────────────────────────────────────
const managedS = createStore<{ keys: string[]; at: number; who: string }>({ keys: [], at: 0, who: '' });
const loadManaged = async (mode: ContentMode, signedIn: boolean, force = false) => {
  const who = `${mode}:${signedIn}`;
  const s = managedS.get();
  if (!force && s.who === who && Date.now() - s.at < FRESH) return;
  if (mode !== 'live' || !signedIn) {
    const demo = mode === 'demo' ? await readJSON<Manager[]>(MANAGERS_DEMO_KEY, []) : [];
    managedS.set({ keys: demo.filter(m => m.userId === 'me').map(m => m.key), at: Date.now(), who });
    return;
  }
  try {
    const { programManagers } = await import('./backend');
    managedS.set({ keys: await programManagers.mine(), at: Date.now(), who });
  } catch {
    managedS.set({ who, at: 0 });   // offline or 0021 not run: keep what we had
  }
};

// The program keys this account runs (empty for most students).
export const useManaged = () => {
  const { mode } = useContent();
  const { signedIn } = useProfile();
  const s = useStore(managedS);
  useEffect(() => { loadManaged(mode, signedIn); }, [mode, signedIn]);
  return s.keys;
};

export const useCanPost = (name: string) => {
  const { roles } = useContent();
  const keys = useManaged();
  return isStaff(roles) || keys.includes(programKey(name));
};

// ── Managers (staff) ────────────────────────────────────────────
export type Manager = { key: string; program: string; userId: string; name: string; email: string; grade?: number };
export type FoundPerson = { id: string; name: string; email: string; grade?: number };

const fromManagerRow = (r: ManagerRow): Manager => ({
  key: r.program_key, program: r.program_name || r.program_key, userId: r.user_id,
  name: `${r.first_name} ${r.last_name}`.trim() || r.email, email: r.email, grade: r.grade,
});
// Demo only: the same sample people as the Members page.
const DEMO_PEOPLE: FoundPerson[] = [
  { id: 'demo-maya', name: 'Maya Chen', email: 'mayac118@edu.sd45.bc.ca', grade: 10 },
  { id: 'demo-noah', name: 'Noah Patel', email: 'noahp442@edu.sd45.bc.ca', grade: 11 },
  { id: 'demo-grant', name: 'Mr. Grant', email: 'dgrant@wvschools.ca' },
];

export const useProgramManagers = () => {
  const { mode } = useContent();
  const { signedIn } = useProfile();
  const live = mode === 'live';
  const [list, setList] = useState<Manager[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!live) { setList(demoBuild ? await readJSON<Manager[]>(MANAGERS_DEMO_KEY, []) : []); return; }
    try {
      const { programManagers } = await import('./backend');
      setList((await programManagers.list()).map(fromManagerRow));
      setNote(null);
    } catch (e: any) {
      setList([]);
      setNote(errText(e, 'Could not load who runs each program.'));
    }
  }, [live]);
  useEffect(() => { load(); }, [load]);

  const keepDemo = (next: Manager[]) => { setList(next); writeJSON(MANAGERS_DEMO_KEY, next); };

  const add = async (program: string, p: FoundPerson) => {
    const key = programKey(program);
    if (key.length < 2) throw new Error('Pick a program first.');
    if (live) {
      try { const { programManagers } = await import('./backend'); await programManagers.add(key, program, p.id); }
      catch (e: any) { throw new Error(errText(e, 'Could not add them.')); }
      await load();
    } else {
      keepDemo([...(list || []).filter(m => !(m.key === key && m.userId === p.id)), { key, program: program.trim(), userId: p.id, name: p.name, email: p.email, grade: p.grade }]);
    }
    loadManaged(mode, signedIn, true);
  };

  const remove = async (m: Manager) => {
    if (live) {
      try { const { programManagers } = await import('./backend'); await programManagers.remove(m.key, m.userId); }
      catch (e: any) { throw new Error(errText(e, 'Could not remove them.')); }
      await load();
    } else {
      keepDemo((list || []).filter(x => !(x.key === m.key && x.userId === m.userId)));
    }
    loadManaged(mode, signedIn, true);
  };

  const find = async (q: string): Promise<FoundPerson[]> => {
    if (q.trim().length < 2) return [];
    if (!live) {
      const s = q.trim().toLowerCase();
      return DEMO_PEOPLE.filter(f => (f.name + f.email).toLowerCase().includes(s));
    }
    try {
      const { programManagers } = await import('./backend');
      return (await programManagers.find(q)).map(r => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim() || r.email, email: r.email, grade: r.grade }));
    } catch (e: any) { throw new Error(errText(e, 'Could not search.')); }
  };

  return { list, note, live, load, add, remove, find };
};
