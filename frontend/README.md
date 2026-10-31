# UpToSkill frontend

Plain HTML/CSS/JS. No install, no build. Open `index.html`, or serve this folder: `python3 -m http.server 8000`.

Flow: `index.html` (landing) -> Learner / Tutor -> `student/login.html` or `tutor/login.html` -> `student/app.html` or `tutor/app.html`.

| Folder | Contents |
|---|---|
| `index.html`, `style.css`, `script.js` | Landing page |
| `student/` | Student login + student app (`lift.js` is the lift-and-fly card animation) |
| `tutor/` | Tutor login + tutor app (`js/` has the ledger, sim, AI, charts, UI) |
| `auth/` | Shared login code (`auth.js`), form logic (`login.js`), theme + language (`prefs.js`), styles |
| `shared/` | `shared.js`: tutor public profile (photo, qualifications, intro video), notifications both ways, student-tutor chat. `theme.js` + `theme.css`: light / dark / system theme for both apps. Used by both apps |
| `assets/` | Logo, favicon, plane, classroom image |

Demo accounts (password `demo1234`): `student@demo.com`, `tutor@demo.com`.

Right now accounts and app data are saved in the browser (localStorage). To use the backend, change `register()` and `login()` in `auth/auth.js` to call `POST /auth/register` and `POST /auth/login` on the backend (default http://localhost:4000).
