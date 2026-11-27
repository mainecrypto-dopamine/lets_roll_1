// Supabase Edge Function "enter": lets a BUDDY or GUEST sign in with just their email (no code, no password).
// Only works for emails listed in the members table with role 'buddy' or 'guest'. Owners and family still use the email code.
// Deploy with Enforce JWT verification turned OFF (the buddy isn't signed in yet).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email } = await req.json();
    const e = String(email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return json({ error: "Enter your email address." }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: m } = await admin.from("members").select("email,role").ilike("email", e).maybeSingle();
    if (!m || !["buddy", "guest"].includes(m.role)) return json({ error: "not_buddy" }, 403);
    let link = await admin.auth.admin.generateLink({ type: "magiclink", email: m.email });
    if (link.error) {
      await admin.auth.admin.createUser({ email: m.email, email_confirm: true });
      link = await admin.auth.admin.generateLink({ type: "magiclink", email: m.email });
    }
    if (link.error) return json({ error: link.error.message }, 500);
    return json({ token_hash: link.data.properties.hashed_token });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
