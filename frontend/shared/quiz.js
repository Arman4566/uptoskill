/* UpToSkill quiz + AI report module. Loaded by BOTH the student app and the tutor app.
   Student: after a lesson, take a short quiz written by Gemini (on the server). Score -> credits. Low score -> the AI explains
            the weak topics, and the tutor gets a report and can send a short video.
   Tutor:   "Student Reports" page: the AI report about each student, plus record/upload a short explainer video.
   The Gemini key lives on the server only. This file just talks to /quiz/... on the backend. */
(function () {
  "use strict";
  const API = () => (window.UTSAuth && UTSAuth.apiBase) || "";
  const tok = () => { try { return localStorage.getItem("uts_api_token"); } catch (e) { return null; } };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = iso => iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";

  async function call(path, { method = "GET", body, raw, headers } = {}) {
    let res;
    try {
      res = await fetch(API() + path, { method, headers: Object.assign({ Authorization: "Bearer " + tok() }, body && !raw ? { "Content-Type": "application/json" } : {}, headers || {}), body: raw ? body : body ? JSON.stringify(body) : undefined });
    } catch (e) { throw Object.assign(new Error("Cannot reach the server. Is it running?"), { code: "NETWORK" }); }
    if (raw === "blob" || (res.ok && res.headers.get("content-type") && /^video\//.test(res.headers.get("content-type")))) { if (!res.ok) throw new Error("Could not load the video."); return res.blob(); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Something went wrong."), { code: data.error, status: res.status });
    return data;
  }

  /* ---------- styles (use the app's own colour variables, so light and dark both work) ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .qz-ov{position:fixed;inset:0;z-index:90;background:rgba(15,27,61,.55);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}
  .qz-box{background:var(--card,#fff);color:var(--ink,#0F1B3D);border-radius:16px;padding:22px;width:100%;max-width:720px;margin:auto;display:flex;flex-direction:column;gap:14px;box-shadow:0 30px 60px -20px rgba(0,0,0,.5)}
  .qz-box h3{margin:0;font-size:20px}.qz-box p{margin:0}.qz-mut{color:var(--muted,#55627F);font-size:13px}
  .qz-q{border:1px solid var(--line,#DDE6F7);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}
  .qz-q b{font-size:15px}
  .qz-opt{display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid var(--line2,#BCD0F5);background:var(--card,#fff);color:var(--ink,#0F1B3D);font:inherit;font-size:14px;cursor:pointer}
  .qz-opt:hover{background:var(--hover,#F1F6FF)}.qz-opt.on{border-color:var(--brand,#1D4ED8);background:var(--soft,#EAF2FF);font-weight:600}
  .qz-opt.right{border-color:#16a34a;background:var(--ok-bg,#DCFCE7);color:var(--ok-ink,#166534)}.qz-opt.wrong{border-color:#dc2626;background:rgba(220,38,38,.12)}
  .qz-opt[disabled]{cursor:default}.qz-k{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
  .qz-score{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.qz-big{font-size:40px;font-weight:800;line-height:1}
  .qz-card{border:1px solid var(--line,#DDE6F7);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--card,#fff)}
  .qz-ai{border-color:var(--brand,#1D4ED8);background:var(--soft,#EAF2FF)}
  .qz-chips{display:flex;gap:6px;flex-wrap:wrap}.qz-chip{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--soft,#EAF2FF);color:var(--brand,#1D4ED8)}
  .qz-chip.o{background:var(--accent-chip,#FFE3C7);color:var(--accent-text,#7A3A06)}.qz-chip.g{background:var(--ok-bg,#DCFCE7);color:var(--ok-ink,#166534)}.qz-chip.r{background:rgba(220,38,38,.14);color:var(--neg,#B42318)}
  .qz-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.qz-sp{flex:1}
  .qz-bar{height:8px;border-radius:99px;background:var(--line,#DDE6F7);overflow:hidden}.qz-bar i{display:block;height:100%;background:var(--accent,#FF9A4D);transition:width .25s}
  .qz-spin{width:34px;height:34px;border-radius:50%;border:4px solid var(--line,#DDE6F7);border-top-color:var(--brand,#1D4ED8);animation:qzs 1s linear infinite;margin:18px auto}@keyframes qzs{to{transform:rotate(360deg)}}
  .qz-err{color:var(--neg,#B42318);font-size:14px}.qz-box video{width:100%;max-height:60vh;border-radius:10px;background:#000}
  .qz-in{width:100%;min-height:44px;border:1px solid var(--line2,#BCD0F5);border-radius:10px;background:var(--card,#fff);color:var(--ink,#0F1B3D);padding:10px 12px;font:inherit}
  .qz-dot{width:9px;height:9px;border-radius:50%;background:var(--accent,#FF9A4D);display:inline-block}
  .qz-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px;font-size:14px}
  @media (prefers-reduced-motion:reduce){.qz-spin{animation:none}}`;
  document.head.appendChild(css);

  /* ---------- overlay ---------- */
  let ov = null, onClose = null;
  function show(html, close) {
    if (!ov) { ov = document.createElement("div"); ov.className = "qz-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); document.body.appendChild(ov); }
    delete ov.dataset.lock; ov.innerHTML = `<div class="qz-box">${html}</div>`; onClose = close || null; return ov;
  }
  function hide() { if (ov) { ov.remove(); ov = null; } if (onClose) { const f = onClose; onClose = null; f(); } }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && ov && !ov.dataset.lock) hide(); });
  document.addEventListener("click", e => { if (ov && e.target === ov && !ov.dataset.lock) hide(); });
  const loading = msg => show(`<div class="qz-spin" role="status"></div><p style="text-align:center">${esc(msg)}</p>`);
  const fail = (e, retry) => show(`<h3>Something went wrong</h3><p class="qz-err">${esc(e.message)}</p><div class="qz-row">${retry ? `<button class="btn" data-qz="retry">Try again</button>` : ""}<button class="btn ghost" data-qz="close">Close</button></div>`);
  document.addEventListener("click", e => { const b = e.target.closest("[data-qz]"); if (!b) return; const f = handlers[b.dataset.qz]; if (f) f(b); });
  const handlers = { close: () => hide() };

  /* ====================================================================== STUDENT ====================================================================== */
  let hooks = { credits: () => { } };         // set by the student app: credits(quizId, amount, label)

  async function startQuiz(session, covered) {
    loading("Writing your quiz with AI...");
    handlers.retry = () => startQuiz(session, covered);
    try {
      const r = await call("/quiz/start", { method: "POST", body: { sessionRef: String(session.ref || session.id), topic: session.skill || session.title, title: (covered || session.title || "").slice(0, 200), tutorEmail: session.mentorEmail || undefined } });
      if (r.done) return showResult(r.result);
      drawQuiz(r);
    } catch (e) { fail(e, e.code !== "AI_NOT_CONFIGURED" && e.code !== "QUIZ_LIMIT"); }
  }

  function drawQuiz(q) {
    const ans = new Array(q.questions.length).fill(-1);
    const root = show(`<div class="qz-row"><h3>Quiz: ${esc(q.topic)}</h3><span class="qz-sp"></span><button class="btn ghost" data-qz="close" aria-label="Close quiz">Close</button></div>
      <p class="qz-mut">Pick one answer for each question. Do well and you earn credits. If you struggle, the AI will explain what to revise and your tutor can help.</p>
      <div class="qz-bar"><i id="qz-p" style="width:0"></i></div>
      ${q.questions.map((x, i) => `<div class="qz-q"><b>${i + 1}. ${esc(x.q)}</b>${x.options.map((o, j) => `<button class="qz-opt" data-qz="pick" data-i="${i}" data-j="${j}" aria-pressed="false"><span class="qz-k">${"ABCD"[j]}</span><span>${esc(o)}</span></button>`).join("")}</div>`).join("")}
      <div class="qz-row"><span class="qz-mut" id="qz-n">0 of ${q.questions.length} answered</span><span class="qz-sp"></span><button class="btn orange" data-qz="submit" disabled>Submit answers</button></div><p class="qz-err" id="qz-e" hidden></p>`);
    const upd = () => { const n = ans.filter(x => x >= 0).length; root.querySelector("#qz-n").textContent = `${n} of ${ans.length} answered`; root.querySelector("#qz-p").style.width = (n / ans.length * 100) + "%"; root.querySelector('[data-qz="submit"]').disabled = n < ans.length; };
    handlers.pick = b => { const i = +b.dataset.i, j = +b.dataset.j; ans[i] = j; root.querySelectorAll(`[data-qz="pick"][data-i="${i}"]`).forEach(o => { const on = +o.dataset.j === j; o.classList.toggle("on", on); o.setAttribute("aria-pressed", on); }); upd(); };
    handlers.submit = async b => {
      b.disabled = true; b.textContent = "Checking...";
      try { showResult(await call(`/quiz/${q.id}/submit`, { method: "POST", body: { answers: ans } })); }
      catch (e) { const er = root.querySelector("#qz-e"); er.hidden = false; er.textContent = e.message; b.disabled = false; b.textContent = "Submit answers"; }
    };
  }

  function analysisHTML(a) {
    return `<div class="qz-card qz-ai"><b>AI coach: what to revise</b><p>${esc(a.summary)}</p>
      ${(a.weakTopics || []).map(w => `<div class="qz-card"><div class="qz-row"><b>${esc(w.topic)}</b><span class="qz-chip r">weak topic</span></div><p class="qz-mut">${esc(w.whatWentWrong)}</p><p>${esc(w.explanation)}</p><p><b>Practice:</b> ${esc(w.practiceTip)}</p></div>`).join("")}
      ${a.encouragement ? `<p class="qz-mut">${esc(a.encouragement)}</p>` : ""}</div>`;
  }

  function showResult(r) {
    if (r.creditsEarned > 0) hooks.credits(r.id, r.creditsEarned, `Quiz reward: ${r.topic}`);
    const good = r.passed;
    show(`<div class="qz-row"><h3>Quiz result: ${esc(r.topic)}</h3><span class="qz-sp"></span><button class="btn ghost" data-qz="close">Close</button></div>
      <div class="qz-score"><span class="qz-big">${r.score}/${r.total}</span><div><div class="qz-chips"><span class="qz-chip ${good ? "g" : "o"}">${r.pct}%</span>${r.creditsEarned > 0 ? `<span class="qz-chip g">+${r.creditsEarned} credit${r.creditsEarned > 1 ? "s" : ""} earned</span>` : `<span class="qz-chip o">No credits this time</span>`}</div>
        <p class="qz-mut" style="margin-top:6px">${good ? "Nice work! Review the answers below." : "That is okay. Learning where you are stuck is the first step."}</p></div></div>
      ${r.analysis ? analysisHTML(r.analysis) : r.analysisPending ? `<div class="qz-card qz-ai"><b>AI coach</b><p class="qz-mut">${esc(r.analysisError || "The explanation is not ready yet.")}</p><div><button class="btn" data-qz="analyze">Get the AI explanation</button></div></div>` : ""}
      ${r.reportSent ? `<div class="qz-card"><b>Your tutor has been told</b><p class="qz-mut">The AI sent your tutor a short report about your weak topics. They can teach you in the next lesson or send you a short video. Look in <b>Quizzes</b> for it.</p></div>` : ""}
      <h4 style="margin:4px 0 0">Your answers</h4>
      ${r.review.map((x, i) => `<div class="qz-q"><b>${i + 1}. ${esc(x.q)}</b><span class="qz-chips"><span class="qz-chip">${esc(x.topic)}</span></span>
        ${x.options.map((o, j) => `<button class="qz-opt ${j === x.correct ? "right" : j === x.yourAnswer ? "wrong" : ""}" disabled><span class="qz-k">${"ABCD"[j]}</span><span>${esc(o)}${j === x.correct ? " (correct)" : j === x.yourAnswer ? " (your answer)" : ""}</span></button>`).join("")}
        <p class="qz-mut">${esc(x.explanation)}</p></div>`).join("")}
      <div class="qz-row"><button class="btn" data-qz="close">Done</button></div>`);
    handlers.analyze = async b => {
      b.disabled = true; b.textContent = "Asking the AI...";
      try { showResult(await call(`/quiz/${r.id}/analyze`, { method: "POST" })); } catch (e) { b.disabled = false; b.textContent = "Try again"; b.parentElement.insertAdjacentHTML("beforebegin", `<p class="qz-err">${esc(e.message)}</p>`); }
    };
  }

  /* Asks first. Nothing is generated (and no AI call is made) until the student presses "Start quiz". */
  function offer(session, opt) {
    const manual = opt && opt.manual;
    show(`<h3>${manual ? "Take a quiz" : "You left the lesson. Want a quick quiz?"}</h3>
      <p>A short AI quiz on what you covered. Do well and earn up to 2 credits. If something was hard, the AI explains it and your tutor can help. <b>It is optional.</b></p>
      <label>What did you cover in this lesson?<input class="qz-in" id="qz-cov" maxlength="120" value="${esc(session.title || session.skill || "")}"></label>
      <p class="qz-mut">The quiz is made from these topics. Change them if the lesson went somewhere else.</p>
      <div class="qz-row"><button class="btn orange" data-qz="take">Start quiz</button><button class="btn ghost" data-qz="close">${manual ? "Cancel" : "No thanks"}</button></div>`);
    handlers.take = () => { const v = (ov.querySelector("#qz-cov").value || "").trim(); onClose = null; startQuiz(session, v || session.title); };
  }

  /* Student "Quizzes" page: history + videos from tutors. */
  const SEEN = () => "uts_quiz_seen_videos:" + ((window.UTS && UTS.email) || "");
  const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN()) || "[]")); } catch (e) { return new Set(); } };
  async function unseenVideos() { try { const r = await call("/quiz/mine"); const s = seenSet(); return r.videos.filter(v => !s.has(v.id)).length; } catch (e) { return 0; } }

  async function studentPage(el) {
    el.innerHTML = `<div class="qz-spin" role="status"></div>`;
    let r; try { r = await call("/quiz/mine"); } catch (e) { el.innerHTML = `<div class="empty"><b>Could not load your quizzes</b>${esc(e.message)}</div>`; return; }
    const seen = seenSet(); r.videos.forEach(v => seen.add(v.id)); try { localStorage.setItem(SEEN(), JSON.stringify([...seen])); } catch (e) { }
    el.innerHTML = `
      <section class="sec"><div class="sec-head"><h2>Videos from your tutors</h2></div>
        ${r.videos.length ? r.videos.map(v => `<div class="card pad"><div class="qz-row"><div><b>${esc(v.topic)}</b><div class="qz-mut">From ${esc(v.tutor_name)} · ${when(v.created_at)}</div>${v.note ? `<p style="margin-top:6px">${esc(v.note)}</p>` : ""}</div><span class="qz-sp"></span><button class="btn" data-qz="watch" data-id="${v.id}">Watch</button></div></div>`).join("")
          : `<div class="empty"><b>No videos yet</b>If a quiz shows a weak topic, your tutor may send you a short video here.</div>`}</section>
      <section class="sec" style="margin-top:20px"><div class="sec-head"><h2>My quizzes</h2></div>
        ${r.quizzes.length ? r.quizzes.map(q => `<div class="card pad"><div class="qz-row"><div><b>${esc(q.topic)}</b><div class="qz-mut">${esc(q.session_title)} · ${when(q.created_at)}</div></div><span class="qz-sp"></span>
          ${q.status === "graded" ? `<span class="qz-chip ${q.score / q.total >= .6 ? "g" : "o"}">${q.score}/${q.total}</span><span class="qz-chip ${q.credits_awarded ? "g" : ""}">${q.credits_awarded ? "+" + q.credits_awarded + " credits" : "0 credits"}</span>` : `<span class="qz-chip o">Not finished</span>`}</div>
          ${q.weakTopics.length ? `<div class="qz-chips"><span class="qz-mut">Weak topics:</span>${q.weakTopics.map(t => `<span class="qz-chip r">${esc(t)}</span>`).join("")}</div>` : ""}
          <div class="qz-row"><button class="btn ghost" data-qz="openq" data-id="${q.id}">${q.status === "graded" ? "View result" : "Resume quiz"}</button></div></div>`).join("")
          : `<div class="empty"><b>No quizzes yet</b>Finish a lesson, then take the quiz from My Sessions &gt; Past.</div>`}</section>`;
    handlers.watch = b => watchVideo(b.dataset.id);
    handlers.openq = async b => { loading("Opening..."); try { const x = await call(`/quiz/${b.dataset.id}`); x.status === "graded" || x.review ? showResult(x) : drawQuiz(x); } catch (e) { fail(e); } };
  }

  async function watchVideo(id) {
    loading("Loading video...");
    try {
      const url = URL.createObjectURL(await call(`/quiz/video/${id}`, { raw: "blob" }));
      show(`<div class="qz-row"><h3>Video from your tutor</h3><span class="qz-sp"></span><button class="btn ghost" data-qz="close">Close</button></div><video controls autoplay playsinline src="${url}"></video>`, () => URL.revokeObjectURL(url));
    } catch (e) { fail(e); }
  }

  /* ====================================================================== TUTOR ====================================================================== */
  async function unreadReports() { try { return (await call("/quiz/tutor/summary")).unread; } catch (e) { return 0; } }
  function pollTutor(cb, ms = 45000) { let last = -1; const run = async () => { const n = await unreadReports(); if (n !== last) { last = n; cb(n); } }; run(); return setInterval(run, ms); }

  const sev = n => n >= 3 ? ["r", "needs the most help"] : n === 2 ? ["o", "needs practice"] : ["g", "minor gap"];
  function reportHTML(x) {
    const r = x.report || {};
    return `<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
      <div class="qz-row"><div><b style="font-size:16px">${x.read ? "" : `<span class="qz-dot" title="New"></span> `}${esc(x.studentName)}</b><div class="qz-mut">${esc(r.quizTopic || "")} · scored ${r.score}/${r.total} · ${when(x.createdAt)}</div></div><span class="qz-sp"></span>
        <button class="btn" data-qz="video" data-id="${x.id}">Send a short video</button></div>
      <p><b>${esc(r.headline || "")}</b></p>
      <div><b>Weak topics</b><div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">${(r.weakTopics || []).map(w => { const s = sev(w.severity); const times = (x.studentWeakTopics || []).find(t => t.topic.toLowerCase() === String(w.topic).toLowerCase()); return `<div class="qz-card"><div class="qz-row"><b>${esc(w.topic)}</b><span class="qz-chip ${s[0]}">${s[1]}</span>${times && times.count > 1 ? `<span class="qz-chip o">missed ${times.count} times</span>` : ""}</div><p class="qz-mut">${esc(w.evidence)}</p><p><b>Teach:</b> ${esc(w.whatToTeach)}</p></div>`; }).join("")}</div></div>
      ${(r.strengths || []).length ? `<div class="qz-chips"><span class="qz-mut">Strengths:</span>${r.strengths.map(s => `<span class="qz-chip g">${esc(s)}</span>`).join("")}</div>` : ""}
      ${(r.teachingPlan || []).length ? `<div><b>Suggested plan for the next lesson</b><ol class="qz-list">${r.teachingPlan.map(s => `<li>${esc(s)}</li>`).join("")}</ol></div>` : ""}
      ${(r.videoOutlines || []).length ? `<details><summary><b>AI outline for a short video</b></summary>${r.videoOutlines.map(v => `<div class="qz-card" style="margin-top:8px"><b>${esc(v.title)}</b> <span class="qz-mut">· about ${v.seconds}s · ${esc(v.topic)}</span><ul class="qz-list">${(v.points || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}</details>` : ""}
      ${x.videos.length ? `<div class="qz-chips"><span class="qz-mut">Videos sent:</span>${x.videos.map(v => `<button class="qz-chip" style="border:0;cursor:pointer" data-qz="watch" data-id="${v.id}">${esc(v.topic)} · ${when(v.created_at)}</button>`).join("")}</div>` : ""}
    </div>`;
  }

  let reports = [];
  async function tutorPage(el, onChange) {
    el.innerHTML = `<div class="qz-spin" role="status"></div>`;
    try { reports = (await call("/quiz/tutor/reports")).reports; } catch (e) { el.innerHTML = `<div class="empty"><b>Could not load reports</b>${esc(e.message)}</div>`; return; }
    el.innerHTML = reports.length ? reports.map(reportHTML).join("") : `<div class="empty"><b>No reports yet</b>When one of your students scores low on a quiz after your lesson, the AI writes a report here with their weak topics and a plan for you.</div>`;
    handlers.watch = b => watchVideo(b.dataset.id);
    handlers.video = b => videoDialog(+b.dataset.id, () => tutorPage(el, onChange));
    const unread = reports.filter(r => !r.read);
    if (unread.length) { await Promise.all(unread.map(r => call(`/quiz/tutor/reports/${r.id}/read`, { method: "POST" }).catch(() => { }))); if (onChange) onChange(0); }
  }

  /* Record (camera) or upload a short video for one report. */
  function videoDialog(reportId, done) {
    const rep = reports.find(r => r.id === reportId); if (!rep) return;
    const topics = (rep.report.weakTopics || []).map(w => w.topic);
    let stream = null, rec = null, chunks = [], blob = null, timer = 0, secs = 0;
    const MAX_SEC = 120, MAX_MB = 60;
    const stop = () => { clearInterval(timer); if (rec && rec.state !== "inactive") rec.stop(); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
    const root = show(`<div class="qz-row"><h3>Short video for ${esc(rep.studentName)}</h3><span class="qz-sp"></span><button class="btn ghost" data-qz="vclose">Cancel</button></div>
      <p class="qz-mut">Explain one weak topic in under 2 minutes. Record with your camera or upload a video file (max ${MAX_MB} MB).</p>
      <label>Topic<select class="qz-in" id="qz-vt">${(topics.length ? topics : ["Extra help"]).map(t => `<option>${esc(t)}</option>`).join("")}</select></label>
      <video id="qz-vp" playsinline muted controls hidden></video>
      <div class="qz-row"><button class="btn" data-qz="vrec">Record with camera</button><button class="btn ghost" data-qz="vstop" hidden>Stop</button><label class="btn ghost" style="cursor:pointer">Upload a file<input type="file" id="qz-vf" accept="video/*" hidden></label><span class="qz-mut" id="qz-vs"></span></div>
      <label>Message to the student (optional)<textarea class="qz-in" id="qz-vn" rows="2" maxlength="300" placeholder="e.g. Watch this before our next lesson."></textarea></label>
      <p class="qz-err" id="qz-ve" hidden></p><div class="qz-row"><button class="btn orange" data-qz="vsend" disabled>Send to student</button></div>`, stop);
    root.dataset.lock = "1";
    const $ = s => root.querySelector(s), err = m => { const e = $("#qz-ve"); e.hidden = !m; e.textContent = m || ""; };
    const preview = b => { blob = b; const v = $("#qz-vp"); v.hidden = false; v.muted = false; if (v.srcObject) v.srcObject = null; v.src = URL.createObjectURL(b); $('[data-qz="vsend"]').disabled = false; $("#qz-vs").textContent = (b.size / 1048576).toFixed(1) + " MB"; };
    handlers.vclose = () => { stop(); delete root.dataset.lock; hide(); };
    handlers.vrec = async b => {
      err(""); if (!navigator.mediaDevices || !window.MediaRecorder) return err("Recording is not supported in this browser. Upload a video file instead.");
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true }); } catch (e) { return err("Could not open the camera or microphone. Allow access, or upload a file instead."); }
      const v = $("#qz-vp"); v.hidden = false; v.muted = true; v.srcObject = stream; v.play().catch(() => { });
      chunks = []; blob = null; secs = 0;
      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m));
      rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 1200000 }, mime ? { mimeType: mime } : {}));
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => { clearInterval(timer); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; if (chunks.length) preview(new Blob(chunks, { type: rec.mimeType || "video/webm" })); $('[data-qz="vstop"]').hidden = true; b.hidden = false; };
      rec.start(1000); b.hidden = true; $('[data-qz="vstop"]').hidden = false;
      timer = setInterval(() => { secs++; $("#qz-vs").textContent = `Recording ${secs}s / ${MAX_SEC}s`; if (secs >= MAX_SEC) rec.stop(); }, 1000);
    };
    handlers.vstop = () => { if (rec && rec.state !== "inactive") rec.stop(); };
    $("#qz-vf").onchange = e => {
      err(""); const f = e.target.files[0]; if (!f) return;
      if (!/^video\//.test(f.type)) return err("Please choose a video file.");
      if (f.size > MAX_MB * 1048576) return err(`That file is too large (max ${MAX_MB} MB).`);
      const probe = document.createElement("video"); probe.preload = "metadata"; probe.src = URL.createObjectURL(f);
      probe.onloadedmetadata = () => { if (probe.duration > MAX_SEC + 5) { URL.revokeObjectURL(probe.src); return err("Please keep the video under 2 minutes."); } URL.revokeObjectURL(probe.src); preview(f); };
      probe.onerror = () => preview(f);
    };
    handlers.vsend = async b => {
      if (!blob) return; err(""); b.disabled = true; b.textContent = "Sending...";
      try {
        await call(`/quiz/tutor/reports/${reportId}/video?topic=${encodeURIComponent($("#qz-vt").value)}&note=${encodeURIComponent($("#qz-vn").value)}`, { method: "PUT", body: blob, raw: "json", headers: { "Content-Type": blob.type || "video/webm" } });
        stop(); delete root.dataset.lock; hide(); if (done) done();
      } catch (e) { err(e.message); b.disabled = false; b.textContent = "Send to student"; }
    };
  }

  window.UTSQuiz = {
    setHooks: h => { hooks = Object.assign(hooks, h); },
    start: startQuiz, offer, studentPage, unseenVideos,
    tutorPage, pollTutor, close: hide
  };
})();
