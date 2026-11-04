-- Spartans — Social avatars.
--   • profiles.avatar: { tone, glyph } — a colour and an optional emoji the
--     student picks. Friends see this instead of a photo; the ID photo never
--     leaves the device. The app only draws tones and glyphs from its own
--     list (avatarOf in src/components/Avatar.tsx), so free text can't show.
--   • friend_cards() and request_peers() hand the avatar back with the name.

alter table profiles add column if not exists avatar jsonb;

alter table profiles drop constraint if exists profiles_avatar_shape;
alter table profiles add constraint profiles_avatar_shape check (
  avatar is null or (
    jsonb_typeof(avatar) = 'object'
    and jsonb_typeof(avatar->'tone') = 'number'
    and (avatar->'glyph' is null or (jsonb_typeof(avatar->'glyph') = 'string' and length(avatar->>'glyph') <= 8))
  )
);

-- Return type changes, so drop first.
drop function if exists friend_cards();
create function friend_cards()
returns table (
  id uuid, first_name text, last_name text, grade int, xp_total int,
  pinned_badges jsonb, since timestamptz, row_id uuid, shared jsonb, avatar jsonb
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
    ), '[]'::jsonb) as shared,
    p.avatar
  from fr join profiles p on p.id = fr.fid
  where auth.uid() is not null;
$$;
revoke all on function friend_cards() from public;
grant execute on function friend_cards() to authenticated;

drop function if exists request_peers();
create function request_peers()
returns table (id uuid, first_name text, last_name text, grade int, avatar jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.grade, p.avatar
  from friend_requests r
  join profiles p
    on p.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
  where auth.uid() is not null
    and r.status = 'pending'
    and (r.from_user = auth.uid() or r.to_user = auth.uid());
$$;
revoke all on function request_peers() from public;
grant execute on function request_peers() to authenticated;
