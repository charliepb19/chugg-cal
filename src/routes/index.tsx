import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, ImageUp, CalendarDays, Gauge, Shield, TrendingUp, Users } from "lucide-react";
import logoAsset from "@/assets/chuggcal-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "chuggCal — Import Your Syllabus, See Every Due Date" },
      {
        name: "description",
        content:
          "chuggCal turns syllabus PDFs and assignment screenshots into a colour-coded school calendar. Stop typing assignments by hand.",
      },
      { property: "og:title", content: "chuggCal — Import Your Syllabus, See Every Due Date" },
      {
        property: "og:description",
        content:
          "Upload a syllabus PDF or a screenshot of your course assignment list and get a colour-coded calendar of every due date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const COURSES = [
  { code: "BIO 101", color: "var(--chart-1)" },
  { code: "HIST 210", color: "var(--chart-2)" },
  { code: "CALC 1", color: "var(--chart-4)" },
];

const DEMO_ITEMS: { day: number; course: number; title: string; done?: boolean; big?: boolean }[] = [
  { day: 3, course: 0, title: "Lab 1", done: true },
  { day: 6, course: 2, title: "HW 1", done: true },
  { day: 8, course: 1, title: "Reading 2", done: true },
  { day: 10, course: 0, title: "Quiz 1" },
  { day: 13, course: 2, title: "HW 2" },
  { day: 15, course: 1, title: "Essay draft" },
  { day: 17, course: 0, title: "Exam #1", big: true },
  { day: 17, course: 2, title: "Quiz 2" },
  { day: 20, course: 1, title: "Reading 4" },
  { day: 22, course: 2, title: "Midterm", big: true },
  { day: 24, course: 0, title: "Lab 3" },
  { day: 27, course: 1, title: "Essay final", big: true },
  { day: 29, course: 2, title: "HW 4" },
];

function DemoCalendar() {
  const [filter, setFilter] = useState<number | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const offset = 3; // month starts on Wednesday
  const cells = Array.from({ length: 35 }, (_, i) => i - offset + 1);
  const items = DEMO_ITEMS.filter(
    (it) => (filter === null || it.course === filter) && (!hideDone || !it.done),
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-auto font-display text-lg font-semibold">October</span>
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full border px-3 py-1 text-xs ${filter === null ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
        >
          All courses
        </button>
        {COURSES.map((c, i) => (
          <button
            key={c.code}
            onClick={() => setFilter(filter === i ? null : i)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${filter === i ? "border-primary bg-accent" : "border-border"}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.code}
          </button>
        ))}
        <button
          onClick={() => setHideDone((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs ${hideDone ? "border-primary bg-accent" : "border-border"}`}
        >
          Hide completed
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="px-1 pb-1 text-center font-medium">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-16 rounded-md border p-1 text-left ${day < 1 || day > 31 ? "border-transparent" : "border-border bg-background"}`}
          >
            {day >= 1 && day <= 31 && (
              <>
                <div className="mb-0.5">{day}</div>
                {items
                  .filter((it) => it.day === day)
                  .map((it) => (
                    <div
                      key={it.title}
                      className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] text-foreground ${it.done ? "line-through opacity-50" : ""} ${it.big ? "font-semibold" : ""}`}
                      style={{
                        background: `color-mix(in oklab, ${COURSES[it.course]!.color} 25%, transparent)`,
                        borderLeft: `3px solid ${COURSES[it.course]!.color}`,
                      }}
                    >
                      {it.done && "✓ "}
                      {it.title}
                    </div>
                  ))}
              </>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Sample semester — try the filters. Your real one builds itself from your syllabus.
      </p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <span className="flex items-center gap-2">
          <img src={logoAsset.url} alt="chuggCal logo" className="h-7 w-7 rounded-md" />
          <span className="font-display text-lg font-semibold tracking-tight text-primary">
            chuggCal
          </span>
        </span>
        <Link to="/auth" className="ml-auto">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-16 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
          Built by a student, for students
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Never type an assignment again.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Upload your syllabus PDF or a screenshot of your course assignment list. chuggCal reads
          the due dates, the grade weights, and builds your whole semester in seconds.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Get started free</Button>
          </Link>
          <a href="#demo">
            <Button size="lg" variant="outline">
              See the demo
            </Button>
          </a>
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-4xl scroll-mt-8 px-4 pb-16">
        <DemoCalendar />
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <h2 className="mb-6 text-center text-2xl font-semibold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: FileUp, title: "1. Upload", body: "Drop in your syllabus PDF, or screenshots from Canvas, D2L or Blackboard." },
            { icon: ImageUp, title: "2. Review", body: "Check what chuggCal found — dates, types and grade weights — and fix anything." },
            { icon: CalendarDays, title: "3. Done", body: "Every course lands on one colour-coded calendar, sorted by what's due next." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <h2 className="mb-6 text-center text-2xl font-semibold">Things no other planner does</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Gauge, title: "Panic score", body: "One daily number that tells you if today is a coast day or a grind day." },
            { icon: Shield, title: "Grade insurance", body: "Find the cheapest assignment you can skip and still keep your letter grade." },
            { icon: TrendingUp, title: "Am I on track?", body: "See your projected final grade and what you need on the rest for an A." },
            { icon: Users, title: "Classmate check", body: "Anonymous cross-checks with your section catch dates that look wrong." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3 rounded-xl border border-border bg-card p-5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 text-center">
        <div className="rounded-2xl bg-primary px-6 py-10 text-primary-foreground">
          <h2 className="text-2xl font-semibold">Your semester, sorted in two minutes.</h2>
          <p className="mt-2 text-sm opacity-90">Free. Installs on your phone like an app.</p>
          <Link to="/auth" className="mt-6 inline-block">
            <Button size="lg" variant="secondary">
              Import my first syllabus
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} chuggCal · Made for students
      </footer>
    </div>
  );
}
