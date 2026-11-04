-- Spartans — five App Club teams, part 2 (2026-10-17). Run after 0016.
--
-- Ranks (same rules as src/ranks.ts):
--   top        owner, president, sponsor: everything, every team, who is on
--              each one
--   developer  any Developer role: every job in every team (full access),
--              but never the top powers (handing out roles, owner-only things)
--   manager    lead_developer / lead_maintenance / lead_badges / lead_feedback:
--              every job in their team, approvals, adding and removing members
--   member     only the jobs given to them
-- Executive has no manager; its roles are President, Marketing, HR, Student
-- Council Rep and Teacher Sponsor.
--
-- Also:
--   * Facts get their own job (fact posts need `facts`), club events belong
--     to News. Everyone with trivia gets facts, everyone with events gets news.
--   * Feedback says who it came from (student / teacher / club + role), set by
--     the server from the sender's account; the Real job logs in-person
--     feedback with log_feedback().
--   * club_items: every team's boards (ideas, seasonal, backend, iOS and
--     Android checklists, campaigns, HR check-ins, student council requests,
--     decisions).
--   * Badge grantors: award_badge_many(), program_roster(), find_many(), and
--     claim_badge_code() for students scanning a QR badge.

-- ── Which team a role belongs to ────────────────────────────────
create or replace function team_of(r app_role) returns text
language sql immutable as $$
  select case
    when r in ('lead_developer', 'dev_innovator', 'dev_seasonal', 'dev_backend', 'dev_apple', 'dev_android') then 'developer'
    when r in ('trivia', 'facts', 'polls', 'news', 'menu', 'popups', 'events', 'library', 'lead_maintenance') then 'maintenance'
    when r in ('badges', 'badge_award', 'badge_list', 'badge_qr', 'lead_badges') then 'badges'
    when r in ('feedback', 'feedback_real', 'lead_feedback') then 'feedback'
    when r in ('president', 'marketing', 'hr', 'stuco', 'sponsor') then 'executive'
  end;
$$;

create or replace function is_top_role(r app_role) returns boolean
language sql immutable as $$ select r in ('owner', 'president', 'sponsor'); $$;

-- has_role(r): a top role, a developer (for anything but the top roles), the
-- role itself, or the manager of r's team. Every policy and function that
-- calls has_role() picks this up, so has_role('owner') now means "has top
-- powers" (Owner, President or Teacher Sponsor).
create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.user_id = auth.uid() and m.revoked_at is null
      and (is_top_role(m.role)
           or (team_of(m.role) = 'developer' and not is_top_role(r))
           or m.role = r
           or (team_of(r) is not null and m.role::text = 'lead_' || team_of(r)))
  );
$$;

-- ── Posts: facts are their own job, events belong to News ───────
create or replace function post_role(k post_kind) returns app_role
language sql immutable as $$
  select case k when 'trivia' then 'trivia'::app_role
                when 'fact'   then 'facts'::app_role
                when 'poll'   then 'polls'::app_role
                when 'news'   then 'news'::app_role
                when 'menu'   then 'menu'::app_role
                when 'popup'  then 'popups'::app_role
                when 'event'  then 'news'::app_role end;
$$;

create or replace function can_post(k post_kind, roles app_role[]) returns boolean
language sql immutable as $$
  select exists (select 1 from unnest(roles) r where is_top_role(r) or team_of(r) = 'developer')
    or 'lead_maintenance' = any(roles) or post_role(k) = any(roles);
$$;

-- Nobody loses anything: trivia people keep facts, events people keep events.
insert into members (user_id, role, granted_by)
  select distinct m.user_id, 'facts'::app_role, m.granted_by from members m
  where m.role = 'trivia' and m.revoked_at is null
    and not exists (select 1 from members x where x.user_id = m.user_id and x.role = 'facts' and x.revoked_at is null);
insert into members (user_id, role, granted_by)
  select distinct m.user_id, 'news'::app_role, m.granted_by from members m
  where m.role = 'events' and m.revoked_at is null
    and not exists (select 1 from members x where x.user_id = m.user_id and x.role = 'news' and x.revoked_at is null);

-- ── Who may hand out a role ─────────────────────────────────────
-- Top roles: anything. Managers: the jobs in their own team, never managers
-- or top roles. Developers: nothing (full access is to the work, not people).
create or replace function can_assign(p_role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and revoked_at is null and is_top_role(role))
    or (p_role::text not like 'lead\_%' and not is_top_role(p_role) and team_of(p_role) is not null
        and exists (select 1 from members where user_id = auth.uid() and revoked_at is null
                    and role::text = 'lead_' || team_of(p_role)));
$$;

