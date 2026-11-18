/* Сохранность данных: миграция формата 4 → 5, копии, восстановление, удаление, сдвиг дат, повреждённые значения.
   Сценарии 1-14, 17-22 и 25 из docs/migration-5.md (раздел 7) и проверки из раздела 9.
   Запуск: node tests/data.mjs   (путь к playwright: PW=...; BR=webkit — движок Safari)
   Сервер на свободном порту, OK/FAIL по каждой проверке. Нехватка места подменяется
   обёрткой Storage.prototype.setItem в addInitScript. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, webkit, devices } = await import(process.env.PW || 'playwright');
const engine = process.env.BR === 'webkit' ? webkit : chromium;   /* BR=webkit — движок Safari */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPORT = path.resolve(ROOT, '..');
const OLD_ROOT = path.join(SPORT, '_backup/2026-11-17/app-c9f11c9');       /* сборка v79 для сценария 14 */
const PHONE_DIR = process.env.PHONE_DIR || path.join(SPORT, '_backup/phone');                        /* реальный файл копии для сценария 11 */
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' };

function serve(root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r({ server, url: `http://localhost:${server.address().port}/` })));
}
const main = await serve(ROOT);
const URL0 = main.url;

let fails = 0, skips = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
const skip = (name, why) => { console.log(`SKIP ${name} — ${why}`); skips++; };
const browser = await engine.launch();

/* ---------- Данные для подкладки ---------- */
const DATA_KEYS = ['planMarks', 'planSkips', 'planFood', 'planPos', 'planTodo', 'planLog', 'planSet', 'planBody', 'planCirc', 'planTests', 'planFav', 'planWatch', 'planCook', 'planArchive', 'planLoad'];
const raw = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && v.__raw !== undefined ? v.__raw : JSON.stringify(v)]));
const RAW = s => ({ __raw: s });
/* Полный набор 15 ключей формата 4/5. tag отличает два набора друг от друга. auto:false — неделя не пересчитывается, planPos остаётся как есть */
function dataset(tag = 'A') {
  const d = tag === 'A' ? '10' : '11';
  return {
    planMarks: { '2026-11-09-d1-a1': true, '2026-11-09-d1-a2': true, [`2026-11-${d}-d2-c1`]: true },
    planSkips: tag === 'A' ? {} : { '2026-11-12-skip': true },
    planFood: { '2026-11-09-0': { dishOn: { shake: true }, grams: {}, custom: [{ name: 'Кола ' + tag, k: 212, p: 0, f: 0, c: 53, t: '15:00' }], times: { shake: '09:00' } } },
    planPos: { cycle: 1, week: tag === 'A' ? 6 : 7 },
    planTodo: { t1: true },
    planLog: { '2026-11-09-d1-a1': { n: 'Присед ' + tag, d: '2026-11-09', sets: [{ w: '60', r: '8' }, { w: '62,5', r: '8' }], rpe: 8 } },
    planSet: { start: '2026-10-05', session: 4, auto: false, theme: tag === 'A' ? 'dark' : 'light' },
    planBody: { '2026-11-09': { w: 76.2, knee: 1 }, [`2026-11-${d}`]: { w: 76.0 } },
    planCirc: [{ d: '2026-11-01', a: 84, b: 90, h: 55 }],
    planTests: [{ d: '2026-09-20', t: 'pull', v: tag === 'A' ? 8 : 9 }],
    planFav: [{ name: 'Йогурт', k: 100, p: 10, f: 2, c: 8 }],
    planWatch: { '2026-11-09-d1': { s: '17:00', e: '18:00' } },
    planCook: { '2026-11-09': [{ m: 'chicken', g: 'g_rice', n: 4 }] },
    planArchive: {},
    planLoad: { '2026-11-10': [{ k: 'ball', min: 60, rpe: 6 }] },
  };
}
const CLOCK = '2026-11-18T10:00:00';

/* Открыть приложение с подложенными сырыми строками.
   o.raw — {ключ: строка}; o.blockFirst / o.blockAlways — ключи, запись которых бросает QuotaExceededError
   (первый запуск / всегда); o.blockPrefix — то же для ключей с префиксом; o.time — часы браузера.
   Подмена и подкладка работают на каждой загрузке страницы, но данные кладутся только на первой. */
async function open(o = {}, url = URL0) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|QuotaExceeded|Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  if (o.time) await p.clock.install({ time: new Date(o.time) });
  await p.addInitScript(cfg => {
    const first = !sessionStorage.getItem('seeded');
    if (first) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      for (const k in cfg.raw) {
        let v = cfg.raw[k];
        if (v === '@today') { const d = new Date(); v = JSON.stringify(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }
        localStorage.setItem(k, v);
      }
    }
    window.__block = [...(cfg.blockAlways || []), ...(first ? (cfg.blockFirst || []) : [])];
    window.__prefix = cfg.blockPrefix || null;
    window.__fail = null;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (window.__block.includes(k) || (window.__prefix && k.startsWith(window.__prefix))) throw new DOMException('нет места', 'QuotaExceededError');
      const f = window.__fail;
      if (f && f.keys.includes(k)) { f.count++; if (f.count === f.n) throw new DOMException('нет места', 'QuotaExceededError'); }
      return orig.call(this, k, v);
    };
  }, { raw: Object.fromEntries(Object.entries(o.raw || {}).map(([k, v]) => [k, v && v.__raw !== undefined ? v.__raw : v])), blockFirst: o.blockFirst, blockAlways: o.blockAlways, blockPrefix: o.blockPrefix });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(500);
  return { ctx, p };
}
const SNAP_KEYS = [...DATA_KEYS, 'planGrams', 'planCustom', 'planSchema', 'planPre5', 'planPreOp', 'planAutoBackup', 'planAuto2', 'planAuto3', 'planAutoDay', 'planShiftChecked', 'planShiftFix', 'planLive'];
const snap = p => p.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), SNAP_KEYS);
const J = s => (s == null ? null : JSON.parse(s));
const sameRaw = (a, b, keys) => keys.every(k => a[k] === b[k]);
const tabs = async p => { for (const t of ['now', 'plan', 'food', 'me']) { await p.click(`#tabbar [data-go="${t}"]`); await p.waitForTimeout(120); }
  await p.evaluate(() => { openSettings(); closePage(true); openLibrary(); closePage(true); }); };
