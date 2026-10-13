"use strict";
/* ############################################################
   ПРАВИЛА ПЛАНА ПОВЕРХ РАСПИСАНИЯ
   plan.js — что задумано на неделю. Здесь — как план меняется
   от реальной жизни: замены упражнений, колено, возвращение после
   перерыва, накопленная усталость, незамеченные пропуски.
   Колено, перерыв и усталость действуют только на текущую неделю:
   прошлые недели в выгрузке остаются такими, какими были задуманы.
   Замены — выбор человека, они действуют всегда.
   ############################################################ */

/* Открыта та неделя, в которой мы сейчас по календарю */
function isNowWeek(){
  const p=posForDate(isoDay());
  return !p.pre && p.cycle===state.cycle && p.week===state.week;
}

/* ---------- Когда реально тренировался ----------
   День тренировки считается сделанным, если в нём есть галочка,
   запись подходов или данные с часов. Дата — по расписанию недели. */
const DAY_DOW={d1:0, d2:3, d3:5, d4:4};

/* Расчёты по всей истории дорогие, а за одну перерисовку их зовут
   десятки раз. Запоминаем результат, пока не поменялись данные, дата или неделя */
const MEMO={};
function memo(name, fn){
  const k=`${dataGen}|${isoDay()}|${state.cycle}-${state.week}`;
  const m=MEMO[name];
  if(m && m.k===k) return m.v;
  const v=fn(); MEMO[name]={k,v}; return v;
}

/* Дни, в которых что-то сделано: "цикл-неделя-день" */
function activeDays(){
  return memo('active', ()=>{
    const set=new Set(), re=/^([123]-\d+-d[1-4])(?:-|$)/;
    for(const k in watch){ const m=k.match(re); if(m) set.add(m[1]); }
    for(const k in marks){ const m=marks[k] && k.match(re); if(m) set.add(m[1]); }
    for(const k in logs){ const m=k.match(re); if(m && hasData(logs[k])) set.add(m[1]); }
    return set;
  });
}
const dayActive=(c,w,id)=>activeDays().has(`${c}-${w}-${id}`);

/* Даты тренировок до сегодняшнего дня, по возрастанию */
function activityDates(){ return memo('dates', activityDatesRaw); }
function activityDatesRaw(){
  const set=new Set(), today=isoDay();
  const add=(c,w,id)=>{ if(DAY_DOW[id]!=null) set.add(dateOfCW(c,w,DAY_DOW[id])); };
  const parse=k=>k.match(/^([123])-(\d+)-(d[1-4])(?:-|$)/);
  for(const k in logs){ const L=logs[k]; if(L && hasData(L)){ if(L.d) set.add(L.d); else { const m=parse(k); if(m) add(+m[1],+m[2],m[3]); } } }
  for(const k in marks){ const m=marks[k] && parse(k); if(m) add(+m[1],+m[2],m[3]); }
  for(const k in watch){ const m=parse(k); if(m) add(+m[1],+m[2],m[3]); }
  return [...set].filter(d=>d<today).sort();
}

/* ---------- Возвращение после перерыва ----------
   Болезнь, поездка, сессия без зала. 10+ дней без тренировок —
   первая тренировка на подход меньше и на 10 % легче.
   21+ день — две тренировки на подход меньше и на 20 % легче. */
function returnInfo(){ return memo('return', returnRaw); }
function returnRaw(){
  if(!isNowWeek()) return null;
  const ds=activityDates();
  if(!ds.length) return null;                 /* ещё не начинал — для этого есть вводная неделя */
  const pts=[...ds, isoDay()];
  for(let i=pts.length-1; i>0; i--){
    const after=ds.length-i;                  /* тренировок уже сделано после этой паузы */
    if(after>1) break;
    const gap=daysBetween(pts[i-1], pts[i]);
    if(gap>=21) return {gap, lvl:2, cut:0.2, left:2-after};
    if(gap>=10 && after===0) return {gap, lvl:1, cut:0.1, left:1};
  }
  return null;
}

/* ---------- Накопленная усталость ----------
   Две последние тренировки почти целиком на пределе (тяжесть 9–10) —
   сегодня лёгкий день: на подход меньше, без прибавки веса. */
