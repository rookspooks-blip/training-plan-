"use strict";
/* ############################################################
   ПЛЕЕР ТРЕНИРОВКИ · ЭКРАН (E3.1, макет А «Лента»)
   Сверху шапка: закрыть, штрихи шагов, меню. В середине лента: сделанное строками,
   текущее упражнение с дозой, «в прошлый раз», записанные подходы со временем.
   Внизу панель: вес и повторы с − и +, «Готово». Над панелью после подхода - полоса отдыха.
   Отдых ничего не блокирует. Модель, запись и таймер отдыха - в player-core.js.
   Один обработчик нажатий на весь экран (делегирование): экран перерисовывается целиком,
   а числа на панели при − и + обновляются на месте, чтобы удержание кнопки не рвалось.
   ############################################################ */
const ICO={
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more:'<svg viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.4"/></svg>',
  ck:'<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  sk:'<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>'
};
const plBox=()=>$('#player');

/* ---------- Тексты ---------- */
/* «12,5 кг × 8, 8, 7»: вес один на все подходы - выносится вперёд, разный - у каждого */
function plSumSets(sets, timed){
  const rec=(sets||[]).filter(x=>num(x.r)!=null); if(!rec.length) return '';
  const ws=rec.map(x=>num(x.w)||0), rs=rec.map(x=>String(x.r));
  const unit=timed?' сек':'';
  if(ws.every(w=>w===ws[0])) return (ws[0]?`${fmtW(ws[0])} кг × `:'')+rs.join(', ')+(ws[0]?'':unit);
  return rec.map((x,i)=>(ws[i]?fmtW(ws[i])+'×':'')+rs[i]).join(', ')+unit;
}
const plRowVal=(x,timed)=>{ const w=num(x.w)||0; return w ? `${fmtW(w)} кг × ${x.r}` : timed ? `${x.r} сек` : `${x.r} повт.`; };
const plFmtNum=n=>String(Math.round(n*10)/10).replace('.',',');

/* ---------- Лента ---------- */
function plPastLine(g, e, steps, L){
  const st=plGroupState(g, e, steps);
  if(st==='todo') return null;
  const tm=L.tm[g.id]||'';
  if(g.warm) return {sk:st==='skip', txt:'Разминка'+(st==='skip'?' · пропущена':''), tm:st==='skip'?'':tm, id:g.id};
  const ex=g.ex, Lg=plLog(ex);
  if(st==='skip') return {sk:true, txt:`${plShortName(ex.name)} · пропущено`, tm:'', id:g.id};
  if(isLogged(ex)){
    const sum=plSumSets(Lg&&Lg.sets, parseDose(ex.dose).timed);
    const last=Lg&&Lg.sets?[...Lg.sets].reverse().find(x=>num(x.r)!=null):null;
    return {sk:false, txt:sum?`${plShortName(ex.name)} · ${sum}`:plShortName(ex.name), tm:(last&&last.t)||'', id:g.id, part:st==='part'};
  }
  return {sk:false, txt:ex.name, tm, id:g.id};
}
function plPastHTML(lines, cap){
  if(!lines.length) return '';
  let more='';
  if(cap && lines.length>cap){ more=`<div class="more">ещё ${lines.length-cap} выше</div>`; lines=lines.slice(-cap); }
  return `<div class="pastl">${more}${lines.map(l=>`<button type="button" class="pl${l.sk?' sk':''}" data-a="past" data-id="${esc(l.id)}">${l.sk?ICO.sk:ICO.ck}<span>${esc(l.txt)}</span><time>${esc(l.tm)}</time></button>`).join('')}</div>`;
}
function plHeadHTML(tag, name, dose, id){
  return `<div class="exh" role="button" tabindex="0" data-a="title" data-id="${esc(id)}"><span class="ptag">${esc(tag)}</span><h2>${esc(name)}</h2>${dose?`<p class="dose">${esc(dose)}</p>`:''}</div>`;
}
function plFocusHTML(e, steps, cur, fid, groups){
  const gi=groups.findIndex(g=>g.id===fid), g=groups[gi], L=live();
  const tagOf=s=>`${s} · ${gi+1} из ${groups.length}`;
  if(g.warm){
    const W=warmupOf(e.day,state.week);
    return plHeadHTML(tagOf('Разминка'),'Разминка',W.dur,'warm')+`<div class="xcard">${W.list.map((s,i)=>
      `<button type="button" class="xrow wm chk" data-a="wi" data-tech="${esc(s.tech)}" data-nm="${esc(s.name)}"><span class="ck2${marks[key(PL.id,s.id)]?' on':''}"></span><span class="v">${esc(s.name)}</span><time>${mmss(s.sec)}</time></button>`).join('')}</div>`;
  }
  const ex=g.ex, type=plType(ex), tag=tagOf(ex.badge[0]), dose=ex.dose+(ex.zapas?` · запас ${ex.zapas}`:'')+(ex.sub?' · замена'+(ex.sub.note?': '+ex.sub.note.toLowerCase():''):'');
  if(type==='iv') return plIvFocus(ex, tag);
  if(type==='scn') return plScnFocus(ex, tag);
  if(type==='test') return plHeadHTML(tag, ex.name, ex.dose, ex.id)+`<div class="xcard"><div class="xrow"><span class="lbl">Последний результат</span><span class="pv">${plTestLast(ex)}</span></div></div>`;
  if(type==='set' || type==='hold'){
    const P=parseDose(ex.dose), Lg=plLog(ex), N=plSets(ex), last=lastLog(ex.name, logKey(PL.id,ex.id));
    const rows=[`<div class="xrow"><span class="lbl">В прошлый раз</span><span class="pv">${last?esc(plSumSets(last.sets,P.timed)):'нет записей'}</span></div>`];
    if(ex.hint) rows.push(`<div class="xrow"><span class="lbl">${esc(ex.hint)}</span></div>`);
    for(let si=0; si<N; si++){
      if(!plSetFull(ex,si)) continue;
      const s=Lg.sets[si], fresh=PL.undo && PL.undo.id===ex.id && PL.undo.si===si && Date.now()-PL.undo.t<UNDO_MS;
      const isNew=PL.newRow && PL.newRow.id===ex.id && PL.newRow.si===si;
      rows.push(`<div class="xrow${isNew?' new':''}" role="button" tabindex="0" data-a="row" data-id="${esc(ex.id)}" data-si="${si}"><span class="n">${si+1}</span><span class="v">${esc(plRowVal(s,P.timed))}</span>${fresh?`<button type="button" class="un" data-a="undo" data-t="${esc(s.t||'')}">Отменить</button>`:`<time>${esc(s.t||'')}</time>`}</div>`);
    }
    PL.newRow=null;
    const done=plGroupState(g,e,steps)==='done' && !plSkipped(ex.id);
    if(done && fid===ex.id){
      const cur10=Lg&&Lg.rpe;
      rows.push(`<div class="chiprow"><span class="lbl">Запас повторов</span>${ZAP.map(([t,v])=>`<button type="button" class="zc${cur10===v?' on':''}" data-a="zap" data-id="${esc(ex.id)}" data-v="${v}">${t}</button>`).join('')}</div>`);
    }
    return plHeadHTML(tag, ex.name, dose, ex.id)+`<div class="xcard">${rows.join('')}</div>`;
  }
  /* готовность и счёт: заголовок, при необходимости одна строка */
  const rows=[];
  if(ex.rest && ex.rest!=='—') rows.push(`<div class="xrow"><span class="lbl">Отдых между</span><span class="pv">${esc(ex.rest)}</span></div>`);
  if(type==='ready' && readyLow()) rows.push(`<div class="xrow"><span class="lbl" style="color:var(--acc)">Лёгкий день по прыжку</span></div>`);
  return plHeadHTML(tag, ex.name, dose, ex.id)+(rows.length?`<div class="xcard">${rows.join('')}</div>`:'');
}

