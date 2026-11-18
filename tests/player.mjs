/* Плеер тренировки (E3.1): критерии приёмки 1-10 из docs/SPORT_APP.md, раздел 4.2, плюс поведение из раздела 3.
   Запуск: PW=.../playwright/index.mjs node tests/player.mjs   (BR=webkit - движок Safari)
   SHOTS=папка - заодно сохранить скриншоты 390 × 844 в обеих темах.
   Тапы считаются функцией tap(): каждая строка «тап» - одно нажатие пальцем. Ввод цифр тапом не считается. */
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

let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' - ' + extra : ''}`); if (!ok) fails++; };
const browser = await engine.launch();

/* Журнал прошлой недели: подставляются веса и повторы, есть «в прошлый раз» */
const lg = (n, d, w, r, rpe, k = 3) => ({ n, d, sets: Array.from({ length: k }, () => ({ w: String(w), r: String(r), t: '18:30' })), rpe, tr: r, th: r + 2, ns: k, wk: 'build' });
const SEED = {
  planOnboarded: true, planHintOff: true,
  planLog: {
    '2026-10-12-d1-a1': lg('Болгарский сплит-присед', '2026-10-12', '', 11, 8, 4), '2026-10-12-d1-a4': lg('Румынская тяга в разноножке', '2026-10-12', '4', 10, 8, 3),
    '2026-10-12-d1-a2': lg('Подтягивания', '2026-10-12', '', 8, 9, 4), '2026-10-12-d1-a3': lg('Отжимания с паузой', '2026-10-12', '', 12, 8, 3),
    '2026-10-12-d1-a6': lg('Подъём на носки на одной ноге', '2026-10-12', '', 12, 8, 3), '2026-10-12-d1-aL': lg('Махи гантелями в стороны', '2026-10-12', '4', 14, 8, 2),
    '2026-10-12-d1-a7': lg('Dead bug', '2026-10-12', '', 16, 8, 3) }
};
const DEVICE = { ...devices['iPhone 13 Pro'], viewport: { width: 390, height: 844 } };   /* iPhone 13 Pro, экран без панелей Safari: 390 × 844 */
async function at(time, data = SEED, o = {}) {
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce', serviceWorkers: 'block', colorScheme: o.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.errs = []; p.taps = 0; p.ctx = ctx;
  p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.addInitScript(() => { try { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {}; } catch (e) {} window.AudioContext = window.webkitAudioContext = undefined; });   /* тест не должен ни говорить, ни пищать вслух */
  await p.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear(); localStorage.setItem('planSchema', '5');
    for (const k in d) localStorage.setItem(k, JSON.stringify(d[k]));
  }, data);
  await p.goto(URL0, { waitUntil: 'load' });
  await p.waitForTimeout(250);
  return p;
}
const E = (p, f, a) => p.evaluate(f, a);
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
/* тап: считается, после него проходит 700 мс (окно защиты от двойного «Готово» - 600 мс) */
async function tap(p, sel) { p.taps++; await p.click(sel); await p.clock.runFor(700); }
const cur = p => E(p, () => { const e = plEntry(), c = e && plCur(e); return c ? { sig: plSig(c), k: c.k, t: c.t, id: c.id, si: c.si ?? null } : null; });
/* текущий шаг ленты проходится так, как его проходил бы человек: одним нажатием по главной кнопке */
async function stepOnce(p) {
  const c = await cur(p); if (!c) return false;
  if (c.k === 'warm') await tap(p, '#player [data-a=warmdone]');
  else if (c.t === 'ready') await tap(p, '#player [data-a=ready][data-v="1"]');
  else if (c.k === 'ex') await tap(p, '#player [data-a=count]');
  else if (c.t === 'hold') { await tap(p, '#player [data-a=hstart]'); await p.clock.runFor(61000); }
  else await tap(p, '#player [data-a=done]');
  return true;
}
const close = async p => { check('ошибок страницы нет', p.errs.length === 0, p.errs.join(' | ')); await p.ctx.close(); };
const MON = '2026-10-19T17:00:00';

/* ===== 1. Вход: не больше 2 тапов до первого шага, в любое время суток и при пустом замере ===== */
/* E3.2: «Начать» стоит главным пунктом «Сейчас» в любое время суток, замер ничего не блокирует: 1 тап */
for (const [lab, time] of [['утром 06:30, замер пуст', '2026-10-19T06:30:00'], ['днём 13:00', '2026-10-19T13:00:00'], ['вечером 17:00', MON], ['ночью 23:50', '2026-10-19T23:50:00']]) {
  const p = await at(time, { planOnboarded: true, planHintOff: true });
  await tap(p, '#scr-now [data-start]');
  check(`1. вход ${lab}: плеер открыт за ${p.taps} тап(а)`, p.taps <= 2 && await vis(p, '#player .panel'));
  await close(p);
}

/* ===== 2, 4, 5, 6. Подход: 1 тап, отдых без тапов, правка веса, экран без прокрутки ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  check('тренировка началась: время записано, тостов нет', await E(p, () => watch['2026-10-19-d1'].s === '17:00' && !document.querySelector('#toast').classList.contains('show')));
  /* разминка, готовность, старты, торможение, болгарский - до рабочего подхода с весом (румынская) */
  while ((await cur(p)).id !== 'a4') await stepOnce(p);
  p.taps = 0;
  const v0 = await E(p, () => { const c = plCur(plEntry()); return plValues(c); });
  check('на первом подходе подставлены вес и повторы по плану и прошлому разу', v0.w > 0 && v0.r >= 1, JSON.stringify({ w: v0.w, r: v0.r, last: v0.lastTop }));
  /* экран подхода: размеры, элементы */
  const L1 = await E(p, () => {
    const q = s => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null);
    const hist = e => e.closest('.pastl, .xcard');
    const ctrl = q('#player button, #player [role=button], #player input').filter(e => !hist(e));
    const done = document.querySelector('#player [data-a=done]').getBoundingClientRect();
    const panel = document.querySelector('#player .panel').getBoundingClientRect();
    const hdr = document.querySelector('#player .pnav').getBoundingClientRect();
    const feed = document.querySelector('#player .feed');
    const head = document.querySelector('#player .exh').getBoundingClientRect();
    const imgs = q('#player img').length + [...document.querySelectorAll('#player *')].filter(e => /url\(/.test(getComputedStyle(e).backgroundImage)).length;
    return { n: ctrl.length, doneY: done.top, doneB: done.bottom, panelB: panel.bottom, vh: innerHeight, hdrB: hdr.bottom, headT: head.top, headB: head.bottom, panelT: panel.top,
      pageScroll: document.querySelector('#player').scrollHeight - document.querySelector('#player').clientHeight, imgs, notes: q('#player .note, #player .tempo, #player .tempo-start').length, doseLines: q('#player .dose').length,
      feedOver: feed.scrollHeight > feed.clientHeight + 1 };
  });
  check(`5. рабочий экран: постоянных элементов управления ${L1.n} (не больше 10)`, L1.n <= 10, JSON.stringify(L1));
  check('5. прокрутка не нужна: страница не прокручивается, панель и «Готово» в экране', L1.pageScroll <= 0 && L1.panelB <= L1.vh + 1 && L1.doneB <= L1.vh);
  check('5. «Готово» в нижней трети экрана', L1.doneY > L1.vh * 2 / 3);
  check('5. заголовок упражнения не залезает ни под шапку, ни под панель', L1.headT >= L1.hdrB - 1 && L1.headB <= L1.panelT + 1);
  check('5. фото и таймера темпа на экране нет, пояснение одно (доза)', L1.imgs === 0 && L1.notes === 0 && L1.doseLines === 1);
  /* 2. один тап */
  const t0 = p.taps;
  await tap(p, '#player [data-a=done]');
  const L = await E(p, () => logs['2026-10-19-d1-a4']);
  check(`2. подход с готовыми значениями: ${p.taps - t0} тап`, p.taps - t0 === 1 && L && L.sets[0].r !== '' && /^\d\d:\d\d$/.test(L.sets[0].t) && L.d === '2026-10-19' && L.wk === 'build', JSON.stringify(L && L.sets[0]));
  check('2. отдых запустился сам, ни одной кнопки пропуска и «+30»', await vis(p, '#player [data-rest]') && !(await vis(p, '#player [data-a=rskip], #player [data-plus]')));
  /* 6. во время отдыха меняются значения следующего подхода */
  const w1 = await E(p, () => plValues(plCur(plEntry())).w);
  await p.click('#player [data-st=w][data-d="1"]');
  const w2 = await E(p, () => plValues(plCur(plEntry())).w);
  check('6. вес следующего подхода меняется во время отдыха, отдых идёт', w2 > w1 && await vis(p, '#player [data-rest]') && /вес изменён/.test(await E(p, () => document.querySelector('#player .plbl').innerText)), `${w1} -> ${w2}`);
  /* 4. один шаг = один тап (шаг гантели) и свой вес за 4 тапа */
  const step = Math.round((w2 - w1) * 10) / 10;
  check('4. изменить вес на один шаг: 1 тап (шаг снаряда ' + step + ' кг)', step > 0);
  p.taps = 0;
  await tap(p, '#player [data-a=num][data-f=w]');
  await p.fill('.sheet [data-in]', '9,5');
  await tap(p, '.sheet [data-ok]');
  await tap(p, '#player [data-a=done]');
  const L2 = await E(p, () => logs['2026-10-19-d1-a4']);
  check(`4. произвольный вес 9,5: ${p.taps} тапа (не больше 4), записан`, p.taps <= 4 && L2.sets[1].w === '9,5', JSON.stringify(L2.sets[1]));
  check('3.3 правка веса действует и на следующие подходы', await E(p, () => plValues(plCur(plEntry())).w === 9.5));
  /* двойной «Готово» за 600 мс */
  await p.click('#player [data-a=done]'); await p.click('#player [data-a=done]');
  const n3 = await E(p, () => logs['2026-10-19-d1-a4'].sets.filter(x => x.r !== '').length);
  check('двойной тап «Готово» за 600 мс пишет один подход', n3 === 3, 'записано подходов: ' + n3);
  await close(p);
}

/* ===== 3. Силовая А целиком без правок: число тапов ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  p.taps = 0;
  while (await stepOnce(p));
  const full = p.taps;
  const W = await E(p, () => watch['2026-10-19-d1']);
  check(`3. полная Силовая А (все 26 шагов v1): ${full} тап(ов) в плеере`, full <= 26, 'после «Начать»');
  check('10. тренировка закрылась сама на последнем шаге: время конца записано, кнопки «Закончить» нет', !!W.e && /^\d\d:\d\d$/.test(W.e) && !W.ac && await vis(p, '#player .sumv') && !(await vis(p, '#player [data-a=fin], #player [data-finish]')), JSON.stringify(W));
  check('10. итог: время, подходы и одна необязательная шкала 1-10', await E(p, () => document.querySelectorAll('#player .sumv .sc button').length === 10 && /подход/.test(document.querySelector('#player .sumv').innerText)));
  await tap(p, '#player .sumv [data-a=srpe][data-v="7"]');
  check('шкала тяжести пишется в нагрузку недели', await E(p, () => gymLoadOf('2026-10-19', 'd1').rpe === 7));
  await close(p);
}
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  p.taps = 0;
  await tap(p, '#player [data-a=menu]'); await tap(p, '.sheet [data-a=short]');
  const n0 = await E(p, () => plBuild(plEntry()).length);
  while (await stepOnce(p));
  const short = p.taps;
  check(`3. Силовая А с короткой версией (без изоляции и кора): ${short} тап(ов) (не больше 25)`, short <= 25 && n0 < 26, `шагов в короткой ${n0}`);
  check('короткая версия: главные упражнения на ноги остались', await E(p, () => plOrdered(plEntry()).filter(x => x.badge[0] === 'Ноги').length >= 2));
  await close(p);
}

/* ===== 7, 8. Отдых и перезагрузка ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  while ((await cur(p)).id !== 'a4') await stepOnce(p);
  await tap(p, '#player [data-a=done]');
  await p.clock.runFor(30000);
  const t1 = await E(p, () => { const r = plRest(); return r && r.left; });
  check('7. отдых 90 с: через 30 с осталось 60 (допуск 1 с)', t1 !== null && Math.abs(t1 - 60) <= 1, 'left=' + t1);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  const t2 = await E(p, () => { const r = plRest(); return r && r.left; });
  check('7. после перезагрузки таймер отдыха верный (допуск 1 с)', t2 !== null && Math.abs(t2 - 60) <= 2, 'left=' + t2);
  check('7. мини-плашка над вкладками: название, упражнение, подход, время отдыха', await E(p, () => { const m = document.querySelector('#mini'); return !m.hidden && /Силовая А · Румынская тяга в разноножке 2 из 3|Силовая А · Румынская 2 из 3/.test(m.innerText) && /\d:\d\d/.test(m.querySelector('.mt').innerText); }), await E(p, () => document.querySelector('#mini').innerText.replace(/\n/g, ' | ')));
  await p.click('#mini'); await p.waitForTimeout(100);
  const t3 = await E(p, () => document.querySelector('#player [data-rt]').textContent);
  check('7. в открытом плеере полоса отдыха показывает то же время', /^[01]:\d\d$/.test(t3), t3);
  /* блокировка телефона: время ушло вперёд, таймеры страницы не работали */
  await p.clock.fastForward(60000); await p.clock.runFor(600);
  const R = await E(p, () => plRest());
  check('7. после «блокировки» на минуту отдых закончился и считает вверх', R && R.over && /^\+/.test(await E(p, () => document.querySelector('#player [data-rt]').textContent)), JSON.stringify(R));
  check('7. по нулю полоса серая, ничего само не переключилось', await vis(p, '#player .rest.over') && (await cur(p)).id === 'a4' && (await cur(p)).si === 1);
  await close(p);
}
{
  /* 8. перезагрузка на любом шаге: тот же шаг, те же значения */
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  let bad = [], n = 0;
  for (let guard = 0; guard < 40; guard++) {
    const before = await E(p, () => { const c = plCur(plEntry()); return c ? { sig: plSig(c), ed: JSON.stringify(live().ed), vals: c.k === 'set' ? (({ w, r }) => ({ w, r }))(plValues(c)) : null } : null; });
    if (!before) break;
    /* правка значений: на половине подходов меняем повторы, чтобы проверить, что правка переживает перезагрузку */
    if (before.vals && guard % 3 === 1) { await p.click('#player [data-st=r][data-d="1"]'); await p.waitForTimeout(30); }
    const b2 = await E(p, () => { const c = plCur(plEntry()); return { sig: plSig(c), ed: JSON.stringify(live().ed), vals: c.k === 'set' ? (({ w, r }) => ({ w, r }))(plValues(c)) : null }; });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(150);
    await p.click('#mini'); await p.waitForTimeout(50);
    const after = await E(p, () => { const c = plCur(plEntry()); return c ? { sig: plSig(c), ed: JSON.stringify(live().ed), vals: c.k === 'set' ? (({ w, r }) => ({ w, r }))(plValues(c)) : null } : null; });
    n++;
    if (!after || after.sig !== b2.sig || after.ed !== b2.ed || JSON.stringify(after.vals) !== JSON.stringify(b2.vals)) bad.push(JSON.stringify([b2, after]).slice(0, 200));
    if (!(await stepOnce(p))) break;
  }
  check(`8. перезагрузка на каждом из ${n} шагов Силовой А: тот же шаг и те же значения`, bad.length === 0 && n >= 25, bad.join(' || '));
  await close(p);
}

/* ===== 9. Ввод: повторы 0, опечатка, запятая и точка, буквы, минус ===== */
{
  const p = await at(MON, { ...SEED, planLog: { ...SEED.planLog, '2026-10-12-d1-a4': lg('Румынская тяга в разноножке', '2026-10-12', '12.5', 10, 8, 3) } });
  await tap(p, '#scr-now [data-start]');
  while ((await cur(p)).id !== 'a4') await stepOnce(p);
  /* повторы */
  await p.click('#player [data-a=num][data-f=r]');
  const typeOpt = async (txt) => { await p.fill('.sheet [data-in]', txt); await p.click('.sheet [data-ok]'); await p.waitForTimeout(60); };
  await typeOpt('0');
  check('9. повторы 0 не принимаются: лист остался, красная линия, «повторы от 1 до 200»', await vis(p, '.sheet [data-in].err') && /повторы от 1 до 200/.test(await E(p, () => document.querySelector('.sheet [data-err]').textContent)));
  check('9. ошибка ввода без тоста', !(await E(p, () => document.querySelector('#toast').classList.contains('show'))));
  for (const bad of ['', 'abc', '-3', '1e3', '201', '8,5']) { await typeOpt(bad); if (!(await vis(p, '.sheet [data-in].err'))) { check('9. значение «' + bad + '» должно отклоняться', false); } }
  check('9. пусто, буквы, минус, 1e3, 201 и дробные повторы отклонены', await vis(p, '.sheet [data-in]'));
  await typeOpt('7');
  check('9. повторы 7 приняты', await E(p, () => plValues(plCur(plEntry())).r === 7));
  const rMin = await E(p, () => { for (let i = 0; i < 20; i++) plAdj('r', -1); return plValues(plCur(plEntry())).r; });
  check('9. кнопка «−» не опускает повторы ниже 1', rMin === 1, 'r=' + rMin);
  await E(p, () => { plSetEdit(plCur(plEntry()).ex, 'r', 7); plPatchPanel(); });
  /* вес: запятая и точка равноправны */
  await p.click('#player [data-a=num][data-f=w]'); await typeOpt('13,5');
  const wa = await E(p, () => plValues(plCur(plEntry())).w);
  await p.click('#player [data-a=num][data-f=w]'); await typeOpt('14.5');
  const wb = await E(p, () => plValues(plCur(plEntry())).w);
  check('9. вес «13,5» и «14.5» оба принимаются', wa === 13.5 && wb === 14.5, `${wa}, ${wb}`);
  await p.click('#player [data-a=num][data-f=w]'); await typeOpt('401');
  check('9. вес 401 отклонён: «вес от 0 до 400»', /вес от 0 до 400/.test(await E(p, () => document.querySelector('.sheet [data-err]').textContent)));
  await typeOpt('0');
  check('9. вес 0 разрешён', await E(p, () => plValues(plCur(plEntry())).w === 0) && !(await vis(p, '.sheet')));
  /* опечатка: 125 после 12,5 */
  const before = await E(p, () => JSON.stringify(logs['2026-10-19-d1-a4'] || null));
  await p.click('#player [data-a=num][data-f=w]'); await typeOpt('125');
  check('9. 125 после 12,5: в панели вопрос «125 кг вместо 12,5?» и две кнопки', /125 кг вместо 12,5\?/.test(await E(p, () => document.querySelector('#player .ask').innerText)) && await E(p, () => document.querySelectorAll('#player .ask ~ .two button').length === 2));
  check('9. до ответа ничего не пишется и «Готово» нет', await E(p, b => JSON.stringify(logs['2026-10-19-d1-a4'] || null) === b, before) && !(await vis(p, '#player [data-a=done]')));
  await p.click('#player [data-a=ask][data-v=fix]'); await p.waitForTimeout(50);
  check('9. «12,5 кг» - вес исправлен, панель обычная', await E(p, () => plValues(plCur(plEntry())).w === 12.5) && await vis(p, '#player [data-a=done]'));
  await p.click('#player [data-a=num][data-f=w]'); await typeOpt('125');
  await p.click('#player [data-a=ask][data-v=keep]'); await p.waitForTimeout(50);
  check('9. «125 кг» - оставлено как набрано', await E(p, () => plValues(plCur(plEntry())).w === 125));
  await close(p);
}

/* ===== 10. Автозакрытие через 30 минут без записей ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  await stepOnce(p);   /* разминка */
  await p.clock.runFor(10 * 60000);
  await stepOnce(p);   /* прыжки: запись в 17:10 */
  check('10. сессия идёт, плашка висит', await E(p, () => sessionState('d1') === 'run'));
  await p.click('#player [data-a=min]');
  await p.clock.runFor(29 * 60000);
  check('10. через 29 минут без записей сессия ещё идёт', await E(p, () => sessionState('d1') === 'run' && !document.querySelector('#mini').hidden));
  await p.clock.runFor(2 * 60000);
  const W = await E(p, () => watch['2026-10-19-d1']);
  check('10. через 31 минуту тренировка закрыта, концом стало время последней записи (17:10)', W.e === '17:10' && W.ac === 1 && await E(p, () => document.querySelector('#mini').hidden), JSON.stringify(W));
  /* вернулся: запись снова открывает сессию */
  await p.click('#scr-now [data-play], #scr-now .hero [data-start]').catch(() => {});
  await E(p, () => openPlayer('d1'));
  check('вернулся в закрытую тренировку: итог с кнопкой «Продолжить»', await vis(p, '#player [data-a=resume]'));
  await tap(p, '#player [data-a=resume]');
  await stepOnce(p);
  const W2 = await E(p, () => watch['2026-10-19-d1']);
  check('следующая запись снова открыла сессию: конец и признак снят', !W2.e && !W2.ac && await E(p, () => sessionState('d1') === 'run'), JSON.stringify(W2));
  await close(p);
}

/* ===== Поведение подхода: отмена, правка, удаление, запас, пропуск, позже, пара ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  while ((await cur(p)).id !== 'a4') await stepOnce(p);
  await tap(p, '#player [data-a=done]');
  check('«Отменить» у новой строки 5 секунд', await vis(p, '#player .xrow .un'));
  await tap(p, '#player .xrow .un');
  check('«Отменить» убрала подход, вернула прежний отдых (после болгарского, 2 мин) и шаг', await E(p, () => !logs['2026-10-19-d1-a4'] || logs['2026-10-19-d1-a4'].sets.every(s => s.r === '')) && await E(p, () => { const r = plRest(); return r && r.total === 120; }) && (await cur(p)).si === 0);
  await tap(p, '#player [data-a=done]');
  await p.clock.runFor(5200);
  check('через 5 секунд «Отменить» пропадает, остаётся время', !(await vis(p, '#player .xrow .un')) && /^\d\d:\d\d$/.test(await E(p, () => document.querySelector('#player .xrow[data-a=row] time').textContent)));
  /* правка тапом по строке */
  await tap(p, '#player .xrow[data-a=row]');
  check('тап по строке: лист правки с весом, повторами и «Удалить подход»', await vis(p, '.sheet [data-i=w]') && await vis(p, '.sheet [data-i=r]') && await vis(p, '.sheet [data-del]'));
  await p.fill('.sheet [data-i=r]', '0'); await p.click('.sheet [data-save]');
  check('в листе правки повторы 0 не сохраняются', await vis(p, '.sheet [data-i=r].err'));
  await p.fill('.sheet [data-i=r]', '9'); await p.click('.sheet [data-save]'); await p.waitForTimeout(80);
  check('правка записанного подхода: повторы 9, время сохранилось', await E(p, () => { const s = logs['2026-10-19-d1-a4'].sets[0]; return s.r === '9' && /^\d\d:\d\d$/.test(s.t); }));
  /* удаление свайпом влево */
  await tap(p, '#player [data-a=done]');
  await p.clock.runFor(5200);
  await E(p, () => {
    const row = document.querySelectorAll('#player .xrow[data-a=row]')[1], r = row.getBoundingClientRect();
    const mk = (type, x) => { const ev = new Event(type, { bubbles: true, cancelable: true }); const t = [{ clientX: x, clientY: r.top + 20, target: row }]; ev.touches = type === 'touchend' ? [] : t; ev.changedTouches = t; row.dispatchEvent(ev); };
    mk('touchstart', 300); mk('touchmove', 250); mk('touchmove', 150); mk('touchend', 150);
  });
  await p.waitForTimeout(80);
  check('свайп влево по строке удаляет подход, «Отменить» в тосте возвращает', await E(p, () => logs['2026-10-19-d1-a4'].sets[1].r === '') && await vis(p, '#toast button'));
  await p.click('#toast button'); await p.clock.runFor(500);
  check('«Отменить» вернула удалённый подход', await E(p, () => logs['2026-10-19-d1-a4'].sets[1].r !== ''));
  /* удаление кнопкой в листе */
  await tap(p, '#player .xrow[data-a=row] >> nth=1'); await tap(p, '.sheet [data-del]');
  check('«Удалить подход» в листе правки', await E(p, () => logs['2026-10-19-d1-a4'].sets[1].r === ''));
  await tap(p, '#player [data-a=done]');
  await tap(p, '#player [data-a=done]');
  /* запас повторов */
  check('последний подход: под строкой фишки запаса 0 · 1 · 2 · 3+, панель ведёт дальше', await E(p, () => document.querySelectorAll('#player .zc').length === 4 && /Дальше/.test(document.querySelector('#player .plbl').innerText)));
  const zap = {};
  for (const [lab, v] of [['0', 10], ['1', 9], ['2', 8], ['3+', 7]]) { await tap(p, `#player .zc[data-v="${v}"]`); zap[lab] = await E(p, () => logs['2026-10-19-d1-a4'].rpe); }
  check('запас пишется как 10 минус запас: 0→10, 1→9, 2→8, 3+→7', zap['0'] === 10 && zap['1'] === 9 && zap['2'] === 8 && zap['3+'] === 7, JSON.stringify(zap));
  await tap(p, '#player .zc[data-v="7"]');
  check('повторный тап по фишке снимает запас', await E(p, () => logs['2026-10-19-d1-a4'].rpe === null));
  await tap(p, '#player [data-a=done]');
  check('первый подход следующего упражнения: фишки исчезли, прошлое свернулось в строку', !(await vis(p, '#player .zc')) && /Румынская · .*кг ×/.test(await E(p, () => document.querySelector('#player .pastl').innerText)) && (await cur(p)).id === 'a3');
  /* пара: подтягивания - отжимания */
  const seq = await E(p, () => plBuild(plEntry()).filter(s => s.k === 'set' && (s.id === 'a2' || s.id === 'a3')).slice(0, 4).map(s => s.id + s.si));
  check('пара чередуется: подход A, подход B, затем снова A', JSON.stringify(seq) === JSON.stringify(['a20', 'a30', 'a21', 'a31']), JSON.stringify(seq));
  check('в паре после первого упражнения отдыха нет, панель сразу показывает второе', !(await vis(p, '#player [data-rest]')) && (await cur(p)).id === 'a3' && /Отжимания/.test(await E(p, () => document.querySelector('#player .exh h2').textContent)));
  await tap(p, '#player [data-a=done]');
  check('после второго упражнения пары отдых идёт, снова первое упражнение', await vis(p, '#player [data-rest]') && (await cur(p)).id === 'a2' && (await cur(p)).si === 1);
  /* пропустить и «позже» */
  const laterId = (await cur(p)).id;
  await tap(p, '#player .exh');
  check('тап по заголовку: «Как делать», «Сделать позже», «Пропустить»', await E(p, () => { const t = document.querySelector('.sheet').innerText; return /Как делать/.test(t) && /Сделать позже/.test(t) && /Пропустить/.test(t); }));
  await tap(p, '.sheet [data-a=later]');
  const ord = await E(p, () => plOrdered(plEntry()).map(x => x.id).join());
  check('«Сделать позже» уносит упражнение в конец', ord.endsWith(',' + laterId) && (await cur(p)).id !== laterId, ord);
  const cid = (await cur(p)).id;
  await tap(p, '#player .exh'); await tap(p, '.sheet [data-a=skipex]');
  check('«Пропустить»: шаг помечен пропущенным без вопросов, ключ xs, перенос не запускается', await E(p, a => !!skips['2026-10-19-xs-d1-' + a] && !isMoved('d1') && !isDropped('d1'), cid));
  await close(p);
}

