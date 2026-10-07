"use strict";
/* ############################################################
   10 · УНИВЕРСАЛЬНЫЙ АККОРДЕОН
   Работает на любой глубине вложенности
   ############################################################ */
function bindFold(head, box){
  const toggle=()=>{
    const open=box.classList.toggle('is-open');
    head.setAttribute('aria-expanded', open?'true':'false');
  };
  head.addEventListener('click',e=>{
    if(e.target.closest('.check,.step-check,.dish-toggle,.gram,input,.step-toggle,.dish-time')) return;
    toggle();
  });
  head.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); }
  });
}

/* ############################################################
   11 · ОТРИСОВКА ТРЕНИРОВОК
   ############################################################ */
/* Аэробная работа по дням недели.
   Инструмент подобран под реальную проблему: мышцы сдаются раньше дыхания.
   Велосипед даёт пульс в зоне без ударной нагрузки на голень,
   одна беговая сессия остаётся, чтобы голень постепенно адаптировалась. */
function cardioFor(){
  const dl = weekInfo().kind==='deload';
  if(isSession()){
    return {
      tue:{dur:'20–30 мин', note:'Спокойно, пульс 125–140. В сессию это разгрузка для головы, а не тренировка', mode:'bike'},
      sun:{dur:'20–30 мин', note:'Спокойно, пульс 125–140', mode:'bike'}
    };
  }
  if(state.cycle===1){
    const d = state.week<=4 ? '20–25 мин' : (state.week<=8 ? '25–30 мин' : '30–35 мин');
    return {
      tue:{dur: dl?'15–20 мин':d, note:'80–85 оборотов, пульс 135–140', mode:'bike'},
      sun:{dur: dl?'20 мин':d,    note:'80–85 оборотов, пульс 135–140', mode:'bike'}
    };
  }
  if(state.cycle===2){
    return { tue:{dur: dl?'20 мин':'25–30 мин', note:'80–85 оборотов, пульс 135–140', mode:'bike'},
             sun:{dur: dl?'20 мин':'25–30 мин', note:'Велосипед или дорожка — по состоянию голени', mode:'bike'} };
  }
  const hyper = cycle3(Math.min(state.week,24)).kind==='hyper';
  return { tue:{dur: dl?'20 мин':'30 мин', note:'80–85 оборотов, пульс 135–140', mode:'bike'},
           sun:{dur: dl?'20 мин':(hyper?'30 мин':'30–35 мин'), note:'Велосипед или дорожка — по состоянию голени', mode:'bike'} };
}

/* ############################################################
   РАСПИСАНИЕ С ПЕРЕНОСАМИ
   Пропущенная тренировка не исчезает — она переезжает на
   ближайший день, где интервалы остаются рабочими.
   Если и на новом месте не сделал — тогда отменяется совсем.
   ############################################################ */

/* Пропуск = перенос. Второй пропуск = отмена на этой неделе. */
const skipKey  = id => `${state.cycle}-${state.week}-skip-${id}`;
const dropKey  = id => `${state.cycle}-${state.week}-drop-${id}`;
const peKey    = ()  => `${state.cycle}-${state.week}-nope`;
const isMoved   = id => !!skips[skipKey(id)];
const isDropped = id => !!skips[dropKey(id)];
const isSkipped = id => isDropped(id) || (isMoved(id) && id==='d2');  /* скоростная не переносится */
const noPE = () => !!skips[peKey()];

function toggleSkip(id){
  const k=skipKey(id), d=dropKey(id);
  if(skips[d]){ delete skips[d]; delete skips[k]; }      /* вернуть день целиком */
  else if(skips[k]) skips[d]=true;                       /* второй пропуск — отмена */
  else skips[k]=true;                                    /* первый пропуск — перенос */
  saveSkips(); renderAll();
}
function togglePE(){
  const k=peKey();
  if(skips[k]) delete skips[k]; else skips[k]=true;
  saveSkips(); renderAll();
}

/* Сдвиг старта недели. Если на прошлой неделе Силовая Б уехала
   на воскресенье, эта начинается со вторника: иначе между ними
   остаётся 24 часа вместо 48. Разгрузка выравнивает всё. */
function weekShift(){
  const c=state.cycle, w=state.week;
  if(w<=1) return 0;
  const k=weekKind(c,w);
  if(k==='deload' || k==='test' || k==='session') return 0;
  const prevMoved = !!skips[`${c}-${w-1}-skip-d3`];
  const prevDrop  = !!skips[`${c}-${w-1}-drop-d3`];
  return (prevMoved && !prevDrop) ? 1 : 0;
}

/* Куда встают три тренировки на этой неделе */
function layout(){
  const sh=weekShift();
  const L={
    d1:{dow:1, note:''},
    d2:{dow:4, note:''},
    d3:{dow:6, note:''}
  };

  /* Входящий сдвиг двигает только Силовую А: скоростная привязана
     к физре в четверг, а суббота и так далеко от воскресенья */
  if(sh){
    L.d1.dow=2;
    L.d1.note='Сдвинута на вторник: на прошлой неделе Силовая Б была в воскресенье, между ними нужно 48 часов.';
  }

  /* Пропущенная Силовая А переезжает на следующий день.
     Со вторника — на среду, чтобы до четверга остался день. */
  if(isMoved('d1') && !isDropped('d1')){
    L.d1.dow = sh ? 3 : 2;
    L.d1.note = sh
      ? 'Перенесена на среду. До скоростной остаётся день — этого хватает, но жать по весам не надо.'
      : 'Перенесена на вторник. До скоростной 48 часов, интервалы не сломаны.';
  }

  /* Силовая Б переезжает на воскресенье, следующая неделя сдвигается */
  if(isMoved('d3') && !isDropped('d3')){
    L.d3.dow=0;
    L.d3.note='Перенесена на воскресенье. Следующая неделя начнётся со вторника — между силовыми нужно 48 часов.';
  }

  return L;
}

/* Неделя целиком в календарном порядке: силовые, кардио и отдых */
function buildWeek(){
  const S=buildDays(state.cycle,state.week), C=cardioFor();
  if(noPE() && !isSession()) S[1]=homeSpeedDay();          /* четверг: физры не было */
  adjustDays(S);                                            /* замены, колено, перерыв, усталость */
  const L=layout();
  const MODE={bike:'Велосипед', run:'Бег', walk:'Ходьба'};

  /* Дни, занятые силовыми — туда кардио не ставим */
  const taken=new Set([L.d1.dow, L.d3.dow]);
  if(!isDropped('d2')) taken.add(L.d2.dow);

  const out=[];
  out.push({dow:L.d1.dow, id:'d1', type:'gym', day:S[0], moveNote:L.d1.note});
  if(!isDropped('d2')) out.push({dow:L.d2.dow, id:'d2', type:'gym', day:S[1], moveNote:L.d2.note});
  out.push({dow:L.d3.dow, id:'d3', type:'gym', day:S[2], moveNote:L.d3.note});

  /* Кардио: вторник и воскресенье, но уступают силовым */
  const dropped=[];
  const bike=(want, alts, id, ex, c)=>{
    if(!c) return;
    let dow = taken.has(want) ? alts.find(a=>!taken.has(a)) : want;
    if(dow===undefined){ dropped.push(id); return; }   /* некуда — сессия выпадает */
    taken.add(dow);
    out.push({dow, id, type:'run', ex, title:MODE[c.mode]||'Аэробная работа', ...c,
              moveNote: dow!==want ? 'Сдвинуто: основной день занят силовой.' : ''});
  };
  /* Пятница в альтернативы не входит: физра плюс пары до 19:05 плюс дорога */
  bike(2, [3], 'c-tue','ctue', C.tue);
  bike(0, [3], 'c-sun','csun', C.sun);

  /* Остальные дни — отдых */
  const RESTS={
    3:{title:'Отдых', why:'Полный день без нагрузки между силовой и скоростной. Нервной системе нужен именно он, а не лёгкая тренировка.'},
    5:{title:'Только учёба', why:'Физра, пары до 19:05 и 80 минут дороги. Сюда не влезает ни тренировка, ни ДЗ.'},
    2:{title:'Отдых', why:''},
    0:{title:'Отдых', why:''},
    6:{title:'Отдых', why:''},
    1:{title:'Отдых', why:''},
    4:{title:'Отдых', why:''}
  };
  const used=new Set(out.map(e=>e.dow));
  for(let d=0; d<7; d++){
    if(used.has(d)) continue;
    const r=RESTS[d]||{title:'Отдых', why:''};
    let why=r.why;
    if(d===5 && dropped.length) why += ' Кардио на этой неделе выпало: тренировки заняли свободные дни. Догонять не надо.';
    out.push({dow:d, id:'d-rest-'+d, type:'rest', title:r.title, why});
  }

  /* Календарный порядок: понедельник первый, воскресенье последнее */
  out.sort((a,b)=> ((a.dow===0?7:a.dow) - (b.dow===0?7:b.dow)) );
  return out;
}

