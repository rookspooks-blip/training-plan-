"use strict";
/* ############################################################
   «СЕЙЧАС» (E3.2, макет А «Лента»): один список дня.
   Сверху главный пункт, ниже вес утром одной строкой, ниже остальные пункты.
   Утренний замер ничего не блокирует: полная форма открывается листом по тапу.
   ############################################################ */
const cycleShort=()=> isSession() ? 'сессия' : state.cycle===1 ? 'сушка'
  : state.cycle===2 ? 'сила' : (weekKind(3,state.week)==='hyper' ? 'масса' : 'сила');
/* «Сейчас» может показать другой день недели — по нажатию на день в «Плане».
   nowDay — номер дня (пн = 0) или null, когда показываем сегодня */
let nowDay=null;
const vIdx=()=> nowDay ?? todayIdx();
const vIso=()=> nowDay==null ? isoDay() : dateOfCW(state.cycle, state.week, nowDay);
const vDow=()=> (vIdx()+1)%7;
function showDayOnNow(i){
  nowDay = (i===todayIdx() && isNowWeek()) ? null : i;
  nowPick=null; nowAnim=0;
  goTab('now', true);
}
/* сделана: закончена в плеере или отмечены все упражнения, кроме тех, что на этой неделе «пропустить» */
const gymExToMark=e=> e.day ? e.day.ex.filter(x=>!plSkipDose(x)) : [];
const isGymDone=e=>{ const xs=gymExToMark(e); return sessionState(e.id)==='done' || (xs.length>0 && xs.every(x=>marks[key(e.id,x.id)])); };
const isRunDone=e=> !!marks[key(e.id,e.ex)];
function morningOf(iso){ const b=body[iso]||{}; return {w:num(b.w), hr:num(b.hr), knee:num(b.knee), back:num(b.back), groin:num(b.groin), sleep:num(b.sleep), bed:b.bed||null, wake:b.wake||null}; }
const morningDone=iso=>{ const m=morningOf(iso); return m.w!=null || m.knee!=null || m.back!=null || m.hr!=null || m.groin!=null || m.sleep!=null; };
function setBody(iso, f, v){
  const cur=body[iso]||{};
  if(v===''||v==null) delete cur[f]; else cur[f]=v;
  if(Object.keys(cur).length) body[iso]=cur; else delete body[iso];
  saveBody();
}
const lastWeightBefore=iso=>{ const ws=weightsSorted().filter(p=>p.d<iso); return ws.length ? ws[ws.length-1] : null; };

/* ---------- Утренний замер: барабан веса, пульс, колено, поясница, пах ----------
   Сохраняется сразу при каждом изменении. Карточка на «Сейчас» остаётся,
   пока не нажал «Готово», даже если что-то уже записано */
