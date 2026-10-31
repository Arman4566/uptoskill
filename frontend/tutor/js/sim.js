/* UpToSkill Tutor - simulated world: learners posting requests, rival mentors, learners rating and accepting answers.
   Runs once per second. In a real build this is the server + Socket.IO. */
"use strict";
const QUEUE = [];                      // toasts produced by sweeps, shown by the UI
const say = m => QUEUE.push(m);

function newRequest(instant) {
  const mine = S.me.skills.map(s => s.n).filter(n => PROBLEMS[n]);
  const skill = mine[Math.floor(Math.random() * mine.length)], text = PROBLEMS[skill][Math.floor(Math.random() * PROBLEMS[skill].length)];
  const learners = Object.values(S.users).filter(u => u.level < S.me.level && bal(u.id) >= 4);   // mentor must be above learner
  if (!learners.length) return null;
  const l = learners[Math.floor(Math.random() * learners.length)], ai = S.settings.aiOn ? AI.analyze(text) : null, raw = AI.analyze(text);
  if (instant) {
    const min = Math.random() < .5 ? 10 : 15, r = { id: S.nid++, learnerId: l.id, skill, problem: text, title: raw.title, tags: raw.tags, minutes: min, credits: priceOf(min, true), createdTs: Date.now(), expiresTs: Date.now() + INSTANT_WAIT, status: "open", rivalAt: Math.random() < .4 ? Date.now() + 9000 + Math.random() * 30000 : 0, brief: ai ? { problem_summary: ai.problem_summary, already_tried: ai.already_tried, topics_to_prepare: ai.topics_to_prepare } : null };
    S.instant.unshift(r); return r;
  }
  const free = S.slots.filter(x => !x.booked && x.start > Date.now() && !S.sessions.some(s => s.slotId === x.id && s.status === "requested"));
  if (!free.length) return null;
  const sl = free[0], min = [15, 30, 45][raw.difficulty - 1];
  const s = { id: S.nid++, type: "booked", status: "requested", learnerId: l.id, title: raw.title, problem: text, tags: raw.tags, difficulty: raw.difficulty, minutes: min, credits: priceOf(min), brief: ai ? { problem_summary: ai.problem_summary, already_tried: ai.already_tried, topics_to_prepare: ai.topics_to_prepare } : null, slotId: sl.id, slotTs: sl.start, reqTs: Date.now(), token: uid() };
  S.sessions.push(s); return s;
}

function fallbackToBounty(r) {
  r.status = "bountied";
  const l = user(r.learnerId);
  if (bal(l.id) < r.credits) return;
  const b = { id: S.nid++, authorId: l.id, title: r.title, tags: r.tags, reward: r.credits, status: "open", deadline: Date.now() + DAY, answers: [], ts: Date.now(), fromInstant: true };
  addLedger(l.id, -r.credits, "bounty_hold", "bounty", b.id, "Escrow (instant fallback): " + r.title);
  S.bounties.unshift(b);
}

/* returns true when something visible changed */
function sweep() {
  const now = Date.now(); let ch = false;
  // instant help: rival claims and 60s timeout
  S.instant.filter(r => r.status === "open").forEach(r => {
    if (r.rivalAt && r.rivalAt <= now) { r.status = "claimed"; r.by = RIVAL_NAMES[Math.floor(Math.random() * 3)]; say(`${r.by} claimed ${user(r.learnerId).name}'s request first`); ch = true; }
    else if (r.expiresTs <= now) { fallbackToBounty(r); say("Instant request moved to the Doubt Board (no taker in 60s)"); ch = true; }
  });
  // booking requests expire after 24h, nothing was held
  S.sessions.filter(s => s.status === "requested" && now - s.reqTs > REQ_TTL).forEach(s => { s.status = "expired"; ch = true; tellStudent(s, "booking_declined", "Request expired", `${S.me.name} did not answer “${s.title}” within 24 hours. Your ${s.credits} credits were refunded.`); });
  // after completion: learner rates, AI writes notes
  S.sessions.filter(s => s.status === "completed" && s.rateAt && s.rateAt <= now).forEach(s => {
    const pr = s.pendingRating; s.rateAt = 0; s.pendingRating = 0; const r = rate(s, pr ? { stars: pr } : undefined); ch = true;
    if (r) say(`${r.name} rated you ${r.stars}★${r.bonus ? " (+1 bonus credit)" : ""}`);
    const lv = refreshLevel(); if (lv) say(`Level up! You are now Level ${lv} ${levelName(lv)}`);
    checkBadges().forEach(k => say("Badge unlocked: " + BADGE_INFO[k][0]));
  });
  S.sessions.filter(s => s.noteStatus === "pending" && s.notesAt && s.notesAt <= now).forEach(s => { s.notesAt = 0; genNotes(s); });
  // bounties: simulated helpers answer my bounty, authors accept my answer, deadlines refund
  S.bounties.filter(b => b.status === "open").forEach(b => {
    (b.simAt || []).filter(t => t <= now).forEach(() => { b.answers.push({ id: S.nid++, helperId: "R:" + RIVAL_NAMES[b.answers.length % 3], body: ["Try isolating the smallest failing case first, then log each step.", "Look at the order of operations; the second step overwrites the first."][b.answers.length % 2], accepted: false, ts: now }); ch = true; say("New answer on your bounty: " + b.title); });
    if (b.simAt) b.simAt = b.simAt.filter(t => t > now);
    if (b.acceptAt && b.acceptAt <= now && b.authorId !== "me") { const mine = b.answers.find(a => a.helperId === "me"), other = b.answers.find(a => a.helperId !== "me"); b.acceptAt = 0; if (mine && (b.pickMine !== false || !other)) { acceptBounty(b, mine.id); say(`${user(b.authorId).name} accepted your answer. +${b.reward} credits`); ch = true; } else if (other) { acceptBounty(b, other.id); say(`${user(b.authorId).name} chose another answer for "${b.title}"`); ch = true; } }
    if (b.deadline <= now) { refundBounty(b); ch = true; }
  });
  // spawn new work while the tutor is available
  if (S.me.online) {
    const sp = S.spawn;
    if (sp.nInst < 6 && sp.inst <= now && !S.instant.some(r => r.status === "open")) { const r = newRequest(true); sp.nInst++; sp.inst = now + 70e3 + Math.random() * 40e3; if (r) { say(`Instant Help: ${user(r.learnerId).name} needs ${r.skill} help now`); ch = true; } }
    if (sp.nReq < 3 && sp.req <= now) { const s = newRequest(false); sp.nReq++; sp.req = now + 100e3; if (s) { say(`New session request from ${user(s.learnerId).name}`); ch = true; } }
  }
  if (ch) save();
  return ch;
}

function genNotes(s) {
  const room = roomGet(s.id), ctx = { msgs: room.msgs || [], code: room.code || "" };
  S.notes[s.id] = { finalCode: ctx.code, status: "pending", ts: Date.now() };
  AI.call(() => AI.summarize(s, ctx.msgs, ctx.code)).then(sm => { S.notes[s.id] = { ...sm, finalCode: ctx.code, status: "ok", ts: Date.now() }; s.noteStatus = "ok"; save(); say("AI session notes are ready"); window.dispatchEvent(new Event("uts-change")); })
    .catch(e => { S.notes[s.id] = { finalCode: ctx.code, status: "unavailable", err: e.message, ts: Date.now() }; s.noteStatus = "unavailable"; save(); say("Summary unavailable - you can retry from the session"); window.dispatchEvent(new Event("uts-change")); });
}
