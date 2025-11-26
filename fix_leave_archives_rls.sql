-- Fix RLS policies for leave_archives table to allow INSERT operations
-- This allows Admin and Super Admin to create archive records during year-end processing

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "leave_archives_insert" ON public.leave_archives;

-- Create INSERT policy for Admin and Super Admin
-- They can insert archive records for users in their organization
CREATE POLICY "leave_archives_insert" 
ON public.leave_archives FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_user_role_org() ur
    WHERE (
      (ur.role IN ('ADMIN', 'SUPER_ADMIN') AND ur.organization_id = leave_archives.organization_id) OR
      ur.role = 'SUPER_ADMIN'
    )
  )
);

-- Also add UPDATE policy in case we need to update existing archives
DROP POLICY IF EXISTS "leave_archives_update" ON public.leave_archives;

CREATE POLICY "leave_archives_update" 
ON public.leave_archives FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_org() ur
    WHERE (
      (ur.role IN ('ADMIN', 'SUPER_ADMIN') AND ur.organization_id = leave_archives.organization_id) OR
      ur.role = 'SUPER_ADMIN'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_user_role_org() ur
    WHERE (
      (ur.role IN ('ADMIN', 'SUPER_ADMIN') AND ur.organization_id = leave_archives.organization_id) OR
      ur.role = 'SUPER_ADMIN'
    )
  )
);

