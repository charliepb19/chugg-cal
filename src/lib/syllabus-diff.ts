import type { Assignment } from "@/lib/db";

export type DiffStatus = "new" | "moved" | "unchanged";

export type DiffResult = {
  /** id of the existing assignment this row matches, when there is one */
  matchId: string | null;
  status: DiffStatus;
  /** previous due date (YYYY-MM-DD) when the date changed */
  previousDate: string | null;
};

/** Loose key for comparing titles across two versions of a syllabus. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an|of|for|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "2026-09-13T23:59:00Z" | "2026-09-13" -> "2026-09-13" */
export function dateOnly(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function similar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const wa = new Set(a.split(" "));
  const wb = new Set(b.split(" "));
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared >= 2 && shared / Math.max(wa.size, wb.size) >= 0.6;
}

/**
 * Compare freshly-extracted rows against what the course already has, so a
 * re-uploaded syllabus reads as "3 dates moved, 1 added" instead of doubling
 * every assignment.
 */
export function diffAgainstExisting(
  rows: { title: string; dueDate: string | null }[],
  existing: Assignment[],
): { results: DiffResult[]; dropped: Assignment[] } {
  const used = new Set<string>();
  const results = rows.map((row) => {
    const key = normalizeTitle(row.title);
    const match =
      existing.find((e) => !used.has(e.id) && normalizeTitle(e.title) === key) ??
      existing.find((e) => !used.has(e.id) && similar(normalizeTitle(e.title), key));
    if (!match) return { matchId: null, status: "new" as const, previousDate: null };
    used.add(match.id);
    const before = dateOnly(match.due_date);
    const after = row.dueDate ? dateOnly(row.dueDate) : null;
    if (before === after) return { matchId: match.id, status: "unchanged" as const, previousDate: null };
    return { matchId: match.id, status: "moved" as const, previousDate: before };
  });
  const dropped = existing.filter((e) => !used.has(e.id));
  return { results, dropped };
}

export function diffSummary(results: DiffResult[], dropped: number): string {
  const moved = results.filter((r) => r.status === "moved").length;
  const added = results.filter((r) => r.status === "new").length;
  const parts: string[] = [];
  if (moved) parts.push(`${moved} date${moved === 1 ? "" : "s"} moved`);
  if (added) parts.push(`${added} new`);
  if (dropped) parts.push(`${dropped} no longer listed`);
  if (!parts.length) return "Nothing has changed since your last import.";
  return `${parts.join(", ")} since your last import.`;
}
