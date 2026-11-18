"use strict";
/* ############################################################
   ЛИСТЫ ТРЕНИРОВКИ: «Как делать», «Не получается?», «Время и пульс с часов»
   Вынесены из плеера без изменения поведения. Листы вызываются и из других вкладок.
   «Как делать» теперь хранит фото, технику, подводку, замену и таймер темпа:
   с рабочего экрана плеера всё это ушло сюда (E3.1).
   ############################################################ */
/* ---------- «Как делать»: фото, текст, подводка, замена ---------- */
/* step - подход упражнения в плеере: тогда в листе появляются строка «Сегодня» (откуда вес) и таймер темпа, его повторы встают в значения панели */
function techSheet(tech, name, ex, step){
  const t=TECH[tech]||{text:'<p>Описание будет добавлено.</p>'};
  let sub='';
  if(ex){
    if(ex.sub) sub=`<div class="note i"><b>Замена для «${esc(ex.sub.from)}»</b>${esc(ex.sub.why)}. <button type="button" class="link" data-sub="${esc(ex.sub.from)}" data-on="0">Вернуть «${esc(ex.sub.from)}»</button></div>`;
    else { const A=ALTS[ex.name]; if(A && !plSkipDose(ex)) sub=`<div class="note i"><b>Если ${esc(A.why)}</b><button type="button" class="link" data-sub="${esc(ex.name)}" data-on="1">заменить на «${esc(A.name)}»</button></div>`; }
  }
  openSheet(`<h2>${esc(name||'')}</h2>${ex?`<div class="sub">${esc(ex.dose)}${ex.rest&&ex.rest!=='—'?` · отдых ${esc(ex.rest)}`:''}</div>`:''}
    ${figFor(tech,name)}
    ${step&&tempoOf(ex,plValues(step))?'<div data-tempo style="margin-top:12px"></div>':''}
    ${step&&plValues(step).pl.t?`<div class="note i" style="margin-top:12px"><b>Сегодня</b>${plValues(step).pl.t}</div>`:''}
    ${step?`<div class="small muted" style="margin-top:8px">${plValues(step).WK.hint}</div>`:''}
    ${ex&&ex.warm?`<div class="note" style="margin-top:12px"><b>Подводка</b>${ex.warm}</div>`:''}
    <div class="tech" style="margin-top:12px">${t.text}</div>${sub}
    <button type="button" class="btn big" style="margin-top:14px" data-close>Закрыть</button>`,
    (el,close)=>{
      const b=el.querySelector('[data-sub]'); if(b) b.addEventListener('click',()=>{
        const from=b.dataset.sub, onv=b.dataset.on==='1'; setSub(from, onv); close(); renderAll();
        toast(onv?'Заменено — журнал этого упражнения отдельный':`Вернул «${from}»`, ()=>{ setSub(from,!onv); renderAll(); }); });
      const tb=el.querySelector('[data-tempo]');
      if(tb){ TM.st=step; tb.innerHTML=tmHTML(ex, plValues(step)); tmBind(tb); }
    }, {onClose:()=>{ if(TM.on) tmOff(); TM.st=null; if(typeof plPatchPanel==='function') plPatchPanel(); }});
}

