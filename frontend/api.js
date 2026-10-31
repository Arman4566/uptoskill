/* UTSApi: tiny client for the backend (used by lessons.html and lesson.html).
   The backend has its own accounts and tokens, so these pages show their own sign-in form the first time.
   Change API_BASE if the backend runs somewhere else. */
(function () {
  const API_BASE = localStorage.getItem("uts_api") || "http://localhost:4000";
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
    if (res.status === 401 && path !== "/auth/login") { set(null); location.reload(); }
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

  function loginForm() {
    document.getElementById("app").innerHTML = `<section class="card pad" style="max-width:420px"><h1>Sign in</h1>
      <p class="mut">Sign in with your UpToSkill server account (demo: <b>student@demo.com</b> or <b>tutor@demo.com</b>, password <b>demo1234</b>, after <code>npm run db:seed</code>).</p>
      <form id="lf" style="display:flex;flex-direction:column;gap:12px"><label>Email<input id="le" type="email" required></label>
      <label>Password<input id="lp" type="password" required></label><p class="err" id="lerr" hidden></p><div><button class="btn">Sign in</button></div></form></section>`;
    return new Promise(resolve => {
      document.getElementById("lf").onsubmit = async ev => {
        ev.preventDefault();
        try {
          const r = await request("/auth/login", { method: "POST", body: { email: document.getElementById("le").value, password: document.getElementById("lp").value } });
          set(r.token); resolve(r.user);
        } catch (e) { const el = document.getElementById("lerr"); el.hidden = false; el.textContent = e.code === "BAD_CREDENTIALS" ? "Wrong email or password." : e.message; }
      };
    });
  }

  async function boot(start) {
    let user;
    if (get()) { try { user = await request("/me"); } catch (e) { set(null); } }
    if (!user) user = await loginForm();
    start(user);
  }

  window.UTSApi = { api: request, boot, logout, esc, when, toast, download };
})();
