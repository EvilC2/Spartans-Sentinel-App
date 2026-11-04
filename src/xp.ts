// Spartans — XP, levels, ranks and the XP log.
// XP comes from three places:
//   1. Badges: each unlocked badge is worth its rarity's points (RARITY_XP).
//   2. Moving up a grade: GRADE_XP for every grade past 8, worth a pile of
//      levels. Worked out from the profile's grade (setXpGrade), never stored.
//   3. Doing things in the app, kept as a log on this phone: opening the app
//      each day (streaks pay more), answering trivia, voting in polls,
//      finishing homework, reading announcements. Every entry has a `ref`
//      so the same thing never pays twice, and some kinds have a daily cap.
// The XP sheet (src/components/XpSheet.tsx) reads levels, stats and the log
// from here. Key starts with "spartans-" so Delete account wipes it.
// Friends still see server XP (badges only) until the log syncs.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES, Rarity, isUnlocked, unlockedOn } from './badges';
import type { IconName } from './components/Icon';

export const RARITY_XP: Record<Rarity, number> = {
  common: 10, uncommon: 25, rare: 50, epic: 100, legendary: 200,
  exotic: 400, special: 75, seasonal: 40, secret: 150,
};

// ── Rules ───────────────────────────────────────────────────────
export type XpKind = 'daily' | 'trivia' | 'poll' | 'homework' | 'read' | 'badge' | 'grade';

export const STREAK_BONUS = 2;      // per day of streak after the first
export const STREAK_BONUS_MAX = 20;
export const GRADE_XP = 4000;        // per grade moved up (9, 10, 11, 12)
export const FIRST_GRADE = 8;
export const XP = { triviaRight: 15, triviaWrong: 3, poll: 5, homework: 10, read: 2 };

export const XP_RULES: { kind: XpKind; label: string; xp: string; sub: string; icon: IconName }[] = [
  { kind: 'daily', label: 'Open Spartans', xp: '+5', sub: `Once a day. A streak adds ${STREAK_BONUS} a day, up to +${STREAK_BONUS_MAX}`, icon: 'sun' },
  { kind: 'trivia', label: 'Trivia', xp: `+${XP.triviaRight}`, sub: `Right answer. A wrong guess still gets +${XP.triviaWrong}`, icon: 'sparkle' },
  { kind: 'poll', label: 'Vote in a poll', xp: `+${XP.poll}`, sub: 'Once per poll', icon: 'chart' },
  { kind: 'homework', label: 'Finish homework', xp: `+${XP.homework}`, sub: 'Tick it off. Up to 5 a day', icon: 'tasks' },
  { kind: 'read', label: 'Read an announcement', xp: `+${XP.read}`, sub: 'Open a post. Up to 5 a day', icon: 'news' },
  { kind: 'badge', label: 'Unlock a badge', xp: '+10 to +400', sub: 'More for rarer badges', icon: 'badge' },
  { kind: 'grade', label: 'Move up a grade', xp: `+${GRADE_XP.toLocaleString()}`, sub: 'Every September. Worth a pile of levels', icon: 'grad' },
];
const CAP: Partial<Record<XpKind, number>> = { homework: 5, read: 5 };

export const KIND_LABEL: Record<XpKind, string> = {
  daily: 'Daily', trivia: 'Trivia', poll: 'Polls', homework: 'Homework', read: 'Reading', badge: 'Badges', grade: 'Grades',
};

// ── Levels and ranks ────────────────────────────────────────────
// Each level costs a little more than the last: level n → n+1 needs
// 40 + 8·(n−1) XP. So level 2 is 40 XP (about a day), level 10 is 648,
// level 50 is 11,368 and level 100 is 42,768. Levels keep going past 100.
export const xpForLevel = (level: number) => { const m = Math.max(0, level - 1); return 4 * m * m + 36 * m; };
export const levelFor = (xp: number) => {
  const x = Math.max(0, xp);
  let level = 1 + Math.floor((Math.sqrt(1296 + 16 * x) - 36) / 8);
  while (xpForLevel(level + 1) <= x) level++;      // guard the float edges
  while (level > 1 && xpForLevel(level) > x) level--;
  return level;
};

