"use strict";
/* ############################################################
   «ПЛАН» — где я в году и как идёт неделя.
   Год одной полосой → неделя цветом дня → каждый день →
   еда за неделю → сон → привычки → отчёт.
   Карточка дня (лист) открывается отсюда и из ленты «Сейчас».
   ############################################################ */
const CYC_COL={cut:'var(--str)', ses:'var(--rest)', str:'var(--spd)', hyp:'var(--up)', test:'var(--test)'};
const KIND_RU={build:'рабочая', hyper:'рабочая', deload:'разгрузка', test:'тестовая', session:'сессия'};

/* Все недели года по порядку: цикл 1 + сессия, цикл 2, цикл 3 */
function yearWeeks(){
  const out=[];
  const add=(c,w)=>{ const k=weekKind(c,w); out.push({c,w,k}); };
  for(let w=1; w<=maxWeek(1); w++) add(1,w);
  for(let w=1; w<=12; w++) add(2,w);
  for(let w=1; w<=24; w++) add(3,w);
  let run=0;
  out.forEach(x=>{
    if(x.k==='deload'||x.k==='test'||x.k==='session') run=0; else run++;
    x.h = x.k==='deload' ? 30 : x.k==='test' ? 55 : x.k==='session' ? 40 : Math.min(100, (x.k==='hyper'?66:58)+run*9);
    x.col = x.k==='test' ? CYC_COL.test : x.k==='session' ? CYC_COL.ses : x.c===1 ? CYC_COL.cut : x.k==='hyper' ? CYC_COL.hyp : CYC_COL.str;
  });
  return out;
}
const weekTitle=(c,w)=> c===1 && w>12 ? `Сессия · неделя ${w-12} из ${settings.session|0}`
  : c===3 && w>24 ? `Повтор блока · неделя ${(w-25)%6+1} из 6`
  : `Неделя ${w} из ${c===1?12:maxWeek(c)}`;
const cycleGoal=(c,w)=>{
  const k=weekKind(c,w);
  if(c===1 && w>12) return 'поддержание формы';
  if(c===3 && w>24) return 'план пройден · повтор последнего блока';
  if(c===1) return 'сушка · свой вес';
  if(c===2) return 'сила · штанга';
  return k==='hyper' ? 'масса' : 'сила и прыжок';
};

/* ---------- Подпись дозировки с весом недели ---------- */
function doseShown(dayId, ex){
  let d=ex.dose;
  if(isLogged(ex) && !plSkipDose(ex)){
    const P=parseDose(ex.dose), pl=planFor(ex, P, logKey(dayId, ex.id)), bd=planBadge(ex, P, pl);
    if(bd){
      if(/·\s*[\d.,]+\s*кг/.test(d)) d=d.replace(/·\s*[\d.,]+\s*кг/, '· '+bd);
      else if(/·\s*(свой вес|рюкзак [\d–]+ кг)/.test(d)) d=d.replace(/·\s*(свой вес|рюкзак [\d–]+ кг)/, '· '+bd);
      else d+=' · '+bd;
    }
  }
  return d;
}

