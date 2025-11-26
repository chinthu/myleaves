-- Immediate fix for role constraint issue
-- This script will find and drop the existing constraint, then recreate it with TEAM_LEAD

-- Step 1: First, check what roles exist in the table (for debugging)
-- Uncomment the next line to see current roles:
-- SELECT DISTINCT role, COUNT(*) FROM public.users GROUP BY role;

-- Step 2: Update existing users with APPROVER role to TEAM_LEAD (if any)
UPDATE public.users 
SET role = 'TEAM_LEAD' 
WHERE role = 'APPROVER';

-- Step 3: Fix any invalid roles (set to USER as default if they don't match allowed values)
-- This ensures all rows are valid before adding the constraint
UPDATE public.users 
SET role = 'USER' 
WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER');

-- Step 4: Find and list all check constraints on users table
-- Run this to see what constraints exist:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.users'::regclass AND contype = 'c';

-- Step 5: Drop ALL check constraints on the users table that involve role
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
           constraint_record.constraint_def LIKE '%APPROVER%' OR
           constraint_record.constraint_def LIKE '%TEAM_LEAD%' OR
           constraint_record.conname LIKE '%role%' THEN
            EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname);
            RAISE NOTICE 'Dropped constraint: % (Definition: %)', constraint_record.conname, constraint_record.constraint_def;
        END IF;
    END LOOP;
END $$;

-- Step 6: Add the new check constraint with TEAM_LEAD
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER'));

-- Step 7: Verify the constraint was created correctly
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND contype = 'c' 
AND pg_get_constraintdef(oid) LIKE '%role%';

