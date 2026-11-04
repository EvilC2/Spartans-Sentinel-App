// Spartans — App Club Admin content model.
// Everything the App Club puts in front of students is a Post: trivia, "did
// you know" facts, polls, news, cafeteria menu changes, pop-up banners and
// club events. A post says WHERE it shows (`places`) and WHEN (`startsAt` /
// `endsAt`), so editing one that is already out changes it everywhere at once.
// Same shape as the server's `posts` table (supabase/migrations/0008).

import type { IconName } from '../components/Icon';
import type { Role } from '../backend';
import { can } from '../ranks';
import type { MenuCategory, Tag } from '../menu';

export type PostKind = 'trivia' | 'fact' | 'poll' | 'news' | 'menu' | 'popup' | 'event';
export type Place = 'buzz' | 'news' | 'banner' | 'bell' | 'cafeteria' | 'calendar';
export type NewsCategory = 'Athletics' | 'Academic' | 'General' | 'Events';

// Every kind may carry a photo that shows behind it (a public URL from the
// post-images bucket, migration 0010; a file on this phone in demo mode).
export type Pic = { image?: string | null };

export type TriviaData = Pic & { prompt: string; options: string[]; answer: number; explain?: string };
export type FactData = Pic & { eyebrow: string; title: string; body: string };
export type PollData = Pic & { prompt: string; options: string[]; showResults: boolean };
export type NewsData = Pic & { category: NewsCategory; title: string; body: string; author: string; role?: string; push?: boolean };
// Menu: with `itemId` it changes an item already on the menu (price, sold
// out, hidden, today's special). Without, it adds a new item.
export type MenuData = Pic & {
  itemId?: string; name: string; price?: number | null; blurb: string; cats: MenuCategory[];
  art?: string; tags?: Tag[]; soldOut?: boolean; hidden?: boolean; featured?: boolean;
};
export type PopupData = Pic & { template: string; title: string; body: string; badge?: string | null; push?: boolean };
export type EventData = Pic & { title: string; date: string; time?: string; place?: string; body?: string; push?: boolean };

export type DataOf = {
  trivia: TriviaData; fact: FactData; poll: PollData; news: NewsData;
  menu: MenuData; popup: PopupData; event: EventData;
};

type Base = {
  id: string;
  places: Place[];
  status: 'draft' | 'published';
  startsAt: string | null;   // ISO; null = as soon as published
  endsAt: string | null;     // ISO; null = until taken down
  sort: number;              // lower shows first in The Buzz
  pinned: boolean;           // top of Announcements
  createdAt: string;
  updatedAt: string;
  sample?: boolean;          // starter content shipped with the app
};
export type Post = { [K in PostKind]: Base & { kind: K; data: DataOf[K] } }[PostKind];
export type PostOf<K extends PostKind> = Extract<Post, { kind: K }>;

// ── Status ──────────────────────────────────────────────────────
export type Phase = 'draft' | 'scheduled' | 'live' | 'ended';

export const phaseOf = (p: Pick<Post, 'status' | 'startsAt' | 'endsAt'>, now = Date.now()): Phase => {
  if (p.status === 'draft') return 'draft';
  if (p.startsAt && Date.parse(p.startsAt) > now) return 'scheduled';
  if (p.endsAt && Date.parse(p.endsAt) <= now) return 'ended';
  return 'live';
};
export const isLive = (p: Post, now = Date.now()) => phaseOf(p, now) === 'live';

export const PHASES: Record<Phase, { label: string; tone: 'moss' | 'sky' | 'ink' | 'gold' }> = {
  live: { label: 'Live', tone: 'moss' },
  scheduled: { label: 'Scheduled', tone: 'sky' },
  draft: { label: 'Draft', tone: 'gold' },
  ended: { label: 'Ended', tone: 'ink' },
};

// ── Places ──────────────────────────────────────────────────────
export const PLACES: Record<Place, { label: string; sub: string; icon: IconName }> = {
  buzz: { label: 'The Buzz', sub: 'The big window on Home', icon: 'sparkle' },
  news: { label: 'Announcements', sub: 'The Announcements tab', icon: 'news' },
  banner: { label: 'Pop-up banner', sub: 'Full-screen when the app opens', icon: 'flash' },
  bell: { label: 'Notifications', sub: 'The bell list, and a phone alert if turned on', icon: 'bell' },
  cafeteria: { label: 'Cafeteria menu', sub: 'Specials and changes on the menu', icon: 'fork' },
  calendar: { label: 'Calendar', sub: 'Calendar and Day view', icon: 'calendar' },
};
export const PLACE_ORDER: Place[] = ['buzz', 'news', 'banner', 'cafeteria', 'calendar', 'bell'];

// ── Kinds ───────────────────────────────────────────────────────
export type KindInfo = { label: string; noun: string; icon: IconName; role: Role; places: Place[]; defaults: Place[] };

