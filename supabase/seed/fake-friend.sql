-- DEV ONLY: one fake student, already friends with every active Owner, so the
-- Social screen has someone to show. Run in the Supabase SQL editor (it runs
-- as postgres, so RLS and the role checks are skipped). Safe to re-run.
-- Takes two blocks from the Owner's own timetable so compare shows overlaps.
-- Remove with the block at the bottom.

do $$
declare
  v_friend uuid;
  v_me     uuid;
  v_mine   jsonb;
begin
  select id into v_friend from auth.users where email = 'test.friend@edu.sd45.bc.ca';
  if v_friend is null then
    v_friend := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_friend, 'authenticated', 'authenticated',
            'test.friend@edu.sd45.bc.ca', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            '{"first_name":"Maya","last_name":"Testfriend","grade":11,"student_id":"9990001"}',
            now(), now());
    -- handle_new_user() makes the profiles row
  end if;

  for v_me in select user_id from members where role = 'owner' and revoked_at is null loop
    select timetable into v_mine from profiles where id = v_me;

    update profiles set
      pronouns = 'she/her',
      student_id = '9990001',
      timetable = jsonb_build_array(
        coalesce((select e from jsonb_array_elements(v_mine) e where e->>'slot' = '1-1' and e->>'name' <> ''),
                 '{"slot":"1-1","name":"English 11","teacher":"Harper, Dana","room":"214","color":"#A23E3E"}'::jsonb),
        '{"slot":"1-2","name":"Chemistry 11","teacher":"Okafor, Ben","room":"131","color":"#1A3A5C"}'::jsonb,
        '{"slot":"1-3","name":"Spare","teacher":"","room":"","color":"#5B7A4E","spare":true}'::jsonb,
        '{"slot":"1-4","name":"Pre-Calculus 11","teacher":"Lindqvist, Erik","room":"207","color":"#B68842"}'::jsonb,
        '{"slot":"2-1","name":"Social Studies 11","teacher":"Moreau, Claire","room":"219","color":"#7A4E8C"}'::jsonb,
        coalesce((select e from jsonb_array_elements(v_mine) e where e->>'slot' = '2-2' and e->>'name' <> ''),
                 '{"slot":"2-2","name":"Art Studio 11","teacher":"Nakamura, Jun","room":"106","color":"#2A7A8C"}'::jsonb),
        '{"slot":"2-3","name":"Physical and Health Education 11","teacher":"Bains, Raj","room":"Gym","color":"#8C5A2A"}'::jsonb,
        '{"slot":"2-4","name":"French 11","teacher":"Dubois, Anne","room":"221","color":"#4E6B8C"}'::jsonb
      ),
      extras = '[{"name":"Senior Girls Volleyball","teacher":"","kind":"sport"},{"name":"Concert Band","teacher":"","kind":"music"}]'
    where id = v_friend;

    insert into friend_requests (from_user, to_user, status, responded_at)
    values (v_friend, v_me, 'accepted', now())
    on conflict (from_user, to_user) do update set status = 'accepted', responded_at = now();
  end loop;

  -- School-activity badges only (district rule). Trigger updates xp_total.
  insert into badge_awards (user_id, badge_id, reason)
  select v_friend, b, 'dev seed' from unnest(array['tutorial-complete','nerd','friday-night-lights','home-field-advantage','mvp']) b
  where exists (select 1 from badge_catalog where id = b)
  on conflict (user_id, badge_id) do nothing;
end $$;

-- ── Remove the fake friend (profile, request and badges cascade) ──
-- delete from auth.users where email = 'test.friend@edu.sd45.bc.ca';
