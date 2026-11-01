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
let marks={};    // галочки: "цикл-неделя-день-упражнение"
let grams={};    // граммовки выбранного дня (ссылка внутрь foodLog): "блюдо-продукт"
let dishOn={};   // включено ли блюдо в выбранный день (ссылка внутрь foodLog)
let skips={};    // пропущенные дни и отсутствие физры
let custom=[];   // еда вручную — ссылка на массив выбранного дня
let foodLog={};  // дневник: "цикл-неделя-день" → {dishOn, grams, custom}
let logs={};     // журнал подходов: "цикл-неделя-день-упражнение" → {n, d, sets:[{w,r}], rpe}
let selDow=new Date().getDay();   // какой день показан на «Сегодня» (0 = воскресенье)
let foodDay=0;   // выбранный день, 0 = понедельник

/* Понедельник считаем нулевым днём: неделя в плане начинается с него */
const DOW_IDX=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const todayIdx = () => (new Date().getDay()+6)%7;
const foodKey = () => `${state.cycle}-${state.week}-${foodDay}`;

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
  const k=`${state.cycle}-${state.week}-${(d==null?foodDay:d)}`;
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
const SCHEMA=3;
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
  applyAuto();
  foodDay=todayIdx();
  loadFoodDay();
}
const saveMarks=()=>store.set('planMarks',marks);
const saveFood=()=>store.set('planFood',foodLog);   // все данные дня — одна запись
const saveSkips=()=>store.set('planSkips',skips);
const savePos=()=>store.set('planPos',state);
const saveLogs=()=>store.set('planLog',logs);
let watch={};   /* данные часов по тренировке: "цикл-неделя-id дня" → {s,e,hr,mx,kc} */
const saveWatch=()=>store.set('planWatch',watch);
const saveSettings=()=>store.set('planSet',settings);
let cook={};    /* контейнеры недели: "цикл-неделя" → [{m, g, n}] — блюдо, гарнир, порций */
const saveCook=()=>store.set('planCook',cook);

const maxWeek=c=>(c===3?24:(c===1?12+(settings.session|0):12));

/* ############################################################
   ПРИВЯЗКА ДАННЫХ К ЧИСЛУ
   Записи лежат под ключами «цикл-неделя-…», а какая дата к какой неделе относится, зависит от
   старта плана и длины сессии. Поэтому при их смене записи переезжают вместе со своей датой:
   еда, отметки, журнал подходов, переносы, часы и контейнеры остаются на тех же числах.
   Что не попало в новый план (до старта) или относится к другому содержанию недели,
   не пропадает, а уходит в planArchive по дате и возвращается, когда дата снова попадёт в план.
   ############################################################ */
const planWeekDate=(start, session, c, w)=>{
  const ses=session|0, g = c===1 ? w-1 : (c===2 ? 12+ses+w-1 : 24+ses+w-1);
  return addDays(start, g*7);
};
function planWeekAt(start, session, iso){
  const n=Math.floor(daysBetween(start, iso)/7);
  if(n<0) return null;
  const c1=12+(session|0);
  if(n<c1) return [1, n+1];
  if(n<c1+12) return [2, n-c1+1];
  return [3, n-c1-12+1];
}
/* Что за содержание у недели: у отметок и журнала упражнения свои в каждом виде недели */
const planKind=(c,w)=> c===1 ? (w>12 ? 'ses' : 'c1') : 'c'+c;
const PLAN_KEY_RE=/^([123])-(\d+)(-.+)?$/;
const KIND_BOUND=new Set(['marks','logs']);
function planDataSnapshot(){
  return JSON.stringify({marks, skips, foodLog, logs, watch, cook, arch:store.get('planArchive',{}), pos:{cycle:state.cycle, week:state.week}});
}
function planDataRestore(snap){
  const o=JSON.parse(snap);
  marks=o.marks; skips=o.skips; foodLog=o.foodLog; logs=o.logs; watch=o.watch; cook=o.cook;
  saveMarks(); saveSkips(); saveFood(); saveLogs(); saveWatch(); saveCook(); store.set('planArchive', o.arch||{});
  loadFoodDay();
}
/* Переносит данные со старой привязки дат на новую. Возвращает сколько записей переехало, ушло в архив и вернулось */
function remapPlanData(oldCfg, newCfg){
  const oS=oldCfg.start, oN=oldCfg.session|0, nS=newCfg.start, nN=newCfg.session|0;
  if(oS===nS && oN===nN) return {moved:0, archived:0, restored:0};
  const arch=asObj(store.get('planArchive',{}),{});
  const R={moved:0, archived:0, restored:0};
  const stores={marks, skips, foodLog, logs, watch, cook};
  const next={marks:{}, skips:{}, foodLog:{}, logs:{}, watch:{}, cook:{}};
  Object.keys(stores).forEach(name=>{
    Object.keys(stores[name]).forEach(k=>{
      const m=PLAN_KEY_RE.exec(k), v=stores[name][k];
      if(!m){ next[name][k]=v; return; }
      const c=+m[1], w=+m[2], rest=m[3]||'', iso=planWeekDate(oS,oN,c,w), pos=planWeekAt(nS,nN,iso);
      const here = pos && (!KIND_BOUND.has(name) || planKind(pos[0],pos[1])===planKind(c,w));
      if(here){ const nk=`${pos[0]}-${pos[1]}${rest}`; if(!(nk in next[name])) next[name][nk]=v; if(nk!==k) R.moved++; }
      else { const a=arch[iso] || (arch[iso]={kind:planKind(c,w)}); (a[name] || (a[name]={}))[rest]=v; R.archived++; }
    });
  });
  /* вернуть из архива то, что снова попало в план своего вида */
  Object.keys(arch).forEach(iso=>{
    const a=arch[iso], pos=planWeekAt(nS,nN,iso); if(!pos) return;
    Object.keys(next).forEach(name=>{
      if(!a[name]) return;
      if(KIND_BOUND.has(name) && planKind(pos[0],pos[1])!==a.kind) return;
      Object.keys(a[name]).forEach(rest=>{
        const nk=`${pos[0]}-${pos[1]}${rest}`;
        if(!(nk in next[name])){ next[name][nk]=a[name][rest]; delete a[name][rest]; R.restored++; }
      });
      if(!Object.keys(a[name]).length) delete a[name];
    });
    if(!Object.keys(a).some(k=>k!=='kind')) delete arch[iso];
  });
  marks=next.marks; skips=next.skips; foodLog=next.foodLog; logs=next.logs; watch=next.watch; cook=next.cook;
  saveMarks(); saveSkips(); saveFood(); saveLogs(); saveWatch(); saveCook(); store.set('planArchive', arch);
  loadFoodDay();
  return R;
}
const remapNote=R=> R.moved||R.archived||R.restored ? ` Записи остались на своих числах: переехало ${R.moved}${R.archived?`, в архиве ${R.archived} (до старта или другого вида недели)`:''}${R.restored?`, вернулось из архива ${R.restored}`:''}.` : '';
const key=(d,e)=>`${state.cycle}-${state.week}-${d}-${e}`;
function gramOf(dishId,foodId,base){
  const k=`${dishId}-${foodId}`;
  return grams[k]!=null ? grams[k] : Math.round(base*portionFactor()/5)*5;
}
