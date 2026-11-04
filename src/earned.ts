// Spartans — badges earned on this phone at runtime (event banners, later
// the server's badge_awards). UNLOCKED in badges.ts is the demo list every
// screen already reads synchronously, so an earned badge is written straight
// into it and saved, then subscribers re-render. Loaded once at startup.
//
// Key starts with "spartans-" so Delete account wipes it.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UNLOCKED, BADGES, Badge } from './badges';

const KEY = 'spartans-badges-earned-v1';          // { id: { iso, at } }
const listeners = new Set<() => void>();
const AT: Record<string, number> = {};
let loaded = false;

const emit = () => listeners.forEach(f => f());

export const loadEarned = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const v = await AsyncStorage.getItem(KEY);
    const saved: Record<string, { iso: string; at: number }> = v ? JSON.parse(v) : {};
    for (const [id, e] of Object.entries(saved)) { UNLOCKED[id] = e.iso; AT[id] = e.at; }
  } catch {}
  emit();
};

// Returns the badge if this call unlocked it, null if it was already had
// (or the id is unknown), so callers only celebrate a real unlock.
export const earnBadge = (id: string, iso: string, when = Date.now()): Badge | null => {
  const badge = BADGES.find(b => b.id === id);
  if (!badge || id in UNLOCKED) return null;
  UNLOCKED[id] = iso;
  AT[id] = when;
  AsyncStorage.getItem(KEY)
    .then(v => AsyncStorage.setItem(KEY, JSON.stringify({ ...(v ? JSON.parse(v) : {}), [id]: { iso, at: when } })))
    .catch(() => {});
  emit();
  return badge;
};

// When a badge was earned on this phone (ms), if it was.
export const earnedAt = (id: string): number | undefined => AT[id];

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
