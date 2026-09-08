import type { Assignment } from "@/lib/db";

/** Pull a percentage out of free text like "20%", "worth 15 %", "0.10". */
export function parseWeight(weight: string): number | null {
  if (!weight) return null;
  const pct = weight.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct?.[1]) return Number(pct[1]);
  const num = weight.match(/(\d+(?:\.\d+)?)/);
  if (!num?.[1]) return null;
  const n = Number(num[1]);
  if (!Number.isFinite(n)) return null;
  return n > 0 && n <= 1 ? n * 100 : n;
}

const TYPE_WORDS: Record<string, string[]> = {
  quiz: ["quiz", "quizzes"],
  exam: ["exam", "exams", "midterm", "final", "test"],
  reading: ["reading", "readings", "chapter"],
};

/** How many of the extracted items plausibly belong to a grading category. */
export function countForCategory(
  categoryName: string,
  items: { title: string; type: string }[],
): number {
  const name = categoryName.trim().toLowerCase();
  if (!name) return 0;
  const type = Object.keys(TYPE_WORDS).find((t) =>
    TYPE_WORDS[t]!.some((w) => name.includes(w)),
  );
  const stem = name.replace(/(es|s)$/, "");
  return items.filter(
    (i) =>
      (type && i.type === type) ||
      (stem.length > 2 && i.title.toLowerCase().includes(stem)),
  ).length;
}

/** Plain-language flags where the syllabus grading policy and the schedule disagree. */
export function categoryWarnings(
  categories: { name: string; percent: number; expectedCount?: number | null; note?: string }[],
  items: { title: string; type: string }[],
): string[] {
  const out: string[] = [];
  for (const c of categories) {
    if (!c.name.trim() || !c.percent) continue;
    const found = countForCategory(c.name, items);
    const label = `${c.name} weight of ${c.percent}%`;
    if (found === 0) {
      out.push(`We found a ${label} but no matching dates — check if any are missing.`);
    } else if (c.expectedCount && found < c.expectedCount) {
      out.push(
        `We found a ${label} and ${c.expectedCount} implied${c.note ? ` (${c.note})` : ""}, but only ${found} date${found === 1 ? "" : "s"} — check if any are missing.`,
      );
    }
  }
  return out;
}

export type GradeSummary = {
  /** Grade so far, counting only graded items. */
  current: number | null;
  /** Percentage points of the course already graded. */
  gradedWeight: number;
  /** Total weight found across all items. */
  totalWeight: number;
  gradedCount: number;
  weightedCount: number;
};

export function summarizeGrade(items: Assignment[]): GradeSummary {
  let earned = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  let gradedCount = 0;
  let weightedCount = 0;

  for (const a of items) {
    const w = parseWeight(a.weight);
    if (w === null || w <= 0) continue;
    weightedCount += 1;
    totalWeight += w;
    if (a.score !== null && a.score !== undefined) {
      earned += (a.score / 100) * w;
      gradedWeight += w;
      gradedCount += 1;
    }
  }

  return {
    current: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
    gradedWeight,
    totalWeight,
    gradedCount,
    weightedCount,
  };
}

export function letterGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 85) return "A-";
  if (pct >= 80) return "B+";
  if (pct >= 75) return "B";
  if (pct >= 70) return "B-";
  if (pct >= 65) return "C+";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}
