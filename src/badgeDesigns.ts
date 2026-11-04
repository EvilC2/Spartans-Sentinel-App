// Spartans — Badge team designs (App Club Admin → Badges).
// A design is a badge on its way into the catalogue: the wizard fills it in
// step by step, then it is sent for approval (owner or Badges manager).
// Approved designs join BADGES at runtime, so the Badges page, unlocks and
// pins treat them like built-in ones.
// A design with `targetId` is an edit to an existing badge (built-in or made
// here): once approved it replaces that badge's title, description, rarity,
// category and art, and the badge keeps its id so nobody loses it.
//
// Same three modes as the content store:
//   demo   no backend: designs live on this phone and you are an owner, so
//          you can approve your own to try the whole flow.
//   live   signed in: the server's badge_designs table (migration 0011).
//   local  backend set up but 0011 not run: stays on this phone, with a note.
//
// Module-level store with listeners (like earned.ts) so the admin panel, the
// wizard and the Badges page share one copy without another provider.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendConfigured } from './supabase';
import { BADGES, Badge, Category, CustomArt, Rarity, Season, SEASON } from './badges';
import { ROOMS, roomName } from './map/data';
import type { BadgeDesignRow, BadgeDesignWrite } from './backend';
import type { IconName } from './components/Icon';

// ── Model ───────────────────────────────────────────────────────
// `builtin`: the app already awards it (edits to existing badges only).
export type HowKind = 'seasonal' | 'attendance' | 'qr' | 'granted' | 'builtin';

// How students get it. One flat object so switching kinds in the wizard
// keeps what was typed for the others.
export type How = {
  kind: HowKind | null;
  date?: string;       // seasonal: YYYY-MM-DD the badge unlocks
  until?: string;      // seasonal: optional last day (a range, like all of December)
  places?: string[];   // attendance: map place ids, or 'events' for any school event
  times?: number;      // attendance: how many check-ins it takes
  code?: string;       // qr: what the code says
};

export type DesignStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type BadgeDesign = {
  id: string;
  title: string;
  desc: string;
  category: Category;
  how: How;
  rarity: Rarity | null;      // null until step 3
  season?: Season;            // seasonal: from the date
  art: CustomArt;             // { mode: 'template' } until step 4
  status: DesignStatus;
  note?: string | null;       // the owner's note when sent back (or approved)
  badgeId?: string | null;    // catalogue id once approved
  targetId?: string | null;   // editing this existing badge
  author?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
};

export const HOW: Record<HowKind, { label: string; sub: string; icon: IconName }> = {
  seasonal: { label: 'Seasonal', sub: 'Unlocks on a date', icon: 'calendar' },
  attendance: { label: 'Attendance', sub: 'Show up somewhere', icon: 'pin' },
  qr: { label: 'QR code', sub: 'Scan to unlock', icon: 'qr' },
  granted: { label: 'Granted', sub: 'Badge team gives it', icon: 'shield' },
  builtin: { label: 'Built in', sub: 'The app gives it out', icon: 'sparkle' },
};
export const HOW_ORDER: HowKind[] = ['seasonal', 'attendance', 'qr', 'granted'];

export const STATUS: Record<DesignStatus, { label: string; tone: 'gold' | 'sky' | 'moss' | 'crimson' }> = {
  draft: { label: 'Draft', tone: 'gold' },
  pending: { label: 'Waiting for approval', tone: 'sky' },
  approved: { label: 'Approved', tone: 'moss' },
  rejected: { label: 'Sent back', tone: 'crimson' },
};

// Rarities a designer can pick. Seasonal is set by the "Seasonal" way to get
// it, never picked by hand.
export const PICKABLE: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'exotic', 'special', 'secret'];

// Where attendance can count: school places from the map, plus any event.
// District rule (Oct 2026): badges are for school activities only.
export const PLACES: { id: string; name: string }[] = [
  { id: 'events', name: 'Any school event' },
  ...ROOMS.filter(r => (r.kind === 'place' || r.kind === 'outdoor') && !/parking/i.test(r.id))
    .map(r => ({ id: r.id, name: r.name || roomName(r) || r.label.replace(/\n/g, ' ') }))
    // Activity spots only: no offices, change rooms, portables or second-floor duplicates.
    .filter(p => !/office|staff|counsel|change room|portable \d|bleachers|2nd floor|mezzanine/i.test(p.name))
    .filter((p, i, all) => p.name && all.findIndex(q => q.name === p.name) === i),
];
export const placeName = (id: string) => PLACES.find(p => p.id === id)?.name || id;

