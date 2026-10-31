# AI Quiz, Weak-Topic Help and Tutor Reports: setup

## What it does
1. **Student leaves the lesson** (leaves the virtual classroom, or presses Finish) -> a box asks if they want a short quiz. It is **optional**: *No thanks* skips it and nothing is generated or charged. The student can still start it later from *My Sessions > Past > Take quiz*. The box asks once per lesson.
2. **Grok writes the quiz only after the student says yes** (5 multiple-choice questions on the topics covered; the student can edit the "What did you cover?" box first). The right answers stay on the server until the student submits.
3. **Score = credits.** 60%+ earns 1 credit, 80%+ earns 2 credits (changeable in `.env`). One quiz per lesson, so credits cannot be farmed.
4. **Low score (under 60%)**: no credits, and the AI coach shows the student their **weak topics** with a short explanation and a practice tip for each.
5. **The AI writes a report about the student for the tutor** (weak topics, how often each was missed before, strengths, a plan for the next lesson, and an outline for a short video). It appears in the tutor app under **Student Reports** (with an unread badge).
6. **The tutor sends a short video** (record with the camera or upload a file, up to 2 minutes). The student sees it under **Quizzes > Videos from your tutors**.

## Setup steps
1. **Get a Grok key.** Sign in at https://console.x.ai, open *API Keys*, create a key and add credit to the account.
2. **Put it in `backend/.env`:**
   ```
   XAI_API_KEY=your-key
   GROK_MODEL=grok-4
   ```
   Use the model name your xAI console shows. If the app says "model not found", change `GROK_MODEL`.
3. **Update the database** (adds the quiz tables and the `quiz_reward` credit type; safe to run again):
   ```
   cd backend
   npm install
   npm run db:migrate
   ```
4. **Start the backend** (`npm run dev`) and check `http://localhost:4000/health`. Then open `http://localhost:4000/quiz/config` with a login token, or just use the app: `aiReady` must be `true`.
5. **Serve the frontend** as before (for example `python3 -m http.server 8000` inside `frontend`).
6. **Try it with two accounts** (two browsers or one normal + one private window):
   - Student: book a lesson with the tutor, the tutor accepts, the student presses *Finish* -> *Take the quiz now*. Answer badly on purpose.
   - Tutor: within a few seconds a badge appears on **Student Reports**. Open it, press *Send a short video*, record or upload.
   - Student: open **Quizzes** to watch the video.
7. **Deploying (Render etc.):** add `XAI_API_KEY` and `GROK_MODEL` to the environment variables of the backend service, redeploy, and run `npm run db:migrate` once against the production database.

## Notes and limits
- The key is only ever read by the server (`backend/services/grok.js`). Never put it in the frontend.
- Each quiz costs one Grok call; a low score costs a second one (the analysis). `QUIZ_DAILY_LIMIT` caps this per student.
- If Grok is down when a student submits, the score and credits are still saved; the result shows a **Get the AI explanation** button to retry.
- The student app's credit balance is still kept in the browser (as for all credits in the student app), so the quiz reward is added there once per quiz. The server also records it in the credit ledger (`quiz_reward`), so it appears in Live Lessons / wallet balances.
- The tutor is found from the lesson's tutor email. If that tutor has no account, the student still gets the quiz and explanation, but no report is created.
- Videos are stored in the database (max 60 MB, 5 per report), like the tutor intro video. For many videos, move them to file storage later.

## Files
Backend: `services/grok.js`, `services/quiz.js`, `routes/quiz.js`, `db/schema.sql` (tables `quizzes`, `student_reports`, `remedial_videos`), `app.js`.
Frontend: `shared/quiz.js` (everything the browser does), plus small hooks in `student/app.js` and `tutor/js/ui.js`.
