import { BookOpen, FileText, GraduationCap, HelpCircle } from "lucide-react";
import type { AssignmentType } from "@/lib/db";

/** Small icon that shows at a glance what kind of work an item is. */
export function AssignmentTypeIcon({
  type,
  className = "h-3 w-3 shrink-0",
}: {
  type: AssignmentType | string;
  className?: string;
}) {
  switch (type) {
    case "exam":
      return <GraduationCap className={className} aria-label="Exam" />;
    case "quiz":
      return <HelpCircle className={className} aria-label="Quiz" />;
    case "reading":
      return <BookOpen className={className} aria-label="Reading" />;
    default:
      return <FileText className={className} aria-label="Assignment" />;
  }
}