/* ---------- Карточка дня ---------- */
function daySheet(x){
  const week=buildWeek();
  const dow = typeof x==='number' ? x : (week.find(e=>e.id===x)||{}).dow;
  if(dow==null) return;
  const es=week.filter(e=>e.dow===dow);
  const isToday=isNowWeek() && dow===new Date().getDay();
  const iso=dateOfCW(state.cycle, state.week, (dow+6)%7);
  const parts=es.map(e=>{
    if(e.type==='rest'){
      const ord=d=>(d===0?7:d);
      const next=week.filter(y=>y.type!=='rest' && !(y.type==='gym'&&isDropped(y.id)) && ord(y.dow)>ord(e.dow))[0];
      return `<div class="hero c-rest" style="box-shadow:none;background:var(--s2)"><div class="k">Отдых</div><div class="t">${esc(e.title)}</div>${e.why?`<div class="s t2">${e.why}</div>`:''}
        ${next?`<div class="note" style="margin-top:12px;background:var(--s1)"><b>Следующая: ${DOW_FULL[next.dow]}</b>${next.type==='gym'?next.day.title:next.title}${trainingTime(next)?` · ${trainingTime(next)}`:''}</div>`:''}</div>`;
    }
    if(e.type==='run'){
      const sk=isDropped(e.id)||isSkipped(e.id), d1=isRunDone(e), d2=!!marks[key(e.id,'ball')];
      const W=watch[watchKey(e.id)]||{};
      return `<div data-day="${e.id}"><div class="kick">${trainingTime(e)} · ${e.dur}</div><div class="h2" style="margin:4px 0 6px">${esc(e.title)}</div>
        <div class="t2" style="margin-bottom:10px">${sk?'Пропущено. Догонять не надо.':e.note}</div>
        ${sk?`<div class="note y"><b>Пропущено</b>${DROP_ADVICE.run}</div><button type="button" class="btn big pri" data-unskip>Вернуть</button>`:`
        ${e.moveNote?`<div class="note i"><b>День сдвинут</b>${e.moveNote}</div>`:''}
        <div class="card" style="padding:4px 16px">
          <button type="button" class="row" style="width:100%;text-align:left" data-ck="${e.ex}"><span class="ck${d1?' on':''}">${IC.check}</span><span class="grow"><div class="nm">${esc(e.title)}</div><div class="ds">${e.dur}</div></span></button>
          <button type="button" class="row" style="width:100%;text-align:left" data-ck="ball"><span class="ck${d2?' on':''}">${IC.check}</span><span class="grow"><div class="nm">${BALL.name}</div><div class="ds">${BALL.dose}</div></span></button>
        </div>
        <div class="btnrow"><button type="button" class="btn" data-how="${e.mode==='run'?'run_setup':'bike_setup'}">Как настроить</button><button type="button" class="btn" data-ball>Мяч: как делать</button></div>
        <div class="btnrow"><button type="button" class="btn" data-watch>${W.s||W.hr?'Часы: '+[W.s&&W.e?fmtDur(watchMinutes(W)):'', W.hr?'пульс '+W.hr:''].filter(Boolean).join(' · '):'Время и пульс с часов'}</button><button type="button" class="btn" data-nw>Пропустил</button></div>`}
      </div>`;
    }
    const day=e.day, st=sessionState(e.id), done=isGymDone(e), dropped=isDropped(e.id);
    const t=trainingTime(e), S=daySummary(day);
    let btn='';
    if(dropped) btn=`<button type="button" class="btn big pri" data-unskip>Вернуть день</button>`;
    else if(st==='run') btn=`<button type="button" class="btn big pri" data-play>Вернуться к тренировке</button>`;
    else if(done||st==='done') btn=`<button type="button" class="btn big pri" data-sum>Итог тренировки</button>`;
    else if(isToday) btn=`<button type="button" class="btn big pri" data-start>Начать тренировку</button>`;
    else btn=`<button type="button" class="btn big pri" data-play>${iso<isoDay()?'Записать подходы':'Открыть в плеере'}</button>`;
    return `<div data-day="${e.id}">
      <div class="kick">${DOW_FULL[e.dow]}${t?` · ${t}`:''}${dayPlace(day)?` · ${dayPlace(day)}`:''} · ≈${dayMinutes(day,state.week)} мин${S.done?` · сделано ${S.done} из ${S.total}`:''}</div>
      <div class="h2" style="margin:4px 0 6px">${esc(day.title)}</div>
      <div class="t2" style="margin-bottom:10px">${day.note}</div>
      ${dayNotesHTML(e)}
      ${dropped?'':`
      ${!day.noWarm?`<div class="muted small" style="margin:4px 0 6px">Разминка ${warmupOf(day,state.week).dur} · ${warmupOf(day,state.week).label}</div>`:'<div class="muted small" style="margin:4px 0 6px">Разминка не нужна — после физры</div>'}
      <div class="card" style="padding:4px 16px">${day.ex.map(ex=>{ const on=!!marks[key(e.id,ex.id)], skip=plSkipDose(ex);
        return `<div class="row"><button type="button" class="ck${on?' on':''}" data-exck="${ex.id}" aria-label="${esc(ex.name)}" ${skip?'disabled style="opacity:.3"':''}>${IC.check}</button>
          <button type="button" class="grow" style="text-align:left" data-tech="${ex.id}"><div class="nm">${esc(ex.name)}${ex.sub?' <small class="muted">замена</small>':''}</div><div class="ds">${esc(doseShown(e.id, ex))}${ex.rest&&ex.rest!=='—'?` · отдых ${esc(ex.rest)}`:''}</div></button></div>`; }).join('')}</div>`}
      ${btn}
      <div class="btnrow"><button type="button" class="btn" data-nw>${dropped?'Что это значит':isMoved(e.id)?'Перенесено · изменить':'Не получается?'}</button><button type="button" class="btn" data-watch>Время и пульс</button></div>
    </div>`;
  });
  openSheet(`<div class="kick" style="margin-bottom:6px">${isToday?'Сегодня':DOW_FULL[dow]} · ${shortDate(iso)}</div>${parts.join('<div style="height:22px"></div>')}
    <button type="button" class="btn" style="margin-top:16px" data-close>Закрыть</button>`,
    (el,close)=>{
      el.querySelectorAll('[data-day]').forEach(box=>{
        const id=box.dataset.day, e=es.find(y=>y.id===id);
        const on=(sel,f)=>box.querySelectorAll(sel).forEach(b=>b.addEventListener('click',()=>f(b)));
        on('[data-start]',()=>{ close(); startWorkout(id); });
        on('[data-play]',()=>{ close(); openPlayer(id); });
        on('[data-sum]',()=>{ close(); openPlayer(id,'sum'); });
        on('[data-unskip]',()=>{ close(); unskip(id); toast('День возвращён'); });
        on('[data-nw]',()=>{ close(); notWorkingSheet(id); });
        on('[data-watch]',()=>{ close(); watchSheet(id); });
        on('[data-how]',b=>techSheet(b.dataset.how, 'Как настроить'));
        on('[data-ball]',()=>techSheet(BALL.tech, BALL.name, BALL));
        on('[data-tech]',b=>{ const ex=e.day.ex.find(y=>y.id===b.dataset.tech); techSheet(ex.tech, ex.name, ex); });
        on('[data-exck]',b=>{ const k=key(id,b.dataset.exck); if(marks[k]) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); b.classList.toggle('on',!!marks[k]); renderAll(); });
        on('[data-ck]',b=>{ const k=key(id,b.dataset.ck); if(marks[k]) delete marks[k]; else marks[k]=true; saveMarks(); vibe(); b.querySelector('.ck').classList.toggle('on',!!marks[k]); renderAll(); });
      });
    });
}

