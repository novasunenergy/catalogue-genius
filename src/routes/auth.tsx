import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { claimSignupRole } from "@/lib/claim-role.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: search.role === "admin" || search.role === "salesperson" ? search.role : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Team Login — Mayur Hardware" },
      { name: "description", content: "Admin and staff sign-in for Mayur Hardware catalogue management and order entry." },
      { property: "og:title", content: "Team Login — Mayur Hardware" },
      { property: "og:description", content: "Admin and staff sign-in for Mayur Hardware catalogue management and order entry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Role = "admin" | "salesperson";

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", sess.session.user.id);
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("admin")) navigate({ to: "/admin" });
  else if (set.has("salesperson")) navigate({ to: "/sales" });
  else navigate({ to: "/" });
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const selectedRole = search.role ?? "salesperson";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>(selectedRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { routeByRole(navigate); }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) throw new Error("Full name is required");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), role },
          },
        });
        if (error) throw error;
        // Self-assign requested role via server function (admin-side)
        await claimSignupRole({ data: { requested: role } });
        toast.success("Account created.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
      await routeByRole(navigate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-secondary px-4 py-8">
      <div className="w-full max-w-sm rounded-lg bg-card border shadow-lg p-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <img src={logo} alt={SHOP_CONFIG.name} width={64} height={64} className="h-16 w-16" />
          <h1 className="text-xl font-bold">{selectedRole === "admin" ? "Admin Login" : "Staff Login"}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup" ? `Create ${role === "admin" ? "admin" : "staff"} account` : SHOP_CONFIG.name}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Account type</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRole("salesperson")}
                    className={`rounded-md border py-2 text-sm ${role === "salesperson" ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                    Staff
                  </button>
                  <button type="button" onClick={() => setRole("admin")}
                    className={`rounded-md border py-2 text-sm ${role === "admin" ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                    Admin
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full name</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button disabled={loading} className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div className="mt-3 text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>No account? <button className="text-primary underline" onClick={() => setMode("signup")}>Create one</button></>
          ) : (
            <>Have an account? <button className="text-primary underline" onClick={() => setMode("signin")}>Sign in</button></>
          )}
        </div>
        <div className="mt-3 text-center text-[10px] text-muted-foreground">
          Customers do not need to sign in — the product catalogue opens directly from the QR code or share link.
        </div>
      </div>
    </div>
  );
}
