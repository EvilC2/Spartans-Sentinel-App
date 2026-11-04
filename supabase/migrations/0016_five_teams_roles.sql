-- Spartans — five App Club teams, part 1 (2026-10-17). Run this ON ITS OWN,
-- then 0017. Postgres can't use a new enum value in the same run that adds it.
--
-- Teams and roles (same as src/ranks.ts):
--   Developer    lead_developer, dev_innovator, dev_seasonal, dev_backend, dev_apple, dev_android
--   Maintenance  lead_maintenance, trivia, facts, polls, news, menu, popups
--   Badge        lead_badges, badges (Creator), badge_award, badge_list, badge_qr
--   Feedback     lead_feedback, feedback (Digital), feedback_real (Real)
--   Executive    president, marketing, hr, stuco, sponsor (Teacher Sponsor)
-- `owner` stays. `events` and `library` stay in the enum as old roles.

alter type app_role add value if not exists 'facts';
alter type app_role add value if not exists 'lead_developer';
alter type app_role add value if not exists 'dev_innovator';
alter type app_role add value if not exists 'dev_seasonal';
alter type app_role add value if not exists 'dev_backend';
alter type app_role add value if not exists 'dev_apple';
alter type app_role add value if not exists 'dev_android';
alter type app_role add value if not exists 'badge_award';
alter type app_role add value if not exists 'badge_list';
alter type app_role add value if not exists 'badge_qr';
alter type app_role add value if not exists 'feedback_real';
alter type app_role add value if not exists 'president';
alter type app_role add value if not exists 'marketing';
alter type app_role add value if not exists 'hr';
alter type app_role add value if not exists 'stuco';
alter type app_role add value if not exists 'sponsor';
