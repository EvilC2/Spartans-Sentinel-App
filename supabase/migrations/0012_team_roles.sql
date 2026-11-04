-- Spartans — team ranks, part 1 (2026-10-09). Run this ON ITS OWN, then 0013.
-- Postgres can't use a new enum value in the same run that adds it.
--
-- Three teams run App Club Admin: Badges, Maintenance, Feedback. Each gets a
-- manager role; Feedback also gets its member job.

alter type app_role add value if not exists 'feedback';
alter type app_role add value if not exists 'lead_badges';
alter type app_role add value if not exists 'lead_maintenance';
alter type app_role add value if not exists 'lead_feedback';
