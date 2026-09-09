import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { workShiftsQuery, shiftRangeLabel, type WorkShift } from "@/lib/db";
import { extractShifts, type ExtractedShift } from "@/lib/work.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUp, Loader2, Plus, Trash2, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "Work Schedule — ChuggCal" },
      {
        name: "description",
        content:
          "Upload a screenshot of your work schedule and see your shifts alongside your coursework.",
      },
      { property: "og:title", content: "Work Schedule — ChuggCal" },
      {
        property: "og:description",
        content:
          "Upload a screenshot of your work schedule and see your shifts alongside your coursework.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkPage,
});

type Row = ExtractedShift & { include: boolean };

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

const todayIso = () => new Date().toISOString().slice(0, 10);

function plusDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const shiftKey = (s: { date?: string | null; shift_date?: string; start_time?: string; startTime?: string }) =>
  `${s.date ?? s.shift_date ?? ""}|${(s.startTime ?? s.start_time ?? "").trim()}`;

function WorkPage() {
  const { data: shifts = [] } = useQuery(workShiftsQuery);
  const queryClient = useQueryClient();
  const extract = useServerFn(extractShifts);
  const imgRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [rangeEnd, setRangeEnd] = useState(() => plusDays(todayIso(), 120));

  const existingKeys = useMemo(() => new Set(shifts.map((s) => shiftKey(s))), [shifts]);

  async function handleFiles(input: File[]) {
    const files = input.slice(0, 10);
    if (!files.length) return;
    setBusy(true);
    setProgress(files.length > 1 ? { done: 0, total: files.length } : null);
    const found: Row[] = [];
    const failures: string[] = [];

    try {
      for (const [index, original] of files.entries()) {
        setProgress(files.length > 1 ? { done: index, total: files.length } : null);
        try {
          const file = await toUploadableFile(original);
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not read that file"));
            reader.readAsDataURL(file);
          });
          const result = await extract({
            data: { dataUrl, filename: file.name, rangeEnd },
          });
          for (const s of result.shifts) {
            const row: Row = { ...s, include: true };
            if (!found.some((f) => shiftKey(f) === shiftKey(row))) found.push(row);
          }
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Couldn't read ${original.name}`);
        }
      }

      if (!found.length) {
        toast.error(
          failures[0] ??
            "We couldn't read any shifts in those screenshots. Crop closer to the schedule, or upload a clearer image.",
        );
        return;
      }

      setRows((prev) => {
        const merged = [...(prev ?? [])];
        for (const row of found) if (!merged.some((m) => shiftKey(m) === shiftKey(row))) merged.push(row);
        return merged;
      });

      const dupes = found.filter((f) => existingKeys.has(shiftKey(f))).length;
      if (failures.length) {
        toast.warning(
          `Added what we could — ${failures.length} image${failures.length === 1 ? "" : "s"} couldn't be read.`,
        );
      }
      toast.success(
        dupes
          ? `Found ${found.length} shifts — ${dupes} already on your calendar and unticked.`
          : `Found ${found.length} shifts — review and save.`,
      );
      setRows((prev) =>
        (prev ?? []).map((r) => (existingKeys.has(shiftKey(r)) ? { ...r, include: false } : r)),
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function patch(index: number, next: Partial<Row>) {
    setRows((prev) => prev?.map((r, i) => (i === index ? { ...r, ...next } : r)) ?? prev);
  }

  async function saveRows() {
    const picked = (rows ?? []).filter((r) => r.include && r.date);
    if (!picked.length) {
      toast.error("Pick at least one shift with a date.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out");
      const { error } = await supabase.from("work_shifts").insert(
        picked.map((r) => ({
          user_id: userId,
          shift_date: r.date as string,
          start_time: r.startTime,
          end_time: r.endTime,
          location: r.location,
          notes: r.notes,
          source: "parsed_image_work",
        })),
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["work_shifts"] });
      setRows(null);
      toast.success(`Added ${picked.length} shift${picked.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save those shifts.");
    } finally {
      setSaving(false);
    }
  }

  async function updateShift(id: string, patchValues: Partial<WorkShift>) {
    const { error } = await supabase.from("work_shifts").update(patchValues).eq("id", id);
    if (error) {
      toast.error("Couldn't save that change.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["work_shifts"] });
  }

  async function deleteShifts(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("work_shifts").delete().in("id", ids);
    if (error) {
      toast.error("Couldn't remove those shifts.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["work_shifts"] });
    toast.success(`Removed ${ids.length} shift${ids.length === 1 ? "" : "s"}.`);
  }

  async function addManual() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("work_shifts").insert({
      user_id: userId,
      shift_date: todayIso(),
      start_time: "09:00",
      end_time: "17:00",
      location: "",
      notes: "",
      source: "manual",
    });
    if (error) {
      toast.error("Couldn't add a shift.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["work_shifts"] });
  }

  const upcoming = shifts.filter((s) => s.shift_date >= todayIso());
  const past = shifts.filter((s) => s.shift_date < todayIso());

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            Work Schedule
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your shifts live outside your courses. Turn on “Show work schedule” on the calendar to
            see them next to your coursework.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <h2 className="text-sm font-medium">Import from a screenshot</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload up to 10 images of your posted schedule (PNG, JPG, HEIC).
            </p>
          </div>
          <label className="text-xs text-muted-foreground">
            Repeat shifts through
            <Input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="mt-1 h-9 w-40"
            />
          </label>
          <Button
            onClick={() => imgRef.current?.click()}
            disabled={busy}
            className="h-9"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {busy
              ? progress
                ? `Reading ${progress.done + 1} of ${progress.total}…`
                : "Reading…"
              : "Upload schedule"}
          </Button>
          <input
            ref={imgRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void handleFiles(files);
            }}
          />
        </div>
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Review shifts before adding</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRows(null)} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" onClick={() => void saveRows()} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add to calendar
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
              >
                <Checkbox
                  checked={r.include}
                  onCheckedChange={(v) => patch(i, { include: v === true })}
                />
                <Input
                  type="date"
                  value={r.date ?? ""}
                  onChange={(e) => patch(i, { date: e.target.value || null })}
                  className="h-8 w-40"
                />
                <Input
                  type="time"
                  value={r.startTime}
                  onChange={(e) => patch(i, { startTime: e.target.value })}
                  className="h-8 w-28"
                />
                <Input
                  type="time"
                  value={r.endTime}
                  onChange={(e) => patch(i, { endTime: e.target.value })}
                  className="h-8 w-28"
                />
                <Input
                  placeholder="Place or role"
                  value={r.location}
                  onChange={(e) => patch(i, { location: e.target.value })}
                  className="h-8 min-w-40 flex-1"
                />
                {r.yearUnconfirmed && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                    check year
                  </span>
                )}
                {r.recurring && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    repeating
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setRows((prev) => prev?.filter((_, x) => x !== i) ?? prev)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">Your shifts ({shifts.length})</h2>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void addManual()}>
          <Plus className="h-4 w-4" />
          Add shift
        </Button>
        {past.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void deleteShifts(past.map((s) => s.id))}
          >
            Clear past ({past.length})
          </Button>
        )}
        {shifts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void deleteShifts(shifts.map((s) => s.id))}
          >
            Clear all
          </Button>
        )}
      </div>

      {shifts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No shifts yet. Upload a screenshot of your schedule to get started.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {[...upcoming, ...past].map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
            >
              <Input
                type="date"
                defaultValue={s.shift_date}
                onBlur={(e) =>
                  e.target.value !== s.shift_date &&
                  void updateShift(s.id, { shift_date: e.target.value })
                }
                className="h-8 w-40"
              />
              <Input
                type="time"
                defaultValue={s.start_time}
                onBlur={(e) =>
                  e.target.value !== s.start_time &&
                  void updateShift(s.id, { start_time: e.target.value })
                }
                className="h-8 w-28"
              />
              <Input
                type="time"
                defaultValue={s.end_time}
                onBlur={(e) =>
                  e.target.value !== s.end_time &&
                  void updateShift(s.id, { end_time: e.target.value })
                }
                className="h-8 w-28"
              />
              <Input
                placeholder="Place or role"
                defaultValue={s.location}
                onBlur={(e) =>
                  e.target.value !== s.location &&
                  void updateShift(s.id, { location: e.target.value })
                }
                className="h-8 min-w-40 flex-1"
              />
              <span className="text-xs text-muted-foreground">{shiftRangeLabel(s)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void deleteShifts([s.id])}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