/* ===== Типы шагов: удержание, готовность, лист «Как делать» с таймером темпа ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  await tap(p, '#player [data-a=warmdone]');
  check('готовность: две кнопки «Достал метку» и «Не достал»', await vis(p, '#player [data-a=ready][data-v="1"]') && await vis(p, '#player [data-a=ready][data-v="0"]'));
  await tap(p, '#player [data-a=ready][data-v="0"]');
  check('«Не достал»: отметка и лёгкий день по правилу, место в тренировке не потеряно', await E(p, () => readyLow() && !!marks['2026-10-19-d1-aJ']) && (await cur(p)).id === 'aS');
  /* как делать: фото и таймер темпа тут */
  while ((await cur(p)).id !== 'a1') await stepOnce(p);
  await tap(p, '#player .exh'); await tap(p, '.sheet [data-a=how]');
  check('«Как делать»: фото или схема, текст и таймер темпа', await E(p, () => !!document.querySelector('.sheet .tempo-start') && !!document.querySelector('.sheet .tech') && !!document.querySelector('.sheet img, .sheet svg.figsvg, .sheet .fig')));
  await p.click('.sheet [data-tpon]'); await p.click('.sheet [data-tpgo]');
  await p.clock.runFor(7000);
  check('таймер темпа: повтор засчитан и стоит в значениях панели', await E(p, () => (plValues(plCur(plEntry())).ed.r ?? 0) >= 1 || plValues(plCur(plEntry())).r >= 1));
  await p.click('.sheet [data-close]'); await p.waitForTimeout(100);
  await close(p);
}
{
  /* удержание: четверг, «Изометрия ахилла» 3 × 30 сек */
  const p = await at('2026-10-22T11:30:00');
  await E(p, () => startWorkout('d2'));
  let c = await cur(p); let guard = 0;
  while (c && c.t !== 'hold' && guard++ < 20) { await stepOnce(p); c = await cur(p); }
  check('удержание: «Старт», время в секундах', c && c.t === 'hold' && await vis(p, '#player [data-a=hstart]') && /секунд/.test(await E(p, () => document.querySelector('#player .panel').innerText)));
  await tap(p, '#player [data-a=hstart]');
  check('удержание: идёт обратный отсчёт', await vis(p, '#player [data-hbig]'));
  await p.clock.runFor(31500);
  const L = await E(p, () => { const l = logs['2026-10-19-d2-bA']; return l && l.sets[0]; });
  check('удержание: запись сама по нулю (30 сек)', L && L.r === '30', JSON.stringify(L));
  check('после удержания пошёл отдых', await vis(p, '#player [data-rest]'));
  await tap(p, '#player [data-a=hstart]'); await p.clock.runFor(10000);
  await tap(p, '#player [data-a=hstop]');
  const L2 = await E(p, () => logs['2026-10-19-d2-bA'].sets[1]);
  check('«Стоп» пишет прошедшее время (около 10 сек)', L2 && Math.abs(+L2.r - 10) <= 2, JSON.stringify(L2));
  await close(p);
}

