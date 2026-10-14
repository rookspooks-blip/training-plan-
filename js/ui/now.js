"use strict";
/* ############################################################
   «СЕЙЧАС» — один следующий шаг крупно, ниже лента дня.
   Шаг выбирается по времени и по тому, что уже сделано:
   утренний замер → тренировка по расписанию → кардио → итог дня.
   ############################################################ */
const cycleShort=()=> isSession() ? 'сессия' : state.cycle===1 ? 'сушка'
  : state.cycle===2 ? 'сила' : (weekKind(3,state.week)==='hyper' ? 'масса' : 'сила');
const todayEntries=()=>{ const dow=new Date().getDay(); return buildWeek().filter(e=>e.dow===dow); };
const isGymDone=e=> sessionState(e.id)==='done' || (e.day && e.day.ex.length && e.day.ex.every(x=>marks[key(e.id,x.id)]));
const isRunDone=e=> !!marks[key(e.id,e.ex)];
function morningOf(iso){ const b=body[iso]||{}; return {w:num(b.w), hr:num(b.hr), knee:num(b.knee), back:num(b.back), groin:num(b.groin)}; }
const morningDone=iso=>{ const m=morningOf(iso); return m.w!=null || m.knee!=null || m.back!=null || m.hr!=null || m.groin!=null; };
function setBody(iso, f, v){
  const cur=body[iso]||{};
  if(v===''||v==null) delete cur[f]; else cur[f]=v;
  if(Object.keys(cur).length) body[iso]=cur; else delete body[iso];
  saveBody();
}
const lastWeightBefore=iso=>{ const ws=weightsSorted().filter(p=>p.d<iso); return ws.length ? ws[ws.length-1] : null; };

/* ---------- Утренний замер: барабан веса, пульс, колено, поясница, пах ----------
   Пишется сразу при каждом изменении. Карточка на «Сейчас» остаётся,
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
    ${sl('knee','Колено: боль в приседе на одной ноге')}
    ${sl('back','Поясница: тянет или «забита»')}
    ${sl('groin','Пах')}</div>`;
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
}
function morningSheet(){
  const iso=isoDay();
  openSheet(`<h2>Утренний замер</h2><div class="sub">Пишется сразу. Вес — каждое утро натощак, минимум 3 раза в неделю; колено — утром после прыжкового дня.</div>
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
  return parts.join(' · ');
}

/* ---------- Ежедневный блок ---------- */
const dailyKey=i=>`${state.cycle}-${state.week}-daily-${i}`;
function toggleDaily(i){
  const k=dailyKey(i), was=!!marks[k];
  if(was) delete marks[k]; else marks[k]=true;
  saveMarks(); vibe(); renderAll();
  if(!was) toast('Каждый день — отмечено', ()=>{ delete marks[k]; saveMarks(); renderAll(); });
}
function dailySheet(i){
  i = i ?? todayIdx();
  const done=!!marks[dailyKey(i)];
  openSheet(`<h2>Каждый день · ≈${dailyMinutes()} мин</h2>
    <div class="sub">Колени, пах и стопа. Не режется никогда. Все семь дней, в том числе тренировочные: отдельно от разминки, в любое время — утром, в перерыве между парами, вечером.</div>
    <div class="doc">${DAILY.map((x,n)=>{ const t=TECH[x.tech]||{text:''};
      return `<details class="lx"><summary><b>${n+1}. ${x.name}</b><span>${x.dose}</span></summary>${figFor(x.tech,x.name)}<div class="tech">${t.text}</div></details>`; }).join('')}
    <p style="margin-top:12px" class="t2">Эти четыре пункта работают медленно и только от частоты. Полуприсед у стены даёт первые изменения в колене через 4–6 недель ежедневной работы, изометрия паха примерно так же. Делать их три раза в неделю вместо семи — значит растянуть результат вдвое.</p></div>
    <button type="button" class="btn big ${done?'':'pri'}" data-t>${done?'Снять отметку':'Сделано сегодня'}</button>`,
    (el,close)=>el.querySelector('[data-t]').addEventListener('click',()=>{ close(); toggleDaily(i); }));
}

