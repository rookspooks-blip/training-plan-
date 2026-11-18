"use strict";
/* ############################################################
   НАДЁЖНОСТЬ ДАННЫХ
   Сырые копии, запись с проверкой чтением, миграция формата, ротация автокопий,
   откат восстановления, защита повреждённых значений.
   Правила (docs/migration-5.md):
   1. Формат растёт только добавлением необязательных полей.
   2. Любое разрушительное действие начинается с копии, записанной и проверенной чтением.
      Копия не записалась — действие не выполняется.
   3. Копия хранит исходные строки localStorage как есть, не разобранные и снова собранные.
   4. Записи не удаляются, пока новые не записаны и проверены.
   5. Ошибка записи посередине оставляет данные такими, какими они были.
   ############################################################ */

/* Лимит localStorage в символах (длина значений плюс длина имён ключей).
   Safari даёт порядка 5 МБ на адрес; считает ли он символы или байты UTF-16 — неизвестно.
   Взято осторожное чтение: 5 МБ в UTF-16 это около 2,5 млн символов.
   ПРОВЕРИТЬ НА УСТРОЙСТВЕ (docs/migration-5.md, раздел 8, проба 1) и поправить число */
const LIMIT_CHARS=2500000;
const KEY_PRE5='planPre5', KEY_PREOP='planPreOp';
const AUTO_KEYS=['planAutoBackup','planAuto2','planAuto3'];   /* от свежей к старой */
const FREEABLE=['planAuto3','planAuto2'];   /* копии, которыми можно пожертвовать ради страховочной */
const PRE5_DAYS=14, YOUNG_DAYS=3;
const PROG_DEFAULT={v:2, from:'2026-11-09'};

/* ---------- Низкий уровень: сырые строки ---------- */
const ls={
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  /* запись считается удавшейся, только если чтение обратно вернуло ту же строку */
  put(k,s){ try{ localStorage.setItem(k,s); return localStorage.getItem(k)===s; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); return localStorage.getItem(k)===null; }catch(e){ return false; } },
  keys(){ const r=[]; try{ for(let i=0;i<localStorage.length;i++) r.push(localStorage.key(i)); }catch(e){} return r; }
};
const ALL_KEYS=()=>[...DATA_KEYS, ...LEGACY_KEYS];
/* Сырые строки всех ключей данных. Неразобравшиеся значения тоже берутся */
function rawData(){ const r={}; ALL_KEYS().forEach(k=>{ const v=ls.get(k); if(v!=null) r[k]=v; }); return r; }
const EMPTYISH=new Set(['','{}','[]','null','""']);
/* Есть ли что защищать. Одной позиции в плане (planPos) мало: пустое состояние не должно вытеснять копии */
const hasMeaning=raw=>ALL_KEYS().some(k=>{
  if(k==='planPos' || raw[k]==null || EMPTYISH.has(raw[k])) return false;
  if(k==='planSet'){   /* одно только planSet.prog пишет миграция сама: это не данные пользователя */
    try{ const o=JSON.parse(raw[k]); if(o && typeof o==='object' && !Object.keys(o).some(x=>x!=='prog')) return false; }catch(e){}
  }
  return true;
});
const rawEqual=(a,b)=>{ const ka=Object.keys(a), kb=Object.keys(b); return ka.length===kb.length && ka.every(k=>a[k]===b[k]); };
const rawLen=r=>Object.keys(r).reduce((n,k)=>n+r[k].length,0);

/* Номер формата из значения: целое от 1. Не число — как будто ключа нет (проходит миграцию один раз) */
function normSchema(j){
  const n=typeof j==='string' && j.trim()!=='' ? Number(j) : j;
  return Number.isInteger(n) && n>=1 ? n : 1;
}
function schemaOf(raw){ if(raw==null) return 1; try{ return normSchema(JSON.parse(raw)); }catch(e){ return 1; } }

/* ---------- Постоянные строки о проблемах с данными (настройки и «Сейчас») ---------- */
const dataAlerts=new Map();
const addAlert=(id,text,lvl)=>dataAlerts.set(id,{text,lvl:lvl||'r'});
function alertsHTML(){
  return [...dataAlerts.values()].map(a=>`<div class="note ${a.lvl}" data-dalert><b>${a.lvl==='r'?'Данные под угрозой':'О данных'}</b>${esc(a.text)}
    <button type="button" class="btn" style="margin-top:8px" data-alert-save>Сохранить файл копии</button></div>`).join('');
}
function bindAlerts(box){ box.querySelectorAll('[data-alert-save]').forEach(b=>b.addEventListener('click',()=>exportBackup())); }