let mEdit=false;
function morningFormHTML(iso){
  const m=morningOf(iso), prev=lastWeightBefore(iso), center=m.w ?? (prev?prev.w:75);
  const sl=(f,lab)=>`<div class="mfield"><div class="lab"><span>${lab}</span><span><b class="n" data-sv="${f}">${m[f]??''}</b><button type="button" class="link small" style="margin-left:10px;min-height:32px" data-clr="${f}" ${m[f]==null?'hidden':''}>убрать</button></span></div>${sliderHTML(m[f])}</div>`;
  return `<div class="mform"><div class="mfield"><div class="lab"><span>Вес натощак</span><b class="n" data-wv>${m.w!=null?fmt1(m.w)+' кг':'—'}</b></div>
      <div class="drum"><div class="wheel" data-wheel aria-label="Вес, прокрути">${wheelHTML(center, m.w)}</div>
        <div class="side"><span class="u">${prev?`вчера ${fmt1(prev.w)}`:'кг'}</span><button type="button" class="btn" data-wtype>Ввести</button></div></div></div>
    <div class="mfield"><div class="lab"><span>Пульс лёжа</span><span class="muted small">сразу после пробуждения</span></div>
      <input class="inp" data-hr inputmode="numeric" placeholder="уд/мин" value="${m.hr??''}" aria-label="Пульс лёжа">
      <div class="errtxt" data-hrerr hidden>Пульс от 30 до 150</div></div>
    ${sl('knee', ballYesterday(iso)?'Колено после вчерашней игры: присед на одной ноге':'Колено: боль в приседе на одной ноге')}
    ${sl('back','Поясница: тянет или «забита»')}
    ${sl('groin','Пах')}
    <div class="mfield"><div class="lab"><span>Сон</span><span class="muted small">лёг вчера → встал</span></div>
      <div class="btnrow" style="grid-template-columns:1fr 1fr;margin-top:0"><input class="inp" type="time" data-bed value="${m.bed||''}" aria-label="Лёг вчера"><input class="inp" type="time" data-wake value="${m.wake||''}" aria-label="Встал"></div>
      <div class="small muted" data-slh style="margin-top:6px">${m.sleep!=null?`${fmtHours(m.sleep)}${m.sleep<7?' — мало, прыжки и силовые сегодня с запасом':''}`:'Цель — 8 часов. Отбой 01:00.'}</div></div>
    ${weeklyTestsHTML(iso)}</div>`;
}
/* Раз в неделю: голеностоп (колено к стене) и баланс с закрытыми глазами — по ногам */
function weeklyTestsHTML(iso){
  const done=weeklyTestsDone(iso), v=t=>{ const x=testOn(iso,t); return x==null?'':String(x).replace('.',','); };
  const f=(t,lab,u)=>`<div><div class="small t2" style="font-weight:700;margin-bottom:6px">${lab}</div><input class="inp" data-wt="${t}" inputmode="decimal" placeholder="${u}" value="${v(t)}" aria-label="${lab}"></div>`;
  return `<details class="lx wtests"${done?'':' open'}><summary><b>Раз в неделю: голеностоп и баланс</b><span>${done?'на этой неделе записано':'не записано на этой неделе'}</span></summary>
    <div class="small t2" style="margin:8px 0">Колено к стене: пятка прижата, отодвигай стопу, пока колено ещё касается, — см от большого пальца до стены. Баланс: на одной ноге с закрытыми глазами, секунды (до 30).</div>
    <div class="btnrow" style="grid-template-columns:1fr 1fr;margin-top:0">${f('kwL','Колено к стене, Л','см')}${f('kwR','Колено к стене, П','см')}${f('balL','Баланс, Л','сек')}${f('balR','Баланс, П','сек')}</div></details>`;
}
function bindMorningForm(root, iso){
  const form=root.querySelector('.mform');
  const m=morningOf(iso), prev=lastWeightBefore(iso), center=m.w ?? (prev?prev.w:75);
  const redraw=()=>{ form.outerHTML=morningFormHTML(iso); bindMorningForm(root, iso); };
  const changed=()=>{ mEdit=true; TABS.forEach(t=>{ if(t!==curTab()) dirty.add(t); }); updateMini(); };
  const wv=form.querySelector('[data-wv]');
  bindWheel(form.querySelector('[data-wheel]'), m.w, center, x=>{ setBody(iso,'w',x); wv.textContent=fmt1(x)+' кг'; changed(); });
  form.querySelector('[data-wtype]').addEventListener('click', async ()=>{
    const x=await numberSheet({title:'Вес натощак', value:morningOf(iso).w ?? center, step:0.1, min:30, max:200, unit:'кг', clear:'Убрать вес'});
    if(x===null) return;
    setBody(iso,'w', x===''?null:Math.round(x*10)/10); changed(); redraw();
  });
  const hr=form.querySelector('[data-hr]'), he=form.querySelector('[data-hrerr]');
  hr.addEventListener('input',()=>{
    const x=num(hr.value);
    const bad = hr.value.trim()!=='' && (x==null || x<30 || x>150);
    hr.classList.toggle('err', bad); he.hidden=!bad;
    if(!bad){ setBody(iso,'hr', x); changed(); }
  });
  ['knee','back','groin'].forEach((f,i)=>{
    const sl=form.querySelectorAll('.sl')[i];
    bindSlider(sl, v=>{ setBody(iso,f,v); form.querySelector(`[data-sv="${f}"]`).textContent=v??''; form.querySelector(`[data-clr="${f}"]`).hidden=v==null; changed(); });
  });
  form.querySelectorAll('[data-clr]').forEach(b=>b.addEventListener('click',()=>{ setBody(iso,b.dataset.clr,null); changed(); redraw(); }));
  /* сон: из времени отбоя и подъёма */
  const bed=form.querySelector('[data-bed]'), wk=form.querySelector('[data-wake]'), slh=form.querySelector('[data-slh]');
  const sleepUpd=()=>{
    setBody(iso,'bed',bed.value||null); setBody(iso,'wake',wk.value||null);
    if(bed.value && wk.value){ const h=Math.round(((hm2min(wk.value)-hm2min(bed.value)+1440)%1440)/6)/10;
      if(h>=2 && h<=15){ setBody(iso,'sleep',h); slh.textContent=`${fmtHours(h)}${h<7?' — мало, прыжки и силовые сегодня с запасом':''}`; } }
    changed();
  };
  bed.addEventListener('change',sleepUpd); wk.addEventListener('change',sleepUpd);
  /* недельные тесты */
  form.querySelectorAll('[data-wt]').forEach(i=>i.addEventListener('change',()=>{
    const s=i.value.trim(), x=s===''?null:num(s), bad=s!=='' && (x==null || x<0 || x>(i.dataset.wt.startsWith('kw')?30:120));
    i.classList.toggle('err',bad); if(bad) return;
    setTestOn(iso, i.dataset.wt, x==null?null:Math.round(x*10)/10); changed();
  }));
}
function morningSheet(day){
  const iso=typeof day==='string' ? day : isoDay();   /* бывает обработчиком нажатия — тогда сегодня */
  openSheet(`${iso!==isoDay()?`<div class="kick">${shortDate(iso)}</div>`:''}<h2>Утренний замер</h2><div class="sub">Сохраняется сразу. Вес — каждое утро натощак, минимум 3 раза в неделю; колено — утром после прыжкового дня.</div>
    ${morningFormHTML(iso)}<button type="button" class="btn big pri" style="margin-top:18px" data-close>Готово</button>`,
    el=>bindMorningForm(el, iso), {onClose:()=>{ mEdit=false; renderAll(); }});
}
/* Итог замера одной строкой и цвет по светофорам */
function morningLine(iso){
  const m=morningOf(iso), parts=[];
  if(m.w!=null) parts.push(`${fmt1(m.w)} кг`);
  if(m.hr!=null) parts.push(`пульс ${m.hr}`);
  if(m.knee!=null) parts.push(`колено ${m.knee}`);
  if(m.back!=null) parts.push(`поясница ${m.back}`);
  if(m.groin!=null) parts.push(`пах ${m.groin}`);
  if(m.sleep!=null) parts.push(`сон ${fmt1(m.sleep)} ч`);
  return parts.join(' · ');
}

/* место зарядки среди дел дня: после замера, днём или вечером (настройки) */
const dailyAt=()=>({day:'13:00', evening:'21:00'})[settings.dailyAt]||'08:31';
/* ---------- Ежедневный блок ----------
   Каждое из четырёх упражнений отмечается отдельно. Все четыре — день засчитан
   (общая отметка дня, её читают неделя, привычки и выгрузка). Старые отметки дня без
   упражнений считаются как «все четыре сделаны» */
