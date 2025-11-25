-- Comprehensive fix for user_comp_offs table
-- Run this script to ensure all required columns exist

-- 1. Add work_date
ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS work_date DATE;

-- 2. Add reason
ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS reason TEXT;

-- 3. Add organization_id
ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Add created_by
ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- 5. Add timestamps
ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 6. Ensure RLS policies are correct
ALTER TABLE user_comp_offs ENABLE ROW LEVEL SECURITY;

-- Re-apply the select policy to be safe
DROP POLICY IF EXISTS "comp_off_select_admin" ON user_comp_offs;
CREATE POLICY "comp_off_select_admin" 
ON user_comp_offs FOR SELECT 
TO authenticated 
USING (
  organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
  AND
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);