/* ############################################################
   СДВИГ ПРОГРЕССИИ ПОСЛЕ ПРОПУСКОВ
   Пропущенные силовые не должны просто исчезать: если неделя
   не состоялась, веса следующей недели брать неоткуда.
   Две пропущенные силовые = минус одна неделя прогрессии.
   Сдвиг живёт внутри блока и обнуляется на разгрузке —
   она и есть точка, где всё выравнивается.
   ############################################################ */

/* Первая неделя текущего блока. Блоки заканчиваются разгрузкой. */
function blockStart(c, w){
  if(c===1 && w>12) return w;                   /* сессионный блок — без сдвигов */
  if(c===3) return Math.floor((w-1)/6)*6 + 1;   /* блоки по 6 недель */
  if(w<=3) return 1;                            /* 1–3, разгрузка 4  */
  if(w<=7) return 5;                            /* 5–7, разгрузка 8  */
  return 9;                                     /* 9–11, тест 12     */
}

/* Сколько недель прогрессии потеряно к текущему моменту */
function progressShift(){ return memo('shift', progressShiftRaw); }
function progressShiftRaw(){
  const c=state.cycle, w=state.week, start=blockStart(c,w);
  /* Пропуск без отметки тоже пропуск: если человек ведёт журнал, а за
     прошедший день нет ни галочки, ни подходов, ни часов — тренировки не было.
     Считаем только дни после первой записи и только уже прошедшие. */
  const today=isoDay(), first=activityDates()[0];
  let missed=0;
  for(let x=start; x<w; x++){
    ['d1','d3'].forEach(id=>{
      /* перенесённая тренировка сделана, просто в другой день — она не считается */
      if(skips[`${c}-${x}-drop-${id}`]){ missed++; return; }
      const date=dateOfCW(c,x,DAY_DOW[id]+(skips[`${c}-${x}-skip-${id}`]?1:0));
      if(first && date>=first && date<today && !dayActive(c,x,id)) missed++;
    });
  }
  return Math.floor(missed/2);
}

/* Неделя, от которой берутся веса. Календарная позиция
   (разгрузки, тестовая) при этом не двигается. */
function loadWeek(){
  const k=weekKind(state.cycle, state.week);
  if(k==='deload' || k==='test' || k==='session') return state.week;
  return Math.max(blockStart(state.cycle,state.week), state.week - progressShift());
}

/* Что делать с пропущенным днём — совет зависит от того, что именно пропало */
const MOVE_NOTE={
  d1:'Силовая А переехала — смотри новый день в расписании выше. Веса те же, менять ничего не надо.',
  d2:'Скоростная не переносится: после физры её делать негде, а на уставших ногах она тренирует медленный бег. Пропуск раз в месяц ничего не стоит.',
  d3:'Силовая Б переехала на воскресенье. Следующая неделя начнётся со вторника — приложение само это учтёт.',
  run:'Кардио догонять не надо. Одна сессия на базу почти не влияет.'
};
const DROP_ADVICE={
  d1:'Силовая А отменена на этой неделе. Если отменишь и Силовую Б, прогрессия сдвинется на неделю назад — веса следующей недели повторят эти.',
  d2:'Скоростная отменена. На прогрессию весов не влияет, но прыжковой работы на этой неделе не было — учти в отчёте.',
  d3:'Силовая Б отменена. Если на этой неделе отменены обе силовые, прогрессия сдвинется: веса следующей недели повторят текущие.',
  run:'Кардио отменено. Догонять не надо.'
};

/* Сколько сессий пропущено на этой неделе — нужно для пересчёта питания */
function missedSessions(){
  const w=buildWeek();
  let gym=0, run=0;
  w.forEach(e=>{
    if(e.type==='gym' && isDropped(e.id)) gym++;
    if(e.type==='run' && isDropped(e.id)) run++;
  });
  if(isDropped('d2')) gym++;            /* скоростная вылетает из расписания целиком */
  return {gym, run, total:gym+run};
}

const DOW_FULL=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

/* ############################################################
   ЕЖЕДНЕВНЫЙ БЛОК
   Ядро, которое делается каждый день без исключений.
   В тренировочные дни оно входит в разминку и отдельно не нужно —
   такие дни помечены и не требуют галочки.
   ############################################################ */
const DAILY=[WP.wallsit, WP.groin, WP.shortfoot, WP.balance];

/* В какие дни недели есть тренировка (там блок закрыт разминкой) */
function gymDays(){
  const set=new Set();
  buildWeek().forEach(e=>{ if(e.type==='gym' && !isDropped(e.id)) set.add(e.dow===0?6:e.dow-1); });
  return set;
}

function renderDaily(){
  const box=document.getElementById('dailyBox');
  const gym=gymDays();
  const td=todayIdx();

  const gymList  = DOW_IDX.filter((n,i)=>gym.has(i)).join(', ');
  const freeList = DOW_IDX.filter((n,i)=>!gym.has(i)).join(', ');

  const cells=DOW_IDX.map((n,i)=>{
    if(gym.has(i)) return `<div class="dcell gym${i===td?' today':''}" title="в разминке">
      <span class="dn">${n}</span><span class="dm"><span class="gm">тр</span></span></div>`;
    const k=`${state.cycle}-${state.week}-daily-${i}`;
    return `<button class="dcell${marks[k]?' done':''}${i===td?' today':''}" type="button" data-k="${k}">
      <span class="dn">${n}</span><span class="dm"></span></button>`;
  }).join('');

  const list=DAILY.map((x,i)=>{
    const t=TECH[x.tech]||{text:''};
    return `<div class="sub">
      <div class="sub-head" tabindex="0" role="button" aria-expanded="false">
        <span>${i+1}. ${x.name} · ${x.dose}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="fold"><div class="fold-inner"><div class="sub-body">
        ${t.fig?`<div class="fig">${S[t.fig]}</div>`:''}
        <div class="tech">${t.text}</div>
      </div></div></div>
    </div>`;
  }).join('');

  const d=document.createElement('div');
  d.className='daily';
  d.innerHTML=`
    <div class="daily-head" tabindex="0" role="button" aria-expanded="false">
      <div class="daily-t">
        <div class="t">Каждый день</div>
        <div class="s">Колени, пах и стопа. Не режется никогда</div>
      </div>
      <span class="daily-dur">6–8 мин</span>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="fold"><div class="fold-inner"><div class="daily-body">
      <div class="dweek">${cells}</div>
      <p style="font-size:12.5px;color:var(--muted);margin:0 0 14px">
        ${gymList ? `<b style="color:var(--warmc)">${gymList}</b> — тренировочные дни, блок уже входит в разминку. Галочка там не нужна и не нажимается.`
                  : 'Тренировок на этой неделе не отмечено, поэтому блок нужен во все семь дней.'}
        ${freeList ? `<br>Отмечать нужно: <b>${freeList}</b>.` : ''}
      </p>
      ${list}
      <div class="tip" style="margin-top:14px">
        Эти четыре пункта работают медленно и только от частоты. Полуприсед у стены даёт первые изменения
        в колене через 4–6 недель ежедневной работы, изометрия паха примерно так же.
        Делать их три раза в неделю вместо семи — значит растянуть результат вдвое.
      </div>
    </div></div></div>`;

  box.innerHTML='';
  box.appendChild(d);
  bindFold(d.querySelector('.daily-head'), d);
  d.querySelectorAll('.daily-body .sub').forEach(x=>bindFold(x.querySelector('.sub-head'), x));

  d.querySelectorAll('.dcell[data-k]').forEach(b=>{
    b.addEventListener('click',()=>{
      const k=b.dataset.k;
      if(marks[k]) delete marks[k]; else marks[k]=true;
      b.classList.toggle('done', !!marks[k]);
      saveMarks(); updateProgress();
    });
  });
}

