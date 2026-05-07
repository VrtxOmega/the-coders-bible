// Coder's Bible — Service Worker
// Cache-first for shell + sql.js. The 64 MB DB is cached separately by the
// engine itself in IndexedDB, so we don't try to precache it here.

const CACHE_NAME = 'coders-bible-v2.1.1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './wasm_engine.js',
  './sql-wasm.js',
  './sql-wasm.wasm',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Don't intercept the DB — it's already IndexedDB-cached by the engine,
  // and HTTP-caching a 64MB body in the SW cache is wasteful.
  if (request.url.endsWith('/coders_bible.db')) return;

  // Shell assets: cache-first, fall back to network, update cache async.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
