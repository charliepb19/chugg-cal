import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { letterGrade } from "@/lib/grade";
import type { Assignment } from "@/lib/db";

type Props = {
  /** Assignments with their categories already resolved. */
  items: (Assignment & { category?: string })[];
  /** Effective percentage of the course each item is worth. */
  weights: (number | null)[];
};

/**
 * "What if…" — real marks are locked in, and you can type a hypothetical score
 * for every assignment that hasn't been graded yet to see the final result.
 */
export function WhatIfGrade({ items, weights }: Props) {
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [fillValue, setFillValue] = useState(85);

  const rows = useMemo(
    () =>
      items
        .map((a, i) => ({ a, w: weights[i] }))
        .filter((r) => r.w !== null && r.w !== undefined && r.w > 0)
        .map((r) => ({ ...r, w: r.w as number })),
    [items, weights],
  );

  const graded = rows.filter((r) => r.a.score !== null && r.a.score !== undefined);
  const ungraded = rows.filter((r) => r.a.score === null || r.a.score === undefined);

  let earnedPoints = 0;
  let totalWeight = 0;
  let bonusPoints = 0;

  for (const { a, w } of graded) {
    if (a.extra_credit) {
      bonusPoints += (a.score! / 100) * w;
      continue;
    }
    earnedPoints += (a.score! / 100) * w;
    totalWeight += w;
  }

  let projectedPoints = earnedPoints;
  let projectedBonus = bonusPoints;
  for (const { a, w } of ungraded) {
    const raw = guesses[a.id];
    const guess = raw === undefined || raw === "" ? null : Number(raw);
    if (a.extra_credit) {
      if (guess !== null && Number.isFinite(guess)) projectedBonus += (guess / 100) * w;
      continue;
    }
    totalWeight += w;
    if (guess !== null && Number.isFinite(guess)) projectedPoints += (guess / 100) * w;
  }

  if (rows.length === 0 || totalWeight <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add grading weights and a mark or two, and this will project your final grade.
      </p>
    );
  }

  const projected = ((projectedPoints + projectedBonus) / totalWeight) * 100;
  const gradedWeight = graded
    .filter((r) => !r.a.extra_credit)
    .reduce((sum, r) => sum + r.w, 0);
  const currentSoFar =
    gradedWeight > 0 ? ((earnedPoints + bonusPoints) / gradedWeight) * 100 : null;

  const fillAll = () => {
    const next: Record<string, string> = { ...guesses };
    for (const { a } of ungraded) next[a.id] = String(fillValue);
    setGuesses(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Projected final grade</p>
          <p className="text-2xl font-semibold tabular-nums">
            {projected.toFixed(1)}%
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {letterGrade(projected)}
            </span>
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {currentSoFar === null
            ? "Nothing graded yet"
            : `Graded so far: ${currentSoFar.toFixed(1)}% of ${gradedWeight.toFixed(1)}%`}
        </p>
      </div>

      {ungraded.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Fill every blank with</span>
          <Input
            type="number"
            min={0}
            max={110}
            value={fillValue}
            onChange={(e) => setFillValue(Number(e.target.value))}
            aria-label="Score to fill into every ungraded assignment"
            className="h-8 w-20 text-right text-sm"
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button type="button" size="sm" variant="secondary" onClick={fillAll}>
            Apply
          </Button>
          {Object.keys(guesses).length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setGuesses({})}>
              Clear
            </Button>
          )}
        </div>
      )}

      <ul className="space-y-1.5">
        {ungraded.map(({ a, w }) => (
          <li key={a.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {(a.category?.trim() || "No category") + ` · worth ${w.toFixed(1)}%`}
                {a.extra_credit ? " · extra credit" : ""}
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={110}
              placeholder="—"
              value={guesses[a.id] ?? ""}
              onChange={(e) => setGuesses((g) => ({ ...g, [a.id]: e.target.value }))}
              aria-label={`Hypothetical score for ${a.title}`}
              className="h-8 w-24 shrink-0 text-right text-sm"
            />
          </li>
        ))}
        {graded.map(({ a, w }) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 text-muted-foreground"
          >
            <div className="min-w-0">
              <p className="truncate text-sm">{a.title}</p>
              <p className="text-xs">
                {(a.category?.trim() || "No category") + ` · worth ${w.toFixed(1)}%`}
                {a.extra_credit ? " · extra credit" : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm tabular-nums">{a.score}% ✓</span>
          </li>
        ))}
      </ul>

      {ungraded.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Everything is graded — this is your actual mark.
        </p>
      )}
    </div>
  );
}