const dailyKey=i=>`${weekTag()}-daily-${i}`;
const dailyItemKey=(i,n)=>`${weekTag()}-dailyx-${i}-${n}`;
const dailyItemOn=(i,n)=>!!marks[dailyKey(i)] || !!marks[dailyItemKey(i,n)];
const dailyCount=i=>DAILY.filter((_,n)=>dailyItemOn(i,n)).length;
/* снимок отметок дня — для «Отменить» */
function dailyUndo(i){
  const ks=[dailyKey(i), ...DAILY.map((_,n)=>dailyItemKey(i,n))], was={};
  ks.forEach(k=>{ was[k]=marks[k]; });
  return ()=>{ ks.forEach(k=>{ if(was[k]) marks[k]=was[k]; else delete marks[k]; }); saveMarks(); renderAll(); };
}
function setDailyItems(i, ons){
  ons.forEach((on,n)=>{ const k=dailyItemKey(i,n); if(on) marks[k]=true; else delete marks[k]; });
  if(ons.every(Boolean)) marks[dailyKey(i)]=true; else delete marks[dailyKey(i)];
  saveMarks();
}
function toggleDailyItem(i, n){
  const undo=dailyUndo(i), ons=DAILY.map((_,m)=>dailyItemOn(i,m));
  ons[n]=!ons[n];
  setDailyItems(i, ons); vibe(); renderAll();
  if(ons.every(Boolean)) toast('Зарядка для колен — всё сделано', undo);
}
function toggleDaily(i){
  const was=!!marks[dailyKey(i)], undo=dailyUndo(i);
  setDailyItems(i, DAILY.map(()=>!was)); vibe(); renderAll();
  toast(was?'Зарядка для колен — отметка снята':'Зарядка для колен — сделана', undo);
}
/* Тренировка одним нажатием: отметить все упражнения или снять отметки. Подходы в журнале не трогаются */
function toggleGymDone(e){
  if(isDropped(e.id)){ daySheet(e.id); return; }
  const st=sessionState(e.id);
  if(st==='done'){ openPlayer(e.id,'sum'); return; }
  if(st==='run'){ openPlayer(e.id); return; }
  const xs=gymExToMark(e), was=isGymDone(e), prev={};
  xs.forEach(x=>{ prev[x.id]=marks[key(e.id,x.id)]; if(was) delete marks[key(e.id,x.id)]; else marks[key(e.id,x.id)]=true; });
  saveMarks(); vibe(); renderAll();
  toast(was?`${e.day.title} — отметки сняты`:`${e.day.title} — сделано`, ()=>{ xs.forEach(x=>{ if(prev[x.id]) marks[key(e.id,x.id)]=prev[x.id]; else delete marks[key(e.id,x.id)]; }); saveMarks(); renderAll(); });
}
function toggleRunDone(e){
  if(isDropped(e.id)){ daySheet(e.id); return; }
  const k=key(e.id,e.ex), was=!!marks[k];
  if(was) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); renderAll();
  toast(was?'Велосипед — отметка снята':'Велосипед — сделано', ()=>{ if(was) marks[k]=true; else delete marks[k]; saveMarks(); renderAll(); });
}
function dailySheet(i){
  i = i ?? todayIdx();
  const html=()=>{ const done=!!marks[dailyKey(i)];
    const today=i===todayIdx() && isNowWeek();
    return `<div class="kick">${today?'Сегодня':`${DOW_FULL[(i+1)%7]}, ${shortDate(dateOfCW(state.cycle,state.week,i))}`}</div><h2>Зарядка для колен · ≈${dailyMinutes()} мин</h2>
    <div class="sub">${DAILY.length} коротких упражнений, чтобы колено не болело от прыжков, а пах не тянуло, а стопа и голеностоп держали колено. Делается каждый день, даже в разгрузку и в дни тренировок: отдельно от разминки, в любое время — утром, в перерыве между парами, вечером. Отмечай каждое упражнение кружком.</div>
    <div class="doc">${DAILY.map((x,n)=>{ const t=TECH[x.tech]||{text:''}, on=dailyItemOn(i,n);
      return `<div class="dxrow"><button type="button" class="ck${on?' on':''}" data-dx="${n}" aria-pressed="${on}" aria-label="${esc(x.name)} — ${on?'сделано':'не сделано'}">${IC.check}</button>
        <details class="lx"><summary><b>${n+1}. ${x.name}</b><span>${x.dose}</span></summary>${figFor(x.tech,x.name)}<div class="tech">${t.text}</div></details></div>`; }).join('')}
    <p style="margin-top:12px" class="t2">Эти пункты работают медленно и только от частоты. Полуприсед у стены даёт первые изменения в колене через 4–6 недель ежедневной работы, изометрия паха примерно так же. Делать их три раза в неделю вместо семи — значит растянуть результат вдвое.</p></div>
    <button type="button" class="btn big ${done?'':'pri'}" data-t>${done?'Снять все отметки':'Сделал все'}</button>`; };
  const bind=(el,close)=>{
    el.querySelector('[data-t]').addEventListener('click',()=>{ close(); toggleDaily(i); });
    el.querySelectorAll('[data-dx]').forEach(b=>b.addEventListener('click',()=>{
      const open=[...el.querySelectorAll('details.lx')].map(d=>d.open);
      toggleDailyItem(i, +b.dataset.dx);
      /* лист остаётся открытым — перерисовываем его содержимое на месте */
      const y=el.scrollTop; [...el.children].forEach(c=>{ if(!c.classList.contains('grab')) c.remove(); });
      el.insertAdjacentHTML('beforeend', html()); el.scrollTop=y;
      el.querySelectorAll('details.lx').forEach((d,k)=>{ d.open=open[k]; });
      bind(el,close);
    }));
  };
  openSheet(html(), bind);
}

/* ---------- Карточки «следующего шага» ---------- */
function statusLinesForDay(day){
  const out=[];
  const needBack=day.ex.some(x=>BACK_LOAD.includes(x.tech)), needKnee=day.ex.some(x=>x.badge[0]==='Скорость'||x.id==='kW');
  const bs=needBack?backStatus():null, ks=needKnee?kneeStatus():null;
  const needGroin=day.ex.some(x=>x.tech==='copenhagen'), gs=needGroin?groinStatus():null;
  [ks,bs,gs].forEach(s=>{ if(s && s.lvl!=='g') out.push({lvl:s.lvl, b:s.title, x:s.text}); });
  return out;
}
function dayNotesHTML(e, inHero){
  const day=e.day, n=[];
  if(isDropped(e.id)) n.push({lvl:'y', b:'Отменено на этой неделе', x:DROP_ADVICE[e.id]||DROP_ADVICE.d1});
  else {
    if(e.moveNote) n.push({lvl:'i', b:'Перенесено', x:e.moveNote});
    if(day.alert) n.push({lvl:day.alert.lvl, html:day.alert.html});
    if(day.swap) n.push({lvl:'i', b:'Замена дома', x:'Прыжковая часть переносится целиком — ей нужно три квадратных метра, а не зал. Мотор добираем интервалами в горку на дорожке. Не заменяются ускорения с места: на дорожке полотно уходит из-под ноги само. Раз-два в месяц это ничего не стоит; если физры нет несколько недель подряд — нужен любой коридор метров на двадцать.'});
    statusLinesForDay(day).forEach(s=>n.push(s));
  }
  return n.map(x=>`<div class="note ${x.lvl==='g'?'g':x.lvl}">${x.html ? x.html.replace(/^<b>([^<]*)<\/b>/,'<b>$1</b>') : `<b>${x.b}</b>${x.x||''}`}</div>`).join('');
}
/* Где тренировка: «универ, после физры», «подъезд и зал у дома», «дома» — вторая часть day.when */
const dayPlace=day=>(day.when||'').split(' · ').slice(1).join(' · ');

