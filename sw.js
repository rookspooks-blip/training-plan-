/* Офлайн-режим. Страница: сначала сеть (чтобы обновления приходили сами),
   без сети — из кэша. Иконки и manifest: сначала кэш.
   При изменении файлов приложения увеличь VERSION. */
const VERSION = 'v11';
const CACHE = 'tri-cikla-' + VERSION;
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './plan.ics'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      /* no-cache: всегда спрашиваем сервер, нет ли новой версии,
         а не берём копию из кэша браузера (GitHub держит её 10 минут) */
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
