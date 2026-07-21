import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SHOP_CONFIG } from "@/lib/shop-config";
import logo from "@/assets/logo.png";
import { LogIn, LayoutDashboard } from "lucide-react";

export function SiteHeader() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSignedIn(!!data.session);
      if (data.session) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.session.user.id);
        if (mounted) setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-header text-header-foreground shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt={SHOP_CONFIG.name} width={40} height={40} className="h-9 w-9 sm:h-10 sm:w-10 rounded bg-white p-1" />
          <div className="hidden sm:block leading-tight">
            <div className="font-bold text-base">{SHOP_CONFIG.name}</div>
            <div className="text-[10px] text-white/70">{SHOP_CONFIG.tagline}</div>
          </div>
        </Link>
        <div className="flex-1" />
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-1.5 rounded-md bg-header-accent px-3 py-1.5 text-sm font-medium hover:bg-header-accent/80">
            <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        {!signedIn && (
          <Link to="/auth" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-header-accent">
            <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Sign in</span>
          </Link>
        )}
      </div>
    </header>
  );
}