/* ===== Меню «⋯»: закончить сейчас, вернуться; мини-плашка; ошибка записи ===== */
{
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  await stepOnce(p); await stepOnce(p);
  await tap(p, '#player [data-a=menu]');
  check('меню «⋯»: короткая версия, закончить сейчас, действия с упражнением', await E(p, () => { const t = document.querySelector('.sheet').innerText; return /Короткая версия/.test(t) && /Закончить сейчас/.test(t) && /Как делать/.test(t) && /Пропустить/.test(t); }));
  await tap(p, '.sheet [data-a=fin]');
  const W = await E(p, () => watch['2026-10-19-d1']);
  check('«Закончить сейчас»: время конца записано, остальное пропущено, перенос не запущен', !!W.e && await E(p, () => Object.keys(skips).filter(k => /-xs-d1-/.test(k)).length >= 5 && !isMoved('d1')) && await vis(p, '#player .sumv'));
  await tap(p, '#player [data-a=resume]');
  check('«Продолжить»: пропущенные шаги на очереди, конец снят', await E(p, () => !watch['2026-10-19-d1'].e && Object.keys(skips).filter(k => /-xs-d1-/.test(k)).length === 0) && (await cur(p)).id === 'aS');
  await tap(p, '#player [data-a=min]');
  check('закрыл плеер посреди тренировки: без подтверждения, мини-плашка', await E(p, () => document.querySelector('#player').hidden && !document.querySelector('#mini').hidden && /Силовая А · .*\d? ?/.test(document.querySelector('#mini').innerText)));
  await tap(p, '#mini');
  check('тап по плашке возвращает в плеер на тот же шаг', await vis(p, '#player .panel') && (await cur(p)).id === 'aS');
  await close(p);
}
{
  /* ошибка записи: строка под шапкой, не тост */
  const p = await at(MON);
  await tap(p, '#scr-now [data-start]');
  while ((await cur(p)).id !== 'a4') await stepOnce(p);
  await E(p, () => { window.__o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^plan(Log|Marks)$/.test(k)) throw new Error('q'); return window.__o.call(this, k, v); }; });
  await tap(p, '#player [data-a=done]');
  check('не записалось: постоянная строка «Не сохраняется на телефоне» с кнопкой, тоста нет', await vis(p, '#player .savebad') && await vis(p, '#player .savebad button') && !(await E(p, () => document.querySelector('#toast').classList.contains('show'))));
  check('подход остался на экране', await E(p, () => logs['2026-10-19-d1-a4'].sets[0].r !== '') && await vis(p, '#player .xrow[data-a=row]'));
  await E(p, () => { Storage.prototype.setItem = window.__o; });
  await tap(p, '#player [data-a=done]');
  check('следующее действие снова пишет: строка исчезла, оба подхода в хранилище', !(await vis(p, '#player .savebad')) && await E(p, () => JSON.parse(localStorage.getItem('planLog'))['2026-10-19-d1-a4'].sets.filter(s => s.r !== '').length === 2));
  await close(p);
}

