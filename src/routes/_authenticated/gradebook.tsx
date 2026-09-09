import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery, gradeCategoriesQuery } from "@/lib/db";
import { summarizeGrade, letterGrade, resolveCategories } from "@/lib/grade";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gradebook")({
  head: () => ({
    meta: [
      { title: "Gradebook — ChuggCal" },
      {
        name: "description",
        content: "See your mark in every course at once, with weighted percentages and totals.",
      },
      { property: "og:title", content: "Gradebook — ChuggCal" },
      {
        property: "og:description",
        content: "See your mark in every course at once, with weighted percentages and totals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gradebook,
});

function pct(n: number) {
  return `${Math.round(n * 10) / 10}%`;
}

function Gradebook() {
  const { data: courses = [], isLoading } = useQuery(coursesQuery);
  const { data: assignments = [] } = useQuery(assignmentsQuery);
  const { data: categories = [] } = useQuery(gradeCategoriesQuery);

  const rows = courses.map((course) => {
    const cats = categories
      .filter((c) => c.course_id === course.id)
      .map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item }));
    const items = resolveCategories(
      assignments.filter((a) => a.course_id === course.id),
      cats,
    );
    return { course, grade: summarizeGrade(items, cats) };
  });

  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gradebook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your mark in every course, based on the weights you've set.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No courses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a course and import its assignments to start tracking grades.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map(({ course, grade }) => (
            <li key={course.id}>
              <Link
                to="/courses/$courseId"
                params={{ courseId: course.id }}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-accent/50"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: course.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{course.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {grade.gradedCount} of {grade.weightedCount} graded ·{" "}
                    {pct(grade.gradedWeight)} of the course marked so far
                    {grade.totalWeight > 0 && ` · weights cover ${pct(grade.totalWeight)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {grade.current === null ? (
                    <p className="text-sm text-muted-foreground">No marks yet</p>
                  ) : (
                    <>
                      <p className="text-lg font-semibold tabular-nums">{pct(grade.current)}</p>
                      <p className="text-xs text-muted-foreground">
                        {letterGrade(grade.current)}
                      </p>
                    </>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {courses.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          A course mark counts only the work you've entered a score for. Open a course to add
          marks or fix its grading weights.
        </p>
      )}
    </AppShell>
  );
}
