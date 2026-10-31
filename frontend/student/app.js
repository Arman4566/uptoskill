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
  { ini: "NS", name: "Neha Sharma",  email: "tutor@demo.com", level: 3, levelName: "Mentor", rating: 4.8, reviews: 17, sessions: 17, yrs: 1.3, skills: ["React", "JavaScript"],         langs: ["English", "Hindi"], slots: ["today"],             color: "#1D4ED8",
    bio: "Final-year CS student. I love explaining React and SQL with small, runnable examples.", quals: [{ deg: "B.Tech Computer Science", inst: "Delhi Technological University", year: 2027 }] },
  { ini: "VJ", name: "Vikram Joshi", level: 4, levelName: "Guide",  rating: 4.7, reviews: 28, sessions: 31, yrs: 5, skills: ["React", "Node"],               langs: ["English"],          slots: ["tomorrow"],          color: "#C2570C",
    bio: "Backend engineer who mentors on Node and React. I debug step by step and explain why, not just what.", quals: [{ deg: "M.Sc Information Technology", inst: "IIIT Delhi", year: 2022 }] },
  { ini: "IR", name: "Ishita Rao",   level: 2, levelName: "Helper", rating: 4.6, reviews: 6,  sessions: 6,  yrs: 2, skills: ["JavaScript", "Python", "DSA"], langs: ["English", "Hindi"], slots: ["today", "tomorrow"], color: "#0B2A6F",
    bio: "Python and DSA coach. I focus on small habits that make code easier to read and debug.", quals: [{ deg: "B.Sc Computer Science", inst: "Miranda House, Delhi University", year: 2024 }] },
  { ini: "KM", name: "Karan Mehta",  level: 4, levelName: "Guide",  rating: 4.9, reviews: 25, sessions: 27, yrs: 6, skills: ["SQL", "Node"],                 langs: ["English", "Hindi"], slots: ["tomorrow"],          color: "#1D4ED8",
    bio: "Database engineer. Joins, indexes and query plans explained with real tables.", quals: [{ deg: "B.Tech Information Technology", inst: "NSUT, Delhi", year: 2020 }] },
  { ini: "SQ", name: "Sana Qureshi", level: 3, levelName: "Mentor", rating: 4.5, reviews: 11, sessions: 12, yrs: 3, skills: ["Python", "DSA"],               langs: ["English", "Hindi"], slots: ["today"],             color: "#0B2A6F",
    bio: "Python and DSA mentor. Patient with beginners and strong on interview problems.", quals: [{ deg: "MCA", inst: "Jamia Millia Islamia", year: 2023 }] }
];
const COST = { 15: 2, 30: 4, 45: 6 };                       // same lengths and prices as the server (backend/lib/price.js)
const SLOT = { today: ["Today", "6:00 PM"], tomorrow: ["Tomorrow", "11:00 AM"] };

/* ---------- small helpers ---------- */
const HR = 36e5, DAY = 864e5;
const round2 = n => Math.round(n * 100) / 100, fmt = n => +round2(+n).toFixed(2);
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
function parseWhen(day, time) {                               // "Today" + "4:30 PM" -> timestamp (only used for sessions saved before timestamps existed)
  if (day === "Now" || !time) return Date.now();
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (day === "Tomorrow" ? 1 : day === "Yesterday" ? -1 : 0));
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(time);
  if (m) d.setHours((+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0), +m[2], 0, 0);
  return d.getTime();
}
/* Delaying a lecture: 10% of the session credits when the mentor already accepted (paid to the mentor), max 2 delays, max 14 days ahead */
const DELAY = { pct: 10, max: 2, maxDays: 14 };
const delayFee = credits => round2(credits * DELAY.pct / 100);
const delayBlock = s => s.day === "Now" ? "Instant help cannot be delayed." : (s.delays || []).length >= DELAY.max ? `A lecture can be delayed at most ${DELAY.max} times.` : "";

