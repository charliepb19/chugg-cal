import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
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
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

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
                className={`min-h-24 border-b border-r border-border p-1.5 transition-colors last:border-r-0 ${
                  inMonth ? "" : "bg-muted/30"
                } ${dragOverKey === key ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""}`}
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
                        {a.completed && <Check className="h-3 w-3 shrink-0" />}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
