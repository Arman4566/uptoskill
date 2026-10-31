/* UpToSkill front-end auth (demo).
   Accounts and the signed-in session live in this browser's localStorage, one role per account: "student" or "tutor".
   For production, replace register()/login() with fetch() calls to the server's POST /auth/register and /auth/login. */
(function () {
  const USERS = "uts_users", SESS = "uts_session";
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  async function hash(s) {
    try {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("uts:" + s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
    } catch (e) { return "p:" + btoa(unescape(encodeURIComponent("uts:" + s))); } // file:// fallback
  }

  async function users() {
    let u = read(USERS, null);
    if (!u) { // demo accounts so the pages can be tried straight away
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

  async function register({ name, email, password, role }) {
    name = String(name || "").trim(); email = clean(email);
    if (!name) throw fail("name", "Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail("email", "Please enter a valid email address.");
    if (String(password || "").length < 8) throw fail("password", "Password must be at least 8 characters.");
    const all = await users();
    const ex = all.find(u => u.email === email);
    if (ex) throw fail("email", ex.role === role ? "This email is already registered. Please log in." : `This email already has a ${ex.role} account. Use the ${ex.role} login.`);
    const user = { name, email, role, pass: await hash(password) };
    all.push(user); write(USERS, all);
    return start(user);
  }

  async function login({ email, password, role }) {
    email = clean(email);
    const u = (await users()).find(x => x.email === email);
    if (!u || u.pass !== await hash(password || "")) throw fail("password", "Wrong email or password.");
    if (u.role !== role) throw fail("role", `This email is registered as a ${u.role}. Please use the ${u.role} login.`);
    return start(u);
  }

  function start(u) {
    const s = { name: u.name, email: u.email, role: u.role, at: Date.now() };
    write(SESS, s); return s;
  }
  const session = () => read(SESS, null);
  function logout(to) { try { localStorage.removeItem(SESS); } catch (e) { } location.href = to; }

  /* Call at the top of an app page. Sends visitors without the right role to that role's login page. */
  function require(role, loginUrl) {
    const s = session();
    if (!s || s.role !== role) { location.replace(loginUrl); return null; }
    return s;
  }

  window.UTSAuth = { register, login, logout, session, require };
})();
