-- Spartans — App Club role for calendar events (2026-10-05).
--
-- Its own file because Postgres won't let a new enum value be used in the
-- same transaction that adds it. Run this one first, then 0008.

alter type app_role add value if not exists 'events';