/* ---------- Панель ---------- */
function plRestHTML(){
  const R=plRest(); if(!R) return '';
  const frac=R.total>0 ? Math.max(0,Math.min(1, 1-R.left/R.total)) : 1;
  return `<div class="rest${R.over?' over':''}" data-rest><span>Отдых</span><div class="bar"><i data-rbar style="width:${(R.over?100:frac*100).toFixed(1)}%"></i></div><b data-rt>${R.over?'+':''}${mmss(Math.abs(R.left))}</b></div>`;
}
function plStepper(f, val, unit, opt){
  const txt = f==='w' && !val ? '—' : plFmtNum(val);
  return `<div class="stp${opt.solo?' solo':''}${opt.chg?' chgd':''}" data-stp="${f}"><button type="button" class="sb" data-st="${f}" data-d="-1" aria-label="${f==='w'?'Вес':'Повторы'} меньше">−</button><button type="button" class="num" data-a="num" data-f="${f}" data-v>${txt}<small>${unit}</small></button><button type="button" class="sb" data-st="${f}" data-d="1" aria-label="${f==='w'?'Вес':'Повторы'} больше">+</button></div>`;
}
function plSetLabel(cur, lag, v){
  const side=plSide(cur.ex);
  const base=`Подход ${cur.si+1} из ${cur.n}${side?` · ${side}`:''}${cur.mate?` · в паре с «${cur.mate.name}»`:''}`;
  return lag ? `Дальше: ${plShortName(cur.ex.name)} · подход ${cur.si+1} из ${cur.n}` : base;
}
function plChgText(v){
  const cw='w' in v.ed, cr='r' in v.ed;
  if(cw && cr) return 'значения изменены';
  if(cw || cr) return cw ? 'вес изменён' : (v.P.timed?'секунды изменены':'повторы изменены');
  /* правило прогрессии советует прибавить: одна строка вместо длинного пояснения («в прошлый раз 10 кг, сегодня 12,5») */
  if(!v.rec && v.lastTop>0 && v.pl.w>v.lastTop && v.w===v.pl.w && !(v.w===v.defW && v.defW!==v.pl.w)) return `по плану +${plFmtNum(v.pl.w-v.lastTop)} кг`;
  return '';
}
function plPanelHTML(e, steps, cur, lag){
  const rest=plRestHTML();
  /* вопрос про опечатку: пока нет ответа, ничего не пишется */
  if(PL.ask && cur.k==='set'){
    const A=PL.ask;
    return `<div class="panel">${rest}<div class="plbl"><span>${esc(plSetLabel(cur,lag))}</span></div>
      <div class="ask"><b>${plFmtNum(A.val)} кг вместо ${plFmtNum(A.fix)}?</b><p>Это больше прошлого веса (${plFmtNum(A.ref)} кг) в ${Math.round(A.val/A.ref)} раз.</p></div>
      <div class="two"><button type="button" class="go alt" data-a="ask" data-v="keep">${plFmtNum(A.val)} кг</button><button type="button" class="go" data-a="ask" data-v="fix">${plFmtNum(A.fix)} кг</button></div></div>`;
  }
  /* новые виды шагов (интервалы, сценарий, тест) подключаются здесь по cur.k и cur.t: панель своя, остальной экран тот же */
  if(cur.k==='warm') return `<div class="panel">${rest}<div class="plbl"><span>Все пункты отмечаются сразу</span></div><button type="button" class="go" style="margin-top:0" data-a="warmdone">Разминка сделана</button></div>`;
  if(cur.k==='ex' && cur.t==='iv') return plIvPanel(cur, rest);
  if(cur.k==='ex' && cur.t==='scn') return plScnPanel(cur, rest);
  if(cur.k==='ex' && cur.t==='test') return plTestPanel(cur, rest, lag);
  if(cur.k==='ex'){
    const lab=(lag?`Дальше: ${plShortName(cur.ex.name)} · `:'')+cur.ex.dose;
    if(cur.t==='ready') return `<div class="panel">${rest}<div class="plbl"><span>${esc(lag?'Дальше: '+plShortName(cur.ex.name):'Метка на стене')}</span><span class="chg">не достал 2 из 3 - лёгкий день</span></div><div class="two" style="margin-top:0"><button type="button" class="go" data-a="ready" data-v="1">Достал метку</button><button type="button" class="go alt" data-a="ready" data-v="0">Не достал</button></div></div>`;
    return `<div class="panel">${rest}<div class="plbl"><span>${esc(lab)}</span></div><button type="button" class="go" style="margin-top:0" data-a="count">Сделано</button></div>`;
  }
  const v=plValues(cur), label=plSetLabel(cur,lag,v);
  if(cur.t==='hold'){
    const H=PL.hold && PL.hold.key===plSig(cur) ? PL.hold : null;
    if(H){
      const left=Math.max(0,Math.ceil((H.end-Date.now())/1000));
      return `<div class="panel">${rest}<div class="phase"><div class="plbl" style="padding:0 0 4px"><span>${esc(label)}</span></div><div class="big" data-hbig>${mmss(left)}<small>осталось</small></div><div class="pbar"><i data-hbar style="width:${(100*(1-left/H.sec)).toFixed(1)}%"></i></div></div><button type="button" class="go alt" style="margin-top:10px" data-a="hstop">Стоп</button></div>`;
    }
    return `<div class="panel">${rest}<div class="plbl"><span>${esc(label)}</span><span class="chg" data-chg>${esc(plChgText(v))}</span></div><div class="steppers">${plStepper('r',v.r,'секунд',{solo:true,chg:'r' in v.ed})}</div><button type="button" class="go" data-a="hstart">Старт</button></div>`;
  }
  const showW=v.hasW;
  const plus = !showW && v.canW ? `<button type="button" class="chg" style="min-height:44px;margin:-10px -6px -10px 0;padding:0 6px;font-weight:900" data-a="wplus">+ вес</button>` : `<span class="chg" data-chg>${esc(plChgText(v))}</span>`;
  return `<div class="panel">${rest}<div class="plbl"><span>${esc(label)}</span>${plus}</div>
    <div class="steppers">${showW?plStepper('w',v.w,v.WK.ph==='доп.'?'кг доп.':'кг',{chg:'w' in v.ed}):''}${plStepper('r',v.r,plUnit(v.P)==='сек'?'секунд':'повторов',{solo:!showW,chg:'r' in v.ed})}</div>
    <button type="button" class="go" data-a="done">Готово</button></div>`;
}
/* итог: время, сколько подходов, одна необязательная шкала */
function plSumPanel(e, steps){
  const W=watch[watchKey(PL.id)]||{}, ss=sessionState(PL.id);
  const m = ss==='run' ? watchMinutes({s:W.s, e:nowHM()}) : watchMinutes(W);
  const d=dayDate(e), GL=gymLoadOf(d, PL.id);
  let sets=0; plExList(e).forEach(ex=>{ sets+=plRecCount(ex); });
  const left=!!plCur(e,steps) || plGroups(e).some(g=>plSkipped(g.id));   /* есть что догнать: «Продолжить» вернёт пропущенное */
  return `<div class="panel sumv"><div class="big"><b>${m!=null?(m<60?`${m} мин`:`${Math.floor(m/60)} ч ${String(m%60).padStart(2,'0')}`):'-'}</b><span>${m!=null&&m>=60?'мин · ':''}${sets} ${plural(sets,'подход','подхода','подходов')}</span></div>
    <div class="plbl" style="padding-top:14px"><span>Как тяжело была тренировка, 1-10</span><span class="chg">${GL?`${GL.min} мин × ${GL.rpe}`:''}</span></div>
    <div class="sc">${Array.from({length:10},(_,i)=>`<button type="button" class="${GL&&GL.rpe===i+1?'on':''}" data-a="srpe" data-v="${i+1}">${i+1}</button>`).join('')}</div>
    <div class="two">${left?`<button type="button" class="go alt" data-a="resume">Продолжить</button>`:''}<button type="button" class="go${left?'':' neutral'}" data-a="min">Закрыть</button></div></div>`;
}

