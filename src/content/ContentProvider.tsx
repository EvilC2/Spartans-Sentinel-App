// Spartans — the content store. Every screen that shows App Club content
// (The Buzz, Announcements, Cafeteria, pop-up banners, the bell, Calendar and
// Day view) reads it from here, and App Club Admin writes it here.
//
// Three modes:
//   demo   A developer's machine with no backend keys (`demoBuild`), never a
//          release build. Starter posts plus this phone's edits; you count as
//          the app's owner and President so App Club can be tried.
//   live   Signed in with the backend. Posts come from the server `posts`
//          table (migration 0008); edits go there and every phone sees them.
//          No connection: still live, showing the last copy from the server.
//   local  Signed out, or the posts table isn't there yet (0008 not run). No
//          posts but this phone's own; roles come from the server, and the
//          admin screen says changes stay on this phone.
//
// View as (TEMPORARY, for testing App Club): `viewAs` swaps the roles every
// screen sees for another set, so the club can be checked as any role. Only
// offered to the app's owner (`canViewAs`, src/devAccess.ts). The server still
// checks the real roles, so it never grants anything.
//
// Views and answers: shown posts are batched and counted (see_posts), trivia
// and poll answers are saved (answer_post) and the counts come back
// (post_tally). Demo/local mode keeps them on this phone; in demo they sit on
// top of sample numbers for the starter posts.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendConfigured, demoBuild } from '../supabase';
import { useProfile } from '../ProfileContext';
import { useDevAccess } from '../devAccess';
import type { Role, PostRow, PostStat, Popup } from '../backend';
import { Post, PostKind, Place, DataOf, isLive, canEdit as canEditKind, tidy, titleOf } from './model';
import { seedPosts, SAMPLE_STATS } from './seed';
import { earnXp, checkIn, XP } from '../xp';

export type ContentMode = 'demo' | 'live' | 'local';
export type Mine = { seen?: boolean; opens?: number; choice?: number };
export type Counts = { counts: number[]; total: number };
export type Stats = { viewers: number; opens: number; answers: number; sample?: boolean };

