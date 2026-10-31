// Backend URL used by login, Live Lessons and the virtual classroom.
// - Local development: leave blank. Pages on localhost / 127.0.0.1 / file:// use http://localhost:4000 automatically.
// - Frontend and backend on the same public origin: leave blank.
// - Different Render URLs: set it, e.g. 'https://your-backend.onrender.com' (no trailing slash).
window.UPTOSKILL_API_URL = '';
(function () {
  try {
    if (window.UPTOSKILL_API_URL) return;
    var saved = localStorage.getItem('uts_api');           // optional per-browser override
    if (saved) { window.UPTOSKILL_API_URL = saved.replace(/\/$/, ''); return; }
  } catch (e) { }
  var h = location.hostname;
  if (location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') window.UPTOSKILL_API_URL = 'http://localhost:4000';
})();
