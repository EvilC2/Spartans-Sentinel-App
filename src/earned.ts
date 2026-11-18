// Spartans — badges this account has earned. UNLOCKED in badges.ts is the
// store every screen reads synchronously, so an earned badge is written
// straight into it and saved, then subscribers re-render. Loaded once at
// startup, then topped up with the server's badge_awards after sign-in so team
// awards and a new phone both show the right shelf.
//
// Key starts with "spartans-" so Delete account wipes it.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UNLOCKED, BADGES, Badge } from './badges';

const KEY = 'spartans-badges-earned-v1';          // { id: { iso, at, catchUp? } }
type Saved = Record<string, { iso: string; at: number; catchUp?: boolean }>;
const listeners = new Set<() => void>();
const AT: Record<string, number> = {};
const CATCH_UP = new Set<string>();
let loading: Promise<void> | null = null;

const emit = () => listeners.forEach(f => f());

export const loadEarned = () => (loading ??= (async () => {
  try {
    const v = await AsyncStorage.getItem(KEY);
    const saved: Saved = v ? JSON.parse(v) : {};
    for (const [id, e] of Object.entries(saved)) {
      UNLOCKED[id] = e.iso; AT[id] = e.at;
      if (e.catchUp) CATCH_UP.add(id);
    }
  } catch {}
  emit();
})());

// Writes go one at a time so two quick changes can't overwrite each other.
let writes: Promise<unknown> = Promise.resolve();
const mutate = (fn: (s: Saved) => Saved) => {
  writes = writes
    .then(() => AsyncStorage.getItem(KEY))
    .then(v => AsyncStorage.setItem(KEY, JSON.stringify(fn(v ? JSON.parse(v) : {}))))
    .catch(() => {});
};

// Returns the badge if this call unlocked it, null if it was already had
// (or the id is unknown), so callers only celebrate a real unlock.
export const earnBadge = (id: string, iso: string, when = Date.now()): Badge | null => {
  const badge = BADGES.find(b => b.id === id);
  if (!badge || id in UNLOCKED) return null;
  UNLOCKED[id] = iso;
  AT[id] = when;
  mutate(s => ({ ...s, [id]: { iso, at: when } }));
  emit();
  return badge;
};

// Catch Up gives many at once. Returns the ones this call really unlocked.
export const earnCatchUp = async (ids: string[], iso: string, when = Date.now()): Promise<Badge[]> => {
  await loadEarned();
  const fresh = BADGES.filter(b => ids.includes(b.id) && !(b.id in UNLOCKED));
  for (const b of fresh) { UNLOCKED[b.id] = iso; AT[b.id] = when; CATCH_UP.add(b.id); }
  mutate(s => {
    const next = { ...s };
    for (const b of fresh) next[b.id] = { iso, at: when, catchUp: true };
    return next;
  });
  emit();
  return fresh;
};

export const revokeBadges = async (ids: string[]) => {
  if (!ids.length) return;
  await loadEarned();
  for (const id of ids) { delete UNLOCKED[id]; delete AT[id]; CATCH_UP.delete(id); }
  mutate(s => {
    const next = { ...s };
    for (const id of ids) delete next[id];
    return next;
  });
  emit();
};

// The server's awards for this account. Only adds: something earned on this
// phone that hasn't reached the server yet stays.
export const mergeServerAwards = async (rows: { badge_id: string; awarded_at: string; reason?: string }[]) => {
  await loadEarned();
  const fresh = rows.filter(r => !(r.badge_id in UNLOCKED));
  if (!fresh.length) return;
  const add: Saved = {};
  for (const r of fresh) {
    const at = Date.parse(r.awarded_at) || Date.now();
    const d = new Date(at);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const catchUp = r.reason === 'Catch Up';
    UNLOCKED[r.badge_id] = iso; AT[r.badge_id] = at;
    if (catchUp) CATCH_UP.add(r.badge_id);
    add[r.badge_id] = { iso, at, catchUp };
  }
  mutate(s => ({ ...s, ...add }));
  emit();
};

// A different account signed in on this phone: its shelf isn't this one.
export const clearEarned = async () => {
  await loadEarned();
  for (const id of Object.keys(UNLOCKED)) delete UNLOCKED[id];
  for (const id of Object.keys(AT)) delete AT[id];
  CATCH_UP.clear();
  mutate(() => ({}));
  emit();
};

// When a badge was earned on this phone (ms), if it was.
export const earnedAt = (id: string): number | undefined => AT[id];

// Came from Catch Up rather than being earned that day, so the XP history and
// notifications don't treat it as something that just happened.
export const isCatchUpBadge = (id: string) => CATCH_UP.has(id);
export const catchUpBadgeIds = () => [...CATCH_UP];

// Re-render when a badge is earned. Returns a counter to key memos on.
export const useEarnedVersion = () => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN(x => x + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return n;
};
