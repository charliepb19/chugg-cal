import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  /** data URL: data:<mime>;base64,<payload> */
  dataUrl: z.string().min(10),
  filename: z.string().optional(),
  /** ISO date the generated recurring shifts should stop at */
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ExtractedShift = {
  date: string | null;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  recurring: boolean;
  yearUnconfirmed?: boolean;
};

type RawShift = {
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  location?: unknown;
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

const SYSTEM_PROMPT = `You read a screenshot of a person's WORK SCHEDULE (from a scheduling app like When I Work, 7shifts, Homebase, Deputy, a spreadsheet, or a photo of a printed rota) and turn it into calendar entries.
Return STRICT JSON of the form:
{
  "readable": true | false,
  "shifts": [
    {
      "date": "YYYY-MM-DD or null",
      "yearVisible": true | false,
      "startTime": "HH:MM 24-hour, or empty string",
      "endTime": "HH:MM 24-hour, or empty string",
      "location": "store, department or role if visible, else empty string",
      "notes": "short string or empty string",
      "recurring": true | false,
      "recurrence": { "weekday": "Monday..Sunday", "startDate": "YYYY-MM-DD or null", "endDate": "YYYY-MM-DD or null", "intervalWeeks": 1 } | null
    }
  ]
}
Rules:
- One entry per shift. Skip days marked OFF, unavailable, requested off, or blank.
- Convert every time to 24-hour HH:MM ("4-9pm" -> startTime "16:00", endTime "21:00"). An overnight shift keeps the end time as printed (e.g. "22:00" to "02:00").
- Layouts vary: week grids with weekday columns, day-by-day lists, or text rows. Read them all.
- "yearVisible" is true only when the year is actually printed for that row; otherwise set it false and still give your best-guess year in "date".
- If the schedule states a repeating pattern ("every Tuesday 4-9pm", "Mon/Wed/Fri 9-5 ongoing"), set recurring true and fill recurrence with the weekday, any stated range and intervalWeeks (1 weekly, 2 biweekly), and leave date null. Return one entry per repeating weekday.
- A normal posted week (specific dates for one week) is NOT recurring.
- location: store name, department, position or role when shown.
- Do not invent shifts. Skip totals, hours summaries, headers and names of other staff.
- Set "readable" to false only when the image is too blurry, cropped or dark to read, or shows no schedule at all.
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

function normTime(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  const m = s.match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/i);
  if (!m) return "";
  let hour = Number(m[1]);
  const minute = m[2] ?? "00";
  const suffix = m[3]?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export const extractShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const today = new Date().toISOString().slice(0, 10);
    const rangeEnd = data.rangeEnd ?? addDays(today, 120);
    const unreadable =
      "We couldn't read any shifts in that screenshot. Try cropping closer to the schedule, or upload a clearer, full-size image.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Today is ${today}. Read this work schedule screenshot and list every shift with its date and start/end times. If the schedule describes a repeating pattern, mark it recurring instead of guessing dates.`,
              },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429)
      throw new Error("Too many imports right now. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI usage limit reached for this workspace.");
    if (!res.ok) throw new Error(`Import failed (${res.status}). Please try another image.`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: { shifts?: RawShift[]; readable?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(unreadable);
    }
    if (parsed.readable === false) throw new Error(unreadable);

    const out: ExtractedShift[] = [];
    for (const raw of parsed.shifts ?? []) {
      const startTime = normTime(raw.startTime);
      const endTime = normTime(raw.endTime);
      const location = typeof raw.location === "string" ? raw.location.trim().slice(0, 120) : "";
      const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 200) : "";

      if (raw.recurring === true) {
        const rec = raw.recurrence ?? {};
        const start = isDate(rec.startDate) ? rec.startDate : today;
        const end = isDate(rec.endDate) ? rec.endDate : rangeEnd;
        const weekdayIndex = WEEKDAYS.indexOf(String(rec.weekday ?? "").trim().toLowerCase());
        if (weekdayIndex < 0 || start > end) {
          out.push({ date: null, startTime, endTime, location, notes, recurring: true });
          continue;
        }
        const step = Math.min(Math.max(Number(rec.intervalWeeks) || 1, 1), 8);
        const startDow = new Date(`${start}T12:00:00Z`).getUTCDay();
        let cursor = addDays(start, (weekdayIndex - startDow + 7) % 7);
        let made = 0;
        while (cursor <= end && made < 60) {
          out.push({ date: cursor, startTime, endTime, location, notes, recurring: true });
          cursor = addDays(cursor, 7 * step);
          made++;
        }
        if (!made) out.push({ date: null, startTime, endTime, location, notes, recurring: true });
        continue;
      }

      let date = isDate(raw.date) ? raw.date : null;
      let yearUnconfirmed = false;
      if (date && raw.yearVisible === false) {
        // Only month/day was printed — keep the model's guess but flag it for review.
        yearUnconfirmed = true;
      }
      if (!date && !startTime) continue;
      out.push({ date, startTime, endTime, location, notes, recurring: false, yearUnconfirmed });
    }

    if (!out.length) throw new Error(unreadable);

    return {
      shifts: out.sort((a, b) =>
        `${a.date ?? "9999"}${a.startTime}`.localeCompare(`${b.date ?? "9999"}${b.startTime}`),
      ),
    };
  });
