-- DIRECT UPDATE COMMAND (Easiest Method)
-- Run this command in the Supabase SQL Editor to update a user's role.
-- Replace the email and role as needed.

UPDATE public.users
SET role = 'SUPER_ADMIN' -- Options: 'SUPER_ADMIN', 'ADMIN', 'HR', 'APPROVER', 'USER'
WHERE email = 'chintup@thinking-code.com';

-- Verify the change
SELECT * FROM public.users WHERE email = 'chintup@thinking-code.com';


-- OPTIONAL: Helper Function (Only run this if you want to create a reusable function)
/*
create or replace function public.update_user_role(user_email text, new_role text)
returns void as $$
begin
  update public.users
  set role = new_role
  where email = user_email;
end;
$$ language plpgsql security definer;
*/
