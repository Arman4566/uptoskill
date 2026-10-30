/* UpToSkill Tutor - state, credit ledger and session state machine.
   Everything is stored in the browser (localStorage). Rule from the project plan: logic lives in code, AI only writes language. */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HR = 36e5, DAY = 864e5, KEY = "uptoskill_tutor_v1", ROOM = id => "uptoskill_tutor_room_" + id;

const VOCAB = ["React", "JavaScript", "Node", "SQL", "Python", "DSA", "Git", "Flutter", "WebGL/GLSL"];
const LANGS = ["English", "Hindi", "Marathi"];
const PRICE = { 15: 2, 30: 4, 45: 6 }, IPRICE = { 10: 1, 15: 2 }, MAXPRICE = 6;       // price always comes from this table, never from AI
const priceOf = (min, instant) => Math.min(MAXPRICE, (instant ? IPRICE : PRICE)[min] || (instant ? 1 : 2));
const LEVELS = [[1, "Newcomer"], [2, "Helper"], [3, "Mentor"], [4, "Guide"]];
const LEVEL_RULES = { 2: [3, 0], 3: [10, 4.0], 4: [25, 4.5] };                      // [sessions given, rating]
const BONUS_CAP = 3, INSTANT_WAIT = 60e3, REQ_TTL = 24 * HR;

/* ---------- time helpers ---------- */
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayName = t => { const d = startOfDay(t) - startOfDay(Date.now()); return d === 0 ? "Today" : d === DAY ? "Tomorrow" : d === -DAY ? "Yesterday" : new Date(t).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); };
const clock = t => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
const when = t => dayName(t) + ", " + clock(t);
const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
const uid = () => Math.random().toString(36).slice(2, 10);
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- sample content ---------- */
const PROBLEMS = {
  React: ["My useEffect runs in an infinite loop when I set state inside it. I tried an empty dependency array but then the value goes stale.", "I do not understand props vs state. I tried lifting state up but my child component does not re-render."],
  JavaScript: ["Why does my map() return undefined? I wrote a callback with curly braces and tried console.log inside it.", "My async function returns a Promise instead of the value. I tried adding await but I get a syntax error."],
  Node: ["Express routing: my second route never runs. I tried moving app.use around but the order still confuses me.", "My Node server crashes with unhandled promise rejection when the database is slow."],
  SQL: ["SQL group by gives wrong totals after a join, the rows are duplicated. I tried DISTINCT but the sums are still off.", "My LEFT JOIN returns duplicate rows for each order. I tried GROUP BY but then I lose columns."],
  Python: ["Python dictionary: I get KeyError when counting words. I tried using if key in dict but the code is long.", "My list comprehension is slow on a big list. I tried a for loop and it is the same."],
  DSA: ["I cannot figure out the time complexity of my recursive solution. I tried drawing the call tree.", "Binary search keeps looping forever on some inputs. I tried changing mid to (lo+hi)//2."]
};
const CODE = {
  React: "function Timer() {\n  const [n, setN] = useState(0);\n  useEffect(() => {\n    setN(n + 1);          // loops forever\n  });\n  return <p>{n}</p>;\n}\n",
  JavaScript: "const doubled = nums.map(n => {\n  n * 2;               // returns undefined\n});\nconsole.log(doubled);\n",
  Node: "app.use(express.json());\napp.get('/users/:id', getUser);\napp.get('/users/me', getMe);   // never reached\n",
  SQL: "SELECT c.name, SUM(o.total)\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN items i ON i.order_id = o.id   -- duplicates rows\nGROUP BY c.name;\n",
  Python: "counts = {}\nfor w in words:\n    counts[w] += 1        # KeyError\n",
  DSA: "def search(a, x):\n    lo, hi = 0, len(a)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if a[mid] < x: lo = mid   # never ends\n        else: hi = mid\n"
};
const COMMENTS = { 5: ["Explained it so clearly. Fixed in minutes.", "Patient, great examples, exactly what I needed.", "Very clear walkthrough. Would book again.", "Saved my evening, thank you!"], 4: ["Helpful session, a bit fast at the end.", "Good explanation and useful tips."], 3: ["Okay help, I needed a little more time."] };
const SIM_REPLIES = ["Okay, trying that now...", "Oh, that makes sense. Can you show the fixed line?", "I changed it and the error is gone!", "Thanks, now I understand why it happened.", "Got it. Should I do the same in the other file?"];
const RIVAL_NAMES = ["Vikram Joshi", "Karan Mehta", "Sana Qureshi"];

