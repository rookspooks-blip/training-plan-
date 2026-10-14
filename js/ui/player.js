"use strict";
/* ############################################################
   ПЛЕЕР ТРЕНИРОВКИ
   Один подход на экран: фото, огромные числа плана, «Готово».
   Отдых — круг во весь экран, звук и вибрация в конце.
   Пары («в паре с …») чередуются: подход A → подход B → отдых.
   После последнего подхода — «Как тяжело?».
   Пишет туда же, что и раньше: журнал подходов, галочки,
   время с часов, самочувствие. Формат данных тот же.
   ############################################################ */
const PL={id:null, steps:[], i:0, rest:null, iv:0, wake:null, ctx:null, edit:{}, passed:new Set(), photo2:false};
const TYPE_VAR={'c-str':'var(--str)','c-spd':'var(--spd)','c-up':'var(--up)','c-car':'var(--car)','c-rest':'var(--t3)'};
const plEntry=()=>PL.id ? buildWeek().find(e=>e.id===PL.id && e.type==='gym') : null;
const plSkipDose=ex=>/пропустить/.test(ex.dose);
const mmss=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const plSide=ex=>{ const m=ex.dose.match(/на (ногу|руку|сторону)/); return m ? `на ${m[1]==='ногу'?'каждую ногу':m[1]==='руку'?'каждую руку':'каждую сторону'}` : ''; };
const plUnit=P=>P.timed?'сек':'повт.';

/* ---------- Шаги ---------- */
function plSets(ex){ const P=parseDose(ex.dose), L=logs[logKey(PL.id,ex.id)]; return Math.max(P.sets, L&&L.sets?L.sets.length:0); }
function plExList(e){ return e.day.ex.filter(x=>!plSkipDose(x)); }
function plBuild(e){
  const out=[], list=plExList(e);
  if(!e.day.noWarm) out.push({k:'warm'});
  const isPair=x=>/^в паре/.test(x.rest||'') && isLogged(x);
  for(let n=0;n<list.length;n++){
    const ex=list[n], nx=list[n+1];
    if(isPair(ex) && nx && isPair(nx)){
      const A=plSets(ex), B=plSets(nx);
      for(let s=0;s<Math.max(A,B);s++){
        if(s<A) out.push({k:'set', ex, si:s, n:A, mate:s<B?nx:null, first:true});
        if(s<B) out.push({k:'set', ex:nx, si:s, n:B, mate:s<A?ex:null});
      }
      out.push({k:'rpe', ex},{k:'rpe', ex:nx}); n++; continue;
    }
    if(isLogged(ex)){ const N=plSets(ex); for(let s=0;s<N;s++) out.push({k:'set', ex, si:s, n:N}); out.push({k:'rpe', ex}); }
    else out.push({k:'ex', ex});
  }
  out.push({k:'sum'});
  return out;
}
const plLog=ex=>logs[logKey(PL.id,ex.id)];
const plSetFull=(ex,si)=>{ const L=plLog(ex); return !!(L && L.sets && L.sets[si] && num(L.sets[si].r)!=null); };
const plAnyLogged=e=>plExList(e).some(x=>{ const L=plLog(x); return L && hasData(L); });
function plStepDone(st, e){
  if(st.k==='warm') return PL.passed.has('warm') || warmupOf(e.day,state.week).list.every(s=>marks[key(PL.id,s.id)]) || plAnyLogged(e);
  if(st.k==='set') return plSetFull(st.ex, st.si);
  if(st.k==='rpe'){ const L=plLog(st.ex); return PL.passed.has('rpe'+st.ex.id) || !!(L && L.rpe!=null); }
  if(st.k==='ex') return PL.passed.has('ex'+st.ex.id) || !!marks[key(PL.id,st.ex.id)];
  return false;
}
function plFirstUndone(e){ const i=PL.steps.findIndex(st=>!plStepDone(st,e)); return i<0 ? PL.steps.length-1 : i; }
const plSig=st=>st ? `${st.k}|${st.ex?st.ex.id:''}|${st.si??''}` : '';
/* Состав дня поменялся (замена, колено, «не достал метку») — остаёмся на том же месте */
function plRebuild(){
  const e=plEntry(); if(!e) return;
  const sig=plSig(PL.steps[PL.i]);
  PL.steps=plBuild(e);
  const j=PL.steps.findIndex(st=>plSig(st)===sig);
  PL.i = j>=0 ? j : Math.min(PL.i, PL.steps.length-1);
}

