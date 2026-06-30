const CACHE_NAME = 'aws-exam-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=2',
  './app.js?v=2',
  './manifest.json?v=2',
  './icon.svg?v=2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      if (key !== CACHE_NAME) return caches.delete(key);
      return null;
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok && request.url.startsWith(self.location.origin)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});
