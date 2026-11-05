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

/* Лист «Добавить занятие»: вид, минуты, тяжесть 1–10 */
function loadAddSheet(k0, iso0){
  let k=k0||'ball', rpe=null;
  const iso=iso0||isoDay();
  openSheet(`${iso!==isoDay()?`<div class="kick">${shortDate(iso)}</div>`:''}<h2>Нагрузка: занятие</h2>
    <div class="sub">Баскетбол, игра или что-то вне плана. Минуты × тяжесть 1–10 — так считается нагрузка недели.</div>
    <div class="pills" data-lk>${Object.keys(LOAD_KINDS).filter(x=>x!=='gym').map(x=>`<button type="button" class="pill${x===k?' ghost':''}" style="${x===k?'outline:3px solid var(--acc)':''}" data-k="${x}">${LOAD_KINDS[x].n}</button>`).join('')}</div>
    <div class="sec">Минут</div>
    <input class="inp" data-min inputmode="numeric" value="${LOAD_KINDS[k].min}" aria-label="Минут">
    <div class="sec">Тяжесть всего занятия, 1–10</div>
    <div class="scale10" data-rpe>${Array.from({length:10},(_,i)=>`<button type="button" data-v="${i+1}">${i+1}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:6px" data-rw>Оцени через 15–30 минут после конца: насколько тяжело было в целом.</div>
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
        const m=num(mi.value);
        if(m==null || m<5 || m>300){ mi.classList.add('err'); err.hidden=false; err.textContent='Минут от 5 до 300'; return; }
        if(rpe==null){ err.hidden=false; err.textContent='Выбери тяжесть 1–10'; return; }
        const rec=addLoad(iso, {k, min:Math.round(m), rpe}); close(); renderAll();
        toast(`${LOAD_KINDS[k].n}: ${Math.round(m)} мин × ${rpe} = ${loadAU(rec)}`, ()=>{ removeLoad(iso, rec); renderAll(); });
      });
    });
}

/* Карточка нагрузки: 6 недель столбиками, текущая — выделена, вывод */
/* подпись столбика: номер недели плана («Н1», «С2» для сессии), до старта плана — дата понедельника */
function loadWeekLabel(mon){
  const p=posForDate(mon);
  if(p.pre) return shortDate(mon);
  if(p.cycle===1 && p.week>12) return `С${p.week-12}`;
  return `${p.cycle>1?`Ц${p.cycle} `:''}Н${p.week}`;
}
function loadCardHTML(){
  const W=loadWeeks(6);
  /* пустые недели до старта плана не показываем (остаются минимум две) */
  while(W.length>2 && posForDate(W[0].mon).pre && !W[0].n) W.shift();
  const mx=Math.max(1,...W.map(w=>w.v)), sp=loadSpike(), last=W.length-1;
  const any=W.some(w=>w.n);
  const base=W.slice(Math.max(0,last-3),last).filter(w=>w.n), avg=base.length?Math.round(base.reduce((a,w)=>a+w.v,0)/base.length):null;
  const bars=W.map((w,i)=>`<div class="lw${i===last?' cur':''}"><b class="n">${w.v||''}</b><i style="height:${Math.max(3,Math.round(w.v/mx*70))}px"></i><span>${loadWeekLabel(w.mon)}</span></div>`).join('');
  const today=loadEntries(isoDay());
  return `<div class="card"><div class="lbars" style="grid-template-columns:repeat(${W.length},1fr)">${bars}</div>
    ${!any?'<div class="t2" style="margin-top:8px">Пока пусто. Оценивай тяжесть в итоге тренировки, а баскетбол и игры добавляй кнопкой ниже.</div>'
      : sp?`<div class="note y" style="margin-top:10px"><b>Неделя тяжелее обычного на ${Math.round((sp.ratio-1)*100)} %</b>Обычно ${sp.avg}, сейчас ${sp.cur}. Резкий рост нагрузки — главный риск для колена и ахилла: убери одно прыжковое занятие или сократи игру, силовые — с запасом 2–3 повтора.</div>`
      : `<div class="small muted" style="margin-top:8px">${avg!=null?`Средняя прошлых недель ${avg}. Рост больше чем на 30 % за неделю — сигнал притормозить.`:'Сравнение появится после двух недель с записями.'}</div>`}
    ${today.length?`<div class="sec" style="margin-top:12px">Сегодня</div>${today.map((r,i)=>`<div class="row"><span class="grow"><div class="nm">${esc(LOAD_KINDS[r.k]?LOAD_KINDS[r.k].n:r.k)}</div><div class="ds">${r.min} мин × ${r.rpe} = ${loadAU(r)}</div></span><button type="button" class="del" data-ldel="${i}" aria-label="Удалить">×</button></div>`).join('')}`:''}
    <button type="button" class="btn" style="margin-top:10px" data-ladd>+ Баскетбол или игра</button></div>`;
}
function bindLoadCard(box){
  box.querySelectorAll('[data-ladd]').forEach(b=>b.addEventListener('click',()=>loadAddSheet('ball')));
  box.querySelectorAll('[data-ldel]').forEach(b=>b.addEventListener('click',()=>{
    const iso=isoDay(), rec=loadEntries(iso)[+b.dataset.ldel]; if(!rec) return;
    const at=removeLoad(iso, rec); renderAll();
    toast('Занятие удалено', ()=>{ (loadLog[iso]=loadLog[iso]||[]).splice(at,0,rec); saveLoad(); renderAll(); });
  }));
}
