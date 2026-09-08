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
