/* Drives student/login.html and tutor/login.html. The role comes from <body data-role>, the destination from data-next. */
(function () {
  const role = document.body.dataset.role, next = document.body.dataset.next, other = document.body.dataset.other;
  const $ = s => document.querySelector(s);
  const form = $("#f"), err = $("#err"), go = $("#go");
  let mode = "login";

  // already signed in with this role -> go straight to the app
  const s0 = UTSAuth.session();
  if (s0 && s0.role === role) location.replace(next);

  const showErr = (m, html) => { err.hidden = false; err.classList.add("on"); err[html ? "innerHTML" : "textContent"] = m; };
  const clearErr = () => { err.classList.remove("on"); err.textContent = ""; };

  function setMode(m) {
    mode = m; clearErr();
    document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    document.querySelectorAll("[data-only]").forEach(e => e.hidden = e.dataset.only !== m);
    $("#title").textContent = m === "login" ? $("#title").dataset.login : $("#title").dataset.signup;
    go.textContent = m === "login" ? "Log in" : "Create account";
    $("#password").autocomplete = m === "login" ? "current-password" : "new-password";
    document.querySelectorAll("[data-only=signup] input").forEach(i => i.required = m === "signup");
  }
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => setMode(b.dataset.mode));

  $("#toggle").onclick = e => {
    const p = $("#password"), show = p.type === "password";
    p.type = show ? "text" : "password"; e.target.textContent = show ? "Hide" : "Show";
  };
  const fill = $("#fill");
  if (fill) fill.onclick = () => { setMode("login"); $("#email").value = fill.dataset.email; $("#password").value = "demo1234"; };

  form.addEventListener("submit", async ev => {
    ev.preventDefault(); clearErr(); go.disabled = true;
    const d = { email: $("#email").value, password: $("#password").value, role };
    try {
      if (mode === "signup") await UTSAuth.register({ ...d, name: $("#name").value });
      else await UTSAuth.login(d);
      location.href = next;
    } catch (e) {
      if (e.code === "role") showErr(`${e.message} <a href="${other}">Go to the other login</a>`, true);
      else showErr(e.message);
      go.disabled = false;
    }
  });
  setMode("login");
})();
