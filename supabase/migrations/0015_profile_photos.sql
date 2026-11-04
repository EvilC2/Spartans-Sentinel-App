-- Spartans — profile photos friends see (2026-10-15). Run after 0014.
--
-- Clive's call: your profile photo is shared with your friends and with
-- anyone who looks you up by friend code (so they know it's you before
-- sending a request). Replaces the "photo never leaves the phone" rule.
--   • Bucket `avatars`, public read, one file per student at <uid>/photo.jpg.
--     Students write only their own folder. 2 MB cap.
--   • profiles.photo_url (exists since 0001) holds the public URL.
--   • find_student(), friend_cards() and request_peers() hand it back.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  on conflict (id) do nothing;

drop policy if exists storage_avatars_read on storage.objects;
create policy storage_avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists storage_avatars_write on storage.objects;
create policy storage_avatars_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists storage_avatars_update on storage.objects;
create policy storage_avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists storage_avatars_delete on storage.objects;
create policy storage_avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Only our own bucket's URLs, so a crafted row can't point friends' phones elsewhere.
alter table profiles drop constraint if exists profiles_photo_url_shape;
alter table profiles add constraint profiles_photo_url_shape check (
  photo_url is null or photo_url ~ '^https://[^/]+/storage/v1/object/public/avatars/'
) not valid;   -- new writes only; old rows never held app data

-- ── Return types change, so drop first ──────────────────────────
drop function if exists find_student(text);
create function find_student(q text)
returns table (id uuid, first_name text, last_name text, grade int, avatar jsonb, photo_url text)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, grade, avatar, photo_url from profiles
  where auth.uid() is not null
    and friend_code = upper(regexp_replace(trim(q), '[^A-Za-z0-9]', '', 'g'))
    and id <> auth.uid()
  limit 1;
$$;
revoke all on function find_student(text) from public;
grant execute on function find_student(text) to authenticated;

drop function if exists friend_cards();
create function friend_cards()
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
      select jsonb_agg(t)
      from jsonb_array_elements(p.timetable) t
      join jsonb_array_elements((select timetable from me)) m on m->>'slot' = t->>'slot'
      where coalesce(t->>'name', '') <> ''
        and lower(trim(t->>'name')) = lower(trim(m->>'name'))
        and lower(trim(t->>'name')) <> 'spare'
        and coalesce((t->>'spare')::boolean, false) = false
        and coalesce((m->>'spare')::boolean, false) = false
    ), '[]'::jsonb) as shared,
    p.avatar, p.photo_url
  from fr join profiles p on p.id = fr.fid
  where auth.uid() is not null;
$$;
revoke all on function friend_cards() from public;
grant execute on function friend_cards() to authenticated;

drop function if exists request_peers();
create function request_peers()
returns table (id uuid, first_name text, last_name text, grade int, avatar jsonb, photo_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.grade, p.avatar, p.photo_url
  from friend_requests r
  join profiles p
    on p.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
  where auth.uid() is not null
    and r.status = 'pending'
    and (r.from_user = auth.uid() or r.to_user = auth.uid());
$$;
revoke all on function request_peers() from public;
grant execute on function request_peers() to authenticated;
