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
npm run db:migrate       # safe to re-run; upgrades an older database and DELETES the old demo accounts (student@demo.com, tutor@demo.com, *@demo.test)
npm run db:seed          # optional: skill tags only. No accounts are created.
npm run dev              # API on http://localhost:4000 - open /health, it must say {"ok":true,"db":true}

# 2. frontend (second terminal)
cd frontend
python3 -m http.server 8000     # then open http://localhost:8000
```
Any localhost port (8000, 5500, 5173) or a double-clicked `index.html` can call the API in development. For a deployed site set `NODE_ENV=production` and `CLIENT_ORIGIN=https://your-site` in `backend/.env`.

There are no demo logins. Create a student account on the student login page and a tutor account on the tutor login page (use two different browsers or profiles to try both at once).

## Virtual classroom (video, whiteboard, shared editor, chat)
Added from the Virtual Classroom update. Needs a free LiveKit Cloud project: put `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `backend/.env` (names are in `.env.example`). The tutor opens it from a session ("Open virtual classroom"), copies the invite link, and the student pastes it in "Join room". Full steps: `VIRTUAL_CLASSROOM_SETUP.md`. After merging, run `npm install` in `backend` (new packages: `livekit-server-sdk`, `socket.io`).

## How the pieces connect
- **Login / sign up** (student + tutor pages) call the backend (`POST /auth/register`, `/auth/login`). The token is shared with the **Live Lessons** pages, so you sign in once.
- The server must be running: there is no offline mode and there are no sample accounts, tutors or sessions. A new account starts empty with 10 welcome credits.
- **Everything you add in the student and tutor apps is saved in the database** (tables `user_state`, `shared_items`, `tutor_videos`): sessions, credits and ledger, doubts, profile photo, qualifications, availability slots, intro video, chats and notifications. Log in from another browser or device and it is all there. `frontend/shared/sync.js` does the saving and loading; `backend/routes/state.js` is the API.
- **Tutors and bookings are real.** The student's tutor list is built from the tutors' public profiles. A booking is sent to that tutor, who accepts or declines in the tutor app; the student sees the answer, chats with the tutor, and rates the tutor after the session.
- Real bookings, credits escrow and availability on the server's own tables are also used from **Live Lessons** (`lessons.html`).

## AI quizzes (Gemini)
After a lesson the student can take an AI-written quiz, earn credits, and get weak-topic explanations; the tutor gets an AI report and can send a short video. Needs `GEMINI_API_KEY` in `backend/.env`. Steps: `QUIZ_SETUP.md`.
