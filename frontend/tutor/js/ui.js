/* UpToSkill Tutor - screens and actions. */
"use strict";
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  help: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4"/><circle cx="16" cy="14" r="1"/>',
  star: '<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
  book: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h12"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5"/>',
  flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-10z"/>',
  bar: '<path d="M12 20V10M18 20V4M6 20v-4"/>', check: '<path d="M20 6L9 17l-5-5"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
  ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
  repeat: '<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0M17 4.5a3.5 3.5 0 0 1 0 7M22 21a6 6 0 0 0-4-5.6"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.3L4 21l1.5-4.5A8.4 8.4 0 1 1 21 11.5z"/>',
  cap: '<path d="M22 10L12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'
};
const icon = (n, s = 20) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${P[n]}</svg>`;
const ini = n => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const COLORS = ["#1D4ED8", "#C2570C", "#0B2A6F", "#2563EB", "#9A3412"];
const av = (n, s = 44) => `<span class="av" style="background:${COLORS[(n.charCodeAt(0) + n.length) % COLORS.length]};width:${s}px;height:${s}px">${ini(n)}</span>`;
const stars = n => "★".repeat(n) + "☆".repeat(5 - n);

/* ---------- profile helpers (photo, qualifications, intro video live in the shared store so the student app can read them) ---------- */
const MYMAIL = window.UTS ? UTS.email : "guest";
const myProf = () => UTSShared.getProfile(MYMAIL);
const avMe = (s = 44) => { const p = myProf().photo; return p ? `<img class="av ph" src="${p}" alt="Your photo" style="width:${s}px;height:${s}px">` : av(S.me.name, s); };
function saveProf(patch) { if (!UTSShared.setProfile(MYMAIL, patch)) { toast("Could not save: browser storage is full."); return false; } return true; }
function syncPublic() {                 // what a student may see on a tutor card (also my open time slots, so students can book them)
  if (!window.UTSShared || !window.UTS) return;
  const now = Date.now(), pub = { name: S.me.name, bio: S.me.bio, level: S.me.level, levelName: levelName(S.me.level), skills: S.me.skills, langs: S.me.langs, rating: +avgRating().toFixed(1), reviews: S.ratings.length, sessions: given().length, since: S.me.joined,
    slots: S.slots.filter(x => !x.booked && x.end > now + 5 * 6e4).sort((a, b) => a.start - b.start).slice(0, 30).map(x => ({ id: x.id, start: x.start, end: x.end })) };
  const old = myProf().pub;
  if (!old || JSON.stringify(old) !== JSON.stringify(pub)) UTSShared.setProfile(MYMAIL, { pub });   // unchanged -> nothing to save
}
function profileExtras() {
  const p = myProf(), q = p.qualifications || [], v = p.video, cy = new Date().getFullYear();
  return `<div class="card pad"><h2>${icon("camera")} Profile photo</h2><p class="mut">Learners see this on your tutor card. Use a clear photo of your face.</p>
    <div class="row" style="gap:16px">${avMe(88)}<div class="acts"><button class="btn" data-act="photocam">${icon("camera", 18)} Take photo</button><button class="btn ghost" data-act="photogal">${icon("image", 18)} From gallery</button>${p.photo ? '<button class="btn ghost" data-act="photodel">Remove</button>' : ""}</div></div>
    <input type="file" id="f-photo-gal" accept="image/*" data-file="photo" hidden><input type="file" id="f-photo-cam" accept="image/*" capture="user" data-file="photo" hidden></div>
    <div class="card pad"><h2>${icon("cap")} Qualifications</h2><p class="mut">Add your degrees and certificates (up to 6). A future year means you are still studying.</p>
    ${q.length ? q.map((x, i) => `<div class="qrow"><div><b>${esc(x.deg)}</b><span>${esc(x.inst)} · ${x.year > cy ? "Pursuing, " + x.year : x.year}</span></div><button class="ib" aria-label="Remove ${esc(x.deg)}" data-act="rmqual" data-id="${i}">${icon("x", 15)}</button></div>`).join("") : '<p class="mut">No qualification added yet.</p>'}
    <div class="qadd"><input class="in" id="q-deg" maxlength="80" placeholder="Degree / certificate, e.g. B.Tech CSE" aria-label="Degree"><input class="in" id="q-inst" maxlength="80" placeholder="Institute" aria-label="Institute"><input class="in" id="q-yr" type="number" min="1980" max="${cy + 6}" placeholder="Year" aria-label="Year"><button class="btn ghost" data-act="addqual">${icon("plus", 18)} Add</button></div></div>
    <div class="card pad"><h2>${icon("video")} Intro video</h2><p class="mut">Learners can watch this on your profile. Max 1 minute. Portrait (9:16) or landscape (16:9) only.</p>
    ${v ? `<div class="vwrap ${v.ratio === "9:16" ? "portrait" : "land"}"><video id="pvid" controls playsinline preload="metadata"></video></div><p class="mut">${v.ratio} · ${Math.round(v.duration)} s · ${(v.size / 1048576).toFixed(1)} MB</p>` : empty("No intro video yet", "A short hello video helps learners trust and pick you.")}
    <div class="acts"><button class="btn" data-act="vidcam">${icon("video", 18)} Record video</button><button class="btn ghost" data-act="vidgal">${icon("image", 18)} From gallery</button>${v ? '<button class="btn ghost" data-act="viddel">Remove</button>' : ""}</div>
    <input type="file" id="f-vid-gal" accept="video/*" data-file="video" hidden><input type="file" id="f-vid-cam" accept="video/*" capture="user" data-file="video" hidden></div>`;
}
function loadMyVideo() { const el = $("#pvid"); if (el) UTSShared.getVideo(MYMAIL).then(b => { if (b && $("#pvid") === el) el.src = URL.createObjectURL(b); }); }

/* webcam capture for desktop (phones use the file input with capture, which opens the camera app) */
let camStream = null;
function stopCam() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
async function openWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("No camera found here. Pick a photo from the gallery."); return $("#f-photo-gal").click(); }
  try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false }); }
  catch (e) { return toast("Camera is blocked or missing. Allow camera access, or choose from gallery."); }
  modal(`<h3>Take a profile photo</h3><div class="cam"><video id="camv" autoplay playsinline muted></video></div><div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="camshot">${icon("camera", 18)} Capture</button></div>`);
  $("#camv").srcObject = camStream;
}
function setPhoto(dataUrl) { if (saveProf({ photo: dataUrl })) { toast("Profile photo updated"); go("profile", null, true); } }
const FILE = {
  photo: el => { const f = el.files[0]; el.value = ""; if (f) UTSShared.photoFromFile(f).then(setPhoto).catch(e => toast(e.message)); },
  video: el => { const f = el.files[0]; el.value = ""; if (!f) return; toast("Checking video...");
    UTSShared.saveVideo(MYMAIL, f).then(m => { toast(`Intro video saved (${m.ratio}, ${Math.round(m.duration)} s)`); go("profile", null, true); }).catch(e => toast(e.message || "Could not save the video.")); }
};


let page = "dashboard", arg = null, quizUnread = 0;
const T = { sess: "upcoming", board: "open", earn: "month", lf: "all", bq: "", bt: "Any", openReq: {} };
let learnerMode = false, roomTimers = [];

/* ---------- toast + modal ---------- */
let toastBusy = false; const toastQ = [];
function toast(m) { toastQ.push(m); nextToast(); }
function nextToast() {
  if (toastBusy || !toastQ.length) return; toastBusy = true; const t = $("#toast"); t.textContent = toastQ.shift(); t.className = "on";
  setTimeout(() => { t.className = ""; setTimeout(() => { toastBusy = false; nextToast(); }, 250); }, 3000);
}
function modal(h, wide) { $("#modal").innerHTML = `<div class="mod ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${h}</div>`; $("#modal").hidden = false; const f = $("#modal input,#modal textarea,#modal select,#modal .btn"); if (f) f.focus(); }
const closeModal = () => { stopCam(); $("#modal").hidden = true; };

