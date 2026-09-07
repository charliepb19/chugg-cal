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

type Row = ExtractedAssignment & { include: boolean };

export function ImportPanel({ courseId }: { courseId: string }) {
  const extract = useServerFn(extractAssignments);
  const queryClient = useQueryClient();
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "pdf" | "image">(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [importKind, setImportKind] = useState<"pdf" | "image">("pdf");
  const [saving, setSaving] = useState(false);

  async function handleFile(file: File, kind: "pdf" | "image") {
    setBusy(kind);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file"));
        reader.readAsDataURL(file);
      });

      const result = await extract({ data: { kind, dataUrl, filename: file.name } });
      if (!result.assignments.length) {
        toast.error("No assignments found in that file. Try the other import method.");
        return;
      }
      setImportKind(kind);
      setRows(result.assignments.map((a) => ({ ...a, include: true })));
      toast.success(`Found ${result.assignments.length} assignments — review and save.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const picked = (rows ?? []).filter((r) => r.include);
    if (!picked.length) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out");

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
          weight: r.weight,
        })),
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setRows(null);
      toast.success(`Added ${picked.length} assignments.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (rows) {
    const count = rows.filter((r) => r.include).length;
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
                <Input
                  value={row.weight}
                  placeholder="Weight"
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
              </div>
            );
          })}
        </div>
        <Button className="mt-4" onClick={save} disabled={saving || count === 0}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {count} assignment{count === 1 ? "" : "s"}
        </Button>
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
          onDrop={(f) => handleFile(f, "pdf")}
        />
        <DropCard
          icon={ImageUp}
          title="Upload assignment screenshot"
          body="A screenshot from D2L, Canvas or Blackboard works."
          busy={busy === "image"}
          onPick={() => imgRef.current?.click()}
          onDrop={(f) => handleFile(f, "image")}
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
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f, "image");
        }}
      />

      <div className="mt-3 flex items-center justify-center">
        <ManualAssignmentDialog courseId={courseId}>
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
  onPick,
  onDrop,
}: {
  icon: typeof FileUp;
  title: string;
  body: string;
  busy: boolean;
  onPick: () => void;
  onDrop: (file: File) => void;
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
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
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
      <span className="mt-3 text-sm font-medium">{busy ? "Reading your file…" : title}</span>
      <span className="mt-1 text-sm text-muted-foreground">
        {busy ? "This takes a few seconds." : body}
      </span>
    </button>
  );
}
