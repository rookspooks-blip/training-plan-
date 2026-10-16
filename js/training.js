"use strict";
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
  const hyper = cycle3(state.week).kind==='hyper';
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
const isSkipped = id => isDropped(id) || (isMoved(id) && (id==='d2'||id==='d4'));  /* скоростные не переносятся */
const noPE = () => !!skips[peKey()];
/* Баскет в субботу утром (секция в вузе) — отмечается на конкретную неделю */
const ballKey  = ()  => `${state.cycle}-${state.week}-ball`;
const ballSat  = ()  => !!skips[ballKey()];

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
function toggleBall(){
  const k=ballKey();
  if(skips[k]) delete skips[k]; else skips[k]=true;
  saveSkips(); renderAll();
}

/* Суббота с баскетом — «высокий день», как каникулы: утром скорость (игра), вечером ноги.
   Игра и есть скоростная этой недели: старты, прыжки, торможения. Отдельную не добавляем —
   четверг и пятница уже прыжковые, сухожилию колена нужны дни без прыжков */
function basketDay(cycle, week){
  const dl=weekKind(cycle,week)==='deload', ks=kneeStatus(), red=ks && ks.lvl==='r', yellow=ks && ks.lvl==='y';
  return {id:'d7', title:'Баскетбол', when:'Суббота · утром, зал вуза', noWarm:true,
    note:'Это скоростная этой недели: старты, прыжки и торможения — в игре. Силовая Б — вечером, через 5+ часов. '
      +(red ? 'Колено красное: только броски, без прыжков и игры в полную силу.'
        : dl ? 'Разгрузка: не больше одной пары, прыжки не на максимум.'
        : 'Прыгай в полную силу, пока высота не падает. Стала ниже — дальше играй без прыжков на максимум.'),
    ex:[
      {...ACHILLES, warm:'Дома или в зале до командной разминки.'},
      {id:'k2',name:'Ускорения и прыжки перед игрой',badge:['Скорость','b-speed'],dose:red||yellow?'пропустить':'2 × 10 м на 80 % · 3 прыжка на касание',rest:'60 сек',tech:'reach',
       warm:'После командной разминки. Это «включить» ноги, а не тренировка: в полную силу — только последний прыжок.'},
      {id:'k3',name:'Игра',badge:['Мяч','b-ball'],dose:red?'только броски · 20–30 мин':dl?'1 пара':'1–2 пары',rest:'—',tech:'shoot',
       warm:'Сразу после игры — еда: контейнер или хотя бы банан с йогуртом. В этот день на ~250 ккал больше обычного.'}
    ]};
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

/* Куда встают тренировки на этой неделе.
   Силовая В (верх) — среда, Силовая Г (верх, блоки массы цикла 3) — пятница вечером */
/* Каникулы (шаг 4 ресерча): три «высоких» дня через 48 часов — Пн, Ср, Пт.
   Пн: скорость утром, Силовая А вечером. Ср: скоростная утром, Силовая Б вечером.
   Пт: данки. Верх — во вторник, велосипед — в воскресенье. Утро и вечер — через 6+ часов */
function vacationLayout(){
  /* note — только для настоящих переносов: по ней неделя рисует значок «перенесено» */
  const L={ d1:{dow:1, note:''}, d2:{dow:3, note:''}, d3:{dow:3, note:''}, d5:{dow:2, note:''}, d6:{dow:5, note:''} };
  if(isMoved('d1') && !isDropped('d1')){
    L.d1.dow=2; L.d1.note='Перенесена на вторник.';
    L.d5.dow=4; L.d5.note='Верх уступил вторник Силовой А и переехал на четверг.';
  }
  if(isMoved('d3') && !isDropped('d3')){
    L.d3.dow=4; L.d3.note='Перенесена на четверг вечером. Пятничные данки — по самочувствию, ноги не будут свежими.';
    if(L.d5.dow===4){ L.d5.dow=6; L.d5.note='Верх переехал на субботу.'; }
  }
  if(isMoved('d5') && !isDropped('d5')){
    L.d5.dow = L.d3.dow===4 || L.d1.dow===2 ? 6 : 4;
    L.d5.note = L.d5.dow===4 ? 'Перенесена на четверг. Это только верх, ногам не мешает.' : 'Перенесена на субботу.';
  }
  return L;
}
function layout(){
  if(summerMode()==='vacation') return vacationLayout();
  const sh=weekShift();
  const L={
    d1:{dow:1, note:''},
    d2:{dow:4, note:''},
    d3:{dow:6, note:''},
    d5:{dow:3, note:''},
    d6:{dow:5, note:''}
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
      : 'Перенесена на вторник.';
  }

  /* Силовая Б переезжает на воскресенье, следующая неделя сдвигается */
  if(isMoved('d3') && !isDropped('d3')){
    L.d3.dow=0;
    L.d3.note='Перенесена на воскресенье. Следующая неделя начнётся со вторника — между силовыми нужно 48 часов.';
  }

  /* Силовая А уехала на среду — верх уступает ей среду и переезжает на пятницу вечером */
  if(L.d1.dow===3){
    L.d5.dow=5;
    L.d5.note='Сдвинута на пятницу вечером: в среду стоит перенесённая Силовая А.';
  }
  /* Пропущенный верх — на четверг вечером: ногам и скоростной он не мешает */
  if(isMoved('d5') && !isDropped('d5')){
    L.d5.dow=4;
    L.d5.note='Перенесена на четверг вечером — через 3+ часа после скоростной. Это только верх, ногам не мешает.';
  }
  if(isMoved('d6') && !isDropped('d6')){
    L.d6.dow=0;
    L.d6.note='Перенесена на воскресенье вечером, через 6+ часов после велосипеда.';
  }

  return L;
}

/* Неделя целиком в календарном порядке: силовые, кардио и отдых.
   За одну перерисовку её спрашивают до десяти раз — собираем один раз.
   Готовые недели живут до конца текущего нажатия (сбрасываются микрозадачей),
   а запись данных (dataGen) или другая неделя дают другой ключ */
let weekCache=null;
function buildWeek(){
  const k=`${dataGen}|${isoDay()}|${state.cycle}-${state.week}`;
  if(!weekCache){ weekCache=new Map(); queueMicrotask(()=>{ weekCache=null; }); }
  let v=weekCache.get(k);
  if(!v){ v=buildWeekRaw(); weekCache.set(k, v); }
  return v;
}
function buildWeekRaw(){
  const S=buildDays(state.cycle,state.week), C=cardioFor();
  if(noPE() && !isSession()) S[1]=homeSpeedDay();          /* четверг: физры не было */
  /* пятница: «Первый шаг» (недели 1–2 цикла 1) или данки в каникулы; в остальные недели дня нет */
  if(!isSession()){ const F=fridayDay(state.cycle,state.week); if(F) S[3]=F; }
  /* летняя сессия — как зимняя: две короткие силовые и прыжки, без отдельных дней верха */
  const exam=summerMode()==='exam';
  const U=exam?null:upperDay(state.cycle,state.week);  if(U) S[4]=U;   /* среда: верх дома */
  const G=exam?null:massDay(state.cycle,state.week);   if(G) S[5]=G;   /* пятница вечером: верх в блоках массы */
  adjustDays(S);                                            /* замены, колено, перерыв, усталость */
  const L=layout();
  const MODE={bike:'Велосипед', run:'Бег', walk:'Ходьба'};

  /* Силовая А не в понедельник (пропуск или сдвиг недели) — до скоростной меньше 48 часов:
     без подъезда и на подход меньше на ноги. Верх по плану */
  if(S[0] && (L.d1.dow===2 || L.d1.dow===3) && !isDropped('d1') && !isSession() && S[0].ex.some(ex=>ex.badge[0]==='Скорость')){
    S[0]={...S[0], ex:S[0].ex.filter(ex=>ex.badge[0]!=='Скорость').map(ex=>isLogged(ex)&&ex.badge[0]==='Ноги'?lessSets(ex):ex)};
    L.d1.note+=' До скоростной меньше 48 часов: без стартов и прыжков в начале и на подход меньше на ноги.';
  }

  /* Дни, занятые силовыми — туда кардио не ставим */
  const taken=new Set([L.d1.dow, L.d3.dow]);
  if(!isDropped('d2')) taken.add(L.d2.dow);
  if(S[4] && !isDropped('d5')) taken.add(L.d5.dow);
  if(S[5] && !isDropped('d6')) taken.add(L.d6.dow);

  const out=[];
  out.push({dow:L.d1.dow, id:'d1', type:'gym', day:S[0], moveNote:L.d1.note});
  if(!isDropped('d2')) out.push({dow:L.d2.dow, id:'d2', type:'gym', day:S[1], moveNote:L.d2.note});
  if(S[4]) out.push({dow:L.d5.dow, id:'d5', type:'gym', day:S[4], moveNote:L.d5.note});
  out.push({dow:L.d3.dow, id:'d3', type:'gym', day:S[2], moveNote:L.d3.note});
  if(S[3] && !isDropped('d4')){ out.push({dow:5, id:'d4', type:'gym', day:S[3], moveNote:''}); taken.add(5); }
  if(S[5]) out.push({dow:L.d6.dow, id:'d6', type:'gym', day:S[5], moveNote:L.d6.note});
  /* баскет утром — Силовая Б остаётся в субботе, но вечером и без стартов и прыжков: их дала игра */
  if(ballSat()){
    out.push({dow:6, id:'d7', type:'gym', day:basketDay(state.cycle,state.week), moveNote:''});
    taken.add(6);
    const b=out.find(e=>e.id==='d3');
    if(b && b.dow===6) b.day={...b.day, ex:b.day.ex.filter(ex=>ex.badge[0]!=='Скорость'),
      note:'Утром был баскет — Силовая Б вечером, через 5+ часов после игры. Стартов и прыжков нет: их дала игра. '+b.day.note.replace(/Суббота свободна — тренируйся днём, без спешки\.\s*/,'')};
  }

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
    5:{title:'Отдых', why:'Физра утром и пары — вечер свободен, ноги отдыхают перед субботой.'},
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
  /* в один день — по времени: баскет утром раньше Силовой Б вечером */
  const tm=e=>hm2min(trainingTime(e)||'23:59')||0;
  out.sort((a,b)=> ((a.dow===0?7:a.dow) - (b.dow===0?7:b.dow)) || (a.id==='d7'||b.id==='d7' ? tm(a)-tm(b) : 0));
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

const DROP_ADVICE={
  d1:'Силовая А отменена на этой неделе. Если отменишь и Силовую Б, прогрессия сдвинется на неделю назад — веса следующей недели повторят эти.',
  d2:'Скоростная отменена. На прогрессию весов не влияет, но прыжковой работы на этой неделе не было — учти в отчёте.',
  d3:'Силовая Б отменена. Если на этой неделе отменены обе силовые, прогрессия сдвинется: веса следующей недели повторят текущие.',
  d5:'Силовая В отменена. На веса ног и прогрессию не влияет: верх на этой неделе получит нагрузку в понедельник и субботу.',
  d6:'Силовая Г отменена. Догонять не надо — это добавка к верху в блоке массы.',
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

/* Время тренировки — как в календаре: Пн 17:00, Вт 09:00 велосипед, Ср 18:00 верх,
   Чт 11:40 скоростная после физры (дома без физры — после пар, 17:00), Пт 18:00 верх в блоках
   массы, Сб 13:00, Вс 11:00 велосипед. Перенос — время дня, куда переехала.
   Лето: практика — вечером, каникулы — днём */
/* Числитель или знаменатель. Известно только для осеннего семестра 2026:
   неделя 1 начинается 31.08, нечётные — числитель, чётные — знаменатель
   (по твоему календарю 21.10 — знаменатель). Весной расписание другое — там null */
function denomWeek(iso){
  if(!(iso>='2026-08-31' && iso<='2026-12-31')) return null;
  const n=Math.floor(daysBetween('2026-08-31', iso)/7)+1;
  return n%2===0;
}
/* Время дел дня — как в твоём Google Календаре и в шаге 4 ресерча:
   Пн 17:00, Вт велосипед 19:00 (пары до 13:20, учёба до 16:00), Ср верх — 18:00,
   в знаменатель вечером семинар, поэтому утром 8:30; Чт после физры 11:40,
   Сб 12:00, Вс велосипед 12:00 */
function trainingTime(e){
  if(!e || e.type==='rest') return null;
  const sm=summerMode();
  if(e.type==='run') return e.dow===0 ? '12:00' : (sm==='vacation' ? '11:00' : '19:00');
  /* суббота с баскетом: игра утром в вузе, Силовая Б вечером — в любой период */
  if(e.id==='d7') return '10:10';
  if(e.id==='d3' && e.dow===6 && ballSat()) return '18:00';
  if(sm==='practice') return '18:30';
  if(sm==='vacation') return VAC_TIME[e.id] || '11:00';
  if(isSession() || sm==='exam') return e.dow===6 ? '12:00' : '17:00';
  if(e.id==='d2') return e.day && e.day.swap ? '17:00' : '11:40';
  if(e.id==='d4') return '11:40';
  if(e.id==='d5' && e.dow===3 && denomWeek(dateOfCW(state.cycle,state.week,2))) return '08:30';
  if(e.id==='d5' || e.id==='d6') return '18:00';
  if(e.id==='d3') return '12:00';
  return '17:00';
}
/* Каникулы: утром скорость, вечером ноги — между ними 6+ часов (шаг 4) */
const VAC_TIME={d1:'18:00', d2:'10:00', d3:'18:00', d4:'11:00', d5:'18:00', d6:'18:00'};

const DOW_FULL=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

/* ############################################################
   ЕЖЕДНЕВНЫЙ БЛОК
   Ядро, которое делается каждый день без исключений, в том числе
   в тренировочные: отдельно от разминки, в любое удобное время
   (утром, в перерыве, вечером). Разминка перед тренировкой — другое.
   ############################################################ */
const DAILY=[WP.wallsit, WP.groin, WP.shortfoot, WP.balance];
const dailyMinutes=()=>Math.round(DAILY.reduce((a,x)=>a+x.sec,0)*1.15/60);

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
  'Жим штанги лёжа':50,
  'Тяга гантели в наклоне':12, 'Жим гантелей стоя':12, 'Румынская тяга на одной ноге':4,
  'Сгибания на бицепс':10, 'Разгибания на трицепс':14, 'Тяга штанги в наклоне':40,
  'Подтягивания с весом':5, 'Брусья с весом':5, 'Болгарский сплит-присед':8,
  'Махи гантелями в стороны':4, 'Разведения в наклоне':3, 'Разгибания из-за головы':10,
  'Румынская тяга в разноножке':8, 'Разгибания ног в тренажёре':25, 'Сгибания ног в тренажёре':20
};
/* Первый вес на 5-й неделе цикла 1, кг одной гантели: сплит-присед — по 10
   в каждой руке; румынская — 4 кг, поясница на 12 кг уже ныла */
const HEAVY_START={bulgarian:10, rdl:4, rdlb:6};
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
  if(bk && bk.lvl!=='g' && ['rdl','rdlb','row','trap'].includes(ex.tech)){
    const n=P.sets;
    return {w:0, kind:'back', sets:Array.from({length:n},()=>({w:0, r:bk.lvl==='r'?null:P.lo})),
      t: bk.lvl==='r' ? '<b>сегодня пропусти</b> — поясница красная. Вместо этого ягодичный мостик без веса'
                      : '<b>без веса</b>, рукой за опору — поясница жёлтая. Амплитуда до середины голени'};
  }
  const wk=weekKind(state.cycle,state.week);
  const deload=wk==='deload' || earlyDlOn(), session=wk==='session', test=/^тест/.test(ex.dose);
  const hist=logsOf(ex.name,k);
  const base=hist.find(h=>h.L.wk!=='deload' && h.L.wk!=='test') || hist[0] || null;
  const B=base ? sessionStats(base.L, P.lo, P.sets) : null;
  const lo=P.lo, hi=P.hi, n=P.sets;
  const out=(w, r, t, kind)=>({w, kind,
    sets:Array.from({length:n},(_,i)=>({w, r:Array.isArray(r)?(r[i]??r[r.length-1]??null):r})), t});
  const isBar=WK.ph==='штанга';
  const optional=/пусто, если без веса/.test(WK.hint);
  const loaded=WK.ph==='гантель'||WK.ph==='рюкзак'||WK.ph==='доп.'||WK.ph==='тренажёр'||optional||/без веса/.test(ex.dose);

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
    else if(deload){ w=r25(bw*0.9); t=`разгрузка: ~90 % от рабочих ${fmtW(bw)} → <b>${fmtW(w)} кг</b>, подходов меньше, запас 3–4 повтора`; }
    else if(session){ w=bw; t=`сессия: держим <b>${fmtW(w)} кг</b>, запас 2–3 повтора`; }
    else {
      const prev=hist.filter(h=>h!==base && h.L.wk!=='deload' && h.L.wk!=='test')[0];
      const P2=prev?sessionStats(prev.L,lo,n):null;
      const twoFails = B.comp<1 && P2 && P2.comp<1 && Math.abs(P2.top-bw)<0.1;
      const small = /Жим стоя|наклоне|лёжа/.test(ex.name);
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
    const fine = !!WK.fine;
    const step = fine ? 1 : (WK.ph==='доп.'||WK.ph==='тренажёр' ? 2.5 : 2);
    const ruck = (ex.dose.match(/рюкзак (\d+)/)||[])[1];
    const bodyNow = /свой вес/.test(ex.dose);
    const noLoad = /без веса/.test(ex.dose);
    if(!B){
      let w = ruck ? +ruck : ((optional||noLoad) ? 0 : (START_W[ex.name] ?? null));
      if(WK.fine) w = HEAVY_START[ex.tech] ?? w;   /* цикл 1, с 5-й недели: тот же старт, что после своего веса */
      if(WK.ph==='доп.' && lo<=5) w=10;
      const range = hi>lo?`${lo}–${hi}`:`${lo}`;
      if(!w && noLoad) return out(0, lo, `<b>без веса</b>, рукой за опору, ${range} повт. Если поясница хоть чуть тянет — амплитуду меньше`, 'body');
      if(!w) return out(0, lo, `<b>свой вес</b>, ${range} повт. Последние 2 повтора тяжёлые`, 'body');
      const nxt = WK.ph==='доп.' ? 'легко — +2,5 кг' : WK.ph==='рюкзак' ? 'легко — +2 кг в рюкзак' : 'легко — бери следующую гантель';
      return out(w, lo, `старт: <b>${fmtW(w)} кг</b> × ${range}. Последний повтор тяжёлый, но чистый; ${nxt}`, 'load');
    }
    const bw=B.top;
    const allTop=B.n>=B.ns && B.min>=hi && (!B.rpe||B.rpe<=8);
    /* с этой недели вес в руках, а раньше было своим весом */
    if(fine && !bw && /вес в руках/.test(ex.dose)){
      const w0=HEAVY_START[ex.tech]||8;
      return out(w0, lo, `с этой недели с весом: <b>${fmtW(w0)} кг</b> в каждой руке, ${lo}${hi>lo?'–'+hi:''} повт., темп тот же. Последние 2 повтора тяжёлые — иначе в следующий раз +1 кг`, 'load');
    }
    /* по плану с этой недели появился рюкзак, а раньше было без веса */
    if(ruck && !bw) return out(+ruck, lo, `с этой недели рюкзак: <b>${ruck} кг</b>, повторы снова от ${lo}`, 'load');
    /* разгрузка (шаг 8): вес ~90 % от рабочего, гантели с шагом 1 кг, запас 3–4 повтора */
    if(deload){ const dw=bw ? Math.max(1, Math.round(bw*0.9)) : bw;
      return out(dw, lo, `разгрузка: ~90 % от рабочего${bw?` → <b>${fmtW(dw)} кг</b>`:''}, по ${lo} повт., запас 3–4 повтора`, 'load'); }
    if(session) return out(bw, lo, `сессия: держим${bw?` <b>${fmtW(bw)} кг</b>`:''} × ${lo}, запас 2–3 повтора`, 'load');
    if(allTop){
      /* дома гантели собираются максимум до 30 кг: дальше ноги переезжают в зал */
      if(bw>=30 && WK.ph==='гантель' && ex.badge[0]==='Ноги')
        return out(bw, hi, `все подходы по ${hi} с ${fmtW(bw)} кг — тяжелее дома не собрать. <b>Пора в зал со штангой</b>: дни ног переезжают туда, верх остаётся дома. Пока — тот же вес, пауза 2 сек внизу`, 'load');
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
  if(WK.ph==='тренажёр') return `${w} кг`;
  return `гантель ${w} кг`;
}

/* Тип отягощения: что вписывать в «кг». Свой вес не пишется никогда —
   только то, что держишь в руках, на плечах или на поясе. */
function weightKind(ex, P){
  const n=ex.name, d=ex.dose, t=ex.tech;
  const BODY={hint:`кг — оставь пустым: свой вес не пишется, только ${P.timed?'секунды':'повторы'}`, ph:'—'};
  /* тяжёлая медленная работа для сухожилия: гантели собираются с шагом 0,5 кг,
     поэтому прибавка мелкая — по 1 кг на гантель */
  if(/вес в руках/.test(d)) return {hint:'кг — вес <b>одной</b> гантели. Гантели разборные, шаг 0,5 кг: прибавляй по 1 кг', ph:'гантель', fine:true};
  if(t==='facepull' || t==='pallof' || /резин/.test(d)) return {hint:'кг — оставь пустым: это резина, считаем только повторы', ph:'—'};
  if(t==='trap') return {hint:'кг — общий вес: трэп-гриф (обычно 20–25 кг, написано на нём) + блины', ph:'штанга'};
  if(t==='squat' || /штанг/i.test(n) || (n==='Жим стоя')) return {hint:'кг — общий вес: гриф (20 кг) + блины', ph:'штанга'};
  if(/с весом/.test(n)) return {hint:'кг — только добавленный вес: блин на поясе, гантель между ног или рюкзак. Свой вес не пиши', ph:'доп.'};
  if(/без веса/.test(d)) return {hint:'кг — пусто: рукой за опору, без веса. Вес появится позже, когда поясница совсем не реагирует', ph:'—'};
  if(/тренажёр/.test(n)) return {hint:'кг — вес, выставленный на тренажёре', ph:'тренажёр'};
  /* мелкие мышцы: гантели разборные, шаг 0,5 кг — прибавка по 1 кг, а не по 2 */
  if(['lateral','reardelt','curl','triceps'].includes(t)) return {hint:'кг — вес <b>одной</b> гантели. Прибавляй по 1 кг', ph:'гантель', fine:true};
  if(/гантел/i.test(n) || ['rdl','rdlb','row'].includes(t)) return {hint:'кг — вес <b>одной</b> гантели', ph:'гантель'};
  if(/рюкзак/.test(d)) return {hint:'кг — вес рюкзака', ph:'рюкзак'};
  if(/свой вес/.test(d)) return BODY;
  if(/без веса/.test(d)) return {hint:'кг — пусто: рукой за опору, без веса. Вес появится позже, когда поясница совсем не реагирует', ph:'—'};
  /* можно со своим весом, можно с гантелями */
  if(['calf','hipthrust','pistol','bulgarian'].includes(t))
    return {hint:'кг — пусто, если без веса. Взял гантели — вес <b>одной</b>', ph:'—'};
  return BODY;
}

/* ---------- Данные с часов ----------
   Начало и конец тренировки, средний и максимальный пульс, калории.
   Калории с часов идут в отчёт и выгрузку; к цели еды не прибавляются (С7). */
const watchKey = id => `${state.cycle}-${state.week}-${id}`;
const hm2min = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
function watchMinutes(w){
  const a=hm2min(w&&w.s), b=hm2min(w&&w.e);
  if(a==null || b==null) return null;
  return (b-a+1440)%1440;
}
const fmtDur = m => m==null ? '' : `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;
/* ############################################################
   ТРЕНИРОВКА ОТ НАЧАЛА ДО КОНЦА
   «Начать» → идёт (время, сколько сделано) → «Закончить» → итог
   с самочувствием. Время старта и конца пишутся туда же, где данные
   с часов, поэтому выгрузка и калории считают их как раньше.
   ############################################################ */
function sessionState(id){
  const W=watch[watchKey(id)]||{};
  return !W.s ? 'idle' : (W.e ? 'done' : 'run');
}
const dayDate = e => dateOfCW(state.cycle, state.week, (e.dow+6)%7);
function daySummary(day){
  const pre=`${state.cycle}-${state.week}-${day.id}-`;
  const done=day.ex.filter(x=>marks[key(day.id,x.id)]).length;
  let vol=0;
  for(const k in logs) if(k.startsWith(pre)) (logs[k].sets||[]).forEach(s=>{ const w=num(s.w), r=num(s.r); if(w&&r) vol+=w*r; });
  return {done, total:day.ex.length, vol:Math.round(vol)};
}
function setWatch(id, f, v){
  const k=watchKey(id), cur=watch[k]||{};
  if(v==null) delete cur[f]; else cur[f]=v;
  if(Object.keys(cur).length) watch[k]=cur; else delete watch[k];
  saveWatch();
}
/* ---------- «Не получается?» ----------
   Пропуск (перенос), физры не было, болею — в одном меню */
function unskip(id){ delete skips[skipKey(id)]; delete skips[dropKey(id)]; saveSkips(); renderAll(); }
function pauseWeek(fromDow){
  const ord=d=>(d===0?7:d);
  buildWeek().forEach(x=>{
    if((x.type==='gym'||x.type==='run') && ord(x.dow)>=ord(fromDow)){ skips[skipKey(x.id)]=true; skips[dropKey(x.id)]=true; }
  });
  saveSkips(); renderAll();
  toast('Пауза до конца недели. После — первая тренировка будет легче');
}
