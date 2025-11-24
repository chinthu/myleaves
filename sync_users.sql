-- Script to sync existing users from auth.users to public.users
-- Run this once to backfill any missing user profiles.

INSERT INTO public.users (id, email, full_name, role)
SELECT 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', 'User'), 
  'USER' -- Default role
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Verify the sync
SELECT * FROM public.users;
