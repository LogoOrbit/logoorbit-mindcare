// Service worker for MindCare. Its only job is push notifications for the
// staff submissions dashboard: when someone registers for a workshop, the
// Edge Function sends a push and this shows it on the phone.
//
// The push is sent without a payload, so nothing about the person who
// registered travels through Google's push service. Tapping the notification
// opens /submissions, where the details actually live.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let title = "New workshop registration";
  let body = "Tap to open the submissions dashboard.";
  // Payload-less pushes are the normal case; read one if it ever arrives.
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
    } catch (e) {
      const raw = event.data.text();
      if (raw) body = raw;
    }
  }
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-192.png",
    tag: "mindcare-submission",
    renotify: true,
    data: { url: "/submissions" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/submissions";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if (client.url.indexOf("/submissions") !== -1 && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(url);
  })());
});
