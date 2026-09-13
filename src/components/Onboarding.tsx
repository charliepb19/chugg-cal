import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, Upload, CalendarDays } from "lucide-react";
import { COURSE_COLORS, type Course, type Assignment } from "@/lib/db";
import { toast } from "sonner";

const DISMISS_KEY = "chuggcal-onboarding-dismissed";

export function isOnboardingDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

type StepProps = {
  index: number;
  done: boolean;
  active: boolean;
  title: string;
  children?: React.ReactNode;
};

function Step({ index, done, active, title, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span
        className={[
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : active
              ? "border-primary text-primary"
              : "border-border text-muted-foreground",
        ].join(" ")}
      >
        {done ? <Check className="h-4 w-4" /> : index}
      </span>
      <div className="min-w-0 flex-1 pb-5">
        <p
          className={[
            "text-sm font-medium",
            done ? "text-muted-foreground line-through" : "",
          ].join(" ")}
        >
          {title}
        </p>
        {active && !done ? <div className="mt-3">{children}</div> : null}
      </div>
    </li>
  );
}

export function Onboarding({
  courses,
  assignments,
}: {
  courses: Course[];
  assignments: Assignment[];
}) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(() => isOnboardingDismissed());
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [busy, setBusy] = useState(false);

  const hasCourse = courses.length > 0;
  const hasAssignments = assignments.length > 0;

  if (dismissed || (hasCourse && hasAssignments)) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out");
      const { error } = await supabase.from("courses").insert({
        user_id: userId,
        name,
        semester,
        color: COURSE_COLORS[courses.length % COURSE_COLORS.length] ?? "#2563eb",
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
      setName("");
      setSemester("");
      toast.success("Course added. Now drop in its syllabus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create course");
    } finally {
      setBusy(false);
    }
  }

  const firstCourse = courses[0];

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Set up your semester
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Three steps and your whole term is on the calendar.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Skip
        </Button>
      </div>

      <ol className="mt-6">
        <Step index={1} done={hasCourse} active={!hasCourse} title="Add your first course">
          <form onSubmit={createCourse} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ob-name">Course name</Label>
              <Input
                id="ob-name"
                required
                placeholder="Intro to Psychology"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-40">
              <Label htmlFor="ob-sem">Semester</Label>
              <Input
                id="ob-sem"
                placeholder="Fall 2026"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Add course
            </Button>
          </form>
        </Step>

        <Step
          index={2}
          done={hasAssignments}
          active={hasCourse && !hasAssignments}
          title="Drop in the syllabus or a screenshot"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ChuggCal reads the dates, types and grade weights for you — you just review them.
            </p>
            {firstCourse ? (
              <Link to="/courses/$courseId" params={{ courseId: firstCourse.id }}>
                <Button size="sm">
                  <Upload className="h-4 w-4" />
                  Import into {firstCourse.name}
                </Button>
              </Link>
            ) : null}
          </div>
        </Step>

        <Step
          index={3}
          done={false}
          active={hasCourse && hasAssignments}
          title="Watch your calendar fill up"
        >
          <Link to="/calendar">
            <Button size="sm" variant="secondary">
              <CalendarDays className="h-4 w-4" />
              Open the calendar
            </Button>
          </Link>
        </Step>
      </ol>
    </section>
  );
}
