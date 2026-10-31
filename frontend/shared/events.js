/* UpToSkill weekly events (student app): an AI quiz and an AI coding battle every week, a leaderboard,
   and the switch that turns on push reminders (they arrive even when this website is closed).
   Everything is written by Gemini on the SERVER; this file only talks to /events/... */
(function () {
  "use strict";
  const API = () => (window.UTSAuth && UTSAuth.apiBase) || "";
  const tok = () => { try { return localStorage.getItem("uts_api_token"); } catch (e) { return null; } };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = iso => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  async function call(path, { method = "GET", body } = {}) {
    let res;
    try { res = await fetch(API() + path, { method, headers: Object.assign({ Authorization: "Bearer " + tok() }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw Object.assign(new Error("Cannot reach the server. Is it running?"), { code: "NETWORK" }); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Something went wrong."), { code: data.error, status: res.status });
    return data;
  }

  const css = document.createElement("style");
  css.textContent = `
  .ev-wrap{display:flex;flex-direction:column;gap:16px}
  .ev-card{border:1px solid var(--line,#DDE6F7);border-radius:14px;padding:18px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px}
  .ev-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ev-sp{flex:1}
  .ev-chip{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--soft,#EAF2FF);color:var(--brand,#1D4ED8)}
  .ev-chip.o{background:var(--accent-chip,#FFE3C7);color:var(--accent-text,#7A3A06)}.ev-chip.g{background:var(--ok-bg,#DCFCE7);color:var(--ok-ink,#166534)}
  .ev-mut{color:var(--muted,#55627F);font-size:13px}.ev-err{color:var(--neg,#B42318);font-size:14px}
  .ev-q{border:1px solid var(--line,#DDE6F7);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
  .ev-opt{display:block;width:100%;text-align:left;min-height:42px;padding:9px 12px;border-radius:10px;border:1px solid var(--line2,#BCD0F5);background:var(--card,#fff);color:var(--ink,#0F1B3D);font:inherit;cursor:pointer}
  .ev-opt.on{border-color:var(--brand,#1D4ED8);background:var(--soft,#EAF2FF);font-weight:600}
  .ev-opt.right{border-color:#16a34a;background:var(--ok-bg,#DCFCE7)}.ev-opt.wrong{border-color:#dc2626;background:rgba(220,38,38,.12)}
  .ev-code{width:100%;min-height:160px;border:1px solid var(--line2,#BCD0F5);border-radius:10px;background:var(--card,#fff);color:var(--ink,#0F1B3D);padding:10px 12px;font:13px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
  .ev-in{min-height:40px;border:1px solid var(--line2,#BCD0F5);border-radius:10px;background:var(--card,#fff);color:var(--ink,#0F1B3D);padding:6px 10px;font:inherit}
  .ev-pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,Consolas,monospace;background:var(--soft,#EAF2FF);border-radius:8px;padding:8px 10px;margin:0}
  .ev-board{width:100%;border-collapse:collapse;font-size:14px}.ev-board td,.ev-board th{padding:6px 8px;text-align:left;border-bottom:1px solid var(--line,#DDE6F7)}.ev-board tr.me{font-weight:700;background:var(--soft,#EAF2FF)}
  .ev-score{font-size:34px;font-weight:800;line-height:1}`;
  document.head.appendChild(css);

  /* ---------- push reminders ---------- */
  const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  async function pushState() {
    if (!pushSupported()) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    try { const reg = await navigator.serviceWorker.getRegistration("/sw.js") || await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); return sub ? "on" : "off"; } catch (e) { return "off"; }
  }
  async function enablePush() {
    if (!pushSupported()) throw new Error("This browser cannot show push notifications. On iPhone, add UpToSkill to the Home Screen first.");
    const { key } = await call("/events/push/key");
    if (!key) throw new Error("Push reminders are not switched on at the server yet (VAPID keys are missing). You will still see reminders here in the app.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications were not allowed. Allow them in the browser's site settings, then try again.");
    const reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    await call("/events/push/subscribe", { method: "POST", body: sub.toJSON() });
  }
  async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js"); const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { await call("/events/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => { }); await sub.unsubscribe(); }
  }

  /* ---------- pieces ---------- */
  const boardHTML = b => !b || !b.top.length ? `<p class="ev-mut">Nobody has played yet. Be the first on the board.</p>` :
    `<table class="ev-board"><tbody>${b.top.map(r => `<tr class="${r.me ? "me" : ""}"><td>#${r.rank}</td><td>${esc(r.name)}${r.me ? " (you)" : ""}</td><td>${r.score}/${r.maxScore}</td></tr>`).join("")}</tbody></table>
    <p class="ev-mut">${b.players} player${b.players === 1 ? "" : "s"}${b.myRank ? ` · your rank: #${b.myRank}` : ""}</p>`;

  function resultHTML(ev) {
    const m = ev.mine; if (!m) return "";
    let h = `<div class="ev-row"><span class="ev-score">${m.score}</span><span class="ev-mut">/ ${m.maxScore} points</span></div>`;
    if (ev.kind === "code" && m.feedback) h += m.feedback.map(f => `<div class="ev-q"><div class="ev-row"><b>${esc(f.problem)}</b><span class="ev-sp"></span><span class="ev-chip ${f.points >= f.outOf * .7 ? "g" : "o"}">${f.points}/${f.outOf} · ${esc(f.verdict)}</span></div><span class="ev-mut">${esc(f.feedback)}</span></div>`).join("");
    if (ev.kind === "quiz") h += m.review ? m.review.map((r, i) => `<div class="ev-q"><b>${i + 1}. ${esc(r.q)}</b>${r.options.map((o, j) => `<div class="ev-opt ${j === r.correct ? "right" : j === r.yours ? "wrong" : ""}">${esc(o)}</div>`).join("")}<span class="ev-mut">${esc(r.explanation)}</span></div>`).join("")
      : `<p class="ev-mut">Answers and explanations are shown when the week ends, so nobody can copy them.</p>`;
    return h;
  }

  function playHTML(ev) {
    if (ev.kind === "quiz") return ev.questions.map((q, i) => `<div class="ev-q"><b>${i + 1}. ${esc(q.q)}</b>${q.options.map((o, j) => `<button type="button" class="ev-opt" data-ev="pick" data-i="${i}" data-j="${j}">${esc(o)}</button>`).join("")}</div>`).join("") +
      `<div class="ev-row"><button class="btn" data-ev="submit">Submit answers</button><span class="ev-mut" id="ev-count">0 / ${ev.questions.length} answered</span></div>`;
    return ev.problems.map((p, i) => `<div class="ev-q"><div class="ev-row"><b>${i + 1}. ${esc(p.title)}</b><span class="ev-sp"></span><span class="ev-chip o">${p.difficulty} · ${p.points} pts</span></div>
      <div style="white-space:pre-wrap">${esc(p.statement)}</div>${p.example ? `<pre class="ev-pre">${esc(p.example)}</pre>` : ""}${p.hint ? `<span class="ev-mut">Hint: ${esc(p.hint)}</span>` : ""}
      <div class="ev-row"><label class="ev-mut">Language <input class="ev-in" data-lang="${i}" value="JavaScript" maxlength="30" style="width:140px"></label></div>
      <textarea class="ev-code" data-code="${i}" maxlength="6000" spellcheck="false" placeholder="Write your solution here (leave empty to skip)"></textarea></div>`).join("") +
      `<div class="ev-row"><button class="btn" data-ev="submit">Submit for AI judging</button><span class="ev-mut">One try. The AI reads your code and scores it, so write it carefully.</span></div>`;
  }

  function cardHTML(ev) {
    const open = !ev.finished && !ev.mine;
    return `<section class="ev-card" data-event="${ev.id}"><div class="ev-row"><h2 style="margin:0;font-size:19px">${ev.kind === "quiz" ? "Weekly Quiz" : "Coding Battle"}: ${esc(ev.title)}</h2><span class="ev-sp"></span><span class="ev-chip">${esc(ev.topic)}</span></div>
      <p class="ev-mut" style="margin:0">${esc(ev.blurb)} · closes ${when(ev.endsAt)}</p>
      ${ev.mine ? resultHTML(ev) : ev.finished ? `<p class="ev-mut">This event has ended.</p>` : `<div class="ev-play"><button class="btn orange" data-ev="start">${ev.kind === "quiz" ? "Start quiz" : "Start battle"}</button></div>`}
      <div><b>Leaderboard</b>${boardHTML(ev.board)}</div></section>`;
  }

  /* ---------- the page ---------- */
  async function page(el, hooks) {
    el.innerHTML = `<div class="ev-card"><span class="ev-mut">Loading this week's events...</span></div>`;
    let data;
    try { data = await call("/events"); } catch (e) { el.innerHTML = `<div class="ev-card"><p class="ev-err">${esc(e.message)}</p></div>`; return; }
    const pst = await pushState();
    const pushBox = pst === "unsupported" ? "" : `<div class="ev-card"><div class="ev-row"><div><b>Daily reminders, even when this site is closed</b><div class="ev-mut">${pst === "blocked" ? "Notifications are blocked for this site in your browser settings." : pst === "on" ? "On. Expect a funny nudge every evening, plus a ping when a new event starts." : "Get a witty AI nudge based on your streak, plus a ping when a new event starts."}</div></div><span class="ev-sp"></span>${pst === "blocked" ? "" : `<button class="btn ${pst === "on" ? "ghost" : ""}" data-ev="push">${pst === "on" ? "Turn off" : "Turn on"}</button>`}</div><p class="ev-err" id="ev-push-err" hidden></p></div>`;
    const cur = data.current.length ? data.current.map(cardHTML).join("") : `<div class="ev-card"><b>No events yet this week</b><p class="ev-mut">${data.aiReady ? "The AI is preparing them. Check back in a few minutes." : "The server has no GEMINI_API_KEY yet, so events cannot be created."}</p></div>`;
    const past = data.past.length ? `<div class="ev-card"><b>Earlier weeks</b><table class="ev-board"><tbody>${data.past.map(p => `<tr><td>${p.kind === "quiz" ? "Quiz" : "Battle"}</td><td>${esc(p.title)}</td><td>${p.score === null ? "not played" : p.score + "/" + p.max_score}</td></tr>`).join("")}</tbody></table></div>` : "";
    el.innerHTML = `<div class="ev-wrap">${pushBox}${cur}${past}</div>`;
    const byId = id => data.current.find(x => x.id === id);

    el.onclick = async e => {
      const b = e.target.closest("[data-ev]"); if (!b) return;
      const act = b.dataset.ev, card = b.closest("[data-event]"), ev = card && byId(+card.dataset.event);
      if (act === "push") {
        const err = el.querySelector("#ev-push-err"); err.hidden = true; b.disabled = true;
        try { if (pst === "on") await disablePush(); else await enablePush(); page(el, hooks); }
        catch (x) { err.hidden = false; err.textContent = x.message; b.disabled = false; }
        return;
      }
      if (!ev) return;
      if (act === "start") { card.querySelector(".ev-play").innerHTML = playHTML(ev) + `<p class="ev-err" id="ev-e" hidden></p>`; card.__ans = ev.kind === "quiz" ? ev.questions.map(() => -1) : null; return; }
      if (act === "pick") {
        const i = +b.dataset.i, j = +b.dataset.j; card.__ans[i] = j;
        card.querySelectorAll(`[data-ev="pick"][data-i="${i}"]`).forEach(o => o.classList.toggle("on", +o.dataset.j === j));
        card.querySelector("#ev-count").textContent = `${card.__ans.filter(x => x >= 0).length} / ${card.__ans.length} answered`; return;
      }
      if (act === "submit") {
        const er = card.querySelector("#ev-e");
        const body = ev.kind === "quiz" ? { answers: card.__ans } : { solutions: [0, 1, 2].map(i => ({ lang: card.querySelector(`[data-lang="${i}"]`).value || "code", code: card.querySelector(`[data-code="${i}"]`).value })) };
        if (ev.kind === "quiz" && card.__ans.some(x => x < 0) && !confirm("Some questions are unanswered. Submit anyway? You only get one try.")) return;
        if (ev.kind === "code" && !confirm("Submit your solutions? You only get one try.")) return;
        b.disabled = true; b.textContent = ev.kind === "quiz" ? "Checking..." : "The AI is judging your code..."; er.hidden = true;
        try { const out = await call(`/events/${ev.id}/submit`, { method: "POST", body }); Object.assign(ev, out); card.outerHTML = cardHTML(ev); if (hooks && hooks.done) hooks.done(out); }
        catch (x) { er.hidden = false; er.textContent = x.message; b.disabled = false; b.textContent = "Submit again"; }
      }
    };
  }

  window.UTSEvents = { page, pushState, enablePush };
})();
