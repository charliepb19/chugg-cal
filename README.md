# ChuggCal

ChuggCal is a school assignment calendar app that eliminates manual entry. Instead of typing in every due date by hand, upload a syllabus PDF or a screenshot of your assignment list from your school's LMS (D2L, Canvas, Blackboard, Moodle), and ChuggCal reads it and builds your calendar for you.

## Why ChuggCal?

Keeping track of due dates across multiple classes usually means manually copying dates from a syllabus or LMS into a planner. ChuggCal removes that step — upload what you already have, and let the app do the parsing, weighting, and scheduling.

## Features

- **Syllabus & screenshot import** — Upload a PDF syllabus or an LMS screenshot; ChuggCal extracts every assignment, exam, quiz, and reading, along with due dates and grading weights.
- **Smart date handling** — Distinguishes real due dates from "available"/opening dates, infers missing years from semester context, and expands recurring items (e.g. "quiz every Friday") automatically.
- **Grading breakdown parsing** — Reads the syllabus's grading table (e.g. "Quizzes: 15%, Exams: 40%") and separates it from the dated calendar items.
- **What-if grade calculator** — Model hypothetical scores to see their effect on your final grade.
- **Gradebook** — Track actual scores against each course's grading categories.
- **Calendar & agenda views** — Drag-to-reschedule calendar, week view, and an agenda list.
- **Workload view** — See how work is distributed across the semester to spot heavy weeks.
- **Work schedule import** — Import a work schedule alongside your coursework.
- **Dark mode & PWA** — Installable as a standalone app, with a custom icon and theme.
- **Onboarding flow** — Guided first-run setup for new users.

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19) + [TanStack Router](https://tanstack.com/router) with file-based routing
- **Build tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Backend:** [Supabase](https://supabase.com) (auth, database, migrations)
- **Validation:** Zod
- **PDF parsing:** unpdf
- **Package manager:** Bun
- **Dev tooling:** ESLint, Prettier
- **Built with:** [Lovable](https://lovable.dev)

## Project Structure

```
src/
├── components/       # UI components (AgendaView, ImportPanel, WhatIfGrade, Onboarding, etc.)
│   └── ui/           # shadcn/ui primitives
├── integrations/
│   ├── supabase/     # Supabase client, auth middleware, generated types
│   └── lovable/       # Lovable platform integration
├── lib/              # Core logic: import parsing, grade calculations, date parsing, syllabus diffing
├── routes/           # File-based routes (dashboard, calendar, courses, gradebook, workload, work)
├── routeTree.gen.ts  # Auto-generated route tree
└── server.ts         # Server entry point

supabase/
└── migrations/       # Database schema migrations
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Supabase](https://supabase.com) project (for auth and database)

### Installation

```bash
git clone https://github.com/charliepb19/chuggcal.git
cd chuggcal
bun install
```

### Development

```bash
bun run dev
```

### Other scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the dev server |
| `bun run build` | Production build |
| `bun run build:dev` | Development-mode build |
| `bun run preview` | Preview a production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format code with Prettier |

## Status

🚧 In active development. Core import flow, calendar, gradebook, and workload views are functional. Current focus is pre-launch polish — see [`roadmap.md`](./roadmap.md) for the full list, including:

- Onboarding flow refinement
- Streaming import UX (items appear one by one)
- Syllabus diffing (re-upload shows moved/added/dropped dates)
- Grade-aware scheduling and high-stakes week callouts
- "Am I on track?" end-of-semester forecasting

## Contributing

This is currently a personal/student project. Feel free to open an issue if you have suggestions.

