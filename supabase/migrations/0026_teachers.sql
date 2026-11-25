-- Spartans — teacher accounts, class lists and announcements to one class
-- (2026-11-24). Run after 0025. One file, one go.
--
--   Sign-up        @wvschools.ca addresses can now sign up. The server marks
--                  the account a teacher from the address alone (profiles.kind),
--                  never from anything the app sends, and the account can't
--                  change it afterwards.
--   Confirming     Email confirmation is off, so an address proves nothing by
--                  itself. A new teacher account can look around but can't post
--                  or see a class list until it holds the `teacher` role
--                  (0021). That comes from a teacher invite code, or from a top
--                  role (Owner, President, Teacher Sponsor) confirming them in
--                  App Club → Clubs & programs → Teachers, which now lists the
--                  accounts that are waiting (pending_teachers()).
--   Class lists    my_class_rosters(): for each block a confirmed teacher
--                  teaches, the students who put that class, in that block,
--                  with that teacher (or no teacher) in their timetable. Name
--                  and grade only.
--   Announcements  program_posts.slot: a post from a teacher can go to one
--                  block of a class instead of every section of it. The app
--                  shows it to the students in that block with that teacher
--                  (src/clubs.ts seesPost). `from_teacher` marks a post a
--                  teacher wrote, so it can say so.
--   Guard rails    Teachers and students can't be friends, teachers don't get
--                  the default App Club friends, and a teacher's grade is 0.
--
--   Phone alerts   push_targets_program(): the phones to tell about a program
--                  post (send-push, NOTIFICATIONS.md). Needs a Database Webhook
--                  on program_posts (INSERT) and the function redeployed.
--
-- Posts stay readable by anyone signed in, as before: which block a post is
-- for is a filter in the app, not a secret.

-- ── Profiles: student or teacher ────────────────────────────────
alter table profiles add column if not exists kind text not null default 'student';
alter table profiles drop constraint if exists profiles_kind_check;
alter table profiles add constraint profiles_kind_check check (kind in ('student', 'teacher'));
alter table profiles add column if not exists dept text;
alter table profiles drop constraint if exists profiles_dept_check;
alter table profiles add constraint profiles_dept_check check (dept is null or char_length(dept) <= 80);

-- Students are in grade 8 to 12; a teacher has no grade (0).
alter table profiles drop constraint if exists profiles_grade_check;
alter table profiles add constraint profiles_grade_check check (
  (kind = 'student' and grade between 8 and 12) or (kind = 'teacher' and grade = 0)
);

-- Sign-up: school addresses only. The address decides the kind.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_teacher boolean := new.email ~* '@wvschools\.ca$';
begin
  if not v_teacher and new.email !~* '@edu\.sd45\.bc\.ca$' then
    raise exception 'Use your school email (@edu.sd45.bc.ca for students, @wvschools.ca for teachers)';
  end if;
  insert into profiles (id, email, first_name, last_name, grade, pronouns, student_id, kind, dept)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    case when v_teacher then 0 else coalesce((new.raw_user_meta_data->>'grade')::int, 8) end,
    new.raw_user_meta_data->>'pronouns',
    case when v_teacher then null else new.raw_user_meta_data->>'student_id' end,
    case when v_teacher then 'teacher' else 'student' end,
    case when v_teacher then left(nullif(trim(new.raw_user_meta_data->>'dept'), ''), 80) end
  );
  return new;
end $$;

-- An account can't turn itself into a teacher (or back), or change its address.
create or replace function profiles_keep_kind() returns trigger
language plpgsql as $$
begin
  new.kind := old.kind;
  new.email := old.email;
  if old.kind = 'teacher' then new.grade := 0; new.student_id := null; end if;
  return new;
end $$;
drop trigger if exists profiles_keep_kind on profiles;
create trigger profiles_keep_kind before update on profiles
  for each row execute function profiles_keep_kind();

-- ── Friends are for students ────────────────────────────────────
create or replace function profiles_add_default_friends() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'student' then perform add_default_friends(new.id); end if;
  return new;
end $$;

create or replace function friend_requests_students_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id in (new.from_user, new.to_user) and kind = 'teacher') then
    raise exception 'Teachers and students can''t be friends on Spartans.';
  end if;
  return new;
end $$;
drop trigger if exists friend_requests_students_only on friend_requests;
create trigger friend_requests_students_only before insert on friend_requests
  for each row execute function friend_requests_students_only();

