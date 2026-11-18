// Spartans — Social: friends, requests and what friends may see. Logic only.
//
// District rules (Oct 2026):
//   • Friends add each other with a random friend code. Never a student
//     number, never an email.
//   • Nobody sees a friend's timetable. You only see the blocks you SHARE
//     (same slot, same course, or a spare you both have), which you already
//     know you are in. A spare you don't both have stays hidden. The server
//     (friend_cards, migration 0020) trims the row before it leaves Postgres;
//     the client never holds a friend's full timetable.
//   • A friend sees: name, profile photo (else colour + emoji), grade,
//     level / XP, up to four pinned badges,
//     the full badge list, how long you have been friends, and homework you
//     wrote for a class you share (to copy into their own list).
//
// Three modes behind one hook, useFriends():
//   • live — signed in with the backend configured.
//   • signed-out — no friends, nothing to load.
//   • demo — a developer's machine with no backend keys (`demoBuild`), never a
//     release build. A small sample directory built from the student's own
//     timetable so compare has overlaps to show. Kept in memory; resets on
//     launch.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Course, Slot, SLOTS, StudentProfile, useProfile } from './ProfileContext';
import { social as remoteSocial, badges as remoteBadges, auth as remoteAuth, RemoteProfile, FoundStudent, FriendRequest, FriendCard, HomeworkShare } from './backend';
import { demoBuild } from './supabase';
import { BADGES, UNLOCKED } from './badges';
import { RARITY_XP, levelFor, gradeXp } from './xp';
import { useHomework } from './stores';
import type { HomeworkItem } from './programs';
import type { DayPlan, PlanPeriod } from './bell';
import { AvatarSpec, avatarOf } from './components/Avatar';

// ── Types ───────────────────────────────────────────────────────
export type Peer = { id: string; firstName: string; lastName: string; grade: number; avatar: AvatarSpec; photo?: string };