// Fall Sep–Nov, winter Dec–Feb, spring Mar–May, summer Jun–Aug.
export const seasonOf = (date?: string): Season | undefined => {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(date || '');
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 9 && n <= 11 ? 'fall' : n === 12 || n <= 2 ? 'winter' : n <= 5 ? 'spring' : 'summer';
};

// Where a badge shows on the Badges page when grouped by category; the
// designer can change it on the last step.
export const categoryFor = (k: HowKind | null, current: Category = 'events'): Category =>
  k === 'seasonal' ? 'seasonal' : k === 'granted' ? 'milestones' : k === 'builtin' ? current : 'events';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const newCode = () => `SPARTANS-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
export const qrPayload = (code: string) => `spartans://badge?code=${encodeURIComponent(code)}`;
export const freshCode = newCode;

export const newDesign = (): BadgeDesign => {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: '', desc: '', category: 'events', how: { kind: null, times: 1 }, rarity: null,
    art: { mode: 'template' }, status: 'draft', createdAt: now, updatedAt: now,
  };
};

// Edit an existing badge: the wizard starts filled in with what it has now,
// keeping its art until new art is picked.
export const newEdit = (b: Badge): BadgeDesign => {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetId: b.id, title: b.title, desc: b.desc, category: b.category,
    how: { kind: 'builtin', times: 1 }, rarity: b.rarity, season: b.season,
    art: { mode: 'original' }, status: 'draft', createdAt: now, updatedAt: now,
  };
};

// What still blocks a step (and so sending). Index = step number.
export const stepProblems = (d: BadgeDesign): Record<1 | 2 | 3 | 4, string | null> => {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const h = d.how;
  return {
    1: !d.title.trim() ? 'Give it a name.' : !d.desc.trim() ? 'Say how to earn it.' : null,
    2: !h.kind ? 'Pick how students get it.'
      : h.kind === 'seasonal' && !date.test(h.date || '') ? 'Set the date (YYYY-MM-DD).'
      : h.kind === 'seasonal' && !!h.until && (!date.test(h.until) || h.until < h.date!) ? 'The last day has to be a date after the first.'
      : h.kind === 'attendance' && !h.places?.length ? 'Pick at least one place.'
      : h.kind === 'qr' && !h.code ? 'Make a code.'
      : null,
    3: !d.rarity ? 'Pick a rarity.' : null,
    4: d.rarity === 'seasonal' && d.art.mode === 'template' ? 'Seasonal badges start empty. Add an icon or a whole badge.' : null,
  };
};
export const readyToSend = (d: BadgeDesign) => Object.values(stepProblems(d)).every(p => !p);

