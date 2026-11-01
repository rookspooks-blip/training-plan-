"use strict";
/* ############################################################
   9 · СОСТОЯНИЕ И ХРАНЕНИЕ
   ############################################################ */
let state={cycle:1,week:1};
/* Настройки: неделя по дате, длина сессионного блока, поправка калорий */
const SETTINGS_DEFAULT={auto:true, start:'2026-10-05', session:4, theme:'auto'};
let settings={...SETTINGS_DEFAULT, kcalAdj:{}};
/* Цикл 1: недели 1–12 сушка, дальше — сессионный блок (зима, экзамены) */
const isSession=(c,w)=>{ c=c??state.cycle; w=w??state.week; return c===1 && w>12; };
let marks={};    // галочки: "дата понедельника-день-упражнение"
let grams={};    // граммовки выбранного дня (ссылка внутрь foodLog): "блюдо-продукт"
let dishOn={};   // включено ли блюдо в выбранный день (ссылка внутрь foodLog)
let skips={};    // пропущенные дни и отсутствие физры
let custom=[];   // еда вручную — ссылка на массив выбранного дня
let foodLog={};  // дневник: "дата понедельника-день" → {dishOn, grams, custom}
let logs={};     // журнал подходов: "дата понедельника-день-упражнение" → {n, d, sets:[{w,r}], rpe}
let selDow=new Date().getDay();   // какой день показан на «Сегодня» (0 = воскресенье)
let foodDay=0;   // выбранный день, 0 = понедельник

/* Понедельник считаем нулевым днём: неделя в плане начинается с него */
const DOW_IDX=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const todayIdx = () => (new Date().getDay()+6)%7;
const foodKey = () => `${weekTag()}-${foodDay}`;

/* Переключает активный день: dishOn, grams и custom начинают
   указывать на запись этого дня, поэтому весь остальной код не меняется */
const emptyDay = () => ({ dishOn:Object.fromEntries(DISHES.map(d=>[d.id,false])), grams:{}, custom:[], times:{} });
let mealTimes={};   /* время приёма блюд выбранного дня: id блюда → «ЧЧ:ММ» */

function loadFoodDay(){
  const k=foodKey();
  if(!foodLog[k]) foodLog[k]=emptyDay();
  const e=foodLog[k];
  if(!e.dishOn) e.dishOn=Object.fromEntries(DISHES.map(d=>[d.id,false]));
  if(!e.grams)  e.grams={};
  if(!e.custom) e.custom=[];
  if(!e.times) e.times={};
  dishOn=e.dishOn; grams=e.grams; custom=e.custom; mealTimes=e.times;
}

/* День заполнен, только если в нём реально есть еда.
   Пустой день — это «не заполнял», а не «съел ноль»,
   и в недельную статистику он не попадает. */
function dayFilled(d){
  const t=totalsOfDay(d);
  return !!(t && t.k > 0);
}

/* Полная очистка дня */
function clearDay(d){
  const k=`${weekTag()}-${(d==null?foodDay:d)}`;
  foodLog[k]=emptyDay();
  if(d==null || d===foodDay) loadFoodDay();
}

/* localStorage может быть недоступен — тогда работаем в памяти.
   Ошибку записи не глотаем молча: раз за сеанс показываем подсказку */
let storeWarned=false;
let dataGen=0;   /* номер версии данных в памяти: растёт при каждой записи */
const store={
  get(k,fb){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):fb; }catch(e){ return fb; } },
  set(k,v){
    dataGen++;   /* данные поменялись — расчёты по истории пересчитаются */
    try{ localStorage.setItem(k,JSON.stringify(v)); return true; }
    catch(e){
      if(!storeWarned && typeof toast==='function'){
        storeWarned=true;
        toast('Не получилось сохранить на телефоне — сохрани копию: «Я» → «Настройки и данные»');
      }
      return false;
    }
  }
};
/* Текст пользователя в разметку — только через esc */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Значение из хранилища нужного вида, иначе запасное */
const asObj=(v,fb)=>(v && typeof v==='object' && !Array.isArray(v)) ? v : fb;
const asArr=(v,fb)=>Array.isArray(v) ? v : fb;

/* Все ключи данных приложения. planSchema — версия формата */
const DATA_KEYS=['planMarks','planSkips','planFood','planPos','planTodo','planLog','planSet',
                 'planBody','planCirc','planTests','planFav','planWatch','planCook','planArchive'];