function fatigueInfo(){ return memo('fatigue', fatigueRaw); }
function fatigueRaw(){
  if(!isNowWeek()) return null;
  const today=isoDay(), by={};
  for(const k in logs){ const L=logs[k]; if(L && L.d && L.d<today && L.rpe) (by[L.d]=by[L.d]||[]).push(L.rpe); }
  const days=Object.keys(by).sort().slice(-2);
  if(days.length<2 || daysBetween(days[1], today)>7) return null;
  const hard=days.every(d=>by[d].length>=2 && by[d].filter(r=>r>=9).length/by[d].length>=0.6);
  return hard ? {days} : null;
}

/* ---------- Замены упражнений ----------
   Нет оборудования, болит сустав, упражнение не идёт — меняется
   на то, что тренирует то же самое. Журнал ведётся отдельно по каждому. */
const setsOf=ex=>parseDose(ex.dose).sets;
const isDl=()=>weekKind(state.cycle,state.week)==='deload';
const ALTS={
  'Нордические сгибания':{name:'Скольжение пяток на полотенце', tech:'hamslide', why:'нет надёжной опоры для пяток',
    dose:()=>{ if(isDl()) return '2 × 6';
      const c=state.cycle, lw=loadWeek();
      if(c===1) return lw<=1 ? '2 × 8' : (lw<=4 ? '3 × 8' : (lw<=8 ? '3 × 10' : '3 × 6 на одной ноге'));
      return '3 × 8 на одной ноге'; },
    warm:'Не нужна — ноги размяты. Таз держи высоко весь подход.'},
  'Болгарский сплит-присед':{name:'Сплит-присед с ногами на полу', tech:'bulgarian', why:'сильно забивается задняя нога',
    dose:ex=>ex.dose,
    warm:'Один подход 8 повторов без веса, медленно. Задняя нога на носке, почти не участвует.'},
  'Румынская тяга на одной ноге':{name:'Ягодичный мостик на одной ноге', tech:'hipthrust', why:'поясница реагирует на наклоны',
    dose:ex=>`${setsOf(ex)} × 10–12 на ногу`},
  'Тяга гантели в наклоне':{name:'Тяга гантели лёжа грудью на скамье', tech:'row', why:'поясница: спина лежит на опоре',
    dose:ex=>`${setsOf(ex)} × 10–12 на руку`},
  'Тяга штанги в наклоне':{name:'Тяга гантелей лёжа грудью на скамье', tech:'row', why:'поясница: спина лежит на опоре',
    dose:ex=>ex.dose.replace(/·\s*[\d.,]+\s*кг/,'').trim()},
  'Жим гантелей стоя':{name:'Жим гантелей сидя со спинкой', tech:'ohp', why:'поясница прогибается в жиме стоя',
    dose:ex=>`${setsOf(ex)} × 10`},
  'Жим стоя':{name:'Жим гантелей сидя со спинкой', tech:'ohp', why:'поясница или плечо',
    dose:ex=>`${setsOf(ex)} × ${parseDose(ex.dose).lo||8}–${(parseDose(ex.dose).lo||8)+2}`},
  'Присед на одной ноге':{name:'Болгарский сплит-присед', tech:'bulgarian', why:'колено не любит глубокий присед на одной ноге',
    dose:ex=>`${setsOf(ex)} × 8–10 на ногу`},
  'Отжимания на брусьях':{name:'Отжимания с паузой', tech:'pushup', why:'плечо болит в брусьях',
    dose:ex=>`${setsOf(ex)} × 10–15 · 3 сек вниз`},
  'Брусья с весом':{name:'Отжимания с паузой', tech:'pushup', why:'плечо болит в брусьях',
    dose:ex=>`${setsOf(ex)} × 10–15 · 3 сек вниз`},
  'Копенгагенская планка':{name:'Изометрия паха', tech:'w_groin', why:'пах болит больше 3 из 10',
    dose:ex=>`${setsOf(ex)} × 30 сек`},
};
/* Замены по умолчанию. Нордические только с надёжной фиксацией пяток:
   без неё можно упасть лицом, поэтому по умолчанию скольжение пяток.
   Вернуть нордические можно кнопкой, когда появится опора */
const DEFAULT_SUBS={'Нордические сгибания':true};
function subOn(name){
  const s=settings.subs||{};
  return (name in s) ? !!s[name] : !!DEFAULT_SUBS[name];
}
function setSub(name, on){
  settings.subs=settings.subs||{};
  settings.subs[name]=!!on;
  saveSettings();
}
function applySub(ex){
  const A=ALTS[ex.name];
  if(!A || !subOn(ex.name) || /пропустить/.test(ex.dose)) return ex;
  return {...ex, name:A.name, tech:A.tech, dose:A.dose(ex), warm:A.warm||ex.warm, sub:{from:ex.name, why:A.why}};
}