export const howSummary = (h: How): string => {
  switch (h.kind) {
    case 'seasonal': return h.until && h.until !== h.date ? `${fmtDay(h.date)} to ${fmtDay(h.until)}` : `On ${fmtDay(h.date)}`;
    case 'attendance': return `${h.times && h.times > 1 ? `${h.times} times at ` : ''}${(h.places || []).map(placeName).join(', ')}`;
    case 'qr': return 'Scan the code';
    case 'granted': return 'Given by the badge team';
    case 'builtin': return 'The app gives it out';
    default: return 'Not chosen';
  }
};
export const fmtDay = (iso?: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Every badge as it ships, before any Badge team edits. Captured once, at
// load, while BADGES still holds only the built-in catalogue.
const BASE = new Map<string, Badge>(BADGES.map(b => [b.id, { ...b }]));

// The badge a design starts from: built-in, or one the Badge team made.
const baseOf = (id: string): Badge | undefined => {
  const b = BASE.get(id);
  if (b) return b;
  const made = state.designs.find(x => x.status === 'approved' && !x.targetId && x.badgeId === id);
  return made ? toBadge(made) : undefined;
};

// The Badge every screen draws. Before approval the id is the design's.
export const toBadge = (d: BadgeDesign): Badge => {
  const base = d.targetId ? baseOf(d.targetId) : undefined;
  const keep = d.art.mode === 'original';
  return {
    id: d.targetId || d.badgeId || `design-${d.id}`,
    title: d.title || 'New badge',
    desc: d.desc || 'How to earn it',
    rarity: d.rarity || 'common',
    category: d.category,
    flavor: base?.flavor,
    season: d.season,
    // Built-in seasonal badges carry their own outline colour; keep it while
    // the season is unchanged.
    tint: d.season ? (base?.season === d.season && base.tint ? base.tint : SEASON[d.season]) : undefined,
    art: keep ? base?.art : undefined,
    custom: keep ? base?.custom : d.art,
    designId: d.id,
  };
};

// Open work on a badge (a draft, waiting, or sent back), newest first.
export const openWorkOn = (badgeId: string) =>
  state.designs.filter(d => (d.targetId === badgeId || (!d.targetId && d.badgeId === badgeId)) && d.status !== 'approved')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

// ── Server rows ─────────────────────────────────────────────────
const fromRow = (r: BadgeDesignRow): BadgeDesign => ({
  id: r.id, title: r.title, desc: r.description, category: r.category as Category,
  how: { ...(r.how as How), kind: (r.how as How).kind ?? null }, rarity: (r.rarity || null) as Rarity | null,
  season: (r.season || undefined) as Season | undefined, art: (r.art as CustomArt) || { mode: 'template' },
  status: r.status, note: r.review_note, badgeId: r.badge_id, targetId: r.target_id ?? null, author: r.author,
  createdAt: r.created_at, updatedAt: r.updated_at, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at,
});
const toRow = (d: BadgeDesign): BadgeDesignWrite => ({
  title: d.title.trim(), description: d.desc.trim(), category: d.category, how: d.how as Record<string, unknown>,
  rarity: d.rarity || 'common', season: d.season || null, art: d.art as unknown as Record<string, unknown>,
  status: d.status === 'pending' ? 'pending' : 'draft', submitted_at: d.submittedAt || null,
  ...(d.targetId ? { target_id: d.targetId } : {}),
});
const missingTable = (e: any) => /badge_designs|review_badge_design/.test(String(e?.message)) && /does not exist|not find|schema cache|404/i.test(String(e?.message));

// ── Store ───────────────────────────────────────────────────────
export type DesignMode = 'demo' | 'live' | 'local';
type State = { designs: BadgeDesign[]; mode: DesignMode; note: string | null; loaded: boolean };

const KEY = 'spartans-badge-designs-v1';
let state: State = { designs: [], mode: backendConfigured ? 'local' : 'demo', note: null, loaded: false };
const listeners = new Set<() => void>();
let catalogVersion = 0;

const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  syncCatalog();
  listeners.forEach(f => f());
};
const persist = () => {
  if (state.mode !== 'live') AsyncStorage.setItem(KEY, JSON.stringify(state.designs)).catch(() => {});
};

// Approved designs → BADGES: the shipped catalogue, plus new badges, with
// the latest approved edit to each badge laid over it. BADGES is rebuilt in
// place so every screen holding it sees the change.
let synced = '';
const syncCatalog = () => {
  const approved = state.designs.filter(d => d.status === 'approved' && (d.badgeId || d.targetId));
  const key = approved.map(d => `${d.id}:${d.updatedAt}:${d.reviewedAt}`).sort().join('|');
  if (key === synced) return;
  synced = key;
  const when = (d: BadgeDesign) => d.reviewedAt || d.updatedAt;
  const next: Badge[] = [...BASE.values()].map(b => ({ ...b }));
  for (const d of approved.filter(x => !x.targetId)) {
    if (!next.some(b => b.id === d.badgeId)) next.push({ ...toBadge(d), editedAt: when(d) });
  }
  for (const d of approved.filter(x => x.targetId).sort((a, b) => when(a).localeCompare(when(b)))) {
    const i = next.findIndex(b => b.id === d.targetId);
    if (i >= 0) next[i] = { ...toBadge(d), editedAt: when(d) };
  }
  BADGES.splice(0, BADGES.length, ...next);
  catalogVersion++;
};

const loadLocal = async (): Promise<BadgeDesign[]> => {
  try { const v = await AsyncStorage.getItem(KEY); return v ? JSON.parse(v) : []; } catch { return []; }
};

