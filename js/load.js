"use strict";
/* ############################################################
   НАГРУЗКА ЗА НЕДЕЛЮ: тяжесть 1–10 × минуты по всем занятиям,
   включая баскетбол и игры. Простая и самая проверенная мера:
   рост недели больше чем на 30 % к средней прошлых — риск перегруза
   (колено, ахилл). Данные: planLoad, "YYYY-MM-DD" → [{k, min, rpe, id?}]
   ############################################################ */
const saveLoad=()=>store.set('planLoad',loadLog);
const LOAD_KINDS={
  gym:  {n:'Тренировка по плану', min:60},
  ball: {n:'Баскетбол, тренировка', min:90},
  game: {n:'Игра', min:60},
  bike: {n:'Велосипед', min:20},
  strength:{n:'Силовая вне плана', min:60},
  run:{n:'Бег или кросс', min:30},
  other:{n:'Другое', min:45}
};
const RPE_WORDS=['','очень легко','легко','легко','средне','средне','тяжеловато','тяжело','тяжело','очень тяжело','предел'];
const loadEntries=iso=>loadLog[iso]||[];
const loadAU=r=>Math.round((num(r.min)||0)*(num(r.rpe)||0));
function addLoad(iso, rec){ (loadLog[iso]=loadLog[iso]||[]).push(rec); saveLoad(); return rec; }
function removeLoad(iso, rec){
  const L=loadLog[iso]; if(!L) return -1;
  const i=L.indexOf(rec); if(i>=0) L.splice(i,1);
  if(!L.length) delete loadLog[iso]; saveLoad(); return i;
}
/* оценка тренировки по плану: одна запись на день плана, перезаписывается */
const gymLoadOf=(iso,id)=>loadEntries(iso).find(r=>r.k==='gym' && r.id===id)||null;
function setGymLoad(iso, id, min, rpe){
  const L=(loadLog[iso]||[]).filter(r=>!(r.k==='gym' && r.id===id));
  if(rpe!=null) L.push({k:'gym', id, min:Math.max(10,min||60), rpe});
  if(L.length) loadLog[iso]=L; else delete loadLog[iso];
  saveLoad();
}
const mondayOf=iso=>{ const d=new Date(iso+'T12:00:00'); return addDays(iso, -((d.getDay()+6)%7)); };
const dayLoad=iso=>loadEntries(iso).reduce((a,r)=>a+loadAU(r),0);
function weekLoad(mon){ let s=0, n=0; for(let i=0;i<7;i++){ const d=addDays(mon,i); s+=dayLoad(d); n+=loadEntries(d).length; } return {mon, v:s, n}; }
/* последние n недель, текущая — последняя */
function loadWeeks(n){ const m=mondayOf(isoDay()), out=[]; for(let i=n-1;i>=0;i--) out.push(weekLoad(addDays(m,-7*i))); return out; }
/* Скачок: текущая неделя (даже незаконченная) больше средней трёх прошлых на 30 %+.
   Нужны минимум две прошлые недели с записями — иначе сравнивать не с чем */
function loadSpike(){
  const W=loadWeeks(4), cur=W[3], base=W.slice(0,3).filter(w=>w.n>0);
  if(base.length<2 || !cur.v) return null;
  const avg=base.reduce((a,w)=>a+w.v,0)/base.length, ratio=cur.v/avg;
  return ratio>1.3 ? {ratio, cur:cur.v, avg:Math.round(avg)} : null;
}
/* вчера был баскет или игра — утренняя оценка колена «после игры» */
const ballYesterday=iso=>loadEntries(addDays(iso,-1)).some(r=>r.k==='ball'||r.k==='game');

/* ---------- Неделя по дням: выбери день и запиши, что и когда делал ---------- */
let loadOff=0, loadSel=null;   /* loadOff: 0 — эта неделя, −1 — прошлая; loadSel — выбранный день */
const loadMon=()=>addDays(mondayOf(isoDay()), loadOff*7);
function loadSelDay(){
  const mon=loadMon(), end=addDays(mon,6), t=isoDay();
  if(loadSel && loadSel>=mon && loadSel<=end) return loadSel;
  return (t>=mon && t<=end) ? t : mon;
}
const loadKindName=k=>LOAD_KINDS[k]?LOAD_KINDS[k].n:k;
/* подпись недели плана («Н1», «С2» для сессии), до старта плана — пусто */
function loadWeekLabel(mon){
  const p=posForDate(mon);
  if(p.pre) return '';
  if(p.cycle===1 && p.week>12) return `С${p.week-12}`;
  return `${p.cycle>1?`Ц${p.cycle} `:''}Н${p.week}`;
}
const loadSorted=iso=>[...loadEntries(iso)].sort((a,b)=>(a.t||'99:99')<(b.t||'99:99')?-1:1);