// A rank is a band of levels. Legend starts at level 100. Each rank has a
// tier colour pair (light → dark) for its emblem (src/components/RankEmblem.tsx).
export const MAX_RANK_LEVEL = 100;
export type Rank = { title: string; level: number; colors: [string, string]; glow: string };
export const RANKS: Rank[] = [
  { title: 'Rookie', level: 1, colors: ['#D9A87A', '#8A5A34'], glow: '#E0A06A' },
  { title: 'Starter', level: 10, colors: ['#E4E8EE', '#8E98A6'], glow: '#C9D2DE' },
  { title: 'Varsity', level: 20, colors: ['#9BD77E', '#3E7D3A'], glow: '#7CCB5E' },
  { title: 'All-Star', level: 35, colors: ['#7FC4FF', '#1F5FB0'], glow: '#5AAEFF' },
  { title: 'Captain', level: 50, colors: ['#C9A2FF', '#5E2FA8'], glow: '#B07CFF' },
  { title: 'Champion', level: 65, colors: ['#FF9A8A', '#A42A2A'], glow: '#FF6F5E' },
  { title: 'Hall of Fame', level: 80, colors: ['#FFE38A', '#B57A12'], glow: '#FFC94A' },
  { title: 'Legend', level: MAX_RANK_LEVEL, colors: ['#8AF5FF', '#7A3DFF'], glow: '#C07CFF' },
];
export const rankIndex = (level: number) => { let i = 0; RANKS.forEach((r, j) => { if (level >= r.level) i = j; }); return i; };
export const rankFor = (level: number) => RANKS[rankIndex(level)];
export const nextRank = (level: number) => RANKS[rankIndex(level) + 1] || null;
export const levelTitle = (level: number) => rankFor(level).title;

export type LevelState = { xp: number; level: number; into: number; span: number; progress: number; toNext: number };

export const levelState = (xp = totalXp()): LevelState => {
  const level = levelFor(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const into = xp - floor;
  const span = ceil - floor;
  return { xp, level, into, span, progress: span ? into / span : 1, toNext: ceil - xp };
};

// ── The log ─────────────────────────────────────────────────────
export type XpEntry = { id: string; kind: XpKind; xp: number; at: number; label: string };
type Saved = { log: XpEntry[]; streak: { last: string; current: number; best: number } };

const KEY = 'spartans-xp-v1';
let state: Saved = { log: [], streak: { last: '', current: 0, best: 0 } };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
const save = () => { AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); };

export const isoOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayBefore = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return isoOf(new Date(y, m - 1, d - 1).getTime()); };

// Loads once; every caller waits for the same read so nothing writes over it.
export const loadXp = () => (loaded ??= (async () => {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) state = { ...state, ...JSON.parse(v) };
  } catch {}
  emit();
})());

// Grade XP: one entry per grade moved up, dated the September it happened.
let grade = FIRST_GRADE;
export const setXpGrade = (g: number) => {
  const next = Math.max(FIRST_GRADE, Math.min(12, Math.round(g) || FIRST_GRADE));
  if (next === grade) return;
  grade = next;
  emit();
};
export const gradeXp = (g: number) => GRADE_XP * Math.max(0, Math.min(12, g) - FIRST_GRADE);
const gradeEntries = (now = new Date()): XpEntry[] => {
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const out: XpEntry[] = [];
  for (let g = FIRST_GRADE + 1; g <= grade; g++) {
    out.push({ id: `grade:${g}`, kind: 'grade', xp: GRADE_XP, at: new Date(startYear - (grade - g), 8, 1, 9).getTime(), label: `Moved up to Grade ${g}` });
  }
  return out;
};

// Badge XP, as log entries so the history shows them too.
const badgeEntries = (): XpEntry[] => BADGES.filter(isUnlocked).map(b => ({
  id: `badge:${b.id}`, kind: 'badge' as const, xp: RARITY_XP[b.rarity], at: unlockedOn(b)?.getTime() ?? 0, label: b.title,
}));

export const xpLog = (): XpEntry[] => [...state.log, ...badgeEntries(), ...gradeEntries()].sort((a, b) => b.at - a.at);
export const totalXp = () => xpLog().reduce((s, e) => s + e.xp, 0);

// Pay out once per `ref`. Returns the XP given (0 if already paid or capped).
export const earnXp = async (kind: Exclude<XpKind, 'badge' | 'daily' | 'grade'>, ref: string, xp: number, label: string, now = Date.now()): Promise<number> => {
  await loadXp();
  const id = `${kind}:${ref}`;
  if (state.log.some(e => e.id === id)) return 0;
  const cap = CAP[kind];
  if (cap) {
    const today = isoOf(now);
    if (state.log.filter(e => e.kind === kind && isoOf(e.at) === today).length >= cap) return 0;
  }
  state = { ...state, log: [...state.log, { id, kind, xp, at: now, label }] };
  save(); emit();
  return xp;
};

