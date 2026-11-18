-- Spartans — Catch Up (2026-11-05). Run after 0018.
--
-- Catch Up gives a student the badges they would already have if they had
-- been using the app since they started at Sentinel. They answer questions on
-- the honour system and the app works out the badges (src/catchUp.ts).
--
-- Each account keeps:
--   catch_up_score    0-100, how much is answered. 100 only once finished.
--   catch_up_done_at  when it was finished. Null means the app keeps asking on
--                     every open. Clear it in the table editor to ask again.
--   catch_up_answers  what they said, so a redo starts filled in. profiles is
--                     self-read only (0009), so friends never see this.
--
-- finish_catch_up only ever gives badges on the list below, so nobody can call
-- it to claim The GOAT. The list mirrors src/catchUp.ts: change them together.
-- Awards carry the reason 'Catch Up', which is how a redo finds them again.

alter table profiles
  add column if not exists catch_up_score   smallint not null default 0 check (catch_up_score between 0 and 100),
  add column if not exists catch_up_answers jsonb not null default '{}'::jsonb,
  add column if not exists catch_up_done_at timestamptz;

create or replace function catch_up_allowed() returns text[]
language sql immutable as $$
  select array[
    -- every account
    'hello-world', 'welcome-to-sentinel', 'first-bell', 'achievement-unlocked',
    'badge-hunter', 'badge-addict', 'collector', 'speedrunner',
    -- time at Sentinel
    'fresh-meat', 'new-kid', 'non-capisco', 'not-lost-anymore', 'survived-september',
    'tutorial-complete', 'halfway-point', 'am-i-unc', 'entering-the-big-leagues',
    '1-more-year', 'top-dog', 'class-of-2027', 'last-first-day', 'phew-that-was-easy',
    'behind-the-wheel', 'watch-the-roads',
    -- dates they were here for
    'back-to-school', 'spooky-sentinel', 'trick-or-treat', 'she-s-melting', 'winter-arc',
    'new-year-same-homework', 'cupid-s-victim', 'lucky-sentinel', 'hope', 'summer-loading',
    'freedom-from-2026',
    -- sports
    'sentinel-athlete', 'playmaker', 'game-day', 'multi-sport-athlete', 'triple-threat',
    'five-year-athlete', 'home-field-advantage', 'road-warrior', 'playoffs', 'bringing-it-home',
    'team-captain', 'mvp', 'baller-jr', 'baller',
    'friday-night-lights', 'derby-day', 'good-luck-charm', '12th-man', '1-fan',
    -- events
    'little-sentinel', 'school-spirit', 'the-regular', 'social-butterfly', 'front-row',
    'ones-for-every-theme-day', 'full-circle',
    -- clubs and people
    'first-time', 'that-s-okay-i-m-a-member', 'president', 'volunteer', '100-hours', 'study-buddy',
    -- classes
    'honor-roll', 'academic-weapon', 'comeback-season', 'academic-comeback', 'published', 'nerd',
    'final-boss', 'perfect-week', 'perfect-month', 'on-time', 'athlete-scholar',
    'on-stage', 'mic-check', 'opening-night', 'behind-the-curtain', 'the-axrtist',
    -- traditions
    'costume-commitment', 'group-costume', 'holiday-spirit', 'secret-admirer', 'april-fools',
    -- Grade 12
    'senior-sunrise', 'golden-hour', 'senior-assassin', 'say-cheese', 'class-colours',
    'the-final-chapter', 'senior-meeting', 'future-funded'
  ];
$$;

-- Finish (or finish again). Takes back Catch Up badges no longer claimed, gives
-- the rest, and leaves anything earned another way alone: a badge the Badge
-- team took away stays taken away. Returns how many were newly given.
create or replace function finish_catch_up(p_answers jsonb, p_badges text[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ids text[];
  v_given int;
begin
  if v_user is null then raise exception 'Not signed in'; end if;

  select coalesce(array_agg(c.id), '{}') into v_ids from badge_catalog c
    where c.id = any(p_badges) and c.id = any(catch_up_allowed());

  update badge_awards set revoked_at = now()
    where user_id = v_user and reason = 'Catch Up' and revoked_at is null and badge_id <> all(v_ids);

  insert into badge_awards (user_id, badge_id, awarded_by, reason)
    select v_user, id, null, 'Catch Up' from unnest(v_ids) as id
    on conflict (user_id, badge_id) do update set revoked_at = null, awarded_at = now()
      where badge_awards.reason = 'Catch Up' and badge_awards.revoked_at is not null;
  get diagnostics v_given = row_count;

  update profiles set catch_up_score = 100, catch_up_answers = coalesce(p_answers, '{}'::jsonb), catch_up_done_at = now()
    where id = v_user;
  return v_given;
end $$;

-- Start over: takes back Catch Up badges and asks again. Answers stay so the
-- redo starts filled in. Returns the badge ids taken back, for the phone to drop.
create or replace function reset_catch_up() returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ids text[];
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  with gone as (
    update badge_awards set revoked_at = now()
      where user_id = v_user and reason = 'Catch Up' and revoked_at is null
      returning badge_id
  ) select coalesce(array_agg(badge_id), '{}') into v_ids from gone;
  update profiles set catch_up_score = 0, catch_up_done_at = null where id = v_user;
  return v_ids;
end $$;

revoke all on function finish_catch_up(jsonb, text[]) from public, anon;
revoke all on function reset_catch_up() from public, anon;
grant execute on function finish_catch_up(jsonb, text[]) to authenticated;
grant execute on function reset_catch_up() to authenticated;
