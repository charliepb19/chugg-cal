import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractAssignments, type ExtractedAssignment } from "@/lib/import.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileUp, ImageUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ManualAssignmentDialog } from "@/components/ManualAssignmentDialog";
import { parseDueDateFromText } from "@/lib/parse-date";
import { CategoryWeights, type CategoryRow } from "@/components/CategoryWeights";
import { categoryWarnings, computeWeights, guessCategory, mergeCategories } from "@/lib/grade";


type Row = ExtractedAssignment & { include: boolean; category?: string };
type CatRow = CategoryRow & { expectedCount?: number | null };

/** How many review rows sit in each category, for the running total. */
function catCounts(items: { category?: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    const key = (i.category ?? "").trim().toLowerCase();
    if (key) out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Only complete category rows count towards saving and auto-weighting. */
function cleanCats(cats: CatRow[]) {
  return cats
    .filter((c) => c.name.trim() && typeof c.percent === "number")
    .map((c) => ({
      name: c.name.trim(),
      percent: Number(c.percent),
      perItem: c.perItem ?? false,
      expectedCount: c.expectedCount ?? null,
      note: c.note,
    }));
}


const HEIC_RE = /\.(heic|heif)$/i;

async function toUploadableFile(file: File): Promise<File> {
  const isHeic = HEIC_RE.test(file.name) || /heic|heif/i.test(file.type);
  if (!isHeic) return file;
  try {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    return new File([blob], file.name.replace(HEIC_RE, ".jpg"), { type: "image/jpeg" });
  } catch {
    throw new Error(
      "We couldn't open that iPhone photo. Save the screenshot as JPG or PNG and try again.",
    );
  }
}

export function ImportPanel({ courseId, semester = "" }: { courseId: string; semester?: string }) {
  const extract = useServerFn(extractAssignments);
  const queryClient = useQueryClient();
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "pdf" | "image">(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cats, setCats] = useState<CatRow[]>([]);
  const [catsDetected, setCatsDetected] = useState(false);
  const [importKind, setImportKind] = useState<"pdf" | "image">("pdf");
  const [saving, setSaving] = useState(false);

  const key = (r: { title: string; dueDate: string | null }) =>
    `${r.title.trim().toLowerCase()}|${r.dueDate ?? ""}`;

  async function handleFiles(input: File[], kind: "pdf" | "image") {
    const files = input.slice(0, 10);
    if (!files.length) return;
    setBusy(kind);
    setProgress(files.length > 1 ? { done: 0, total: files.length } : null);

    const found: Row[] = [];
    const detected: CatRow[] = [];
    const failures: string[] = [];

    try {
      for (const [index, original] of files.entries()) {
        setProgress(files.length > 1 ? { done: index, total: files.length } : null);
        try {
          const file = kind === "image" ? await toUploadableFile(original) : original;
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not read that file"));
            reader.readAsDataURL(file);
          });

          const result = await extract({
            data: { kind, dataUrl, filename: file.name, semester },
          });

          for (const c of result.categories ?? []) {
            if (!detected.some((d) => d.name.toLowerCase() === c.name.toLowerCase())) {
              detected.push({
                name: c.name,
                percent: c.percent,
                note: c.note,
                perItem: c.perItem,
                expectedCount: c.expectedCount,
              });
            }
          }

          for (const a of result.assignments) {
            const row: Row = {
              ...a,
              // Anything the model left undated: recover the date from its own text.
              dueDate: a.dueDate ?? parseDueDateFromText(`${a.title} ${a.notes}`, semester),
              include: true,
            };
            // The same assignment can appear in two overlapping screenshots.
            if (!found.some((f) => key(f) === key(row))) found.push(row);
          }
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Couldn't read ${original.name}`);
        }
      }

      if (!found.length && !detected.length) {
        toast.error(
          failures[0] ??
            (kind === "image"
              ? "We couldn't read any assignments in those screenshots. Crop closer to the assignment list, or upload clearer ones."
              : "No assignments found in that file. Try the other import method."),
        );
        return;
      }

      setImportKind(kind);
      if (detected.length) {
        setCatsDetected(true);
        // The same category can show up in two documents, or as "Exam 1 / Exam 2".
        const merged = mergeCategories(
          detected.map((d) => ({ ...d, percent: Number(d.percent) || 0 })),
        ) as CatRow[];
        setCats((prev) => (prev.length ? prev : merged));
      }
      setRows((prev) => {
        const merged = [...(prev ?? [])];
        for (const row of found) if (!merged.some((m) => key(m) === key(row))) merged.push(row);
        return merged;
      });

      if (failures.length) {
        toast.warning(
          `Added what we could — ${failures.length} file${failures.length === 1 ? "" : "s"} couldn't be read.`,
        );
      }
      const unsure = found.filter((a) => a.yearUnconfirmed).length;
      toast.success(
        !found.length
          ? `Found a grading breakdown with ${detected.length} categor${detected.length === 1 ? "y" : "ies"} — review and save.`
          : unsure
            ? `Found ${found.length} assignments — check the ${unsure} flagged year${unsure === 1 ? "" : "s"}.`
            : detected.length
              ? `Found ${found.length} assignments and a grading breakdown — review and save.`
              : `Found ${found.length} assignments — review and save.`,
      );
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const handleFile = (file: File, kind: "pdf" | "image") => handleFiles([file], kind);


  async function save() {
    const all = rows ?? [];
    const keep = cleanCats(cats);
    const picked = all
      .map((r) => ({ ...r, category: r.category ?? guessCategory(r, keep) }))
      .filter((r) => r.include);
    if (!picked.length && !keep.length) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out");

      if (picked.length) {
        const { error } = await supabase.from("assignments").insert(
          picked.map((r) => ({
            user_id: userId,
            course_id: courseId,
            title: r.title,
            notes: r.notes,
            due_date: r.dueDate ? new Date(`${r.dueDate}T23:59:00`).toISOString() : null,
            source: importKind === "pdf" ? "parsed_pdf" : "parsed_image",
            confirmed: true,
            type: r.type,
            weight: r.weight ?? "",
            category: r.category ?? "",
          })),
        );
        if (error) throw error;
      }

      if (keep.length) {
        await supabase.from("grade_categories").delete().eq("course_id", courseId);
        const { error: catError } = await supabase.from("grade_categories").insert(
          keep.map((c) => ({
            user_id: userId,
            course_id: courseId,
            name: c.name.trim(),
            weight: Number(c.percent),
            per_item: c.perItem ?? false,
            source: importKind === "pdf" ? "parsed_pdf" : "parsed_image",
          })),
        );
        if (catError) throw catError;
        await queryClient.invalidateQueries({ queryKey: ["grade_categories"] });
      }

      // Put assignments already on this course into the matching category, so the
      // breakdown's percentages cover them too and re-split as more are added.
      let backfilled = 0;
      if (keep.length) {
        const { data: existing } = await supabase
          .from("assignments")
          .select("id,title,type,weight,category,source")
          .eq("course_id", courseId);
        const list = (existing ?? []) as {
          id: string;
          title: string;
          type: string;
          weight: string;
          category: string;
          source: string;
        }[];
        for (const a of list) {
          if (a.category?.trim()) continue;
          const guess = guessCategory(a, keep);
          if (!guess) continue;
          // A weight an earlier import wrote in would freeze the old split.
          const patch: { category: string; weight?: string } = { category: guess };
          if (a.source !== "manual") patch.weight = "";
          await supabase.from("assignments").update(patch).eq("id", a.id);
          backfilled += 1;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setRows(null);
      setCats([]);
      toast.success(
        keep.length
          ? `Added ${picked.length} assignment${picked.length === 1 ? "" : "s"} and ${keep.length} grading categories${backfilled ? `, sorting ${backfilled} existing item${backfilled === 1 ? "" : "s"} into them` : ""}.`
          : `Added ${picked.length} assignments.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (rows) {
    const count = rows.filter((r) => r.include).length;
    const readyCats = cleanCats(cats);
    const resolved = rows.map((r) => ({ ...r, category: r.category ?? guessCategory(r, readyCats) }));
    const autoWeights = computeWeights(
      resolved.map((r) => ({ ...r, weight: "" })),
      readyCats,
    );
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Review what we found</h2>
          <Button variant="ghost" size="sm" onClick={() => setRows(null)}>
            Discard
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing is saved until you confirm. Edit anything that looks off.
        </p>
        <div className="mt-4 divide-y divide-border">
          {rows.map((row, i) => {
            const update = (patch: Partial<Row>) =>
              setRows((prev) => (prev ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 py-2.5 sm:flex-nowrap sm:gap-3">
                <Checkbox
                  checked={row.include}
                  onCheckedChange={(v) => update({ include: Boolean(v) })}
                />
                <Input
                  value={row.title}
                  onChange={(e) => update({ title: e.target.value })}
                  className="h-9 min-w-40 flex-1"
                />
                <select
                  value={row.type}
                  onChange={(e) => update({ type: e.target.value as Row["type"] })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label="Type"
                >
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="quiz">Quiz</option>
                  <option value="reading">Reading</option>
                </select>
                <select
                  value={resolved[i]?.category ?? ""}
                  onChange={(e) => update({ category: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label={`Grading category for ${row.title}`}
                  disabled={readyCats.length === 0}
                >
                  <option value="">No category</option>
                  {readyCats.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  value={row.weight ?? ""}
                  placeholder={autoWeights[i] != null ? `${autoWeights[i]}%` : "Weight"}
                  title="Left blank, this is worked out from the grading breakdown"
                  onChange={(e) => update({ weight: e.target.value })}
                  className="h-9 w-24"
                />
                <Input
                  type="date"
                  value={row.dueDate ?? ""}
                  onChange={(e) => update({ dueDate: e.target.value || null })}
                  className="h-9 w-40"
                />
                {row.recurring && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    repeating
                  </span>
                )}
                {row.yearUnconfirmed && (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                    check year
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {(catsDetected || importKind === "pdf") && (
          <div className="mt-5 border-t border-border pt-4">
            <CategoryWeights
              rows={cats}
              onChange={setCats}
              detected={catsDetected}
              counts={catCounts(resolved.filter((r) => r.include))}
              warnings={categoryWarnings(readyCats, resolved.filter((r) => r.include))}
            />
            {readyCats.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Each percentage is split evenly across the items in that category, so it updates
                itself whenever you add more. Use the dropdown to move an item to another category.
                Set a category to "each item" when every item is worth that much on its own — like
                three exams at 20% each.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving || (count === 0 && readyCats.length === 0)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {count === 0
              ? "Save grading breakdown"
              : `Add ${count} assignment${count === 1 ? "" : "s"}`}
          </Button>
          <Button
            variant="outline"
            onClick={() => imgRef.current?.click()}
            disabled={busy !== null || saving}
          >
            {busy === "image" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageUp className="h-4 w-4" />
            )}
            {busy === "image" && progress
              ? `Reading ${progress.done + 1} of ${progress.total}…`
              : "Add more screenshots"}
          </Button>
        </div>

        <input
          ref={imgRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,image/*"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) handleFiles(files, "image");
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DropCard
          icon={FileUp}
          title="Upload syllabus PDF"
          body="We'll pull every due date out of the schedule."
          busy={busy === "pdf"}
          onPick={() => pdfRef.current?.click()}
          onDrop={(files) => handleFile(files[0]!, "pdf")}
        />
        <DropCard
          icon={ImageUp}
          title="Import from screenshots"
          body="D2L, Canvas or Blackboard assignment lists — add as many as you need. PNG, JPG or HEIC."
          busy={busy === "image"}
          progress={progress}
          onPick={() => imgRef.current?.click()}
          onDrop={(files) => handleFiles(files, "image")}
        />
      </div>

      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f, "pdf");
        }}
      />
      <input
        ref={imgRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,image/*"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) handleFiles(files, "image");
        }}
      />

      <div className="mt-3 flex items-center justify-center">
        <ManualAssignmentDialog courseId={courseId} semester={semester}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
            Or add one by hand
          </Button>
        </ManualAssignmentDialog>
      </div>
    </div>
  );
}

function DropCard({
  icon: Icon,
  title,
  body,
  busy,
  progress,
  onPick,
  onDrop,
}: {
  icon: typeof FileUp;
  title: string;
  body: string;
  busy: boolean;
  progress?: { done: number; total: number } | null;
  onPick: () => void;
  onDrop: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onDrop(files);
      }}
      disabled={busy}
      className={`flex min-h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        over ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent/50"
      }`}
    >
      {busy ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="h-6 w-6 text-muted-foreground" />
      )}
      <span className="mt-3 text-sm font-medium">
        {busy
          ? progress
            ? `Reading file ${progress.done + 1} of ${progress.total}…`
            : "Reading your file…"
          : title}
      </span>
      <span className="mt-1 text-sm text-muted-foreground">
        {busy ? "This takes a few seconds." : body}
      </span>
    </button>
  );
}