function renderDays(){
  const week=buildWeek();
  const warm=warmupFor(state.week);
  const today=new Date().getDay();
  const root=document.getElementById('days');
  root.innerHTML='';

  /* полоса недели сверху */
  document.getElementById('weekstrip').innerHTML = week.map(e=>{
    const cls = e.type==='rest' ? 'rest' : (e.type==='run' ? 'cardio' : '');
    const label = e.type==='gym' ? e.day.title.split(' · ')[0] : e.title;
    const sel = e.dow===selDow ? ' sel' : '';
    return `<button type="button" class="wchip ${cls}${e.dow===today?' today':''}${sel}" data-dow="${e.dow}">
      <span class="wd">${e.dow===today?'Сегодня':DOW_FULL[e.dow]}</span><span class="wt">${label}</span></button>`;
  }).join('');
  const strip=document.getElementById('weekstrip');
  strip.querySelectorAll('.wchip').forEach(b=>b.addEventListener('click',()=>{
    selDow=+b.dataset.dow; renderDays(); updateProgress();
  }));
  const selChip=strip.querySelector('.wchip.sel');
  if(selChip) strip.scrollLeft = Math.max(0, selChip.offsetLeft - strip.clientWidth/2 + selChip.clientWidth/2);

  /* кнопка «Сегодня» в нижней панели ведёт на сегодняшний день */
  const te=week.find(e=>e.dow===today);
  /* полоса недели скроллит внутри вкладки «Сегодня» */

  week.filter(e=>e.dow===selDow).forEach(e=>{
    const isToday = (e.dow===today);
    const tag = isToday ? '<span class="today-tag">сегодня</span>' : '';

    /* --- день отдыха --- */
    if(e.type==='rest'){
      const r=document.createElement('div');
      r.className='rday'; r.id=e.id;
      r.innerHTML=`<b>${DOW_FULL[e.dow]} · ${e.title}</b>${tag}${e.why?`<br>${e.why}`:''}`;
      root.appendChild(r);
      const order=d=>(d===0?7:d);
      const next=week.filter(x=>x.type!=='rest' && !(x.type==='gym'&&isDropped(x.id)) && order(x.dow)>order(e.dow))[0];
      if(next){
        const nb=document.createElement('button');
        nb.type='button'; nb.className='btn nextbtn';
        nb.textContent=`Следующая: ${DOW_FULL[next.dow]} · ${next.type==='gym'?next.day.title:next.title} →`;
        nb.addEventListener('click',()=>{ selDow=next.dow; renderDays(); updateProgress(); });
        root.appendChild(nb);
      }
      return;
    }

    /* --- день кардио --- */
    if(e.type==='run'){
      const k=key(e.id,e.ex), done=!!marks[k], sk=isSkipped(e.id);
      const techId = e.mode==='run' ? 'run_setup' : 'bike_setup';
      const t=TECH[techId]||{text:''};
      const c=document.createElement('div');
      c.className='cday'+(done?' done':'')+(sk?' is-skipped':''); c.id=e.id;
      c.innerHTML=`
        <div class="cday-head">
          <button class="check" role="checkbox" aria-checked="${done}" aria-label="${e.title}"></button>
          <div class="cday-main">
            <div class="cday-name">${DOW_FULL[e.dow]} · ${sk?'Пропущено':e.title}${tag}</div>
            <div class="cday-note">${sk?'Догонять не надо':e.note}</div>
          </div>
          <div class="cday-dur">${sk?'—':e.dur}</div>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="fold"><div class="fold-inner"><div class="cday-body">
          ${t.fig?`<div class="fig">${S[t.fig]}</div>`:''}
          <div class="tech">${t.text}</div>
        </div></div></div>`;
      bindFold(c.querySelector('.cday-head'), c);
      c.querySelector('.cday-body').appendChild(watchBlock(e.id));
      c.querySelector('.check').addEventListener('click',ev=>{
        ev.stopPropagation();
        const now=!marks[k];
        if(now) marks[k]=true; else delete marks[k];
        ev.currentTarget.setAttribute('aria-checked',now?'true':'false');
        c.classList.toggle('done',now);
        saveMarks(); updateProgress();
      });
      root.appendChild(c);

      const tools=document.createElement('div');
      tools.className='day-tools'; tools.style.margin='-2px 0 14px';
      tools.innerHTML=`<button class="skipbtn${sk?' on':''}" type="button">${sk?'Вернуть':'Пропустил'}</button>`;
      tools.querySelector('button').addEventListener('click',()=>toggleSkip(e.id));
      root.appendChild(tools);
      /* мяч: 10–15 минут дриблинга после велосипеда */
      if(!sk) root.appendChild(exCard({id:e.id}, BALL));

      if(sk){
        const n=document.createElement('div');
        n.className='skipnote';
        n.innerHTML=`<b>Пропущено.</b> ${DROP_ADVICE.run}`;
        root.appendChild(n);
      } else if(e.moveNote){
        const n=document.createElement('div');
        n.className='swapnote';
        n.innerHTML=`<b>День сдвинут.</b> ${e.moveNote}`;
        root.appendChild(n);
      }
      return;
    }

    /* --- силовой день --- */
    const day=e.day;
    const dropped=isDropped(e.id), moved=isMoved(e.id) && !dropped;
    const sec=document.createElement('section');
    sec.className='day'+(dropped?' is-skipped':''); sec.id=day.id;
    /* у перенесённого дня в заголовке стоит новый день недели */
    const whenText = moved || e.moveNote
      ? `${DOW_FULL[e.dow]} · ${day.when.split(' · ').slice(1).join(' · ')}`
      : day.when;
    sec.innerHTML=`<div class="day-head"><h2>${day.title}${tag}</h2><span class="when">${whenText}</span></div>
                   <p class="day-note">${day.note}</p>`;

    /* кнопки: первый пропуск переносит, второй отменяет */
    const tools=document.createElement('div');
    tools.className='day-tools';
    const peBtn = (e.id==='d2' && !isSession())
      ? `<button class="skipbtn pe${noPE()?' on':''}" type="button">${noPE()?'Физра была':'Физры не было'}</button>`
      : '';
    const skLabel = dropped ? 'Вернуть день' : (moved ? 'Снова не сделал' : 'Пропустил');
    tools.innerHTML=`<button class="skipbtn sk${dropped?' on':''}${moved?' moved':''}" type="button">${skLabel}</button>${peBtn}`;
    tools.querySelector('.sk').addEventListener('click',()=>toggleSkip(e.id));
    if(e.id==='d2' && !isSession()) tools.querySelector('.pe').addEventListener('click', togglePE);
    sec.appendChild(tools);

    /* отменённый день: вместо упражнений — что это значит */
    if(dropped){
      const n=document.createElement('div');
      n.className='skipnote';
      n.innerHTML=`<b>Отменено на этой неделе.</b> ${DROP_ADVICE[e.id]||DROP_ADVICE.d1}`;
      sec.appendChild(n);
      root.appendChild(sec);
      return;
    }

    /* перенесённый или сдвинутый день: объясняем, почему он здесь */
    if(e.moveNote){
      const n=document.createElement('div');
      n.className='swapnote';
      n.innerHTML=`<b>День перенесён.</b> ${e.moveNote}`;
      sec.appendChild(n);
    }

    /* перерыв или усталость: день легче, объясняем почему */
    if(day.alert){
      const n=document.createElement('div');
      n.className='coach knee-note '+day.alert.lvl;
      n.innerHTML=day.alert.html;
      sec.appendChild(n);
    }

    /* поясница: светофор в днях, где есть наклоны и штанга */
    if(day.ex.some(x=>BACK_LOAD.includes(x.tech))){
      const bs=backStatus();
      const n=document.createElement('div');
      n.className='coach knee-note '+(bs?bs.lvl:'');
      n.innerHTML = bs ? `<b>${bs.title}</b>${bs.text}`
        : `<b>Поясница</b>Утром оцени, как она, 0–10 во вкладке «Прогресс» — здесь появится светофор для наклонов. Если во время подхода в пояснице больше 2 из 10 — стоп.`;
      sec.appendChild(n);
    }

    /* колено прыгуна: светофор по утренней оценке */
    if(day.ex.some(x=>x.badge[0]==='Скорость')){
      const ks=kneeStatus();
      const n=document.createElement('div');
      n.className='coach knee-note '+(ks?ks.lvl:'');
      n.innerHTML = ks ? `<b>${ks.title}</b>${ks.text}`
        : `<b>Колено</b>Утром после прыжкового дня оцени боль 0–10 во вкладке «Прогресс» — здесь появится светофор. Перед прыжками — изометрия у стены 5 × 45 сек.`;
      sec.appendChild(n);
    }

    /* четверг без физры: объясняем, что поменялось и чего не заменить */
    if(day.swap){
      const n=document.createElement('div');
      n.className='swapnote';
      n.innerHTML=`<b>Замена дома.</b> Прыжковая часть переносится целиком — ей нужно три квадратных метра, а не зал.
        Мотор добираем интервалами в горку на дорожке.
        <br><br>Не заменяется одно: ускорения с места. На дорожке полотно уходит из-под ноги само, а весь смысл в отталкивании от неподвижного пола. Раз-два в месяц это ничего не стоит; если физры нет несколько недель подряд — нужен любой коридор метров на двадцать.`;
      sec.appendChild(n);
    }

    /* --- разминка --- */
    const wb=document.createElement('div');
    wb.className='warmblock';
    wb.innerHTML=`
      <div class="warm-head" tabindex="0" role="button" aria-expanded="false">
        <div class="warm-title">
          <div class="t">Разминка · уровень ${warm.level}</div>
          <div class="s">${warm.label}</div>
        </div>
        <span class="warm-dur">${warm.dur}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="fold"><div class="fold-inner"><div class="warm-list">
      ${warm.list.map((s,i)=>{
        const k=key(day.id,s.id), done=!!marks[k], t=TECH[s.tech]||{text:''};
        const mm=Math.floor(s.sec/60), ss=s.sec%60;
        return `<div class="step${done?' done':''}" data-k="${k}">
          <div class="step-n">${i+1}</div>
          <div class="step-main">
            <div class="step-name">${s.name}</div>
            <div class="step-meta">
              <span class="timer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>${mm}:${String(ss).padStart(2,'0')}</span>
              <span class="step-dose">${s.dose}</span>
            </div>
            <button class="step-toggle" type="button">Как делать</button>
            <div class="step-detail" hidden>
              ${t.fig?`<div class="fig">${S[t.fig]}</div>`:''}
              <div class="tech">${t.text}</div>
            </div>
          </div>
          <button class="step-check" role="checkbox" aria-checked="${done}" aria-label="${s.name}"></button>
        </div>`;
      }).join('')}
      </div></div></div>`;
    bindFold(wb.querySelector('.warm-head'), wb);

    wb.querySelectorAll('.step').forEach(st=>{
      const k=st.dataset.k;
      st.querySelector('.step-check').addEventListener('click',e=>{
        e.stopPropagation();
        const now=!marks[k];
        if(now) marks[k]=true; else delete marks[k];
        e.currentTarget.setAttribute('aria-checked',now?'true':'false');
        st.classList.toggle('done',now);
        saveMarks(); updateProgress();
      });
      const btn=st.querySelector('.step-toggle'), det=st.querySelector('.step-detail');
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        det.hidden=!det.hidden;
        btn.textContent = det.hidden ? 'Как делать' : 'Свернуть';
      });
    });
    sec.appendChild(wb);

    /* --- основные упражнения --- */
    day.ex.forEach(ex=>sec.appendChild(exCard(day, ex)));
    sec.appendChild(watchBlock(day.id));

    root.appendChild(sec);
  });
}

