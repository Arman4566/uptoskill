# UpToSkill server (Lane A)

## Setup
```bash
cd backend
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate            # applies db/schema.sql (db:reset drops everything first)
npm run db:seed               # demo users, skills, slots (password for all: demo1234). Safe to re-run.
npm run dev                   # API on :4000
npm run test:race             # 20-way parallel accept/complete/cancel checks
```

## Payments (simulated) and video

Prices, fee and credit value are set in `.env` (see `.env.example`). Defaults: 1 credit = Rs 1, 5% website fee.

**How the 5% works.** The website adds its fee on top of what the tutor earns. A 15 minute lesson is worth 95 credits to the tutor, so the student sees and pays 100. When the tutor completes the lesson, 100 held credits become 95 to the tutor and 5 to the website (a ledger row for the `platform@uptoskill.internal` account, whose balance is website revenue). The tutor's price per length is `TUTOR_PRICE_TABLE` in `lib/price.js`.

**SimPay: the built-in simulated gateway.** There is no outside payment company. `services/simpay.js` is a pretend gateway plus a pretend bank that lives in your own database (tables `simpay_*`). Every user gets a SimBank account with Rs 10,000 of pretend money (`SIMPAY_OPENING_BALANCE_RUPEES`). Money and credits still move exactly like they would for real: only the other side of the wire is pretend.

**Money -> credits (buying).** `POST /payments/orders {credits}` (the server works out the rupees) -> the checkout window calls `POST /simpay/pay` (card, UPI or net banking) -> SimPay takes the money out of the SimBank account in one transaction and returns `{orderId, paymentId, signature}` -> the browser sends that to `POST /payments/verify`. Credits are added only after the signature checks out AND SimPay itself reports the payment as captured for the right order and amount. A moment later SimPay also calls the shop on its own (`SIMPAY_WEBHOOK_DELAY_MS`), which covers a browser that closed early. Both paths are idempotent, so credits can never be added twice, and an order can be paid only once even if checkout is clicked five times at once.

**Credits -> money (withdrawing).** The tutor saves a UPI id or bank account (`PUT /payouts/account`), then `POST /payouts/withdraw {credits}`. Credits leave the ledger first, then the payout is sent with an idempotency key. The pretend bank "processes" it for `SIMPAY_PAYOUT_DELAY_MS` (8 s), then the money lands in the tutor's SimBank account and the payout becomes `paid` (a sweeper runs every 2 s). If the bank declines, or the gateway refuses, the credits come back (once). If the outcome is unknown, the payout stays queued and a minute-by-minute sweeper retries with the same key. Only credits earned by teaching can be withdrawn; bought, starter and bonus credits can only be spent.

**Test instruments** (also shown in the wallet page):
| Where | Works | Fails |
|---|---|---|
| Card | `4111 1111 1111 1111` or `5555 5555 5555 4444`, any future expiry, any 3-digit CVV, OTP `123456` | `4000 0000 0000 0002` declined, `4000 0000 0000 9995` no funds, wrong OTP |
| UPI | any `name@bank` | `fail@anything` is declined by the payer |
| Net banking | SBI, HDFC, ICICI, Axis | "Test Bank (always down)" |
| Withdraw to | any `name@bank` (paid after ~8 s) | `fail@bank` or an account number ending `0000` is declined after ~8 s and the credits come back; `reject@bank` is refused at once |

Demo seed: `neha@demo.test` starts with 500 credits of teaching earnings so a withdrawal can be tried straight away. `riya@demo.test` can buy credits.

**Video (Daily.co).** `POST /sessions/:id/video-token` creates the private room `uts-s<id>` on first use and returns a personal token. The tutor is the room owner and recording starts automatically when they join (cloud recording, needs a paid Daily plan). Both people can share their screen. When Daily finishes processing, its webhook adds a row to `recordings`, and `GET /recordings/:id/play` gives either participant a one hour playback link.

### Set-up checklist
1. `cp .env.example .env`, set `DATABASE_URL`, `JWT_SECRET` and `SIMPAY_SECRET` (any long random string). Nothing else is needed for payments.
2. `npm run db:migrate` (safe on an existing database; it also renames the old `razorpay_*` columns to `gateway_*`).
3. Video (optional): `DAILY_API_KEY`, `DAILY_DOMAIN`, and a `DAILY_WEBHOOK_SECRET` (any base64 string, for example `openssl rand -base64 32`). Then `PUBLIC_URL=https://YOUR_API npm run daily:webhook`. Webhooks need a public https address; locally use a tunnel such as ngrok.
4. `npm run test:unit`, then `npm run test:money`.

### Tests
`npm run test:unit` needs nothing (fee maths, checkout and Daily signature checks).
`npm run test:money` needs the database; it runs the real SimPay simulator (only Daily is faked) and checks declined payments, racing checkouts, double-credit, double-withdraw, declined and rejected payouts, refunds, retries, the 95 -> 100 split, and who may watch a recording.
`npm run test:race` is the original ledger concurrency test, updated for the new prices.

## Contract so far
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register, /auth/login | register writes the 10-credit `starter` ledger row |
| GET | /me, /me/ledger | balance = SUM(delta); `creditsInEscrow` shown separately |
| POST | /sessions | body: mentorId, minutes (15/30/45), title, problemText, tags[], difficulty?, slotId? |
| GET | /sessions, /sessions/:id | participants only |
| POST | /sessions/:id/accept, decline, cancel, start, complete | state machine; money moves inside these (complete pays tutor + website fee) |
| POST | /sessions/:id/video-token | join the lesson: `{role, roomUrl, token, recording, session}` |
| GET | /sessions/:id/recordings | recordings of a lesson (participants only) |
| GET | /recordings/:id/play | `{url, expiresAt}` temporary playback link |
| GET | /mentors | tutors the learner can book, with the price of each length |
| GET | /payments/config, /payments | rates + `mode: simulated`; my purchases |
| POST | /payments/orders, /payments/verify | buy credits |
| GET | /payouts | withdrawable credits, saved account, withdrawal history |
| PUT | /payouts/account | save UPI id or bank account |
| POST | /payouts/withdraw | `{credits}` cash out earnings |
| GET | /simpay/bank, /simpay/feed | my SimBank balance + movements; live feed of charges and withdrawals |
| POST | /simpay/pay | the checkout window: `{orderId, method: card/upi/netbanking, ...}` -> signed proof |
| POST | /webhooks/daily | called by Daily, signature checked, no login |

Errors are `{ error: CODE, message }`. Common codes: INSUFFICIENT_CREDITS (402), INVALID_TRANSITION (409), MENTOR_LEVEL_TOO_LOW (403), BAD_JSON (400).

## Levels
Completing a session counts it for the mentor and promotes them automatically (never demotes):
level 2 at 3 sessions given, level 3 at 10 sessions and rating 4.0+, level 4 at 25 sessions and rating 4.5+.
Mentors with no ratings yet are not held back by the rating rule. A learner can only book a mentor of a higher level.

## CORS
`CLIENT_ORIGIN` is a comma-separated list. The example allows Vite (5173), VS Code Live Server (5500/5501) and
`null` (index.html opened by double-click). Leave it empty to allow any origin (development only).

## For Lane C (realtime)
Services emit on `lib/events.js` after commit: `session:status` `{sessionId,status,session}` and `credits:updated` `{userId}`.
`index.js` exports `server` so Socket.IO can attach to it.

## For Lane D (seed)
`db/seed.sql` is the reference for how to insert users and ledger rows (`ref_type`, `ref_id` are NOT NULL).
`skills.name` is the tag vocabulary; session tags must exist there.