/* ---------- Снимки ---------- */
function snapObj(kind, reason, raw){
  const sr=ls.get('planSchema');
  return {app:'tri-cikla', kind, reason, schema:schemaOf(sr), schemaRaw:sr, saved:new Date().toISOString(), raw};
}
/* Запись страховочной копии. Не вышло — освобождаем место старшими автокопиями (это копии, не данные) и пробуем ещё.
   keep — ключ копии, из которой сейчас идёт восстановление: её не трогаем */
function putSafe(key, str, freeable, keep){
  if(ls.put(key,str)) return true;
  for(const f of (freeable||[])){
    if(f===keep || ls.get(f)==null) continue;
    ls.del(f);
    if(ls.put(key,str)) return true;
  }
  return false;
}
function writeSnap(key, kind, reason, raw, keep){
  const obj=snapObj(kind,reason,raw), str=JSON.stringify(obj);
  return {ok:putSafe(key,str,FREEABLE,keep), obj, str};
}
/* Снимок текущих данных в указанный слот (по умолчанию planPreOp). true — копия записана и проверена
   (или защищать нечего); false — не записалась, разрушительное действие делать нельзя */
function snapshot(reason, key){
  key=key||KEY_PREOP;
  const raw=rawData();
  if(key===KEY_PRE5 ? !Object.keys(raw).length : !hasMeaning(raw)) return true;
  return writeSnap(key, key===KEY_PRE5?'pre5':'preop', reason, raw).ok;
}
/* Копия перед операцией. written — копия лежит в planPreOp; obj всегда есть в памяти для отката */
function makePreOp(reason, keep){
  const raw=rawData();
  if(!hasMeaning(raw)) return {ok:true, written:false, obj:snapObj('preop',reason,raw)};
  const w=writeSnap(KEY_PREOP,'preop',reason,raw,keep);
  return {ok:w.ok, written:w.ok, obj:w.obj};
}
function readSlot(key){
  const s=ls.get(key); if(s==null) return null;
  let o=null; try{ o=JSON.parse(s); }catch(e){}
  return {key, str:s, obj:o && typeof o==='object' && !Array.isArray(o) ? o : null};
}
/* Сырые строки из копии: новый вид (raw), старый v79 (data, разобранные) или файл (data плюс bad) */
function slotRaw(o){
  if(!o || typeof o!=='object') return null;
  const r={}, all=ALL_KEYS();
  if(o.raw && typeof o.raw==='object' && !Array.isArray(o.raw)){
    all.forEach(k=>{ if(typeof o.raw[k]==='string') r[k]=o.raw[k]; });
  }else if(o.data && typeof o.data==='object' && !Array.isArray(o.data)){
    all.forEach(k=>{ if(k in o.data) r[k]=JSON.stringify(o.data[k]); });
    if(o.bad && typeof o.bad==='object') all.forEach(k=>{ if(!(k in r) && typeof o.bad[k]==='string') r[k]=o.bad[k]; });
  }else return null;
  return r;
}

/* Записать набор сырых строк на место данных: сначала запись ключей (каждая атомарна: старое или новое значение),
   потом удаление лишних, номер формата последним. false — что-то не записалось */
function applyRaw(raw, schemaRaw){
  const keys=ALL_KEYS();
  for(const k of keys){ if(k in raw && !ls.put(k,raw[k])) return false; }
  for(const k of keys){ if(!(k in raw) && !ls.del(k)) return false; }
  return schemaRaw==null ? ls.del('planSchema') : ls.put('planSchema',schemaRaw);
}
/* Вернуть данные из копии перед операцией. Берём то, что лежит в planPreOp; нет — из памяти.
   true — данные снова такие, какими были */
function rollbackRaw(pre){
  let bs=pre.obj;
  if(pre.written){ const s=readSlot(KEY_PREOP); if(s && s.obj && s.obj.raw) bs=s.obj; }
  if(!applyRaw(bs.raw, bs.schemaRaw)) return false;
  return rawEqual(rawData(), bs.raw);
}

