// Supabase Edge Function "line-webhook": LINE calls this when someone adds or messages your Let's Roll account.
// It remembers who they are (LINE name + ID) so you can link them to a contact in the app.
// Secrets needed: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN. Deploy with JWT verification OFF (LINE can't sign in).
import { createClient } from "jsr:@supabase/supabase-js@2";

async function validSignature(body: string, sig: string | null, secret: string) {
  if (!sig || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await validSignature(body, req.headers.get("x-line-signature"), Deno.env.get("LINE_CHANNEL_SECRET") ?? ""))) {
    return new Response("bad signature", { status: 401 });
  }
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const events = (JSON.parse(body || "{}").events ?? []) as Array<Record<string, any>>;

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId || !["follow", "message"].includes(ev.type)) continue;
    let displayName = "";
    try {
      const p = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (p.ok) displayName = (await p.json()).displayName ?? "";
    } catch { /* name is optional */ }
    await admin.from("docs").upsert({
      path: `linefollowers/${userId}`, coll: "linefollowers",
      data: { userId, displayName, lastText: ev.message?.text?.slice(0, 200) ?? "", at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
    if (ev.type === "follow" && ev.replyToken) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: "text", text: "🛞 สวัสดีครับ! เชื่อมต่อกับ Let's Roll แล้ว\nConnected to Let's Roll ✓" }] }),
      });
    }
  }
  return new Response("ok");
});
