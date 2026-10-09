ALTER TABLE public.courses
  ADD COLUMN course_code text NOT NULL DEFAULT '',
  ADD COLUMN school text NOT NULL DEFAULT '',
  ADD COLUMN section text NOT NULL DEFAULT '',
  ADD COLUMN professor text NOT NULL DEFAULT '';

-- Returns, for each assignment in the caller's course, how many classmates
-- (same code, school, section, semester, and professor when both set) list the
-- same title, and the most common date they have. No identities are exposed.
CREATE OR REPLACE FUNCTION public.crowd_check(_course_id uuid)
RETURNS TABLE(assignment_id uuid, classmates int, agree int, common_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT * FROM courses WHERE id = _course_id AND user_id = auth.uid()
      AND course_code <> '' AND school <> '' AND section <> ''
  ),
  peers AS (
    SELECT c.id FROM courses c, me
    WHERE c.user_id <> me.user_id
      AND lower(trim(c.course_code)) = lower(trim(me.course_code))
      AND lower(trim(c.school)) = lower(trim(me.school))
      AND lower(trim(c.section)) = lower(trim(me.section))
      AND lower(trim(c.semester)) = lower(trim(me.semester))
      AND (me.professor = '' OR c.professor = '' OR lower(trim(c.professor)) = lower(trim(me.professor)))
  ),
  mine AS (
    SELECT a.id, lower(trim(a.title)) t, a.due_date::date d
    FROM assignments a WHERE a.course_id = _course_id AND a.user_id = auth.uid() AND a.due_date IS NOT NULL
  ),
  theirs AS (
    SELECT lower(trim(a.title)) t, a.due_date::date d, count(*) n
    FROM assignments a WHERE a.course_id IN (SELECT id FROM peers) AND a.due_date IS NOT NULL
    GROUP BY 1, 2
  )
  SELECT m.id,
    coalesce((SELECT sum(n) FROM theirs WHERE t = m.t), 0)::int,
    coalesce((SELECT sum(n) FROM theirs WHERE t = m.t AND d = m.d), 0)::int,
    (SELECT d FROM theirs WHERE t = m.t ORDER BY n DESC LIMIT 1)
  FROM mine m;
$$;
REVOKE ALL ON FUNCTION public.crowd_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crowd_check(uuid) TO authenticated;