/* ---------- Повреждённые значения: сырая строка в planBad до любой перезаписи ---------- */
const KEY_TYPE={planCirc:'a', planTests:'a', planFav:'a'};   /* остальные ключи данных — объекты */
function saveBad(tag, str){
  const pref=`planBad:${tag}:`;
  for(const k of ls.keys()) if(k.startsWith(pref) && ls.get(k)===str) return true;   /* уже сохранено раньше */
  const date=isoDay();
  for(let i=1;i<50;i++){ const k=pref+date+(i>1?'#'+i:''); if(ls.get(k)==null) return ls.put(k,str); }
  return false;
}
function guardBadData(){
  DATA_KEYS.forEach(k=>{
    const s=ls.get(k); if(s==null || s==='') return;
    let v, ok=true;
    try{ v=JSON.parse(s); }catch(e){ ok=false; }
    if(ok) ok = KEY_TYPE[k]==='a' ? Array.isArray(v) : !!(v && typeof v==='object' && !Array.isArray(v));
    if(ok) return;
    if(!saveBad(k,s)){
      blockedKeys.add(k);
      addAlert('bad:'+k, `Данные «${k}» повреждены, и сохранить их строку не вышло. Новые записи в них не пишутся, чтобы не затереть. Сохрани файл копии.`);
    }
  });
}

/* ---------- Миграция формата ---------- */
let migrateIssue=null;   /* почему миграция остановилась: 'nospace' | 'write' */
/* Старая копия v79 с причиной (перед удалением, перед восстановлением) могла быть единственной у пользователя.
   Переносим её в planPreOp до любой ротации. Занято — остаётся в planAutoBackup и уходит в ротацию как есть */
function keepOldOpCopy(){
  const s=ls.get('planAutoBackup'); if(s==null) return true;
  let o=null; try{ o=JSON.parse(s); }catch(e){}
  if(!o || typeof o!=='object' || !o.reason || o.kind) return true;
  if(ls.get(KEY_PREOP)!=null) return true;
  return putSafe(KEY_PREOP, s, FREEABLE);
}
/* planSet.prog: только если ещё нет. Правим копию значения из хранилища, не settings в памяти */
function addProg(){
  const s=ls.get('planSet'); let o;
  if(s==null) o={};
  else{ try{ o=JSON.parse(s); }catch(e){ return true; } if(!o || typeof o!=='object' || Array.isArray(o)) return true; }
  if(o.prog!=null) return true;
  o.prog={...PROG_DEFAULT};
  return ls.put('planSet', JSON.stringify(o));
}
function migrate(){
  const v0=schemaOf(ls.get('planSchema'));
  if(v0>=SCHEMA) return true;
  migrateIssue=null;
  const stop=why=>{
    migrateIssue=why;
    addAlert('migrate', why==='nospace'
      ? 'Не хватило памяти на страховочную копию перед обновлением формата. Приложение работает на старом формате, данные не тронуты. Сохрани файл копии.'
      : 'Обновление формата данных не записалось полностью. Приложение работает на старом формате, данные не потеряны. Сохрани файл копии.');
    return false;
  };
  /* 1-3. Страховочный снимок: сырые строки, проверка чтением. Ключ уже есть — не трогаем */
  const raw=rawData();
  if(Object.keys(raw).length && ls.get(KEY_PRE5)==null){
    if(!writeSnap(KEY_PRE5,'pre5',`миграция ${v0}→${SCHEMA}`,raw).ok) return stop('nospace');
  }
  let v=v0;
  if(v<2){
    /* граммовки и своя еда давно хранятся внутри дней planFood. Старые общие ключи удаляем, только если
       их точная копия лежит в planPre5 */
    const p5=readSlot(KEY_PRE5), p5raw=p5 && slotRaw(p5.obj);
    LEGACY_KEYS.forEach(k=>{ const cur=ls.get(k); if(cur!=null && p5raw && p5raw[k]===cur) ls.del(k); });
    v=2;
  }
  if(v<3){ v=3; }   /* формат 3: добавлен planCook, ничего не переписывается */
  if(v<4){
    /* формат 4: «цикл-неделя-…» → «дата понедельника недели-…» */
    if(!convertLegacyKeys()) return stop('write');
    v=4;
  }
  /* 4 → 5: ничего существующего не меняется */
  if(!keepOldOpCopy()) return stop('nospace');
  if(!addProg()) return stop('write');
  if(v0===4 && !store.set('planShiftChecked',true)) return stop('write');
  if(!ls.put('planSchema', String(SCHEMA))) return stop('write');
  return true;
}