/* ---------- Ручной выбор недели ---------- */
function setWeekManual(c, w){
  if(settings.auto){
    const p=posForDate(isoDay());
    if(p.cycle!==c || p.week!==w){ settings.auto=false; saveSettings(); toast('Неделя выбрана вручную — автовыбор по дате выключен'); }
  }
  state.cycle=c; state.week=w; savePos();
  foodDay=todayIdx(); loadFoodDay(); renderAll();
}

/* ---------- Привычки недели: три считаются сами, две — кружками в итоге дня ---------- */
function habitRows(){
  const c=state.cycle, w=state.week, days=[0,1,2,3,4,5,6];
  const dk=(id,i)=>`${c}-${w}-hab-${id}-${i}`, old=id=>!!marks[`${c}-${w}-hab-${id}`];
  const n=id=>days.filter(i=>marks[dk(id,i)]).length;
  const dailyN=days.filter(i=>marks[`${c}-${w}-daily-${i}`]).length;
  const dates=days.map(i=>dateOfCW(c,w,i));
  const weighN=dates.filter(d=>body[d] && num(body[d].w)!=null).length;
  const gyms=buildWeek().filter(e=>e.type==='gym' && !isDropped(e.id) && dateOfCW(c,w,(e.dow+6)%7)<=isoDay());
  const loggedN=gyms.filter(e=>e.day.ex.some(x=>{ const L=logs[logKey(e.id,x.id)]; return L && hasData(L); })).length;
  return [
    {t:'Лёг в одно и то же время', v:old('sl1')?'✓ за неделю':`${n('sl1')} из 7`, s:'отмечается вечером в «Итогах дня»'},
    {t:'Не пропустил ни одного приёма пищи', v:old('sl2')?'✓ за неделю':`${n('sl2')} из 7`, s:'отмечается вечером в «Итогах дня»'},
    {t:'Сделал зарядку для колен', v:`${dailyN} из 7`, s:'день засчитан, когда отмечены все четыре упражнения'},
    {t:'Взвесился утром натощак', v:`${weighN} из 7`, s:'по утренним взвешиваниям, нужно минимум 3'},
    {t:'Записал рабочие веса', v:gyms.length?`${loggedN} из ${gyms.length}`:'—', s:'по записанным подходам'}
  ];
}

