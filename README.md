# UpToSkill

```
uptoskill/
  frontend/   Landing page, student login + app, tutor login + app. Plain HTML/CSS/JS, no install.
  backend/    REST API: Node + Express + PostgreSQL (auth, credit ledger with escrow, session state machine).
```

## Run the frontend
Open `frontend/index.html` (or `cd frontend && python3 -m http.server 8000`). See `frontend/README.md`.

## Run the backend
Needs Node 18.11+ and PostgreSQL.
```bash
cd backend
cp .env.example .env     # set DATABASE_URL and a real JWT_SECRET
npm install
npm run db:migrate
npm run db:seed          # demo users, password demo1234
npm run dev              # API on http://localhost:4000, try GET /health
```
If the frontend runs on another port (for example 8000), add it to `CLIENT_ORIGIN` in `backend/.env`.

## Payments (simulated), withdrawals and video lessons
New pages (open from the student and tutor sidebars): `frontend/wallet.html` (buy credits through the SimPay checkout, withdraw, live money feed, history), `frontend/lessons.html` (book, accept, join, watch recordings), `frontend/lesson.html` (the classroom with screen share and tutor panel). They talk to the real server, so start the backend first, and sign in with a server account (`neha@demo.test` / `riya@demo.test`, password `demo1234`). Payments need no outside account: SimPay is a built-in pretend gateway and bank (every user gets a SimBank account with Rs 10,000 pretend money), so buying credits takes money out of it and withdrawing puts money into it, live. Test cards, UPI ids and set-up steps are in `backend/README.md`. Video lessons need a Daily key (optional).

## Video lessons (Jitsi) and lesson notes PDF
Lessons use Jitsi by default: free, no account, no key. The classroom page has an **Open video meeting** button; the meeting (camera, mic, Share screen) opens in a new tab because meet.jit.si cannot be embedded in other sites. The classroom tab stays open as the tutor's dashboard: timer, the student's question, **lesson notes** (typed text plus screenshots, saved automatically) and **End lesson**. When the tutor ends the lesson, the notes become a PDF; the student finds a **Notes (PDF)** button beside that lesson under Lessons and can open it any time. Jitsi's free server does not record the call. To use paid Daily recording instead, set `VIDEO_PROVIDER=daily` (see `backend/README.md`). Check it all with `npm run test:notes` in `backend/`.

## Status
The older demo screens (student/ and tutor/ apps) still save data in the browser and do not call the API. The new wallet, lessons and classroom pages are connected to the API.
