-- Create leave_settings table
CREATE TABLE IF NOT EXISTS leave_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  default_casual_leaves INTEGER DEFAULT 12,
  default_medical_leaves INTEGER DEFAULT 12,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, year)
);

-- RLS Policies
ALTER TABLE leave_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view settings (needed for logic)
CREATE POLICY "leave_settings_select" 
ON leave_settings FOR SELECT 
TO authenticated 
USING (true);

-- Allow HR, ADMIN, SUPER_ADMIN to insert/update
CREATE POLICY "leave_settings_modify" 
ON leave_settings FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) 
  IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);
