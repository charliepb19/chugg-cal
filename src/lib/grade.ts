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

/** Does this extracted item plausibly belong to the named grading category? */
export function matchesCategory(
  categoryName: string,
  item: { title: string; type: string },
): boolean {
  const name = categoryName.trim().toLowerCase();
  if (!name) return false;
  const type = Object.keys(TYPE_WORDS).find((t) => TYPE_WORDS[t]!.some((w) => name.includes(w)));
  const stem = name.replace(/(es|s)$/, "");
  return Boolean(
    (type && item.type === type) ||
      (stem.length > 2 && item.title.toLowerCase().includes(stem)),
  );
}

/** How many items belong to a grading category (explicit pick wins over a guess). */
export function countForCategory(
  categoryName: string,
  items: { title: string; type: string; category?: string }[],
): number {
  const name = categoryName.trim().toLowerCase();
  return items.filter((i) =>
    i.category?.trim()
      ? i.category.trim().toLowerCase() === name
      : matchesCategory(categoryName, i),
  ).length;
}


/** Best-guess grading category for an item, or "" when nothing matches. */
export function guessCategory(
  item: { title: string; type: string },
  categories: { name: string }[],
): string {
  return categories.find((c) => matchesCategory(c.name, item))?.name ?? "";
}

type WeighedItem = {
  title: string;
  type: string;
  weight?: string;
  category?: string;
  /** bonus work: earns points on top instead of counting toward the total */
  extra_credit?: boolean;
};
type CatLike = {
  name: string;
  percent: number;
  expectedCount?: number | null;
  /** true when every item in the category is worth this percentage on its own */
  perItem?: boolean | undefined;
};

/** Exams are normally worth their percentage each, not shared between them. */
export function defaultPerItem(name: string): boolean {
  return /\b(exam|exams|midterm|midterms|final|finals|test|tests)\b/i.test(name.trim());
}

type MergeableCategory = {
  name: string;
  percent: number;
  expectedCount?: number | null;
  note?: string;
  perItem?: boolean;
};

/**
 * Group name used to spot the same grading category written twice — "Exam 1",
 * "Exam #2" and "Exams" all collapse to one entry.
 */
function categoryKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[#()]/g, " ")
    .replace(/\b(no|number|part)\b/g, " ")
    .replace(/\b(i{1,3}|iv|v|one|two|three|four|five)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/(es|s)$/, "");
}

/**
 * Collapse repeated grading rows into one category. Three "Exam N — 20%" rows
 * become a single per-item Exams category worth 20% each, instead of three
 * duplicates stacking up to 60% in the breakdown list.
 */
export function mergeCategories<T extends MergeableCategory>(cats: T[]): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const c of cats) {
    const key = categoryKey(c.name) || c.name.trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(c);
  }
  return order.map((key) => {
    const group = groups.get(key)!;
    const first = group[0]!;
    if (group.length === 1) return first;
    const numbered = group.filter((c) => /\d|\b(i{1,3}|iv|v)\b/i.test(c.name));
    const pooled = group.find((c) => !/\d/.test(c.name));
    const percents = group.map((c) => c.percent);
    const allSame = percents.every((p) => p === percents[0]);
    const base = pooled ?? first;
    // Several same-sized rows (Exam 1/2/3 at 20%) mean 20% each, not 60% total.
    const perItem = base.perItem ?? (numbered.length > 1 && allSame) ?? false;
    return {
      ...base,
      name: base.name,
      percent: allSame ? percents[0]! : Math.max(...percents),
      perItem: perItem || (numbered.length > 1 && allSame),
      expectedCount:
        base.expectedCount ?? (numbered.length > 1 ? numbered.length : null),
    } as T;
  });
}

/**
 * Effective percentage of the final grade for each item.
 *
 * A category's percentage is split evenly between every item put in that
 * category, so adding another quiz automatically re-splits the quiz weight —
 * unless the category is marked per item (e.g. three exams worth 20% each).
 * A weight typed by hand on an item always wins.
 */
export function computeWeights(items: WeighedItem[], categories: CatLike[]): (number | null)[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = (item.category ?? "").trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return items.map((item) => {
    const typed = parseWeight(item.weight ?? "");
    if (typed !== null && typed > 0) return typed;
    const key = (item.category ?? "").trim().toLowerCase();
    if (!key) return null;
    const cat = categories.find((c) => c.name.trim().toLowerCase() === key);
    const count = counts.get(key) ?? 0;
    if (!cat || !cat.percent || !count) return null;
    if (cat.perItem) return Math.round(cat.percent * 100) / 100;
    return Math.round((cat.percent / count) * 100) / 100;
  });
}

/**
 * Spread each grading category's percentage across the real assignments that
 * belong to it, so a student never types a weight the syllabus already stated.
 * Per-item categories give every matching item the full percentage.
 * Existing weights are never overwritten.
 */
export function weightsFromCategories<T extends { title: string; type: string; weight: string }>(
  items: T[],
  categories: CatLike[],
): string[] {
  const out = items.map((i) => i.weight ?? "");
  for (const c of categories) {
    if (!c.name.trim() || !c.percent) continue;
    const idx = items
      .map((item, i) => (matchesCategory(c.name, item) ? i : -1))
      .filter((i) => i >= 0);
    if (!idx.length) continue;
    const count = Math.max(idx.length, c.expectedCount ?? 0);
    const each = c.perItem ? c.percent : Math.round((c.percent / count) * 100) / 100;
    if (each <= 0) continue;
    for (const i of idx) if (!out[i]?.trim()) out[i] = `${each}%`;
  }
  return out;
}


/** Plain-language flags where the syllabus grading policy and the schedule disagree. */
export function categoryWarnings(
  categories: {
    name: string;
    percent: number;
    expectedCount?: number | null | undefined;
    note?: string | undefined;
    perItem?: boolean | undefined;
  }[],
  items: { title: string; type: string }[],
): string[] {
  const out: string[] = [];
  for (const c of categories) {
    if (!c.name.trim() || !c.percent) continue;
    const found = countForCategory(c.name, items);
    const label = `${c.name} weight of ${c.percent}%${c.perItem ? " each" : ""}`;
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

export function summarizeGrade(
  items: Assignment[],
  categories: CatLike[] = [],
): GradeSummary {
  let earned = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  let gradedCount = 0;
  let weightedCount = 0;

  const weights = computeWeights(items, categories);

  for (const [i, a] of items.entries()) {
    const w = weights[i];
    if (w === null || w === undefined || w <= 0) continue;
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
