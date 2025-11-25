-- Drop old table if exists
DROP TABLE IF EXISTS comp_off_requests;

-- Create user_comp_offs table
CREATE TABLE IF NOT EXISTS user_comp_offs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_comp_offs ENABLE ROW LEVEL SECURITY;

-- HR/Admin/Super Admin can view all in their org
CREATE POLICY "comp_off_select_admin" 
ON user_comp_offs FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);

-- Users can view their own (optional, but good for transparency)
CREATE POLICY "comp_off_select_own" 
ON user_comp_offs FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Only HR/Admin/Super Admin can insert
CREATE POLICY "comp_off_insert_admin" 
ON user_comp_offs FOR INSERT 
TO authenticated 
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);

-- Only HR/Admin/Super Admin can update
CREATE POLICY "comp_off_update_admin" 
ON user_comp_offs FOR UPDATE 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);

-- Only HR/Admin/Super Admin can delete
CREATE POLICY "comp_off_delete_admin" 
ON user_comp_offs FOR DELETE 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);
