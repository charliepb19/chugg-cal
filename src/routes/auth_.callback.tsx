import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { consumeOAuthReturn } from "@/lib/oauth-callback";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — chuggCal" },
      { name: "description", content: "Finishing your chuggCal sign-in." },
      { property: "og:title", content: "Signing you in — chuggCal" },
      { property: "og:description", content: "Finishing your chuggCal sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = consumeOAuthReturn();
      if (result?.tokens) {
        const { error } = await supabase.auth.setSession(result.tokens);
        if (!cancelled && !error) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
      }
      if (!cancelled && result?.error) toast.error("Sign-in didn't complete. Please try again.");

      // Maybe the session already landed some other way.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in…
      </div>
    </div>
  );
}
