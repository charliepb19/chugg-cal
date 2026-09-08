import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  kind: z.enum(["pdf", "image"]),
  /** data URL: data:<mime>;base64,<payload> */
  dataUrl: z.string().min(10),
  filename: z.string().optional(),
  /** free text like "Fall 2026", used to infer a missing year */
  semester: z.string().max(100).optional(),
});

export type AssignmentType = "assignment" | "exam" | "quiz" | "reading";

export type ExtractedAssignment = {
  title: string;
  dueDate: string | null;
  notes: string;
  type: AssignmentType;
  weight: string;
  recurring: boolean;
  /** true when the year had to be guessed and the student should double-check it */
  yearUnconfirmed?: boolean;
};

type RawItem = {
  title?: unknown;
  date?: unknown;
  dueDate?: unknown;
  type?: unknown;
  weight?: unknown;
  notes?: unknown;
  yearVisible?: unknown;
  recurring?: unknown;
  recurrence?: {
    weekday?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    intervalWeeks?: unknown;
  } | null;
};

const SYSTEM_PROMPT = `You extract every graded deadline from course materials for a student calendar.
Return STRICT JSON of the form:
{
  "semesterStart": "YYYY-MM-DD or null",
  "semesterEnd": "YYYY-MM-DD or null",
  "items": [
    {
      "title": "string",
      "date": "YYYY-MM-DD or null",
      "type": "assignment" | "exam" | "quiz" | "reading",
      "weight": "string, e.g. 20% or empty string",
      "notes": "short string or empty string",
      "recurring": true | false,
      "recurrence": { "weekday": "Monday..Sunday", "startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null", "intervalWeeks": 1 } | null
    }
  ]
}
Rules:
- Include every assignment, quiz, exam, project, reading, discussion post or deliverable with a stated or implied date.
- If something repeats (e.g. "quiz every Friday", "weekly reading response"), set recurring to true and fill recurrence with the weekday, the range it runs over, and how many weeks between occurrences (1 for weekly, 2 for biweekly). Leave date null for those.
- Use semesterStart/semesterEnd from the syllabus term dates when present; they bound recurring items when the recurrence has no range.
- Do not invent items. Skip office hours, policies and grading scales.
- Titles must be short and human readable ("Problem Set 3", "Midterm Exam").
- If a date has no year, infer it from surrounding context, otherwise use the current year.
- notes may hold chapter or submission detail, under 120 characters.
Return only JSON.`;

const IMAGE_SYSTEM_PROMPT = `You read a screenshot of a course assignment list from a school LMS (D2L/Brightspace, Canvas, Blackboard, Moodle) and turn it into a student calendar.
Return STRICT JSON of the form:
{
  "readable": true | false,
  "items": [
    {
      "title": "string",
      "date": "YYYY-MM-DD or null",
      "yearVisible": true | false,
      "type": "assignment" | "exam" | "quiz" | "reading",
      "weight": "string, e.g. 20% or empty string",
      "notes": "short string or empty string"
    }
  ]
}
Rules:
- Layouts vary a lot: columns can appear in any order, and dates may be "Oct 3", "10/3", "3 Oct 2026", "Due Friday, October 3 at 11:59 PM", or inside a "Due" column header.
- Pick the date the student must finish by. Start dates are never the due date: "Available from", "Opens", "Starts", "Posted", "Unlocks", "Last updated" must never go in "date".
- Closing dates ARE due dates when no explicit "Due" date is shown: "Availability ends", "Available until", "Closes", "Ends", "Due by", or the end of an availability window (e.g. "Oct 1 - Oct 8" -> Oct 8). Quizzes on D2L usually show only "Availability ends" — use that as the due date and note it in "notes" (e.g. "availability ends").
- If a row shows both an explicit due date and an availability window, use the explicit due date.
- Only when a row has no due date and no closing date at all, set date to null and mention the other date in notes (e.g. "opens Oct 1").
- "yearVisible" is true only when the year is actually printed on screen for that row. When only month/day is shown, set yearVisible false and still give your best-guess year in "date".
- Infer type from wording: "Quiz"/"Test bank" -> quiz, "Exam"/"Midterm"/"Final" -> exam, "Read"/"Chapter"/"Reading" -> reading, otherwise assignment.
- Fill "weight" only when a points value or percentage is visible (e.g. "10%", "25 pts").
- Skip navigation, folders, headers, announcements, grade totals and anything without an assignment name.
- Set "readable" to false and return an empty items array when the image is too blurry, cropped or dark to read, or shows no assignment list.
Return only JSON.`;