/* ---------- Отрисовка ---------- */
function plRender(){
  const box=plBox(), e=plEntry();
  if(!e){ closePlayer(); return; }
  const steps=plBuild(e), cur=plCur(e,steps), L=live(), groups=plGroups(e);
  const sum = !cur || PL.view==='sum';
  /* фокус ленты: текущее упражнение. Сразу после последнего подхода лента остаётся на нём (запас повторов),
     а панель уже говорит «Дальше» */
  let fid=null, lag=false;
  if(!sum){
    fid=cur.id;
    if(L.lx && L.lx!==cur.id){
      const lx=plOrdered(e).find(x=>x.id===L.lx);
      if(lx && isLogged(lx) && !plSkipped(lx.id) && plGroupState({id:lx.id},e,steps)==='done' && !(cur.k==='set' && plHasRec(cur.ex))){ fid=lx.id; lag=true; }
    }
  }
  const dash=groups.map(g=>{ const st=plGroupState(g,e,steps); return `<i class="${g.id===fid?'c':(st==='done'||(sum&&st!=='skip'&&st!=='todo'))?'d':''}"></i>`; }).join('');
  const lines=groups.filter(g=>g.id!==fid).map(g=>plPastLine(g,e,steps,L)).filter(Boolean);
  let feed;
  if(sum) feed=`<div class="fin"><div class="exh"><span class="ptag">Итог</span><h2>${esc(e.day.title)}</h2></div><div style="height:12px"></div>${plPastHTML(lines,0)}</div>`;
  else feed=`<div class="fin">${plPastHTML(lines,4)}${plFocusHTML(e,steps,cur,fid,groups)}</div>`;
  const panel = sum ? plSumPanel(e,steps) : plPanelHTML(e,steps,cur,lag);
  box.innerHTML=`<div class="pnav"><button type="button" class="rb" data-a="min" aria-label="Закрыть">${ICO.x}</button><div class="dashes">${dash}</div><button type="button" class="rb" data-a="menu" aria-label="Меню">${ICO.more}</button></div>
    ${PL.saveBad?`<div class="savebad"><span>Не сохраняется на телефоне</span><button type="button" data-a="saveb">Сделать копию</button></div>`:''}
    <div class="feed">${feed}</div>${panel}`;
  const f=box.querySelector('.feed'); if(f) f.scrollTop=f.scrollHeight;
  /* кнопка «Отменить» живёт 5 секунд: после - строка снова обычная */
  clearTimeout(PL.undoT);
  if(PL.undo && Date.now()-PL.undo.t<UNDO_MS) PL.undoT=setTimeout(plExpireUndo, UNDO_MS-(Date.now()-PL.undo.t)+30);
}
/* через 5 секунд «Отменить» превращается во время подхода. На месте, без перерисовки: нажатие в этот момент не пропадает */
function plExpireUndo(){
  plBox().querySelectorAll('.xrow .un').forEach(b=>{ const t=document.createElement('time'); t.textContent=b.dataset.t||''; b.replaceWith(t); });
}
/* числа панели на месте: удержание «+» не рвётся перерисовкой */
function plPatchPanel(){
  const box=plBox(); if(!box || box.hidden || !PL.id) return;
  const e=plEntry(); if(!e) return;
  const cur=plCur(e); if(!cur || cur.k!=='set') return;
  const v=plValues(cur);
  const put=(f,val,unit)=>{ const s=box.querySelector(`[data-stp="${f}"]`); if(!s) return;
    const n=s.querySelector('[data-v]'); n.innerHTML=`${f==='w'&&!val?'—':plFmtNum(val)}<small>${unit}</small>`; s.classList.toggle('chgd', f in v.ed); };
  put('w',v.w,v.WK.ph==='доп.'?'кг доп.':'кг');
  put('r',v.r,v.P.timed?'секунд':'повторов');
  const c=box.querySelector('[data-chg]'); if(c) c.textContent=plChgText(v);
}

/* ---------- Нажатия на − и +: один тап - один шаг, удержание повторяет ---------- */
function plAdj(f, d){
  const e=plEntry(); if(!e) return;
  const cur=plCur(e); if(!cur || cur.k!=='set') return;
  const v=plValues(cur);
  if(f==='w'){
    const step=plWStep(v.WK), val=v.w||0;
    let nv;
    if(d>0) nv = val ? val+step : (v.pl.w || v.lastTop || OPT_W[cur.ex.tech] || (v.WK.ph==='штанга'?20:step));
    else nv = Math.max(0, val-step);
    nv=Math.min(400, Math.round(nv*10)/10);
    plSetEdit(cur.ex,'w',nv);
  }else{
    const step=v.P.timed?5:1, val=v.r||0;
    plSetEdit(cur.ex,'r',Math.max(1,Math.min(v.P.timed?600:200, val+d*step)));
  }
  PL.ask=null;
  plNormEdit(cur); plPatchPanel();
}
let plRep={t:0,i:0};
function plRepStop(){ clearTimeout(plRep.t); clearInterval(plRep.i); }
function plRepStart(f,d){
  plRepStop(); plAdj(f,d); vibe(6);
  plRep.t=setTimeout(()=>{ plRep.i=setInterval(()=>{ plAdj(f,d); },110); }, 450);
}

/* ---------- Ввод с клавиатуры ---------- */
/* Границы и тексты ошибок. Тостов для проверки ввода нет: красная линия и одна строка под полем */
const PL_RULE={
  w:{re:/^\d+([.,]\d+)?$/, min:0, max:400, msg:'вес от 0 до 400'},
  r:{re:/^\d+$/, min:1, max:200, msg:'повторы от 1 до 200'},
  s:{re:/^\d+$/, min:1, max:600, msg:'секунды от 1 до 600'},
  v:{re:/^\d+([.,]\d+)?$/, min:0, max:99999, msg:'число от 0 до 99999'}
};
function plParse(kind, text){
  const R=PL_RULE[kind], t=String(text==null?'':text).trim();
  if(!R.re.test(t)) return {ok:false, msg:R.msg};
  let x=parseFloat(t.replace(',','.'));
  if(kind==='w' || kind==='v') x=Math.round(x*10)/10;
  if(!isFinite(x) || x<R.min || x>R.max) return {ok:false, msg:R.msg};
  return {ok:true, val:x};
}
function plNumSheet(o){
  return new Promise(res=>{
    let done=false;
    openSheet(`<h2>${esc(o.title)}</h2>${o.sub?`<div class="sub">${esc(o.sub)}</div>`:''}
      <div class="estp" style="grid-template-columns:1fr"><div class="col"><div class="fld"><input data-in class="inp0" type="text" inputmode="${o.kind==='w'?'decimal':'numeric'}" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(plFmtNum(o.value))}" aria-label="${esc(o.title)}"></div></div></div>
      <div class="errtxt" data-err hidden></div>
      <button type="button" class="btn big pri" style="margin-top:12px" data-ok>Готово</button>`,
      (el,close)=>{
        const inp=el.querySelector('[data-in]'), err=el.querySelector('[data-err]');
        const ok=()=>{
          const r=plParse(o.kind, inp.value);
          if(!r.ok){ inp.classList.add('err'); err.hidden=false; err.textContent=r.msg; return; }
          done=true; close(); res(r.val);
        };
        inp.addEventListener('input',()=>{ inp.classList.remove('err'); err.hidden=true; });
        inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); ok(); } });
        el.querySelector('[data-ok]').addEventListener('click',ok);
        try{ inp.focus(); inp.select(); }catch(x){}
      }, {onClose:()=>{ if(!done) res(null); }});
  });
}
async function plTypeNum(f){
  const e=plEntry(); if(!e) return;
  const cur=plCur(e); if(!cur || cur.k!=='set') return;
  const v=plValues(cur), ex=cur.ex;
  const kind = f==='w' ? 'w' : (v.P.timed ? 's' : 'r');
  const x=await plNumSheet({kind, title:f==='w'?'Вес, кг':(v.P.timed?'Секунды':'Повторы'), sub:f==='w'?v.WK.hint.replace(/<[^>]+>/g,''):'', value:f==='w'?v.w:v.r});
  if(x===null) return;
  /* опечатка на порядок: вес в 2 и более раза больше прошлого по этому упражнению */
  if(f==='w'){
    let prev=0; for(let i=cur.si-1;i>=0;i--) if(plSetFull(ex,i)){ prev=num(plLog(ex).sets[i].w)||0; break; }
    const ref=prev||v.lastTop;
    if(ref>0 && x>=2*ref){ PL.ask={field:'w', val:x, fix:Math.round(x/10*10)/10, ref}; plRender(); return; }
  }
  PL.ask=null;
  plSetEdit(ex, f, x); plNormEdit(cur); plRender();
}
function plAskAnswer(a){
  const A=PL.ask; if(!A) return;
  const e=plEntry(), cur=e&&plCur(e); PL.ask=null;
  if(cur && cur.k==='set'){ plSetEdit(cur.ex,'w', a==='fix'?A.fix:A.val); plNormEdit(cur); }
  plRender();
}

