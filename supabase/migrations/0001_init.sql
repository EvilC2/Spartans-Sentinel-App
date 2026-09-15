-- Spartans backend — schema v1.
-- Implements "What the app needs from the backend" in SCOPE-v3.md.
-- Run once in the Supabase SQL editor (see BACKEND.md). Idempotent enough to
-- re-run after a `drop schema public cascade; create schema public;` reset.

create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────
create type app_role as enum ('trivia', 'polls', 'news', 'menu', 'popups', 'badges', 'library', 'owner');
create type content_status as enum ('draft', 'queued', 'published');
create type buzz_kind as enum ('trivia', 'fact', 'poll', 'news');
create type friend_status as enum ('pending', 'accepted', 'declined', 'blocked');

-- ── Profiles ────────────────────────────────────────────────────
-- One per auth user. Created by trigger on sign-up from the metadata the app
-- passes to supabase.auth.signUp(). Timetable is the 8-slot courses array the
-- app already keeps in ProfileContext; extras is ExtraCourse[].
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  first_name   text not null default '',
  last_name    text not null default '',
  grade        int  not null default 8 check (grade between 8 and 12),
  pronouns     text,
  student_id   text,
  photo_url    text,
  artona_url   text,
  timetable    jsonb not null default '[]'::jsonb,
  extras       jsonb not null default '[]'::jsonb,
  friend_code  text not null unique default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  xp_total     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- Only school-domain accounts. Comment out the `if` to allow test accounts.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email !~* '@edu\.sd45\.bc\.ca$' then
    raise exception 'Use your @edu.sd45.bc.ca school email';
  end if;
  insert into profiles (id, email, first_name, last_name, grade, pronouns, student_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce((new.raw_user_meta_data->>'grade')::int, 8),
    new.raw_user_meta_data->>'pronouns',
    new.raw_user_meta_data->>'student_id'
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── Roles / members / invite codes ──────────────────────────────
create table members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  role        app_role not null,
  granted_by  uuid references profiles(id),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index members_active_role on members (user_id, role) where revoked_at is null;

create table invite_codes (
  code        text primary key,
  role        app_role not null,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz
);

-- True if the calling user holds `r` (or owner) and it is not revoked.
create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where user_id = auth.uid() and revoked_at is null and role in (r, 'owner')
  );
$$;

-- Redeem an invite code: single use, must not be expired, binds the role to
-- the caller. Returns the role granted.
create or replace function redeem_invite(p_code text) returns app_role
language plpgsql security definer set search_path = public as $$
declare v invite_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v from invite_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Unknown code'; end if;
  if v.redeemed_at is not null then raise exception 'Code already used'; end if;
  if v.expires_at < now() then raise exception 'Code expired'; end if;
  update invite_codes set redeemed_by = auth.uid(), redeemed_at = now() where code = v.code;
  insert into members (user_id, role, granted_by) values (auth.uid(), v.role, v.created_by)
    on conflict do nothing;
  return v.role;
end $$;

-- Owner-only: mint a code. Returns it.
create or replace function create_invite(p_role app_role, p_days int default 7) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not has_role('owner') then raise exception 'Owner only'; end if;
  c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into invite_codes (code, role, created_by, expires_at)
    values (c, p_role, auth.uid(), now() + make_interval(days => p_days));
  return c;
end $$;