/* ---------- Объём меньше на подход ---------- */
function lessSets(ex){
  return {...ex, dose:ex.dose.replace(/^(\d+)(\s*(?:×|подход))/, (m,n,r)=>Math.max(2,+n-1)+r)};
}

/* ---------- Колено прыгуна ----------
   Жёлтый: прыжков и ускорений вдвое меньше, ускорения на 80 %,
   самые ударные прыжки — пропуск. Красный: никаких прыжков и
   ускорений, вместо них изометрия у стены. */
const KNEE_HARD=['plyo'];
function kneeAdjust(list, lvl){
  const speed=ex=>ex.badge[0]==='Скорость' || ex.badge[0]==='Выносливость';
  if(lvl==='y') return list.map(ex=>{
    if(!speed(ex) || /пропустить/.test(ex.dose)) return ex;
    if(KNEE_HARD.includes(ex.tech)) return {...ex, dose:'пропустить · колено жёлтое'};
    let d=ex.dose.replace(/^(\d+)(?:–\d+)?(\s*(?:×|подход))/, (m,n,r)=>Math.max(1,Math.ceil(+n/2))+r);
    if(ex.tech==='sprint' || ex.tech==='shuttle') d+=' · на 80 %';
    return {...ex, dose:d+' · колено жёлтое'};
  });
  /* красный */
  const out=list.filter(ex=>!speed(ex) && ex.badge[0]!=='Тест');
  const wall={id:'kW', name:'Полуприсед у стены', badge:['Суставы','b-joint'], dose:'5 × 45 сек', rest:'60 сек', tech:'w_wallsit',
    warm:'Не нужна. Угол в колене такой, чтобы боль была не выше 3 из 10.'};
  const at=out.findIndex(ex=>ex.badge[0]!=='Суставы');
  out.splice(at<0?out.length:at, 0, wall);
  return out;
}

/* ---------- Сколько длится тренировка ----------
   Считается по составу дня, а не вписывается руками:
   подход = работа + отдых, плюс подводка перед первым рабочим подходом и
   смена снаряда между упражнениями. Разминка берётся из её уровня */
const TIME_SETUP=45;       /* сек: подойти, взять снаряд, настроиться */
const TIME_AFTER=300;      /* сек: сборы, душ не считаем, запись в журнал */
function exSeconds(ex){
  const d=ex.dose;
  if(/пропустить/.test(d)) return 0;
  const P=parseDose(d);
  let sets=P.sets||3;
  const sides=/на ногу|на руку|на сторону/.test(d) ? 2 : 1;
  /* минуты: «5 мин бросков», «10 минут дриблинга» */
  let m=d.match(/^(\d+)\s*мин/); if(m) return (+m[1])*60+TIME_SETUP;
  /* одна работа в секундах: «3 × 30 сек» */
  let work;
  const sec=d.match(/×\s*(\d+)(?:–(\d+))?\s*сек/);
  const dist=d.match(/×\s*(\d+)(?:–(\d+))?\s*м\b/);
  if(sec) work=+(sec[2]||sec[1]);
  else if(dist) work=Math.max(4, Math.round((+(dist[2]||dist[1]))/4)+3);   /* бег: ~4 м/с + возврат */
  else if(/до дальней|штрафная|челнок/i.test(d+ex.name)) work=/челнок|штрафная/i.test(d+ex.name)?35:12;
  else if(P.hi){
    /* темп: «3–3» — 6 сек на повтор, «3 сек вниз» — 4, остальное — 3 */
    const tempo=/темп 3–3/.test(d)?6:(/сек вниз|5 сек/.test(d)?4:3);
    work=Math.round((P.lo+P.hi)/2)*tempo;     /* по середине диапазона */
  } else work=40;
  const rest=restSec(ex.rest);
  /* «в паре с …» — суперсет: отдых делится на двоих */
  const r=/в паре/.test(ex.rest||'') ? 45 : (rest||0);
  /* подводка: «Не нужна» — нет, иначе минута */
  const warm=/^Не нужна/.test(ex.warm||'') ? 0 : (/× 5 · /.test(ex.warm||'')||/·.*×/.test(ex.warm||'') ? 150 : 75);
  /* одна нога → вторая почти без паузы (15 сек), полный отдых — между парами подходов */
  return sets*sides*work + Math.max(0,sets-1)*r + sets*(sides-1)*15 + warm + TIME_SETUP;
}
function dayMinutes(day, week){
  const warm = day.noWarm ? 0 : (()=>{ const w=warmupFor(week).dur.match(/(\d+)\D+(\d+)/); return w?(+w[1]+ +w[2])/2*60:0; })();
  const body = day.ex.reduce((a,x)=>a+exSeconds(x),0);
  return Math.round((warm+body+TIME_AFTER)/60/5)*5;   /* до 5 минут */
}