const noErr = (name, p) => check(name + ': ошибок страницы нет', p.errs.length === 0, p.errs.join(' | '));
const withSkip = obj => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== 'planSet'));

/* Эталон: чистый прогон формата 4 (для сравнения с прерванными) */
const A = dataset('A');
const RAW4 = { ...raw(A), planSchema: '4' };
const clean4 = await (async () => { const { ctx, p } = await open({ raw: RAW4, time: CLOCK }); const s = await snap(p); await ctx.close(); return s; })();

/* ===== 1. Формат 1: нет planSchema, planGrams/planCustom, ключи «цикл-неделя» ===== */
{
  const R1 = raw({ planGrams: { 'x-y': 100 }, planCustom: [{ name: 'старое', k: 1 }], planMarks: { '1-1-d1-a1': true, '1-1-d1-a2': true },
    planLog: { '1-1-d1-a4': { n: 'X', d: '2026-10-05', sets: [{ w: '6', r: '10' }], rpe: 8 } }, planFood: { '1-1-0': { dishOn: { shake: true }, grams: {}, custom: [], times: {} } } });
  const { ctx, p } = await open({ raw: R1 });
  const s = await snap(p), pre = J(s.planPre5);
  check('1 формат 1: planPre5 хранит исходные строки побайтово (в том числе устаревшие ключи)', !!pre && Object.keys(R1).every(k => pre.raw[k] === R1[k]));
  check('1 формат 1: схема 5, ключи стали датами понедельника, значения целы',
    s.planSchema === '5' && JSON.stringify(J(s.planMarks)) === '{"2026-10-05-d1-a1":true,"2026-10-05-d1-a2":true}'
    && J(s.planLog)['2026-10-05-d1-a4'].rpe === 8 && !!J(s.planFood)['2026-10-05-0'], s.planMarks);
  check('1 формат 1: planGrams/planCustom удалены только после записи в planPre5', s.planGrams === null && s.planCustom === null && pre.raw.planGrams === R1.planGrams && pre.raw.planCustom === R1.planCustom);
  noErr('1', p); await ctx.close();
}

/* ===== 2. Формат 2 ===== */
{
  const R2 = { ...raw({ planMarks: { '1-1-d1-a1': true }, planBody: { '2026-10-05': { w: 76.2, knee: 2 } }, planFood: { '1-1-0': { dishOn: { shake: true }, grams: {}, custom: [], times: { shake: '09:00' } } } }), planSchema: '2' };
  const { ctx, p } = await open({ raw: R2 });
  const s = await snap(p), cook = await p.evaluate(() => ({ t: typeof cook, n: Object.keys(cook).length }));
  check('2 формат 2: схема 5, ключи стали датами, planBody не тронут, planCook пуст при чтении',
    s.planSchema === '5' && s.planMarks === '{"2026-10-05-d1-a1":true}' && s.planBody === R2.planBody && !!J(s.planFood)['2026-10-05-0'] && cook.t === 'object' && cook.n === 0);
  check('2 формат 2: planPre5 с исходными строками', J(s.planPre5).raw.planMarks === R2.planMarks && J(s.planPre5).schema === 2);
  noErr('2', p); await ctx.close();
}

/* ===== 3. Формат 3 ===== */
{
  const R3 = { ...raw(A), planSchema: '3' };
  const { ctx, p } = await open({ raw: R3, time: CLOCK });
  const s = await snap(p);
  check('3 формат 3: схема 5, записи не изменены (кроме planSet.prog)', s.planSchema === '5' && sameRaw(s, R3, DATA_KEYS.filter(k => k !== 'planSet')));
  await ctx.close();
}

/* ===== 4. Формат 4: штатный путь ===== */
let after4;
{
  const { ctx, p } = await open({ raw: RAW4, time: CLOCK });
  const s = await snap(p), pre = J(s.planPre5); after4 = s;
  check('4 формат 4: схема 5', s.planSchema === '5');
  check('4 формат 4: planPre5 равен исходным строкам побайтово (все 15 ключей)', !!pre && pre.kind === 'pre5' && pre.schema === 4 && DATA_KEYS.every(k => pre.raw[k] === RAW4[k]));
  check('4 формат 4: остальные 14 ключей после миграции побайтово те же', sameRaw(s, RAW4, DATA_KEYS.filter(k => k !== 'planSet')),
    DATA_KEYS.filter(k => k !== 'planSet' && s[k] !== RAW4[k]).join(','));
  const ps = J(s.planSet), ps0 = A.planSet;
  check('4 формат 4: planSet.prog добавлен, остальные поля те же', JSON.stringify(ps.prog) === '{"v":2,"from":"2026-11-09"}' && Object.keys(ps0).every(k => JSON.stringify(ps[k]) === JSON.stringify(ps0[k])));
  check('4 формат 4: planShiftChecked = true', s.planShiftChecked === 'true');
  await tabs(p); noErr('4', p);
  /* ===== 5. Повторный запуск ===== */
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const s2 = await snap(p);
  check('5 повторный запуск: planPre5 не перезаписан, данные и planSet те же', s2.planPre5 === s.planPre5 && sameRaw(s2, s, DATA_KEYS) && Object.keys(J(s2.planSet)).filter(k => k === 'prog').length === 1);
  await ctx.close();
}

/* ===== 6. Прерывание между шагами ===== */
{
  const finalOf = s => ({ ...Object.fromEntries(DATA_KEYS.map(k => [k, s[k]])), planSchema: s.planSchema, planShiftChecked: s.planShiftChecked });
  /* страница «умирает» на записи номера формата (шаг 5) */
  const { ctx, p } = await open({ raw: RAW4, time: CLOCK, blockFirst: ['planSchema'] });
  const s1 = await snap(p);
  check('6 прерывание на шаге 5: схема осталась 4, копия planPre5 есть, данные не потеряны',
    s1.planSchema === '4' && !!s1.planPre5 && sameRaw(s1, RAW4, DATA_KEYS.filter(k => k !== 'planSet')));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const s2 = await snap(p);
  check('6 прерывание: следующий запуск доводит миграцию, результат как у чистого прогона', JSON.stringify(finalOf(s2)) === JSON.stringify(finalOf(clean4)));
  check('6 прерывание: planPre5 при повторе не перезаписан', s2.planPre5 === s1.planPre5);
  await ctx.close();
}

