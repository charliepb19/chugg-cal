import { useCallback, useEffect, useState } from "react";

export type ReminderFrequency = "off" | "daily" | "twice" | "hourly";

export type ReminderSettings = {
  /** How many days ahead an assignment shows up in the bell. */
  leadDays: number;
  /** How often browser notifications are sent. */
  frequency: ReminderFrequency;
  /** Preferred hour of day (0-23) for daily/twice-daily reminders. */
  hour: number;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  leadDays: 7,
  frequency: "off",
  hour: 8,
};

const KEY = "chuggcal.reminders";
const LAST_KEY = "chuggcal.reminders.lastSent";

function read(): ReminderSettings {
  if (typeof window === "undefined") return DEFAULT_REMINDER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_REMINDER_SETTINGS;
    return { ...DEFAULT_REMINDER_SETTINGS, ...(JSON.parse(raw) as Partial<ReminderSettings>) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

/** Reads/writes the user's reminder preferences from local storage. */
export function useReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  useEffect(() => {
    setSettings(read());
  }, []);

  const update = useCallback((patch: Partial<ReminderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { settings, update };
}

/** True when enough time has passed since the last notification for this frequency. */
export function shouldNotify(settings: ReminderSettings, now = new Date()): boolean {
  if (settings.frequency === "off") return false;
  const last = Number(window.localStorage.getItem(LAST_KEY) ?? 0);
  const minutesSince = (now.getTime() - last) / 60000;
  if (settings.frequency === "hourly") return minutesSince >= 60;

  const hours = settings.frequency === "twice" ? [settings.hour, (settings.hour + 12) % 24] : [settings.hour];
  const atSlot = hours.some((h) => now.getHours() === h);
  return atSlot && minutesSince >= 60 * 6;
}

export function markNotified(now = new Date()) {
  try {
    window.localStorage.setItem(LAST_KEY, String(now.getTime()));
  } catch {
    /* storage unavailable */
  }
}

export function frequencyLabel(f: ReminderFrequency): string {
  return f === "off"
    ? "No notifications"
    : f === "daily"
      ? "Once a day"
      : f === "twice"
        ? "Twice a day"
        : "Every hour";
}
