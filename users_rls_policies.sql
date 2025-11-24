-- RLS Policies for users table ONLY
-- Run this in Supabase SQL Editor to fix user creation issue

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users in org" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users in org" ON public.users;
DROP POLICY IF EXISTS "Super Admins can delete users" ON public.users;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Admins/HR/Super Admins can view all users in their organization
CREATE POLICY "Admins can view all users in org"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'HR')
    AND u.organization_id = public.users.organization_id
  )
);

-- Policy 4: Admins/HR/Super Admins can INSERT new users in their organization  
CREATE POLICY "Admins can insert users"
ON public.users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'HR')
    AND u.organization_id = public.users.organization_id
  )
);

-- Policy 5: Admins/HR/Super Admins can UPDATE users in their organization
CREATE POLICY "Admins can update users in org"
ON public.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'HR')
    AND u.organization_id = public.users.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'HR')
    AND u.organization_id = public.users.organization_id
  )
);

-- Policy 6: Super Admins can DELETE users in their organization
CREATE POLICY "Super Admins can delete users"
ON public.users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role = 'SUPER_ADMIN'
    AND u.organization_id = public.users.organization_id
  )
);

-- Verify policies were created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';
