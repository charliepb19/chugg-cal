import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  kind: z.enum(["pdf", "image"]),
  /** data URL: data:<mime>;base64,<payload> */
  dataUrl: z.string().min(10),
  filename: z.string().optional(),
});

export type ExtractedAssignment = {
  title: string;
  dueDate: string | null;
  notes: string;
};

const SYSTEM_PROMPT = `You extract graded work from course materials for a student calendar.
Return STRICT JSON of the form:
{"assignments":[{"title":"string","dueDate":"YYYY-MM-DD or null","notes":"short string"}]}
Rules:
- Include every assignment, quiz, exam, project, reading response, discussion post or deliverable that has or implies a due date.
- Do not invent items. Do not include office hours, policies, or grading scales.
- Titles must be short and human readable (e.g. "Problem Set 3", "Midterm Exam").
- If a date has no year, infer the most sensible year from surrounding context, otherwise use the current year.
- If no date can be determined, set dueDate to null.
- notes may hold weight, chapter, or submission detail. Keep it under 120 characters. Use "" when nothing useful.
Return only JSON.`;

async function callGateway(messages: unknown[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("Too many imports right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI usage limit reached for this workspace.");
  if (!res.ok) throw new Error(`Import failed (${res.status}). Please try another file.`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: { assignments?: ExtractedAssignment[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Could not read assignments from that file.");
  }

  const today = new Date().toISOString().slice(0, 10);
  return (parsed.assignments ?? [])
    .filter((a) => a && typeof a.title === "string" && a.title.trim().length > 0)
    .map((a) => ({
      title: String(a.title).trim().slice(0, 200),
      dueDate:
        typeof a.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : null,
      notes: typeof a.notes === "string" ? a.notes.slice(0, 200) : "",
    }))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .map((a) => ({ ...a, _today: today }))
    .map(({ _today, ...rest }) => rest as ExtractedAssignment);
}

export const extractAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);

    if (data.kind === "image") {
      return {
        assignments: await callGateway([
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Today is ${today}. This screenshot shows a course assignment list. Extract every assignment.`,
              },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ]),
      };
    }

    const base64 = data.dataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const syllabus = String(text).slice(0, 120_000).trim();

    if (syllabus.length < 40) {
      throw new Error(
        "That PDF has no readable text (it may be a scan). Try uploading a screenshot instead.",
      );
    }

    return {
      assignments: await callGateway([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Today is ${today}. Extract every assignment from this syllabus:\n\n${syllabus}`,
        },
      ]),
    };
  });
