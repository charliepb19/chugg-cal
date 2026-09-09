import { useState } from "react";
import { Input } from "@/components/ui/input";
import { letterGrade } from "@/lib/grade";
import type { Assignment } from "@/lib/db";

type Props = {
  /** Assignments with their categories already resolved. */
  items: (Assignment & { category?: string })[];
  /** Effective percentage of the course each item is worth. */
  weights: (number | null)[];
};

/**
 * "What do I need on the final?" — projects the course grade from the marks
 * already entered plus a guessed score on everything still ungraded.
 */
export function WhatIfGrade({ items, weights }: Props) {
  const [assumed, setAssumed] = useState(85);
  const [target, setTarget] = useState(90);

  let earnedPoints = 0;
  let remainingWeight = 0;
  let totalWeight = 0;
  let bonusPoints = 0;

  type Cat = {
    name: string;
    earned: number;
    gradedWeight: number;
    remaining: number;
    remainingCount: number;
  };
  const cats = new Map<string, Cat>();

  for (const [i, a] of items.entries()) {
    const w = weights[i];
    if (w === null || w === undefined || w <= 0) continue;
    const graded = a.score !== null && a.score !== undefined;
    if (a.extra_credit) {
      if (graded) bonusPoints += (a.score! / 100) * w;
      continue;
    }
    const name = (a.category?.trim() || "Uncategorized") as string;
    let cat = cats.get(name.toLowerCase());
    if (!cat) {
      cat = { name, earned: 0, gradedWeight: 0, remaining: 0, remainingCount: 0 };
      cats.set(name.toLowerCase(), cat);
    }
    totalWeight += w;
    if (graded) {
      earnedPoints += (a.score! / 100) * w;
      cat.earned += (a.score! / 100) * w;
      cat.gradedWeight += w;
    } else {
      remainingWeight += w;
      cat.remaining += w;
      cat.remainingCount += 1;
    }
  }

  if (totalWeight <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add grading weights and a mark or two, and this will project your final grade.
      </p>
    );
  }

  const projected =
    ((earnedPoints + (assumed / 100) * remainingWeight + bonusPoints) / totalWeight) * 100;

  const catList = [...cats.values()].sort((a, b) => b.remaining - a.remaining);

  /** What you'd need to average in this category if everything else still
   * ungraded comes in at the assumed score. */
  const neededFor = (cat: Cat) => {
    if (cat.remaining <= 0) return null;
    const otherRemaining = remainingWeight - cat.remaining;
    const need =
      (((target / 100) * totalWeight -
        earnedPoints -
        bonusPoints -
        (assumed / 100) * otherRemaining) /
        cat.remaining) *
      100;
    return need;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="whatif-assumed" className="text-xs text-muted-foreground">
            If I score{" "}
            <span className="font-medium text-foreground tabular-nums">{assumed}%</span> on the
            remaining {Math.round(remainingWeight)}% of the course
          </label>
          <p className="text-right text-xl font-semibold tabular-nums">
            {projected.toFixed(1)}%
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {letterGrade(projected)}
            </span>
          </p>
        </div>
        <input
          id="whatif-assumed"
          type="range"
          min={0}
          max={100}
          step={1}
          value={assumed}
          onChange={(e) => setAssumed(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>To finish with</span>
          <Input
            type="number"
            min={0}
            max={110}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            aria-label="Target final grade"
            className="h-8 w-20 text-right text-sm"
          />
          <span>% overall, here&apos;s what each category needs</span>
        </div>

        {remainingWeight <= 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Everything is graded already.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {catList.map((cat) => {
              const need = neededFor(cat);
              const avg =
                cat.gradedWeight > 0 ? (cat.earned / cat.gradedWeight) * 100 : null;
              return (
                <li
                  key={cat.name}
                  className="flex items-start justify-between gap-4 rounded-md bg-muted/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {avg === null ? "Nothing graded yet" : `Averaging ${avg.toFixed(1)}%`}
                      {cat.remaining > 0
                        ? ` · ${cat.remainingCount} left worth ${cat.remaining.toFixed(1)}%`
                        : " · all graded"}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm">
                    {need === null ? (
                      <span className="text-muted-foreground">Done</span>
                    ) : need > 100 ? (
                      <span className="text-destructive">
                        Needs {need.toFixed(1)}% — not reachable here
                      </span>
                    ) : need <= 0 ? (
                      <span className="text-muted-foreground">Anything works</span>
                    ) : (
                      <>
                        Need{" "}
                        <span className="font-semibold tabular-nums">{need.toFixed(1)}%</span>
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {remainingWeight > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Each row assumes your other ungraded work comes in at {assumed}%.
          </p>
        )}
      </div>
    </div>
  );
}

