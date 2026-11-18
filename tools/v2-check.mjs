/* Сверка программы v2 в коде с таблицей docs/v2-map.csv, строка за строкой.
   Собирает скрипты js/ в node:vm в порядке из index.html (без интерфейса), для каждой недели 2-7 блока 1
   и одной недели блока 2 строит неделю и сравнивает упражнения, подходы, повторы, отдых, пары, запас, интервалы, сценарий четверга.
   Запуск: node tools/v2-check.mjs   Расхождение - FAIL и код выхода 1. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- сборка кода ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NEED = ['plan.js','plan-v2.js','food-data.js','plan-extra.js','store.js','safe.js','training.js','rules.js','progress.js','load.js','food.js','calendar.js','export.js'];
const order = [...html.matchAll(/<script src="js\/([\w.-]+\.js)"><\/script>/g)].map(m => m[1]).filter(f => NEED.includes(f));
const missing = NEED.filter(f => !order.includes(f));
if (missing.length) { console.log('FAIL скрипты не подключены в index.html: ' + missing.join(', ')); process.exit(1); }
const mem = {};
const ctx = {
  console, TextEncoder, Intl, Date, Math, JSON, Map, Set,
  localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, key: i => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; } },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: { classList: { add() {}, remove() {} }, dataset: {} }, documentElement: { dataset: {} }, createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {} }) },
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
  navigator: {}, queueMicrotask: f => Promise.resolve().then(f), setTimeout: () => 0, clearTimeout() {}, matchMedia: () => ({ matches: false })
};
ctx.window.localStorage = ctx.localStorage;
vm.createContext(ctx);
const code = order.map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n;\n');
vm.runInContext(code + '\n;this.__x={get state(){return state}, set state(v){state=v}, get settings(){return settings}};', ctx);
const run = src => vm.runInContext(src, ctx);

/* ---------- csv ---------- */
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const CSV = parseCsv(fs.readFileSync(path.join(ROOT, 'docs/v2-map.csv'), 'utf8'));
const byNom = Object.fromEntries(CSV.map(r => [+r.nom, r]));

let ok = 0, fail = 0;
const check = (name, good, extra = '') => { if (good) ok++; else fail++; console.log(`${good ? 'OK  ' : 'FAIL'} ${name}${!good && extra ? ' - ' + extra : ''}`); };

