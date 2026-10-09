import type { Assignment, Course, GradeCategory } from "@/lib/db";
import { gradeInsurance } from "@/lib/insights";
import { ShieldCheck } from "lucide-react";

export function GradeInsuranceCard({
  assignments,
  courses,
  categories,
}: {
  assignments: Assignment[];
  courses: Course[];
  categories: GradeCategory[];
}) {
  const picks = gradeInsurance(assignments, courses, categories);
  if (!picks.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Grade insurance</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The cheapest thing you could skip in each course without dropping a letter grade.
      </p>
      <ul className="mt-2 space-y-1.5">
        {picks.map((p) => (
          <li key={p.assignment.id} className="text-sm">
            <span className="font-medium">{p.courseName}:</span>{" "}
            <span className="text-muted-foreground">
              skipping “{p.assignment.title}” ({p.weight}%) keeps you at a {p.letterNow} (
              {p.currentGrade}% → {p.gradeIfSkipped}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
