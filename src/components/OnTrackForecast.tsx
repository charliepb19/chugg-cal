import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { gradeCategoriesQuery, type Assignment, type Course } from "@/lib/db";
import { letterGrade, resolveCategories, summarizeGrade } from "@/lib/grade";

const TARGETS = [90, 80, 70];

function r(n: number) {
  return Math.round(n * 10) / 10;
}

export function OnTrackForecast({
  assignments,
  courses,
}: {
  assignments: Assignment[];
  courses: Course[];
}) {
  const { data: categories = [] } = useQuery(gradeCategoriesQuery);

  const rows = courses
    .map((course) => {
      const cats = categories
        .filter((c) => c.course_id === course.id)
        .map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item }));
      const items = resolveCategories(
        assignments.filter((a) => a.course_id === course.id),
        cats,
      );
      const g = summarizeGrade(items, cats);
      if (g.current === null || g.totalWeight <= 0) return null;
      const total = Math.max(g.totalWeight, 100);
      const remaining = Math.max(0, total - g.gradedWeight);
      const earnedPts = (g.current / 100) * g.gradedWeight;
      // At current pace, remaining work scores the same as graded work so far.
      const projected = g.current;
      const progress = Math.min(100, (g.gradedWeight / total) * 100);
      // Lowest letter target still reachable, with the average needed on the rest.
      const goal = TARGETS.map((t) => ({
        t,
        need: remaining > 0 ? ((t / 100) * total - earnedPts) / remaining * 100 : null,
      })).find((x) => x.need !== null && x.need <= 100);
      return { course, projected, progress, remaining, goal };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (rows.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <TrendingUp className="h-4 w-4 text-primary" />
        Am I on track?
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Where each course ends up if you keep scoring the way you have so far.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map(({ course, projected, progress, remaining, goal }) => {
          const tone =
            projected >= 80 ? "text-primary" : projected >= 70 ? "text-foreground" : "text-destructive";
          return (
            <li key={course.id}>
              <Link
                to="/courses/$courseId"
                params={{ courseId: course.id }}
                className="block rounded-lg p-2 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: course.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{course.name}</span>
                  <span className={`text-sm font-semibold ${tone}`}>
                    {r(projected)}% · {letterGrade(projected)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.round(progress)}% of the course graded
                  {remaining > 0 && goal
                    ? ` · average ${Math.max(0, Math.round(goal.need!))}% on the rest for a ${letterGrade(goal.t)}`
                    : remaining > 0
                      ? " · a C is out of reach on the remaining work"
                      : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