// Server photo URL (migration 0015), http(s) only.
const photoOf = (u: unknown) => (typeof u === 'string' && /^https?:\/\//.test(u) ? u : undefined);

export type Friend = Peer & {
  shared: Course[];       // only the blocks you share; never their whole timetable
  badgeIds: string[];
  pinned: string[];       // up to four badge ids they chose to show
  xp: number;
  since: string;          // ISO date the request was accepted
  rowId: string;          // friend_requests row, for unfriend
};

export type Request = {
  id: string;             // friend_requests row
  peer: Peer;
  direction: 'in' | 'out';
  created: string;
};

export type FindResult =
  | { state: 'found'; peer: Peer }
  | { state: 'self' | 'friend' | 'pending' | 'none' };

// Homework a friend wrote for a class you share.
export type SharedHomework = {
  id: string; friendId: string; className: string; title: string; due: string; time?: string; notes?: string;
};

// ── Compare ─────────────────────────────────────────────────────
// Same class, a spare you both have, or nothing to show. A shared spare counts
// as a block together. Lunch and FIT never do: the whole school has them.
export type MatchKind = 'class' | 'spare' | 'none';
export type SlotMatch = { slot: Slot; mine?: Course; kind: MatchKind };
export type Comparison = {
  slots: SlotMatch[];
  sharedBlocks: SlotMatch[];
  byDay: { day: 1 | 2; rows: SlotMatch[] }[];
};

export const isSpare = (c?: Course) => !!c && (!!c.spare || /^spare$/i.test(c.name.trim()));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
// What to call a block: spares read "Spare" whatever the row holds.
export const blockName = (c?: Course) => isSpare(c) ? 'Spare' : c?.name.trim() || '';
const EVERYONE_HAS = /^(fit|lunch)$/;
const matchOf = (a?: Course, b?: Course): MatchKind => {
  if (!a || !b) return 'none';
  if (isSpare(a) || isSpare(b)) return isSpare(a) && isSpare(b) ? 'spare' : 'none';
  const name = norm(a.name);
  return name && name === norm(b.name) && !EVERYONE_HAS.test(name) ? 'class' : 'none';
};

// `shared` is already trimmed to shared blocks (server or demo), but it is
// checked against my timetable again so an edit on my side updates at once.
export const compareSchedules = (mine: Course[], shared: Course[]): Comparison => {
  const slots: SlotMatch[] = SLOTS.map(slot => {
    const a = mine.find(c => c.slot === slot);
    const b = shared.find(c => c.slot === slot);
    return { slot, mine: a, kind: matchOf(a, b) };
  });
  return {
    slots,
    sharedBlocks: slots.filter(s => s.kind !== 'none'),
    byDay: ([1, 2] as const).map(day => ({ day, rows: slots.filter(s => s.slot.startsWith(`${day}-`)) })),
  };
};

// Which blocks you share, by slot, from a full timetable (demo + my side).
export const sharedOf = (mine: Course[], theirs: Course[]): Course[] =>
  theirs.filter(t => matchOf(mine.find(m => m.slot === t.slot), t) !== 'none');

// What today looks like together: the blocks you share on today's plan.
export type TodayRow = { period: PlanPeriod; kind: 'class' | 'spare' };
export const todayTogether = (plan: DayPlan | null, cmp: Comparison): TodayRow[] => {
  if (!plan) return [];
  const out: TodayRow[] = [];
  for (const p of plan.periods) {
    if (p.kind !== 'block' || !p.slot) continue;
    const m = cmp.slots.find(s => s.slot === p.slot);
    if (m && m.kind !== 'none') out.push({ period: p, kind: m.kind });
  }
  return out;
};

// Friends who share the period that is on right now (or the next one).
export const friendsInPeriod = (period: PlanPeriod | null, me: Course[], friends: Friend[]) => {
  if (!period || period.kind !== 'block' || !period.slot) return [];
  return friends.flatMap(f => {
    const kind = compareSchedules(me, f.shared).slots.find(s => s.slot === period.slot)!.kind;
    return kind === 'none' ? [] : [{ friend: f, kind }];
  });
};

// One line for the friends in a block: "with Alex", "with Alex & Sam",
// "with Alex +2". A spare you both have counts the same as a class together and
// says so: "Spare with Alex". '' when nobody is in it.
export const togetherLabel = (period: PlanPeriod | null, me: Course[], friends: Friend[]) => {
  const hits = friendsInPeriod(period, me, friends);
  if (!hits.length) return '';
  const names = hits.map(h => h.friend.firstName || h.friend.lastName).filter(Boolean);
  const who = names.length <= 2 ? names.join(' & ') : `${names[0]} +${names.length - 1}`;
  return hits.every(h => h.kind === 'spare') ? `Spare with ${who}` : `with ${who}`;
};

// Names of the classes two people share (for the homework section). A spare
// has no homework, so it stays out.
export const sharedClassNames = (me: Course[], f: Friend) =>
  Array.from(new Set(compareSchedules(me, f.shared).sharedBlocks.filter(s => s.kind === 'class').map(s => s.mine!.name.trim())));

// ── Level / badges ──────────────────────────────────────────────
const byId = new Map(BADGES.map(b => [b.id, b]));
export const badgeOf = (id: string) => byId.get(id);
export const xpFromBadges = (ids: string[]) => ids.reduce((s, id) => s + (byId.get(id) ? RARITY_XP[byId.get(id)!.rarity] : 0), 0);
// Server XP is badges only for now; the grade bonus is added here so friends
// sit on the same scale as you.
export const friendXp = (f: Friend) => (f.xp || xpFromBadges(f.badgeIds)) + gradeXp(f.grade);
export const friendLevel = (f: Friend) => levelFor(friendXp(f));

// ── Helpers shared by both modes ────────────────────────────────
export const fullName = (p: Peer) => [p.firstName, p.lastName].filter(Boolean).join(' ');
export const peerInitials = (p: Peer) => ((p.firstName[0] || '') + (p.lastName[0] || '')).toUpperCase() || '?';
export const MAX_PINNED = 4;

// Friend codes: 8 chars, no 0/O/1/I. The server issues the real one; before
// sign-in a stable one is derived from the account so the card never changes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const formatCode = (code: string) => { const s = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s; };
export const cleanCode = (q: string) => q.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const myFriendCode = (p: StudentProfile | null): string => {
  if (!p) return '';
  if (p.friendCode) return cleanCode(p.friendCode);
  const seed = `${p.email || ''}|${p.firstName}|${p.lastName}|${p.studentId || ''}`;
  let h = 2166136261;
  let out = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < seed.length; j++) { h ^= seed.charCodeAt(j) + i; h = Math.imul(h, 16777619) >>> 0; }
    out += CODE_ALPHABET[h % CODE_ALPHABET.length];
  }
  return out;
};

