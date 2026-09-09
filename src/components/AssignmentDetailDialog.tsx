import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Assignment, Course } from "@/lib/db";
import { letterGrade } from "@/lib/grade";

/**
 * Tap any assignment to see its details — including the grade you received,
 * what it's worth toward the course, and a place to enter or fix the mark.
 */
export function AssignmentDetailDialog({
  assignment,
  course,
  weight,
  children,
}: {
  assignment: Assignment;
  course?: Course | undefined;
  /** Effective % of the final grade this item is worth, when known. */
  weight?: number | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(assignment.score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [extraCredit, setExtraCredit] = useState(assignment.extra_credit);

  const hasScore = assignment.score !== null && assignment.score !== undefined;
  const contribution =
    hasScore && weight ? Math.round(((assignment.score! / 100) * weight) * 100) / 100 : null;

  async function saveScore() {
    const trimmed = score.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      toast.error("Enter a mark between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("assignments")
        .update({ score: value })
        .eq("id", assignment.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success(value === null ? "Mark cleared." : "Mark saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleExtraCredit(next: boolean) {
    setExtraCredit(next);
    const { error } = await supabase
      .from("assignments")
      .update({ extra_credit: next })
      .eq("id", assignment.id);
    if (error) {
      setExtraCredit(!next);
      toast.error("Couldn't update this one. Please try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["assignments"] });
    toast.success(next ? "Marked as extra credit." : "No longer extra credit.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{assignment.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: course?.color ?? "#94a3b8" }}
            />
            <span>{course?.name ?? "Course"}</span>
            <span className="capitalize">· {assignment.type}</span>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Due</p>
            <p className="mt-0.5">
              {assignment.due_date
                ? new Date(assignment.due_date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No due date"}
            </p>
          </div>

          {assignment.category && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Grading category</p>
              <p className="mt-0.5">{assignment.category}</p>
            </div>
          )}

          <label className="flex items-start gap-2 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={extraCredit}
              onChange={(e) => toggleExtraCredit(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-medium">Extra credit</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Bonus points added on top — this one won't count toward the course total.
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-end justify-between gap-4">
              <p className="text-xs font-medium text-muted-foreground">Grade received</p>
              {hasScore ? (
                <p className="text-2xl font-semibold tabular-nums">
                  {assignment.score}%
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {letterGrade(assignment.score!)}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Not graded yet</p>
              )}
            </div>
            {contribution !== null && weight != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {extraCredit
                  ? `Bonus worth up to ${weight}% — this mark adds ${contribution} extra points.`
                  : `Worth ${weight}% of the course — this mark earns ${contribution} of those points.`}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Enter mark"
                aria-label={`Mark for ${assignment.title}`}
                className="h-8 w-28 text-right"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveScore();
                }}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <button
                type="button"
                onClick={saveScore}
                disabled={saving}
                className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save mark"}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note — readings, page numbers, what to bring…"
              aria-label={`Notes for ${assignment.title}`}
              className="mt-1 min-h-20 text-sm"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={saveNotes}
                disabled={savingNotes || notes === (assignment.notes ?? "")}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {savingNotes ? "Saving…" : "Save note"}
              </button>
              {notes !== (assignment.notes ?? "") && (
                <button
                  type="button"
                  onClick={() => setNotes(assignment.notes ?? "")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
