/* Офлайн-режим.
   Код приложения (страница, js, css, календарь): сначала сеть, чтобы
   обновления приходили сами. Сеть не ответила за NET_WAIT — открываем
   из кэша, а свежую копию докачиваем в фоне к следующему запуску.
   Иконки и картинки: сначала кэш.
   При изменении списка файлов увеличь VERSION. */
const VERSION = 'v58';
const CACHE = 'tri-cikla-' + VERSION;
const NET_WAIT = 3000;
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
  './js/photos.js',
  './js/plan-extra.js',
  './js/plan.js',
  './js/progress.js',
  './js/rules.js',
  './js/store.js',
  './js/tech.js',
  './js/training.js',
  './js/ui/kit.js',
  './js/ui/now.js',
  './js/ui/player.js',
  './js/ui/week.js',
  './js/ui/foodtab.js',
  './js/ui/me.js',
  './js/ui/library.js',
  './js/ui/settings.js',
  './js/ui/native.js',
  './js/ui/app.js',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './plan.ics',
  './img/ex/barbell-bench-press---medium-grip-0.webp',
  './img/ex/barbell-bench-press---medium-grip-1.webp',
  './img/ex/barbell-full-squat-0.webp',
  './img/ex/barbell-full-squat-1.webp',
  './img/ex/bent-over-barbell-row-0.webp',
  './img/ex/bent-over-barbell-row-1.webp',
  './img/ex/butt-lift-bridge-0.webp',
  './img/ex/butt-lift-bridge-1.webp',
  './img/ex/calf-raise-on-a-dumbbell-0.webp',
  './img/ex/calf-raise-on-a-dumbbell-1.webp',
  './img/ex/calf-stretch-hands-against-wall-0.webp',
  './img/ex/calf-stretch-hands-against-wall-1.webp',
  './img/ex/calves-smr-0.webp',
  './img/ex/calves-smr-1.webp',
  './img/ex/chin-up-0.webp',
  './img/ex/chin-up-1.webp',
  './img/ex/dead-bug-0.webp',
  './img/ex/dead-bug-1.webp',
  './img/ex/decline-push-up-0.webp',
  './img/ex/decline-push-up-1.webp',
  './img/ex/dips---chest-version-0.webp',
  './img/ex/dips---chest-version-1.webp',
  './img/ex/dumbbell-bicep-curl-0.webp',
  './img/ex/dumbbell-bicep-curl-1.webp',
  './img/ex/dumbbell-one-arm-triceps-extension-0.webp',
  './img/ex/dumbbell-one-arm-triceps-extension-1.webp',
  './img/ex/dumbbell-shoulder-press-0.webp',
  './img/ex/dumbbell-shoulder-press-1.webp',
  './img/ex/face-pull-0.webp',
  './img/ex/face-pull-1.webp',
  './img/ex/freehand-jump-squat-0.webp',
  './img/ex/freehand-jump-squat-1.webp',
  './img/ex/front-box-jump-0.webp',
  './img/ex/front-box-jump-1.webp',
  './img/ex/hamstring-smr-0.webp',
  './img/ex/hamstring-smr-1.webp',
  './img/ex/hamstring-stretch-0.webp',
  './img/ex/hamstring-stretch-1.webp',
  './img/ex/hurdle-hops-0.webp',
  './img/ex/hurdle-hops-1.webp',
  './img/ex/iliotibial-tract-smr-0.webp',
  './img/ex/iliotibial-tract-smr-1.webp',
  './img/ex/inchworm-0.webp',
  './img/ex/inchworm-1.webp',
  './img/ex/it-band-and-glute-stretch-0.webp',
  './img/ex/it-band-and-glute-stretch-1.webp',
  './img/ex/kettlebell-one-legged-deadlift-0.webp',
  './img/ex/kettlebell-one-legged-deadlift-1.webp',
  './img/ex/kettlebell-pistol-squat-0.webp',
  './img/ex/kettlebell-pistol-squat-1.webp',
  './img/ex/kneeling-hip-flexor-0.webp',
  './img/ex/kneeling-hip-flexor-1.webp',
  './img/ex/lateral-cone-hops-0.webp',
  './img/ex/lateral-cone-hops-1.webp',
  './img/ex/leg-extensions-0.webp',
  './img/ex/leg-extensions-1.webp',
  './img/ex/natural-glute-ham-raise-0.webp',
  './img/ex/natural-glute-ham-raise-1.webp',
  './img/ex/one-arm-dumbbell-row-0.webp',
  './img/ex/one-arm-dumbbell-row-1.webp',
  './img/ex/pallof-press-0.webp',
  './img/ex/pallof-press-1.webp',
  './img/ex/piriformis-smr-0.webp',
  './img/ex/piriformis-smr-1.webp',
  './img/ex/platform-hamstring-slides-0.webp',
  './img/ex/platform-hamstring-slides-1.webp',
  './img/ex/pullups-0.webp',
  './img/ex/pullups-1.webp',
  './img/ex/pushups-0.webp',
  './img/ex/pushups-1.webp',
  './img/ex/quadriceps-smr-0.webp',
  './img/ex/quadriceps-smr-1.webp',
  './img/ex/seated-bent-over-rear-delt-raise-0.webp',
  './img/ex/seated-bent-over-rear-delt-raise-1.webp',
  './img/ex/seated-leg-curl-0.webp',
  './img/ex/seated-leg-curl-1.webp',
  './img/ex/side-bridge-0.webp',
  './img/ex/side-bridge-1.webp',
  './img/ex/side-lateral-raise-0.webp',
  './img/ex/side-lateral-raise-1.webp',
  './img/ex/single-leg-glute-bridge-0.webp',
  './img/ex/single-leg-glute-bridge-1.webp',
  './img/ex/split-squat-with-dumbbells-0.webp',
  './img/ex/split-squat-with-dumbbells-1.webp',
  './img/ex/standing-dumbbell-press-0.webp',
  './img/ex/standing-dumbbell-press-1.webp',
  './img/ex/standing-dumbbell-triceps-extension-0.webp',
  './img/ex/standing-dumbbell-triceps-extension-1.webp',
  './img/ex/standing-military-press-0.webp',
  './img/ex/standing-military-press-1.webp',
  './img/ex/standing-soleus-and-achilles-stretch-0.webp',
  './img/ex/standing-soleus-and-achilles-stretch-1.webp',
  './img/ex/trap-bar-deadlift-0.webp',
  './img/ex/trap-bar-deadlift-1.webp'
];

