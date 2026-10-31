/* UpToSkill app theme (Light / Dark / System). Same storage key as the login pages ("uts_theme"), so the choice made on
   the login page carries into the apps and back. Loaded in <head> so the right theme is set before first paint. */
(function () {
  "use strict";
  const KEY = "uts_theme", MODES = ["light", "dark", "system"];
  const get = () => { try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : "light"; } catch (e) { return "light"; } };
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  let mode = get();
  function apply() {
    const dark = mode === "dark" || (mode === "system" && mq && mq.matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }
  function set(m) {
    if (!MODES.includes(m)) return;
    mode = m; try { localStorage.setItem(KEY, m); } catch (e) { }
    apply(); window.dispatchEvent(new CustomEvent("uts-theme", { detail: m }));
  }
  apply();
  if (mq) mq.addEventListener("change", () => { if (mode === "system") apply(); });
  window.addEventListener("storage", e => { if (e.key === KEY) { mode = get(); apply(); window.dispatchEvent(new CustomEvent("uts-theme", { detail: mode })); } });

  const ICON = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'
  };
  const LABEL = { light: "Light", dark: "Dark", system: "System" };
  /* sidebar control: three icon buttons; the app's click handler calls UTSTheme.set(data-id) through data-act="theme" */
  function control() {
    return `<div class="themeseg" role="group" aria-label="Theme">${MODES.map(m =>
      `<button type="button" class="${m === mode ? "on" : ""}" data-act="theme" data-id="${m}" aria-pressed="${m === mode}" title="${LABEL[m]} theme">` +
      `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[m]}</svg><span>${LABEL[m]}</span></button>`).join("")}</div>`;
  }
  window.UTSTheme = { set, get mode() { return mode; }, control };
})();
