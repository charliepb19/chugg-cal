import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery, workShiftsQuery, shiftRangeLabel } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight, EyeOff, Briefcase, AlertTriangle } from "lucide-react";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { AssignmentTypeIcon } from "@/lib/assignment-type";

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
  const { data: shifts = [] } = useQuery(workShiftsQuery);
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showWork, setShowWork] = useState(false);

  async function moveAssignment(id: string, target: Date) {
    const a = assignments.find((x) => x.id === id);
    if (!a || !a.due_date) return;
    const original = new Date(a.due_date);
    if (
      original.getFullYear() === target.getFullYear() &&
      original.getMonth() === target.getMonth() &&
      original.getDate() === target.getDate()
    )
      return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    const keepsTime = /[T ]\d{2}:\d{2}/.test(a.due_date);
    const next = keepsTime
      ? `${datePart}T${pad(original.getHours())}:${pad(original.getMinutes())}:00`
      : datePart;
    const { error } = await supabase.from("assignments").update({ due_date: next }).eq("id", id);
    if (error) {
      toast.error("Couldn't move that assignment. Please try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["assignments"] });
    toast.success(
      `Moved "${a.title}" to ${target.toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`,
    );
  }

  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  });

  const byCourse = Object.fromEntries(courses.map((c) => [c.id, c]));

  const days = useMemo(() => {
    const start =
      view === "month"
        ? (() => {
            const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            const s = new Date(first);
            s.setDate(1 - first.getDay());
            return s;
          })()
        : (() => {
            const s = new Date(cursor);
            s.setDate(cursor.getDate() - cursor.getDay());
            return s;
          })();
    return Array.from({ length: view === "month" ? 42 : 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor, view]);

  function shift(dir: 1 | -1) {
    setCursor((c) => {
      const d = new Date(c);
      if (view === "month") d.setMonth(c.getMonth() + dir, 1);
      else d.setDate(c.getDate() + dir * 7);
      return d;
    });
  }

  const filtered = useMemo(
    () =>
      assignments.filter(
        (a) =>
          (selectedCourses.size === 0 || selectedCourses.has(a.course_id)) &&
          (!hideCompleted || !a.completed),
      ),
    [assignments, selectedCourses, hideCompleted],
  );

  const map = useMemo(() => {
    const m: Record<string, typeof assignments> = {};
    for (const a of filtered) {
      if (!a.due_date) continue;
      const d = new Date(a.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (m[key] ??= []).push(a);
    }
    return m;
  }, [filtered]);

  // Work shifts keyed the same way as assignments, so a day cell can show both.
  const shiftMap = useMemo(() => {
    const m: Record<string, typeof shifts> = {};
    if (!showWork) return m;
    for (const s of shifts) {
      const [y, mo, dd] = s.shift_date.split("-").map(Number);
      if (!y || !mo || !dd) continue;
      (m[`${y}-${mo - 1}-${dd}`] ??= []).push(s);
    }
    return m;
  }, [shifts, showWork]);

  // A day is a clash when school work is due while the student is on shift.
  const conflictDays = useMemo(() => {
    const out: Record<string, string> = {};
    if (!showWork) return out;
    for (const [key, dayShifts] of Object.entries(shiftMap)) {
      const items = map[key];
      if (!items?.length) continue;
      const clashes = items.filter((a) => {
        if (a.completed) return false;
        const hasTime = a.due_date ? /[T ]\d{2}:\d{2}/.test(a.due_date) : false;
        if (!hasTime) return true;
        const due = new Date(a.due_date as string);
        const mins = due.getHours() * 60 + due.getMinutes();
        return dayShifts.some((s) => {
          const toMin = (t: string) => {
            const m2 = /^(\d{1,2}):(\d{2})$/.exec(t);
            return m2 ? Number(m2[1]) * 60 + Number(m2[2]) : null;
          };
          const start = toMin(s.start_time);
          const end = toMin(s.end_time);
          if (start === null || end === null) return true;
          return end >= start ? mins >= start && mins <= end : mins >= start || mins <= end;
        });
      });
      if (clashes.length) {
        out[key] = `Work shift clashes with ${clashes.map((c) => c.title).join(", ")}`;
      }
    }
    return out;
  }, [shiftMap, map, showWork]);

  const today = new Date();

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {view === "month"
            ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
            : `${days[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6]?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
        </h1>
        <div className="flex items-center gap-1">
          <div className="mr-1 flex rounded-full border border-border p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
            }
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filter:</span>
          <button
            type="button"
            onClick={() => setSelectedCourses(new Set())}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selectedCourses.size === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            All courses
          </button>
          {courses.map((c) => {
            const active = selectedCourses.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setSelectedCourses((prev) => {
                    const next = new Set(prev);
                    if (active) next.delete(c.id);
                    else next.add(c.id);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setHideCompleted((v) => !v)}
            aria-pressed={hideCompleted}
            className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              hideCompleted
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <EyeOff className="h-3 w-3" />
            Hide completed
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowWork((v) => !v)}
          aria-pressed={showWork}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
            showWork
              ? "border-slate-500 bg-slate-600 text-white"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="h-3 w-3" />
          Show work schedule
        </button>
        {showWork && Object.keys(conflictDays).length > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {Object.keys(conflictDays).length} day
            {Object.keys(conflictDays).length === 1 ? "" : "s"} where work overlaps school work
          </span>
        )}
      </div>



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
            const dayShifts = shiftMap[key] ?? [];
            const conflict = conflictDays[key];
            const inMonth = view === "week" || d.getMonth() === cursor.getMonth();
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div
                key={i}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId ?? e.dataTransfer.getData("text/plain");
                  setDragOverKey(null);
                  setDragId(null);
                  if (id) void moveAssignment(id, d);
                }}
                className={`${view === "week" ? "min-h-64" : "min-h-24"} border-b border-r border-border p-1.5 transition-colors last:border-r-0 ${
                  inMonth ? "" : "bg-muted/30"
                } ${dragOverKey === key ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""}`}
              >
                <div className="mb-1 flex items-center gap-1">
                  <div
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                  {conflict && (
                    <span title={conflict} aria-label={conflict}>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {(view === "week" ? items : items.slice(0, 3)).map((a) => (
                    <AssignmentDetailDialog
                      key={a.id}
                      assignment={a}
                      course={byCourse[a.course_id]}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", a.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(a.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOverKey(null);
                        }}
                        title={`${a.title} · ${byCourse[a.course_id]?.name ?? ""}${a.completed ? " · completed" : ""}`}
                        className={`flex w-full cursor-grab items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight text-white active:cursor-grabbing ${
                          a.completed ? "opacity-50" : ""
                        } ${dragId === a.id ? "opacity-40" : ""}`}
                        style={{
                          backgroundColor: byCourse[a.course_id]?.color ?? "#94a3b8",
                          ...(a.completed
                            ? {
                                backgroundImage:
                                  "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.22) 4px, rgba(255,255,255,0.22) 8px)",
                              }
                            : {}),
                        }}
                      >
                        {a.completed ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : (
                          <AssignmentTypeIcon type={a.type} />
                        )}
                        <span className={`truncate ${a.completed ? "line-through" : ""}`}>
                          {a.title}
                        </span>
                      </button>
                    </AssignmentDetailDialog>
                  ))}
                  {items.length > 3 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{items.length - 3} more
                    </div>
                  )}
                  {dayShifts.slice(0, 2).map((s) => (
                    <div
                      key={s.id}
                      title={`Work${s.location ? ` · ${s.location}` : ""} · ${shiftRangeLabel(s)}`}
                      className="flex items-center gap-1 truncate rounded border border-dashed border-slate-400 bg-slate-500/10 px-1.5 py-0.5 text-[11px] leading-tight text-slate-700 dark:text-slate-200"
                    >
                      <Briefcase className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {shiftRangeLabel(s)}
                        {s.location ? ` · ${s.location}` : ""}
                      </span>
                    </div>
                  ))}
                  {dayShifts.length > 2 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{dayShifts.length - 2} more shifts
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
