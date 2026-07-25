import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.object({
  requested: z.enum(["admin", "salesperson", "user"]),
});

export const claimSignupRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("claim_signup_role", {
      _requested: data.requested,
    } as never);
    // The RPC uses auth.uid(); when called via admin client that's null.
    // So we replicate the logic here directly instead.
    void result;
    if (error) {
      // fall through to manual logic
    }

    const uid = context.userId;
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();
    if (existing?.role) return { role: existing.role };

    let assigned: "admin" | "salesperson" | "user" = "user";
    if (data.requested === "admin") {
      assigned = "admin";
    } else if (data.requested === "salesperson") {
      assigned = "salesperson";
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: assigned });
    if (insErr) throw insErr;
    return { role: assigned };
  });
