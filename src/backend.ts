// Spartans — the one place screens talk to the backend.
// Thin typed wrappers over supabase-js so screens never write queries. Every
// call either returns data or throws; callers keep rendering cached/local
// state on failure (client contract in SCOPE-v3: every screen works offline).
//
// Roles, publish rules and single-use invite codes are enforced by Postgres
// (RLS + security-definer functions), never here.

import { supabase } from './supabase';
import type { Course, ExtraCourse } from './ProfileContext';

export type Role = 'trivia' | 'polls' | 'news' | 'menu' | 'popups' | 'events' | 'badges' | 'library' | 'owner'
  | 'feedback' | 'lead_badges' | 'lead_maintenance' | 'lead_feedback'   // migration 0012: team managers + feedback team
  // migration 0016: five teams (src/ranks.ts)
  | 'facts' | 'lead_developer' | 'dev_innovator' | 'dev_seasonal' | 'dev_backend' | 'dev_apple' | 'dev_android'
  | 'badge_award' | 'badge_list' | 'badge_qr' | 'feedback_real'
  | 'president' | 'marketing' | 'hr' | 'stuco' | 'sponsor'
  | 'teacher';   // migration 0021: staff outside the club teams (Clubs & programs only)
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
  pinned_badges?: string[];   // migration 0009: up to four badge ids under your name
  avatar?: { tone: number; glyph?: string } | null;   // migration 0014: colour + emoji friends see
  catch_up_score?: number;              // migration 0019: 0-100, 100 once finished
  catch_up_answers?: Record<string, string | string[]>;
  catch_up_done_at?: string | null;
  kind?: 'student' | 'teacher';         // migration 0026: set by the server from the email address
  dept?: string | null;                 // migration 0026: a teacher's department
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
  starts_at: string; ends_at: string; status: ContentStatus; publish_at?: string | null;
  badge_id?: string | null;   // migration 0006: unlocked when the banner is closed
  push?: boolean;             // migration 0006: also send a phone notification
  from_post?: boolean;        // made from an App Club Admin post (0008), not the popups table
  image_url?: string | null;  // photo behind the banner (post data.image, 0010)
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
  signUp: async (email: string, password: string, meta: { first_name: string; last_name: string; grade: number; pronouns?: string; student_id?: string; dept?: string }) =>
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
  // Settings → Account & privacy (migration 0004). Server removes the account
  // and everything tied to it; the caller then wipes this device.
  deleteAccount: async () => {
    await rpc<void>('delete_my_account', {});
    await supabase.auth.signOut().catch(() => {});
  },
};