/* ===== 7. Нет места под planPre5 ===== */
{
  const { ctx, p } = await open({ raw: RAW4, time: CLOCK, blockFirst: ['planPre5'] });
  const s = await snap(p);
  check('7 нет места: схема осталась 4, все 15 ключей побайтово те же, planPre5 нет', s.planSchema === '4' && sameRaw(s, RAW4, DATA_KEYS) && s.planPre5 === null);
  check('7 нет места: на «Сейчас» постоянная строка с кнопкой файла копии', await p.evaluate(() => { const e = document.querySelector('#scr-now [data-dalert]'); return !!e && /Не хватило памяти/.test(e.textContent) && !!e.querySelector('[data-alert-save]'); }));
  await p.evaluate(() => openSettings());
  check('7 нет места: строка есть и вверху настроек', await p.evaluate(() => !!document.querySelector('#page [data-dalert] [data-alert-save]')));
  await p.evaluate(() => closePage(true));
  /* файл ловим на выходе из приложения (в WebKit из Playwright событие скачивания не приходит и у сборки v79) */
  await p.evaluate(() => { window.__dl = null; navigator.canShare = undefined; const oc = URL.createObjectURL.bind(URL);
    URL.createObjectURL = f => { window.__dl = f; return oc(f); }; HTMLAnchorElement.prototype.click = function () {}; });
  await p.click('#scr-now [data-alert-save]'); await p.waitForTimeout(300);
  let file = null; try { file = JSON.parse(await p.evaluate(() => window.__dl && window.__dl.text())); } catch (e) {}
  check('7 нет места: кнопка отдаёт файл копии с данными формата 4', !!file && file.app === 'tri-cikla' && file.schema === 4 && JSON.stringify(file.data.planMarks) === JSON.stringify(A.planMarks));
  check('7 нет места: приложение работает (вкладки)', await (async () => { await tabs(p); return p.errs.length === 0; })(), p.errs.join(' | '));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const s2 = await snap(p);
  check('7 место освободилось: следующий запуск мигрирует', s2.planSchema === '5' && !!s2.planPre5 && DATA_KEYS.every(k => J(s2.planPre5).raw[k] === RAW4[k]));
  await ctx.close();
}

/* ===== 8. Нет места на шаге 4 (planSet) ===== */
{
  const { ctx, p } = await open({ raw: RAW4, time: CLOCK, blockFirst: ['planSet'] });
  const s = await snap(p);
  check('8 нет места на planSet: схема 4, все 15 ключей те же, копия planPre5 есть', s.planSchema === '4' && sameRaw(s, RAW4, DATA_KEYS) && !!s.planPre5);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const s2 = await snap(p);
  check('8 повтор при следующем запуске: схема 5, результат как у чистого прогона', s2.planSchema === '5' && s2.planSet === clean4.planSet && s2.planPre5 === s.planPre5);
  await ctx.close();
}

/* ===== 9. Битые данные ===== */
{
  const R9 = { ...raw({ planTests: [{ d: '2026-09-20', t: 'pull', v: 8 }] }), planSchema: JSON.stringify('abc'), planLog: RAW('{не json'), planMarks: RAW('[1,2]'), planBody: RAW('null') };
  const { ctx, p } = await open({ raw: R9, time: CLOCK });
  await tabs(p);
  const s = await snap(p), pre = J(s.planPre5);
  const bad = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('planBad:')).map(k => [k, localStorage.getItem(k)])));
  const badOf = name => Object.entries(bad).filter(([k]) => k.startsWith(`planBad:${name}:`)).map(([, v]) => v);
  check('9 битые данные: нет падений при загрузке и на вкладках', p.errs.length === 0, p.errs.join(' | '));
  check('9 битые данные: сырые значения сохранены в planPre5', !!pre && pre.raw.planLog === '{не json' && pre.raw.planMarks === '[1,2]' && pre.raw.planBody === 'null');
  check('9 битые данные: сырые значения сохранены в planBad:<ключ>:<дата>', badOf('planLog').includes('{не json') && badOf('planMarks').includes('[1,2]') && badOf('planBody').includes('null'), Object.keys(bad).join(','));
  check('9 битые данные: нечисловая схема дала одну миграцию, схема 5', s.planSchema === '5');
  await p.evaluate(() => { marks['2026-11-09-d1-a1'] = true; saveMarks(); });
  const bad2 = await p.evaluate(() => Object.values(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('planBad:planMarks:')).map(k => [k, localStorage.getItem(k)]))));
  check('9 битые данные: первое сохранение затирает испорченное значение, но его строка остаётся в planBad', bad2.includes('[1,2]') && (await snap(p)).planMarks === '{"2026-11-09-d1-a1":true}');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  check('9 битые данные: повторный запуск не делает снимок заново', (await snap(p)).planPre5 === s.planPre5);
  await ctx.close();
}
{
  const R9b = { ...raw(A), planSchema: '7' };
  const { ctx, p } = await open({ raw: R9b, time: CLOCK });
  const s = await snap(p);
  check('9 схема 7 (из будущего): без снимка и миграции, данные те же, без ошибок', s.planSchema === '7' && s.planPre5 === null && sameRaw(s, R9b, DATA_KEYS) && p.errs.length === 0, p.errs.join(' | '));
  await ctx.close();
}
{
  /* не удалось сохранить строку повреждённого значения: поверх ключа ничего не пишем, строка о повреждении */
  const R9c = { ...raw(A), planSchema: '5', planLog: RAW('{не json') };
  const { ctx, p } = await open({ raw: R9c, time: CLOCK, blockPrefix: 'planBad:' });
  const r = await p.evaluate(() => { const ok = store.set('planLog', {}); return { ok, raw: localStorage.getItem('planLog'), note: !!document.querySelector('#scr-now [data-dalert]') && /повреждены/.test(document.querySelector('#scr-now [data-dalert]').textContent) }; });
  check('9 planBad не записался: запись поверх повреждённого ключа не идёт, строка о повреждении видна', r.ok === false && r.raw === '{не json' && r.note, JSON.stringify(r));
  await ctx.close();
}

