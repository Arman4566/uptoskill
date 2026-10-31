# New in this round

All AI now uses **Google Gemini** (Grok/xAI is gone). One key powers quizzes, weekly events, code judging and reminders.

## 1. Setup (5 minutes)
1. `cd backend && npm install` (new dependency: `web-push`)
2. In `backend/.env` add `GEMINI_API_KEY=...` (and optionally `GEMINI_MODEL`). Remove the old `XAI_API_KEY` / `GROK_MODEL` lines.
3. For reminders that arrive when the website is closed: `npx web-push generate-vapid-keys`, then put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@example.com` in `.env`.
4. `npm run db:migrate` (adds the new tables), then `npm start`.
5. Try it now without waiting: `npm run events:now` (makes this week's events and sends today's reminders).

## 2. Weekly events (AI quiz + AI coding battle)
- Every week (Monday 00:00 to Sunday 24:00, India time) the server asks Gemini for one **quiz** (10 questions) and one **coding battle** (3 problems: easy 20, medium 30, hard 50 points).
- Every student gets a notification when they go live. Student app: sidebar **Weekly Events**.
- Quiz is graded on the server. Code is **judged by Gemini** (it reads the code, it does not run it). One try per event.
- Leaderboard (first name + initial only). Quiz answers are revealed after the week ends, so nobody can copy them.
- Files: `services/events.js`, `routes/events.js`, `frontend/shared/events.js`.

## 3. Daily AI reminders (sarcastic + funny)
- Every evening (default 6 pm IST, `REMINDER_HOUR_IST`) Gemini reads each student's streak, days since last study, recent quiz scores and unplayed events, and writes a short roast-with-love. Numbers come from our database, the AI cannot invent them.
- Delivered as a **push notification** (works with the site closed) and as an in-app notification.
- If Gemini is down or has no key, built-in jokes are used, so the reminder is never skipped.
- Students switch push on from **Weekly Events** (button "Turn on"). Files: `services/reminders.js`, `services/push.js`, `frontend/sw.js`.

## 4. Whiteboard: fixed pages, big board, saved into the summary
- Fixed 16:9 pages. **Next page +** saves the current page and opens a blank one; Prev / Next flip through pages (shared by everyone in the room).
- **Big board** button: full-screen board (Esc to leave). **Eraser** added. Drawings scale, so they look the same on any screen size.
- Notes, code and all board pages are now saved in the database (`room_summaries`), so they survive a server restart.
- **Summary** button (notes panel and board panel) opens `virtual-room-summary.html`: notes + every non-blank board page + final code. Press **Print / Save as PDF**.

## 5. Things to know
- The weekly/reminder jobs run inside the server (every 10 min check, safe to repeat). On a free host that sleeps (Render free) they do not run while asleep: ping `/health` every 10 minutes (UptimeRobot) or call `npm run events:now` from a scheduler.
- I could not run the database or install packages in my sandbox (no network), so the SQL and `web-push` parts are written but untested against a real Postgres. Gemini client and week maths were tested with a fake server. Please run `npm run events:now` once and tell me any error.
- Default model `gemini-2.5-flash` is my best guess; if you get "model not found" set `GEMINI_MODEL` to a name shown in Google AI Studio.

## 6. NOT added (on purpose, ask if you want them)
- Credit rewards for the weekly top 3 (needs a new ledger reason + a finishing job).
- Real code execution / sandbox for the coding battle (Gemini only reads the code).
- A tutor/admin screen to edit or re-roll an event (use `npm run events:now`; delete a row in `events` to regenerate).
- Email or SMS reminders; iPhone only gets push after "Add to Home Screen".
- Tutor-side events or reminders; student-to-student chat in events.
- Whiteboard: shapes, text boxes, undo, delete-a-page, per-person pages.

## 7. Found but NOT touched
- `frontend/lesson.js` and `lessons.js` call `/sessions/:id/notes` and `/sessions/:id/notes.pdf`, and `backend/services/notes.js` expects a `lesson_notes` table and `pdfkit`, but none of those exist in this merged zip (no route, no table, no package). The old "tutor notes PDF" therefore returns 404 right now. I left it alone because you did not ask; tell me and I will restore it.
