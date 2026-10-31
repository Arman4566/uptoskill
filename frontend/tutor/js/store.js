/* UpToSkill Tutor - state, credit ledger and session state machine.
   The app works on this state in memory / localStorage and shared/sync.js saves every change to the database (and loads it again on
   the next sign-in). Rule from the project plan: logic lives in code, AI only writes language. */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HR = 36e5, DAY = 864e5, KEY = "uptoskill_tutor_v1:" + (window.UTS ? UTS.email : "guest"), ROOM = id => "uptoskill_tutor_room_" + id;

const VOCAB = ["React", "JavaScript", "Node", "SQL", "Python", "DSA", "Git", "Flutter", "WebGL/GLSL"];
const LANGS = ["English", "Hindi", "Marathi"];
const PRICE = { 15: 2, 30: 4, 45: 6 }, IPRICE = { 10: 1, 15: 2 }, MAXPRICE = 6;       // price always comes from this table, never from AI
const priceOf = (min, instant) => Math.min(MAXPRICE, (instant ? IPRICE : PRICE)[min] || (instant ? 1 : 2));
const LEVELS = [[1, "Newcomer"], [2, "Helper"], [3, "Mentor"], [4, "Guide"]];
const LEVEL_RULES = { 2: [3, 0], 3: [10, 4.0], 4: [25, 4.5] };                      // [sessions given, rating]
const BONUS_CAP = 3, INSTANT_WAIT = 60e3, REQ_TTL = 24 * HR;
const RESCHEDULE_PCT = 2;                                                          // tutor pays 2% of the session credits each time he moves a lecture
const reschedFee = credits => Math.round(credits * RESCHEDULE_PCT) / 100;
const learnerEmail = id => (S.users[id] && S.users[id].email) || null;              // real students are linked to their login by email

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
const RIVAL_NAMES = ["Vikram Joshi", "Karan Mehta", "Sana Qureshi"];   // only used by the old simulator in sim.js, which never starts for real accounts

/* ---------- state ---------- */
let S = load();
function load() { try { const x = JSON.parse(localStorage.getItem(KEY)); if (x && x.v === 2 && x.fresh) return x; } catch (e) { } return seed(); }   // the saved copy comes from the database (shared/sync.js); old sample-data copies are ignored
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } if (typeof syncPublic === "function") syncPublic(); };   // syncPublic (ui.js) refreshes what students see on my tutor card
save();                                                   // persist the seed on first run
const me = () => S.me;
const user = id => id === "me" ? S.me : S.users[id] || { id, name: String(id).startsWith("R:") ? id.slice(2) : id === "platform" ? "Platform (simulated)" : "Unknown", level: 1, langs: [] };
const sess = id => S.sessions.find(s => s.id == id);

/* ---------- ledger: balance is a query, every movement is a row ---------- */
const bal = u => Math.round(S.ledger.filter(r => r.uid === u).reduce((n, r) => n + r.delta, 0) * 100) / 100;   // 2 decimals: reschedule fee can be a fraction
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
  const old = S.me.level, l = Math.max(S.me.baseLevel || 1, levelFor(given().length, avgRating())); S.me.level = l; return l > old ? l : 0;
}
const levelName = l => LEVELS.find(x => x[0] === l)[1];
/* Other real tutors, taken from the public profiles in the database (each tutor publishes level, sessions and rating). */
function otherTutors() {
  const me = window.UTS ? UTS.email : "", all = window.UTSShared ? UTSShared.profiles() : {};
  return Object.keys(all).filter(k => k !== me && all[k].pub).map(k => { const p = all[k].pub; return { name: p.name || k, level: p.level || 2, sessions: p.sessions || 0, rating: p.rating || 0 }; });
}
function leaderboard() {
  const rows = otherTutors().concat([{ name: S.me.name, level: S.me.level, sessions: given().length, rating: +avgRating().toFixed(1), me: true }]);
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
    // A real student already paid (held) the credits in the student app when booking; only simulated learners are held here.
    if (!s.prepaid && bal(s.learnerId) < s.credits) return fail(`${l.name} does not have enough credits (needs ${s.credits}).`);   // balance check before hold
    if (!s.prepaid) addLedger(s.learnerId, -s.credits, "hold", "session", s.id, "Held: " + s.title);
    s.status = "accepted"; s.acceptedTs = Date.now();
    const sl = S.slots.find(x => x.id === s.slotId); if (sl) { sl.booked = true; sl.sid = s.id; }
    tellStudent(s, "booking_accepted", "Session accepted", `${S.me.name} accepted “${s.title}”. Your credits stay held until the session is done.`);
    return good();
  },
  decline(id) { const s = sess(id); if (!s || s.status !== "requested") return fail("This request is no longer open."); s.status = "declined";
    tellStudent(s, "booking_declined", "Request declined", `${S.me.name} declined “${s.title}”. Your ${s.credits} credits were refunded.`); return good(); },
  reschedule(id, ts, reason) {
    const s = sess(id); if (!s || s.status !== "accepted") return fail("Only accepted sessions that have not started can be moved.");
    if (!(ts > Date.now() + 5 * 6e4)) return fail("Pick a time at least 5 minutes from now.");
    if (ts > Date.now() + 14 * DAY) return fail("You can move a session at most 14 days ahead.");
    if (Math.abs(ts - s.slotTs) < 6e4) return fail("That is the same time the session already has.");
    const clash = S.sessions.find(x => x.id !== s.id && ["accepted", "in_progress"].includes(x.status) && ts < x.slotTs + x.minutes * 6e4 && ts + s.minutes * 6e4 > x.slotTs);
    if (clash) return fail(`That overlaps your session "${clash.title}" (${when(clash.slotTs)}).`);
    if ((s.reschedules || []).length >= 3) return fail("A session can be moved at most 3 times.");
    const fee = reschedFee(s.credits); if (bal("me") < fee) return fail("Not enough credits to pay the reschedule fee.");
    s.reschedules = s.reschedules || []; const key = s.id + ":r" + (s.reschedules.length + 1), from = s.slotTs;
    addLedger("me", -fee, "reschedule_fee", "reschedule", key, `Reschedule fee ${RESCHEDULE_PCT}%: ` + s.title);
    addLedger("platform", fee, "platform_fee", "reschedule", key, "Reschedule fee (simulated)");
    const sl = S.slots.find(x => x.sid === s.id); if (sl) { sl.booked = false; sl.sid = null; }   // old slot is free again
    s.slotId = null; s.slotTs = ts; s.reschedules.push({ from, to: ts, reason: reason || "", fee, ts: Date.now() });
    return { ok: true, fee, from };
  },
  start(id) { const s = sess(id); if (!s) return fail("Session not found."); if (s.status === "in_progress") return good(); if (s.status !== "accepted") return fail("Session cannot start from status " + s.status + "."); s.status = "in_progress"; s.startTs = Date.now(); return good(); },
  release(s, status) {
    if (!s.prepaid) addLedger(s.learnerId, s.credits, "release", "session", s.id, "Released: " + s.title);
    tellStudent(s, "booking_cancelled", status === "no_show" ? "Marked as no-show" : "Session cancelled", `${S.me.name} ${status === "no_show" ? "marked “" + s.title + "” as a no-show" : "cancelled “" + s.title + "”"}. Your ${s.credits} credits were refunded.`);
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
    // A real student rates on their own (arrives as a notification, possibly before the session was completed here).
    s.rateAt = s.ref ? (s.pendingRating ? s.endTs + 500 : 0) : s.endTs + 4000;
    s.notesAt = s.endTs + 1500; s.noteStatus = "pending";
    const sl = S.slots.find(x => x.sid === s.id); if (sl) { sl.booked = false; sl.sid = null; sl.done = true; }
    return good();
  }
};

