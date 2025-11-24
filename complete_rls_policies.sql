-- Complete RLS Policies for Leave Management System
-- Run this in Supabase SQL Editor

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Super Admins can manage their own organization
CREATE POLICY "Super Admins can view own org"
ON public.organizations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND organization_id = public.organizations.id
  )
);

CREATE POLICY "Super Admins can update own org"
ON public.organizations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND organization_id = public.organizations.id
  )
);

-- ============================================
-- LEAVE_REQUESTS TABLE
-- ============================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own leave requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests FOR SELECT
USING (user_id = auth.uid());

-- Approvers/HR/Admins can view leave requests in their org
CREATE POLICY "Approvers can view org leave requests"
ON public.leave_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.organization_id = u2.organization_id
    WHERE u1.id = auth.uid()
    AND u2.id = public.leave_requests.user_id
    AND u1.role IN ('APPROVER', 'HR', 'ADMIN', 'SUPER_ADMIN')
  )
);

-- Users can insert their own leave requests
CREATE POLICY "Users can create own leave requests"
ON public.leave_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own pending leave requests
CREATE POLICY "Users can update own pending requests"
ON public.leave_requests FOR UPDATE
USING (user_id = auth.uid() AND status = 'PENDING');

-- Approvers/HR can update leave requests in their org
CREATE POLICY "Approvers can update leave requests"
ON public.leave_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.organization_id = u2.organization_id
    WHERE u1.id = auth.uid()
    AND u2.id = public.leave_requests.user_id
    AND u1.role IN ('APPROVER', 'HR', 'ADMIN', 'SUPER_ADMIN')
  )
);

-- Users can delete their own pending requests
CREATE POLICY "Users can delete own pending requests"
ON public.leave_requests FOR DELETE
USING (user_id = auth.uid() AND status = 'PENDING');

-- ============================================
-- LEAVE_BALANCES TABLE  
-- ============================================
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Users can view their own balance
CREATE POLICY "Users can view own balance"
ON public.leave_balances FOR SELECT
USING (user_id = auth.uid());

-- HR/Admins can view all balances in org
CREATE POLICY "HR can view org balances"
ON public.leave_balances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.organization_id = u2.organization_id
    WHERE u1.id = auth.uid()
    AND u2.id = public.leave_balances.user_id
    AND u1.role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
  )
);

-- HR/Admins can update balances in org
CREATE POLICY "HR can update org balances"
ON public.leave_balances FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.organization_id = u2.organization_id
    WHERE u1.id = auth.uid()
    AND u2.id = public.leave_balances.user_id
    AND u1.role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
  )
);

-- HR/Admins can insert balances for org users
CREATE POLICY "HR can insert org balances"
ON public.leave_balances FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.organization_id = u2.organization_id
    WHERE u1.id = auth.uid()
    AND u2.id = public.leave_balances.user_id
    AND u1.role IN ('HR', 'ADMIN', 'SUPER_ADMIN')
  )
);
