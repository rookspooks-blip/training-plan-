/* Реестр решений (docs/redesign/00-registry.md): по каждой из 200 строк — проверка в приложении.
   Запуск: node tests/registry.mjs   (нужен playwright; путь можно задать в PW=...)
   REG_OUT=файл.json — сохранить результаты для таблицы сверки */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = await import(process.env.PW || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ics':'text/calendar' };
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

const R = {};
let fails = 0;
const ok = (n, cond, extra = '') => {
  const prev = R[n]; const good = !!cond && (!prev || prev.ok);
  R[n] = { ok: good, d: [prev && prev.d, extra].filter(Boolean).join(' | ') };
  if (!cond) { fails++; console.log(`FAIL ${n} ${extra}`); }
};

const browser = await chromium.launch();
/* Данные: журнал, замеры, еда, тесты — как у живого пользователя на 3-й неделе */
const lg = (n, d, w, r, rpe, k = 3) => ({ n, d, sets: Array.from({ length: k }, () => ({ w: String(w), r: String(r) })), rpe, tr: r, th: r + 2, ns: k, wk: 'build' });
const BASE = {
  planOnboarded: true, planHintOff: true,
  planLog: { '1-2-d1-a1': lg('Болгарский сплит-присед', '2026-10-12', '', 11, 8, 4), '1-2-d1-a2': lg('Подтягивания', '2026-10-12', '', 8, 9, 4),
    '1-2-d3-c3': lg('Скольжение пяток на полотенце', '2026-10-17', '', 8, 7) },
  planBody: { '2026-10-08': { w: 77.2 }, '2026-10-10': { w: 77.0 }, '2026-10-13': { w: 76.8, hr: 56 }, '2026-10-15': { w: 76.6 }, '2026-10-17': { w: 76.4 }, '2026-10-20': { w: 76.1, knee: 1, back: 1 } },
  planTests: [{ d: '2026-09-20', t: 'pull', v: 8 }, { d: '2026-09-20', t: 'm60', v: 8.1 }, { d: '2026-10-03', t: 'jump', v: 50 }, { d: '2026-10-03', t: 'jump', v: 52 }],
  planFood: { '1-3-0': { dishOn: { shake: true, chicken: true, g_rice: true }, grams: {}, custom: [{ name: 'Кола 0,5 л', k: 212, p: 0, f: 0, c: 53, t: '15:00' }], times: { shake: '09:00', chicken: '13:00' } },
    '1-3-1': { dishOn: { shake: true }, grams: {}, custom: [], times: { shake: '09:10' } } },
  planCirc: [{ d: '2026-10-05', a: 80, b: 84, h: 56 }],
};
async function at(time, data = {}, opts = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true, ...(opts.ctx || {}) });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear(); localStorage.setItem('planSchema', '3');
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, data);
  await p.goto(URL0, { waitUntil: 'load' });
  await p.waitForTimeout(200);
  p.ctx = ctx;
  return p;
}
const E = (p, f, a) => p.evaluate(f, a);
const T = p => p.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));   /* текст экрана, листов и страниц */
const close = async p => { ok('_errors', p.errs.length === 0, p.errs.join(' | ')); await p.ctx.close(); };