// Days since the request was accepted.
export const friendsForDays = (since: string) => {
  if (!since) return 0;
  const a = new Date(since + 'T12:00:00').getTime();
  return Math.max(0, Math.floor((Date.now() - a) / 86400000));
};

// Sort: most shared blocks first, then by name.
export const sortFriends = (friends: Friend[], me: Course[]) =>
  [...friends].sort((a, b) =>
    (compareSchedules(me, b.shared).sharedBlocks.length - compareSchedules(me, a.shared).sharedBlocks.length)
    || fullName(a).localeCompare(fullName(b)));

// ── Demo data ───────────────────────────────────────────────────
// Sample students. `share` = slots where they take the same class as you.
type Sample = { id: string; firstName: string; lastName: string; avatar: AvatarSpec; gradeDelta: number; code: string; share: Slot[]; badges: string[]; pinned: string[]; hw: [string, number][] };

const SAMPLES: Sample[] = [
  { id: 'demo-priya', firstName: 'Priya', lastName: 'Nair', avatar: { tone: 8, glyph: '🦊' }, gradeDelta: 0, code: 'K7M2Q9XA', share: ['1-1', '1-3', '2-2'], badges: ['hello-world', 'welcome-to-sentinel', 'first-bell', 'back-to-school', 'early-bird', 'game-day', 'where-am-i'], pinned: ['early-bird', 'game-day', 'where-am-i'], hw: [['Read ch. 4 and answer the questions', 1], ['Lab write-up', 3], ['Practice quiz', 5]] },
  { id: 'demo-sam', firstName: 'Sam', lastName: 'Okafor', avatar: { tone: 4, glyph: '🏀' }, gradeDelta: 0, code: 'R4TD8HNP', share: ['1-2', '2-1'], badges: ['hello-world', 'first-bell', 'got-homework', 'campout'], pinned: ['got-homework'], hw: [['Worksheet 3.2', 2], ['Study for unit test', 6]] },
  { id: 'demo-leo', firstName: 'Leo', lastName: 'Marchetti', avatar: { tone: 5 }, gradeDelta: 1, code: 'ZX3W9LQ2', share: ['2-3'], badges: ['hello-world', 'welcome-to-sentinel', 'achievement-unlocked', 'first-bell', 'back-to-school', 'where-am-i', 'early-bird', 'phew-that-was-easy', 'campout', 'game-day', 'got-homework'], pinned: ['achievement-unlocked', 'phew-that-was-easy'], hw: [['Finish the project outline', 4]] },
];
// Not friends yet — what Add friend finds in demo mode.
const DIRECTORY: Sample[] = [
  { id: 'demo-noah', firstName: 'Noah', lastName: 'Patel', avatar: { tone: 2, glyph: '🎸' }, gradeDelta: 0, code: 'N8PV2KHM', share: ['1-4'], badges: ['hello-world', 'first-bell'], pinned: [], hw: [['Textbook p. 112 #1-15', 2]] },
  { id: 'demo-maya', firstName: 'Maya', lastName: 'Chen', avatar: { tone: 6, glyph: '🌙' }, gradeDelta: -1, code: 'C5JR7QTW', share: [], badges: ['hello-world', 'welcome-to-sentinel', 'back-to-school'], pinned: ['back-to-school'], hw: [] },
  { id: 'demo-ethan', firstName: 'Ethan', lastName: 'Brooks', avatar: { tone: 3 }, gradeDelta: 0, code: 'H2MX6DBF', share: ['1-1', '2-2'], badges: ['hello-world'], pinned: [], hw: [['Vocabulary list', 1], ['Essay draft', 7]] },
];
export const DEMO_CODE = DIRECTORY[0].code;

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const demoFriend = (s: Sample, me: StudentProfile, since: string): Friend => {
  const grade = Math.min(12, Math.max(8, me.grade + s.gradeDelta));
  const shared = s.share
    .map(slot => me.courses.find(c => c.slot === slot))
    .filter((c): c is Course => !!c && (!!c.name.trim() || isSpare(c)))
    .map(c => ({ ...c }));
  return {
    id: s.id, firstName: s.firstName, lastName: s.lastName, grade, avatar: s.avatar,
    shared, badgeIds: s.badges, pinned: s.pinned.filter(id => s.badges.includes(id)).slice(0, MAX_PINNED),
    xp: xpFromBadges(s.badges), since, rowId: `row-${s.id}`,
  };
};

