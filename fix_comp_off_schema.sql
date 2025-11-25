-- Add organization_id column if it doesn't exist
ALTER TABLE user_comp_offs 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update RLS policies to scope by organization (Optional but recommended)
DROP POLICY IF EXISTS "comp_off_select_admin" ON user_comp_offs;

CREATE POLICY "comp_off_select_admin" 
ON user_comp_offs FOR SELECT 
TO authenticated 
USING (
  organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
  AND
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);