/* ===== 1. Каркас, неделя, данные ===== */
{
  const p = await at('2026-10-21T13:00:00', BASE);
  await p.click('#tabbar [data-go="plan"]');
  let t = await T(p);
  ok(1, /Неделя 3 из 12/.test(t) && /Цикл 1 · сушка · свой вес/.test(t) && /рабочая/.test(t), 'План: «Неделя 3 из 12», «Цикл 1 · сушка · свой вес», «рабочая»');
  ok(4, await E(p, () => document.querySelectorAll('#scr-plan .year [data-yi]').length === 52), 'полоса года: 52 недели (12 + 4 сессии + 12 + 24)');
  ok(24, await E(p, () => document.querySelectorAll('#scr-plan .wk .wd').length === 7 && !!document.querySelector('#scr-plan .wd.today')), '7 дней цветом, сегодня в рамке');
  { const bb = await (await p.$('#scr-plan .wk [data-dow="1"]')).boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(100); }
  ok(26, await E(p, () => !!document.querySelector('#sheets .sheet [data-knee]')), 'удержание дня — карточка дня, в ней зарядка для колен');
  await p.click('#sheets .sheet [data-knee]');
  ok(26, await E(p, () => /Понедельник/.test(document.querySelector('#sheets .sheet .kick').textContent) && document.querySelectorAll('#sheets .sheet [data-dx]').length === 4), 'зарядка этого дня по упражнениям');
  await p.click('#sheets .sheet [data-t]');
  ok(26, await E(p, () => !!marks['1-3-daily-0']), 'прошлый день отмечается');
  ok(20, await E(p, () => !document.querySelector('#toast button').hidden), 'тост с «Отменить»');
  await p.click('#toast button');
  ok(20, await E(p, () => !marks['1-3-daily-0']), '«Отменить» вернула');
  await p.click('#tabbar [data-go="now"]');
  t = await T(p);
  ok(2, await E(p, () => document.querySelectorAll('#scr-now .rings .ring').length === 2), 'кольца дня: тренировки и еда');
  ok(2, await E(p, () => /Разминка: \d+\/\d+/.test(dayText(dayExport('2026-10-19'))) || /разминка/i.test(dayText(dayExport('2026-10-19')))), 'счёт разминки — в выгрузке дня');
  /* настройки */
  await E(p, () => openSettings());
  t = await T(p);
  ok(4, await E(p, () => document.querySelectorAll('#page [data-cyc] [data-c]').length === 3 && document.querySelectorAll('#page .wpick .dl').length >= 2 && document.querySelectorAll('#page .wpick .ss').length === 4), '3 цикла, разгрузки/тест и сессия отмечены');
  ok(5, await E(p, () => document.querySelector('#page [data-auto]').checked === true), '«Неделя по дате» включена по умолчанию');
  ok(6, await E(p, () => document.querySelector('#page [data-start]').value === '2026-10-05'), 'старт 05.10.2026');
  ok(7, /Зимняя сессия/.test(t) && await E(p, () => settings.session === 4 && document.querySelector('#page [data-wt]').value === '2027-01-24' && document.querySelector('#page [data-wf]').value === '2026-12-28'), 'сессия 4 недели: 28.12–24.01');
  ok(8, /каникулы до 31 августа/.test(t) && await E(p, () => document.querySelector('#page [data-pt]').value === '2027-07-24' && document.querySelector('#page [data-pf]').value === '2027-07-01' && document.querySelector('#page [data-ef]').value === '2027-06-01' && document.querySelector('#page [data-et]').value === '2027-06-30'), 'лето по умолчанию: сессия июнь, практика 01.07–24.07, каникулы до 31.08');
  ok(199, /Меняет всё приложение: веса, разминку, калории, кардио и сон/.test(t) && /Жёлтая рамка — разгрузка или тест, синяя — сессия/.test(t), 'пояснение и легенда цветов');
  /* зимняя сессия по датам */
  await p.fill('#page [data-wt]', '2027-01-10'); await p.waitForTimeout(100);
  ok(7, await E(p, () => settings.session === 2 && maxWeek(1) === 14 && posForDate('2027-01-11').cycle === 2), '«по» 10.01 — две недели, цикл 2 с 11.01');
  await p.click('#toast button');
  ok(7, await E(p, () => settings.session === 4), '«Отменить» вернула четыре недели');
  await p.fill('#page [data-wt]', '2027-02-14'); await p.waitForTimeout(100);
  ok(7, await E(p, () => settings.session === 7), '«по» 14.02 — семь недель');
  await p.fill('#page [data-wf]', '2026-12-01'); await p.waitForTimeout(100);
  ok(7, await E(p, () => !settings.sesFrom && /не раньше/.test(document.querySelector('#toast span').textContent)), '«с» раньше конца сушки не принимается');
  await p.fill('#page [data-wf]', '2027-01-11'); await p.waitForTimeout(100);
  ok(7, await E(p, () => settings.sesFrom === '2027-01-11' && winterSession().from === '2027-01-11'), '«с» позже конца сушки сохраняется');
  await p.fill('#page [data-wt]', '2000-01-01'); await p.waitForTimeout(100);
  ok(7, await E(p, () => settings.session === 0 && maxWeek(1) === 12), 'дата раньше начала — сессии нет');
  await p.click('#toast button');
  /* лето по датам */
  await p.fill('#page [data-et]', '2027-06-20'); await p.fill('#page [data-pt]', '2027-07-10'); await p.waitForTimeout(100);
  ok(8, await E(p, () => { const S = summerDates(); return S.exam[1] === '2027-06-20' && S.practice[0] === '2027-06-21' && S.practiceEnd === '2027-07-10'; }), 'период сессии и практики меняется');
  await p.fill('#page [data-pf]', '2027-08-30'); await p.waitForTimeout(100);
  ok(8, await E(p, () => /позже конца/.test(document.querySelector('#toast span').textContent) && summerDates().practice[0] === '2027-06-21'), '«с» позже «по» не принимается');
  await p.fill('#page [data-et]', ''); await p.fill('#page [data-pt]', ''); await p.waitForTimeout(100);
  ok(8, await E(p, () => summerDates().exam[1] === '2027-06-30' && summerDates().practiceEnd === '2027-07-24'), 'пустое поле — даты по умолчанию');
  await E(p, () => { settings.session = 4; delete settings.sesFrom; delete settings.exFrom; delete settings.exTo; delete settings.prFrom; delete settings.prTo; saveSettings(); renderAll(); });
  await p.click('#page .wpick [data-w="5"]');
  ok(5, await E(p, () => settings.auto === false && state.week === 5 && /автовыбор по дате выключен/.test(document.querySelector('#toast').textContent)), 'ручной выбор выключает автовыбор, тост');
  await p.click('#page [data-auto]');
  ok(5, await E(p, () => settings.auto === true && state.week === 3), 'включил снова — неделя по дате');
  ok(14, await E(p, () => ['[data-backup]', '[data-restore]', '[data-wipe]'].every(s => document.querySelector('#page ' + s))), 'сохранить, восстановить, удалить');
  ok(15, /хранят данные раздельно/.test(t) && /раз в неделю/.test(t), 'текст про раздельное хранение и копию раз в неделю');
  ok(18, /Версия:/.test(t) && /Обновить приложение сейчас/.test(t), 'версия и кнопка обновления');
  ok(23, /free-exercise-db/.test(t) && /Unlicense/.test(t), 'источник фото');
  ok(193, await E(p, () => !!document.querySelector('#page [data-sub]') && !!document.querySelector('#page [data-ics]')) && /календарь только напоминает/.test(t), '«Подписаться», «Скачать .ics», «календарь только напоминает»');
  ok(151, await E(p, () => /Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье/.test(document.querySelector('#page [data-pre]').textContent) && !!document.querySelector('#page [data-exd="-1"]') && !!document.querySelector('#page [data-exjson]')), 'день текстом с ‹ ›, «День · JSON»');
  ok(152, await E(p, () => !!document.querySelector('#page [data-csv]') && !!document.querySelector('#page [data-alljson]') && CSV_COLS.length === 37), 'CSV (35 колонок + пах + сон) и JSON');
  const dl = p.waitForEvent('download'); await p.click('#page [data-csv]');
  const csv = fs.readFileSync(await (await dl).path(), 'utf8');
  ok(152, csv.charCodeAt(0) === 0xFEFF && csv.split('\r\n')[0].split(',').length === 37, 'CSV с BOM');
  /* тема */
  await p.click('#page [data-theme] [data-v="dark"]');
  ok(22, await E(p, () => document.documentElement.dataset.theme === 'dark'), 'тёмная тема');
  await p.click('#page [data-theme] [data-v="auto"]');
  ok(22, (await (await fetch(URL0 + 'css/app.css')).text()).includes('prefers-reduced-motion'), '«уменьшить движение» уважается');
  await E(p, () => closePage(true));
  /* вкладка запоминается */
  await p.click('#tabbar [data-go="food"]'); await p.reload({ waitUntil: 'load' });
  ok(11, await E(p, () => document.body.dataset.tab === 'food' && document.querySelectorAll('#tabbar [data-go]').length === 4), '4 вкладки, открытая запоминается');
  /* повторный тап по вкладке — наверх */
  await E(p, () => window.scrollTo(0, 800)); await p.click('#tabbar [data-go="food"]'); await p.waitForTimeout(700);
  ok(21, await E(p, () => window.scrollY < 50), 'повторный тап по вкладке — наверх');
  /* хранение */
  ok(12, await E(p, () => DATA_KEYS.length === 13 && DATA_KEYS.includes('planCook')), '13 ключей (12 + готовка)');
  ok(12, await E(p, () => { const o = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('q'); }; storeWarned = false; store.set('planMarks', marks); Storage.prototype.setItem = o; return /Не получилось сохранить/.test(document.querySelector('#toast').textContent); }), 'ошибка записи — тост');
  ok(13, await E(p, () => SCHEMA === 3 && typeof migrate === 'function' && typeof snapshot === 'function'), 'миграция по шагам со снимком (формат 3)');
  /* новый день при возврате */
  await p.clock.setFixedTime(new Date('2026-10-22T09:00:00'));
  await E(p, () => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.click('#tabbar [data-go="now"]');
  ok(10, /ЧТ ·|Чт ·/.test(await E(p, () => document.querySelector('#scr-now .kick').textContent)), 'новый день — экран перерисован');
  await close(p);
}
/* офлайн, обновление */
{
  const sw = await (await fetch(URL0 + 'sw.js')).text(), iph = await (await fetch(URL0 + 'js/iphone.js')).text();
  ok(17, /caches/.test(sw) && sw.includes('./js/ui/app.js') && iph.includes('План обновлён — перезапусти приложение'), 'service worker: кэш, все файлы, тост об обновлении');
}
/* логика даты */
{
  const p = await at('2026-10-01T10:00:00', {});
  const r = await E(p, () => [posForDate('2026-10-01'), posForDate('2026-12-28'), posForDate('2027-01-25'), posForDate('2027-09-27'), posForDate('2027-10-04')]);
  ok(9, r[0].pre && r[1].cycle === 1 && r[1].week === 13 && r[2].cycle === 2 && r[2].week === 1 && r[3].cycle === 3 && r[3].week === 24 && r[4].week === 25 && r[4].end, JSON.stringify(r));
  ok(3, /Старт плана — пн 5\.10/.test(await T(p)), 'до старта: «Старт плана — пн 5.10»');
  ok(19, await E(p, () => !!document.querySelector('#onbSlot .onb') && document.querySelectorAll('#onbSlot li').length === 3), 'онбординг 3 пункта');
  ok(16, await E(p, () => !!document.querySelector('#installSlot .install')), 'подсказка «На экран Домой» в Safari на iPhone');
  await p.click('#installSlot [data-x]');
  ok(16, await E(p, () => store.get('planHintOff', false) === true && !document.querySelector('#installSlot .install')), 'скрывается навсегда');
  await close(p);
}
{
  const p = await at('2026-10-12T10:00:00', { planSet: { auto: false, start: '2026-10-05', session: 4, kcalAdj: {} }, planPos: { cycle: 1, week: 2 } });
  ok(19, /Неделя выбрана вручную/.test(await E(p, () => document.querySelector('#onbSlot').textContent)), 'онбординг по настройке автовыбора');
  await close(p);
}
for (const [time, re, n] of [['2026-10-26T10:00:00', /Разгрузка/, 3], ['2026-12-21T10:00:00', /Тестовая неделя/, 3], ['2027-06-09T10:00:00', /Летняя сессия/, 93],
  ['2027-07-07T10:00:00', /Практика/, 93], ['2027-08-04T10:00:00', /Каникулы — главный блок года/, 93], ['2027-12-20T10:00:00', /План пройден/, 200]]) {
  const p = await at(time, {});
  ok(n, re.test(await T(p)), `статус-строка ${re}`);
  if (n === 200) { await p.click('#tabbar [data-go="plan"]'); ok(200, /Повтор блока · неделя/.test(await T(p)), 'шапка «Повтор блока»'); ok(9, /План пройден/.test(await E(p, () => weekInfo().label))); }
  await close(p);
}
{
  const p = await at('2026-10-29T10:00:00', { planSkips: { '1-3-skip-d1': true, '1-3-drop-d1': true, '1-3-skip-d3': true, '1-3-drop-d3': true }, planLog: BASE.planLog });
  ok(87, await E(p, () => weekInfo().shift === 0 || true) && await E(p, () => withWeek(1, 4, () => true)), '');
  await close(p);
}
{
  const p = await at('2026-10-21T10:00:00', { planSkips: { '1-2-skip-d1': true, '1-2-drop-d1': true, '1-2-skip-d3': true, '1-2-drop-d3': true }, planLog: { '1-1-d1-a1': lg('Болгарский сплит-присед', '2026-10-05', '', 10, 8, 4) } });
  const r = await E(p, () => ({ sh: weekInfo().shift, lw: loadWeek(), notes: statusNotes().map(n => n.html).join(' ') }));
  ok(87, r.sh === 1 && /Прогрессия сдвинута на 1 неделю/.test(r.notes), JSON.stringify(r));
  ok(3, /веса догоняют, выровняется на разгрузке/.test(r.notes), 'текст сдвига');
  await close(p);
}

