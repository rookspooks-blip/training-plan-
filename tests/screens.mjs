/* Экраны «Сейчас» и «Еда» (E3.2): критерии приёмки 1, 12-17, 19, 20 из FABLE_BRIEF/state/SPORT_APP.md, раздел 4.2.
   Запуск: PW=.../playwright/index.mjs node tests/screens.mjs   (BR=webkit - движок Safari)
   SHOTS=папка - заодно сохранить скриншоты 390 × 844 в обеих темах (префикс E3.2-).
   Тапы считаются функцией tap(): каждая строка «тап» - одно нажатие пальцем. Ввод текста тапом не считается. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, webkit, devices } = await import(process.env.PW || 'playwright');
const engine = process.env.BR === 'webkit' ? webkit : chromium;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml' };
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
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' - ' + extra : ''}`); if (!ok) fails++; };
const browser = await engine.launch();

const lg = (n, d, w, r, rpe, k = 3) => ({ n, d, sets: Array.from({ length: k }, () => ({ w: String(w), r: String(r), t: '18:30' })), rpe, tr: r, th: r + 2, ns: k, wk: 'build' });
const SEED = {
  planOnboarded: true, planHintOff: true,
  planLog: { '2026-10-12-d1-a1': lg('Болгарский сплит-присед', '2026-10-12', '', 11, 8, 4), '2026-10-12-d1-a4': lg('Румынская тяга в разноножке', '2026-10-12', '4', 10, 8, 3) },
  planBody: { '2026-10-15': { w: 76.6 }, '2026-10-17': { w: 76.4 } }
};
const DEVICE = { ...devices['iPhone 13 Pro'], viewport: { width: 390, height: 844 } };
async function at(time, o = {}) {
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: o.motion ? 'no-preference' : 'reduce', serviceWorkers: 'block', colorScheme: o.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.errs = []; p.taps = 0; p.ctx = ctx;
  p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear(); localStorage.setItem('planSchema', '5');
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, o.data || SEED);
  await p.goto(URL0, { waitUntil: 'load' });
  await p.waitForTimeout(250);
  return p;
}
const E = (p, f, a) => p.evaluate(f, a);
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
async function tap(p, sel) { p.taps++; await p.click(sel); await p.clock.runFor(300); }
const close = async p => { check('ошибок страницы нет', p.errs.length === 0, p.errs.join(' | ')); await p.ctx.close(); };
const shot = async (p, name, dark) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `E3.2-${name}-${dark ? 'dark' : 'light'}.png`) }); };
const MON = '2026-10-19';

/* Прямоугольники интерактивных элементов: пересечения и перекрытия.
   Берётся видимая часть: обрезается экраном, прокручиваемыми предками и нижней панелью. Пара «вложенных» элементов не считается.
   Второй вид проверки: в центре видимой части сверху лежит сам элемент (его не закрывает чужой). */