/* ===== 10. Коллизия ключей в convertLegacyKeys ===== */
{
  const R10 = { ...raw({ planMarks: { '1-1-d1-a1': true, '2026-10-05-d1-a1': false } }), planSchema: '2' };
  const { ctx, p } = await open({ raw: R10 });
  const s = await snap(p);
  const conf = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('planBad:conflict:')).map(k => JSON.parse(localStorage.getItem(k))));
  check('10 коллизия: побеждает запись на дате, проигравшее значение не потеряно (planBad:conflict и planPre5)',
    s.planSchema === '5' && J(s.planMarks)['2026-10-05-d1-a1'] === false && conf.length === 1 && conf[0].items[0].lost === true && J(s.planPre5).raw.planMarks === R10.planMarks, JSON.stringify(conf).slice(0, 150));
  check('10 коллизия: пользователь предупреждён', await p.evaluate(() => /не потеряны/.test(document.querySelector('#scr-now [data-dalert]')?.textContent || '')));
  await ctx.close();
}
{
  /* архив: записи возвращаются на свои числа; очищается только после подтверждённого переноса */
  const R10b = { ...raw({ planMarks: { '2026-10-05-d1-a1': true }, planArchive: { '2026-10-05': { marks: { '-d1-a1': false, '-d1-a2': true } } } }), planSchema: '3' };
  const blocked = await open({ raw: R10b, blockFirst: ['planMarks'] });
  const sb = await snap(blocked.p);
  check('10 архив: перенос не записался — planArchive не очищен, схема 3, planMarks те же', sb.planSchema === '3' && sb.planArchive === R10b.planArchive && sb.planMarks === R10b.planMarks);
  await blocked.p.reload({ waitUntil: 'load' }); await blocked.p.waitForTimeout(400);
  const sa = await snap(blocked.p);
  check('10 архив: после повтора записи на местах, архив очищен, конфликтное значение сохранено отдельно',
    sa.planSchema === '5' && J(sa.planMarks)['2026-10-05-d1-a2'] === true && J(sa.planMarks)['2026-10-05-d1-a1'] === true && sa.planArchive === '{}'
    && (await blocked.p.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('planBad:conflict:')))));
  await blocked.ctx.close();
}

/* ===== 11. Реальный файл пользователя ===== */
{
  const files = fs.existsSync(PHONE_DIR) ? fs.readdirSync(PHONE_DIR).filter(f => /^plan-backup-.*\.json$/.test(f)).sort() : [];
  if (!files.length) skip('11 реальный файл пользователя', `нет файлов plan-backup-*.json в ${PHONE_DIR}`);
  else {
    const b = JSON.parse(fs.readFileSync(path.join(PHONE_DIR, files[files.length - 1]), 'utf8'));
    const { ctx, p } = await open({ raw: {} });
    const res = await p.evaluate(b => restoreData(b, 'тест'), b);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600);
    const s = await snap(p);
    const same = Object.keys(b.data).filter(k => k !== 'planSet' && k !== 'planPos' && k !== 'planTab').every(k => s[k] === JSON.stringify(b.data[k]));
    const cnt = k => (b.data[k] && typeof b.data[k] === 'object') ? Object.keys(b.data[k]).length : 0;
    const cnt2 = k => { const v = J(s[k]); return v && typeof v === 'object' ? Object.keys(v).length : 0; };
    check(`11 реальный файл (${files[files.length - 1]}): восстановлено, схема ${b.schema} → 5`, res === 'ok' && s.planSchema === '5');
    check('11 реальный файл: ключи побайтово те же (planSet: добавлено prog)', same);
    check('11 реальный файл: число записей planLog, planMarks, planFood, planBody, planLoad, planTests совпадает', ['planLog', 'planMarks', 'planFood', 'planBody', 'planLoad', 'planTests'].every(k => cnt(k) === cnt2(k)));
    console.log(`     размер данных: ${await p.evaluate(() => usedChars())} знаков в хранилище (LIMIT_CHARS = ${await p.evaluate(() => LIMIT_CHARS)})`);
    noErr('11', p); await ctx.close();
  }
}

/* ===== 12. Круг «копия — удалить всё — восстановить» ===== */
{
  const R12 = { ...raw(A), planSchema: '5', planAutoDay: '@today', planLive: RAW('{"v":1,"sid":"2026-11-09-d1","restUntil":1,"restSec":120}') };
  const { ctx, p } = await open({ raw: R12, time: CLOCK });
  const r = await p.evaluate(keys => {
    const before = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
    const b = JSON.parse(JSON.stringify(makeBackup()));
    const w = wipeData();
    const wiped = keys.every(k => localStorage.getItem(k) === null);
    localStorage.setItem('planLive', '{"чужой":"таймер"}');   /* состояние экрана от чужих данных: восстановление его чистит */
    const res = restoreData(b, 'тест');
    const afterR = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
    return { before, w, wiped, res, afterR, live: localStorage.getItem('planLive') };
  }, DATA_KEYS);
  check('12 круг: удаление выполнено, все ключи пусты', r.w === 'ok' && r.wiped);
  check('12 круг: после восстановления все 15 ключей побайтово равны исходным, planLive пуст', r.res === 'ok' && DATA_KEYS.every(k => r.afterR[k] === r.before[k]) && r.live === null,
    DATA_KEYS.filter(k => r.afterR[k] !== r.before[k]).join(','));
  await ctx.close();
}

