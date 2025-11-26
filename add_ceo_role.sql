-- Add CEO role to the users table
-- This migration adds the CEO role to the existing role check constraint

-- Step 1: Drop the existing check constraint on the role column
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all check constraints on the users table
    FOR constraint_record IN 
        SELECT conname, pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint 
        WHERE conrelid = 'public.users'::regclass 
        AND contype = 'c'
    LOOP
        -- Check if this constraint involves the role column
        IF constraint_record.constraint_def LIKE '%role%' OR 
           constraint_record.constraint_def LIKE '%SUPER_ADMIN%' OR
           constraint_record.constraint_def LIKE '%TEAM_LEAD%' OR
           constraint_record.conname LIKE '%role%' THEN
            EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname);
            RAISE NOTICE 'Dropped constraint: % (Definition: %)', constraint_record.conname, constraint_record.constraint_def;
        END IF;
    END LOOP;
END $$;

-- Step 2: Add the new check constraint with CEO included
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER', 'CEO'));

-- Step 3: Update RLS policies to include CEO role
-- Policy: HR/ADMIN/SUPER_ADMIN/CEO can view all users in their organization
DROP POLICY IF EXISTS "users_select_org" ON public.users;
CREATE POLICY "users_select_org" ON public.users
  FOR SELECT TO authenticated USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() 
      WHERE role IN ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO')
    )
  );

-- Policy: HR/ADMIN/SUPER_ADMIN/CEO can update users in their organization
DROP POLICY IF EXISTS "users_update_org" ON public.users;
CREATE POLICY "users_update_org" ON public.users
  FOR UPDATE TO authenticated USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() ur
      WHERE (
        (ur.role IN ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO') AND ur.organization_id = users.organization_id) OR
        ur.role = 'SUPER_ADMIN'
      )
    )
  )
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() ur
      WHERE (
        (ur.role IN ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO') AND ur.organization_id = users.organization_id) OR
        ur.role = 'SUPER_ADMIN'
      )
    )
  );

-- Policy: Leave Settings - HR, ADMIN, SUPER_ADMIN, CEO can modify
DROP POLICY IF EXISTS "leave_settings_modify" ON public.leave_settings;
CREATE POLICY "leave_settings_modify" ON public.leave_settings
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() 
      WHERE role IN ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO')
    )
  );

