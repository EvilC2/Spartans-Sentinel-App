-- Spartans — notifications (2026-09-24).
--
-- 1. Event banners (popups) can carry a badge that unlocks when the student
--    closes the banner, and can also send a phone notification.
-- 2. Big announcements can opt in to a phone notification.
-- 3. Each phone's push token remembers which topics the student turned on
--    (Settings → Notifications) so the server only sends those.
-- 4. claim_popup_badge(): the server, not the phone, decides whether closing
--    a banner earns its badge.
--
-- Sending is done by the send-push Edge Function (supabase/functions/send-push),
-- called by Database Webhooks on popups, announcements, friend_requests and
-- badge_awards. See NOTIFICATIONS.md.

alter table popups
  add column if not exists badge_id text references badge_catalog(id),
  add column if not exists push     boolean not null default true;

alter table announcements
  add column if not exists push boolean not null default false;

alter table push_tokens
  add column if not exists topics text[]  not null default '{}',
  add column if not exists paused boolean not null default false;

-- Closing a live banner that has a badge. Idempotent: a second call (or a
-- badge the student already has) returns the id without a second award.
-- Grace of 12 hours after ends_at so a banner seen at 11:58 PM still counts.
create or replace function claim_popup_badge(p_popup uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p popups;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into p from popups where id = p_popup;
  if not found or p.badge_id is null then return null; end if;
  if not is_live(p.status, p.publish_at) then return null; end if;
  if now() < p.starts_at or now() > p.ends_at + interval '12 hours' then return null; end if;
  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    values (auth.uid(), p.badge_id, null, 'banner:' || p.template_id)
    on conflict (user_id, badge_id) do nothing;
  return p.badge_id;
end $$;

revoke all on function claim_popup_badge(uuid) from public;
grant execute on function claim_popup_badge(uuid) to authenticated;

-- Who should get a push for a topic: live tokens that have the topic on and
-- are not paused. `p_user` narrows it to one student (friend requests, badges).
-- 'popups' skips the topic check: snow days go to everyone not paused.
-- Service role only (the Edge Function); students never call it.
create or replace function push_targets(p_topic text, p_user uuid default null)
returns table (token text, user_id uuid)
language sql stable security definer set search_path = public as $$
  select t.token, t.user_id from push_tokens t
  where not t.paused
    and (p_topic = 'popups' or p_topic = any (t.topics))
    and (p_user is null or t.user_id = p_user)
$$;

revoke all on function push_targets(text, uuid) from public, anon, authenticated;
