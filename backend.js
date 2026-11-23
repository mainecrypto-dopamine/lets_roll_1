/* Let's Roll backend: Supabase stands in for the capabilities the app used inside Claude.
   It exposes window.claude.use("db" | "user" | "sample") with the same shape the app expects,
   and shows a sign-in screen until a family member is logged in. */
(function () {
  const cfg = window.LR_CONFIG || {};
  const ready = cfg.supabaseUrl && cfg.supabaseAnonKey && !/YOUR_/.test(cfg.supabaseUrl + cfg.supabaseAnonKey);
  const sb = ready && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  let session = null, member = null, loaded = false;
  const cache = new Map();          // path -> data
  const listeners = new Set();      // functions called after every change
  const collOf = p => p.slice(0, p.lastIndexOf("/"));
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 20);
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const meta = () => ({ fromCache: !loaded, hasPendingWrites: false });

  function snapDoc(path) {
    const v = cache.get(path);
    return { id: path.split("/").pop(), exists: v !== undefined, data: () => clone(v), metadata: meta() };
  }
  function snapColl(coll) {
    const docs = [...cache.keys()].filter(p => collOf(p) === coll).map(snapDoc);
    return { docs, size: docs.length, empty: !docs.length, metadata: meta(), docChanges: () => [] };
  }
  function emit() { listeners.forEach(l => { try { l(); } catch (e) { console.error(e); } }); }

  async function loadAll() {
    const { data, error } = await sb.from("docs").select("path,data");
    if (error) throw error;
    cache.clear();
    data.forEach(r => cache.set(r.path, r.data));
    loaded = true;
    emit();
  }
  function goLive() {
    sb.channel("docs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, p => {
        if (p.eventType === "DELETE") cache.delete(p.old.path);
        else cache.set(p.new.path, p.new.data);
        emit();
      })
      .subscribe(st => { if (st === "SUBSCRIBED") loadAll().catch(console.error); });
    // phones pause pages in the background: catch up when the app comes back
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadAll().catch(() => {}); });
    setInterval(() => { if (document.visibilityState === "visible") loadAll().catch(() => {}); }, 30000);
  }

  const fail = e => { throw { code: "invalid_argument", message: (e && e.message) || "Not allowed" }; };
  async function write(path, data) {
    cache.set(path, clone(data)); emit();
    const { error } = await sb.from("docs").upsert({ path, coll: collOf(path), data, updated_at: new Date().toISOString() });
    if (error) { await loadAll().catch(() => {}); fail(error); }
  }
  async function remove(path) {
    cache.delete(path); emit();
    const { error } = await sb.from("docs").delete().eq("path", path);
    if (error) { await loadAll().catch(() => {}); fail(error); }
  }
  function listen(make, next) {
    const l = () => next(make());
    listeners.add(l);
    if (loaded) setTimeout(l, 0);
    return () => listeners.delete(l);
  }
  function docRef(path) {
    return {
      id: path.split("/").pop(), path,
      get: async () => snapDoc(path),
      set: d => write(path, d),
      update: async d => { const cur = cache.get(path); if (cur === undefined) fail({ message: "Missing document" }); return write(path, Object.assign({}, cur, d)); },
      delete: () => remove(path),
      onSnapshot: next => listen(() => snapDoc(path), next),
      collection: c => collRef(path + "/" + c)
    };
  }
  function collRef(coll) {
    const q = {
      path: coll,
      doc: id => docRef(coll + "/" + (id || rid())),
      add: async d => { const r = docRef(coll + "/" + rid()); await r.set(d); return r; },
      get: async () => snapColl(coll),
      onSnapshot: next => listen(() => snapColl(coll), next),
      where() { return q; }, orderBy() { return q; }, limit() { return q; }
    };
    return q;
  }
  const db = { doc: docRef, collection: collRef };

  const user = {
    isOwner: async () => member?.role === "owner",
    canEdit: async () => member?.role === "owner",
    can: async () => !!member,
    id: async () => session?.user?.id || null,
    me: async () => ({ id: session?.user?.id, name: member?.name || "" }),
    profiles: async ids => Object.fromEntries((ids || []).map(i => [i, { name: "" }]))
  };

  async function ask(prompt) {
    const { data, error } = await sb.functions.invoke("ask", { body: { prompt: String(prompt) } });
    if (error) throw { code: "unavailable", message: error.message };
    return { text: data?.text || "", truncated: false };
  }
  const sample = Object.assign(input => ask(typeof input === "string" ? input : (input || []).map(m => m.content).join("\n")), {
    json: async (input) => {
      const { text } = await ask(input);
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return JSON.parse(m ? m[0] : text);
    },
    limits: async () => ({ images: false })
  });

  /* ---------- sign-in screen ---------- */
  let resolveReady;
  const readyP = new Promise(r => (resolveReady = r));
  function gate(html) {
    let el = document.getElementById("lrGate");
    if (!el) {
      el = document.createElement("div"); el.id = "lrGate";
      el.style.cssText = "position:fixed;inset:0;z-index:50;background:#141416;color:#fff;display:grid;place-items:center;padding:24px;font:16px/1.5 Anuphan,system-ui,sans-serif";
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="width:min(100%,380px);display:grid;gap:14px;text-align:center">
      <img src="icons/icon-192.png" alt="" width="88" height="88" style="justify-self:center;border-radius:24px">
      <div style="font:700 30px Mali,Anuphan,sans-serif">Let's <span style="color:#ffcc00">Roll</span></div>${html}</div>`;
    return el;
  }
  const inp = "width:100%;font-size:17px;padding:13px 14px;border-radius:14px;border:2px solid #333;background:#1f1f23;color:#fff;box-sizing:border-box";
  const btn = "min-height:52px;border:0;border-radius:14px;background:#ffcc00;color:#111;font:700 18px Anuphan,sans-serif;cursor:pointer";
  function showEmail(msg) {
    const el = gate(`<p style="margin:0;color:#c9c9cf">Sign in with your email · เข้าสู่ระบบด้วยอีเมล</p>
      <input id="lrEmail" type="email" autocomplete="email" placeholder="you@gmail.com" style="${inp}">
      <button id="lrSend" style="${btn}">Send me a code</button><p id="lrMsg" style="margin:0;color:#ff8592;min-height:1.5em">${msg || ""}</p>`);
    el.querySelector("#lrSend").onclick = async () => {
      const email = el.querySelector("#lrEmail").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { el.querySelector("#lrMsg").textContent = "Enter your email address."; return; }
      el.querySelector("#lrSend").disabled = true;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) { el.querySelector("#lrMsg").textContent = error.message; el.querySelector("#lrSend").disabled = false; return; }
      showCode(email);
    };
  }
  function showCode(email) {
    const el = gate(`<p style="margin:0;color:#c9c9cf">We emailed <b>${email.replace(/[<>&"]/g, "")}</b>.<br>Type the code, or tap the link in the email.</p>
      <input id="lrCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" style="${inp};text-align:center;letter-spacing:.3em;font-size:24px">
      <button id="lrGo" style="${btn}">Let's Roll</button><button id="lrBack" style="background:none;border:0;color:#c9c9cf;cursor:pointer">Use a different email</button>
      <p id="lrMsg" style="margin:0;color:#ff8592;min-height:1.5em"></p>`);
    el.querySelector("#lrBack").onclick = () => showEmail();
    el.querySelector("#lrGo").onclick = async () => {
      const token = el.querySelector("#lrCode").value.trim();
      const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
      if (error) el.querySelector("#lrMsg").textContent = "That code didn't work. Check it and try again.";
    };
  }
  let admitting = false;
  async function admit(s) {
    if (member || admitting) return;
    admitting = true;
    try { await admitInner(s); } finally { admitting = false; }
  }
  async function admitInner(s) {
    session = s;
    if (!s) { showEmail(); return; }
    const { data } = await sb.from("members").select("email,role,name").ilike("email", s.user.email).maybeSingle();
    if (!data) {
      const el = gate(`<p style="margin:0;color:#c9c9cf">${s.user.email} isn't on the team yet.<br>Ask the owner to add you.</p><button id="lrOut" style="${btn}">Sign out</button>`);
      el.querySelector("#lrOut").onclick = () => sb.auth.signOut();
      return;
    }
    member = data;
    document.getElementById("lrGate")?.remove();
    if (!loaded) { goLive(); await loadAll().catch(console.error); }
    resolveReady();
  }

  // LINE Official Account sending (only once you've set it up and turned on lineEnabled in config.js)
  if (sb && cfg.lineEnabled) {
    window.lrLine = {
      send: async (to, text) => {
        const { data, error } = await sb.functions.invoke("line-send", { body: { to, text } });
        if (error) throw { message: error.message };
        if (!data?.ok) throw { message: (data?.results || []).filter(r => !r.ok).map(r => r.status).join(", ") || data?.error || "failed" };
        return data;
      }
    };
  }

  const caps = { db, user, sample };
  window.claude = {
    use: async name => {
      if (!sb) return null;
      await readyP;
      return caps[name] || null;
    }
  };
  window.lrSignOut = () => sb && sb.auth.signOut().then(() => location.reload());

  document.addEventListener("DOMContentLoaded", () => {
    if (!sb) { gate(`<p style="margin:0;color:#ff8592">Setup needed: add your Supabase URL and key to <b>config.js</b>.</p>`); return; }
    sb.auth.getSession().then(({ data }) => admit(data.session));
    sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_IN" && !member) admit(s); if (ev === "SIGNED_OUT") location.reload(); });
  });
})();