const SCHEMA=4;
const LEGACY_KEYS=['planGrams','planCustom'];   /* формат 1: еда лежала вне дней */

/* Снимок всех данных в отдельный ключ: перед миграцией и перед восстановлением */
function snapshot(reason){
  const data={};
  [...DATA_KEYS, ...LEGACY_KEYS].forEach(k=>{
    try{ const v=localStorage.getItem(k); if(v!=null) data[k]=JSON.parse(v); }catch(e){}
  });
  if(!Object.keys(data).length) return;
  store.set('planAutoBackup', {app:'tri-cikla', schema:store.get('planSchema',1), reason, saved:new Date().toISOString(), data});
}

/* Миграции формата по шагам. Каждая — только вперёд */
function migrate(){
  let v=store.get('planSchema',1);
  if(v>=SCHEMA) return;
  snapshot(`миграция ${v}→${SCHEMA}`);
  if(v<2){
    /* граммовки и своя еда давно хранятся внутри дней planFood —
       старые общие ключи больше никто не читает */
    LEGACY_KEYS.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
    v=2;
  }
  if(v<3){
    /* формат 3 — новый дизайн: старые ключи читаются как есть, добавляется
       planCook (контейнеры недели) и пах в утреннем замере. Ничего не переписывается */
    v=3;
  }
  if(v<4){
    /* формат 4 — записи привязаны к числу: «цикл-неделя-…» → «дата понедельника недели-…» */
    convertLegacyKeys();
    v=4;
  }
  store.set('planSchema',v);
}
/* Зимняя сессия: период по датам. Сушка идёт ровно 12 недель, поэтому сессия начинается не раньше
   понедельника после неё; недели между концом сушки и «с» — те же поддерживающие тренировки.
   Длина в неделях (settings.session) считается из даты «по» и хранится как раньше — так план,
   выгрузки и календарь работают без изменений */
const sesBase=()=>addDays(settings.start, 12*7);
function winterSession(){
  const base=sesBase(), weeks=settings.session|0;
  if(!weeks) return {weeks:0, base, from:null, to:null};
  const to=addDays(base, weeks*7-1);
  const f=settings.sesFrom;
  const from=(f && f>=base && f<=to) ? f : base;
  return {weeks, base, from, to};
}
/* «по» → недели: до воскресенья недели, в которую попала дата. Раньше начала — сессии нет */
function weeksUntil(iso){
  const base=sesBase();
  if(!iso || iso<base) return 0;
  return Math.min(12, Math.ceil((daysBetween(base, iso)+1)/7));
}

/* Где в плане находится дата: сушка 12 нед → сессия → цикл 2 → цикл 3 */
function posForDate(iso){
  const n=Math.floor(daysBetween(settings.start, iso)/7);
  if(n<0) return {cycle:1, week:1, pre:true};
  const c1=12+(settings.session|0);
  if(n<c1) return {cycle:1, week:n+1};
  if(n<c1+12) return {cycle:2, week:n-c1+1};
  /* после 24-й недели цикла 3 план пройден: недели 25, 26… повторяют последний блок */
  const w=n-c1-12+1;
  return {cycle:3, week:w, end:w>24};
}
function applyAuto(){
  if(!settings.auto || !settings.start) return false;
  const p=posForDate(isoDay());
  if(p.cycle===state.cycle && p.week===state.week) return false;
  state.cycle=p.cycle; state.week=p.week; savePos();
  return true;
}

