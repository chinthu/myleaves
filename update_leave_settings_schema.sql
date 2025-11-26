-- Update leave_settings to be one per organization (not per year)
-- Remove year from unique constraint and make organization_id unique

-- Drop the existing unique constraint
ALTER TABLE public.leave_settings 
DROP CONSTRAINT IF EXISTS leave_settings_organization_id_year_key;

-- Add unique constraint on organization_id only
ALTER TABLE public.leave_settings 
ADD CONSTRAINT leave_settings_organization_id_key UNIQUE (organization_id);

-- Note: The year column is kept for reference but is no longer part of the unique constraint
-- You may want to remove the year column entirely if it's not needed, or keep it for tracking purposes

