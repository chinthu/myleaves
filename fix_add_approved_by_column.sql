-- Add approved_by column to leaves table to track who approved the leave
-- This migration adds the column if it doesn't exist

-- Step 1: Add the column if it doesn't exist
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id);

-- Step 2: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leaves_approved_by ON public.leaves(approved_by);

-- Step 3: Refresh the schema cache (PostgREST will pick this up automatically)
-- Note: In Supabase, the schema cache refreshes automatically, but you may need to wait a few seconds
-- or restart the PostgREST service if the error persists