export const KINDS: Record<PostKind, KindInfo> = {
  trivia: { label: 'Trivia', noun: 'trivia question', icon: 'sparkle', role: 'trivia', places: ['buzz', 'bell'], defaults: ['buzz'] },
  fact: { label: 'Did you know', noun: 'fact', icon: 'book', role: 'facts', places: ['buzz'], defaults: ['buzz'] },
  poll: { label: 'Poll', noun: 'poll', icon: 'chart', role: 'polls', places: ['buzz', 'bell'], defaults: ['buzz'] },
  news: { label: 'News', noun: 'news post', icon: 'news', role: 'news', places: ['news', 'buzz', 'bell'], defaults: ['news'] },
  menu: { label: 'Menu', noun: 'menu change', icon: 'fork', role: 'menu', places: ['cafeteria', 'buzz'], defaults: ['cafeteria'] },
  popup: { label: 'Pop-up', noun: 'pop-up banner', icon: 'flash', role: 'popups', places: ['banner', 'bell'], defaults: ['banner'] },
  event: { label: 'Event', noun: 'event', icon: 'calendar', role: 'news', places: ['calendar', 'buzz', 'bell'], defaults: ['calendar'] },
};
export const KIND_ORDER: PostKind[] = ['trivia', 'fact', 'poll', 'news', 'menu', 'popup', 'event'];

// Top ranks, developers, the kind's job, or the Maintenance manager (src/ranks.ts).
// Facts have their own job since 0017; club events belong to News.
export const canEdit = (kind: PostKind, roles: Role[]) => can(roles, KINDS[kind].role);

// ── Display helpers ─────────────────────────────────────────────
export const imageOf = (p: Post): string | null => (p.data as Pic).image || null;

export const titleOf = (p: Post): string => {
  switch (p.kind) {
    case 'trivia': case 'poll': return p.data.prompt;
    case 'menu': return p.data.name;
    default: return p.data.title;
  }
};

export const subOf = (p: Post): string => {
  switch (p.kind) {
    case 'trivia': return p.data.options.join(' · ');
    case 'poll': return p.data.options.join(' · ');
    case 'fact': return p.data.body;
    case 'news': return `${p.data.category} · ${p.data.author}`;
    case 'menu': return [p.data.price != null ? `$${p.data.price.toFixed(2)}` : null, p.data.soldOut ? 'Sold out' : null, p.data.hidden ? 'Hidden' : null, p.data.featured ? 'Featured' : null, p.data.blurb].filter(Boolean).join(' · ');
    case 'popup': return p.data.body;
    case 'event': return [p.data.date, p.data.time, p.data.place].filter(Boolean).join(' · ');
  }
};

// Empty data for the editor.
export const blank = <K extends PostKind>(kind: K): DataOf[K] => {
  const out: { [P in PostKind]: DataOf[P] } = {
    trivia: { prompt: '', options: ['', '', '', ''], answer: 0 },
    fact: { eyebrow: 'Did you know', title: '', body: '' },
    poll: { prompt: '', options: ['', ''], showResults: true },
    news: { category: 'General', title: '', body: '', author: 'School App Club' },
    menu: { name: '', blurb: '', cats: ['plated'], price: null },
    popup: { template: 'announcement', title: '', body: '', push: true },
    event: { title: '', date: '', place: '' },
  };
  return out[kind] as DataOf[K];
};

// Problems that block publishing (drafts can be saved anyway).
export const problems = (p: Post): string[] => {
  const out: string[] = [];
  const need = (v: unknown, what: string) => { if (!String(v ?? '').trim()) out.push(`Add ${what}.`); };
  switch (p.kind) {
    case 'trivia': {
      need(p.data.prompt, 'a question');
      const opts = p.data.options.filter(o => o.trim());
      if (opts.length < 2) out.push('Add at least two answers.');
      if (!p.data.options[p.data.answer]?.trim()) out.push('Pick the right answer.');
      break;
    }
    case 'poll':
      need(p.data.prompt, 'a question');
      if (p.data.options.filter(o => o.trim()).length < 2) out.push('Add at least two choices.');
      break;
    case 'fact': need(p.data.title, 'a headline'); break;
    case 'news': need(p.data.title, 'a title'); need(p.data.body, 'the post text'); break;
    case 'menu': need(p.data.name, 'a name'); break;
    case 'popup': need(p.data.title, 'a title'); break;
    case 'event': need(p.data.title, 'a title'); if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data.date)) out.push('Set the date (YYYY-MM-DD).'); break;
  }
  if (!p.places.length) out.push('Pick at least one place to show it.');
  if (p.startsAt && p.endsAt && Date.parse(p.endsAt) <= Date.parse(p.startsAt)) out.push('The end has to be after the start.');
  return out;
};

// Trivia / poll options are saved without the blank rows.
export const tidy = (p: Post): Post => {
  if (p.kind === 'trivia') {
    const keep = p.data.options.map((o, i) => ({ o: o.trim(), i })).filter(x => x.o);
    const answer = Math.max(0, keep.findIndex(x => x.i === p.data.answer));
    return { ...p, data: { ...p.data, options: keep.map(x => x.o), answer } };
  }
  if (p.kind === 'poll') return { ...p, data: { ...p.data, options: p.data.options.map(o => o.trim()).filter(Boolean) } };
  return p;
};
