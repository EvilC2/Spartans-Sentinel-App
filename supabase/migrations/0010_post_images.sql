-- Spartans — pictures on App Club posts (2026-10-08). Run after 0008.
--
-- Any post (trivia, fact, poll, news, menu, pop-up, event) may carry a photo
-- that shows behind it: `data.image`, a public URL. The app uploads photos to
-- the post-images bucket and saves the URL in the post, so no table changes.
-- Anyone with an active App Club role may upload; everyone may read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  on conflict (id) do nothing;

create policy storage_post_images_read on storage.objects for select
  using (bucket_id = 'post-images');
create policy storage_post_images_write on storage.objects for insert
  with check (bucket_id = 'post-images' and cardinality((select my_roles())) > 0);
create policy storage_post_images_update on storage.objects for update
  using (bucket_id = 'post-images' and cardinality((select my_roles())) > 0)
  with check (bucket_id = 'post-images' and cardinality((select my_roles())) > 0);
create policy storage_post_images_delete on storage.objects for delete
  using (bucket_id = 'post-images' and cardinality((select my_roles())) > 0);
