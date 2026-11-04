-- Spartans — scale pass (1200 students).
--
-- 1. Poll and menu counts are added up on the server. Before this the app
--    downloaded every vote row and counted on the phone: one 1200-vote poll
--    seen by 1200 students = ~1.4 million rows sent. poll_tally() and
--    menu_tally() return one row per option instead, for many polls/items in
--    one call, plus which one the caller picked.
--    Raw vote/rating rows are now own-row only: nobody can see who voted what.
-- 2. Friends lookups use both sides of friend_requests, so to_user gets an
--    index. Tables that cascade on account deletion get a user_id index so
--    deleting one account doesn't scan every vote ever cast.
-- 3. Every row rule is rewritten so auth.uid() / has_role() run once per
--    query instead of once per row (Supabase's own RLS performance advice:
--    wrap them in `(select …)`). Friends-only reads use my_friend_ids()
--    (one lookup) instead of are_friends() (one lookup per row).
--    Who can read/write what is unchanged, except the raw votes above.

-- ── 1. Counts ───────────────────────────────────────────────────
-- Only counts polls/items the caller could see anyway (live, or their role's
-- drafts). At most 200 ids per call.
create or replace function poll_tally(p_polls uuid[])
returns table (poll_id uuid, option int, votes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select v.poll_id, v.option, count(*), bool_or(v.user_id = auth.uid())
  from poll_votes v
  join buzz_items b on b.id = v.poll_id
  where auth.uid() is not null
    and cardinality(p_polls) <= 200
    and v.poll_id = any(p_polls)
    and (is_live(b.status, b.publish_at) or has_role(buzz_role(b.kind)))
  group by v.poll_id, v.option;
$$;

create or replace function menu_tally(p_items uuid[])
returns table (item_id uuid, emoji text, votes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.item_id, r.emoji, count(*), bool_or(r.user_id = auth.uid())
  from menu_ratings r
  join menu_items m on m.id = r.item_id
  where auth.uid() is not null
    and cardinality(p_items) <= 200
    and r.item_id = any(p_items)
    and (is_live(m.status, m.publish_at) or has_role('menu'))
  group by r.item_id, r.emoji;
$$;

-- ── 2. Indexes ──────────────────────────────────────────────────
create index if not exists friend_requests_to_user on friend_requests (to_user);
create index if not exists poll_votes_user on poll_votes (user_id);
create index if not exists menu_ratings_user on menu_ratings (user_id);
create index if not exists push_tokens_user on push_tokens (user_id);
create index if not exists feedback_user on feedback (user_id);

-- ── 3. Row rules ────────────────────────────────────────────────
-- Everyone the caller is friends with, in one pass over friend_requests.
create or replace function my_friend_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select to_user from friend_requests where from_user = auth.uid() and status = 'accepted'
  union all
  select from_user from friend_requests where to_user = auth.uid() and status = 'accepted';
$$;

drop policy profiles_read on profiles;
create policy profiles_read on profiles for select using (
  id = (select auth.uid())
  or id in (select my_friend_ids())
  or (select has_role('owner'))
);
drop policy profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy members_read on members;
create policy members_read on members for select
  using (user_id = (select auth.uid()) or (select has_role('owner')));

drop policy invites_owner on invite_codes;
create policy invites_owner on invite_codes for all
  using ((select has_role('owner'))) with check ((select has_role('owner')));

-- buzz: spelled out per kind so each has_role() is checked once, not per row.
drop policy buzz_read on buzz_items;
create policy buzz_read on buzz_items for select using (
  is_live(status, publish_at)
  or (kind in ('trivia', 'fact') and (select has_role('trivia')))
  or (kind = 'poll' and (select has_role('polls')))
  or (kind = 'news' and (select has_role('news')))
);
drop policy buzz_write on buzz_items;
create policy buzz_write on buzz_items for all using (
  (kind in ('trivia', 'fact') and (select has_role('trivia')))
  or (kind = 'poll' and (select has_role('polls')))
  or (kind = 'news' and (select has_role('news')))
) with check (
  (kind in ('trivia', 'fact') and (select has_role('trivia')))
  or (kind = 'poll' and (select has_role('polls')))
  or (kind = 'news' and (select has_role('news')))
);

drop policy votes_read on poll_votes;
create policy votes_read on poll_votes for select using (user_id = (select auth.uid()));
drop policy votes_insert on poll_votes;
create policy votes_insert on poll_votes for insert with check (user_id = (select auth.uid()));
drop policy votes_update on poll_votes;
create policy votes_update on poll_votes for update using (user_id = (select auth.uid()));

drop policy menu_read on menu_items;
create policy menu_read on menu_items for select
  using (is_live(status, publish_at) or (select has_role('menu')));
drop policy menu_write on menu_items;
create policy menu_write on menu_items for all
  using ((select has_role('menu'))) with check ((select has_role('menu')));

drop policy ratings_read on menu_ratings;
create policy ratings_read on menu_ratings for select using (user_id = (select auth.uid()));
drop policy ratings_write on menu_ratings;
create policy ratings_write on menu_ratings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy ann_read on announcements;
create policy ann_read on announcements for select
  using (is_live(status, publish_at) or (select has_role('news')));
drop policy ann_write on announcements;
create policy ann_write on announcements for all
  using ((select has_role('news'))) with check ((select has_role('news')));

drop policy popups_read on popups;
create policy popups_read on popups for select
  using (is_live(status, publish_at) or (select has_role('popups')));
drop policy popups_write on popups;
create policy popups_write on popups for all
  using ((select has_role('popups'))) with check ((select has_role('popups')));

drop policy lib_read on library_status;
create policy lib_read on library_status for select using ((select auth.uid()) is not null);
drop policy lib_write on library_status;
create policy lib_write on library_status for update
  using ((select has_role('library'))) with check ((select has_role('library')));

drop policy awards_read on badge_awards;
create policy awards_read on badge_awards for select using (
  user_id = (select auth.uid())
  or user_id in (select my_friend_ids())
  or (select has_role('badges'))
);
drop policy awards_revoke on badge_awards;
create policy awards_revoke on badge_awards for update
  using ((select has_role('badges'))) with check ((select has_role('badges')));

drop policy fr_read on friend_requests;
create policy fr_read on friend_requests for select
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
drop policy fr_insert on friend_requests;
create policy fr_insert on friend_requests for insert with check (from_user = (select auth.uid()));
drop policy fr_respond on friend_requests;
create policy fr_respond on friend_requests for update
  using (to_user = (select auth.uid()) or from_user = (select auth.uid()));
drop policy fr_delete on friend_requests;
create policy fr_delete on friend_requests for delete
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));

drop policy push_own on push_tokens;
create policy push_own on push_tokens for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy feedback_insert on feedback;
create policy feedback_insert on feedback for insert with check (user_id = (select auth.uid()));
drop policy feedback_read on feedback;
create policy feedback_read on feedback for select
  using (user_id = (select auth.uid()) or (select has_role('owner')));
drop policy feedback_delete on feedback;
create policy feedback_delete on feedback for delete using ((select has_role('owner')));
