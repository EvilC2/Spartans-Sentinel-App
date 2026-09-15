// Spartans — the one place screens talk to the backend.
// Thin typed wrappers over supabase-js so screens never write queries. Every
// call either returns data or throws; callers keep rendering cached/local
// state on failure (client contract in SCOPE-v3: every screen works offline).
//
// Roles, publish rules and single-use invite codes are enforced by Postgres
// (RLS + security-definer functions), never here.

import { supabase } from './supabase';
import type { Course, ExtraCourse } from './ProfileContext';

export type Role = 'trivia' | 'polls' | 'news' | 'menu' | 'popups' | 'badges' | 'library' | 'owner';
export type ContentStatus = 'draft' | 'queued' | 'published';
export type BuzzKind = 'trivia' | 'fact' | 'poll' | 'news';

export type RemoteProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  grade: number;
  pronouns: string | null;
  student_id: string | null;
  photo_url: string | null;
  artona_url: string | null;
  timetable: Course[];
  extras: ExtraCourse[];
  friend_code: string;
  xp_total: number;
};

export type BuzzItem = {
  id: string;
  kind: BuzzKind;
  payload: Record<string, unknown>;
  status: ContentStatus;
  publish_at: string | null;
  author: string;
  created_at: string;
};

export type Announcement = {
  id: string; title: string; body: string; category: string; pinned: boolean;
  status: ContentStatus; publish_at: string | null; created_at: string;
};

export type Popup = {
  id: string; template_id: string; title: string; body: string;
  starts_at: string; ends_at: string; status: ContentStatus;
};

export type MenuItem = {
  id: string; name: string; price_cents: number | null; tags: string[];
  photo_url: string | null; served_on: string | null; status: ContentStatus;
};

export type BadgeAward = {
  id: string; user_id: string; badge_id: string; awarded_by: string | null;
  reason: string; awarded_at: string; revoked_at: string | null;
};

const unwrap = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};
// supabase-js builders are PromiseLike; `await` turns them into real Promises.
const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => unwrap(await supabase.rpc(fn, args)) as T;

// ── Auth ─────────────────────────────────────────────────────────
export const auth = {
  signUp: async (email: string, password: string, meta: { first_name: string; last_name: string; grade: number; pronouns?: string; student_id?: string }) =>
    unwrap(await supabase.auth.signUp({ email, password, options: { data: meta } })),
  signIn: async (email: string, password: string) => {
    const r = await supabase.auth.signInWithPassword({ email, password });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
  updatePassword: async (password: string) => {
    const r = await supabase.auth.updateUser({ password });
    if (r.error) throw new Error(r.error.message);
  },
  signOut: () => supabase.auth.signOut(),
  session: () => supabase.auth.getSession().then(r => r.data.session),
  onChange: (cb: (signedIn: boolean) => void) =>
    supabase.auth.onAuthStateChange((_e, s) => cb(!!s)).data.subscription,
  userId: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
};

// ── Profile ──────────────────────────────────────────────────────
export const profile = {
  me: async (): Promise<RemoteProfile | null> => {
    const id = await auth.userId();
    if (!id) return null;
    return unwrap(await supabase.from('profiles').select('*').eq('id', id).single());
  },
  update: async (patch: Partial<Omit<RemoteProfile, 'id' | 'email' | 'friend_code' | 'xp_total'>>) => {
    const id = await auth.userId();
    if (!id) throw new Error('Not signed in');
    return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select().single());
  },
};

// ── Roles / App Club Admin ───────────────────────────────────────
export const admin = {
  myRoles: async (): Promise<Role[]> => {
    const rows = unwrap(await supabase.from('members').select('role').is('revoked_at', null));
    return (rows as { role: Role }[]).map(r => r.role);
  },
  redeemInvite: (code: string) => rpc<Role>('redeem_invite', { p_code: code }),
  // owner only
  createInvite: (role: Role, days = 7) => rpc<string>('create_invite', { p_role: role, p_days: days }),
  revokeRole: (userId: string, role: Role) => rpc<void>('revoke_role', { p_user: userId, p_role: role }),
};

// ── The Buzz ─────────────────────────────────────────────────────
const live = <T,>(q: any) => q.order('publish_at', { ascending: false, nullsFirst: false }).limit(50).then(unwrap) as Promise<T[]>;

export const buzz = {
  list: () => live<BuzzItem>(supabase.from('buzz_items').select('*')),
  // role-holders: create (defaults to draft), then publish or queue
  create: (kind: BuzzKind, payload: Record<string, unknown>) =>
    supabase.from('buzz_items').insert({ kind, payload }).select().single().then(unwrap) as Promise<BuzzItem>,
  setStatus: (id: string, status: ContentStatus, publish_at: string | null = null) =>
    supabase.from('buzz_items').update({ status, publish_at }).eq('id', id).select().single().then(unwrap),
  remove: (id: string) => supabase.from('buzz_items').delete().eq('id', id).then(unwrap),
  vote: (poll_id: string, option: number) =>
    supabase.from('poll_votes').upsert({ poll_id, option }).then(unwrap),
  votes: (poll_id: string) =>
    supabase.from('poll_votes').select('option').eq('poll_id', poll_id).then(unwrap) as Promise<{ option: number }[]>,
};