/* ---------- «Не получается?»: пропуск, перенос, физры не было, болею ---------- */
function notWorkingSheet(id){
  const e=buildWeek().find(x=>x.id===id); if(!e) return;
  const dropped=isDropped(id), moved=isMoved(id) && !dropped;
  const snap=JSON.stringify(skips);
  const undo=()=>{ skips=JSON.parse(snap); saveSkips(); renderAll(); };
  const title=e.type==='gym'?e.day.title:e.title;
  if(dropped){
    openSheet(`<h2>${esc(title)}</h2><div class="sub">Отменено на этой неделе. ${DROP_ADVICE[id]||(e.type==='run'?DROP_ADVICE.run:DROP_ADVICE.d1)}</div>
      <button type="button" class="btn big pri" data-un>Вернуть день</button><button type="button" class="btn" style="margin-top:10px" data-close>Закрыть</button>`,
      (el,close)=>el.querySelector('[data-un]').addEventListener('click',()=>{ close(); unskip(id); toast('День возвращён', undo); }));
    return;
  }
  const speed=id==='d2'||id==='d4'||id==='c-tue', pe=id==='d2' && !isSession() && !summerMode();
  const run=e.type==='run';
  /* суббота: утром баскет в вузе — включается здесь же, у Силовой Б; у самого баскета — выключается */
  const ballOpt = !v2On() && (id==='d7' || (id==='d3' && e.dow===6)) ? [{a:'ball', t:ballSat()?'Баскета не будет':'Утром баскет в вузе',
    s:ballSat()?'Силовая Б снова днём, в 12:00':'утром вторая скоростная и игра, Силовая Б уедет на вечер, без стартов и прыжков'}] : [];
  const opts = id==='d7' ? [...ballOpt, {a:'ill', t:'Болею', s:'пауза до конца недели, после — мягкое возвращение'}] : [
    {a:'skip', t:moved?'Снова не сделал':'Пропустил',
     s:run?'кардио не переносится — догонять не надо':moved?'отменить тренировку на этой неделе':(speed?'скоростная не переносится — просто отменится':'перенести на ближайший подходящий день')},
    ...(moved?[{a:'back', t:'Вернуть в свой день', s:'перенос не нужен'}]:[]),
    ...(pe?[{a:'pe', t:noPE()?'Физра всё-таки была':'Физры не было', s:noPE()?'вернуть скоростную после физры':'прыжки дома, выносливость — горкой на дорожке'}]:[]),
    ...ballOpt,
    {a:'ill', t:'Болею', s:'пауза до конца недели, после — мягкое возвращение'}
  ];
  openSheet(`<h2>${id==='d7'||(id==='d3'&&e.dow===6)?'Что меняется?':'Не получается?'}</h2><div class="sub">${esc(DOW_FULL[e.dow])} · ${esc(title)}</div>
    ${opts.map(o=>`<button type="button" class="opt${o.a==='ill'?' danger':''}" data-a="${o.a}"><span class="grow"><b>${o.t}</b><span>${o.s}</span></span></button>`).join('')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Отмена</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',async()=>{
      const a=b.dataset.a; close();
      if(a==='skip'){
        if((speed||run) && !moved){ skips[skipKey(id)]=true; skips[dropKey(id)]=true; saveSkips(); renderAll(); toast(run?'Кардио пропущено — догонять не надо':'Отменено на этой неделе', undo); }
        else { toggleSkip(id); toast(isDropped(id)?'Отменено на этой неделе':'Перенесено — новый день виден в неделе', undo); }
      }
      else if(a==='back'){ unskip(id); toast('Вернул в свой день', undo); }
      else if(a==='pe'){ togglePE(); toast(noPE()?'Физры не было — прыжки дома':'Скоростная снова после физры', undo); }
      else if(a==='ball'){ toggleBall(); toast(ballSat()?'Суббота: баскет утром, Силовая Б в 18:00':'Баскета нет — Силовая Б в 12:00', undo); }
      else if(a==='ill'){
        if(await confirmSheet('Пауза до конца недели?','Тренировки этой недели с этого дня отменятся. Вернуть любую можно кнопкой «Вернуть день». После паузы первая тренировка будет легче.','Поставить паузу',true)) pauseWeek(e.dow);
      }
    })));
}

/* ---------- Время, пульс и калории с часов ---------- */
function watchSheet(id){
  const k=watchKey(id), W=watch[k]||{};
  const f=(fld,lab,ph)=>`<div><div class="lab small t2" style="font-weight:700;margin-bottom:6px">${lab}</div><input class="inp small" data-f="${fld}" inputmode="numeric" placeholder="${ph}" value="${esc(W[fld])}" aria-label="${lab}"></div>`;
  openSheet(`<h2>Время и пульс с часов</h2>
    <div class="sub">«Начал» в начале и «Закончил» в конце: часы не должны идти дольше тренировки.</div>
    <div class="grid2">
      <div><div class="small t2" style="font-weight:700;margin-bottom:6px">Начало</div><input type="time" class="inp small" data-t="s" value="${esc(W.s)}" aria-label="Начало"><button type="button" class="btn" style="margin-top:6px" data-now="s">Начал сейчас</button></div>
      <div><div class="small t2" style="font-weight:700;margin-bottom:6px">Конец</div><input type="time" class="inp small" data-t="e" value="${esc(W.e)}" aria-label="Конец"><button type="button" class="btn" style="margin-top:6px" data-now="e">Закончил сейчас</button></div>
    </div>
    <div class="btnrow three" style="margin-top:14px">${f('hr','Ср. пульс','уд/мин')}${f('mx','Макс. пульс','уд/мин')}${f('kc','Ккал','активные')}</div>
    <div class="errtxt" hidden></div>
    <div class="muted small" style="margin-top:10px" data-sum></div>
    <button type="button" class="btn big pri" style="margin-top:14px" data-close>Готово</button>`,
    el=>{
      const sum=el.querySelector('[data-sum]'), err=el.querySelector('.errtxt');
      const paint=()=>{ const w=watch[k]||{}, m=watchMinutes(w), p=[];
        if(m!=null) p.push(`длительность ${fmtDur(m)}`);
        if(num(w.hr)!=null) p.push(`пульс ${w.hr}${num(w.mx)!=null?'/'+w.mx:''}`);
        if(num(w.kc)!=null) p.push(`${w.kc} ккал по часам`);
        sum.textContent=p.join(' · '); };
      const put=(fl,v)=>{ setWatch(id, fl, v===''||v==null?null:v); paint(); };
      el.querySelectorAll('[data-now]').forEach(b=>b.addEventListener('click',()=>{ const fl=b.dataset.now, v=nowHM(); put(fl,v); el.querySelector(`[data-t="${fl}"]`).value=v; toast(fl==='s'?`Начало ${v}`:`Конец ${v}`); }));
      el.querySelectorAll('[data-t]').forEach(i=>i.addEventListener('change',()=>put(i.dataset.t, i.value)));
      el.querySelectorAll('[data-f]').forEach(i=>i.addEventListener('input',()=>{
        const x=num(i.value), fl=i.dataset.f, max=fl==='kc'?5000:240, min=fl==='kc'?0:30;
        const bad=i.value.trim()!=='' && (x==null || x<min || x>max);
        i.classList.toggle('err',bad); err.hidden=!bad; if(bad){ err.textContent=fl==='kc'?'Калории от 0 до 5000':'Пульс от 30 до 240'; return; }
        put(fl, x==null?'':x);
      }));
      paint();
    }, {onClose:()=>{ renderAll(); }});
}
