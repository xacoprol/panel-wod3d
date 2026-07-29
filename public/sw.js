/* Minimal service worker — required for installability on Chromium; Safari Mac usa el manifest. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first: la app es dinámica (auth + DB)
  event.respondWith(fetch(event.request));
});
