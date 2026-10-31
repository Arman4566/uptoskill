/* Theme (Light / Dark / System) and language (English / Hindi) for the login pages.
   Choices are saved in localStorage and read again by the app pages. */
(function () {
  const TK = "uts_theme", LK = "uts_lang";
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;

  /* ---------- theme ---------- */
  function applyTheme(mode) {
    const dark = mode === "dark" || (mode === "system" && mq && mq.matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }
  let theme = get(TK, "light"); applyTheme(theme);          // runs before first paint (script sits in <head>)
  if (mq) mq.addEventListener("change", () => { if (theme === "system") applyTheme("system"); });

  /* ---------- language ---------- */
  const DICT = {
    en: {
      theme_light: "Light", theme_dark: "Dark", theme_system: "System", home: "← Back to home",
      tagline: "Learn • Teach • Grow", login: "Log in", signup: "Sign up", email: "Email", password: "Password", name: "Full name",
      show: "Show", hide: "Hide", demo: "Demo account:", fill: "Fill in", create: "Create account",
      s_badge: "Student", s_t_login: "Welcome back, learner", s_t_signup: "Start learning today", s_sub_login: "Log in to continue your learning journey.", s_sub_signup: "Create your free account in a minute.",
      s_name_ph: "Your name", s_switch: "Want to teach instead?", s_switch_a: "Go to tutor login",
      t_badge: "Tutor", t_t_login: "Welcome back, mentor", t_t_signup: "Become a tutor", t_sub_login: "Log in to manage your sessions and earnings.", t_sub_signup: "Share what you know and earn credits.",
      t_name_ph: "Your name as learners will see it", t_switch: "Here to learn instead?", t_switch_a: "Go to student login",
      pw_ph: "At least 8 characters", email_ph: "you@example.com"
    },
    hi: {
      theme_light: "लाइट", theme_dark: "डार्क", theme_system: "सिस्टम", home: "← होम पर वापस",
      tagline: "सीखो • सिखाओ • आगे बढ़ो", login: "लॉग इन", signup: "साइन अप", email: "ईमेल", password: "पासवर्ड", name: "पूरा नाम",
      show: "दिखाएँ", hide: "छिपाएँ", demo: "डेमो अकाउंट:", fill: "भरें", create: "अकाउंट बनाएँ",
      s_badge: "स्टूडेंट", s_t_login: "वापसी पर स्वागत है, लर्नर", s_t_signup: "आज ही सीखना शुरू करें", s_sub_login: "अपनी सीखने की यात्रा जारी रखने के लिए लॉग इन करें।", s_sub_signup: "एक मिनट में अपना फ्री अकाउंट बनाएँ।",
      s_name_ph: "आपका नाम", s_switch: "क्या आप पढ़ाना चाहते हैं?", s_switch_a: "ट्यूटर लॉगिन पर जाएँ",
      t_badge: "ट्यूटर", t_t_login: "वापसी पर स्वागत है, मेंटर", t_t_signup: "ट्यूटर बनें", t_sub_login: "अपने सेशन और कमाई देखने के लिए लॉग इन करें।", t_sub_signup: "जो आप जानते हैं वह सिखाएँ और क्रेडिट कमाएँ।",
      t_name_ph: "आपका नाम जैसा लर्नर देखेंगे", t_switch: "क्या आप सीखने आए हैं?", t_switch_a: "स्टूडेंट लॉगिन पर जाएँ",
      pw_ph: "कम से कम 8 अक्षर", email_ph: "you@example.com"
    }
  };
  let lang = get(LK, "en"); if (!DICT[lang]) lang = "en";
  const t = k => (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k;

  function translate() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(e => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
    const cur = document.getElementById("langName"); if (cur) cur.textContent = lang === "hi" ? "हिन्दी" : "English";
    const tn = document.getElementById("themeName"); if (tn) tn.textContent = t("theme_" + theme);
    document.querySelectorAll("#langMenu button").forEach(b => b.setAttribute("aria-checked", b.dataset.v === lang));
    document.querySelectorAll("#themeMenu button").forEach(b => { b.setAttribute("aria-checked", b.dataset.v === theme); b.querySelector("span").textContent = t("theme_" + b.dataset.v); });
    document.dispatchEvent(new CustomEvent("uts-lang"));
  }

  /* ---------- dropdown wiring ---------- */
  function wire() {
    const dds = document.querySelectorAll(".dd");
    dds.forEach(d => d.querySelector(":scope>button").addEventListener("click", e => {
      e.stopPropagation(); const was = d.classList.contains("open"); dds.forEach(x => x.classList.remove("open")); d.classList.toggle("open", !was);
      d.querySelector(":scope>button").setAttribute("aria-expanded", !was);
    }));
    document.addEventListener("click", () => dds.forEach(x => x.classList.remove("open")));
    document.addEventListener("keydown", e => { if (e.key === "Escape") dds.forEach(x => x.classList.remove("open")); });
    document.querySelectorAll("#themeMenu button").forEach(b => b.onclick = () => { theme = b.dataset.v; set(TK, theme); applyTheme(theme); translate(); });
    document.querySelectorAll("#langMenu button").forEach(b => b.onclick = () => { lang = b.dataset.v; set(LK, lang); translate(); });
    translate();
  }
  window.UTSPrefs = { t, get lang() { return lang; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