/* ---------- Карточки «следующего шага» ---------- */
function statusLinesForDay(day){
  const out=[];
  const needBack=day.ex.some(x=>BACK_LOAD.includes(x.tech)), needKnee=day.ex.some(x=>x.badge[0]==='Скорость'||x.id==='kW');
  const bs=needBack?backStatus():null, ks=needKnee?kneeStatus():null;
  const needGroin=day.ex.some(x=>x.tech==='copenhagen'), gs=needGroin?groinStatus():null;
  [ks,bs,gs].forEach(s=>{ if(s) out.push({lvl:s.lvl, b:s.title, x:s.lvl==='g'?'':s.text}); });
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
function trainingHero(e){
  const day=e.day, t=trainingTime(e), st=sessionState(e.id), done=isGymDone(e), cls=typeClass(e);
  const mins=dayMinutes(day, state.week);
  const shown=day.ex.slice(0,6).map(x=>`<span class="chip">${esc(x.name)}</span>`).join('') + (day.ex.length>6?`<span class="chip">+${day.ex.length-6}</span>`:'');
  const S=daySummary(day);
  const W=watch[watchKey(e.id)]||{};
  let k = `${isNowWeek()?'Сегодня':DOW_FULL[e.dow]} · ${t||''}${dayPlace(day)?` · ${dayPlace(day)}`:''} · ≈${mins} мин`;
  let btn;
  if(isDropped(e.id)) btn=`<button type="button" class="btn big white hb" data-unskip>Вернуть день</button>`;
  else if(st==='run') btn=`<button type="button" class="btn big white hb" data-play>Вернуться к тренировке</button>`;
  else if(done || st==='done') { k=`Сделано · ${S.done} из ${S.total}${W.s&&W.e?` · ${fmtDur(watchMinutes(W))}`:''}`; btn=`<button type="button" class="btn big white hb" data-play>Открыть итог</button>`; }
  else btn=`<button type="button" class="btn big white hb" data-start>Начать тренировку</button>`;
  return `<div class="hero ${cls}" data-day="${e.id}">
    <div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><div class="k">${k}</div><div class="t">${day.title}</div></div>
      <button type="button" class="pl-cb" style="background:rgba(0,0,0,.2)" data-more aria-label="Не получается?">${IC.more}</button></div>
    <div class="s">${day.note}</div>
    ${isDropped(e.id)?'':`<div class="chips">${shown}</div>`}
    <div style="margin-top:12px">${dayNotesHTML(e,true)}</div>
    ${btn}</div>`;
}
function cardioHero(e){
  const sk=isDropped(e.id), d1=isRunDone(e), d2=!!marks[key(e.id,'ball')];
  return `<div class="hero c-car" data-day="${e.id}">
    <div class="k">${trainingTime(e)} · ${e.dur}</div><div class="t">Велосипед + мяч</div>
    <div class="s">${sk?'Пропущено. Догонять не надо.':e.note}</div>
    ${e.moveNote?`<div class="note" style="margin-top:12px"><b>Сдвинуто</b>${e.moveNote}</div>`:''}
    ${sk?`<button type="button" class="btn big white hb" data-unskip>Вернуть</button>`:`
    <div style="margin-top:14px">
      <button type="button" class="row" style="width:100%;color:inherit" data-ck="${e.ex}"><span class="ck${d1?' on':''}" style="border-color:rgba(255,255,255,.6)">${IC.check}</span><span class="grow" style="text-align:left"><div class="nm">Велосипед ${e.dur}</div><div class="ds" style="color:inherit;opacity:.85">80–85 оборотов · пульс по плану</div></span></button>
      <button type="button" class="row" style="width:100%;color:inherit;border-color:rgba(255,255,255,.25)" data-ck="ball"><span class="ck${d2?' on':''}" style="border-color:rgba(255,255,255,.6)">${IC.check}</span><span class="grow" style="text-align:left"><div class="nm">Мяч · дриблинг</div><div class="ds" style="color:inherit;opacity:.85">${BALL.dose}</div></span></button>
    </div>
    <div class="btnrow"><button type="button" class="btn white" data-how>Как настроить</button><button type="button" class="btn white" data-skip>Пропустил</button></div>`}
  </div>`;
}
function restHero(e, week){
  const ord=d=>(d===0?7:d);
  const next=week.filter(x=>x.type!=='rest' && !(x.type==='gym'&&isDropped(x.id)) && ord(x.dow)>ord(e.dow))[0];
  return `<div class="hero c-rest"><div class="k">Сегодня · отдых</div><div class="t">Отдых</div>
    ${e.why?`<div class="s t2">${e.why}</div>`:''}
    ${next?`<div class="note" style="margin-top:14px"><b>Следующая: ${DOW_FULL[next.dow]}</b>${next.type==='gym'?next.day.title:next.title}${trainingTime(next)?` · ${trainingTime(next)}`:''}</div>`:''}
  </div>`;
}
function morningHero(){
  return `<div class="hero" id="morning"><div class="k" style="color:var(--t3)">Сначала замер · 30 секунд</div>
    ${morningFormHTML(isoDay())}
    <div class="muted small" style="margin-top:12px">Пишется сразу. По колену, пояснице и паху план подстраивается.</div>
    <button type="button" class="btn big pri hb" data-mdone>Готово</button></div>`;
}
function eveningHero(es){
  const td=todayIdx(), iso=isoDay();
  const T=nutritionTarget(), t=totalsOfDay(td)||{k:0};
  const hk=id=>`${state.cycle}-${state.week}-hab-${id}-${td}`;
  const S=sleepInfo(), sh=SHOWER[todayKind()];
  const lines=[];
  es.filter(e=>e.type==='gym').forEach(e=>lines.push([isGymDone(e)||isDropped(e.id), e.day.title+(isDropped(e.id)?' — отменена':'')]));
  es.filter(e=>e.type==='run').forEach(e=>lines.push([isRunDone(e)||isDropped(e.id), 'Велосипед + мяч']));
  lines.push([morningDone(iso), morningDone(iso)?`Утро: ${morningLine(iso)}`:'Утренний замер не записан']);
  lines.push([!!marks[dailyKey(td)], 'Каждый день']);
  lines.push([t.k>0 && Math.abs(t.k-T.k)<=120, `Еда: ${kfmt(t.k)} из ${kfmt(T.k)} ккал`]);
  return `<div class="hero"><div class="k" style="color:var(--t3)">Итоги дня</div><div class="t">Как прошёл день</div>
    <div style="margin-top:10px">${lines.map(([ok,txt])=>`<div class="done-line" style="min-height:40px"><span class="ck${ok?' on':''}">${IC.check}</span>${esc(txt)}</div>`).join('')}</div>
    <div class="sec" style="margin-top:14px">Привычки</div>
    ${[['sl1','Лёг в одно и то же время'],['sl2','Не пропустил ни одного приёма пищи']].map(([id,txt])=>`<button type="button" class="row" style="width:100%" data-hab="${hk(id)}"><span class="ck${marks[hk(id)]?' on':''}">${IC.check}</span><span class="grow" style="text-align:left"><div class="nm">${txt}</div></span></button>`).join('')}
    <div class="note" style="margin-top:12px"><b>Сон: ${S.target}, отбой 01:00</b>${S.why}</div>
    <div class="note"><b>Душ: ${sh.t.toLowerCase()}</b>${sh.x()}</div>
  </div>`;
}

/* ---------- Лента «дальше сегодня» ---------- */
function timelineItems(es){
  const iso=isoDay(), td=todayIdx(), items=[];
  items.push({t:'08:30', c:'c-kc', nm:'Утренний замер', ds: morningDone(iso)?morningLine(iso):'вес, пульс, колено, поясница, пах', done:morningDone(iso), act:'morning'});
  items.push({t:'весь день', sort:'08:31', c:'c-car', nm:'Каждый день', ds:`колени, пах, стопа · ${dailyMinutes()} мин`, done:!!marks[dailyKey(td)], act:'daily', ck:true});
  es.forEach(e=>{
    if(e.type==='gym') items.push({t:trainingTime(e)||'—', c:typeClass(e), nm:e.day.title+(isDropped(e.id)?' · отменена':''), ds:`≈${dayMinutes(e.day,state.week)} мин`, done:isGymDone(e)||isDropped(e.id), act:'gym', id:e.id});
    if(e.type==='run') items.push({t:trainingTime(e), c:'c-car', nm:'Велосипед + мяч', ds:e.dur, done:isRunDone(e)||isDropped(e.id), act:'run', id:e.id});
  });
  const mt=mealTiming(td), log=foodLog[`${state.cycle}-${state.week}-${td}`]||{};
  const times=[...Object.entries(log.times||{}).filter(([id])=>log.dishOn&&log.dishOn[id]).map(([,t])=>t), ...(log.custom||[]).map(x=>x.t).filter(Boolean)];
  mt.rows.filter(r=>!/^(Подъём|Тренировка|Физра)/.test(r[1])).forEach(r=>{
    const near=times.some(t=>Math.abs(hm2min(t)-hm2min(r[0]))<=90);
    items.push({t:r[0], c:'c-kc', nm:r[1], ds:r[2]?`белок ${r[2]} г`:'', done:near, act:'food', at:r[0]});
  });
  items.push({t:'01:00', sort:'25:00', c:'c-rest', nm:'Отбой', ds:`норма ${sleepInfo().target}`, done:false, act:'sleep'});
  const val=x=>{ const s=x.sort||x.t; return /^\d/.test(s) ? hm2min(s.slice(0,5))+(s.startsWith('25')?1440:0) : 0; };
  /* сделанное уходит вниз серым */
  return items.sort((a,b)=>(a.done-b.done) || (val(a)-val(b)));
}
function foodQuickSheet(at){
  const us=usualNow(6), conts=cookList().filter(c=>cookLeft(c)>0);
  openSheet(`<h2>Что съел?</h2><div class="sub">${at?`По режиму в ${at}. `:''}Тап — записано на сейчас, с отменой.</div>
    ${conts.length?`<div class="sec">Контейнеры</div><div class="pills">${conts.map((c,i)=>`<button type="button" class="pill" data-cont="${i}">${esc(dishById(c.m).name)}${c.g?` + ${esc(dishById(c.g).name.toLowerCase())}`:''} <small>${cookLeft(c)} ост.</small></button>`).join('')}</div>`:''}
    <div class="sec">Как обычно в это время</div><div class="pills">${us.map((u,i)=>quickPill(u,i)).join('')||'<span class="muted">Пока нет истории</span>'}</div>
    <button type="button" class="btn big pri" style="margin-top:18px" data-go>Открыть «Еду»</button>`,
    (el,close)=>{
      el.querySelectorAll('[data-cont]').forEach(b=>b.addEventListener('click',()=>{ close(); eatContainer(conts[+b.dataset.cont], true); }));
      el.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{ close(); eatQuick(us[+b.dataset.q], true); }));
      el.querySelector('[data-go]').addEventListener('click',()=>{ close(); goTab('food'); });
    });
}