/* ---------- Запись подхода — как раньше в журнале ---------- */
function plWrite(ex, si, w, r){
  const k=logKey(PL.id, ex.id), P=parseDose(ex.dose);
  const L=logs[k] || {n:ex.name, d:null, sets:[], rpe:null};
  while(L.sets.length<P.sets) L.sets.push({w:'',r:''});
  while(L.sets.length<=si) L.sets.push({w:'',r:''});
  L.sets[si]={w: w ? fmtW(w) : '', r: r==null ? '' : String(r)};
  L.n=ex.name; L.tr=P.lo; L.th=P.hi; L.ns=P.sets; L.wk=weekKind(state.cycle,state.week);
  if(!L.d && hasData(L)) L.d=isoDay();
  logs[k]=L; saveLogs();
  /* все подходы записаны → упражнение отмечено само */
  if(L.sets.length && L.sets.every(x=>num(x.r)!=null)){ marks[key(PL.id,ex.id)]=true; saveMarks(); }
  delete PL.edit[k+'|'+si];
}
function plSetRpe(ex, v){
  const k=logKey(PL.id, ex.id), P=parseDose(ex.dose);
  const L=logs[k] || {n:ex.name, d:null, sets:Array.from({length:P.sets},()=>({w:'',r:''})), rpe:null};
  L.rpe=v; L.n=ex.name; L.tr=P.lo; L.th=P.hi; L.ns=P.sets; L.wk=weekKind(state.cycle,state.week);
  logs[k]=L; saveLogs();
}
/* Что показать в подходе: записанное → правка → вес прошлого подхода → план */
function plValues(st){
  const ex=st.ex, P=parseDose(ex.dose), k=logKey(PL.id,ex.id), L=logs[k];
  const pl=planFor(ex,P,k), WK=weightKind(ex,P);
  const rec = plSetFull(ex, st.si) ? L.sets[st.si] : null;
  const ed = PL.edit[k+'|'+st.si] || {};
  const ps = pl.sets[st.si] || pl.sets[pl.sets.length-1] || {};
  const prev = st.si>0 && L && L.sets[st.si-1] && num(L.sets[st.si-1].r)!=null ? num(L.sets[st.si-1].w) : undefined;
  const w = rec ? num(rec.w) : ('w' in ed ? ed.w : (prev!==undefined ? prev : (ps.w ?? null)));
  const r = rec ? num(rec.r) : ('r' in ed ? ed.r : (ps.r ?? null));
  return {ex, P, k, L, pl, WK, rec, w, r};
}
const plWStep=WK=> WK.ph==='штанга'||WK.ph==='доп.'||WK.ph==='тренажёр' ? 2.5 : WK.ph==='рюкзак' ? 1 : 0.5;
const plCanW=WK=> WK.ph!=='—' || /пусто, если без веса/.test(WK.hint);

/* ---------- Отдых: считает от времени окончания, экран не гаснет ---------- */
function plBeep(){
  try{
    const c=PL.ctx; if(c){
      [0,0.22,0.44].forEach(t=>{
        const o=c.createOscillator(), g=c.createGain();
        o.frequency.value=880; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(0.0001,c.currentTime+t);
        g.gain.exponentialRampToValueAtTime(0.35,c.currentTime+t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+t+0.18);
        o.start(c.currentTime+t); o.stop(c.currentTime+t+0.2);
      });
    }
  }catch(e){}
  try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){}
}
async function plWakeOn(){ try{ if('wakeLock' in navigator && !PL.wake) PL.wake=await navigator.wakeLock.request('screen'); }catch(e){} }
function plWakeOff(){ try{ PL.wake && PL.wake.release(); }catch(e){} PL.wake=null; }
function plStartRest(sec, label){
  try{ PL.ctx=PL.ctx||new (window.AudioContext||window.webkitAudioContext)(); if(PL.ctx.state==='suspended') PL.ctx.resume(); }catch(e){}
  PL.rest={end:Date.now()+sec*1000, total:sec, label:label||''};
  plWakeOn(); clearInterval(PL.iv); PL.iv=setInterval(plTick,250);
}
function plStopRest(){ clearInterval(PL.iv); PL.rest=null; plWakeOff(); updateMini(); }
const plLeft=()=>PL.rest ? Math.max(0, Math.round((PL.rest.end-Date.now())/1000)) : 0;
function plTick(){
  if(!PL.rest){ clearInterval(PL.iv); return; }
  const left=plLeft(), box=$('#player');
  if(!box.hidden){
    const v=box.querySelector('.bigring .v'), arc=box.querySelector('.bigring .arc');
    if(v) v.textContent=mmss(left);
    if(arc){ const c=+arc.dataset.c; arc.setAttribute('stroke-dashoffset', (c*(1-left/PL.rest.total)).toFixed(1)); }
  }
  updateMini();
  if(left<=0){
    plBeep(); plStopRest();
    if(box.hidden) toast('Отдых закончился — подход');
    else plRender();
  }
}