/* ---------- Итоги дня: лист (раньше карточка в карусели) ---------- */
function eveningSheet(){
  const td=vIdx(), iso=vIso(), week=buildWeek(), es=week.filter(e=>e.dow===vDow());
  const html=()=>{
    const T=nutritionTarget(td), t=totalsOfDay(td)||{k:0};
    const hk=id=>`${weekTag()}-hab-${id}-${td}`;
    const S=sleepInfo(), N=sleepTonight(td), sh=SHOWER[todayKind(td)];
    const lines=[];
    es.filter(e=>e.type==='gym').forEach(e=>lines.push([isGymDone(e)||isDropped(e.id), e.day.title+(isDropped(e.id)?' — отменена':''), 'g:'+e.id]));
    es.filter(e=>e.type==='run').forEach(e=>lines.push([isRunDone(e)||isDropped(e.id), 'Велосипед + мяч', 'r:'+e.id]));
    lines.push([morningDone(iso), morningDone(iso)?`Утро: ${morningLine(iso)}`:'Утренний замер не записан', 'm']);
    if(dailyOn()){ const dn=dailyCount(td);
    lines.push([dn===DAILY.length, `Зарядка для колен${dn&&dn<DAILY.length?` · ${dn} из ${DAILY.length}`:''}`, 'daily']); }
    lines.push([t.k>0 && Math.abs(t.k-T.k)<=120, `Еда: ${kfmt(t.k)} из ${kfmt(T.k)} ккал`, 'food']);
    const dl=dayLoad(iso);
    lines.push([dl>0, dl?`Нагрузка дня: ${dl} (минуты × тяжесть)`:'Был баскетбол или игра? Добавь в нагрузку', 'load']);
    return `<div class="kick">${iso===isoDay()?'Сегодня':shortDate(iso)}</div><h2>Итоги дня</h2>
    <div style="margin-top:6px">${lines.map(([ok,txt,ev])=>`<button type="button" class="row" style="width:100%" data-ev="${ev}"><span class="ck${ok?' on':''}">${IC.check}</span><span class="grow" style="text-align:left"><div class="nm">${esc(txt)}</div></span></button>`).join('')}</div>
    <div class="sec" style="margin-top:14px">Привычки</div>
    ${[['sl1','Лёг в одно и то же время'],['sl2','Не пропустил ни одного приёма пищи']].map(([id,txt])=>`<button type="button" class="row" style="width:100%" data-hab="${hk(id)}"><span class="ck${marks[hk(id)]?' on':''}">${IC.check}</span><span class="grow" style="text-align:left"><div class="nm">${txt}</div></span></button>`).join('')}
    <div class="note" style="margin-top:12px"><b>Сон: отбой 01:00, подъём ${N.wake} — ${fmtHours(N.h)}</b>${N.note}${S.heavy?' Неделя тяжёлая — добери днём 20–30 минут.':''}</div>
    <div class="note"><b>Душ: ${sh.t.toLowerCase()}</b>${sh.x()}</div>
    <button type="button" class="btn big pri" style="margin-top:6px" data-drep>Отчёт за ${nowDay==null?'день':DOW_FULL[vDow()].toLowerCase()}</button>`;
  };
  const draw=(el,close)=>{ const y=el.scrollTop; [...el.children].forEach(c=>{ if(!c.classList.contains('grab')) c.remove(); }); el.insertAdjacentHTML('beforeend', html()); el.scrollTop=y; wire(el,close); };
  const wire=(el,close)=>{
    el.querySelectorAll('[data-hab]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.hab; if(marks[k]) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); renderAll(); draw(el,close); }));
    el.querySelector('[data-drep]').addEventListener('click',()=>{ close(); dayReportSheet(iso); });
    el.querySelectorAll('[data-ev]').forEach(b=>b.addEventListener('click',()=>{
      const ev=b.dataset.ev, e=week.find(x=>x.id===ev.slice(2));
      if(ev==='m'){ close(); morningSheet(iso); }
      else if(ev==='daily'){ toggleDaily(td); draw(el,close); }
      else if(ev==='food'){ close(); foodDay=td; loadFoodDay(); goTab('food', true); }
      else if(ev==='load'){ close(); loadAddSheet('ball', iso); }
      else if(ev.startsWith('g:') && e){ close(); toggleGymDone(e); }
      else if(ev.startsWith('r:') && e){ toggleRunDone(e); draw(el,close); }
    }));
  };
  openSheet(html(), (el,close)=>wire(el,close));
}

/* ---------- Меню «⋯» на «Сейчас»: то, что раньше открывала кнопка «+» ---------- */
function nowMenu(){
  const o=[['m','Утренний замер','пульс, сон, шкалы, недельные замеры'],['load','Баскетбол или игра','в нагрузку недели'],['test','Тест','прыжок, спринт, касание'],
    ...(dailyOn()?[['daily','Зарядка для колен','отметить упражнения']]:[]),['eve','Итоги дня','привычки, сон, душ'],['rep','Отчёт за день','всё одним текстом']];
  openSheet(`<h2>Сейчас</h2>${o.map(([a,t,s])=>`<button type="button" class="opt" data-a="${a}"><span class="grow"><b>${t}</b><span>${s}</span></span></button>`).join('')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.a; close();
      if(a==='m') morningSheet(vIso()); else if(a==='load') loadAddSheet('ball', vIso()); else if(a==='test') testRecordSheet();
      else if(a==='daily') dailySheet(vIdx()); else if(a==='eve') eveningSheet(); else dayReportSheet(vIso());
    })));
}

/* ---------- «Не сегодня»: у каждого варианта виден результат, посчитанный правилами переноса ----------
   Результат считается «примеркой»: пропуски меняются в памяти, неделя собирается заново, пропуски возвращаются.
   Правило 48 часов и перенос остаются в buildWeekRaw(), здесь они только читаются */
function whatIf(fn){ const snap=JSON.stringify(skips); try{ return fn(); } finally{ skips=JSON.parse(snap); } }
const dowLabel=dow=>`${DOW_IDX[(dow+6)%7].toLowerCase()} ${shortDate(dateOfCW(state.cycle,state.week,(dow+6)%7))}`;
function skipOptions(e){
  const id=e.id, run=e.type==='run', speed=id==='d2'||id==='d4'||id==='c-tue', moved=isMoved(id)&&!isDropped(id);
  const pe=id==='d2' && !isSession() && !summerMode();
  const out=[];
  /* пропуск */
  let s;
  if(run) s='Кардио не переносится: догонять не надо';
  else if(speed) s='Скоростная не переносится: отменится на этой неделе';
  else if(moved) s='Отменится на этой неделе, второй раз переносить нельзя';
  else {
    const pv=whatIf(()=>{ skips[skipKey(id)]=true; const e2=buildWeekRaw().find(x=>x.id===id); return {dropped:isDropped(id)||!e2, dow:e2&&e2.dow, t:e2&&trainingTime(e2), note:e2&&e2.moveNote}; });
    s=pv.dropped ? 'Отменится на этой неделе' : `Перенесётся на ${dowLabel(pv.dow)}${pv.t?` в ${pv.t}`:''}`;
  }
  out.push({a:'skip', t:moved?'Снова не сделал':'Пропустил', s});
  /* физры не было (четверг, скоростная) */
  if(pe){
    const pv=whatIf(()=>{ if(skips[peKey()]) delete skips[peKey()]; else skips[peKey()]=true; const e2=buildWeekRaw().find(x=>x.id==='d2'); return e2&&trainingTime(e2); });
    out.push({a:'pe', t:noPE()?'Физра всё-таки была':'Физры не было', s:noPE()?`Скоростная снова после физры${pv?` в ${pv}`:''}`:`Скоростная дома${pv?` в ${pv}`:''}: прыжки дома, выносливость горкой на дорожке`});
  }
  /* суббота: утром баскет в вузе */
  if(!v2On() && (id==='d7' || (id==='d3' && e.dow===6))){
    const pv=whatIf(()=>{ if(skips[ballKey()]) delete skips[ballKey()]; else skips[ballKey()]=true; const e2=buildWeekRaw().find(x=>x.id==='d3'); return e2&&trainingTime(e2); });
    out.push({a:'ball', t:ballSat()?'Баскета не будет':'Утром баскет в вузе', s:ballSat()?`Силовая Б снова днём${pv?` в ${pv}`:''}`:`Силовая Б в ${pv||'18:00'} без стартов и прыжков, утром скоростная и игра`});
  }
  /* болею: сколько тренировок снимется до конца недели */
  const ord=d=>(d===0?7:d);
  const hit=buildWeek().filter(x=>(x.type==='gym'||x.type==='run') && ord(x.dow)>=ord(e.dow) && !isDropped(x.id));
  out.push({a:'ill', t:'Болею', s:`Снимется тренировок до конца недели: ${hit.length}. Первая после паузы будет легче`, danger:true});
  return out;
}
function skipSheet(id){
  const e=buildWeek().find(x=>x.id===id); if(!e) return;
  const title=e.type==='gym'?e.day.title:e.title;
  const opts=skipOptions(e), snap=JSON.stringify(skips);
  const undo=()=>{ skips=JSON.parse(snap); saveSkips(); renderAll(); };
  openSheet(`<h2>Не сегодня</h2><div class="sub">${esc(title)} · выбери причину, результат виден сразу</div>
    ${opts.map(o=>`<button type="button" class="sopt" data-a="${o.a}"><b>${o.t}</b><span>${o.s}</span></button>`).join('')}
    <button type="button" class="cancel" data-close>Отмена</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.a, o=opts.find(x=>x.a===a); close();
      if(a==='skip'){
        if(e.type==='run' || id==='d2' || id==='d4' || id==='c-tue'){ skips[skipKey(id)]=true; skips[dropKey(id)]=true; saveSkips(); renderAll(); }
        else toggleSkip(id);
        toast(`${title}: ${lcFirst(o.s)}`, undo);
      }
      else if(a==='pe'){ togglePE(); toast(o.s, ()=>togglePE()); }
      else if(a==='ball'){ toggleBall(); toast(o.s, ()=>toggleBall()); }
      else if(a==='ill'){ pauseWeek(e.dow); toast(o.s, undo); }
    })));
}