/* ---------- Лист правки записанного подхода ---------- */
function plEditSheet(exId, si){
  const e=plEntry(); if(!e) return;
  const ex=plExList(e).find(x=>x.id===exId); if(!ex) return;
  const L=plLog(ex), s=L&&L.sets[si]; if(!s) return;
  const P=parseDose(ex.dose), WK=weightKind(ex,P), wStep=plWStep(WK);
  const showW = (num(s.w)||0)>0 || plCanW(WK) || ['штанга','гантель','тренажёр','рюкзак','доп.'].includes(WK.ph);
  const fld=(f,lab,val)=>`<div class="col"><div class="lab">${lab}</div><div class="fld"><button type="button" data-d="-1" data-f="${f}" aria-label="меньше">−</button><input data-i="${f}" type="text" inputmode="${f==='w'?'decimal':'numeric'}" autocomplete="off" value="${esc(val)}" aria-label="${lab}"><button type="button" data-d="1" data-f="${f}" aria-label="больше">+</button></div></div>`;
  openSheet(`<h2>Подход ${si+1} · ${esc(plShortName(ex.name))}</h2>${s.t?`<div class="sub">записан в ${esc(s.t)}</div>`:''}
    <div class="estp" style="${showW?'':'grid-template-columns:1fr'}">${showW?fld('w','Вес, кг',plFmtNum(num(s.w)||0)):''}${fld('r',P.timed?'Секунды':'Повторы',String(s.r))}</div>
    <div class="errtxt" data-err hidden></div>
    <button type="button" class="btn big pri" style="margin-top:12px" data-save>Сохранить</button>
    <button type="button" class="btn danger" style="margin-top:10px" data-del>Удалить подход</button>`,
    (el,close)=>{
      const err=el.querySelector('[data-err]');
      const inp=f=>el.querySelector(`[data-i="${f}"]`);
      el.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{
        const f=b.dataset.f, d=+b.dataset.d, i=inp(f), x=parseFloat(String(i.value).replace(',','.'));
        const base=isFinite(x)?x:0, step=f==='w'?wStep:(P.timed?5:1);
        const nv=Math.max(f==='w'?0:1, Math.min(f==='w'?400:(P.timed?600:200), base+d*step));
        i.value=plFmtNum(nv); i.classList.remove('err'); err.hidden=true; vibe(6);
      }));
      el.querySelectorAll('[data-i]').forEach(i=>i.addEventListener('input',()=>{ i.classList.remove('err'); err.hidden=true; }));
      el.querySelector('[data-save]').addEventListener('click',()=>{
        const rr=plParse(P.timed?'s':'r', inp('r').value);
        const ww=showW ? plParse('w', inp('w').value) : {ok:true,val:0};
        const bad=!rr.ok?['r',rr.msg]:!ww.ok?['w',ww.msg]:null;
        if(bad){ inp(bad[0]).classList.add('err'); err.hidden=false; err.textContent=bad[1]; return; }
        plEditSet(ex, si, ww.val, rr.val); close(); plRender();
      });
      el.querySelector('[data-del]').addEventListener('click',()=>{
        const undo=plDeleteSet(ex, si); close(); plRender();
        if(undo) toast('Подход удалён', ()=>{ undo(); plRender(); });
      });
    });
}

