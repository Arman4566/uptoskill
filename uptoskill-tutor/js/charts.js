/* UpToSkill Tutor - earnings chart. Every number comes from the ledger rows, nothing is hard-coded. */
"use strict";
const PERIODS = [["day", "1 Day"], ["month", "1 Month"], ["year", "1 Year"], ["total", "Total"]];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function series(period) {
  const rows = earnRows(), now = Date.now(); let buckets = [];
  if (period === "day") {                                   // last 24 hours, hourly
    const d = new Date(now); d.setMinutes(0, 0, 0); const end = d.getTime() + HR;
    for (let i = 24; i >= 1; i--) { const a = end - i * HR; buckets.push({ a, b: a + HR, label: clock(a).replace(":00", ""), tip: clock(a) + " - " + clock(a + HR) }); }
  } else if (period === "month") {                          // last 30 days, daily
    const end = startOfDay(now) + DAY;
    for (let i = 30; i >= 1; i--) { const a = end - i * DAY, d = new Date(a); buckets.push({ a, b: a + DAY, label: d.getDate() + " " + MON[d.getMonth()], tip: dayName(a) + " " + d.getDate() + " " + MON[d.getMonth()] }); }
  } else {                                                  // year = last 12 months, total = since joining
    const n = new Date(now), months = period === "year" ? 12 : Math.max(2, Math.ceil((now - S.me.joined) / (30.4 * DAY)) + 1);
    for (let i = months - 1; i >= 0; i--) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1), e = new Date(n.getFullYear(), n.getMonth() - i + 1, 1); buckets.push({ a: d.getTime(), b: e.getTime(), label: MON[d.getMonth()] + (d.getMonth() === 0 || i === months - 1 ? " " + String(d.getFullYear()).slice(2) : ""), tip: MON[d.getMonth()] + " " + d.getFullYear() }); }
  }
  buckets.forEach(k => { const r = rows.filter(x => x.ts >= k.a && x.ts < k.b); k.v = r.reduce((n, x) => n + x.delta, 0); k.n = r.length; });
  const inWin = rows.filter(x => x.ts >= buckets[0].a && x.ts < buckets[buckets.length - 1].b);
  const by = { payout: 0, bounty_payout: 0, bonus: 0 }; inWin.forEach(x => by[x.reason] += x.delta);
  const total = inWin.reduce((n, x) => n + x.delta, 0), best = buckets.reduce((m, k) => k.v > m.v ? k : m, buckets[0]);
  let run = rows.filter(x => x.ts < buckets[0].a).reduce((n, x) => n + x.delta, 0);
  buckets.forEach(k => { run += k.v; k.cum = run; });
  return { buckets, total, count: inWin.length, by, best, avg: inWin.length ? total / inWin.length : 0, cumulative: period === "total" };
}

function niceMax(v) { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

function chartSVG(sr) {
  const W = 760, H = 300, L = 42, Rr = 12, T = 14, B = 36, iw = W - L - Rr, ih = H - T - B, n = sr.buckets.length;
  const vals = sr.buckets.map(k => sr.cumulative ? k.cum : k.v), max = niceMax(Math.max(...vals, 1));
  const y = v => T + ih - v / max * ih, step = iw / n, x = i => L + step * i + step / 2;
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = max / 4 * i, yy = y(v); g += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="#DDE6F7"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#55627F">${Math.round(v * 10) / 10}</text>`; }
  const every = Math.ceil(n / 8);
  let lab = ""; sr.buckets.forEach((k, i) => { if (i % every === 0 || i === n - 1 && n < 10) lab += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#55627F">${esc(k.label)}</text>`; });
  let marks = "";
  if (sr.cumulative) {
    const pts = sr.buckets.map((k, i) => `${x(i)},${y(k.cum)}`).join(" ");
    marks += `<polygon points="${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}" fill="#EAF2FF"/><polyline points="${pts}" fill="none" stroke="#1D4ED8" stroke-width="3" stroke-linejoin="round"/>`;
    sr.buckets.forEach((k, i) => { marks += `<circle cx="${x(i)}" cy="${y(k.cum)}" r="${i === n - 1 ? 5 : 3.5}" fill="${i === n - 1 ? "#FF9A4D" : "#1D4ED8"}"/>`; });
    sr.buckets.forEach((k, i) => { marks += `<rect class="hit" tabindex="0" data-i="${i}" x="${x(i) - step / 2}" y="${T}" width="${step}" height="${ih}" fill="transparent"/>`; });
  } else {
    const bw = Math.max(3, Math.min(34, step * .66));
    sr.buckets.forEach((k, i) => { const h = Math.max(k.v ? 3 : 0, k.v / max * ih); marks += `<rect x="${x(i) - bw / 2}" y="${T + ih - h}" width="${bw}" height="${h}" rx="4" fill="${k === sr.best && k.v ? "#FF9A4D" : "#1D4ED8"}" pointer-events="none"/><rect class="hit" tabindex="0" data-i="${i}" x="${x(i) - step / 2}" y="${T}" width="${step}" height="${ih}" fill="#1D4ED8" fill-opacity="0"/>`; });
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Credits earned chart. ${sr.total} credits earned in this period." style="width:100%;height:auto;display:block">${g}${marks}${lab}</svg>`;
}

function bindChart(box, sr) {
  const tip = box.querySelector(".tip"); if (!tip) return;
  const show = e => {
    const r = e.target.closest(".hit"); if (!r) { tip.hidden = true; return; }
    const k = sr.buckets[+r.dataset.i], bb = box.getBoundingClientRect(), rb = r.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(k.tip)}</b><br>${sr.cumulative ? `Total so far: ${k.cum} credits<br>This month: +${k.v}` : `${k.v} credits · ${k.n} payout${k.n === 1 ? "" : "s"}`}`;
    tip.hidden = false; tip.style.left = Math.min(bb.width - 170, Math.max(4, rb.left - bb.left + rb.width / 2 - 80)) + "px"; tip.style.top = Math.max(0, rb.top - bb.top - 58) + "px";
  };
  box.addEventListener("mouseover", show); box.addEventListener("focusin", show); box.addEventListener("mouseleave", () => tip.hidden = true); box.addEventListener("focusout", () => tip.hidden = true);
}
