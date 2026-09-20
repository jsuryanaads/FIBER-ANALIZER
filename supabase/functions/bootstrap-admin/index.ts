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
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) throw new Error("AUTH_REQUIRED");

    const { data: existing } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ profile: existing }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { count: profileCount, error: countError } = await admin
      .from("profiles").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    if ((profileCount ?? 0) > 0) throw new Error("BOOTSTRAP_NOT_AVAILABLE");

    const meta = user.user_metadata || {};
    const orgName = String(meta.organization_name || "FIBER-ANALYZER Organization").trim();
    const name = String(meta.name || meta.full_name || "Administrator").trim();
    const username = String(meta.username || "").trim() || null;
    const codeBase = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fiber-analyzer";

    let { data: org, error: orgError } = await admin
      .from("organizations").select("*").eq("created_by", user.id).maybeSingle();
    if (orgError) throw orgError;

    if (!org) {
      const inserted = await admin.from("organizations").insert({
        name: orgName,
        code: codeBase + "-" + user.id.slice(0, 8),
        created_by: user.id,
      }).select().single();
      if (inserted.error) throw inserted.error;
      org = inserted.data;
    }

    const { data: profile, error: profileError } = await admin.from("profiles").insert({
      id: user.id,
      organization_id: org.id,
      role: "ADMINISTRATOR",
      name,
      username,
      active: true,
      created_by: user.id,
    }).select().single();
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ profile }), {
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