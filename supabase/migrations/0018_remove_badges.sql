-- Spartans — remove three badges (2026-11-05). Run after 0017.
--
-- Deletes School App Jesus (school-app-jesus), Campout (campout) and
-- Under the Stars (under-the-stars) from badge_catalog, and cleans every place
-- that can point at them so the delete cannot fail and nothing keeps a dead id.
-- Safe to run more than once.

do $$
declare
  ids text[] := array['school-app-jesus', 'campout', 'under-the-stars'];
begin
  -- Awards: badge_awards.badge_id references badge_catalog(id). The
  -- badge_awards_xp trigger (0001) runs recompute_xp for each deleted row, so
  -- profiles.xp_total drops by the right amount on its own.
  delete from badge_awards where badge_id = any(ids);

  -- Pop-ups: popups.badge_id references badge_catalog(id) (0006).
  update popups set badge_id = null where badge_id = any(ids);

  -- Posts: a pop-up post carries its badge in data->>'badge' (0008), a plain
  -- json value with no foreign key, so strip it.
  update posts set data = data - 'badge' where data->>'badge' = any(ids);

  -- Badge designs: badge_id (0011) and target_id (0013) reference badge_catalog(id).
  -- Designs that only edited a removed badge are rejected; the rest just lose the link.
  update badge_designs
     set status = 'rejected',
         review_note = coalesce(review_note, 'The badge this design edited was removed.')
   where target_id = any(ids) and status in ('draft', 'pending');
  update badge_designs set target_id = null where target_id = any(ids);
  update badge_designs set badge_id = null where badge_id = any(ids);

  -- Pinned badges on profiles (0009): jsonb array of ids, drop the removed ones.
  update profiles
     set pinned_badges = coalesce((
           select jsonb_agg(e) from jsonb_array_elements(pinned_badges) e
           where e #>> '{}' <> all(ids)), '[]'::jsonb)
   where pinned_badges ?| ids;

  delete from badge_catalog where id = any(ids);
end $$;
