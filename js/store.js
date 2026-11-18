"use strict";
/* ############################################################
   9 · СОСТОЯНИЕ И ХРАНЕНИЕ
   ############################################################ */
let state={cycle:1,week:1};
/* Настройки: неделя по дате, длина сессионного блока, поправка калорий */
const SETTINGS_DEFAULT={auto:true, start:'2026-10-05', session:4, theme:'auto'};
let settings={...SETTINGS_DEFAULT, kcalAdj:{}};
/* Цикл 1: недели 1–12 сушка, дальше — сессионный блок (зима, экзамены) */
const isSession=(c,w)=>{ c=c??state.cycle; w=w??state.week;
  const P2=v2Pos(planWeekDate(settings.start, settings.session, c, w));   /* v2: сессия - блоки 2 и 3 */
  if(P2) return P2.block>1;
  return c===1 && w>12; };
let loadLog={}; // нагрузка: "YYYY-MM-DD" → [{k, min, rpe, id?}], см. load.js
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
/* Ключи, чьё значение в хранилище повреждено и сырую строку которого не вышло сохранить (safe.js: guardBadData).
   Поверх них в этом сеансе ничего не пишем, чтобы не затереть единственный экземпляр */
const blockedKeys=new Set();
const store={
  get(k,fb){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):fb; }catch(e){ return fb; } },
  set(k,v){
    dataGen++;   /* данные поменялись — расчёты по истории пересчитаются */
    if(blockedKeys.has(k)) return false;
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
                 'planBody','planCirc','planTests','planFav','planWatch','planCook','planArchive','planLoad'];
const SCHEMA=5;
const LEGACY_KEYS=['planGrams','planCustom'];   /* формат 1: еда лежала вне дней */
/* snapshot, migrate, автокопии и откат — в safe.js */
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
  guardBadData();   /* повреждённое значение — в planBad до любой записи */
  const migrated=migrate();
  marks  =asObj(store.get('planMarks',{}),{});
  skips  =asObj(store.get('planSkips',{}),{});
  foodLog=asObj(store.get('planFood',{}),{});
  logs   =asObj(store.get('planLog',{}),{});
  watch  =asObj(store.get('planWatch',{}),{});
  body   =asObj(store.get('planBody',{}),{});
  circ   =asArr(store.get('planCirc',[]),[]);
  tests  =asArr(store.get('planTests',null),null) || SEED_TESTS.slice();
  cook   =asObj(store.get('planCook',{}),{});
  loadLog=asObj(store.get('planLoad',{}),{});
  settings=Object.assign(settings, asObj(store.get('planSet',{}),{}));
  if(!asObj(settings.kcalAdj)) settings.kcalAdj={};
  const p=asObj(store.get('planPos',null),null);
  if(p){ state.cycle=[1,2,3].includes(p.cycle)?p.cycle:1; state.week=Math.max(1,p.week|0); }
  if(state.week>maxWeek(state.cycle) && state.cycle!==3) state.week=maxWeek(state.cycle);   /* в цикле 3 после 24-й — повтор блока */
  /* один раз: если журнал показывает, что записи сидят не на своих числах (старт менялся до привязки к числам), сдвигаем */
  /* Миграция 4→5 не прошла: данные формата 4 уже привязаны к числам, проверку сдвига не запускаем
     (флаг выставит сама миграция, когда дойдёт до конца) */
  if(!store.get('planShiftChecked',false) && (migrated || schemaOf(ls.get('planSchema'))<4)){
    store.set('planShiftChecked', true);
    const d=detectDateShift();
    if(d){
      const n=shiftDataBy(d.delta);
      if(n>=0) store.set('planShiftFix', {delta:d.delta, n:d.n, total:d.total, at:isoDay()});
      else{
        /* копия не записалась — проверка повторится при следующем запуске; коллизия — сдвига не будет, о нём скажем */
        if(shiftError==='copy') store.set('planShiftChecked', false);
        addAlert('shift', shiftMessage(), 'y');
      }
    }
  }
  applyAuto();
  foodDay=todayIdx();
  loadFoodDay();
  autoRotate();   /* ежедневная автокопия: раз в день, после того как данные загружены и выровнены */
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
/* Старые ключи «цикл-неделя-…» → дата понедельника недели по нынешнему старту. Повторный запуск ничего не меняет.
   Возвращает true, только если всё записано. Всё считается в памяти, пока ничего не записано; архив очищается
   лишь после того, как перенос подтверждён; значения, которым не нашлось места из-за совпавшего ключа, не теряются:
   их строка уходит в planBad (и лежит в planPre5) */
