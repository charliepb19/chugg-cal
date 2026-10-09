import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { assignmentsQuery, coursesQuery } from "@/lib/db";
import { AssignmentTypeIcon } from "@/lib/assignment-type";

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: courses = [] } = useQuery({ ...coursesQuery, enabled: open });
  const { data: assignments = [] } = useQuery({ ...assignmentsQuery, enabled: open });
  const byCourse = Object.fromEntries(courses.map((c) => [c.id, c]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(courseId: string) {
    setOpen(false);
    navigate({ to: "/courses/$courseId", params: { courseId } });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Search">
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search assignments, courses, notes…" />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandGroup heading="Courses">
            {courses.map((c) => (
              <CommandItem key={c.id} value={`course ${c.name} ${c.id}`} onSelect={() => go(c.id)}>
                <BookOpen className="h-4 w-4" style={{ color: c.color }} />
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Assignments">
            {assignments.map((a) => {
              const c = byCourse[a.course_id];
              return (
                <CommandItem
                  key={a.id}
                  value={`${a.title} ${c?.name ?? ""} ${a.notes ?? ""} ${a.id}`}
                  onSelect={() => go(a.course_id)}
                >
                  <AssignmentTypeIcon type={a.type} className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c?.name}
                      {a.due_date ? ` · ${new Date(a.due_date).toLocaleDateString()}` : ""}
                      {a.notes ? ` · ${a.notes}` : ""}
                    </p>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
