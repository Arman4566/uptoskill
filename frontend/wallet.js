/* Wallet: buy credits through SimPay (simulated checkout), withdraw earnings to a pretend UPI / bank account,
   watch every rupee and credit move live. Nothing here is real money. */
(function () {
  const { api, boot, logout, esc, inr, when, toast } = UTSApi;
  const $ = s => document.querySelector(s);
  document.getElementById("out").onclick = logout;
  const REASON = { starter: "Welcome credits", hold: "Held for a lesson", release: "Lesson hold released", payout: "Lesson earnings", bonus: "5-star bonus", bounty_hold: "Bounty hold", bounty_payout: "Bounty earnings", bounty_refund: "Bounty refund", purchase: "Bought credits", fee: "Website fee", withdraw_hold: "Withdrawal", withdraw_refund: "Withdrawal returned" };
  const CHIP = { paid: "ok", processing: "warn", queued: "warn", failed: "bad", reversed: "bad", created: "warn" };
  let me, cfg, pick = 500, kind = "upi", lastW = null, lastInFlight = -1;
  const PAYSTATE = { processing: "on its way", queued: "on its way", paid: "received", failed: "failed", reversed: "reversed", captured: "paid", processed: "received" };
  const FEEDCHIP = { captured: "ok", processed: "ok", failed: "bad", processing: "warn" };

  async function start(user) {
    me = user; cfg = await api("/payments/config");
    $("#app").innerHTML = `<div><h1>Wallet</h1><p class="mut">1 credit = ${inr(cfg.creditPricePaise)}. Lesson prices already include the ${cfg.platformFeePct}% website fee.</p></div>
      <div class="sim-banner"><b>SIMULATION</b> Payments run through SimPay, a built-in pretend gateway and bank. You get a pretend bank account (SimBank) to pay from and withdraw into. No real money moves.</div>
      <div class="stats" id="stats"></div>
      <section class="card pad" id="buy"></section>
      <div class="grid2"><section class="card pad"><h2>SimBank account</h2><p class="mut">Your pretend bank. Buying credits takes money out, withdrawals put it in.</p><div id="bank"></div></section>
      <section class="card pad"><div class="row" style="justify-content:space-between;align-items:center"><h2>Live money feed</h2><span class="live"><i></i>live</span></div><div class="feed" id="feed"></div></section></div>
      <section class="card pad" id="wd"></section>
      <section class="card pad"><h2>Credit history</h2><div id="ledger"></div></section>`;
    drawBuy(); await refresh(true);
    setInterval(() => { if (!document.hidden) refresh(false).catch(() => { }); }, 2000);   // live: money and credits update by themselves
  }

  const inflight = w => w.payouts.filter(p => p.status === "queued" || p.status === "processing").length;
  const money = p => (p > 0 ? "+" : "-") + inr(Math.abs(p));

  // full = also redraw the forms (first load, after an action). The 2-second poll leaves the forms alone so typing is never wiped.
  async function refresh(full) {
    const [m, w, led, pays, bank, feed] = await Promise.all([api("/me"), api("/payouts"), api("/me/ledger"), api("/payments"), api("/simpay/bank"), api("/simpay/feed")]);
    $("#stats").innerHTML = [
      ["Credits you can spend", m.balance, `${inr(m.balance * cfg.creditPricePaise)} in value`],
      ["Credits you can withdraw", w.withdrawable, "Only credits earned by teaching"],
      ["Held for lessons", m.creditsInEscrow, "Released when the lesson ends"]
    ].map(([a, b, c]) => `<div class="card stat"><small>${a}</small><b>${b}</b><small>${c}</small></div>`).join("");
    $("#bank").innerHTML = `<div class="bankbal">${inr(bank.balancePaise)}</div><small class="mut">available in SimBank</small>
      <table style="margin-top:10px"><tbody>${bank.entries.slice(0, 6).map(e => `<tr><td>${when(e.created_at)}</td><td>${esc(e.note)}</td><td class="${e.delta_paise > 0 ? "pos" : "neg"}">${money(e.delta_paise)}</td></tr>`).join("")}</tbody></table>`;
    $("#feed").innerHTML = feed.length ? feed.map(f => {
      const out = f.kind === "charge";
      return `<div class="item"><span><b>${out ? "Bought credits" : "Withdrawal"}</b> &middot; <span class="${out ? "amt-out" : "amt-in"}">${out ? "-" : "+"}${inr(f.amount_paise)}</span><br><small class="mut">${when(f.created_at)} &middot; ${esc(f.detail || "")}${f.note && f.status === "failed" ? " &middot; " + esc(f.note) : ""}</small></span><span class="chip ${FEEDCHIP[f.status] || ""}">${f.status === "processing" ? "on its way" : f.status === "captured" ? "paid" : f.status === "processed" ? "received" : f.status}</span></div>`;
    }).join("") : `<p class="mut">No money has moved yet. Buy some credits to see it here.</p>`;
    lastW = w;
    if (full || !$("#acct") || (inflight(w) !== lastInFlight && $("#acct").hidden)) drawWithdraw(w);
    else $("#pl").innerHTML = payoutList(w);
    lastInFlight = inflight(w);
    $("#ledger").innerHTML = led.entries.length ? `<table><thead><tr><th>When</th><th>What</th><th>Credits</th></tr></thead><tbody>${led.entries.map(e => `<tr><td>${when(e.created_at)}</td><td>${esc(REASON[e.reason] || e.reason)}</td><td class="${e.delta > 0 ? "pos" : "neg"}">${e.delta > 0 ? "+" : ""}${e.delta}</td></tr>`).join("")}</tbody></table>` : `<p class="mut">Nothing yet.</p>`;
    const pl = $("#paylist"); if (pl) pl.innerHTML = pays.length ? pays.slice(0, 5).map(p => `<div class="item"><span>${p.credits} credits &middot; ${inr(p.amount_paise)}<br><small class="mut">${when(p.created_at)}</small></span><span class="chip ${CHIP[p.status]}">${p.status === "created" ? "not completed" : p.status}</span></div>`).join("") : "";
  }

  /* ---------- buy ---------- */
  function drawBuy() {
    $("#buy").innerHTML = `<h2>Buy credits</h2><p class="mut">Pay with a card, UPI or net banking in the SimPay checkout window. The money comes out of your SimBank account and credits appear straight away.</p>
      <div class="chips" id="presets">${[100, 500, 1000, 2000].map(n => `<button class="choice ${n === pick ? "on" : ""}" data-n="${n}">${n} credits</button>`).join("")}</div>
      <div class="row" style="margin-top:14px"><label>Or enter credits<input id="cr" type="number" min="${cfg.minPurchaseCredits}" max="${cfg.maxPurchaseCredits}" step="1" value="${pick}"></label>
      <button class="btn orange" id="pay">Pay <span id="amt"></span></button></div><div id="paylist" style="margin-top:12px"></div>`;
    const upd = () => { pick = Math.floor(Number($("#cr").value) || 0); $("#amt").textContent = inr(pick * cfg.creditPricePaise); document.querySelectorAll("#presets .choice").forEach(b => b.classList.toggle("on", Number(b.dataset.n) === pick)); };
    document.querySelectorAll("#presets .choice").forEach(b => b.onclick = () => { $("#cr").value = b.dataset.n; upd(); });
    $("#cr").oninput = upd; upd();
    $("#pay").onclick = buy;
  }

  async function buy() {
    const btn = $("#pay"); btn.disabled = true;
    try {
      const o = await api("/payments/orders", { method: "POST", body: { credits: pick } });
      SimPay.open({
        orderId: o.orderId, amountPaise: o.amountPaise, credits: o.credits,
        onClose: () => { btn.disabled = false; refresh(true).catch(() => { }); },
        onPaid: async r => {
          // The shop only trusts the signed proof from the server, never the browser's word that it paid.
          const out = await api("/payments/verify", { method: "POST", body: { orderId: r.orderId, paymentId: r.paymentId, signature: r.signature } });
          refresh(false).catch(() => { });
          return out.status === "paid" ? `${out.credits} credits added to your wallet.` : "Payment received. Credits will appear in a moment.";
        }
      });
    } catch (e) { toast(e.message); btn.disabled = false; }
  }

  /* ---------- withdraw ---------- */
  function payoutList(w) {
    return w.payouts.map(p => {
      const live = p.status === "queued" || p.status === "processing", bad = p.status === "failed" || p.status === "reversed";
      const trk = `<div class="trk"><span class="done">credits taken</span><em></em><span class="${bad ? "bad" : live ? "on" : "done"}">${bad ? "declined" : "sent to bank"}</span><em></em><span class="${p.status === "paid" ? "done" : ""}">money received</span></div>`;
      return `<div class="item"><span>${p.credits} credits &rarr; ${inr(p.amount_paise)}<br><small class="mut">${when(p.created_at)}${p.failure_reason && bad ? " &middot; " + esc(p.failure_reason) + " &middot; credits returned" : ""}</small></span>${trk}<span class="chip ${CHIP[p.status]}">${PAYSTATE[p.status] || p.status}</span></div>`;
    }).join("");
  }

  function drawWithdraw(w) {
    const a = w.account;
    $("#wd").innerHTML = `<h2>Withdraw earnings</h2><p class="mut">Credits you earned by teaching are sent to your SimBank account (pretend money), ${inr(w.creditPricePaise)} per credit. Credits you bought or were given can be spent on lessons but not withdrawn.</p>
      ${a ? `<p>Paying to <b>${esc(a.label)}</b> (${a.kind === "upi" ? "UPI" : "bank account"}) <button class="btn ghost" id="chg" style="min-height:34px;margin-left:8px">Change</button></p>` : `<p class="note">Add where to send your money first.</p>`}
      <form id="acct" ${a ? "hidden" : ""} class="row" style="flex-direction:column;align-items:stretch;max-width:420px">
        <div class="chips"><button type="button" class="choice ${kind === "upi" ? "on" : ""}" data-k="upi">UPI</button><button type="button" class="choice ${kind === "bank" ? "on" : ""}" data-k="bank">Bank account</button></div>
        ${kind === "upi" ? `<label>UPI id<input id="upi" placeholder="name@bank" required></label>` : `<label>Name on account<input id="bn" required></label><label>IFSC<input id="ifsc" placeholder="HDFC0001234" required></label><label>Account number<input id="an" inputmode="numeric" required></label>`}
        <p class="err" id="ae" hidden></p><button class="btn">Save payout details</button></form>
      <div class="row" style="margin-top:12px"><label>Credits to withdraw<input id="wc" type="number" min="${w.minWithdrawCredits}" max="${Math.min(w.maxWithdrawCredits, w.withdrawable)}" value="${Math.min(w.withdrawable, w.minWithdrawCredits) >= w.minWithdrawCredits ? w.withdrawable : ""}" ${!a ? "disabled" : ""}></label>
      <button class="btn" id="wbtn" ${!a || w.withdrawable < w.minWithdrawCredits ? "disabled" : ""}>Withdraw <span id="wamt"></span></button></div>
      <p class="mut">Minimum ${w.minWithdrawCredits} credits. ${w.withdrawable < w.minWithdrawCredits ? `You can withdraw once you have earned ${w.minWithdrawCredits} credits teaching.` : ""}</p>
      <p class="hint">Test payees: any <b>name@bank</b> is paid after a few seconds. <b>fail@bank</b> is declined by the pretend bank (credits come back). <b>reject@bank</b> is refused at once.</p>
      <div id="pl">${payoutList(w)}</div>`;
    document.querySelectorAll("#acct .choice").forEach(b => b.onclick = () => { kind = b.dataset.k; drawWithdraw(w); $("#acct").hidden = false; });
    const chg = $("#chg"); if (chg) chg.onclick = () => { $("#acct").hidden = false; };
    $("#acct").onsubmit = async ev => {
      ev.preventDefault();
      const body = kind === "upi" ? { kind, upi: $("#upi").value } : { kind, name: $("#bn").value, ifsc: $("#ifsc").value, accountNumber: $("#an").value };
      try { await api("/payouts/account", { method: "PUT", body }); toast("Payout details saved."); refresh(true); }
      catch (e) { const el = $("#ae"); el.hidden = false; el.textContent = e.code === "VALIDATION" ? "Please check the details you entered." : e.message; }
    };
    const upd = () => { $("#wamt").textContent = inr((Number($("#wc").value) || 0) * w.creditPricePaise); }; upd(); $("#wc").oninput = upd;
    $("#wbtn").onclick = async () => {
      const credits = Math.floor(Number($("#wc").value));
      if (!confirm(`Withdraw ${credits} credits (${inr(credits * w.creditPricePaise)}) to ${a.label}?`)) return;
      $("#wbtn").disabled = true;
      try { await api("/payouts/withdraw", { method: "POST", body: { credits } }); toast("Withdrawal started. Watch the live feed: the money lands in a few seconds."); }
      catch (e) { toast(e.message); }
      refresh(true);
    };
  }

  UTSApi.boot(start);
})();