/* ---------- Листы действий ---------- */
const plOpt=(a,t,s,extra)=>`<button type="button" class="opt${extra&&extra.danger?' danger':''}" data-a="${a}"><span class="grow"><b>${esc(t)}</b>${s?`<span>${esc(s)}</span>`:''}</span></button>`;
/* действия с упражнением: тап по заголовку и то же самое в меню */
function plExOptions(e, steps, exId){
  const g=plGroups(e).find(x=>x.id===exId); if(!g) return [];
  const o=[], st=plGroupState(g,e,steps), open=st!=='done';
  if(g.warm){ if(open) o.push(plOpt('skipex','Пропустить','разминка не нужна')); return o; }
  const ex=g.ex, A=ALTS[ex.name];
  o.push(plOpt('how','Как делать',ex.name));
  if(ex.sub && ex.sub.live) o.push(plOpt('rep0',`Вернуть «${ex.sub.from}»`,'замена больше не нужна'));
  else if(ex.alts && ex.alts.length && !plSkipDose(ex)) o.push(plOpt('rep1','Заменить','выбери причину: '+[...new Set(ex.alts.map(a=>V2_WHY[a.why]||a.why))].map(x=>x.toLowerCase()).join(', ')));
  else if(ex.sub) o.push(plOpt('sub0',`Вернуть «${ex.sub.from}»`,'замена больше не нужна'));
  else if(A && !plSkipDose(ex)) o.push(plOpt('sub1','Заменить',`на «${A.name}», если ${A.why}`));
  if(ex.action==='jump') o.push(plOpt('jump','Посчитать прыжок по видео','откроется в «Я»'));
  if(ex.action==='shootstage'){
    if(ex.stage<4) o.push(plOpt('shn',`Ритм автоматический - этап ${ex.stage+1}`,''));
    if(ex.stage>1) o.push(plOpt('shp',`Мяч опять ждёт - этап ${ex.stage-1}`,''));
  }
  if(open && plOrdered(e).filter(x=>x.id!==ex.id && !plSkipped(x.id) && plGroupState({id:x.id},e,steps)!=='done').length) o.push(plOpt('later','Сделать позже','упражнение уедет в конец тренировки'));
  if(open) o.push(plOpt('skipex','Пропустить',st==='skip'?'':'без переноса и вопросов'));
  if(isLogged(ex) && !plSkipped(ex.id)) o.push(plOpt('addset','Ещё один подход',''));
  return o;
}
function plExSheet(exId, title){
  const e=plEntry(); if(!e) return;
  const steps=plBuild(e), cur=plCur(e,steps), g=plGroups(e).find(x=>x.id===exId);
  const opts=plExOptions(e,steps,exId); if(!opts.length) return;
  openSheet(`<h2>${esc(title||(g&&g.ex?g.ex.name:'Разминка'))}</h2>${opts.join('')}<button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{ close(); plExAction(b.dataset.a, exId); })));
}
function plExAction(a, exId){
  const e=plEntry(); if(!e) return;
  const steps=plBuild(e), cur=plCur(e,steps), g=plGroups(e).find(x=>x.id===exId), ex=g&&g.ex;
  if(a==='how' && ex){
    const st = steps.find(x=>x.k==='set' && x.id===ex.id && !plDone(x,e)) || steps.find(x=>x.k==='set' && x.id===ex.id) || null;
    techSheet(ex.tech, ex.name, ex, st);
  }
  else if(a==='sub0'||a==='sub1'){ const from=a==='sub0'?ex.sub.from:ex.name; setSub(from, a==='sub1'); renderAll(); toast(a==='sub1'?'Заменено - журнал этого упражнения отдельный':`Вернул «${from}»`, ()=>{ setSub(from, a!=='sub1'); renderAll(); }); }
  else if(a==='rep1' && ex) plRepSheet(ex);
  else if(a==='rep0' && ex){ delete live().rep[ex.id]; liveSave(); plRender(); toast(`Вернул «${ex.sub.from}»`); }
  else if(a==='later'){ plLater(exId); plRender(); }
  else if(a==='skipex'){
    plSkipEx(exId); plCheckEnd(e, plBuild(e)); plRender();
    toast('Пропущено', ()=>{ plUnskipEx(exId); const W=watch[watchKey(PL.id)]; if(W && W.e && !W.ac){ delete W.e; saveWatch(); } plRender(); });
  }
  else if(a==='addset' && ex){
    const k=logKey(PL.id,ex.id), P=parseDose(ex.dose), Lg=logs[k]||{n:ex.name, d:null, sets:[], rpe:null};
    while(Lg.sets.length<P.sets) Lg.sets.push({w:'',r:''});
    Lg.sets.push({w:'',r:''}); Lg.n=ex.name; logs[k]=Lg; plPersistOk(saveLogs());
    delete marks[key(PL.id,ex.id)]; saveMarks();
    const W=watch[watchKey(PL.id)]; if(W && W.e){ delete W.e; delete W.ac; saveWatch(); }
    plRender();
  }
  else if(a==='jump'){ closePlayer(); goTab('me'); openJumpTool(); }
  else if(a==='shn'){ settings.shootStage=Math.min(4,shootStage()+1); saveSettings(); renderAll(); toast(`Бросок: этап ${shootStage()}`); }
  else if(a==='shp'){ settings.shootStage=Math.max(1,shootStage()-1); saveSettings(); renderAll(); toast(`Бросок: этап ${shootStage()}`); }
}
function plMenu(){
  const e=plEntry(); if(!e) return;
  const steps=plBuild(e), cur=plCur(e,steps), L=live();
  const ss=sessionState(PL.id);
  const exo = cur ? plExOptions(e,steps,cur.id) : [];
  openSheet(`<h2>${esc(e.day.title)}</h2>${exo.join('')}
    ${plOpt('short', L.short?'Полная версия':'Короткая версия', L.short?'вернуть необязательные упражнения':'без изоляции и кора, главные упражнения остаются')}
    ${ss!=='done'?plOpt('fin','Закончить сейчас','остальное пометится пропущенным'):''}
    ${plOpt('watch','Время и пульс с часов','начало, конец, пульс')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.a; close();
      if(a==='short'){ plShort(!L.short); plRender(); }
      else if(a==='fin'){ plFinishNow(e); PL.view=null; plRender(); }
      else if(a==='watch') watchSheet(PL.id);
      else if(cur) plExAction(a, cur.id);
    })));
}
/* тап по свёрнутой строке: правка подходов, снять отметку, вернуть пропущенное */
function plPastSheet(id){
  const e=plEntry(); if(!e) return;
  const steps=plBuild(e), g=plGroups(e).find(x=>x.id===id); if(!g) return;
  const st=plGroupState(g,e,steps);
  if(st==='skip'){
    openSheet(`<h2>${esc(g.warm?'Разминка':g.ex.name)}</h2><div class="sub">Пропущено</div>
      <button type="button" class="btn big pri" data-un>Вернуть в тренировку</button><button type="button" class="btn" style="margin-top:10px" data-close>Закрыть</button>`,
      (el,close)=>el.querySelector('[data-un]').addEventListener('click',()=>{ close(); plUnskipEx(id); const W=watch[watchKey(PL.id)]; if(W && W.e){ delete W.e; delete W.ac; saveWatch(); } PL.view=null; plRender(); }));
    return;
  }
  if(g.warm || !isLogged(g.ex)){
    const ex=g.ex, ready=ex&&plType(ex)==='ready';
    openSheet(`<h2>${esc(g.warm?'Разминка':ex.name)}</h2>
      ${ready?`<button type="button" class="opt" data-low><span class="grow"><b>${readyLow()?'Метку достал - вернуть обычный день':'Не достал метку 2 из 3'}</b><span>${readyLow()?'ноги и старты снова по плану':'день станет лёгким'}</span></span></button>`:''}
      <button type="button" class="opt" data-off><span class="grow"><b>Снять отметку</b><span>шаг снова станет текущим</span></span></button>
      <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
      (el,close)=>{
        el.querySelector('[data-off]').addEventListener('click',()=>{ close();
          if(g.warm) warmupOf(e.day,state.week).list.forEach(s=>{ delete marks[key(PL.id,s.id)]; }); else delete marks[key(PL.id,id)];
          saveMarks(); const W=watch[watchKey(PL.id)]; if(W && W.e){ delete W.e; delete W.ac; saveWatch(); } PL.view=null; plRender(); });
        const lo=el.querySelector('[data-low]'); if(lo) lo.addEventListener('click',()=>{ close(); setReadyLow(!readyLow()); renderAll(); });
      });
    return;
  }
  const ex=g.ex, Lg=plLog(ex), P=parseDose(ex.dose);
  const rows=(Lg&&Lg.sets||[]).map((s,i)=>num(s.r)==null?'':`<button type="button" class="opt" data-si="${i}"><span class="grow"><b>${i+1} · ${esc(plRowVal(s,P.timed))}</b>${s.t?`<span>${esc(s.t)}</span>`:''}</span></button>`).join('');
  openSheet(`<h2>${esc(ex.name)}</h2><div class="sub">Тап по подходу - правка</div>${rows||'<div class="sub">Подходов нет</div>'}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-si]').forEach(b=>b.addEventListener('click',()=>{ close(); plEditSheet(id,+b.dataset.si); })));
}

/* ---------- Нажатия ---------- */
function plDoneTap(){
  const now=Date.now(); if(now-PL.lastDone<DONE_GUARD_MS) return;
  const e=plEntry(); if(!e || PL.ask) return;
  const cur=plCur(e); if(!cur || cur.k!=='set' || cur.t!=='set') return;
  PL.lastDone=now; plAudio();
  const v=plValues(cur);
  if(!(v.r>=1)) return;
  plRecord(cur, v.w, v.r);
  PL.newRow={id:cur.id, si:cur.si}; vibe(25);
  plRender();
}
function plHoldStart(){
  const e=plEntry(); if(!e) return; const cur=plCur(e); if(!cur || cur.t!=='hold') return;
  const v=plValues(cur); plAudio();
  PL.hold={key:plSig(cur), end:Date.now()+v.r*1000, sec:v.r};
  const L=live(); L.hold=PL.hold; liveSave(); vibe(15); plRender();
}
function plHoldFinish(early){
  const e=plEntry(); if(!e || !PL.hold) return; const cur=plCur(e);
  if(!cur || plSig(cur)!==PL.hold.key){ PL.hold=null; live().hold=null; liveSave(); return; }
  const H=PL.hold, v=plValues(cur);
  const sec = early ? Math.max(1,Math.min(H.sec, Math.round(H.sec-(H.end-Date.now())/1000))) : H.sec;
  PL.hold=null; plRecord(cur, v.hasW?v.w:0, sec);
  PL.newRow={id:cur.id, si:cur.si}; if(!early) plBeep(); else vibe(25);
  plRender();
}
function plClick(ev){
  const t=ev.target.closest('[data-a]'); if(!t || !plBox().contains(t)) return;
  const a=t.dataset.a;
  /* свайп по строке уже сработал: нажатие после него не считается */
  if(PL.swiped && Date.now()-PL.swiped<400){ ev.preventDefault(); return; }
  if(a==='min') closePlayer();
  else if(a==='menu') plMenu();
  else if(a==='title') plExSheet(t.dataset.id);
  else if(a==='done') plDoneTap();
  else if(a==='num') plTypeNum(t.dataset.f);
  else if(a==='ask') plAskAnswer(t.dataset.v);
  else if(a==='wplus') plAdj('w',1);
  else if(a==='warmdone'){ const e=plEntry(), cur=e&&plCur(e); if(cur&&cur.k==='warm'){ PL.lastDone=Date.now(); plMarkEx(cur,e); vibe(20); plRender(); } }
  else if(a==='count'||a==='ready'){
    let e=plEntry(), cur=e&&plCur(e); if(!cur||cur.k!=='ex') return;
    if(Date.now()-PL.lastDone<DONE_GUARD_MS) return; PL.lastDone=Date.now();
    if(a==='ready'){ const id=cur.id; setReadyLow(t.dataset.v==='0'); e=plEntry(); cur=plBuild(e).find(s=>s.id===id); if(!cur) return; }
    plMarkEx(cur,e); vibe(25); plRender();
    if(a==='ready' && t.dataset.v==='0') toast('Лёгкий день: объём меньше, без отказа');
  }
  else if(a==='ivstart'||a==='ivpause'||a==='ivresume'||a==='ivfinish'||a==='ivsave'){
    const e=plEntry(), cur=e&&plCur(e); if(!cur||cur.t!=='iv') return;
    if(a==='ivstart'){ plAudio(); plIvStart(cur.ex); vibe(15); }
    else if(a==='ivpause') plIvPause(cur.ex);
    else if(a==='ivresume') plIvResume(cur.ex);
    else {
      if(Date.now()-PL.lastDone<DONE_GUARD_MS) return; PL.lastDone=Date.now();
      let hr=null; if(a==='ivsave'){ const inp=plBox().querySelector('[data-hrend]'), v=inp?inp.value.trim():'';
        if(v!==''){ const r=/^\d{2,3}$/.test(v)?+v:null; if(r==null||r<40||r>230){ inp.classList.add('err'); const er=plBox().querySelector('[data-err]'); if(er){ er.hidden=false; er.textContent='пульс от 40 до 230'; } return; } hr=r; } }
      plIvFinish(cur, e, hr); vibe(25);
    }
    plRender();
  }
  else if(a==='scstart'||a==='scnext'||a==='scp'){
    const e=plEntry(), cur=e&&plCur(e); if(!cur||cur.t!=='scn') return;
    if(a==='scstart'){ plAudio(); plScnStart(cur.ex); vibe(15); }
    else if(a==='scnext'){ if(Date.now()-PL.lastDone<DONE_GUARD_MS) return; PL.lastDone=Date.now(); plScnNext(cur, e); vibe(20); }
    else { const S=scnState(cur.ex), B=S&&scnBlocks(cur.ex)[S.blk]; if(B){ plShotAdj(B.id, t.dataset.f, +t.dataset.d); vibe(6); } }
    plRender();
  }
  else if(a==='tsave'){
    const e=plEntry(), cur=e&&plCur(e); if(!cur||cur.t!=='test') return;
    const inp=plBox().querySelector('[data-tv]'), er=plBox().querySelector('[data-err]'), r=plParse('v', inp?inp.value:'');
    if(!r.ok){ if(inp) inp.classList.add('err'); if(er){ er.hidden=false; er.textContent=r.msg; } return; }
    if(Date.now()-PL.lastDone<DONE_GUARD_MS) return; PL.lastDone=Date.now();
    plTestWrite(cur.ex, r.val, cur.ex.id==='sB2'?'2':''); plMarkEx(cur, e); vibe(25); plRender();
  }
  else if(a==='hstart') plHoldStart();
  else if(a==='hstop') plHoldFinish(true);
  else if(a==='undo'){ ev.stopPropagation(); if(plUndoLast()){ vibe(10); plRender(); } }
  else if(a==='row') plEditSheet(t.dataset.id, +t.dataset.si);
  else if(a==='zap'){ const e=plEntry(), ex=e&&plExList(e).find(x=>x.id===t.dataset.id); if(ex){ plSetZap(ex, +t.dataset.v); vibe(10); plRender(); } }
  else if(a==='past') plPastSheet(t.dataset.id);
  else if(a==='wi') techSheet(t.dataset.tech, t.dataset.nm);
  else if(a==='saveb') exportBackup();
  else if(a==='srpe'){
    const e=plEntry(); if(!e) return;
    const v=+t.dataset.v, d=dayDate(e), G=gymLoadOf(d, PL.id), W=watch[watchKey(PL.id)]||{};
    const m=watchMinutes(W.e?W:{s:W.s, e:nowHM()}) ?? dayMinutes(e.day, state.week);
    setGymLoad(d, PL.id, G&&G.min || m, G&&G.rpe===v ? null : v, W.iv ? {iv:{n:W.iv.n, work:W.iv.work, easy:W.iv.easy, ...(W.iv.hrEnd!=null?{hrEnd:W.iv.hrEnd}:{})}} : null); vibe(); plRender();
  }
  else if(a==='resume'){ const e=plEntry(); if(e){ plResume(e); PL.view=null; plRender(); } }
}
function plBindOnce(){
  const box=plBox();
  box.addEventListener('click', plClick);
  /* − и +: на pointerdown, чтобы удержание повторяло; клавиатурное нажатие приходит как click без указателя */
  box.addEventListener('pointerdown', ev=>{
    const b=ev.target.closest('[data-st]'); if(!b) return;
    ev.preventDefault(); plRepStart(b.dataset.st, +b.dataset.d);
  });
  box.addEventListener('click', ev=>{
    const b=ev.target.closest('[data-st]'); if(!b || ev.detail!==0) return;
    plAdj(b.dataset.st, +b.dataset.d);
  });
  box.addEventListener('contextmenu', ev=>{ if(ev.target.closest('[data-st]')) ev.preventDefault(); });
  ['pointerup','pointercancel','pointerleave'].forEach(n=>{ box.addEventListener(n, plRepStop); });
  window.addEventListener('blur', plRepStop);
  /* свайп влево по строке подхода - удалить (то же самое есть кнопкой в листе правки) */
  let sx=0, sy=0, row=null, dx=0;
  box.addEventListener('touchstart', ev=>{ const r=ev.target.closest('.xrow[data-a="row"]'); if(!r||ev.touches.length!==1){ row=null; return; } row=r; dx=0; sx=ev.touches[0].clientX; sy=ev.touches[0].clientY; }, {passive:true});
  box.addEventListener('touchmove', ev=>{
    if(!row) return; const t=ev.touches[0]; dx=t.clientX-sx; const dy=t.clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)+6){ row.style.transform=''; row=null; return; }
    if(dx<0){ row.style.transform=`translateX(${Math.max(dx,-140)}px)`; row.style.opacity=String(1+Math.max(dx,-140)/280); }
  }, {passive:true});
  const endSwipe=()=>{
    if(!row) return; const r=row; row=null;
    if(dx<-90){
      PL.swiped=Date.now();
      const e=plEntry(), ex=e&&plExList(e).find(x=>x.id===r.dataset.id);
      if(ex){ const undo=plDeleteSet(ex, +r.dataset.si); plRender(); if(undo) toast('Подход удалён', ()=>{ undo(); plRender(); }); }
    } else { r.style.transform=''; r.style.opacity=''; }
  };
  box.addEventListener('touchend', endSwipe); box.addEventListener('touchcancel', endSwipe);
  /* свайп шапки вниз - свернуть */
  let hy=null;
  box.addEventListener('touchstart', ev=>{ hy=ev.target.closest('.pnav') && !ev.target.closest('button') ? ev.touches[0].clientY : null; }, {passive:true});
  box.addEventListener('touchend', ev=>{ if(hy==null) return; const dy=ev.changedTouches[0].clientY-hy; hy=null; if(dy>60) closePlayer(); }, {passive:true});
  /* Enter и пробел на заголовке и строках */
  box.addEventListener('keydown', ev=>{ if((ev.key==='Enter'||ev.key===' ') && ev.target.matches('[role="button"]')){ ev.preventDefault(); ev.target.click(); } });
}

