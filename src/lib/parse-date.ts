const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Year hint from a semester string like "Fall 2026". */
function inferYear(month: number, semester?: string): number {
  const now = new Date();
  const semYear = semester?.match(/(20\d{2})/)?.[1];
  if (semYear) {
    const base = Number(semYear);
    return /fall|autumn/i.test(semester ?? "") && month <= 4 ? base + 1 : base;
  }
  // Default: nearest sensible year — roll into next year if the date already passed.
  const y = now.getFullYear();
  const candidate = new Date(`${y}-${pad(month)}-01T12:00:00Z`);
  return candidate.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 200 ? y + 1 : y;
}

/**
 * Pull a due date out of free text like "Essay 2 due Oct 3" or "Quiz 10/3/2026".
 * Returns YYYY-MM-DD, or null when no date is present.
 */
export function parseDueDateFromText(text: string, semester?: string): string | null {
  if (!text) return null;
  const s = text.trim();

  // 2026-10-03
  const iso = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;

  // Oct 3, October 3rd 2026, 3 Oct
  const named =
    s.match(
      /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/,
    ) ?? null;
  if (named) {
    const m = MONTHS[named[1].toLowerCase()];
    const d = Number(named[2]);
    if (m && d >= 1 && d <= 31) {
      const year = named[3] ? Number(named[3]) : inferYear(m, semester);
      return `${year}-${pad(m)}-${pad(d)}`;
    }
  }
  const dayFirst = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s*(20\d{2}))?\b/);
  if (dayFirst) {
    const m = MONTHS[dayFirst[2].toLowerCase()];
    const d = Number(dayFirst[1]);
    if (m && d >= 1 && d <= 31) {
      const year = dayFirst[3] ? Number(dayFirst[3]) : inferYear(m, semester);
      return `${year}-${pad(m)}-${pad(d)}`;
    }
  }

  // 10/3, 10/3/26, 10-3-2026
  const numeric = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const m = Number(numeric[1]);
    const d = Number(numeric[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      let year: number;
      if (numeric[3]) {
        const raw = Number(numeric[3]);
        year = raw < 100 ? 2000 + raw : raw;
      } else {
        year = inferYear(m, semester);
      }
      return `${year}-${pad(m)}-${pad(d)}`;
    }
  }

  return null;
}
