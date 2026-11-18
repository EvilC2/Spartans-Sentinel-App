-- Spartans — the school's real clubs, and announcements inside a program
-- (2026-11-18). Run after 0020. Then, once, supabase/seed/clubs.sql.
--
--   clubs            Sentinel's real clubs (and teams, bands, anything outside
--                    the timetable), kept by staff. "Add programs" lists them
--                    first, with a line about each, when it meets, the room
--                    and the teacher who runs it. Adding one still stores it
--                    in the student's extras by name (src/programs.ts toExtra),
--                    so nothing about programs changes.
--   program_managers who runs a program: a club president, a team captain.
--                    Staff pick them. A program is its name, lowercased and
--                    trimmed (`program_key`, the same as classKey() in
--                    src/programs.ts), so classes work too: "chemistry 11".
--   program_posts    announcements to one program. Everyone signed in reads
--                    them on the program's page (src/components/ProgramBody);
--                    staff and that program's managers post. Pinned first,
--                    then newest.
--
-- Staff = Owner, President, Teacher Sponsor, and the new `teacher` role. A
-- teacher isn't on an App Club team: has_role() never matches it (team_of()
-- is null, it isn't a top role), so it opens Clubs & programs and nothing
-- else. Top roles hand it out from App Club → Clubs & programs → Teachers
-- (set_member_role / create_invite already allow top roles any role).
--
-- Postgres can't use a new enum value in the same run that adds it, so every
-- check below compares role::text. This file runs in one go.

alter type app_role add value if not exists 'teacher';

-- ── Who counts as staff ─────────────────────────────────────────
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where user_id = auth.uid() and revoked_at is null
      and role::text in ('owner', 'president', 'sponsor', 'teacher')
  );
$$;

-- ── Clubs ───────────────────────────────────────────────────────
create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 80),
  kind        text not null default 'club' check (kind in ('club', 'sport', 'music', 'extra', 'outside')),
  blurb       text check (char_length(blurb) <= 400),      -- one or two lines, what it is
  meets       text check (char_length(meets) <= 120),      -- "Tuesdays at lunch"
  room        text check (char_length(room) <= 60),        -- "Room 214", "Library"
  sponsor     text check (char_length(sponsor) <= 120),    -- the teacher who runs it
  active      boolean not null default true,               -- false: hidden from students
  created_by  uuid default auth.uid() references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- One row per program name, however it's capitalised.
create unique index if not exists clubs_key on clubs (lower(trim(name)));
drop trigger if exists clubs_updated on clubs;
create trigger clubs_updated before update on clubs for each row execute function set_updated_at();

alter table clubs enable row level security;
drop policy if exists clubs_read on clubs;
drop policy if exists clubs_insert on clubs;
drop policy if exists clubs_update on clubs;
drop policy if exists clubs_delete on clubs;
create policy clubs_read   on clubs for select using ((select auth.uid()) is not null and (active or (select is_staff())));
create policy clubs_insert on clubs for insert with check ((select is_staff()));
create policy clubs_update on clubs for update using ((select is_staff())) with check ((select is_staff()));
create policy clubs_delete on clubs for delete using ((select is_staff()));

-- ── Program managers ────────────────────────────────────────────
create table if not exists program_managers (
  program_key   text not null check (program_key = lower(trim(program_key)) and char_length(program_key) between 2 and 120),
  program_name  text not null default '' check (char_length(program_name) <= 120),   -- as staff typed it, for lists
  user_id       uuid not null references profiles(id) on delete cascade,
  added_by      uuid default auth.uid() references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (program_key, user_id)
);
create index if not exists program_managers_user on program_managers (user_id);

alter table program_managers enable row level security;
drop policy if exists program_managers_read on program_managers;
drop policy if exists program_managers_write on program_managers;
-- Your own rows, or everything for staff. Names come from program_manager_list().
create policy program_managers_read on program_managers for select
  using (user_id = (select auth.uid()) or (select is_staff()));
create policy program_managers_write on program_managers for all
  using ((select is_staff())) with check ((select is_staff()));

