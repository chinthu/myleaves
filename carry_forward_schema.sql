-- Add carry forward fields to leave_settings table
ALTER TABLE public.leave_settings 
ADD COLUMN IF NOT EXISTS carry_forward_enabled BOOLEAN DEFAULT false;

-- Add field to track if year-end processing has been completed
ALTER TABLE public.leave_settings 
ADD COLUMN IF NOT EXISTS year_end_processed BOOLEAN DEFAULT false;

-- Add field to track when year-end processing was done
ALTER TABLE public.leave_settings 
ADD COLUMN IF NOT EXISTS year_end_processed_at TIMESTAMP WITH TIME ZONE;

-- Create leave_archives table to store previous year's leave records
CREATE TABLE IF NOT EXISTS public.leave_archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  total_leaves_applied INTEGER DEFAULT 0,
  total_leaves_approved INTEGER DEFAULT 0,
  total_leaves_pending INTEGER DEFAULT 0,
  total_leaves_rejected INTEGER DEFAULT 0,
  total_leaves_cancelled INTEGER DEFAULT 0,
  casual_leaves_taken NUMERIC DEFAULT 0,
  medical_leaves_taken NUMERIC DEFAULT 0,
  comp_off_leaves_taken NUMERIC DEFAULT 0,
  total_days_taken NUMERIC DEFAULT 0,
  balance_casual_at_year_end INTEGER DEFAULT 0,
  balance_medical_at_year_end INTEGER DEFAULT 0,
  balance_compoff_at_year_end NUMERIC DEFAULT 0,
  carry_forward_casual INTEGER DEFAULT 0,
  carry_forward_medical INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, organization_id, year)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_leave_archives_user_year ON public.leave_archives(user_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_archives_org_year ON public.leave_archives(organization_id, year);

-- RLS Policies for leave_archives
ALTER TABLE public.leave_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_archives_select" ON public.leave_archives;
CREATE POLICY "leave_archives_select" 
ON public.leave_archives FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND (
      u.role IN ('HR', 'ADMIN', 'SUPER_ADMIN') 
      AND u.organization_id = leave_archives.organization_id
    )
    OR u.role = 'SUPER_ADMIN'
  )
);

-- Add is_archived field to leaves table to mark archived leaves
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Add index for archived leaves
CREATE INDEX IF NOT EXISTS idx_leaves_archived ON public.leaves(is_archived, user_id, start_date);

