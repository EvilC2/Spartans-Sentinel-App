-- Spartans — Social, part 4 (district approval, Oct 2026).
--   • Friends add each other with the random 8-char friend_code only. No
--     student number, no email (find_student).
--   • Friends never read each other's full profile row. profiles_read is
--     self-only again; friend_cards() hands back name, grade, XP, pinned
--     badges, friends-since, and ONLY the timetable blocks the two of you
--     share (same slot, same course). Spares and everything else stay hidden.
--   • pinned_badges: up to three badge ids shown under your name.
--   • homework_shares: homework a student writes for a timetable class. A
--     friend in the same class can read it (and copy it in the app).

alter table profiles add column if not exists pinned_badges jsonb not null default '[]'::jsonb;

-- ── Find by friend code only ────────────────────────────────────
create or replace function find_student(q text)
returns table (id uuid, first_name text, last_name text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, grade from profiles
  where auth.uid() is not null
    and friend_code = upper(regexp_replace(trim(q), '[^A-Za-z0-9]', '', 'g'))
    and id <> auth.uid()
  limit 1;
$$;

-- ── Profiles: self only ─────────────────────────────────────────
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (id = (select auth.uid()));

-- ── Friend cards ────────────────────────────────────────────────
-- A class row counts as shared when both timetables have the same course
-- name in the same slot and it is not a spare.
create or replace function friend_cards()
returns table (
  id uuid, first_name text, last_name text, grade int, xp_total int,
  pinned_badges jsonb, since timestamptz, row_id uuid, shared jsonb
)
language sql stable security definer set search_path = public as $$
  with me as (
    select timetable from profiles where id = auth.uid()
  ), fr as (
    select r.id as row_id,
           case when r.from_user = auth.uid() then r.to_user else r.from_user end as fid,
           coalesce(r.responded_at, r.created_at) as since
    from friend_requests r
    where r.status = 'accepted' and (r.from_user = auth.uid() or r.to_user = auth.uid())
  )
  select p.id, p.first_name, p.last_name, p.grade, p.xp_total, p.pinned_badges, fr.since, fr.row_id,
    coalesce((
      select jsonb_agg(t)
      from jsonb_array_elements(p.timetable) t
      join jsonb_array_elements((select timetable from me)) m on m->>'slot' = t->>'slot'
      where coalesce(t->>'name', '') <> ''
        and lower(trim(t->>'name')) = lower(trim(m->>'name'))
        and lower(trim(t->>'name')) <> 'spare'
        and coalesce((t->>'spare')::boolean, false) = false
        and coalesce((m->>'spare')::boolean, false) = false
    ), '[]'::jsonb) as shared
  from fr join profiles p on p.id = fr.fid
  where auth.uid() is not null;
$$;
revoke all on function friend_cards() from public;
grant execute on function friend_cards() to authenticated;

-- ── Shared homework ─────────────────────────────────────────────
create table if not exists homework_shares (
  id          text not null,                 -- the app's local item id
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  class_name  text not null,
  title       text not null,
  due         date not null,
  due_time    text,
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);
alter table homework_shares enable row level security;

-- Caller takes the class too (by name, any slot) and is friends with the owner.
create or replace function in_my_classes(cls text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles me, jsonb_array_elements(me.timetable) t
    where me.id = auth.uid()
      and lower(trim(t->>'name')) = lower(trim(cls))
      and coalesce((t->>'spare')::boolean, false) = false
  );
$$;

create policy hw_own on homework_shares for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hw_friends_read on homework_shares for select
  using (are_friends((select auth.uid()), user_id) and in_my_classes(class_name));

-- Replace everything the caller shares in one call.
create or replace function sync_homework(p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from homework_shares where user_id = auth.uid();
  insert into homework_shares (id, user_id, class_name, title, due, due_time, notes)
  select x->>'id', auth.uid(), x->>'class_name', x->>'title', (x->>'due')::date, x->>'due_time', x->>'notes'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
  where coalesce(x->>'id', '') <> '' and coalesce(x->>'title', '') <> '' and coalesce(x->>'class_name', '') <> ''
    and (x->>'due') ~ '^\d{4}-\d{2}-\d{2}$';
end $$;
revoke all on function sync_homework(jsonb) from public;
grant execute on function sync_homework(jsonb) to authenticated;
