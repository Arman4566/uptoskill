/* Classroom. Opens the private Daily room for ?session=ID.
   Both people can turn on camera, microphone and share their screen (the buttons inside the video).
   The tutor also gets this side panel: the student's question, a countdown, and "End lesson" which pays the tutor.
   The lesson is recorded in the cloud automatically when the tutor joins. */
(function () {
  const { api, boot, logout, esc, toast } = UTSApi;
  const $ = s => document.querySelector(s);
  document.getElementById("out").onclick = logout;
  const id = Number(new URLSearchParams(location.search).get("session"));

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
    // The token is passed in the address of the private room; Daily's own screen-share, mic and camera controls appear inside.
    const src = `${info.roomUrl}?t=${encodeURIComponent(info.token)}`;
    root.innerHTML = `<div id="stage"><iframe title="Video lesson" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write" src="${esc(src)}"></iframe></div>
      <aside class="panel">
        <section class="card pad"><div class="chips"><span class="chip">${tutor ? "You are teaching" : "You are learning"}</span><span class="chip">${s.minutes} min</span></div>
          <div class="timer" id="t" aria-live="off">--:--</div><p class="mut" id="tl">Time left in this lesson</p>
          ${info.recording ? `<div class="rec"><span class="dot"></span> Recording this lesson</div><p class="mut">Both of you can watch the recording afterwards from Lessons.</p>` : `<p class="mut">Automatic recording is turned off for this lesson.</p>`}
        </section>
        <section class="card pad"><h2>${esc(s.title)}</h2><pre>${esc(s.problemText)}</pre></section>
        <section class="card pad">${tutor
        ? `<b>Tutor tools</b><p class="mut">Use <b>Share screen</b> in the video bar to show your code, slides or this dashboard. When the student's question is solved, end the lesson to receive your credits.</p><button class="btn orange" id="end">End lesson and get paid</button>`
        : `<b>Tips</b><p class="mut">Use <b>Share screen</b> in the video bar to show your problem. The tutor ends the lesson when you are done.</p><a class="btn ghost" href="lessons.html">Leave classroom</a>`}</section>
      </aside>`;

    const ends = Date.now() + s.minutes * 60000;
    const tick = () => {
      const left = Math.max(0, Math.round((ends - Date.now()) / 1000));
      $("#t").textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
      if (!left) $("#tl").textContent = "Scheduled time is up. You can keep going or end the lesson.";
    };
    tick(); setInterval(tick, 1000);

    const end = $("#end");
    if (end) end.onclick = async () => {
      if (!confirm("End the lesson now? Your earnings are released to you and the student can watch the recording.")) return;
      end.disabled = true;
      try {
        $("#stage").innerHTML = ""; // leaving the room stops the recording once everyone has left
        await api(`/sessions/${id}/complete`, { method: "POST" });
        toast("Lesson complete. Credits added to your wallet.");
        setTimeout(() => { location.href = "wallet.html"; }, 1200);
      } catch (e) { toast(e.message); end.disabled = false; }
    };
  }
  boot(start);
})();
