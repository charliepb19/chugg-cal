const STORAGE_KEY = "chuggcal-theme";

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Inline script string evaluated in <head> before first paint to avoid theme flash. */
export const themeInitScript = `(function(){try{var t=window.localStorage.getItem("${STORAGE_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;
