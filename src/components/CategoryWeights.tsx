import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export type CategoryRow = {
  name: string;
  percent: number | "";
  note?: string;
  /** true when each item in the category is worth this percentage on its own */
  perItem?: boolean;
};

/**
 * Total share of the final grade. A per-item category counts once per item in it,
 * so three exams at 20% each contribute 60%.
 */
export function weightTotal(rows: CategoryRow[], counts: Record<string, number> = {}): number {
  return rows.reduce((sum, r) => {
    if (typeof r.percent !== "number") return sum;
    const n = r.perItem ? Math.max(counts[r.name.trim().toLowerCase()] ?? 1, 1) : 1;
    return sum + r.percent * n;
  }, 0);
}

/**
 * Editable grading breakdown. Used pre-filled after a syllabus import and empty
 * as the manual fallback when a syllabus states no grading policy.
 */
export function CategoryWeights({
  rows,
  onChange,
  detected,
  warnings = [],
  counts = {},
}: {
  rows: CategoryRow[];
  onChange: (rows: CategoryRow[]) => void;
  /** true when these came out of the syllabus rather than being typed by hand */
  detected: boolean;
  warnings?: string[];
  /** how many items sit in each category (lower-cased name), for the total */
  counts?: Record<string, number>;
}) {
  const total = Math.round(weightTotal(rows, counts) * 10) / 10;
  const update = (i: number, patch: Partial<CategoryRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Grading breakdown</h3>
        <span
          className={`text-xs tabular-nums ${
            rows.length && Math.abs(total - 100) > 0.5 ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {total}% total
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {detected
          ? "Taken straight from the syllabus — just confirm or correct it."
          : "The syllabus didn't state one, so add your categories and their percentages."}
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row.name}
              placeholder="Category (e.g. Quizzes)"
              onChange={(e) => update(i, { name: e.target.value })}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={row.percent}
              placeholder="%"
              aria-label={`Percentage for ${row.name || "category"}`}
              onChange={(e) =>
                update(i, { percent: e.target.value === "" ? "" : Number(e.target.value) })
              }
              className="h-9 w-24 text-right"
            />
            <select
              value={row.perItem ? "each" : "split"}
              aria-label={`How the percentage for ${row.name || "category"} is applied`}
              onChange={(e) => update(i, { perItem: e.target.value === "each" })}
              className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="split">split across items</option>
              <option value="each">each item</option>
            </select>
            <button
              type="button"
              aria-label={`Remove ${row.name || "category"}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 text-muted-foreground"
        onClick={() => onChange([...rows, { name: "", percent: "" }])}
      >
        <Plus className="h-3.5 w-3.5" />
        Add category
      </Button>

      {rows.length > 0 && Math.abs(total - 100) > 0.5 && (
        <p className="mt-2 text-xs text-destructive">
          {detected
            ? `Detected weights only add up to ${total}% — the syllabus excerpt may be incomplete, please review.`
            : `These add up to ${total}%, not 100% — check the percentages.`}
        </p>
      )}

      {warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-amber-600 dark:text-amber-500">
          {w}
        </p>
      ))}
    </div>
  );
}
