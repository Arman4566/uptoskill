# UpToSkill Virtual Classroom Setup

This adds in-page video/audio using LiveKit Cloud, plus a Socket.IO collaborative whiteboard, code editor and room chat. It does **not** use the Google Meet REST API; that API does not embed a Meet call inside the UpToSkill page.

## 1. Create LiveKit credentials

Create a LiveKit Cloud project and copy its server URL, API key and API secret. Keep the API secret private; never put it in frontend JavaScript or a public repository.

## 2. Update the existing Render backend service

In Render → existing UpToSkill backend service → Environment, add:

- `LIVEKIT_URL` = your LiveKit server URL (starts with `wss://`)
- `LIVEKIT_API_KEY` = the LiveKit API key
- `LIVEKIT_API_SECRET` = the LiveKit API secret
- `CLIENT_ORIGIN` = exact public URL of the frontend, e.g. `https://your-frontend.onrender.com` (no trailing slash). If multiple frontend origins are used, separate them with commas.

Keep your existing Neon `DATABASE_URL` and `JWT_SECRET` values in Render; do not copy them into source files. The virtual classroom does not require a database migration.

Ensure the Render backend build/install command is `npm install` and its start command is `npm start`. This feature adds `livekit-server-sdk` and `socket.io`; if your build command is `npm ci`, change it to `npm install` so the new dependencies can be resolved.

## 3. Configure the frontend's API URL

Open `frontend/virtual-room-config.js` (it also sets the server address for login and Live Lessons). On localhost it is filled in automatically (`http://localhost:4000`).

- If frontend and backend are on the **same public origin**, leave the value blank.
- If they are on **different Render URLs**, set the backend URL, e.g.:

```js
window.UPTOSKILL_API_URL = 'https://your-backend.onrender.com';
```

Use your real backend URL, not the example. Publish the updated frontend files to its existing Render service.

## 4. Start and join a room

1. Open the tutor dashboard and a session's room.
2. Click **Open virtual classroom**. The room page creates a private-looking invite code for that session.
3. Click **Copy invite link** and send the link to the intended student.
4. The student opens the link directly, or pastes the invite link into the Join Room dialog in the student dashboard.
5. Both participants allow camera and microphone access. They can use video/audio, the shared code editor, whiteboard and chat.

The invite link is a bearer invitation: anyone who has it can join. Do not post it publicly.

## 5. Verify deployment

- Open `https://YOUR-BACKEND/health` and confirm it returns `{"ok":true}`.
- Open a virtual room. The video status should say it is connected, and the participant list should update as another person joins.
- Type a few lines in the editor and draw on the whiteboard; verify the other participant sees the changes.
- If the page reports `LIVEKIT_NOT_CONFIGURED`, check the three LiveKit environment variables on Render and redeploy the backend.
- If the editor/whiteboard say they are reconnecting, verify `CLIENT_ORIGIN`, the backend URL in `virtual-room-config.js`, and that the Render service is running WebSockets/Socket.IO.

## Important current limitation

The original supplied frontend uses browser-local demo authentication/session state. The room token endpoint therefore uses a hard-to-guess room invite rather than checking a database-backed session membership record. This is suitable for a prototype/demo only. Before using the room for private or paid classes, connect it to real backend authentication and authorize the exact student and tutor for each session. Collaboration state is currently in backend memory and is cleared if the backend restarts.