/* ===== 13. Восстановление старой копии (формат 4) после миграции ===== */
{
  const B = dataset('B');
  const fileB = { app: 'tri-cikla', version: 1, schema: 4, saved: '2026-11-10T09:00:00.000Z', data: B };
  const { ctx, p } = await open({ raw: RAW4, time: CLOCK });
  const s0 = await snap(p);
  const res = await p.evaluate(f => restoreData(f, 'перед восстановлением'), fileB);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const s1 = await snap(p), op = J(s1.planPreOp);
  check('13 старая копия после миграции: восстановлено', res === 'ok' && s1.planMarks === JSON.stringify(B.planMarks));
  check('13 старая копия: копия текущих данных в planPreOp (сырые строки)', !!op && op.kind === 'preop' && DATA_KEYS.every(k => op.raw[k] === s0[k]));
  check('13 старая копия: схема 4 → 5 прошла снова, planPre5 не изменён, prog на месте', s1.planSchema === '5' && s1.planPre5 === s0.planPre5 && !!J(s1.planSet).prog);
  await tabs(p); noErr('13', p); await ctx.close();
}

/* ===== 14. Новый файл (схема 5, все новые поля) в старое приложение v79 ===== */
{
  if (!fs.existsSync(path.join(OLD_ROOT, 'index.html'))) skip('14 файл формата 5 в v79', `нет сборки v79: ${OLD_ROOT}`);
  else {
    const old = await serve(OLD_ROOT);
    const N = dataset('A');
    N.planLog['2026-11-09-d1-a1'].sets = [{ w: '60', r: '8', t: '18:42' }, { w: '62,5', r: '8', t: '18:46' }];
    N.planLog['2026-11-09-d1-a1'].sub = { n: 'Гоблет-присед', why: 'knee' };
    N.planWatch['2026-11-09-d1'] = { s: '17:00', e: '18:00', lt: 1763388123000, ac: 1, iv: { n: 4, work: 240, easy: 180, hr: [168, 170], hrEnd: 171 }, sh: [{ b: 'ft', h: 7, n: 10 }] };
    N.planSkips = { '2026-11-09-xs-d1-a3': true };
    N.planTests = [{ d: '2026-11-23', t: 'yoyo', v: 1240 }, { d: '2026-09-20', t: 'pull', v: 8 }];
    N.planSet = { ...N.planSet, prog: { v: 2, from: '2026-11-09' }, opDay: '2027-03-02' };
    N.planFood['2026-11-09-0'].custom.push({ name: 'Кофе', k: 50, p: 0, f: 0, c: 0, nm: 1 });
    const file = { app: 'tri-cikla', version: 1, schema: 5, saved: '2026-11-17T09:00:00.000Z', data: N };
    const { ctx, p } = await open({ raw: {}, time: CLOCK }, old.url);
    const res = await p.evaluate(f => restoreData(f, 'тест'), file);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600);
    await tabs(p);
    await p.evaluate(() => { openSettings(); closePage(true); const e = buildWeek().find(x => x.type === 'gym'); openPlayer(e.id); closePlayer(); });
    const s = await snap(p);
    check('14 файл формата 5 в v79: восстановление проходит, все экраны открываются без ошибок', res === 'ok' && p.errs.length === 0, p.errs.join(' | '));
    check('14 файл формата 5 в v79: записи на месте, новые поля не стёрты', J(s.planLog)['2026-11-09-d1-a1'].sub.why === 'knee' && J(s.planWatch)['2026-11-09-d1'].iv.n === 4
      && J(s.planSkips)['2026-11-09-xs-d1-a3'] === true && J(s.planTests)[0].t === 'yoyo' && J(s.planSet).prog.v === 2 && s.planSchema === '5');
    await ctx.close(); old.server.close();
  }
}

/* ===== 17. Своя запись еды без БЖУ ===== */
{
  const { ctx, p } = await open({ raw: { ...raw(A), planSchema: '5', planAutoDay: '@today' }, time: CLOCK });
  await p.evaluate(() => { goTab('food'); foodDay = todayIdx(); loadFoodDay(); ownFoodSheet(); });
  await p.fill('.sheet [data-n]', 'Кофе с молоком'); await p.fill('.sheet [data-k]', '50');
  await p.click('.sheet [data-add]'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('planFood'))[foodKey()];
    const x = e.custom.find(y => y.name === 'Кофе с молоком');
    const t = totalsOfDay(foodDay), txt = dayText(dayExport(addDays(weekTag(), foodDay)));
    return { x, fin: [t.k, t.p, t.f, t.c].every(Number.isFinite), nan: /NaN|undefined/.test(txt) };
  });
  check('17 запись без БЖУ: p, f, c в хранилище равны 0 (число), итоги дня и выгрузка без NaN', r.x && r.x.k === 50 && r.x.p === 0 && r.x.f === 0 && r.x.c === 0 && r.fin && !r.nan, JSON.stringify(r));
  await ctx.close();
}

/* ===== 18. Ротация автокопий ===== */
{
  const { ctx, p } = await open({ raw: { ...raw(A), planSchema: '5' }, time: '2026-11-20T10:00:00' });
  const slots = () => p.evaluate(() => ['planAutoBackup', 'planAuto2', 'planAuto3'].map(k => localStorage.getItem(k)));
  const day = async (iso, mut) => {
    await p.clock.setSystemTime(new Date(iso + 'T10:00:00'));
    await p.evaluate(m => { if (m) { marks[m] = true; saveMarks(); } autoRotate(); }, mut);
  };
  const markOf = s => s ? Object.keys(JSON.parse(JSON.parse(s).raw.planMarks)).filter(k => /^x/.test(k)).join() : null;
  const s1 = await slots();
  check('18 ротация: первый запуск создаёт ежедневную копию', !!s1[0] && JSON.parse(s1[0]).kind === 'daily' && !s1[1] && !s1[2]);
  await day('2026-11-21', 'x1'); await day('2026-11-22', 'x2'); await day('2026-11-23', 'x3');
  const s4 = await slots();
  check('18 ротация: три дня подряд — три разные копии, свежая первая', markOf(s4[0]) === 'x1,x2,x3' && markOf(s4[1]) === 'x1,x2' && markOf(s4[2]) === 'x1', s4.map(markOf).join(' | '));
  await day('2026-11-24', null);
  const s5 = await slots();
  check('18 ротация: день без изменений данных не двигает слоты', s5.every((x, i) => x === s4[i]) && await p.evaluate(() => JSON.parse(localStorage.getItem('planAutoDay'))) === '2026-11-24');
  await p.evaluate(() => { DATA_KEYS.forEach(k => { if (k !== 'planPos') localStorage.removeItem(k); }); });
  await p.clock.setSystemTime(new Date('2026-11-25T10:00:00')); await p.evaluate(() => autoRotate());
  const s6 = await slots();
  check('18 ротация: пустое состояние не затирает копии', s6.every((x, i) => x === s4[i]));
  await ctx.close();
}

