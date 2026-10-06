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
const DAY_DOW={d1:0, d2:3, d3:5};

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
    const set=new Set(), re=/^([123]-\d+-d[123])(?:-|$)/;
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
  const parse=k=>k.match(/^([123])-(\d+)-(d[123])(?:-|$)/);
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
  'Нордические сгибания':{name:'Скольжение пяток на полотенце', tech:'hamslide', why:'нет партнёра или опоры для пяток',
    dose:()=>{ if(isDl()) return '2 × 6';
      const c=state.cycle, lw=loadWeek();
      if(c===1) return lw<=8 ? '3 × 10' : '3 × 6 на одной ноге';
      return '3 × 8 на одной ноге'; },
    warm:'Не нужна — ноги размяты. Таз держи высоко весь подход.'},
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
/* Партнёра для нордических нет — по умолчанию сразу замена */
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

/* ---------- Всё вместе: план недели с поправками ---------- */
function adjustDays(S){
  S.forEach(day=>{ day.ex=day.ex.map(applySub); });
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

/* ---------- Подсказка веса с поправками дня ----------
   planBase считает от прошлых записей, здесь — перерыв и усталость */
function planFor(ex, P, k){
  const pl=planBase(ex, P, k);
  if(!isNowWeek() || pl.kind==='back') return pl;
  const rt=returnInfo(), ft=rt?null:fatigueInfo();
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
    : `<b>лёгкий день</b>: ${w?`${fmtW(w)} кг, `:''}без отказа. <span style="color:var(--muted)">По плану было: ${pl.t}</span>`;
  return pl;
}