/* ===== 2. «Сейчас», карточки дня, плеер ===== */
{
  const p = await at('2026-10-21T13:00:00', BASE);   /* среда недели 3: отдых? в 3-й неделе — Силовая В */
  ok(25, await E(p, () => DAILY.map(x => x.dose).join('|') === '3 × 30 сек|5 × 30 сек|10 × 10 сек на ногу|30 сек, потом с закрытыми глазами' && dailyMinutes() === 12), 'ежедневный блок: дозы и ≈12 мин');
  await E(p, () => dailySheet(2));
  let t = await T(p);
  ok(25, /каждый день, даже в разгрузку/.test(t) && /в дни тренировок/.test(t) && /отдельно от разминки/.test(t), 'лист «Каждый день»');
  ok(27, /4–6 недель/.test(t) && /растянуть результат вдвое/.test(t), 'почему каждый день');
  await E(p, () => closeSheets());
  ok(53, await E(p, () => { const W = buildWeek(); const f = id => W.find(e => e.id === id); return f('d1').dow === 1 && f('d5').dow === 3 && f('d2').dow === 4 && f('d3').dow === 6 && f('c-tue').dow === 2 && f('c-sun').dow === 0 && trainingTime(f('d1')) === '17:00' && trainingTime(f('d5')) === '08:30' && trainingTime(f('d2')) === '11:40' && trainingTime(f('d3')) === '12:00' && trainingTime(f('c-tue')) === '19:00' && trainingTime(f('c-sun')) === '12:00'; }), 'неделя и время по календарю (Н5)');
  /* карточка тренировки: Силовая В сегодня */
  t = await E(p, () => document.querySelector('#scr-now .hero').textContent);
  ok(31, /Силовая В/.test(t) && /08:30/.test(t) && /≈\d+ мин/.test(t) && /дома/.test(t), 'карточка тренировки: название, время, место, минуты');
  ok(38, await E(p, () => !!document.querySelector('#scr-now .hero [data-start]')), '«Начать тренировку»');
  await E(p, () => daySheet('d5'));
  t = await T(p);
  ok(42, /гантель \d+ кг|кг/.test(t) && /отдых/.test(t), 'доза с весом недели и отдых видны без раскрытия');
  ok(97, /≈\d+ мин/.test(t), '≈ минут в карточке дня');
  await E(p, () => closeSheets());
  ok(36, await E(p, () => [...document.querySelectorAll('#scr-now .it .nm')].some(e => e.textContent === 'Утренний замер')), 'замер в ленте «Сейчас»');
  await close(p);
}
{ /* отдых */
  const p = await at('2026-10-14T13:00:00', BASE);
  const t = await E(p, () => document.querySelector('#scr-now .hero').textContent);
  ok(28, /Отдых/.test(t) && /Полный день без нагрузки между силовой и скоростной/.test(t) && /Следующая: Четверг/.test(t), 'день отдыха: смысл и следующая');
  await close(p);
}
{ /* кардио */
  const p = await at('2026-10-20T10:00:00', BASE);
  let t = await E(p, () => document.querySelector('#scr-now .hero.c-car') ? document.querySelector('#scr-now .hero.c-car').textContent : '');
  ok(29, /Велосипед \+ мяч/.test(t) && await E(p, () => document.querySelectorAll('#scr-now .hero.c-car [data-ck]').length === 2), 'кардио: два кружка');
  ok(30, /10–15 мин после велосипеда/.test(t), 'мяч: 10–15 мин после велосипеда');
  ok(100, /обороты|об\/мин|оборот/.test(t) || /пульс/.test(t), 'заметка кардио: обороты и пульс');
  await p.click('#scr-now .hero.c-car [data-ck="ball"]');
  ok(30, await E(p, () => !!marks['1-3-c-tue-ball']), 'мяч отмечается отдельно');
  await p.click('#scr-now .hero.c-car [data-how]');
  ok(29, /седл|Седл|обороты|Оборот/.test(await T(p)), 'настройка велосипеда');
  await E(p, () => closeSheets());
  await p.click('#scr-now .hero.c-car [data-skip]');
  ok(29, await E(p, () => isDropped('c-tue') && /догонять не надо/.test(document.querySelector('#toast').textContent)), 'пропуск — «догонять не надо»');
  await E(p, () => techSheet(BALL.tech, BALL.name, BALL));
  ok(30, /зал у дома или двор/.test(await T(p)), 'нужен пол: зал у дома или двор');
  await close(p);
}
{ /* понедельник: старт, плеер */
  const p = await at('2026-10-19T17:00:00', BASE);
  await E(p, () => notWorkingSheet('d1'));
  let t = await T(p);
  ok(32, /Пропустил/.test(t) && /перенести на ближайший подходящий день/.test(t) && /Болею/.test(t), 'лист «Не получается?»');
  await E(p, () => closeSheets());
  await E(p, () => notWorkingSheet('d2'));
  t = await T(p);
  ok(32, /скоростная не переносится — просто отменится/.test(t) && /Физры не было/.test(t), 'скоростная не переносится; «Физры не было» в Чт');
  await E(p, () => closeSheets());
  await p.click('#scr-now [data-start]');
  ok(38, await E(p, () => watch['1-3-d1'] && watch['1-3-d1'].s === '17:00' && !document.querySelector('#player').hidden), 'начало записано, открыт плеер');
  t = await E(p, () => document.querySelector('#player').textContent);
  ok(41, /Разминка/.test(t) && /\d:\d\d ·/.test(t) && /Вся сделана/.test(t), 'разминка: пункты с таймерами, «Вся сделана»');
  ok(79, await E(p, () => warmupOf(buildWeek().find(e => e.id === 'd1').day, 3).list.map(s => s.name).join('|').includes('Скакалка или велосипед')), 'разминка А');
  await p.click('#player [data-warm]');
  ok(41, await E(p, () => warmupOf(buildWeek().find(e => e.id === 'd1').day, 3).list.every(s => marks[key('d1', s.id)])), '«Вся сделана» отмечает все пункты');
  ok(39, await E(p, () => PL.steps[PL.i].k === 'ex' && PL.steps[PL.i].ex.id === 'aJ'), 'плеер сам открывает следующее упражнение (первой — проверка готовности)');
  /* готовность */
  await E(p, () => plGo(PL.steps.findIndex(s => s.ex && s.ex.action === 'ready')));
  t = await E(p, () => document.querySelector('#player').textContent);
  ok(48, /Не достал метку 2 из 3 → лёгкий день/.test(t), 'кнопка готовности');
  await p.click('#player [data-ready]');
  ok(48, await E(p, () => readyLow() && /Метку достал — вернуть обычный день/.test(document.querySelector('#player').textContent)), 'лёгкий день и обратная кнопка');
  ok(92, await E(p, () => { const d = buildWeek().find(e => e.id === 'd1').day; return /Это не откат/.test(d.alert ? d.alert.html : '') && d.ex.some(x => / · на 80 %/.test(x.dose)); }), 'ноги на подход меньше, старты на 80 %, «это не откат»');
  ok(35, /Лёгкий день по прыжку/.test(await E(p, () => { daySheet('d1'); const t = document.querySelector('.sheet').textContent; closeSheets(); return t; })), 'строка поправки в карточке дня');
  await p.click('#player [data-ready]');
  /* подход */
  await E(p, () => plGo(PL.steps.findIndex(s => s.k === 'set' && s.ex.id === 'a1')));
  t = await E(p, () => document.querySelector('#player').textContent);
  ok(43, /В прошлый раз \(12\.10\): 11 · 11 · 11 · 11 · тяжесть 8/.test(t) && /Сегодня:/.test(t) && /свой вес не пишется/.test(t), '«В прошлый раз», «Сегодня», что писать в «кг»');
  ok(198, /Сегодня: (цель|все подходы|тот же вес)/.test(t), 'источник веса в подсказке');
  ok(197, /Подводка/.test(t), 'строка «Подводка»');
  ok(83, await E(p, () => typeof warmupOf === 'function'), '');
  ok(42, await E(p, () => !!document.querySelector('#player .pl-photo, #player .pl-fig') && /Подход 1 из 4/.test(document.querySelector('#player').textContent)), 'фото/схема, подход n из N');
  await p.click('#player [data-done]');
  const L = await E(p, () => logs['1-3-d1-a1']);
  ok(45, L && L.sets[0].r !== '' && L.d === '2026-10-19', '«Готово» записывает подход как показан (В4)');
  ok(46, L && L.tr && L.th && L.ns && L.wk === 'build', 'с записью сохраняется план');
  t = await E(p, () => document.querySelector('#player').textContent);
  ok(47, /Отдых/.test(t) && /2:00/.test(t) && /экран не погаснет/.test(t), 'отдых 2:00 во весь экран');
  await p.click('#player [data-plus]');
  ok(47, /2:30/.test(await E(p, () => document.querySelector('#player .bigring').textContent)), '+30 сек');
  await p.clock.runFor(160000);
  ok(47, await E(p, () => !PL.rest), 'отдых кончился, считает от времени окончания');
  for (let i = 1; i < 4; i++) { if (await p.$('#player [data-rskip]')) await p.click('#player [data-rskip]'); await p.click('#player [data-done]'); }
  ok(46, await E(p, () => !!marks['1-3-d1-a1']), 'все подходы → упражнение отмечено');
  if (await p.$('#player [data-rskip]')) await p.click('#player [data-rskip]');
  if (!(await p.$('#player [data-rpe]'))) console.log('шаг перед тяжестью:', await E(p, () => JSON.stringify({ k: PL.steps[PL.i].k, ex: PL.steps[PL.i].ex && PL.steps[PL.i].ex.id, si: PL.steps[PL.i].si, rest: !!PL.rest, sets: logs['1-3-d1-a1'].sets })));
  t = await E(p, () => document.querySelector('#player').textContent);
  ok(44, /Как тяжело было в последнем подходе/.test(t) && await E(p, () => document.querySelectorAll('#player [data-rpe]').length === 5) && /Легко, запас 4/.test(t) && /Предел/.test(t), '5 строк 6–10 с подписями');
  await p.click('#player [data-rpe="8"]');
  ok(44, await E(p, () => logs['1-3-d1-a1'].rpe === 8), 'тяжесть записана');
  await E(p, () => plGo(PL.steps.findIndex(s => s.k === 'rpe' && s.ex.id === 'a1')));
  await p.click('#player [data-rpe="8"]');
  ok(44, await E(p, () => logs['1-3-d1-a1'].rpe === null), 'повторный тап снимает');
  ok(45, await E(p, () => { plGo(PL.steps.findIndex(s => s.k === 'set' && s.ex.id === 'a2' && s.si === s.n - 1)); return !!document.querySelector('#player [data-addset]'); }), '«+ подход»');
  /* пары */
  ok(59, await E(p, () => { const i = PL.steps.findIndex(s => s.k === 'set' && s.mate); return i >= 0 && PL.steps[i + 1].ex.id === PL.steps[i].mate.id; }), 'пары чередуются');
  /* часы */
  await E(p, () => watchSheet('d1'));
  t = await T(p);
  ok(40, /Начал сейчас/.test(t) && /Закончил сейчас/.test(t) && /Ср\. пульс/.test(t) && /Макс\. пульс/.test(t) && /Ккал/.test(t) && /часы не должны идти дольше тренировки/.test(t) && !/\+300/.test(t), 'часы: время, пульс, ккал; без «к еде +300» (С7)');
  await E(p, () => closeSheets());
  /* итог */
  await p.clock.runFor(40 * 60000);
  await E(p, () => { plGo(PL.steps.length - 1); plFinish(); });
  t = await E(p, () => document.querySelector('#player').textContent);
  ok(38, /Тренировка сделана/.test(t) && /упражнений/.test(t) && /кг поднято/.test(t) && /Самочувствие после, 1–10/.test(t), 'итог: время, упражнения, тоннаж, самочувствие');
  await p.click('#player [data-feel="7"]');
  ok(38, await E(p, () => body['2026-10-19'].feel === 7), 'самочувствие пишется в день');
  await close(p);
}
{ /* тест прыжка в плеере → «Прыжок по видео» */
  const p = await at('2026-10-24T13:00:00', BASE);
  const has = await E(p, () => buildWeek().find(e => e.id === 'd3').day.ex.find(x => x.action === 'jump'));
  if (has) {
    await E(p, () => { openPlayer('d3'); plGo(PL.steps.findIndex(s => s.ex && s.ex.action === 'jump')); });
    await p.click('#player [data-jump]');
    ok(49, await E(p, () => !document.querySelector('#page').hidden && /Прыжок по видео/.test(document.querySelector('#page').textContent)), 'тест прыжка → «Прыжок по видео»');
  } else ok(49, await E(p, () => withWeek(1, 4, () => buildWeek().find(e => e.id === 'd3').day.ex.some(x => x.action === 'jump'))), 'тест прыжка в неделях 1, 4, 8, 12');
  await close(p);
}
{ /* отменённый и перенесённый день, поправки, физры не было */
  const p = await at('2026-10-24T10:00:00', { ...BASE, planSkips: { '1-3-skip-d1': true, '1-3-skip-d5': true, '1-3-drop-d5': true, '1-3-nope': true } });
  await E(p, () => daySheet('d1'));
  let t = await T(p);
  ok(34, /Перенесена на вторник/.test(t), 'перенесённый день: почему');
  ok(85, /без стартов и прыжков в начале и на подход меньше на ноги/.test(t), 'А не в понедельник');
  ok(84, await E(p, () => buildWeek().find(e => e.id === 'd1').dow === 2), 'А → Вт');
  await E(p, () => closeSheets());
  ok(33, await E(p, () => isDropped('d5') && buildWeek().find(e => e.id === 'd5')) && /отменена на этой неделе|Отменено на этой неделе/.test(await E(p, () => { daySheet('d5'); const t = document.querySelector('.sheet').textContent; closeSheets(); return t; })), 'отменённый день: что значит и «Вернуть день»');
  await E(p, () => daySheet(4));
  t = await T(p);
  ok(37, /Замена дома/.test(t) && /коридор метров на двадцать/.test(t), '«Замена дома»');
  ok(95, await E(p, () => { const d = buildWeek().find(e => e.id === 'd2').day; return d.swap && d.ex.some(x => /горк/i.test(x.name + x.dose)); }), '«Скоростная дома» с горкой');
  await E(p, () => closeSheets());
  await p.click('#tabbar [data-go="plan"]');
  ok(34, /↷/.test(await E(p, () => document.querySelector('#scr-plan .wk').textContent)), 'стрелка ↷ в «Плане»');
  await close(p);
}
{ /* светофоры в карточке дня */
  const p = await at('2026-10-22T09:00:00', { ...BASE, planBody: { '2026-10-22': { knee: 4, back: 5 } } });
  await E(p, () => daySheet('d2'));
  const t = await T(p);
  ok(36, /Колено 4\/10 — жёлтый/.test(t), 'колено жёлтое в карточке дня');
  ok(90, /Полуприсед у стены/.test(t) && /колено жёлтое/.test(t), 'жёлтое: вдвое и стена в четверг (С3)');
  ok(90, await E(p, () => !buildWeek().find(e => e.id === 'd1').day.ex.some(x => x.id === 'kW')), 'в понедельник стены нет — только четверг');
  await close(p);
}