const BALL={id:'ball',name:'Мяч · дриблинг',badge:['Мяч','b-ball'],dose:'10–15 мин после велосипеда',rest:'—',tech:'dribble',
  warm:'Не нужна — ты разогрет велосипедом. Нужен пол, по которому можно стучать: зал у дома или двор.'};

/* Какие упражнения пишутся в журнал: силовые, не скорость и не мяч */
const isLogged = ex => !['Скорость','Выносливость','Мяч','Тест'].includes(ex.badge[0]);

/* Разбор дозировки: сколько подходов, какой диапазон, какой вес по таблице */
function parseDose(dose){
  const o={sets:3, lo:null, hi:null, w:null, timed:/×\s*[\d–]+\s*сек|максимум, сек/.test(dose), max:/отказ|запас/.test(dose)};
  let m=dose.match(/^(\d+)\s*(?:×|подход)/); if(m) o.sets=+m[1];
  if(/^тест/.test(dose)) o.sets=1;
  m=dose.match(/×\s*(\d+)(?:–(\d+))?/); if(m){ o.lo=+m[1]; o.hi=+(m[2]||m[1]); }
  m=dose.match(/·\s*([\d.,]+)\s*кг/); if(m) o.w=parseFloat(m[1].replace(',','.'));
  if(/тест на 5/.test(dose)){ o.lo=o.hi=5; }
  return o;
}
/* Отдых в секундах из «2 мин», «90 сек», «в паре с …» */
function restSec(rest){
  if(!rest || rest==='—') return 0;
  let m=rest.match(/(\d+)\s*мин/); if(m) return +m[1]*60;
  m=rest.match(/(\d+)\s*сек/); if(m) return +m[1];
  return 90;
}
const num = v => { const x=parseFloat(String(v).replace(',','.')); return isFinite(x)?x:null; };
const fmtW = w => (Math.round(w*10)/10).toString().replace('.',',');
const isoDay = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shortDate = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${+d}.${m}`; };
const logKey = (dayId, exId) => `${state.cycle}-${state.week}-${dayId}-${exId}`;
const hasData = L => L && L.sets && L.sets.some(x=>num(x.r)!=null);

/* Положение недели в году: прошлый раз всегда раньше текущего */
const posOf = (c,w) => (c===1?0:(c===2?100:200)) + w;
/* Все записи этого упражнения (по названию), от свежих к старым */
function logsOf(name, exceptKey){
  const cur=posOf(state.cycle,state.week);
  return Object.keys(logs)
    .filter(k=>k!==exceptKey && logs[k] && logs[k].n===name && hasData(logs[k]))
    .map(k=>{ const [c,w]=k.split('-').map(Number); return {k, pos:posOf(c,w), L:logs[k]}; })
    .filter(x=>x.pos<=cur)
    .sort((a,b)=> b.pos-a.pos || ((b.L.d||'')>(a.L.d||'') ? 1 : -1));
}
function lastLog(name, exceptKey){ const a=logsOf(name, exceptKey); return a.length ? a[0].L : null; }

function lastSummary(L, P){
  const sets=L.sets.filter(x=>num(x.r)!=null).map(x=>{
    const w=num(x.w);
    return (w?`${fmtW(w)}×`:'') + x.r + (P.timed?' сек':'');
  });
  return `В прошлый раз${L.d?` (${shortDate(L.d)})`:''}: ${sets.join(' · ')}${L.rpe?` · тяжесть ${L.rpe}`:''}`;
}

/* ############################################################
   ПРОГРЕССИЯ: какой вес и сколько повторов на этой неделе
   Считается от того, что реально сделано в прошлый раз, а не по
   формуле «процент выполнения × прибавка». Логика тренера:
   сделал всё и было не на пределе — прибавка; недобрал немного —
   тот же вес и добрать; недобрал много или второй раз подряд —
   шаг назад. Разгрузка, тест и сессия — свои правила.
   ############################################################ */

/* Стартовые веса, пока нет истории (вес одной гантели / штанги) */
const START_W={
  'Тяга гантели в наклоне':12, 'Жим гантелей стоя':12, 'Румынская тяга на одной ноге':4,
  'Сгибания на бицепс':10, 'Разгибания на трицепс':14, 'Тяга штанги в наклоне':40,
  'Подтягивания с весом':5, 'Брусья с весом':5, 'Болгарский сплит-присед':8
};
/* С какой гантели начинать, когда без веса стало легко */
const OPT_W={calf:10, hipthrust:10, pistol:4, bulgarian:8, rdl:4};
/* Как усложнить упражнение со своим весом, когда упёрся в верх диапазона */
const HARDER={pushup:'ноги на возвышение или рюкзак 5 кг', pullup:'рюкзак или блин 5 кг', deadbug:'медленнее, 3 сек на каждое движение',
  nordic:'опускайся медленнее, 5 сек', plank:'+5 сек', copenhagen:'переходи на длинный рычаг (стопа на скамье)',
  bulgarian:'рюкзак 4–6 кг уже сейчас', pistol:'гантели по 4 кг в руки', hipthrust:'гантель 10 кг на таз'};

const rDb = x => Math.round(x*2)/2;                 /* гантели — до 0,5 кг */
const listR = a => a.map(v=>v==null?'—':v).join('-');

function sessionStats(L, lo, ns){
  const sets=L.sets.filter(x=>num(x.r)!=null);
  const rs=sets.map(x=>num(x.r)), ws=sets.map(x=>num(x.w)||0);
  const need=(L.tr ?? lo) || 0, plan=L.ns || ns;
  const comp = need ? Math.min(1, rs.reduce((a,r)=>a+Math.min(r,need),0)/(need*plan)) : (sets.length>=plan?1:sets.length/plan);
  return {rs, top:ws.length?Math.max(...ws):0, n:sets.length, min:rs.length?Math.min(...rs):0,
          sum:rs.reduce((a,b)=>a+b,0), comp, rpe:L.rpe||null, tr:L.tr, ns:plan};
}

/* План на сегодня: вес (если есть), повторы на каждый подход, объяснение */
/* Подсказка по прошлым записям. Поправки дня (перерыв, усталость) — planFor в rules.js */
function planBase(ex, P, k){
  const WK=weightKind(ex,P);
  /* поясница жёлтая/красная — наклонные упражнения без веса или пропуск */
  const bk=backStatus();
  if(bk && bk.lvl!=='g' && ['rdl','row','trap'].includes(ex.tech)){
    const n=P.sets;
    return {w:0, kind:'back', sets:Array.from({length:n},()=>({w:0, r:bk.lvl==='r'?null:P.lo})),
      t: bk.lvl==='r' ? '<b>сегодня пропусти</b> — поясница красная. Вместо этого ягодичный мостик без веса'
                      : '<b>без веса</b>, рукой за опору — поясница жёлтая. Амплитуда до середины голени'};
  }
  const wk=weekKind(state.cycle,state.week);
  const deload=wk==='deload', session=wk==='session', test=/^тест/.test(ex.dose);
  const hist=logsOf(ex.name,k);
  const base=hist.find(h=>h.L.wk!=='deload' && h.L.wk!=='test') || hist[0] || null;
  const B=base ? sessionStats(base.L, P.lo, P.sets) : null;
  const lo=P.lo, hi=P.hi, n=P.sets;
  const out=(w, r, t, kind)=>({w, kind,
    sets:Array.from({length:n},(_,i)=>({w, r:Array.isArray(r)?(r[i]??r[r.length-1]??null):r})), t});
  const isBar=WK.ph==='штанга';
  const optional=/пусто, если без веса/.test(WK.hint);
  const loaded=WK.ph==='гантель'||WK.ph==='рюкзак'||WK.ph==='доп.'||optional||/без веса/.test(ex.dose);

  /* --- на время --- */
  if(P.timed){
    if(!B) return out(null, lo, `<b>${lo}${hi>lo?'–'+hi:''} сек</b> в подходе`);
    if(deload) return out(null, lo, `разгрузка: <b>${lo} сек</b>, без предела`);
    const allTop=B.n>=B.ns && B.min>=hi && (!B.rpe||B.rpe<=8);
    if(allTop) return out(null, hi+5, `прошлый раз дался легко — <b>${hi+5} сек</b>${HARDER[ex.tech]&&hi+5>45?` или ${HARDER[ex.tech]}`:''}`);
    const r=B.rs.map(x=>Math.min(hi, x+5));
    return out(null, r, `цель: <b>${listR(r)} сек</b> (было ${listR(B.rs)})`);
  }

  /* --- штанга --- */
  if(isBar){
    const table=P.w;
    if(!B){
      if(test) return out(null, lo, 'тест: разомнись и прибавляй по 2,5–5 кг до веса, который поднимешь 5 раз на пределе', 'bar');
      const w=table ?? START_W[ex.name] ?? null;
      return out(w, lo, w!=null?`<b>${fmtW(w)} кг</b> ${table!=null?'по таблице':'— стартовый вес'}. Последние повторы тяжёлые, но чистые`:'', 'bar');
    }
    const bw=B.top;
    let w, t;
    if(test){ w=r25(bw+5); t=`тест: разминка до ${fmtW(bw)}, дальше по 2,5–5 кг. Ориентир — <b>${fmtW(w)} кг на 5</b>`; }
    else if(B.tr && lo && B.tr!==lo){
      /* схема повторов сменилась: пересчёт через одноповторный максимум */
      const e1=bw*(1+B.tr/30);
      w=r25(e1/(1+lo/30)*0.92);   /* 4 подхода, а не один — нужен запас */
      t=`новая схема (${lo} повт.): пересчёт с прошлых ${fmtW(bw)}×${B.tr} → <b>${fmtW(w)} кг</b>`;
    }
    else if(deload){ w=r25(bw*0.8); t=`разгрузка: ~80 % от рабочих ${fmtW(bw)} → <b>${fmtW(w)} кг</b>, без предела`; }
    else if(session){ w=bw; t=`сессия: держим <b>${fmtW(w)} кг</b>, запас 2–3 повтора`; }
    else {
      const prev=hist.filter(h=>h!==base && h.L.wk!=='deload' && h.L.wk!=='test')[0];
      const P2=prev?sessionStats(prev.L,lo,n):null;
      const twoFails = B.comp<1 && P2 && P2.comp<1 && Math.abs(P2.top-bw)<0.1;
      const small = /Жим стоя|наклоне/.test(ex.name);
      if(B.comp>=1){
        const rpe=B.rpe||8;
        const inc = rpe<=7 ? (small?2.5:5) : rpe>=9.5 ? 0 : rpe===9 ? (small?0:2.5) : 2.5;
        w=r25(bw+inc);
        if(table!=null && w>table+5) w=r25(table+5);
        t = inc ? `все повторы сделаны${B.rpe?`, тяжесть ${B.rpe}`:''} → <b>${fmtW(w)} кг</b> (+${fmtW(w-bw)})`
                : `все повторы, но на пределе → <b>${fmtW(w)} кг</b> ещё раз, пусть станет легче`;
      } else if(twoFails){ w=r25(bw*0.9); t=`второй раз подряд недобор на ${fmtW(bw)} → шаг назад: <b>${fmtW(w)} кг</b>, потом снова вверх`; }
      else if(B.comp>=0.75){ w=bw; t=`недобрал ${Math.round((1-B.comp)*lo*B.ns)} повт. → тот же вес <b>${fmtW(w)} кг</b>, добери`; }
      else { w=r25(bw*0.9); t=`сделано меньше ¾ объёма → <b>${fmtW(w)} кг</b> (−10 %), техника и скорость важнее`; }
    }
    /* поясница не в порядке — штанга на плечах легче */
    if(bk && bk.lvl!=='g' && ['squat','ohp'].includes(ex.tech)){
      const f = bk.lvl==='y' ? 0.8 : 0.6;
      w=r25(w*f); t+=` · <b>поясница ${bk.lvl==='y'?'жёлтая: −20':'красная: −40'} %</b> → ${fmtW(w)} кг`;
    }
    if(table!=null && Math.abs(w-table)>=2.5 && !test) t+=` <span style="color:var(--muted)">· по таблице ${fmtW(table)}</span>`;
    return out(w, lo, t, 'bar');
  }

  /* --- гантели, рюкзак, добавленный вес, «по желанию с гантелями» --- */
  if(loaded && lo!=null){
    const step = WK.ph==='доп.' ? 2.5 : 2;
    const ruck = (ex.dose.match(/рюкзак (\d+)/)||[])[1];
    const bodyNow = /свой вес/.test(ex.dose);
    const noLoad = /без веса/.test(ex.dose);
    if(!B){
      let w = ruck ? +ruck : ((optional||noLoad) ? 0 : (START_W[ex.name] ?? null));
      if(WK.ph==='доп.' && lo<=5) w=10;
      const range = hi>lo?`${lo}–${hi}`:`${lo}`;
      if(!w && noLoad) return out(0, lo, `<b>без веса</b>, рукой за опору, ${range} повт. Если поясница хоть чуть тянет — амплитуду меньше`, 'body');
      if(!w) return out(0, lo, `<b>свой вес</b>, ${range} повт. Последние 2 повтора тяжёлые`, 'body');
      const nxt = WK.ph==='доп.' ? 'легко — +2,5 кг' : WK.ph==='рюкзак' ? 'легко — +2 кг в рюкзак' : 'легко — бери следующую гантель';
      return out(w, lo, `старт: <b>${fmtW(w)} кг</b> × ${range}. Последний повтор тяжёлый, но чистый; ${nxt}`, 'load');
    }
    const bw=B.top;
    const allTop=B.n>=B.ns && B.min>=hi && (!B.rpe||B.rpe<=8);
    /* по плану с этой недели появился рюкзак, а раньше было без веса */
    if(ruck && !bw) return out(+ruck, lo, `с этой недели рюкзак: <b>${ruck} кг</b>, повторы снова от ${lo}`, 'load');
    if(deload) return out(bw, lo, `разгрузка: тот же вес${bw?` <b>${fmtW(bw)} кг</b>`:''}, по ${lo} повт., без отказа`, 'load');
    if(session) return out(bw, lo, `сессия: держим${bw?` <b>${fmtW(bw)} кг</b>`:''} × ${lo}, запас 2–3 повтора`, 'load');
    if(allTop){
      if(noLoad) return out(0, lo, `все подходы по ${hi}, поясница спокойна — <b>всё ещё без веса</b>, но уже без опоры руки. Вес — после 4-й недели`, 'body');
      if(bodyNow) return out(0, lo, `все подходы по ${hi} — можно надеть <b>рюкзак 4–6 кг</b> уже сейчас, повторы снова от ${lo}`, 'body');
      const w = bw ? rDb(bw+step) : (OPT_W[ex.tech] ?? step);
      return out(w, lo, `все подходы по ${hi}${B.rpe?`, тяжесть ${B.rpe}`:''} → <b>${fmtW(w)} кг</b>${bw?` (+${fmtW(w-bw)})`:''}, повторы снова от ${lo}`, 'load');
    }
    if(B.comp>=1){
      const r=Array.from({length:n},(_,i)=>Math.min(hi, (B.rs[i]??lo)+1));
      return out(bw, r, `${bw?`тот же вес <b>${fmtW(bw)} кг</b>, `:''}цель: <b>${listR(r)}</b> (было ${listR(B.rs)})`, 'load');
    }
    if(B.comp>=0.75) return out(bw, lo, `${bw?`тот же вес <b>${fmtW(bw)} кг</b>, `:''}добери до ${lo} во всех подходах (было ${listR(B.rs)})`, 'load');
    const w=bw?Math.max(0,rDb(bw-step)):0;
    return out(w, lo, `много недобора (${listR(B.rs)}) → ${w?`<b>${fmtW(w)} кг</b>`:'<b>без веса</b>'}, сначала чистые повторы`, 'load');
  }

  /* --- свой вес: до отказа минус 1 / запас --- */
  if(P.max){
    if(!B) return out(null, null, 'до отказа минус 1 — запиши повторы, и в следующий раз будет цель на каждый подход');
    if(deload) { const r=B.rs.slice(0,n).map(x=>Math.max(1,x-2)); return out(null, r, `разгрузка: <b>${listR(r)}</b> — на 2 меньше прошлого, без отказа`); }
    if(session || /запас/.test(ex.dose)) { const r=B.rs.slice(0,n).map(x=>Math.max(1,x-1)); return out(null, r, `поддержание: <b>${listR(r)}</b>, запас 2 повтора`); }
    const r=Array.from({length:n},(_,i)=>(B.rs[i]??B.rs[B.rs.length-1]??5)+(i<2?1:0));
    const heavy=(B.rs[0]||0)>=12 && HARDER[ex.tech] ? ` · первый подход 12+ — пора ${HARDER[ex.tech]}` : '';
    return out(null, r, `цель: <b>${listR(r)}</b> (было ${listR(B.rs)}) — +2 повтора за тренировку${heavy}`);
  }

  /* --- свой вес с диапазоном или фиксированными повторами --- */
  if(lo!=null){
    if(!B) return out(null, lo, `<b>${hi>lo?`${lo}–${hi}`:lo} повт.</b> в подходе`);
    if(deload) return out(null, lo, `разгрузка: по <b>${lo}</b>, без отказа`);
    const allTop=B.n>=B.ns && B.min>=hi && (!B.rpe||B.rpe<=8);
    if(allTop) return out(null, hi>lo?lo:hi, hi>lo
      ? `все подходы по ${hi} — усложни: <b>${HARDER[ex.tech]||'медленнее опускание, 3–4 сек'}</b>, повторы снова от ${lo}`
      : `всё по ${hi} сделано — держи технику, объём вырастет по плану`);
    const r=Array.from({length:n},(_,i)=>Math.min(hi, (B.rs[i]??lo)+1));
    return out(null, r, `цель: <b>${listR(r)}</b> (было ${listR(B.rs)})`);
  }
  return out(null, null, '');
}

/* Короткая подпись веса для заголовка карточки */
function planBadge(ex, P, pl){
  if(!pl || pl.w==null || !pl.w) return '';
  const WK=weightKind(ex,P);
  const w=fmtW(pl.w);
  if(WK.ph==='штанга') return `${w} кг`;
  if(WK.ph==='доп.') return `+${w} кг`;
  if(WK.ph==='рюкзак') return `рюкзак ${w} кг`;
  return `гантель ${w} кг`;
}

const TIMER_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>';

/* Тип отягощения: что вписывать в «кг». Свой вес не пишется никогда —
   только то, что держишь в руках, на плечах или на поясе. */
function weightKind(ex, P){
  const n=ex.name, d=ex.dose, t=ex.tech;
  const BODY={hint:`кг — оставь пустым: свой вес не пишется, только ${P.timed?'секунды':'повторы'}`, ph:'—'};
  if(t==='facepull' || t==='pallof' || /резин/.test(d)) return {hint:'кг — оставь пустым: это резина, считаем только повторы', ph:'—'};
  if(t==='trap') return {hint:'кг — общий вес: трэп-гриф (обычно 20–25 кг, написано на нём) + блины', ph:'штанга'};
  if(t==='squat' || /штанг/i.test(n) || (n==='Жим стоя')) return {hint:'кг — общий вес: гриф (20 кг) + блины', ph:'штанга'};
  if(/с весом/.test(n)) return {hint:'кг — только добавленный вес: блин на поясе, гантель между ног или рюкзак. Свой вес не пиши', ph:'доп.'};
  if(/без веса/.test(d)) return {hint:'кг — пусто: рукой за опору, без веса. Вес появится позже, когда поясница совсем не реагирует', ph:'—'};
  if(/гантел/i.test(n) || ['rdl','row','curl','triceps'].includes(t)) return {hint:'кг — вес <b>одной</b> гантели', ph:'гантель'};
  if(/рюкзак/.test(d)) return {hint:'кг — вес рюкзака', ph:'рюкзак'};
  if(/свой вес/.test(d)) return BODY;
  if(/без веса/.test(d)) return {hint:'кг — пусто: рукой за опору, без веса. Вес появится позже, когда поясница совсем не реагирует', ph:'—'};
  /* можно со своим весом, можно с гантелями */
  if(['calf','hipthrust','pistol','bulgarian'].includes(t))
    return {hint:'кг — пусто, если без веса. Взял гантели — вес <b>одной</b>', ph:'—'};
  return BODY;
}

/* Блок журнала внутри карточки упражнения */
function logBlock(day, ex, card, setDone){
  const k=logKey(day.id, ex.id);
  const P=parseDose(ex.dose);
  const L=logs[k] || {n:ex.name, d:null, sets:[], rpe:null};
  while(L.sets.length<P.sets) L.sets.push({w:'',r:''});
  const last=lastLog(ex.name, k);
  const PL=planFor(ex, P, k);
  const rs=restSec(ex.rest);
  const box=document.createElement('div');
  box.className='log';
  const unit=P.timed?'сек':'повт.';
  /* Что писать в поле «кг» — по типу отягощения */
  const WK=weightKind(ex, P);
  const DB = WK.ph==='гантель';
  const wHint = WK.hint;

  const draw=()=>{
    box.innerHTML=`
      ${last?`<div class="log-last">${lastSummary(last,P)}</div>`:''}
      ${PL.t?`<div class="log-tip">Сегодня: ${PL.t}</div>`:''}
      <div class="log-last" style="margin-bottom:8px">${wHint}</div>
      <div class="ls-head"><span>#</span><span>кг</span><span></span><span>${unit}</span><span>${rs?'отдых':''}</span></div>
      ${L.sets.map((x,i)=>`<div class="ls-row${num(x.r)!=null?' full':''}" data-i="${i}">
        <span class="ls-n">${i+1}</span>
        <input class="ls-w" type="text" inputmode="decimal" enterkeyhint="next" value="${esc(x.w)}" placeholder="${(PL.sets[i]&&PL.sets[i].w)?fmtW(PL.sets[i].w):WK.ph}" aria-label="Вес, подход ${i+1}">
        <span class="ls-x">×</span>
        <input class="ls-r" type="text" inputmode="numeric" enterkeyhint="done" value="${esc(x.r)}" placeholder="${(PL.sets[i]&&PL.sets[i].r!=null)?PL.sets[i].r:'—'}" aria-label="Повторы, подход ${i+1}">
        ${rs?`<button type="button" class="ls-rest" aria-label="Таймер отдыха">${TIMER_IC}</button>`:'<span></span>'}
      </div>`).join('')}
      <div class="log-rpe">
        <div class="lbl">Насколько тяжело было в последнем подходе</div>
        <div class="rpe-row">${[6,7,8,9,10].map(v=>`<button type="button" data-v="${v}" class="${v>=9?'hard':''}" aria-pressed="${L.rpe===v}">${v}</button>`).join('')}</div>
        <div class="rpe-legend"><span>легко, запас 4</span><span>ещё 1–2</span><span>предел</span></div>
      </div>
      <div class="log-actions">
        <button type="button" class="btn fill">По плану</button>
        <button type="button" class="btn addset">+ подход</button>
      </div>`;
    bind();
  };
  const save=()=>{
    L.n=ex.name;
    /* что было запланировано — чтобы в следующий раз честно посчитать выполнение */
    L.tr=P.lo; L.th=P.hi; L.ns=P.sets; L.wk=weekKind(state.cycle,state.week);
    if(!L.d && hasData(L)) L.d=isoDay();
    logs[k]=L; saveLogs();
    /* все подходы записаны → упражнение отмечено само */
    const full=L.sets.length && L.sets.every(x=>num(x.r)!=null);
    if(full) setDone(true);
  };
  const bind=()=>{
    box.querySelectorAll('.ls-row').forEach(row=>{
      const i=+row.dataset.i, w=row.querySelector('.ls-w'), r=row.querySelector('.ls-r');
      w.addEventListener('input',()=>{ L.sets[i].w=w.value.trim(); save(); });
      r.addEventListener('input',()=>{ L.sets[i].r=r.value.trim(); row.classList.toggle('full', num(r.value)!=null); save(); });
      /* записал повторы не в последнем подходе — таймер отдыха стартует сам */
      r.addEventListener('change',()=>{ if(rs && num(r.value)!=null && i<L.sets.length-1) startRest(rs, ex.name); });
      const b=row.querySelector('.ls-rest'); if(b) b.addEventListener('click',()=>startRest(rs, ex.name));
    });
    box.querySelectorAll('.rpe-row button').forEach(b=>b.addEventListener('click',()=>{
      const v=+b.dataset.v; L.rpe = (L.rpe===v) ? null : v; save(); draw();
    }));
    box.querySelector('.fill').addEventListener('click',()=>{
      L.sets.forEach((x,i)=>{ const p=PL.sets[i]||PL.sets[PL.sets.length-1]||{};
        if(!x.w && p.w) x.w=fmtW(p.w); if(!x.r && p.r!=null) x.r=String(p.r); });
      save(); draw();
    });
    box.querySelector('.addset').addEventListener('click',()=>{ L.sets.push({w:'',r:''}); save(); draw(); });
  };
  draw();
  return box;
}

/* ---------- Данные с часов ----------
   Начало и конец тренировки, средний и максимальный пульс, калории.
   Часы завышают калории на силовых — к еде прибавляется около 300 ккал, а не вся цифра. */
const watchKey = id => `${state.cycle}-${state.week}-${id}`;
const hm2min = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
function watchMinutes(w){
  const a=hm2min(w&&w.s), b=hm2min(w&&w.e);
  if(a==null || b==null) return null;
  return (b-a+1440)%1440;
}
const fmtDur = m => m==null ? '' : `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;
function watchBlock(id){
  const k=watchKey(id);
  const W=watch[k]||{};
  const box=document.createElement('div');
  box.className='watchbox';
  box.innerHTML=`
    <div class="wb-h">Данные с часов</div>
    <div class="wb-row">
      <div class="wb-cell"><button type="button" class="tbtn" data-t="s">Начал сейчас</button>
        <input type="time" class="tinp" data-f="s" value="${esc(W.s)}" aria-label="Начало"></div>
      <div class="wb-cell"><button type="button" class="tbtn" data-t="e">Закончил сейчас</button>
        <input type="time" class="tinp" data-f="e" value="${esc(W.e)}" aria-label="Конец"></div>
    </div>
    <div class="wb-row three">
      <label>Ср. пульс<input type="text" inputmode="numeric" class="app-field" data-f="hr" value="${esc(W.hr)}" placeholder="уд/мин"></label>
      <label>Макс. пульс<input type="text" inputmode="numeric" class="app-field" data-f="mx" value="${esc(W.mx)}" placeholder="уд/мин"></label>
      <label>Ккал<input type="text" inputmode="numeric" class="app-field" data-f="kc" value="${esc(W.kc)}" placeholder="активные"></label>
    </div>
    <div class="wb-sum"></div>`;
  const sum=box.querySelector('.wb-sum');
  const paint=()=>{
    const w=watch[k]||{}, m=watchMinutes(w), parts=[];
    if(m!=null) parts.push(`длительность ${fmtDur(m)}`);
    if(num(w.hr)!=null) parts.push(`пульс ${w.hr}${num(w.mx)!=null?'/'+w.mx:''}`);
    if(num(w.kc)!=null) parts.push(`${w.kc} ккал по часам · к еде +300`);
    sum.innerHTML = parts.length ? `<span style="color:var(--carb)">✓</span> ${parts.join(' · ')}` : '<span style="color:var(--muted)">Нажми «Начал сейчас» в начале и «Закончил сейчас» в конце: часы не должны идти дольше тренировки</span>';
  };
  const put=(f,v)=>{
    const cur=watch[k]||{};
    if(v===''||v==null) delete cur[f]; else cur[f]=v;
    if(Object.keys(cur).length) watch[k]=cur; else delete watch[k];
    saveWatch(); paint();
  };
  box.querySelectorAll('.tbtn').forEach(b=>b.addEventListener('click',()=>{
    const f=b.dataset.t, v=nowHM(); put(f,v);
    box.querySelector(`.tinp[data-f="${f}"]`).value=v;
    toast(f==='s'?`Начало ${v}`:`Конец ${v}`);
  }));
  box.querySelectorAll('.tinp').forEach(i=>i.addEventListener('change',()=>put(i.dataset.f, i.value)));
  box.querySelectorAll('.app-field').forEach(i=>i.addEventListener('input',()=>put(i.dataset.f, num(i.value)==null?'':num(i.value))));
  paint();
  return box;
}

