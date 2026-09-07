ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT true;

UPDATE public.assignments SET source = 'parsed_pdf' WHERE source NOT IN ('manual','parsed_pdf','parsed_image');

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_source_check CHECK (source IN ('manual','parsed_pdf','parsed_image'));