/* ---------- Открыть, свернуть ---------- */
function openPlayer(id, at){
  const e=buildWeek().find(x=>x.id===id && x.type==='gym');
  if(!e){ toast('Этой тренировки нет на открытой неделе'); return; }
  if(isDropped(id)){ toast('День отменён - сначала верни его'); return; }
  plAutoClose();
  if(PL.id!==id){ PL.undo=null; PL.ask=null; PL.hold=null; }
  PL.id=id; const L=live();
  if(L.hold && !PL.hold) PL.hold=L.hold;
  PL.view = (at==='sum' || (at!=='resume' && sessionState(id)==='done')) ? 'sum' : null;
  if(at==='resume'){ plResume(e); PL.view=null; }
  closeSheets();
  const pl=plBox(), wasHidden=pl.hidden;
  /* ошибка записи показывается строкой в плеере, а не тостом */
  if(wasHidden){ PL.warnedBefore=storeWarned; storeWarned=true; }
  pl.hidden=false; document.body.classList.add('playing','locked');
  if(wasHidden && !reducedMotion()){ pl.classList.remove('opening'); void pl.offsetWidth; pl.classList.add('opening'); }
  plWakeOn(); plRender(); updateMini();
}
function startWorkout(id){
  const e=buildWeek().find(x=>x.id===id);
  if(e && isNowWeek() && e.dow===new Date().getDay() && sessionState(id)==='idle'){
    setWatch(id,'s',nowHM());
    const W=watch[watchKey(id)]; if(W){ W.lt=Date.now(); saveWatch(); }
  }
  openPlayer(id);
}
function closePlayer(){
  if(TM.on) tmOff();
  plRepStop(); clearTimeout(PL.undoT);
  plBox().hidden=true; document.body.classList.remove('playing');
  if(!sheetStack.length && $('#page').hidden) document.body.classList.remove('locked');
  plWakeOff();
  if(PL.warnedBefore!==undefined){ storeWarned=PL.warnedBefore; PL.warnedBefore=undefined; }
  PL.view=null;
  renderAll();
}
/* После правок данных из других мест: плеер на виду - перерисовать */
function plRefresh(){
  if(plBox().hidden || !PL.id) return;
  const e=plEntry();
  if(!e || isDropped(PL.id)){ closePlayer(); return; }
  plRender();
}