/* Строка замены: «Заменить на …» или «Вернуть …» */
function subRow(ex){
  if(ex.sub) return `<div class="subrow">Замена для «${ex.sub.from}»: ${ex.sub.why}.
    <button type="button" class="linkbtn subbtn" data-from="${esc(ex.sub.from)}" data-on="0">Вернуть «${ex.sub.from}»</button></div>`;
  const A=ALTS[ex.name];
  if(!A || /пропустить/.test(ex.dose)) return '';
  return `<div class="subrow">Если ${A.why} — <button type="button" class="linkbtn subbtn" data-from="${esc(ex.name)}" data-on="1">заменить на «${A.name}»</button></div>`;
}

/* Карточка упражнения: галочка, дозировка, журнал, техника */
function exCard(day, ex){
  const k=key(day.id,ex.id), done=!!marks[k];
  /* вес на эту неделю — видно без раскрытия карточки */
  let doseShown=ex.dose;
  if(isLogged(ex)){
    const P=parseDose(ex.dose), pl=planFor(ex, P, logKey(day.id, ex.id)), bd=planBadge(ex, P, pl);
    if(bd){
      if(/·\s*[\d.,]+\s*кг/.test(doseShown)) doseShown=doseShown.replace(/·\s*[\d.,]+\s*кг/, '· '+bd);
      else if(/·\s*(свой вес|рюкзак [\d–]+ кг)/.test(doseShown)) doseShown=doseShown.replace(/·\s*(свой вес|рюкзак [\d–]+ кг)/, '· '+bd);
      else doseShown+=' · '+bd;
    }
  }
  const t=TECH[ex.tech]||{text:'<p>Описание будет добавлено.</p>'};
  const card=document.createElement('article');
  card.className='ex'+(done?' ex-done':'');
  card.innerHTML=`
    <div class="ex-head" tabindex="0" role="button" aria-expanded="false">
      <button class="check" role="checkbox" aria-checked="${done}" aria-label="${ex.name}"></button>
      <div class="ex-main">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">
          <span class="badge ${ex.badge[1]}">${ex.badge[0]}</span>
          <span class="dose">${doseShown}${ex.rest&&ex.rest!=='—'?`<span class="rest">отдых ${ex.rest}</span>`:''}</span>
        </div>
      </div>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="fold"><div class="fold-inner"><div class="ex-body">
      <div class="logslot"></div>
      ${ex.warm?`<div class="warmsets${/^Не нужна/.test(ex.warm)?' none':''}">
        <span class="ws-l">Подводка</span><span>${ex.warm}</span></div>`:''}
      ${t.fig?`<div class="fig">${S[t.fig]}</div>`:''}
      <div class="tech">${t.text}</div>
      ${subRow(ex)}
    </div></div></div>`;
  bindFold(card.querySelector('.ex-head'), card);
  const sb=card.querySelector('.subbtn');
  if(sb) sb.addEventListener('click',e=>{ e.stopPropagation(); setSub(sb.dataset.from, sb.dataset.on==='1'); renderAll(); });
  const chk=card.querySelector('.check');
  const setDone=now=>{
    if(!!marks[k]===now) return;
    if(now) marks[k]=true; else delete marks[k];
    chk.setAttribute('aria-checked',now?'true':'false');
    card.classList.toggle('ex-done',now);
    saveMarks(); updateProgress();
  };
  chk.addEventListener('click',e=>{ e.stopPropagation(); setDone(!marks[k]); });
  const slot=card.querySelector('.logslot');
  if(isLogged(ex)) slot.appendChild(logBlock(day, ex, card, setDone));
  if(ex.action==='jump'){
    const b=document.createElement('button');
    b.type='button'; b.className='btn btn-primary actbtn'; b.style.width='100%';
    b.textContent='Посчитать прыжок по видео →';
    b.addEventListener('click',()=>{ goTab('prog','#jumpTool'); });
    slot.appendChild(b);
  }
  return card;
}

