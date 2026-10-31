# UpToSkill server (Lane A)

## Setup
```bash
cd server
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate            # applies db/schema.sql (db:reset drops everything first)
npm run db:seed               # demo users, skills, slots (password for all: demo1234). Safe to re-run.
npm run dev                   # API on :4000
npm run test:race             # 20-way parallel accept/complete/cancel checks
```

## Contract so far
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register, /auth/login | register writes the 10-credit `starter` ledger row |
| GET | /me, /me/ledger | balance = SUM(delta); `creditsInEscrow` shown separately |
| POST | /sessions | body: mentorId, minutes (15/30/45), title, problemText, tags[], difficulty?, slotId? |
| GET | /sessions, /sessions/:id | participants only |
| POST | /sessions/:id/accept, decline, cancel, start, complete | state machine; money moves inside these |

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
