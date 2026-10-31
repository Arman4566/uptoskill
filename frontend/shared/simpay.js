/* SimPay checkout: a pretend payment window (card, UPI, net banking) for the simulated gateway.
   No real money. The server (POST /simpay/pay) decides if the payment works and signs the proof.
   Usage: SimPay.open({ orderId, amountPaise, credits, onPaid(proof) -> Promise<string>, onClose() }) */
(function () {
  const { api, esc, inr } = UTSApi;
  const BANKS = [["SBI", "State Bank of India"], ["HDFC", "HDFC Bank"], ["ICICI", "ICICI Bank"], ["AXIS", "Axis Bank"], ["DOWN", "Test Bank (always down)"]];
  const STAGES = ["Contacting your bank", "Authorising the payment", "Capturing the money"];
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function open(o) {
    const f = { tab: "card", number: "", expiry: "", cvv: "", upi: "", bank: "SBI", otp: "" };
    let step = "form", error = "", closed = false;
    const ov = document.createElement("div");
    ov.className = "ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "SimPay checkout");
    document.body.appendChild(ov);

    function close() { if (closed) return; closed = true; document.removeEventListener("keydown", onKey); ov.remove(); o.onClose && o.onClose(); }
    function onKey(e) { if (e.key === "Escape" && step !== "processing") close(); }
    document.addEventListener("keydown", onKey);

    const head = () => `<div class="sp-h"><div><div class="logo">SimPay<small>TEST MODE</small></div><div style="font-size:13px;opacity:.85;margin-top:4px">UpToSkill · ${o.credits} credits</div></div>
      <div class="amt"><b>${inr(o.amountPaise)}</b><small>${esc(o.orderId.slice(0, 18))}</small></div>${step === "processing" ? "" : `<button class="sp-x" id="x" aria-label="Close">✕</button>`}</div>`;
    const foot = `<div class="sp-foot">Simulated payment window. No real money moves. Paid from your SimBank pretend account.</div>`;

    function draw() {
      let body = "";
      if (step === "form") body = formHTML();
      else if (step === "otp") body = `<p style="margin:0"><b>Card verification (3-D Secure)</b></p><p class="mut">Your bank sent a one-time password to your phone. In this simulation it is always <b>123456</b>.</p>
        <label>One-time password<input id="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" value="${esc(f.otp)}"></label><p class="err" id="e">${esc(error)}</p>
        <div class="row"><button class="btn ghost" id="back">Back</button><button class="btn orange" id="go" style="flex:1">Verify and pay ${inr(o.amountPaise)}</button></div>`;
      else if (step === "approve") body = `<div class="sp-phone"><b>Collect request sent</b><p class="mut">to ${esc(f.upi)}</p><p class="mut">Pretend UPI app: pay UpToSkill ${inr(o.amountPaise)}?</p>
        <div class="row" style="justify-content:center"><button class="btn ghost" id="back">Decline</button><button class="btn orange" id="go">Approve</button></div></div>`;
      else if (step === "bank") body = `<div class="sp-phone"><b>${esc((BANKS.find(b => b[0] === f.bank) || [])[1] || "Bank")} · net banking</b><p class="mut">Authorise a payment of ${inr(o.amountPaise)} to UpToSkill?</p>
        <div class="row" style="justify-content:center"><button class="btn ghost" id="back">Cancel</button><button class="btn orange" id="go">Authorise</button></div></div>`;
      else if (step === "processing") body = `<div class="sp-steps" id="stg">${STAGES.map((s, i) => `<div class="sp-step ${i === 0 ? "on" : ""}" data-i="${i}"><i>✓</i>${s}</div>`).join("")}</div>`;
      else if (step === "success") body = `<div class="sp-big"><div class="ic ok">✓</div><b style="font-size:18px">${inr(o.amountPaise)} paid</b><p class="mut" id="note">Adding ${o.credits} credits to your wallet…</p></div><button class="btn" id="done">Done</button>`;
      else body = `<div class="sp-big"><div class="ic no">✕</div><b style="font-size:18px">Payment failed</b><p class="mut">${esc(error)}</p><p class="mut">Nothing was charged.</p></div><div class="row"><button class="btn ghost" id="close2">Close</button><button class="btn orange" id="retry" style="flex:1">Try again</button></div>`;
      ov.innerHTML = `<div class="sp">${head()}<div class="sp-b">${body}</div>${foot}</div>`;
      wire();
    }

    function formHTML() {
      const tabs = [["card", "Card"], ["upi", "UPI"], ["netbanking", "Net banking"]];
      let fields = "";
      if (f.tab === "card") fields = `<label>Card number<input id="num" inputmode="numeric" autocomplete="cc-number" placeholder="4111 1111 1111 1111" maxlength="19" value="${esc(f.number)}"></label>
        <div class="sp-two"><label>Expiry<input id="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5" value="${esc(f.expiry)}"></label><label>CVV<input id="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="3" type="password" value="${esc(f.cvv)}"></label></div>
        <p class="hint">Test cards: <button type="button" data-fill="ok">4111… pays</button><button type="button" data-fill="no">4000…0002 declined</button><button type="button" data-fill="poor">4000…9995 no funds</button></p>`;
      else if (f.tab === "upi") fields = `<label>UPI id<input id="spupi" placeholder="name@bank" autocomplete="off" value="${esc(f.upi)}"></label>
        <p class="hint">Any <b>name@bank</b> pays. <button type="button" data-fill="upiok">Use me@simpay</button><button type="button" data-fill="upino">Use fail@simpay (declined)</button></p>`;
      else fields = `<label>Choose your bank<select id="bk">${BANKS.map(b => `<option value="${b[0]}" ${f.bank === b[0] ? "selected" : ""}>${b[1]}</option>`).join("")}</select></label>`;
      return `<div class="sp-tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" aria-selected="${f.tab === t[0]}" class="${f.tab === t[0] ? "on" : ""}" data-tab="${t[0]}">${t[1]}</button>`).join("")}</div>${fields}
        <p class="err" id="e" role="alert">${esc(error)}</p><button class="btn orange" id="go">Pay ${inr(o.amountPaise)}</button>`;
    }

    const $ = s => ov.querySelector(s);
    function readForm() {
      if (f.tab === "card") { f.number = ($("#num") || {}).value || ""; f.expiry = ($("#exp") || {}).value || ""; f.cvv = ($("#cvv") || {}).value || ""; }
      else if (f.tab === "upi") f.upi = ($("#spupi") || {}).value || "";
      else f.bank = ($("#bk") || {}).value || f.bank;
    }

    function wire() {
      const x = $("#x"); if (x) x.onclick = close;
      const c2 = $("#close2"); if (c2) c2.onclick = close;
      const done = $("#done"); if (done) done.onclick = close;
      const rt = $("#retry"); if (rt) rt.onclick = () => { error = ""; step = "form"; draw(); };
      const back = $("#back"); if (back) back.onclick = () => { error = ""; step = "form"; draw(); };
      ov.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { readForm(); f.tab = b.dataset.tab; error = ""; draw(); });
      ov.querySelectorAll("[data-fill]").forEach(b => b.onclick = () => {
        const v = b.dataset.fill;
        if (v === "ok" || v === "no" || v === "poor") { f.number = v === "ok" ? "4111 1111 1111 1111" : v === "no" ? "4000 0000 0000 0002" : "4000 0000 0000 9995"; f.expiry = "12/39"; f.cvv = "123"; }
        else f.upi = v === "upiok" ? "me@simpay" : "fail@simpay";
        error = ""; draw();
      });
      const num = $("#num"); if (num) num.oninput = () => { num.value = num.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); };
      const exp = $("#exp"); if (exp) exp.oninput = () => { let v = exp.value.replace(/\D/g, "").slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2); exp.value = v; };
      const otp = $("#otp"); if (otp) { otp.focus(); otp.oninput = () => { f.otp = otp.value.replace(/\D/g, ""); otp.value = f.otp; }; otp.onkeydown = e => { if (e.key === "Enter") $("#go").click(); }; }
      const go = $("#go"); if (go) go.onclick = onGo;
      const first = ov.querySelector("input,select"); if (first && step === "form") first.focus();
    }

    function onGo() {
      if (step === "form") {
        readForm(); error = "";
        if (f.tab === "card") {
          if (f.number.replace(/\s/g, "").length !== 16) { error = "Enter a 16-digit card number"; return draw(); }
          if (!/^\d{2}\/\d{2}$/.test(f.expiry)) { error = "Enter the expiry as MM/YY"; return draw(); }
          if (!/^\d{3}$/.test(f.cvv)) { error = "Enter the 3-digit CVV"; return draw(); }
          f.otp = ""; step = "otp";
        } else if (f.tab === "upi") {
          if (!/^[\w.\-]{2,256}@[\w.\-]{2,64}$/.test(f.upi.trim())) { error = "Enter a valid UPI id like name@bank"; return draw(); }
          step = "approve";
        } else step = "bank";
        return draw();
      }
      if (step === "otp" && f.otp.length !== 6) { error = "Enter the 6-digit OTP"; return draw(); }
      submit();
    }

    async function submit() {
      step = "processing"; draw();
      const body = { orderId: o.orderId, method: f.tab };
      if (f.tab === "card") { body.card = { number: f.number, expiry: f.expiry, cvv: f.cvv }; body.otp = f.otp; }
      else if (f.tab === "upi") body.upi = f.upi.trim(); else body.bank = f.bank;
      const req = api("/simpay/pay", { method: "POST", body }).then(r => ({ r }), e => ({ e }));
      for (let i = 0; i < STAGES.length; i++) {          // the three stages play for a moment so the flow is visible
        if (closed) return;
        ov.querySelectorAll(".sp-step").forEach((el, j) => { el.className = "sp-step " + (j < i ? "done" : j === i ? "on" : ""); });
        await wait(i === STAGES.length - 1 ? 500 : 650);
      }
      const out = await req;
      if (closed) return;
      if (out.e) { error = out.e.message || "The payment could not be completed"; step = "failed"; return draw(); }
      ov.querySelectorAll(".sp-step").forEach(el => { el.className = "sp-step done"; });
      await wait(250);
      step = "success"; draw();
      let msg = "Payment received.";
      try { msg = await o.onPaid(out.r); } catch (e) { msg = "Paid, but not confirmed yet: " + e.message; }
      const n = $("#note"); if (n) n.textContent = msg;
    }
    draw();
    return { close };
  }
  window.SimPay = { open };
})();
