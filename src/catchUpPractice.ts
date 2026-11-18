// Spartans — Catch Up practice runs, for the owner (Developer screen).
// Opens the whole Catch Up flow as many times as wanted, as any grade, and
// throws it all away: no progress saved, no badges given, nothing sent to the
// server. The reveal still plays with what the answers would have earned.

import { useSyncExternalStore } from 'react';

export type Practice = { grade: number } | null;

let current: Practice = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export const startCatchUpPractice = (grade: number) => { current = { grade }; emit(); };
export const endCatchUpPractice = () => { current = null; emit(); };

export const useCatchUpPractice = () => useSyncExternalStore(
  f => { subs.add(f); return () => { subs.delete(f); }; },
  () => current,
  () => current,
);