type Ctx = {
  ready: boolean;
  mode: ContentMode;
  note: string | null;                 // shown at the top of App Club Admin
  posts: Post[];                       // everything this account may see (drafts of its roles too)
  roles: Role[];                       // what the screens act on (viewAs when set)
  realRoles: Role[];                   // this account's own roles
  viewAs: Role[] | null;               // null = your own; [] = not in the club
  setViewAs: (r: Role[] | null) => void;
  canViewAs: boolean;
  now: number;
  inPlace: (place: Place) => Post[];   // live, in show order
  live: <K extends PostKind>(kind: K, place?: Place) => (DataOf[K] & { id: string })[];
  popups: Popup[];                     // live pop-up posts, shaped for the banner code
  // students
  mine: (id: string) => Mine;
  tally: (id: string) => Counts;
  seen: (ids: string[]) => void;
  opened: (id: string) => void;
  answer: (id: string, choice: number) => Promise<void>;
  // admins
  canEdit: (kind: PostKind) => boolean;
  save: (post: Post) => Promise<Post>;
  remove: (id: string) => Promise<void>;
  move: (id: string, place: Place, dir: -1 | 1) => Promise<void>;
  stats: (id: string) => Stats | null;
  loadStats: (ids: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  // a photo picked on this phone → a URL the post can keep (uploaded when live)
  uploadImage: (uri: string, mime?: string) => Promise<string>;
};

const C = createContext<Ctx | null>(null);
export const useContent = () => {
  const v = useContext(C);
  if (!v) throw new Error('useContent outside ContentProvider');
  return v;
};

// Live posts of one kind, as their data plus id. Handy for screens that only
// need, say, the club events.
export const usePosted = <K extends PostKind>(kind: K, place?: Place) => {
  const { live } = useContent();
  return useMemo(() => live(kind, place), [live, kind, place]);
};

const LOCAL_KEY = 'spartans-content-v1';         // demo/local: { edits, own }
const MINE_KEY = 'spartans-content-mine-v1';      // this student's views + answers
const CACHE_KEY = 'spartans-content-cache-v1';    // live: last server copy

type Local = { edits: Record<string, Post | { deleted: true }>; own: Post[] };

const fromRow = (r: PostRow): Post => ({
  id: r.id, kind: r.kind as PostKind, data: r.data as any, places: r.places as Place[],
  status: r.status === 'draft' ? 'draft' : 'published',
  startsAt: r.starts_at, endsAt: r.ends_at, sort: r.sort, pinned: r.pinned,
  createdAt: r.created_at, updatedAt: r.updated_at,
} as Post);
const toRow = (p: Post) => ({
  kind: p.kind, data: p.data as unknown as Record<string, unknown>, places: p.places, status: p.status,
  starts_at: p.startsAt, ends_at: p.endsAt, sort: p.sort, pinned: p.pinned,
});

// Missing table → the server hasn't had migration 0008 yet.
const missingTable = (e: any) => /posts|post_tally|see_posts/.test(String(e?.message)) && /does not exist|not find|schema cache|404/i.test(String(e?.message));

// Show order inside a place: pinned first, then newest. The Buzz also uses
// `sort`, the order admins set with the arrows.
const newest = (a: Post, b: Post) => Date.parse(b.startsAt || b.createdAt) - Date.parse(a.startsAt || a.createdAt);
const order = (place?: Place) => (a: Post, b: Post) =>
  Number(b.pinned) - Number(a.pinned) || (place === 'buzz' ? a.sort - b.sort : 0) || newest(a, b);

const endOfDay = (iso: string) => { const d = new Date(iso); d.setHours(23, 59, 0, 0); return d.toISOString(); };

export const ContentProvider = ({ children }: { children: React.ReactNode }) => {
  const { signedIn, roles: serverRoles } = useProfile();
  const [mode, setMode] = useState<ContentMode>(backendConfigured ? 'live' : demoBuild ? 'demo' : 'local');
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<Local>({ edits: {}, own: [] });
  const [server, setServer] = useState<Post[]>([]);
  const [mine, setMine] = useState<Record<string, Mine>>({});
  const [tallies, setTallies] = useState<Record<string, Counts>>({});
  const [serverStats, setServerStats] = useState<Record<string, PostStat>>({});
  const [now, setNow] = useState(Date.now());
  const [seedAt, setSeedAt] = useState(Date.now());
  const pending = useRef(new Set<string>());
  const sent = useRef(new Set<string>());

  const live = mode === 'live';
  const [viewAs, setViewAs] = useState<Role[] | null>(null);
  // Demo: you own the app and are its President.
  const realRoles: Role[] = useMemo(() => mode === 'demo' ? ['owner', 'president'] : serverRoles, [mode, serverRoles]);
  const canViewAs = useDevAccess();
  const roles: Role[] = canViewAs && viewAs ? viewAs : realRoles;

  // ── Load from this phone ──
  useEffect(() => {
    (async () => {
      try {
        const [l, m, cache] = await AsyncStorage.multiGet([LOCAL_KEY, MINE_KEY, CACHE_KEY]);
        if (l[1]) setLocal(JSON.parse(l[1]));
        if (m[1]) setMine(JSON.parse(m[1]));
        if (cache[1] && backendConfigured) setServer(JSON.parse(cache[1]));
      } catch {}
      setReady(true);
    })();
    checkIn();
  }, []);

  const persistLocal = (fn: (l: Local) => Local) => setLocal(prev => {
    const next = fn(prev);
    AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next)).catch(() => {});
    return next;
  });
  const patchMine = (id: string, patch: Mine) => setMine(m => {
    const out = { ...m, [id]: { ...m[id], ...patch } };
    AsyncStorage.setItem(MINE_KEY, JSON.stringify(out)).catch(() => {});
    return out;
  });

  // ── Server ──
  const refresh = useCallback(async () => {
    setNow(Date.now());
    setSeedAt(Date.now());
    if (!backendConfigured || !signedIn) { setMode(demoBuild ? 'demo' : 'local'); return; }
    try {
      const { posts } = await import('../backend');
      const rows = (await posts.list()).map(fromRow);
      setServer(rows);
      setMode('live');
      setNote(null);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(rows)).catch(() => {});
      const asked = rows.filter(p => p.kind === 'trivia' || p.kind === 'poll').map(p => p.id);
      if (asked.length) {
        const t = await posts.tally(asked);
        setTallies(Object.fromEntries(asked.map(id => {
          const r = t[id];
          const n = (rows.find(p => p.id === id)!.data as { options: string[] }).options.length;
          return [id, { counts: Array.from({ length: n }, (_, i) => r?.counts[i] || 0), total: r?.total || 0 }];
        })));
      }
    } catch (e: any) {
      if (missingTable(e)) {
        setMode('local');
        setNote('The server does not have admin posts yet (migrations 0007 and 0008). Until they are run, changes here stay on this phone.');
      } else {
        // Offline: keep the cached copy, still live. (The signed-out moment at
        // launch set 'local', which has no server posts, so set it back.)
        setMode('live');
        setNote(server.length ? 'Offline. Showing the last copy from the server.' : 'Could not reach the server.');
      }
    }
  }, [signedIn, server.length]);

  useEffect(() => { refresh(); }, [signedIn]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') { refresh(); checkIn(); } });
    // The clock moves every 30 s so scheduled posts appear and ended ones go
    // on time; the server is asked again every 3 minutes.
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const id = setInterval(() => { if (live) refresh(); }, 3 * 60_000);
    return () => { sub.remove(); clearInterval(tick); clearInterval(id); };
  }, [refresh, live]);

  // ── What this account sees ──
  const posts = useMemo<Post[]>(() => {
    if (live) return server;
    if (!demoBuild) return local.own;
    const seeds = seedPosts().filter(p => !(local.edits[p.id] as any)?.deleted).map(p => (local.edits[p.id] as Post) || p);
    return [...seeds, ...local.own];
  }, [live, server, local, seedAt]);

  const inPlace = useCallback((place: Place) =>
    posts.filter(p => p.places.includes(place) && isLive(p, now)).sort(order(place)), [posts, now]);

  const liveOf = useCallback(<K extends PostKind>(kind: K, place?: Place) =>
    posts.filter(p => p.kind === kind && (!place || p.places.includes(place)) && isLive(p, now)).sort(order(place))
      .map(p => ({ ...(p.data as DataOf[K]), id: p.id })), [posts, now]);

  const popups = useMemo<Popup[]>(() => posts
    .filter(p => p.kind === 'popup' && p.places.includes('banner') && isLive(p, now))
    .map(p => {
      const d = p.data as DataOf['popup'];
      const start = p.startsAt || p.createdAt;
      return {
        id: p.id, template_id: d.template, title: d.title, body: d.body,
        starts_at: start, ends_at: p.endsAt || endOfDay(start), status: 'published', badge_id: d.badge || null,
        push: !!d.push, from_post: true, image_url: d.image || null,
      };
    }), [posts, now]);

  // ── Counting ──
  const sampleOf = (id: string) => (posts.find(p => p.id === id)?.sample ? SAMPLE_STATS[id] : undefined);

  const tally = useCallback((id: string): Counts => {
    const p = posts.find(x => x.id === id);
    const n = p && (p.kind === 'trivia' || p.kind === 'poll') ? p.data.options.length : 0;
    if (live) return tallies[id] || { counts: Array(n).fill(0), total: 0 };
    const base = sampleOf(id)?.votes;
    const counts = Array.from({ length: n }, (_, i) => (base && base.length === n ? base[i] : 0));
    const pick = mine[id]?.choice;
    if (pick !== undefined && pick < n) counts[pick] += 1;
    return { counts, total: counts.reduce((a, b) => a + b, 0) };
  }, [posts, live, tallies, mine]);

  // Shown posts: once per post per session, sent in batches.
  const flush = useCallback(async () => {
    const ids = [...pending.current];
    pending.current.clear();
    if (!ids.length || !live) return;
    try { const { posts } = await import('../backend'); await posts.seen(ids); } catch {}
  }, [live]);
  useEffect(() => { const id = setInterval(flush, 4000); return () => clearInterval(id); }, [flush]);

  const seen = useCallback((ids: string[]) => {
    for (const id of ids) {
      if (sent.current.has(id)) continue;
      sent.current.add(id);
      pending.current.add(id);
      if (!mine[id]?.seen) patchMine(id, { seen: true });
    }
  }, [mine]);

  const opened = useCallback((id: string) => {
    patchMine(id, { seen: true, opens: (mine[id]?.opens || 0) + 1 });
    const p = posts.find(x => x.id === id);
    if (p?.kind === 'news') earnXp('read', id, XP.read, `Read: ${titleOf(p)}`);
    if (live) import('../backend').then(({ posts }) => posts.seen([id], true)).catch(() => {});
  }, [mine, posts, live]);

  const answer = useCallback(async (id: string, choice: number) => {
    const p = posts.find(x => x.id === id);
    if (!p || (p.kind !== 'trivia' && p.kind !== 'poll')) return;
    if (p.kind === 'trivia' && mine[id]?.choice !== undefined) return;
    patchMine(id, { seen: true, choice });
    if (p.kind === 'trivia') {
      const right = choice === p.data.answer;
      earnXp('trivia', id, right ? XP.triviaRight : XP.triviaWrong, `${right ? 'Got it right' : 'Tried'}: ${p.data.prompt}`);
    } else {
      earnXp('poll', id, XP.poll, `Voted: ${p.data.prompt}`);
    }
    if (!live) return;
    // optimistic count, then the server's
    setTallies(t => {
      const cur = t[id] || { counts: Array(p.data.options.length).fill(0), total: 0 };
      const counts = [...cur.counts];
      const prev = mine[id]?.choice;
      if (prev !== undefined && counts[prev]) counts[prev] -= 1;
      counts[choice] = (counts[choice] || 0) + 1;
      return { ...t, [id]: { counts, total: counts.reduce((a, b) => a + b, 0) } };
    });
    try {
      const { posts: api } = await import('../backend');
      await api.answer(id, choice);
      const r = (await api.tally([id]))[id];
      setTallies(t => ({ ...t, [id]: { counts: Array.from({ length: p.data.options.length }, (_, i) => r?.counts[i] || 0), total: r?.total || 0 } }));
    } catch {}
  }, [posts, mine, live]);

  // ── Admin ──
  const canEdit = useCallback((kind: PostKind) => canEditKind(kind, roles), [roles]);

  const save = useCallback(async (input: Post): Promise<Post> => {
    const p = { ...tidy(input), updatedAt: new Date().toISOString() } as Post;
    if (!canEditKind(p.kind, roles)) throw new Error('You do not have permission to post this.');
    if (live) {
      const { posts: api } = await import('../backend');
      const isNew = !server.some(x => x.id === p.id);
      const row = isNew ? await api.create(toRow(p)) : await api.update(p.id, toRow(p));
      const out = fromRow(row);
      setServer(list => isNew ? [out, ...list] : list.map(x => (x.id === out.id ? out : x)));
      setNow(Date.now());
      return out;
    }
    persistLocal(l => p.id.startsWith('seed-') ? { ...l, edits: { ...l.edits, [p.id]: p } }
      : l.own.some(x => x.id === p.id) ? { ...l, own: l.own.map(x => (x.id === p.id ? p : x)) }
      : { ...l, own: [p, ...l.own] });
    setNow(Date.now());
    return p;
  }, [roles, live, server]);

  const remove = useCallback(async (id: string) => {
    if (live) {
      const { posts: api } = await import('../backend');
      await api.remove(id);
      setServer(list => list.filter(x => x.id !== id));
      return;
    }
    persistLocal(l => id.startsWith('seed-') ? { ...l, edits: { ...l.edits, [id]: { deleted: true } } } : { ...l, own: l.own.filter(x => x.id !== id) });
  }, [live]);

  // Swap a post with its neighbour in one place's show order.
  const move = useCallback(async (id: string, place: Place, dir: -1 | 1) => {
    const list = inPlace(place).filter(p => !p.pinned);
    const i = list.findIndex(p => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    // re-number the whole place so equal sorts can't get stuck
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    for (let k = 0; k < next.length; k++) {
      if (next[k].sort !== (k + 1) * 10) await save({ ...next[k], sort: (k + 1) * 10 } as Post);
    }
  }, [inPlace, save]);

  const stats = useCallback((id: string): Stats | null => {
    const p = posts.find(x => x.id === id);
    if (!p) return null;
    if (live) {
      const s = serverStats[id];
      return s ? { viewers: s.viewers, opens: s.opens, answers: s.answers } : null;
    }
    const base = sampleOf(id);
    const m = mine[id];
    const t = p.kind === 'trivia' || p.kind === 'poll' ? tally(id).total : 0;
    return { viewers: (base?.viewers || 0) + (m?.seen ? 1 : 0), opens: (base?.opens || 0) + (m?.opens || 0), answers: t, sample: !!base };
  }, [posts, live, serverStats, mine, tally]);

  const loadStats = useCallback(async (ids: string[]) => {
    if (!live || !ids.length) return;
    try {
      const { posts: api } = await import('../backend');
      const out: Record<string, PostStat> = {};
      for (let i = 0; i < ids.length; i += 200) Object.assign(out, await api.stats(ids.slice(i, i + 200)));
      setServerStats(s => ({ ...s, ...out }));
      const asked = posts.filter(p => ids.includes(p.id) && (p.kind === 'trivia' || p.kind === 'poll'));
      if (asked.length) {
        const t = await api.tally(asked.map(p => p.id));
        setTallies(cur => ({ ...cur, ...Object.fromEntries(asked.map(p => {
          const n = (p.data as { options: string[] }).options.length;
          return [p.id, { counts: Array.from({ length: n }, (_, i) => t[p.id]?.counts[i] || 0), total: t[p.id]?.total || 0 }];
        })) }));
      }
    } catch {}
  }, [live, posts]);

  // Pictures. Live: upload to the post-images bucket (0010) and keep the
  // public URL. Demo/local: copy the file into the app's documents so it
  // survives the picker's cache being cleared; it only shows on this phone.
  const uploadImage = useCallback(async (uri: string, mime = 'image/jpeg'): Promise<string> => {
    const { File, Paths } = await import('expo-file-system');
    const ext = /png/i.test(mime) ? 'png' : /webp/i.test(mime) ? 'webp' : 'jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    if (live) {
      const { posts: api } = await import('../backend');
      const bytes = await new File(uri).arrayBuffer();
      return api.uploadImage(`posts/${name}`, bytes, ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    }
    const dest = new File(Paths.document, `post-${name}`);
    new File(uri).copy(dest);
    return dest.uri;
  }, [live]);

  const value = useMemo<Ctx>(() => ({
    ready, mode, note, posts, roles, realRoles, viewAs, setViewAs, canViewAs, now, inPlace, live: liveOf, popups,
    mine: id => mine[id] || {}, tally, seen, opened, answer,
    canEdit, save, remove, move, stats, loadStats, refresh, uploadImage,
  }), [ready, mode, note, posts, roles, realRoles, viewAs, canViewAs, now, inPlace, liveOf, popups, mine, tally, seen, opened, answer, canEdit, save, remove, move, stats, loadStats, refresh, uploadImage]);

  return <C.Provider value={value}>{children}</C.Provider>;
};