/* ---------- state ---------- */
let S = load();
function load() { try { const x = JSON.parse(localStorage.getItem(KEY)); if (x && x.v === 2) return x; } catch (e) { } return seed(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
save();                                                   // persist the seed on first run
const me = () => S.me;
const user = id => id === "me" ? S.me : S.users[id] || { id, name: String(id).startsWith("R:") ? id.slice(2) : id === "platform" ? "Platform (simulated)" : "Unknown", level: 1, langs: [] };
const sess = id => S.sessions.find(s => s.id == id);

/* ---------- ledger: balance is a query, every movement is a row ---------- */
const bal = u => S.ledger.filter(r => r.uid === u).reduce((n, r) => n + r.delta, 0);
function addLedger(u, delta, reason, refType, refId, note, ts) {
  if (refId != null && S.ledger.some(r => r.uid === u && r.reason === reason && r.refType === refType && r.refId === refId)) return null; // unique index: settles once
  const r = { id: S.nid++, uid: u, delta, reason, refType: refType || null, refId: refId ?? null, note: note || "", ts: ts || Date.now() };
  S.ledger.push(r); return r;
}
const EARN = ["payout", "bounty_payout", "bonus"];
const earnRows = () => S.ledger.filter(r => r.uid === "me" && EARN.includes(r.reason));
const escrowIn = () => S.sessions.filter(s => s.status === "accepted" || s.status === "in_progress").reduce((n, s) => n + s.credits, 0);

/* ---------- derived profile ---------- */
const given = () => S.sessions.filter(s => s.status === "completed");
const avgRating = () => { const r = S.ratings; return r.length ? r.reduce((n, x) => n + x.stars, 0) / r.length : 0; };
function levelFor(sessions, rating) {
  let l = 1;
  for (const k of [2, 3, 4]) if (sessions >= LEVEL_RULES[k][0] && rating >= LEVEL_RULES[k][1]) l = k;
  return l;
}
function refreshLevel() {
  const old = S.me.level, l = levelFor(given().length, avgRating()); S.me.level = l; return l > old ? l : 0;
}
const levelName = l => LEVELS.find(x => x[0] === l)[1];
function leaderboard() {
  const rows = S.others.map(o => ({ ...o })).concat([{ name: S.me.name, level: S.me.level, sessions: given().length, rating: +avgRating().toFixed(1), me: true }]);
  return rows.sort((a, b) => b.sessions - a.sessions || b.rating - a.rating);
}
function checkBadges() {
  const n = given().length, got = k => S.badges.some(b => b.key === k), out = [];
  const add = k => { if (!got(k)) { S.badges.push({ key: k, ts: Date.now() }); out.push(k); } };
  if (n >= 1) add("first_session"); if (n >= 10) add("ten_sessions");
  if (leaderboard().findIndex(r => r.me) < 3) add("top_helper");
  return out;
}
const BADGE_INFO = { first_session: ["First session", "Completed your first session", "flame"], ten_sessions: ["Ten sessions", "Helped 10 learners", "medal"], top_helper: ["Top helper", "In the top 3 of the leaderboard", "trophy"] };

/* ---------- matching (score is computed in code, AI only phrases it) ---------- */
function matchScore(req) {
  const l = user(req.learnerId), mine = S.me.skills.map(s => s.n);
  const hit = req.tags.filter(t => mine.includes(t)).length;
  const skill = req.tags.length ? Math.round(40 * hit / req.tags.length) : 0;
  const lang = l.langs.some(x => S.me.langs.includes(x)) ? 15 : 0;
  const avail = req.slotId && S.slots.some(x => x.id === req.slotId) ? 20 : req.type === "instant" ? 10 : 0;
  const rate = Math.round(avgRating() / 5 * 15), gap = Math.min(Math.max(S.me.level - l.level, 0), 3) * 3 + 1;
  return { skill, lang, avail, rate, gap, total: skill + lang + avail + rate + gap };
}

/* ---------- session state machine: every transition checks the current status first ---------- */
const fail = err => ({ ok: false, err }), good = () => ({ ok: true });
const Sess = {
  accept(id) {
    const s = sess(id); if (!s || s.status !== "requested") return fail("This request is no longer open.");
    const l = user(s.learnerId);
    if (S.me.level <= l.level) return fail("Mentor level must be higher than the learner's level.");
    if (bal(s.learnerId) < s.credits) return fail(`${l.name} does not have enough credits (needs ${s.credits}).`);   // balance check before hold
    addLedger(s.learnerId, -s.credits, "hold", "session", s.id, "Held: " + s.title);
    s.status = "accepted"; s.acceptedTs = Date.now();
    const sl = S.slots.find(x => x.id === s.slotId); if (sl) { sl.booked = true; sl.sid = s.id; }
    return good();
  },
  decline(id) { const s = sess(id); if (!s || s.status !== "requested") return fail("This request is no longer open."); s.status = "declined"; return good(); },
  start(id) { const s = sess(id); if (!s) return fail("Session not found."); if (s.status === "in_progress") return good(); if (s.status !== "accepted") return fail("Session cannot start from status " + s.status + "."); s.status = "in_progress"; s.startTs = Date.now(); return good(); },
  release(s, status) {
    addLedger(s.learnerId, s.credits, "release", "session", s.id, "Released: " + s.title);
    const sl = S.slots.find(x => x.sid === s.id); if (sl) { sl.booked = false; sl.sid = null; }
    s.status = status; s.endTs = Date.now();
  },
  cancel(id) { const s = sess(id); if (!s || s.status !== "accepted") return fail("Only accepted sessions can be cancelled."); this.release(s, "cancelled"); return good(); },
  noShow(id) { const s = sess(id); if (!s || s.status !== "accepted") return fail("Only accepted sessions can be marked no-show."); this.release(s, "no_show"); return good(); },
  complete(id, notes) {
    const s = sess(id); if (!s || s.status !== "in_progress") return fail("Only a session in progress can be completed.");
    if (s.settledTs) return good();                                                  // idempotent settlement
    const pct = S.settings.feePct, fee = pct ? Math.ceil(s.credits * pct / 100) : 0;
    addLedger("me", s.credits - fee, "payout", "session", s.id, "Session with " + user(s.learnerId).name);
    if (fee) addLedger("platform", fee, "platform_fee", "session", s.id, "Simulated platform fee");
    s.status = "completed"; s.endTs = Date.now(); s.settledTs = s.endTs; s.mentorNotes = notes || "";
    s.rateAt = s.endTs + 4000; s.notesAt = s.endTs + 1500; s.noteStatus = "pending";
    const sl = S.slots.find(x => x.sid === s.id); if (sl) { sl.booked = false; sl.sid = null; sl.done = true; }
    return good();
  }
};

/* ---------- ratings, bonus (capped per day) ---------- */
function rate(s) {
  if (S.ratings.some(r => r.sid === s.id)) return null;
  const r = Math.random(), stars = r < .7 ? 5 : r < .95 ? 4 : 3, pool = COMMENTS[stars];
  S.ratings.push({ sid: s.id, learnerId: s.learnerId, stars, comment: pool[Math.floor(Math.random() * pool.length)], ts: Date.now() });
  let bonus = 0;
  if (stars === 5) {
    const today = S.ledger.filter(x => x.uid === "me" && x.reason === "bonus" && x.ts >= startOfDay(Date.now())).length;
    if (today < BONUS_CAP && addLedger("me", 1, "bonus", "session", s.id, "5-star bonus")) bonus = 1;
  }
  return { stars, bonus, name: user(s.learnerId).name };
}

/* ---------- bounties ---------- */
function acceptBounty(b, answerId) {
  if (b.status !== "open") return fail("This bounty is already closed.");
  const a = b.answers.find(x => x.id === answerId); if (!a) return fail("Answer not found.");
  a.accepted = true; b.status = "solved"; b.solvedTs = Date.now();
  addLedger(a.helperId, b.reward, "bounty_payout", "bounty", b.id, "Bounty: " + b.title);
  return good();
}
function refundBounty(b) {
  if (b.status !== "open") return;
  b.status = "expired"; addLedger(b.authorId, b.reward, "bounty_refund", "bounty", b.id, "Refund: " + b.title);
}
function postBounty(title, tags, reward) {
  if (bal("me") < reward) return fail("Not enough credits for that reward.");
  const b = { id: S.nid++, authorId: "me", title, tags, reward, status: "open", deadline: Date.now() + DAY, answers: [], ts: Date.now(), simAt: [Date.now() + 9000, Date.now() + 20000] };
  addLedger("me", -reward, "bounty_hold", "bounty", b.id, "Escrow: " + title);
  S.bounties.unshift(b); return { ok: true, b };
}

/* ---------- room storage (separate key so two windows never overwrite each other) ---------- */
function roomGet(id) { try { const r = JSON.parse(localStorage.getItem(ROOM(id))); if (r) return r; } catch (e) { } return { code: "", msgs: [], pres: {}, endReq: false }; }
function roomSet(id, fn) { const r = roomGet(id); fn(r); try { localStorage.setItem(ROOM(id), JSON.stringify(r)); } catch (e) { } return r; }

/* ---------- seed ---------- */
function seed() {
  const now = Date.now(), R = rng(11), pick = a => a[Math.floor(R() * a.length)];
  const T = { v: 2, nid: 1000, ledger: [], sessions: [], bounties: [], instant: [], slots: [], ratings: [], badges: [], notes: {}, spawn: { inst: now + 6000, req: now + 30000, nInst: 0, nReq: 0 }, ai: { calls: [] }, settings: { aiOn: true, feePct: 0 }, toasts: [] };
  const joined = now - 16 * 30 * DAY;
  T.me = { id: "me", name: "Neha Sharma", level: 3, bio: "Final-year CS student. I love explaining React and SQL with small, runnable examples.", langs: ["English", "Hindi"], online: true, joined,
    skills: [{ n: "React", exp: 3 }, { n: "JavaScript", exp: 3 }, { n: "Node", exp: 2 }, { n: "SQL", exp: 2 }, { n: "Python", exp: 2 }, { n: "DSA", exp: 2 }] };
  const L = [["Riya Verma", 1, ["English"]], ["Rohit Das", 1, ["Hindi", "English"]], ["Meera Patel", 1, ["English"]], ["Arjun Thakur", 1, ["Hindi"]], ["Aman Khan", 1, ["English", "Hindi"]], ["Pooja Singh", 2, ["English"]],
    ["Sameer Kulkarni", 1, ["Marathi", "English"]], ["Kavya Nair", 2, ["English"]], ["Dev Malhotra", 2, ["Hindi", "English"]], ["Ananya Gupta", 2, ["English", "Hindi"]], ["Tanvi Shah", 1, ["English"]], ["Imran Sheikh", 1, ["Hindi"]]];
  T.users = {}; L.forEach((l, i) => { T.users["L" + (i + 1)] = { id: "L" + (i + 1), name: l[0], level: l[1], langs: l[2] }; });
  T.others = [{ name: "Karan Mehta", level: 4, sessions: 27, rating: 4.9 }, { name: "Vikram Joshi", level: 4, sessions: 31, rating: 4.7 }, { name: "Sana Qureshi", level: 3, sessions: 12, rating: 4.5 }, { name: "Ishita Rao", level: 2, sessions: 6, rating: 4.6 }, { name: "Ananya Gupta", level: 2, sessions: 4, rating: 4.4 }, { name: "Dev Malhotra", level: 2, sessions: 3, rating: 4.2 }];
  const led = (u, d, r, rt, ri, n, ts) => T.ledger.push({ id: T.nid++, uid: u, delta: d, reason: r, refType: rt, refId: ri, note: n, ts });
  led("me", 10, "starter", null, null, "Welcome credits", joined);
  Object.keys(T.users).forEach(k => led(k, 10, "starter", null, null, "Welcome credits", joined));
  // availability: next days, future only
  const slot = (d, h1, h2) => { let a = startOfDay(now) + d * DAY + h1 * HR; while (a < now + 30 * 6e4) a += DAY; return { id: T.nid++, start: a, end: a + (h2 - h1) * HR, booked: false, sid: null }; };
  const sl = [slot(0, 18, 19), slot(0, 20, 21), slot(1, 11, 12), slot(1, 17, 18.5), slot(1, 20, 21), slot(2, 10, 11), slot(2, 18, 19), slot(3, 16, 17), slot(5, 10, 12)];
  T.slots = sl;
  // history: completed sessions spread over ~15 months, newest ones inside the last 24h / week
  const hist = [[470, 2], [431, 4], [385, 4], [342, 2], [301, 6], [255, 4], [210, 4], [172, 2], [141, 6], [112, 4], [84, 4], [58, 2], [33, 4], [16, 4], [6.5, 6], [1.2, 4], [0.3, 4]];
  hist.forEach(([off, cr], i) => {
    const learner = "L" + (1 + Math.floor(R() * 12)), skill = pick(Object.keys(CODE)), ts = now - off * DAY, id = T.nid++, ai = AI.analyze(pick(PROBLEMS[skill]));
    const s = { id, type: R() < .25 ? "instant" : "booked", status: "completed", learnerId: learner, title: ai.title, problem: PROBLEMS[skill][0], tags: ai.tags, difficulty: ai.difficulty, minutes: cr === 2 ? 15 : cr === 4 ? 30 : 45, credits: cr, brief: null, slotTs: ts, reqTs: ts - HR, startTs: ts, endTs: ts + cr * 7.5 * 6e4, settledTs: ts + cr * 7.5 * 6e4, token: uid(), noteStatus: "ok" };
    T.sessions.push(s);
    led("me", cr, "payout", "session", id, "Session with " + T.users[learner].name, s.endTs);
    const stars = R() < .78 ? 5 : 4; T.ratings.push({ sid: id, learnerId: learner, stars, comment: pick(COMMENTS[stars]), ts: s.endTs + 6e4 });
    if (stars === 5 && i % 2 === 0) led("me", 1, "bonus", "session", id, "5-star bonus", s.endTs + 6e4);
    T.notes[id] = { ...AI.summarize(s, [], CODE[skill] || ""), finalCode: CODE[skill] || "", status: "ok", ts: s.endTs };
    if (i % 3 === 1) led("me", 1 + (i % 4), "bounty_payout", "bounty", 900 + i, "Bounty answer accepted", ts + 5 * HR);
  });
  // learner side of each of today's rows is not shown; open work below uses real holds
  const mk = (type, status, learner, skill, min, slotId, extra) => {
    const text = pick(PROBLEMS[skill]), ai = AI.analyze(text), id = T.nid++, cr = type === "instant" ? priceOf(min, true) : priceOf(min);
    const s = { id, type, status, learnerId: learner, title: ai.title, problem: text, tags: ai.tags, difficulty: ai.difficulty, minutes: min, credits: cr, brief: { problem_summary: ai.problem_summary, already_tried: ai.already_tried, topics_to_prepare: ai.topics_to_prepare }, slotId, slotTs: slotId ? T.slots.find(x => x.id === slotId).start : now, reqTs: now - 20 * 6e4, token: uid(), ...extra };
    T.sessions.push(s); return s;
  };
  const a1 = mk("booked", "accepted", "L1", "React", 30, sl[0].id), a2 = mk("booked", "accepted", "L7", "Python", 30, sl[1].id), a3 = mk("booked", "accepted", "L5", "SQL", 15, sl[2].id);
  mk("booked", "requested", "L2", "Node", 30, sl[3].id); mk("booked", "requested", "L3", "React", 15, sl[5].id); mk("booked", "requested", "L4", "SQL", 45, sl[4].id);
  // bounties
  const bt = (title, tags, reward, author, hrs, status, answers, extra) => ({ id: T.nid++, authorId: author, title, tags, reward, status, deadline: now + hrs * HR, answers: answers || [], ts: now - 3 * HR, ...extra });
  const ans = (by, body, acc) => ({ id: T.nid++, helperId: by, body, accepted: !!acc, ts: now - HR });
  T.bounties = [
    bt("Why does my map() return undefined?", ["JavaScript"], 2, "L5", 20, "open", [ans("R:Vikram Joshi", "Check that you return inside the callback.")]),
    bt("GROUP BY totals are wrong after joining three tables", ["SQL"], 5, "L6", 9, "open"),
    bt("Express: /users/me never matches, /users/:id always wins", ["Node"], 4, "L8", 30, "open"),
    bt("How do I debounce a search input in React?", ["React", "JavaScript"], 3, "L9", 14, "open"),
    bt("Difference between INNER and LEFT JOIN?", ["SQL"], 2, "L10", -30, "solved", [ans("R:Karan Mehta", "INNER keeps only matching rows; LEFT keeps every row from the left table.", 1)]),
    bt("Git rebase vs merge: which one before a PR?", ["Git"], 3, "L11", -60, "solved", [ans("me", "Rebase your branch onto main to keep history linear, then merge with a PR.", 1)]),
    bt("Python list vs tuple, when to use which?", ["Python"], 3, "L9", -30, "expired")
  ];
  T.bounties.forEach(b => {
    if (b.authorId === "me") return;
    led(b.authorId, -b.reward, "bounty_hold", "bounty", b.id, "Escrow: " + b.title, b.ts);
    if (b.status === "expired") led(b.authorId, b.reward, "bounty_refund", "bounty", b.id, "Refund: " + b.title, b.deadline);
    if (b.status === "solved" && b.answers[0].helperId === "me") led("me", b.reward, "bounty_payout", "bounty", b.id, "Bounty: " + b.title, b.ts + HR);
  });
  // holds for the 3 accepted sessions (ledger rows for learners)
  [a1, a2, a3].forEach(s => { led(s.learnerId, -s.credits, "hold", "session", s.id, "Held: " + s.title, now - 10 * 6e4); const x = T.slots.find(q => q.id === s.slotId); x.booked = true; x.sid = s.id; });
  T.badges = [{ key: "first_session", ts: joined }, { key: "ten_sessions", ts: now - 60 * DAY }];
  return T;
}
