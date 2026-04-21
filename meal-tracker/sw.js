const CACHE_NAME = 'meal-tracker-v7';
const APP_FILES = [
  './',
  './index.html',
  './foods.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  // Network-first for HTML so new deployments are always loaded
  const url = new URL(req.url);
  const isHTML = req.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname === '/meal-tracker';

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return networkRes;
        })
        .catch(err => {
          console.warn('[SW] Network fetch failed for HTML, serving from cache:', err);
          return caches.match(req).then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // Cache-first for other static assets (JS, CSS, images, JSON)
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(networkRes => {
        const copy = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (req.url.startsWith(self.location.origin)) {
            cache.put(req, copy);
          }
        });
        return networkRes;
      }).catch(() => caches.match('./index.html'));
    })
  );
});