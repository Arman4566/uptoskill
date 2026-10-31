/* UpToSkill front-end auth.
   Sign up and log in always go to the backend (POST /auth/register, POST /auth/login), so every account lives in the database.
   The token is stored under "uts_api_token" (the same key the Lessons pages use), so you sign in once.
   There are no built-in demo accounts and no browser-only accounts: if the server cannot be reached you get an error message.
   The server address comes from virtual-room-config.js (or localStorage "uts_api"). */
(function () {
  const SESS = "uts_session", TOKEN = "uts_api_token";
  const API_BASE = String(window.UPTOSKILL_API_URL || (location.protocol === "file:" ? "http://localhost:4000" : location.origin)).replace(/\/$/, "");   // set in virtual-room-config.js
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const setToken = t => { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch (e) { } };

  const clean = e => String(e || "").trim().toLowerCase();
  const fail = (code, msg) => Object.assign(new Error(msg), { code });

  /* One request to the backend. Throws code "NETWORK" only when the server cannot be reached at all. */
  async function call(path, body) {
    let res;
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60000);
      try { res = await fetch(API_BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal }); }
      finally { clearTimeout(timer); }
    } catch (e) { throw fail("NETWORK", "Cannot reach the server at " + API_BASE); }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // A real UpToSkill backend always answers sign-up / log-in with { user, token }. Anything else on this
      // address (an old server, another program on port 4000) must not be mistaken for a successful sign-in.
      if (path.startsWith("/auth/") && !(data && data.user && data.token)) {
        throw fail("BAD_SERVER", "The program answering at " + API_BASE + " is not the UpToSkill backend (it replied without an account). Stop whatever is using that port, then start the backend with npm start in the backend folder.");
      }
      return data;
    }
    throw Object.assign(fail(data.error || "ERROR", data.message || "Something went wrong. Please try again."), { status: res.status, details: data.details });
  }

  function start(u) {
    const s = { name: u.name, email: u.email, role: u.role, at: Date.now() };
    write(SESS, s); return s;
  }

  async function register({ name, email, password, role }) {
    name = String(name || "").trim(); email = clean(email);
    if (!name) throw fail("name", "Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail("email", "Please enter a valid email address.");
    if (String(password || "").length < 8) throw fail("password", "Password must be at least 8 characters.");
    try {
      const r = await call("/auth/register", { name, email, password, role });
      setToken(r.token); return start({ name: r.user.name, email: r.user.email, role: r.user.role || role });
    } catch (e) {
      if (e.code === "EMAIL_TAKEN") throw fail("email", "An account with this email already exists. Try logging in.");
      if (e.code === "VALIDATION") throw fail("form", "Please check your details (name, a valid email and a password of 8+ characters).");
      if (e.code === "NETWORK") throw fail("network", "Cannot reach the server, so your account could not be created. Start the backend (npm run dev in /backend) and try again.");
      throw e;
    }
  }

  async function login({ email, password, role }) {
    email = clean(email);
    if (!email || !password) throw fail("password", "Enter your email and password.");
    try {
      const r = await call("/auth/login", { email, password });
      const got = r.user.role || "student";
      if (got !== role) throw fail("role", `This email is registered as a ${got}. Please use the ${got} login.`);
      setToken(r.token); return start({ name: r.user.name, email: r.user.email, role: got });
    } catch (e) {
      if (e.code === "role") throw e;
      if (e.code === "VALIDATION") throw fail("password", "Please enter a valid email and password.");
      if (e.code === "BAD_CREDENTIALS") throw fail("password", "Wrong email or password.");
      if (e.code === "NETWORK") throw fail("network", "Cannot reach the server. Start the backend (npm run dev in /backend) and try again.");
      throw e;
    }
  }

  const session = () => read(SESS, null);
  function logout(to) { setToken(null); try { localStorage.removeItem(SESS); } catch (e) { } location.href = to; }

  /* Call at the top of an app page. Sends visitors without the right role (or without a server sign-in) to that role's login page. */
  function require(role, loginUrl) {
    const s = session(), tok = (() => { try { return localStorage.getItem(TOKEN); } catch (e) { return null; } })();
    if (!s || s.role !== role || !tok) { try { localStorage.removeItem(SESS); } catch (e) { } location.replace(loginUrl); return null; }
    return s;
  }

  window.UTSAuth = { register, login, logout, session, require, apiBase: API_BASE };
})();
