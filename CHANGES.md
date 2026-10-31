# Change log

## Round 1 (done)
**Login / sign up (student + tutor)** - redesigned to the reference screenshot: wave background, centred card, logo top-left, Language (English / Hindi) and Theme (Light / Dark / System) dropdowns, demo-account row. Files: `frontend/auth/auth.css`, `prefs.js`, `login.js`, `student/login.html`, `tutor/login.html`.

**Tutor app**
- Profile photo: camera (webcam on desktop, camera app on phones) or gallery. Shown in sidebar, profile and leaderboard.
- Qualifications: degree, institute, year (up to 6; a future year shows "Pursuing").
- Intro video: gallery or camera; max 1 minute; only 9:16 or 16:9; stored in IndexedDB.
- Reschedule on every accepted (not yet started) lecture: new day/time, reason, message, "I talked with the student" tick. Costs 2% of the session credits (ledger row "Reschedule fee"). Max 3 moves per session, no overlap with another session, max 14 days ahead. The student gets a notification.
- "Post a bounty" button removed from Doubt Board (code removed too).
- Card hover zoom (tiny, mouse devices only) on tutor and student cards.

**Shared** - `frontend/shared/shared.js` is the single place for tutor profile data and notifications, so the student app can read it next round.

## Round 2 (done)

**Student: recommendation cards** - photo, rating (with review count), years of experience, sessions taught, qualification, skills, match score and three buttons: Chat, View profile, Book. Tutors above the student's level only, as before. Files: `student/app.js`, `student/style.css`.
- The live demo tutor (Neha Sharma, `tutor@demo.com`) shows what she saved in her own app: photo, qualifications, intro video, rating, skills, languages. The other four tutors are fixed demo data with initials instead of a photo.
- **View profile** opens the tutor's full profile: stats, bio, all qualifications, skills and the intro video (plays in the panel; 9:16 or 16:9). If there is no video it says so.
- **Chat** opens a chat window. Messages are stored in `shared/shared.js` (`uts_chats`). Demo tutors answer automatically (marked "demo reply"). Neha's messages reach her **Messages** page in the tutor app (new nav item with an unread badge) and her replies show up in the student chat.

**Student: delay a lecture** - "Delay" button on every upcoming lecture (also inside the lecture panel). New day + time, reason, optional note.
- Fee: 10% of the session credits **when the mentor already accepted** (paid to the mentor, ledger row "Delay fee"). Requests still waiting for a mentor can be delayed for free.
- Rules: later than the current time, at least 5 minutes from now, max 14 days ahead, max 2 delays per lecture, no overlap with another upcoming lecture, not for Instant Help.
- The tutor gets a notice the next time the tutor app is open (or live if it is open in another tab): the session moves to the new time, the old slot is freed, the fee is credited, the session shows "Delayed by learner" and the notice says who, from when to when, the reason and the note.
- Change the numbers at the top of `student/app.js` (`DELAY = { pct, max, maxDays }`).

**Lift-and-fly-to-centre animation** (`student/lift.js`, styles at the end of `student/style.css`) - click a recommendation card or an upcoming lecture card (or its View profile / Details button): the card lifts, flies to the centre, the page behind blurs and dims, the card's place becomes a dashed empty slot, the card turns into the detail panel and gets a glowing ring. Close with X, Esc or a click outside: it turns back into the card and flies back into the slot. Respects "reduce motion", keyboard (button opens it, focus returns to the button), small screens, and it waits to redraw the page until it is closed.

**Dark / light theme inside both apps** - Light / Dark / System switch at the bottom of the sidebar (icons only on small screens). Same storage key as the login pages, so the choice carries across login, student app and tutor app (and updates other open tabs). Files: `shared/theme.js`, `shared/theme.css`; both app stylesheets now use colour variables and the earnings chart uses them too. The sidebar is now sticky so the switch, streak and Log out stay on screen.

### Things to know
- Experience is "years since joining" for the live tutor (about 1.3 yrs) and fixed numbers for the demo tutors.
- The delay notice and chat only reach a tutor who has a login: in the demo that is Neha. Delaying a lecture with another mentor still charges the fee and saves the change, and the message says that mentor has no login to notify.
- The student's demo lectures and the tutor's demo sessions are separate sample data, so the tutor notice names the tutor-side session closest in time to the one the student moved.
- Lift animation is on the student app only. Tutor cards still just get the small hover zoom.
- Everything is still browser-only (localStorage / IndexedDB). Chat, notices and the fee need the backend before they work between real devices.