// Students and admins alike: at startup (and on sign-in) pull the designs
// this account can see. For students RLS returns approved ones only.
export const loadDesigns = async (signedIn: boolean) => {
  if (!backendConfigured || !signedIn) {
    set({ designs: await loadLocal(), mode: backendConfigured ? 'local' : 'demo', loaded: true, note: null });
    return;
  }
  try {
    const { badgeDesigns } = await import('./backend');
    set({ designs: (await badgeDesigns.list()).map(fromRow), mode: 'live', loaded: true, note: null });
  } catch (e: any) {
    if (missingTable(e)) {
      set({ designs: await loadLocal(), mode: 'local', loaded: true,
        note: 'The server does not have badge designs yet (migration 0011). Until it is run, designs stay on this phone.' });
    } else {
      set({ loaded: true, note: state.designs.length ? 'Offline. Showing the last copy.' : 'Could not reach the server.' });
    }
  }
};

export const saveDesign = async (input: BadgeDesign): Promise<BadgeDesign> => {
  const d = { ...input, updatedAt: new Date().toISOString() };
  if (state.mode === 'live') {
    const { badgeDesigns } = await import('./backend');
    const isNew = d.id.startsWith('local-');
    const out = fromRow(isNew ? await badgeDesigns.create(toRow(d)) : await badgeDesigns.update(d.id, toRow(d)));
    set({ designs: isNew ? [out, ...state.designs] : state.designs.map(x => (x.id === out.id ? out : x)) });
    return out;
  }
  const exists = state.designs.some(x => x.id === d.id);
  set({ designs: exists ? state.designs.map(x => (x.id === d.id ? d : x)) : [d, ...state.designs] });
  persist();
  return d;
};

export const submitDesign = (d: BadgeDesign) =>
  saveDesign({ ...d, status: 'pending', note: null, submittedAt: new Date().toISOString() });

export const removeDesign = async (id: string) => {
  if (state.mode === 'live' && !id.startsWith('local-')) {
    const { badgeDesigns } = await import('./backend');
    await badgeDesigns.remove(id);
  }
  set({ designs: state.designs.filter(x => x.id !== id) });
  persist();
};

// Owner or Badges manager: approve (joins the catalogue) or send back with
// a note.
export const reviewDesign = async (d: BadgeDesign, ok: boolean, note?: string) => {
  if (!ok && !note?.trim()) throw new Error('Say what to change.');
  if (state.mode === 'live') {
    const { badgeDesigns } = await import('./backend');
    await badgeDesigns.review(d.id, ok, note);
    await loadDesigns(true);
    return;
  }
  let badgeId: string | null = null;
  if (ok && d.targetId) badgeId = d.targetId;
  else if (ok) {
    const base = slug(d.title) || 'badge';
    badgeId = base;
    for (let n = 2; BADGES.some(b => b.id === badgeId && b.designId !== d.id); n++) badgeId = `${base}-${n}`;
  }
  const at = new Date().toISOString();
  const out: BadgeDesign = { ...d, status: ok ? 'approved' : 'rejected', note: note?.trim() || null, badgeId, updatedAt: at, reviewedAt: at };
  set({ designs: state.designs.map(x => (x.id === d.id ? out : x)) });
  persist();
};

// Managers skip the queue: send it and approve it in one go.
export const publishDesign = async (d: BadgeDesign) => {
  const sent = await submitDesign(d);
  await reviewDesign(sent, true);
};

// A PNG picked on this phone → a URL the design keeps. Live: the badge-art
// bucket. Demo/local: copied into the app's documents (web: kept as a data
// URL) so it survives the picker's cache being cleared.
export const uploadArt = async (uri: string): Promise<string> => {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    if (state.mode === 'live') {
      const { badgeDesigns } = await import('./backend');
      return badgeDesigns.uploadArt(`designs/${name}`, await blob.arrayBuffer());
    }
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Could not read the picture.'));
      r.readAsDataURL(blob);
    });
  }
  const { File, Paths } = await import('expo-file-system');
  if (state.mode === 'live') {
    const { badgeDesigns } = await import('./backend');
    return badgeDesigns.uploadArt(`designs/${name}`, await new File(uri).arrayBuffer());
  }
  const dest = new File(Paths.document, `badge-${name}`);
  new File(uri).copy(dest);
  return dest.uri;
};

// Re-render on any change. `catalog` bumps when approved badges join BADGES,
// for memos over the catalogue.
export const useBadgeDesigns = () => {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN(x => x + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return { ...state, catalog: catalogVersion };
};
export const useCatalogVersion = () => useBadgeDesigns().catalog;
// Outside React (claiming a scanned code).
export const allDesigns = () => state.designs;
