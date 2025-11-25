-- Public Holidays Management Schema
-- Run this in Supabase SQL Editor

-- Create public_holidays table
CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  year INTEGER NOT NULL,
  type VARCHAR(20) CHECK (type IN ('MANDATORY', 'OPTIONAL', 'NORMAL')) DEFAULT 'NORMAL',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(organization_id, date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_public_holidays_org_year ON public_holidays(organization_id, year);
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_type ON public_holidays(type);

-- Enable RLS
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "public_holidays_select" ON public_holidays;
DROP POLICY IF EXISTS "public_holidays_insert" ON public_holidays;
DROP POLICY IF EXISTS "public_holidays_update" ON public_holidays;
DROP POLICY IF EXISTS "public_holidays_delete" ON public_holidays;

-- RLS Policies
-- All authenticated users can view holidays
CREATE POLICY "public_holidays_select" 
ON public_holidays FOR SELECT 
TO authenticated 
USING (true);

-- Only HR, ADMIN, SUPER_ADMIN can insert
CREATE POLICY "public_holidays_insert" 
ON public_holidays FOR INSERT 
TO authenticated 
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) 
  IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);

-- Only HR, ADMIN, SUPER_ADMIN can update
CREATE POLICY "public_holidays_update" 
ON public_holidays FOR UPDATE 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) 
  IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);

-- Only HR, ADMIN, SUPER_ADMIN can delete
CREATE POLICY "public_holidays_delete" 
ON public_holidays FOR DELETE 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) 
  IN ('HR', 'ADMIN', 'SUPER_ADMIN')
);

-- Verification query
SELECT 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd 
FROM pg_policies 
WHERE tablename = 'public_holidays';