/* ---------- помощники ---------- */
const norm = s => String(s || '').replace(/[–—]/g, '-').replace(/[·,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const rng = s => { const m = String(s).replace(/[–—]/g, '-').match(/(\d+)(?:-(\d+))?/); return m ? m[1] + (m[2] ? '-' + m[2] : '') : ''; };
const weekDays = (date, fn) => run(`(function(){ const p=posForDate('${date}'); state.cycle=p.cycle; state.week=p.week; return buildWeek(); })()`);
const weekOf = n => ({ 2: '2026-11-16', 3: '2026-11-23', 4: '2026-11-30', 5: '2026-12-07', 6: '2026-12-14', 7: '2026-12-21' })[n];
ctx.__week = d => weekDays(d);
const day = (wk, id) => { const e = wk.find(x => x.id === id && x.type === 'gym'); return e ? e.day : null; };
const findEx = (d, id) => d && d.ex.find(x => x.id === id);
const setsOf = ex => run(`parseDose(${JSON.stringify(ex.dose)}).sets`);
const expSets = (week, n, id) => week === 7 ? Math.max(1, Math.round(n * 0.6)) : (week === 6 && ['a1', 'c1'].includes(id) ? 4 : n);

/* строки csv блока 1, недели 2-7: nom -> id упражнения в коде */
const MAP = { Пн: { 3: 'a1', 4: 'a4', 5: 'a2', 6: 'a3', 7: 'a6', 8: 'aL', 9: 'a7' }, Сб: { 12: 'c1', 13: 'c3', 14: 'cL', 15: 'c4', 16: 'c5', 17: 'c9', 18: 'cF', 19: 'c6', 20: 'c7' }, Ср: { 21: 'e1', 22: 'e2', 23: 'e3', 24: 'e4', 25: 'e5', 26: 'e7' } };
const DAYID = { Пн: 'd1', Сб: 'd3', Ср: 'd5' };

function checkRow(week, dayName, nom, id, wk, tag) {
  const r = byNom[nom], d = day(wk, DAYID[dayName]), ex = findEx(d, id), t = `нед.${week} ${dayName} nom ${nom} «${r.uprazhnenie}»`;
  if (!ex) return check(`${t}: упражнение ${id} есть`, false, 'нет в дне');
  check(`${t}: название`, ex.name === r.uprazhnenie, `${ex.name}`);
  check(`${t}: подходы`, setsOf(ex) === expSets(week, +r.podhody, id), `${setsOf(ex)} вместо ${expSets(week, +r.podhody, id)}`);
  if (r.povtory) check(`${t}: повторы`, norm(ex.dose).includes(norm(r.povtory)), `«${ex.dose}» не содержит «${r.povtory}»`);
  if (r.otdyh) {
    if (/^в паре/.test(r.otdyh)) check(`${t}: отдых в паре`, /^в паре/.test(ex.rest), ex.rest);
    else check(`${t}: отдых`, rng(ex.rest) === rng(r.otdyh), `${ex.rest} вместо ${r.otdyh}`);
  }
  if (r.para_s) { const mate = findEx(d, ex.pair); check(`${t}: пара`, !!mate && mate.name === r.para_s, `${mate && mate.name} вместо ${r.para_s}`); }
  else check(`${t}: без пары`, !ex.pair);
  if (r.zapas) check(`${t}: запас`, norm(ex.zapas) === norm(r.zapas), `${ex.zapas} вместо ${r.zapas}`);
  /* замена при боли: у упражнения есть замены, если в таблице она есть */
  if (r.zamena_pri_boli && !/^Кисть болит на хвате/.test(r.zamena_pri_boli)) check(`${t}: замена при боли`, !!(ex.alts && ex.alts.length) || !!ex.hint, 'нет alts');
  if (/^Кисть болит на хвате/.test(r.zamena_pri_boli)) check(`${t}: замена кисть`, !!(ex.alts && ex.alts.some(a => a.why === 'wrist')));
}

/* ============ блок 1, недели 2-7 ============ */
const WARM_IDS = ['wr', 'wn', 'wf', 'ww', 'wp'];
for (let week = 2; week <= 7; week++) {
  const wk = weekDays(weekOf(week));
  const T = `нед.${week}`;
  check(`${T}: программа v2 включена`, run('v2Pos(weekTag())') && run('v2Pos(weekTag())').week === week, JSON.stringify(run('v2Pos(weekTag())')));
  check(`${T}: плановой разгрузки нет`, run('weekKind(state.cycle,state.week)') !== 'deload');
  /* неделя по B.5 */
  const dows = Object.fromEntries(wk.filter(e => e.type !== 'rest').map(e => [e.id, e.dow]));
  check(`${T}: Пн А, Вт интервалы, Ср верх, Чт площадка, Пт физра, Сб Б, Вс велосипед`, dows.d1 === 1 && dows['c-tue'] === 2 && dows.d5 === 3 && dows.d2 === 4 && dows.d4 === 5 && dows.d3 === 6 && dows['c-sun'] === 0, JSON.stringify(dows));
  /* разминка (nom 1, 10) */
  for (const [dayId, nom] of [['d1', 1], ['d3', 10]]) {
    const d = day(wk, dayId), W = d.warmup, want = byNom[1].uprazhnenie;
    check(`${T}: nom ${nom} разминка 10 минут`, W && W.dur === '10 мин' && WARM_IDS.every((x, i) => W.list[i] && W.list[i].id === x), W && W.list.map(x => x.id).join());
    check(`${T}: nom ${nom} дозы разминки`, W && /3 мин/.test(W.list[0].dose) && /2 × 30/.test(W.list[1].dose) && /10 раз/.test(W.list[2].dose) && /2 × 30/.test(W.list[3].dose) && /2 × 10/.test(W.list[4].dose), W && W.list.map(x => x.dose).join(' | '));
  }
  /* nom 2: прыжки в метку 3 × 3, старты 4 × 3-5 м, отдых 60-90 */
  { const d = day(wk, 'd1'), j = findEx(d, 'aJ'), s = findEx(d, 'aS');
    check(`${T}: nom 2 прыжки в метку 3 × 3`, j && /^3 × 3/.test(j.dose) && rng(j.rest) === '60-90', j && `${j.dose} / ${j.rest}`);
    check(`${T}: nom 2 старты 4 × 3-5 м`, s && /^4 × 3–5 м/.test(s.dose) && rng(s.rest) === '60-90', s && `${s.dose} / ${s.rest}`);
    check(`${T}: nom 2 замена при колене`, j && j.alts.some(a => a.why === 'knee' && /3 × 5/.test(a.dose))); }
  for (const dn of ['Пн', 'Сб', 'Ср']) for (const [nom, id] of Object.entries(MAP[dn])) checkRow(week, dn, +nom, id, wk);
  /* nom 11, 124: субботний блок 0а */
  { const d = day(wk, 'd3'), g = x => findEx(d, x);
    check(`${T}: nom 11 прыжки в метку 3 × 3 в блоке 0а`, g('kJ') && /^3 × 3/.test(g('kJ').dose) && rng(g('kJ').rest) === '60-90');
    check(`${T}: nom 11 старты 4 × 3-5 м`, g('kS') && /^4 × 3–5 м/.test(g('kS').dose));
    check(`${T}: nom 11 торможения 4`, g('kT') && /^4 /.test(g('kT').dose));
    check(`${T}: nom 124 боковые и скрестные старты 4 × 5 м`, g('bL') && /^4 × 5 м/.test(g('bL').dose) && /2 вправо, 2 влево/.test(g('bL').dose));
    const ids = d.ex.map(x => x.id), at = x => ids.indexOf(x);
    check(`${T}: nom 11 блок 0а стоит после теста и до силовой`, at('kJ') >= 0 && at('kJ') < at('c1') && at('bL') < at('c1'), ids.join()); }
  /* тест прыжка: недели 1, 4, 7 в субботу */
  { const d = day(wk, 'd3'), c0 = findEx(d, 'c0'), want = [4, 7].includes(week);
    check(`${T}: nom 10/55/67/79 тест прыжка ${want ? 'есть' : 'нет'} в субботу`, want ? (c0 && c0.step === 'test' && c0.test.t === 'jump') : !c0); }
  /* вторник: интервалы (nom 35-40) */
  { const d = day(wk, 'c-tue'), iv = findEx(d, 'iv');
    const row = byNom[33 + week]; /* nom 35 = неделя 2 */
    const m = x => +String(x).match(/\d+/)[0] * 60;
    check(`${T}: nom ${row.nom} интервалы: подходов ${row.podhody}`, iv && iv.iv.n === +row.podhody, iv && iv.iv.n);
    check(`${T}: nom ${row.nom} работа ${row.povtory}`, iv && iv.iv.work === m(row.povtory), iv && iv.iv.work);
    check(`${T}: nom ${row.nom} отдых ${row.otdyh || '3 мин (из недели 3)'}`, iv && iv.iv.easy === (row.otdyh ? m(row.otdyh) : 180), iv && iv.iv.easy);
    const hr = (row.primechanie.split('; v1')[0].match(/(\d{3}[-–]\d{3})/) || [])[1];
    check(`${T}: nom ${row.nom} целевой пульс`, hr ? iv && norm(iv.iv.hr) === norm(hr) : iv && !iv.iv.hr, iv && iv.iv.hr);
    check(`${T}: nom 41 после интервалов мяч 10 минут`, d.ex.some(x => x.id === 'ball' && /10 минут/.test(x.dose))); }
  /* четверг: сценарий (nom 42-52) */
  { const d = day(wk, 'd2'), scn = findEx(d, 'scn'), B = scn && scn.blocks, test = [2, 7].includes(week);
    check(`${T}: nom 42-45 сценарий четверга, блоки по минутам`, B && B[0].from === 0 && B[0].to === 5 && B[1].from === 5 && B[1].to === 30 && B[2].from === 30 && B[2].to === 36, B && B.map(b => b.from + '-' + b.to).join());
    check(`${T}: nom 42 «${byNom[42].uprazhnenie}»`, B && B[0].name === byNom[42].uprazhnenie);
    check(`${T}: nom 43 бросок: батарея`, B && /^Бросок: /.test(B[1].name) && /батаре/.test(B[1].name));
    check(`${T}: nom 44 «${byNom[44].uprazhnenie}»`, B && B[2].name === byNom[44].uprazhnenie);
    const sS = B && B.find(b => b.id === 'sS'), yy = findEx(d, 'sY');
    if (test) { check(`${T}: nom ${week === 2 ? 47 : 52} Yo-Yo вместо рывков`, !sS && yy && yy.step === 'test' && yy.test.t === 'yoyo'); }
    else {
      const rw = byNom[{ 3: 48, 4: 49, 5: 50, 6: 51 }[week]];
      check(`${T}: nom 45 повторные рывки, 2 серии`, sS && sS.name === byNom[45].uprazhnenie);
      check(`${T}: nom ${rw.nom} рывки: 2 серии по ${rw.povtory}`, sS && norm(sS.dose).includes(norm(rw.povtory.replace(/^(\d)/, '2 серии по $1'))) || (sS && norm(sS.dose).startsWith('2 серии по ' + norm(rw.povtory))), sS && `${sS.dose} / ${rw.povtory}`);
      check(`${T}: nom ${rw.nom} отдых ${rw.otdyh || '30 с'}, между сериями 3 мин`, sS && /30 сек/.test(sS.rest) && /между сериями 3 мин/.test(sS.rest), sS && sS.rest);
      check(`${T}: рывков нет вместе с Yo-Yo`, !yy);
    }
    check(`${T}: бросковая батарея в четверг`, findEx(d, 'sB') && findEx(d, 'sB').test.t === 'battery');
    check(`${T}: nom ${53 + (week - 1) * 4} Бросок за неделю ${byNom[53 + (week - 1) * 4].primechanie}`, B[1].note.includes(byNom[53 + (week - 1) * 4].primechanie), B[1].note);
    check(`${T}: nom ${54 + (week - 1) * 4} прыжков в полную силу ${byNom[54 + (week - 1) * 4].primechanie}`, d.note.includes(byNom[54 + (week - 1) * 4].primechanie), d.note); }
  /* пятница (nom 113) */
  { const d = day(wk, 'd4'); check(`${T}: nom 113 физра: игра, броски`, d && d.title === 'Физра: игра, броски' && /90 мин/.test(d.ex[0].dose)); }
  /* неделя: правила 6.2 */
  { const d = day(wk, 'd1'); check(`${T}: nom ${26 + week} «${byNom[26 + week].uprazhnenie.replace(/^Силовые: /, '')}» в заметке дня`, d.note.includes(byNom[26 + week].uprazhnenie.replace(/^Силовые: /, ''))); }
  /* убрано: упражнений v1 нет в днях v2 */
  const allIds = wk.filter(e => e.type === 'gym').flatMap(e => e.day.ex.flatMap(x => x.blocks ? x.blocks.map(b => b.id) : [x.id]));
  check(`${T}: убранные упражнения не показаны (aT, e6, bA, bP, b2, b3, b4, cN, c8)`, ['aT', 'e6', 'bA', 'bP', 'b2', 'b3', 'b4', 'cN', 'c8'].every(x => !allIds.includes(x)), allIds.join());
  check(`${T}: nom 121 разминки верха нет`, day(wk, 'd5').noWarm === true);
  check(`${T}: nom 131 отдельной зарядки для колен нет`, run('dailyOn()') === false);
  /* калории по типу дня (nom 81-83) */
  const kc = i => run(`nutritionTarget(${i})`);
  check(`${T}: nom 81 четверг 2850`, kc(3).k === 2850, kc(3).k);
  check(`${T}: nom 82 тренировочный день 2600`, kc(0).k === 2600 && kc(1).k === 2600 && kc(5).k === 2600, [kc(0).k, kc(1).k, kc(5).k].join());
  check(`${T}: nom 83 день без тренировки 2400 (воскресенье без велосипеда)`, kc(6).k === 2400, kc(6).k);
  check(`${T}: nom 84-86 белок 165, жир 70-80, углеводы остальное`, [0, 3, 6].every(i => kc(i).p === 165 && kc(i).f >= 70 && kc(i).f <= 80 && Math.abs(kc(i).p * 4 + kc(i).f * 9 + kc(i).c * 4 - kc(i).k) <= 4));
}

/* ============ блок 2, одна неделя (nom 88-96) ============ */
{
  const wk = weekDays('2027-01-11'), T = 'блок 2';
  const P = run('v2Pos(weekTag())');
  check(`${T}: программа v2, блок 2`, P && P.block === 2, JSON.stringify(P));
  check(`${T}: сессия, без плановой разгрузки`, run('weekKind(state.cycle,state.week)') === 'session');
  const A = day(wk, 'd1'), B = day(wk, 'd3');
  const cnt = d => d.ex.filter(x => /подход|×/.test(x.dose) && !x.step && !['Мяч', 'Скорость', 'Кардио', 'Тест'].includes(x.badge[0]));
  check(`${T}: nom 88 силовые А и Б, 2 раза в неделю`, A && B && !day(wk, 'd5'));
  check(`${T}: nom 88 по 2 подхода вместо 3, вес не снижать`, cnt(A).concat(cnt(B)).every(x => setsOf(x) <= 2) && cnt(A).concat(cnt(B)).some(x => setsOf(x) === 2));
  const iv = findEx(day(wk, 'c-tue'), 'iv');
  check(`${T}: nom 89 интервалы 4 × 4 минуты, раз в неделю`, iv && iv.iv.n === 4 && iv.iv.work === 240 && wk.filter(e => e.id === 'c-tue').length === 1);
  check(`${T}: nom 90 велосипед спокойно, 1 раз, по желанию`, wk.filter(e => e.id === 'c-sun').length === 1 && /по желанию/.test(wk.find(e => e.id === 'c-sun').note));
  const balls = wk.filter(e => e.type === 'gym' && e.day.ex.some(x => x.id === 'ball')).length + wk.filter(e => e.type === 'run').length;
  check(`${T}: nom 91 мяч 10 минут, 5 раз в неделю`, balls === 5, balls);
  const th = day(wk, 'd2');
  check(`${T}: nom 93 прыжки 15 в неделю в полную силу`, th && th.ex.some(x => /^15 прыжков/.test(x.dose) && /в полную силу/.test(x.dose)));
  check(`${T}: nom 94 кольца нет, четверга с площадкой нет`, th && !th.ex.some(x => x.step === 'scn') && !day(wk, 'd4'));
  const k = run('nutritionTarget(3)').k;
  check(`${T}: nom 95 калории: поддержание 2850`, k === 2850 && run('nutritionTarget(0)').k === 2850, k);
}
/* блок 3 от даты операции */
{
  run("settings.opDay='2027-02-10'");
  const wk = weekDays('2027-02-08'), P = run('v2Pos(weekTag())');
  check('блок 3: от planSet.opDay (неделя операции)', P && P.block === 3 && wk.some(e => e.type === 'gym'), JSON.stringify(P));
  check('блок 3: подсказка фазы на дне (nom 98)', day(wk, 'd1').alert && /О - О\+2/.test(day(wk, 'd1').alert.html));
  run('delete settings.opDay');
}
/* до 16.11 - v1 как раньше */
{
  const wk = weekDays('2026-11-09');
  check('до 16.11: неделя 1 собирается по v1 (Силовая А, подъезд, a1 из v1, зарядка для колен)', run('v2Pos(weekTag())') === null && day(wk, 'd1').ex.some(x => x.id === 'aT') && run('dailyOn()') === true);
  const wk2 = weekDays('2026-11-02');
  check('до 16.11: неделя 0 тоже v1', run('v2Pos(weekTag())') === null && day(wk2, 'd2').ex.some(x => x.id === 'b4'));
}

console.log(`\nИтог: OK ${ok}, FAIL ${fail}`);
process.exit(fail ? 1 : 0);