-- ── Teachers waiting to be confirmed (top roles) ────────────────
create or replace function pending_teachers()
returns table (id uuid, first_name text, last_name text, email text, dept text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.email, p.dept, p.created_at
  from profiles p
  where has_role('owner')
    and p.kind = 'teacher'
    and not exists (
      select 1 from members m
      where m.user_id = p.id and m.revoked_at is null
        and m.role::text in ('owner', 'president', 'sponsor', 'teacher')
    )
  order by p.created_at desc
  limit 200;
$$;

-- ── Class lists ─────────────────────────────────────────────────
-- For each block the caller teaches: the students with that class in that
-- block. A student who named a different teacher for it is left out; one who
-- named none is kept (better to list them than to miss them). Confirmed
-- teachers only, and only for their own timetable.
create or replace function my_class_rosters()
returns table (slot text, id uuid, first_name text, last_name text, grade int)
language sql stable security definer set search_path = public as $$
  with me as (
    select lower(trim(last_name)) as last, timetable
    from profiles
    where id = auth.uid() and kind = 'teacher' and is_staff()
  ), mine as (
    select t->>'slot' as slot, lower(trim(t->>'name')) as k
    from me, jsonb_array_elements(me.timetable) t
    where coalesce(t->>'spare', 'false') <> 'true' and trim(coalesce(t->>'name', '')) <> ''
  )
  select mine.slot, p.id, p.first_name, p.last_name, p.grade
  from mine
  join profiles p on p.kind = 'student'
  cross join lateral jsonb_array_elements(p.timetable) s
  where s->>'slot' = mine.slot
    and lower(trim(coalesce(s->>'name', ''))) = mine.k
    and (trim(coalesce(s->>'teacher', '')) = ''
      or lower(trim(split_part(s->>'teacher', ',', 1))) = (select last from me))
  order by mine.slot, p.last_name, p.first_name
  limit 2000;
$$;

-- ── Announcements to one block ──────────────────────────────────
alter table program_posts add column if not exists slot text;
alter table program_posts drop constraint if exists program_posts_slot_check;
alter table program_posts add constraint program_posts_slot_check check (
  slot is null or slot in ('1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4')
);
alter table program_posts add column if not exists teacher_key text;   -- the teacher's last name, lowercased
alter table program_posts add column if not exists from_teacher boolean not null default false;

-- Same as 0021, plus: the server says whether a teacher wrote it, and only a
-- teacher's post may be for one block (anyone else's goes to the whole program).
create or replace function program_posts_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind text; v_last text;
begin
  if tg_op = 'INSERT' then
    new.program_key := lower(trim(new.program_key));
    new.author := auth.uid();
    new.created_at := now();
    select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), kind, lower(trim(last_name))
      into new.author_name, v_kind, v_last from profiles where id = auth.uid();
    new.from_teacher := coalesce(v_kind = 'teacher', false);
    if new.slot is not null and new.from_teacher and coalesce(v_last, '') <> '' then
      new.teacher_key := v_last;
    else
      new.slot := null;
      new.teacher_key := null;
    end if;
  else
    new.program_key := old.program_key;
    new.author := old.author;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
    new.slot := old.slot;
    new.teacher_key := old.teacher_key;
    new.from_teacher := old.from_teacher;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ── Phone alerts for program posts ──────────────────────────────
-- Students with the program who left Announcements alerts on. A post for one
-- block goes to that block's students only (same rule as my_class_rosters);
-- any other post goes to everyone with the program in their timetable or
-- extras. Never to its author. Service role only (the send-push function).
create or replace function push_targets_program(p_key text, p_slot text default null, p_teacher text default null, p_author uuid default null)
returns table (token text, user_id uuid)
language sql stable security definer set search_path = public as $$
  select t.token, t.user_id
  from push_tokens t
  join profiles p on p.id = t.user_id
  where not t.paused
    and 'announcements' = any (t.topics)
    and p.kind = 'student'
    and (p_author is null or p.id <> p_author)
    and (
      exists (
        select 1 from jsonb_array_elements(p.timetable) s
        where lower(trim(coalesce(s->>'name', ''))) = lower(trim(p_key))
          and coalesce(s->>'spare', 'false') <> 'true'
          and (p_slot is null
            or (s->>'slot' = p_slot
              and (coalesce(p_teacher, '') = ''
                or trim(coalesce(s->>'teacher', '')) = ''
                or lower(trim(split_part(s->>'teacher', ',', 1))) = p_teacher)))
      )
      or (p_slot is null and exists (
        select 1 from jsonb_array_elements(p.extras) x
        where lower(trim(coalesce(x->>'name', ''))) = lower(trim(p_key))
      ))
    );
$$;
revoke all on function push_targets_program(text, text, text, uuid) from public, anon, authenticated;

revoke all on function pending_teachers(), my_class_rosters() from public;
grant execute on function pending_teachers(), my_class_rosters() to authenticated;
