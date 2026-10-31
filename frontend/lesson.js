/* Classroom for ?session=ID.
   Video: Jitsi (free). meet.jit.si cannot be shown inside other websites, so the meeting opens in its own tab
   (camera, microphone and "Share screen" are in Jitsi's bottom bar). This tab stays open as the tutor's dashboard:
   timer, the student's question, lesson notes with screenshots, and "End lesson". When the lesson ends the notes
   become a PDF that the student finds under Lessons. (If the server uses Daily instead, the call is embedded here.) */
(function () {
  const { api, boot, logout, esc, toast } = UTSApi;
  const $ = s => document.querySelector(s);
  document.getElementById("out").onclick = logout;
  const id = Number(new URLSearchParams(location.search).get("session"));
  const MAX_IMAGES = 8;

  /* Shrinks a screenshot so the notes stay small: longest side 1100px, JPEG. */
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That file is not a picture.")); i.src = url; });
      const r = Math.min(1, 1100 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.72);
    } finally { URL.revokeObjectURL(url); }
  }

  /* The tutor's notes editor. Saves by itself a moment after every change. */
  function notesEditor(host) {
    let images = [], timer = null, chain = Promise.resolve(), locked = false;
    host.innerHTML = `<h2>Lesson notes</h2><p class="mut">Write what you teach. Screenshots of your dashboard or code can be added too. When you end the lesson, this becomes a PDF the student can open any time.</p>
      <textarea id="nb" maxlength="30000" placeholder="Key steps, explanations, links, homework..." style="min-height:220px;width:100%"></textarea>
      <div class="row" style="margin-top:10px"><label class="btn ghost" style="cursor:pointer;margin:0">Add screenshot<input id="nf" type="file" accept="image/*" multiple hidden></label><span class="mut" id="ns">Saved automatically</span></div>
      <div id="ni" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>`;
    const body = host.querySelector("#nb"), status = host.querySelector("#ns");
    const draw = () => {
      host.querySelector("#ni").innerHTML = images.map((im, i) => `<div style="position:relative"><img src="${im}" alt="Screenshot ${i + 1}" style="height:84px;border-radius:8px;border:1px solid var(--line);display:block"><button type="button" data-x="${i}" aria-label="Remove screenshot ${i + 1}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:#B91C1C;color:#fff;cursor:pointer">x</button></div>`).join("");
      host.querySelectorAll("[data-x]").forEach(b => b.onclick = () => { images.splice(Number(b.dataset.x), 1); draw(); changed(); });
    };
    const flush = () => {
      clearTimeout(timer); timer = null;
      chain = chain.then(async () => {
        if (locked) return;
        status.textContent = "Saving...";
        try { await api(`/sessions/${id}/notes`, { method: "PUT", body: { body: body.value, images } }); status.textContent = "Saved"; }
        catch (e) { if (e.code === "NOTES_LOCKED") { locked = true; return; } status.textContent = "Could not save: " + e.message; throw e; }
      }).catch(() => { });
      return chain;
    };
    const changed = () => { status.textContent = "Typing..."; clearTimeout(timer); timer = setTimeout(flush, 1500); };
    const addFiles = async files => {
      for (const f of files) {
        if (!f.type.startsWith("image/")) continue;
        if (images.length >= MAX_IMAGES) { toast(`You can add up to ${MAX_IMAGES} screenshots.`); break; }
        try { images.push(await shrink(f)); } catch (e) { toast(e.message); }
      }
      draw(); changed();
    };
    body.oninput = changed;
    body.onpaste = e => { const fs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/")); if (fs.length) { e.preventDefault(); addFiles(fs); } };
    host.querySelector("#nf").onchange = e => { addFiles([...e.target.files]); e.target.value = ""; };
    api(`/sessions/${id}/notes`).then(n => { if (!body.value) body.value = n.body || ""; images = n.images || []; draw(); }).catch(() => { });
    return { flush, lock: () => { locked = true; } };
  }

  async function loadScript(src) {
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Could not load the video tool.")); document.head.appendChild(s); });
  }

  async function start() {
    const root = $("#app");
    root.classList.remove("room");
    if (!id) { root.innerHTML = `<div class="card pad"><b>No lesson selected.</b> <a href="lessons.html">Go to your lessons</a></div>`; return; }
    let info;
    try { info = await api(`/sessions/${id}/video-token`, { method: "POST" }); }
    catch (e) {
      const msg = e.code === "LESSON_NOT_OPEN" ? "This lesson opens once the tutor accepts the request." : e.code === "VIDEO_NOT_CONFIGURED" ? "Video is not set up on the server yet." : e.message;
      root.innerHTML = `<div class="card pad"><b>${esc(msg)}</b><p><a href="lessons.html">Back to your lessons</a></p></div>`; return;
    }
    root.classList.add("room");
    const tutor = info.role === "tutor", s = info.session;
    const jitsi = info.provider === "jitsi";
    const newTab = jitsi && !info.embed;
    const meetUrl = jitsi ? `https://${info.domain}/${encodeURIComponent(info.roomName)}#userInfo.displayName=${encodeURIComponent(JSON.stringify(info.userName))}` : "";

    let stage;
    if (newTab) {
      stage = `<div id="stage" style="background:none;overflow:auto;display:flex;flex-direction:column;gap:12px">
        <section class="card pad"><h2>Video meeting</h2>
          <p class="mut">${tutor ? "Open the meeting and wait for your student. In the meeting use <b>Share screen</b> to show your code, slides or dashboard." : "Open the meeting to see and hear your tutor. Use <b>Share screen</b> in the meeting to show your problem."}</p>
          <div class="row" style="margin-top:8px"><a class="btn orange" id="meet" href="${esc(meetUrl)}" target="_blank" rel="noopener">Open video meeting</a></div>
          <p class="mut">The meeting opens in a new tab. Keep this tab open: ${tutor ? "your notes and the End lesson button are here." : "the timer is here, and the tutor's notes PDF will be waiting under Lessons when the lesson ends."}</p></section>
        ${tutor ? `<section class="card pad" id="notes"></section>` : `<section class="card pad"><h2>Notes PDF</h2><p class="mut">When the tutor ends the lesson, their notes are turned into a PDF. You will find a <b>Notes (PDF)</b> button next to this lesson under Lessons, and you can open it any time.</p></section>`}
      </div>`;
    } else if (jitsi) {
      stage = `<div id="stage"></div>`;
    } else {
      const src = `${info.roomUrl}?t=${encodeURIComponent(info.token)}`;
      stage = `<div id="stage"><iframe title="Video lesson" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write" src="${esc(src)}"></iframe></div>`;
    }
    root.innerHTML = `${stage}
      <aside class="panel">
        <section class="card pad"><div class="chips"><span class="chip">${tutor ? "You are teaching" : "You are learning"}</span><span class="chip">${s.minutes} min</span></div>
          <div class="timer" id="t" aria-live="off">--:--</div><p class="mut" id="tl">Time left in this lesson</p>
          ${info.recording ? `<div class="rec"><span class="dot"></span> Recording this lesson</div><p class="mut">Both of you can watch the recording afterwards from Lessons.</p>` : ""}
        </section>
        <section class="card pad"><h2>${esc(s.title)}</h2><pre>${esc(s.problemText)}</pre></section>
        ${tutor && !newTab ? `<section class="card pad" id="notes"></section>` : ""}
        <section class="card pad">${tutor
        ? `<b>Finish</b><p class="mut">When the student's question is solved, end the lesson. You receive your credits and the student receives your notes as a PDF.</p><button class="btn orange" id="end">End lesson and get paid</button>`
        : `<b>When you are done</b><p class="mut">The tutor ends the lesson. Your notes PDF then appears under Lessons.</p><a class="btn ghost" href="lessons.html">Leave classroom</a>`}</section>
      </aside>`;

    if (jitsi && info.embed) {
      try {
        await loadScript(`https://${info.domain}/external_api.js`);
        new window.JitsiMeetExternalAPI(info.domain, { roomName: info.roomName, parentNode: $("#stage"), width: "100%", height: "100%", userInfo: { displayName: info.userName } });
      } catch (e) { $("#stage").innerHTML = `<div class="card pad"><b>${esc(e.message)}</b><p><a class="btn orange" target="_blank" rel="noopener" href="${esc(meetUrl)}">Open video meeting in a new tab</a></p></div>`; }
    }
    if (newTab) { try { window.open(meetUrl, "_blank", "noopener"); } catch (e) { /* the button is there if the browser blocks it */ } }

    const editor = tutor ? notesEditor($("#notes")) : null;

    const ends = Date.now() + s.minutes * 60000;
    const tick = () => {
      const left = Math.max(0, Math.round((ends - Date.now()) / 1000));
      $("#t").textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
      if (!left) $("#tl").textContent = "Scheduled time is up. You can keep going or end the lesson.";
    };
    tick(); setInterval(tick, 1000);

    const end = $("#end");
    if (end) end.onclick = async () => {
      if (!confirm("End the lesson now? Your earnings are released to you and the student receives your notes as a PDF.")) return;
      end.disabled = true;
      try {
        await editor.flush(); // the last words typed are saved before the lesson closes
        if (!newTab) $("#stage").innerHTML = ""; // leaving the room stops the recording once everyone has left
        await api(`/sessions/${id}/complete`, { method: "POST" });
        editor.lock();
        toast("Lesson complete. Credits added to your wallet. Notes sent to the student.");
        setTimeout(() => { location.href = "wallet.html"; }, 1500);
      } catch (e) { toast(e.message); end.disabled = false; }
    };
  }
  boot(start);
})();
