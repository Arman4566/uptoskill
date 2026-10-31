/* UpToSkill service worker: shows push notifications (weekly events, daily reminders) even when the website is closed.
   It is served from the frontend root so it can notify for every page. It does not cache anything. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "UpToSkill", {
    body: d.body || "", tag: d.tag || "uts", icon: "/assets/logo-icon.png", badge: "/assets/favicon.png", data: { url: d.url || "/student/app.html" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/student/app.html", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.indexOf("/student/") !== -1 && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