/* Tell the student (in their own app) what happened to their booking. Returns false for simulated learners. */
function tellStudent(s, kind, title, body) {
  const to = learnerEmail(s.learnerId); if (!to || !s.ref || !window.UTSShared) return false;
  return UTSShared.notify(to, { kind, ref: s.ref, title, body, mentor: S.me.name, sessionTitle: s.title });
}
/* A real student who booked me: remembered by email so the session list can show their name. */
function ensureLearner(email, name, level, langs) {
  const key = "E:" + email, u = S.users[key] || (S.users[key] = { id: key });
  u.name = name || u.name || email; u.email = email; u.level = level || u.level || 1; u.langs = langs && langs.length ? langs : (u.langs || ["English"]);
  return key;
}

/* ---------- ratings, bonus (capped per day) ---------- */
function rate(s, real) {                                   // real = { stars, comment } from the student; without it a simulated learner rates
  if (S.ratings.some(r => r.sid === s.id)) return null;
  const r = Math.random(), stars = real ? real.stars : r < .7 ? 5 : r < .95 ? 4 : 3, pool = COMMENTS[stars];
  S.ratings.push({ sid: s.id, learnerId: s.learnerId, stars, comment: real ? (real.comment || "") : pool[Math.floor(Math.random() * pool.length)], ts: Date.now() });
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

/* ---------- room storage (separate key so two windows never overwrite each other) ---------- */
function roomGet(id) { try { const r = JSON.parse(localStorage.getItem(ROOM(id))); if (r) return r; } catch (e) { } return { code: "", msgs: [], pres: {}, endReq: false }; }
function roomSet(id, fn) { const r = roomGet(id); fn(r); try { localStorage.setItem(ROOM(id), JSON.stringify(r)); } catch (e) { } return r; }

/* ---------- first start of a new account ---------- */
/* A tutor starts clean: no history, learners, requests or bounties; 10 welcome credits. Everything after that is real data that
   shared/sync.js saves to the database. New tutors start at level 2 (Helper), the same as the server, so level-1 students can book them. */
function seed() {
  const now = Date.now(), MAX = Number.MAX_SAFE_INTEGER;
  const T = { v: 2, fresh: true, nid: 1000, ledger: [], sessions: [], bounties: [], instant: [], slots: [], ratings: [], badges: [], notes: {}, spawn: { inst: MAX, req: MAX, nInst: 0, nReq: 0 }, ai: { calls: [] }, settings: { aiOn: true, feePct: 0 }, toasts: [], handled: [] };
  T.me = { id: "me", name: window.UTS ? UTS.name : "Tutor", level: 2, baseLevel: 2, bio: "", langs: ["English"], online: true, joined: now, skills: [] };
  T.users = {};
  T.ledger.push({ id: T.nid++, uid: "me", delta: 10, reason: "starter", refType: null, refId: null, note: "Welcome credits", ts: now });
  return T;
}