-- Owner-only: revoke a member's role (flag, not delete).
create or replace function revoke_role(p_user uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role('owner') then raise exception 'Owner only'; end if;
  update members set revoked_at = now()
    where user_id = p_user and role = p_role and revoked_at is null;
end $$;

-- ── Content ─────────────────────────────────────────────────────
-- Shared columns: status/publish_at/author/created_at. "Live" means published,
-- or queued with publish_at in the past — no cron needed.
create or replace function is_live(s content_status, at timestamptz) returns boolean
language sql stable as $$
  select s = 'published' or (s = 'queued' and at is not null and at <= now());
$$;

create table buzz_items (
  id          uuid primary key default gen_random_uuid(),
  kind        buzz_kind not null,
  payload     jsonb not null default '{}'::jsonb,   -- see BACKEND.md for shapes
  status      content_status not null default 'draft',
  publish_at  timestamptz,
  author      uuid not null default auth.uid() references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger buzz_updated before update on buzz_items for each row execute function set_updated_at();
create index buzz_live on buzz_items (publish_at desc) where status <> 'draft';

-- Which role owns which buzz kind.
create or replace function buzz_role(k buzz_kind) returns app_role
language sql immutable as $$
  select case k when 'trivia' then 'trivia'::app_role
                when 'fact'   then 'trivia'::app_role
                when 'poll'   then 'polls'::app_role
                when 'news'   then 'news'::app_role end;
$$;

create table poll_votes (
  poll_id     uuid not null references buzz_items(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  option      int not null,
  created_at  timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price_cents int,
  tags        text[] not null default '{}',
  photo_url   text,
  served_on   date,          -- a specific day, or null for the standing menu
  status      content_status not null default 'draft',
  publish_at  timestamptz,
  author      uuid not null default auth.uid() references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger menu_updated before update on menu_items for each row execute function set_updated_at();

create table menu_ratings (
  item_id     uuid not null references menu_items(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  emoji       text not null check (char_length(emoji) <= 8),
  created_at  timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  category    text not null default 'general',
  pinned      boolean not null default false,
  status      content_status not null default 'draft',
  publish_at  timestamptz,
  author      uuid not null default auth.uid() references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger ann_updated before update on announcements for each row execute function set_updated_at();

create table popups (
  id          uuid primary key default gen_random_uuid(),
  template_id text not null,           -- 'snow-day', 'early-dismissal', …
  title       text not null,
  body        text not null default '',
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  status      content_status not null default 'draft',
  publish_at  timestamptz,
  author      uuid not null default auth.uid() references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger popups_updated before update on popups for each row execute function set_updated_at();

-- Single row, admin-editable tile.
create table library_status (
  id          int primary key default 1 check (id = 1),
  hours       text not null default '',
  notes       text not null default '',
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);
insert into library_status (id) values (1);
create trigger lib_updated before update on library_status for each row execute function set_updated_at();

-- ── Badges / XP ─────────────────────────────────────────────────
-- Catalogue mirrors src/badges.ts (seeded from seed/badges.sql). XP per badge
-- is fixed here so the ledger is server-authoritative.
create table badge_catalog (
  id      text primary key,
  title   text not null,
  rarity  text not null,
  xp      int  not null
);

create table badge_awards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  badge_id    text not null references badge_catalog(id),
  awarded_by  uuid references profiles(id),
  reason      text not null default '',
  awarded_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  unique (user_id, badge_id)
);

-- Keep profiles.xp_total in sync with live awards.
create or replace function recompute_xp(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update profiles set xp_total = coalesce((
    select sum(c.xp) from badge_awards a join badge_catalog c on c.id = a.badge_id
    where a.user_id = p_user and a.revoked_at is null), 0)
  where id = p_user;
$$;
create or replace function badge_awards_changed() returns trigger language plpgsql as $$
begin
  perform recompute_xp(coalesce(new.user_id, old.user_id));
  return null;
end $$;
create trigger badge_awards_xp after insert or update or delete on badge_awards
  for each row execute function badge_awards_changed();

-- Badges role: award with a reason (audit row = the award itself).
create or replace function award_badge(p_user uuid, p_badge text, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not has_role('badges') then raise exception 'Badges role only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;
  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    values (p_user, p_badge, auth.uid(), p_reason)
    on conflict (user_id, badge_id) do update set revoked_at = null, awarded_by = auth.uid(), reason = p_reason, awarded_at = now()
    returning id into v;
  return v;
end $$;

-- ── Social ──────────────────────────────────────────────────────
create table friend_requests (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null default auth.uid() references profiles(id) on delete cascade,
  to_user     uuid not null references profiles(id) on delete cascade,
  status      friend_status not null default 'pending',
  created_at  timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user),
  unique (from_user, to_user)
);

create or replace function are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friend_requests
    where status = 'accepted'
      and ((from_user = a and to_user = b) or (from_user = b and to_user = a))
  );
$$;

-- Look someone up by school email or friend code without exposing the whole
-- profiles table. Returns just enough to send a request.
create or replace function find_student(q text)
returns table (id uuid, first_name text, last_name text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, grade from profiles
  where auth.uid() is not null
    and (lower(email) = lower(trim(q))
      or lower(email) = lower(trim(q)) || '@edu.sd45.bc.ca'
      or friend_code = upper(trim(q)))
    and id <> auth.uid()
  limit 1;
$$;

-- ── Push ────────────────────────────────────────────────────────
create table push_tokens (
  token       text primary key,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);

-- ── Storage buckets ─────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('menu-photos', 'menu-photos', true),
  ('badge-art',   'badge-art',   true),
  ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

-- ── Row-level security ──────────────────────────────────────────
alter table profiles        enable row level security;
alter table members         enable row level security;
alter table invite_codes    enable row level security;
alter table buzz_items      enable row level security;
alter table poll_votes      enable row level security;
alter table menu_items      enable row level security;
alter table menu_ratings    enable row level security;
alter table announcements   enable row level security;
alter table popups          enable row level security;
alter table library_status  enable row level security;
alter table badge_catalog   enable row level security;
alter table badge_awards    enable row level security;
alter table friend_requests enable row level security;
alter table push_tokens     enable row level security;

-- profiles: own row, friends' rows (schedule compare), owner sees all.
create policy profiles_read on profiles for select using (
  id = auth.uid() or are_friends(auth.uid(), id) or has_role('owner')
);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- members: see own roles; owner sees all. Writes only via functions.
create policy members_read on members for select using (user_id = auth.uid() or has_role('owner'));

-- invite_codes: owner only. Redeem via redeem_invite().
create policy invites_owner on invite_codes for all using (has_role('owner')) with check (has_role('owner'));

-- Content: everyone signed in reads live rows; the owning role reads and
-- writes everything (drafts included).
create policy buzz_read on buzz_items for select using (
  is_live(status, publish_at) or has_role(buzz_role(kind))
);
create policy buzz_write on buzz_items for all using (has_role(buzz_role(kind))) with check (has_role(buzz_role(kind)));

create policy votes_read on poll_votes for select using (auth.uid() is not null);
create policy votes_insert on poll_votes for insert with check (user_id = auth.uid());
create policy votes_update on poll_votes for update using (user_id = auth.uid());

create policy menu_read on menu_items for select using (is_live(status, publish_at) or has_role('menu'));
create policy menu_write on menu_items for all using (has_role('menu')) with check (has_role('menu'));

create policy ratings_read on menu_ratings for select using (auth.uid() is not null);
create policy ratings_write on menu_ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ann_read on announcements for select using (is_live(status, publish_at) or has_role('news'));
create policy ann_write on announcements for all using (has_role('news')) with check (has_role('news'));

create policy popups_read on popups for select using (is_live(status, publish_at) or has_role('popups'));
create policy popups_write on popups for all using (has_role('popups')) with check (has_role('popups'));

create policy lib_read on library_status for select using (auth.uid() is not null);
create policy lib_write on library_status for update using (has_role('library')) with check (has_role('library'));

create policy catalog_read on badge_catalog for select using (true);

-- badge_awards: own, friends', badges role sees all. Writes via award_badge().
create policy awards_read on badge_awards for select using (
  user_id = auth.uid() or are_friends(auth.uid(), user_id) or has_role('badges')
);
create policy awards_revoke on badge_awards for update using (has_role('badges')) with check (has_role('badges'));

-- friend_requests: either side sees it; sender creates; receiver answers.
create policy fr_read on friend_requests for select using (from_user = auth.uid() or to_user = auth.uid());
create policy fr_insert on friend_requests for insert with check (from_user = auth.uid());
create policy fr_respond on friend_requests for update using (to_user = auth.uid() or from_user = auth.uid());
create policy fr_delete on friend_requests for delete using (from_user = auth.uid() or to_user = auth.uid());

create policy push_own on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: public buckets readable by all, role-gated writes.
create policy storage_public_read on storage.objects for select using (bucket_id in ('menu-photos', 'badge-art'));
create policy storage_menu_write on storage.objects for insert with check (bucket_id = 'menu-photos' and has_role('menu'));
create policy storage_menu_delete on storage.objects for delete using (bucket_id = 'menu-photos' and has_role('menu'));
create policy storage_badge_write on storage.objects for insert with check (bucket_id = 'badge-art' and has_role('badges'));
create policy storage_badge_delete on storage.objects for delete using (bucket_id = 'badge-art' and has_role('badges'));
-- profile-photos/<uid>/… : owner of the folder only.
create policy storage_profile_rw on storage.objects for all
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Bootstrap the first owner ───────────────────────────────────
-- After the first club member signs up in the app, run once in SQL editor:
--   insert into members (user_id, role) select id, 'owner' from profiles where email = 'you###@edu.sd45.bc.ca';
-- Every other role is then granted with create_invite('news') etc. from the app.
