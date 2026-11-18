-- Spartans — Catch Up: three more badges it may give (2026-11-18).
-- Run after 0019 (independent of 0021).
--
-- The reworked questions in src/catchUp.ts can now award:
--   bleeds-sentinel   stuck with the same club or team for three years
--   locked-in         properly studied through an exam week (been here a year+)
--   the-victory-lap   Grade 12, from June 1 (the final month)
-- Same function, same signature: finish_catch_up() picks the new list up as is.

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
    'the-final-chapter', 'senior-meeting', 'future-funded',
    -- added in 0022: three years with one club or team, studying through an
    -- exam week, and the final month of Grade 12
    'bleeds-sentinel', 'locked-in', 'the-victory-lap'
  ];
$$;
