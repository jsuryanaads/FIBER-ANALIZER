import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("AUTH_REQUIRED");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const token = authHeader.replace(/^Bearer\s+/, "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("AUTH_REQUIRED");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,organization_id,role,active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "ADMINISTRATOR" || !profile.active) {
      throw new Error("ADMIN_REQUIRED");
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim();
    const role = String(body.role || "").toUpperCase();

    if (!email || !name || !["PENGELOLA", "TEKNISI"].includes(role)) {
      throw new Error("INVALID_INPUT");
    }

    const { data: inv, error: invError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, username, role, organization_id: profile.organization_id },
    });
    if (invError) throw invError;

    const { data: newProfile, error: newProfileError } = await admin
      .from("profiles")
      .insert({
        id: inv.user.id,
        organization_id: profile.organization_id,
        role,
        name,
        username,
        active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (newProfileError) {
      await admin.auth.admin.deleteUser(inv.user.id);
      throw newProfileError;
    }

    await admin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      actor_user_id: user.id,
      action: "USER_INVITED",
      entity_type: "profiles",
      entity_id: newProfile?.id ?? inv.user.id,
      metadata: { email, username, role },
    });

    return new Response(JSON.stringify({ profile: newProfile }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "REQUEST_FAILED" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});