"use strict";
/* ############################################################
   СВЯЗЬ С IPHONE
   Импорт из «Здоровья» через «Команды» (строка в буфере обмена или ссылка),
   защита хранилища от очистки, значок на иконке приложения.
   Веб не читает «Здоровье» напрямую — его читает команда и передаёт строкой:
   w=76.4&hr=58&sleep=7.5&ws=17:05&we=18:20&whr=128&wmx=165&wkc=420&d=2026-10-22
   ============================================================ */
const HEALTH_SAMPLE='w=76.4&hr=58&sleep=7.5&ws=17:05&we=18:20&whr=128&wmx=165&wkc=420';
const HEALTH_KEYS=/(^|[&\n;])\s*(w|hr|sleep|ws|we|whr|wmx|wkc|d)\s*[=:]/i;

/* Разбор: «w=76,4&hr=58», по строкам, через «;» или JSON */
function parseHealth(text){
  const o={}; let s=String(text||'').trim().replace(/^[?#]/,'');
  if(s[0]==='{'){ try{ const j=JSON.parse(s); Object.keys(j).forEach(k=>o[k.toLowerCase()]=String(j[k])); return o; }catch(e){} }
  s.split(/[&\n;]+/).forEach(p=>{ const m=p.trim().match(/^([a-z]+)\s*[=:]\s*(.+)$/i); if(m) o[m[1].toLowerCase()]=m[2].trim().replace(',','.'); });
  return o;
}
/* Что записать, что не принято и почему. Ничего не пишет */
function planHealth(o){
  const bad=[], put={}, iso=o.d||isoDay();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso>isoDay()){ return {err:`Дата «${o.d}» не подходит: нужна прошедшая или сегодняшняя, ГГГГ-ММ-ДД`}; }
  const n=(k,lo,hi,name)=>{ if(o[k]==null||o[k]==='') return; const x=num(o[k]); if(x==null||x<lo||x>hi) bad.push(`${name} ${o[k]}`); else put[k]=Math.round(x*10)/10; };
  n('w',30,200,'вес'); n('hr',30,150,'пульс'); n('sleep',0,16,'сон');
  const wk={};
  const t=(k,name)=>{ if(o[k]==null||o[k]==='') return; const m=String(o[k]).match(/^(\d{1,2}):(\d{2})$/); if(!m||+m[1]>23||+m[2]>59) bad.push(`${name} ${o[k]}`); else wk[k]=pad2(+m[1])+':'+m[2]; };
  t('ws','начало'); t('we','конец');
  const w2=(k,lo,hi,name)=>{ if(o[k]==null||o[k]==='') return; const x=num(o[k]); if(x==null||x<lo||x>hi) bad.push(`${name} ${o[k]}`); else wk[k]=Math.round(x); };
  w2('whr',30,240,'средний пульс'); w2('wmx',30,240,'макс. пульс'); w2('wkc',0,5000,'ккал');
  return {iso, put, wk, bad};
}
function applyHealth(o){
  const P=planHealth(o);
  if(P.err){ toast(P.err); return false; }
  const {iso,put,wk,bad}=P, parts=[], undo=[];
  const prevBody=body[iso]?JSON.stringify(body[iso]):null;
  if(put.w!=null){ setBody(iso,'w',put.w); parts.push(`вес ${fmt1(put.w)} кг`); }
  if(put.hr!=null){ setBody(iso,'hr',Math.round(put.hr)); parts.push(`пульс ${Math.round(put.hr)}`); }
  if(put.sleep!=null){ setBody(iso,'sleep',put.sleep); parts.push(`сон ${fmt1(put.sleep)} ч`); }
  undo.push(()=>{ if(prevBody) body[iso]=JSON.parse(prevBody); else delete body[iso]; saveBody(); });
  /* тренировка: в этот день по плану, не отменённая */
  if(Object.keys(wk).length){
    const pos=posForDate(iso);
    let placed=false;
    if(!pos.pre){
      withWeek(pos.cycle,pos.week,()=>{
        const dow=dOf(iso).getDay();
        const es=buildWeek().filter(e=>e.dow===dow && (e.type==='gym'||e.type==='run') && !isDropped(e.id));
        /* две тренировки в день (баскет утром + Силовая Б вечером) — та, что ближе по времени начала */
        const gyms=es.filter(x=>x.type==='gym'), near=x=>Math.abs((hm2min(trainingTime(x))||0)-(hm2min(wk.ws)||0));
        const e=(wk.ws && gyms.length>1 ? gyms.slice().sort((a,b)=>near(a)-near(b))[0] : gyms[0])||es[0];
        if(!e) return;
        const k=watchKey(e.id), prev=watch[k]?JSON.stringify(watch[k]):null;
        Object.entries({ws:'s',we:'e',whr:'hr',wmx:'mx',wkc:'kc'}).forEach(([from,to])=>{ if(wk[from]!=null) setWatch(e.id,to,wk[from]); });
        placed=true; parts.push(`${e.type==='gym'?e.day.title:e.title}: ${[wk.ws&&wk.we?`${wk.ws}–${wk.we}`:'', wk.whr?`пульс ${wk.whr}`:'', wk.wkc?`${wk.wkc} ккал`:''].filter(Boolean).join(', ')||'данные часов'}`);
        undo.push(()=>{ withWeek(pos.cycle,pos.week,()=>{ if(prev) watch[k]=JSON.parse(prev); else delete watch[k]; saveWatch(); }); });
      });
    }
    if(!placed) bad.push('тренировка: в этот день по плану её нет');
  }
  if(!parts.length){ toast(bad.length?`Нечего записывать: ${bad.join(', ')}`:'В строке нет данных: нужны w, hr, sleep или ws/we'); return false; }
  renderAll();
  toast(`Из «Здоровья»: ${parts.join(' · ')}${bad.length?` · не принято: ${bad.join(', ')}`:''}`, ()=>{ undo.forEach(f=>f()); renderAll(); });
  return true;
}
/* Кнопка «Вставить из Здоровья»: буфер → если пусто или не разрешили, окно для ручной вставки */
async function pasteHealth(){
  let t=''; try{ t=await navigator.clipboard.readText(); }catch(e){}
  if(t && HEALTH_KEYS.test(t)){ closeSheets(); applyHealth(parseHealth(t)); return; }
  openSheet(`<h2>Вставить из «Здоровья»</h2><div class="sub">В буфере обмена нет строки от команды. Вставь её сюда вручную.</div>
    <textarea class="inp area" data-t placeholder="${HEALTH_SAMPLE}" aria-label="Строка из «Команд»"></textarea>
    <div class="errtxt" hidden></div>
    <button type="button" class="btn big pri" style="margin-top:12px" data-ok>Записать</button>
    <button type="button" class="btn" style="margin-top:10px" data-close>Отмена</button>`,
    (el,close)=>el.querySelector('[data-ok]').addEventListener('click',()=>{
      const v=el.querySelector('[data-t]').value;
      if(!HEALTH_KEYS.test(v)){ const e=el.querySelector('.errtxt'); e.hidden=false; e.textContent='Не вижу данных. Нужен вид: '+HEALTH_SAMPLE; return; }
      close(); applyHealth(parseHealth(v));
    }));
}
/* Если открыли ссылкой …/?w=76.4&hr=58 — записываем и убираем параметры из адреса */
function importFromLocation(){
  const q=location.search;
  if(!q || !HEALTH_KEYS.test(q.slice(1))) return;
  try{ history.replaceState(null,'',location.pathname+location.hash); }catch(e){}
  applyHealth(parseHealth(q));
}

/* ---------- Хранилище и значок ---------- */
function persistStorage(){
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
}
const badgeSupported=()=> 'setAppBadge' in navigator;
function updateBadge(){
  try{
    if(!badgeSupported()) return;
    if(backupDue()) navigator.setAppBadge(1).catch(()=>{}); else navigator.clearAppBadge().catch(()=>{});
  }catch(e){}
}
async function enableBadge(){
  try{
    if(!('Notification' in window)){ toast('Этот браузер не умеет показывать значок'); return; }
    const r=await Notification.requestPermission();
    toast(r==='granted' ? 'Значок включён: появится, когда пора сохранить копию' : 'Разрешение не дано — значка не будет');
    updateBadge();
  }catch(e){ toast('Не получилось включить значок'); }
}
