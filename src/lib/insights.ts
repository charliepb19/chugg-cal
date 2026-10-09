import type { Assignment, Course, GradeCategory } from "@/lib/db";
import { computeWeights, summarizeGrade, letterGrade } from "@/lib/grade";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = startOfDay(new Date(dateStr));
  return Math.round((d.getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

// ---------- Study debt ----------

export type DebtItem = {
  assignment: Assignment;
  daysOverdue: number;
};

export type StudyDebt = {
  items: DebtItem[];
  /** Total percentage points of course grades sitting overdue. */
  totalWeight: number;
};

/** Overdue, unfinished work — the "debt" you owe before you can move on. */
export function studyDebt(
  assignments: Assignment[],
  categories: GradeCategory[],
): StudyDebt {
  const overdue = assignments.filter((a) => {
    if (a.completed) return false;
    const days = daysFromNow(a.due_date);
    return days !== null && days < 0;
  });
  const weights = computeWeights(overdue, categories.map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item })));
  let totalWeight = 0;
  const items = overdue.map((a, i) => {
    const w = weights[i];
    if (w && !a.extra_credit) totalWeight += w;
    return { assignment: a, daysOverdue: Math.abs(daysFromNow(a.due_date)!) };
  });
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { items, totalWeight: Math.round(totalWeight * 10) / 10 };
}

// ---------- Panic score ----------

export type PanicScore = {
  /** 0–100: how intense the next 7 days are. */
  score: number;
  label: string;
  reasons: string[];
};

/**
 * A single daily number combining how much grade weight is due in the next
 * week, how soon it hits, and how shaky your standing is in those courses.
 */
export function panicScore(
  assignments: Assignment[],
  courses: Course[],
  categories: GradeCategory[],
): PanicScore {
  const upcoming = assignments.filter((a) => {
    if (a.completed) return false;
    const days = daysFromNow(a.due_date);
    return days !== null && days >= 0 && days <= 7;
  });
  if (!upcoming.length) {
    return { score: 0, label: "Calm", reasons: ["Nothing due in the next 7 days."] };
  }

  const cats = categories.map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item }));
  const weights = computeWeights(upcoming, cats);
  const byCourse = new Map<string, Course>(courses.map((c) => [c.id, c]));

  let score = 0;
  const reasons: string[] = [];
  let weightDue = 0;

  for (const [i, a] of upcoming.entries()) {
    const days = daysFromNow(a.due_date)!;
    const w = weights[i] ?? 0;
    if (!a.extra_credit) weightDue += w;
    // Base pressure per item: sooner = worse.
    let pressure = days === 0 ? 18 : days === 1 ? 14 : days <= 3 ? 9 : 5;
    // Exams and quizzes add pressure.
    if (a.type === "exam") pressure += 12;
    else if (a.type === "quiz") pressure += 6;
    // Heavy items add pressure.
    if (w >= 15) pressure += 14;
    else if (w >= 5) pressure += 7;
    // Shaky standing in this course adds pressure.
    const courseItems = assignments.filter((x) => x.course_id === a.course_id);
    const courseCats = categories
      .filter((c) => c.course_id === a.course_id)
      .map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item }));
    const summary = summarizeGrade(courseItems, courseCats);
    if (summary.current !== null && summary.current < 75) {
      pressure += 8;
      const course = byCourse.get(a.course_id);
      if (course && w >= 5) {
        reasons.push(
          `${a.title} (${course.name}) is worth ${w}% and you're at ${Math.round(summary.current)}% there.`,
        );
      }
    } else if (w >= 15) {
      const course = byCourse.get(a.course_id);
      reasons.push(`${a.title}${course ? ` (${course.name})` : ""} is worth ${w}% of the grade.`);
    }
    score += pressure;
  }

  if (weightDue >= 20) {
    reasons.unshift(`${Math.round(weightDue)}% of your grades is decided in the next 7 days.`);
  }

  score = Math.min(100, Math.round(score));
  const label = score >= 70 ? "Critical" : score >= 45 ? "High" : score >= 20 ? "Moderate" : "Calm";
  return { score, label, reasons: reasons.slice(0, 3) };
}

// ---------- Grade insurance ----------

export type InsurancePick = {
  assignment: Assignment;
  weight: number;
  courseName: string;
  currentGrade: number;
  /** Projected final grade if this item is scored 0. */
  gradeIfSkipped: number;
  letterNow: string;
  letterIfSkipped: string;
  safe: boolean;
};

/**
 * The cheapest assignment you could skip in each course without dropping a
 * letter grade — assuming you keep scoring at your current average on the rest.
 */
export function gradeInsurance(
  assignments: Assignment[],
  courses: Course[],
  categories: GradeCategory[],
): InsurancePick[] {
  const picks: InsurancePick[] = [];
  const byCourse = new Map<string, Course>(courses.map((c) => [c.id, c]));

  for (const course of courses) {
    const items = assignments.filter((a) => a.course_id === course.id);
    const cats = categories
      .filter((c) => c.course_id === course.id)
      .map((c) => ({ name: c.name, percent: c.weight, perItem: c.per_item }));
    const summary = summarizeGrade(items, cats);
    if (summary.current === null || summary.current < 60) continue;

    const weights = computeWeights(items, cats);
    // Candidates: ungraded, unfinished, weighted, non-extra-credit work.
    const candidates = items
      .map((a, i) => ({ a, w: weights[i] ?? 0 }))
      .filter(
        ({ a, w }) =>
          w > 0 && !a.extra_credit && a.score === null && !a.completed,
      );
    if (!candidates.length) continue;

    // Current average on graded work is our stand-in for future performance.
    const avg = summary.current;
    const remainingWeight = summary.totalWeight - summary.gradedWeight;
    if (remainingWeight <= 0) continue;

    // Projected final = earned so far + avg on everything else, with the
    // skipped item scored 0.
    const projected = (skipWeight: number): number => {
      const earned = (avg / 100) * summary.gradedWeight;
      const rest = remainingWeight - skipWeight;
      const future = rest > 0 ? (avg / 100) * rest : 0;
      const total = summary.totalWeight > 0 ? summary.totalWeight : 100;
      return ((earned + future) / total) * 100;
    };

    // Cheapest skip: smallest weight that keeps the same letter grade.
    const letterNow = letterGrade(avg);
    const sorted = [...candidates].sort((x, y) => x.w - y.w);
    const pick = sorted.find(({ w }) => letterGrade(projected(w)) === letterNow);
    if (!pick) continue;

    const gradeIfSkipped = Math.round(projected(pick.w) * 10) / 10;
    picks.push({
      assignment: pick.a,
      weight: pick.w,
      courseName: course.name,
      currentGrade: Math.round(avg * 10) / 10,
      gradeIfSkipped,
      letterNow,
      letterIfSkipped: letterGrade(gradeIfSkipped),
      safe: true,
    });
  }
  return picks;
}
