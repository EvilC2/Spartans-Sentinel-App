-- Spartans — team ranks, part 2 (2026-10-09). Run after 0012.
--
-- Ranks (same rules as src/ranks.ts):
--   owner     everything, every team, and who manages each team
--   manager   lead_badges / lead_maintenance / lead_feedback: every job in
--             their team, approving its work, adding and removing its members
--   member    only the jobs given to them inside their team
-- Teams and their jobs:
--   badges       badges
--   maintenance  trivia, polls, news, menu, popups, events, library
--   feedback     feedback
--
-- Also:
--   * Badge designs can edit an existing badge (`target_id`); approving one
--     updates that badge in badge_catalog.
--   * Feedback gets a status (new / doing / done) and a team note.

-- ── Which team a role belongs to ────────────────────────────────
create or replace function team_of(r app_role) returns text
language sql immutable as $$
  select case
    when r in ('badges', 'lead_badges') then 'badges'
    when r in ('trivia', 'polls', 'news', 'menu', 'popups', 'events', 'library', 'lead_maintenance') then 'maintenance'
    when r in ('feedback', 'lead_feedback') then 'feedback'
  end;
$$;

-- has_role(r): owner, the role itself, or the manager of r's team. Every
-- policy and function that already calls has_role() picks this up.
create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.user_id = auth.uid() and m.revoked_at is null
      and (m.role = 'owner' or m.role = r
           or (team_of(r) is not null and m.role::text = 'lead_' || team_of(r)))
  );
$$;

-- Posts: the Maintenance manager may write every kind.
create or replace function can_post(k post_kind, roles app_role[]) returns boolean
language sql immutable as $$
  select 'owner' = any(roles) or 'lead_maintenance' = any(roles) or post_role(k) = any(roles);
$$;

-- May the caller hand out (or take away) this role? Owners: anything.
-- Managers: the jobs in their own team, never manager or owner.
create or replace function can_assign(p_role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('owner')
    or (p_role::text not like 'lead\_%' and p_role <> 'owner' and team_of(p_role) is not null
        and exists (select 1 from members where user_id = auth.uid() and revoked_at is null
                    and role::text = 'lead_' || team_of(p_role)));
$$;

-- ── Team list: owners see everyone, managers see their own team ──
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
    and (has_role('owner')
      or exists (select 1 from members me where me.user_id = auth.uid() and me.revoked_at is null
                 and team_of(m.role) is not null and me.role::text = 'lead_' || team_of(m.role)))
  order by p.last_name, p.first_name, m.role;
$$;

create or replace function set_member_role(p_user uuid, p_role app_role, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_assign(p_role) then raise exception 'Only an owner or this team''s manager can change that'; end if;
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

-- Owners and managers: find a student to add.
create or replace function find_people(q text)
returns table (id uuid, first_name text, last_name text, email text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, email, grade from profiles
  where (has_role('owner') or exists (select 1 from members where user_id = auth.uid() and revoked_at is null and role::text like 'lead\_%'))
    and length(trim(q)) >= 2
    and (lower(first_name || ' ' || last_name) like '%' || lower(trim(q)) || '%'
      or lower(email) like lower(trim(q)) || '%'
      or student_id = trim(q))
  order by last_name, first_name
  limit 20;
$$;

-- Invite codes: whoever may assign the role may make a code for it.
create or replace function create_invite(p_role app_role, p_days int default 7) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not can_assign(p_role) then raise exception 'Only an owner or this team''s manager can invite to that'; end if;
  c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into invite_codes (code, role, created_by, expires_at)
    values (c, p_role, auth.uid(), now() + make_interval(days => p_days));
  return c;
end $$;

-- ── Badge designs: edits to existing badges, managers approve ───
alter table badge_designs add column if not exists target_id text references badge_catalog(id);

drop policy if exists badge_designs_delete on badge_designs;
create policy badge_designs_delete on badge_designs for delete
  using ((author = (select auth.uid()) and status <> 'approved') or (select has_role('lead_badges')));

create or replace function review_badge_design(p_id uuid, p_ok boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  d badge_designs;
  v_id text;
  v_base text;
  v_xp int;
  n int := 1;
begin
  if not has_role('lead_badges') then raise exception 'Only an owner or the Badges manager can approve'; end if;
  select * into d from badge_designs where id = p_id for update;
  if not found then raise exception 'No such design'; end if;
  if d.status <> 'pending' then raise exception 'This design is not waiting for approval'; end if;

  if not p_ok then
    if coalesce(trim(p_note), '') = '' then raise exception 'Say what to change'; end if;
    update badge_designs set status = 'rejected', review_note = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_id;
    return null;
  end if;

  v_xp := case d.rarity when 'common' then 10 when 'uncommon' then 25 when 'rare' then 50 when 'epic' then 100
    when 'legendary' then 200 when 'exotic' then 400 when 'special' then 75 when 'seasonal' then 40
    when 'secret' then 150 else 10 end;

  if d.target_id is not null then
    -- An edit: the badge keeps its id, so everyone who has it keeps it.
    v_id := d.target_id;
    update badge_catalog set title = d.title, rarity = d.rarity, xp = v_xp where id = v_id;
  else
    v_base := trim(both '-' from regexp_replace(lower(d.title), '[^a-z0-9]+', '-', 'g'));
    if v_base = '' then v_base := 'badge'; end if;
    v_id := v_base;
    while exists (select 1 from badge_catalog where id = v_id) loop
      n := n + 1;
      v_id := v_base || '-' || n;
    end loop;
    insert into badge_catalog (id, title, rarity, xp) values (v_id, d.title, d.rarity, v_xp);
  end if;

  update badge_designs set status = 'approved', badge_id = v_id, review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
  return v_id;
end $$;

-- ── Feedback: status + team note, the feedback team reads it ────
alter table feedback add column if not exists status text not null default 'new' check (status in ('new', 'doing', 'done'));
alter table feedback add column if not exists note text;
alter table feedback add column if not exists handled_by uuid references profiles(id) on delete set null;
alter table feedback add column if not exists updated_at timestamptz;

drop policy if exists feedback_read on feedback;
drop policy if exists feedback_delete on feedback;
create policy feedback_read on feedback for select
  using (user_id = (select auth.uid()) or (select has_role('feedback')));
create policy feedback_update on feedback for update
  using ((select has_role('feedback'))) with check ((select has_role('feedback')));
create policy feedback_delete on feedback for delete
  using ((select has_role('lead_feedback')));
