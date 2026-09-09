import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  name: string;
  semester: string;
  color: string;
  created_at: string;
};

export type AssignmentSource = "manual" | "parsed_pdf" | "parsed_image";

export type AssignmentType = "assignment" | "exam" | "quiz" | "reading";

export type Assignment = {
  id: string;
  course_id: string;
  title: string;
  notes: string;
  due_date: string | null;
  completed: boolean;
  source: AssignmentSource;
  confirmed: boolean;
  type: AssignmentType;
  weight: string;
  category: string;
  score: number | null;
  /** bonus work: adds points on top instead of counting toward the course total */
  extra_credit: boolean;
};

export type GradeCategory = {
  id: string;
  course_id: string;
  name: string;
  weight: number;
  source: AssignmentSource;
  /** true when each item in the category is worth `weight` on its own (e.g. exams) */
  per_item: boolean;
};

export const gradeCategoriesQuery = {
  queryKey: ["grade_categories"],
  queryFn: async (): Promise<GradeCategory[]> => {
    const { data, error } = await supabase
      .from("grade_categories")
      .select("id,course_id,name,weight,source,per_item")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c) => ({ ...c, weight: Number(c.weight) })) as GradeCategory[];
  },
};

export const COURSE_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

export const coursesQuery = {
  queryKey: ["courses"],
  queryFn: async (): Promise<Course[]> => {
    const { data, error } = await supabase
      .from("courses")
      .select("id,name,semester,color,created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Course[];
  },
};

export const assignmentsQuery = {
  queryKey: ["assignments"],
  queryFn: async (): Promise<Assignment[]> => {
    const { data, error } = await supabase
      .from("assignments")
      .select("id,course_id,title,notes,due_date,completed,source,confirmed,type,weight,category,score,extra_credit")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as Assignment[];
  },
};
