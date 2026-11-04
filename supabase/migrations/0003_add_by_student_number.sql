-- Spartans — Social, part 3.
-- Friends add each other by student number (or school email) instead of the
-- random 8-char friend_code. find_student() now matches student_id; the
-- friend_code column stays for now so nothing else breaks.

create or replace function find_student(q text)
returns table (id uuid, first_name text, last_name text, grade int)
language sql stable security definer set search_path = public as $$
  select id, first_name, last_name, grade from profiles
  where auth.uid() is not null
    and (lower(email) = lower(trim(q))
      or lower(email) = lower(trim(q)) || '@edu.sd45.bc.ca'
      or (trim(q) ~ '^\d+$' and student_id = trim(q)))
    and id <> auth.uid()
  limit 1;
$$;
