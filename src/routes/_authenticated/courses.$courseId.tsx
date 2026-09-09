import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { coursesQuery, assignmentsQuery, gradeCategoriesQuery } from "@/lib/db";
import { CategoryWeights, type CategoryRow } from "@/components/CategoryWeights";
import { ImportPanel } from "@/components/ImportPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, Trash2, Sparkles } from "lucide-react";
import { summarizeGrade, letterGrade, computeWeights, resolveCategories } from "@/lib/grade";
import { AssignmentDetailDialog } from "@/components/AssignmentDetailDialog";
import { WhatIfGrade } from "@/components/WhatIfGrade";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Import Assignments — ChuggCal" },
      {
        name: "description",
        content:
          "Upload a syllabus PDF or an assignment screenshot to add this course's due dates automatically.",
      },
      { property: "og:title", content: "Import Assignments — ChuggCal" },
      {
        property: "og:description",
        content:
          "Upload a syllabus PDF or an assignment screenshot to add this course's due dates automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: courses = [] } = useQuery(coursesQuery);
  const { data: assignments = [] } = useQuery(assignmentsQuery);
  const { data: categories = [] } = useQuery(gradeCategoriesQuery);

  const course = courses.find((c) => c.id === courseId);
  const items = assignments.filter((a) => a.course_id === courseId);

  const courseCats = categories.filter((c) => c.course_id === courseId);
  const catWeights = courseCats.map((c) => ({
    name: c.name,
    percent: c.weight,
    perItem: c.per_item,
  }));
  // An item with no category picked yet still falls into its best match.
  const effective = resolveCategories(items, catWeights);
  const grade = summarizeGrade(effective, catWeights);
  const itemWeights = computeWeights(effective, catWeights);
  const catsDetected = courseCats.some((c) => c.source !== "manual");
  const [catRows, setCatRows] = useState<CategoryRow[] | null>(null);
  const [savingCats, setSavingCats] = useState(false);
  const rows: CategoryRow[] =
    catRows ?? courseCats.map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item }));

  async function saveCategories() {
    setSavingCats(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const keep = rows.filter((r) => r.name.trim() && typeof r.percent === "number");
      await supabase.from("grade_categories").delete().eq("course_id", courseId);
      if (keep.length) {
        await supabase.from("grade_categories").insert(
          keep.map((r) => ({
            user_id: userId,
            course_id: courseId,
            name: r.name.trim(),
            weight: Number(r.percent),
            per_item: r.perItem ?? false,
            source: "manual",
          })),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["grade_categories"] });
      setCatRows(null);
      toast.success("Grading breakdown saved.");
    } finally {
      setSavingCats(false);
    }
  }


  async function toggle(id: string, completed: boolean) {
    await supabase.from("assignments").update({ completed }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function setCategory(id: string, category: string) {
    // Clearing the typed weight lets the category's percentage drive this item.
    await supabase.from("assignments").update({ category, weight: "" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function setScore(id: string, raw: string) {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) return;
    await supabase.from("assignments").update({ score: value }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function remove(id: string) {
    await supabase.from("assignments").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  }

  async function deleteCourse() {
    await supabase.from("courses").delete().eq("id", courseId);
    await queryClient.invalidateQueries({ queryKey: ["courses"] });
    await queryClient.invalidateQueries({ queryKey: ["assignments"] });
    navigate({ to: "/courses" });
  }

  return (
    <AppShell>
      <Link
        to="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Courses
      </Link>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: course?.color ?? "#94a3b8" }}
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{course?.name ?? "Course"}</h1>
            <p className="text-sm text-muted-foreground">{course?.semester || "No semester"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={deleteCourse}>
          Delete course
        </Button>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Grade so far</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {grade.gradedCount === 0
                ? "Enter a mark next to any graded item and this updates itself."
                : `Based on ${grade.gradedCount} graded item${grade.gradedCount === 1 ? "" : "s"} — ${Math.round(grade.gradedWeight)}% of the course.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums">
              {grade.current === null ? "—" : `${grade.current.toFixed(1)}%`}
            </p>
            {grade.current !== null && (
              <p className="text-xs text-muted-foreground">{letterGrade(grade.current)}</p>
            )}
          </div>
        </div>
        {effective.some((a, i) => a.score !== null && a.score !== undefined && !itemWeights[i]) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Some marked work has no grading category yet, so it isn&apos;t counted — pick a
            category next to it below.
          </p>
        )}
        {grade.weightedCount > 0 && grade.totalWeight < 99 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Only {Math.round(grade.totalWeight)}% of the course has a weight on it, so add weights
            to the rest for a full picture.
          </p>
        )}

      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">What if…</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          See where you land based on how the rest of the term goes.
        </p>
        <WhatIfGrade items={effective} weights={itemWeights} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <CategoryWeights
          rows={rows}
          onChange={setCatRows}
          detected={catsDetected}
          counts={effective.reduce<Record<string, number>>((acc, a) => {
            // Extra-credit work sits outside the course total, so skip it here.
            if (a.extra_credit) return acc;
            const key = (a.category ?? "").trim().toLowerCase();
            if (key) acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {})}
        />
        <Button size="sm" className="mt-3" onClick={saveCategories} disabled={savingCats}>
          Save breakdown
        </Button>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Add assignments</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Drop in a file — ChuggCal reads the due dates so you don't have to type them.
        </p>
        <ImportPanel courseId={courseId} semester={course?.semester ?? ""} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">
          Assignments <span className="text-muted-foreground">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {items.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Checkbox
                  checked={a.completed}
                  onCheckedChange={(v) => toggle(a.id, Boolean(v))}
                />
                <AssignmentDetailDialog
                  assignment={a}
                  course={course}
                  weight={itemWeights[i] ?? null}
                >
                  <button type="button" className="min-w-0 flex-1 text-left">
                    <p
                      className={`truncate text-sm ${a.completed ? "text-muted-foreground line-through" : "font-medium"}`}
                    >
                      {a.title}
                    </p>
                    {a.notes && <p className="truncate text-xs text-muted-foreground">{a.notes}</p>}
                  </button>
                </AssignmentDetailDialog>
                {courseCats.length > 0 && (
                  <select
                    value={effective[i]?.category ?? ""}
                    onChange={(e) => setCategory(a.id, e.target.value)}
                    aria-label={`Grading category for ${a.title}`}
                    className="hidden h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs sm:block"
                  >
                    <option value="">No category</option>
                    {courseCats.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:inline">
                  {itemWeights[i] != null ? `${itemWeights[i]}% of grade` : "No weight"}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    defaultValue={a.score ?? ""}
                    placeholder="—"
                    aria-label={`Mark for ${a.title}`}
                    className="h-8 w-20 text-right text-sm"
                    onBlur={(e) => setScore(a.id, e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.due_date
                    ? new Date(a.due_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No due date"}
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Delete ${a.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
