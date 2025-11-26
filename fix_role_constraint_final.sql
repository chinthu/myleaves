-- Final fix for role constraint issue
-- This script will drop the constraint first, fix data, then recreate it

-- Step 1: Check what roles currently exist (for debugging)
-- Uncomment to see:
-- SELECT DISTINCT role, COUNT(*) FROM public.users GROUP BY role;

-- Step 2: Drop the constraint FIRST (if it exists)
-- This allows us to update the data freely
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

-- Step 3: Now update existing users with APPROVER role to TEAM_LEAD
UPDATE public.users 
SET role = 'TEAM_LEAD' 
WHERE role = 'APPROVER';

-- Step 4: Fix any invalid roles (set to USER as default if they don't match allowed values)
-- This handles any edge cases or typos
UPDATE public.users 
SET role = 'USER' 
WHERE role IS NULL 
   OR role NOT IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER')
   OR TRIM(UPPER(role)) NOT IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER');

-- Step 5: Normalize any case issues (convert to uppercase)
UPDATE public.users 
SET role = UPPER(TRIM(role))
WHERE role != UPPER(TRIM(role));

-- Step 6: Verify all roles are now valid
-- Uncomment to verify:
-- SELECT DISTINCT role, COUNT(*) FROM public.users GROUP BY role;

-- Step 7: Add the new check constraint with TEAM_LEAD
-- This should now work because all rows have valid roles
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER'));

-- Step 8: Verify the constraint was created correctly
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND contype = 'c' 
AND pg_get_constraintdef(oid) LIKE '%role%';