/* ---------- Открыть, свернуть ---------- */
function openPlayer(id, at){
  const same=PL.id===id && PL.steps.length;
  if(PL.id!==id){ plStopRest(); PL.id=id; PL.edit={}; PL.passed=new Set(); }
  const e=plEntry();
  if(!e){ toast('Этой тренировки нет на открытой неделе'); return; }
  if(isDropped(id)){ toast('День отменён — сначала верни его'); return; }
  if(same) plRebuild(); else { PL.steps=plBuild(e); PL.i=plFirstUndone(e); }
  if(at==='sum') PL.i=PL.steps.length-1;
  PL.photo2=false;
  closeSheets();
  $('#player').hidden=false; document.body.classList.add('playing','locked');
  plRender(); updateMini();
}
function startWorkout(id){
  const e=buildWeek().find(x=>x.id===id);
  if(e && isNowWeek() && e.dow===new Date().getDay() && sessionState(id)==='idle'){
    setWatch(id,'s',nowHM()); toast(`Начало ${nowHM()} · удачной тренировки`);
  }
  openPlayer(id);
}
function closePlayer(){
  $('#player').hidden=true; document.body.classList.remove('playing');
  if(!sheetStack.length && $('#page').hidden) document.body.classList.remove('locked');
  renderAll();
}
function plFinish(){
  setWatch(PL.id,'e',nowHM()); plStopRest();
  PL.i=PL.steps.length-1; plRender();
  toast('Готово. Оцени самочувствие — это видно в отчёте');
}
/* После правок данных из других мест: плеер на виду — перестроить */
function plRefresh(){
  if($('#player').hidden || !PL.id) return;
  const e=plEntry();
  if(!e || isDropped(PL.id)){ plStopRest(); closePlayer(); return; }
  plRebuild(); plRender();
}

/* ---------- Переходы ---------- */
function plGo(i){ if(PL.rest) plStopRest(); PL.i=Math.max(0,Math.min(PL.steps.length-1,i)); PL.photo2=false; plRender(); $('#player .pl-scroll') && ($('#player .pl-scroll').scrollTop=0); }
function plGroups(e){
  const g=[]; if(!e.day.noWarm) g.push({warm:true});
  plExList(e).forEach(ex=>g.push({ex})); return g;
}
function plGroupStart(gr, e){
  const match=st=> gr.warm ? st.k==='warm' : (st.ex && st.ex.id===gr.ex.id && st.k!=='rpe');
  const idx=PL.steps.map((st,i)=>match(st)?i:-1).filter(i=>i>=0);
  return idx.find(i=>!plStepDone(PL.steps[i],e)) ?? idx[0] ?? 0;
}
function plCurGroup(e){
  const st=PL.steps[PL.i], gs=plGroups(e);
  if(st.k==='warm') return 0;
  if(!st.ex) return -1;
  return gs.findIndex(g=>g.ex && g.ex.id===st.ex.id);
}
function plSwipe(dir){
  const e=plEntry(), gs=plGroups(e), cur=plCurGroup(e);
  if(cur<0){ if(dir<0) plGo(plGroupStart(gs[gs.length-1],e)); return; }
  const n=cur+dir;
  if(n<0) return;
  if(n>=gs.length){ plGo(PL.steps.length-1); return; }
  plGo(plGroupStart(gs[n],e));
}
function plAdvance(fromDone){
  const cur=PL.steps[PL.i], nx=PL.steps[PL.i+1];
  if(!nx) return;
  let rs=0;
  if(fromDone && nx.k!=='sum'){
    if(cur.k==='set'){ if(!(cur.first && nx.k==='set' && cur.mate && nx.ex===cur.mate) && nx.k!=='rpe') rs=restSec(cur.ex.rest); }
    else if(cur.k==='rpe' && (nx.k==='set'||nx.k==='ex')) rs=restSec(cur.ex.rest);
  }
  /* следующий шаг уже сделан (вернулся назад и прошёл заново) — отдыха нет */
  if(rs && plStepDone(nx, plEntry())) rs=0;
  PL.i++; PL.photo2=false;
  if(rs>0) plStartRest(rs, cur.ex.name);
  plRender();
  const sc=$('#player .pl-scroll'); if(sc) sc.scrollTop=0;
}

/* ---------- Отрисовка ---------- */
function plTop(e, light){
  const gs=plGroups(e), cur=plCurGroup(e);
  const dots=gs.map((g,i)=>{
    const done = g.warm ? plStepDone({k:'warm'},e) : !!marks[key(PL.id,g.ex.id)];
    return `<button type="button" class="${i===cur?'c':done?'d':''}" data-g="${i}" aria-label="${g.warm?'Разминка':esc(g.ex.name)}"><i></i></button>`;
  }).join('');
  return `<div class="pl-top"><button type="button" class="pl-cb" data-min aria-label="Свернуть">${IC.close}</button>
    <div class="pl-dots">${dots}<button type="button" class="${PL.steps[PL.i].k==='sum'?'c':''}" data-g="sum" aria-label="Итог"><i></i></button></div>
    <button type="button" class="pl-cb" data-menu aria-label="Ещё">${IC.more}</button></div>`;
}
function plMedia(ex){
  const p=photoOf(ex.tech, ex.name);
  if(p) return {html:`<div class="pl-photo" data-ph style="background-image:url('img/ex/${p}-${PL.photo2?1:0}.webp')"><span class="phl">${PL.photo2?'2 · конец':'1 · начало'}</span></div>`, img:true};
  const t=TECH[ex.tech];
  return {html:`<div class="pl-fig">${t && t.fig ? `<div class="fig">${S[t.fig]}</div>` : ''}</div>`, img:false};
}
function plTag(ex, e){
  const list=plExList(e), i=list.findIndex(x=>x.id===ex.id);
  return `<span class="tag">${esc(ex.badge[0])} · ${i+1} из ${list.length}</span>${ex.sub?' <span class="tag" style="background:var(--s3);color:var(--tx)">замена</span>':''}`;
}
function plNextText(st){
  if(!st) return '';
  if(st.k==='set'){ const v=plValues(st); return {b:`Подход ${st.si+1} из ${st.n} · ${v.w?fmtW(v.w)+' кг × ':''}${v.r??'—'} ${plUnit(v.P)}`, s:st.ex.name}; }
  if(st.k==='rpe') return {b:'Как тяжело было', s:st.ex.name};
  if(st.k==='ex') return {b:st.ex.name, s:st.ex.dose};
  return {b:'Итог тренировки', s:''};
}