// Sample homework: one of their items per shared class, spread over the week.
const demoHomework = (s: Sample, f: Friend): SharedHomework[] =>
  f.shared.map((c, i) => {
    const [title, days] = s.hw[i % Math.max(1, s.hw.length)] || ['Homework', 2];
    return { id: `${s.id}-hw-${i}`, friendId: f.id, className: c.name.trim(), title, due: plusDays(days + i) };
  }).filter(() => s.hw.length > 0);

const peerOf = (s: Sample, me: StudentProfile): Peer => ({
  id: s.id, firstName: s.firstName, lastName: s.lastName, grade: Math.min(12, Math.max(8, me.grade + s.gradeDelta)), avatar: s.avatar,
});

// ── The hook ────────────────────────────────────────────────────
export type Social = {
  mode: 'live' | 'demo' | 'signed-out';
  loading: boolean;
  ready: boolean;         // first load finished (later refreshes are quiet)
  error: string | null;
  friends: Friend[];
  requests: Request[];
  homework: SharedHomework[];   // friends' homework in classes I share with them
  find: (q: string) => Promise<FindResult>;
  request: (peer: Peer) => Promise<void>;
  respond: (r: Request, accept: boolean) => Promise<void>;
  cancel: (r: Request) => Promise<void>;
  unfriend: (f: Friend) => Promise<void>;
  refresh: () => Promise<void>;
};

const fromCard = (p: FriendCard, badgeIds: string[]): Friend => ({
  id: p.id, firstName: p.first_name, lastName: p.last_name, grade: p.grade, avatar: avatarOf(p.avatar, `${p.first_name} ${p.last_name}`), photo: photoOf(p.photo_url),
  shared: Array.isArray(p.shared) ? p.shared : [],
  badgeIds, pinned: (Array.isArray(p.pinned_badges) ? p.pinned_badges : []).filter(id => badgeIds.includes(id)).slice(0, MAX_PINNED),
  xp: p.xp_total, since: (p.since || '').slice(0, 10), rowId: p.row_id,
});

const fromShare = (h: HomeworkShare): SharedHomework => ({
  id: `${h.user_id}:${h.id}`, friendId: h.user_id, className: h.class_name, title: h.title, due: h.due,
  ...(h.due_time ? { time: h.due_time } : {}), ...(h.notes ? { notes: h.notes } : {}),
});

// My homework for timetable classes, as the server wants it.
const toShares = (items: HomeworkItem[], courses: Course[]) =>
  items.filter(h => !h.done).flatMap(h => {
    // Homework names its class; only rows saved with a block carry a slot.
    const program = h.program?.trim().toLowerCase();
    const k = courses.find(c => h.slot ? c.slot === h.slot : !!program && c.name.trim().toLowerCase() === program);
    if (!k || !k.name.trim() || isSpare(k)) return [];
    return [{ id: h.id, class_name: k.name.trim(), title: h.title, due: h.due, ...(h.time ? { due_time: h.time } : {}), ...(h.notes ? { notes: h.notes } : {}) }];
  });