/* Отчёт за день: тренировка, подходы, замер, еда, сон — одним текстом, как в выгрузке */
function dayReportSheet(iso){
  iso=iso||isoDay();
  const txt=dayText(dayExport(iso));
  openSheet(`<div class="kick">${iso===isoDay()?'Сегодня':shortDate(iso)}</div><h2>Отчёт за день</h2>
    <div class="sub">Всё за день одним текстом — скопируй и пришли.</div>
    <div class="expre" style="max-height:50vh">${esc(txt)}</div>
    <div class="btnrow"><button type="button" class="btn pri" data-copy>Скопировать</button><button type="button" class="btn" data-share>Поделиться</button></div>`,
    el=>{
      el.querySelector('[data-copy]').addEventListener('click',async()=>{ toast(await copyText(txt)?'Отчёт за день скопирован':'Не вышло скопировать — выдели текст вручную'); });
      el.querySelector('[data-share]').addEventListener('click',()=>{ if(navigator.share) navigator.share({text:txt}).catch(()=>{}); else shareFile(`den-${iso}.txt`, txt, 'text/plain', 'День '+iso); });
    });
}
/* Какие приёмы пищи уже записаны: время блюда или своей еды в пределах ±90 минут */
function mealLogged(td, at){
  const log=foodLog[`${weekTag()}-${td}`]||{};
  const times=[...Object.entries(log.times||{}).filter(([id])=>log.dishOn&&log.dishOn[id]).map(([,t])=>t), ...(log.custom||[]).map(x=>x.t).filter(Boolean)];
  return times.some(t=>Math.abs(hm2min(t)-hm2min(at))<=90);
}
function foodQuickSheet(at){
  const us=usualNow(6), conts=cookList().filter(c=>cookLeft(c)>0);
  openSheet(`<h2>Что съел?</h2><div class="sub">${at?`По режиму в ${at}. `:''}Нажми — запишется на текущее время, можно отменить.</div>
    ${conts.length?`<div class="sec">Контейнеры</div><div class="pills">${conts.map((c,i)=>`<button type="button" class="pill" data-cont="${i}">${esc(dishById(c.m).name)}${c.g?` + ${esc(dishById(c.g).name.toLowerCase())}`:''} <small>${cookLeft(c)} ост.</small></button>`).join('')}</div>`:''}
    <div class="sec">Как обычно в это время</div><div class="pills">${us.map((u,i)=>quickPill(u,i)).join('')||'<span class="muted">Пока нет истории</span>'}</div>
    <button type="button" class="btn big pri" style="margin-top:18px" data-go>Открыть «Еду»</button>`,
    (el,close)=>{
      el.querySelectorAll('[data-cont]').forEach(b=>b.addEventListener('click',()=>{ close(); eatContainer(conts[+b.dataset.cont], true); }));
      el.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{ close(); eatQuick(us[+b.dataset.q], true); }));
      el.querySelector('[data-go]').addEventListener('click',()=>{ close(); goTab('food'); });
    });
}