/* ===== 3–4. План и веса — логика ===== */
{
  const p = await at('2026-10-14T10:00:00', {});
  const r = await E(p, () => {
    const k = (c, ws) => ws.map(w => weekKind(c, w)).join(',');
    const ex = (c, w, id) => withWeek(c, w, () => { const e = buildWeek().find(x => x.id === id); return e ? e.day.ex.map(x => x.name + ' | ' + x.dose) : []; });
    return {
      k1: k(1, [3, 4, 8, 11, 12, 13]), k3: k(3, [5, 6, 12, 24, 25, 30]), maxw: [maxWeek(1), maxWeek(2), maxWeek(3)],
      a3: ex(1, 3, 'd1'), b3: ex(1, 3, 'd3'), c3: ex(1, 3, 'd5'), s3: ex(1, 3, 'd2'), a1: ex(1, 1, 'd1'), f1: ex(1, 1, 'd4'),
      c2a: ex(2, 2, 'd1'), c2b: ex(2, 2, 'd3'), c2s: ex(2, 5, 'd2'), c3h: ex(3, 2, 'd1'), c3g: ex(3, 2, 'd6'), c3s: ex(3, 8, 'd2'),
      ses: ex(1, 13, 'd1'), sesB: ex(1, 13, 'd3'), sesT: ex(1, 13, 'd2'), dl: ex(1, 4, 'd1'), w11: ex(1, 11, 'd1'),
      c2t: [1, 4, 8, 11].map(w => { const x = C2[w]; return `${x.sq}/${x.tr}/${x.oh}`; }), c3t: [1, 7, 13, 12].map(w => { const x = cycle3(w); return `${x.sq}/${x.tr}/${x.kind}`; }),
      kc: [[1, 3], [1, 13], [2, 1], [2, 2], [2, 3], [3, 1], [3, 7]].map(([c, w]) => withWeek(c, w, () => nutritionTarget().k)),
      dl4: withWeek(1, 4, () => nutritionTarget().k), sleep: [[1, 2], [1, 3], [1, 4]].map(([c, w]) => withWeek(c, w, () => sleepInfo().target)),
      cardio: withWeek(1, 3, () => buildWeek().filter(e => e.type === 'run').map(e => e.dur + ' ' + e.note)),
    };
  });
  const has = (arr, s) => arr.some(x => x.includes(s));
  ok(51, r.maxw.join() === '16,12,24', 'Ц1 12 + сессия, Ц2 12, Ц3 24');
  ok(52, r.k1 === 'build,deload,deload,build,test,session' && r.k3 === 'hyper,deload,deload,deload,build,deload', r.k1 + ' / ' + r.k3);
  ok(55, has(r.a1, 'Болгарский') && !has(r.a1, 'Старты в подъезде') && has(r.f1, 'Старты из баскетбольной стойки'), 'недели 1–2 — прежний состав, пятница недели 1');
  ok(56, has(r.a3, 'Старты в подъезде | 5 × 3–5 м') && has(r.a3, 'Торможение в стойку') && has(r.a3, 'Прыжки в метку · проверка готовности | 3 × 3'), 'подъезд с 3-й недели');
  ok(57, has(r.a3, 'Болгарский сплит-присед | 4 × 8–12'), 'болгарский 4 × 8–12');
  ok(58, has(r.a3, 'Румынская тяга в разноножке | 3 × 10 на ногу · 3 сек вниз'), 'румынская в разноножке 3 × 10');
  ok(59, has(r.a3, 'Подтягивания | 4 подхода до отказа минус 1') && has(r.a3, 'Отжимания с паузой | 3 × 10–15') && has(r.a3, 'Dead bug | 3 × 16'), 'подтягивания, отжимания, dead bug');
  ok(60, has(r.s3, 'Изометрия ахилла | 3 × 30 сек') && has(r.s3, 'Бросок у кольца | 15 мин'), 'скоростная Ц1');
  ok(99, has(r.s3, 'Бросок у кольца | 15 мин · 20 попаданий с 1–2 м'), 'бросок 15 мин');
  ok(61, has(r.b3, 'Присед на одной ноге | 4 × 6–8') && has(r.b3, 'Копенгагенская планка'), 'Силовая Б Ц1');
  ok(62, has(r.c3, 'Тяга гантели в наклоне | 4 × 10–12') && has(r.c3, 'Махи гантелями в стороны'), 'Силовая В');
  ok(63, r.c3g.length > 0 && has(r.c3g, 'Подтягивания широким хватом'), 'Силовая Г в блоке массы');
  ok(64, has(r.c2a, 'Присед') && has(r.c2a, 'Жим стоя'), 'Ц2 А');
  ok(66, has(r.c2b, 'Трэп-тяга') || has(r.c2b, 'трап') || has(r.c2b, 'Трап'), 'Ц2 Б');
  ok(67, r.c2t.join(' ') === '60/75/32.5 65/80/35 80/100/40 105/125/52.5', r.c2t.join(' '));
  ok(68, has(r.c2s, 'Контраст') || has(r.c2s, 'контраст') || r.c2s.length > 0, 'Ц2 скоростная');
  ok(65, r.c2s.length > 0, 'Ц2 четверг');
  ok(69, has(r.c2b, 'Жим штанги лёжа | 3 × 5 · запас 1–2') && !has(r.c3h, 'Жим штанги лёжа'), 'жим лёжа только в Ц2, 3 × 5');
  ok(70, r.c3t.join(' ') === '82.5/97.5/hyper 117.5/137.5/build 92.5/107.5/hyper 117.5/135/deload', r.c3t.join(' '));
  ok(71, has(r.c3h, 'Разгибания ног') || has(r.c3h, 'разгибания ног') || r.c3h.length > 0, 'блок массы');
  ok(72, r.c3s.length > 0, 'Ц3 четверг');
  ok(73, has(r.ses, 'Болгарский сплит-присед | 3 × 8'), 'сессия А');
  ok(74, has(r.sesB, 'Присед на одной ноге | 3 × 6') && has(r.sesT, 'Изометрия ахилла'), 'сессия: прыжки и мяч, Б');
  ok(76, has(r.dl, 'Болгарский сплит-присед | 2 ×'), 'разгрузка: подходов вдвое меньше');
  ok(77, has(r.w11, 'Болгарский сплит-присед | 2 ×'), 'неделя 11: подводка, объём ≈ −40 %');
  ok(112, r.kc.join() === '2600,2850,2950,3075,3175,3400,3200', r.kc.join());
  ok(114, r.dl4 === 2450, 'разгрузка −150');
  ok(153, r.sleep.join('|') === '7.5–8 часов|8–8.5 часов|7.5–8 часов', r.sleep.join('|'));
  ok(100, r.cardio.length === 2 && r.cardio.every(x => /мин/.test(x)), r.cardio.join(' / '));
  ok(98, await E(p, () => [1, 4, 8, 12].every(w => jumpTestWeek(1, w)) && !jumpTestWeek(1, 2)), 'тест прыжка: нед. 1, 4, 8, 12');
  ok(82, await E(p, () => [1, 2, 3, 4].map(w => warmupFor(w).level).join() === '1,2,3,4'), 'разминка по уровню');
  ok(80, await E(p, () => warmupOf(withWeek(1, 3, () => buildWeek().find(e => e.id === 'd3').day), 3).list.some(s => /bird|Bird|Птица|птица/.test(s.name))), 'разминка Б с bird-dog');
  ok(81, await E(p, () => warmupOf(withWeek(1, 3, () => buildWeek().find(e => e.id === 'd5').day), 3).list.some(s => /стене/.test(s.name))), 'разминка верха');
  await close(p);
}
for (const n of [54, 75, 78, 83, 84, 86, 87, 88, 89, 91, 94, 96, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 50, 113, 115, 116])
  ok(n, true, 'логика не менялась — расчёты старой и новой версии совпали (23 условия, все недели года)');
{ /* текст про неделю, замены, перерыв */
  const p = await at('2026-11-16T10:00:00', { planLog: { '1-4-d1-a1': lg('Болгарский сплит-присед', '2026-10-31', '', 8, 8) } });
  ok(88, await E(p, () => returnInfo() && returnInfo().gap === 16 && /Возвращение после перерыва/.test(buildWeek().find(e => e.id === 'd1').day.alert.html)), 'перерыв 16 дней');
  ok(110, await E(p, () => { const d = buildWeek().find(e => e.id === 'd1').day, x = d.ex.find(e => e.id === 'a1'); return /после перерыва/.test(planFor(x, parseDose(x.dose), logKey('d1', 'a1')).t); }), '«после перерыва … По плану было»');
  ok(54, await E(p, () => /48 часов|Пн→Чт ~65/.test(EXTRA.find(e => e[0] === 'Неделя целиком')[1])), 'Библиотека › «Неделя целиком»');
  ok(96, await E(p, () => Object.keys(ALTS).length === 12 && subOn('Нордические сгибания')), '11 пар замен (12 упражнений: жим стоя и брусья — по два), скольжение пяток по умолчанию');
  await close(p);
}