/* Код кладём весь или никакой: без него офлайн не откроется. Картинки — по одной,
   отсутствие одной не должна ломать установку. reload — мимо кэша браузера,
   иначе в новый кэш попадёт копия, которую GitHub отдал до обновления */
const fresh = u => new Request(u, { cache: 'reload' });
self.addEventListener('install', e => {
  const list = [...new Set(FILES)];   /* повтор в addAll — ошибка, и офлайн не ставится совсем */
  const code = list.filter(u => !u.startsWith('./img/')), img = list.filter(u => u.startsWith('./img/'));
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(code.map(fresh)).then(() => Promise.allSettled(img.map(u => c.add(fresh(u))))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

let slowUntil = 0;   /* до этого момента код берём из кэша сразу: сеть только что не успела */
const isCode = url => url.pathname.endsWith('/') || /\.(html|js|css|ics|webmanifest)$/.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  /* номер сборки на сервере (плашка «Вышла новая версия») — только из сети, мимо кэша */
  if (url.pathname.endsWith('/sw.js')) return;

  if (req.mode === 'navigate' || isCode(url)) {
    /* страница всегда кладётся под одним ключом */
    const key = req.mode === 'navigate' ? './index.html' : url.pathname;
    const fromCache = () => caches.match(key, { ignoreSearch: true }).then(hit => hit || caches.match(req, { ignoreSearch: true }));
    /* no-cache: всегда спрашиваем сервер, нет ли новой версии,
       а не берём копию из кэша браузера (GitHub держит её 10 минут) */
    let saved = Promise.resolve(), netDone = false;
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        netDone = true;
        if (res.ok) { const copy = res.clone(); saved = caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      });
    e.waitUntil(net.then(() => saved, () => {}).catch(() => {}));   /* свежая копия докачается, даже если ответил кэш */
    /* слабая сеть: ждём не дольше NET_WAIT, дальше — кэш. Кэша нет — ждём сеть до конца.
       Страница уже открылась из кэша — остальные её файлы тоже из кэша, без ожидания: версии не смешаются */
    const wait = Date.now() < slowUntil ? 0 : NET_WAIT;
    const slow = new Promise(r => setTimeout(r, wait)).then(() => netDone ? net : fromCache()
      .then(hit => { if (hit && wait) slowUntil = Date.now() + 5000; return hit || net; }));
    e.respondWith(Promise.race([net.catch(() => fromCache()), slow]).then(res => res || net));
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
