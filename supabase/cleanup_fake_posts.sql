-- Spartans: one-off cleanup, not a migration. Removes 13 sample-looking posts
-- that are live on the server for every student. They look like they came from
-- the old "Load the starter posts" button.
--
-- The delete is permanent. Run the select first and check the list.

select id, kind, status, author, created_at, coalesce(data->>'title', data->>'q', data->>'question', data::text) as what
from posts
where id in (
  'ef4d82f7-42b7-4570-b80f-cc0ee67f1f3f', '75ca00e5-da46-4792-adbd-f9cab79cf655',
  'ed25aba9-f12e-4003-935a-c8ea3b7ba230', 'b5ed48cb-5ff0-4d31-81b6-a793026b878f',
  '8131e621-136f-4304-b846-cb31e85d5722', '526bf5c7-bfaa-47bb-8e35-04bc36a73ac0',
  'ad5dbb78-6507-481a-9db0-3ad086274b52', 'e3d0340a-a5d8-4077-b498-ccf0b079f4c7',
  '354f6c43-86cd-4976-9e86-bc816a362707', '872e9f74-9395-4e36-894a-bdb3ee9edf18',
  '80d8e5eb-dbf5-4c16-92ab-6eaa2d130023', 'd8d4962f-81d0-4d75-8100-b19a14cd11a9',
  'aa4e51da-4149-4543-b5bb-e39309bbfce1'
);

-- Then, when the list looks right, remove the comment markers and run:
-- delete from posts where id in (
--   'ef4d82f7-42b7-4570-b80f-cc0ee67f1f3f', '75ca00e5-da46-4792-adbd-f9cab79cf655',
--   'ed25aba9-f12e-4003-935a-c8ea3b7ba230', 'b5ed48cb-5ff0-4d31-81b6-a793026b878f',
--   '8131e621-136f-4304-b846-cb31e85d5722', '526bf5c7-bfaa-47bb-8e35-04bc36a73ac0',
--   'ad5dbb78-6507-481a-9db0-3ad086274b52', 'e3d0340a-a5d8-4077-b498-ccf0b079f4c7',
--   '354f6c43-86cd-4976-9e86-bc816a362707', '872e9f74-9395-4e36-894a-bdb3ee9edf18',
--   '80d8e5eb-dbf5-4c16-92ab-6eaa2d130023', 'd8d4962f-81d0-4d75-8100-b19a14cd11a9',
--   'aa4e51da-4149-4543-b5bb-e39309bbfce1'
-- );
