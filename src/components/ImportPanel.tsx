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
          source: "import",
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
        <div className="mt-4 divide-y divide-border">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <Checkbox
                checked={row.include}
                onCheckedChange={(v) =>
                  setRows((prev) =>
                    (prev ?? []).map((r, j) => (j === i ? { ...r, include: Boolean(v) } : r)),
                  )
                }
              />
              <Input
                value={row.title}
                onChange={(e) =>
                  setRows((prev) =>
                    (prev ?? []).map((r, j) => (j === i ? { ...r, title: e.target.value } : r)),
                  )
                }
                className="h-9 flex-1"
              />
              <Input
                type="date"
                value={row.dueDate ?? ""}
                onChange={(e) =>
                  setRows((prev) =>
                    (prev ?? []).map((r, j) =>
                      j === i ? { ...r, dueDate: e.target.value || null } : r,
                    ),
                  )
                }
                className="h-9 w-40"
              />
            </div>
          ))}
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
