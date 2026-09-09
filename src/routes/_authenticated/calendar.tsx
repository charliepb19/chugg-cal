import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Assignment Calendar — ChuggCal" },
      {
        name: "description",
        content: "A month view of every assignment across your courses, colour-coded by course.",
      },
      { property: "og:title", content: "Assignment Calendar — ChuggCal" },
      {
        property: "og:description",
        content: "A month view of every assignment across your courses, colour-coded by course.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarPage() {
  const { data: courses = [] } = useQuery(coursesQuery);
  const { data: assignments = [] } = useQuery(assignmentsQuery);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const byCourse = Object.fromEntries(courses.map((c) => [c.id, c]));

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const map = useMemo(() => {
    const m: Record<string, typeof assignments> = {};
    for (const a of assignments) {
      if (!a.due_date) continue;
      const d = new Date(a.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (m[key] ??= []).push(a);
    }
    return m;
  }, [assignments]);

  const today = new Date();

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h1>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {courses.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const items = map[key] ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div
                key={i}
                className={`min-h-24 border-b border-r border-border p-1.5 last:border-r-0 ${
                  inMonth ? "" : "bg-muted/30"
                }`}
              >
                <div
                  className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      title={`${a.title} · ${byCourse[a.course_id]?.name ?? ""}`}
                      className="truncate rounded px-1.5 py-0.5 text-[11px] leading-tight text-white"
                      style={{ backgroundColor: byCourse[a.course_id]?.color ?? "#94a3b8" }}
                    >
                      {a.title}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