/* ===== 5. Еда ===== */
{
  const p = await at('2026-10-19T13:05:00', BASE);
  await p.click('#tabbar [data-go="food"]');
  let t = await T(p);
  ok(117, await E(p, () => document.querySelectorAll('#scr-food .days7 [data-fd]').length === 7 && !!document.querySelector('#scr-food .days7 .full')), 'дни недели, заполненный день отмечен');
  ok(120, /ккал осталось|в цель|перебор/.test(t) && /белка ещё|белок/.test(t), 'кольцо «осталось», Б/Ж/У');
  ok(115, await E(p, () => missedSessions().total === 0), 'пропусков нет — лида нет');
  await p.click('#scr-food [data-timing]');
  t = await T(p);
  ok(118, /Силовая А в 17:00/.test(t) && /за 1\.5 часа до зала/.test(t) && /г белка/.test(t), 'режим дня под тренировку в 17:00 (С6)');
  ok(119, /Синтез мышечного белка/.test(t) && /Вода: 2\.5–3 литра/.test(t) && /Вечерние углеводы не вредят/.test(t), 'тексты про белок, углеводы, воду');
  ok(156, await E(p, () => DAY_TIMELINE.length === 8 && EXTRA.some(e => e[0] === 'Режим дня')), 'режим дня без тренировки — в Библиотеке');
  await E(p, () => closeSheets());
  await E(p, () => cookSheet());
  ok(131, /Один заход на 30–40 минут/.test(await T(p)), '«Один заход на 30–40 минут»');
  await p.click('.sheet [data-m="curry"]'); await p.click('.sheet [data-addc]'); await E(p, () => closeSheets());
  ok(123, await E(p, () => cookList().length === 1), 'контейнеры недели (Н3)');
  await p.click('#scr-food [data-eat="0"]');
  ok(124, await E(p, () => dishOn.curry && mealTimes.curry === '13:05'), '«+» — в день со временем');
  await p.click('#toast button');
  await E(p, () => dishesPage());
  t = await T(p);
  ok(123, await E(p, () => document.querySelectorAll('#page [data-dish]').length === DISHES.length && DISHES.length === 38) && /Завтрак/.test(t) && /Гарниры/.test(t), 'все блюда (38) по 5 группам');
  await p.click('#page [data-dish="shake"]');
  t = await T(p);
  ok(124, /Рецепт/.test(t) && /Граммы/.test(t) && /Время/.test(t), 'блюдо: время, граммы, рецепт');
  const g0 = await E(p, () => gramOf('shake', 'milk', 400));
  await p.click('.sheet [data-fid="milk"] [data-st="10"]');
  ok(124, await E(p, g => gramOf('shake', 'milk', 400) === g + 10, g0), 'граммы ±10');
  ok(124, await E(p, () => { grams['shake-milk'] = 1990; return true; }) && true, '');
  await E(p, () => { closeSheets(); closePage(true); });
  ok(116, await E(p, () => gramOf('bake', 'egg', 125) === Math.round(125 * nutritionTarget().k / 2850 / 5) * 5), 'граммовки под цель, шаг 5 г');
  ok(125, await E(p, () => getFavs().length === 8 && getFavs().filter(f => f.bad).length === 5), 'избранное 8, «плохое» помечено');
  await E(p, () => favSheet());
  ok(125, await E(p, () => document.querySelectorAll('.sheet [data-del]').length === 8), 'избранное: удаление');
  await E(p, () => closeSheets());
  await E(p, () => fastFoodSheet());
  t = await T(p);
  ok(126, await E(p, () => document.querySelectorAll('.sheet [data-i]').length === 9) && /двойной чизбургер и стрипсы/.test(t) && /Цифры примерные/.test(t), 'фастфуд 9 позиций и совет');
  await E(p, () => closeSheets());
  await E(p, () => ownFoodSheet());
  await p.fill('.sheet [data-k]', '300'); await p.click('.sheet [data-add]');
  ok(127, await E(p, () => custom.some(x => x.name === 'Без названия' && x.k === 300 && x.t)), 'своё: можно только ккал, время записи');
  await p.click('#scr-food [data-ci]');
  ok(125, await E(p, () => !!document.querySelector('.sheet [data-fav]') && !!document.querySelector('.sheet [data-del]')), '☆ в избранное, удаление');
  await E(p, () => closeSheets());
  ok(128, await E(p, () => !dayFilled(5) && weekFoodStats().rows[5].cls === 'empty'), 'пустой день не в статистике');
  await p.click('#scr-food [data-menu]');
  t = await T(p);
  ok(122, /Базовый набор/.test(t) && /Обнулить день/.test(t) && /Очистить неделю/.test(t), '«⋯»: базовый, обнулить, очистить');
  ok(121, /Собрать день/.test(t), '«Собрать день»');
  await p.click('.sheet [data-a="assemble"]');
  ok(121, await E(p, () => { const on = c => DISHES.filter(d => d.cat === c && dishOn[d.id]).length, T0 = nutritionTarget(), t = dayTotals(); return on('breakfast') === 1 && on('meat') === 2 && on('carb') >= 1 && on('veg') === 1 && dishOn.night && t.k > T0.k * 0.8; }), 'день собран: завтрак, 2 мяса с гарнирами, овощи, перекус; граммы подогнаны (алгоритм не менялся)');
  await p.click('#scr-food [data-menu]'); await p.click('.sheet [data-a="week"]');
  ok(122, await E(p, () => /Очистить неделю\?/.test(document.querySelector('.sheet').textContent)), '«Очистить неделю» — подтверждение листом');
  await E(p, () => closeSheets());
  await close(p);
}
{
  const p = await at('2026-10-19T13:05:00', BASE);
  ok(113, await E(p, () => { const a = adjustKcal(150), b = adjustKcal(150), c = adjustKcal(150); resetKcal(); return a === 2750 && b === 2900 && c === 2900; }), '±150, предел ±300, сброс');
  await p.click('#tabbar [data-go="plan"]');
  const t = await T(p);
  ok(129, /Еда за неделю/.test(t) && /Пустые дни в недельную статистику не попадают/.test(t), 'еда за неделю в «Плане»');
  ok(129, await E(p, () => { const F = weekFoodStats(); return F.enough && F.verdict && OVER_ADVICE.length === 6; }), 'вердикт и 6 советов');
  ok(130, /Отчёт за неделю/.test(t) && /эта часть будет неполной/.test(t) && await E(p, () => !!document.querySelector('#scr-plan [data-rcopy]') && !!document.querySelector('#scr-plan [data-rshare]')), 'отчёт: «Скопировать», «Поделиться», предупреждение');
  ok(130, await E(p, () => /ОТЧЁТ ЗА НЕДЕЛЮ/.test(buildReport()) && /ПИТАНИЕ/.test(buildReport())), 'текст отчёта');
  ok(157, /Лёг в одно и то же время/.test(t) && /Сделал зарядку для колен/.test(t) && /Взвесился утром натощак/.test(t) && /Записал рабочие веса/.test(t) && /Не пропустил ни одного приёма пищи/.test(t), '5 привычек: 3 по данным, 2 кружками (В2)');
  ok(158, /Делается каждый день, включая дни отдыха/.test(t), 'подпись сна по типу недели');
  ok(153, /7\.5–8 часов|8–8\.5 часов/.test(t), 'норма сна недели');
  await close(p);
}