/* ---------- Экран: один список дня ----------
   Сверху главный пункт (тренировка дня, а без неё следующее по времени дело), ниже вес утром одной строкой,
   ниже остальные пункты дня. Ни один пункт не показан дважды: главный из списка убирается */
const MONTHS_G=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function ruDate(iso){ const [y,m,d]=iso.split('-').map(Number), dt=new Date(y,m-1,d); return `${DOW_IDX[(dt.getDay()+6)%7].toLowerCase()}, ${d} ${MONTHS_G[m-1]}`; }
const lcFirst=s=>s?s[0].toLowerCase()+s.slice(1):s;
const sortKey=it=> it.sort!=null ? it.sort : (hm2min((it.t||'00:00').slice(0,5))||0);

function nowItems(es){
  const td=vIdx(), iso=vIso(), future=iso>isoDay(), items=[];
  es.filter(e=>e.type==='gym').forEach(e=>{
    const dr=isDropped(e.id), st=sessionState(e.id);
    items.push({id:'g:'+e.id, k:'gym', e, t:trainingTime(e)||'17:00', nm:e.day.title+(dr?' · отменена':''), done:isGymDone(e)||st==='done'||dr, dropped:dr, running:st==='run', ck:true});
  });
  es.filter(e=>e.type==='run').forEach(e=>{
    const dr=isDropped(e.id);
    items.push({id:'r:'+e.id, k:'run', e, t:trainingTime(e)||'09:00', nm:'Велосипед + мяч'+(dr?' · отменено':''), done:isRunDone(e)||dr, dropped:dr, ck:true});
  });
  const dn=dailyCount(td);
  if(dailyOn()) items.push({id:'daily', k:'daily', t:dailyAt(), nm:'Зарядка для колен', ds:dn&&dn<DAILY.length?`${dn} из ${DAILY.length}`:'', done:!!marks[dailyKey(td)], ck:true});
  mealTiming(td).rows.filter(r=>!/^(Подъём|Тренировка|Физра)/.test(r[1])).forEach(r=>{
    const parts=String(r[1]).split(/ — |: /), nm=parts.shift();
    items.push({id:'f:'+r[0], k:'food', t:r[0], nm, more:parts.join('. '), prot:r[2], done:mealLogged(td,r[0]), at:r[0], ck:true});
  });
  if(!future){
    items.push({id:'eve', k:'eve', t:'23:30', nm:'Итоги дня', done:false, ck:false});
    items.push({id:'sleep', k:'sleep', t:'01:00', sort:1500, nm:'Отбой', done:!!marks[`${weekTag()}-hab-sl1-${td}`], ck:true});
  }
  return items;
}
/* Главный пункт: идущая или ближайшая тренировка, потом кардио, потом закрытая сегодня тренировка,
   иначе следующее по времени дело, а когда всё сделано - итоги дня */
function pickMain(items, past, future, nowMin){
  const byT=(a,b)=>sortKey(a)-sortKey(b);
  if(past) return items.find(x=>x.k==='eve') || null;
  const live=items.find(x=>x.k==='gym' && x.running);
  if(live) return live;
  const gp=items.filter(x=>x.k==='gym' && !x.done).sort(byT)[0]; if(gp) return gp;
  const rp=items.filter(x=>x.k==='run' && !x.done).sort(byT)[0]; if(rp) return rp;
  const gd=items.filter(x=>x.k==='gym' && x.done && !x.dropped);
  if(gd.length) return gd.sort(byT)[gd.length-1];
  const pend=items.filter(x=>!x.done && x.k!=='gym' && x.k!=='run').sort(byT);
  if(future) return pend[0] || null;
  return pend.find(x=>sortKey(x)>=nowMin-30) || pend[0] || null;
}
function closedAt(e){ const W=watch[watchKey(e.id)]||{}; return W.e||''; }

