# UpToSkill frontend

Plain HTML/CSS/JS. No install, no build. Open `index.html`, or serve this folder: `python3 -m http.server 8000`.

Flow: `index.html` (landing) -> Learner / Tutor -> `student/login.html` or `tutor/login.html` -> `student/app.html` or `tutor/app.html`.

| Folder | Contents |
|---|---|
| `index.html`, `style.css`, `script.js` | Landing page |
| `student/` | Student login + student app |
| `tutor/` | Tutor login + tutor app (`js/` has the ledger, sim, AI, charts, UI) |
| `auth/` | Shared login code (`auth.js`), form logic, styles |
| `assets/` | Logo, favicon, plane, classroom image |

Demo accounts (password `demo1234`): `student@demo.com`, `tutor@demo.com`.

Right now accounts and app data are saved in the browser (localStorage). To use the backend, change `register()` and `login()` in `auth/auth.js` to call `POST /auth/register` and `POST /auth/login` on the backend (default http://localhost:4000).
