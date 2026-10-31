/* UpToSkill front-end auth.
   1. Talks to the backend first: POST /auth/register and POST /auth/login (default http://localhost:4000).
      The token is stored under "uts_api_token", the same key the Lessons pages use, so you sign in once.
   2. If the server cannot be reached at all, it falls back to browser-only accounts (localStorage) so the pages
      still work offline. In that mode a yellow bar says so, and Lessons (which need the server) will ask you to sign in.
   Change the server address with:  localStorage.setItem("uts_api", "https://your-server")  */
(function () {
  const USERS = "uts_users", SESS = "uts_session", TOKEN = "uts_api_token";
  const API_BASE = String(window.UPTOSKILL_API_URL || (location.protocol === "file:" ? "http://localhost:4000" : location.origin)).replace(/\/$/, "");   // set in virtual-room-config.js
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const setToken = t => { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch (e) { } };

  async function hash(s) {
    try {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("uts:" + s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
    } catch (e) { return "p:" + btoa(unescape(encodeURIComponent("uts:" + s))); } // file:// fallback
  }

  /* Browser-only accounts (offline mode). The two demo accounts exist here so the pages can be tried without a server. */
  async function users() {
    let u = read(USERS, null);
    if (!u) {
      u = [
        { name: "Riya Verma", email: "student@demo.com", role: "student", pass: await hash("demo1234") },
        { name: "Neha Sharma", email: "tutor@demo.com", role: "tutor", pass: await hash("demo1234") }
      ];
      write(USERS, u);
    }
    return u;
  }

  const clean = e => String(e || "").trim().toLowerCase();
  const fail = (code, msg) => Object.assign(new Error(msg), { code });

  /* One request to the backend. Throws code "NETWORK" only when the server cannot be reached at all. */
  async function call(path, body) {
    let res;
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
      try { res = await fetch(API_BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal }); }
      finally { clearTimeout(timer); }
    } catch (e) { throw fail("NETWORK", "Cannot reach the server at " + API_BASE); }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    throw Object.assign(fail(data.error || "ERROR", data.message || "Something went wrong. Please try again."), { status: res.status, details: data.details });
  }

  function start(u, online) {
    const s = { name: u.name, email: u.email, role: u.role, online: !!online, at: Date.now() };
    write(SESS, s); return s;
  }

  async function register({ name, email, password, role }) {
    name = String(name || "").trim(); email = clean(email);
    if (!name) throw fail("name", "Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail("email", "Please enter a valid email address.");
    if (String(password || "").length < 8) throw fail("password", "Password must be at least 8 characters.");
    try {
      const r = await call("/auth/register", { name, email, password, role });
      setToken(r.token); return start({ name: r.user.name, email: r.user.email, role: r.user.role || role }, true);
    } catch (e) {
      if (e.code === "EMAIL_TAKEN") throw fail("email", "An account with this email already exists. Try logging in.");
      if (e.code === "VALIDATION") throw fail("form", "Please check your details (name, a valid email and a password of 8+ characters).");
      if (e.code !== "NETWORK") throw e;
    }
    // server unreachable -> browser-only account
    const all = await users();
    const ex = all.find(u => u.email === email);
    if (ex) throw fail("email", "An account with this email already exists. Try logging in.");
    all.push({ name, email, role, pass: await hash(password) }); write(USERS, all);
    setToken(null); return start({ name, email, role }, false);
  }

  async function login({ email, password, role }) {
    email = clean(email);
    if (!email || !password) throw fail("password", "Enter your email and password.");
    try {
      const r = await call("/auth/login", { email, password });
      const got = r.user.role || "student";
      if (got !== role) throw fail("role", `This email is registered as a ${got}. Please use the ${got} login.`);
      setToken(r.token); return start({ name: r.user.name, email: r.user.email, role: got }, true);
    } catch (e) {
      if (e.code === "role") throw e;
      if (e.code === "VALIDATION") throw fail("password", "Please enter a valid email and password.");
      if (e.code !== "NETWORK" && e.code !== "BAD_CREDENTIALS") throw e;
      // NETWORK: server is down. BAD_CREDENTIALS: maybe an account made in offline mode. Check this browser.
      const u = (await users()).find(x => x.email === email);
      if (u && u.pass === await hash(password)) {
        if (u.role !== role) throw fail("role", `This email is registered as a ${u.role}. Please use the ${u.role} login.`);
        setToken(null); return start(u, false);
      }
      if (e.code === "NETWORK") throw fail("network", "Cannot reach the server, and this browser has no account with these details. Start the backend (npm run dev in /backend) and try again.");
      throw fail("password", "Wrong email or password.");
    }
  }

  const session = () => read(SESS, null);
  function logout(to) { setToken(null); try { localStorage.removeItem(SESS); } catch (e) { } location.href = to; }

  /* Small yellow bar shown in the apps when the account is browser-only (server was unreachable at sign-in). */
  function banner(s) {
    if (!s || s.online || document.getElementById("uts-offline")) return;
    const mk = () => {
      const b = document.createElement("div"); b.id = "uts-offline";
      b.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;max-width:92vw;background:#FEF3C7;color:#78350F;border:1px solid #F59E0B;border-radius:10px;padding:8px 14px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)";
      b.textContent = "Offline mode: the server was not reachable when you signed in. Your data stays in this browser, and Lessons need the server.";
      const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", "Dismiss");
      x.style.cssText = "margin-left:10px;border:0;background:none;font-size:16px;cursor:pointer;color:inherit"; x.onclick = () => b.remove(); b.appendChild(x);
      document.body.appendChild(b);
    };
    document.body ? mk() : document.addEventListener("DOMContentLoaded", mk);
  }

  /* Call at the top of an app page. Sends visitors without the right role to that role's login page. */
  function require(role, loginUrl) {
    const s = session();
    if (!s || s.role !== role) { location.replace(loginUrl); return null; }
    banner(s);
    return s;
  }

  window.UTSAuth = { register, login, logout, session, require, apiBase: API_BASE };
})();
