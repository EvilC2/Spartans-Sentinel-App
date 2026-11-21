-- Spartans — default friends (2026-11-18).
--
-- Every student starts already friends with three App Club accounts, found by
-- friend code (49F8-8F83, 0C53-E415, 9723-ABA0):
--   • New sign-ups: a trigger on profiles adds them right after the row is made
--     (handle_new_user() inserts the profile, this fires after it).
--   • Existing students: the backfill at the bottom adds them once.
--
-- Rows go in as 'accepted', so send-push (which only pushes on 'pending'
-- inserts) stays quiet. A pair that already has a row in either direction is
-- left alone except 'pending', which is upgraded to 'accepted'. 'declined' and
-- 'blocked' stay as the student chose. A code that matches no profile yet is
-- skipped; re-run the backfill once that account exists.
--
-- To change the list, edit default_friend_codes() and re-run this file.

create or replace function default_friend_codes() returns text[]
language sql immutable as $$
  select array['49F88F83', '0C53E415', '9723ABA0'];
$$;

-- Make `p_user` friends with every default account. Safe to call repeatedly.
create or replace function add_default_friends(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_friend uuid;
begin
  for v_friend in
    select id from profiles
    where friend_code = any (default_friend_codes()) and id <> p_user
  loop
    update friend_requests set status = 'accepted', responded_at = now()
      where status = 'pending'
        and ((from_user = v_friend and to_user = p_user) or (from_user = p_user and to_user = v_friend));

    insert into friend_requests (from_user, to_user, status, responded_at)
    select v_friend, p_user, 'accepted', now()
    where not exists (
      select 1 from friend_requests
      where (from_user = v_friend and to_user = p_user) or (from_user = p_user and to_user = v_friend)
    )
    on conflict (from_user, to_user) do nothing;
  end loop;
end $$;
revoke all on function add_default_friends(uuid) from public, anon, authenticated;

create or replace function profiles_add_default_friends() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform add_default_friends(new.id);
  return new;
end $$;

drop trigger if exists profiles_default_friends on profiles;
create trigger profiles_default_friends after insert on profiles
  for each row execute function profiles_add_default_friends();

-- ── Backfill everyone who already has an account ────────────────
select add_default_friends(id) from profiles;
