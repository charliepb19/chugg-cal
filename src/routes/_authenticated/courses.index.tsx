import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery, COURSE_COLORS } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Your Courses — ChuggCal" },
      {
        name: "description",
        content: "Create courses and import their assignments from a syllabus PDF or screenshot.",
      },
      { property: "og:title", content: "Your Courses — ChuggCal" },
      {
        property: "og:description",
        content: "Create courses and import their assignments from a syllabus PDF or screenshot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading } = useQuery(coursesQuery);
  const { data: assignments = [] } = useQuery(assignmentsQuery);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
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
      setOpen(false);
      toast.success("Course created. Now import its assignments.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create course");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a course to import its assignments.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New course</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Course name</Label>
                <Input
                  id="c-name"
                  required
                  placeholder="Intro to Psychology"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-sem">Semester</Label>
                <Input
                  id="c-sem"
                  placeholder="Fall 2026"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Create course
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No courses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first course, then upload its syllabus.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {courses.map((c) => {
            const count = assignments.filter((a) => a.course_id === c.id).length;
            return (
              <li key={c.id}>
                <Link
                  to="/courses/$courseId"
                  params={{ courseId: c.id }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.semester || "No semester"} · {count} assignment{count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
