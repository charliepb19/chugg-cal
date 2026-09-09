import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery } from "@/lib/db";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";

export const Route = createFileRoute("/_authenticated/workload")({
  head: () => ({
    meta: [
      { title: "Workload — ChuggCal" },
      {
        name: "description",
        content: "See which weeks are busiest across all your courses.",
      },
      { property: "og:title", content: "Workload — ChuggCal" },
      {
        property: "og:description",
        content: "See which weeks are busiest across all your courses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workload,
});

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay()); // Sunday start
  return x;
}

function weekKey(d: Date) {
  const s = startOfWeek(d);
  return s.toISOString().slice(0, 10);
}

function weekLabel(key: string) {
  const start = new Date(key + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function Workload() {
  const { data: courses = [] } = useQuery(coursesQuery);
  const { data: assignments = [], isLoading } = useQuery(assignmentsQuery);

  const byCourse = Object.fromEntries(courses.map((c) => [c.id, c]));

  const weeks = new Map<string, typeof assignments>();
  for (const a of assignments) {
    if (a.completed || !a.due_date) continue;
    const d = new Date(a.due_date);
    if (isNaN(d.getTime())) continue;
    const key = weekKey(d);
    const list = weeks.get(key) ?? [];
    list.push(a);
    weeks.set(key, list);
  }

  const sortedKeys = [...weeks.keys()].sort();
  const maxCount = Math.max(0, ...sortedKeys.map((k) => weeks.get(k)!.length));
  const thisWeek = weekKey(new Date());

  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workload</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything still to do, grouped by week — spot your crunch weeks early.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : sortedKeys.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">Nothing on the horizon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you have assignments with due dates, they'll be grouped by week here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {sortedKeys.map((key) => {
            const list = weeks.get(key)!;
            const count = list.length;
            const ratio = maxCount > 0 ? count / maxCount : 0;
            const isCurrent = key === thisWeek;
            const isPast = key < thisWeek;
            return (
              <section
                key={key}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold">
                    {weekLabel(key)}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                        this week
                      </span>
                    )}
                    {isPast && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        overdue
                      </span>
                    )}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {count} due
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      ratio >= 0.75
                        ? "h-full rounded-full bg-destructive"
                        : ratio >= 0.5
                          ? "h-full rounded-full bg-primary"
                          : "h-full rounded-full bg-primary/60"
                    }
                    style={{ width: `${Math.max(8, ratio * 100)}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-1.5">
                  {list
                    .slice()
                    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
                    .map((a) => {
                      const course = byCourse[a.course_id];
                      const d = new Date(a.due_date!);
                      return (
                        <li key={a.id} className="flex items-center gap-2 text-sm">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: course?.color ?? "#94a3b8" }}
                          />
                          <AssignmentDetailDialog assignment={a} course={course}>
                            <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline">
                              {a.title}
                            </button>
                          </AssignmentDetailDialog>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {d.toLocaleDateString(undefined, { weekday: "short" })}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
