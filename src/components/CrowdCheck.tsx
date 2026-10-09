import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Assignment, Course } from "@/lib/db";

export function CrowdCheck({ course, assignments }: { course: Course; assignments: Assignment[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    course_code: course.course_code,
    school: course.school,
    section: course.section,
    professor: course.professor,
  });
  useEffect(() => {
    setForm({
      course_code: course.course_code,
      school: course.school,
      section: course.section,
      professor: course.professor,
    });
  }, [course.id, course.course_code, course.school, course.section, course.professor]);

  const ready = Boolean(course.course_code && course.school && course.section);
  const { data: rows = [] } = useQuery({
    queryKey: ["crowd_check", course.id, assignments.length],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("crowd_check", { _course_id: course.id });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    const { error } = await supabase.from("courses").update(form).eq("id", course.id);
    if (error) return toast.error(error.message);
    toast.success("Class details saved");
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["crowd_check", course.id] });
  }

  const byId = Object.fromEntries(assignments.map((a) => [a.id, a]));
  const compared = rows.filter((r) => r.classmates > 0);
  const flags = compared.filter(
    (r) => r.common_date && r.agree < r.classmates - r.agree,
  );

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-primary" />
        Classmate check
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Enter your class details. If classmates in the same section use chuggCal, we'll flag dates
        that don't match theirs. Nobody sees who you are.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <Input placeholder="Course # (BIO 101)" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} />
        <Input placeholder="School" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
        <Input placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
        <Input placeholder="Professor (optional)" value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} />
        <Button size="sm" variant="outline" onClick={save}>Save</Button>
      </div>
      {ready ? (
        <div className="mt-3 text-xs">
          {compared.length === 0 ? (
            <p className="text-muted-foreground">No classmates in this section yet.</p>
          ) : flags.length === 0 ? (
            <p className="text-primary">✓ Your dates match your classmates' on {compared.length} item{compared.length === 1 ? "" : "s"}.</p>
          ) : (
            <ul className="space-y-1">
              {flags.map((r) => (
                <li key={r.assignment_id} className="text-destructive">
                  ⚠ {byId[r.assignment_id]?.title}: most classmates have{" "}
                  {new Date(r.common_date + "T12:00").toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
