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

## Status
The app pages still save in the browser. The new Lessons pages (`frontend/lessons.html`, `lesson.html`) do call the API (sign in with a server account).
