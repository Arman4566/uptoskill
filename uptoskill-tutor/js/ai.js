/* UpToSkill Tutor - AI layer (demo).
   Golden rule from the plan: logic in code, language in AI. Prices, matching and level checks never read AI output.
   This demo runs a small rule-based writer locally so it works offline. To use a real LLM, replace the body of
   AI.analyze / AI.summarize with a fetch() call that returns the same JSON shape (see README). */
"use strict";
const KEYWORDS = {
  React: ["react", "useeffect", "usestate", "jsx", "props", "component", "re-render", "debounce"],
  JavaScript: ["javascript", "map()", "promise", "async", "await", "undefined", "callback", "debounce"],
  Node: ["node", "express", "middleware", "route", "routing", "server"],
  SQL: ["sql", "join", "group by", "select", "query", "distinct"],
  Python: ["python", "dictionary", "dict", "keyerror", "list comprehension", "pandas"],
  DSA: ["recursion", "complexity", "binary search", "tree", "graph", "array", "sort"],
  Git: ["git", "rebase", "merge", "commit", "branch"],
  Flutter: ["flutter", "dart", "widget"],
  "WebGL/GLSL": ["shader", "glsl", "webgl"]
};
const PREP = {
  React: ["useEffect dependency array", "state vs props", "cleanup functions"], JavaScript: ["arrow function returns", "async/await basics", "Array.map"],
  Node: ["Express middleware order", "route matching", "error handling"], SQL: ["JOIN types", "GROUP BY vs DISTINCT", "aggregate on joined rows"],
  Python: ["dict.get and defaultdict", "Counter", "list comprehensions"], DSA: ["loop invariants", "recursion tree", "Big-O"],
  Git: ["rebase vs merge", "reflog"], Flutter: ["widget tree", "setState"], "WebGL/GLSL": ["uniforms", "fragment shaders"]
};
const AI = {
  analyze(text) {                                   // sync core, returns validated JSON
    const t = String(text || "").toLowerCase(), tags = Object.keys(KEYWORDS).filter(k => KEYWORDS[k].some(w => t.includes(w))).filter(k => VOCAB.includes(k)).slice(0, 3);
    const first = String(text || "").split(/(?<=[.?!])\s+/)[0] || "Help request";
    const tried = String(text || "").split(/(?<=[.?!])\s+/).filter(x => /tried|added|changed|wrote|using/i.test(x)).join(" ") || "Nothing mentioned yet.";
    const difficulty = Math.max(1, Math.min(3, 1 + (t.length > 120 ? 1 : 0) + (/recurs|complex|async|join|middleware/.test(t) ? 1 : 0)));
    const tg = tags.length ? tags : ["JavaScript"];
    return { title: first.length > 80 ? first.slice(0, 77) + "..." : first, tags: tg, difficulty, suggested_minutes: [15, 30, 45][difficulty - 1], problem_summary: first, already_tried: tried, topics_to_prepare: (PREP[tg[0]] || []).slice(0, 3) };
  },
  summarize(s, msgs, code) {
    const learner = (msgs.find(m => m.from === "learner") || {}).body, tutorMsgs = msgs.filter(m => m.from === "tutor").map(m => m.body);
    const tag = s.tags[0] || "the topic";
    return {
      solved: `Worked through: ${s.title}`,
      takeaways: [`The core idea behind ${tag} in this problem was explained step by step.`, tutorMsgs[0] ? `Key tip from the mentor: "${tutorMsgs[0].slice(0, 90)}"` : "The mentor walked through the failing code line by line.", learner ? "The learner restated the problem clearly, which made debugging faster." : "The fix was tested live in the shared editor."],
      next_steps: [`Practise one more small ${tag} exercise today.`, "Re-read the changed lines and explain them out loud.", (PREP[s.tags[0]] || [])[0] ? "Revise: " + PREP[s.tags[0]][0] + "." : "Write a short note on what you learned."]
    };
  },
  /* async wrappers: timeout, rate limit (20 per hour), fallback when AI is off */
  call(fn, ms = 600) {
    return new Promise((ok, no) => {
      if (!S.settings.aiOn) return no(new Error("AI is turned off"));
      const now = Date.now(); S.ai.calls = S.ai.calls.filter(t => now - t < HR);
      if (S.ai.calls.length >= 20) return no(new Error("AI rate limit reached (20 per hour)"));
      S.ai.calls.push(now); setTimeout(() => { try { ok(fn()); } catch (e) { no(e); } }, ms);
    });
  },
  explainMatch(b) {
    const parts = [b.skill >= 30 && "your skills fit the topic", b.lang && "you share a language", b.avail >= 20 && "the slot is in your availability"].filter(Boolean);
    return parts.length ? "Good fit: " + parts.join(", ") + "." : "Lower match for your profile.";
  }
};
