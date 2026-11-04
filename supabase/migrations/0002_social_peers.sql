-- Spartans — Social, part 2.
-- Profiles are readable by friends only (profiles_read), so a pending request
-- row alone can't be shown with a name. request_peers() returns name + grade
-- for the other side of every pending request involving the caller, nothing
-- else — the same shape find_student() returns.

create or replace function request_peers()
returns table (id uuid, first_name text, last_name text, grade int)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.grade
  from friend_requests r
  join profiles p
    on p.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
  where auth.uid() is not null
    and r.status = 'pending'
    and (r.from_user = auth.uid() or r.to_user = auth.uid());
$$;
