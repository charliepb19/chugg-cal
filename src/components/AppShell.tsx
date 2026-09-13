import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  LayoutList,
  BookOpen,
  LogOut,
  GraduationCap,
  BarChart3,
  Briefcase,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoAsset from "@/assets/chuggcal-logo.png.asset.json";

const nav = [
  { to: "/dashboard", label: "Upcoming", icon: LayoutList },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/gradebook", label: "Grades", icon: GraduationCap },
  { to: "/workload", label: "Workload", icon: BarChart3 },
  { to: "/work", label: "Work", icon: Briefcase },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src={logoAsset.url}
              alt="ChuggCal logo"
              className="h-7 w-7 rounded-md"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-primary">
              ChuggCal
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
