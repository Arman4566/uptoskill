# UpToSkill — Start Here

This project contains a static frontend (`frontend/`) and an Express backend (`backend/`). The virtual classroom uses LiveKit for camera/microphone audio/video and Socket.IO for synchronized code, whiteboard, chat, and participant updates.

## Before running
- Install Node.js 18.11 or newer.
- Have a PostgreSQL database (Neon works) and a LiveKit Cloud project.
- Do not publish `.env` files, database passwords, JWT secrets, or LiveKit API secrets.

## Run locally (Windows PowerShell)

### 1. Configure the backend
Open PowerShell in the project folder:

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

Edit `backend/.env` and set real values for `DATABASE_URL` and `JWT_SECRET`. For video/audio, also set:

```env
LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
PORT=4000
```

Keep the rest of the existing `.env.example` settings unless you know you need to change them. `DATABASE_URL` must point to your real PostgreSQL/Neon database; the example database URL is only a placeholder.

Install and prepare the database:

```powershell
npm install
npm run db:migrate
```

Start the API:

```powershell
npm start
```

Leave this terminal running. Visit `http://localhost:4000/health`; a healthy database should return `{"ok":true,"db":true}`.

### 2. Serve the frontend
Open a second PowerShell terminal in the project root:

```powershell
cd frontend
npx --yes serve -l 5173 .
```

Open the URL printed by `serve` (normally `http://localhost:5173`). Open the tutor/student dashboard and enter a virtual classroom. Test with two separate browser windows/profiles and allow camera/microphone access.

If `serve` is not available or blocked by network restrictions, use VS Code Live Server on the `frontend` folder. Do not open the HTML file by double-clicking it for the full test.

## Deploy using your existing services

### Backend on Render
- Root directory: `backend` (if Render asks for one)
- Build/install command: `npm install`
- Start command: `npm start`
- Keep your existing `DATABASE_URL` and `JWT_SECRET` environment values.
- Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Set `CLIENT_ORIGIN` to the exact public frontend origin, e.g. `https://your-app.vercel.app` (no trailing slash). For multiple origins, comma-separate them if your backend CORS helper supports it.
- Redeploy and check `https://YOUR-BACKEND.onrender.com/health`.

### Frontend on Vercel or another host
Edit `frontend/virtual-room-config.js` and set the first assignment to the real Render backend URL:

```js
window.UPTOSKILL_API_URL = 'https://YOUR-BACKEND.onrender.com';
```

Do not leave the example URL; use the real one. Then redeploy the frontend. If the frontend and backend share the same origin, leave it blank instead.

## Troubleshooting
- `Missing DATABASE_URL` or `Missing JWT_SECRET`: set these in `backend/.env` locally or Render Environment settings.
- `/health` returns `db:false`: check the Neon connection string, network access, and run `npm run db:migrate` from `backend`.
- `LIVEKIT_NOT_CONFIGURED`: add all three LiveKit environment variables to the backend and restart/redeploy.
- CORS errors: set `CLIENT_ORIGIN` to the exact frontend origin and check `frontend/virtual-room-config.js` points to the correct backend.
- `npm ci` fails: this archive intentionally omits the stale lockfile because it did not include the newly added `livekit-server-sdk` and `socket.io` dependencies. Use `npm install` for the first install/deploy. Once installed in an environment with registry access, generate and commit a fresh lockfile with `npm install --package-lock-only`.
- Camera/mic unavailable: use HTTPS on deployed sites (localhost is also allowed), allow permissions in the browser, and check that no other app is monopolizing the device.

## Prototype limitations
Room invitation links are bearer links: anyone who has the link may be able to join. The room token endpoint does not check who booked the session, so this is not yet suitable for confidential or paid classes without server-side user/session authorization. Shared editor/whiteboard state is held in backend memory and is lost when the backend restarts.
