/* Проверка приложения в эмуляции iPhone.
   Запуск: node tests/smoke.mjs   (нужен playwright; путь можно задать в PW=...)
   Сам поднимает сервер на свободном порту и печатает OK/FAIL по каждому пункту. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = await import(process.env.PW || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ics':'text/calendar' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}/`;

let fails = 0;
const check = (name, ok, extra='') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

const browser = await chromium.launch();
async function page(opts = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], reducedMotion: 'reduce', serviceWorkers: opts.sw ? 'allow' : 'block' });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) p.errs.push(m.text()); });
  if (opts.init) await p.addInitScript(opts.init, opts.arg);
  await p.goto(URL0, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { ctx, p };
}

/* 1. Загрузка, все вкладки, плеер, библиотека и настройки без ошибок */
{
  const { ctx, p } = await page();
  for (const t of ['now', 'plan', 'food', 'me']) { await p.click(`#tabbar [data-go="${t}"]`); await p.waitForTimeout(150); }
  await p.evaluate(() => { openLibrary(); openLibGroup('tech'); closePage(true); openSettings(); closePage(true);
    const e = buildWeek().find(x => x.type === 'gym'); openPlayer(e.id); closePlayer(); openJumpTool(); closePage(true); });
  check('загрузка, вкладки, плеер, страницы без ошибок', p.errs.length === 0, p.errs.join(' | '));
  check('формат данных записан', await p.evaluate(() => localStorage.getItem('planSchema')) === '3');
  await ctx.close();
}

/* 2. Миграция старого формата: автокопия + удаление старых ключей */
{
  const { ctx, p } = await page({ init: () => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('planGrams', JSON.stringify({ 'x-y': 100 }));
    localStorage.setItem('planCustom', JSON.stringify([{ name: 'старое', k: 1 }]));
    localStorage.setItem('planMarks', JSON.stringify({ '1-1-d1-a1': true }));
  } });
  const r = await p.evaluate(() => ({
    schema: localStorage.getItem('planSchema'),
    grams: localStorage.getItem('planGrams'),
    auto: JSON.parse(localStorage.getItem('planAutoBackup') || 'null'),
    marks: marks['1-1-d1-a1'],
  }));
  check('миграция 1→3', r.schema === '3' && r.grams === null && r.marks === true);
  check('автокопия перед миграцией', !!(r.auto && r.auto.data.planGrams && r.auto.data.planMarks));
  await ctx.close();
}

/* 2б. Формат 2 → 3: данные не трогаются */
{
  const data = { planMarks: { '1-1-d1-a1': true }, planLog: { '1-1-d1-a4': { n: 'X', d: '2026-10-05', sets: [{ w: '6', r: '10' }], rpe: 8 } },
    planBody: { '2026-10-05': { w: 76.2, knee: 2 } }, planFood: { '1-1-0': { dishOn: { shake: true }, grams: {}, custom: [], times: { shake: '09:00' } } } };
  const { ctx, p } = await page({ init: d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear(); localStorage.setItem('planSchema', '2');
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, arg: data });
  const r = await p.evaluate(keys => ({ schema: localStorage.getItem('planSchema'), same: keys.map(k => localStorage.getItem(k)) }), Object.keys(data));
  check('миграция 2→3 без изменений данных', r.schema === '3' && r.same.every((v, i) => v === JSON.stringify(Object.values(data)[i])), JSON.stringify(r).slice(0, 160));
  await ctx.close();
}

/* 3. Битые данные не роняют приложение */
{
  const { ctx, p } = await page({ init: () => {
    localStorage.setItem('planSchema', '3');
    localStorage.setItem('planMarks', '[1,2]');
    localStorage.setItem('planCirc', '{"a":1}');
    localStorage.setItem('planPos', '{"cycle":9,"week":-4}');
    localStorage.setItem('planFood', 'не json');
    localStorage.setItem('planCook', '"строка"');
  } });
  const r = await p.evaluate(() => ({ m: Array.isArray(marks), c: Array.isArray(circ), s: state, cook: typeof cook }));
  for (const t of ['now', 'plan', 'food', 'me']) { await p.click(`#tabbar [data-go="${t}"]`); await p.waitForTimeout(100); }
  check('битые данные заменяются пустыми', !r.m && r.c && r.s.cycle === 1 && r.s.week >= 1 && r.cook === 'object' && p.errs.length === 0, p.errs.join(' | '));
  await ctx.close();
}

/* 4. Ошибка записи видна пользователю */
{
  const { ctx, p } = await page();
  const r = await p.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    const ok = store.set('planMarks', {});
    Storage.prototype.setItem = orig;
    return { ok, toast: document.querySelector('#toast span')?.textContent || '' };
  });
  check('ошибка записи → подсказка', r.ok === false && /сохранить/i.test(r.toast), r.toast);
  await ctx.close();
}