/* Лист «Записать занятие»: что, какого числа, во сколько, сколько минут, насколько тяжело */
function loadAddSheet(k0, iso0){
  let k=k0&&LOAD_KINDS[k0]&&k0!=='gym'?k0:'ball', rpe=null;
  const iso=iso0||isoDay();
  openSheet(`<h2>Записать занятие</h2>
    <div class="sub">Баскетбол, игра или что-то вне плана. Минуты × тяжесть 1–10 идут в нагрузку недели.</div>
    <div class="sec">Что делал</div>
    <div class="pills" data-lk>${Object.keys(LOAD_KINDS).filter(x=>x!=='gym').map(x=>`<button type="button" class="pill${x===k?' ghost':''}" style="${x===k?'outline:3px solid var(--acc)':''}" data-k="${x}">${LOAD_KINDS[x].n}</button>`).join('')}</div>
    <div class="btnrow" style="grid-template-columns:1fr 1fr;margin-top:14px">
      <div><div class="small t2" style="font-weight:700;margin-bottom:6px">Когда: день</div><input class="inp small" type="date" data-d value="${iso}" aria-label="День"></div>
      <div><div class="small t2" style="font-weight:700;margin-bottom:6px">Во сколько начал</div><input class="inp small" type="time" data-t value="${iso===isoDay()?nowHM():''}" aria-label="Время начала"></div></div>
    <div class="sec">Сколько минут</div>
    <input class="inp" data-min inputmode="numeric" value="${LOAD_KINDS[k].min}" aria-label="Минут">
    <div class="sec">Насколько было тяжело, 1–10</div>
    <div class="scale10" data-rpe>${Array.from({length:10},(_,i)=>`<button type="button" data-v="${i+1}">${i+1}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:6px" data-rw>Оцени всё занятие в целом: 1 — прогулка, 10 — предел.</div>
    <div class="sec">Заметка (по желанию)</div>
    <input class="inp" data-note placeholder="например: игра 5 на 5, колено ок" maxlength="80" aria-label="Заметка">
    <div class="errtxt" hidden></div>
    <button type="button" class="btn big pri" style="margin-top:14px" data-ok>Записать</button>`,
    (el,close)=>{
      const mi=el.querySelector('[data-min]'), err=el.querySelector('.errtxt');
      el.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{ k=b.dataset.k;
        el.querySelectorAll('[data-k]').forEach(x=>{ const on=x.dataset.k===k; x.classList.toggle('ghost',on); x.style.outline=on?'3px solid var(--acc)':''; });
        mi.value=LOAD_KINDS[k].min; }));
      el.querySelectorAll('[data-rpe] button').forEach(b=>b.addEventListener('click',()=>{ rpe=+b.dataset.v;
        el.querySelectorAll('[data-rpe] button').forEach(x=>x.classList.toggle('on',x===b));
        el.querySelector('[data-rw]').textContent=`${rpe} — ${RPE_WORDS[rpe]}`; vibe(8); }));
      el.querySelector('[data-ok]').addEventListener('click',()=>{
        const m=num(mi.value), d=el.querySelector('[data-d]').value||iso, t=el.querySelector('[data-t]').value||'', note=el.querySelector('[data-note]').value.trim();
        if(m==null || m<5 || m>300){ mi.classList.add('err'); err.hidden=false; err.textContent='Минут от 5 до 300'; return; }
        if(rpe==null){ err.hidden=false; err.textContent='Выбери тяжесть 1–10'; return; }
        const rec={k, min:Math.round(m), rpe}; if(t) rec.t=t; if(note) rec.note=note;
        addLoad(d, rec);
        loadSel=d; loadOff=Math.round(daysBetween(mondayOf(isoDay()), mondayOf(d))/7);
        close(); renderAll();
        toast(`${loadKindName(k)}: ${Math.round(m)} мин × ${rpe} = ${loadAU(rec)}`, ()=>{ removeLoad(d, rec); renderAll(); });
      });
    });
}

/* Карточка «Нагрузка недели»: дни недели, у выбранного дня — что записано, внизу кнопка добавить */
function loadCardHTML(){
  const mon=loadMon(), sel=loadSelDay(), today=isoDay(), days=[0,1,2,3,4,5,6].map(i=>addDays(mon,i));
  const W=weekLoad(mon), prev=weekLoad(addDays(mon,-7)), sp=loadOff===0?loadSpike():null, wl=loadWeekLabel(mon);
  const list=loadSorted(sel);
  const row=(r)=>`<div class="row"><span class="grow"><div class="nm">${esc(loadKindName(r.k))}${r.t?` · ${r.t}`:''}</div><div class="ds">${r.min} мин × ${r.rpe} = ${loadAU(r)}${r.note?` · ${esc(r.note)}`:''}</div></span><button type="button" class="del" data-ldel="${loadEntries(sel).indexOf(r)}" aria-label="Удалить">×</button></div>`;
  return `<div class="card">
    <div class="lhead"><button type="button" class="icbtn" data-lw="-1" aria-label="Прошлая неделя">‹</button>
      <div class="grow"><b>${shortDate(mon)} – ${shortDate(addDays(mon,6))}</b><small>${loadOff===0?'эта неделя':loadOff===-1?'прошлая неделя':'неделя'}${wl?` · ${wl}`:''}</small></div>
      <button type="button" class="icbtn" data-lw="1" aria-label="Следующая неделя" ${loadOff>=0?'disabled':''}>›</button></div>
    <div class="small t2" style="margin:6px 0 10px">Всего за неделю: <b>${W.v||0}</b>${prev.v?` · прошлая неделя ${prev.v}`:''}</div>
    <div class="ldays">${days.map((d,i)=>`<button type="button" class="ld${d===sel?' on':''}${d===today?' today':''}${dayLoad(d)?' has':''}" data-ld="${d}" aria-label="${DOW_IDX[i]} ${shortDate(d)}${dayLoad(d)?`, нагрузка ${dayLoad(d)}`:''}"><span>${DOW_IDX[i]}</span><b>${+d.slice(8)}</b><small>${dayLoad(d)||'·'}</small></button>`).join('')}</div>
    <div class="sec" style="margin-top:14px">${sel===today?'Сегодня':`${DOW_IDX[(new Date(sel+'T12:00:00').getDay()+6)%7]}, ${shortDate(sel)}`}</div>
    ${list.length?list.map(row).join(''):'<div class="t2" style="padding:6px 0">В этот день ничего не записано.</div>'}
    <button type="button" class="btn" style="margin-top:10px" data-ladd>+ Записать, что делал</button>
    ${sp?`<div class="note y" style="margin-top:10px"><b>Неделя тяжелее обычного на ${Math.round((sp.ratio-1)*100)} %</b>Обычно ${sp.avg}, сейчас ${sp.cur}. Резкий рост нагрузки — главный риск для колена и ахилла: убери одно прыжковое занятие или сократи игру, силовые — с запасом 2–3 повтора.</div>`:''}
  </div>`;
}
function bindLoadCard(box){
  box.querySelectorAll('[data-lw]').forEach(b=>b.addEventListener('click',()=>{ loadOff=Math.min(0, loadOff+(+b.dataset.lw)); loadSel=null; renderMe(); }));
  box.querySelectorAll('[data-ld]').forEach(b=>b.addEventListener('click',()=>{ loadSel=b.dataset.ld; renderMe(); }));
  box.querySelectorAll('[data-ladd]').forEach(b=>b.addEventListener('click',()=>loadAddSheet('ball', loadSelDay())));
  box.querySelectorAll('[data-ldel]').forEach(b=>b.addEventListener('click',()=>{
    const iso=loadSelDay(), rec=loadEntries(iso)[+b.dataset.ldel]; if(!rec) return;
    const at=removeLoad(iso, rec); renderAll();
    toast('Запись удалена', ()=>{ (loadLog[iso]=loadLog[iso]||[]).splice(at,0,rec); saveLoad(); renderAll(); });
  }));
}
