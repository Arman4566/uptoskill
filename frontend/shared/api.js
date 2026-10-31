/* Talks to the UpToSkill server. Used by wallet.html, lessons.html and lesson.html.
   The older demo pages keep their own localStorage login; these pages use the real server, so they sign in with a
   server account (the seeded ones are riya@demo.test / neha@demo.test, password demo1234). */
(function () {
  const TOKEN = "uts_api_token", ME = "uts_api_me";
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } }
  };
  const base = () => (window.UTS_API_BASE || store.get("uts_api_base") || "http://localhost:4000").replace(/\/$/, "");

  async function api(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetch(base() + path, {
        method,
        headers: { "Content-Type": "application/json", ...(store.get(TOKEN) ? { Authorization: "Bearer " + store.get(TOKEN) } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw Object.assign(new Error("Cannot reach the server. Is it running?"), { code: "NETWORK" }); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== "/auth/login") { store.del(TOKEN); store.del(ME); }
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Request failed"), { code: data.error, status: res.status });
    return data;
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = paise => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const when = iso => iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
  const toast = m => { const t = document.getElementById("toast"); if (!t) return alert(m); t.textContent = m; t.className = "on"; clearTimeout(toast.h); toast.h = setTimeout(() => t.className = "", 3200); };

  /* Shows a sign-in card until there is a valid token, then calls start(me). */
  async function boot(start) {
    const root = document.getElementById("app");
    if (store.get(TOKEN)) {
      try { const me = await api("/me"); store.set(ME, JSON.stringify(me)); return start(me); } catch (e) { if (e.code === "NETWORK") { root.innerHTML = `<div class="card pad"><b>${esc(e.message)}</b><p class="mut">Start the server (<code>npm run dev</code> in the backend folder) and reload.</p></div>`; return; } }
    }
    root.innerHTML = `<form id="lf" class="card pad narrow"><h2>Sign in</h2><p class="mut">Use your UpToSkill server account.</p>
      <label>Email<input id="em" type="email" required autocomplete="username"></label>
      <label>Password<input id="pw" type="password" required autocomplete="current-password"></label>
      <p id="le" class="err" hidden></p><button class="btn">Sign in</button></form>`;
    document.getElementById("lf").onsubmit = async ev => {
      ev.preventDefault();
      try {
        const out = await api("/auth/login", { method: "POST", body: { email: document.getElementById("em").value, password: document.getElementById("pw").value } });
        store.set(TOKEN, out.token); location.reload();
      } catch (e) { const el = document.getElementById("le"); el.hidden = false; el.textContent = e.code === "BAD_CREDENTIALS" ? "Wrong email or password." : e.message; }
    };
  }
  const logout = () => { store.del(TOKEN); store.del(ME); location.reload(); };

  window.UTSApi = { api, boot, logout, esc, inr, when, toast };
})();
