-- Spartans — Badge team: design new badges, send them to an owner for
-- approval (2026-10-08). Run after 0010.
--
-- A design walks through the wizard in App Club Admin → Badges:
--   1 idea (title, description)
--   2 how students get it (`how`: seasonal date / attendance places / QR code / granted)
--   3 rarity (seasonal designs are always 'seasonal')
--   4 art (`art`: the rarity template, an icon on the template, or a whole PNG)
--   5 sent for approval
-- Badge team members (role 'badges', owners too) write drafts and send them.
-- Only an owner approves, through review_badge_design(), which also adds the
-- badge to badge_catalog so it can be awarded and counts for XP. Approved
-- designs are readable by everyone: the app adds them to the Badges page.
-- Art files go in the existing badge-art bucket (0001: badges role writes).

create table badge_designs (
  id           uuid primary key default gen_random_uuid(),
  author       uuid default auth.uid() references profiles(id) on delete set null,
  title        text not null default '',
  description  text not null default '',
  category     text not null default 'events',
  how          jsonb not null default '{}'::jsonb,
  rarity       text not null default 'common',
  season       text check (season in ('fall', 'winter', 'spring', 'summer')),
  art          jsonb not null default '{"mode":"template"}'::jsonb,
  status       text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  review_note  text,
  reviewed_by  uuid references profiles(id) on delete set null,
  badge_id     text references badge_catalog(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at  timestamptz
);
create index badge_designs_status on badge_designs (status);
create trigger badge_designs_touch before update on badge_designs for each row execute function set_updated_at();

alter table badge_designs enable row level security;

-- Everyone sees approved designs (the Badges page needs their art); the badge
-- team sees every design so they can work on them together.
create policy badge_designs_read on badge_designs for select
  using (status = 'approved' or (select has_role('badges')));
-- Team members write their own drafts and send them. Nobody approves by
-- writing the row: approval only happens in review_badge_design().
create policy badge_designs_insert on badge_designs for insert
  with check ((select has_role('badges')) and author = (select auth.uid()) and status in ('draft', 'pending'));
create policy badge_designs_update on badge_designs for update
  using ((select has_role('badges')) and author = (select auth.uid()) and status in ('draft', 'pending', 'rejected'))
  with check (author = (select auth.uid()) and status in ('draft', 'pending'));
create policy badge_designs_delete on badge_designs for delete
  using ((author = (select auth.uid()) and status <> 'approved') or (select has_role('owner')));

-- Owner: approve (adds the badge to the catalogue, returns its id) or send
-- back with a note.
create or replace function review_badge_design(p_id uuid, p_ok boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  d badge_designs;
  v_id text;
  v_base text;
  n int := 1;
begin
  if not exists (select 1 from members where user_id = auth.uid() and revoked_at is null and role = 'owner') then
    raise exception 'Owner only';
  end if;
  select * into d from badge_designs where id = p_id for update;
  if not found then raise exception 'No such design'; end if;
  if d.status <> 'pending' then raise exception 'This design is not waiting for approval'; end if;

  if not p_ok then
    if coalesce(trim(p_note), '') = '' then raise exception 'Say what to change'; end if;
    update badge_designs set status = 'rejected', review_note = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_id;
    return null;
  end if;

  v_base := trim(both '-' from regexp_replace(lower(d.title), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'badge'; end if;
  v_id := v_base;
  while exists (select 1 from badge_catalog where id = v_id) loop
    n := n + 1;
    v_id := v_base || '-' || n;
  end loop;

  insert into badge_catalog (id, title, rarity, xp) values (v_id, d.title, d.rarity,
    case d.rarity when 'common' then 10 when 'uncommon' then 25 when 'rare' then 50 when 'epic' then 100
      when 'legendary' then 200 when 'exotic' then 400 when 'special' then 75 when 'seasonal' then 40
      when 'secret' then 150 else 10 end);
  update badge_designs set status = 'approved', badge_id = v_id, review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
  return v_id;
end $$;
