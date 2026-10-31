/* UpToSkill shared browser store: used by BOTH the tutor app and the student app (same origin).
   - Tutor public profile  (photo, qualifications, intro video info)  -> localStorage "uts_tutor_profiles"
   - Intro video file                                                   -> IndexedDB  "uts_media" (too big for localStorage)
   - Notifications tutor -> student                                      -> localStorage "uts_notifs"
   - Notifications student -> tutor (e.g. lecture delayed)               -> localStorage "uts_tnotifs"
   - Student <-> tutor chat threads                                      -> localStorage "uts_chats"
   When the backend is connected, replace the bodies of these functions with fetch() calls; the callers stay the same. */
(function () {
  "use strict";
  const PK = "uts_tutor_profiles", NK = "uts_notifs", TNK = "uts_tnotifs", CK = "uts_chats";
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const norm = e => String(e || "").trim().toLowerCase();

  /* ---------- tutor public profile ---------- */
  const getProfile = email => rd(PK, {})[norm(email)] || { photo: "", qualifications: [], video: null };
  function setProfile(email, patch) {
    const all = rd(PK, {}), k = norm(email);
    all[k] = { ...getProfile(email), ...patch, updated: Date.now() };
    return wr(PK, all);
  }

  /* ---------- image: any picture -> 320px square JPEG data URL (small enough for localStorage) ---------- */
  function squarePhoto(src, size) {
    size = size || 320;
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        res(c.toDataURL("image/jpeg", .85));
      };
      img.onerror = () => rej(new Error("That file is not a readable image."));
      img.src = src;
    });
  }
  function photoFromFile(file) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej(new Error("Please choose an image file."));
      if (file.size > 15 * 1024 * 1024) return rej(new Error("Image is too large (max 15 MB)."));
      const u = URL.createObjectURL(file);
      squarePhoto(u).then(d => { URL.revokeObjectURL(u); res(d); }, e => { URL.revokeObjectURL(u); rej(e); });
    });
  }

  /* ---------- video rules: max 60 s, ratio 9:16 (portrait) or 16:9 (landscape) ---------- */
  const VIDEO = { maxSec: 60, maxBytes: 150 * 1024 * 1024, tol: 0.03 };
  function probeVideo(file) {
    return new Promise((res, rej) => {
      const v = document.createElement("video"), u = URL.createObjectURL(file);
      const done = (f, x) => { URL.revokeObjectURL(u); f(x); };
      v.preload = "metadata"; v.muted = true; v.playsInline = true;
      v.onloadedmetadata = () => done(res, { duration: v.duration, w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => done(rej, new Error("This video cannot be read. Try an MP4 or MOV file."));
      v.src = u;
    });
  }
  function ratioOf(w, h) {
    const r = w / h, near = (a, b) => Math.abs(a - b) / b <= VIDEO.tol;
    return near(r, 9 / 16) ? "9:16" : near(r, 16 / 9) ? "16:9" : null;
  }
  async function checkVideo(file) {
    if (!file || !/^video\//.test(file.type)) throw new Error("Please choose a video file.");
    if (file.size > VIDEO.maxBytes) throw new Error("Video file is too large (max 150 MB).");
    const m = await probeVideo(file);
    if (!isFinite(m.duration) || m.duration <= 0) throw new Error("Could not read the video length.");
    if (m.duration > VIDEO.maxSec + 0.4) throw new Error(`Video is ${Math.round(m.duration)} s long. The limit is 1 minute.`);
    const ratio = ratioOf(m.w, m.h);
    if (!ratio) throw new Error(`Video is ${m.w}×${m.h}. Only 9:16 (portrait) or 16:9 (landscape) is allowed.`);
    return { duration: Math.round(m.duration * 10) / 10, w: m.w, h: m.h, ratio, size: file.size, type: file.type };
  }

  /* ---------- IndexedDB for the video blob ---------- */
  const db = () => new Promise((res, rej) => {
    const r = indexedDB.open("uts_media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("video");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("video", mode), q = fn(t.objectStore("video")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  async function saveVideo(email, file) {
    const meta = await checkVideo(file);
    await tx("readwrite", s => s.put(file, norm(email)));
    setProfile(email, { video: { ...meta, ts: Date.now() } });
    return meta;
  }
  const getVideo = email => tx("readonly", s => s.get(norm(email))).catch(() => null);
  async function removeVideo(email) { await tx("readwrite", s => s.delete(norm(email))); setProfile(email, { video: null }); }

  /* ---------- notifications (tutor -> student) ---------- */
  function notify(toEmail, n) {
    if (!toEmail) return false;
    const all = rd(NK, []);
    all.push({ ...n, id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), to: norm(toEmail), ts: Date.now(), read: false });   // recipient fields last so a payload can never overwrite them
    return wr(NK, all.slice(-100));
  }
  const notifications = email => rd(NK, []).filter(n => n.to === norm(email)).sort((a, b) => b.ts - a.ts);
  function markRead(email) { const all = rd(NK, []); all.forEach(n => { if (n.to === norm(email)) n.read = true; }); wr(NK, all); }

  /* ---------- notifications (student -> tutor) ---------- */
  function notifyTutor(toEmail, n) {
    if (!toEmail) return false;
    const all = rd(TNK, []);
    all.push({ ...n, id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), to: norm(toEmail), ts: Date.now(), read: false });
    return wr(TNK, all.slice(-100));
  }
  const tutorNotifications = email => rd(TNK, []).filter(n => n.to === norm(email)).sort((a, b) => a.ts - b.ts);
  function markTutorRead(email) { const all = rd(TNK, []); all.forEach(n => { if (n.to === norm(email)) n.read = true; }); wr(TNK, all); }

  /* ---------- chat: one thread per (student, tutor) pair ---------- */
  const threadId = (student, tutor) => norm(student) + "|" + norm(tutor);
  function chatThread(id) { const c = rd(CK, {})[id]; return c || { id, msgs: [], seen: { student: 0, tutor: 0 } }; }
  function chatSend(id, from, name, text, sim) {
    text = String(text || "").trim().slice(0, 500); if (!text) return false;
    const all = rd(CK, {}), c = all[id] || { id, msgs: [], seen: { student: 0, tutor: 0 } };
    c.msgs.push({ from, name, text, ts: Date.now(), sim: !!sim }); c.msgs = c.msgs.slice(-200);
    c.seen[from] = Date.now(); all[id] = c; return wr(CK, all);
  }
  function chatSeen(id, role) { const all = rd(CK, {}); if (!all[id]) return; all[id].seen[role] = Date.now(); wr(CK, all); }
  /* threads where this tutor is the second half of the id, newest first, with an unread count (student messages after the tutor last looked) */
  function tutorThreads(tutorEmail) {
    const t = norm(tutorEmail), all = rd(CK, {});
    return Object.values(all).filter(c => c.id.split("|")[1] === t).map(c => ({ ...c, student: c.id.split("|")[0], unread: c.msgs.filter(m => m.from === "student" && m.ts > (c.seen.tutor || 0)).length }))
      .sort((a, b) => (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0));
  }

  window.UTSShared = { getProfile, setProfile, photoFromFile, squarePhoto, VIDEO, checkVideo, ratioOf, saveVideo, getVideo, removeVideo, notify, notifications, markRead, notifyTutor, tutorNotifications, markTutorRead, threadId, chatThread, chatSend, chatSeen, tutorThreads };
})();
