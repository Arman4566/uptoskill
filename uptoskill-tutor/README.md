# UpToSkill - Tutor app (working prototype)

Open `index.html` in Chrome, Edge or Firefox (double-click). No install, no server, no build step.
All data is saved in your browser (localStorage). Profile > Reset demo data starts over.

## What the tutor can do
| Screen | Working features (from the project plan) |
|---|---|
| Dashboard | Availability switch (presence for Instant Help), credits, stats, incoming requests, upcoming sessions, open doubts. "Credits earned" opens Earnings. |
| Session Requests | AI mentor brief, match score + one-line reason, accept (learner balance check, credits held in escrow) or decline. Mentor level must be above learner level. |
| My Sessions | State machine: requested > accepted > in progress > completed. Join room, cancel and no-show (credits released), end session (credits paid once), AI session notes with retry, learner rating. |
| Live room | Shared code editor + chat + timer + AI notice. Click "Open learner window" to edit from a second browser window and see it sync live. Token check, Jitsi video link, learner can ask to end. |
| Availability | Add / remove slots, overlap and past-time checks, booked slots locked. |
| Instant Help | Live requests, 60-second countdown, first accept wins (rival mentors can claim first), no taker moves it to the Doubt Board with credits locked. |
| Doubt Board | Skill bounties: answer, author accepts best, reward paid; auto-refund on expiry; solved tab is a knowledge base; post your own bounty (escrow). |
| Earnings | Graph for **1 Day / 1 Month / 1 Year / Total** with tooltips, summary tiles, breakdown, and the full credit ledger. |
| Reviews | Ratings, distribution, growth insights. 5-star bonus (+1, max 3 per day). |
| Leaderboard / Profile | Rank by sessions and rating, level rules (1-4), badges, languages, skills, AI on/off, simulated platform fee, reset. |

## Honest notes
* This is a front-end prototype. Learners, rival mentors and AI are simulated in `js/sim.js` and `js/ai.js` (runs offline, rule-based).
  To use a real LLM, replace `AI.analyze` and `AI.summarize` in `js/ai.js` with a fetch call returning the same JSON.
* The editor syncs between windows through localStorage events (last write wins). The plan's production design is Monaco + Yjs + Socket.IO.
* Credits follow the plan's ledger rules: balance = sum of rows, one settlement per session, price comes from a lookup table (never from AI).
* No real payments. The platform fee is a labelled simulation (default off).

## Files
`index.html`, `style.css`, `assets/` (logo), `js/store.js` (ledger + state machine), `js/sim.js`, `js/ai.js`, `js/charts.js`, `js/ui.js`.