const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function expandRecurring(
  item: RawItem,
  title: string,
  notes: string,
  type: AssignmentType,
  weight: string,
  semesterStart: string | null,
  semesterEnd: string | null,
): ExtractedAssignment[] {
  const rec = item.recurrence ?? {};
  const start = isDate(rec.startDate) ? rec.startDate : semesterStart;
  const end = isDate(rec.endDate) ? rec.endDate : semesterEnd;
  const weekdayIndex = WEEKDAYS.indexOf(String(rec.weekday ?? "").trim().toLowerCase());

  if (!start || !end || weekdayIndex < 0 || start > end) {
    // Not enough information to lay it out — keep one undated entry to review.
    return [{ title, dueDate: null, notes, type, weight, recurring: true }];
  }

  const step = Math.min(Math.max(Number(rec.intervalWeeks) || 1, 1), 8);
  const startDow = new Date(`${start}T12:00:00Z`).getUTCDay();
  let cursor = addDays(start, (weekdayIndex - startDow + 7) % 7);

  const out: ExtractedAssignment[] = [];
  while (cursor <= end && out.length < 60) {
    out.push({ title, dueDate: cursor, notes, type, weight, recurring: true });
    cursor = addDays(cursor, 7 * step);
  }
  return out.length ? out : [{ title, dueDate: null, notes, type, weight, recurring: true }];
}

async function callGateway(
  messages: unknown[],
  opts: {
    inferYear?: number | null;
    /** first month of the term (1-12), used to roll Jan-Apr dates into the next year */
    semesterMonth?: number | null;
    unreadableMessage?: string;
  } = {},
): Promise<ExtractedAssignment[]> {
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

  if (res.status === 429)
    throw new Error("Too many imports right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI usage limit reached for this workspace.");
  if (!res.ok) throw new Error(`Import failed (${res.status}). Please try another file.`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: {
    items?: RawItem[];
    assignments?: RawItem[];
    semesterStart?: unknown;
    semesterEnd?: unknown;
    readable?: unknown;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(opts.unreadableMessage ?? "Could not read assignments from that file.");
  }

  if (parsed.readable === false && opts.unreadableMessage) {
    throw new Error(opts.unreadableMessage);
  }


  const semesterStart = isDate(parsed.semesterStart) ? parsed.semesterStart : null;
  const semesterEnd = isDate(parsed.semesterEnd) ? parsed.semesterEnd : null;
  const raw = parsed.items ?? parsed.assignments ?? [];

  const out: ExtractedAssignment[] = [];
  for (const item of raw) {
    const title = typeof item?.title === "string" ? item.title.trim().slice(0, 200) : "";
    if (!title) continue;
    const notes = typeof item.notes === "string" ? item.notes.slice(0, 200) : "";
    const weight = typeof item.weight === "string" ? item.weight.slice(0, 40) : "";
    const t = String(item.type ?? "assignment").toLowerCase();
    const type: AssignmentType = (["assignment", "exam", "quiz", "reading"] as const).includes(
      t as AssignmentType,
    )
      ? (t as AssignmentType)
      : "assignment";

    if (item.recurring === true) {
      out.push(...expandRecurring(item, title, notes, type, weight, semesterStart, semesterEnd));
      continue;
    }

    let date = isDate(item.date) ? item.date : isDate(item.dueDate) ? item.dueDate : null;
    let yearUnconfirmed = false;

    if (date && item.yearVisible === false) {
      if (opts.inferYear) {
        // The screenshot showed only month/day — anchor it to the course's own year.
        const monthDay = date.slice(5);
        const month = Number(date.slice(5, 7));
        // Fall terms run into January; a January-April date belongs to the next year.
        const year =
          opts.inferYear && month <= 4 && (opts.semesterMonth ?? 0) >= 8
            ? opts.inferYear + 1
            : opts.inferYear;
        date = `${year}-${monthDay}`;
      } else {
        yearUnconfirmed = true;
      }
    }

    out.push({ title, dueDate: date, notes, type, weight, recurring: false, yearUnconfirmed });
  }

  return out.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

export const extractAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);

    if (data.kind === "image") {
      const lowQuality =
        "We couldn't read any assignments in that screenshot. Try cropping it closer to the assignment list, or take a clearer, full-size screenshot.";

      const semester = (data.semester ?? "").trim();
      const yearMatch = semester.match(/(20\d{2})/);
      const inferYear = yearMatch ? Number(yearMatch[1]) : null;
      const semesterMonth = /fall|autumn/i.test(semester)
        ? 9
        : /summer/i.test(semester)
          ? 5
          : /winter|spring/i.test(semester)
            ? 1
            : null;

      const assignments = await callGateway(
        [
          { role: "system", content: IMAGE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Today is ${today}.${
                  semester ? ` This course runs in ${semester}.` : ""
                } This screenshot shows a course assignment list from a school LMS. Read every row. Use the due date when one is shown; when a row (often a quiz) only shows "Availability ends" / "Available until" / "Closes", use that closing date as the due date.`,
              },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
        { inferYear, semesterMonth, unreadableMessage: lowQuality },
      );

      if (!assignments.length) throw new Error(lowQuality);
      return { assignments };
    }

    const base64 = data.dataUrl.split(",")[1] ?? "";
    let syllabus = "";
    try {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      syllabus = String(text).slice(0, 120_000).trim();
    } catch {
      throw new Error(
        "We couldn't read that PDF. If it's a scan or photo, upload it as a screenshot image instead.",
      );
    }

    if (syllabus.replace(/\s+/g, " ").length < 40) {
      throw new Error(
        "That PDF has no readable text — it looks like a scanned image. Upload it as a screenshot instead, or add the assignments by hand.",
      );
    }

    return {
      assignments: await callGateway([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Today is ${today}. Extract every deadline from this syllabus:\n\n${syllabus}`,
        },
      ]),
    };
  });
