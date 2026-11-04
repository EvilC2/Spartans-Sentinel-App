-- Spartans — App Club Admin content (2026-10-05). Run after 0007.
--
-- One `posts` table for everything the App Club puts in front of students:
-- trivia, "did you know" facts, polls, news, cafeteria menu changes, pop-up
-- banners and club events. Each post says which places it shows in
-- (`places`) and when (`starts_at` / `ends_at`), so editing a post that is
-- already out changes it everywhere at once.
--
--   places: buzz       Home, The Buzz window
--           news       Announcements tab
--           banner     pop-up banner when the app opens
--           bell       the bell list (and a phone notification if data.push)
--           cafeteria  Cafeteria menu (specials, price changes, sold out)
--           calendar   Calendar and Day view
--
-- Who can write what: the role for the post's kind, or owner (post_role()).
-- Students read live posts only. Views and answers are counted on the server
-- (post_stats / post_tally); nobody can see who answered what.
--
-- Owners manage the team here too: team_list(), set_member_role() and
-- find_people(). The older buzz_items / announcements / popups / menu_items
-- tables stay; the app reads both while it moves over.

-- ── Posts ───────────────────────────────────────────────────────
create type post_kind as enum ('trivia', 'fact', 'poll', 'news', 'menu', 'popup', 'event');

create table posts (
  id          uuid primary key default gen_random_uuid(),
  kind        post_kind not null,
  data        jsonb not null default '{}'::jsonb,       -- shapes in src/content/model.ts
  places      text[] not null default '{}',
  status      content_status not null default 'draft',  -- draft | published ('queued' unused)
  starts_at   timestamptz,                              -- null = as soon as published
  ends_at     timestamptz,                              -- null = until taken down
  sort        int not null default 0,                   -- lower shows first in The Buzz
  pinned      boolean not null default false,           -- top of Announcements
  author      uuid default auth.uid() references profiles(id) on delete set null,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (places <@ array['buzz', 'news', 'banner', 'bell', 'cafeteria', 'calendar']::text[])
);
create index posts_window on posts (status, starts_at, ends_at);

create or replace function posts_touch() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end $$;
create trigger posts_touch before insert or update on posts for each row execute function posts_touch();

-- Which App Club role may write each kind (owner may write all).
create or replace function post_role(k post_kind) returns app_role
language sql immutable as $$
  select case k when 'trivia' then 'trivia'::app_role
                when 'fact'   then 'trivia'::app_role
                when 'poll'   then 'polls'::app_role
                when 'news'   then 'news'::app_role
                when 'menu'   then 'menu'::app_role
                when 'popup'  then 'popups'::app_role
                when 'event'  then 'events'::app_role end;
$$;

-- Live = published, started, not ended.
create or replace function post_live(s content_status, a timestamptz, b timestamptz) returns boolean
language sql stable as $$
  select s = 'published' and (a is null or a <= now()) and (b is null or b > now());
$$;

-- The caller's active roles, looked up once per query (wrap in `(select …)`).
create or replace function my_roles() returns app_role[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(role), '{}') from members where user_id = auth.uid() and revoked_at is null;
$$;

create or replace function can_post(k post_kind, roles app_role[]) returns boolean
language sql immutable as $$
  select 'owner' = any(roles) or post_role(k) = any(roles);
$$;

alter table posts enable row level security;
create policy posts_read   on posts for select using (post_live(status, starts_at, ends_at) or can_post(kind, (select my_roles())));
create policy posts_insert on posts for insert with check (can_post(kind, (select my_roles())));
create policy posts_update on posts for update using (can_post(kind, (select my_roles()))) with check (can_post(kind, (select my_roles())));
create policy posts_delete on posts for delete using (can_post(kind, (select my_roles())));

-- ── Views ───────────────────────────────────────────────────────
-- One row per student per post: first/last seen, and how many times they
-- opened it (tapped a news card, expanded a banner…).
create table post_views (
  post_id   uuid not null references posts(id) on delete cascade,
  user_id   uuid not null default auth.uid() references profiles(id) on delete cascade,
  first_at  timestamptz not null default now(),
  last_at   timestamptz not null default now(),
  opens     int not null default 0,
  primary key (post_id, user_id)
);
create index post_views_user on post_views (user_id);
alter table post_views enable row level security;
create policy post_views_own on post_views for select using (user_id = (select auth.uid()));