/* ---------- navigation ---------- */
const unreadMsgs = () => window.UTSShared ? UTSShared.tutorThreads(MYMAIL).reduce((n, c) => n + c.unread, 0) : 0;
const reqCount = () => S.sessions.filter(s => s.status === "requested").length;
const instOpen = () => S.instant.filter(r => r.status === "open" && !r.skipped);
function menu() {
  return [["dashboard", "Dashboard", "grid"], ["requests", "Session Requests", "inbox", reqCount()], ["messages", "Messages", "chat", unreadMsgs()], ["sessions", "My Sessions", "cal"], ["availability", "Availability", "clock"],
    ["instant", "Instant Help", "bolt", S.me.online ? instOpen().length : 0], ["board", "Doubt Board", "help"], ["earnings", "Earnings", "wallet"], ["reports", "Student Reports", "bar", quizUnread], ["reviews", "Reviews", "star"], ["leaderboard", "Leaderboard", "trophy"], ["profile", "Profile", "user"]];
}
function levelCard() {
  const n = given().length, r = avgRating(), l = S.me.level, nx = LEVEL_RULES[l + 1];
  if (!nx) return `<div class="lvl"><h4>${icon("medal", 16)} Level ${l} · ${levelName(l)}</h4><p>Top level reached. Thank you for mentoring!</p><div class="bar"><i style="width:100%"></i></div></div>`;
  const left = Math.max(0, nx[0] - n), need = left ? `${left} more session${left > 1 ? "s" : ""}` : `rating of ${nx[1]}+`;
  return `<div class="lvl"><h4>${icon("medal", 16)} Level ${l} · ${levelName(l)}</h4><p>${need} to reach Level ${l + 1} ${levelName(l + 1)}</p><div class="bar"><i style="width:${Math.min(100, Math.round(n / nx[0] * 100))}%"></i></div><p>${n} / ${nx[0]} sessions given · rating ${r.toFixed(1)}</p></div>`;
}
function renderNav() {
  syncPublic();
  $("#nav").innerHTML = `<div class="logo"><img class="logo-full" src="../assets/logo.png" alt="UpToSkill"><img class="logo-icon" src="../assets/logo-icon.png" alt="UpToSkill"></div>` +
    menu().map(([id, l, i, n]) => `<button class="nav-item ${id === page || (id === "sessions" && page === "room") ? "on" : ""}" data-act="go" data-id="${id}" ${id === page ? 'aria-current="page"' : ""}>${icon(i)}<span>${l}</span>${n ? `<em class="badge-n">${n}</em>` : ""}</button>`).join("") +
    `<a class="nav-item" href="../lessons.html" title="Accept real lesson requests and add availability (needs the server)">${icon("video")}<span>Live Lessons</span></a>` +
    `${UTSTheme.control()}<div class="side">${levelCard()}<div class="me"><div class="mehead">${avMe(40)}<div><b>${esc(S.me.name)}</b>Tutor · Level ${S.me.level} ${levelName(S.me.level)}</div></div><span class="mc">${icon("wallet", 14)} ${bal("me")} credits</span></div><button class="btn ghost" data-act="logout">Log out</button></div>`;
}
function go(id, a, keep) {
  const y = keep ? window.scrollY : 0;
  roomTimers.forEach(clearInterval); roomTimers = [];
  page = id; arg = a ?? null; if (window.UTSBack && !keep) UTSBack.note(id, arg); try { location.hash = id === "room" ? "room/" + a : id; } catch (e) { }
  renderNav(); $("#main").innerHTML = PAGES[id](a); (AFTER[id] || (() => { }))(a); window.scrollTo(0, y);
}
function refresh() {
  const ae = document.activeElement, typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  renderNav(); if (page === "room" || page === "reports" || !$("#modal").hidden || typing) return;
  go(page, arg, true);
}

/* ---------- shared pieces ---------- */
const head = (t, s, right) => `<div class="phead"><div><h1 class="pt">${t}</h1><p class="mut">${s}</p></div>${right || ""}</div>`;
const sec = (t, i, link, act, id) => `<div class="sec-head"><h2>${icon(i)} ${t}</h2>${link ? `<a tabindex="0" role="link" data-act="${act}" data-id="${id}">${link}</a>` : ""}</div>`;
const empty = (t, s) => `<div class="empty"><b>${t}</b>${s}</div>`;
const STATUS = { requested: ["n", "Waiting for you"], accepted: ["g", "Accepted"], in_progress: ["o", "In progress"], completed: ["g", "Completed"], declined: ["n", "Declined"], expired: ["n", "Expired"], cancelled: ["n", "Cancelled"], no_show: ["n", "No-show"] };
const skillsTxt = t => t.map(x => `<span class="chip">${esc(x)}</span>`).join("");
const diff = n => `<span class="chip n" title="Difficulty">${"●".repeat(n)}${"○".repeat(3 - n)} Level ${n}/3</span>`;

function briefHTML(s) {
  if (!s.brief) return `<div class="brief"><b>Problem (raw text)</b><p>${esc(s.problem)}</p><button class="btn ghost sm" data-act="genbrief" data-id="${s.id}">${icon("repeat", 15)} Generate AI brief</button></div>`;
  return `<div class="brief"><b>AI mentor brief</b><p><u>Problem:</u> ${esc(s.brief.problem_summary)}</p><p><u>Already tried:</u> ${esc(s.brief.already_tried)}</p><p><u>Prepare:</u> ${(s.brief.topics_to_prepare || []).map(esc).join(" · ") || "-"}</p></div>`;
}
function requestCard(s) {
  const l = user(s.learnerId), m = matchScore(s), open = T.openReq[s.id];
  return `<div class="card req"><div class="rtop">${av(l.name)}<div class="info"><div class="t">${esc(s.title)}</div><div class="w">from ${esc(l.name)} · Level ${l.level} · ${s.slotTs ? when(s.slotTs) : ""}</div>
    <div class="m">${skillsTxt(s.tags)}${diff(s.difficulty)}<span class="chip">${s.minutes} min</span><span class="chip o">${s.credits} credits</span><span class="chip g" title="Skill ${m.skill}/40, language ${m.lang}/15, availability ${m.avail}/20, rating ${m.rate}/15, level gap ${m.gap}/10">Match ${m.total}/100</span></div>
    <p class="mut" style="margin-top:8px">${esc(AI.explainMatch(m))}</p></div>
    <div class="acts"><button class="btn" data-act="accept" data-id="${s.id}">${icon("check", 18)} Accept</button><button class="btn ghost" data-act="decline" data-id="${s.id}">Decline</button></div></div>
    <button class="linkbtn" data-act="togglebrief" data-id="${s.id}" aria-expanded="${!!open}">${open ? "Hide" : "View"} problem &amp; AI brief</button>${open ? briefHTML(s) : ""}</div>`;
}
const upcoming = () => S.sessions.filter(s => s.status === "accepted" || s.status === "in_progress").sort((a, b) => a.slotTs - b.slotTs);
function sessionCard(s) {
  const l = user(s.learnerId), st = STATUS[s.status], c = s.status === "completed" ? `+${s.credits} paid` : ["cancelled", "no_show"].includes(s.status) ? `${s.credits} released` : `${s.credits} held`;
  const rt = S.ratings.find(r => r.sid === s.id);
  const btn = s.status === "accepted" ? `<button class="btn" data-act="join" data-id="${s.id}">${icon("video", 18)} Join room</button><button class="btn ghost" data-act="resched" data-id="${s.id}">${icon("clock", 18)} Reschedule</button><button class="btn ghost" data-act="cancel" data-id="${s.id}">Cancel</button><button class="btn ghost" data-act="noshow" data-id="${s.id}">No-show</button>`
    : s.status === "in_progress" ? `<button class="btn" data-act="join" data-id="${s.id}">${icon("video", 18)} Rejoin room</button><button class="btn orange" data-act="endsession" data-id="${s.id}">End session</button>`
    : s.status === "completed" ? `<button class="btn ghost" data-act="notes" data-id="${s.id}">${icon("note", 18)} Session notes</button>` : "";
  return `<div class="card lec"><div class="when"><small>${dayName(s.slotTs)}</small><b>${clock(s.slotTs)}</b></div><div class="info"><div class="t">${esc(s.title)}</div><div class="w">with ${esc(l.name)} · ${esc(s.tags.join(", "))} · ${s.type === "instant" ? "Instant Help" : "Booked"}</div>
    <div class="m"><span class="chip">${s.minutes} min</span><span class="chip o">${c}</span><span class="chip ${st[0]}">${st[1]}</span>${(s.reschedules || []).length ? `<span class="chip o" title="Moved ${(s.reschedules || []).length} time(s)">Rescheduled ×${s.reschedules.length}</span>` : ""}${(s.delays || []).length ? `<span class="chip o" title="The learner moved this lecture">Delayed by learner ×${s.delays.length}</span>` : ""}${rt ? `<span class="chip g">${rt.stars}★ from learner</span>` : ""}${s.status === "completed" && s.noteStatus === "unavailable" ? '<span class="chip n">Notes unavailable</span>' : ""}</div></div><div class="acts">${btn}</div></div>`;
}
function boardCard(b) {
  const a = user(b.authorId), mine = b.authorId === "me", myAns = b.answers.find(x => x.helperId === "me");
  const ans = b.answers.map(x => `<div class="rep ${x.accepted ? "acc" : ""}"><b>${esc(user(x.helperId).name)}${x.accepted ? " · accepted answer ✓" : ""}:</b> ${esc(x.body)}${mine && b.status === "open" ? ` <button class="btn ghost sm" data-act="acceptans" data-id="${b.id}" data-r="${x.id}">Accept best</button>` : ""}</div>`).join("");
  const form = b.status === "open" && !mine && !myAns ? `<div class="row"><input class="in" id="ba${b.id}" placeholder="Write your answer (be specific and kind)"><button class="btn" data-act="answer" data-id="${b.id}">${icon("send", 16)} Answer</button></div>` : b.status === "open" && myAns ? '<p class="mut">Your answer is submitted. The author will pick the best one.</p>' : "";
  const stt = b.status === "open" ? `<span class="chip o">Open · ${Math.max(0, Math.round((b.deadline - Date.now()) / HR))}h left</span>` : b.status === "solved" ? '<span class="chip g">Solved</span>' : '<span class="chip n">Expired · refunded</span>';
  return `<div class="card pad"><div class="row"><b style="flex:1">${esc(b.title)}</b>${skillsTxt(b.tags)}<span class="chip o">${b.reward} credits</span>${stt}</div><p class="mut">Asked by ${esc(mine ? "you" : a.name)} · reward locked in escrow${b.fromInstant ? " · from Instant Help" : ""}</p>${ans}${form}</div>`;
}

