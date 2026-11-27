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
    const el = gate(`<p style="margin:0;color:#c9c9cf">Sign in · เข้าสู่ระบบ</p>
      ${cfg.googleSignIn ? `<button id="lrGoogle" style="${btn};background:#fff;display:flex;align-items:center;justify-content:center;gap:10px"><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>
      <p style="margin:0;color:#8a8a92">or use your email · หรือใช้อีเมล</p>` : ""}
      <input id="lrEmail" type="email" autocomplete="email" placeholder="you@gmail.com" style="${inp}">
      <button id="lrEnter" style="${btn}">Enter · เข้า</button>
      <button id="lrSend" style="background:none;border:0;color:#c9c9cf;cursor:pointer;font-size:15px">Owner? Send me a code</button>
      <button id="lrPw" style="background:none;border:0;color:#c9c9cf;cursor:pointer;font-size:15px">Use a password · ใช้รหัสผ่าน</button><p id="lrMsg" style="margin:0;color:#ff8592;min-height:1.5em">${msg || ""}</p>`);
    el.querySelector("#lrGoogle")?.addEventListener("click", () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }));
    el.querySelector("#lrEnter").onclick = async () => {
      const email = el.querySelector("#lrEmail").value.trim(), msg = el.querySelector("#lrMsg"), b = el.querySelector("#lrEnter");
      if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = "Enter your email address. · ใส่อีเมล"; return; }
      b.disabled = true; msg.textContent = "";
      try {
        const { data, error } = await sb.functions.invoke("enter", { body: { email } });
        if (error || !data?.token_hash) {
          const st = error?.context?.status;
          let code = data?.error; try { code = code || (await error?.context?.clone().json())?.error; } catch (_) {}
          if (st === 401) throw new Error("401 — in Supabase, turn OFF 'Enforce JWT verification' on the enter function");
          if (st === 404) throw new Error("404 — the 'enter' function isn't deployed yet (check the name is exactly enter)");
          if (st && code && code !== "not_buddy") throw new Error(st + " — " + code);
          if (code === "not_buddy") { b.disabled = false; msg.textContent = "Not set up for quick entry. Sending you a code instead…"; el.querySelector("#lrSend").click(); return; }
          throw new Error(code || error?.message || "failed");
        }
        const v = await sb.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
        if (v.error) throw v.error;
      } catch (err) { b.disabled = false; msg.textContent = "Couldn't sign in: " + (err?.message || err); }
    };
    const auto = new URLSearchParams(location.hash.slice(1)).get("enter");
    if (auto && !msg) { el.querySelector("#lrEmail").value = auto; history.replaceState(null, "", location.pathname); setTimeout(() => el.querySelector("#lrEnter").click(), 50); }
    el.querySelector("#lrEmail").addEventListener("keydown", e => { if (e.key === "Enter") el.querySelector("#lrEnter").click(); });
    el.querySelector("#lrPw").onclick = () => showPassword(el.querySelector("#lrEmail").value.trim());
    el.querySelector("#lrSend").onclick = async () => {
      const email = el.querySelector("#lrEmail").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { el.querySelector("#lrMsg").textContent = "Enter your email address."; return; }
      el.querySelector("#lrSend").disabled = true;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) { el.querySelector("#lrMsg").textContent = error.message; el.querySelector("#lrSend").disabled = false; return; }
      showCode(email);
    };
  }
  function showPassword(email) {
    const el = gate(`<p style="margin:0;color:#c9c9cf">Email and password · อีเมลและรหัสผ่าน</p>
      <input id="lrEmail" type="email" autocomplete="email" placeholder="you@gmail.com" value="${(email || "").replace(/[<>&"]/g, "")}" style="${inp}">
      <input id="lrPass" type="password" autocomplete="current-password" placeholder="Password · รหัสผ่าน (6+)" style="${inp}">
      <button id="lrIn" style="${btn}">Sign in · เข้าสู่ระบบ</button>
      <button id="lrNew" style="${btn};background:#2a2a30;color:#fff">First time? Create my password · สร้างรหัสผ่าน</button>
      <button id="lrBack" style="background:none;border:0;color:#c9c9cf;cursor:pointer">Use an email code instead</button>
      <p id="lrMsg" style="margin:0;color:#ff8592;min-height:1.5em"></p>`);
    const v = () => ({ email: el.querySelector("#lrEmail").value.trim(), password: el.querySelector("#lrPass").value });
    const msg = t => (el.querySelector("#lrMsg").textContent = t);
    el.querySelector("#lrBack").onclick = () => showEmail();
    el.querySelector("#lrIn").onclick = async () => {
      const { error } = await sb.auth.signInWithPassword(v());
      if (error) msg("Wrong email or password. First time? Tap Create my password. · อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    };
    el.querySelector("#lrNew").onclick = async () => {
      const c = v();
      if (!/^\S+@\S+\.\S+$/.test(c.email)) return msg("Enter your email address.");
      if (c.password.length < 6) return msg("Use at least 6 characters. · อย่างน้อย 6 ตัว");
      const { data, error } = await sb.auth.signUp(c);
      if (error) return msg(/registered/i.test(error.message) ? "You already have a password. Tap Sign in. · มีรหัสผ่านแล้ว กด เข้าสู่ระบบ" : error.message);
      if (!data.session) msg("Account made, but the app owner still needs to turn off email confirmation in Supabase.");
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
    window.lrMember = data;
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
  window.lrSb = sb;
  window.lrSignOut = () => sb && sb.auth.signOut().then(() => location.reload());

  document.addEventListener("DOMContentLoaded", () => {
    if (!sb) { gate(`<p style="margin:0;color:#ff8592">Setup needed: add your Supabase URL and key to <b>config.js</b>.</p>`); return; }
    sb.auth.getSession().then(({ data }) => admit(data.session));
    sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_IN" && !member) admit(s); if (ev === "SIGNED_OUT") location.reload(); });
  });
})();
