-- ============================================
-- COMPLETE RLS POLICIES FOR USERS TABLE
-- No recursion, safe to run
-- ============================================

-- Step 1: Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
END $$;

-- Step 2: Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 3: Create new simple policies

-- Policy 1: SELECT - All authenticated users can view all users
-- (Admins need to see all users to manage them)
CREATE POLICY "users_select_policy"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: INSERT - All authenticated users can insert
-- (Needed for signup and admin creating users)
CREATE POLICY "users_insert_policy"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: UPDATE - Users can update own record
CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 4: DELETE - Only allow if needed (optional, uncomment if you need delete)
-- CREATE POLICY "users_delete_policy"
-- ON public.users
-- FOR DELETE
-- TO authenticated
-- USING (auth.uid() = id);

-- Step 4: Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN roles = '{authenticated}' THEN 'authenticated users'
        ELSE array_to_string(roles, ', ')
    END as applies_to
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Expected output: You should see 3 policies (select, insert, update_own)