/* 5. Текст пользователя не превращается в разметку */
{
  const { ctx, p } = await page();
  const r = await p.evaluate(() => {
    goTab('food');
    custom.push({ name: '<img src=x onerror="window.__x=1">Шаурма', k: 700, p: 30, f: 30, c: 70, t: '12:00' });
    saveFood(); renderAll();
    const el = [...document.querySelectorAll('#scr-food [data-ci] .nm')].find(e => /Шаурма/.test(e.textContent));
    return { text: el ? el.textContent : null, img: el ? !!el.querySelector('img') : null, x: window.__x };
  });
  check('экранирование своей еды', r.text && r.text.includes('<img') && r.img === false && r.x === undefined, JSON.stringify(r));
  await ctx.close();
}

/* 6. Копия: сохранить → восстановить заменяет данные полностью */
{
  const { ctx, p } = await page();
  const r = await p.evaluate(() => {
    marks = { a: true }; saveMarks();
    watch = {}; store.set('planWatch', { w: 1 });
    const b = makeBackup();
    delete b.data.planWatch;
    marks = { b: true }; saveMarks();
    const res = restoreData(b, 'тест');
    return { res, marks: localStorage.getItem('planMarks'), watch: localStorage.getItem('planWatch'),
             auto: JSON.parse(localStorage.getItem('planAutoBackup')).data.planMarks };
  });
  check('восстановление из копии', r.res === 'ok' && r.marks === '{"a":true}' && r.watch === null && r.auto.b === true, JSON.stringify(r));
  check('не копия → отказ', await p.evaluate(() => restoreData({ app: 'other' }, 'x')) === 'bad');
  await ctx.close();
}

/* 6б. Фото движений: у каждого упражнения из карт есть оба кадра */
{
  const { ctx, p } = await page();
  const r = await p.evaluate(async () => {
    const slugs = [...new Set([...Object.values(PHOTO_BY_TECH), ...Object.values(PHOTO_BY_NAME)].filter(Boolean))];
    const bad = [];
    for (const s of slugs) for (const n of [0, 1]) { const res = await fetch(`img/ex/${s}-${n}.webp`); if (!res.ok) bad.push(`${s}-${n}`); }
    return { n: slugs.length, bad };
  });
  check(`фото движений на месте (${r.n} упражнений)`, r.bad.length === 0, r.bad.join(', '));
  const sw = await (await fetch(URL0 + 'sw.js')).text();
  const miss = (await p.evaluate(() => [...new Set([...Object.values(PHOTO_BY_TECH), ...Object.values(PHOTO_BY_NAME)].filter(Boolean))]))
    .flatMap(s => [0, 1].map(n => `img/ex/${s}-${n}.webp`)).filter(f => !sw.includes(f));
  check('все фото в офлайн-кэше', miss.length === 0, miss.join(', '));
  await ctx.close();
}

/* 6в. Список офлайн-кэша: без повторов (повтор в addAll — и кэш не ставится совсем), все файлы на месте */
{
  const sw = await (await fetch(URL0 + 'sw.js')).text();
  const list = sw.slice(sw.indexOf('const FILES = ['), sw.indexOf('];', sw.indexOf('const FILES = [')));
  const files = [...list.matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]);
  const dup = files.filter((f, i) => files.indexOf(f) !== i);
  const missing = [];
  for (const f of new Set(files)) { const r = await fetch(URL0 + f.slice(2)); if (!r.ok) missing.push(f); }
  const scripts = [...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/src="([^"]+)"/g)].map(m => './' + m[1]).filter(f => !files.includes(f));
  check(`офлайн-кэш: ${files.length} файлов без повторов и пропусков`, !dup.length && !missing.length && !scripts.length,
    [dup.length && 'повтор: ' + dup.join(', '), missing.length && 'нет на сервере: ' + missing.join(', '), scripts.length && 'скрипт не в кэше: ' + scripts.join(', ')].filter(Boolean).join(' | '));
}

/* 7. Офлайн: после первого открытия всё работает без сети */
{
  const { ctx, p } = await page({ sw: true });
  const ready = await p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]));
  /* раньше здесь был пропуск — и офлайн молча не ставился с v32 (повтор файла в списке кэша) */
  check('service worker установился', ready);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  p.errs.length = 0;
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(500);
  const ok = await p.evaluate(() => typeof renderAll === 'function' && document.body.innerText.length > 500);
  check('офлайн-запуск', ok && p.errs.length === 0, p.errs.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} проверок не прошли` : '\nВсе проверки прошли');
process.exit(fails ? 1 : 0);