/* tutor card data = static demo tutor + (for the live demo tutor) whatever she saved in her own app: photo, qualifications, video, rating, skills */
function tutorView(t) {
  const p = t.email && window.UTSShared ? UTSShared.getProfile(t.email) : null, pub = p && p.pub, v = { ...t, photo: "", video: null, live: !!t.email };
  if (p) {
    v.photo = p.photo || ""; v.video = p.video || null;
    if (p.qualifications && p.qualifications.length) v.quals = p.qualifications;
    if (pub) {
      v.rating = pub.rating || t.rating; v.reviews = pub.reviews ?? t.reviews; v.sessions = pub.sessions ?? t.sessions; if (pub.bio) v.bio = pub.bio;
      if (pub.skills && pub.skills.length) v.skills = pub.skills.map(s => s.n);
      if (pub.langs && pub.langs.length) v.langs = pub.langs;
      if (pub.level) { v.level = pub.level; v.levelName = pub.levelName; }
      if (pub.since) v.yrs = Math.max(.1, (Date.now() - pub.since) / (365.25 * DAY));
    }
  }
  return v;
}
const tutorByIni = ini => { const t = TUTORS.find(x => x.ini === ini); return t ? tutorView(t) : null; };
const tutorByName = n => { const t = TUTORS.find(x => x.name === n); return t ? tutorView(t) : null; };
const expText = y => y < 1 ? "Under 1 yr" : (Number.isInteger(y) ? y : y.toFixed(1)) + " yrs";
const tAv = (t, s = 48) => t.photo ? `<img class="av ph" src="${t.photo}" alt="${esc(t.name)}" style="width:${s}px;height:${s}px">` :
  `<span class="av" style="background:${t.color};width:${s}px;height:${s}px;font-size:${Math.round(s * .34)}px">${t.ini}</span>`;
const qualYear = x => x.year > new Date().getFullYear() ? "Pursuing, " + x.year : x.year;

/* Sample data is only for the demo login (student@demo.com). Every other account starts empty with the 10 welcome credits
   (the same starter amount the server gives on sign-up). */
const IS_DEMO = !window.UTS || UTS.email === "student@demo.com";
function freshSeed() {
  return {
    user: { name: window.UTS ? UTS.name : "Student", level: 1, levelName: "Newcomer", skills: [], mentor: false },
    credits: 10, done: 0, mins: 0, nid: 10,
    streak: { days: 0, goal: 50, last: null },
    sessions: [],
    ledger: [{ d: "Today", t: "Welcome credits", a: 10 }],
    doubts: [],
    incoming: [],
    fresh: true                                            // marks "created clean" so old demo copies saved by earlier versions are dropped
  };
}
function seed() {
  if (!IS_DEMO) return freshSeed();
  return {
    user: { name: window.UTS ? UTS.name : "Riya Verma", level: 1, levelName: "Newcomer", skills: ["React", "SQL"], mentor: false },
    credits: 8, done: 4, mins: 120, nid: 10,
    streak: { days: 1, goal: 50, last: ymd(-1) },
    sessions: [
      { id: 1, ts: parseWhen("Today", "4:30 PM"), day: "Today", time: "4:30 PM", title: "Fix useEffect infinite loop", mentor: "Neha Sharma", skill: "React", level: 3, min: 30, credits: 4, status: "accepted" },
      { id: 2, ts: parseWhen("Tomorrow", "11:00 AM"), day: "Tomorrow", time: "11:00 AM", title: "SQL joins returning duplicates", mentor: "Karan Mehta", skill: "SQL", level: 4, min: 15, credits: 2, status: "requested" },
      { id: 3, ts: parseWhen("Yesterday", "5:00 PM"), day: "Yesterday", time: "5:00 PM", title: "Python dictionaries basics", mentor: "Ishita Rao", skill: "Python", level: 2, min: 30, credits: 4, status: "completed", rating: 5 }
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
      { id: 3, student: "Arjun T.", topic: "SQL group by", min: 45, credits: 6 }
    ]
  };
}
let S = (() => {
  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { }
  if (saved && !IS_DEMO && !saved.fresh) saved = null;      // an earlier version copied the demo data into new accounts: start clean once
  return saved || seed();
})();
S.sessions.forEach(s => { if (!s.ts) s.ts = parseWhen(s.day, s.time); });      // older saved data
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const log = (t, a) => S.ledger.unshift({ d: "Today", t, a });
const escrow = () => S.sessions.filter(s => s.status === "requested" || s.status === "accepted").reduce((n, s) => n + s.credits, 0);
const F = { q: "", lang: "Any", slot: "Any" };
let page = "dashboard", tab = "upcoming";

