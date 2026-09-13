import { Link } from "@tanstack/react-router";
import { AlertTriangle, Briefcase, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { AssignmentTypeIcon } from "@/lib/assignment-type";
import { shiftRangeLabel, type Assignment, type Course, type WorkShift } from "@/lib/db";

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Phone-friendly stand-in for the month grid: one scrollable column of days
 * that actually have something on them, so nothing gets squeezed into a cell.
 */
export function AgendaView({
  days,
  map,
  shiftMap,
  conflictDays,
  byCourse,
  isEmpty,
}: {
  days: Date[];
  map: Record<string, Assignment[]>;
  shiftMap: Record<string, WorkShift[]>;
  conflictDays: Record<string, string>;
  byCourse: Record<string, Course | undefined>;
  isEmpty: boolean;
}) {
  const today = new Date();
  const todayKey = dayKey(today);

  const rows = days
    .map((d) => {
      const key = dayKey(d);
      return {
        d,
        key,
        items: map[key] ?? [],
        shifts: shiftMap[key] ?? [],
        conflict: conflictDays[key],
      };
    })
    .filter((r) => r.items.length || r.shifts.length || r.key === todayKey);

  if (isEmpty) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="font-display text-xl font-semibold tracking-tight">
          This could be your semester
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop in a syllabus or a screenshot and every due date lands here.
        </p>
        <Link to="/courses">
          <Button className="mt-4" size="sm">
            <Upload className="h-4 w-4" />
            Import my first syllabus
          </Button>
        </Link>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing scheduled in this stretch. Swipe sideways to look ahead.
      </div>
    );
  }

  return (
    <ul className="mt-5 space-y-2">
      {rows.map(({ d, key, items, shifts, conflict }) => {
        const isToday = key === todayKey;
        return (
          <li
            key={key}
            className={`flex gap-3 rounded-xl border bg-card p-3 ${
              isToday ? "border-primary" : "border-border"
            }`}
          >
            <div className="w-11 shrink-0 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p
                className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-medium ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {d.getDate()}
              </p>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {conflict ? (
                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {conflict}
                </p>
              ) : null}
              {items.length === 0 && shifts.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">Nothing due today</p>
              ) : null}
              {items.map((a) => (
                <AssignmentDetailDialog key={a.id} assignment={a} course={byCourse[a.course_id]}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white ${
                      a.completed ? "opacity-60" : ""
                    }`}
                    style={{ backgroundColor: byCourse[a.course_id]?.color ?? "#94a3b8" }}
                  >
                    {a.completed ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AssignmentTypeIcon type={a.type} />
                    )}
                    <span className={`truncate ${a.completed ? "line-through" : ""}`}>
                      {a.title}
                    </span>
                    <span className="ml-auto shrink-0 truncate text-[11px] opacity-80">
                      {byCourse[a.course_id]?.name ?? ""}
                    </span>
                  </button>
                </AssignmentDetailDialog>
              ))}
              {shifts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-slate-400 bg-slate-500/10 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {shiftRangeLabel(s)}
                    {s.location ? ` · ${s.location}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