-- May the caller post to this program? Staff anywhere; managers in theirs.
create or replace function can_post_program(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    is_staff()
    or exists (select 1 from program_managers where user_id = auth.uid() and program_key = lower(trim(k)))
  );
$$;

-- The programs the caller runs (staff run every program, so they're not listed).
create or replace function my_programs_to_manage() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(program_key order by program_key), '{}') from program_managers where user_id = auth.uid();
$$;

-- Staff: who runs what, with names. One program, or all of them.
create or replace function program_manager_list(p_key text default null)
returns table (program_key text, program_name text, user_id uuid, first_name text, last_name text,
               email text, grade int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.program_key, m.program_name, m.user_id, p.first_name, p.last_name, p.email, p.grade, m.created_at
  from program_managers m
  join profiles p on p.id = m.user_id
  where is_staff() and (p_key is null or m.program_key = lower(trim(p_key)))
  order by m.program_key, p.last_name, p.first_name
  limit 2000;
$$;

-- Staff: find someone to make a manager. Same shape as find_people().
create or replace function find_people_staff(q text)
returns table (id uuid, first_name text, last_name text, email text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, email, grade from profiles
  where is_staff()
    and length(trim(q)) >= 2
    and (lower(first_name || ' ' || last_name) like '%' || lower(trim(q)) || '%'
      or lower(email) like lower(trim(q)) || '%'
      or student_id = trim(q))
  order by last_name, first_name
  limit 20;
$$;

-- ── Program posts ───────────────────────────────────────────────
create table if not exists program_posts (
  id           uuid primary key default gen_random_uuid(),
  program_key  text not null check (program_key = lower(trim(program_key)) and char_length(program_key) between 2 and 120),
  title        text not null check (char_length(trim(title)) between 1 and 120),
  body         text not null default '' check (char_length(body) <= 4000),
  pinned       boolean not null default false,
  author       uuid default auth.uid() references profiles(id) on delete set null,
  author_name  text,                                          -- set by the server, kept if the account goes
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists program_posts_feed on program_posts (program_key, pinned desc, created_at desc);

-- The server stamps who wrote it; an edit can't move it or change the author.
create or replace function program_posts_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.program_key := lower(trim(new.program_key));
    new.author := auth.uid();
    new.created_at := now();
    select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
      into new.author_name from profiles where id = auth.uid();
  else
    new.program_key := old.program_key;
    new.author := old.author;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists program_posts_stamp on program_posts;
create trigger program_posts_stamp before insert or update on program_posts for each row execute function program_posts_stamp();

alter table program_posts enable row level security;
drop policy if exists program_posts_read on program_posts;
drop policy if exists program_posts_insert on program_posts;
drop policy if exists program_posts_update on program_posts;
drop policy if exists program_posts_delete on program_posts;
create policy program_posts_read   on program_posts for select using ((select auth.uid()) is not null);
create policy program_posts_insert on program_posts for insert with check (can_post_program(program_key));
create policy program_posts_update on program_posts for update
  using ((author = (select auth.uid()) and can_post_program(program_key)) or (select is_staff()))
  with check (can_post_program(program_key));
create policy program_posts_delete on program_posts for delete
  using (author = (select auth.uid()) or (select is_staff()));

-- ── Feedback: the teacher role counts as a teacher ──────────────
-- Same as 0017, plus `teacher`: that role is never their "club" role.
create or replace function feedback_from() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role app_role; v_email text;
begin
  if new.source = 'real' then return new; end if;
  select role into v_role from members
    where user_id = new.user_id and revoked_at is null and role::text <> 'teacher'
    order by is_top_role(role) desc, (role::text like 'lead\_%') desc, role
    limit 1;
  select email into v_email from profiles where id = new.user_id;
  if exists (select 1 from members where user_id = new.user_id and role::text in ('sponsor', 'teacher') and revoked_at is null)
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

revoke all on function program_manager_list(text), find_people_staff(text), my_programs_to_manage() from public;
grant execute on function is_staff(), can_post_program(text), program_manager_list(text), find_people_staff(text),
  my_programs_to_manage() to authenticated;
