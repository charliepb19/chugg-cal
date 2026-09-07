ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'assignment',
  ADD COLUMN IF NOT EXISTS weight TEXT NOT NULL DEFAULT '';

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_type_check CHECK (type IN ('assignment','exam','quiz','reading'));