// First open of the day: +5, plus the streak bonus. Safe to call often.
export const checkIn = async (now = Date.now()): Promise<number> => {
  await loadXp();
  const today = isoOf(now);
  const s = state.streak;
  if (s.last === today) return 0;
  const current = s.last === dayBefore(today) ? s.current + 1 : 1;
  const xp = 5 + Math.min(STREAK_BONUS_MAX, STREAK_BONUS * (current - 1));
  state = {
    log: [...state.log, { id: `daily:${today}`, kind: 'daily', xp, at: now, label: current > 1 ? `Opened Spartans · day ${current} streak` : 'Opened Spartans' }],
    streak: { last: today, current, best: Math.max(s.best, current) },
  };
  save(); emit();
  return xp;
};

// ── Stats for the XP sheet ──────────────────────────────────────
export type XpStats = {
  total: number;
  week: number;                                   // last 7 days
  today: number;
  streak: number;                                 // 0 once the streak breaks
  bestStreak: number;
  daysActive: number;
  byKind: Record<XpKind, number>;                 // XP from each kind
  counts: Record<XpKind, number>;                 // how many times
  triviaRight: number;
  last14: { iso: string; xp: number }[];          // oldest first; grade XP left out so it does not flatten the chart
  todayCounts: Record<XpKind, number>;            // entries logged today, for the daily quests
  last7Active: boolean[];                         // oldest first: did they open the app that day
};

// ── Daily quests ────────────────────────────────────────────────
// Nothing new is stored: a quest is done when today's log has enough entries
// of its kind. Resets at midnight with the log.
export type Quest = { kind: XpKind; label: string; goal: number; reward: string; icon: IconName };
export const QUESTS: Quest[] = [
  { kind: 'daily', label: 'Check in', goal: 1, reward: '+5', icon: 'sun' },
  { kind: 'trivia', label: 'Answer the trivia', goal: 1, reward: `+${XP.triviaRight}`, icon: 'sparkle' },
  { kind: 'homework', label: 'Finish 3 homework tasks', goal: 3, reward: `+${XP.homework * 3}`, icon: 'tasks' },
  { kind: 'read', label: 'Read 3 announcements', goal: 3, reward: `+${XP.read * 3}`, icon: 'news' },
];

export const xpStats = (now = Date.now()): XpStats => {
  const log = xpLog();
  const today = isoOf(now);
  const byKind = { daily: 0, trivia: 0, poll: 0, homework: 0, read: 0, badge: 0, grade: 0 } as Record<XpKind, number>;
  const counts = { ...byKind };
  for (const e of log) { byKind[e.kind] += e.xp; counts[e.kind] += 1; }
  const days: { iso: string; xp: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const iso = isoOf(d.getTime());
    days.push({ iso, xp: log.filter(e => e.at && e.kind !== 'grade' && isoOf(e.at) === iso).reduce((s, e) => s + e.xp, 0) });
  }
  const s = state.streak;
  const alive = s.last === today || s.last === dayBefore(today);
  return {
    total: log.reduce((a, e) => a + e.xp, 0),
    week: days.slice(-7).reduce((a, d) => a + d.xp, 0),
    today: days[days.length - 1].xp,
    streak: alive ? s.current : 0,
    bestStreak: s.best,
    daysActive: state.log.filter(e => e.kind === 'daily').length,
    byKind, counts,
    triviaRight: state.log.filter(e => e.kind === 'trivia' && e.xp >= XP.triviaRight).length,
    last14: days,
    todayCounts: log.reduce((m, e) => { if (e.at && isoOf(e.at) === today) m[e.kind] += 1; return m; },
      { daily: 0, trivia: 0, poll: 0, homework: 0, read: 0, badge: 0, grade: 0 } as Record<XpKind, number>),
    last7Active: days.slice(-7).map(d => state.log.some(e => e.id === `daily:${d.iso}`)),
  };
};

// Re-render when XP changes (and once it has loaded).
export const useXpVersion = () => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN(x => x + 1);
    listeners.add(f);
    loadXp();
    return () => { listeners.delete(f); };
  }, []);
  return n;
};
