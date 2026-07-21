import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You are signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-sm rounded-lg bg-card border shadow-lg p-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <img src={logo} alt={SHOP_CONFIG.name} width={64} height={64} className="h-16 w-16" />
          <h1 className="text-xl font-bold">{SHOP_CONFIG.name}</h1>
          <p className="text-sm text-muted-foreground">Admin sign in</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
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
          The first account created becomes the admin.
        </div>
      </div>
    </div>
  );
}
