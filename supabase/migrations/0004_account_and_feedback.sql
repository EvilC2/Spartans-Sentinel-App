-- Spartans — Settings: delete my account + Help & feedback.
--
-- 1. delete_my_account(): the signed-in student removes their own account.
--    Deleting the auth.users row cascades to profiles and from there to
--    roles, votes, ratings, badge awards, friend requests and push tokens.
--    Columns that pointed at the person without a cascade are relaxed first so
--    the delete never fails: club posts they wrote stay up with no author,
--    invite codes they minted are removed, "granted by / awarded by" go blank.
-- 2. feedback: "I like this / Needs fixing / Idea / Confusing" messages about a
--    specific part of the app. Anyone signed in can send; they see their own;
--    owners read them all in App Club Admin.

-- ── 1. Account deletion ─────────────────────────────────────────
alter table buzz_items    alter column author drop not null;
alter table menu_items    alter column author drop not null;
alter table announcements alter column author drop not null;
alter table popups        alter column author drop not null;

alter table buzz_items    drop constraint buzz_items_author_fkey,
  add constraint buzz_items_author_fkey    foreign key (author) references profiles(id) on delete set null;
alter table menu_items    drop constraint menu_items_author_fkey,
  add constraint menu_items_author_fkey    foreign key (author) references profiles(id) on delete set null;
alter table announcements drop constraint announcements_author_fkey,
  add constraint announcements_author_fkey foreign key (author) references profiles(id) on delete set null;
alter table popups        drop constraint popups_author_fkey,
  add constraint popups_author_fkey        foreign key (author) references profiles(id) on delete set null;

alter table members        drop constraint members_granted_by_fkey,
  add constraint members_granted_by_fkey        foreign key (granted_by)  references profiles(id) on delete set null;
alter table invite_codes   drop constraint invite_codes_created_by_fkey,
  add constraint invite_codes_created_by_fkey   foreign key (created_by)  references profiles(id) on delete cascade;
alter table invite_codes   drop constraint invite_codes_redeemed_by_fkey,
  add constraint invite_codes_redeemed_by_fkey  foreign key (redeemed_by) references profiles(id) on delete set null;
alter table badge_awards   drop constraint badge_awards_awarded_by_fkey,
  add constraint badge_awards_awarded_by_fkey   foreign key (awarded_by)  references profiles(id) on delete set null;
alter table library_status drop constraint library_status_updated_by_fkey,
  add constraint library_status_updated_by_fkey foreign key (updated_by)  references profiles(id) on delete set null;

create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = me;
end $$;
revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;

-- ── 2. Feedback ─────────────────────────────────────────────────
create table feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid default auth.uid() references profiles(id) on delete set null,
  area        text not null,                          -- "Map", "The Buzz", "Settings"…
  kind        text not null check (kind in ('like', 'fix', 'idea', 'confusing')),
  message     text not null default '' check (char_length(message) <= 2000),
  platform    text,
  app_version text,
  created_at  timestamptz not null default now()
);
create index feedback_recent on feedback (created_at desc);

alter table feedback enable row level security;
create policy feedback_insert on feedback for insert with check (user_id = auth.uid());
create policy feedback_read   on feedback for select using (user_id = auth.uid() or has_role('owner'));
create policy feedback_delete on feedback for delete using (has_role('owner'));
