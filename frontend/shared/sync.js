/* UpToSkill sync: keeps everything the student and tutor apps save in the browser in the DATABASE as well.

   How it works (the apps themselves did not have to change how they read and write):
   1. Before an app starts, UTSSync.start() downloads this account's saved data (GET /state) and puts it into
      localStorage, so the app finds exactly what it saved last time - on any browser or device.
   2. Every time the app writes one of its keys to localStorage, the change is sent to the server (PUT /state/...),
      a moment later and in one batch.
   3. Shared data (tutor profiles, chat threads, notifications between a student and a tutor) is checked on the server
      every few seconds, so a message or a booking sent from another account shows up without a reload.

   There is no offline mode and no demo data: if the server cannot be reached the app says so and offers "Try again". */
(function () {
  "use strict";
  const TOKEN = "uts_api_token", API = (window.UTSAuth && UTSAuth.apiBase) || "";
  const PRIVATE = ["uptoskill_v1:", "uptoskill_tutor_v1:"];                      // student app, tutor app (one key per account)
  const SHARED = { uts_tutor_profiles: "profiles", uts_chats: "chats", uts_notifs: "notifs", uts_tnotifs: "tnotifs" };
  const COLL_KEY = Object.fromEntries(Object.entries(SHARED).map(([k, v]) => [v, k]));
  const POLL_MS = 5000, FLUSH_MS = 600, OVERLAP_MS = 10000;

  const ls = window.localStorage, rawSet = ls.setItem.bind(ls), rawGet = ls.getItem.bind(ls), rawRemove = ls.removeItem.bind(ls);
  const token = () => { try { return rawGet(TOKEN); } catch (e) { return null; } };
  const rd = (k, d) => { try { const v = JSON.parse(rawGet(k)); return v ?? d; } catch (e) { return d; } };
  const norm = e => String(e || "").trim().toLowerCase();

  let email = "", ready = false, since = null, flushing = false, again = false, timer = 0, failing = 0;
  const sent = new Map();              // "private:<key>" / "<collection>|<item>"  ->  JSON string last known to be on the server

  /* ---------- network ---------- */
  async function call(path, opts) {
    const o = Object.assign({ method: "GET" }, opts || {});
    const headers = { Authorization: "Bearer " + token() };
    if (o.body !== undefined) { headers["Content-Type"] = "application/json"; o.body = JSON.stringify(o.body); }
    let res;
    try { res = await fetch(API + path, Object.assign({}, o, { headers })); }
    catch (e) { throw Object.assign(new Error("Cannot reach the server at " + API), { code: "NETWORK" }); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { expired(); throw Object.assign(new Error("Your sign-in expired."), { code: "AUTH", status: 401 }); }
    if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Server error"), { code: data.error || "ERROR", status: res.status });
    return data;
  }
  function expired() {
    try { rawRemove(TOKEN); rawRemove("uts_session"); } catch (e) { }
    location.replace("login.html");
  }

  /* ---------- small status bar ("Saving…" problems must never be silent) ---------- */
  function bar(msg) {
    let b = document.getElementById("uts-sync");
    if (!msg) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("div"); b.id = "uts-sync"; b.setAttribute("role", "status");
      b.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;max-width:92vw;background:#FEE2E2;color:#7F1D1D;border:1px solid #EF4444;border-radius:10px;padding:8px 14px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)";
      (document.body || document.documentElement).appendChild(b);
    }
    b.textContent = msg;
  }

  /* ---------- merging server rows into what the browser already has ---------- */
  function mergeChat(a, b) {
    const m = new Map();
    [].concat((a && a.msgs) || [], (b && b.msgs) || []).forEach(x => m.set(x.ts + "|" + x.from + "|" + x.text, x));
    const sa = (a && a.seen) || {}, sb = (b && b.seen) || {};
    return { id: (b && b.id) || (a && a.id), msgs: [...m.values()].sort((x, y) => x.ts - y.ts).slice(-200),
      seen: { student: Math.max(+sa.student || 0, +sb.student || 0), tutor: Math.max(+sa.tutor || 0, +sb.tutor || 0) } };
  }
  function mergeList(local, server) {                                   // notifications: by id; "read" never goes back to unread
    const m = new Map(local.map(n => [n.id, n]));
    server.forEach(n => { const o = m.get(n.id); m.set(n.id, o ? Object.assign({}, n, { read: !!(o.read || n.read) }) : n); });
    return [...m.values()].sort((x, y) => x.ts - y.ts).slice(-100);
  }

  /* Writes the shared part from the server into localStorage. Returns the keys that changed (so the apps can react). */
  function applyShared(sh) {
    const changed = [];
    const put = (key, val) => {
      const str = JSON.stringify(val);
      if (rawGet(key) !== str) { rawSet(key, str); changed.push(key); }
      return str;
    };
    if (sh.profiles && Object.keys(sh.profiles).length) {
      const all = rd("uts_tutor_profiles", {});
      Object.keys(sh.profiles).forEach(k => {
        const mine = k === email, loc = all[k], srv = sh.profiles[k];
        all[k] = mine && loc && (loc.updated || 0) > (srv.updated || 0) ? loc : srv;       // my own newest edit wins until it is saved
        if (all[k] === srv) sent.set("profiles|" + k, JSON.stringify(srv));
      });
      put("uts_tutor_profiles", all);
    }
    if (sh.chats && Object.keys(sh.chats).length) {
      const all = rd("uts_chats", {});
      Object.keys(sh.chats).forEach(k => { all[k] = mergeChat(all[k], sh.chats[k]); sent.set("chats|" + k, JSON.stringify(sh.chats[k])); });
      put("uts_chats", all);
    }
    ["notifs", "tnotifs"].forEach(c => {
      if (!sh[c] || !sh[c].length) return;
      const key = COLL_KEY[c], merged = mergeList(rd(key, []), sh[c]);
      sh[c].forEach(n => sent.set(c + "|" + n.id, JSON.stringify(n)));
      put(key, merged);
    });
    return changed;
  }

  /* ---------- download everything for this account (before the app starts) ---------- */
  async function pull() {
    const r = await call("/state");
    email = norm(r.email);
    // Data saved in this browser by an earlier version (before the database existed) is real work: keep it and upload it below.
    // Old demo copies were never marked "fresh" - those are dropped.
    const mineProf = rd("uts_tutor_profiles", {})[email];
    const mineChats = Object.entries(rd("uts_chats", {})).filter(([id]) => id.split("|").includes(email));
    Object.keys(ls).forEach(k => {
      if (!PRIVATE.some(p => k.startsWith(p)) || k in r.state) return;
      const v = rd(k, null); if (!(v && v.fresh)) rawRemove(k);
    });
    ["uts_tutor_profiles", "uts_chats", "uts_notifs", "uts_tnotifs"].forEach(k => rawRemove(k));
    sent.clear();
    Object.keys(r.state).forEach(k => { const s = JSON.stringify(r.state[k]); rawSet(k, s); sent.set("private:" + k, s); });
    applyShared(r.shared);
    if (mineProf && !(r.shared.profiles || {})[email]) { const all = rd("uts_tutor_profiles", {}); all[email] = mineProf; rawSet("uts_tutor_profiles", JSON.stringify(all)); }
    if (mineChats.length) { const all = rd("uts_chats", {}); mineChats.forEach(([id, c]) => { all[id] = mergeChat(all[id], c); }); rawSet("uts_chats", JSON.stringify(all)); }
    since = new Date(Date.parse(r.at) - OVERLAP_MS).toISOString();
  }

  /* ---------- upload what changed ---------- */
  function pendingWrites() {
    const out = [];
    Object.keys(ls).forEach(k => {
      if (!PRIVATE.some(p => k.startsWith(p)) || !k.endsWith(":" + email)) return;      // only this account's own data
      const s = rawGet(k); if (s !== null && sent.get("private:" + k) !== s) out.push({ id: "private:" + k, path: "/state/private/" + encodeURIComponent(k), str: s });
    });
    const prof = rd("uts_tutor_profiles", {});
    if (prof[email]) { const s = JSON.stringify(prof[email]); if (sent.get("profiles|" + email) !== s) out.push({ id: "profiles|" + email, path: "/state/shared/profiles/" + encodeURIComponent(email), str: s }); }
    const chats = rd("uts_chats", {});
    Object.keys(chats).forEach(k => { const s = JSON.stringify(chats[k]); if (sent.get("chats|" + k) !== s) out.push({ id: "chats|" + k, path: "/state/shared/chats/" + encodeURIComponent(k), str: s }); });
    [["notifs", "uts_notifs"], ["tnotifs", "uts_tnotifs"]].forEach(([c, key]) => rd(key, []).forEach(n => {
      const s = JSON.stringify(n); if (sent.get(c + "|" + n.id) !== s) out.push({ id: c + "|" + n.id, path: "/state/shared/" + c + "/" + encodeURIComponent(n.id), str: s, notif: true, to: norm(n.to) });
    }));
    return out;
  }
  async function flush() {
    if (!ready) return;
    if (flushing) { again = true; return; }
    flushing = true;
    try {
      for (const w of pendingWrites()) {
        try {
          await call(w.path, { method: "PUT", body: { data: JSON.parse(w.str) } });
          sent.set(w.id, w.str);
        } catch (e) {
          if (e.code === "AUTH") return;
          if (e.code === "FORBIDDEN" || e.status === 403 || e.status === 400 || e.status === 413) { sent.set(w.id, w.str); console.warn("UTSSync: server refused", w.id, e.message); }   // do not retry what can never succeed
          else throw e;
        }
      }
      failing = 0; bar("");
    } catch (e) {
      failing++; if (failing >= 2) bar("Could not save your changes to the server. Retrying…");
      clearTimeout(timer); timer = setTimeout(flush, 4000);
    } finally { flushing = false; if (again) { again = false; schedule(); } }
  }
  function schedule() { if (!ready) return; clearTimeout(timer); timer = setTimeout(flush, FLUSH_MS); }

  // every write the apps make to their keys is picked up here (our own writes use rawSet and do not trigger this)
  const isOurs = k => k in SHARED || PRIVATE.some(p => String(k).startsWith(p));
  const proto = Object.getPrototypeOf(ls), origSet = proto.setItem, origRemove = proto.removeItem;
  proto.setItem = function (k, v) { const r = origSet.call(this, k, v); if (this === ls && isOurs(k)) schedule(); return r; };
  proto.removeItem = function (k) { const r = origRemove.call(this, k); if (this === ls && isOurs(k)) schedule(); return r; };

  /* ---------- keep shared data fresh ---------- */
  let polling = false;
  async function poll() {
    if (!ready || polling || document.hidden) return;
    polling = true;
    try {
      const r = await call("/state/shared?since=" + encodeURIComponent(since));
      const changed = applyShared(r.shared);
      since = new Date(Date.parse(r.at) - OVERLAP_MS).toISOString();
      changed.forEach(k => { try { window.dispatchEvent(new StorageEvent("storage", { key: k, storageArea: ls })); } catch (e) { } });
    } catch (e) { /* the next tick tries again; the apps keep working with what they have */ }
    finally { polling = false; }
  }

  /* ---------- start: download, then load the app scripts in order ---------- */
  function loadScripts(list) {
    return list.reduce((p, src) => p.then(() => new Promise((ok, no) => {
      const s = document.createElement("script"); s.src = src; s.async = false; s.onload = ok; s.onerror = () => no(new Error("Could not load " + src));
      document.body.appendChild(s);
    })), Promise.resolve());
  }
  function fatal(msg) {
    document.body.innerHTML = `<div style="max-width:440px;margin:18vh auto;padding:24px;font:15px Inter,system-ui,sans-serif;text-align:center">
      <h2 style="margin:0 0 8px">Cannot load your data</h2><p style="color:#555">${String(msg).replace(/[<>&]/g, "")}</p>
      <p><button id="uts-retry" style="padding:10px 18px;border-radius:10px;border:0;background:#1D4ED8;color:#fff;font-weight:600;cursor:pointer">Try again</button></p></div>`;
    document.getElementById("uts-retry").onclick = () => location.reload();
  }
  async function start(scripts) {
    if (!token()) return expired();
    try { await pull(); } catch (e) { if (e.code === "AUTH") return; return fatal(e.code === "NETWORK" ? e.message + ". Start the backend and try again." : e.message); }
    ready = true;
    setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
    window.addEventListener("focus", poll);
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", () => { pendingWrites().forEach(w => { try { fetch(API + w.path, { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() }, body: JSON.stringify({ data: JSON.parse(w.str) }) }).catch(() => { }); } catch (e) { } }); });
    try { await loadScripts(scripts); } catch (e) { fatal(e.message); }
    flush();                                                               // an app may have saved something while starting
  }

  window.UTSSync = { start, flush, poll, get email() { return email; } };
})();
