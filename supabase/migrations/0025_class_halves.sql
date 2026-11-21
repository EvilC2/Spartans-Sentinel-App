-- Spartans — the two halves of a course count as one class.
--   "Work Experience 12A" and "Work Experience 12B" (and Career Life
--   Connections 12A/12B) run in the same room at the same time, so in the same
--   block they are a class together. The letter right after the grade is
--   dropped before names are compared. Matches matchOf() in src/social.ts.
-- Same as 0020 otherwise; same return type, so nothing to drop.

create or replace function friend_cards()
returns table (
  id uuid, first_name text, last_name text, grade int, xp_total int,
  pinned_badges jsonb, since timestamptz, row_id uuid, shared jsonb, avatar jsonb, photo_url text
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
      select jsonb_agg(
        case when b.their_spare
          then jsonb_build_object('slot', t->>'slot', 'name', 'Spare', 'spare', true)
          else t
        end
      )
      from jsonb_array_elements(p.timetable) t
      join jsonb_array_elements((select timetable from me)) m on m->>'slot' = t->>'slot'
      cross join lateral (
        select
          regexp_replace(lower(trim(coalesce(t->>'name', ''))), '([0-9]{1,2})[ab]$', '\1') as their_name,
          regexp_replace(lower(trim(coalesce(m->>'name', ''))), '([0-9]{1,2})[ab]$', '\1') as my_name,
          coalesce((t->>'spare')::boolean, false) or lower(trim(coalesce(t->>'name', ''))) = 'spare' as their_spare,
          coalesce((m->>'spare')::boolean, false) or lower(trim(coalesce(m->>'name', ''))) = 'spare' as my_spare
      ) b
      where (b.their_spare and b.my_spare)
         or (not b.their_spare and not b.my_spare
             and b.their_name <> ''
             and b.their_name = b.my_name
             and b.their_name not in ('fit', 'lunch'))
    ), '[]'::jsonb) as shared,
    p.avatar, p.photo_url
  from fr join profiles p on p.id = fr.fid
  where auth.uid() is not null;
$$;
revoke all on function friend_cards() from public;
grant execute on function friend_cards() to authenticated;