/* ===== 19. Размер: число слотов падает 3 → 2 → 1 → 0 ===== */
{
  const blob = n => JSON.stringify({ x: 'a'.repeat(n) });
  const tinyPre5 = saved => JSON.stringify({ app: 'tri-cikla', kind: 'pre5', reason: 'миграция 4→5', schema: 4, schemaRaw: '4', saved, raw: { planMarks: '{"p":true}' } });
  for (const [D, want] of [[300000, 3], [500000, 2], [800000, 1], [1100000, 0]]) {
    const { ctx, p } = await open({ raw: { ...raw({ planMarks: { m: true } }), planArchive: RAW(blob(D)), planSchema: '5', planPre5: RAW(tinyPre5('2026-11-19T10:00:00.000Z')) }, time: '2026-11-20T10:00:00' });
    for (const [i, d] of ['2026-11-21', '2026-11-22', '2026-11-23'].entries()) {
      await p.clock.setSystemTime(new Date(d + 'T10:00:00'));
      await p.evaluate(i => { marks['x' + i] = true; saveMarks(); autoRotate(); }, i);
    }
    const n = await p.evaluate(() => ['planAutoBackup', 'planAuto2', 'planAuto3'].filter(k => localStorage.getItem(k) != null).length);
    const pre5 = await p.evaluate(() => localStorage.getItem('planPre5') != null);
    await p.evaluate(() => openSettings());
    const note = await p.evaluate(() => /не помещаются/.test(document.querySelector('#page [data-dalert]')?.textContent || ''));
    check(`19 размер: данные ${D / 1000} тыс. знаков (лимит ${2500} тыс.) — копий ${n}, нужно ${want}`, n === want && pre5 && (want > 0 || note), `pre5=${pre5} note=${note}`);
    await ctx.close();
  }
}

/* ===== 20. «Вернуть автокопию»: выбор слота, копия текущего, возврат обратно ===== */
{
  const B = dataset('B');
  const daily = { app: 'tri-cikla', kind: 'daily', reason: 'ежедневная копия', schema: 5, schemaRaw: '5', saved: '2026-11-17T08:00:00.000Z', raw: raw(A) };
  const R20 = { ...raw(B), planSchema: '5', planAutoDay: '@today', planAutoBackup: RAW(JSON.stringify(daily)) };
  const { ctx, p } = await open({ raw: R20 });
  await p.evaluate(() => openSettings());
  await p.click('#page [data-auto-back]');
  await p.waitForSelector('.sheet [data-slot]');
  const slotsN = await p.evaluate(() => document.querySelectorAll('.sheet [data-slot]').length);
  const txt = await p.evaluate(() => document.querySelector('.sheet').textContent);
  check('20 «Вернуть автокопию»: показан выбор слотов с датами', slotsN === 1 && /17 ноября/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 120));
  await p.click('.sheet [data-slot="0"]');
  await p.waitForSelector('.sheet [data-ok]');
  await p.click('.sheet [data-ok]');
  await p.waitForTimeout(1500);
  const s = await snap(p);
  check('20 возврат: данные из слота, копия текущих данных (B) сделана до замены',
    s.planMarks === JSON.stringify(A.planMarks) && J(s.planPreOp).raw.planMarks === JSON.stringify(B.planMarks) && J(s.planPreOp).kind === 'preop');
  await p.evaluate(() => openSettings());
  await p.click('#page [data-auto-back]');
  await p.waitForSelector('.sheet [data-slot]');
  const titles = await p.evaluate(() => [...document.querySelectorAll('.sheet [data-slot] b')].map(b => b.textContent));
  const idx = titles.findIndex(t => /Копия перед/.test(t));
  await p.click(`.sheet [data-slot="${idx}"]`);
  await p.waitForSelector('.sheet [data-ok]'); await p.click('.sheet [data-ok]');
  await p.waitForTimeout(1500);
  const s2 = await snap(p);
  check('20 вторая кнопка возвращает обратно: данные снова B', idx >= 0 && s2.planMarks === JSON.stringify(B.planMarks) && s2.planLog === JSON.stringify(B.planLog), titles.join('|'));
  noErr('20', p); await ctx.close();
}

/* ===== 21. Заблокированная запись копии: удаление и восстановление не выполняются ===== */
{
  const R21 = { ...raw(A), planSchema: '5', planAutoDay: '@today' };
  const { ctx, p } = await open({ raw: R21, time: CLOCK });
  const before = await snap(p);
  await p.evaluate(() => { window.__block = ['planPreOp']; openSettings(); });
  await p.click('#page [data-wipe]'); await p.waitForSelector('.sheet [data-ok]'); await p.click('.sheet [data-ok]');
  await p.waitForTimeout(500);
  const after = await snap(p);
  const sheet = await p.evaluate(() => ({ h: document.querySelector('.sheet h2')?.textContent, t: document.querySelector('.sheet .sub')?.textContent, save: !!document.querySelector('.sheet [data-save]') }));
  check('21 удаление при заблокированной копии: данные на месте', DATA_KEYS.every(k => after[k] === before[k]));
  check('21 удаление: показана причина и кнопка сохранения файла', /не удалены/i.test(sheet.h) && /не хватает места/.test(sheet.t) && sheet.save, JSON.stringify(sheet).slice(0, 150));
  await ctx.close();
}
{
  const R21b = { ...raw(A), planSchema: '5', planAutoDay: '@today' };
  const { ctx, p } = await open({ raw: R21b, time: CLOCK });
  const before = await snap(p);
  const fileB = { app: 'tri-cikla', schema: 5, data: dataset('B') };
  const r = await p.evaluate(f => { window.__block = ['planPreOp']; return restoreData(f, 'тест'); }, fileB);
  const after = await snap(p);
  check('21 восстановление при заблокированной копии: результат nocopy, ничего не изменено', r === 'nocopy' && DATA_KEYS.every(k => after[k] === before[k]) && after.planSchema === '5');
  await ctx.close();
}