// ── Profile ──────────────────────────────────────────────────────
export const profile = {
  me: async (): Promise<RemoteProfile | null> => {
    const id = await auth.userId();
    if (!id) return null;
    return unwrap(await supabase.from('profiles').select('*').eq('id', id).single());
  },
  update: async (patch: Partial<Omit<RemoteProfile, 'id' | 'email' | 'friend_code' | 'xp_total' | 'kind'>>) => {
    const id = await auth.userId();
    if (!id) throw new Error('Not signed in');
    return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select().single());
  },
  // Profile photo friends see (bucket avatars, 0015). One file per student,
  // overwritten; the ?v= stamp makes phones fetch the new one.
  uploadPhoto: async (file: ArrayBuffer | Blob, contentType = 'image/jpeg') => {
    const id = await auth.userId();
    if (!id) throw new Error('Not signed in');
    const path = `${id}/photo.jpg`;
    unwrap(await supabase.storage.from('avatars').upload(path, file, { contentType, upsert: true }));
    return `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  },
  removePhoto: async () => {
    const id = await auth.userId();
    if (!id) return;
    await supabase.storage.from('avatars').remove([`${id}/photo.jpg`]);
  },
};

// ── Roles / App Club Admin ───────────────────────────────────────
export const admin = {
  myRoles: async (): Promise<Role[]> => {
    // Owners can read every members row (RLS), so filter to our own.
    const id = await auth.userId();
    if (!id) return [];
    const rows = unwrap(await supabase.from('members').select('role').eq('user_id', id).is('revoked_at', null));
    return (rows as { role: Role }[]).map(r => r.role);
  },
  redeemInvite: (code: string) => rpc<Role>('redeem_invite', { p_code: code }),
  // owner only
  createInvite: (role: Role, days = 7) => rpc<string>('create_invite', { p_role: role, p_days: days }),
  revokeRole: (userId: string, role: Role) => rpc<void>('revoke_role', { p_user: userId, p_role: role }),
};

// ── Team (owners, migration 0008) ────────────────────────────────
export type TeamRow = {
  user_id: string; first_name: string; last_name: string; email: string; grade: number;
  role: Role; granted_at: string; granted_by_name: string | null;
};
export type Person = { id: string; first_name: string; last_name: string; email: string; grade: number };

export const team = {
  list: () => rpc<TeamRow[]>('team_list', {}),
  // on = grant, off = revoke. The server refuses to remove the last owner.
  set: (userId: string, role: Role, on: boolean) => rpc<void>('set_member_role', { p_user: userId, p_role: role, p_on: on }),
  find: (q: string) => rpc<Person[]>('find_people', { q }),
};

// ── App Club Admin posts (migration 0008) ────────────────────────
// One table for trivia, facts, polls, news, menu changes, banners and club
// events. Shapes of `data` live in src/content/model.ts.
export type PostRow = {
  id: string; kind: string; data: Record<string, unknown>; places: string[];
  status: ContentStatus; starts_at: string | null; ends_at: string | null;
  sort: number; pinned: boolean; author: string | null; updated_by: string | null;
  created_at: string; updated_at: string;
};
export type PostWrite = Partial<Omit<PostRow, 'id' | 'author' | 'updated_by' | 'created_at' | 'updated_at'>>;
export type PostStat = { post_id: string; viewers: number; opens: number; answers: number };

export const posts = {
  // RLS returns live posts, plus every post of the caller's roles (drafts too)
  list: () => supabase.from('posts').select('*').order('sort').order('created_at', { ascending: false }).limit(300).then(unwrap) as Promise<PostRow[]>,
  create: (p: PostWrite & Pick<PostRow, 'kind'>) =>
    supabase.from('posts').insert(p).select().single().then(unwrap) as Promise<PostRow>,
  update: (id: string, p: PostWrite) =>
    supabase.from('posts').update(p).eq('id', id).select().single().then(unwrap) as Promise<PostRow>,
  remove: (id: string) => supabase.from('posts').delete().eq('id', id).then(unwrap),
  // students
  seen: (ids: string[], open = false) => rpc<void>('see_posts', { p_posts: ids, p_open: open }),
  answer: (id: string, choice: number) => rpc<void>('answer_post', { p_post: id, p_choice: choice }),
  tally: async (ids: string[]): Promise<Record<string, Tally<number>>> =>
    groupTally(await rpc<{ post_id: string; choice: number; votes: number; mine: boolean }[]>('post_tally', { p_posts: ids }),
      r => r.post_id, r => r.choice),
  // admins: only posts the caller may edit come back
  stats: async (ids: string[]): Promise<Record<string, PostStat>> => {
    const rows = await rpc<PostStat[]>('post_stats', { p_posts: ids });
    return Object.fromEntries(rows.map(r => [r.post_id, { ...r, viewers: Number(r.viewers), opens: Number(r.opens), answers: Number(r.answers) }]));
  },
  claimBadge: (id: string) => rpc<string | null>('claim_post_badge', { p_post: id }),
  // any App Club role: upload a photo for a post, get its public URL back (bucket post-images, 0010)
  uploadImage: async (path: string, file: ArrayBuffer, contentType = 'image/jpeg') => {
    unwrap(await supabase.storage.from('post-images').upload(path, file, { contentType, upsert: true }));
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
  },
};

// ── Poll / rating counts ─────────────────────────────────────────
// Server adds up votes (poll_tally / menu_tally); ids with no votes are absent.
export type Tally<K extends string | number> = { counts: Record<K, number>; total: number; mine: K | null };

const groupTally = <R extends { votes: number; mine: boolean }, K extends string | number>(
  rows: R[], idOf: (r: R) => string, keyOf: (r: R) => K,
): Record<string, Tally<K>> => {
  const out: Record<string, Tally<K>> = {};
  for (const r of rows) {
    const t = (out[idOf(r)] ??= { counts: {} as Record<K, number>, total: 0, mine: null });
    const n = Number(r.votes); // bigint arrives as number or string
    t.counts[keyOf(r)] = n;
    t.total += n;
    if (r.mine) t.mine = keyOf(r);
  }
  return out;
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
  // counts per option for many polls in one call, plus the caller's pick
  // (migration 0005; raw votes are own-row only)
  tally: async (pollIds: string[]): Promise<Record<string, Tally<number>>> =>
    groupTally(await rpc<{ poll_id: string; option: number; votes: number; mine: boolean }[]>('poll_tally', { p_polls: pollIds }),
      r => r.poll_id, r => r.option),
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
  create: (p: Pick<Popup, 'template_id' | 'title' | 'body' | 'starts_at' | 'ends_at'> & Partial<Pick<Popup, 'badge_id' | 'push' | 'status'>>) =>
    supabase.from('popups').insert(p).select().single().then(unwrap) as Promise<Popup>,
  setStatus: (id: string, status: ContentStatus) =>
    supabase.from('popups').update({ status }).eq('id', id).then(unwrap),
  // Closing a banner that carries a badge (migration 0006). The server checks
  // the popup is live and has that badge; returns the badge id or null.
  claimBadge: (popupId: string) => rpc<string | null>('claim_popup_badge', { p_popup: popupId }),
};

export const menu = {
  list: () => live<MenuItem>(supabase.from('menu_items').select('*')),
  create: (m: Pick<MenuItem, 'name' | 'price_cents' | 'tags' | 'photo_url' | 'served_on'>) =>
    supabase.from('menu_items').insert(m).select().single().then(unwrap) as Promise<MenuItem>,
  setStatus: (id: string, status: ContentStatus, publish_at: string | null = null) =>
    supabase.from('menu_items').update({ status, publish_at }).eq('id', id).then(unwrap),
  rate: (item_id: string, emoji: string) =>
    supabase.from('menu_ratings').upsert({ item_id, emoji }).then(unwrap),
  // counts per emoji for many items in one call, plus the caller's pick (0005)
  tally: async (itemIds: string[]): Promise<Record<string, Tally<string>>> =>
    groupTally(await rpc<{ item_id: string; emoji: string; votes: number; mine: boolean }[]>('menu_tally', { p_items: itemIds }),
      r => r.item_id, r => r.emoji),
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

// ── Catch Up (migration 0019) ────────────────────────────────────
// The server only keeps badges on its own Catch Up list.
export const catchUp = {
  finish: (answers: Record<string, string | string[]>, badgeIds: string[]) =>
    rpc<number>('finish_catch_up', { p_answers: answers, p_badges: badgeIds }),
  // Takes the badges back and asks again; returns the ids taken back.
  reset: () => rpc<string[]>('reset_catch_up', {}),
};

// ── Badge team: new badge designs (migration 0011) ───────────────
// Shapes of `how` and `art` live in src/badgeDesigns.ts.
export type BadgeDesignRow = {
  id: string; author: string | null; title: string; description: string; category: string;
  how: Record<string, unknown>; rarity: string; season: string | null; art: Record<string, unknown>;
  status: 'draft' | 'pending' | 'approved' | 'rejected'; review_note: string | null;
  badge_id: string | null; created_at: string; updated_at: string; submitted_at: string | null; reviewed_at: string | null;
  target_id?: string | null;   // migration 0013: an edit to this existing badge
};
export type BadgeDesignWrite = Partial<Pick<BadgeDesignRow, 'title' | 'description' | 'category' | 'how' | 'rarity' | 'season' | 'art' | 'status' | 'submitted_at' | 'target_id'>>;

export const badgeDesigns = {
  // badge team: every design; everyone else: approved ones only (RLS)
  list: () => supabase.from('badge_designs').select('*').order('updated_at', { ascending: false }).limit(300).then(unwrap) as Promise<BadgeDesignRow[]>,
  approved: () => supabase.from('badge_designs').select('*').eq('status', 'approved').then(unwrap) as Promise<BadgeDesignRow[]>,
  create: (d: BadgeDesignWrite) => supabase.from('badge_designs').insert(d).select().single().then(unwrap) as Promise<BadgeDesignRow>,
  update: (id: string, d: BadgeDesignWrite) =>
    supabase.from('badge_designs').update(d).eq('id', id).select().single().then(unwrap) as Promise<BadgeDesignRow>,
  remove: (id: string) => supabase.from('badge_designs').delete().eq('id', id).then(unwrap),
  // owner or Badges manager: approve → the catalogue id; send back → null
  review: (id: string, ok: boolean, note?: string) => rpc<string | null>('review_badge_design', { p_id: id, p_ok: ok, p_note: note ?? null }),
  // badges role: a PNG for a design, public URL back (bucket badge-art)
  uploadArt: async (path: string, file: ArrayBuffer) => {
    unwrap(await supabase.storage.from('badge-art').upload(path, file, { contentType: 'image/png' }));
    return supabase.storage.from('badge-art').getPublicUrl(path).data.publicUrl;
  },
};

// ── Social ───────────────────────────────────────────────────────
export type FoundStudent = { id: string; first_name: string; last_name: string; grade: number; avatar?: unknown; photo_url?: string | null };
export type FriendRequest = { id: string; from_user: string; to_user: string; status: 'pending' | 'accepted' | 'declined' | 'blocked'; created_at: string; responded_at: string | null };
// What a friend is allowed to see of you (migration 0009): no email, no
// student number, and only the timetable blocks you share.
export type FriendCard = {
  id: string; first_name: string; last_name: string; grade: number; xp_total: number;
  pinned_badges: string[] | null; since: string; row_id: string; shared: Course[] | null;
  avatar?: unknown;   // migration 0014; cleaned by avatarOf()
  photo_url?: string | null;   // migration 0015: profile photo friends see
};
export type HomeworkShare = {
  id: string; user_id: string; class_name: string; title: string; due: string; due_time: string | null; notes: string | null; updated_at: string;
};

export const social = {
  // friend code only (0009) — never a student number or an email
  find: async (code: string): Promise<FoundStudent | null> => {
    const rows = await rpc<FoundStudent[]>('find_student', { q: code });
    return rows[0] ?? null;
  },
  request: (to_user: string) => supabase.from('friend_requests').insert({ to_user }).then(unwrap),
  respond: (id: string, status: 'accepted' | 'declined' | 'blocked') =>
    supabase.from('friend_requests').update({ status, responded_at: new Date().toISOString() }).eq('id', id).then(unwrap),
  requests: () => supabase.from('friend_requests').select('*').then(unwrap) as Promise<FriendRequest[]>,
  // name + grade for the other side of each pending request (migration 0002)
  peers: () => rpc<FoundStudent[]>('request_peers', {}),
  // cancel an outgoing request, or drop an accepted row to unfriend
  remove: (id: string) => supabase.from('friend_requests').delete().eq('id', id).then(unwrap),
  // accepted friends, trimmed server-side to what a friend may see (0009)
  friends: () => rpc<FriendCard[]>('friend_cards', {}),
  // homework I wrote for timetable classes → visible to friends in that class
  syncHomework: (items: { id: string; class_name: string; title: string; due: string; due_time?: string; notes?: string }[]) =>
    rpc<void>('sync_homework', { p_items: items }),
  // friends' homework in classes I take (RLS does the filtering)
  friendHomework: () =>
    supabase.from('homework_shares').select('*').order('due').then(unwrap) as Promise<HomeworkShare[]>,
};

// ── Help & feedback (migration 0004) ─────────────────────────────
export type FeedbackKind = 'like' | 'fix' | 'idea' | 'confusing';
export type FeedbackStatus = 'new' | 'doing' | 'done';
// Who said it (migration 0017): a student, a teacher or an App Club member
// (with their role). `source` is 'app' for the Help & feedback form, 'real'
// when the Feedback team logs something heard in person (with `heard_at`:
// where, and `said_by`: a name if they gave one).
export type FeedbackFrom = 'student' | 'teacher' | 'club';
export type FeedbackRow = {
  id: string; user_id: string | null; area: string; kind: FeedbackKind; message: string;
  platform: string | null; app_version: string | null; created_at: string;
  status?: FeedbackStatus; note?: string | null; updated_at?: string | null;   // migration 0013
  from_type?: FeedbackFrom | null; from_role?: string | null; source?: 'app' | 'real' | null;
  heard_at?: string | null; said_by?: string | null; logged_by_name?: string | null;   // migration 0017
};

export const feedback = {
  send: (f: { area: string; kind: FeedbackKind; message: string; platform?: string; app_version?: string; from_type?: FeedbackFrom; from_role?: string | null }) =>
    supabase.from('feedback').insert(f).then(unwrap),
  // Feedback team (Real): log what someone said in person (migration 0017)
  log: (f: { area: string; kind: FeedbackKind; message: string; from_type: FeedbackFrom; from_role?: string | null; heard_at?: string | null; said_by?: string | null }) =>
    rpc<FeedbackRow>('log_feedback', { p: f }),
  // the feedback team gets everyone's; everyone else only their own (RLS, 0013)
  list: () => supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(500).then(unwrap) as Promise<FeedbackRow[]>,
  // feedback team: move it along, keep a team note
  update: async (id: string, patch: { status?: FeedbackStatus; note?: string | null }) =>
    unwrap(await supabase.from('feedback').update({ ...patch, updated_at: new Date().toISOString(), handled_by: await auth.userId() })
      .eq('id', id).select().single()) as FeedbackRow,
  // Feedback manager
  remove: (id: string) => supabase.from('feedback').delete().eq('id', id).then(unwrap),
};

// ── App Club boards (migration 0017) ─────────────────────────────
// One table for every team's lists: ideas, seasonal changes, release
// checklists, campaigns, HR check-ins, student council requests, decisions.
// Shapes and statuses live in src/admin/boards.ts.
export type ClubItemRow = {
  id: string; board: string; title: string; body: string | null; status: string;
  tag: string | null; due: string | null; who: string | null;
  created_by: string | null; created_by_name?: string | null; created_at: string; updated_at: string;
};
export type ClubItemWrite = Partial<Omit<ClubItemRow, 'created_by' | 'created_by_name' | 'created_at' | 'updated_at'>> & { board: string };

export const club = {
  list: (board: string) =>
    supabase.from('club_items').select('*').eq('board', board).order('updated_at', { ascending: false }).limit(300).then(unwrap) as Promise<ClubItemRow[]>,
  save: (row: ClubItemWrite) =>
    supabase.from('club_items').upsert({ ...row, updated_at: new Date().toISOString() }).select().single().then(unwrap) as Promise<ClubItemRow>,
  remove: (id: string) => supabase.from('club_items').delete().eq('id', id).then(unwrap),
};

// ── Badge grantors (migration 0017) ──────────────────────────────
export type GrantTarget = { id: string; first_name: string; last_name: string; email: string; grade: number; student_id: string | null };
export const grants = {
  // List-based: everyone with this program in their timetable or extras.
  roster: (program: string) => rpc<GrantTarget[]>('program_roster', { p_name: program }),
  // List-based: school emails or student numbers, one each.
  lookup: (keys: string[]) => rpc<GrantTarget[]>('find_many', { p_keys: keys }),
  // Award / list: give one badge to many at once; returns how many got it.
  give: (userIds: string[], badgeId: string, reason: string) =>
    rpc<number>('award_badge_many', { p_users: userIds, p_badge: badgeId, p_reason: reason }),
  // Students: scan a badge's QR code.
  claim: (code: string) => rpc<string | null>('claim_badge_code', { p_code: code }),
};

// ── Clubs and program announcements (migration 0021) ─────────────
// The school's real clubs, kept by staff (Owner, President, Teacher Sponsor,
// teacher). A program is its name lowercased and trimmed (`program_key`, the
// same as classKey() in src/programs.ts). Hooks and offline fallbacks live in
// src/clubs.ts.
export type ClubKind = 'club' | 'sport' | 'music' | 'extra' | 'outside';
export type ClubRow = {
  id: string; name: string; kind: ClubKind; blurb: string | null; meets: string | null; room: string | null;
  sponsor: string | null; active: boolean; created_by: string | null; created_at: string; updated_at: string;
  gc_code?: string | null;   // migration 0023: Google Classroom code to join
  is_new?: boolean;          // migration 0023: new this year
};
export type ClubWrite = Partial<Pick<ClubRow, 'name' | 'kind' | 'blurb' | 'meets' | 'room' | 'sponsor' | 'active' | 'gc_code' | 'is_new'>>;

export const clubs = {
  // students: active clubs; staff: every club (RLS)
  list: () => supabase.from('clubs').select('*').order('name').limit(500).then(unwrap) as Promise<ClubRow[]>,
  // staff
  add: (c: ClubWrite & Pick<ClubRow, 'name'>) =>
    supabase.from('clubs').insert(c).select().single().then(unwrap) as Promise<ClubRow>,
  update: (id: string, c: ClubWrite) =>
    supabase.from('clubs').update(c).eq('id', id).select().single().then(unwrap) as Promise<ClubRow>,
  remove: (id: string) => supabase.from('clubs').delete().eq('id', id).then(unwrap),
};

export type ProgramPostRow = {
  id: string; program_key: string; title: string; body: string; pinned: boolean;
  author: string | null; author_name: string | null; created_at: string; updated_at: string;
  slot?: string | null;          // migration 0026: one block of the class, or null for everyone in it
  teacher_key?: string | null;   // migration 0026: that block's teacher (last name, lowercased)
  from_teacher?: boolean;        // migration 0026: a teacher wrote it
};

export const programPosts = {
  // anyone signed in; pinned first, then newest
  list: (key: string) =>
    supabase.from('program_posts').select('*').eq('program_key', key)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50).then(unwrap) as Promise<ProgramPostRow[]>,
  // Several programs at once, for the Announcements tab's "My programs".
  listMany: (keys: string[]) =>
    supabase.from('program_posts').select('*').in('program_key', keys)
      .order('created_at', { ascending: false }).limit(300).then(unwrap) as Promise<ProgramPostRow[]>,
  // staff, or a manager of this program (can_post_program); the server stamps the author
  // `slot` (teachers only, 0026) sends it to one block; leave it out for the whole program
  add: (p: Pick<ProgramPostRow, 'program_key' | 'title' | 'body' | 'pinned'> & { slot?: string }) =>
    supabase.from('program_posts').insert(p).select().single().then(unwrap) as Promise<ProgramPostRow>,
  update: (id: string, p: Partial<Pick<ProgramPostRow, 'title' | 'body' | 'pinned'>>) =>
    supabase.from('program_posts').update(p).eq('id', id).select().single().then(unwrap) as Promise<ProgramPostRow>,
  // the author, or staff
  remove: (id: string) => supabase.from('program_posts').delete().eq('id', id).then(unwrap),
};

export type ManagerRow = {
  program_key: string; program_name: string; user_id: string; first_name: string; last_name: string;
  email: string; grade: number; created_at: string;
};

export const programManagers = {
  // staff: who runs what, with names (all programs, or one)
  list: (key?: string) => rpc<ManagerRow[]>('program_manager_list', key ? { p_key: key } : {}),
  add: (key: string, name: string, userId: string) =>
    supabase.from('program_managers').upsert({ program_key: key, program_name: name.trim(), user_id: userId }).then(unwrap),
  remove: (key: string, userId: string) =>
    supabase.from('program_managers').delete().eq('program_key', key).eq('user_id', userId).then(unwrap),
  // anyone: the program keys I run
  mine: () => rpc<string[]>('my_programs_to_manage', {}),
  // staff: people search for picking a manager
  find: (q: string) => rpc<Person[]>('find_people_staff', { q }),
};

// ── Teachers (migration 0026) ────────────────────────────────────
export type RosterRow = { slot: string; id: string; first_name: string; last_name: string; grade: number };
export type PendingTeacher = { id: string; first_name: string; last_name: string; email: string; dept: string | null; created_at: string };

export const teachers = {
  // a confirmed teacher: the students in each block they teach
  rosters: () => rpc<RosterRow[]>('my_class_rosters', {}),
  // top roles: teacher accounts nobody has confirmed yet
  pending: () => rpc<PendingTeacher[]>('pending_teachers', {}),
};

// ── Push ─────────────────────────────────────────────────────────
// One row per phone. `topics` / `paused` mirror the Notifications settings so
// the server only sends what the student asked for (migration 0006).
export const push = {
  register: (token: string, platform: string, topics: string[] = [], paused = false) =>
    supabase.from('push_tokens').upsert({ token, platform, topics, paused, updated_at: new Date().toISOString() }).then(unwrap),
  unregister: (token: string) => supabase.from('push_tokens').delete().eq('token', token).then(unwrap),
};