## Round 3 (merge of the slots update)
- Backend: added `routes/mentors.js` (bookable tutors + prices, open slots of a tutor) and `routes/slots.js` (tutor adds/removes availability); `app.js` mounts `/mentors` and `/slots`; `lib/price.js` gained `quoteFor()`. The `is_platform` filter in mentors.js was dropped (no such column in this schema).
- Frontend: kept the existing frontend; added `lessons.js` (from the update), `lessons.html`, `lesson.html` (basic classroom: start/finish), `api.js` (API client), `lessons.css`.
- Back button: `shared/back.js`. In the student and tutor apps it steps back through the app pages you visited (hidden on the first page); on the lessons pages it uses browser history. Login pages already had "Back to home".
- Landing "Choose your path" text is larger with more space around it.
- Not included (not in the supplied files): payments, payouts, simpay, recordings, webhooks routes; notes PDF; video room. `lessons.js` buttons for those will show an error until the routes exist.

## Round 4 (backend <-> frontend wiring, clean new accounts)
**Calling the backend now works**
- `auth/auth.js`: sign up / log in call `POST /auth/register` and `/auth/login`; the token is saved as `uts_api_token`, the same key `api.js` uses, so Live Lessons does not ask for a second login. Server errors (email taken, wrong password, wrong role) show proper messages. If the server is unreachable it falls back to browser-only accounts and shows an "Offline mode" bar.
- Backend CORS: any `localhost`/`127.0.0.1` port is allowed in development (the README's `python3 -m http.server 8000` was blocked before). Production only allows `CLIENT_ORIGIN`.
- Seed accounts did not match the website (`student@demo.com` / `tutor@demo.com` did not exist on the server; only `@demo.test` did). They exist now, duplicates removed. Seed is still safe to re-run.
- New `users.role` column (student / tutor) so the student and tutor logins stay separate on the server. `db:migrate` upgrades an existing database in place. New tutors start at level 2 so students can book them (a level-1 tutor could never be booked).
- `/health` checks the database; the server refuses to start with a clear message if `DATABASE_URL` / `JWT_SECRET` is missing and reports a DB problem at startup; stub `GET /sessions/:id/recordings` so the Lessons page does not hit a 404 page.
- "Live Lessons" link in both app sidebars; lessons pages have a "My dashboard" link; an expired token now shows a sign-in form instead of a reload loop.

**New accounts showed the demo account's data - fixed**
- Student and tutor apps only load the sample sessions, tutors' requests, doubts, history, credits and leaderboard for `student@demo.com` / `tutor@demo.com`. Every other account starts empty with 10 welcome credits. Accounts created with the old version have their copied demo data dropped once on next open.
- Tutor: levelling can no longer demote a new tutor below the starting level 2.

**Other fixes**
- Student booking offered "60 min / 6 credits"; the server and tutor app use 45 min / 6 credits. Aligned to 45.
- `.env.example` contained a real database URL and JWT secret. Replaced with placeholders. **Rotate that Neon password and JWT secret**, since they were in the zip.

## Round 5 (merge of the Virtual Classroom update)
The update was built on an older snapshot (no mentors/slots routes, no `back.js`, older landing CSS), so it was merged by hand instead of copied over.
- Added: `backend/routes/virtual-room.js` (LiveKit token), `backend/realtime/collab.js` (Socket.IO editor / whiteboard / chat), `frontend/virtual-room.*`, `VIRTUAL_CLASSROOM_SETUP.md`, new packages in `package.json`, LiveKit variables in `.env.example`.
- Kept from before (the update would have removed them): `/mentors` and `/slots` routes, `quoteFor()`, `shared/back.js` and the Back button, the landing-page text sizes, the real login, clean new accounts, `/health`.
- Clash fixes:
  - `app.js` / `index.js`: both route sets are mounted; Socket.IO is attached to the same server and uses the **same CORS rule** as the REST API (`lib/cors.js`), so a localhost frontend works for both.
  - One backend address for everything: `virtual-room-config.js` is now loaded by the login pages, apps, Lessons and the classroom. On localhost it defaults to `http://localhost:4000`; before, the classroom would have called the page's own port.
  - Student "Join room" dialog no longer removed the end-session + rating step (sessions could not be completed); the rating buttons are back under the join field.
  - Tutor button "Video call (Jitsi)" is now "Open virtual classroom".
  - The public token endpoint is rate limited (20 per minute per IP); empty collaboration rooms are freed after 10 minutes.