const OVERLAP = () => {
  const bar = document.querySelector('#tabbar').getBoundingClientRect();
  const mini = document.querySelector('#mini');
  const limit = Math.min(innerHeight, bar.top, mini && !mini.hidden ? mini.getBoundingClientRect().top : 1e9);
  const q = 'button,input,select,textarea,a[href],[role=button],.nrow';
  const items = [];
  for (const e of document.querySelectorAll(q)) {
    if (e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    let x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(innerWidth, r.right), y1 = Math.min(limit, r.bottom);
    const inBar = e.closest('#tabbar,#mini,#toast');
    if (inBar) { y1 = Math.min(innerHeight, r.bottom); }
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (/(auto|scroll|hidden)/.test(c.overflowY + c.overflowX)) { const b = a.getBoundingClientRect(); x0 = Math.max(x0, b.left); y0 = Math.max(y0, b.top); x1 = Math.min(x1, b.right); y1 = Math.min(y1, b.bottom); }
    }
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    items.push({ e, x0, y0, x1, y1 });
  }
  const name = e => (e.getAttribute('aria-label') || e.textContent || e.className || e.tagName).trim().slice(0, 28);
  const bad = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 1 && h > 1) bad.push(`пересечение: «${name(a.e)}» и «${name(b.e)}»`);
  }
  for (const a of items) {
    const t = document.elementFromPoint((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
    if (!t || !(a.e.contains(t) || t.contains(a.e))) bad.push(`закрыт: «${name(a.e)}» поверх «${t ? name(t) : 'ничего'}»`);
  }
  return { n: items.length, bad };
};

/* ===== 1. Вход в плеер из «Сейчас»: не больше 2 тапов в 06:30, 13:00, 17:00 и 23:50 ===== */
for (const [lab, t] of [['06:30', '06:30'], ['13:00', '13:00'], ['17:00', '17:00'], ['23:50', '23:50']]) {
  const p = await at(`${MON}T${t}:00`);
  await tap(p, '#scr-now [data-start]');
  check(`1. вход в ${lab}: плеер открыт за ${p.taps} тап(а)`, p.taps <= 2 && await vis(p, '#player .panel'));
  await close(p);
}

/* ===== «Сейчас»: один список без дублей, высота, замер ничего не блокирует ===== */
for (const dark of [false, true]) {
  const p = await at(`${MON}T07:52:00`, { dark });
  const r = await E(p, () => {
    const main = document.querySelector('#scr-now .main h2'), rows = [...document.querySelectorAll('#scr-now .nrow .nm')].map(e => e.firstChild.textContent.trim());
    const all = [main && main.textContent.replace(/ · .*/, '').trim(), ...rows];
    const body = document.querySelector('#scr-now').innerText;
    return { all, h: document.documentElement.scrollHeight, greet: /Доброе утро|Добрый день|Добрый вечер|удачной/i.test(body), kneeG: /зелёный/.test(body), pager: !!document.querySelector('#scr-now .pager, #scr-now .pdots'), morning: !!document.querySelector('#scr-now #morning'), fab: !!document.querySelector('#fab'), start: !!document.querySelector('#scr-now .main [data-start]'), later: /Не сегодня/.test(document.querySelector('#scr-now .main').textContent), w: !!document.querySelector('#scr-now [data-w]'), form: !!document.querySelector('#scr-now .mform') };
  });
  const tag = dark ? 'тёмная' : 'светлая';
  check(`17. «Сейчас» (${tag}): ни один пункт не показан дважды`, new Set(r.all).size === r.all.length, r.all.join(' | '));
  check(`17. «Сейчас» (${tag}): высота ${r.h} px не больше 1266`, r.h <= 1266);
  check(`«Сейчас» (${tag}): главный пункт «Начать» + «Не сегодня», вес одной строкой, формы замера на экране нет`, r.start && r.later && r.w && !r.form && !r.morning);
  check(`«Сейчас» (${tag}): без приветствий, плашек «зелёный», карусели и «+»`, !r.greet && !r.kneeG && !r.pager && !r.fab);
  if (!dark) {
    /* вес строкой записывается, буквы и диапазон отклоняются; полная форма - по тапу */
    await p.fill('#scr-now [data-w]', 'abc'); await p.click('#scr-now [data-wsave]');
    check('вес: буквы не записываются', await E(p, () => !body[isoDay()]));
    await p.fill('#scr-now [data-w]', '74,6'); await p.click('#scr-now [data-wsave]');
    check('вес: «74,6» записан, тост с «Отменить»', await E(p, () => body[isoDay()] && body[isoDay()].w === 74.6 && !document.querySelector('#toast button').hidden));
    await p.click('#scr-now [data-wopen]'); await p.clock.runFor(300);
    check('пульс, сон, шкалы - листом по тапу', await vis(p, '.sheet .mform [data-hr]'));
  }
  await shot(p, 'seychas-utro', dark);
  await close(p);
}

/* после тренировки: «Силовая А · закрыта в 18:42 · продолжить» */
for (const dark of [false, true]) {
  const p = await at(`${MON}T19:30:00`, { dark });
  await E(p, () => { setWatch('d1', 's', '17:00'); setWatch('d1', 'e', '18:42'); renderAll(); });
  const t = await E(p, () => document.querySelector('#scr-now .main').textContent);
  check(`после тренировки (${dark ? 'тёмная' : 'светлая'}): главный пункт «закрыта в 18:42» и «Продолжить»`, /Силовая А/.test(t) && /закрыта в 18:42/.test(t) && /Продолжить/.test(t));
  if (!dark) {
    const n = await E(p, () => [...document.querySelectorAll('#scr-now .nrow .nm')].filter(e => /Силовая А/.test(e.textContent)).length);
    check('закрытая тренировка в списке не повторяется', n === 0);
    await tap(p, '#scr-now [data-resume]');
    check('«Продолжить» открывает плеер', await vis(p, '#player .panel'));
  }
  await shot(p, 'seychas-posle', dark);
  await close(p);
}

/* «Не сегодня»: лист по макету 7, у вариантов последствие по правилам, «Отменить» 5 секунд */
for (const dark of [false, true]) {
  const p = await at(`${MON}T07:52:00`, { dark });
  await tap(p, '#scr-now [data-later]');
  const o = await E(p, () => [...document.querySelectorAll('.sheet .sopt')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  const expect = await E(p, () => { const w = whatIf(() => { skips[skipKey('d1')] = true; const e = buildWeekRaw().find(x => x.id === 'd1'); return dowLabel(e.dow); }); return w; });
  check(`«Не сегодня» (${dark ? 'тёмная' : 'светлая'}): три варианта, у «Пропустил» посчитан день переноса`, o.length >= 2 && o.some(x => /^ПропустилПеренесётся на /.test(x) && x.includes(expect)) && o.some(x => /^БолеюСнимется /.test(x)), o.join(' / ') + ' | ждали ' + expect);
  await p.clock.runFor(300);
  await shot(p, 'ne-segodnya', dark);
  if (!dark) {
    const before = await E(p, () => JSON.stringify(skips));
    await p.click('.sheet [data-a="skip"]'); await p.clock.runFor(300);
    check('после выбора день перенесён и виден «Отменить»', await E(p, () => isMoved('d1') && !document.querySelector('#toast button').hidden && document.querySelector('#toast').classList.contains('show')));
    await p.clock.runFor(4500);
    check('«Отменить» ещё на экране через 4,5 с', await E(p, () => document.querySelector('#toast').classList.contains('show')));
    await p.click('#toast button'); await p.clock.runFor(300);
    check('«Отменить» возвращает прежнее состояние', await E(p, b => JSON.stringify(skips) === b, before));
  }
  await close(p);
}

/* ===== «Еда» ===== */
const FOOD = { ...SEED, planFood: { '2026-10-19-0': { dishOn: { shake: true }, grams: {}, custom: [{ name: 'Кола 0,5 л', k: 212, p: 0, f: 0, c: 53, t: '09:05' }], times: { shake: '08:40' } } } };
for (const dark of [false, true]) {
  const p = await at(`${MON}T13:42:00`, { dark, data: FOOD });
  await p.click('#tabbar [data-go="food"]'); await p.clock.runFor(300);
  const r = await E(p, () => {
    const card = document.querySelector('#scr-food .fsum').getBoundingClientRect(), ring = document.querySelector('#scr-food .fring').getBoundingClientRect();
    const chips = [...document.querySelectorAll('#scr-food .fchip')];
    const cover = chips.map(c => { const b = c.getBoundingClientRect(), t = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); return b.bottom <= innerHeight - document.querySelector('#tabbar').offsetHeight && b.top >= 0 && (c === t || c.contains(t)); });
    return { card: card.height, ring: ring.width, chips: chips.length, ok: cover.filter(Boolean).length, rows: document.querySelectorAll('#scr-food .frow').length, mac: document.querySelectorAll('#scr-food .mrow').length, fab: !!document.querySelector('#fab'),
      menuOnly: !/Контейнеры недели|Собрать день|Фастфуд|Режим дня/.test(document.querySelector('#scr-food').innerText) };
  });
  const tag = dark ? 'тёмная' : 'светлая';
  check(`15. «Еда» (${tag}): карточка ${Math.round(r.card)} pt не выше 170, кольцо ${r.ring} pt, БЖУ три строки`, r.card <= 170 && r.ring >= 128 && r.ring <= 132 && r.mac === 3);
  check(`12. «Еда» (${tag}): фишек ${r.chips}, видно и не перекрыто ${r.ok}`, r.chips >= 6 && r.ok === r.chips);
  check(`«Еда» (${tag}): записи дня лентой, контейнеры и каталог только в меню, «+» нет`, r.rows === 2 && r.menuOnly && !r.fab);
  if (!dark) {
    /* привычное блюдо: 1 тап */
    p.taps = 0; const n0 = await E(p, () => custom.length + Object.values(dishOn).filter(Boolean).length);
    await tap(p, '#scr-food .fchip >> nth=0');
    check('12. привычное блюдо записано за 1 тап', p.taps === 1 && await E(p, n => custom.length + Object.values(dishOn).filter(Boolean).length === n + 1, n0));
    await p.click('#toast button'); await p.clock.runFor(300);
    check('запись отменяется кнопкой «Отменить»', await E(p, n => custom.length + Object.values(dishOn).filter(Boolean).length === n, n0));
    /* своя запись одной строкой */
    p.taps = 0;
    await p.fill('#scr-food [data-line]', 'Шаурма 650'); await tap(p, '#scr-food [data-add]');
    const own = await E(p, () => custom.find(x => x.name === 'Шаурма'));
    check('13. своя запись «Шаурма 650»: одна строка и 1 тап', p.taps === 1 && own && own.k === 650 && own.t === '13:42', JSON.stringify(own));
    /* валидация */
    const n1 = await E(p, () => custom.length);
    const rejected = [];
    for (const bad of ['Борщ abc', 'Борщ', '650', 'Борщ 0', 'Борщ 99999', 'Борщ 6a5', '']) {
      await p.fill('#scr-food [data-line]', bad); await p.click('#scr-food [data-add]'); await p.clock.runFor(100);
      rejected.push(await E(p, n => custom.length === n, n1));
    }
    check('13. буквы в калориях, пустые калории и пустая строка не сохраняются', rejected.every(Boolean) && await vis(p, '#scr-food [data-lineerr]'), rejected.join(','));
    /* Б, Ж, У под «ещё»: форма с полями; название без калорий и буквы там тоже не проходят */
    await p.fill('#scr-food [data-line]', 'Плов'); await p.click('#scr-food [data-more]'); await p.clock.runFor(300);
    check('13. «ещё» открывает форму с Б, Ж, У и названием из строки', await E(p, () => document.querySelector('.sheet [data-n]').value === 'Плов' && ['p', 'f', 'c'].every(f => document.querySelector(`.sheet [data-${f}]`))));
    await p.click('.sheet [data-add]');
    check('13. форма: название без калорий не сохраняется', await E(p, n => custom.length === n && !document.querySelector('.sheet .errtxt').hidden, n1));
    await p.fill('.sheet [data-k]', 'abc'); await p.click('.sheet [data-add]');
    check('13. форма: буквы в калориях не сохраняются', await E(p, n => custom.length === n, n1));
    await p.fill('.sheet [data-k]', '720'); await p.fill('.sheet [data-p]', '30'); await p.click('.sheet [data-add]'); await p.clock.runFor(400);
    check('13. форма: название и калории сохраняются, БЖУ - по желанию', await E(p, () => custom.some(x => x.name === 'Плов' && x.k === 720 && x.p === 30 && x.f === 0)));
    /* правка своей записи: название, калории, БЖУ, время */
    await p.click('#scr-food [data-ci] >> nth=0'); await p.clock.runFor(300);
    const idx = await E(p, () => [...document.querySelectorAll('#scr-food [data-ci]')].map(e => e.querySelector('.nm').textContent));
    await shot(p, 'eda-pravka', dark);
    await p.fill('.sheet [data-n]', 'Колу заменил'); await p.fill('.sheet [data-k]', '180'); await p.fill('.sheet [data-p]', '1'); await p.fill('.sheet [data-f]', '2'); await p.fill('.sheet [data-c]', '40'); await p.fill('.sheet [data-t]', '10:15');
    await p.click('.sheet [data-save]'); await p.clock.runFor(400);
    check('14. правка своей записи: название, калории, Б, Ж, У и время', await E(p, () => custom.some(x => x.name === 'Колу заменил' && x.k === 180 && x.p === 1 && x.f === 2 && x.c === 40 && x.t === '10:15')), idx.join(' | '));
    await p.click('#scr-food [data-ci] >> nth=0'); await p.clock.runFor(300);
    await p.fill('.sheet [data-k]', 'abc'); await p.click('.sheet [data-save]');
    check('14. при правке буквы в калориях не сохраняются', await E(p, () => custom.find(x => x.name === 'Колу заменил').k === 180));
    await p.click('.sheet [data-k]'); await p.fill('.sheet [data-k]', '180');
    /* удаление с «Отменить» 5 секунд */
    const nDel = await E(p, () => custom.length);
    await p.click('.sheet [data-del]'); await p.clock.runFor(300);
    check('14. удаление: запись ушла, «Отменить» на экране', await E(p, n => custom.length === n - 1 && !document.querySelector('#toast button').hidden, nDel));
    await p.clock.runFor(4500);
    check('14. «Отменить» доступна 5 секунд', await E(p, () => document.querySelector('#toast').classList.contains('show')));
    await p.click('#toast button'); await p.clock.runFor(300);
    check('14. «Отменить» возвращает запись', await E(p, n => custom.length === n, nDel));
    /* меню */
    await p.click('#scr-food [data-menu]'); await p.clock.runFor(300);
    check('контейнеры недели, каталог, «Собрать день», фастфуд, режим дня - в меню «⋯»', await E(p, () => ['cook', 'all', 'assemble', 'ff', 'timing', 'day'].every(a => document.querySelector(`.sheet [data-a="${a}"]`))));
    await E(p, () => closeSheets()); await p.clock.runFor(300);
  }
  await close(p);
}
/* скриншоты «Еды» с записями */
for (const dark of [false, true]) {
  const p = await at(`${MON}T13:42:00`, { dark, data: FOOD });
  await p.click('#tabbar [data-go="food"]'); await p.clock.runFor(300);
  await E(p, () => { custom.push({ name: 'Шаурма', k: 650, p: 0, f: 0, c: 0, t: '13:41' }); dishOn.shake = true; saveFood(); renderAll(); });
  await shot(p, 'eda', dark);
  if (dark) { await p.click('#scr-food [data-ci] >> nth=1'); await p.clock.runFor(300); await shot(p, 'eda-pravka', dark); }
  await close(p);
}

/* ===== 16. Нет перекрытий на всех четырёх вкладках, 390 × 844, обе темы ===== */
for (const dark of [false, true]) {
  const p = await at(`${MON}T13:42:00`, { dark, data: FOOD });
  for (const tab of ['now', 'plan', 'food', 'me']) {
    await p.click(`#tabbar [data-go="${tab}"]`); await p.clock.runFor(300);
    const r = await E(p, OVERLAP);
    check(`16. вкладка «${tab}» (${dark ? 'тёмная' : 'светлая'}): ${r.n} элементов, перекрытий ${r.bad.length}`, r.bad.length === 0, r.bad.slice(0, 4).join('; '));
    check(`«+» нет на вкладке «${tab}»`, await E(p, () => !document.querySelector('#fab')));
    if (tab === 'plan' || tab === 'me') await shot(p, tab === 'plan' ? 'plan' : 'ya', dark);
  }
  await close(p);
}
/* с плашкой «идёт тренировка» над вкладками и с открытым листом */
{
  const p = await at(`${MON}T18:10:00`, { data: FOOD });
  await tap(p, '#scr-now [data-start]'); await E(p, () => closePlayer()); await p.clock.runFor(300);
  for (const tab of ['now', 'food']) {
    await p.click(`#tabbar [data-go="${tab}"]`); await p.clock.runFor(300);
    const r = await E(p, OVERLAP);
    check(`16. вкладка «${tab}» с плашкой «идёт тренировка»: перекрытий ${r.bad.length}`, r.bad.length === 0, r.bad.slice(0, 4).join('; '));
  }
  await close(p);
}

/* ===== 20. Цели для пальца не меньше 44 pt на «Сейчас», «Еде» и в листе «Не сегодня» ===== */
{
  const SMALL = () => {
    const bad = [];
    for (const e of document.querySelectorAll('button,input,select,textarea,a[href],.nrow')) {
      if (e.closest('[hidden]') || e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue;
      if (e.matches('input[type=checkbox]') || e.closest('.switch')) continue;
      const r = e.getBoundingClientRect(); if (r.width < 1) continue;
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) bad.push(`${(e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 24)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return bad;
  };
  const p = await at(`${MON}T07:52:00`, { data: FOOD });
  check('20. «Сейчас»: все цели не меньше 44 pt', (await E(p, SMALL)).length === 0, (await E(p, SMALL)).join('; '));
  await p.click('#tabbar [data-go="food"]'); await p.clock.runFor(300);
  check('20. «Еда»: все цели не меньше 44 pt', (await E(p, SMALL)).length === 0, (await E(p, SMALL)).join('; '));
  await p.click('#tabbar [data-go="now"]'); await p.clock.runFor(300);
  await p.click('#scr-now [data-later]'); await p.clock.runFor(300);
  check('20. лист «Не сегодня»: все цели не меньше 44 pt', (await E(p, SMALL)).length === 0, (await E(p, SMALL)).join('; '));
  await close(p);
}

/* ===== 19. Переходы до 200 мс, лист до 250 мс, содержимое на месте сразу (движение включено) ===== */
{
  const p = await at(`${MON}T07:52:00`, { motion: true, data: FOOD });
  const ms = v => Math.max(...String(v).split(',').map(x => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000) || 0));
  await p.clock.runFor(1000);
  for (const tab of ['plan', 'food', 'me', 'now']) {
    await p.click(`#tabbar [data-go="${tab}"]`);
    const r = await E(p, () => {
      const box = document.querySelector(`#scr-${document.body.dataset.tab}`), cs = getComputedStyle(box);
      const kids = [...box.children].map(k => getComputedStyle(k)), d = k => k.animationDelay;
      return { dur: cs.animationDuration, name: cs.animationName, kidsAnim: kids.filter(k => k.animationName !== 'none').length, kidsDelay: kids.filter(k => parseFloat(d(k)) > 0).length, op: cs.opacity, h: box.scrollHeight };
    });
    check(`19. переход на «${tab}»: анимация ${r.dur} (до 200 мс), у блоков нет своих анимаций и задержек, содержимое уже на месте (высота ${r.h})`, ms(r.dur) <= 200 && r.kidsAnim === 0 && r.kidsDelay === 0 && parseFloat(r.op) >= 0.3 && r.h > 100, JSON.stringify(r));
    await p.clock.runFor(300);
  }
  await p.click('#scr-now [data-later]');
  const sh = await E(p, () => { const s = getComputedStyle(document.querySelector('.sheet')), d = getComputedStyle(document.querySelector('.dim')); return { s: s.animationDuration, d: d.animationDuration }; });
  check(`19. лист: ${sh.s} (до 250 мс), затемнение ${sh.d}`, ms(sh.s) <= 250 && ms(sh.d) <= 250, JSON.stringify(sh));
  const css = await (await fetch(URL0 + 'css/app.css')).text();
  check('19. «уменьшить движение» работает, ступенчатых задержек `rise` у вкладки нет', css.includes('prefers-reduced-motion') && !/\.wrap\.enter > :nth-child/.test(css));
  await close(p);
}

/* ===== Установка: подсказка не в standalone и не чаще одного раза ===== */
{
  const ctx = await browser.newContext({ ...DEVICE, serviceWorkers: 'block', userAgent: devices['iPhone 13 Pro'].userAgent });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('planSchema', '5'); localStorage.setItem('planOnboarded', 'true'); } });
  await p.goto(URL0, { waitUntil: 'load' }); await p.waitForTimeout(250);
  const first = await vis(p, '#installSlot .install');
  await p.evaluate(() => sessionStorage.removeItem('hintShown')); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  const second = await vis(p, '#installSlot .install');
  check('подсказка установки: в первом запуске видна, в следующем нет', first && !second, `${first}/${second}`);
  await ctx.close();
}

await browser.close(); server.close();
console.log(fails ? `\n${fails} проверок не прошли` : '\nВсе проверки прошли');
process.exit(fails ? 1 : 0);
