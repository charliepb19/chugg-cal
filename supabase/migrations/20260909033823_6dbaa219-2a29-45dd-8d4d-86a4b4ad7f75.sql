CREATE TABLE public.work_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','parsed_image_work')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_shifts TO authenticated;
GRANT ALL ON public.work_shifts TO service_role;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own work shifts" ON public.work_shifts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX work_shifts_user_date_idx ON public.work_shifts (user_id, shift_date);