export const useFriends = (profile: StudentProfile | null, signedIn: boolean): Social => {
  const mode: Social['mode'] = demoBuild ? 'demo' : signedIn ? 'live' : 'signed-out';
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [homework, setHomework] = useState<SharedHomework[]>([]);
  // Live starts loading so the Friends card shows a spinner, not "No friends yet".
  const [loading, setLoading] = useState(mode === 'live');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(mode !== 'live');
  useEffect(() => { if (mode === 'live') setReady(false); }, [mode]);   // signing in starts a fresh first load
  const seeded = useRef(false);
  const { items: myHomework } = useHomework();

  // Signing out drops the last account's friends from memory.
  useEffect(() => {
    if (mode !== 'signed-out') return;
    setFriends([]); setRequests([]); setHomework([]); setError(null); setLoading(false);
  }, [mode]);

  // Sample data for demo mode only. Seeded once the profile is known, with one
  // incoming request so the Requests card has something to show.
  const demo = mode === 'demo';
  useEffect(() => {
    if (!demo || !profile || seeded.current) return;
    seeded.current = true;
    const list = SAMPLES.map((s, i) => demoFriend(s, profile, ['2026-09-08', '2026-09-10', '2026-09-15'][i]));
    setFriends(list);
    setHomework(list.flatMap((f, i) => demoHomework(SAMPLES[i], f)));
    setRequests([{ id: 'req-noah', peer: peerOf(DIRECTORY[0], profile), direction: 'in', created: '2026-09-20' }]);
  }, [mode, profile]);

  // Keep demo friends' shared classes in step with an edited timetable.
  useEffect(() => {
    if (!demo || !profile || !seeded.current) return;
    setFriends(prev => {
      const next = prev.map(f => { const s = [...SAMPLES, ...DIRECTORY].find(x => x.id === f.id); return s ? demoFriend(s, profile, f.since) : f; });
      setHomework(next.flatMap(f => { const s = [...SAMPLES, ...DIRECTORY].find(x => x.id === f.id); return s ? demoHomework(s, f) : []; }));
      return next;
    });
  }, [demo, profile?.courses]);   // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    if (mode !== 'live') { setLoading(false); setReady(true); return; }
    setLoading(true); setError(null);
    try {
      const me = await remoteAuth.userId();
      // peers() needs migration 0002; without it requests still load, just nameless (hidden).
      const [rows, peers, cards, shares] = await Promise.all([
        remoteSocial.requests(),
        remoteSocial.peers().catch(() => [] as FoundStudent[]),
        remoteSocial.friends(),
        remoteSocial.friendHomework().catch(() => [] as HomeworkShare[]),
      ]);
      const peerById = new Map(peers.map(p => [p.id, p]));
      const pending: Request[] = rows.filter(r => r.status === 'pending').flatMap(r => {
        const otherId = r.from_user === me ? r.to_user : r.from_user;
        const p = peerById.get(otherId);
        return p ? [{ id: r.id, peer: toPeer(p), direction: r.from_user === me ? 'out' : 'in', created: r.created_at }] : [];
      });
      const awards = await Promise.all(cards.map(p => remoteBadges.of(p.id).catch(() => [])));
      setFriends(cards.map((p, i) => fromCard(p, awards[i].map(a => a.badge_id))));
      setHomework(shares.filter(h => h.user_id !== me).map(fromShare));
      setRequests(pending);
    } catch (e) {
      setError((e as Error).message || 'Could not load friends');
    } finally {
      setLoading(false); setReady(true);
    }
  }, [mode]);

  // Load at launch (the provider sits above the tabs), then keep it current:
  // again whenever the app comes back to the foreground, and once a minute
  // while it's open so accepted requests and timetable edits show up.
  useEffect(() => {
    refresh();
    if (mode !== 'live') return;
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 60_000);
    return () => { sub.remove(); clearInterval(timer); };
  }, [refresh]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Push my class homework so friends in the same class can see it. Debounced
  // so ticking through a list doesn't fire a call per tap.
  const lastSync = useRef('');
  useEffect(() => {
    if (mode !== 'live' || !profile) return;
    const body = JSON.stringify(toShares(myHomework, profile.courses));
    if (body === lastSync.current) return;
    const t = setTimeout(() => {
      lastSync.current = body;
      remoteSocial.syncHomework(JSON.parse(body)).catch(() => { lastSync.current = ''; });
    }, 1500);
    return () => clearTimeout(t);
  }, [mode, myHomework, profile?.courses]);   // eslint-disable-line react-hooks/exhaustive-deps

  const find = useCallback(async (q: string): Promise<FindResult> => {
    const s = cleanCode(q);
    if (!s) return { state: 'none' };
    if (!demo) {
      const me = await remoteAuth.userId();
      const found = await remoteSocial.find(s);
      if (!found) return { state: 'none' };
      if (found.id === me) return { state: 'self' };
      if (friends.some(f => f.id === found.id)) return { state: 'friend' };
      if (requests.some(r => r.peer.id === found.id)) return { state: 'pending' };
      return { state: 'found', peer: toPeer(found) };
    }
    if (!profile) return { state: 'none' };
    if (s === myFriendCode(profile)) return { state: 'self' };
    const hit = [...SAMPLES, ...DIRECTORY].find(x => x.code === s);
    if (!hit) return { state: 'none' };
    if (friends.some(f => f.id === hit.id)) return { state: 'friend' };
    if (requests.some(r => r.peer.id === hit.id)) return { state: 'pending' };
    return { state: 'found', peer: peerOf(hit, profile) };
  }, [mode, profile, friends, requests]);

  const request = useCallback(async (peer: Peer) => {
    if (!demo) { await remoteSocial.request(peer.id); await refresh(); return; }
    setRequests(prev => [...prev, { id: `req-${peer.id}`, peer, direction: 'out', created: todayISO() }]);
  }, [mode, refresh]);

  const respond = useCallback(async (r: Request, accept: boolean) => {
    if (!demo) { await remoteSocial.respond(r.id, accept ? 'accepted' : 'declined'); await refresh(); return; }
    setRequests(prev => prev.filter(x => x.id !== r.id));
    if (accept && profile) {
      const s = [...SAMPLES, ...DIRECTORY].find(x => x.id === r.peer.id);
      if (s) {
        const f = demoFriend(s, profile, todayISO());
        setFriends(prev => [...prev, f]);
        setHomework(prev => [...prev, ...demoHomework(s, f)]);
      }
    }
  }, [mode, profile, refresh]);

  const cancel = useCallback(async (r: Request) => {
    if (!demo) { await remoteSocial.remove(r.id); await refresh(); return; }
    setRequests(prev => prev.filter(x => x.id !== r.id));
  }, [mode, refresh]);

  const unfriend = useCallback(async (f: Friend) => {
    if (!demo) { if (f.rowId) await remoteSocial.remove(f.rowId); await refresh(); return; }
    setFriends(prev => prev.filter(x => x.id !== f.id));
    setHomework(prev => prev.filter(h => h.friendId !== f.id));
  }, [mode, refresh]);

  return useMemo(() => ({ mode, loading, ready, error, friends, requests, homework, find, request, respond, cancel, unfriend, refresh }),
    [mode, loading, ready, error, friends, requests, homework, find, request, respond, cancel, unfriend, refresh]);
};