-- ── People list: top roles, developers and HR see everyone; managers their team
create or replace function team_list()
returns table (user_id uuid, first_name text, last_name text, email text, grade int,
               role app_role, granted_at timestamptz, granted_by_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.first_name, p.last_name, p.email, p.grade, m.role, m.granted_at,
         nullif(trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '')
  from members m
  join profiles p on p.id = m.user_id
  left join profiles g on g.id = m.granted_by
  where m.revoked_at is null
    and (has_role('owner') or has_role('hr')
      or exists (select 1 from members me where me.user_id = auth.uid() and me.revoked_at is null
                 and team_of(me.role) is not null and me.role::text = 'lead_' || team_of(m.role)))
  order by p.last_name, p.first_name, m.role;
$$;

-- Find a student: anyone who can assign roles, and the badge grantors.
create or replace function find_people(q text)
returns table (id uuid, first_name text, last_name text, email text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, email, grade from profiles
  where (has_role('owner') or has_role('badge_award') or has_role('badge_list')
         or exists (select 1 from members where user_id = auth.uid() and revoked_at is null and role::text like 'lead\_%'))
    and length(trim(q)) >= 2
    and (lower(first_name || ' ' || last_name) like '%' || lower(trim(q)) || '%'
      or lower(email) like lower(trim(q)) || '%'
      or student_id = trim(q))
  order by last_name, first_name
  limit 20;
$$;

-- ── Feedback: who it's from, and logging in-person feedback ─────
alter table feedback add column if not exists from_type text not null default 'student' check (from_type in ('student', 'teacher', 'club'));
alter table feedback add column if not exists from_role text;
alter table feedback add column if not exists source text not null default 'app' check (source in ('app', 'real'));
alter table feedback add column if not exists heard_at text check (char_length(heard_at) <= 120);
alter table feedback add column if not exists said_by text check (char_length(said_by) <= 120);
alter table feedback add column if not exists logged_by uuid references profiles(id) on delete set null;

-- App feedback: the server decides who it's from, so nobody can pose as a
-- teacher or the club. A teacher = the Teacher Sponsor or a wvschools.ca
-- account; club = any App Club role (the first one, in team order).
create or replace function feedback_from() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role app_role; v_email text;
begin
  if new.source = 'real' then return new; end if;
  select role into v_role from members
    where user_id = new.user_id and revoked_at is null
    order by is_top_role(role) desc, (role::text like 'lead\_%') desc, role
    limit 1;
  select email into v_email from profiles where id = new.user_id;
  if exists (select 1 from members where user_id = new.user_id and role = 'sponsor' and revoked_at is null)
     or v_email ilike '%@wvschools.ca' then
    new.from_type := 'teacher';
  elsif v_role is not null then
    new.from_type := 'club';
  else
    new.from_type := 'student';
  end if;
  new.from_role := v_role::text;
  return new;
end $$;
drop trigger if exists feedback_from on feedback;
create trigger feedback_from before insert on feedback for each row execute function feedback_from();

drop policy if exists feedback_read on feedback;
drop policy if exists feedback_update on feedback;
create policy feedback_read on feedback for select
  using (user_id = (select auth.uid()) or (select has_role('feedback')) or (select has_role('feedback_real')));
create policy feedback_update on feedback for update
  using ((select has_role('feedback')) or (select has_role('feedback_real')))
  with check ((select has_role('feedback')) or (select has_role('feedback_real')));

-- Real: log what someone said in person. Returns the new row (plus who logged it).
create or replace function log_feedback(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f feedback;
begin
  if not has_role('feedback_real') then raise exception 'Only the Feedback team can log feedback'; end if;
  if coalesce(p->>'from_type', '') not in ('student', 'teacher', 'club') then raise exception 'Say who it was from'; end if;
  insert into feedback (user_id, area, kind, message, source, from_type, from_role, heard_at, said_by, logged_by)
    values (null, coalesce(nullif(trim(p->>'area'), ''), 'Something else'), p->>'kind', coalesce(trim(p->>'message'), ''),
            'real', p->>'from_type', nullif(p->>'from_role', ''), nullif(trim(p->>'heard_at'), ''), nullif(trim(p->>'said_by'), ''), auth.uid())
    returning * into f;
  return to_jsonb(f) || jsonb_build_object('logged_by_name',
    (select nullif(trim(first_name || ' ' || last_name), '') from profiles where id = auth.uid()));
end $$;

-- ── Boards ──────────────────────────────────────────────────────
-- The role that owns each board (has_role() adds top roles, developers and
-- the team's manager).
create or replace function board_role(b text) returns app_role
language sql immutable as $$
  select case b when 'ideas'     then 'dev_innovator'::app_role
                when 'seasonal'  then 'dev_seasonal'::app_role
                when 'backend'   then 'dev_backend'::app_role
                when 'ios'       then 'dev_apple'::app_role
                when 'android'   then 'dev_android'::app_role
                when 'campaigns' then 'marketing'::app_role
                when 'checkins'  then 'hr'::app_role
                when 'stuco'     then 'stuco'::app_role
                when 'decisions' then 'president'::app_role end;
$$;

create table if not exists club_items (
  id              uuid primary key default gen_random_uuid(),
  board           text not null check (board in ('ideas', 'seasonal', 'backend', 'ios', 'android', 'campaigns', 'checkins', 'stuco', 'decisions')),
  title           text not null check (char_length(title) between 1 and 200),
  body            text check (char_length(body) <= 4000),
  status          text not null check (char_length(status) <= 30),
  tag             text check (char_length(tag) <= 40),
  due             date,
  who             text check (char_length(who) <= 120),
  created_by      uuid default auth.uid() references profiles(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists club_items_board on club_items (board, updated_at desc);
drop trigger if exists club_items_touch on club_items;
create trigger club_items_touch before update on club_items for each row execute function set_updated_at();

create or replace function club_items_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  new.created_by_name := (select nullif(trim(first_name || ' ' || last_name), '') from profiles where id = auth.uid());
  return new;
end $$;
drop trigger if exists club_items_author on club_items;
create trigger club_items_author before insert on club_items for each row execute function club_items_author();

alter table club_items enable row level security;
drop policy if exists club_items_read on club_items;
drop policy if exists club_items_write on club_items;
create policy club_items_read on club_items for select using ((select has_role(board_role(board))));
create policy club_items_write on club_items for all
  using ((select has_role(board_role(board)))) with check ((select has_role(board_role(board))));

-- ── Badge grantors ──────────────────────────────────────────────
-- The old award_badge(): any badge grantor (and the Creator, as before).
create or replace function award_badge(p_user uuid, p_badge text, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not (has_role('badges') or has_role('badge_award') or has_role('badge_list')) then raise exception 'Badge team only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;
  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    values (p_user, p_badge, auth.uid(), p_reason)
    on conflict (user_id, badge_id) do update set revoked_at = null, awarded_by = auth.uid(), reason = p_reason, awarded_at = now()
    returning id into v;
  return v;
end $$;

-- Many at once (Award- and List-based Grantors). Returns how many got it.
create or replace function award_badge_many(p_users uuid[], p_badge text, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (has_role('badge_award') or has_role('badge_list')) then raise exception 'Badge grantors only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;
  if not exists (select 1 from badge_catalog where id = p_badge) then raise exception 'No such badge'; end if;
  if coalesce(array_length(p_users, 1), 0) > 2000 then raise exception 'Too many at once'; end if;
  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    select distinct u, p_badge, auth.uid(), trim(p_reason) from unnest(p_users) u
    where exists (select 1 from profiles where id = u)
    on conflict (user_id, badge_id) do update set revoked_at = null, awarded_by = auth.uid(), reason = excluded.reason, awarded_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Everyone with this program in their timetable or their extras.
create or replace function program_roster(p_name text)
returns table (id uuid, first_name text, last_name text, email text, grade int, student_id text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.email, p.grade, p.student_id from profiles p
  where has_role('badge_list') and length(trim(p_name)) >= 2
    and (exists (select 1 from jsonb_array_elements(case jsonb_typeof(p.timetable) when 'array' then p.timetable else '[]'::jsonb end) e
                 where lower(trim(e->>'name')) = lower(trim(p_name)))
      or exists (select 1 from jsonb_array_elements(case jsonb_typeof(p.extras) when 'array' then p.extras else '[]'::jsonb end) e
                 where lower(trim(e->>'name')) = lower(trim(p_name))))
  order by p.last_name, p.first_name
  limit 2000;
$$;

-- A pasted sign-in list: school emails, the part before the @, or student numbers.
create or replace function find_many(p_keys text[])
returns table (id uuid, first_name text, last_name text, email text, grade int, student_id text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.email, p.grade, p.student_id from profiles p
  where has_role('badge_list') and coalesce(array_length(p_keys, 1), 0) <= 2000
    and exists (select 1 from unnest(p_keys) k
                where lower(p.email) = lower(trim(k)) or lower(p.email) like lower(trim(k)) || '@%' or p.student_id = trim(k))
  order by p.last_name, p.first_name;
$$;

-- Students: a scanned QR badge code. Returns the badge id, or null when the
-- code isn't an approved QR badge.
create or replace function claim_badge_code(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v_badge text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select badge_id into v_badge from badge_designs
    where status = 'approved' and badge_id is not null and how->>'kind' = 'qr'
      and upper(how->>'code') = upper(trim(p_code))
    limit 1;
  if v_badge is null then return null; end if;
  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    values (auth.uid(), v_badge, null, 'Scanned the QR code')
    on conflict (user_id, badge_id) do nothing;
  return v_badge;
end $$;

grant execute on function log_feedback(jsonb), award_badge_many(uuid[], text, text), program_roster(text),
  find_many(text[]), claim_badge_code(text) to authenticated;