function convertLegacyKeys(){
  const S=Object.assign({}, SETTINGS_DEFAULT, asObj(store.get('planSet',{}),{}));
  const conflicts=[];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const conv=(obj,name)=>{
    const out={}; let n=0;
    const keys=Object.keys(obj), exist=new Set(keys.filter(k=>!LEGACY_RE.test(k)));
    keys.forEach(k=>{
      const m=LEGACY_RE.exec(k);
      if(!m){ out[k]=obj[k]; return; }
      n++;
      const nk=planWeekDate(S.start, S.session, +m[1], +m[2])+(m[3]||'');
      /* запись, уже стоящая на числе, главнее: она новее формата */
      if(exist.has(nk)){ if(!same(obj[nk],obj[k])) conflicts.push({key:name, nk, lost:obj[k]}); return; }
      if(nk in out){ if(!same(out[nk],obj[k])) conflicts.push({key:name, nk, lost:obj[k]}); return; }
      out[nk]=obj[k];
    });
    return n ? out : null;
  };
  const names=['planMarks','planSkips','planFood','planLog','planWatch','planCook'];
  const cur={}, changed=new Set();
  names.forEach(k=>{ cur[k]=asObj(store.get(k,{}),{}); const c=conv(cur[k],k); if(c){ cur[k]=c; changed.add(k); } });
  /* досрочные разгрузки лежат в настройках под тем же видом ключа */
  const ps=asObj(store.get('planSet',{}),{});
  if(ps.earlyDl){ const c=conv(ps.earlyDl,'planSet.earlyDl'); if(c){ ps.earlyDl=c; changed.add('planSet'); } }
  /* архив прошлой версии: записи возвращаются на свои числа */
  const arch=asObj(store.get('planArchive',{}),{});
  const hasArch=Object.keys(arch).length>0;
  if(hasArch){
    const into={marks:'planMarks', skips:'planSkips', foodLog:'planFood', logs:'planLog', watch:'planWatch', cook:'planCook'};
    Object.keys(arch).forEach(iso=>Object.keys(into).forEach(name=>{
      const part=arch[iso] && arch[iso][name]; if(!part || typeof part!=='object') return;
      const key=into[name], o=cur[key];
      Object.keys(part).forEach(rest=>{ const nk=iso+rest;
        if(!(nk in o)){ o[nk]=part[rest]; changed.add(key); }
        else if(!same(o[nk],part[rest])) conflicts.push({key, nk, lost:part[rest], from:'planArchive'}); });
    }));
  }
  /* сначала сохраняем то, что не войдёт, и только потом пишем */
  if(conflicts.length){
    if(!saveBad('conflict', JSON.stringify({note:'значения, не вошедшие при переносе старых ключей: ключ уже занят другой записью', items:conflicts}))) return false;
    addAlert('conflict', `При переносе старых записей ${conflicts.length} значений оказались на уже занятых ключах. Они не потеряны: лежат отдельно (planBad:conflict) и в копии planPre5.`, 'y');
  }
  let ok=true;
  changed.forEach(k=>{ if(k==='planSet') ok=store.set('planSet',ps)&&ok; else ok=store.set(k,cur[k])&&ok; });
  if(ok && hasArch) ok=store.set('planArchive',{});   /* только когда перенос подтверждён */
  return ok;
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
/* Почему сдвиг не выполнен (см. shiftDataBy) */
let shiftError=null;   /* 'copy' | 'collision' | 'write' */
const shiftMessage=()=>shiftError==='copy' ? 'Не хватило памяти на копию перед сдвигом дат. Ничего не сдвинуто, записи на месте.'
  : shiftError==='collision' ? 'Сдвиг дат остановлен: после него записи легли бы на одни и те же ключи. Ничего не сдвинуто.'
  : 'Сдвиг дат не записался до конца. Записи возвращены как были.';
/* Сдвиг дат всех записей на delta дней. Возвращает число сдвинутых ключей; -1 — сдвига не было (причина в shiftError,
   данные те же). Порядок: проверка коллизий до записи → копия в planPreOp (обязательна) → запись → при сбое возврат */
function shiftDataBy(delta){
  shiftError=null;
  if(!delta) return 0;
  let n=0, clash=false;
  const mv=obj=>{
    const out={};
    Object.keys(obj).forEach(k=>{
      const m=TAG_RE.exec(k); let nk=k;
      if(m){ nk=addDays(m[1],delta)+(m[2]||''); n++; }
      if(nk in out || /NaN/.test(nk)) clash=true;   /* совпавший или не получившийся ключ — сдвиг отменяется */
      out[nk]=obj[k];
    });
    return out;
  };
  const old={marks, skips, foodLog, logs, watch, cook, earlyDl:settings.earlyDl};
  const nu={marks:mv(marks), skips:mv(skips), foodLog:mv(foodLog), logs:mv(logs), watch:mv(watch), cook:mv(cook), earlyDl:settings.earlyDl?mv(settings.earlyDl):settings.earlyDl};
  if(clash){ shiftError='collision'; return -1; }
  if(!snapshot('перед сдвигом дат')){ shiftError='copy'; return -1; }
  const keys=['planMarks','planSkips','planFood','planLog','planWatch','planCook','planSet'];
  const before={}; keys.forEach(k=>{ const v=ls.get(k); if(v!=null) before[k]=v; });
  ({marks, skips, foodLog, logs, watch, cook}=nu); if(settings.earlyDl) settings.earlyDl=nu.earlyDl;
  const ok=[saveMarks(), saveSkips(), saveFood(), saveLogs(), saveWatch(), saveCook(), saveSettings()].every(x=>x===true);
  if(!ok){
    /* сбой посередине: возвращаем записанные ключи как были и память тоже */
    keys.forEach(k=>{ if(k in before) ls.put(k,before[k]); else ls.del(k); });
    ({marks, skips, foodLog, logs, watch, cook}=old); settings.earlyDl=old.earlyDl;
    loadFoodDay();
    shiftError='write'; return -1;
  }
  loadFoodDay();
  return n;
}
const key=(d,e)=>`${weekTag()}-${d}-${e}`;
function gramOf(dishId,foodId,base){
  const k=`${dishId}-${foodId}`;
  return grams[k]!=null ? grams[k] : Math.round(base*portionFactor()/5)*5;
}
