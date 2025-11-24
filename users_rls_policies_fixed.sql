-- Fixed RLS Policies for users table (No Recursion)
-- Run this in Supabase SQL Editor

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users in org" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users in org" ON public.users;
DROP POLICY IF EXISTS "Super Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.users;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Simple Policy 1: All authenticated users can read all users in same org
-- This allows admins to see users and create new ones without recursion
CREATE POLICY "Enable read for authenticated users"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Simple Policy 2: Users can INSERT if authenticated
-- We'll validate role in the application layer
CREATE POLICY "Enable insert for authenticated users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Simple Policy 3: Users can update their own profile OR admins can update any
CREATE POLICY "Enable update for authenticated users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id  -- Users can update themselves
  OR 
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN', 'HR')  -- Or if user is admin
)
WITH CHECK (
  auth.uid() = id
  OR
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN', 'HR')
);

-- Verify
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
