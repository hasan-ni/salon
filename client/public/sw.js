// Service worker: shows alerts from the salon even when the website is closed.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data.json(); } catch { /* no data */ }
  const important = d.kind === 'turn' || d.kind === 'next' || d.kind === 'staff-booked';
  event.waitUntil(self.registration.showNotification(d.title || 'Maison Lilac', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.kind || 'message',
    renotify: true,                       // without this, a new alert with the same tag arrives silently
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: important,        // stays on screen until tapped (desktop)
    data: { url: d.url || '/book' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate?.(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
