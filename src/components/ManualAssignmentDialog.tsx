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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseDueDateFromText } from "@/lib/parse-date";


export function ManualAssignmentDialog({
  courseId,
  semester = "",
  children,
}: {
  courseId: string;
  semester?: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "weekly" | "biweekly">("none");
  const [repeatCount, setRepeatCount] = useState("4");

  /** Read a date out of whatever the student typed, unless they set one themselves. */
  function autoDate(nextTitle: string, nextNotes: string) {
    if (dateTouched) return;
    const found =
      parseDueDateFromText(nextTitle, semester) ?? parseDueDateFromText(nextNotes, semester);
    setDueDate(found ?? "");
    setAutoFilled(Boolean(found));
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out");
      // Recurring items become one row per occurrence, numbered in the title.
      const count = repeat === "none" ? 1 : Math.max(1, Math.min(30, Math.round(Number(repeatCount) || 1)));
      const stepDays = repeat === "biweekly" ? 14 : 7;
      const rows = Array.from({ length: count }, (_, i) => {
        let due: string | null = null;
        if (dueDate) {
          const d = new Date(`${dueDate}T23:59:00`);
          d.setDate(d.getDate() + i * stepDays);
          due = d.toISOString();
        }
        return {
          user_id: userId,
          course_id: courseId,
          title: count > 1 ? `${title} ${i + 1}` : title,
          notes,
          due_date: due,
          source: "manual",
          confirmed: true,
        };
      });
      const { error } = await supabase.from("assignments").insert(rows);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setTitle("");
      setDueDate("");
      setNotes("");
      setDateTouched(false);
      setAutoFilled(false);
      setRepeat("none");
      setRepeatCount("4");
      setOpen(false);
      toast.success(count > 1 ? `${count} assignments added.` : "Assignment added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add assignment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an assignment by hand</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input
              id="m-title"
              required
              placeholder="e.g. Essay 2 due Oct 3"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                autoDate(e.target.value, notes);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-due">Due date</Label>
            <Input
              id="m-due"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDateTouched(true);
                setAutoFilled(false);
                setDueDate(e.target.value);
              }}
            />
            {autoFilled && (
              <p className="text-xs text-muted-foreground">
                Filled in from what you typed — change it if it&apos;s wrong.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-repeat">Repeats</Label>
            <div className="flex gap-2">
              <select
                id="m-repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as "none" | "weekly" | "biweekly")}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="none">Just once</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every two weeks</option>
              </select>
              {repeat !== "none" && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(e.target.value)}
                    aria-label="How many times"
                    className="h-9 w-16 text-right"
                  />
                  <span className="text-xs text-muted-foreground">times</span>
                </div>
              )}
            </div>
            {repeat !== "none" && (
              <p className="text-xs text-muted-foreground">
                Each one gets its own due date, a {repeat === "weekly" ? "week" : "two weeks"} apart.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea
              id="m-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                autoDate(title, e.target.value);
              }}
            />
          </div>

          <Button type="submit" disabled={busy} className="w-full">
            Add assignment
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
