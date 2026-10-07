"use strict";
/* ############################################################
   9 · СОСТОЯНИЕ И ХРАНЕНИЕ
   ############################################################ */
let state={cycle:1,week:1};
/* Настройки: неделя по дате, длина сессионного блока, поправка калорий */
const SETTINGS_DEFAULT={auto:true, start:'2026-10-05', session:4};
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
let draft={cycle:1,week:1};

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
        toast('Не получилось сохранить на телефоне — сохрани копию в «Справке»');
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
                 'planBody','planCirc','planTests','planFav','planWatch'];
const SCHEMA=2;
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
  store.set('planSchema',v);
}
/* Где в плане находится дата: сушка 12 нед → сессия → цикл 2 → цикл 3 */
function posForDate(iso){
  const n=Math.floor(daysBetween(settings.start, iso)/7);
  if(n<0) return {cycle:1, week:1, pre:true};
  const c1=12+(settings.session|0);
  if(n<c1) return {cycle:1, week:n+1};
  if(n<c1+12) return {cycle:2, week:n-c1+1};
  /* после 24-й недели цикла 3 план закончился: остаёмся на последней неделе */
  return {cycle:3, week:Math.min(24, n-c1-12+1), end:n-c1-12+1>24};
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
  settings=Object.assign(settings, asObj(store.get('planSet',{}),{}));
  if(!asObj(settings.kcalAdj)) settings.kcalAdj={};
  const p=asObj(store.get('planPos',null),null);
  if(p){ state.cycle=[1,2,3].includes(p.cycle)?p.cycle:1; state.week=Math.max(1,p.week|0); }
  if(state.week>maxWeek(state.cycle)) state.week=maxWeek(state.cycle);
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

const maxWeek=c=>(c===3?24:(c===1?12+(settings.session|0):12));
const key=(d,e)=>`${state.cycle}-${state.week}-${d}-${e}`;
function gramOf(dishId,foodId,base){
  const k=`${dishId}-${foodId}`;
  return grams[k]!=null ? grams[k] : Math.round(base*portionFactor()/5)*5;
}