/* ---------- Полоса года: зажал — выросла, ведёшь пальцем — подпись недели, отпустил — её состав ---------- */
function bindYearScrub(box, yw, nowI, selI){
  const bar=box.querySelector('.year'), tip=box.querySelector('.ytip'), wrap=box.querySelector('.ywrap');
  if(!bar) return;
  const btns=[...bar.children];
  const tipHTML=i=>{ const x=yw[i];
    const when=i===nowI?'сейчас':i===selI?'открыта':i<nowI?'пройдена':'';
    return `<b>${weekTitle(x.c,x.w)}</b><span>Цикл ${x.c} · ${cycleGoal(x.c,x.w)} · ${KIND_RU[x.k]||''}</span>
      <span>${shortDate(dateOfCW(x.c,x.w,0))}–${shortDate(dateOfCW(x.c,x.w,6))} · ${i+1}-я неделя года из ${yw.length}${when?` · ${when}`:''}</span>`; };
  let on=false, live=false, cur=-1, pid=null, x0=0, lx=0, hold=0, raf=0, follow=0;
  /* как Dock на Mac: столбики у пальца плавно расширяются колоколом, соседи раздвигаются, дальние чуть сжимаются.
     Центр колокола φ (в номерах недель) подбираем так, чтобы его середина была ровно под пальцем */
  const n=btns.length, G=2.4, RB=9;
  const bell=t=>t<1 ? (Math.cos(Math.PI*t)+1)/2 : 0;
  const grows=phi=>btns.map((_,j)=>1+G*bell(Math.abs(j-phi)/RB));
  const posOf=(phi,g,W,gap)=>{   /* где на экране окажется точка φ при ширинах g */
    const u=(W-gap*(n-1))/g.reduce((a,b)=>a+b,0), k=Math.min(n-1,Math.floor(phi)), fr=phi-k;
    let x=0; for(let m=0;m<k;m++) x+=g[m]*u+gap;
    return x+g[k]*u*(0.5+fr);
  };
  const paint=()=>{
    raf=0;
    const r=bar.getBoundingClientRect(), W=r.width, gap=parseFloat(getComputedStyle(bar).columnGap)||0, x=lx-r.left;
    let lo=0, hi=n-1;
    for(let it=0; it<22; it++){ const mid=(lo+hi)/2; if(posOf(mid,grows(mid),W,gap)<x) lo=mid; else hi=mid; }
    const phi=(lo+hi)/2, g=grows(phi);
    btns.forEach((b,j)=>{ b.style.flexGrow=g[j].toFixed(3); b.style.setProperty('--f', ((g[j]-1)/G).toFixed(3)); });
    const i=Math.max(0, Math.min(n-1, Math.round(phi)));
    if(i!==cur){
      if(cur>=0) haptic();
      if(cur>=0) btns[cur].classList.remove('hot'); btns[i].classList.add('hot'); cur=i;
      tip.innerHTML=tipHTML(i); tip.hidden=false;
    }
    /* подпись — над пальцем */
    const wr=wrap.getBoundingClientRect(), w=tip.offsetWidth, cx=Math.max(4, Math.min(wr.width-4, lx-wr.left)), left=Math.max(0, Math.min(wr.width-w, cx-w/2));
    tip.style.transform=`translateX(${left}px)`; tip.style.setProperty('--ax', `${cx-left}px`);
  };
  const show=()=>{ if(!raf) raf=requestAnimationFrame(paint); };
  /* полоса растёт не сразу: после короткого удержания или движения вбок — иначе мешала бы прокрутке */
  const begin=()=>{
    if(!on||live) return; live=true; clearTimeout(hold);
    try{ bar.setPointerCapture(pid); }catch(_){}
    bar.classList.add('scrub'); vibe(6); paint();
    follow=setTimeout(()=>bar.classList.add('follow'), 230);   /* раскрылась — дальше идёт за пальцем без задержки */
  };
  const stop=()=>{
    clearTimeout(hold); clearTimeout(follow); if(raf){ cancelAnimationFrame(raf); raf=0; }
    on=false; live=false; cur=-1; bar.classList.remove('scrub','follow'); tip.hidden=true;
    btns.forEach(b=>{ b.style.flexGrow=''; b.style.removeProperty('--f'); b.classList.remove('hot'); });
  };
  bar.addEventListener('pointerdown',e=>{
    if(e.button>0) return;
    on=true; live=false; pid=e.pointerId; x0=lx=e.clientX;
    hold=setTimeout(begin, 170);
  });
  bar.addEventListener('pointermove',e=>{
    if(!on||e.pointerId!==pid) return;
    lx=e.clientX;
    if(!live){ if(Math.abs(lx-x0)>6) begin(); return; }
    show();
  });
  /* короткий тап — обычный click по неделе ниже; после ведения пальцем неделю открываем сами,
     а «хвостовой» click гасим — иначе он нажмёт то, что окажется под пальцем после перерисовки */
  bar.addEventListener('pointerup',e=>{
    if(!on||e.pointerId!==pid) return;
    const was=live, i=cur; stop();
    if(!was || i<0) return;
    const kill=ev=>{ ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click',kill,true); setTimeout(()=>document.removeEventListener('click',kill,true),400);
    const x=yw[i]; pickYearWeek(x.c,x.w);
  });
  bar.addEventListener('touchmove',e=>{ if(live && e.cancelable) e.preventDefault(); },{passive:false});   /* ведёшь пальцем — страница не едет */
  bar.addEventListener('pointercancel',stop);   /* страницу повели вверх-вниз — это прокрутка, не выбор */
  btns.forEach((b,i)=>b.addEventListener('click',()=>{ const x=yw[i]; pickYearWeek(x.c,x.w); }));
}

/* Отпустил палец на неделе — она открывается. Текущая по дате — снова «по дате»; «Отменить» возвращает как было */
function pickYearWeek(c, w){
  const prev={c:state.cycle, w:state.week, auto:settings.auto}, p=posForDate(isoDay());
  if(prev.c===c && prev.w===w) return;
  const byDate=!p.pre && p.cycle===c && Math.min(p.week, c===3?24:p.week)===w;
  if(byDate){ settings.auto=true; saveSettings(); applyAuto(); }
  else { settings.auto=false; saveSettings(); state.cycle=c; state.week=w; savePos(); }
  foodDay=todayIdx(); loadFoodDay(); renderAll(); vibe();
  toast(byDate ? 'Открыта текущая неделя — снова по дате' : `Открыта ${weekTitle(c,w).toLowerCase()}, цикл ${c}${prev.auto?' · выбор по дате выключен':''}`, ()=>{
    settings.auto=prev.auto; saveSettings();
    if(prev.auto) applyAuto(); else { state.cycle=prev.c; state.week=prev.w; savePos(); }
    foodDay=todayIdx(); loadFoodDay(); renderAll();
  });
}

/* ---------- Экран ---------- */
function renderWeekTab(){
  const box=$('#scr-plan'); if(!box) return;
  const c=state.cycle, w=state.week, info=weekInfo(), week=buildWeek();
  const p=posForDate(isoDay()), yw=yearWeeks();
  const idxOf=(cc,ww)=>yw.findIndex(x=>x.c===cc && x.w===Math.min(ww, cc===3?24:ww));
  const nowI=p.pre?-1:idxOf(p.cycle,p.week), selI=idxOf(c,w);
  const td=new Date().getDay(), nowWeek=isNowWeek();

  /* до разгрузки */
  let toDl='';
  if(info.kind==='deload') toDl='Разгрузка сейчас';
  else { for(let x=w+1; x<=Math.min(maxWeek(c), w+8); x++){ const k=weekKind(c,x); if(k==='deload'||k==='test'){ const n=x-w; toDl=`До ${k==='test'?'тестовой':'разгрузки'} ${n} ${plural(n,'неделя','недели','недель')}`; break; } } }

  /* дни недели */
  const tiles=[1,2,3,4,5,6,0].map(d=>{
    const es=week.filter(e=>e.dow===d);
    const gy=es.filter(e=>e.type==='gym'), rn=es.find(e=>e.type==='run');
    const main=gy[0]||rn||es[0];
    const lab = gy.length ? gy.map(e=>TYPE_SHORT[e.id]||'Сил.').join('+') : rn ? 'Вело' : 'Отдых';
    let mk='', cls='';
    const all=[...gy, ...(rn?[rn]:[])];
    if(all.length){
      const dropped=all.every(e=>isDropped(e.id)), done=all.every(e=>isDropped(e.id) || (e.type==='gym'?isGymDone(e):isRunDone(e)));
      if(dropped){ mk='✕'; }
      else if(done){ mk=IC.check; cls=' ok'; }
      else if(all.some(e=>e.moveNote||isMoved(e.id))) mk='↷';
    }
    return `<button type="button" class="wd ${typeClass(main)}${nowWeek&&d===td?' today':''}" data-dow="${d}" aria-label="${DOW_FULL[d]}: ${lab}">
      <span class="dn">${DOW_IDX[(d+6)%7]}</span><span class="dt">${lab}</span><span class="st${cls}">${mk}</span></button>`;
  }).join('');

  /* каждый день */
  /* полный кружок — все четыре упражнения, дуга — часть */
  const dots=DOW_IDX.map((n,i)=>{ const k=dailyCount(i), all=k===DAILY.length;
    return `<button type="button" class="${all?'on':k?'part':''}${nowWeek&&i===todayIdx()?' today':''}" ${k&&!all?`style="--p:${k/DAILY.length}"`:''} data-di="${i}" aria-label="${DOW_FULL[(i+1)%7]}: ${all?'сделано':k?`${k} из ${DAILY.length}`:'не отмечено'}">${n}</button>`; }).join('');

  /* еда за неделю */
  const F=weekFoodStats();
  const scale=F.T.k*0.6;
  const bars=F.rows.map(r=>{
    if(!r.on) return `<div class="bars7"><span>${DOW_IDX[r.d]}</span><span class="trk"></span><span class="muted">—</span></div>`;
    const wdt=Math.min(50, Math.abs(r.diff)/scale*100);
    const col=r.cls==='ok'?'var(--ok)':r.cls==='over'?'var(--wn)':'var(--spd)';
    const st=r.diff>=0?`left:50%;width:${wdt}%;background:${col}`:`right:50%;width:${wdt}%;background:${col}`;
    return `<div class="bars7"><span>${DOW_IDX[r.d]}</span><span class="trk"><i style="${st}"></i></span><span class="n" style="text-align:right">${r.diff>0?'+':''}${r.diff}</span></div>`;
  }).join('');
  const filledN=F.rows.filter(r=>r.on).length;
  const foodCard = F.enough
    ? `${bars}<div class="note ${F.verdict.lvl==='ok'?'g':'y'}" style="margin-top:12px"><b>${F.verdict.b}</b>${F.verdict.x}</div>${F.notes.map(n=>`<p class="small t2" style="margin:0 0 6px">${n}</p>`).join('')}
       ${F.advice?`<button type="button" class="btn" data-adv>Как не улетать в перебор</button>`:''}`
    : `<div class="t2">Заполнено ${filledN} из 7. Сводка появится со второго дня.</div>`;
  const foodFoot='<div class="small muted" style="margin-top:8px">Пустые дни в недельную статистику не попадают.</div>';

  const SL=sleepInfo();
  const H=habitRows();

  box.innerHTML=`
    <div class="hd"><div class="tt"><div class="kick">Цикл ${c} · ${cycleGoal(c,w)}</div><div class="h1">${weekTitle(c,w)}</div></div>
      <button type="button" class="icbtn" data-set aria-label="Неделя и даты">${IC.gear}</button></div>
    ${statusNotes().map(n=>`<div class="note ${n.lvl}">${n.html}</div>`).join('')}
    <div class="card">
      <div class="ywrap"><div class="ytip" aria-hidden="true" hidden></div><div class="year" role="list">${yw.map((x,i)=>`<button type="button" class="${i<nowI?'past':''}${i===nowI?' now':''}" data-yi="${i}" aria-label="Цикл ${x.c}, ${weekTitle(x.c,x.w)}, ${KIND_RU[x.k]||''}" style="--c:${x.col}"><i style="height:${x.h}%;${i===selI?'box-shadow:0 0 0 2px var(--acc)':''}"></i></button>`).join('')}</div></div>
      <div class="yleg"><span><i style="background:${CYC_COL.cut}"></i>сушка</span><span><i style="background:${CYC_COL.ses}"></i>сессия</span><span><i style="background:${CYC_COL.str}"></i>сила</span><span><i style="background:${CYC_COL.hyp}"></i>масса</span><span><i style="background:${CYC_COL.test}"></i>тест</span></div>
      <div class="small t2" style="margin-top:8px">${nowI>=0?`▲ сейчас ${weekTitle(p.cycle,p.week).toLowerCase()}, цикл ${p.cycle}.`:'План ещё не начался.'} Низкие столбики — разгрузки. Зажми полосу и веди пальцем — увидишь каждую неделю, отпусти — она откроется.</div>
    </div>
    <div class="sec">Неделя · ${KIND_RU[info.kind]||''}<span class="aux">${toDl}</span></div>
    <div class="wk">${tiles}</div>
    ${/^(Рабочая|Разгрузочная|Тестовая) неделя$/.test(info.label)?'':`<div class="small t2" style="margin-top:8px">${esc(info.label)}</div>`}
    <div class="sec">Зарядка для колен · каждый день · ≈${dailyMinutes()} мин<button type="button" class="aux link" data-daily>Что это</button></div>
    <div class="dots7">${dots}</div>
    <div class="sec">Еда за неделю · цель ${kfmt(F.T.k)} ккал</div>
    <div class="card">${foodCard}${foodFoot}</div>
    <div class="sec">Сон</div>
    <div class="card tap" data-sleep><div class="small muted" style="margin-bottom:4px">${info.kind==='deload'?'Разгрузочная неделя — восстановление важнее объёма.':'Делается каждый день, включая дни отдыха.'}</div><div class="h2 n">${SL.target}</div><div class="t2" style="margin-top:6px">${SL.why}</div><div class="link">Отбой 01:00 · почему так</div></div>
    <div class="sec">Привычки недели</div>
    <div class="card">${H.map(h=>`<div class="hab"><span><b>${h.t}</b><small>${h.s}</small></span><span class="v">${h.v}</span></div>`).join('')}</div>
    <div class="sec">Отчёт за неделю</div>
    <div class="card"><div class="t2">Питание, тренировки, рабочие веса и замеры одним текстом. Скопируй и пришли — по нему видно, что подправить.${filledN<3?` Питание пока заполнено за ${filledN} ${plural(filledN,'день','дня','дней')} — эта часть будет неполной.`:''}</div>
      <div class="btnrow"><button type="button" class="btn pri" data-rcopy>Скопировать</button><button type="button" class="btn" data-rshare>Поделиться</button></div>
      <button type="button" class="btn" style="margin-top:10px" data-rshow>Показать текст</button></div>
  `;

  box.querySelector('[data-set]').addEventListener('click',()=>openSettings('week'));
  bindYearScrub(box, yw, nowI, selI);
  box.querySelectorAll('[data-dow]').forEach(b=>b.addEventListener('click',()=>daySheet(+b.dataset.dow)));
  /* день — открывает зарядку для колен именно этого дня, там отмечаются упражнения */
  box.querySelectorAll('[data-di]').forEach(b=>b.addEventListener('click',()=>dailySheet(+b.dataset.di)));
  box.querySelector('[data-daily]').addEventListener('click',()=>dailySheet(todayIdx()));
  const adv=box.querySelector('[data-adv]');
  if(adv) adv.addEventListener('click',()=>openSheet(`<h2>Как не улетать в перебор</h2><div class="doc">${OVER_ADVICE.map(([b,t])=>`<p><b>${b}</b> ${t}</p>`).join('')}</div><button type="button" class="btn big" data-close>Понятно</button>`));
  box.querySelector('[data-sleep]').addEventListener('click',()=>openLibrarySection('Сон: норма недели'));
  box.querySelector('[data-rcopy]').addEventListener('click',async()=>{ const ok=await copyText(buildReport()); toast(ok?'Отчёт скопирован':'Не вышло скопировать — нажми «Показать текст»'); });
  box.querySelector('[data-rshare]').addEventListener('click',()=>{ const t=buildReport(); if(navigator.share) navigator.share({text:t}).catch(()=>{}); else shareFile(`отчёт-неделя-${c}-${w}.txt`, t, 'text/plain', 'Отчёт за неделю'); });
  box.querySelector('[data-rshow]').addEventListener('click',()=>openSheet(`<h2>Отчёт за неделю</h2><div class="expre" style="max-height:60vh">${esc(buildReport())}</div>
    <div class="btnrow"><button type="button" class="btn pri" data-c>Скопировать</button><button type="button" class="btn" data-close>Закрыть</button></div>`,
    (el)=>el.querySelector('[data-c]').addEventListener('click',async()=>{ const ok=await copyText(buildReport()); toast(ok?'Отчёт скопирован':'Выдели текст и скопируй вручную'); })));
}
