// Service worker for MindCare. Its only job is push notifications for the
// staff submissions dashboard: when someone submits any form on the website,
// the Edge Function sends a push and this shows it on the phone.
//
// The push itself carries no payload, so no personal detail travels through
// Google's or Apple's push service. Instead this asks our own server what just
// arrived, over the signed-in session, and puts that in the notification. If
// that call cannot be made the notification still appears, just without the
// name on it: a push subscription is userVisibleOnly, so failing to show
// anything would have the browser show "this site was updated in the
// background" on our behalf, which is worse than a vague line of our own.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const FALLBACK = {
  title: "New website submission",
  body: "Tap to see who it is.",
  tag: "mindcare-submission",
};

/** Reads any payload the push itself carried. Normally there is none. */
function fromPush(event) {
  if (!event.data) return null;
  try {
    const data = event.data.json();
    if (data && (data.title || data.body)) return { title: data.title, body: data.body, tag: data.tag };
  } catch (e) {
    const raw = event.data.text();
    if (raw) return { body: raw };
  }
  return null;
}

/**
 * Asks the dashboard what the newest submission is. Same-origin, so the
 * session cookie goes with it and the details never leave our own server.
 */
async function fromServer() {
  try {
    const res = await fetch("/submissions?latest=1", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.title ? data : null;
  } catch (e) {
    return null;
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const detail = fromPush(event) || await fromServer() || {};
    await self.registration.showNotification(detail.title || FALLBACK.title, {
      body: detail.body || FALLBACK.body,
      icon: "/assets/icons/icon-192.png",
      badge: "/assets/icons/icon-192.png",
      // A tag per submission, so two arriving close together stack up rather
      // than the second quietly replacing the first.
      tag: detail.tag || FALLBACK.tag,
      renotify: true,
      timestamp: Date.now(),
      data: { url: "/submissions" },
    });
  })());
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