/* ---------- Ход времени: отдых, удержание, автозакрытие ---------- */
let plLastAC=0, plLastMini=0;
function plTick(){
  const vis=!plBox().hidden, now=Date.now();
  if(now-plLastAC>=30000){   /* автозакрытие проверяем раз в 30 секунд */
    plLastAC=now;
    if(plAutoClose()){ if(vis) plRender(); renderAll(); return; }
  }
  const R=PL.id ? plRest() : null;
  if(R){
    if(R.over && !PL.beeped){ PL.beeped=true; if(R.left>-3) plBeep(); }
    if(vis){
      const box=plBox(), rt=box.querySelector('[data-rt]'), bar=box.querySelector('[data-rbar]'), rs=box.querySelector('[data-rest]');
      if(rt){ rt.textContent=(R.over?'+':'')+mmss(Math.abs(R.left)); if(bar) bar.style.width=((R.over?1:Math.max(0,Math.min(1,1-R.left/(R.total||1))))*100).toFixed(1)+'%'; if(rs) rs.classList.toggle('over',R.over); }
      else plRender();   /* полоса появилась (вернулись после паузы) */
    }
  }else if(vis && plBox().querySelector('[data-rest]')) plRender();
  /* интервалы: цифры на месте, смена фазы - сигнал и перерисовка */
  if(PL.id && LIVE && LIVE.iv){
    const e=plEntry(), cur=e&&plCur(e);
    if(cur && cur.t==='iv'){
      const S=ivState(cur.ex), idx=S.st==='end'?-1:S.idx;
      if(S.st==='run' && PL.ivIdx!==undefined && PL.ivIdx!==idx){ PL.ivIdx=idx; plBeep(); if(vis) plRender(); }
      else if(S.st==='end' && PL.ivIdx!==-1){ PL.ivIdx=-1; plBeep(); if(vis) plRender(); }
      else if(S.st==='run' && vis){
        PL.ivIdx=idx; const box=plBox(), b=box.querySelector('[data-ivbig]'), bar=box.querySelector('[data-ivbar]');
        if(b) b.firstChild.nodeValue=mmss(S.left); if(bar) bar.style.width=(100*(1-S.left/S.cur.sec)).toFixed(1)+'%';
      }
    }
  }
  if(PL.id && LIVE && LIVE.scn && vis){
    const S=LIVE.scn, box=plBox(), a=box.querySelector('[data-scb]'), t=box.querySelector('[data-sct]');
    if(a) a.textContent=plClock(Date.now()-S.bt0); if(t) t.textContent=plClock(Date.now()-S.t0);
  }
  if(PL.hold){
    const left=Math.ceil((PL.hold.end-Date.now())/1000);
    if(left<=0) plHoldFinish(false);
    else if(vis){ const b=plBox().querySelector('[data-hbig]'), bar=plBox().querySelector('[data-hbar]');
      if(b) b.firstChild.nodeValue=mmss(left); if(bar) bar.style.width=(100*(1-left/PL.hold.sec)).toFixed(1)+'%'; }
  }
  if(!vis && (R || now-plLastMini>=1000)){ plLastMini=now; updateMini(); }
}
/* Часто (2 раза в секунду) тикаем, только когда есть что считать: плеер на виду, идёт отдых или удержание.
   Иначе раз в 15 секунд - для автозакрытия и плашки */
const plBusy=()=>!plBox().hidden || !!PL.hold || !!(LIVE && (LIVE.restUntil || (LIVE.iv && !LIVE.iv.pause)));
function plLoop(){ try{ plTick(); }catch(e){} setTimeout(plLoop, plBusy()?500:15000); }
setTimeout(plLoop, 500);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){ if(!plBox().hidden) plWakeOn(); plTick(); }
});
plBindOnce();