/* Типичная длительность дня по плану: медиана рабочих недель (без разгрузок) */
function typicalMinutes(){
  const med=a=>{ a=a.slice().sort((x,y)=>x-y); return a[Math.floor(a.length/2)]; };
  const out={};
  const run=(key, c, weeks, id)=>{
    const v=[];
    weeks.forEach(w=>withWeek(c,w,()=>{
      if(weekKind(c,w)==='deload') return;
      const e=buildWeek().find(x=>x.id===id); if(e && e.type==='gym') v.push(dayMinutes(e.day,w));
    }));
    out[key]=med(v);
  };
  const c1=Array.from({length:12},(_,i)=>i+1);
  ['d1','d2','d3','d4'].forEach(id=>run(id,1,c1,id));
  const ses=Array.from({length:Math.max(1,settings.session|0)},(_,i)=>13+i);
  run('s1',1,ses,'d1'); run('s2',1,ses,'d2'); run('s3',1,ses,'d3');
  return out;
}

/* ---------- Лето ----------
   Сессия (июнь): пар нет, только подготовка — держим форму.
   Практика (с начала июля, конец в настройках): днём занят, вечером тренировка.
   Каникулы (до 31 августа): главный блок года — днём, на свежие ноги.
   Физры летом нет, поэтому скоростные дни не «после физры».
   Режим считается по дате недели, а не по номеру цикла */
function summerDates(){
  const st=settings.start||SETTINGS_DEFAULT.start;
  const y=+st.slice(0,4) + (+st.slice(5,7)>=7 ? 1 : 0);
  return {y, exam:[`${y}-06-01`,`${y}-06-30`], practiceEnd:settings.practiceEnd||`${y}-07-24`, end:`${y}-08-31`};
}
function summerModeOf(c,w){
  const d=dateOfCW(c,w,2), S=summerDates();     /* середина недели */
  if(d>=S.exam[0] && d<=S.exam[1]) return 'exam';
  if(d>S.exam[1] && d<=S.practiceEnd) return 'practice';
  if(d>S.practiceEnd && d<=S.end) return 'vacation';
  return null;
}
const summerMode=()=>summerModeOf(state.cycle,state.week);
const SUMMER_WHEN={exam:'любой день · зал с кольцом', practice:'вечер после практики', vacation:'днём, на свежие ноги'};
const SUMMER_NOTE={
  exam:'<b>Летняя сессия</b>Держим форму, а не растём: на подход меньше, вес как в прошлый раз. Тренировка — перерыв между билетами, а не ещё один экзамен.',
  practice:'<b>Практика</b>Днём занят, тренировки вечером. Физры нет — скоростные дни на свежих ногах, без спешки.',
  vacation:'<b>Каникулы — главный блок года</b>Тренируйся днём, спи 8–9 часов. Это лучшее окно для прыжка: к осеннему отбору выходишь на пике.'
};