/* ---------- Автокопии: ротация раз в день ---------- */
const usedChars=()=>ls.keys().reduce((n,k)=>n+k.length+(ls.get(k)||'').length, 0);
const ageDays=iso=>{ const t=Date.parse(iso); return isNaN(t) ? null : (Date.now()-t)/864e5; };
function autoRotate(){
  if(schemaOf(ls.get('planSchema'))<SCHEMA) return false;
  const today=isoDay();
  if(store.get('planAutoDay',null)===today) return true;
  const raw=rawData();
  if(!hasMeaning(raw)) return true;   /* пустое состояние не должно вытеснять хорошие копии */
  const slots=AUTO_KEYS.map(readSlot), [S1,S2,S3]=slots;
  const cur1=S1 && slotRaw(S1.obj);
  if(cur1 && rawEqual(cur1,raw)){ store.set('planAutoDay',today); return true; }   /* без изменений: слоты не двигаем */
  const str=JSON.stringify(snapObj('daily','ежедневная копия',raw)), S=str.length;
  const LIM=LIMIT_CHARS;
  const dailyLen=()=>AUTO_KEYS.reduce((n,k)=>{ const s=ls.get(k); return n+(s==null?0:k.length+s.length); },0);
  /* сколько копий помещается: 3 при занятых 60 % лимита, 2 при 70 %, 1 при 80 % */
  const howMany=()=>{ const base=usedChars()-dailyLen();
    return base+3*S<=.6*LIM ? 3 : base+2*S<=.7*LIM ? 2 : base+S<=.8*LIM ? 1 : 0; };
  let k=howMany();
  /* planPre5 защищён 14 дней. Потом при нехватке места уходит раньше ежедневных копий,
     но только если есть успешная ежедневная копия младше 3 дней */
  const p5=readSlot(KEY_PRE5);
  const p5old=!!(p5 && p5.obj && ageDays(p5.obj.saved)!=null && ageDays(p5.obj.saved)>=PRE5_DAYS);
  const young=s=>!!(s && s.obj && ageDays(s.obj.saved)!=null && ageDays(s.obj.saved)<YOUNG_DAYS);
  if(k<3 && p5old && slots.some(young)){ ls.del(KEY_PRE5); k=howMany(); }
  /* данных заметно меньше, чем в свежей копии: старые копии не вытесняем */
  const shrunk=!!(cur1 && rawLen(raw)<0.5*rawLen(cur1));
  if(shrunk) addAlert('auto-shrunk','Данных стало вдвое меньше, чем в прошлой автокопии. Прошлая копия сохранена и не вытеснена.','y');
  if(k===0 || (shrunk && k<2)){
    addAlert('auto-space', k===0 ? 'Автокопии не помещаются в память телефона. Сохрани файл копии: он не зависит от места.'
      : 'Данных стало вдвое меньше, а места на ещё одну копию нет. Прошлая копия оставлена. Сохрани файл копии.', 'y');
    return false;
  }
  /* Сдвиг от старшего к младшему: ни один слот не затирается, пока соседний не записан */
  let ok=true;
  if(shrunk){
    ok=!S1 || ls.put('planAuto2',S1.str);
    ok=ok && ls.put('planAutoBackup',str);
  }else if(k>=3){
    ok=!S2 || ls.put('planAuto3',S2.str);
    ok=ok && (!S1 || ls.put('planAuto2',S1.str));
    ok=ok && ls.put('planAutoBackup',str);
  }else if(k===2){
    ok=!S1 || ls.put('planAuto2',S1.str);
    ok=ok && ls.put('planAutoBackup',str);
    if(ok) ls.del('planAuto3');
  }else{
    ok=ls.put('planAutoBackup',str);
    if(ok){ ls.del('planAuto2'); ls.del('planAuto3'); }
  }
  if(!ok){ addAlert('auto-write','Автокопия не записалась: не хватает места. Данные не тронуты. Сохрани файл копии.','y'); return false; }
  /* новая копия записана и проверена: если места по-прежнему мало, просроченную planPre5 можно убрать */
  if(k<3 && p5old) ls.del(KEY_PRE5);
  store.set('planAutoDay',today);
  return true;
}

/* Копии, которые можно вернуть: для выбора в настройках */
function listSlots(){
  const out=[];
  const fmt=iso=>{ const d=new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}); };
  [['planAutoBackup'],['planAuto2'],['planAuto3'],[KEY_PREOP],[KEY_PRE5]].forEach(([key])=>{
    const s=readSlot(key); if(!s || !s.obj) return;
    const r=slotRaw(s.obj); if(!r || !Object.keys(r).length) return;
    const cnt=k=>{ try{ return Object.keys(JSON.parse(r[k]||'{}')).length; }catch(e){ return 0; } };
    const o=s.obj, kind=o.kind || (o.reason ? 'preop' : 'daily');
    const title = key===KEY_PRE5 ? 'Перед обновлением формата'
      : key===KEY_PREOP ? `Копия ${o.reason||'перед операцией'}`
      : kind==='daily' ? 'Ежедневная автокопия' : `Старая автокопия: ${o.reason||''}`;
    out.push({key, str:s.str, obj:o, title, sub:`${fmt(o.saved)} · записей упражнений ${cnt('planLog')}, дней с замерами ${cnt('planBody')}`});
  });
  return out;
}