/* ---------- pages ---------- */
const PAGES = {
  dashboard() {
    const rq = S.sessions.filter(s => s.status === "requested"), up = upcoming(), io = instOpen(), wk = earnRows().filter(r => r.ts > Date.now() - 7 * DAY).reduce((n, r) => n + r.delta, 0), pw = earnRows().filter(r => r.ts <= Date.now() - 7 * DAY && r.ts > Date.now() - 14 * DAY).reduce((n, r) => n + r.delta, 0);
    const got = given(), hrs = got.reduce((n, s) => n + s.minutes, 0) / 60, bs = S.bounties.filter(b => b.status === "open" && b.authorId !== "me" && b.tags.some(t => S.me.skills.some(k => k.n === t)) && !b.answers.some(a => a.helperId === "me")).slice(0, 3);
    const stats = [["wallet", "Credits earned (7 days)", wk, (wk - pw >= 0 ? "+" : "") + (wk - pw) + " vs previous week · see graph", 1, "earnings"], ["book", "Sessions taught", got.length, "Total", 0], ["star", "Average rating", avgRating().toFixed(1), S.ratings.length + " reviews", 1, "reviews"], ["clock", "Teaching time", +hrs.toFixed(1) + "h", "Total", 0]];
    return `<section class="hero"><div><h1>Tutor dashboard</h1><p>${rq.length} request${rq.length === 1 ? "" : "s"} waiting · ${up.length} upcoming session${up.length === 1 ? "" : "s"}${S.me.online ? " · you are visible for Instant Help" : " · you are offline"}</p></div>
      <div class="right"><button class="toggle" role="switch" aria-checked="${S.me.online}" data-act="online"><span>${S.me.online ? "Available now" : "Offline"}</span><i class="sw ${S.me.online ? "" : "off"}"></i></button><span class="credits">${icon("wallet", 18)} ${bal("me")} credits</span></div></section>
    ${io.length && S.me.online ? instantBanner(io[0]) : ""}
    <div class="stats">${stats.map(s => `<${s[5] ? 'button data-act="go" data-id="' + s[5] + '"' : "div"} class="card stat ${s[5] ? "click" : ""}"><span class="ic ${s[4] ? "o" : ""}">${icon(s[0], 22)}</span><div><small>${s[1]}</small><b>${s[2]}</b><em>${s[3]}</em></div></${s[5] ? "button" : "div"}>`).join("")}</div>
    <section class="sec">${sec("Incoming session requests", "inbox", "View all", "go", "requests")}${rq.length ? rq.slice(0, 3).map(requestCard).join("") : empty("No pending requests", "New requests from learners below your level show up here.")}</section>
    <section class="sec">${sec("Upcoming sessions", "cal", "View all", "go", "sessions")}${up.length ? up.slice(0, 3).map(sessionCard).join("") : empty("Nothing scheduled", "Accept a request to fill your calendar.")}</section>
    <section class="sec">${sec("Doubts you can answer", "help", "Open board", "go", "board")}${bs.length ? bs.map(boardCard).join("") : empty("No open doubts for your skills", "Check the Doubt Board later.")}</section>`;
  },
  requests() {
    const rq = S.sessions.filter(s => s.status === "requested");
    return head("Session Requests", "Accept a request to hold the learner's credits in escrow. You are paid when the session is completed.") + (rq.length ? rq.map(requestCard).join("") : empty("No pending requests", "New requests will show up here. Requests expire after 24 hours with nothing charged."));
  },
  sessions() {
    const up = T.sess === "upcoming", list = S.sessions.filter(s => up ? ["accepted", "in_progress"].includes(s.status) : ["completed", "cancelled", "no_show", "declined", "expired"].includes(s.status)).sort((a, b) => up ? a.slotTs - b.slotTs : (b.endTs || b.slotTs) - (a.endTs || a.slotTs));
    return head("My Sessions", "Join the live room, end a session to get paid, or cancel to release the learner's credits.") +
      `<div class="tabs">${[["upcoming", "Upcoming"], ["past", "Past"]].map(([k, l]) => `<button class="btn ${T.sess === k ? "" : "ghost"}" data-act="stab" data-id="${k}">${l}</button>`).join("")}</div>` +
      (list.length ? list.slice(0, 40).map(sessionCard).join("") : empty("Nothing here yet", "Accept a request or take an Instant Help call."));
  },
  messages() {
    const th = UTSShared.tutorThreads(MYMAIL), learners = Object.values(S.users).filter(u => u.email);
    const compose = `<div class="card pad"><b>Message a learner</b><p class="mut">${learners.length ? "Write to any learner who booked or messaged you. They see it under Messages in their app." : "Learners appear here after they book you or send you a message."}</p>
      ${learners.length ? `<div class="row"><select class="in" id="nmTo" aria-label="Learner">${learners.map(u => `<option value="${esc(String(u.email).toLowerCase())}">${esc(u.name || u.email)}</option>`).join("")}</select>
      <input class="in" id="nmText" maxlength="500" placeholder="Write your message" aria-label="Message" style="flex:1;min-width:160px"><button class="btn" data-act="newmsg">${icon("send", 16)} Send</button></div>` : ""}</div>`;
    return head("Messages", "Chat with your learners. Learners can also message you from their Recommended tutors list.") + compose + (th.length ? th.map(threadCard).join("") : empty("No messages yet", "When a learner opens your card and taps Chat, the conversation shows up here."));
  },
  availability() {
    const slots = S.slots.slice().sort((a, b) => a.start - b.start).filter(x => x.end > Date.now() - DAY), days = {};
    slots.forEach(x => (days[startOfDay(x.start)] = days[startOfDay(x.start)] || []).push(x));
    return head("Availability", "Learners can only book slots you publish here.", `<button class="btn" data-act="addslot">${icon("plus", 18)} Add slot</button>`) +
      (Object.keys(days).length ? `<div class="days">${Object.entries(days).map(([d, ls]) => `<div class="day ${startOfDay(Date.now()) == d ? "today" : ""}"><b>${dayName(+d)}</b>${ls.map(x => `<div class="slot ${x.booked ? "bk" : ""}"><span>${clock(x.start)} - ${clock(x.end)}</span>${x.booked ? `<em>Booked · ${esc(user(sess(x.sid)?.learnerId).name)}</em>` : '<em>Free</em>'}<button class="ib" aria-label="Remove slot" data-act="rmslot" data-id="${x.id}" ${x.booked ? "disabled" : ""}>${icon("trash", 15)}</button></div>`).join("")}</div>`).join("")}</div>` : empty("No slots yet", "Add your first free slot so learners can book you."));
  },
  instant() {
    const io = instOpen(), done = S.instant.filter(r => r.status !== "open").slice(0, 6), lab = { claimed: "Claimed", bountied: "Moved to Doubt Board", taken: "You took it" };
    return head("Instant Help", "A learner is stuck right now. The first mentor to accept wins. No taker in 60 seconds and it moves to the Doubt Board.", `<button class="toggle dark" role="switch" aria-checked="${S.me.online}" data-act="online"><span>${S.me.online ? "Available now" : "Offline"}</span><i class="sw ${S.me.online ? "" : "off"}"></i></button>`) +
      (!S.me.online ? `<div class="empty"><b>You are offline</b>Turn on "Available now" to receive instant requests that match your skills.</div>` : "") +
      (io.length ? io.map(r => instantBanner(r, true)).join("") : S.me.online ? empty("Waiting for requests...", "New instant requests appear here live. Stay on this page or the dashboard.") : "") +
      (done.length ? `<section class="sec">${sec("Recent", "clock")}<div class="card"><table><tr><th>Learner</th><th>Topic</th><th>Result</th></tr>${done.map(r => `<tr><td>${esc(user(r.learnerId).name)}</td><td>${esc(r.title)}</td><td>${lab[r.status]}${r.by ? " by " + esc(r.by) : ""}</td></tr>`).join("")}</table></div></section>` : "");
  },
  board() {
    return head("Doubt Board", "Answer a bounty. If the learner accepts your answer, the escrowed reward is paid to you. Solved bounties stay as a knowledge base.") +
      `<div class="tabs">${[["open", "Open"], ["solved", "Solved"], ["expired", "Expired"], ["mine", "My answers"]].map(([k, l]) => `<button class="btn ${T.board === k ? "" : "ghost"}" data-act="btab" data-id="${k}">${l}</button>`).join("")}</div>
      <div class="card search"><label>${icon("help")}<input id="bq" data-inp="bq" value="${esc(T.bq)}" placeholder="Search doubts" aria-label="Search doubts"></label><select class="in" data-chg="bt" aria-label="Filter by topic">${["Any", ...VOCAB].map(o => `<option ${T.bt === o ? "selected" : ""}>${o}</option>`).join("")}</select></div><div id="blist" class="sec"></div>`;
  },
  earnings() {
    const sr = series(T.earn), life = earnRows().reduce((n, r) => n + r.delta, 0), rows = S.ledger.filter(r => r.uid === "me" && (T.lf === "all" || (T.lf === "earn" ? EARN.includes(r.reason) : !EARN.includes(r.reason)))).sort((a, b) => b.ts - a.ts);
    const unit = { day: "hour", month: "day", year: "month", total: "month" }[T.earn], R = { starter: "Starter", payout: "Session payout", bonus: "Rating bonus", bounty_payout: "Bounty payout", bounty_hold: "Bounty escrow", bounty_refund: "Bounty refund", hold: "Hold", release: "Release", platform_fee: "Fee", reschedule_fee: "Reschedule fee", delay_fee: "Delay fee" };
    return head("Earnings", "Everything you earned from mentoring, built from your credit ledger.") +
      `<div class="stats">${[["Available balance", bal("me") + " credits", "SUM of your ledger rows"], ["In escrow for you", escrowIn() + " credits", "Paid when sessions complete"], ["Lifetime earned", life + " credits", "Sessions + bounties + bonuses"]].map(s => `<div class="card stat"><div><small>${s[0]}</small><b>${s[1]}</b><em>${s[2]}</em></div></div>`).join("")}</div>
      <section class="card pad"><div class="row" style="justify-content:space-between"><h2>${icon("bar")} Credits earned</h2><div class="tabs" role="tablist">${PERIODS.map(([k, l]) => `<button role="tab" aria-selected="${T.earn === k}" class="btn sm ${T.earn === k ? "" : "ghost"}" data-act="period" data-id="${k}">${l}</button>`).join("")}</div></div>
      <div class="sumrow"><div><small>${sr.cumulative ? "Total earned" : "Earned in period"}</small><b>${sr.total}</b></div><div><small>Payouts</small><b>${sr.count}</b></div><div><small>Average per payout</small><b>${sr.avg.toFixed(1)}</b></div><div><small>Best ${unit}</small><b>${sr.best.v}</b><em>${esc(sr.best.tip)}</em></div></div>
      <div class="chartbox" id="cbox">${chartSVG(sr)}<div class="tip" hidden></div></div>
      <div class="row"><span class="chip">Sessions ${sr.by.payout}</span><span class="chip o">Bounties ${sr.by.bounty_payout}</span><span class="chip g">Bonuses ${sr.by.bonus}</span><span class="mut" style="margin-left:auto">${sr.cumulative ? "Line shows your running total." : "Orange bar is the best " + unit + "."}</span></div></section>
      <section class="sec"><div class="sec-head"><h2>${icon("book")} Credit ledger</h2><select class="in" data-chg="lf" aria-label="Filter ledger"><option value="all" ${T.lf === "all" ? "selected" : ""}>All movements</option><option value="earn" ${T.lf === "earn" ? "selected" : ""}>Earnings only</option><option value="other" ${T.lf === "other" ? "selected" : ""}>Escrow and other</option></select></div>
      <div class="card" style="overflow-x:auto"><table><tr><th>When</th><th>Details</th><th>Type</th><th>Credits</th></tr>${rows.slice(0, 60).map(l => `<tr><td>${new Date(l.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}, ${clock(l.ts)}</td><td>${esc(l.note)}</td><td><span class="chip ${EARN.includes(l.reason) ? "g" : "n"}">${R[l.reason] || l.reason}</span></td><td class="${l.delta > 0 ? "pos" : "neg"}">${l.delta > 0 ? "+" : ""}${l.delta}</td></tr>`).join("")}</table></div><p class="mut">Showing ${Math.min(60, rows.length)} of ${rows.length} rows. Balance is always the sum of these rows.</p></section>`;
  },
  reports() { return head("Student Reports", "After a student scores low on a quiz, the AI writes a report about their weak topics. Teach them in your next lesson, or send a short video.") + `<div id="qrpage" style="display:flex;flex-direction:column;gap:14px"></div>`; },
  reviews() {
    const rs = S.ratings.slice().sort((a, b) => b.ts - a.ts), avg = avgRating(), dist = [5, 4, 3, 2, 1].map(n => [n, rs.filter(r => r.stars === n).length]);
    const by = {}; rs.forEach(r => { const t = (sess(r.sid)?.tags || ["Other"])[0]; (by[t] = by[t] || []).push(r.stars); });
    const top = Object.entries(by).filter(([, v]) => v.length >= 2).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length, v.length]).sort((a, b) => b[1] - a[1]);
    return head("Reviews", "What learners say after each session.") +
      `<div class="grid2"><div class="card pad"><div class="big">${avg.toFixed(1)}<small>/ 5</small></div><div class="st">${stars(Math.round(avg))}</div><p class="mut">${rs.length} reviews</p>${dist.map(([n, c]) => `<div class="dist"><span>${n}★</span><div class="bar"><i style="width:${rs.length ? c / rs.length * 100 : 0}%"></i></div><span>${c}</span></div>`).join("")}</div>
      <div class="card pad"><h2>${icon("bolt")} Growth insights</h2><p class="mut">Computed from your own sessions.</p>${top.length ? `<p><b>Strongest topic:</b> ${esc(top[0][0])} (${top[0][1].toFixed(1)}★ over ${top[0][2]} sessions)</p>${top.length > 1 ? `<p><b>Room to grow:</b> ${esc(top[top.length - 1][0])} (${top[top.length - 1][1].toFixed(1)}★)</p>` : ""}` : "<p>Complete a few more sessions to see insights.</p>"}<p class="mut">Tip: a 5★ rating earns +1 bonus credit (max ${BONUS_CAP} per day).</p></div></div>` +
      rs.slice(0, 30).map(r => `<div class="card pad"><div class="row"><span class="st">${stars(r.stars)}</span><b>${esc(user(r.learnerId).name)}</b><span class="mut" style="margin-left:auto">${ago(r.ts)} · ${esc(sess(r.sid)?.title || "")}</span></div><p style="margin:0">“${esc(r.comment)}”</p></div>`).join("");
  },
  leaderboard() {
    return head("Leaderboard", "Top helpers by sessions given, then rating.") + leaderboard().map((r, i) => `<div class="card lb ${r.me ? "you" : ""}"><span class="n">#${i + 1}</span>${r.me ? avMe(36) : av(r.name, 36)}<span class="nm">${esc(r.name)}${r.me ? " (You)" : ""} <span class="chip n">Level ${r.level} ${levelName(r.level)}</span></span><span class="chip">${r.sessions} sessions</span><span class="chip o">${r.rating.toFixed(1)}★</span></div>`).join("") + `<p class="mut">Top 3 earn the "Top helper" badge.</p>`;
  },
  profile() {
    const m = S.me, owned = m.skills.map(s => s.n), expN = ["", "Beginner", "Intermediate", "Expert"];
    return head("Profile", "Your public mentor profile, level, badges and settings.") +
      `<div class="card pad"><div class="row">${avMe(56)}<div><b style="font-size:18px">${esc(m.name)}</b><div class="mut">Level ${m.level} ${levelName(m.level)} · ${given().length} sessions · ${avgRating().toFixed(1)}★ · ${bal("me")} credits</div></div></div>
      <label class="f">Name<input class="in" id="pn" value="${esc(m.name)}" maxlength="40"></label><label class="f">Bio<textarea class="in" id="pb" rows="2" maxlength="200">${esc(m.bio)}</textarea></label><div><button class="btn" data-act="savebio">Save profile</button></div></div>
      ${profileExtras()}
      <div class="card pad"><b>Languages you teach in</b><div class="tags">${LANGS.map(l => `<button class="chip pick ${m.langs.includes(l) ? "on" : ""}" aria-pressed="${m.langs.includes(l)}" data-act="lang" data-id="${l}">${l}</button>`).join("")}</div>
      <b>Skills and experience</b><div class="tags">${m.skills.map((s, i) => `<span class="chip">${esc(s.n)} · <select class="mini" data-chg="exp" data-i="${i}" aria-label="Experience for ${esc(s.n)}">${[1, 2, 3].map(n => `<option value="${n}" ${s.exp === n ? "selected" : ""}>${expN[n]}</option>`).join("")}</select> <button class="ib" aria-label="Remove ${esc(s.n)}" data-act="rmskill" data-id="${i}">${icon("x", 13)}</button></span>`).join("")}</div>
      <div class="row"><select class="in" id="ps">${VOCAB.filter(v => !owned.includes(v)).map(v => `<option>${v}</option>`).join("")}</select><button class="btn ghost" data-act="addskill">Add skill</button></div></div>
      <div class="card pad"><b>Badges</b><div class="tags">${S.badges.map(b => `<span class="chip o">${icon(BADGE_INFO[b.key][2], 13)} ${BADGE_INFO[b.key][0]}</span>`).join("") || '<span class="mut">None yet</span>'}</div>
      <b>Level rules</b><table><tr><th>Level</th><th>Name</th><th>Requirement</th></tr>${LEVELS.map(([l, n]) => `<tr class="${l === m.level ? "hl" : ""}"><td>${l}</td><td>${n}</td><td>${l === 1 ? "Default" : LEVEL_RULES[l][0] + " sessions given" + (LEVEL_RULES[l][1] ? " and rating " + LEVEL_RULES[l][1] + "+" : "")}</td></tr>`).join("")}</table></div>
      <div class="card pad"><b>Settings</b><div class="row"><button class="btn ${S.settings.aiOn ? "" : "ghost"}" data-act="toggleai">AI assistant: ${S.settings.aiOn ? "ON" : "OFF"}</button><span class="mut">Turn off to see that booking and settlement still work. Notes then show "unavailable, retry".</span></div>
      <div class="row"><label class="f" style="flex-direction:row;align-items:center;gap:10px">Simulated platform fee <select class="in" data-chg="fee">${[0, 10, 20].map(p => `<option value="${p}" ${S.settings.feePct === p ? "selected" : ""}>${p}%${p ? " (simulated)" : " (off)"}</option>`).join("")}</select></label><span class="mut">Credits only. No real money is ever moved.</span></div>
</div>`;
  },
  room(id) {
    const s = sess(id); if (!s || !["accepted", "in_progress"].includes(s.status)) return empty("Room not available", "This session is not open. Go back to My Sessions.");
    if (s.status === "accepted") { Sess.start(id); save(); }
    const l = user(s.learnerId);
    return `<div class="phead"><div><h1 class="pt">${esc(s.title)}</h1><p class="mut">Live room with ${esc(l.name)} · ${esc(s.tags.join(", "))} · ${s.minutes} min planned</p></div>
      <div class="row"><span class="chip o timer" title="Session timer">${icon("clock", 14)} <span data-timer="${s.startTs}">00:00</span> / ${s.minutes}:00</span><span class="chip" id="presence"></span></div></div>
      <div class="card pad notice">${icon("bolt", 16)} Session content is used by the AI assistant to create notes after the session (processed locally in your browser). Only you and the learner can join this room.</div>
      <div id="endreq" class="live" hidden><span class="pulse"></span><div class="info"><b>${esc(l.name)} asked to end the session</b><p>End it to release payment and generate notes.</p></div><button class="btn orange" data-act="endsession" data-id="${s.id}">End session</button></div>
      <div class="room-grid"><div class="card pad"><div class="row"><b>${icon("code", 18)} Shared code editor</b><span class="mut" style="margin-left:auto" id="syncst">Synced</span></div><textarea id="ed" class="code" spellcheck="false" aria-label="Shared code editor"></textarea></div>
      <div class="card pad chat"><b>${icon("help", 18)} Room chat</b><div id="msgs" class="msgs" aria-live="polite"></div><div class="row"><input class="in" id="chat" placeholder="Type a message and press Enter" aria-label="Chat message"><button class="btn" data-act="send" aria-label="Send">${icon("send", 16)}</button></div></div></div>
      <div class="card pad"><label class="f">Private mentor notes (used for the AI summary)<textarea class="in" id="mn" rows="2" placeholder="What did the learner struggle with? What should they practise?">${esc(s.mentorNotes || "")}</textarea></label>
      <div class="row"><button class="btn orange" data-act="endsession" data-id="${s.id}">End session &amp; confirm completion</button><button class="btn ghost" data-act="learnerwin" data-id="${s.id}">${icon("users", 18)} Open learner window</button><button class="btn ghost" data-act="jitsi" data-id="${s.id}">${icon("video", 18)} Open virtual classroom</button><button class="btn ghost" data-act="go" data-id="sessions">Leave room</button></div></div>`;
  }
};
function threadCard(c) {
  const known = Object.values(S.users).find(u => u.email && String(u.email).toLowerCase() === c.student), name = (c.msgs.find(m => m.from === "student") || {}).name || (known && known.name) || c.student, id = esc(c.id);
  return `<div class="card pad thread"><div class="row">${av(name, 40)}<div style="flex:1"><b>${esc(name)}</b><div class="mut">${esc(c.student)}</div></div>${c.unread ? `<span class="chip o">${c.unread} new</span>` : ""}</div>
    <div class="msgs" style="height:200px">${c.msgs.map(m => `<div class="msg ${m.from === "tutor" ? "mine" : ""}"><small>${m.from === "tutor" ? "You" : esc(m.name)} · ${clock(m.ts)}</small>${esc(m.text)}</div>`).join("")}</div>
    <div class="row"><input class="in" data-reply="${id}" maxlength="500" placeholder="Write a reply and press Enter" aria-label="Reply to ${esc(name)}"><button class="btn" data-act="msgsend" data-id="${id}">${icon("send", 16)} Reply</button></div></div>`;
}
function instantBanner(r, full) {
  const l = user(r.learnerId), left = Math.max(0, Math.ceil((r.expiresTs - Date.now()) / 1000));
  return `<div class="live"><span class="pulse"></span><div class="info"><b>${esc(l.name)} needs instant help · ${esc(r.tags.join(", "))}</b><p>${r.minutes} min · ${r.credits} credit${r.credits > 1 ? "s" : ""} · “${esc(r.title)}” · <span data-cd="${r.expiresTs}">${left}s</span> left</p><div class="bar cd"><i data-cdbar="${r.createdTs},${r.expiresTs}" style="width:${Math.max(0, left / 60 * 100)}%"></i></div>${full && r.brief ? briefHTML({ brief: r.brief, problem: r.problem, id: r.id }) : ""}</div>
    <button class="btn orange" data-act="claim" data-id="${r.id}">${icon("bolt", 18)} Take it now</button><button class="btn ghost" data-act="skip" data-id="${r.id}">Skip</button></div>`;
}
function drawBoard() {
  const q = T.bq.trim().toLowerCase(), f = b => (T.board === "mine" ? b.answers.some(a => a.helperId === "me") : b.status === T.board) && (!q || (b.title + b.tags.join(" ")).toLowerCase().includes(q)) && (T.bt === "Any" || b.tags.includes(T.bt));
  const l = S.bounties.filter(f); $("#blist").innerHTML = l.length ? l.map(boardCard).join("") : empty("Nothing here", T.board === "open" ? "No open doubts match your filters." : "No bounties in this tab yet.");
}
const AFTER = { reports() { if (window.UTSQuiz) UTSQuiz.tutorPage($("#qrpage"), n => { quizUnread = n; renderNav(); }); }, messages() { UTSShared.tutorThreads(MYMAIL).forEach(c => { if (c.unread) UTSShared.chatSeen(c.id, "tutor"); }); renderNav(); $$(".msgs").forEach(m => m.scrollTop = m.scrollHeight); }, board: drawBoard, profile: loadMyVideo, earnings() { const b = $("#cbox"); if (b) bindChart(b, series(T.earn)); }, room(id) { if (sess(id)) initRoom(id, "tutor"); } };

