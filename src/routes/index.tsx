import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileUp, ImageUp, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChuggCal — Import Your Syllabus, See Every Due Date" },
      {
        name: "description",
        content:
          "ChuggCal turns syllabus PDFs and assignment screenshots into a colour-coded school calendar. Stop typing assignments by hand.",
      },
      { property: "og:title", content: "ChuggCal — Import Your Syllabus, See Every Due Date" },
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

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <span className="text-sm font-semibold tracking-tight">ChuggCal</span>
        <Link to="/auth" className="ml-auto">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-16 pt-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Never type an assignment again.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Upload your syllabus PDF or a screenshot of your course assignment list. ChuggCal reads
          the due dates and builds your semester calendar for you.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Get started free</Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              icon: FileUp,
              title: "Syllabus PDF",
              body: "Drop in the PDF your professor posted. Every deliverable gets pulled out.",
            },
            {
              icon: ImageUp,
              title: "Screenshot import",
              body: "Snap your D2L, Canvas or Blackboard assignment list and upload the image.",
            },
            {
              icon: CalendarDays,
              title: "One calendar",
              body: "All courses in one month view, colour-coded, sorted by what's due next.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h2 className="mt-3 text-sm font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
