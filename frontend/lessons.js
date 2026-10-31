/* Lessons: book a tutor, accept requests, join the video room, watch recordings of finished lessons. */
(function () {
  const { api, boot, logout, esc, when, toast } = UTSApi;
  const $ = s => document.querySelector(s);
  document.getElementById("out").onclick = logout;
  const STATUS = { requested: ["Waiting for tutor", "warn"], accepted: ["Ready to start", "ok"], in_progress: ["Live now", "ok"], completed: ["Finished", ""], declined: ["Declined", "bad"], cancelled: ["Cancelled", "bad"], expired: ["Expired", "bad"], no_show: ["No show", "bad"] };
  let me, book;

  async function start(user) {
    me = user;
    $("#app").innerHTML = `<div><h1>Lessons</h1><p class="mut">Video lessons with screen sharing. After each lesson the tutor's notes are sent to the student as a PDF they can open any time.</p></div>
      ${me.level >= 2 ? `<section class="card pad" id="avail"></section>` : ""}
      <section class="card pad" id="book"></section><section class="card pad"><h2>Your lessons</h2><div id="list"></div></section>`;
    try { book = await api("/mentors"); } catch (e) { book = { mentors: [], prices: [] }; }
    drawBook(); load(); if (me.level >= 2) drawAvail();
  }

  /* Tutor: add the times students can book. Saved on the server, so students see them straight away. */
  const local = d => { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  async function drawAvail() {
    let slots = [];
    try { slots = await api("/slots/mine"); } catch (e) { /* shown empty */ }
    const t = new Date(Date.now() + 3600e3); t.setMinutes(0, 0, 0);
    $("#avail").innerHTML = `<h2>Your availability</h2><p class="mut">Add the times you can teach. Students pick one of these when they book you.</p>
      <form id="af" class="row"><label>From<input type="datetime-local" id="as" required value="${local(t)}"></label>
      <label>To<input type="datetime-local" id="ae" required value="${local(new Date(t.getTime() + 3600e3))}"></label>
      <button class="btn">Add time</button></form><p class="err" id="ae2" hidden></p>
      <div style="margin-top:8px">${slots.length ? slots.map(x => `<div class="item"><div><b>${when(x.starts_at)}</b> <span class="mut">to ${new Date(x.ends_at).toLocaleTimeString([], { timeStyle: "short" })}</span></div><div class="row"><span class="chip ${x.is_booked ? "warn" : "ok"}">${x.is_booked ? "Booked" : "Open"}</span>${x.is_booked ? "" : `<button class="btn ghost" data-del="${x.id}">Remove</button>`}</div></div>`).join("") : `<p class="mut">No upcoming times yet.</p>`}</div>`;
    $("#af").onsubmit = async ev => {
      ev.preventDefault();
      try {
        await api("/slots", { method: "POST", body: { startsAt: new Date($("#as").value).toISOString(), endsAt: new Date($("#ae").value).toISOString() } });
        toast("Time added. Students can book it now."); drawAvail();
      } catch (e) { const el = $("#ae2"); el.hidden = false; el.textContent = e.code === "VALIDATION" ? "Please pick a valid start and end." : e.message; }
    };
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { try { await api("/slots/" + b.dataset.del, { method: "DELETE" }); drawAvail(); } catch (e) { toast(e.message); } });
  }

  async function mentorSlots() {
    const box = $("#bsl"), mid = $("#bm").value;
    box.innerHTML = `<option value="">Loading times...</option>`;
    let slots = [];
    try { slots = await api(`/mentors/${mid}/slots`); } catch (e) { /* none */ }
    box.innerHTML = slots.length
      ? slots.map(x => `<option value="${x.id}">${esc(when(x.starts_at))} to ${esc(new Date(x.ends_at).toLocaleTimeString([], { timeStyle: "short" }))}</option>`).join("")
      : `<option value="">This tutor has not added any times yet</option>`;
  }

  function drawBook() {
    if (!book.mentors.length) { $("#book").innerHTML = `<h2>Book a lesson</h2><p class="mut">No tutors above your level are available yet.</p>`; return; }
    const price = m => { const p = book.prices.find(x => x.minutes === Number(m)); return p ? p.studentCredits : ""; };
    $("#book").innerHTML = `<h2>Book a lesson</h2><form id="bf" style="display:flex;flex-direction:column;gap:12px;max-width:560px">
      <label>Tutor<select id="bm">${book.mentors.map(m => `<option value="${m.id}">${esc(m.name)} · level ${m.level} · ${esc((m.skills || []).join(", "))}</option>`).join("")}</select></label>
      <label>Time<select id="bsl"></select></label>
      <label>Length<select id="bt">${book.prices.map(p => `<option value="${p.minutes}">${p.minutes} minutes · ${p.studentCredits} credits</option>`).join("")}</select></label>
      <label>What do you need help with?<input id="bh" minlength="3" maxlength="80" required placeholder="e.g. Fix my useEffect loop"></label>
      <label>Describe the problem<textarea id="bp" minlength="10" required></textarea></label>
      <p class="err" id="be" hidden></p><div><button class="btn orange" id="bc">Request lesson (${price(book.prices[0].minutes)} credits)</button></div>
      <p class="mut">Credits are only held once the tutor accepts, and released to the tutor when the lesson ends.</p></form>`;
    $("#bm").onchange = mentorSlots; mentorSlots();
    $("#bt").onchange = () => { $("#bc").textContent = `Request lesson (${price($("#bt").value)} credits)`; };
    $("#bf").onsubmit = async ev => {
      ev.preventDefault();
      try {
        await api("/sessions", { method: "POST", body: { mentorId: Number($("#bm").value), ...($("#bsl").value ? { slotId: Number($("#bsl").value) } : {}), minutes: Number($("#bt").value), title: $("#bh").value, problemText: $("#bp").value } });
        toast("Request sent."); $("#bf").reset(); mentorSlots(); load();
      } catch (e) { const el = $("#be"); el.hidden = false; el.textContent = e.code === "VALIDATION" ? "Please fill in every field (problem needs 10+ characters)." : e.code === "BAD_SLOT" ? "That time was just taken. Pick another." : e.message; }
    };
  }

  async function load() {
    const list = await api("/sessions");
    $("#list").innerHTML = list.length ? list.map(s => {
      const tutor = s.mentor_id === me.id, st = STATUS[s.status] || [s.status, ""];
      const acts = [];
      if (tutor && s.status === "requested") acts.push(`<button class="btn" data-a="accept" data-id="${s.id}">Accept</button>`, `<button class="btn ghost" data-a="decline" data-id="${s.id}">Decline</button>`);
      if (["accepted", "in_progress"].includes(s.status)) acts.push(`<a class="btn orange" href="lesson.html?session=${s.id}">${tutor ? "Open classroom" : "Join lesson"}</a>`);
      if (["requested", "accepted"].includes(s.status)) acts.push(`<button class="btn ghost" data-a="cancel" data-id="${s.id}">Cancel</button>`);
      if (s.status === "completed") {
        if (s.has_notes) acts.push(`<button class="btn orange" data-a="pdf" data-id="${s.id}">Notes (PDF)</button>`);
        acts.push(`<button class="btn ghost" data-a="rec" data-id="${s.id}">Recordings</button>`);
      }
      const money = tutor ? `You earn ${s.tutor_credits ?? s.credits} credits` : `${s.credits} credits`;
      return `<div class="item"><div><b>${esc(s.title)}</b><div class="chips" style="margin-top:6px"><span class="chip">${tutor ? "You teach" : "You learn"}</span><span class="chip">${s.minutes} min</span><span class="chip">${money}</span><span class="chip ${st[1]}">${st[0]}</span></div><small class="mut">${when(s.created_at)}</small></div><div class="row">${acts.join("")}</div></div>`;
    }).join("") : `<p class="mut">No lessons yet.</p>`;
    document.querySelectorAll("#list [data-a]").forEach(b => b.onclick = () => act(b.dataset.a, Number(b.dataset.id)));
  }

  async function act(a, id) {
    if (a === "rec") return recordings(id);
    if (a === "pdf") { try { await UTSApi.download(`/sessions/${id}/notes.pdf`, `lesson-${id}-notes.pdf`); } catch (e) { toast(e.message); } return; }
    try { await api(`/sessions/${id}/${a}`, { method: "POST" }); toast({ accept: "Accepted. The student's credits are now held.", decline: "Declined.", cancel: "Cancelled." }[a]); }
    catch (e) { toast(e.code === "INSUFFICIENT_CREDITS" ? "The student does not have enough credits yet." : e.message); }
    load();
  }

  async function recordings(id) {
    const ov = $("#ov"), mod = $("#mod");
    const close = () => { ov.hidden = true; mod.innerHTML = ""; };
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.hidden = false; mod.innerHTML = `<p>Loading...</p>`;
    try {
      const recs = await api(`/sessions/${id}/recordings`);
      if (!recs.length) { mod.innerHTML = `<h2>Recording</h2><p class="mut">The recording is still being processed, or none was made. It usually appears a few minutes after the lesson ends.</p><button class="btn ghost" id="x">Close</button>`; $("#x").onclick = close; return; }
      mod.innerHTML = `<h2>Lesson recording</h2><div id="vw"></div><div class="row" style="margin-top:10px">${recs.map((r, i) => `<button class="btn ghost" data-r="${r.id}">Part ${i + 1}${r.duration_sec ? " · " + Math.round(r.duration_sec / 60) + " min" : ""}</button>`).join("")}<button class="btn ghost" id="x">Close</button></div>`;
      $("#x").onclick = close;
      const play = async rid => {
        $("#vw").innerHTML = `<p class="mut">Loading video...</p>`;
        try { const l = await api(`/recordings/${rid}/play`); $("#vw").innerHTML = `<video controls autoplay playsinline src="${esc(l.url)}"></video>`; }
        catch (e) { $("#vw").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
      };
      mod.querySelectorAll("[data-r]").forEach(b => b.onclick = () => play(b.dataset.r));
      play(recs[0].id);
    } catch (e) { mod.innerHTML = `<p class="err">${esc(e.message)}</p><button class="btn ghost" id="x">Close</button>`; $("#x").onclick = close; }
  }

  boot(start);
})();