/* ---------- live room (works in two browser windows through localStorage events) ---------- */
function drawRoom(id, who) {
  const r = roomGet(id), ed = $("#ed"), ml = $("#msgs"); if (!ed || !ml) return;
  if (ed.value !== r.code) { const a = ed.selectionStart, b = ed.selectionEnd, foc = document.activeElement === ed; ed.value = r.code; if (foc) ed.setSelectionRange(Math.min(a, r.code.length), Math.min(b, r.code.length)); }
  const key = r.msgs.length + "|" + who; if (ml.dataset.k !== key) { ml.dataset.k = key; ml.innerHTML = r.msgs.map(m => `<div class="msg ${m.from === who ? "mine" : ""}"><small>${esc(m.name)} · ${clock(m.ts)}</small>${esc(m.body)}</div>`).join(""); ml.scrollTop = ml.scrollHeight; }
  const pr = $("#presence"), s = sess(id), other = who === "tutor" ? "learner" : "tutor", live = Date.now() - (r.pres[other] || 0) < 6000;
  if (pr) pr.innerHTML = `<i class="dot ${live || who === "tutor" ? "on" : ""}"></i> ${esc(user(s.learnerId).name)} ${who === "tutor" ? (live ? "online (second window)" : "online (simulated)") : ""}`;
  const er = $("#endreq"); if (er) er.hidden = !r.endReq;
}
function initRoom(id, who) {
  const s = sess(id); if (!s) return;
  if (who === "tutor") { const x = Sess.start(id); if (!x.ok) { toast(x.err); return go("sessions"); } save(); }
  roomSet(id, r => { if (!r.code) r.code = CODE[s.tags[0]] || "// shared editor\n"; if (!r.msgs.length) r.msgs.push({ from: "learner", name: user(s.learnerId).name, body: s.problem, ts: Date.now() }); });
  drawRoom(id, who);
  const ed = $("#ed"), ch = $("#chat"), beat = () => { roomSet(id, r => { r.pres[who] = Date.now(); }); drawRoom(id, who); };
  ed.addEventListener("input", () => { roomSet(id, r => { r.code = ed.value; r.codeBy = who; }); });
  ch.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(id, who); });
  const mn = $("#mn"); if (mn) mn.addEventListener("input", () => { s.mentorNotes = mn.value; save(); });
  window._roomStore = e => { if (e.key === ROOM(id)) drawRoom(id, who); }; window.removeEventListener("storage", window._roomOld || (() => { })); window._roomOld = window._roomStore; window.addEventListener("storage", window._roomStore);
  beat(); roomTimers.push(setInterval(beat, 2000));
}
function sendChat(id, who) {
  const el = $("#chat"), v = el.value.trim(); if (!v) return; el.value = ""; const s = sess(id);
  roomSet(id, r => r.msgs.push({ from: who, name: who === "tutor" ? S.me.name : user(s.learnerId).name, body: v.slice(0, 500), ts: Date.now() })); drawRoom(id, who);
  if (who === "tutor") setTimeout(() => {                                       // simulated learner answers only when no real learner window is open
    const r = roomGet(id); if (Date.now() - (r.pres.learner || 0) < 6000) return;
    const n = r.msgs.filter(m => m.from === "learner").length; roomSet(id, x => x.msgs.push({ from: "learner", name: user(s.learnerId).name, body: SIM_REPLIES[n % SIM_REPLIES.length], ts: Date.now() })); drawRoom(id, "tutor");
  }, 1800);
}

