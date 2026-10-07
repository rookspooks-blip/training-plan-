/* Офлайн-режим.
   Код приложения (страница, js, css, календарь): сначала сеть, чтобы
   обновления приходили сами, без сети — из кэша.
   Иконки и картинки: сначала кэш.
   При изменении списка файлов увеличь VERSION. */
const VERSION = 'v18';
const CACHE = 'tri-cikla-' + VERSION;
const FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/calendar.js',
  './js/export.js',
  './js/figures.js',
  './js/food-data.js',
  './js/food.js',
  './js/iphone.js',
  './js/main.js',
  './js/plan-extra.js',
  './js/plan.js',
  './js/progress.js',
  './js/rules.js',
  './js/store.js',
  './js/tech.js',
  './js/training.js',
  './js/ui.js',
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

const isCode = url => url.pathname.endsWith('/') || /\.(html|js|css|ics|webmanifest)$/.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (req.mode === 'navigate' || isCode(url)) {
    /* страница всегда кладётся под одним ключом */
    const key = req.mode === 'navigate' ? './index.html' : url.pathname;
    e.respondWith(
      /* no-cache: всегда спрашиваем сервер, нет ли новой версии,
         а не берём копию из кэша браузера (GitHub держит её 10 минут) */
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
          return res;
        })
        .catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
