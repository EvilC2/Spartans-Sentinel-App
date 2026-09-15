// Spartans — XP and levels, derived from unlocked badges.
// Local only for now: rarity → points, summed over unlocked badges. The
// server-side ledger (phase 2) replaces this with awarded XP.

import { BADGES, Rarity, isUnlocked } from './badges';

export const RARITY_XP: Record<Rarity, number> = {
  common: 10, uncommon: 25, rare: 50, epic: 100, legendary: 200,
  exotic: 400, special: 75, seasonal: 40, secret: 150,
};

export const totalXp = () => BADGES.filter(isUnlocked).reduce((s, b) => s + RARITY_XP[b.rarity], 0);

// Level n needs 100·(n−1)² XP: 0, 100, 400, 900, 1600…
export const levelFor = (xp: number) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));
export const xpForLevel = (level: number) => 100 * (level - 1) ** 2;

export type LevelState = { xp: number; level: number; into: number; span: number; progress: number; toNext: number };

export const levelState = (xp = totalXp()): LevelState => {
  const level = levelFor(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const into = xp - floor;
  const span = ceil - floor;
  return { xp, level, into, span, progress: span ? into / span : 1, toNext: ceil - xp };
};

export const LEVEL_TITLES = ['Rookie', 'Recruit', 'Hoplite', 'Shield-bearer', 'Phalanx', 'Captain', 'Champion', 'Legend'];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, level - 1))];