/* ===== 22. detectDateShift после миграции и при восстановлении файла формата 5 ===== */
{
  /* журнал «живёт» на неделях, расходящихся с d на 14 дней: у данных формата 2 это вызвало бы сдвиг */
  const lg = (d, n) => ({ n, d, sets: [{ w: '', r: '10' }], rpe: 8 });
  const L = { '2026-10-26-d1-a1': lg('2026-11-09', 'Болгарский'), '2026-10-26-d3-c1': lg('2026-11-14', 'Присед') };
  const S22 = { ...raw({ ...dataset('A'), planLog: L }), planSchema: '4' };
  const { ctx, p } = await open({ raw: S22, time: CLOCK });
  const s = await snap(p);
  check('22 после миграции 4→5 ничего не сдвигается: planShiftFix нет, ключи журнала те же', s.planShiftFix === null && s.planLog === S22.planLog && s.planShiftChecked === 'true');
  const file = await p.evaluate(() => JSON.parse(JSON.stringify(makeBackup())));
  await ctx.close();
  const fresh = await open({ raw: {}, time: CLOCK });
  const res = await fresh.p.evaluate(f => restoreData(f, 'тест'), file);
  await fresh.p.reload({ waitUntil: 'load' }); await fresh.p.waitForTimeout(500);
  const s2 = await snap(fresh.p);
  check('22 чистое хранилище и файл формата 5: данные не сдвинуты, planShiftChecked = true', res === 'ok' && s2.planLog === S22.planLog && s2.planShiftFix === null && s2.planShiftChecked === 'true');
  await fresh.ctx.close();
  /* контроль: старый формат по-прежнему сдвигается, и перед этим копия лежит в planPreOp */
  const lg2 = (d, n) => ({ n, d, sets: [{ w: '', r: '10' }], rpe: 8 });
  const R2 = { ...raw({ planSet: { start: '2026-10-19' }, planMarks: { '1-2-d1-a1': true }, planLog: { '1-2-d1-a1': lg2('2026-10-12', 'Болгарский'), '1-2-d3-c1': lg2('2026-10-17', 'Присед') } }), planSchema: '2' };
  const c = await open({ raw: R2, time: '2026-11-02T10:00:00' });
  const s3 = await snap(c.p), fix = J(await c.p.evaluate(() => localStorage.getItem('planShiftFix')));
  check('22 контроль: данные формата 2 сдвигаются как раньше, перед сдвигом копия в planPreOp',
    !!fix && fix.delta === -14 && !!s3.planPreOp && /перед сдвигом/.test(J(s3.planPreOp).reason) && Object.keys(J(J(s3.planPreOp).raw.planMarks)).join() === '2026-10-26-d1-a1', JSON.stringify(fix));
  await c.ctx.close();
}
{
  /* коллизия до записи, копия обязательна, сбой посередине возвращает записи */
  const R = { ...raw(A), planSchema: '5', planAutoDay: '@today' };
  const { ctx, p } = await open({ raw: R, time: CLOCK });
  const before = await snap(p);
  const r1 = await p.evaluate(() => { marks = { '2026-02-30-d1-a1': true, '2026-03-02-d1-a1': true }; saveMarks(); const n = shiftDataBy(7); return { n, e: shiftError, raw: localStorage.getItem('planMarks') }; });
  check('22 сдвиг: коллизия ключей находится до записи, сдвига нет, данные те же', r1.n === -1 && r1.e === 'collision' && r1.raw === '{"2026-02-30-d1-a1":true,"2026-03-02-d1-a1":true}', JSON.stringify(r1));
  const r2 = await p.evaluate(() => { marks = { '2026-11-09-d1-a1': true }; saveMarks(); window.__block = ['planPreOp']; const n = shiftDataBy(7); window.__block = []; return { n, e: shiftError, raw: localStorage.getItem('planMarks') }; });
  check('22 сдвиг: копию записать не вышло — сдвига нет', r2.n === -1 && r2.e === 'copy' && r2.raw === '{"2026-11-09-d1-a1":true}');
  const r3 = await p.evaluate(() => { window.__block = ['planLog']; const n = shiftDataBy(7); window.__block = []; return { n, e: shiftError, marks: localStorage.getItem('planMarks'), mem: Object.keys(marks).join(), log: localStorage.getItem('planLog') }; });
  check('22 сдвиг: сбой записи на planLog — все ключи возвращены как были, память тоже', r3.n === -1 && r3.e === 'write' && r3.marks === '{"2026-11-09-d1-a1":true}' && r3.mem === '2026-11-09-d1-a1' && r3.log === before.planLog, JSON.stringify(r3));
  const r4 = await p.evaluate(() => { const n = shiftDataBy(7); return { n, marks: localStorage.getItem('planMarks'), op: JSON.parse(localStorage.getItem('planPreOp')).raw.planMarks }; });
  check('22 сдвиг: штатно — сдвинуто, перед этим копия в planPreOp', r4.n >= 1 && r4.marks === '{"2026-11-16-d1-a1":true}' && r4.op === '{"2026-11-09-d1-a1":true}', JSON.stringify(r4));
  await ctx.close();
}

