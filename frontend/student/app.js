/* UpToSkill dummy app - all data is saved in your browser (localStorage). Profile > Reset demo data to start over. */
const $ = s => document.querySelector(s);
const KEY = "uptoskill_v1:" + (window.UTS ? UTS.email : "guest"); // one saved profile per account
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ymd = o => new Date(Date.now() + o * 864e5).toISOString().slice(0, 10);

const BADGES = [
  { days: 1, name: "Starter", icon: "flame" }, { days: 7, name: "Week", icon: "bolt" },
  { days: 15, name: "Focus", icon: "star" }, { days: 30, name: "Pro", icon: "medal" }, { days: 50, name: "Legend", icon: "trophy" }
];
const TUTORS = [
  { ini: "NS", name: "Neha Sharma",  level: 3, levelName: "Mentor", rating: 4.8, skills: ["React", "JavaScript"],         langs: ["English", "Hindi"], slots: ["today"],             color: "#1D4ED8" },
  { ini: "VJ", name: "Vikram Joshi", level: 4, levelName: "Guide",  rating: 4.7, skills: ["React", "Node"],               langs: ["English"],          slots: ["tomorrow"],          color: "#C2570C" },
  { ini: "IR", name: "Ishita Rao",   level: 2, levelName: "Helper", rating: 4.6, skills: ["JavaScript", "Python", "DSA"], langs: ["English", "Hindi"], slots: ["today", "tomorrow"], color: "#0B2A6F" },
  { ini: "KM", name: "Karan Mehta",  level: 4, levelName: "Guide",  rating: 4.9, skills: ["SQL", "Node"],                 langs: ["English", "Hindi"], slots: ["tomorrow"],          color: "#1D4ED8" },
  { ini: "SQ", name: "Sana Qureshi", level: 3, levelName: "Mentor", rating: 4.5, skills: ["Python", "DSA"],               langs: ["English", "Hindi"], slots: ["today"],             color: "#0B2A6F" }
];
const COST = { 15: 2, 30: 4, 60: 6 };
const SLOT = { today: ["Today", "6:00 PM"], tomorrow: ["Tomorrow", "11:00 AM"] };

function seed() {
  return {
    user: { name: window.UTS ? UTS.name : "Riya Verma", level: 1, levelName: "Newcomer", skills: ["React", "SQL"], mentor: false },
    credits: 8, done: 4, mins: 120, nid: 10,
    streak: { days: 1, goal: 50, last: ymd(-1) },
    sessions: [
      { id: 1, day: "Today", time: "4:30 PM", title: "Fix useEffect infinite loop", mentor: "Neha Sharma", skill: "React", level: 3, min: 30, credits: 4, status: "accepted" },
      { id: 2, day: "Tomorrow", time: "11:00 AM", title: "SQL joins returning duplicates", mentor: "Karan Mehta", skill: "SQL", level: 4, min: 15, credits: 2, status: "requested" },
      { id: 3, day: "Yesterday", time: "5:00 PM", title: "Python dictionaries basics", mentor: "Ishita Rao", skill: "Python", level: 2, min: 30, credits: 4, status: "completed", rating: 5 }
    ],
    ledger: [
      { d: "Yesterday", t: "Welcome credits", a: 18 },
      { d: "Yesterday", t: "Session with Ishita Rao", a: -4 },
      { d: "Today", t: "Held: Fix useEffect infinite loop", a: -4 },
      { d: "Today", t: "Held: SQL joins returning duplicates", a: -2 }
    ].reverse(),
    doubts: [
      { id: 1, title: "Why does my map() return undefined?", tag: "JavaScript", by: "Aman K.", solved: false, replies: [{ by: "Ishita Rao", text: "Check that you return inside the callback." }] },
      { id: 2, title: "Difference between INNER and LEFT JOIN?", tag: "SQL", by: "Pooja S.", solved: true, replies: [] }
    ],
    incoming: [
      { id: 1, student: "Rohit D.", topic: "Node.js express routing", min: 30, credits: 4 },
      { id: 2, student: "Meera P.", topic: "React props vs state", min: 15, credits: 2 },
      { id: 3, student: "Arjun T.", topic: "SQL group by", min: 60, credits: 6 }
    ]
  };
}
let S = JSON.parse(localStorage.getItem(KEY) || "null") || seed();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const log = (t, a) => S.ledger.unshift({ d: "Today", t, a });
const escrow = () => S.sessions.filter(s => s.status === "requested" || s.status === "accepted").reduce((n, s) => n + s.credits, 0);
const F = { q: "", lang: "Any", slot: "Any" };
let page = "dashboard", tab = "upcoming";