function loadAll(){
  migrate();
  marks  =asObj(store.get('planMarks',{}),{});
  skips  =asObj(store.get('planSkips',{}),{});
  foodLog=asObj(store.get('planFood',{}),{});
  logs   =asObj(store.get('planLog',{}),{});
  watch  =asObj(store.get('planWatch',{}),{});
  body   =asObj(store.get('planBody',{}),{});
  circ   =asArr(store.get('planCirc',[]),[]);
  tests  =asArr(store.get('planTests',null),null) || SEED_TESTS.slice();
  cook   =asObj(store.get('planCook',{}),{});
  settings=Object.assign(settings, asObj(store.get('planSet',{}),{}));
  if(!asObj(settings.kcalAdj)) settings.kcalAdj={};
  const p=asObj(store.get('planPos',null),null);
  if(p){ state.cycle=[1,2,3].includes(p.cycle)?p.cycle:1; state.week=Math.max(1,p.week|0); }
  if(state.week>maxWeek(state.cycle) && state.cycle!==3) state.week=maxWeek(state.cycle);   /* в цикле 3 после 24-й — повтор блока */
  /* один раз: если журнал показывает, что записи сидят не на своих числах (старт менялся до привязки к числам), сдвигаем */
  if(!store.get('planShiftChecked',false)){
    store.set('planShiftChecked', true);
    const d=detectDateShift();
    if(d){ shiftDataBy(d.delta); store.set('planShiftFix', {delta:d.delta, n:d.n, total:d.total, at:isoDay()}); }
  }
  applyAuto();
  foodDay=todayIdx();
  loadFoodDay();
}
const saveMarks=()=>store.set('planMarks',marks);
const saveFood=()=>store.set('planFood',foodLog);   // все данные дня — одна запись
const saveSkips=()=>store.set('planSkips',skips);
const savePos=()=>store.set('planPos',state);
const saveLogs=()=>store.set('planLog',logs);
let watch={};   /* данные часов по тренировке: "дата понедельника-id дня" → {s,e,hr,mx,kc} */
const saveWatch=()=>store.set('planWatch',watch);
const saveSettings=()=>store.set('planSet',settings);
let cook={};    /* контейнеры недели: "дата понедельника" → [{m, g, n}] — блюдо, гарнир, порций */
const saveCook=()=>store.set('planCook',cook);

const maxWeek=c=>(c===3?24:(c===1?12+(settings.session|0):12));

/* ############################################################
   ПРИВЯЗКА ДАННЫХ К ЧИСЛУ
   Запись лежит под ключом «дата понедельника недели-…» (например 2026-10-26-d1-a1), а не «цикл-неделя-…».
   Сдвиг старта плана и длина сессии меняют только то, какая неделя плана на какой даты, а сами записи
   (еда, отметки, журнал подходов, переносы, часы, контейнеры) остаются на своих числах.
   ############################################################ */
const planWeekDate=(start, session, c, w)=>{
  const ses=session|0, g = c===1 ? w-1 : (c===2 ? 12+ses+w-1 : 24+ses+w-1);
  return addDays(start, g*7);
};
let weekTagForce=null;   /* неделя до старта плана: у неё нет цикла и номера, но записи за её даты есть */
const weekTag=(c, w)=> weekTagForce && c==null ? weekTagForce : planWeekDate(settings.start, settings.session, c==null?state.cycle:c, w==null?state.week:w);
function withTag(tag, fn){ const sv=weekTagForce; weekTagForce=tag; try{ return fn(); } finally{ weekTagForce=sv; } }
const TAG_RE=/^(\d{4}-\d\d-\d\d)(-.+)?$/;
const LEGACY_RE=/^([123])-(\d+)(-.+)?$/;
/* Старые ключи «цикл-неделя-…» → дата понедельника недели по нынешнему старту. Повторный запуск ничего не меняет */
function convertLegacyKeys(){
  const S=Object.assign({}, SETTINGS_DEFAULT, asObj(store.get('planSet',{}),{}));
  const conv=obj=>{
    const out={}; let n=0;
    Object.keys(obj).forEach(k=>{
      const m=LEGACY_RE.exec(k);
      if(!m){ if(!(k in out)) out[k]=obj[k]; return; }
      const nk=planWeekDate(S.start, S.session, +m[1], +m[2])+(m[3]||'');
      if(!(nk in out)) out[nk]=obj[k]; n++;
    });
    return n ? out : null;
  };
  const sets=[['planMarks'],['planSkips'],['planFood'],['planLog'],['planWatch'],['planCook']];
  sets.forEach(([key])=>{ const o=asObj(store.get(key,{}),{}); const c=conv(o); if(c) store.set(key,c); });
  /* досрочные разгрузки лежат в настройках под тем же видом ключа */
  const ps=asObj(store.get('planSet',{}),{});
  if(ps.earlyDl){ const c=conv(ps.earlyDl); if(c){ ps.earlyDl=c; store.set('planSet',ps); } }
  /* архив прошлой версии: записи возвращаются на свои числа */
  const arch=asObj(store.get('planArchive',{}),{});
  if(Object.keys(arch).length){
    const into={marks:'planMarks', skips:'planSkips', foodLog:'planFood', logs:'planLog', watch:'planWatch', cook:'planCook'};
    Object.keys(arch).forEach(iso=>Object.keys(into).forEach(name=>{
      const part=arch[iso] && arch[iso][name]; if(!part) return;
      const o=asObj(store.get(into[name],{}),{});
      Object.keys(part).forEach(rest=>{ const nk=iso+rest; if(!(nk in o)) o[nk]=part[rest]; });
      store.set(into[name], o);
    }));
    store.set('planArchive', {});
  }
}
/* Старт плана уже менялся до привязки к числам: записи сидят на датах, посчитанных от нового старта.
   Сдвигаем все метки недель на разницу между старым и нынешним стартом */
