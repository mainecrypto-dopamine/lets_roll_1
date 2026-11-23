// Supabase Edge Function "ask": lets the app ask Claude for Thai/English translations.
// Needs one secret: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Only signed-in team members may use it (keeps your Claude bill yours).
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ok, error: memberErr } = await sb.rpc("is_member");
  if (memberErr || ok !== true) return json({ error: "Not on the team" }, 403);

  let prompt = "";
  try { prompt = String((await req.json()).prompt ?? ""); } catch { return json({ error: "Bad request" }, 400); }
  if (!prompt || prompt.length > 8000) return json({ error: "Prompt missing or too long" }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("CLAUDE_MODEL") ?? "claude-haiku-5-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) return json({ error: "Claude API error " + r.status }, 502);
  const j = await r.json();
  const text = (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return json({ text });
});
