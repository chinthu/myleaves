-- Create leave_settings table
CREATE TABLE IF NOT EXISTS public.leave_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  default_casual_leaves INTEGER DEFAULT 12,
  default_medical_leaves INTEGER DEFAULT 12,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(organization_id, year)
);

-- RLS Policies
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "leave_settings_select" ON public.leave_settings;
DROP POLICY IF EXISTS "leave_settings_modify" ON public.leave_settings;

-- Allow all authenticated users to view settings (needed for logic)
CREATE POLICY "leave_settings_select" 
ON public.leave_settings FOR SELECT 
TO authenticated 
USING (true);

-- Allow HR, ADMIN, SUPER_ADMIN to insert/update
CREATE POLICY "leave_settings_modify" 
ON public.leave_settings FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) 
  IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);