/* ===== Скриншоты ===== */
const SHOTS = process.env.SHOTS;
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const t0 = Date.parse('2026-10-19T17:00:00');
  const state = {   /* разминка, прыжки, старты, торможение и болгарский уже сделаны, румынская тяга впереди */
    ...SEED,
    planWatch: { '2026-10-19-d1': { s: '16:30', lt: t0 - 60000 } },
    planMarks: Object.fromEntries(['aJ', 'aS', 'aT', 'a1'].map(x => [`2026-10-19-d1-${x}`, true])
      .concat(['wp', 'sk', 'wl', 'wb', 'wt', 'ww', 'wr'].map(x => [`2026-10-19-d1-${x}`, true]))),
    planLog: { ...SEED.planLog, '2026-10-19-d1-a1': { n: 'Болгарский сплит-присед', d: '2026-10-19', sets: [0, 1, 2, 3].map(() => ({ w: '', r: '12', t: '16:50' })), rpe: null, tr: 8, th: 12, ns: 4, wk: 'build' } }
  };
  const need = await (async () => { const p = await at(MON, state); const r = await E(p, () => warmupOf(buildWeek().find(e => e.id === 'd1').day, state.week).list.map(s => s.id)); await p.ctx.close(); return r; })();
  for (const m of need) state.planMarks[`2026-10-19-d1-${m}`] = true;
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    const snap = async (p, name) => { await p.waitForTimeout(120); await p.screenshot({ path: path.join(SHOTS, `E3.1-${name}-${th}.png`) }); };
    let p = await at(MON, state, { dark });
    await E(p, () => openPlayer('d1'));
    await snap(p, '1-pered-podhodom');
    await p.click('#player [data-a=num][data-f=w]'); await p.fill('.sheet [data-in]', '50'); await p.click('.sheet [data-ok]');
    await snap(p, '6-vopros-pro-opechatku');
    await p.click('#player [data-a=ask][data-v=fix]');   /* 5 кг, как было */
    await tap(p, '#player [data-a=done]');
    await p.click('#player [data-st=w][data-d="1"]'); await p.click('#player [data-st=w][data-d="1"]');
    await p.clock.runFor(18000);
    await snap(p, '2-otdyh-s-pravkoj');
    await tap(p, '#player [data-a=done]'); await tap(p, '#player [data-a=done]');
    await snap(p, '3-zapas');
    await tap(p, '#player .xrow[data-a=row] >> nth=0');
    await snap(p, '5-list-pravki-podhoda');
    await E(p, () => closeSheets()); await p.waitForTimeout(60);
    await tap(p, '#player [data-a=menu]'); await tap(p, '.sheet [data-a=fin]');
    await snap(p, '4-itog');
    await p.ctx.close();
  }
}