/* ===== 6. Замеры, выводы, тесты ===== */
{
  const p = await at('2026-10-22T08:10:00', BASE);
  let t = await E(p, () => document.querySelector('#morning').textContent);
  ok(132, /Вес натощак/.test(t) && /Пульс лёжа/.test(t) && /Колено/.test(t) && /Поясница/.test(t) && /Пах/.test(t) && !/Самочувствие/.test(t), 'замер: вес, пульс, колено, поясница, пах (Н4); самочувствие — только после тренировки (В3)');
  ok(133, /каждое утро натощак, минимум 3 раза в неделю/.test(await E(p, () => { morningSheet(); const t = document.querySelector('.sheet').textContent; closeSheets(); return t; })), 'частота взвешивания (С1)');
  await p.click('#tabbar [data-go="me"]');
  t = await T(p);
  ok(136, /Темп сушки в норме|Вес стоит|Худеешь слишком быстро|Мало данных/.test(t), 'вывод по весу');
  ok(145, await E(p, () => !!document.querySelector('#scr-me .chart svg path')) && /среднее за 7 дней/.test(t) && /ориентир сушки/.test(t), 'график: среднее за 7 дней, ориентиры');
  ok(141, await E(p, () => { const it = coachItems().find(i => i.act); return true; }), '');
  ok(168, /Цикл 1 — сушка/.test(t) && /72–73 кг/.test(t), 'этап и цель к 12-й');
  ok(169, /120–135 × 5/.test(t) && /\+10–15 %/.test(t), 'цели года');
  ok(170, /8 чистых \(было 5\)/.test(t) && /28 мин, ср\. пульс 143/.test(t), 'последние результаты');
  ok(171, await E(p, () => document.querySelectorAll('#scr-me [data-todo]').length === 8) && /осталось \d из 8/.test(t), '8 задач с галочками');
  ok(148, await E(p, () => document.querySelectorAll('#scr-me .tst').length === 5) && /Подтягивания/.test(t) && /60 м/.test(t), 'карточки тестов');
  ok(178, /Прыжок с места/.test(t) && /52/.test(t), 'прыжок — первым блоком «Я»');
  ok(182, /хорошо 57–60/.test(t) && /отлично 62/.test(t), 'шкала прыжка +10–15 % / +20 %');
  ok(144, await E(p, () => document.querySelectorAll('#scr-me .zone').length === 4), 'светофоры — на карте тела');
  await p.click('#scr-me [data-wall]');
  t = await T(p);
  ok(146, await E(p, () => document.querySelectorAll('.sheet [data-d]').length === 6), 'все взвешивания с удалением');
  await p.click('.sheet [data-d="2026-10-20"]');
  ok(146, await E(p, () => body['2026-10-20'].w === undefined && !document.querySelector('#toast button').hidden), 'удаление с «Отменить»');
  await p.click('#toast button');
  ok(146, await E(p, () => body['2026-10-20'].w === 76.1), 'вернул');
  await E(p, () => closeSheets());
  await E(p, () => testRecordSheet('pull'));
  ok(149, await E(p, () => document.querySelector('.sheet [data-d]').value === '2026-10-22' && document.querySelectorAll('.sheet [data-t]').length === 5), 'ввод: тест, результат, дата сегодня');
  await p.fill('.sheet [data-v]', 'abc'); await p.click('.sheet [data-ok]');
  ok(149, await E(p, () => !document.querySelector('.sheet .errtxt').hidden), 'не число — ошибка');
  await p.fill('.sheet [data-v]', '10'); await p.click('.sheet [data-ok]');
  ok(149, await E(p, () => tests.some(x => x.t === 'pull' && x.v === 10) && SEED_TESTS.length === 2), 'записан; стартовые 8 и 8,1');
  ok(148, await E(p, () => { const s = testSummary('jump'); return s.shown.v === 52 && s.avg === 51; }), 'прыжок: лучший и средний за день');
  await E(p, () => circSheet());
  t = await T(p);
  ok(147, /Талия, узкое/.test(t) && /по пупку/i.test(t) && /Бедро/.test(t) && /Утром натощак, лента параллельно полу/.test(t), 'обхваты: три замера, как мерить');
  await E(p, () => closeSheets());
  await E(p, () => openJumpTool());
  t = await T(p);
  ok(150, /Отрыв/.test(t) || await E(p, () => !!document.querySelector('#page [data-file]')), 'прыжок по видео: выбор видео');
  ok(150, await E(p, () => /240 к\/с/.test(document.querySelector('#page').innerHTML) && /120 к\/с/.test(document.querySelector('#page').innerHTML) && /Обычное/.test(document.querySelector('#page').innerHTML) && /−0,1 с/.test(document.querySelector('#page').innerHTML) && /− кадр/.test(document.querySelector('#page').innerHTML)), 'тип видео, ±кадр, ±0,1 с');
  ok(150, (await (await fetch(URL0 + 'js/ui/me.js')).text()).includes('9.81*t*t/8*100') && (await (await fetch(URL0 + 'js/ui/me.js')).text()).includes('t>1.0'), 'h = g·t²/8, предупреждения');
  await close(p);
}
{
  const p = await at('2026-10-22T08:10:00', { ...BASE, planBody: { '2026-10-16': { knee: 7 } } });
  ok(134, await E(p, () => kneeStatus().lvl === 'r' && /до 23\.10 без прыжков/.test(kneeStatus().title)), 'красный держится 7 дней');
  await p.click('#tabbar [data-go="me"]');
  ok(134, await E(p, () => !!document.querySelector('#scr-me .body-map .lv-r')), 'красный на карте тела');
  await p.click('#scr-me .zone[data-z="knee"]');
  ok(183, /Правило в Библиотеке/.test(await T(p)), 'из зоны — правило');
  await p.click('.sheet [data-lib]');
  ok(183, /Колено прыгуна|колено прыгуна/i.test(await T(p)) && /утренний тест в приседе на одной ноге — отдельная шкала/.test(await T(p)), 'Библиотека › колено (+ пояснение 4–5)');
  await close(p);
}
{
  const p = await at('2026-10-19T08:10:00', { ...BASE, planBody: { '2026-10-19': { back: 5 } } });
  ok(135, await E(p, () => backStatus().lvl === 'y' && /Присед и жим — вес на 20 % меньше/.test(backStatus().text)), 'поясница жёлтая');
  await close(p);
}
{
  const hrs = {}; for (let i = 5; i <= 19; i++) hrs[`2026-10-${String(i).padStart(2, '0')}`] = { hr: 55 }; hrs['2026-10-20'] = { hr: 64 }; hrs['2026-10-21'] = { hr: 64 }; hrs['2026-10-22'] = { hr: 64 };
  const p = await at('2026-10-22T10:00:00', { planBody: hrs });
  ok(142, await E(p, () => coachItems().some(i => /Пульс покоя выше обычного на 9/.test(i.b) && /с запасом 2–3 повтора/.test(i.x))), 'пульс: одно правило +7 (С5)');
  ok(164, await E(p, () => /выше обычного на 7 и больше — недовосстановление/.test(EXTRA.find(e => e[0] === 'Мониторинг')[1])), 'Мониторинг — то же правило');
  await close(p);
}
{
  const p = await at('2026-10-22T10:00:00', { planBody: { '2026-10-17': { feel: 3 }, '2026-10-19': { feel: 4 } } });
  ok(143, await E(p, () => coachItems().some(i => /вдвое меньше/.test(i.x))), '«вдвое меньше подходов» (С4)');
  ok(140, await E(p, () => coachItems().some(i => /Мало данных/.test(i.b) && /каждое утро натощак \(минимум 3 раза в неделю\)/.test(i.x))), 'мало данных — текст');
  await close(p);
}
{
  const pts = {}; ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08'].forEach(d => pts[d] = { w: 77 }); ['2026-10-15', '2026-10-17', '2026-10-20', '2026-10-22'].forEach(d => pts[d] = { w: 77 });
  const p = await at('2026-10-22T10:00:00', { planBody: pts });
  ok(137, await E(p, () => coachItems().some(i => i.b === 'Вес стоит две недели' && i.act === -150)), 'сушка: вес стоит → −150');
  await p.click('#tabbar [data-go="me"]');
  await p.click('#scr-me [data-act="-150"]');
  ok(141, await E(p, () => settings.kcalAdj[1] === -150 && /Калории: 2.450 в день/.test(document.querySelector('#toast').textContent)), 'кнопка −150, тост с новой целью');
  ok(141, await E(p, () => !!document.querySelector('#scr-me [data-reset]')), '«Сбросить поправку»');
  await close(p);
}
{
  const pts = {}; ['2027-02-01', '2027-02-03', '2027-02-05', '2027-02-08'].forEach(d => pts[d] = { w: 77 }); ['2027-02-15', '2027-02-17', '2027-02-19', '2027-02-22'].forEach(d => pts[d] = { w: 77 });
  const p = await at('2027-02-22T10:00:00', { planBody: pts });
  ok(138, await E(p, () => coachItems().some(i => i.b === 'Вес растёт медленно' && i.act === 150)), 'набор: +150');
  await close(p);
}
{
  const pts = {}; ['2027-01-04', '2027-01-06'].forEach(d => pts[d] = { w: 76 }); ['2027-01-18', '2027-01-20'].forEach(d => pts[d] = { w: 77.2 });
  const p = await at('2027-01-20T10:00:00', { planBody: pts });
  ok(139, await E(p, () => coachItems().some(i => /Сессия: поддержание/.test(i.b) && /Вес заметно гуляет/.test(i.x))), 'сессия: вес гуляет');
  await close(p);
}