/* ---------- actions ---------- */
const ok = r => { if (!r.ok) toast(r.err); return r.ok; };
const ACT = {
  go: id => go(id),
  theme: id => { UTSTheme.set(id); renderNav(); },
  msgsend: id => {
    const sel = () => document.querySelector(`input[data-reply="${CSS.escape(id)}"]`), inp = sel(), v = inp ? inp.value.trim() : ""; if (!v) return;
    UTSShared.chatSend(id, "tutor", S.me.name, v); go("messages", null, true); const again = sel(); if (again) again.focus();
  },
  newmsg: () => {
    const to = ($("#nmTo") || {}).value, v = (($("#nmText") || {}).value || "").trim();
    if (!to) return toast("Choose a learner first."); if (!v) return toast("Write a message first.");
    if (!UTSShared.chatSend(UTSShared.threadId(to, MYMAIL), "tutor", S.me.name, v)) return toast("Could not send. Try again.");
    toast("Message sent."); go("messages", null, true);
  },
  rvstar: (id, b) => { RV.stars = +b.dataset.r; document.querySelectorAll('[data-act="rvstar"]').forEach(x => x.classList.toggle("orange", +x.dataset.r <= RV.stars)); },
  rvsend: () => {
    if (!RV.stars) return toast("Choose 1 to 5 stars first.");
    const text = (($("#rvtext") || {}).value || "").trim().slice(0, 400), s = S.sessions.find(x => x.ref === RV.ref);
    if (s) s.learnerReview = { stars: RV.stars, text, ts: Date.now() };
    save(); if (RV.peer) UTSShared.notify(RV.peer, { kind: "learner_review", title: `${S.me.name} reviewed you`, body: `${RV.stars}★${text ? " - " + text : ""}` });
    closeModal(); toast("Thanks! Your review was sent.");
  },
  photogal: () => $("#f-photo-gal").click(),
  photocam: () => { if (window.matchMedia && matchMedia("(pointer: coarse)").matches) $("#f-photo-cam").click(); else openWebcam(); },
  camshot: () => { const v = $("#camv"); if (!v || !v.videoWidth) return toast("Camera is still starting..."); const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    const u = c.toDataURL("image/jpeg", .9); closeModal(); UTSShared.squarePhoto(u).then(setPhoto).catch(e => toast(e.message)); },
  photodel: () => { if (saveProf({ photo: "" })) { toast("Photo removed"); go("profile", null, true); } },
  addqual: () => {
    const d = $("#q-deg").value.trim(), i = $("#q-inst").value.trim(), y = Math.round(+$("#q-yr").value), cy = new Date().getFullYear(), q = (myProf().qualifications || []).slice();
    if (d.length < 2) return toast("Enter your degree or certificate"); if (i.length < 2) return toast("Enter the institute name");
    if (!(y >= 1980 && y <= cy + 6)) return toast(`Enter a year between 1980 and ${cy + 6}`); if (q.length >= 6) return toast("You can list up to 6 qualifications");
    q.push({ deg: d.slice(0, 80), inst: i.slice(0, 80), year: y }); if (saveProf({ qualifications: q })) { toast("Qualification added"); go("profile", null, true); }
  },
  rmqual: id => { const q = (myProf().qualifications || []).slice(); q.splice(+id, 1); if (saveProf({ qualifications: q })) go("profile", null, true); },
  vidgal: () => $("#f-vid-gal").click(),
  vidcam: () => $("#f-vid-cam").click(),
  viddel: () => UTSShared.removeVideo(MYMAIL).then(() => { toast("Intro video removed"); go("profile", null, true); }),
  resched: id => {
    const s = sess(id), l = user(s.learnerId), fee = reschedFee(s.credits), def = new Date(s.slotTs + HR), dd = startOfDay(def.getTime()), p2 = n => String(n).padStart(2, "0");
    const days = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const t = startOfDay(Date.now()) + i * DAY; return `<option value="${t}" ${t === dd ? "selected" : ""}>${dayName(t)}</option>`; }).join("");
    modal(`<h3>Reschedule session</h3><p class="mut">“${esc(s.title)}” with ${esc(l.name)}<br>Now: <b>${when(s.slotTs)}</b></p>
      <label class="f">New day<select class="in" id="rs-d">${days}</select></label><label class="f">New time<input class="in" id="rs-t" type="time" value="${p2(def.getHours())}:${p2(def.getMinutes())}"></label>
      <label class="f">Reason<select class="in" id="rs-r"><option>Urgent work</option><option>Health or family emergency</option><option>Internet or power problem</option><option>Student asked for a new time</option><option>Other</option></select></label>
      <label class="f">Message to ${esc(l.name.split(" ")[0])} (optional)<textarea class="in" id="rs-m" rows="2" maxlength="160" placeholder="e.g. Sorry, a college event came up."></textarea></label>
      <label class="chk"><input type="checkbox" id="rs-ok"> I talked with ${esc(l.name.split(" ")[0])} and they agree to the new time.</label>
      <p class="note-fee">Reschedule fee: ${RESCHEDULE_PCT}% of ${s.credits} credits = <b>${fee} credits</b>, deducted from your balance. ${esc(l.name.split(" ")[0])} gets a notification.</p>
      <div class="row"><button class="btn ghost" data-act="close">Keep current time</button><button class="btn orange" data-act="reschedyes" data-id="${id}">Confirm new time</button></div>`);
  },
  reschedyes: id => {
    const s = sess(id); if (!s) return; if (!$("#rs-ok").checked) return toast("Please confirm you talked with the student");
    const day = new Date(+$("#rs-d").value), [h, m] = ($("#rs-t").value || "").split(":").map(Number); if (isNaN(h)) return toast("Pick the new time");
    day.setHours(h, m, 0, 0); const ts = day.getTime(), reason = $("#rs-r").value, msg = $("#rs-m").value.trim(), l = user(s.learnerId);
    const r = Sess.reschedule(id, ts, reason); if (!ok(r)) return; save(); closeModal();
    const sent = UTSShared.notify(learnerEmail(s.learnerId), { kind: "reschedule", title: "Lecture rescheduled", mentor: S.me.name, sessionTitle: s.title, ref: s.ref, fromTs: r.from, toTs: ts, reason,
      body: `${S.me.name} moved “${s.title}” from ${when(r.from)} to ${when(ts)}. Reason: ${reason}.${msg ? " Message: " + msg : ""}` });
    toast(`Moved to ${when(ts)}. Fee ${r.fee} credits. ${sent ? l.name.split(" ")[0] + " was notified." : "This learner is not connected to an account."}`); go("sessions");
  },
  online: () => { S.me.online = !S.me.online; if (S.me.online) S.spawn.inst = Math.min(S.spawn.inst, Date.now() + 4000); save(); toast(S.me.online ? "You are visible for Instant Help" : "You are offline"); go(page, arg, true); },
  togglebrief: id => { T.openReq[id] = !T.openReq[id]; go(page, arg, true); },
  genbrief: id => { const s = sess(id); AI.call(() => AI.analyze(s.problem)).then(a => { s.brief = { problem_summary: a.problem_summary, already_tried: a.already_tried, topics_to_prepare: a.topics_to_prepare }; save(); toast("AI brief ready"); go(page, arg, true); }).catch(e => toast("AI unavailable: " + e.message)); toast("Generating brief..."); },
  accept: id => { const s = sess(id); if (ok(Sess.accept(id))) { save(); toast(`Accepted. ${s.credits} credits held in escrow`); go(page, arg, true); } else { save(); } },
  decline: id => { if (ok(Sess.decline(id))) { save(); toast("Request declined. Nothing was charged."); go(page, arg, true); } },
  stab: id => { T.sess = id; go("sessions"); },
  cancel: id => modal(`<h3>Cancel this session?</h3><p class="mut">The learner's held credits are released back to them.</p><div class="row"><button class="btn ghost" data-act="close">Keep it</button><button class="btn orange" data-act="cancelyes" data-id="${id}">Cancel session</button></div>`),
  cancelyes: id => { closeModal(); if (ok(Sess.cancel(id))) { save(); toast("Cancelled. Credits released to the learner."); go("sessions"); } },
  noshow: id => { if (ok(Sess.noShow(id))) { save(); toast("Marked no-show. Credits released to the learner."); go("sessions"); } },
  join: id => go("room", id),
  endsession: id => { const s = sess(id); modal(`<h3>End session and confirm completion?</h3><p class="mut">${s.credits} credits move from escrow to you, once. The AI will write session notes.</p><div class="row"><button class="btn ghost" data-act="close">Not yet</button><button class="btn orange" data-act="endyes" data-id="${id}">Confirm completion</button></div>`); },
  endyes: id => { const s = sess(id), n = $("#mn") ? $("#mn").value : s.mentorNotes; closeModal(); if (ok(Sess.complete(id, n))) { save(); toast(`Session completed. +${s.credits - (S.settings.feePct ? Math.ceil(s.credits * S.settings.feePct / 100) : 0)} credits paid to you`); T.sess = "past"; go("sessions"); } },
  send: () => sendChat(arg, "tutor"),
  learnerwin: id => { const s = sess(id); window.open(location.pathname + `?room=${id}&as=learner&t=${s.token}`, "_blank"); toast("Learner window opened. Type in either window to see live sync."); },
  jitsi: id => {
    const s = sess(id); if (!s) return toast("Session not found.");
    const roomKey = "uptoskill_virtual_room:" + s.token;
    let room = "";
    try { room = localStorage.getItem(roomKey) || ""; } catch { }
    if (!/^uts-[A-Za-z0-9_-]{8,100}$/.test(room)) {
      room = "uts-" + crypto.randomUUID().replace(/-/g, "");
      try { localStorage.setItem(roomKey, room); } catch { }
    }
    const api = window.UPTOSKILL_API_URL || "";
    const url = "../virtual-room.html?room=" + encodeURIComponent(room) + "&name=" + encodeURIComponent(S.me.name) + "&role=tutor&ref=" + encodeURIComponent(s.ref || "") + "&peer=" + encodeURIComponent(learnerEmail(s.learnerId) || "") + "&pn=" + encodeURIComponent(user(s.learnerId).name || "") + (api ? "&api=" + encodeURIComponent(api) : "");
    window.open(url, "_blank", "noopener");
  },
  notes: id => {
    const s = sess(id), n = S.notes[id], rt = S.ratings.find(r => r.sid === id);
    const body = !n || n.status === "pending" ? "<p>Generating notes...</p>" : n.status === "unavailable" ? `<p><b>Summary unavailable.</b> ${esc(n.err || "")}</p><button class="btn" data-act="retrynotes" data-id="${id}">${icon("repeat", 16)} Retry</button>` :
      `<p><b>Solved:</b> ${esc(n.solved)}</p><b>Takeaways</b><ul>${n.takeaways.map(t => `<li>${esc(t)}</li>`).join("")}</ul><b>Next steps</b><ul>${n.next_steps.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
    modal(`<h3>${esc(s.title)}</h3><p class="mut">with ${esc(user(s.learnerId).name)}${rt ? " · rated " + rt.stars + "★" : ""} · AI notes</p>${body}${n && n.finalCode ? `<b>Final code</b><pre class="pre">${esc(n.finalCode)}</pre>` : ""}<div class="row"><button class="btn ghost" data-act="close">Close</button></div>`, 1);
  },
  retrynotes: id => { const s = sess(id); closeModal(); s.noteStatus = "pending"; save(); toast("Retrying..."); genNotes(s); setTimeout(() => ACT.notes(id), 1000); },
  claim: id => {
    const r = S.instant.find(x => x.id == id); if (!r) return;
    if (!S.me.online) return toast("Go online to claim requests");
    if (r.status !== "open") { toast("Too late, " + (r.by || "someone else") + " got it"); return go(page, arg, true); }   // atomic: open -> claimed
    const l = user(r.learnerId); if (bal(l.id) < r.credits) return toast("Learner has too few credits");
    r.status = "taken";
    const s = { id: S.nid++, type: "instant", status: "accepted", learnerId: r.learnerId, title: r.title, problem: r.problem, tags: r.tags, difficulty: 1, minutes: r.minutes, credits: r.credits, brief: r.brief, slotTs: Date.now(), reqTs: r.createdTs, token: uid() };
    S.sessions.push(s); addLedger(s.learnerId, -s.credits, "hold", "session", s.id, "Held: " + s.title); save(); toast("You got it! Opening the room..."); go("room", s.id);
  },
  skip: id => { const r = S.instant.find(x => x.id == id); r.skipped = true; save(); toast("Skipped. Another mentor may take it."); go(page, arg, true); },
  btab: id => { T.board = id; go("board"); },
  answer: id => { const v = ($("#ba" + id) || {}).value; if (!v || v.trim().length < 8) return toast("Write a helpful answer (at least 8 characters)"); const b = S.bounties.find(x => x.id == id);
    b.answers.push({ id: S.nid++, helperId: "me", body: v.trim().slice(0, 600), accepted: false, ts: Date.now() }); b.acceptAt = Date.now() + 8000 + Math.random() * 4000; b.pickMine = Math.random() < .75; save(); toast("Answer submitted. Waiting for the author to choose."); drawBoard(); },
  acceptans: (id, el) => { const b = S.bounties.find(x => x.id == id); if (ok(acceptBounty(b, +el.dataset.r))) { save(); toast("Accepted. Reward paid to the helper."); go("board"); } },
  period: id => { T.earn = id; go("earnings", null, true); },
  addslot: () => { const o = [0, 1, 2, 3, 4, 5, 6].map(i => { const t = startOfDay(Date.now()) + i * DAY; return `<option value="${t}">${dayName(t)}</option>`; }).join("");
    modal(`<h3>Add availability slot</h3><label class="f">Day<select class="in" id="sd">${o}</select></label><label class="f">From<input class="in" id="s1" type="time" value="18:00"></label><label class="f">To<input class="in" id="s2" type="time" value="19:00"></label><div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="slotyes">Add slot</button></div>`); },
  slotyes: () => { const d = +$("#sd").value, [h1, m1] = $("#s1").value.split(":").map(Number), [h2, m2] = $("#s2").value.split(":").map(Number); if (isNaN(h1) || isNaN(h2)) return toast("Pick start and end time");
    const a = d + (h1 + m1 / 60) * HR, b = d + (h2 + m2 / 60) * HR; if (b <= a) return toast("End time must be after start time"); if (a < Date.now()) return toast("That slot is in the past");
    if (S.slots.some(x => a < x.end && b > x.start)) return toast("This overlaps another slot"); S.slots.push({ id: S.nid++, start: a, end: b, booked: false, sid: null }); save(); closeModal(); toast("Slot added"); go("availability"); },
  rmslot: id => { const x = S.slots.find(q => q.id == id); if (x.booked) return toast("Booked slots cannot be removed"); S.slots = S.slots.filter(q => q.id != id); save(); go("availability"); },
  savebio: () => { const n = $("#pn").value.trim(); if (!n) return toast("Name cannot be empty"); S.me.name = n; S.me.bio = $("#pb").value.trim(); save(); toast("Profile saved"); go("profile"); },
  lang: id => { const l = S.me.langs; if (l.includes(id)) { if (l.length === 1) return toast("Keep at least one language"); S.me.langs = l.filter(x => x !== id); } else l.push(id); save(); go("profile", null, true); },
  addskill: () => { const v = ($("#ps") || {}).value; if (!v) return toast("You already have every skill"); S.me.skills.push({ n: v, exp: 1 }); save(); go("profile", null, true); },
  rmskill: id => { if (S.me.skills.length === 1) return toast("Keep at least one skill"); S.me.skills.splice(+id, 1); save(); go("profile", null, true); },
  toggleai: () => { S.settings.aiOn = !S.settings.aiOn; save(); toast("AI assistant " + (S.settings.aiOn ? "on" : "off")); go("profile", null, true); },
  logout: () => UTSAuth.logout("login.html"),
  close: closeModal
};
const CHG = {
  bt: v => { T.bt = v; drawBoard(); }, lf: v => { T.lf = v; go("earnings", null, true); },
  fee: v => { S.settings.feePct = +v; save(); toast(+v ? "Simulated fee " + v + "% (demo only)" : "Fee off"); }, exp: (v, el) => { S.me.skills[+el.dataset.i].exp = +v; save(); }
};
const INP = { bq: v => { T.bq = v; drawBoard(); } };
document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (!b) { if (e.target.id === "modal") closeModal(); return; } if (b.disabled) return; ACT[b.dataset.act](b.dataset.id, b); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); if ((e.key === "Enter" || e.key === " ") && e.target.matches("a[data-act]")) { e.preventDefault(); e.target.click(); } });
document.addEventListener("change", e => { const f = e.target.dataset.file; if (f) return FILE[f](e.target); const k = e.target.dataset.chg; if (k) CHG[k](e.target.value, e.target); });
document.addEventListener("input", e => { const k = e.target.dataset.inp; if (k) INP[k](e.target.value); });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.reply) ACT.msgsend(e.target.dataset.reply); });

/* ---------- learner window (second browser window for the live room) ---------- */
function learnerView(id, token) {
  const s = sess(id); document.body.classList.add("learner");
  if (!s || s.token !== token) { $("#main").innerHTML = `<div class="empty"><b>Access denied</b>Only the two participants of this session can join the room.</div>`; return; }
  const l = user(s.learnerId);
  $("#nav").remove(); $(".app").style.display = "block";
  $("#main").innerHTML = `<div class="phead"><div><img class="logo-full" src="../assets/logo.png" alt="UpToSkill" style="height:30px"><h1 class="pt" style="margin-top:10px">${esc(s.title)}</h1><p class="mut">Learner view: ${esc(l.name)} · mentor ${esc(S.me.name)}</p></div><div class="row"><span class="chip" id="presence"></span></div></div>
    <div class="card pad notice">${icon("bolt", 16)} Session content is used by the AI assistant to create notes after the session (processed locally in your browser). This window simulates the learner.</div>
    <div class="room-grid"><div class="card pad"><b>${icon("code", 18)} Shared code editor</b><textarea id="ed" class="code" spellcheck="false" aria-label="Shared code editor"></textarea></div>
    <div class="card pad chat"><b>${icon("help", 18)} Room chat</b><div id="msgs" class="msgs"></div><div class="row"><input class="in" id="chat" placeholder="Type a message and press Enter"><button class="btn" id="lsend" aria-label="Send">${icon("send", 16)}</button></div></div></div>
    <div class="row"><button class="btn ghost" id="lend">Ask mentor to end the session</button></div>`;
  initRoom(id, "learner"); $("#lsend").onclick = () => sendChat(id, "learner"); $("#lend").onclick = () => { roomSet(id, r => r.endReq = true); toast("Mentor notified"); };
}

/* ---------- messages from the student app: new booking, cancellation, delay, rating ---------- */
function checkStudentNotifs() {
  if (learnerMode || !window.UTSShared) return;
  const un = UTSShared.tutorNotifications(MYMAIL).filter(n => !n.read); if (!un.length) return;
  S.handled = S.handled || [];
  const lines = [], byRef = (ref, ...st) => S.sessions.find(x => x.ref === ref && (!st.length || st.includes(x.status)));
  un.forEach(n => {
    if (S.handled.includes(n.id)) return; S.handled.push(n.id);
    const name = n.studentName || "A learner";
    if (n.kind === "booking") {
      if (byRef(n.ref)) return;                                                     // already created from this request
      const lid = ensureLearner(n.fromStudent, name, n.level, n.langs), ai = AI.analyze(n.problem || n.title), slot = n.slotId ? S.slots.find(x => x.id === n.slotId) : null;
      const s = { id: S.nid++, ref: n.ref, prepaid: true, type: n.instant ? "instant" : "booked", status: "requested", learnerId: lid, title: n.title, problem: n.problem || n.title, tags: ai.tags, difficulty: ai.difficulty,
        minutes: n.minutes, credits: n.credits, brief: { problem_summary: ai.problem_summary, already_tried: ai.already_tried, topics_to_prepare: ai.topics_to_prepare },
        slotId: slot && !slot.booked ? slot.id : null, slotTs: n.ts, reqTs: Date.now(), token: uid() };
      S.sessions.push(s);
      lines.push([`New session request from ${name}`, `“${n.title}” · ${n.minutes} min · ${n.credits} credits · ${n.instant ? "wants help now" : when(n.ts)}. Open My Sessions to accept or decline.`]);
    } else if (n.kind === "cancel") {
      const s = byRef(n.ref, "requested", "accepted"); if (!s) return;
      s.status = "cancelled"; s.endTs = Date.now(); const sl = S.slots.find(x => x.sid === s.id); if (sl) { sl.booked = false; sl.sid = null; }
      lines.push([`${name} cancelled a session`, `“${s.title}” was cancelled by the learner. Their credits were refunded.`]);
    } else if (n.kind === "rating") {
      const s = byRef(n.ref); if (!s) return;
      s.pendingRating = n.stars; if (n.comment) s.pendingComment = n.comment;                                                     // counted when the session is completed
      if (s.status === "completed") s.rateAt = Date.now() + 200;
    } else if (n.kind === "delay") {
      const s = byRef(n.ref, "requested", "accepted") || S.sessions.filter(x => x.status === "accepted" && learnerEmail(x.learnerId) === n.fromStudent).sort((a, b) => Math.abs(a.slotTs - n.fromTs) - Math.abs(b.slotTs - n.fromTs))[0];
      if (!s) { lines.push([`${name} delayed a lecture`, `“${n.sessionTitle}” was moved to ${when(n.toTs)}. Reason: ${n.reason}. It is not an open session in your list, so nothing changed here.`]); return; }
      const old = s.slotTs, sl = S.slots.find(x => x.sid === s.id); if (sl) { sl.booked = false; sl.sid = null; }
      s.slotId = null; s.slotTs = n.toTs; s.delays = (s.delays || []).concat([{ from: old, to: n.toTs, fee: n.fee || 0, reason: n.reason, ts: n.ts }]);
      if (n.fee) addLedger("me", n.fee, "delay_fee", "delay", n.id, `Delay fee: ${name} (${s.title})`);
      lines.push([`${name} delayed a lecture`, `“${s.title}” moved from ${when(old)} to ${when(n.toTs)}. Reason: ${n.reason}.${n.note ? " Message: " + n.note : ""}${n.fee ? ` You received ${n.fee} credits as delay fee.` : ""}`]);
    }
  });
  save(); UTSShared.markTutorRead(MYMAIL);
  if (!lines.length) return;
  if (page !== "room") go(page, arg, true);
  modal(`<h3>Notifications</h3><div style="display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow:auto">${lines.map(l => `<div class="rep"><b>${esc(l[0])}</b><br>${esc(l[1])}</div>`).join("")}</div><div class="row"><button class="btn" data-act="close">Got it</button></div>`);
}
window.addEventListener("storage", e => { if (e.key === "uts_tnotifs") checkStudentNotifs(); if (e.key === "uts_chats") { if (page === "messages" && !(document.activeElement && document.activeElement.dataset.reply)) go("messages", null, true); else renderNav(); } });
window.addEventListener("focus", checkStudentNotifs);
window.addEventListener("uts-theme", renderNav);

/* ---------- boot ---------- */
function tick() {
  const ch = sweep();
  $$("[data-cd]").forEach(e => e.textContent = Math.max(0, Math.ceil((+e.dataset.cd - Date.now()) / 1000)) + "s");
  $$("[data-cdbar]").forEach(e => { const [a, b] = e.dataset.cdbar.split(",").map(Number); e.style.width = Math.max(0, (b - Date.now()) / (b - a) * 100) + "%"; });
  $$("[data-timer]").forEach(e => { const t = Math.max(0, Math.floor((Date.now() - +e.dataset.timer) / 1000)); e.textContent = String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); });
  while (QUEUE.length) toast(QUEUE.shift());
  if (ch) refresh();
}
window.addEventListener("uts-change", () => { if (!learnerMode) refresh(); });
(function boot() {
  const q = new URLSearchParams(location.search);
  if (q.get("as") === "learner" && q.get("room")) { learnerMode = true; return learnerView(q.get("room"), q.get("t")); }
  const h = location.hash.slice(1).split("/"), start = PAGES[h[0]] && h[0] !== "room" ? h[0] : "dashboard"; syncPublic(); go(start); checkStudentNotifs();
  if (window.UTSQuiz) UTSQuiz.pollTutor(n => { const more = n > quizUnread; quizUnread = n; renderNav(); if (more && page !== "reports") toast(`New AI report about a student (${n} unread). Open Student Reports.`); });
  setInterval(tick, 1000);
})();

/* ---------- review the learner after a classroom (the room sends you back with ?review=1&ref=...&peer=...) ---------- */
const RV = { stars: 0, ref: "", peer: "" };
(function openReviewFromUrl() {
  const q = new URLSearchParams(location.search); if (q.get("review") !== "1") return;
  history.replaceState(null, "", location.pathname);
  const ref = q.get("ref") || "", peer = q.get("peer") || "", pn = q.get("pn") || "your learner";
  if (!S.sessions.some(x => x.ref === ref)) return;
  Object.assign(RV, { stars: 0, ref, peer });
  modal(`<h3>How was the session with ${esc(pn)}?</h3><p class="mut">Rate your learner. Your review is sent to them right away.</p>
    <div class="row">${[1, 2, 3, 4, 5].map(n => `<button class="btn ghost" data-act="rvstar" data-r="${n}">${n}★</button>`).join("")}</div>
    <label class="f" style="margin-top:10px">Comment (optional)<textarea class="in" id="rvtext" maxlength="400" rows="3" placeholder="How well did they prepare? What should they practise?"></textarea></label>
    <div class="row"><button class="btn ghost" data-act="close">Skip</button><button class="btn" data-act="rvsend">Send review</button></div>`);
})();
