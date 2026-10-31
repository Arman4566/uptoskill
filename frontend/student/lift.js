/* UpToSkill "lift and fly to centre" card animation.

   Lift.open(card, detailHTML, { onShown, onClose })
     1. a clone of the card is lifted (small pop) and flies from its place to the centre of the screen
     2. the page behind is dimmed and blurred, the original card is left as a dashed empty slot
     3. the clone turns into the detail panel (new content fades in) and gets a pulsing glow ring
   Lift.close()  - the panel turns back into the card and flies to the dashed slot, then the slot is filled again
   Lift.closeNow() - instant teardown (used when the page re-renders underneath)

   Motion respects "reduce motion": the card then simply appears in the centre and fades out. */
(function () {
  "use strict";
  const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const EASE = "cubic-bezier(.2,.85,.25,1)", FLY_MS = 520, BACK_MS = 440;
  let st = null, after = [];

  const box = r => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const setBox = (el, b) => Object.assign(el.style, b);

  /* where the panel lands: centred, 580px wide, as tall as its content (max 90% of the screen) */
  function target(html) {
    const W = Math.min(580, innerWidth - 24), probe = document.createElement("div");
    probe.className = "card fly fly-probe"; probe.style.cssText = `left:-9999px;top:0;width:${W}px;visibility:hidden;height:auto;max-height:none`;
    probe.innerHTML = html; document.body.appendChild(probe);
    const H = Math.min(probe.offsetHeight, Math.round(innerHeight * .9)); probe.remove();
    return { left: Math.round((innerWidth - W) / 2), top: Math.round((innerHeight - H) / 2), width: W, height: H };
  }

  function lockScroll(on) {
    const b = document.body, app = document.querySelector(".app");
    if (on) { const sw = innerWidth - document.documentElement.clientWidth; st.prevPad = b.style.paddingRight; b.style.overflow = "hidden"; if (sw > 0) b.style.paddingRight = sw + "px"; if (app) app.inert = true; }
    else { b.style.overflow = ""; b.style.paddingRight = st ? st.prevPad || "" : ""; if (app) app.inert = false; }
  }

  function open(el, detailHTML, opts) {
    if (st || !el || !el.isConnected) return false;
    opts = opts || {};
    const from = el.getBoundingClientRect(), faceHTML = el.innerHTML, faceClass = el.className;
    const ov = document.createElement("div"); ov.className = "liftov"; ov.addEventListener("click", () => close());
    const fly = el.cloneNode(true); fly.removeAttribute("data-lift"); fly.classList.add("fly");
    fly.setAttribute("role", "dialog"); fly.setAttribute("aria-modal", "true"); fly.setAttribute("aria-label", opts.label || "Details");
    setBox(fly, box(from));
    st = { el, fly, ov, faceHTML, faceClass, opts, closing: false, opener: document.activeElement };
    lockScroll(true);
    document.body.append(ov, fly);
    el.classList.add("slot-empty"); el.setAttribute("aria-hidden", "true");
    requestAnimationFrame(() => ov.classList.add("on"));

    const to = target(detailHTML), swap = () => {
      if (!st || st.fly !== fly || st.closing) return;
      fly.className = "card fly"; fly.innerHTML = detailHTML;
    };
    const land = () => {
      if (!st || st.fly !== fly) return;
      setBox(fly, box({ left: to.left, top: to.top, width: to.width, height: to.height }));
      fly.classList.add("glow");
      fly.tabIndex = -1; fly.focus({ preventScroll: true });            // focus the dialog itself; Tab then reaches the close button first
      st.resize = () => { const t = target(detailHTML); setBox(fly, box({ left: t.left, top: t.top, width: t.width, height: t.height })); };
      addEventListener("resize", st.resize);
      if (opts.onShown) opts.onShown(fly);
    };

    if (reduce()) { swap(); land(); return true; }
    const a = fly.animate([
      { ...box(from), transform: "scale(1)" },
      { transform: "scale(1.045)", offset: .18 },
      { ...box({ left: to.left, top: to.top, width: to.width, height: to.height }), transform: "scale(1)" }
    ], { duration: FLY_MS, easing: EASE, fill: "forwards" });
    setTimeout(() => { if (st && st.fly === fly && !st.closing) [...fly.children].forEach(c => { c.style.transition = "opacity .14s"; c.style.opacity = "0"; }); }, FLY_MS * .26);   // card face fades out ...
    setTimeout(swap, FLY_MS * .42);                     // ... and the detail fades in while the card is mid-air
    a.onfinish = () => { if (!st || st.fly !== fly) return; swap(); land(); a.cancel(); };
    return true;
  }

  function teardown() {
    if (!st) return;
    const s = st; st = null;
    if (s.resize) removeEventListener("resize", s.resize);
    s.fly.getAnimations().forEach(a => a.cancel()); s.fly.remove(); s.ov.remove();
    if (s.el.isConnected) { s.el.classList.remove("slot-empty"); s.el.removeAttribute("aria-hidden"); }
    st = s; lockScroll(false); st = null;
    if (s.opts.onClose) s.opts.onClose();
    if (s.opener && s.opener.isConnected && s.opener.focus) { try { s.opener.focus({ preventScroll: true }); } catch (e) { } }
    const q = after; after = []; q.forEach(f => f());
  }

  function close() {
    if (!st || st.closing) return;
    const s = st; s.closing = true;
    const { fly, ov, el } = s, cur = fly.getBoundingClientRect();
    fly.classList.remove("glow"); fly.className = s.faceClass + " fly refade"; fly.innerHTML = s.faceHTML; fly.removeAttribute("data-lift");
    setBox(fly, box(cur)); ov.classList.remove("on");
    if (s.resize) { removeEventListener("resize", s.resize); s.resize = null; }
    if (reduce() || !el.isConnected) { fly.style.transition = "opacity .15s"; fly.style.opacity = "0"; return void setTimeout(teardown, 160); }
    const back = el.getBoundingClientRect();
    const a = fly.animate([
      { ...box(cur), transform: "scale(1)" },
      { ...box(back), transform: "scale(1)" }
    ], { duration: BACK_MS, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" });
    a.onfinish = teardown;
  }

  window.Lift = {
    open, close, closeNow: teardown,
    get isOpen() { return !!st; },
    afterClose(fn) { if (st) after.push(fn); else fn(); }
  };
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && st && !st.closing) { const m = document.getElementById("modal"); if (m && !m.hidden) return; close(); }
  });
})();
