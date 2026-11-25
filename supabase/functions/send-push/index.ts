// Spartans — send-push Edge Function.
//
// Called by Supabase Database Webhooks (Dashboard → Database → Webhooks), one
// per table, all pointing here:
//   popups          INSERT, UPDATE   big-news banners (snow day…) → everyone not paused
//   announcements   INSERT, UPDATE   only rows with push = true   → topic "announcements"
//   friend_requests INSERT           → the receiver, topic "friends"
//   badge_awards    INSERT           awarded by App Club (not banner claims) → topic "badges"
//   program_posts   INSERT           a post inside a class, club or team (0021, 0026) → the
//                                    students in it who left Announcements alerts on
//   posts           INSERT, UPDATE   App Club Admin posts (migration 0008) with data.push and
//                                    the "bell" place, when they go live. Scheduled posts push
//                                    when published, so the admin screen only offers push for
//                                    posts that start right away.
//
// Sends through Expo's push service (it forwards to Apple / Google). Tokens
// Expo reports as dead are deleted. Needs the service role key, which Supabase
// provides to Edge Functions automatically. Deploy: see NOTIFICATIONS.md.

import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Payload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; record: any; old_record: any };
// `program`: a post inside one program (migration 0026). It goes to the
// students in that program (or that one block of it), not to a topic's whole list.
type Message = {
  title: string; body: string; topic: string; user?: string; action: unknown; channelId: string;
  program?: { key: string; slot: string | null; teacher: string | null; author: string | null };
};

const becameLive = (r: any, old: any) =>
  r?.status === 'published' && old?.status !== 'published';

const nameOf = async (id: string) => {
  const { data } = await db.from('profiles').select('first_name,last_name').eq('id', id).single();
  return data ? `${data.first_name} ${data.last_name}`.trim() : 'Someone';
};

const badgeTitle = async (id: string) => {
  const { data } = await db.from('badge_catalog').select('title').eq('id', id).single();
  return data?.title ?? 'a new badge';
};

// Webhook row → the message to send, or null for rows that shouldn't push.
const messageFor = async ({ type, table, record: r, old_record: old }: Payload): Promise<Message | null> => {
  switch (table) {
    case 'popups':
      if (!r.push || !becameLive(r, old)) return null;
      return { title: r.title, body: r.body || 'Open Spartans for details.', topic: 'popups',
        action: { kind: 'tab', tab: 'home' }, channelId: 'school' };
    case 'announcements':
      if (!r.push || !becameLive(r, old)) return null;
      return { title: r.title, body: r.body.slice(0, 180), topic: 'announcements',
        action: { kind: 'tab', tab: 'announcements' }, channelId: 'school' };
    case 'posts': {
      if (!r.data?.push || !(r.places ?? []).includes('bell') || !becameLive(r, old)) return null;
      if (r.starts_at && Date.parse(r.starts_at) > Date.now()) return null;
      const d = r.data;
      const title = d.title || d.prompt || d.name || 'Spartans';
      const body = (d.body || d.blurb || (r.kind === 'poll' ? 'New poll. Tap to vote.' : r.kind === 'trivia' ? 'New trivia. Tap to answer.' : 'Open Spartans for details.')).slice(0, 180);
      const topic = r.kind === 'popup' ? 'popups' : r.kind === 'news' ? 'announcements' : r.kind === 'event' ? 'events' : 'buzz';
      const tab = r.kind === 'news' ? 'announcements' : r.kind === 'event' ? 'calendar' : r.kind === 'menu' ? 'lunch' : 'home';
      return { title, body, topic, action: { kind: 'tab', tab }, channelId: 'school' };
    }
    case 'program_posts':
      if (type !== 'INSERT') return null;
      return {
        title: r.title,
        body: [r.author_name, (r.body || '').slice(0, 160)].filter(Boolean).join(': ') || 'Open Spartans to read it.',
        topic: 'announcements', action: { kind: 'tab', tab: 'announcements' }, channelId: 'school',
        program: { key: r.program_key, slot: r.slot ?? null, teacher: r.teacher_key ?? null, author: r.author ?? null },
      };
    case 'friend_requests':
      if (type !== 'INSERT' || r.status !== 'pending') return null;
      return { title: `${await nameOf(r.from_user)} wants to be friends`, body: 'Tap to answer.', topic: 'friends',
        user: r.to_user, action: { kind: 'tab', tab: 'social' }, channelId: 'school' };
    case 'badge_awards':
      if (type !== 'INSERT' || !r.awarded_by) return null;
      return { title: 'Badge unlocked', body: `You earned ${await badgeTitle(r.badge_id)}.`, topic: 'badges',
        user: r.user_id, action: { kind: 'badge', id: r.badge_id }, channelId: 'school' };
  }
  return null;
};

Deno.serve(async req => {
  const payload = (await req.json()) as Payload;
  const msg = await messageFor(payload);
  if (!msg) return new Response('skip');

  const { data: targets, error } = msg.program
    ? await db.rpc('push_targets_program', { p_key: msg.program.key, p_slot: msg.program.slot, p_teacher: msg.program.teacher, p_author: msg.program.author })
    : await db.rpc('push_targets', { p_topic: msg.topic, p_user: msg.user ?? null });
  if (error) return new Response(error.message, { status: 500 });
  const tokens = [...new Set((targets as { token: string }[]).map(t => t.token))];

  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk.map(to => ({
        to, title: msg.title, body: msg.body, sound: 'default', channelId: msg.channelId,
        data: { action: msg.action, id: `${payload.table}:${payload.record.id}` },
      }))),
    });
    const out = await res.json().catch(() => ({}));
    (out.data ?? []).forEach((t: any, j: number) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(chunk[j]);
    });
  }
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return new Response(`sent ${tokens.length}`);
});
