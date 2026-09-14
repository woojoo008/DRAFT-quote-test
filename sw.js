// Minimal service worker — required by Chrome/Android for the "Add to Home Screen"
// install prompt to appear automatically. It doesn't cache anything special;
// it just needs to exist and handle fetch so the site qualifies as installable.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
