/* Проверка правил плана: перерыв, усталость, колено, замены, пропуски без отметки.
   Запуск: node tests/rules.mjs   (нужен playwright; путь можно задать в PW=...)
   Часы браузера ставятся на нужную дату, данные подкладываются в localStorage. */
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

/* Открыть приложение «в дату» с подложенными данными */
async function at(date, data = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(date + 'T10:00:00') });
  await p.addInitScript(d => {
    localStorage.clear();
    localStorage.setItem('planSchema', '2');
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, data);
  await p.goto(URL0, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  return { ctx, p };
}
/* Упражнения дня по id: имя и дозировка */
const dayEx = (p, id) => p.evaluate(id => buildWeek().find(e => e.id === id).day.ex.map(x => ({ id: x.id, name: x.name, dose: x.dose })), id);
const log = (d, n, w, r, rpe) => ({ n, d, sets: [{ w, r }, { w, r }, { w, r }], rpe, tr: 8, ns: 3 });

/* Пн 16.11.2026 — цикл 1, неделя 7 */
const W7 = '2026-11-16';

/* 1. Перерыв 10+ дней: на подход меньше, вес −10 % */
{
  const { ctx, p } = await at(W7, { planLog: {
    '1-4-d1-a5': log('2026-10-26', 'Тяга гантели в наклоне', '14', '12', 8),
    '1-4-d3-c5': log('2026-10-31', 'Жим гантелей стоя', '12', '10', 8),
  } });
  const r = await p.evaluate(() => ({ pos: [state.cycle, state.week], rt: returnInfo() }));
  const ex = await dayEx(p, 'd1');
  const row = ex.find(x => x.id === 'a5');
  const pl = await p.evaluate(() => { const d = buildWeek().find(e => e.id === 'd1').day; const ex = d.ex.find(x => x.id === 'a5'); return planFor(ex, parseDose(ex.dose), logKey('d1', 'a5')); });
  check('неделя по дате 1/7', r.pos.join('/') === '1/7', r.pos.join('/'));
  check('перерыв 16 дн. замечен', r.rt && r.rt.gap === 16 && r.rt.lvl === 1, JSON.stringify(r.rt));
  check('на подход меньше', /^2 ×/.test(row.dose), row.dose);
  check('вес ниже прошлого', pl.w > 0 && pl.w < 14, String(pl.w));
  check('пояснение на дне', await p.evaluate(() => { renderAll(); return /Возвращение после перерыва/.test(document.body.innerText); }));
  await ctx.close();
}

/* 2. Без перерыва — план не трогается */
{
  const { ctx, p } = await at(W7, { planLog: { '1-6-d3-c5': log('2026-11-14', 'Жим гантелей стоя', '12', '10', 8) } });
  check('нет перерыва — нет поправок', await p.evaluate(() => returnInfo() === null && fatigueInfo() === null));
  await ctx.close();
}

/* 3. Две тренировки на пределе — лёгкий день */
{
  const L = {};
  ['a2', 'a3', 'a5'].forEach(e => { L[`1-6-d1-${e}`] = { ...log('2026-11-09', 'x' + e, '', '8', 10) }; L[`1-6-d3-${e}`] = { ...log('2026-11-14', 'y' + e, '', '8', 9) }; });
  const { ctx, p } = await at(W7, { planLog: L });
  const f = await p.evaluate(() => fatigueInfo());
  const ex = await dayEx(p, 'd1');
  check('усталость замечена', !!f, JSON.stringify(f));
  check('лёгкий день: подходов меньше', /^3 ×/.test(ex.find(x => x.id === 'a1').dose), ex.find(x => x.id === 'a1').dose);
  await ctx.close();
}

/* 4. Колено: жёлтое — прыжков вдвое меньше, красное — вместо прыжков стена */
{
  const { ctx, p } = await at('2026-11-19', { planBody: { '2026-11-19': { knee: 4 } } });
  const ex = await dayEx(p, 'd2');
  const sprint = ex.find(x => x.id === 'b1'), lat = ex.find(x => x.id === 'b3');
  check('жёлтое: ускорения 3 на 80 %', /^3 × .*80 %/.test(sprint.dose), sprint.dose);
  check('жёлтое: латеральные — пропуск', /^пропустить/.test(lat.dose), lat.dose);
  await ctx.close();
}
{
  const { ctx, p } = await at('2026-11-19', { planBody: { '2026-11-19': { knee: 7 } } });
  const ex = await dayEx(p, 'd2');
  check('красное: прыжков нет, есть стена', !ex.some(x => /Ускорения|Выпрыгивания|прыжки/i.test(x.name)) && ex.some(x => x.name === 'Полуприсед у стены'), ex.map(x => x.name).join(', '));
  await ctx.close();
}

/* 5. Замены: нордические → скольжение по умолчанию, можно вернуть */
{
  const { ctx, p } = await at(W7);
  let ex = await dayEx(p, 'd1');
  check('с 5-й недели нордические по умолчанию', ex.some(x => x.id === 'a9' && x.name === 'Нордические сгибания' && x.dose === '3 × 5'), JSON.stringify(ex.find(x => x.id === 'a9')));
  await p.evaluate(() => setSub('Нордические сгибания', true));
  ex = await dayEx(p, 'd1');
  check('замена на скольжение по кнопке', ex.some(x => x.id === 'a9' && x.name === 'Скольжение пяток на полотенце' && x.dose === '3 × 10'));
  await p.evaluate(() => setSub('Жим гантелей стоя', true));
  ex = await dayEx(p, 'd3');
  check('жим стоя → сидя', ex.some(x => x.id === 'c5' && x.name === 'Жим гантелей сидя со спинкой'));
  check('кнопка замены в карточке', await p.evaluate(() => { renderAll(); return document.querySelectorAll('.subbtn').length > 0; }));
  await ctx.close();
}

/* 6. Пропуски без отметки сдвигают прогрессию, если журнал ведётся */
{
  /* неделя 5 сделана, неделя 6 — ничего; сейчас неделя 7 */
  const { ctx, p } = await at(W7, { planMarks: { '1-5-d1-a1': true, '1-5-d3-c1': true } });
  const r = await p.evaluate(() => ({ shift: progressShift(), lw: loadWeek() }));
  check('пустая неделя = минус неделя прогрессии', r.shift === 1 && r.lw === 6, JSON.stringify(r));
  await ctx.close();
}
{
  /* никто ничего не отмечал — приложение не наказывает */
  const { ctx, p } = await at(W7);
  check('без журнала сдвига нет', await p.evaluate(() => progressShift() === 0 && loadWeek() === 7));
  await ctx.close();
}

/* 7. Прошлые недели не меняются от сегодняшнего колена */
{
  const { ctx, p } = await at('2026-11-19', { planBody: { '2026-11-19': { knee: 7 } } });
  const ok = await p.evaluate(() => withWeek(1, 6, () => buildWeek().find(e => e.id === 'd2').day.ex.some(x => /Ускорения/.test(x.name))));
  check('прошлая неделя без поправок колена', ok);
  await ctx.close();
}

/* 8. Конец плана */
{
  const { ctx, p } = await at('2027-12-20');
  const r = await p.evaluate(() => ({ pos: [state.cycle, state.week], label: weekInfo().label }));
  check('после 52 недель — «план пройден»', r.pos.join('/') === '3/24' && /План пройден/.test(r.label), JSON.stringify(r));
  check('ошибок нет', p.errs.length === 0, p.errs.join(' | '));
  await ctx.close();
}

/* 7б. Пятница: первый шаг после физры, без прыжков и без разминки; в сессию — нет */
{
  const { ctx, p } = await at('2026-10-16');
  const r = await p.evaluate(() => {
    const e = buildWeek().find(x => x.id === 'd4');
    return { dow: e && e.dow, names: e ? e.day.ex.map(x => x.name) : [], noWarm: e && e.day.noWarm,
             daily: gymDays().has(4), ses: withWeek(1, 13, () => buildWeek().some(x => x.id === 'd4')) };
  });
  check('пятница: старты и ускорения после физры', r.dow === 5 && r.names.join() === 'Старты из баскетбольной стойки,Ускорения 20 м' && r.noWarm, JSON.stringify(r));
  check('пятница: ежедневный блок нужен, в сессию дня нет', r.daily === false && r.ses === false, JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, p } = await at('2026-11-20', { planBody: { '2026-11-20': { knee: 7 } } });
  const ex = await dayEx(p, 'd4');
  check('пятница при красном колене: вместо стартов стена', !ex.some(x => /Старты|Ускорения/.test(x.name)) && ex.some(x => x.name === 'Полуприсед у стены'), ex.map(x => x.name).join(', '));
  await ctx.close();
}

/* 7в. Сплит-присед цикла 1: своим весом 4 недели, дальше гантели и всё меньше повторов */
{
  const { ctx, p } = await at('2026-11-02', { planLog: {
    '1-4-d1-a1': { n: 'Болгарский сплит-присед', d: '2026-10-26', sets: [{ w: '', r: '12' }, { w: '', r: '12' }, { w: '', r: '12' }], rpe: 7, tr: 8, ns: 3, wk: 'deload' } } });
  const r = await p.evaluate(() => {
    const dose = (c, w) => withWeek(c, w, () => buildWeek().find(e => e.id === 'd1').day.ex.find(x => x.id === 'a1').dose);
    const d = buildWeek().find(e => e.id === 'd1').day, ex = d.ex.find(x => x.id === 'a1');
    const pl = planFor(ex, parseDose(ex.dose), logKey('d1', 'a1'));
    return { w2: dose(1, 2), w5: dose(1, 5), w7: dose(1, 7), w10: dose(1, 10), start: pl.w, kind: weightKind(ex, parseDose(ex.dose)).ph };
  });
  check('сплит-присед: 8–12 своим весом → 10–12 → 8–10 → 6–8 с гантелями',
    /8–12 .*свой вес/.test(r.w2) && /10–12 .*вес в руках/.test(r.w5) && /8–10 .*вес в руках/.test(r.w7) && /6–8 .*вес в руках/.test(r.w10), JSON.stringify(r));
  check('5-я неделя: старт 10 кг в каждой руке', r.start === 10 && r.kind === 'гантель', JSON.stringify(r));
  await ctx.close();
}
{
  /* 6-я неделя: 4 × 12 по 14 кг, тяжесть 8 → на 7-й неделе 15 кг */
  const { ctx, p } = await at('2026-11-16', { planLog: {
    '1-6-d1-a1': { n: 'Болгарский сплит-присед', d: '2026-11-09', sets: [{ w: '14', r: '12' }, { w: '14', r: '12' }, { w: '14', r: '12' }, { w: '14', r: '12' }], rpe: 8, tr: 10, ns: 4, wk: 'build' } } });
  const r = await p.evaluate(() => { const d = buildWeek().find(e => e.id === 'd1').day, ex = d.ex.find(x => x.id === 'a1');
    return { w: planFor(ex, parseDose(ex.dose), logKey('d1', 'a1')).w, pos: [state.cycle, state.week] }; });
  check('все по верху диапазона → +1 кг на гантель', r.w === 15 && r.pos.join('/') === '1/7', JSON.stringify(r));
  await ctx.close();
}

/* 7г. Торможение в пятницу — с 5-й недели; тибиальные и стена — в любой разминке */
{
  const { ctx, p } = await at('2026-11-06');
  const r = await p.evaluate(() => ({
    w5: buildWeek().find(x => x.id === 'd4').day.ex.map(x => x.name),
    w2: withWeek(1, 2, () => buildWeek().find(x => x.id === 'd4').day.ex.map(x => x.name)),
    warm: [1, 2, 3, 4].every(w => { const l = warmupFor(w).list.map(x => x.id); return l.includes('wt') && l.includes('wv'); })
  }));
  check('пятница: остановки с 5-й недели, раньше нет', r.w5.includes('Ускорение с остановкой') && !r.w2.includes('Ускорение с остановкой'), JSON.stringify(r));
  check('тибиальные и скольжение по стене во всех разминках', r.warm);
  await ctx.close();
}

/* 7д. Жим лёжа — только цикл 2, 3 × 5; день данков — пятницы лета цикла 3 */
{
  const { ctx, p } = await at('2026-10-06');
  const r = await p.evaluate(() => {
    const names = (c, w, id) => withWeek(c, w, () => (buildWeek().find(x => x.id === id) || { day: { ex: [] } }).day.ex.map(x => x.name + ': ' + x.dose));
    const date = (c, w) => dateOfCW(c, w, 4);
    return { c2: names(2, 3, 'd3'), c1: names(1, 3, 'd3'), c3: names(3, 3, 'd3'),
             apr: names(3, 2, 'd4'), jul: names(3, 12, 'd4'), dates: [date(3, 2), date(3, 12)],
             photo: photoOf('bench', 'Жим штанги лёжа') };
  });
  check('жим лёжа 3 × 5 в цикле 2, в циклах 1 и 3 нет', r.c2.some(x => /^Жим штанги лёжа: 3 × 5/.test(x)) && !r.c1.concat(r.c3).some(x => /лёжа/.test(x)) && !!r.photo, JSON.stringify(r.c2));
  check('пятница летом цикла 3 — данки, весной — первый шаг', r.jul.some(x => /^Данки/.test(x)) && !r.apr.some(x => /^Данки/.test(x)), JSON.stringify({ apr: r.apr, jul: r.jul, d: r.dates }));
  await ctx.close();
}

/* 7е. Лето: июнь — сессия, июль — практика, август — каникулы */
{
  const { ctx, p } = await at('2027-06-02');
  const r = await p.evaluate(() => {
    const at = (c, w) => withWeek(c, w, () => { const W = buildWeek(); const d1 = W.find(x => x.id === 'd1').day, d2 = W.find(x => x.id === 'd2').day, d4 = W.find(x => x.id === 'd4');
      return { mode: summerMode(), d1: d1.ex[1].dose, d2when: d2.when, d4: d4 && d4.day.title, kind: weekKind(c, w), pe: noPE() }; });
    return { jun: at(3, 7), jul: at(3, 12), aug: at(3, 16), oct: at(1, 1), y: summerDates() };
  });
  check('июнь — сессия: на подход меньше, без «после физры»', r.jun.mode === 'exam' && /^3 ×/.test(r.jun.d1) && !/физр/.test(r.jun.d2when) && r.jun.d4 === 'Первый шаг', JSON.stringify(r.jun));
  check('июль — практика: вечером, по пятницам данки', r.jul.mode === 'practice' && /вечер/.test(r.jul.d2when) && r.jul.d4 === 'Данки', JSON.stringify(r.jul));
  check('август — каникулы: днём, блок силы вместо массы', r.aug.mode === 'vacation' && /днём/.test(r.aug.d2when) && r.aug.kind !== 'hyper', JSON.stringify(r.aug));
  check('осенью летнего режима нет', r.oct.mode === null, JSON.stringify(r.oct));
  await ctx.close();
}
{
  const { ctx, p } = await at('2027-07-07', { planSet: { auto: true, start: '2026-10-05', session: 4, kcalAdj: {}, practiceEnd: '2027-07-04' } });
  check('практика закончилась раньше — сразу каникулы', await p.evaluate(() => summerMode() === 'vacation'));
  await ctx.close();
}

/* ---------- Связь плана и приложения ---------- */
/* 9. plan.ics на сайте = календарь, который собирает приложение */
{
  const { ctx, p } = await at('2026-10-06');
  const r = await p.evaluate(async () => {
    const file = await (await fetch('plan.ics', { cache: 'no-store' })).text();
    return { same: file === buildIcs(SETTINGS_DEFAULT.start, SETTINGS_DEFAULT.session) };
  });
  check('plan.ics собран из тех же дат', r.same, 'запусти node tools/make-ics.mjs');
  /* калории в календаре = цели питания приложения */
  const k = await p.evaluate(() => {
    const T = (c, w) => withWeek(c, w, () => nutritionTarget());
    const cut = T(1, 1), ses = T(1, 13), c2 = [1, 2, 3].map(w => T(2, w).k);
    return { cut: `${cut.k} ккал · Б${cut.p} · Ж${cut.f} · У${cut.c}` === ICS_KCAL_DEFAULT.cut,
             ses: ses.k === ICS_KCAL_DEFAULT.session, c2: c2.join() === ICS_KCAL_DEFAULT.c2.join(),
             jump: [1,2,3,4,5,6,7,8,9,10,11,12].filter(w => jumpTestWeek(1, w)).join() === ICS_JUMP_WEEKS.join() };
  });
  check('калории и тесты прыжка в календаре = в приложении', k.cut && k.ses && k.c2 && k.jump, JSON.stringify(k));
  await ctx.close();
}
/* 10. Своя длина сессии: справка и календарь пересчитываются */
{
  const { ctx, p } = await at('2026-10-06', { planSet: { auto: true, start: '2026-10-05', session: 2, kcalAdj: {} } });
  const r = await p.evaluate(() => {
    const ics = buildIcs(settings.start, settings.session);
    const txt = EXTRA.find(e => e[0] === 'Сессия и переход на набор')[1]();
    return { c2: ics.includes('DTSTART;VALUE=DATE:20270111'), txt: /2 нед\., с 28 декабря до 10 января/.test(txt) && /11 января/.test(txt) };
  });
  check('сессия 2 недели → цикл 2 с 11.01 в календаре и справке', r.c2 && r.txt, JSON.stringify(r));
  check('предупреждение про подписку при своих датах', await p.evaluate(() => /своя дата старта/.test(document.getElementById('backupBox').innerText)));
  await ctx.close();
}
/* 11. Шапка недели показывает те же веса, что карточка упражнения */
{
  const { ctx, p } = await at('2027-02-01', { planLog: {
    '2-1-d1-a2': { n: 'Присед со штангой', d: '2027-01-25', sets: [{ w: '70', r: '5' }, { w: '70', r: '5' }, { w: '70', r: '5' }, { w: '70', r: '5' }], rpe: 7, tr: 5, ns: 4, wk: 'build' } } });
  const r = await p.evaluate(() => {
    const d = buildWeek().find(e => e.id === 'd1').day, ex = d.ex.find(x => x.tech === 'squat');
    return { label: weekInfo().label, card: planFor(ex, parseDose(ex.dose), logKey('d1', ex.id)).w, pos: [state.cycle, state.week] };
  });
  /* по таблице на неделе 2 — 65; по журналу (70×5 на тяжести 7) — 70: шапка обязана показать журнал */
  check('шапка = карточка, а не таблица', r.card === 70 && r.label.startsWith('Присед 70 '), JSON.stringify(r));
  await ctx.close();
}
/* 12. Сон: тяжёлая неделя — перед разгрузкой, в цикле 3 это 5-я */
{
  const { ctx, p } = await at('2026-10-06');
  const r = await p.evaluate(() => [[1, 3], [1, 11], [3, 5], [3, 3]].map(([c, w]) => withWeek(c, w, () => /8–8\.5/.test(sleepPlan()))));
  check('сон: +полчаса перед разгрузкой и тестом', r.join() === 'true,true,true,false', r.join());
  await ctx.close();
}
/* 13. Красное колено держится неделю без новых отметок */
{
  const { ctx, p } = await at('2026-11-24', { planBody: { '2026-11-19': { knee: 7 } } });
  const r = await p.evaluate(() => { const s = kneeStatus(); return s && s.lvl; });
  check('красное колено через 5 дней всё ещё красное', r === 'r', String(r));
  await ctx.close();
}
{
  const { ctx, p } = await at('2026-11-27', { planBody: { '2026-11-19': { knee: 7 } } });
  check('через 8 дней — снято', await p.evaluate(() => kneeStatus() === null));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} проверок не прошли` : '\nВсе проверки прошли');
process.exit(fails ? 1 : 0);