/* ---------- Экран ---------- */
function renderNowScreen(){
  const box=$('#scr-now'); if(!box) return;
  /* «Сейчас» — про сегодня: открыта не та неделя — показываем её день недели и говорим об этом */
  if(foodDay!==todayIdx() && document.body.dataset.tab!=='food'){ foodDay=todayIdx(); loadFoodDay(); }
  const td=todayIdx(), iso=isoDay(), now=hm2min(nowHM());
  const week=buildWeek(), es=week.filter(e=>e.dow===new Date().getDay());
  const gyms=es.filter(e=>e.type==='gym'), runs=es.filter(e=>e.type==='run'), rest=es.find(e=>e.type==='rest');
  const T=nutritionTarget(), tk=(totalsOfDay(td)||{k:0}).k;
  const planned=gyms.filter(e=>!isDropped(e.id)).length+runs.filter(e=>!isDropped(e.id)).length;
  const doneN=gyms.filter(e=>!isDropped(e.id)&&isGymDone(e)).length+runs.filter(e=>!isDropped(e.id)&&isRunDone(e)).length;
  const running=gyms.find(e=>sessionState(e.id)==='run');
  const pendingGym=gyms.find(e=>!isDropped(e.id) && !isGymDone(e) && sessionState(e.id)!=='done');
  const pendingRun=runs.find(e=>!isDropped(e.id) && !isRunDone(e));
  const mDone=morningDone(iso);

  /* приветствие */
  let greet = now<12*60 ? 'Доброе утро' : now<18*60 ? 'Добрый день' : now<22*60 ? 'Добрый вечер' : 'Итоги дня';
  if(running) greet='Идёт тренировка';
  else if(pendingGym && isNowWeek()){ const tt=hm2min(trainingTime(pendingGym)||'17:00'), dm=tt-now; if(dm>0 && dm<=180) greet = dm<60 ? `Через ${dm} мин` : `Через ${Math.floor(dm/60)} ч ${dm%60?dm%60+' мин':''}`.trim(); }

  /* следующий шаг */
  let hero='';
  if((!mDone || mEdit) && now<12*60) hero=morningHero();
  else if(running) hero=trainingHero(running);
  else if(pendingGym && now<21*60) hero=trainingHero(pendingGym);
  else if(pendingRun && now<21*60) hero=cardioHero(pendingRun);
  else if(now>=20*60) hero=eveningHero(es);
  else if(gyms.length) hero=trainingHero(gyms[0]);
  else if(runs.length) hero=cardioHero(runs[0]);
  else if(rest) hero=restHero(rest, week);

  const notes=statusNotes().map(n=>`<div class="note ${n.lvl}">${n.html}</div>`).join('');
  const off=!isNowWeek() && !posForDate(isoDay()).pre ? `<div class="note i"><b>Открыта неделя ${state.cycle===1&&state.week>12?'сессии '+(state.week-12):state.week}, а не текущая</b>Тренировки и еда показываются за эту неделю. <button type="button" class="link" data-auto>Вернуть неделю по дате</button></div>` : '';

  const items=timelineItems(es).filter(it=>!(hero.includes('id="morning"') && it.act==='morning'));
  box.innerHTML=`
    <div class="hd"><div class="tt"><div class="kick">${DOW_IDX[td]} · неделя ${isSession()?`сессии ${state.week-12}`:state.week} · ${cycleShort()}</div><div class="h1">${greet}</div></div>
      <div class="rings">
        <div class="ring"><div class="rc">${ringSVG(58,8,planned?doneN/planned:0,'var(--str)')}<div class="rv n">${planned?`${doneN}/${planned}`:'—'}</div></div><div class="rl">${planned?'трен.':'отдых'}</div></div>
        <div class="ring"><div class="rc">${ringSVG(58,8,T.k?tk/T.k:0, tk>T.k+120?'var(--wn)':'var(--kc)')}<div class="rv n">${T.k?Math.round(tk/T.k*100):0}%</div></div><div class="rl">еда</div></div>
      </div></div>
    <div id="installSlot"></div><div id="onbSlot"></div>
    ${off}${notes}
    ${hero}
    <div class="sec">Сегодня</div>
    <div class="card tline" style="padding:6px 16px">${items.map(it=>`
      <div class="it${it.done?' done':''} tap" data-act="${it.act}" ${it.id?`data-id="${it.id}"`:''} ${it.at?`data-at="${it.at}"`:''}>
        <span class="tm n">${it.t}</span><span class="bar ${it.c}"></span>
        <span><div class="nm">${esc(it.nm)}</div>${it.ds?`<div class="ds">${esc(it.ds)}</div>`:''}</span>
        ${it.act==='sleep'?'<span></span>':`<button type="button" class="ck${it.done?' on':''}" ${it.ck?'data-tog':''} aria-label="${esc(it.nm)}">${IC.check}</button>`}
      </div>`).join('')}</div>`;

  renderInstallHint(); renderOnboard();

  /* утренний замер в карточке */
  const mh=box.querySelector('#morning');
  if(mh){ bindMorningForm(mh, iso); mh.querySelector('[data-mdone]').addEventListener('click',()=>{ if(!morningDone(iso)){ toast('Ничего не записано — сдвинь хотя бы одно'); return; } mEdit=false; renderAll(); toast(`Замер записан: ${morningLine(iso)}`); }); }
  /* тренировка */
  box.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>startWorkout(b.closest('[data-day]').dataset.day)));
  box.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>openPlayer(b.closest('[data-day]').dataset.day)));
  box.querySelectorAll('[data-more]').forEach(b=>b.addEventListener('click',()=>notWorkingSheet(b.closest('[data-day]').dataset.day)));
  box.querySelectorAll('[data-unskip]').forEach(b=>b.addEventListener('click',()=>{ unskip(b.closest('[data-day]').dataset.day); toast('День возвращён'); }));
  /* кардио */
  box.querySelectorAll('.hero.c-car [data-ck]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.closest('[data-day]').dataset.day, k=key(id,b.dataset.ck), was=!!marks[k];
    if(was) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); renderAll();
    if(!was) toast('Отмечено', ()=>{ delete marks[k]; saveMarks(); renderAll(); });
  }));
  box.querySelectorAll('.hero.c-car [data-how]').forEach(b=>b.addEventListener('click',()=>techSheet('bike_setup','Велосипед')));
  box.querySelectorAll('.hero.c-car [data-skip]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.closest('[data-day]').dataset.day; skips[skipKey(id)]=true; skips[dropKey(id)]=true; saveSkips(); renderAll();
    toast('Кардио пропущено — догонять не надо', ()=>unskip(id));
  }));
  /* итоги дня: привычки */
  box.querySelectorAll('[data-hab]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.hab; if(marks[k]) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); renderAll(); }));
  /* лента */
  box.querySelectorAll('.it').forEach(row=>{
    const act=row.dataset.act;
    const tog=row.querySelector('[data-tog]');
    if(tog) tog.addEventListener('click',e=>{ e.stopPropagation(); toggleDaily(todayIdx()); });
    row.addEventListener('click',()=>{
      if(act==='morning') morningSheet();
      else if(act==='daily') dailySheet();
      else if(act==='gym'){ const e=week.find(x=>x.id===row.dataset.id); if(sessionState(e.id)!=='idle'||isGymDone(e)) openPlayer(e.id); else daySheet(e.id); }
      else if(act==='run') daySheet(row.dataset.id);
      else if(act==='food') foodQuickSheet(row.dataset.at);
      else if(act==='sleep') openLibrarySection('Сон: норма недели');
    });
  });
  const ab=box.querySelector('[data-auto]'); if(ab) ab.addEventListener('click',()=>{ settings.auto=true; saveSettings(); applyAuto(); foodDay=todayIdx(); loadFoodDay(); renderAll(); toast('Неделя снова по дате'); });
}