/* ============ Лист «Заменить» по причине (программа v2): колено, поясница, плечо, кисть, занят тренажёр ============ */
function plRepSheet(ex){
  const A=ex.alts||[], whys=V2_ORDER.filter(w=>A.some(a=>a.why===w));
  openSheet(`<h2>Заменить</h2><div class="sub">${esc(ex.name)} · выбери причину</div>
    ${whys.map(w=>`<div class="sec" style="margin-top:12px">${esc(V2_WHY[w])}</div>${A.map((a,i)=>a.why!==w?'':`<button type="button" class="opt" data-i="${i}"><span class="grow"><b>${esc(a.tech?a.name:'Тот же вес, другой инструмент')}</b><span>${esc(a.note||(a.dose?a.dose:''))}</span></span></button>`).join('')}`).join('')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{
      const a=A[+b.dataset.i]; close();
      live().rep[ex.id]={why:a.why, name:a.tech?a.name:null, tech:a.tech||null, dose:a.dose||null, note:a.tech?(a.note||''):(a.note||a.name)};
      liveSave(); plRender(); toast(`Замена: ${a.tech?a.name:a.note||a.name}`);
    })));
}

/* ============ Интервалы ============ */
const plHrRow=(label,val)=>`<div class="hrrow"><span>${esc(label)}</span><b>${esc(val)}</b></div>`;
function plIvFocus(ex, tag){
  const I=ex.iv, S=ivState(ex), rows=[];
  for(let i=0;i<I.n;i++){
    const done = S.st==='end' || (S.idx!=null && S.cur && (S.cur.k==='work' ? i<S.cur.i : i<=S.cur.i-0 && i<S.cur.i+1 && S.cur.i>=i));
    const cur = S.st!=='idle' && S.st!=='end' && S.cur && S.cur.i===i && S.cur.k==='work';
    const fin = S.st==='end' || (S.cur && (S.cur.i>i || (S.cur.i===i && S.cur.k==='easy')));
    rows.push(`<div class="xrow"><span class="n">${i+1}</span><span class="v">Работа ${mmss(I.work)}</span>${fin?`<time>готово</time>`:cur?`<time>идёт</time>`:'<time></time>'}</div>`);
  }
  return plHeadHTML(tag, `Интервалы ${ex.dose}`, `${I.hr?`пульс ${I.hrNote||'на работе'} ${I.hr} · `:''}отдых ${ex.rest}`, ex.id)+`<div class="xcard">${rows.join('')}</div>`;
}
function plIvPanel(cur, rest){
  const ex=cur.ex, I=ex.iv, S=ivState(ex), hr=I.hr?plHrRow(I.hrNote?`Пульс ${I.hrNote}`:'Пульс на работе', I.hr):'';
  if(S.st==='idle') return `<div class="panel">${rest}<div class="plbl"><span>${I.n} × ${mmss(I.work)} · отдых ${mmss(I.easy)}</span></div>${hr}<button type="button" class="go" data-a="ivstart">Старт</button></div>`;
  if(S.st==='end') return `<div class="panel">${rest}<div class="plbl"><span>Интервалы закончены</span></div>
    <div class="estp" style="grid-template-columns:1fr"><div class="col"><div class="lab">Пульс в конце, необязательно</div><div class="fld"><input data-hrend class="inp0" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" placeholder="уд/мин" aria-label="Пульс в конце"></div></div></div>
    <div class="errtxt" data-err hidden></div><button type="button" class="go" data-a="ivsave">Записать</button></div>`;
  const frac=1-S.left/S.cur.sec;
  return `<div class="panel"><div class="phase"><div class="plbl" style="padding:0 0 4px"><span data-ivlbl>${esc(ivLabel(S))}${S.st==='pause'?' · пауза':''}</span></div>
    <div class="big" data-ivbig>${mmss(S.left)}<small>осталось</small></div><div class="pbar"><i data-ivbar style="width:${(frac*100).toFixed(1)}%"></i></div></div>
    ${hr}
    ${S.st==='pause'?`<div class="two"><button type="button" class="go alt" data-a="ivfinish">Закончить</button><button type="button" class="go" data-a="ivresume">Дальше</button></div>`:`<button type="button" class="go" data-a="ivpause">Пауза</button>`}</div>`;
}

/* ============ Сценарий четверга ============ */
function plScnFocus(ex, tag){
  const S=scnState(ex), B=scnBlocks(ex), rows=B.map((b,i)=>{
    const st = !S ? '' : i<S.blk ? 'готово' : i===S.blk ? 'идёт' : '';
    const sh = b.shoot ? shotsOf(b.id) : null;
    const sub=[b.dose&&!b.shoot&&b.id!=='b1'?b.dose:'', b.rest&&b.rest!=='—'?`отдых ${b.rest}`:''].filter(Boolean).join(' · ');
    return `<div class="xrow scn"><span class="n">${b.from}</span><span class="v">${esc(b.name)}${sub?`<small>${esc(sub)}</small>`:''}</span><time>${esc(st||`${b.from}–${b.to} мин`)}</time></div>`;
  });
  return plHeadHTML(tag, ex.name, 'по минутам, дальше - кнопкой', ex.id)+`<div class="xcard">${rows.join('')}</div>`;
}
const plClock=ms=>mmss(Math.max(0,Math.floor(ms/1000)));
function plScnPanel(cur, rest){
  const ex=cur.ex, B=scnBlocks(ex), S=scnState(ex);
  if(!S) return `<div class="panel">${rest}<div class="plbl"><span>${B.length} блока · ${B[B.length-1].to} минут</span></div><button type="button" class="go" data-a="scstart">Начать сценарий</button></div>`;
  const b=B[S.blk], last=S.blk===B.length-1, sh=b.shoot?shotsOf(b.id):null;
  const ctr=(f,val,lab)=>`<div class="stp solo" data-sc="${f}"><button type="button" class="sb" data-a="scp" data-f="${f}" data-d="-1" aria-label="${lab} меньше">−</button><span class="num" data-scv="${f}">${val}<small>${lab}</small></span><button type="button" class="sb" data-a="scp" data-f="${f}" data-d="1" aria-label="${lab} больше">+</button></div>`;
  return `<div class="panel">${rest}<div class="plbl"><span>Блок ${S.blk+1} из ${B.length} · ${b.from}–${b.to} мин</span></div>
    ${sh?`<div class="steppers">${ctr('h',sh.h,'попал')}${ctr('n',sh.n,'бросил')}</div>`:''}
    ${b.note?`<div class="small muted" style="padding:6px 4px 0">${esc(b.note)}</div>`:''}
    <div class="hrrow"><span>В блоке <b data-scb style="display:inline;font-size:inherit">${plClock(Date.now()-S.bt0)}</b></span><span>Всего <b data-sct>${plClock(Date.now()-S.t0)}</b></span></div>
    <button type="button" class="go" data-a="scnext">${last?'Сценарий закончен':'Дальше'}</button></div>`;
}

/* ============ Тест: число и единица ============ */
const plTestLast=ex=>{ const xs=tests.filter(x=>x.t===ex.test.t).sort((a,b)=>a.d<b.d?1:-1); return xs.length?`${String(xs[0].v).replace('.',',')} ${ex.test.u} · ${shortDate(xs[0].d)}`:'нет записей'; };
function plTestPanel(cur, rest, lag){
  const ex=cur.ex, v=plTestOf(ex);
  return `<div class="panel">${rest}<div class="plbl"><span>${esc(lag?'Дальше: '+ex.name:ex.name)} · ${esc(ex.test.u)}</span></div>
    <div class="estp" style="grid-template-columns:1fr"><div class="col"><div class="fld"><input data-tv class="inp0" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="${esc(ex.test.u)}" value="${v!=null?esc(String(v).replace('.',',')):''}" aria-label="${esc(ex.name)}, ${esc(ex.test.u)}"></div></div></div>
    <div class="errtxt" data-err hidden></div><button type="button" class="go" data-a="tsave">Записать</button></div>`;
}