const toPeer = (p: FoundStudent): Peer => ({ id: p.id, firstName: p.first_name, lastName: p.last_name, grade: p.grade, avatar: avatarOf(p.avatar, `${p.first_name} ${p.last_name}`), photo: photoOf(p.photo_url) });

// The student's own badge ids: what src/earned.ts has written into UNLOCKED.
export const myBadgeIds = () => Object.keys(UNLOCKED);
export type { RemoteProfile };

// One friends list for the whole app, loaded at launch rather than when the
// Social tab first opens.
const SocialContext = createContext<Social | null>(null);
export const FriendsProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile, signedIn } = useProfile();
  const value = useFriends(profile, signedIn);
  return React.createElement(SocialContext.Provider, { value }, children);
};
export const useSocial = () => {
  const s = useContext(SocialContext);
  if (!s) throw new Error('useSocial needs FriendsProvider');
  return s;
};

// You, as a friend sees you. An unpicked avatar falls back to a tone from the
// name, which is what friends' phones work out too.
export const myAvatar = (p: StudentProfile) => avatarOf(p.avatar, `${p.firstName} ${p.lastName}`);
// Your photo: the file on this phone, else the copy friends get from the server.
export const mePeer = (p: StudentProfile): Peer => ({ id: 'me', firstName: p.firstName, lastName: p.lastName, grade: p.grade, avatar: myAvatar(p), photo: p.photoUri || p.photoUrl || undefined });