/* ---------- Всё вместе: план недели с поправками ---------- */
function adjustDays(S){
  S.forEach(day=>{ day.ex=day.ex.map(applySub); });
  /* лето: дни без физры, в сессию — поддержание. Действует на все недели лета, не только текущую */
  const sm=summerMode();
  if(sm) S.forEach(day=>{
    if(!day) return;
    if(day.id==='d2' || day.id==='d4'){
      day.when=day.when.replace(/универ, после физры|зал с кольцом, днём/, SUMMER_WHEN[sm]);
      day.note=day.note.replace(/^.*?(физр|Физр)[^.]*\.\s*/,'');
    }
    if(sm==='exam' && day.ex.some(isLogged)) day.ex=day.ex.map(ex=>isLogged(ex)?lessSets(ex):ex);
    if(!day.alert) day.alert={lvl:sm==='exam'?'y':'g', html:SUMMER_NOTE[sm]};
  });
  if(!isNowWeek()) return S;
  const rt=returnInfo(), ft=fatigueInfo(), ks=kneeStatus();
  const k=weekKind(state.cycle,state.week);
  /* вводная неделя цикла 1 и разгрузка уже легче — второй раз не режем */
  const light = k==='deload' || (state.cycle===1 && k!=='session' && loadWeek()===1);
  S.forEach(day=>{
    const gym=day.ex.some(isLogged);
    if(gym && (rt || ft)){
      if(!light) day.ex=day.ex.map(ex=>isLogged(ex)?lessSets(ex):ex);
      day.alert = rt
        ? {lvl:'y', html:`<b>Возвращение после перерыва · ${rt.gap} дн.</b>${rt.lvl===2
            ? `${rt.left===2?'Эта и следующая тренировка':'Сегодня последняя облегчённая тренировка'}: на подход меньше и на 20 % легче. Мышцы вспоминают быстро, связки — нет.`
            : 'Сегодня на подход меньше и на 10 % легче. Со следующей тренировки — снова по плану.'}`}
        : {lvl:'y', html:'<b>Лёгкий день</b>Две прошлые тренировки были на пределе (тяжесть 9–10). Сегодня на подход меньше и без прибавки веса — так прогресс не встанет.'};
    }
    if(ks && ks.lvl!=='g' && day.ex.some(ex=>ex.badge[0]==='Скорость')) day.ex=kneeAdjust(day.ex, ks.lvl);
  });
  return S;
}

/* ---------- Веса недели для шапки ----------
   Те же числа, что в карточках упражнений: по журналу, а не по таблице.
   Нет записей — числа из таблицы. */
function plannedBar(){
  return memo('bar', ()=>{
    const c=state.cycle, out={};
    const tbl = c===2 ? C2[Math.min(loadWeek(),12)] : cycle3(Math.min(loadWeek(),24));
    const want={squat:'sq', trap:'tr'};
    buildDays(c, state.week).forEach(day=>day.ex.forEach(ex0=>{
      const ex=applySub(ex0);
      const f = want[ex.tech] || (ex.name==='Жим стоя' ? 'oh' : null);
      if(!f) return;
      const pl=planFor(ex, parseDose(ex.dose), logKey(day.id, ex.id));
      out[f] = pl.w || tbl[f];
    }));
    return {sq:out.sq ?? tbl.sq, tr:out.tr ?? tbl.tr, oh:('oh' in out) ? out.oh : null};
  });
}

/* ---------- Подсказка веса с поправками дня ----------
   planBase считает от прошлых записей, здесь — перерыв и усталость */
function planFor(ex, P, k){
  const pl=planBase(ex, P, k);
  if(!isNowWeek() || pl.kind==='back') return pl;
  const rt=returnInfo(), ft=rt?null:(fatigueInfo() || (summerMode()==='exam' ? {exam:true} : null));
  if(!rt && !ft) return pl;
  const isBar=weightKind(ex,P).ph==='штанга';
  /* прибавки нет ни после перерыва, ни при усталости: от прошлого реального веса */
  const L=lastLog(ex.name,k), top=L?Math.max(0,...L.sets.map(x=>num(x.w)||0)):0;
  const cutW=w=>{
    if(!w) return w;
    if(top && w>top) w=top;
    if(rt) return isBar ? r25(w*(1-rt.cut)) : Math.max(0, rDb(w*(1-rt.cut)));
    return w;
  };
  const cutR=r=> r==null ? r : Math.max(1, r-(rt?(rt.lvl===2?2:1):1));
  pl.sets=pl.sets.map(s=>({w:cutW(s.w), r:cutR(s.r)}));
  pl.w=cutW(pl.w);
  const w=pl.sets[0]&&pl.sets[0].w;
  pl.t = rt
    ? `<b>после перерыва</b>: ${w?`${fmtW(w)} кг, `:''}${pl.sets[0]&&pl.sets[0].r!=null?`по ${pl.sets[0].r} повт., `:''}запас 2–3 повтора. <span style="color:var(--muted)">По плану было: ${pl.t}</span>`
    : `<b>${ft.exam?'сессия, держим':'лёгкий день'}</b>: ${w?`${fmtW(w)} кг, `:''}без отказа. <span style="color:var(--muted)">По плану было: ${pl.t}</span>`;
  return pl;
}
