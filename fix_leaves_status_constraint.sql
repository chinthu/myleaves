-- Fix leaves table status check constraint to include CANCELLED
-- This allows leaves to be cancelled in addition to pending, approved, and rejected

-- Drop the existing check constraint
ALTER TABLE public.leaves 
DROP CONSTRAINT IF EXISTS leaves_status_check;

-- Add the new check constraint that includes CANCELLED
ALTER TABLE public.leaves 
ADD CONSTRAINT leaves_status_check 
CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));