function plRender(){
  const box=$('#player'), e=plEntry();
  if(!e){ closePlayer(); return; }
  if(PL.i>=PL.steps.length) PL.i=PL.steps.length-1;
  const st=PL.steps[PL.i], col=TYPE_VAR[typeClass(e)];
  box.style.setProperty('--c', col);
  if(PL.rest) return plRenderRest(e);
  let media={html:'<div class="pl-fig"></div>', img:false}, main='', dock='';

  if(st.k==='warm'){
    const warm=warmupOf(e.day, state.week), all=warm.list.every(s=>marks[key(PL.id,s.id)]);
    main=`<span class="tag">Разминка</span><div class="pl-name">Разминка${warm.level?` · уровень ${warm.level}`:''}</div>
      <div class="pl-setn">${warm.label} · ${warm.dur}</div>
      <div style="margin-top:14px">${dayNotesHTML(e)}</div>
      <div class="card" style="padding:4px 16px;margin-top:6px">${warm.list.map((s,i)=>{ const k=key(PL.id,s.id), on=!!marks[k];
        return `<div class="row"><button type="button" class="ck${on?' on':''}" data-wk="${k}" aria-label="${esc(s.name)}">${IC.check}</button>
          <div class="grow"><div class="nm">${i+1}. ${esc(s.name)}</div><div class="ds">${mmss(s.sec)} · ${esc(s.dose)}</div></div>
          <button type="button" class="link" data-tech="${s.tech}" data-nm="${esc(s.name)}">Как</button></div>`; }).join('')}</div>`;
    dock=`<button type="button" class="pl-done" data-warm>${all?'Дальше':'Вся сделана'}</button>`;
  }
  else if(st.k==='set'){
    const v=plValues(st), ex=st.ex, P=v.P;
    media=plMedia(ex);
    const last=lastLog(ex.name, v.k);
    const canW=plCanW(v.WK);
    let nums;
    const rBtn=`<button type="button" class="v n" data-r>${v.r??'—'}</button><span class="u">${plUnit(P)}</span>`;
    if(v.w) nums=`<button type="button" class="v n" data-w>${fmtW(v.w)}</button><span class="u">${v.WK.ph==='доп.'?'кг доп.':'кг'}</span><span class="x">×</span>${rBtn}`;
    else if(['штанга','гантель','тренажёр','рюкзак','доп.'].includes(v.WK.ph) && !/пусто, если без веса/.test(v.WK.hint) && v.pl.kind!=='back' && v.pl.kind!=='body')
      nums=`<button type="button" class="v n" data-w>—</button><span class="u">кг</span><span class="x">×</span>${rBtn}`;
    else nums=`${rBtn}${canW?`<button type="button" class="bw" data-w>свой вес</button>`:`<span class="bw">свой вес</span>`}`;
    const side=plSide(ex);
    main=`${plTag(ex,e)}<div class="pl-name">${esc(ex.name)}</div>
      <div class="pl-setn">Подход ${st.si+1} из ${st.n}${side?` · ${side}`:''}${st.mate?` · в паре с «${esc(st.mate.name)}»`:''}</div>
      <div class="huge">${nums}</div>
      <div class="pl-prev">${last?esc(lastSummary(last,P)):'В прошлый раз — нет записей'}</div>
      ${v.pl.t?`<div class="pl-why">Сегодня: ${v.pl.t}</div>`:''}
      ${st.si===0 && ex.warm && !/^Не нужна/.test(ex.warm)?`<div class="note" style="margin-top:12px"><b>Подводка</b>${ex.warm}</div>`:''}
      <div class="muted small" style="margin-top:10px">${v.WK.hint}</div>
      <div class="pl-act">
        <button type="button" class="pill" data-how>Как делать</button>
        ${ALTS[ex.name]||ex.sub?`<button type="button" class="pill" data-how>Заменить</button>`:''}
        ${st.si===st.n-1?`<button type="button" class="pill" data-addset>+ подход</button>`:''}
        <button type="button" class="pill" data-skipex>Пропустить упражнение</button>
      </div>`;
    const nx=PL.steps[PL.i+1];
    const rs = nx && nx.k!=='sum' && nx.k!=='rpe' && !(st.first && nx.k==='set' && st.mate && nx.ex===st.mate) ? restSec(ex.rest) : 0;
    dock = v.rec ? `<button type="button" class="pl-done neutral" data-next>${IC.check} Записано · дальше</button>`
      : v.r==null ? `<button type="button" class="pl-done" data-done>Ввести ${P.timed?'секунды':'повторы'}</button>`
      : `<button type="button" class="pl-done" data-done>Готово${rs?` <small>· отдых ${mmss(rs)}</small>`:(st.first&&st.mate?' <small>· сразу пара</small>':'')}</button>`;
  }
  else if(st.k==='rpe'){
    const L=plLog(st.ex), cur=L&&L.rpe;
    const R=[[6,'Легко, запас 4 и больше'],[7,'Мог ещё 3'],[8,'Мог ещё 2'],[9,'Мог ещё 1'],[10,'Предел, больше ни одного']];
    main=`${plTag(st.ex,e)}<div class="pl-name" style="margin-top:14px">Как тяжело было в последнем подходе?</div>
      <div class="pl-setn">${esc(st.ex.name)} · от этого зависит вес в следующий раз</div>
      <div class="rpe">${R.map(([v,t])=>`<button type="button" class="${v>=9?'h':''}${cur===v?' on':''}" data-rpe="${v}"><b>${v}</b><span>${t}</span></button>`).join('')}</div>`;
    dock=`<button type="button" class="btn big" data-rpeskip>${cur!=null?'Дальше':'Пропустить'}</button>`;
  }
  else if(st.k==='ex'){
    const ex=st.ex, done=!!marks[key(PL.id,ex.id)];
    media=plMedia(ex);
    main=`${plTag(ex,e)}<div class="pl-name">${esc(ex.name)}</div>
      <div class="huge" style="margin-top:12px"><span class="bw" style="color:var(--tx)">${esc(ex.dose)}</span></div>
      ${ex.rest&&ex.rest!=='—'?`<div class="pl-prev">Отдых ${esc(ex.rest)}</div>`:''}
      ${ex.warm && !/^Не нужна/.test(ex.warm)?`<div class="note" style="margin-top:12px"><b>Подводка</b>${ex.warm}</div>`:(ex.warm?`<div class="pl-why">${ex.warm}</div>`:'')}
      ${ex.action==='ready' && isNowWeek()?`<button type="button" class="btn big" style="margin-top:14px" data-ready>${readyLow()?'Метку достал — вернуть обычный день':'Не достал метку 2 из 3 → лёгкий день'}</button>`:''}
      ${ex.action==='jump'?`<button type="button" class="btn big pri" style="margin-top:14px" data-jump>Посчитать прыжок по видео</button>`:''}
      <div class="pl-act">
        <button type="button" class="pill" data-how>Как делать</button>
        ${restSec(ex.rest)?`<button type="button" class="pill" data-timer>Таймер отдыха ${mmss(restSec(ex.rest))}</button>`:''}
        <button type="button" class="pill" data-skipex>Пропустить</button>
      </div>`;
    dock=`<button type="button" class="pl-done${done?' neutral':''}" data-exdone>${done?`${IC.check} Сделано · дальше`:'Сделано'}</button>`;
  }
  else {
    const S=daySummary(e.day), W=watch[watchKey(PL.id)]||{}, ss=sessionState(PL.id);
    const m = ss==='run' ? watchMinutes({s:W.s, e:nowHM()}) : watchMinutes(W);
    const d=dayDate(e), feel=num((body[d]||{}).feel);
    const list=plExList(e);
    main=`<span class="tag">Итог</span><div class="pl-name">${ss==='done'?'Тренировка сделана':e.day.title}</div>
      <div class="pl-setn">${ss==='run'?`Идёт с ${esc(W.s)}`:ss==='done'?`${esc(W.s)}–${esc(W.e)}`:'Время не записано'}</div>
      <div class="mac" style="margin:16px 0 6px">
        <div><b class="n">${m!=null?fmtDur(m):'—'}</b><span>время</span></div>
        <div><b class="n">${S.done}/${S.total}</b><span>упражнений</span></div>
        <div><b class="n">${S.vol?kfmt(S.vol):'—'}</b><span>кг поднято</span></div></div>
      <div class="sec">Самочувствие после, 1–10</div>
      <div class="scale10">${Array.from({length:10},(_,i)=>`<button type="button" class="${feel===i+1?'on':''}" data-feel="${i+1}">${i+1}</button>`).join('')}</div>
      <div class="sec">Упражнения</div>
      <div class="card" style="padding:4px 16px">${list.map(ex=>{ const L=plLog(ex), on=!!marks[key(PL.id,ex.id)];
        const P=parseDose(ex.dose);
        const t= L&&hasData(L) ? L.sets.filter(x=>num(x.r)!=null).map(x=>(num(x.w)?fmtW(num(x.w))+'×':'')+x.r).join(' · ')+(L.rpe?` · тяжесть ${L.rpe}`:'') : (on?'сделано':'не сделано');
        return `<button type="button" class="row tap" style="width:100%;text-align:left" data-jumpex="${ex.id}"><span class="ck${on?' on':''}" style="width:32px;height:32px">${IC.check}</span>
          <span class="grow"><div class="nm">${esc(ex.name)}</div><div class="ds">${esc(t)}${P.timed&&L&&hasData(L)?' сек':''}</div></span></button>`; }).join('')}</div>
      <button type="button" class="btn" style="margin-top:6px" data-watch>Время, пульс и калории с часов</button>`;
    dock = ss==='run' ? `<button type="button" class="pl-done" data-finish>Закончить тренировку</button>`
      : `<button type="button" class="btn big pri" data-min>Закрыть</button>`;
  }

  box.className = media.img ? '' : 'pl-noimg';
  box.innerHTML=`${plTop(e)}<div class="pl-scroll">${media.html}<div class="pl-body">${main}</div></div><div class="pl-dock">${dock}</div>`;
  plBind(e, st);
}