/* ===== Раздел 9 ===== */
/* 9.1 Старая автокопия «перед удалением всех данных» переживает ротацию */
{
  const old = { app: 'tri-cikla', schema: 4, reason: 'перед удалением всех данных', saved: '2026-11-10T10:00:00.000Z', data: dataset('B') };
  const oldStr = JSON.stringify(old);
  const { ctx, p } = await open({ raw: { ...RAW4, planAutoBackup: RAW(oldStr) }, time: '2026-11-18T10:00:00' });
  const s0 = await snap(p);
  check('9.1 формат 4 со старой автокопией: после миграции она в planPreOp байт в байт', s0.planPreOp === oldStr && s0.planSchema === '5');
  for (const [i, d] of ['2026-11-19', '2026-11-20', '2026-11-21'].entries()) {
    await p.clock.setSystemTime(new Date(d + 'T10:00:00'));
    await p.evaluate(i => { marks['x' + i] = true; saveMarks(); autoRotate(); }, i);
  }
  const s = await snap(p);
  const ring = [s.planAutoBackup, s.planAuto2, s.planAuto3];
  check('9.1 после трёх дней ротации копия есть в planPreOp, а из кольца вытеснена', s.planPreOp === oldStr && ring.every(x => x !== oldStr) && J(s.planAutoBackup).kind === 'daily');
  await ctx.close();
}
/* 9.2 Откат при сбое на 5-м ключе восстановления */
{
  const R = { ...raw(A), planSchema: '5', planAutoDay: '@today' };
  const { ctx, p } = await open({ raw: R, time: CLOCK });
  const before = await snap(p);
  const fileB = { app: 'tri-cikla', version: 1, schema: 5, saved: '2026-11-17T09:00:00.000Z', data: dataset('B') };
  const r = await p.evaluate(f => {
    window.__fail = { keys: [...DATA_KEYS, ...LEGACY_KEYS], n: 5, count: 0 };
    const res = restoreData(f, 'перед восстановлением из файла');
    const failed = window.__fail.count >= 5; window.__fail = null;
    afterRestore(res);
    return { res, failed, sheet: document.querySelector('.sheet .sub')?.textContent || '' };
  }, fileB);
  const after = await snap(p);
  check('9.2 сбой записи на 5-м ключе: результат full, сбой действительно был', r.res === 'full' && r.failed, JSON.stringify(r).slice(0, 120));
  check('9.2 после отката все 15 ключей и номер формата побайтово равны исходным', DATA_KEYS.every(k => after[k] === before[k]) && after.planSchema === before.planSchema,
    DATA_KEYS.filter(k => after[k] !== before[k]).join(','));
  check('9.2 копия текущих данных осталась в planPreOp, пользователь видит, что произошло', J(after.planPreOp).raw.planTodo === before.planTodo && /возвращены как были/.test(r.sheet), r.sheet.slice(0, 100));
  await ctx.close();
}
/* 9.3 planPre5 после 14 дней */
{
  const D = 800000, blob = JSON.stringify({ x: 'a'.repeat(D) });
  const pre5 = saved => JSON.stringify({ app: 'tri-cikla', kind: 'pre5', reason: 'миграция 4→5', schema: 4, schemaRaw: '4', saved, raw: { planMarks: '{"p":true}', planArchive: blob } });
  const young = JSON.stringify({ app: 'tri-cikla', kind: 'daily', reason: 'ежедневная копия', schema: 5, schemaRaw: '5', saved: '2026-11-19T10:00:00.000Z', raw: { planMarks: '{"old":true}' } });
  const base = { ...raw({ planMarks: { m: true } }), planArchive: RAW(blob), planSchema: '5' };
  const run = async (extra) => { const { ctx, p } = await open({ raw: { ...base, ...extra }, time: '2026-11-20T10:00:00' }); const s = await snap(p);
    const al = await p.evaluate(() => { openSettings(); return /не помещаются/.test(document.querySelector('#page [data-dalert]')?.textContent || ''); }); await ctx.close(); return { s, al }; };
  /* а) старше 14 дней, есть свежая ежедневная копия, места мало — planPre5 уходит, новая копия записана */
  let r = await run({ planPre5: RAW(pre5('2026-10-30T10:00:00.000Z')), planAutoBackup: RAW(young) });
  check('9.3 planPre5 старше 14 дней, места мало, есть копия младше 3 дней — удалён, новая копия записана', r.s.planPre5 === null && !!r.s.planAutoBackup && J(r.s.planAutoBackup).raw.planMarks !== '{"old":true}');
  /* б) старше 14 дней, но ежедневных копий нет — не удаляется */
  r = await run({ planPre5: RAW(pre5('2026-10-30T10:00:00.000Z')) });
  check('9.3 planPre5 старше 14 дней, но нет ни одной ежедневной копии — не удалён', r.s.planPre5 !== null && r.s.planAutoBackup === null && r.al);
  /* в) моложе 14 дней — не удаляется */
  r = await run({ planPre5: RAW(pre5('2026-11-10T10:00:00.000Z')), planAutoBackup: RAW(young) });
  check('9.3 planPre5 моложе 14 дней — не удалён, даже если места мало', r.s.planPre5 !== null);
}
{
  /* места хватает — старый planPre5 остаётся */
  const pre5 = JSON.stringify({ app: 'tri-cikla', kind: 'pre5', reason: 'миграция 4→5', schema: 4, schemaRaw: '4', saved: '2026-10-30T10:00:00.000Z', raw: { planMarks: '{"p":true}' } });
  const { ctx, p } = await open({ raw: { ...raw(A), planSchema: '5', planPre5: RAW(pre5) }, time: '2026-11-20T10:00:00' });
  check('9.3 места хватает — planPre5 старше 14 дней остаётся', (await snap(p)).planPre5 === pre5);
  await ctx.close();
}

/* ===== 25. Существующие тесты ===== */
{
  const T = n => fs.readFileSync(path.join(ROOT, 'tests', n), 'utf8');
  const all = ['smoke', 'rules', 'flows', 'registry', 'data'].map(n => T(n + '.mjs'));
  check('25 во всех файлах тестов есть выбор движка BR=webkit', all.every(t => /process\.env\.BR === 'webkit'/.test(t)));
  check('25 smoke ждёт planSchema === 5', /planSchema'\)\) === '5'/.test(T('smoke.mjs')));
}

await browser.close();
main.server.close();
console.log(fails ? `\n${fails} проверок не прошли` : `\nВсе проверки прошли${skips ? ` (пропущено: ${skips})` : ''}`);
process.exit(fails ? 1 : 0);