function toast(m) { const t = $("#toast"); t.textContent = m; t.className = "on"; clearTimeout(toast.h); toast.h = setTimeout(() => t.className = "", 2400); }
function modal(h) { $("#modal").innerHTML = `<div class="mod">${h}</div>`; $("#modal").hidden = false; }
function closeModal() { $("#modal").hidden = true; }

/* ---------- icons ---------- */
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  help: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4"/><circle cx="16" cy="14" r="1"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
  book: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h12"/>',
  flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-10z"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>'
};
const icon = (n, s = 20) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${P[n]}</svg>`;

/* ---------- matching ---------- */
function matchTutors({ topic, language, slot }) {
  const q = topic.trim().toLowerCase();
  return TUTORS.filter(t => t.level > S.user.level).map(t => {
    const skill = !q || t.skills.some(s => s.toLowerCase().includes(q)) ? 40 : 0;
    const lang = language === "Any" || t.langs.includes(language) ? 15 : 0;
    const time = slot === "Any" || t.slots.includes(slot.toLowerCase()) ? 20 : 0;
    const rate = Math.round(t.rating / 5 * 15), gap = Math.min(t.level - S.user.level, 3) * 3 + 1;
    const why = [skill && "matches your topic", lang && "speaks your language", time && "is free in your time slot"].filter(Boolean);
    return { ...t, skill, score: skill + lang + time + rate + gap, why: why.length ? "Good fit: " + why.join(", ") + "." : "Lower match for your filters." };
  }).filter(t => !q || t.skill > 0).sort((a, b) => b.score - a.score);
}

/* ---------- sidebar ---------- */
function streakHTML() {
  const k = S.streak, pct = Math.min(100, Math.round(k.days / k.goal * 100)), next = BADGES.find(b => k.days < b.days);
  const left = next ? next.days - k.days : 0;
  return `<div class="streak"><div class="ring" style="--p:${pct}"><div>${icon("flame", 18)}<b>${k.days}/${k.goal}</b><small>days</small></div></div>
    <h4>Day streak</h4><p>Learn once a day to keep it going.</p>
    <div class="sb">${BADGES.map(b => `<div class="${k.days >= b.days ? "done" : ""}" title="${b.name}"><span>${icon(b.icon, 14)}</span>${b.name}<em>${b.days}d</em></div>`).join("")}</div>
    <p style="margin-top:10px">${next ? `${left} more day${left > 1 ? "s" : ""} to unlock ${next.name}` : "All streak badges unlocked!"}</p></div>`;
}
function menu() {
  const m = [["dashboard", "Dashboard", "grid"], ["find", "Find Mentors", "search"], ["sessions", "My Sessions", "cal"], ["instant", "Instant Help", "bolt"],
    ["board", "Doubt Board", "help"], ["ledger", "Credits & Ledger", "wallet"], ["leaderboard", "Leaderboard", "trophy"], ["profile", "Profile", "user"]];
  if (S.user.mentor) m.splice(3, 0, ["requests", `Session Requests (${S.incoming.length})`, "inbox"]);
  return m;
}
function renderNav() {
  $("#nav").innerHTML = `<div class="logo"><img class="logo-full" src="../assets/logo.png" alt="UpToSkill"><img class="logo-icon" src="../assets/logo-icon.png" alt="UpToSkill"></div>` +
    menu().map(([id, l, i]) => `<button class="nav-item ${id === page ? "on" : ""}" data-act="go" data-id="${id}">${icon(i)}<span>${l}</span></button>`).join("") +
    `<div class="side">${streakHTML()}<div class="me"><b>${esc(S.user.name)}</b>${S.user.mentor ? "Mentor mode" : "Student"} · Level ${S.user.level} ${S.user.levelName}</div><button class="btn ghost" data-act="logout">Log out</button></div>`;
}
function go(id) {
  page = id; renderNav();
  $("#main").innerHTML = PAGES[id]();
  if (id === "dashboard" || id === "find") updateTutors();
  window.scrollTo(0, 0);
}

/* ---------- shared pieces ---------- */
const head = (t, s) => `<div><h1 class="pt">${t}</h1><p class="mut">${s}</p></div>`;
const searchHTML = () => `<div class="card search"><label>${icon("search")}<input id="q" value="${esc(F.q)}" placeholder="Search tutors by topic, e.g. React, SQL, Python" aria-label="Search tutors by topic"></label>
  <select id="lang">${["Any", "English", "Hindi"].map(o => `<option ${F.lang === o ? "selected" : ""}>${o}</option>`).join("")}</select>
  <select id="slot">${["Any", "Today", "Tomorrow"].map(o => `<option ${F.slot === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
const tutorsHTML = () => `<section class="sec"><div class="sec-head"><h2>${icon("user")} <span id="rtitle" style="font-size:18px;color:var(--ink)"></span></h2>
  <span>Updates as you type · mentors above your level</span></div><div id="tutors" class="grid"></div></section>`;
function updateTutors() {
  F.q = $("#q").value; F.lang = $("#lang").value; F.slot = $("#slot").value;
  const list = matchTutors({ topic: F.q, language: F.lang, slot: F.slot });
  $("#rtitle").textContent = F.q.trim() ? `Recommended tutors for “${F.q.trim()}”` : "Recommended tutors";
  $("#tutors").innerHTML = list.length ? list.map(t => `<div class="card tutor">
    <div class="top"><span class="av" style="background:${t.color}">${t.ini}</span><div style="flex:1"><div class="name">${t.name}</div><div class="lv">Level ${t.level} ${t.levelName} · ${t.rating} rating</div></div><span class="chip o">Match ${t.score}/100</span></div>
    <div class="tags">${t.skills.map(s => `<span class="chip">${s}</span>`).join("")}</div><p class="why">${t.why}</p>
    <div class="foot"><span>From 2 credits</span><button class="btn" data-act="book" data-id="${t.ini}">Book session</button></div></div>`).join("")
    : `<div class="empty" style="grid-column:1/-1">No tutors match these filters. Try a different topic, language or time.</div>`;
}
function sessionHTML(l) {
  const st = { accepted: ["g", "Accepted"], requested: ["n", "Waiting for mentor"], completed: ["g", "Completed" + (l.rating ? ` · ${l.rating}★` : "")], cancelled: ["n", "Cancelled"] }[l.status];
  const btn = l.status === "accepted" ? `<button class="btn" data-act="join" data-id="${l.id}">${icon("video", 18)} Join room</button><button class="btn ghost" data-act="cancel" data-id="${l.id}">Cancel</button>`
    : l.status === "requested" ? `<button class="btn ghost" data-act="cancel" data-id="${l.id}">Cancel request</button>` : "";
  return `<div class="card lec"><div class="when"><small>${l.day}</small><b>${l.time}</b></div><div class="info"><div class="t">${esc(l.title)}</div>
    <div class="w">with ${l.mentor} · ${l.skill} · Level ${l.level}</div>
    <div class="m"><span class="chip">${l.min} min</span><span class="chip o">${l.credits} credits${l.status === "completed" ? " paid" : l.status === "cancelled" ? " refunded" : " held"}</span><span class="chip ${st[0]}">${st[1]}</span></div></div>${btn}</div>`;
}
const upcoming = () => S.sessions.filter(s => s.status === "requested" || s.status === "accepted");

/* ---------- pages ---------- */
const PAGES = {
  dashboard() {
    const up = upcoming(), got = BADGES.filter(b => S.streak.days >= b.days), stats = [
      ["wallet", "Available credits", S.credits, `${escrow()} held in escrow`, 1], ["book", "Sessions taken", S.done, "Total", 0],
      ["clock", "Learning time", +(S.mins / 60).toFixed(1) + "h", "Total", 0], ["star", "Badges", got.length, got.length ? got[got.length - 1].name : "None yet", 1]];
    return `${searchHTML()}
    <section class="hero"><div><h1>Welcome back, ${esc(S.user.name.split(" ")[0])}</h1><p>Stuck on something? Find a peer mentor in seconds.</p></div>
      <div class="right"><span class="credits">${icon("wallet", 18)} ${S.credits} credits</span><button class="btn orange" data-act="go" data-id="instant">${icon("bolt", 18)} Instant Help</button></div></section>
    <div class="stats">${stats.map(s => `<div class="card stat"><span class="ic ${s[4] ? "o" : ""}">${icon(s[0], 22)}</span><div><small>${s[1]}</small><b>${s[2]}</b><em>${s[3]}</em></div></div>`).join("")}</div>
    <section class="sec"><div class="sec-head"><h2>${icon("cal")} Upcoming lectures</h2><a data-act="go" data-id="sessions">View all</a></div>
      ${up.length ? up.map(sessionHTML).join("") : `<div class="empty"><b>No upcoming lectures</b>Pick a tutor below to book your first session.</div>`}</section>${tutorsHTML()}`;
  },
  find() { return head("Find Mentors", "Search peer mentors above your level and book a session.") + searchHTML() + tutorsHTML(); },
  sessions() {
    const list = S.sessions.filter(s => tab === "upcoming" ? s.status === "requested" || s.status === "accepted" : s.status === "completed" || s.status === "cancelled");
    return head("My Sessions", "Join, cancel or review your sessions.") +
      `<div class="tabs">${["upcoming", "past"].map(t => `<button class="btn ${tab === t ? "" : "ghost"}" data-act="tab" data-id="${t}">${t === "upcoming" ? "Upcoming" : "Past"}</button>`).join("")}</div>` +
      (list.length ? list.slice().reverse().map(sessionHTML).join("") : `<div class="empty"><b>Nothing here yet</b>Book a mentor from Find Mentors or use Instant Help.</div>`);
  },
  instant() {
    return head("Instant Help", "Get matched with a mentor right now. 15 minutes costs 2 credits.") +
      `<div class="card pad"><label class="f">What are you stuck on?<input class="in" id="it" placeholder="e.g. React, SQL, Python"></label>
      <label class="f">Language<select class="in" id="il"><option>Any</option><option>English</option><option>Hindi</option></select></label>
      <div class="row"><button class="btn orange" data-act="instantgo">${icon("bolt", 18)} Find mentor now</button><span class="mut">You have ${S.credits} credits</span></div></div>`;
  },
  board() {
    return head("Doubt Board", "Post a doubt and let mentors and peers answer.") +
      `<div class="card pad"><div class="row"><input class="in" id="dt" placeholder="Describe your doubt"><select class="in" id="dg" style="flex:none">${["React", "JavaScript", "SQL", "Python", "Node", "DSA"].map(s => `<option>${s}</option>`).join("")}</select>
      <button class="btn" data-act="post">Post doubt</button></div></div>` +
      S.doubts.map(d => `<div class="card pad"><div class="row"><b style="flex:1">${esc(d.title)}</b><span class="chip">${d.tag}</span><span class="chip ${d.solved ? "g" : "o"}">${d.solved ? "Solved" : "Open"}</span></div>
        <p class="mut">Asked by ${esc(d.by)}</p>${d.replies.map(r => `<div class="rep"><b>${esc(r.by)}:</b> ${esc(r.text)}</div>`).join("")}
        <div class="row"><input class="in" id="r${d.id}" placeholder="Write a reply"><button class="btn ghost" data-act="reply" data-id="${d.id}">Reply</button>
        ${d.solved ? "" : `<button class="btn ghost" data-act="solve" data-id="${d.id}">Mark solved</button>`}</div></div>`).join("");
  },
  ledger() {
    const tot = S.ledger.filter(l => l.a > 0 && /Earned/.test(l.t)).reduce((n, l) => n + l.a, 0);
    return head("Credits & Ledger", "Every credit movement, in one place.") +
      `<div class="stats">${[["Available", S.credits], ["In escrow", escrow()], ["Earned as mentor", tot]].map(s => `<div class="card stat"><div><small>${s[0]}</small><b>${s[1]}</b></div></div>`).join("")}</div>
      <div><button class="btn orange" data-act="buy">${icon("wallet", 18)} Add 5 demo credits</button></div>
      <div class="card" style="overflow-x:auto"><table><tr><th>When</th><th>Details</th><th>Credits</th></tr>${S.ledger.map(l => `<tr><td>${l.d}</td><td>${esc(l.t)}</td><td class="${l.a > 0 ? "pos" : l.a < 0 ? "neg" : ""}">${l.a > 0 ? "+" : ""}${l.a || "released"}</td></tr>`).join("")}</table></div>`;
  },
  leaderboard() {
    const pts = S.done * 10 + S.streak.days * 5;
    const rows = [["Ananya Gupta", 420], ["Dev Malhotra", 365], ["Kavya Nair", 310], ["Aman Khan", 205], [S.user.name + " (You)", pts, 1], ["Pooja Singh", 40]].sort((a, b) => b[1] - a[1]);
    return head("Leaderboard", "Points: 10 per session + 5 per streak day.") +
      rows.map((r, i) => `<div class="card lb ${r[2] ? "you" : ""}"><span class="n">#${i + 1}</span><span class="nm">${esc(r[0])}</span><span class="chip ${r[2] ? "o" : ""}">${r[1]} pts</span></div>`).join("");
  },
  profile() {
    return head("Profile", "Edit your details and switch between student and mentor mode.") +
      `<div class="card pad"><label class="f">Name<input class="in" id="pn" value="${esc(S.user.name)}"></label><div><button class="btn" data-act="savename">Save name</button></div>
      <b>Skills</b><div class="tags">${S.user.skills.map((s, i) => `<span class="chip">${esc(s)} <a data-act="rmskill" data-id="${i}" style="cursor:pointer">✕</a></span>`).join("") || '<span class="mut">No skills yet</span>'}</div>
      <div class="row"><input class="in" id="ps" placeholder="Add a skill"><button class="btn ghost" data-act="addskill">Add skill</button></div></div>
      <div class="card pad"><b>Mentor mode</b><p class="mut">Switch on to see incoming session requests and earn credits.</p>
      <div><button class="btn ${S.user.mentor ? "orange" : ""}" data-act="mentor">${S.user.mentor ? "Mentor mode is ON - turn off" : "Turn on mentor mode"}</button></div></div>
      <div><button class="btn ghost" data-act="reset">Reset demo data</button></div>`;
  },
  requests() {
    return head("Session Requests", "Accept a request to earn its credits.") +
      (S.incoming.length ? S.incoming.map(r => `<div class="card lec"><div class="info"><div class="t">${esc(r.topic)}</div><div class="w">from ${esc(r.student)}</div>
        <div class="m"><span class="chip">${r.min} min</span><span class="chip o">${r.credits} credits</span></div></div>
        <button class="btn" data-act="accept" data-id="${r.id}">Accept</button><button class="btn ghost" data-act="decline" data-id="${r.id}">Decline</button></div>`).join("")
        : `<div class="empty"><b>No pending requests</b>New requests will show up here.</div>`);
  }
};

