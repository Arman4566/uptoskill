/* Drives student/login.html and tutor/login.html. Role comes from <body data-role>, destination from data-next.
   Text comes from prefs.js (English / Hindi); this file only switches between "log in" and "sign up". */
(function () {
  const role = document.body.dataset.role, next = document.body.dataset.next, other = document.body.dataset.other;
  const $ = s => document.querySelector(s), tr = k => UTSPrefs.t(k), pre = role === "tutor" ? "t_" : "s_";
  const form = $("#f"), err = $("#err"), go = $("#go");
  let mode = "login";

  // already signed in with this role -> go straight to the app
  const s0 = UTSAuth.session();
  let hasTok = false; try { hasTok = !!localStorage.getItem("uts_api_token"); } catch (e) { }
if (s0 && s0.role === role && hasTok) location.replace(next);

  const showErr = (m, html) => { err.hidden = false; err.classList.add("on"); err[html ? "innerHTML" : "textContent"] = m; };
  const clearErr = () => { err.classList.remove("on"); err.textContent = ""; };

  function paint() {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
    document.querySelectorAll("[data-only]").forEach(e => e.hidden = e.dataset.only !== mode);
    $("#title").textContent = tr(pre + "t_" + mode);
    $("#sub").textContent = tr(pre + "sub_" + mode);
    go.textContent = tr(mode === "login" ? "login" : "create");
    const tg = $("#toggle"); tg.textContent = tr($("#password").type === "password" ? "show" : "hide");
  }
  function setMode(m) {
    mode = m; clearErr();
    $("#password").autocomplete = m === "login" ? "current-password" : "new-password";
    document.querySelectorAll("[data-only=signup] input").forEach(i => i.required = m === "signup");
    paint();
  }
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => setMode(b.dataset.mode));
  document.addEventListener("uts-lang", paint);

  $("#toggle").onclick = () => { const p = $("#password"); p.type = p.type === "password" ? "text" : "password"; paint(); };

  form.addEventListener("submit", async ev => {
    ev.preventDefault(); clearErr(); go.disabled = true;
    const d = { email: $("#email").value, password: $("#password").value, role };
    try {
      if (mode === "signup") await UTSAuth.register({ ...d, name: $("#name").value });
      else await UTSAuth.login(d);
      location.href = next;
    } catch (e) {
      if (e.code === "role") showErr(`${e.message} <a href="${other}">${tr(pre + "switch_a")}</a>`, true);
      else showErr(e.message);
      go.disabled = false;
    }
  });
  setMode("login");
})();
