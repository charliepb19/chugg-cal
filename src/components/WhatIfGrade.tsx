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
  let gradedWeight = 0;
  let remainingWeight = 0;
  let totalWeight = 0;
  let bonusPoints = 0;

  for (const [i, a] of items.entries()) {
    const w = weights[i];
    if (w === null || w === undefined || w <= 0) continue;
    const graded = a.score !== null && a.score !== undefined;
    if (a.extra_credit) {
      if (graded) bonusPoints += (a.score! / 100) * w;
      continue;
    }
    totalWeight += w;
    if (graded) {
      earnedPoints += (a.score! / 100) * w;
      gradedWeight += w;
    } else {
      remainingWeight += w;
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
  const needed =
    remainingWeight > 0
      ? (((target / 100) * totalWeight - earnedPoints - bonusPoints) / remainingWeight) * 100
      : null;

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

      <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
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
          <span>%</span>
        </div>
        <p className="text-right text-sm">
          {needed === null ? (
            <span className="text-muted-foreground">Everything is graded already.</span>
          ) : needed > 100 ? (
            <span className="text-destructive">
              Not reachable — you&apos;d need {needed.toFixed(1)}% on what&apos;s left.
            </span>
          ) : needed <= 0 ? (
            <span className="text-muted-foreground">Already locked in.</span>
          ) : (
            <>
              You need{" "}
              <span className="font-semibold tabular-nums">{needed.toFixed(1)}%</span> on the rest.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