function plRenderRest(e){
  const box=$('#player'), left=plLeft(), R=PL.rest, nx=plNextText(PL.steps[PL.i]);
  const size=300, sw=18, r=(size-sw)/2, c=2*Math.PI*r;
  box.className='pl-noimg';
  box.innerHTML=`${plTop(e)}<div class="pl-scroll"><div class="pl-rest">
      <div class="bigring"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--s3)" stroke-width="${sw}" fill="none"/>
        <circle class="arc" data-c="${c.toFixed(1)}" cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--c)" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-left/R.total)).toFixed(1)}"/></svg>
        <div class="c"><div class="l">Отдых</div><div class="v">${mmss(left)}</div><div class="s">экран не погаснет</div></div></div>
      ${nx?`<div class="pl-next"><div class="k">Дальше</div><b>${esc(nx.b)}</b><span>${esc(nx.s)}</span></div>`:''}
    </div></div>
    <div class="pl-dock"><div class="pl-two"><button type="button" class="btn" data-plus>+30 сек</button><button type="button" class="btn pri" data-rskip>Пропустить</button></div></div>`;
  plBindTop(e);
  box.querySelector('[data-plus]').addEventListener('click',()=>{ PL.rest.end+=30000; PL.rest.total+=30; plTick(); vibe(); });
  box.querySelector('[data-rskip]').addEventListener('click',()=>{ plStopRest(); plRender(); });
}

