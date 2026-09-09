import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertCircle, Clock, CalendarClock, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { assignmentsQuery, coursesQuery, type Assignment, type Course } from "@/lib/db";
import {
  markNotified,
  shouldNotify,
  useReminderSettings,
  type ReminderFrequency,
} from "@/lib/reminder-settings";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Accepts "YYYY-MM-DD" or a full timestamp and returns local midnight of that day. */
function dueDay(due: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const [y, m, d] = due.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  const parsed = new Date(due);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function daysUntil(due: string, today: Date): number {
  const d = dueDay(due);
  if (!d) return Number.NaN;
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

type Group = { label: string; icon: typeof Clock; items: Assignment[]; className: string };

/** Bell in the header with overdue and coming-due assignments across all courses. */
export function RemindersBell() {
  const { data: assignments = [] } = useQuery(assignmentsQuery);
  const { data: courses = [] } = useQuery(coursesQuery);
  const { settings, update } = useReminderSettings();
  const [showSettings, setShowSettings] = useState(false);
  const courseById = new Map<string, Course>(courses.map((c) => [c.id, c]));

  const today = startOfToday();
  const pending = assignments.filter((a) => a.due_date && !a.completed);

  const groups: Group[] = [
    { label: "Overdue", icon: AlertCircle, items: [], className: "text-destructive" },
    { label: "Due today", icon: Clock, items: [], className: "text-amber-600" },
    { label: "Due tomorrow", icon: CalendarClock, items: [], className: "text-muted-foreground" },
    {
      label: `Next ${settings.leadDays} days`,
      icon: CalendarClock,
      items: [],
      className: "text-muted-foreground",
    },
  ];
  for (const a of pending) {
    const d = daysUntil(a.due_date!, today);
    if (Number.isNaN(d)) continue;
    const idx = d < 0 ? 0 : d === 0 ? 1 : d === 1 ? 2 : d <= settings.leadDays ? 3 : -1;
    if (idx >= 0) groups[idx]?.items.push(a);
  }

  const urgent = (groups[0]?.items.length ?? 0) + (groups[1]?.items.length ?? 0);
  const hasAny = groups.some((g) => g.items.length > 0);
  const dueCount = groups.reduce((n, g) => n + g.items.length, 0);

  // Browser notifications on the chosen schedule.
  useEffect(() => {
    if (settings.frequency === "off" || typeof Notification === "undefined") return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      if (dueCount === 0 || !shouldNotify(settings)) return;
      new Notification("ChuggCal reminders", {
        body: `${dueCount} assignment${dueCount === 1 ? "" : "s"} due soon${urgent > 0 ? ` (${urgent} urgent)` : ""}.`,
      });
      markNotified();
    };
    tick();
    const id = window.setInterval(tick, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [settings, dueCount, urgent]);

  const setFrequency = async (frequency: ReminderFrequency) => {
    if (frequency !== "off" && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    update({ frequency });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="Due-date reminders">
          <Bell className="h-4 w-4" />
          {urgent > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {urgent}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">Reminders</div>
        {!hasAny ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nothing due in the next week. You're all caught up.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {groups.map(({ label, icon: Icon, items, className }) =>
              items.length === 0 ? null : (
                <div key={label} className="px-2 py-1">
                  <div className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  {items.map((a) => (
                    <AssignmentDetailDialog key={a.id} assignment={a} course={courseById.get(a.course_id)}>
                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: courseById.get(a.course_id)?.color ?? "#94a3b8" }}
                        />
                        <span className="truncate">{a.title}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {dueDay(a.due_date!)?.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </button>
                    </AssignmentDetailDialog>
                  ))}
                </div>
              ),
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