export const announcements = {
  list: () => live<Announcement>(supabase.from('announcements').select('*')),
  create: (a: Pick<Announcement, 'title' | 'body' | 'category' | 'pinned'>) =>
    supabase.from('announcements').insert(a).select().single().then(unwrap) as Promise<Announcement>,
  setStatus: (id: string, status: ContentStatus, publish_at: string | null = null) =>
    supabase.from('announcements').update({ status, publish_at }).eq('id', id).then(unwrap),
};

export const popups = {
  // only ones that should be on screen right now
  active: async (): Promise<Popup[]> => {
    const now = new Date().toISOString();
    return unwrap<Popup[]>(await supabase.from('popups').select('*').lte('starts_at', now).gte('ends_at', now));
  },
  create: (p: Pick<Popup, 'template_id' | 'title' | 'body' | 'starts_at' | 'ends_at'>) =>
    supabase.from('popups').insert(p).select().single().then(unwrap) as Promise<Popup>,
  setStatus: (id: string, status: ContentStatus) =>
    supabase.from('popups').update({ status }).eq('id', id).then(unwrap),
};

export const menu = {
  list: () => live<MenuItem>(supabase.from('menu_items').select('*')),
  create: (m: Pick<MenuItem, 'name' | 'price_cents' | 'tags' | 'photo_url' | 'served_on'>) =>
    supabase.from('menu_items').insert(m).select().single().then(unwrap) as Promise<MenuItem>,
  setStatus: (id: string, status: ContentStatus, publish_at: string | null = null) =>
    supabase.from('menu_items').update({ status, publish_at }).eq('id', id).then(unwrap),
  rate: (item_id: string, emoji: string) =>
    supabase.from('menu_ratings').upsert({ item_id, emoji }).then(unwrap),
  ratings: (item_id: string) =>
    supabase.from('menu_ratings').select('emoji').eq('item_id', item_id).then(unwrap) as Promise<{ emoji: string }[]>,
  // menu role: upload a photo, get its public URL back
  uploadPhoto: async (path: string, file: Blob | ArrayBuffer, contentType = 'image/jpeg') => {
    unwrap(await supabase.storage.from('menu-photos').upload(path, file, { contentType, upsert: true }));
    return supabase.storage.from('menu-photos').getPublicUrl(path).data.publicUrl;
  },
};

export const library = {
  get: () => supabase.from('library_status').select('*').eq('id', 1).single().then(unwrap) as Promise<{ hours: string; notes: string; updated_at: string }>,
  set: async (patch: { hours?: string; notes?: string }) =>
    supabase.from('library_status').update({ ...patch, updated_by: await auth.userId() }).eq('id', 1).then(unwrap),
};

// ── Badges / XP ──────────────────────────────────────────────────
export const badges = {
  mine: () => supabase.from('badge_awards').select('*').is('revoked_at', null).then(unwrap) as Promise<BadgeAward[]>,
  of: (userId: string) =>
    supabase.from('badge_awards').select('*').eq('user_id', userId).is('revoked_at', null).then(unwrap) as Promise<BadgeAward[]>,
  // badges role
  award: (userId: string, badgeId: string, reason: string) =>
    rpc<string>('award_badge', { p_user: userId, p_badge: badgeId, p_reason: reason }),
  revoke: (awardId: string) =>
    supabase.from('badge_awards').update({ revoked_at: new Date().toISOString() }).eq('id', awardId).then(unwrap),
};

// ── Social ───────────────────────────────────────────────────────
export type FoundStudent = { id: string; first_name: string; last_name: string; grade: number };
export type FriendRequest = { id: string; from_user: string; to_user: string; status: 'pending' | 'accepted' | 'declined' | 'blocked'; created_at: string };

export const social = {
  find: async (emailOrCode: string): Promise<FoundStudent | null> => {
    const rows = await rpc<FoundStudent[]>('find_student', { q: emailOrCode });
    return rows[0] ?? null;
  },
  request: (to_user: string) => supabase.from('friend_requests').insert({ to_user }).then(unwrap),
  respond: (id: string, status: 'accepted' | 'declined' | 'blocked') =>
    supabase.from('friend_requests').update({ status, responded_at: new Date().toISOString() }).eq('id', id).then(unwrap),
  requests: () => supabase.from('friend_requests').select('*').then(unwrap) as Promise<FriendRequest[]>,
  // accepted friends' profiles (RLS lets us read them); compare is client-side
  friends: async (): Promise<RemoteProfile[]> => {
    const me = await auth.userId();
    const reqs = (await social.requests()).filter(r => r.status === 'accepted');
    const ids = reqs.map(r => (r.from_user === me ? r.to_user : r.from_user));
    if (!ids.length) return [];
    return unwrap<RemoteProfile[]>(await supabase.from('profiles').select('*').in('id', ids));
  },
};

// ── Push ─────────────────────────────────────────────────────────
export const push = {
  register: (token: string, platform: string) =>
    supabase.from('push_tokens').upsert({ token, platform, updated_at: new Date().toISOString() }).then(unwrap),
};