-- The app batches what came on screen and calls this every few seconds.
create or replace function see_posts(p_posts uuid[], p_open boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(cardinality(p_posts), 0) = 0 or cardinality(p_posts) > 100 then return; end if;
  insert into post_views (post_id, user_id, opens)
    select p.id, auth.uid(), case when p_open then 1 else 0 end
    from posts p
    where p.id = any(p_posts) and post_live(p.status, p.starts_at, p.ends_at)
  on conflict (post_id, user_id) do update
    set last_at = now(), opens = post_views.opens + case when p_open then 1 else 0 end;
end $$;

-- ── Answers (trivia + polls) ────────────────────────────────────
create table post_answers (
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  choice      int  not null check (choice between 0 and 9),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_answers_user on post_answers (user_id);
alter table post_answers enable row level security;
create policy post_answers_own on post_answers for select using (user_id = (select auth.uid()));

-- Trivia: first answer sticks. Polls: a student can change their vote.
create or replace function answer_post(p_post uuid, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare p posts;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into p from posts where id = p_post;
  if not found or p.kind not in ('trivia', 'poll') or not post_live(p.status, p.starts_at, p.ends_at) then
    raise exception 'That question is closed';
  end if;
  if p_choice < 0 or p_choice >= jsonb_array_length(coalesce(p.data->'options', '[]'::jsonb)) then
    raise exception 'No such option';
  end if;
  if p.kind = 'trivia' then
    insert into post_answers (post_id, user_id, choice) values (p_post, auth.uid(), p_choice)
      on conflict (post_id, user_id) do nothing;
  else
    insert into post_answers (post_id, user_id, choice) values (p_post, auth.uid(), p_choice)
      on conflict (post_id, user_id) do update set choice = excluded.choice, created_at = now();
  end if;
end $$;

-- Counts per option for many posts in one call, plus the caller's pick.
create or replace function post_tally(p_posts uuid[])
returns table (post_id uuid, choice int, votes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  with r as (select my_roles() as roles)
  select a.post_id, a.choice, count(*), bool_or(a.user_id = auth.uid())
  from post_answers a
  join posts p on p.id = a.post_id, r
  where auth.uid() is not null
    and coalesce(cardinality(p_posts), 0) <= 200
    and a.post_id = any(p_posts)
    and (post_live(p.status, p.starts_at, p.ends_at) or can_post(p.kind, r.roles))
  group by a.post_id, a.choice;
$$;

-- Admin numbers: unique viewers, total opens, answers. Only for posts the
-- caller may edit.
create or replace function post_stats(p_posts uuid[])
returns table (post_id uuid, viewers bigint, opens bigint, answers bigint)
language sql stable security definer set search_path = public as $$
  with r as (select my_roles() as roles)
  select p.id,
         (select count(*) from post_views v where v.post_id = p.id),
         (select coalesce(sum(v.opens), 0) from post_views v where v.post_id = p.id),
         (select count(*) from post_answers a where a.post_id = p.id)
  from posts p, r
  where coalesce(cardinality(p_posts), 0) <= 200
    and p.id = any(p_posts)
    and can_post(p.kind, r.roles);
$$;

-- Closing a live pop-up banner that carries a badge (data.badge). Same rules
-- as claim_popup_badge in 0006: 12 hours of grace after it ends.
create or replace function claim_post_badge(p_post uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p posts; b text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into p from posts where id = p_post;
  if not found or p.kind <> 'popup' or p.status <> 'published' then return null; end if;
  b := nullif(p.data->>'badge', '');
  if b is null or not exists (select 1 from badge_catalog where id = b) then return null; end if;
  if p.starts_at is not null and now() < p.starts_at then return null; end if;
  if p.ends_at is not null and now() > p.ends_at + interval '12 hours' then return null; end if;
  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    values (auth.uid(), b, null, 'banner:' || coalesce(p.data->>'template', 'post'))
    on conflict (user_id, badge_id) do nothing;
  return b;
end $$;
revoke all on function claim_post_badge(uuid) from public;
grant execute on function claim_post_badge(uuid) to authenticated;

-- ── Team (owners) ───────────────────────────────────────────────
-- Everyone with an active role, one row per role.
create or replace function team_list()
returns table (user_id uuid, first_name text, last_name text, email text, grade int,
               role app_role, granted_at timestamptz, granted_by_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.first_name, p.last_name, p.email, p.grade, m.role, m.granted_at,
         nullif(trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '')
  from members m
  join profiles p on p.id = m.user_id
  left join profiles g on g.id = m.granted_by
  where m.revoked_at is null and has_role('owner')
  order by p.last_name, p.first_name, m.role;
$$;

-- Turn one role on or off for one person. Never removes the last owner.
create or replace function set_member_role(p_user uuid, p_role app_role, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role('owner') then raise exception 'Owner only'; end if;
  if p_on then
    if not exists (select 1 from members where user_id = p_user and role = p_role and revoked_at is null) then
      insert into members (user_id, role, granted_by) values (p_user, p_role, auth.uid());
    end if;
  else
    if p_role = 'owner' and not exists (
      select 1 from members where role = 'owner' and revoked_at is null and user_id <> p_user
    ) then
      raise exception 'Keep at least one owner';
    end if;
    update members set revoked_at = now()
      where user_id = p_user and role = p_role and revoked_at is null;
  end if;
end $$;

-- Owners: find a student to add by name, school email or student number.
create or replace function find_people(q text)
returns table (id uuid, first_name text, last_name text, email text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, email, grade from profiles
  where has_role('owner')
    and length(trim(q)) >= 2
    and (lower(first_name || ' ' || last_name) like '%' || lower(trim(q)) || '%'
      or lower(email) like lower(trim(q)) || '%'
      or student_id = trim(q))
  order by last_name, first_name
  limit 20;
$$;
