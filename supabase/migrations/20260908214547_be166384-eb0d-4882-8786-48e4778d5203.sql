CREATE TABLE public.grade_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','parsed_pdf','parsed_image')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_categories TO authenticated;
GRANT ALL ON public.grade_categories TO service_role;

ALTER TABLE public.grade_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own grade categories"
ON public.grade_categories FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX grade_categories_course_id_idx ON public.grade_categories(course_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_grade_categories_updated_at
BEFORE UPDATE ON public.grade_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();