function mainHTML(m, es){
  const e=m.e;
  const noteHTML=en=>{
    const n=[];
    if(en.type==='gym'){
      if(en.moveNote) n.push({lvl:'i', b:'Перенесено', x:en.moveNote});
      if(en.day.alert) n.push({lvl:en.day.alert.lvl, html:en.day.alert.html});
      statusLinesForDay(en.day).forEach(s=>n.push(s));
    } else if(en.moveNote) n.push({lvl:'i', b:'Сдвинуто', x:en.moveNote});
    return n.map(x=>`<div class="note ${x.lvl}">${x.html?x.html:`<b>${x.b}</b>${x.x||''}`}</div>`).join('');
  };
  if(m.k==='gym'){
    const day=e.day, mins=dayMinutes(day, state.week), place=dayPlace(day);
    if(m.done && !m.dropped){
      const at=closedAt(e), S=daySummary(day);
      return `<div class="main" data-day="${e.id}"><div class="when">${at?`закрыта в ${at}`:'отмечена сделанной'}</div><h2>${esc(day.title)}</h2>
        <p class="dose">${S.done} из ${S.total} упражнений</p>
        <button type="button" class="go" data-resume>Продолжить</button><button type="button" class="later" data-sum>Итог тренировки</button></div>`;
    }
    if(m.running) return `<div class="main" data-day="${e.id}"><div class="when">идёт тренировка</div><h2>${esc(day.title)}</h2>
        <p class="dose">${esc(day.note)}</p><button type="button" class="go" data-play>Вернуться</button></div>`;
    return `<div class="main" data-day="${e.id}"><div class="when">${m.t}${place?` · ${esc(place)}`:''}</div><h2>${esc(day.title)} · ${mins} мин</h2>
      <p class="dose">${esc(day.note)}</p>${noteHTML(e)}
      <button type="button" class="go" data-start>Начать</button><button type="button" class="later" data-later>Не сегодня</button></div>`;
  }
  if(m.k==='run'){
    const d1=isRunDone(e), d2=!!marks[key(e.id,'ball')];
    return `<div class="main cardio" data-day="${e.id}"><div class="when">${m.t} · ${esc(e.dur)}</div><h2>Велосипед + мяч</h2>
      <p class="dose">${esc(e.note)}</p>${noteHTML(e)}
      <div class="crows"><button type="button" class="crow" data-ck="${e.ex}"><span class="ck${d1?' on':''}">${IC.check}</span><span class="nm">Велосипед ${esc(e.dur)}</span></button>
      <button type="button" class="crow" data-ck="ball"><span class="ck${d2?' on':''}">${IC.check}</span><span class="nm">Мяч · дриблинг<small>${BALL.dose}</small></span></button></div>
      <div class="two"><button type="button" class="later" data-how>Как настроить</button><button type="button" class="later" data-later>Не сегодня</button></div></div>`;
  }
  /* любое другое дело */
  const cta={food:'Что съел?', daily:'Открыть', sleep:'Лёг', eve:'Открыть'}[m.k];
  const dose = m.k==='food' ? [m.prot?`Белок ${m.prot} г.`:'', m.more?esc(m.more)+'.':''].filter(Boolean).join(' ')
    : m.k==='daily' ? 'Колени, пах, стопа, голеностоп. Каждый день, в любое время.' : m.k==='eve' ? 'Привычки, сон, душ и отчёт за день.' : 'Отбой 01:00.';
  return `<div class="main" data-item="${m.id}"><div class="when">${m.t}</div><h2>${esc(m.nm)}</h2><p class="dose">${dose}</p>
    <button type="button" class="go" data-mainact="${m.k}">${cta}</button></div>`;
}

function weightRowHTML(iso){
  const m=morningOf(iso);
  const rest=[]; if(m.hr!=null) rest.push(`пульс ${m.hr}`); if(m.knee!=null) rest.push(`колено ${m.knee}`); if(m.back!=null) rest.push(`поясница ${m.back}`); if(m.groin!=null) rest.push(`пах ${m.groin}`); if(m.sleep!=null) rest.push(`сон ${fmt1(m.sleep)} ч`);
  return `<div class="card wrow"><button type="button" class="wl" data-wopen><b>Вес утром</b>${rest.length?`<small>${esc(rest.join(' · '))}</small>`:''}</button>
    <input class="winp n" data-w inputmode="decimal" placeholder="кг" value="${m.w!=null?String(m.w).replace('.',','):''}" aria-label="Вес натощак, кг" enterkeyhint="done">
    <button type="button" class="wbtn" data-wsave aria-label="Записать вес">${IC.up}</button></div>`;
}