/* ---------- actions ---------- */
function autoAccept(id) {
  setTimeout(() => {
    const s = S.sessions.find(x => x.id === id);
    if (s && s.status === "requested") { s.status = "accepted"; save(); toast(`${s.mentor} accepted your request`); if (page === "dashboard" || page === "sessions") go(page); }
  }, 5000);
}
function addSession(t, title, day, time, min, status) {
  const cost = COST[min];
  if (S.credits < cost) { toast(`Not enough credits (need ${cost})`); return null; }
  S.credits -= cost; log(`Held: ${title}`, -cost);
  const s = { id: S.nid++, day, time, title, mentor: t.name, skill: t.skills[0], level: t.level, min, credits: cost, status };
  S.sessions.push(s); save(); return s;
}
function tick() { const k = S.streak, t = ymd(0); if (k.last === t) return; k.days = k.last === ymd(-1) ? k.days + 1 : 1; k.last = t; }

const ACT = {
  go: id => go(id),
  tab: id => { tab = id; go("sessions"); },
  book: id => {
    const t = TUTORS.find(x => x.ini === id);
    modal(`<h3>Book ${t.name}</h3><p class="mut">Level ${t.level} ${t.levelName} · ${t.skills.join(", ")}</p>
      <label class="f">What do you need help with?<input class="in" id="bt" value="${esc(F.q)}" placeholder="e.g. Fix useEffect loop"></label>
      <label class="f">Time slot<select class="in" id="bs">${t.slots.map(s => `<option value="${s}">${SLOT[s].join(" · ")}</option>`).join("")}</select></label>
      <label class="f">Duration<select class="in" id="bd">${Object.entries(COST).map(([m, c]) => `<option value="${m}">${m} min · ${c} credits</option>`).join("")}</select></label>
      <div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="confirm" data-id="${id}">Confirm booking</button></div>`);
  },
  confirm: id => {
    const t = TUTORS.find(x => x.ini === id), [day, time] = SLOT[$("#bs").value];
    const s = addSession(t, $("#bt").value.trim() || `Help with ${t.skills[0]}`, day, time, +$("#bd").value, "requested");
    if (!s) return;
    closeModal(); autoAccept(s.id); tab = "upcoming"; toast("Request sent. Credits held in escrow."); go("sessions");
  },
  close: closeModal,
  cancel: id => {
    const s = S.sessions.find(x => x.id == id); s.status = "cancelled"; S.credits += s.credits; log(`Refund: ${s.title}`, s.credits);
    save(); toast("Cancelled. Credits refunded."); go(page);
  },
  join: id => {
    const s = S.sessions.find(x => x.id == id);
    modal(`<h3>${esc(s.title)}</h3><div class="room">${icon("video", 40)}<p>Live room with ${s.mentor} (demo)</p></div>
      <p class="mut">End the session and rate your mentor:</p>
      <div class="row">${[1, 2, 3, 4, 5].map(n => `<button class="btn ghost" data-act="finish" data-id="${id}" data-r="${n}">${n}★</button>`).join("")}</div>`);
  },
  finish: (id, b) => {
    const s = S.sessions.find(x => x.id == id); s.status = "completed"; s.rating = +b.dataset.r;
    S.done++; S.mins += s.min; tick(); log(`Session with ${s.mentor}`, 0); save(); closeModal();
    toast(`Session complete! Streak: ${S.streak.days} day${S.streak.days > 1 ? "s" : ""}`); tab = "past"; go("sessions");
  },
  instantgo: () => {
    const topic = $("#it").value.trim(); if (!topic) return toast("Tell us what you are stuck on");
    const list = matchTutors({ topic, language: $("#il").value, slot: "Any" });
    if (!list.length) return toast("No mentor found for that topic. Try another.");
    const s = addSession(list[0], `Instant help: ${topic}`, "Now", "Now", 15, "accepted");
    if (s) { toast(`${list[0].name} is ready for you`); tab = "upcoming"; go("sessions"); }
  },
  post: () => {
    const t = $("#dt").value.trim(); if (!t) return toast("Write your doubt first");
    S.doubts.unshift({ id: S.nid++, title: t, tag: $("#dg").value, by: S.user.name, solved: false, replies: [] }); save(); toast("Doubt posted"); go("board");
  },
  reply: id => {
    const v = $("#r" + id).value.trim(); if (!v) return;
    S.doubts.find(d => d.id == id).replies.push({ by: S.user.name, text: v }); save(); go("board");
  },
  solve: id => { S.doubts.find(d => d.id == id).solved = true; save(); toast("Marked as solved"); go("board"); },
  buy: () => { S.credits += 5; log("Added demo credits", 5); save(); toast("+5 credits"); go("ledger"); },
  savename: () => { const v = $("#pn").value.trim(); if (v) { S.user.name = v; save(); toast("Name saved"); go("profile"); } },
  addskill: () => { const v = $("#ps").value.trim(); if (v) { S.user.skills.push(v); save(); go("profile"); } },
  rmskill: id => { S.user.skills.splice(+id, 1); save(); go("profile"); },
  mentor: () => { S.user.mentor = !S.user.mentor; save(); toast(S.user.mentor ? "Mentor mode on" : "Mentor mode off"); go("profile"); },
  accept: id => {
    const r = S.incoming.find(x => x.id == id); S.credits += r.credits; log(`Earned: ${r.topic} (${r.student})`, r.credits);
    S.incoming = S.incoming.filter(x => x.id != id); save(); toast(`Accepted. +${r.credits} credits earned`); go("requests");
  },
  decline: id => { S.incoming = S.incoming.filter(x => x.id != id); save(); go("requests"); },
  logout: () => UTSAuth.logout("login.html"),
  reset: () => { if (confirm("Reset all demo data?")) { S = seed(); save(); toast("Demo data reset"); go("dashboard"); } }
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) { if (e.target.id === "modal") closeModal(); return; }
  ACT[b.dataset.act](b.dataset.id, b);
});
document.addEventListener("input", e => { if (["q", "lang", "slot"].includes(e.target.id)) updateTutors(); });

S.sessions.filter(s => s.status === "requested").forEach(s => autoAccept(s.id));
go("dashboard");