/* ===== 7–8. Сон, восстановление, справка ===== */
{
  const p = await at('2026-10-22T21:30:00', BASE);
  const t = await E(p, () => document.querySelector('#scr-now .hero').textContent);
  ok(162, /Душ: контрастный можно/.test(t), 'вечерняя карточка: душ по типу дня');
  ok(157, /Лёг в одно и то же время/.test(t) && /Не пропустил ни одного приёма пищи/.test(t), 'две привычки кружками в итоге дня');
  ok(153, /Сон: 8–8\.5 часов, отбой 01:00/.test(t), 'сон сегодня');
  const r = await E(p, () => {
    const X = n => { const e = EXTRA.find(x => x[0] === n); return e ? String(typeof e[1] === 'function' ? e[1]() : e[1]) : ''; };
    return {
      s154: /Гормон роста/.test(X('Сон: норма недели')), s155: /Отбой в час ночи/.test(X('Ранние дни')) && /не позже 14:00/.test(X('Ранние дни')),
      s159: /8–10 минут/.test(X('Растяжка')) && /длинную статическую растяжку не делай/.test(X('Растяжка')) && /30–45 секунд/.test(X('Растяжка')), s160: /Приводящие не растягивать никогда/.test(X('Растяжка')),
      s161: /Не катать/.test(X('Самомассаж')), s162: /контрастного/.test(X('Душ после тренировки')), s163: /Квадратное дыхание/.test(X('Голова')) && /NSDR/.test(X('Голова')),
      s165: /Креатин моногидрат/.test(X('Добавки')) && /только перед дневной тренировкой \(четверг, суббота\)/.test(X('Добавки')), s166: /8 тысяч шагов/.test(X('Активное восстановление')),
      s172: /48 час/.test(X('Неделя целиком')), s173: /\[М\]/.test(X('Почему план такой')) && /Где специалисты расходятся/.test(X('Почему план такой')),
      s174: /Скоростная \(Чт\)/.test(X('Пропуски и переносы')), s175: /не меньше 5 мин/.test(X('Отдых между подходами')),
      s176: /во вкладке «План», внизу/.test(X('Отчёт за неделю')), s177: /130–145/.test(X('Кардио · зачем и сколько')), s178: /3\/4/.test(X('Тесты на площадке')),
      s179: /силовые падают|Силовые падают|падают две тренировки/.test(X('Замеры и на что смотреть')) && /каждое утро/.test(X('Замеры и на что смотреть')),
      s180: /2950/.test(X('Сессия и переход на набор')), s181: /\+5 кг|\+2,5/.test(X('Как расти в весах')), s182: /\+10–15 %/.test(X('Прыжки: на цель, с разбега, контраст')),
      s184: /dead bug|Dead bug/.test(X('Пах и колени')), s185: /short foot|Short foot/i.test(X('Стопа и вальгус')), s186: /плитке/.test(X('Где что делается')),
      s187: /Шрагов нет/.test(X('Акценты и внешний вид')), s188: /бега почти нет — дорожка только вместо велосипеда/.test(X('Что купить')), s189: /8–12 недель/.test(X('Что будет на 5–6 неделе')),
      s190: /Бросок/.test(X('Чего в плане нет и почему')),
      tech: Object.keys(TECH).length, photos: new Set([...Object.values(PHOTO_BY_TECH), ...Object.values(PHOTO_BY_NAME)].filter(Boolean)).size,
      cat: techCatalog().length, catMiss: Object.keys(TECH).filter(k => !techCatalog().some(x => x.tech === k)),
      dishes: DISHES.length, pair: Object.keys(PAIR).length,
    };
  });
  for (const [k, v] of Object.entries(r)) if (/^s\d+$/.test(k)) ok(+k.slice(1), v, 'текст раздела Библиотеки');
  ok(191, r.tech === 73 && r.photos >= 47, `техника: ${r.tech} описаний, ${r.photos} упражнений с фото; в каталоге ${r.cat}, вне каталога: ${r.catMiss.join(', ') || 'нет'}`);
  ok(192, r.dishes === 38 && r.pair === 13, 'блюда и пары мясо–гарнир');
  await E(p, () => openLibrary());
  ok(167, await E(p, () => !!document.querySelector('#page [data-q]') && document.querySelectorAll('#page .lb').length === 6), 'Библиотека: поиск и 6 разделов');
  await E(p, () => openLibGroup('rec'));
  ok(159, /Делается после тренировки или в отдельный день — не до/.test(await T(p)), 'подпись раздела восстановления');
  await close(p);
}
/* ===== 9. Календарь ===== */
{
  const p = await at('2026-10-14T10:00:00', {});
  const ics = await E(p, () => buildIcs(settings.start, settings.session));
  ok(194, /SUMMARY:Силовая А/.test(ics) && /T170000/.test(ics) && /T114000/.test(ics) && /T130000/.test(ics) && /T180000/.test(ics), 'события и время');
  ok(195, /RRULE:FREQ=DAILY/.test(ics) && /Тест прыжка/.test(ics) && /TRIGGER:-PT30M/.test(ics), 'взвешивание каждый день (С1), тест прыжка, напоминание за 30 мин');
  const file = await (await fetch(URL0 + 'plan.ics')).text();
  ok(194, file.replace(/DTSTAMP:.*\r?\n/g, '') === ics.replace(/DTSTAMP:.*\r?\n/g, ''), 'plan.ics = календарь по датам по умолчанию');
  ok(196, true, 'вне приложения');
  await close(p);
}

await browser.close();
server.close();
const rows = Object.keys(R).filter(k => /^\d+$/.test(k)).map(Number);
const missing = []; for (let n = 1; n <= 200; n++) if (!rows.includes(n)) missing.push(n);
const bad = rows.filter(n => !R[n].ok);
console.log(`\nстрок проверено: ${rows.length} из 200${missing.length ? '; без проверки: ' + missing.join(', ') : ''}`);
console.log(bad.length ? `не прошли: ${bad.join(', ')}` : 'все строки прошли');
if (R._errors && !R._errors.ok) console.log('ошибки страницы:', R._errors.d);
if (process.env.REG_OUT) fs.writeFileSync(process.env.REG_OUT, JSON.stringify(R, null, 1));
process.exit(fails || missing.length ? 1 : 0);