function toast(m) { const t = $("#toast"); t.textContent = m; t.className = "on"; clearTimeout(toast.h); toast.h = setTimeout(() => t.className = "", 2400); }
function modal(h) { $("#modal").innerHTML = `<div class="mod">${h}</div>`; $("#modal").hidden = false; }
let chatWith = null;
function closeModal() { chatWith = null; $("#modal").hidden = true; }

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
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  cap: '<path d="M22 10L12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.3L4 21l1.5-4.5A8.4 8.4 0 1 1 21 11.5z"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>'
};
const icon = (n, s = 20) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${P[n]}</svg>`;

/* ---------- matching ---------- */
function matchTutors({ topic, language, slot }) {
  const q = topic.trim().toLowerCase();
  return TUTORS.map(tutorView).filter(t => t.level > S.user.level).map(t => {
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
    `<a class="nav-item" href="../lessons.html" title="Book real lessons with tutors (needs the server)">${icon("video")}<span>Live Lessons</span></a>` +
    `${UTSTheme.control()}<div class="side">${streakHTML()}<div class="me"><b>${esc(S.user.name)}</b>${S.user.mentor ? "Mentor mode" : "Student"} · Level ${S.user.level} ${S.user.levelName}</div><button class="btn ghost" data-act="logout">Log out</button></div>`;
}
function go(id) {
  Lift.closeNow();                                  // the page below is about to be redrawn
  page = id; if (window.UTSBack) UTSBack.note(id); renderNav();
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
  $("#tutors").innerHTML = list.length ? list.map(tutorCard).join("")
    : `<div class="empty" style="grid-column:1/-1">No tutors match these filters. Try a different topic, language or time.</div>`;
}
const qualLine = t => { const q = t.quals[0]; return q ? `${esc(q.deg)} · ${esc(q.inst)}${q.year > new Date().getFullYear() ? " (pursuing)" : ""}` : "Qualification not added yet"; };
function tutorCard(t) {
  return `<div class="card tutor" data-lift="tutor:${t.ini}">
    <div class="top">${tAv(t, 56)}<div class="nm"><div class="name">${esc(t.name)}</div><div class="lv">Level ${t.level} ${t.levelName}</div></div><span class="chip o" title="Match score ${t.score} out of 100">${t.score}% match</span></div>
    <div class="facts"><span class="rt">${icon("star", 14)} <b>${(+t.rating).toFixed(1)}</b> (${t.reviews})</span><span>${expText(t.yrs)} experience</span><span>${t.sessions} sessions</span></div>
    <div class="qual">${icon("cap", 16)}<span>${qualLine(t)}</span></div>
    <div class="tags">${t.skills.map(s => `<span class="chip">${esc(s)}</span>`).join("")}</div><p class="why">${t.why}</p>
    <div class="foot"><button class="btn ghost" data-act="chat" data-id="${t.ini}">${icon("chat", 18)} Chat</button><button class="btn ghost" data-act="lift">View profile</button><button class="btn" data-act="book" data-id="${t.ini}">Book</button></div></div>`;
}
function sessionHTML(l) {
  const st = { accepted: ["g", "Accepted"], requested: ["n", "Waiting for mentor"], completed: ["g", "Completed" + (l.rating ? ` · ${l.rating}★` : "")], cancelled: ["n", "Cancelled"] }[l.status];
  const open = l.status === "accepted" || l.status === "requested", can = open && !delayBlock(l), dl = (l.delays || []).length;
  const delayBtn = can ? `<button class="btn ghost" data-act="delay" data-id="${l.id}">${icon("clock", 18)} Delay</button>` : "";
  const btn = l.status === "accepted" ? `<button class="btn" data-act="join" data-id="${l.id}">${icon("video", 18)} Join room</button>${delayBtn}<button class="btn ghost" data-act="cancel" data-id="${l.id}">Cancel</button>`
    : l.status === "requested" ? `${delayBtn}<button class="btn ghost" data-act="cancel" data-id="${l.id}">Cancel request</button>` : "";
  return `<div class="card lec" ${open ? `data-lift="session:${l.id}"` : ""}><div class="when"><small>${l.day}</small><b>${l.time}</b></div><div class="info"><div class="t">${esc(l.title)}</div>
    <div class="w">with ${l.mentor} · ${l.skill} · Level ${l.level}</div>
    <div class="m"><span class="chip">${l.min} min</span><span class="chip o">${l.credits} credits${l.status === "completed" ? " paid" : l.status === "cancelled" ? " refunded" : " held"}</span><span class="chip ${st[0]}">${st[1]}</span>${dl ? `<span class="chip o">Delayed ×${dl}</span>` : ""}</div></div>${btn}${open ? `<button class="btn ghost" data-act="lift">Details</button>` : ""}</div>`;
}
const upcoming = () => S.sessions.filter(s => s.status === "requested" || s.status === "accepted");

/* ---------- pages ---------- */
const PAGES = {
  dashboard() {
    const up = upcoming(), got = BADGES.filter(b => S.streak.days >= b.days), stats = [
      ["wallet", "Available credits", fmt(S.credits), `${escrow()} held in escrow`, 1], ["book", "Sessions taken", S.done, "Total", 0],
      ["clock", "Learning time", +(S.mins / 60).toFixed(1) + "h", "Total", 0], ["star", "Badges", got.length, got.length ? got[got.length - 1].name : "None yet", 1]];
    return `${searchHTML()}
    <section class="hero"><div><h1>${S.sessions.length || S.done ? "Welcome back" : "Welcome"}, ${esc(S.user.name.split(" ")[0])}</h1><p>Stuck on something? Find a peer mentor in seconds.</p></div>
      <div class="right"><span class="credits">${icon("wallet", 18)} ${fmt(S.credits)} credits</span><button class="btn orange" data-act="go" data-id="instant">${icon("bolt", 18)} Instant Help</button></div></section>
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
      <div class="row"><button class="btn orange" data-act="instantgo">${icon("bolt", 18)} Find mentor now</button><span class="mut">You have ${fmt(S.credits)} credits</span></div></div>`;
  },
  board() {
    return head("Doubt Board", "Post a doubt and let mentors and peers answer.") +
      `<div class="card pad"><div class="row"><input class="in" id="dt" placeholder="Describe your doubt"><select class="in" id="dg" style="flex:none">${["React", "JavaScript", "SQL", "Python", "Node", "DSA"].map(s => `<option>${s}</option>`).join("")}</select>
      <button class="btn" data-act="post">Post doubt</button></div></div>` +
      (S.doubts.length ? "" : `<div class="empty"><b>No doubts yet</b>Post the first one above.</div>`) +
      S.doubts.map(d => `<div class="card pad"><div class="row"><b style="flex:1">${esc(d.title)}</b><span class="chip">${d.tag}</span><span class="chip ${d.solved ? "g" : "o"}">${d.solved ? "Solved" : "Open"}</span></div>
        <p class="mut">Asked by ${esc(d.by)}</p>${d.replies.map(r => `<div class="rep"><b>${esc(r.by)}:</b> ${esc(r.text)}</div>`).join("")}
        <div class="row"><input class="in" id="r${d.id}" placeholder="Write a reply"><button class="btn ghost" data-act="reply" data-id="${d.id}">Reply</button>
        ${d.solved ? "" : `<button class="btn ghost" data-act="solve" data-id="${d.id}">Mark solved</button>`}</div></div>`).join("");
  },
  ledger() {
    const tot = S.ledger.filter(l => l.a > 0 && /Earned/.test(l.t)).reduce((n, l) => n + l.a, 0);
    return head("Credits & Ledger", "Every credit movement, in one place.") +
      `<div class="stats">${[["Available", fmt(S.credits)], ["In escrow", escrow()], ["Earned as mentor", tot]].map(s => `<div class="card stat"><div><small>${s[0]}</small><b>${s[1]}</b></div></div>`).join("")}</div>
      ${IS_DEMO ? `<div><button class="btn orange" data-act="buy">${icon("wallet", 18)} Add 5 demo credits</button></div>` : ""}
      <div class="card" style="overflow-x:auto"><table><tr><th>When</th><th>Details</th><th>Credits</th></tr>${S.ledger.map(l => `<tr><td>${l.d}</td><td>${esc(l.t)}</td><td class="${l.a > 0 ? "pos" : l.a < 0 ? "neg" : ""}">${l.a > 0 ? "+" : ""}${l.a || "released"}</td></tr>`).join("")}</table></div>`;
  },
  leaderboard() {
    const pts = S.done * 10 + S.streak.days * 5;
    const rows = (IS_DEMO ? [["Ananya Gupta", 420], ["Dev Malhotra", 365], ["Kavya Nair", 310], ["Aman Khan", 205], ["Pooja Singh", 40]] : []).concat([[S.user.name + " (You)", pts, 1]]).sort((a, b) => b[1] - a[1]);
    return head("Leaderboard", "Points: 10 per session + 5 per streak day.") + (IS_DEMO ? "" : `<div class="empty"><b>Just you for now</b>Other learners show up here as they join and finish sessions.</div>`) +
      rows.map((r, i) => `<div class="card lb ${r[2] ? "you" : ""}"><span class="n">#${i + 1}</span><span class="nm">${esc(r[0])}</span><span class="chip ${r[2] ? "o" : ""}">${r[1]} pts</span></div>`).join("");
  },
  profile() {
    return head("Profile", "Edit your details and switch between student and mentor mode.") +
      `<div class="card pad"><label class="f">Name<input class="in" id="pn" value="${esc(S.user.name)}"></label><div><button class="btn" data-act="savename">Save name</button></div>
      <b>Skills</b><div class="tags">${S.user.skills.map((s, i) => `<span class="chip">${esc(s)} <a data-act="rmskill" data-id="${i}" style="cursor:pointer">✕</a></span>`).join("") || '<span class="mut">No skills yet</span>'}</div>
      <div class="row"><input class="in" id="ps" placeholder="Add a skill"><button class="btn ghost" data-act="addskill">Add skill</button></div></div>
      <div class="card pad"><b>Mentor mode</b><p class="mut">Switch on to see incoming session requests and earn credits.</p>
      <div><button class="btn ${S.user.mentor ? "orange" : ""}" data-act="mentor">${S.user.mentor ? "Mentor mode is ON - turn off" : "Turn on mentor mode"}</button></div></div>
      <div><button class="btn ghost" data-act="reset">${IS_DEMO ? "Reset demo data" : "Reset my data"}</button></div>`;
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
    if (s && s.status === "requested") { s.status = "accepted"; save(); toast(`${s.mentor} accepted your request`); rerender(); }
  }, 5000);
}
function rerender() { if (page !== "dashboard" && page !== "sessions") return; if (Lift.isOpen) Lift.afterClose(() => go(page)); else go(page); }   // never redraw under an open card
function addSession(t, title, day, time, min, status) {
  const cost = COST[min];
  if (S.credits < cost) { toast(`Not enough credits (need ${cost})`); return null; }
  S.credits = round2(S.credits - cost); log(`Held: ${title}`, -cost);
  const s = { id: S.nid++, ts: parseWhen(day, time), day, time, title, mentor: t.name, skill: t.skills[0], level: t.level, min, credits: cost, status };
  S.sessions.push(s); save(); return s;
}
function tick() { const k = S.streak, t = ymd(0); if (k.last === t) return; k.days = k.last === ymd(-1) ? k.days + 1 : 1; k.last = t; }