/* ===== E4. Программа v2 в плеере: силовая А целиком, вторник (интервалы), четверг (сценарий), суббота (блок скорости) ===== */
{
  const V2SEED = { planOnboarded: true, planHintOff: true, planSet: { prog: { v: 2, from: '2026-11-09' } } };
  const shot = async (p, name, th) => { if (!SHOTS) return; await p.waitForTimeout(150); await p.screenshot({ path: path.join(SHOTS, `E4-${name}-${th}.png`) }); };
  const ptext = p => E(p, () => document.querySelector('#player .panel').innerText.replace(/\s+/g, ' '));
  /* Силовая А по v2, неделя 3 (пн 23.11): значения по умолчанию без правок, не больше 25 тапов */
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    const p = await at('2026-11-23T17:00:00', V2SEED, { dark });
    await shot(p, '1-seychas-pn-23-11', th);
    await tap(p, '#scr-now [data-start]');
    await shot(p, '2-silovaya-a-start', th);
    let n = 0;
    while (await stepOnce(p)) { n++; if (n === 7) await shot(p, '3-silovaya-a-seredina', th); if (n > 60) break; }
    if (!dark) {
      check(`E4. Силовая А v2 пройдена целиком за ${p.taps} тапов (не больше 25), значения не правились`, p.taps <= 25 && n > 10, `шагов ${n}`);
      check('E4. А v2: сессия закрыта, все шаги пройдены', await E(p, () => { const e = plEntry(); return !plCur(e) && sessionState('d1') === 'done'; }));
      check('E4. А v2: в журнале болгарский, румынская, подтягивания по 3 подхода', await E(p, () => ['a1', 'a4', 'a2'].every(id => logs[logKey('d1', id)] && logs[logKey('d1', id)].sets.filter(x => x.r).length === 3)));
    }
    await close(p);
  }
  /* Замена при боли по причине */
  {
    const p = await at('2026-11-23T17:00:00', V2SEED);
    await tap(p, '#scr-now [data-start]');
    while ((await cur(p)).id !== 'a1') await stepOnce(p);
    await tap(p, '#player [data-a=title]');
    check('E4. «Заменить» есть у болгарского', await vis(p, '.sheet [data-a=rep1]'));
    await tap(p, '.sheet [data-a=rep1]');
    const txt = await E(p, () => document.querySelector('.sheet').innerText);
    check('E4. лист замен по причинам: колено и кисть', /колено/i.test(txt) && /кисть/i.test(txt) && /мост/i.test(txt), txt.replace(/\n/g, ' | ').slice(0, 160));
    await tap(p, '.sheet [data-i="1"]');
    check('E4. после выбора упражнение заменено, шаг тот же', await E(p, () => { const e = plEntry(), c = plCur(e); return c.id === 'a1' && c.ex.sub && c.ex.sub.live && /мост/i.test(c.ex.name); }));
    await close(p);
  }
  /* Вторник, неделя 2 (вт 17.11): интервалы 4 × 3 мин, отдых 2 мин, пульс 165-175 */
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    const p = await at('2026-11-17T19:00:00', V2SEED, { dark });
    await tap(p, '#scr-now [data-start]');
    check('E4. вторник: первый шаг - интервалы, кнопка «Старт»', await vis(p, '#player [data-a=ivstart]'));
    await tap(p, '#player [data-a=ivstart]');
    await p.clock.runFor(68000);
    const t1 = await ptext(p);
    check('E4. «Работа 1 из 4», время фазы и строка целевого пульса', /Работа 1 из 4/.test(t1) && /1:[45]\d/.test(t1) && /165.175/.test(t1), t1);
    await p.clock.runFor(112000 + 20000);
    const t2 = await ptext(p);
    check('E4. фазы сменяются сами: «Легко»', /Легко/.test(t2), t2);
    await shot(p, '4-vtornik-intervaly', th);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
    await E(p, () => openPlayer('c-tue'));
    const t3 = await ptext(p);
    check('E4. после перезагрузки интервалы идут дальше (не с нуля)', /Легко|Работа 2 из 4/.test(t3), t3);
    await tap(p, '#player [data-a=ivpause]');
    check('E4. «Пауза»: есть «Дальше» и «Закончить»', await vis(p, '#player [data-a=ivresume]') && await vis(p, '#player [data-a=ivfinish]'));
    await tap(p, '#player [data-a=ivresume]');
    await p.clock.runFor(1100000);
    check('E4. в конце необязательное поле «пульс в конце»', await vis(p, '#player [data-hrend]'));
    await p.fill('#player [data-hrend]', '171');
    await tap(p, '#player [data-a=ivsave]');
    check('E4. детали интервалов в planWatch.iv (n, work, easy, hrEnd)', await E(p, () => { const w = watch['2026-11-16-c-tue']; return w && w.iv && w.iv.n === 4 && w.iv.work === 180 && w.iv.easy === 120 && w.iv.hrEnd === 171; }), await E(p, () => JSON.stringify(watch)));
    while (await stepOnce(p)) { }
    check('E4. вторник пройден: интервалы и мяч, сессия закрыта', await E(p, () => sessionState('c-tue') === 'done'));
    if (!dark) {
      await tap(p, '#player [data-a=srpe][data-v="7"]');
      check('E4. тяжесть с деталями интервалов записана в planLoad', await E(p, () => { const r = (loadLog['2026-11-17'] || []).find(x => x.id === 'c-tue'); return r && r.rpe === 7 && r.iv && r.iv.n === 4 && r.iv.hrEnd === 171; }), await E(p, () => JSON.stringify(loadLog)));
    }
    await close(p);
  }
  /* Четверг, неделя 3 (чт 26.11): сценарий по минутам, счётчики «попал» и «бросил», батарея */
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    const p = await at('2026-11-26T11:40:00', V2SEED, { dark });
    await tap(p, '#scr-now [data-start]');
    check('E4. четверг: сценарий, кнопка «Начать сценарий»', await vis(p, '#player [data-a=scstart]'));
    await tap(p, '#player [data-a=scstart]');
    await p.clock.runFor(125000);
    const t1 = await ptext(p);
    check('E4. блок 1 из 4, 0-5 мин, идёт всё время тренировки', /Блок 1 из 4/.test(t1) && /Всего 2:0\d/.test(t1), t1);
    await tap(p, '#player [data-a=scnext]');
    check('E4. бросковый блок: два счётчика «попал» и «бросил»', await vis(p, '#player [data-f=h][data-d="1"]') && await vis(p, '#player [data-f=n][data-d="1"]'));
    for (let i = 0; i < 10; i++) await tap(p, '#player [data-f=n][data-d="1"]');
    for (let i = 0; i < 8; i++) await tap(p, '#player [data-f=h][data-d="1"]');
    await tap(p, '#player [data-f=h][data-d="-1"]');
    await shot(p, '5-chetverg-scenariy-broski', th);
    check('E4. счётчики: попал 7, бросил 10, в planWatch.sh', await E(p, () => { const w = watch['2026-11-23-d2']; return w && w.sh && w.sh[0].b === 'sR' && w.sh[0].h === 7 && w.sh[0].n === 10; }), await E(p, () => JSON.stringify(watch)));
    await tap(p, '#player [data-a=scnext]'); await tap(p, '#player [data-a=scnext]'); await tap(p, '#player [data-a=scnext]');
    check('E4. сценарий закончен, дальше тест «бросковая батарея»', await vis(p, '#player [data-tv]'));
    await p.fill('#player [data-tv]', '38');
    await tap(p, '#player [data-a=tsave]');
    check('E4. батарея 38 записана в planTests', await E(p, () => tests.some(x => x.t === 'battery' && x.v === 38 && x.d === '2026-11-26')));
    check('E4. четверг пройден до конца', await E(p, () => !plCur(plEntry())));
    await close(p);
  }
  /* Yo-Yo в неделе 2 вместо рывков (чт 19.11), тест прыжка в субботу недели 4 (сб 05.12) */
  {
    const p = await at('2026-11-19T11:40:00', V2SEED);
    await tap(p, '#scr-now [data-start]'); await tap(p, '#player [data-a=scstart]');
    for (let i = 0; i < 3; i++) await tap(p, '#player [data-a=scnext]');
    check('E4. неделя 2: после сценария тест Yo-Yo, единица «м»', await E(p, () => { const c = plCur(plEntry()); return c.ex.id === 'sY' && c.ex.test.u === 'м'; }));
    await p.fill('#player [data-tv]', '1240'); await tap(p, '#player [data-a=tsave]');
    check('E4. Yo-Yo записан в planTests', await E(p, () => tests.some(x => x.t === 'yoyo' && x.v === 1240)));
    await close(p);
    const q = await at('2026-12-05T12:00:00', V2SEED);
    await tap(q, '#scr-now [data-start]'); await tap(q, '#player [data-a=warmdone]');
    check('E4. неделя 4: в субботу тест прыжка, поле числа', await vis(q, '#player [data-tv]'));
    await q.fill('#player [data-tv]', '58,5'); await tap(q, '#player [data-a=tsave]');
    check('E4. прыжок 58,5 см записан в planTests', await E(q, () => tests.some(x => x.t === 'jump' && x.v === 58.5)));
    await close(q);
  }
  /* Суббота, неделя 3 (сб 28.11): блок скорости 0а после разминки, потом силовая Б, мяч */
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    const p = await at('2026-11-28T12:00:00', V2SEED, { dark });
    await tap(p, '#scr-now [data-start]');
    await tap(p, '#player [data-a=warmdone]');
    const order = [];
    for (let i = 0; i < 5; i++) { const c = await cur(p); order.push(c.id); if (i === 0) await shot(p, '6-subbota-blok-skorosti', th); await stepOnce(p); }
    if (!dark) check('E4. суббота: после разминки блок 0а (прыжки, старты, торможения, боковые), потом присед на одной ноге', order.slice(0, 4).join() === 'kJ,kS,kT,bL' && order[4] === 'c1', order.join());
    let n = 0; while (await stepOnce(p)) { if (++n > 60) break; }
    if (!dark) check('E4. суббота пройдена от начала до конца', await E(p, () => sessionState('d3') === 'done' && !plCur(plEntry())));
    await close(p);
  }
  /* «Еда» в четверг: цель 2850 */
  for (const dark of [false, true]) {
    const th = dark ? 'dark' : 'light';
    const p = await at('2026-11-26T13:00:00', V2SEED, { dark });
    await E(p, () => { goTab('food', true); });
    await p.waitForTimeout(250);
    const t = await E(p, () => nutritionTarget(3).k + '|' + nutritionTarget(0).k + '|' + nutritionTarget(6).k);
    if (!dark) check('E4. калории по типу дня: чт 2850, пн 2600, вс без тренировки 2400', t === '2850|2600|2400', t);
    await shot(p, '7-eda-chetverg-2850', th);
    if (!dark) check('E4. «Еда» в четверг показывает цель 2850', await E(p, () => /2\s?850/.test(document.querySelector('#scr-food').innerText)));
    await close(p);
  }
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} проверок не прошли` : '\nВсе проверки прошли');
process.exit(fails ? 1 : 0);
