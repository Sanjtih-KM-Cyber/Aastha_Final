/* Web Push handlers, imported into the Workbox-generated service worker (vite.config.ts → workbox.importScripts). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Aastha';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "I'm here if you want to talk.",
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      tag: data.tag || 'aastha',
      renotify: false,
      data: { url: data.url || '/sanctuary' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/sanctuary';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
