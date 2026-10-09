import type { Assignment, Course, GradeCategory } from "@/lib/db";
import { panicScore } from "@/lib/insights";
import { Flame, Wind, AlertTriangle, Thermometer } from "lucide-react";

const STYLES = {
  Calm: { icon: Wind, ring: "border-border", text: "text-muted-foreground", bar: "bg-primary" },
  Moderate: { icon: Thermometer, ring: "border-amber-500/40", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  High: { icon: AlertTriangle, ring: "border-orange-500/50", text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
  Critical: { icon: Flame, ring: "border-destructive/60", text: "text-destructive", bar: "bg-destructive" },
} as const;

export function PanicScoreCard({
  assignments,
  courses,
  categories,
}: {
  assignments: Assignment[];
  courses: Course[];
  categories: GradeCategory[];
}) {
  const { score, label, reasons } = panicScore(assignments, courses, categories);
  const style = STYLES[label as keyof typeof STYLES] ?? STYLES.Calm;
  const Icon = style.icon;

  return (
    <div className={`rounded-xl border ${style.ring} bg-card p-4`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${style.text}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Panic score: <span className={style.text}>{label}</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${score}%` }} />
          </div>
        </div>
        <span className={`text-lg font-semibold tabular-nums ${style.text}`}>{score}</span>
      </div>
      {reasons.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {reasons.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
