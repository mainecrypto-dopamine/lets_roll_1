// Supabase Edge Function "line-send": pushes a text message from your Let's Roll LINE Official Account.
// Secrets needed: LINE_CHANNEL_ACCESS_TOKEN. Only signed-in team members can call it.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: ok } = await sb.rpc("is_member");
  if (ok !== true) return json({ ok: false, error: "Not on the team" }, 403);

  let to: string[] = [], text = "";
  try { const b = await req.json(); to = Array.isArray(b.to) ? b.to.map(String) : []; text = String(b.text ?? ""); }
  catch { return json({ ok: false, error: "Bad request" }, 400); }
  to = [...new Set(to.filter((id) => /^U[0-9a-f]{32}$/.test(id)))].slice(0, 20);
  if (!to.length || !text) return json({ ok: false, error: "Nobody to send to, or empty message" }, 400);
  if (text.length > 4900) text = text.slice(0, 4900);

  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
  const results = await Promise.all(to.map(async (id) => {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: id, messages: [{ type: "text", text }] }),
    });
    return { id, ok: r.ok, status: r.status, error: r.ok ? undefined : (await r.text()).slice(0, 300) };
  }));
  return json({ ok: results.every((r) => r.ok), results });
});