/* Журнал подходов помнит, в какой день его вели (поле d). Если ключи «уехали» на целое число недель
   (старт плана меняли до привязки к числам), это видно по расхождению: считаем самое частое */
function detectDateShift(){
  const cnt={}; let n=0;
  Object.keys(logs).forEach(k=>{
    const m=/^(\d{4}-\d\d-\d\d)-(d[1-7])-/.exec(k), L=logs[k];
    if(!m || !L || !L.d || !hasData(L) || DAY_DOW[m[2]]==null) return;
    const delta=daysBetween(addDays(m[1], DAY_DOW[m[2]]), L.d);
    if(Math.abs(delta)>=7 && delta%7===0) cnt[delta]=(cnt[delta]||0)+1;
    n++;
  });
  let best=null; Object.keys(cnt).forEach(d=>{ if(!best || cnt[d]>cnt[best]) best=d; });
  return best!=null && cnt[best]>=2 && cnt[best]/n>=0.6 ? {delta:+best, n:cnt[best], total:n} : null;
}
/* Записи за даты, которых ещё не было, — верный признак сдвинутого старта. Если сдвиг на разницу со стартом по умолчанию
   (до которого их вели) убирает все такие записи, предлагаем его. Сами ничего не двигаем: решает пользователь */
function misalignCandidate(){
  const def=SETTINGS_DEFAULT.start;
  if(settings.start===def) return null;
  const delta=daysBetween(settings.start, def);
  if(!delta || delta%7) return null;
  const lim=addDays(isoDay(),1), dates=[];
  Object.keys(foodLog).forEach(k=>{ const m=/^(\d{4}-\d\d-\d\d)-(\d)$/.exec(k), e=foodLog[k];
    if(m && e && (Object.values(e.dishOn||{}).some(Boolean) || (e.custom||[]).length)) dates.push(addDays(m[1],+m[2])); });
  const part=/^(\d{4}-\d\d-\d\d)-(d[1-7])-/;
  Object.keys(marks).forEach(k=>{ const m=marks[k] && part.exec(k); if(m && DAY_DOW[m[2]]!=null) dates.push(addDays(m[1],DAY_DOW[m[2]])); });
  Object.keys(logs).forEach(k=>{ const m=part.exec(k); if(m && hasData(logs[k]) && DAY_DOW[m[2]]!=null) dates.push(addDays(m[1],DAY_DOW[m[2]])); });
  const fut=dates.filter(d=>d>lim).length;
  return fut>=3 && !dates.some(d=>addDays(d,delta)>lim) ? {delta, fut, total:dates.length, from:def} : null;
}
function shiftDataDates(oldStart){ return shiftDataBy(daysBetween(settings.start, oldStart)); }
function shiftDataBy(delta){
  if(!delta) return 0;
  let n=0;
  const mv=obj=>{ const out={}; Object.keys(obj).forEach(k=>{ const m=TAG_RE.exec(k); if(m){ out[addDays(m[1],delta)+(m[2]||'')]=obj[k]; n++; } else out[k]=obj[k]; }); return out; };
  marks=mv(marks); skips=mv(skips); foodLog=mv(foodLog); logs=mv(logs); watch=mv(watch); cook=mv(cook);
  if(settings.earlyDl) settings.earlyDl=mv(settings.earlyDl);
  saveMarks(); saveSkips(); saveFood(); saveLogs(); saveWatch(); saveCook(); saveSettings();
  loadFoodDay();
  return n;
}
const key=(d,e)=>`${weekTag()}-${d}-${e}`;
function gramOf(dishId,foodId,base){
  const k=`${dishId}-${foodId}`;
  return grams[k]!=null ? grams[k] : Math.round(base*portionFactor()/5)*5;
}
