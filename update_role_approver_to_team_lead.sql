-- Update role from APPROVER to TEAM_LEAD
-- This migration updates the database constraint and existing user roles

-- Step 1: First, check what roles exist in the table (for debugging)
-- SELECT DISTINCT role FROM public.users;

-- Step 2: Update existing users with APPROVER role to TEAM_LEAD
UPDATE public.users 
SET role = 'TEAM_LEAD' 
WHERE role = 'APPROVER';

-- Step 5: Fix any invalid roles (set to USER as default if they don't match allowed values)
-- This handles any edge cases, nulls, or typos
UPDATE public.users 
SET role = 'USER' 
WHERE role IS NULL 
   OR role NOT IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER')
   OR TRIM(UPPER(role)) NOT IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER');

-- Step 6: Normalize any case issues (convert to uppercase)
UPDATE public.users 
SET role = UPPER(TRIM(role))
WHERE role != UPPER(TRIM(role));

-- Step 4: DROP the constraint FIRST (before fixing data)
-- This is critical - we must drop it first to allow data updates
DO $$ 
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find and drop ALL check constraints on the users table that involve role
    FOR constraint_record IN 
        SELECT conname, pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint 
        WHERE conrelid = 'public.users'::regclass 
        AND contype = 'c'
    LOOP
        -- Check if this constraint involves the role column
        IF constraint_record.constraint_def LIKE '%role%' OR 
           constraint_record.constraint_def LIKE '%APPROVER%' OR
           constraint_record.constraint_def LIKE '%TEAM_LEAD%' OR
           constraint_record.constraint_def LIKE '%SUPER_ADMIN%' OR
           constraint_record.constraint_def LIKE '%ADMIN%' OR
           constraint_record.constraint_def LIKE '%HR%' OR
           constraint_record.constraint_def LIKE '%USER%' OR
           constraint_record.conname LIKE '%role%' THEN
            EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname) || ' CASCADE';
            RAISE NOTICE 'Dropped constraint: % (Definition: %)', constraint_record.conname, constraint_record.constraint_def;
        END IF;
    END LOOP;
END $$;

-- Step 7: Verify all roles are now valid (optional - uncomment to check)
-- SELECT DISTINCT role, COUNT(*) FROM public.users GROUP BY role;

-- Step 8: Add the new check constraint with TEAM_LEAD instead of APPROVER
-- This will now work because all existing rows have valid roles
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER'));

