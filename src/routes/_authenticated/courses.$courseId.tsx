import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery } from "@/lib/db";
import { ImportPanel } from "@/components/ImportPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Trash2 } from "lucide-react";
import { summarizeGrade, letterGrade, parseWeight } from "@/lib/grade";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Import Assignments — ChuggCal" },
      {
        name: "description",
        content:
          "Upload a syllabus PDF or an assignment screenshot to add this course's due dates automatically.",
      },
      { property: "og:title", content: "Import Assignments — ChuggCal" },
      {
        property: "og:description",
        content:
          "Upload a syllabus PDF or an assignment screenshot to add this course's due dates automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: courses = [] } = useQuery(coursesQuery);
  const { data: assignments = [] } = useQuery(assignmentsQuery);

  const course = courses.find((c) => c.id === courseId);
  const items = assignments.filter((a) => a.course_id === courseId);

  async function toggle(id: string, completed: boolean) {
    await supabase.from("assignments").update({ completed }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function remove(id: string) {
    await supabase.from("assignments").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function deleteCourse() {
    await supabase.from("courses").delete().eq("id", courseId);
    await queryClient.invalidateQueries({ queryKey: ["courses"] });
    await queryClient.invalidateQueries({ queryKey: ["assignments"] });
    navigate({ to: "/courses" });
  }

  return (
    <AppShell>
      <Link
        to="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Courses
      </Link>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: course?.color ?? "#94a3b8" }}
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{course?.name ?? "Course"}</h1>
            <p className="text-sm text-muted-foreground">{course?.semester || "No semester"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={deleteCourse}>
          Delete course
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Add assignments</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Drop in a file — ChuggCal reads the due dates so you don't have to type them.
        </p>
        <ImportPanel courseId={courseId} semester={course?.semester ?? ""} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">
          Assignments <span className="text-muted-foreground">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Checkbox
                  checked={a.completed}
                  onCheckedChange={(v) => toggle(a.id, Boolean(v))}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm ${a.completed ? "text-muted-foreground line-through" : "font-medium"}`}
                  >
                    {a.title}
                  </p>
                  {a.notes && <p className="truncate text-xs text-muted-foreground">{a.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.due_date
                    ? new Date(a.due_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No due date"}
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Delete ${a.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
