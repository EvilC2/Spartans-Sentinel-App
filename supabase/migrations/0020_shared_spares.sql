-- Spartans — a spare you both have counts as a block together.
--   • friend_cards() now also returns a block where both timetables are spare,
--     cut down to slot + "Spare": nothing else about that row leaves Postgres.
--     This changes "Spares and everything else stay hidden" from 0009 for this
--     one case. A spare only one of you has stays hidden.
--   • FIT and Lunch never count, even if someone typed one into a block: the
--     whole school has them, so they say nothing.
-- Same return type as 0015, so nothing to drop. Run after 0019.

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
          lower(trim(coalesce(t->>'name', ''))) as their_name,
          lower(trim(coalesce(m->>'name', ''))) as my_name,
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
