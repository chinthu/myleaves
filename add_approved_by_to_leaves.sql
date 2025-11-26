-- Add approved_by column to leaves table to track who approved the leave
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leaves_approved_by ON public.leaves(approved_by);

