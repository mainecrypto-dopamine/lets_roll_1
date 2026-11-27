/* Let's Roll app extras: ☰ menu with Install, Share and Team (owner only). Loaded only in the hosted app. */
(function () {
  let deferredPrompt = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const th = () => { try { return localStorage.getItem("ds-lang") === "th"; } catch (e) { return false; } };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const APP = location.origin + "/";

  const css = document.createElement("style");
  css.textContent = `
  .lrmenu{height:40px;width:40px;border-radius:50%;border:2px solid var(--line);background:var(--card);color:var(--ink);font-size:18px;cursor:pointer}
  .lrveil{position:fixed;inset:0;z-index:60;background:rgba(10,14,30,.55);display:grid;align-items:end;justify-items:center}
  .lrsheet{width:min(100%,560px);max-height:92vh;overflow:auto;background:var(--card);color:var(--ink);border-radius:28px 28px 0 0;padding:22px 20px calc(24px + env(safe-area-inset-bottom));display:grid;gap:14px}
  .lrsheet h2{margin:0;font:700 26px Mali,Anuphan,sans-serif}
  .lrsheet .big{width:100%;min-height:58px;border:0;border-radius:16px;font:700 18px Anuphan,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
  .lrsheet .pk{background:var(--pink);color:#fff}.lrsheet .gr{background:#06c755;color:#fff}.lrsheet .wa{background:#25d366;color:#fff}.lrsheet .gh{background:var(--sky2);color:var(--sky)}
  .lrsheet ol{margin:0;padding-left:22px;line-height:1.7}
  .lrsheet input,.lrsheet select{width:100%;font-size:16px;padding:11px 14px;border:2px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);box-sizing:border-box}
  .lrrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:2px solid var(--line);border-radius:14px}
  .lrrow small{color:var(--mute);display:block}
  .lrrow button{border:0;background:none;color:var(--red);font-size:20px;cursor:pointer}
  .lrx{justify-self:end;margin-bottom:-44px;position:relative;z-index:2;min-height:40px;padding:0 14px;border-radius:12px;border:2px solid var(--line);background:var(--card);color:var(--ink);font-weight:600;cursor:pointer}`;
  document.head.appendChild(css);

  let veil;
  function open(html) {
    close();
    veil = document.createElement("div"); veil.className = "lrveil";
    veil.innerHTML = `<div class="lrsheet" role="dialog" aria-modal="true"><button class="lrx" data-x>${th() ? "ปิด" : "Close"}</button>${html}</div>`;
    veil.addEventListener("click", e => { if (e.target === veil || e.target.closest("[data-x]")) close(); });
    document.body.appendChild(veil);
    return veil;
  }
  function close() { veil?.remove(); veil = null; }

  function shareText() {
    return th()
      ? `🛞 มาใช้ Let's Roll กันครับ!\nแอปตารางรถของครอบครัวเรา\n\n👉 ${APP}\n\nวิธีติดตั้ง:\n📱 iPhone: เปิดลิงก์ใน Safari → กดปุ่มแชร์ ⬆️ → "เพิ่มลงในหน้าจอโฮม"\n🤖 Android: เปิดใน Chrome → เมนู ⋮ → "ติดตั้งแอป"\n\nเข้าสู่ระบบด้วยอีเมลของคุณ แล้วใส่รหัสที่ได้รับทางอีเมล`
      : `🛞 Join me on Let's Roll!\nOur family ride app.\n\n👉 ${APP}\n\nTo install:\n📱 iPhone: open the link in Safari → tap Share ⬆️ → "Add to Home Screen"\n🤖 Android: open in Chrome → menu ⋮ → "Install app"\n\nSign in with your email and type the code you get.`;
  }

  function menu() {
    const owner = window.lrMember?.role === "owner", t = th();
    const v = open(`<h2>Let's Roll</h2>
      ${installed() ? "" : `<button class="big pk" data-a="install">📲 ${t ? "ติดตั้งแอป" : "Install app"}</button>`}
      <button class="big gh" data-a="share">🔗 ${t ? "ชวนคนอื่นมาใช้" : "Share Let's Roll"}</button>
      ${owner ? `<button class="big gh" data-a="team">👥 ${t ? "ทีม" : "Team"}</button>` : ""}
      <button class="big gh" data-a="out">🚪 ${t ? "ออกจากระบบ" : "Sign out"}</button>
      <p style="margin:0;color:var(--mute);font-size:13px;text-align:center">${esc(window.lrMember?.email || "")}</p>`);
    v.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "install") install(); if (a === "share") share(); if (a === "team") team(); if (a === "out") window.lrSignOut?.();
    });
  }

  async function install() {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; close(); return; }
    const t = th();
    open(`<h2>📲 ${t ? "ติดตั้งแอป" : "Install Let's Roll"}</h2>
      ${isIOS
        ? `<ol><li>${t ? "เปิดหน้านี้ใน <b>Safari</b>" : "Open this page in <b>Safari</b>"}</li><li>${t ? "กดปุ่ม <b>แชร์</b> ⬆️ ด้านล่าง" : "Tap the <b>Share</b> button ⬆️ at the bottom"}</li><li>${t ? "เลือก <b>เพิ่มลงในหน้าจอโฮม</b>" : "Choose <b>Add to Home Screen</b>"}</li><li>${t ? "กด <b>เพิ่ม</b>" : "Tap <b>Add</b>"}</li></ol>`
        : `<ol><li>${t ? "เปิดหน้านี้ใน <b>Chrome</b>" : "Open this page in <b>Chrome</b>"}</li><li>${t ? "กดเมนู <b>⋮</b> มุมขวาบน" : "Tap the <b>⋮</b> menu, top right"}</li><li>${t ? "เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b>" : "Choose <b>Install app</b> or <b>Add to Home screen</b>"}</li></ol>`}
      <p style="margin:0;color:var(--mute)">${t ? "แอปจะอยู่บนหน้าจอพร้อมไอคอนล้อ 🛞" : "It'll sit on your home screen with the wheel icon 🛞"}</p>`);
  }

  function share() {
    const txt = shareText(), t = th();
    const v = open(`<h2>🔗 ${t ? "ชวนคนอื่นมาใช้" : "Share Let's Roll"}</h2>
      <textarea id="lrShareTxt" style="width:100%;min-height:190px;font-size:15px;padding:12px;border:2px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);box-sizing:border-box">${esc(txt)}</textarea>
      ${navigator.share ? `<button class="big pk" data-s="native">📤 ${t ? "แชร์" : "Share…"}</button>` : ""}
      <a class="big gr" id="lrLn" href="https://line.me/R/msg/text/?${encodeURIComponent(txt)}" target="_blank" rel="noopener">LINE</a>
      <a class="big wa" id="lrWa" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="big gh" data-s="copy">${t ? "คัดลอก" : "Copy"}</button>
      <p style="margin:0;color:var(--mute);font-size:13px">${t ? "คนที่ได้รับต้องถูกเพิ่มใน 👥 ทีม ก่อน จึงจะเข้าสู่ระบบได้" : "They also need to be added in 👥 Team before they can sign in."}</p>`);
    const area = v.querySelector("#lrShareTxt");
    area.addEventListener("input", () => { v.querySelector("#lrLn").href = "https://line.me/R/msg/text/?" + encodeURIComponent(area.value); v.querySelector("#lrWa").href = "https://wa.me/?text=" + encodeURIComponent(area.value); });
    v.addEventListener("click", async e => {
      const s = e.target.closest("[data-s]")?.dataset.s;
      if (s === "native") navigator.share({ title: "Let's Roll", text: area.value }).catch(() => {});
      if (s === "copy") { try { await navigator.clipboard.writeText(area.value); e.target.textContent = "✓"; } catch (err) {} }
    });
  }

  async function team() {
    const sb = window.lrSb, t = th();
    const v = open(`<h2>👥 ${t ? "ทีม" : "Team"}</h2><div id="lrTeam" style="display:grid;gap:8px">…</div>
      <b>${t ? "เพิ่มคน" : "Add someone"}</b>
      <input id="lrTEmail" type="email" placeholder="name@gmail.com">
      <input id="lrTName" placeholder="${t ? "ชื่อ (เช่น แม่, บัดดี้)" : "Name (e.g. Mum, Buddy)"}">
      <select id="lrTRole"><option value="family">${t ? "ครอบครัว" : "Family"}</option><option value="buddy">${t ? "บัดดี้ (คนขับ)" : "Buddy (driver)"}</option><option value="guest">${t ? "แขก (จองรถได้)" : "Guest (can book)"}</option><option value="work">${t ? "ที่ทำงาน" : "Work"}</option><option value="owner">${t ? "เจ้าของ (เห็นทุกอย่าง)" : "Owner (sees everything)"}</option></select>
      <button class="big pk" data-t="add">${t ? "เพิ่มเข้าทีม" : "Add to team"}</button><p id="lrTMsg" style="margin:0;color:var(--red);min-height:1.4em"></p>`);
    async function load() {
      const { data, error } = await sb.from("members").select("email,role,name").order("role");
      v.querySelector("#lrTeam").innerHTML = error ? `<p>${esc(error.message)}</p>` : data.map(m => `<div class="lrrow"><div><b>${esc(m.name || m.email)}</b><small>${esc(m.email)} · ${esc(m.role)}</small></div>${m.email === window.lrMember?.email ? "" : `<button data-rm="${esc(m.email)}" aria-label="Remove">×</button>`}</div>`).join("");
    }
    v.addEventListener("click", async e => {
      if (e.target.closest("[data-t=add]")) {
        const email = v.querySelector("#lrTEmail").value.trim().toLowerCase(), name = v.querySelector("#lrTName").value.trim(), role = v.querySelector("#lrTRole").value;
        if (!/^\S+@\S+\.\S+$/.test(email)) { v.querySelector("#lrTMsg").textContent = t ? "ใส่อีเมลให้ถูกต้อง" : "Enter a valid email."; return; }
        const { error } = await sb.from("members").upsert({ email, name, role });
        v.querySelector("#lrTMsg").textContent = error ? error.message : "";
        if (!error) { v.querySelector("#lrTEmail").value = ""; v.querySelector("#lrTName").value = ""; load(); }
      }
      const rm = e.target.closest("[data-rm]");
      if (rm && confirmRemove(rm)) { await sb.from("members").delete().eq("email", rm.dataset.rm); load(); }
    });
    load();
  }
  function confirmRemove(btn) {
    if (btn.dataset.sure) return true;
    btn.dataset.sure = "1"; btn.textContent = th() ? "ลบ?" : "Remove?"; btn.style.fontSize = "14px";
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = "×"; btn.style.fontSize = ""; } }, 3000);
    return false;
  }

  function addButton() {
    const host = document.getElementById("sosBtn")?.parentElement;
    if (!host || document.getElementById("lrMenuBtn")) return;
    const b = document.createElement("button"); b.id = "lrMenuBtn"; b.className = "lrmenu"; b.type = "button"; b.setAttribute("aria-label", "Menu"); b.textContent = "☰";
    b.onclick = menu; host.appendChild(b);
  }
  document.addEventListener("DOMContentLoaded", addButton);
})();
