import type { Assignment, Course, GradeCategory } from "@/lib/db";
import { studyDebt } from "@/lib/insights";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { Hourglass } from "lucide-react";

export function StudyDebtCard({
  assignments,
  courses,
  categories,
}: {
  assignments: Assignment[];
  courses: Course[];
  categories: GradeCategory[];
}) {
  const debt = studyDebt(assignments, categories);
  if (!debt.items.length) return null;

  const byCourse = new Map(courses.map((c) => [c.id, c]));

  return (
    <div className="rounded-xl border border-destructive/40 bg-card p-4">
      <div className="flex items-center gap-2">
        <Hourglass className="h-4 w-4 text-destructive" />
        <p className="text-sm font-medium">
          Study debt: {debt.items.length} overdue
          {debt.totalWeight > 0 ? ` · ${debt.totalWeight}% of your grades on the line` : ""}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Clear these oldest-first to get back on track.
      </p>
      <ul className="mt-2 space-y-1">
        {debt.items.slice(0, 5).map(({ assignment, daysOverdue }) => {
          const course = byCourse.get(assignment.course_id);
          return (
            <li key={assignment.id}>
              <AssignmentDetailDialog assignment={assignment} course={course}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: course?.color ?? "#94a3b8" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{assignment.title}</span>
                  <span className="shrink-0 text-xs text-destructive">
                    {daysOverdue}d overdue
                  </span>
                </button>
              </AssignmentDetailDialog>
            </li>
          );
        })}
        {debt.items.length > 5 ? (
          <li className="px-2 text-xs text-muted-foreground">
            …and {debt.items.length - 5} more
          </li>
        ) : null}
      </ul>
    </div>
  );
}