/* ---------- lifted cards: recommendation profile and lecture details ---------- */
let liftURL = "";
function liftCard(card) {
  if (!card || Lift.isOpen) return;
  const [kind, id] = card.dataset.lift.split(":"), html = kind === "tutor" ? tutorDetail(id) : sessionDetail(id); if (!html) return;
  Lift.open(card, html, {
    label: kind === "tutor" ? "Tutor profile" : "Lecture details",
    onShown: () => { if (kind === "tutor") loadProfileVideo(tutorByIni(id)); },
    onClose: () => { if (liftURL) { URL.revokeObjectURL(liftURL); liftURL = ""; } }
  });
}
const closeBtn = `<button class="ib lf-x" data-act="liftclose" aria-label="Close">${icon("x", 18)}</button>`;
function tutorDetail(ini) {
  const t = tutorByIni(ini); if (!t) return "";
  const v = t.video, first = t.name.split(" ")[0];
  return `<div class="lf-detail">${closeBtn}
    <div class="lf-head">${tAv(t, 84)}<div><h3>${esc(t.name)}</h3><div class="mut">Level ${t.level} ${t.levelName}</div><div class="rt big">${icon("star", 16)} <b>${(+t.rating).toFixed(1)}</b> <span class="mut">(${t.reviews} reviews)</span></div></div></div>
    <div class="lf-stats"><div><small>Experience</small><b>${expText(t.yrs)}</b></div><div><small>Sessions</small><b>${t.sessions}</b></div><div><small>Languages</small><b>${esc(t.langs.join(", "))}</b></div></div>
    <p class="bio">${esc(t.bio)}</p>
    <div><b>Qualifications</b>${t.quals.length ? t.quals.map(q => `<div class="qrow">${icon("cap", 18)}<div><b>${esc(q.deg)}</b><span>${esc(q.inst)} · ${qualYear(q)}</span></div></div>`).join("") : '<p class="mut">No qualification added yet.</p>'}</div>
    <div><b>Skills</b><div class="tags" style="margin-top:6px">${t.skills.map(s => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>
    <div><b>Intro video</b>${v ? `<div class="vwrap ${v.ratio === "9:16" ? "portrait" : "land"}"><video id="lfv" controls playsinline preload="metadata" aria-label="Intro video of ${esc(t.name)}"></video></div><p class="mut">${v.ratio} · ${Math.round(v.duration)} s</p>`
      : `<div class="empty" style="margin-top:6px">${esc(first)} has not added an intro video yet.</div>`}</div>
    <div class="row lf-act"><button class="btn ghost" data-act="chat" data-id="${t.ini}">${icon("chat", 18)} Chat with ${esc(first)}</button><button class="btn" data-act="book" data-id="${t.ini}">Book session</button></div></div>`;
}
function loadProfileVideo(t) {
  if (!t || !t.email || !t.video) return;
  UTSShared.getVideo(t.email).then(b => { const el = $("#lfv"); if (b && el) { liftURL = URL.createObjectURL(b); el.src = liftURL; } });
}
function sessionDetail(id) {
  const s = S.sessions.find(x => x.id == id); if (!s) return "";
  const t = tutorByName(s.mentor), blk = delayBlock(s), dl = (s.delays || []).length, fee = s.status === "accepted" ? delayFee(s.credits) : 0, first = s.mentor.split(" ")[0];
  const note = blk ? blk : fee ? `Delaying costs ${DELAY.pct}% of ${s.credits} credits = <b>${fmt(fee)} credits</b>, paid to ${esc(first)}. ${DELAY.max - dl} delay${DELAY.max - dl > 1 ? "s" : ""} left.`
    : `No fee yet: ${esc(first)} has not accepted this request. ${DELAY.max - dl} delay${DELAY.max - dl > 1 ? "s" : ""} left.`;
  return `<div class="lf-detail">${closeBtn}
    <div class="lf-head"><div class="when"><small>${s.day}</small><b>${s.time}</b></div><div><h3>${esc(s.title)}</h3><div class="mut">${esc(s.skill)} · ${s.min} min</div></div></div>
    ${t ? `<div class="mrow">${tAv(t, 52)}<div><b>${esc(t.name)}</b><div class="mut">Level ${t.level} ${t.levelName} · ★ ${(+t.rating).toFixed(1)} · ${expText(t.yrs)} experience</div></div></div>` : ""}
    <div class="m row"><span class="chip">${s.min} min</span><span class="chip o">${s.credits} credits held</span><span class="chip ${s.status === "accepted" ? "g" : "n"}">${s.status === "accepted" ? "Accepted" : "Waiting for mentor"}</span></div>
    ${dl ? `<div><b>Changes</b>${s.delays.map(d => `<div class="rep">Moved from ${dayLabel(d.from)}, ${clockLabel(d.from)} to ${dayLabel(d.to)}, ${clockLabel(d.to)} · ${d.fee ? "fee " + fmt(d.fee) + " credits" : "no fee"}</div>`).join("")}</div>` : ""}
    <p class="note-fee">${note}</p>
    <div class="row lf-act">${s.status === "accepted" ? `<button class="btn" data-act="join" data-id="${s.id}">${icon("video", 18)} Join room</button>` : ""}${blk ? "" : `<button class="btn ghost" data-act="delay" data-id="${s.id}">${icon("clock", 18)} Delay</button>`}${t ? `<button class="btn ghost" data-act="chat" data-id="${t.ini}">${icon("chat", 18)} Chat</button>` : ""}<button class="btn ghost" data-act="cancel" data-id="${s.id}">${s.status === "accepted" ? "Cancel" : "Cancel request"}</button></div></div>`;
}

