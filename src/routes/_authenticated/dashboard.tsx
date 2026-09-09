import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload } from "lucide-react";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { AssignmentTypeIcon } from "@/lib/assignment-type";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Upcoming Assignments — ChuggCal" },
      {
        name: "description",
        content: "Every upcoming assignment across your courses, sorted by due date.",
      },
      { property: "og:title", content: "Upcoming Assignments — ChuggCal" },
      {
        property: "og:description",
        content: "Every upcoming assignment across your courses, sorted by due date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function formatDue(due: string | null) {
  if (!due) return "No due date";
  const d = new Date(due);
  const today = new Date();
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
  const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (days === 0) return `${label} · today`;
  if (days === 1) return `${label} · tomorrow`;
  if (days < 0) return `${label} · ${Math.abs(days)}d overdue`;
  return `${label} · in ${days}d`;
}

function Dashboard() {
  const queryClient = useQueryClient();
  const { data: courses = [] } = useQuery(coursesQuery);
  const { data: assignments = [], isLoading } = useQuery(assignmentsQuery);

  const byCourse = Object.fromEntries(courses.map((c) => [c.id, c]));
  const open = assignments.filter((a) => !a.completed);

  async function toggle(id: string, completed: boolean) {
    await supabase.from("assignments").update({ completed }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upcoming</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {open.length} assignment{open.length === 1 ? "" : "s"} still to do
          </p>
        </div>
        <Link to="/courses">
          <Button size="sm">
            <Upload className="h-4 w-4" />
            Import assignments
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : open.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">Nothing due yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a course, then upload its syllabus or an assignment screenshot.
          </p>
          <Link to="/courses">
            <Button className="mt-4" size="sm">
              Go to courses
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {open.map((a) => {
            const course = byCourse[a.course_id];
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Checkbox
                  checked={a.completed}
                  onCheckedChange={(v) => toggle(a.id, Boolean(v))}
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: course?.color ?? "#94a3b8" }}
                />
                <AssignmentDetailDialog assignment={a} course={course}>
                  <button type="button" className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <AssignmentTypeIcon type={a.type} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{a.title}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {course?.name ?? "Course"}
                      {a.notes ? ` · ${a.notes}` : ""}
                    </p>
                  </button>
                </AssignmentDetailDialog>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDue(a.due_date)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
