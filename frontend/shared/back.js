/* Adds a "Back" button to any page that does not already have one.
   Goes to the previous page in history; if there is none (page opened directly), goes to data-back-fallback on <body>
   (default: the landing page). Pages that already have a back link can opt out with <body data-no-back>. */
(function () {
  if (document.body.hasAttribute("data-no-back") || document.querySelector(".uts-back")) return;
  const here = location.pathname.replace(/\\/g, "/");
  const depth = /\/(student|tutor|auth)\//.test(here) ? "../" : "";
  const fallback = document.body.getAttribute("data-back-fallback") || depth + "index.html";
  const s = document.createElement("style");
  s.textContent = ".uts-back{position:fixed;top:12px;left:12px;z-index:60;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid #BCD0F5;background:#fff;color:#1D4ED8;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px -6px rgba(15,27,61,.35)}.uts-back[hidden]{display:none}.uts-back:hover{background:#EAF2FF}.uts-back:focus-visible{outline:3px solid #FF9A4D;outline-offset:2px}[data-theme=dark] .uts-back,.dark .uts-back{background:#121B38;color:#9DB8FF;border-color:#33447A}.uts-back.r{left:auto;right:16px}@media(max-width:700px){.uts-back{top:8px;left:8px;padding:7px 12px}}";
  document.head.appendChild(s);
  const b = document.createElement("button");
  b.type = "button"; b.className = "uts-back" + (document.getElementById("nav") ? " r" : ""); b.setAttribute("aria-label", "Go back"); b.textContent = "\u2190 Back";
  /* Inside the student/tutor apps the "pages" are drawn by script, so the browser history can't be trusted.
     The app's go() reports each move here (UTSBack.note) and Back replays the previous app page. */
  const inApp = !!document.getElementById("nav"), stack = [];
  window.UTSBack = {
    note(id, arg) { if (id && !window.UTSBack.replaying) { const t = stack[stack.length - 1]; if (!t || t[0] !== id || t[1] !== arg) stack.push([id, arg ?? null]); show(); } },
    replaying: false
  };
  function show() { if (inApp) b.hidden = stack.length < 2; }
  b.onclick = () => {
    if (inApp) {
      if (stack.length < 2) return;
      stack.pop(); const [id, arg] = stack[stack.length - 1];
      window.UTSBack.replaying = true; try { window.go(id, arg); } finally { window.UTSBack.replaying = false; }
      show(); return;
    }
    if (history.length > 1 && document.referrer) history.back(); else location.href = fallback;
  };
  show();
  document.body.appendChild(b);
})();