/* ---------- Таймер отдыха ----------
   Считает от времени окончания, поэтому не сбивается, если телефон
   гасил экран. Экран на время отдыха не гаснет (где это умеет Safari). */
const RT={end:0,total:0,iv:0,wake:null,ctx:null};
function beep(){
  try{
    const c=RT.ctx; if(!c) return;
    [0,0.22,0.44].forEach(t=>{
      const o=c.createOscillator(), g=c.createGain();
      o.frequency.value=880; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001,c.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.35,c.currentTime+t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+t+0.18);
      o.start(c.currentTime+t); o.stop(c.currentTime+t+0.2);
    });
  }catch(e){}
  try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){}
}
async function wakeOn(){ try{ if('wakeLock' in navigator && !RT.wake) RT.wake=await navigator.wakeLock.request('screen'); }catch(e){} }
function wakeOff(){ try{ RT.wake && RT.wake.release(); }catch(e){} RT.wake=null; }
function startRest(sec, label){
  try{
    RT.ctx = RT.ctx || new (window.AudioContext||window.webkitAudioContext)();
    if(RT.ctx.state==='suspended') RT.ctx.resume();
  }catch(e){}
  RT.end=Date.now()+sec*1000; RT.total=sec;
  document.getElementById('rtLabel').textContent = 'Отдых · ' + (label||'');
  const el=document.getElementById('rtimer');
  el.classList.add('show'); el.classList.remove('done'); document.body.classList.add('timing');
  wakeOn(); clearInterval(RT.iv); RT.iv=setInterval(tickRest,250); tickRest();
}
function tickRest(){
  const el=document.getElementById('rtimer');
  const left=Math.max(0, Math.round((RT.end-Date.now())/1000));
  document.getElementById('rtTime').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  document.getElementById('rtBar').style.transform=`scaleX(${RT.total?left/RT.total:0})`;
  if(left<=0 && !el.classList.contains('done')){
    el.classList.add('done'); document.getElementById('rtLabel').textContent='Отдых закончился — подход';
    beep(); wakeOff();
    clearInterval(RT.iv);
    setTimeout(()=>{ if(el.classList.contains('done')){ el.classList.remove('show'); document.body.classList.remove('timing'); } }, 8000);
  }
}
function stopRest(){ clearInterval(RT.iv); wakeOff(); document.getElementById('rtimer').classList.remove('show'); document.body.classList.remove('timing'); }
document.getElementById('rtStop').addEventListener('click', stopRest);
document.getElementById('rtPlus').addEventListener('click',()=>{
  const el=document.getElementById('rtimer');
  if(el.classList.contains('done')){ startRest(30, ''); return; }
  RT.end+=30000; RT.total+=30; tickRest();
});
