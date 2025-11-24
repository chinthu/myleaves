-- Replace 'your_email@example.com' with the email of the user you want to make Super Admin
-- This user must already have signed up via the application.

UPDATE public.users
SET role = 'SUPER_ADMIN'
WHERE email = 'your_email@example.com';

-- Verify the change
SELECT * FROM public.users WHERE email = 'your_email@example.com';
