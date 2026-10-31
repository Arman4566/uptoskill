/* UTSApi: tiny client for the backend (used by lessons.html and lesson.html).
   The backend has its own accounts and tokens, so these pages show their own sign-in form the first time.
   Change API_BASE if the backend runs somewhere else. */
(function () {
  const API_BASE = String(window.UPTOSKILL_API_URL || (location.protocol === "file:" ? "http://localhost:4000" : location.origin)).replace(/\/$/, "");   // set in virtual-room-config.js
  const TOKEN = "uts_api_token";
  const get = () => { try { return localStorage.getItem(TOKEN); } catch (e) { return null; } };
  const set = t => { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch (e) { } };

  async function request(path, { method = "GET", body, raw } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (get()) headers.Authorization = "Bearer " + get();
    let res;
    try { res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw Object.assign(new Error("Cannot reach the server. Is the backend running on " + API_BASE + "?"), { code: "NETWORK" }); }
    if (raw && res.ok) return res;
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== "/auth/login") { set(null); throw Object.assign(new Error("Your sign-in expired. Please sign in again."), { code: "AUTH", status: 401 }); }
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Something went wrong"), { code: data.error || "ERROR", status: res.status });
    return data;
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = d => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }
  function logout() { set(null); location.reload(); }

  async function download(path, name) {
    const res = await request(path, { raw: true }), url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name }); a.click(); URL.revokeObjectURL(url);
  }

  const localSession = () => { try { return JSON.parse(localStorage.getItem("uts_session")); } catch (e) { return null; } };
  const homeUrl = () => { const r = (localSession() || {}).role; return r === "tutor" ? "tutor/app.html" : r === "student" ? "student/app.html" : "index.html"; };

  function loginForm(note) {
    const ls = localSession();
    document.getElementById("app").innerHTML = `<section class="card pad" style="max-width:420px"><h1>Sign in</h1>
      <p class="mut">${note || "Lessons use your UpToSkill server account."}${ls ? "" : ""} Demo: <b>student@demo.com</b> or <b>tutor@demo.com</b>, password <b>demo1234</b> (run <code>npm run db:seed</code> in /backend first).</p>
      <form id="lf" style="display:flex;flex-direction:column;gap:12px"><label>Email<input id="le" type="email" required value="${esc(ls ? ls.email : "")}"></label>
      <label>Password<input id="lp" type="password" required></label><p class="err" id="lerr" hidden></p><div><button class="btn">Sign in</button></div></form>
      <p class="mut"><a href="${homeUrl()}">Back to my dashboard</a></p></section>`;
    return new Promise(resolve => {
      document.getElementById("lf").onsubmit = async ev => {
        ev.preventDefault();
        try {
          const r = await request("/auth/login", { method: "POST", body: { email: document.getElementById("le").value, password: document.getElementById("lp").value } });
          set(r.token); resolve(r.user);
        } catch (e) { const el = document.getElementById("lerr"); el.hidden = false; el.textContent = e.code === "BAD_CREDENTIALS" ? "Wrong email or password. If you created this account while the server was off, sign up again now that it is running." : e.message; }
      };
    });
  }

  async function boot(start) {
    let user, note;
    if (get()) { try { user = await request("/me"); } catch (e) { set(null); note = e.code === "NETWORK" ? e.message : "Your sign-in expired."; } }
    if (!user) user = await loginForm(note);
    const h = document.getElementById("home"); if (h) h.href = homeUrl();
    start(user);
  }

  window.UTSApi = { api: request, boot, logout, esc, when, toast, download, homeUrl };
})();
