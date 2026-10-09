import { AlertTriangle, CalendarClock } from "lucide-react";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { AssignmentTypeIcon } from "@/lib/assignment-type";
import type { Assignment, Course } from "@/lib/db";

function dayDiff(due: string) {
  const d = new Date(due);
  const today = new Date();
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
}

export function DueBanner({
  assignments,
  courses,
}: {
  assignments: Assignment[];
  courses: Course[];
}) {
  const byCourse = Object.fromEntries(courses.map((c) => [c.id, c]));
  const open = assignments.filter((a) => !a.completed && a.due_date);

  const urgent = open
    .filter((a) => dayDiff(a.due_date!) <= 0)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const thisWeek = open
    .filter((a) => {
      const d = dayDiff(a.due_date!);
      return d > 0 && d <= 7;
    })
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  if (urgent.length === 0 && thisWeek.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      {urgent.length > 0 ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Due today
            {urgent.some((a) => dayDiff(a.due_date!) < 0) ? " or overdue" : ""} —{" "}
            {urgent.length} item{urgent.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {urgent.map((a) => {
              const course = byCourse[a.course_id];
              return (
                <li key={a.id}>
                  <AssignmentDetailDialog assignment={a} course={course}>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: course?.color ?? "#94a3b8" }}
                      />
                      <AssignmentTypeIcon type={a.type} className="h-3 w-3 text-muted-foreground" />
                      {a.title}
                    </button>
                  </AssignmentDetailDialog>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {thisWeek.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Due this week — {thisWeek.length} item{thisWeek.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {thisWeek.map((a) => {
              const course = byCourse[a.course_id];
              const d = dayDiff(a.due_date!);
              return (
                <li key={a.id}>
                  <AssignmentDetailDialog assignment={a} course={course}>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: course?.color ?? "#94a3b8" }}
                      />
                      <AssignmentTypeIcon type={a.type} className="h-3 w-3 text-muted-foreground" />
                      {a.title}
                      <span className="text-muted-foreground">
                        · {d === 1 ? "tomorrow" : `in ${d}d`}
                      </span>
                    </button>
                  </AssignmentDetailDialog>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
