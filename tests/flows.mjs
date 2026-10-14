/* Сценарии использования в эмуляции iPhone: первый запуск, тренировка от начала
   до конца, «Не получается?», еда, удаление данных.
   Запуск: node tests/flows.mjs   (нужен playwright; путь можно задать в PW=...) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = await import(process.env.PW || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
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
async function at(time, data = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], reducedMotion: 'reduce', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date(time) });
  await p.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear(); localStorage.setItem('planSchema', '2');   /* старый формат — проверка идёт через миграцию */
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, data);
  await p.goto(URL0, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  return { ctx, p };
}
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);

const sheetOpt = async (p, a) => { await p.click(`.sheet [data-a="${a}"]`); await p.waitForTimeout(100); };

/* 1. Первый запуск: подсказка «Как пользоваться», после «Понятно» не возвращается */
{
  const { ctx, p } = await at('2026-10-12T09:00:00');
  check('первый запуск: подсказка видна', await visible(p, '#onbSlot .onb'));
  await p.click('#onbSlot [data-ok]');
  await p.reload({ waitUntil: 'load' });
  check('после «Понятно» не показывается', !(await visible(p, '#onbSlot .onb')));
  await ctx.close();
}
/* 2. «План»: заголовок недели, без лишней строки статуса в обычную неделю */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true });
  await p.click('#tabbar [data-go="plan"]');
  const r = await p.evaluate(() => ({ t: document.querySelector('#scr-plan .h1').textContent, k: document.querySelector('#scr-plan .kick').textContent,
    notes: statusNotes().length, tiles: document.querySelectorAll('#scr-plan .wk .wd').length }));
  check('план: «Неделя 2 из 12», цикл 1 · сушка, 7 дней, статус пуст', r.t === 'Неделя 2 из 12' && /Цикл 1 · сушка/.test(r.k) && r.notes === 0 && r.tiles === 7, JSON.stringify(r));
  await ctx.close();
}
/* 3. Тренировка в плеере: начать → подход «Готово» → отдых → итог с самочувствием */
{
  const { ctx, p } = await at('2026-10-12T17:00:00', { planOnboarded: true });
  check('пустых подсказок колена/поясницы нет', !(await p.evaluate(() => /Утром оцени, как она/.test(document.body.innerText))));
  check('«Зарядка для колен» в ленте и в день тренировки', await p.evaluate(() => [...document.querySelectorAll('#scr-now .it .nm')].some(e => e.textContent === 'Зарядка для колен')));
  await p.click('#scr-now [data-start]');
  check('плеер открыт, время начала записано', (await visible(p, '#player .pl-dock')) && await p.evaluate(() => watch['1-2-d1'].s === '17:00'));
  /* пары: подход A → подход B → отдых */
  const pair = await p.evaluate(() => {
    /* день с парами «в паре с …» — ищем по году */
    for (const [c, w] of [[1, 3], [1, 5], [1, 9], [2, 2], [3, 2]]) {
      const r = withWeek(c, w, () => { const e = buildWeek().find(x => x.type === 'gym' && x.day.ex.some(y => /^в паре/.test(y.rest)));
        if (!e) return null; const keep = PL.id; PL.id = e.id; const st = plBuild(e); PL.id = keep;
        const i = st.findIndex(s => s.k === 'set' && s.mate); const a = st[i], b = st[i + 1], c2 = st[i + 2];
        return !!(a && b && b.ex.id === a.mate.id && b.si === a.si && c2 && c2.ex.id === a.ex.id && c2.si === a.si + 1); });
      if (r !== null) return r;
    }
    return false;
  });
  check('пары чередуются: подход A, затем подход B', pair);
  await p.evaluate(() => plGo(PL.steps.findIndex(s => s.k === 'set' && !s.mate)));
  const before = await p.evaluate(() => { const s = PL.steps[PL.i]; return { k: logKey('d1', s.ex.id), si: s.si }; });
  await p.click('#player [data-done]');
  const L = await p.evaluate(b => logs[b.k], before);
  check('«Готово» записал подход в журнал', L && L.sets[before.si] && L.sets[before.si].r !== '' && L.d === '2026-10-12' && L.wk, JSON.stringify(L));
  check('после подхода — отдых на весь экран', await visible(p, '#player .bigring'));
  await p.clock.runFor(4 * 60 * 1000);
  check('отдых кончился — снова подход', !(await visible(p, '#player .bigring')));
  await p.clock.runFor(41 * 60 * 1000);
  await p.evaluate(() => { marks[key('d1', 'a1')] = true; saveMarks(); });
  await p.click('#player [data-menu]'); await sheetOpt(p, 'fin');
  const r = await p.evaluate(() => ({ w: watch['1-2-d1'], txt: document.querySelector('#player').innerText }));
  check('итог: время и счёт упражнений', r.w && r.w.s === '17:00' && r.w.e === '17:45' && /0:45/.test(r.txt) && /Тренировка сделана/.test(r.txt), JSON.stringify(r.w));
  await p.click('#player [data-feel="7"]');
  check('самочувствие сохранено в день', await p.evaluate(() => body['2026-10-12'].feel === 7));
  await p.click('#player [data-min]');
  check('плеер закрыт', !(await visible(p, '#player .pl-dock')));
  await ctx.close();
}
/* 3б. Свернуть посреди тренировки — полоска «Идёт тренировка», тап — обратно */
{
  const { ctx, p } = await at('2026-10-12T17:00:00', { planOnboarded: true });
  await p.click('#scr-now [data-start]'); await p.click('#player [data-min]');
  check('полоска «Идёт тренировка» над вкладками', await p.evaluate(() => !document.querySelector('#mini').hidden && /Идёт тренировка/.test(document.querySelector('#mini').innerText)));
  await p.click('#mini');
  check('тап по полоске — плеер', await visible(p, '#player .pl-dock'));
  await ctx.close();
}
/* 4. «Не получается?»: пропуск переносит, «Вернуть в свой день» отменяет, «Болею» — пауза с подтверждением */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true });
  await p.click('#tabbar [data-go="plan"]');
  await p.click('#scr-plan [data-dow="1"]'); await p.click('.sheet [data-nw]'); await sheetOpt(p, 'skip');
  check('пропуск = перенос на вторник', await p.evaluate(() => isMoved('d1') && buildWeek().find(e => e.id === 'd1').dow === 2));
  await p.click('#scr-plan [data-dow="2"]'); await p.click('.sheet [data-day="d1"] [data-nw]'); await sheetOpt(p, 'back');
  check('вернул в свой день', await p.evaluate(() => !isMoved('d1') && buildWeek().find(e => e.id === 'd1').dow === 1));
  await p.click('#scr-plan [data-dow="1"]'); await p.click('.sheet [data-nw]'); await sheetOpt(p, 'ill');
  check('«Болею» спрашивает подтверждение', await visible(p, '.sheet [data-ok]') && await p.evaluate(() => !isDropped('d1')));
  await p.click('.sheet [data-ok]');
  check('болею: все тренировки недели отменены', await p.evaluate(() => ['d1', 'c-tue', 'd2', 'd3', 'c-sun'].every(isDropped)));   /* на 2-й неделе пятницы нет (С9), среда — отдых */
  await ctx.close();
}
/* 5. Еда: блюдо сегодня получает время, редкое — под «⋯», отмена работает */
{
  const { ctx, p } = await at('2026-10-12T13:05:00', { planOnboarded: true });
  await p.click('#tabbar [data-go="food"]');
  check('редкие действия еды под «⋯»', !(await p.evaluate(() => /Очистить неделю/.test(document.querySelector('#scr-food').innerText))));
  await p.click('#scr-food [data-menu]'); await sheetOpt(p, 'all');
  await p.click('#page [data-tog] >> nth=0');
  const r = await p.evaluate(() => Object.values(mealTimes));
  check('отметил блюдо — время 13:05', r.includes('13:05'), JSON.stringify(r));
  await p.click('#page [data-back]');
  await p.click('#scr-food [data-menu]'); await sheetOpt(p, 'clear');
  check('обнулить день', await p.evaluate(() => !Object.values(dishOn).some(Boolean)));
  await p.click('#toast button');
  check('«Отменить» вернула день', await p.evaluate(() => Object.values(mealTimes).includes('13:05')));
  await ctx.close();
}
/* 6. Тема: светлая, тёмная, как в iPhone */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true });
  await p.evaluate(() => openSettings());
  await p.click('#page [data-theme] [data-v="dark"]');
  check('тёмная тема включается', await p.evaluate(() => document.documentElement.dataset.theme === 'dark' && settings.theme === 'dark'));
  await p.reload({ waitUntil: 'load' });
  check('тема сохраняется до отрисовки', await p.evaluate(() => document.documentElement.dataset.theme === 'dark'));
  await p.evaluate(() => openSettings());
  await p.click('#page [data-theme] [data-v="auto"]');
  check('«Как в iPhone» снимает ручную тему', await p.evaluate(() => !document.documentElement.dataset.theme));
  await ctx.close();
}
/* 7. Удалить все данные: с подтверждением и автокопией, которую можно вернуть */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true, planMarks: { '1-2-d1-a1': true } });
  await p.evaluate(() => openSettings());
  await p.click('#page [data-wipe]');
  check('удаление спрашивает подтверждение', await visible(p, '.sheet [data-ok]'));
  await p.click('.sheet [data-ok]');
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({ m: localStorage.getItem('planMarks'), auto: JSON.parse(localStorage.getItem('planAutoBackup') || 'null') }));
  check('данные удалены, автокопия есть', r.m === null && r.auto && r.auto.data.planMarks['1-2-d1-a1'] === true, JSON.stringify(r).slice(0, 120));
  check('ошибок нет', p.errs.length === 0, p.errs.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} проверок не прошли` : '\nВсе проверки прошли');
process.exit(fails ? 1 : 0);
