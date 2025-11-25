-- Add RLS policies to allow HR/ADMIN/SUPER_ADMIN to update users in their organization
-- This is needed for the reset leaves functionality

-- Create a security definer function to get user role and org without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role_org()
RETURNS TABLE(role text, organization_id uuid) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.role, u.organization_id
  FROM public.users u
  WHERE u.id = auth.uid();
END;
$$;

-- Policy: HR/ADMIN/SUPER_ADMIN can view all users in their organization
DROP POLICY IF EXISTS "users_select_org" ON public.users;
CREATE POLICY "users_select_org" ON public.users
  FOR SELECT TO authenticated USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() 
      WHERE role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Policy: HR/ADMIN/SUPER_ADMIN can update users in their organization
DROP POLICY IF EXISTS "users_update_org" ON public.users;
CREATE POLICY "users_update_org" ON public.users
  FOR UPDATE TO authenticated USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() ur
      WHERE (
        (ur.role IN ('HR', 'ADMIN', 'SUPER_ADMIN') AND ur.organization_id = users.organization_id) OR
        ur.role = 'SUPER_ADMIN'
      )
    )
  )
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.get_user_role_org() ur
      WHERE (
        (ur.role IN ('HR', 'ADMIN', 'SUPER_ADMIN') AND ur.organization_id = users.organization_id) OR
        ur.role = 'SUPER_ADMIN'
      )
    )
  );