/* ---------- chat with a tutor (messages live in the shared store; demo mentors answer automatically) ---------- */
const tutorMail = t => t.email || t.ini.toLowerCase() + "@mentors.demo";
const threadOf = t => UTSShared.threadId(UTS.email, tutorMail(t));
const CANNED = ["Hi! Happy to help. What are you stuck on?", "Sure. Share the error message or the code and we will go through it.", "I have a free slot soon. Book a session and we can fix it live.", "Got it, thanks. See you in the session!"];
function chatHTML(t) {
  const th = UTSShared.chatThread(threadOf(t));
  return th.msgs.length ? th.msgs.map(m => `<div class="msg ${m.from === "student" ? "mine" : ""}"><small>${m.from === "student" ? "You" : esc(m.name)} · ${clockLabel(m.ts)}${m.sim ? " · demo reply" : ""}</small>${esc(m.text)}</div>`).join("")
    : `<p class="mut" style="margin:auto;text-align:center">No messages yet. Say hello and tell ${esc(t.name.split(" ")[0])} what you are stuck on.</p>`;
}
function drawChat(t) { const m = $("#cmsgs"); if (!m) return; m.innerHTML = chatHTML(t); m.scrollTop = m.scrollHeight; }

const ACT = {
  go: id => go(id),
  lift: (id, b) => liftCard(b.closest("[data-lift]")),
  liftclose: () => Lift.close(),
  theme: id => { UTSTheme.set(id); renderNav(); },
  chat: ini => {
    const t = tutorByIni(ini); if (!t) return; chatWith = ini; UTSShared.chatSeen(threadOf(t), "student"); const first = t.name.split(" ")[0];
    modal(`<div class="row" style="flex-wrap:nowrap">${tAv(t, 44)}<div style="flex:1"><h3>Chat with ${esc(t.name)}</h3><p class="mut">${t.live ? `${esc(first)} sees your messages in the tutor app (demo: same browser).` : "Demo mentor: replies are automatic."}</p></div></div>
      <div class="msgs" id="cmsgs" aria-live="polite">${chatHTML(t)}</div>
      <div class="row"><input class="in" id="cin" maxlength="500" placeholder="Type a message" aria-label="Message"><button class="btn" data-act="chatsend" data-id="${ini}">${icon("send", 16)} Send</button></div>
      <div class="row"><button class="btn ghost" data-act="close">Close</button></div>`);
    const m = $("#cmsgs"); m.scrollTop = m.scrollHeight; const i = $("#cin"); i.focus(); i.addEventListener("keydown", e => { if (e.key === "Enter") ACT.chatsend(ini); });
  },
  chatsend: ini => {
    const t = tutorByIni(ini), inp = $("#cin"), v = inp ? inp.value.trim() : ""; if (!t || !v) return; inp.value = "";
    const id = threadOf(t); UTSShared.chatSend(id, "student", S.user.name, v); drawChat(t);
    if (!t.live) setTimeout(() => { const n = UTSShared.chatThread(id).msgs.filter(m => m.from === "tutor").length; UTSShared.chatSend(id, "tutor", t.name, CANNED[n % CANNED.length], true); if (chatWith === ini) drawChat(t); }, 1400);
  },
  delay: id => {
    const s = S.sessions.find(x => x.id == id); if (!s || !(s.status === "accepted" || s.status === "requested")) return;
    const blk = delayBlock(s); if (blk) return toast(blk);
    const fee = s.status === "accepted" ? delayFee(s.credits) : 0, first = s.mentor.split(" ")[0], def = new Date(Math.max(s.ts, Date.now()) + 2 * HR), dd = startOfDay(def.getTime()), p2 = n => String(n).padStart(2, "0");
    const days = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const d = startOfDay(Date.now()) + i * DAY; return `<option value="${d}" ${d === dd ? "selected" : ""}>${dayLabel(d)}</option>`; }).join("");
    modal(`<h3>Delay this lecture</h3><p class="mut">“${esc(s.title)}” with ${esc(s.mentor)}<br>Now: <b>${s.day}, ${s.time}</b></p>
      <label class="f">New day<select class="in" id="dl-d">${days}</select></label><label class="f">New time<input class="in" id="dl-t" type="time" value="${p2(def.getHours())}:${p2(def.getMinutes())}"></label>
      <label class="f">Reason<select class="in" id="dl-r"><option>I need more time to prepare</option><option>Exam or class clash</option><option>Health or family reason</option><option>Internet or power problem</option><option>Other</option></select></label>
      <label class="f">Note to ${esc(first)} (optional)<textarea class="in" id="dl-m" rows="2" maxlength="160" placeholder="e.g. My college lab ran late."></textarea></label>
      <p class="note-fee">${fee ? `Delay fee: ${DELAY.pct}% of ${s.credits} credits = <b>${fmt(fee)} credits</b>, taken from your balance and paid to ${esc(first)}.` : `No fee now: ${esc(first)} has not accepted this request yet.`} ${esc(first)} gets a notification. You have ${fmt(S.credits)} credits.</p>
      <div class="row"><button class="btn ghost" data-act="close">Keep current time</button><button class="btn orange" data-act="delayyes" data-id="${id}">Confirm delay</button></div>`);
  },
  delayyes: id => {
    const s = S.sessions.find(x => x.id == id); if (!s) return;
    const day = new Date(+$("#dl-d").value), [h, m] = ($("#dl-t").value || "").split(":").map(Number); if (isNaN(h)) return toast("Pick the new time");
    day.setHours(h, m, 0, 0); const ts = day.getTime(), now = Date.now();
    if (!(ts > now + 5 * 6e4)) return toast("Pick a time at least 5 minutes from now.");
    if (ts > now + DELAY.maxDays * DAY) return toast(`You can delay at most ${DELAY.maxDays} days ahead.`);
    if (ts <= s.ts) return toast("Pick a time after the current one. To go earlier, cancel and book again.");
    const clash = S.sessions.find(x => x.id !== s.id && (x.status === "accepted" || x.status === "requested") && ts < x.ts + x.min * 6e4 && ts + s.min * 6e4 > x.ts);
    if (clash) return toast(`That overlaps “${clash.title}” (${clash.day}, ${clash.time}).`);
    const fee = s.status === "accepted" ? delayFee(s.credits) : 0; if (S.credits < fee) return toast(`Not enough credits for the delay fee (${fmt(fee)}).`);
    const reason = $("#dl-r").value, msg = $("#dl-m").value.trim(), from = s.ts;
    if (fee) { S.credits = round2(S.credits - fee); log(`Delay fee: ${s.title}`, -fee); }
    s.delays = (s.delays || []).concat([{ from, to: ts, fee, reason, ts: now }]); s.ts = ts; s.day = dayLabel(ts); s.time = clockLabel(ts); save();
    const t = tutorByName(s.mentor), sent = t && t.email && UTSShared.notifyTutor(t.email, { kind: "delay", fromStudent: UTS.email, studentName: S.user.name, sessionTitle: s.title, fromTs: from, toTs: ts, fee, reason, note: msg });
    closeModal(); toast(`Delayed to ${s.day}, ${s.time}.${fee ? ` Fee ${fmt(fee)} credits.` : " No fee."} ${sent ? s.mentor.split(" ")[0] + " was notified." : "Saved (this demo mentor has no login to notify)."}`); go(page);
  },
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
    const s = S.sessions.find(x => x.id == id); s.status = "cancelled"; S.credits = round2(S.credits + s.credits); log(`Refund: ${s.title}`, s.credits);
    save(); toast("Cancelled. Credits refunded."); go(page);
  },
  join: id => {
    const s = S.sessions.find(x => x.id == id); if (!s) return toast("Session not found.");
    modal(`<h3>Join virtual classroom</h3><p class="mut">${esc(s.title)} · with ${esc(s.mentor)}</p>
      <label class="f">Room code or invite link<input class="in" id="roomInviteInput" maxlength="500" value="" placeholder="Paste the tutor's invite link or room code"></label>
      <p class="mut">Paste the invite link or room code shared by your tutor to join the same room.</p>
      <div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="openroom" data-id="${id}">${icon("video", 18)} Join room</button></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><p class="mut">Lesson finished? End the session and rate your mentor:</p>
      <div class="row">${[1, 2, 3, 4, 5].map(n => `<button class="btn ghost" data-act="finish" data-id="${id}" data-r="${n}">${n}★</button>`).join("")}</div>`);
  },
  openroom: id => {
    const s = S.sessions.find(x => x.id == id); if (!s) return toast("Session not found.");
    const raw = ((document.querySelector("#roomInviteInput") || {}).value || "").trim();
    if (!raw) return toast("Paste the invite link or room code shared by your tutor.");
    let room = raw;
    try { if (/^https?:\/\//i.test(room)) room = new URL(room).searchParams.get("room") || ""; } catch { room = ""; }
    if (!/^uts-[A-Za-z0-9_-]{8,100}$/.test(room)) return toast("Enter a valid room code or invite link.");
    const api = window.UPTOSKILL_API_URL || "";
    window.open("../virtual-room.html?room=" + encodeURIComponent(room) + "&name=" + encodeURIComponent(S.user.name) + "&role=student" + (api ? "&api=" + encodeURIComponent(api) : ""), "_blank", "noopener");
    closeModal();
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
  reset: () => { if (confirm(IS_DEMO ? "Reset all demo data?" : "Reset this account's data in this browser?")) { S = seed(); save(); toast(IS_DEMO ? "Demo data reset" : "Data reset"); go("dashboard"); } }
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b) {
    if (e.target.id === "modal") closeModal();
    else if (!e.target.closest(".fly, #modal, .liftov, a, input, select, textarea") && !(window.getSelection && String(getSelection()))) liftCard(e.target.closest("[data-lift]"));   // click on a card body lifts it
    return;
  }
  if (ACT[b.dataset.act]) ACT[b.dataset.act](b.dataset.id, b);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
document.addEventListener("input", e => { if (["q", "lang", "slot"].includes(e.target.id)) updateTutors(); });

/* ---------- tutor notifications (reschedule alerts from the tutor app) ---------- */
const dayLabel = t => { const d = new Date(t), n = new Date(); [d, n].forEach(x => x.setHours(0, 0, 0, 0)); const k = Math.round((d - n) / 864e5);
  return k === 0 ? "Today" : k === 1 ? "Tomorrow" : new Date(t).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); };
const clockLabel = t => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
function checkNotifs() {
  if (!window.UTS || !window.UTSShared) return;
  const un = UTSShared.notifications(UTS.email).filter(n => !n.read); if (!un.length) return;
  un.filter(n => n.kind === "reschedule").slice().reverse().forEach(n => {          // keep my upcoming list in step with the new time
    const s = S.sessions.find(x => (x.status === "accepted" || x.status === "requested") && x.mentor === n.mentor && x.title === n.sessionTitle) ||
              S.sessions.find(x => (x.status === "accepted" || x.status === "requested") && x.mentor === n.mentor);
    if (s) { s.day = dayLabel(n.toTs); s.time = clockLabel(n.toTs); s.ts = n.toTs; }
  });
  save(); UTSShared.markRead(UTS.email);
  modal(`<h3>Notifications</h3><div class="nf">${un.map(n => `<div class="rep"><b>${esc(n.title)}</b><br>${esc(n.body)}</div>`).join("")}</div><div class="row"><button class="btn" data-act="close">Got it</button></div>`);
  rerender();
}
window.addEventListener("storage", e => {
  if (e.key === "uts_notifs") checkNotifs();
  if (e.key === "uts_chats" && chatWith) { const t = tutorByIni(chatWith); if (t) drawChat(t); }
});
window.addEventListener("uts-theme", renderNav);

S.sessions.filter(s => s.status === "requested").forEach(s => autoAccept(s.id));
go("dashboard");
checkNotifs();