function renderNowScreen(){
  const box=$('#scr-now'); if(!box) return;
  /* «Сейчас» - про сегодня: открыта не та неделя - показываем её день недели и говорим об этом */
  if(foodDay!==todayIdx() && document.body.dataset.tab!=='food'){ foodDay=todayIdx(); loadFoodDay(); }
  if(nowDay!=null && nowDay===todayIdx() && isNowWeek()) nowDay=null;
  const td=vIdx(), iso=vIso(), now=hm2min(nowHM()), other=nowDay!=null, past=iso<isoDay(), future=iso>isoDay();
  const week=buildWeek(), es=week.filter(e=>e.dow===vDow());
  const rest=es.find(e=>e.type==='rest'), hasGym=es.some(e=>e.type==='gym'), hasRun=es.some(e=>e.type==='run');
  const items=nowItems(es), main=pickMain(items, past, future, now);
  const kind=hasGym?'день с тренировкой':hasRun?'день с велосипедом':'день отдыха';
  /* день отдыха: одной строкой, какая тренировка следующая */
  let nextLine='';
  if(rest && !hasGym && !hasRun){
    const ord=d=>(d===0?7:d);
    const nx=week.filter(x=>x.type!=='rest' && !(x.type==='gym'&&isDropped(x.id)) && ord(x.dow)>ord(rest.dow))[0];
    if(nx) nextLine=`Следующая: ${DOW_FULL[nx.dow]}, ${nx.type==='gym'?esc(nx.day.title):esc(nx.title)}${trainingTime(nx)?` в ${trainingTime(nx)}`:''}`;
  }
  const list=items.filter(x=>x!==main).sort((a,b)=>(a.done-b.done)||(sortKey(a)-sortKey(b)));
  const notes=statusNotes().map(n=>`<div class="note ${n.lvl}">${n.html}</div>`).join('');
  const off=!isNowWeek() && !posForDate(isoDay()).pre ? `<div class="note i"><b>Открыта неделя ${state.cycle===1&&state.week>12?'сессии '+(state.week-12):state.week}, а не текущая</b>Тренировки и еда показываются за эту неделю. <button type="button" class="link" data-auto>Вернуть неделю по дате</button></div>` : '';

  box.innerHTML=`
    <div class="hd"><div class="tt"><div class="h1">Сейчас</div><div class="hsub">${esc(ruDate(iso))} · ${kind}${other?' · <button type="button" class="link small" style="min-height:44px" data-today>К сегодня</button>':''}</div></div>
      <button type="button" class="icbtn" data-menu aria-label="Ещё">${IC.more}</button></div>
    <div id="onbSlot"></div>
    ${alertsHTML()}
    ${main?mainHTML(main, es):''}
    ${nextLine?`<div class="hnote">${nextLine}</div>`:''}
    ${future?'':weightRowHTML(iso)}
    <div class="card nlist">${list.map(it=>`
      <div class="nrow${it.done?' done':''}" data-act="${it.k}" ${it.e?`data-id="${it.e.id}"`:''} ${it.at?`data-at="${it.at}"`:''}>
        <span class="tm n">${it.t}</span><span class="nm">${esc(it.nm)}${it.ds?`<small>${esc(it.ds)}</small>`:''}</span>
        ${it.ck?`<button type="button" class="ck${it.done?' on':''}" data-tog aria-label="${esc(it.nm)} — ${it.done?'сделано':'отметить'}">${IC.check}</button>`:`<span class="chev">›</span>`}
      </div>`).join('')}</div>
    ${off}${notes}
    <div id="installSlot"></div>`;

  renderInstallHint(); renderOnboard(); bindAlerts(box);
  /* шапка */
  box.querySelector('[data-menu]').addEventListener('click',nowMenu);
  const tb=box.querySelector('[data-today]'); if(tb) tb.addEventListener('click',()=>{ nowDay=null; nowPick=null; renderNowScreen(); enterFx(box); window.scrollTo(0,0); });
  const ab=box.querySelector('[data-auto]'); if(ab) ab.addEventListener('click',()=>{ settings.auto=true; saveSettings(); applyAuto(); foodDay=todayIdx(); loadFoodDay(); renderAll(); toast('Неделя снова по дате'); });
  /* вес утром: одна строка, остальное замера - по тапу на подпись */
  const wi=box.querySelector('[data-w]');
  if(wi){
    const save=()=>{
      const s=wi.value.trim(); if(s===''){ wi.classList.add('err'); return; }
      const x=/^\d{2,3}([.,]\d)?$/.test(s) ? num(s) : null;
      if(x==null || x<30 || x>200){ wi.classList.add('err'); toast('Вес от 30 до 200 кг, например 74,6'); return; }
      const was=morningOf(iso).w, v=Math.round(x*10)/10;
      setBody(iso,'w',v); mEdit=false; renderAll();
      toast(`Вес ${fmt1(v)} кг записан`, ()=>{ setBody(iso,'w',was==null?null:was); renderAll(); });
    };
    wi.addEventListener('input',()=>wi.classList.remove('err'));
    wi.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); save(); } });
    box.querySelector('[data-wsave]').addEventListener('click',save);
    box.querySelector('[data-wopen]').addEventListener('click',()=>morningSheet(iso));
  }
  /* главный пункт */
  const mh=box.querySelector('.main');
  if(mh){
    const id=mh.dataset.day;
    const on=(sel,f)=>mh.querySelectorAll(sel).forEach(b=>b.addEventListener('click',()=>f(b)));
    on('[data-start]',()=>startWorkout(id));
    on('[data-play]',()=>openPlayer(id));
    on('[data-resume]',()=>openPlayer(id,'resume'));
    on('[data-sum]',()=>openPlayer(id,'sum'));
    on('[data-later]',()=>skipSheet(id));
    on('[data-how]',()=>techSheet('bike_setup','Велосипед'));
    on('[data-ck]',b=>{
      const k=key(id,b.dataset.ck), was=!!marks[k];
      if(was) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); renderAll();
      if(!was) toast('Отмечено', ()=>{ delete marks[k]; saveMarks(); renderAll(); });
    });
    on('[data-mainact]',b=>{
      const k=b.dataset.mainact;
      if(k==='food') foodOf(main.at); else if(k==='daily') dailySheet(td); else if(k==='eve') eveningSheet();
      else if(k==='sleep') toggleHab('sl1');
    });
  }
  /* еда другого дня - во вкладке «Еда» на тот день: быстрые фишки пишут на текущее время */
  function foodOf(at){ if(!other){ foodQuickSheet(at); return; } foodDay=vIdx(); loadFoodDay(); goTab('food', true); }
  function toggleHab(id){ const k=`${weekTag()}-hab-${id}-${td}`; if(marks[k]) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); renderAll(); }
  /* список */
  box.querySelectorAll('.nrow').forEach(row=>{
    const act=row.dataset.act, e=row.dataset.id ? week.find(x=>x.id===row.dataset.id) : null;
    const tog=row.querySelector('[data-tog]');
    if(tog) tog.addEventListener('click',ev=>{ ev.stopPropagation();
      if(act==='daily') toggleDaily(td);
      else if(act==='gym' && e) toggleGymDone(e);
      else if(act==='run' && e) toggleRunDone(e);
      else if(act==='sleep') toggleHab('sl1');
      else if(act==='food') foodOf(row.dataset.at);
    });
    row.addEventListener('click',()=>{
      if(act==='daily') dailySheet(td);
      else if(act==='gym' && e){ if(isDropped(e.id)) notWorkingSheet(e.id); else if(sessionState(e.id)!=='idle'||isGymDone(e)) openPlayer(e.id); else daySheet(e.id); }
      else if(act==='run' && e) daySheet(e.id);
      else if(act==='food') foodOf(row.dataset.at);
      else if(act==='eve') eveningSheet();
      else if(act==='sleep') openLibrarySection('Сон: норма недели');
    });
  });
}
