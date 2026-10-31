# UpToSkill

```
uptoskill/
  frontend/   Landing page, student login + app, tutor login + app. Plain HTML/CSS/JS, no install.
  backend/    REST API: Node + Express + PostgreSQL (auth, credit ledger with escrow, session state machine).
```

## Run it (frontend + backend together)
Needs Node 18.11+ and PostgreSQL.
```bash
# 1. backend
cd backend
cp .env.example .env     # set DATABASE_URL and a real JWT_SECRET (see the comments inside)
npm install
npm run db:migrate       # safe to re-run; also upgrades an older database (adds users.role)
npm run db:seed          # demo accounts + sample tutors, password demo1234
npm run dev              # API on http://localhost:4000 - open /health, it must say {"ok":true,"db":true}

# 2. frontend (second terminal)
cd frontend
python3 -m http.server 8000     # then open http://localhost:8000
```
Any localhost port (8000, 5500, 5173) or a double-clicked `index.html` can call the API in development. For a deployed site set `NODE_ENV=production` and `CLIENT_ORIGIN=https://your-site` in `backend/.env`.

Demo logins (after `npm run db:seed`): `student@demo.com` and `tutor@demo.com`, password `demo1234`.

## Virtual classroom (video, whiteboard, shared editor, chat)
Added from the Virtual Classroom update. Needs a free LiveKit Cloud project: put `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `backend/.env` (names are in `.env.example`). The tutor opens it from a session ("Open virtual classroom"), copies the invite link, and the student pastes it in "Join room". Full steps: `VIRTUAL_CLASSROOM_SETUP.md`. After merging, run `npm install` in `backend` (new packages: `livekit-server-sdk`, `socket.io`).

## How the pieces connect
- **Login / sign up** (student + tutor pages) call the backend (`POST /auth/register`, `/auth/login`). The token is shared with the **Live Lessons** pages, so you sign in once.
- If the server is not running, sign-in falls back to browser-only accounts and a yellow "Offline mode" bar is shown. Lessons need the server.
- **Only the demo logins get sample data.** Any new account starts empty with 10 welcome credits.
- The dashboards (sessions, doubts, chat, ledger shown in the apps) are still stored in the browser. Real bookings, credits escrow and availability live on the server and are used from **Live Lessons** (`lessons.html`).