function plBindTop(e){
  const box=$('#player');
  box.querySelectorAll('[data-min]').forEach(b=>b.addEventListener('click',closePlayer));
  box.querySelector('[data-menu]').addEventListener('click',()=>plMenu(e));
  box.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>{
    if(PL.rest) plStopRest();
    if(b.dataset.g==='sum') return plGo(PL.steps.length-1);
    plGo(plGroupStart(plGroups(e)[+b.dataset.g], e));
  }));
}
function plBind(e, st){
  const box=$('#player');
  plBindTop(e);
  /* фото: начало ↔ конец движения */
  const ph=box.querySelector('[data-ph]'); if(ph) ph.addEventListener('click',()=>{ PL.photo2=!PL.photo2; plRender(); });
  /* свайп — соседнее упражнение */
  const sc=box.querySelector('.pl-scroll'); let x0=null, y0=0;
  sc.addEventListener('touchstart',ev=>{ const t=ev.touches[0]; x0=t.clientX; y0=t.clientY; },{passive:true});
  sc.addEventListener('touchend',ev=>{ if(x0==null) return; const t=ev.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
    if(Math.abs(dx)>70 && Math.abs(dy)<50) plSwipe(dx<0?1:-1); },{passive:true});
  box.querySelectorAll('[data-tech]').forEach(b=>b.addEventListener('click',()=>techSheet(b.dataset.tech, b.dataset.nm)));
  box.querySelectorAll('[data-how]').forEach(b=>b.addEventListener('click',()=>techSheet(st.ex.tech, st.ex.name, st.ex)));
  const on=(sel,f)=>{ const b=box.querySelector(sel); if(b) b.addEventListener('click',f); };

  if(st.k==='warm'){
    box.querySelectorAll('[data-wk]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.wk; if(marks[k]) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); plRender(); }));
    on('[data-warm]',()=>{ warmupOf(e.day,state.week).list.forEach(s=>{ marks[key(PL.id,s.id)]=true; }); saveMarks(); PL.passed.add('warm'); vibe(20); plAdvance(false); });
  }
  if(st.k==='set'){
    const v=plValues(st), ek=v.k+'|'+st.si;
    const putEdit=(f,x)=>{
      if(v.rec){ const w=f==='w'?x:v.w, r=f==='r'?x:v.r; plWrite(st.ex, st.si, w, r); }
      else { PL.edit[ek]={...(PL.edit[ek]||{}), [f]:x}; }
      plRender();
    };
    on('[data-w]', async ()=>{
      const x=await numberSheet({title:'Вес', sub:v.WK.hint, value:v.w||'', start:v.w||10, step:plWStep(v.WK), min:0, max:400, unit:'кг', decimals:plWStep(v.WK)<1?1:(plWStep(v.WK)===2.5?1:0), clear:plCanW(v.WK)?'Без веса':null});
      if(x===null) return; putEdit('w', x===''?0:x);
    });
    on('[data-r]', async ()=>{
      const x=await numberSheet({title:v.P.timed?'Секунды':'Повторы', value:v.r??'', start:v.P.lo||10, step:v.P.timed?5:1, min:0, max:v.P.timed?600:200, unit:v.P.timed?'сек':'повторов', decimals:0});
      if(x===null || x==='') return; putEdit('r', x);
    });
    on('[data-done]', async ()=>{
      let r=v.r;
      if(r==null){
        const x=await numberSheet({title:v.P.timed?'Сколько секунд?':'Сколько повторов?', value:'', start:v.P.lo||10, step:v.P.timed?5:1, min:0, max:v.P.timed?600:200, unit:v.P.timed?'сек':'повторов', decimals:0, verb:'Записать'});
        if(x===null || x==='') return; r=x;
      }
      plWrite(st.ex, st.si, v.w, r); vibe(25); plAdvance(true);
    });
    on('[data-next]',()=>plAdvance(false));
    on('[data-addset]',()=>{
      const k=v.k, P=v.P, L=logs[k]||{n:st.ex.name, d:null, sets:[], rpe:null};
      while(L.sets.length<P.sets) L.sets.push({w:'',r:''});
      L.sets.push({w:'',r:''}); L.n=st.ex.name; logs[k]=L; saveLogs();
      delete marks[key(PL.id,st.ex.id)]; saveMarks();
      plRebuild(); toast(`Подход ${L.sets.length} добавлен`); plRender();
    });
  }
  if(st.k==='set'||st.k==='ex'){
    on('[data-skipex]',()=>{
      PL.passed.add('ex'+st.ex.id); PL.passed.add('rpe'+st.ex.id);
      const j=PL.steps.findIndex((s,i)=>i>PL.i && s.ex && s.ex.id!==st.ex.id && (!st.mate || s.ex.id!==st.mate.id) && !plStepDone(s,e));
      plGo(j>=0 ? j : PL.steps.length-1);
      toast('Пропущено — можно вернуться к нему с полосок сверху');
    });
  }
  if(st.k==='rpe'){
    /* повторный тап по выбранной тяжести снимает её, как раньше */
    box.querySelectorAll('[data-rpe]').forEach(b=>b.addEventListener('click',()=>{ const v=+b.dataset.rpe, L=plLog(st.ex);
      if(L && L.rpe===v){ plSetRpe(st.ex, null); plRender(); toast('Тяжесть снята'); return; }
      plSetRpe(st.ex, v); vibe(20); plAdvance(true); }));
    on('[data-rpeskip]',()=>{ PL.passed.add('rpe'+st.ex.id); plAdvance(false); });
  }
  if(st.k==='ex'){
    on('[data-exdone]',()=>{ const k=key(PL.id,st.ex.id); if(!marks[k]){ marks[k]=true; saveMarks(); vibe(25); } plAdvance(false); });
    on('[data-timer]',()=>{ plStartRest(restSec(st.ex.rest), st.ex.name); plRender(); });
    on('[data-ready]',()=>{ setReadyLow(!readyLow()); renderAll(); toast(readyLow()?'Лёгкий день: объём меньше, без отказа':'Обычный день'); });
    on('[data-jump]',()=>{ closePlayer(); goTab('me'); openJumpTool(); });
  }
  if(st.k==='sum'){
    const d=dayDate(e);
    box.querySelectorAll('[data-feel]').forEach(b=>b.addEventListener('click',()=>{
      const v=+b.dataset.feel; body[d]=body[d]||{};
      if(num(body[d].feel)===v) delete body[d].feel; else body[d].feel=v;
      if(!Object.keys(body[d]).length) delete body[d];
      saveBody(); vibe(); plRender();
    }));
    box.querySelectorAll('[data-jumpex]').forEach(b=>b.addEventListener('click',()=>{ const ex=plExList(e).find(x=>x.id===b.dataset.jumpex); plGo(plGroupStart({ex},e)); }));
    on('[data-watch]',()=>watchSheet(PL.id));
    on('[data-finish]',plFinish);
  }
}

/* ---------- «⋯» в плеере ---------- */
function plMenu(e){
  const st=PL.steps[PL.i], ex=st.ex, ss=sessionState(PL.id);
  const A=ex && ALTS[ex.name] && !plSkipDose(ex);
  const o=[];
  if(ex) o.push(['how','Как делать', ex.name]);
  if(ex && ex.sub) o.push(['sub0',`Вернуть «${ex.sub.from}»`, 'замена больше не нужна']);
  else if(A) o.push(['sub1',`Заменить на «${ALTS[ex.name].name}»`, `если ${ALTS[ex.name].why}`]);
  o.push(['watch','Время, пульс и калории с часов', 'начало, конец, пульс']);
  o.push(['nw','Не получается?', 'пропустил, физры не было, болею']);
  if(ss==='run') o.push(['fin','Закончить тренировку', `идёт с ${(watch[watchKey(PL.id)]||{}).s}`]);
  o.push(['sum','Итог', 'что сделано, самочувствие']);
  openSheet(`<h2>${esc(e.day.title)}</h2>${o.map(([a,t,s])=>`<button type="button" class="opt" data-a="${a}"><span class="grow"><b>${esc(t)}</b><span>${esc(s)}</span></span></button>`).join('')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.a; close();
      if(a==='how') techSheet(ex.tech, ex.name, ex);
      else if(a==='sub0'||a==='sub1'){ const from=a==='sub0'?ex.sub.from:ex.name; setSub(from, a==='sub1'); renderAll(); toast(a==='sub1'?'Заменено — журнал этого упражнения отдельный':`Вернул «${from}»`, ()=>{ setSub(from, a!=='sub1'); renderAll(); }); }
      else if(a==='watch') watchSheet(PL.id);
      else if(a==='nw') notWorkingSheet(PL.id);
      else if(a==='fin') plFinish();
      else if(a==='sum'){ plStopRest(); plGo(PL.steps.length-1); }
    })));
}

/* ---------- «Как делать»: фото, текст, подводка, замена ---------- */
function techSheet(tech, name, ex){
  const t=TECH[tech]||{text:'<p>Описание будет добавлено.</p>'};
  let sub='';
  if(ex){
    if(ex.sub) sub=`<div class="note i"><b>Замена для «${esc(ex.sub.from)}»</b>${esc(ex.sub.why)}. <button type="button" class="link" data-sub="${esc(ex.sub.from)}" data-on="0">Вернуть «${esc(ex.sub.from)}»</button></div>`;
    else { const A=ALTS[ex.name]; if(A && !plSkipDose(ex)) sub=`<div class="note i"><b>Если ${esc(A.why)}</b><button type="button" class="link" data-sub="${esc(ex.name)}" data-on="1">заменить на «${esc(A.name)}»</button></div>`; }
  }
  openSheet(`<h2>${esc(name||'')}</h2>${ex?`<div class="sub">${esc(ex.dose)}${ex.rest&&ex.rest!=='—'?` · отдых ${esc(ex.rest)}`:''}</div>`:''}
    ${figFor(tech,name)}
    ${ex&&ex.warm?`<div class="note" style="margin-top:12px"><b>Подводка</b>${ex.warm}</div>`:''}
    <div class="tech" style="margin-top:12px">${t.text}</div>${sub}
    <button type="button" class="btn big" style="margin-top:14px" data-close>Закрыть</button>`,
    (el,close)=>{ const b=el.querySelector('[data-sub]'); if(b) b.addEventListener('click',()=>{
      const from=b.dataset.sub, onv=b.dataset.on==='1'; setSub(from, onv); close(); renderAll();
      toast(onv?'Заменено — журнал этого упражнения отдельный':`Вернул «${from}»`, ()=>{ setSub(from,!onv); renderAll(); }); }); });
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
  const speed=id==='d2'||id==='d4', pe=id==='d2' && !isSession() && !summerMode();
  const run=e.type==='run';
  const opts=[
    {a:'skip', t:moved?'Снова не сделал':'Пропустил',
     s:run?'кардио не переносится — догонять не надо':moved?'отменить тренировку на этой неделе':(speed?'скоростная не переносится — просто отменится':'перенести на ближайший подходящий день')},
    ...(moved?[{a:'back', t:'Вернуть в свой день', s:'перенос не нужен'}]:[]),
    ...(pe?[{a:'pe', t:noPE()?'Физра всё-таки была':'Физры не было', s:noPE()?'вернуть скоростную после физры':'прыжки дома, выносливость — горкой на дорожке'}]:[]),
    {a:'ill', t:'Болею', s:'пауза до конца недели, после — мягкое возвращение'}
  ];
  openSheet(`<h2>Не получается?</h2><div class="sub">${esc(DOW_FULL[e.dow])} · ${esc(title)}</div>
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

/* ---------- Полоска «Идёт тренировка» над вкладками ---------- */
function runningEntry(){
  if(PL.id && (PL.rest || sessionState(PL.id)==='run')){ const e=plEntry(); if(e) return e; }
  if(!isNowWeek()) return null;
  return buildWeek().find(e=>e.type==='gym' && sessionState(e.id)==='run') || null;
}
function updateMini(){
  const m=$('#mini'); if(!m) return;
  const e=$('#player').hidden ? runningEntry() : null;
  if(!e){ m.hidden=true; document.body.classList.remove('has-mini'); return; }
  const W=watch[watchKey(e.id)]||{}, min=W.s && !W.e ? watchMinutes({s:W.s, e:nowHM()}) : null;
  const rest=PL.rest && PL.id===e.id;
  m.hidden=false; document.body.classList.add('has-mini');
  m.innerHTML=`<span class="grow"><b>${rest?'Отдых':'Идёт тренировка'}${min!=null?` · ${min} мин`:''}</b><span>${esc(e.day.title)}</span></span>${rest?`<span class="mt">${mmss(plLeft())}</span>`:`<span class="pl-cb" style="background:rgba(127,127,127,.25);color:inherit">${IC.play}</span>`}`;
  m.onclick=()=>openPlayer(e.id);
}
setInterval(()=>{ if(!PL.rest) updateMini(); }, 30000);
