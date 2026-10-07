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
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date(time) });
  await p.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear(); localStorage.setItem('planSchema', '2');
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, data);
  await p.goto(URL0, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  return { ctx, p };
}
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);

/* 1. Первый запуск: подсказка «Как пользоваться», после «Понятно» не возвращается */
{
  const { ctx, p } = await at('2026-10-12T09:00:00');
  check('первый запуск: подсказка видна', await visible(p, '.onboard'));
  await p.click('#obOk');
  await p.reload({ waitUntil: 'load' });
  check('после «Понятно» не показывается', !(await visible(p, '.onboard')));
  await ctx.close();
}
/* 2. Шапка: одна карточка, без лишней строки статуса в обычную неделю */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true });
  const r = await p.evaluate(() => ({ t: document.getElementById('wbTitle').textContent, st: document.getElementById('status').hidden }));
  check('шапка: «Неделя 2 из 12 · рабочая», статус скрыт', r.t === 'Неделя 2 из 12 · рабочая' && r.st, JSON.stringify(r));
  await ctx.close();
}
/* 3. Тренировка: начать → идёт → закончить → итог с самочувствием */
{
  const { ctx, p } = await at('2026-10-12T17:00:00', { planOnboarded: true });
  check('пустых подсказок колена/поясницы нет', !(await p.evaluate(() => /Утром оцени, как она/.test(document.body.innerText))));
  check('блок «Каждый день» скрыт в день тренировки', (await p.evaluate(() => document.getElementById('dailyBox').innerHTML)) === '');
  await p.click('.sb-start');
  check('идёт тренировка', await visible(p, '.sessbar.run'));
  await p.clock.runFor(45 * 60 * 1000);
  await p.evaluate(() => { marks[key('d1', 'a1')] = true; saveMarks(); });
  await p.click('.sb-finish');
  const r = await p.evaluate(() => ({ w: watch['1-2-d1'], txt: document.querySelector('.sessbar.done')?.innerText || '' }));
  check('итог: время и счёт упражнений', r.w && r.w.s === '17:00' && r.w.e === '17:45' && /0:45/.test(r.txt) && /1 из 9/.test(r.txt), JSON.stringify(r));
  await p.click('.sb-feel button[data-v="7"]');
  check('самочувствие сохранено в день', await p.evaluate(() => body['2026-10-12'].feel === 7));
  await ctx.close();
}
/* 4. «Не получается?»: пропуск переносит, «Вернуть в свой день» отменяет, «Болею» — пауза */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true });
  check('меню закрыто по умолчанию', !(await visible(p, '.day-menu')));
  await p.click('.skipbtn.more');
  await p.click('.dm-opt[data-a="skip"]');
  check('пропуск = перенос на вторник', await p.evaluate(() => isMoved('d1') && buildWeek().find(e => e.id === 'd1').dow === 2));
  await p.evaluate(() => { selDow = 2; renderDays(); });
  await p.click('.skipbtn.more');
  await p.click('.dm-opt[data-a="back"]');
  check('вернул в свой день', await p.evaluate(() => !isMoved('d1') && buildWeek().find(e => e.id === 'd1').dow === 1));
  await p.evaluate(() => { selDow = 1; renderDays(); });
  await p.click('.skipbtn.more');
  await p.click('.dm-opt[data-a="ill"]');
  check('болею: все тренировки недели отменены', await p.evaluate(() => ['d1', 'd2', 'd4', 'd3', 'c-tue', 'c-sun'].every(isDropped)));
  await ctx.close();
}
/* 5. Еда: тумблер сегодня ставит время, время скрыто у неотмеченных */
{
  const { ctx, p } = await at('2026-10-12T13:05:00', { planOnboarded: true });
  await p.evaluate(() => goTab('food'));
  check('время скрыто у неотмеченных блюд', !(await visible(p, '.dish.off .dish-time')));
  await p.click('.dish .dish-toggle >> nth=0');
  const r = await p.evaluate(() => Object.values(mealTimes));
  check('включил блюдо — время 13:05', r.includes('13:05'), JSON.stringify(r));
  check('редкие кнопки еды под «Ещё»', !(await visible(p, '#btnClearWeek')));
  check('фастфуд и своё блюдо свёрнуты', !(await visible(p, '#cuName')) && !(await visible(p, '.fav.ff')));
  await ctx.close();
}
/* 6. Удалить все данные: с автокопией, которую можно вернуть */
{
  const { ctx, p } = await at('2026-10-12T09:00:00', { planOnboarded: true, planMarks: { '1-2-d1-a1': true } });
  await p.evaluate(() => document.getElementById('btnWipe').click());
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
