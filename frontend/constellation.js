/* Constellation backdrops.
   1) landing: neon-coloured stars on the dark hero (canvas#sky, ~70% opacity)
   2) after START: the same stars on the morning-horizon choose screen (canvas#skyChoose)
   Both share the same rules:
     - sizes: 10% big, 30% mid, 60% small (biggest never more than 2x the old max)
     - all stars drift very slowly and constantly, and float a little here and there
     - one bright shooting star, top-left to bottom-right, every 4 - 5 s
     - a few constellations pulse brighter, one after another
     - stars near the mouse cursor glow a little more
   Standalone: it only reads the DOM and watches #choose for the "show" class. */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // one shared mouse position for both skies
  const mouse = { x: -9999, y: -9999, on: false };
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; }, { passive: true });
  document.addEventListener('mouseleave', () => { mouse.on = false; });

  function sky(canvas, o) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, stars = [], heroes = [], raf = 0, running = false, last = 0, now = 0, mAct = 0;
    const MOUSE_R = 170, HERO_R = 190;

    // pre-drawn glow sprites, one per palette colour (cheaper than shadowBlur)
    const sprites = o.palette.map(c => {
      const s = document.createElement('canvas'), S = 64, x = s.getContext('2d');
      s.width = s.height = S;
      const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, `rgba(${c.rgb},${o.core})`);
      g.addColorStop(.18, `rgba(${c.rgb},${o.core * .55})`);
      g.addColorStop(1, `rgba(${c.rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      return s;
    });

    // one shooting star: launches every 4 - 5 s, top-left towards bottom-right
    const shooters = [{ on: false, timer: rnd(1200, 2200) }];

    function launch(s) {
      const ang = rnd(.55, .85), sp = rnd(900, 1100);       // radians below horizontal (a clear diagonal)
      s.x = rnd(-.05, .4) * w; s.y = rnd(-.05, .22) * h;
      s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp;
      s.age = 0; s.life = rnd(1, 1.25); s.len = rnd(200, 260); s.on = true;
      s.timer = rnd(4000, 5000);                             // time until the next launch
    }

    function pickHero(hr, age) {
      hr.i = Math.floor(Math.random() * stars.length);
      hr.life = rnd(6, 9); hr.age = age;
    }

    function build() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(30, Math.min(88, Math.round(w * h / 17000)));
      stars = Array.from({ length: n }, (_, i) => {
        // 10% big, 30% mid, 60% small. Old max radius was 1.7, so big tops out at 3.4
        const tier = i < n * .1 ? 2 : i < n * .4 ? 1 : 0;
        const r = tier === 2 ? rnd(2.4, 3.4) : tier === 1 ? rnd(1.5, 2.3) : rnd(.5, 1.3);
        const sp = 5 + tier * 1.5;                               // px per second, very slow
        const ang = Math.random() * 6.283, bx = Math.random() * w, by = Math.random() * h;
        return {
          x: bx, y: by, bx, by, r, tier,
          vx: Math.cos(ang) * rnd(.6, 1) * sp, vy: Math.sin(ang) * rnd(.6, 1) * sp,
          amp: rnd(8, 18), f1: rnd(.45, 1.0), f2: rnd(.4, .9), p1: Math.random() * 6.28, p2: Math.random() * 6.28,
          p: Math.random() * 6.28, s: rnd(.4, 1.2),
          c: Math.floor(Math.random() * o.palette.length), hl: 0, m: 0
        };
      });
      heroes = [0, 1, 2].map(k => { const hr = {}; pickHero(hr, k * 2.5); return hr; });
    }

    function frame(t) {
      const dt = Math.min((t - (last || t)) / 1000, .05); last = t; now = t;
      ctx.clearRect(0, 0, w, h);

      // move: constant slow drift of a base point, plus a soft floating loop around it
      if (!reduce) for (const a of stars) {
        a.bx += a.vx * dt; a.by += a.vy * dt;
        if (a.bx < -20) a.bx = w + 20; else if (a.bx > w + 20) a.bx = -20;
        if (a.by < -20) a.by = h + 20; else if (a.by > h + 20) a.by = -20;
        a.x = a.bx + Math.sin(t / 1000 * a.f1 + a.p1) * a.amp;
        a.y = a.by + Math.cos(t / 1000 * a.f2 + a.p2) * a.amp;
      }

      // highlighted constellations: a few clusters swell and fade, then move on
      for (const a of stars) a.hl = 0;
      for (const hr of heroes) {
        hr.age += dt; if (hr.age > hr.life) pickHero(hr, 0);
        const pulse = reduce ? .6 : Math.sin(Math.PI * hr.age / hr.life), c = stars[hr.i];
        for (const a of stars) {
          const d = Math.hypot(a.x - c.x, a.y - c.y);
          if (d < HERO_R) a.hl = Math.max(a.hl, pulse * (1 - d / HERO_R));
        }
      }

      // mouse: nearby stars glow a little more
      mAct += ((mouse.on ? 1 : 0) - mAct) * Math.min(1, dt * 5);
      for (const a of stars) {
        const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        const k = d < MOUSE_R ? 1 - d / MOUSE_R : 0;
        a.m = k * k * (3 - 2 * k) * mAct;
      }

      // constellation lines
      const L = o.link;
      for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i], b = stars[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < L * L) {
          const hl = (a.hl + b.hl) / 2, m = (a.m + b.m) / 2;
          const al = Math.min(.85, (1 - Math.sqrt(d2) / L) * o.line * (1 + hl * 3 + m * .9));
          ctx.strokeStyle = `rgba(${o.palette[a.c].rgb},${al})`;
          ctx.lineWidth = .7 + hl * .9 + m * .3;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      // stars
      for (const a of stars) {
        const tw = reduce ? 1 : .65 + .35 * Math.sin(t / 1000 * a.s + a.p);
        const gs = a.r * 9 * (1 + a.hl * .6 + a.m * .45);
        ctx.globalAlpha = Math.min(1, tw + a.hl * .4 + a.m * .3);
        ctx.drawImage(sprites[a.c], a.x - gs, a.y - gs, gs * 2, gs * 2);
        ctx.fillStyle = `rgb(${o.palette[a.c].dot})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 + a.hl * .25 + a.m * .3), 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // shooting star: bright thin white head with a long fading tail
      if (!reduce) for (const s of shooters) {
        s.timer -= dt * 1000;
        if (!s.on) { if (s.timer <= 0) launch(s); continue; }
        s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
        const f = s.age / s.life, fade = Math.sin(Math.PI * Math.min(f, 1));
        const sp = Math.hypot(s.vx, s.vy), tx = s.x - s.vx / sp * s.len, ty = s.y - s.vy / sp * s.len;
        const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
        g.addColorStop(0, `rgba(${o.shoot},0)`); g.addColorStop(1, `rgba(${o.shoot},${fade})`);
        ctx.lineCap = 'round'; ctx.strokeStyle = g;
        ctx.globalAlpha = .3; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();   // soft halo
        ctx.globalAlpha = 1; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();  // bright core
        ctx.globalAlpha = fade; ctx.drawImage(sprites[0], s.x - 22, s.y - 22, 44, 44);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
        if (f >= 1) s.on = false;
      }

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    return {
      start() { if (running) return; running = true; last = 0; build(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      resize() { if (running) { build(); if (reduce) frame(0); } }
    };
  }

  // one palette and one set of rules for both screens: bright neon on a transparent canvas
  const cfg = {
    palette: [
      { rgb: '0,245,255', dot: '190,255,255' },    // neon cyan
      { rgb: '255,60,210', dot: '255,190,240' },   // neon magenta
      { rgb: '190,255,60', dot: '235,255,170' }    // neon lime
    ],
    shoot: '215,245,255', core: .6, line: .26, link: 150
  };
  const landing = sky(document.getElementById('sky'), cfg);
  const choose = document.getElementById('choose');
  const after = sky(document.getElementById('skyChoose'), cfg);

  landing.start();
  const sync = () => {
    if (choose.classList.contains('show')) { landing.stop(); after.start(); }
    else { after.stop(); landing.start(); }
  };
  new MutationObserver(sync).observe(choose, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => { landing.resize(); after.resize(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { landing.stop(); after.stop(); } else sync();
  });
})();
