"use strict";
/* ############################################################
   12 · КАЛЬКУЛЯТОР ПИТАНИЯ
   ############################################################ */
function dishTotals(d){
  let k=0,p=0,f=0,c=0;
  d.ing.forEach(([fid,base])=>{
    const g=gramOf(d.id,fid,base)/100, F=FOOD[fid];
    k+=F.k*g; p+=F.p*g; f+=F.f*g; c+=F.c*g;
  });
  return {k:Math.round(k),p:Math.round(p),f:Math.round(f),c:Math.round(c)};
}
function dayTotals(){
  let k=0,p=0,f=0,c=0;
  DISHES.forEach(d=>{ if(!dishOn[d.id]) return; const t=dishTotals(d); k+=t.k;p+=t.p;f+=t.f;c+=t.c; });
  custom.forEach(x=>{ k+=x.k; p+=x.p; f+=x.f; c+=x.c; });
  return {k,p,f,c};
}

/* Еда, добавленная вручную: всё, что съел не из списка */
/* Частая еда одним нажатием. Цифры — из его же дневника (sport.md, неделя 1) */
const FAV_SEED=[
  {name:'Юрский набор', k:530, p:47, f:12, c:58},
  {name:'Вечерняк', k:830, p:58, f:16, c:113},
  {name:'Протеин, порция 30 г', k:120, p:24, f:2, c:3},
  {name:'Кола 0,5 л', k:212, p:0, f:0, c:53, bad:1},
  {name:'Энергетик 0,45 л', k:140, p:0, f:0, c:35, bad:1},
  {name:'Сэндвич карбонара', k:482, p:10, f:38, c:25, bad:1},
  {name:'Сэндвич с беконом', k:544, p:13, f:38, c:37, bad:1},
  {name:'Мега сыр', k:1050, p:55, f:75, c:39, bad:1}
];
/* Фастфуд: цифры примерные, по данным сетей и типичным порциям */
const FASTFOOD=[
  {name:'Шаурма большая ~700 г', k:1400, p:70, f:70, c:120, bad:1},
  {name:'Чизбургер', k:300, p:16, f:12, c:32},
  {name:'Двойной чизбургер', k:430, p:25, f:21, c:33},
  {name:'Картофель фри, средний', k:340, p:4, f:17, c:42, bad:1},
  {name:'Наггетсы, 6 шт', k:280, p:15, f:17, c:16},
  {name:'Наггетсы, 9 шт', k:420, p:23, f:26, c:24},
  {name:'Чикен Премьер', k:500, p:22, f:24, c:48, bad:1},
  {name:'Ролл (Ростикс)', k:580, p:25, f:28, c:55, bad:1},
  {name:'Стрипсы, 3 шт', k:290, p:21, f:15, c:18}
];
const getFavs=()=>store.get('planFav', null) || FAV_SEED.slice();
const setFavs=f=>store.set('planFav', f);

/* Расписание приёмов пищи для выбранного дня.
   Зависит от того, что это за день и когда тренировка: физра утром,
   силовая вечером (Пн 17:00, Ср 18:00) или днём (Сб 13:00), кардио или свободный */
const hmAdd=(t,m)=>{ const x=(hm2min(t)+m+1440)%1440; return pad2(Math.floor(x/60))+':'+pad2(x%60); };
function mealTiming(d){
  const w=buildWeek();
  const es=w.filter(x=>(x.dow===0?6:x.dow-1)===d && x.type!=='rest' && !(x.type==='gym' && isDropped(x.id)));
  const gym=es.find(x=>x.type==='gym'), run=es.find(x=>x.type==='run');
  const kind = gym ? ((gym.id==='d2'||gym.id==='d4') && !summerMode() && !(gym.day && gym.day.swap) ? 'pe' : 'gym')
             : run ? 'cardio' : 'rest';

  const T=nutritionTarget();
  const P=T.p;
  /* подъём — от первой пары или утренней тренировки этого дня (сон по дням, plan-extra) */
  const W=wakeAt(state.cycle,state.week,d).wake;
  /* доли белка по приёмам */
  const share = a => Math.round(P*a);

  /* суббота с баскетом: игра утром, Силовая Б вечером — два захода, еда между ними */
  const ball=es.find(x=>x.id==='d7'), b3=es.find(x=>x.id==='d3');
  if(ball){
    const bt=trainingTime(ball), t=b3?trainingTime(b3):null;
    return {kind:'gym', title: t ? `Скоростная и баскет в ${bt}, Силовая Б в ${t}` : `Скоростная и баскет в ${bt}`,
      warn:'Два захода за день: добавь ~250 ккал углеводами — порцию риса или банан сразу после игры.',
      rows: t ? [
        [W,'Подъём',''],
        [hmAdd(W,10),'Шейкер — до выхода', share(.23)],
        [bt,'Тренировка — скоростная и баскет',''],
        ['12:30','Контейнер 1 — сразу после игры', share(.26)],
        [hmAdd(t,-100),'Контейнер 2 — за 1.5 часа до зала', share(.23)],
        [t,'Тренировка',''],
        [hmAdd(t,105),'Сразу после зала — не тяни до дома', share(.26)],
        ['22:30','Молоко и сыр', share(.13)]
      ] : [
        [W,'Подъём',''],
        [hmAdd(W,10),'Шейкер — до выхода', share(.23)],
        [bt,'Тренировка — скоростная и баскет',''],
        ['12:30','Контейнер 1 — сразу после игры', share(.26)],
        ['15:30','Контейнер 2 и сырые овощи', share(.23)],
        ['20:00','Ужин', share(.26)],
        ['22:30','Молоко и сыр', share(.13)]
      ]};
  }

  if(kind==='pe') return {kind,
    title:'Физра в 9:50, скоростная сразу после',
    warn:'Ранний подъём. Завтрак обязателен: физра плюс спринты на пустом баке — это забитые ноги и медленный первый шаг.',
    rows:[
      [W,'Подъём',''],
      [hmAdd(W,10),'Шейкер — не лезет твёрдое, глотается за минуту', share(.23)],
      ['09:50','Физра',''],
      ['11:30','Быстрый перекус перед скоростной: банан, онигири', share(.05)],
      ['13:30','Контейнер 1', share(.26)],
      ['16:30','Контейнер 2 и сырые овощи', share(.23)],
      ['20:00','Ужин', share(.13)],
      ['22:30','Молоко и сыр', share(.13)]
    ]};

  if(kind==='gym'){
    /* контейнер — за полтора часа до зала, сразу после — не тянуть до дома */
    const t=trainingTime(gym)||'17:00', before=hmAdd(t,-100), after=hmAdd(t,105);
    const rows = hm2min(t)>=15*60 ? [
      [W,'Подъём',''],
      [hmAdd(W,15),'Шейкер', share(.23)],
      ['12:30','Контейнер 1', share(.26)],
      [before,'Контейнер 2 — за 1.5 часа до зала', share(.23)],
      [t,'Тренировка',''],
      [after,'Сразу после зала — не тяни до дома', share(.26)],
      ['22:30','Молоко и сыр', share(.13)]
    ] : [
      [W,'Подъём',''],
      [hmAdd(W,15),'Шейкер', share(.23)],
      ...(hm2min(before)>9*60+60 ? [[before,'Контейнер 1 — за 1.5 часа до зала', share(.26)]] : []),
      [t,'Тренировка',''],
      [after,'Сразу после зала — не тяни до дома', share(.26)],
      ['18:00','Контейнер 2 и сырые овощи', share(.23)],
      ['22:30','Молоко и сыр', share(.13)]
    ];
    return {kind, title:`${gym.day.title.split(' · ')[0]} в ${t}`, warn:'', rows};
  }

  return {kind,
    title: kind==='cardio' ? 'Кардио утром' : 'День без тренировки',
    warn:'',
    rows:[
      [W,'Подъём',''],
      [hmAdd(W,15),'Шейкер', share(.23)],
      ['12:30','Контейнер 1', share(.26)],
      ['15:30','Контейнер 2 и сырые овощи', share(.23)],
      ['20:00','Ужин', share(.26)],
      ['22:30','Молоко и сыр', share(.13)]
    ]};
}
const MEAL_NOTES=[
  'Белок раскидан на четыре приёма намеренно. Синтез мышечного белка запускается порцией и держится 3–4 часа, потом затухает: четыре средних приёма дают четыре всплеска, два больших — два. Калории при этом те же.',
  'Углеводы ставь вокруг тренировки, а не размазывай ровно. Вечерние углеводы не вредят — это миф, они скорее помогают засыпать.',
  'Вода: 2.5–3 литра в день плюс 500–700 мл за тренировку. Ты много потеешь, соли еду щедрее обычного.'
];

/* ---------- Контейнеры недели ----------
   Готовишь раз в неделю: что приготовил и сколько порций. Съеденная порция —
   это блюдо, отмеченное в дне, поэтому отдельный счётчик не нужен */
const cookKey=()=>`${state.cycle}-${state.week}`;
const cookList=()=>asArr(cook[cookKey()],[]);
function portionsEaten(dishId){
  let n=0;
  for(let d=0; d<7; d++){ const e=foodLog[`${state.cycle}-${state.week}-${d}`]; if(e && e.dishOn && e.dishOn[dishId]) n++; }
  return n;
}
const cookLeft=item=>Math.max(0, (item.n|0)-portionsEaten(item.m));
const dishById=id=>DISHES.find(d=>d.id===id);
function containerTotals(item){
  const a=dishTotals(dishById(item.m)), b=item.g && dishById(item.g) ? dishTotals(dishById(item.g)) : {k:0,p:0,f:0,c:0};
  return {k:a.k+b.k, p:a.p+b.p, f:a.f+b.f, c:a.c+b.c};
}
/* Съел блюдо (или порцию контейнера): в выбранный день, время — сейчас, если день сегодняшний */
function eatDish(ids){
  const now = foodDay===todayIdx() && isNowWeek() ? nowHM() : null;
  const added=[];
  ids.filter(Boolean).forEach(id=>{ if(!dishOn[id]){ dishOn[id]=true; added.push(id); if(now) mealTimes[id]=now; } });
  saveFood();
  return added;
}
function uneatDish(ids){ ids.forEach(id=>{ dishOn[id]=false; delete mealTimes[id]; }); saveFood(); }

/* ---------- Как обычно в это время ----------
   Что ты чаще всего записывал в ±2 часа от сейчас за последние две недели.
   Мало истории — добирается избранным */
function usualNow(limit){
  limit=limit||4;
  const now=hm2min(nowHM()), today=isoDay(), cnt={};
  const add=(key, item)=>{ cnt[key]=cnt[key]||{n:0, item}; cnt[key].n++; };
  for(const k in foodLog){
    const [c,w,d]=k.split('-').map(Number); if(!c||!w) continue;
    const date=dateOfCW(c,w,d); if(date>=today || daysBetween(date,today)>14) continue;
    const e=foodLog[k];
    Object.entries(e.times||{}).forEach(([id,t])=>{
      if(e.dishOn && e.dishOn[id] && dishById(id) && Math.abs(hm2min(t)-now)<=120) add('d:'+id, {kind:'dish', id});
    });
    (e.custom||[]).forEach(x=>{ if(x.t && Math.abs(hm2min(x.t)-now)<=120) add('c:'+x.name, {kind:'custom', x:{name:x.name,k:x.k,p:x.p,f:x.f,c:x.c}}); });
  }
  const out=Object.values(cnt).sort((a,b)=>b.n-a.n).map(v=>v.item).filter(it=>!(it.kind==='dish' && dishOn[it.id]));
  getFavs().forEach(f=>{ if(out.length<limit && !out.some(o=>o.kind==='custom' && o.x.name===f.name)) out.push({kind:'custom', x:f, fav:true}); });
  return out.slice(0,limit);
}

/* Блоки еды: так они идут в списке и так собирается день */
const DISH_GROUPS=[
  ['breakfast','Завтрак',''],
  ['meat','Мясо и соусы','Основа приёма. Готовится отдельно от гарнира — сочетай с любым. На день обычно два разных.'],
  ['carb','Гарниры','Варятся без соуса, хранятся 4 дня. Граммы — сухой вес, калории считаются по нему.'],
  ['veg','Овощи',''],
  ['snack','Перекус и добор','']
];
const catOf = d => d.cat==='extra' ? 'snack' : d.cat;
/* С чем мясо сочетается лучше всего */
const PAIR={chicken:['g_rice','g_buck'], bolo:['g_pasta'], mince:['g_pasta','g_buck'], curry:['g_rice','g_potato'], fish:['g_buck','g_potato'],
  teriyaki:['g_rice','g_noodles'], goulash:['g_buck','g_potato'], meatballs:['g_pasta','g_rice'], chili:['g_rice','g_lavash'],
  tandoori:['g_bulgur','g_rice'], mushchick:['g_buck','g_potato'], shrimp:['g_noodles','g_rice'], turkeycut:['g_buck','g_potato','g_bulgur','g_beans']};
const pickOne = a => a[Math.floor(Math.random()*a.length)];

/* Группы продуктов для подгонки.
   Белок держим у цели, калораж добираем крупами, овощи и масло не трогаем —
   так настройка и делается в жизни, иначе жиры улетают вслед за калориями. */
const G_PROT=['thigh','mince','fish','egg','whey','cheese','milk','breast','beef','mince_b','tmince','tuna','shrimp','yogurt'];
const G_CARB=['rice','pasta','buck','oats','potato','bread','banana','honey','bulgur','noodles','lavash','beans'];
const G_FAT =['oil','cheese','sour','pb'];   /* то, что можно срезать, не ломая блюдо */

function scaleGroup(list, r){
  r=Math.max(0.5, Math.min(2.5, r));
  DISHES.forEach(d=>{
    if(!dishOn[d.id]) return;
    d.ing.forEach(([fid,base])=>{
      if(!list.includes(fid)) return;
      const cur=gramOf(d.id,fid,base);
      grams[`${d.id}-${fid}`]=Math.max(5, Math.round(cur*r/5)*5);
    });
  });
}

/* Сумма только по одной группе продуктов */
function groupTotals(list){
  let k=0,p=0,f=0;
  DISHES.forEach(d=>{
    if(!dishOn[d.id]) return;
    d.ing.forEach(([fid,base])=>{
      if(!list.includes(fid)) return;
      const g=gramOf(d.id,fid,base)/100, F=FOOD[fid];
      k+=F.k*g; p+=F.p*g; f+=F.f*g;
    });
  });
  return {k,p,f};
}

/* Трёхступенчатая подгонка под цели недели.
   Порядок важен: белок фиксируем первым, он не обсуждается;
   потом срезаем лишний жир; калораж добираем крупами в самом конце. */
function fitToTarget(){
  const T0=nutritionTarget();
  /* ручную еду не масштабируем — вычитаем её из цели и подгоняем остальное */
  let ck=0,cp=0,cf=0;
  custom.forEach(x=>{ ck+=x.k; cp+=x.p; cf+=x.f; });
  const T={k:Math.max(600,T0.k-ck), p:Math.max(40,T0.p-cp), f:Math.max(20,T0.f-cf)};

  /* Суммы только по блюдам — ручная еда уже вычтена из цели выше */
  const only=()=>{
    let k=0,p=0,f=0;
    DISHES.forEach(d=>{ if(!dishOn[d.id]) return; const t=dishTotals(d); k+=t.k;p+=t.p;f+=t.f; });
    return {k,p,f};
  };

  /* 1. Белок к цели */
  for(let i=0;i<3;i++){
    const P=only().p;
    if(!P || Math.abs(P-T.p)<=6) break;
    scaleGroup(G_PROT, T.p/P);
  }

  /* 2. Жир сильно выше цели — срезаем масло и сыр */
  for(let i=0;i<2;i++){
    const F=only().f;
    if(F <= T.f+12) break;
    const fg=groupTotals(G_FAT).f;
    if(fg < 10) break;
    const cut=Math.min(F-T.f, fg*0.6);
    scaleGroup(G_FAT, (fg-cut)/fg);
  }

  /* 3. Калораж добираем крупами */
  for(let i=0;i<4;i++){
    const K=only().k;
    if(!K || Math.abs(K-T.k)<=40) break;
    const carbK=groupTotals(G_CARB).k;
    if(carbK < 50) break;
    scaleGroup(G_CARB, (T.k-(K-carbK))/carbK);
  }
}

/* Случайно собирает день: завтрак, два разных мяса с подходящими
   гарнирами, овощи и перекус. Потом подгоняет порции. */
function assembleDay(){
  const by = c => DISHES.filter(d=>d.cat===c).map(d=>d.id);
  const chosen=new Set();

  chosen.add(pickOne(by('breakfast')));

  /* два разных мяса, к каждому — подходящий гарнир */
  const meats=by('meat');
  for(let i=0; i<2 && meats.length; i++){
    const id=pickOne(meats);
    chosen.add(id);
    chosen.add(pickOne(PAIR[id] || by('carb')));
    meats.splice(meats.indexOf(id),1);
  }

  chosen.add(pickOne(by('veg')));
  chosen.add('night');   /* остальные перекусы — вручную, когда нужно добрать */

  DISHES.forEach(d=>{ dishOn[d.id]=chosen.has(d.id); });
  Object.keys(grams).forEach(k=>delete grams[k]);
  fitToTarget();
  saveFood();
  renderAll();
}

/* Итоги дня по записи в дневнике — нужно для недельной сводки */
function totalsOfDay(d){
  const e=foodLog[`${state.cycle}-${state.week}-${d}`];
  if(!e) return null;
  let k=0,p=0,f=0,c=0;
  DISHES.forEach(dish=>{
    if(!e.dishOn || !e.dishOn[dish.id]) return;
    dish.ing.forEach(([fid,base])=>{
      const key=`${dish.id}-${fid}`;
      const g=(e.grams && e.grams[key]!=null) ? e.grams[key] : Math.round(base*portionFactor()/5)*5;
      const F=FOOD[fid];
      k+=F.k*g/100; p+=F.p*g/100; f+=F.f*g/100; c+=F.c*g/100;
    });
  });
  (e.custom||[]).forEach(x=>{ k+=x.k; p+=x.p; f+=x.f; c+=x.c; });
  return {k:Math.round(k), p:Math.round(p), f:Math.round(f), c:Math.round(c)};
}

/* Сводка за неделю: где перебор, где недобор, и что с этим делать.
   Дни ±150 от цели — норма, среднее ±100 — попадание. Меньше двух
   заполненных дней — сравнивать нечего */
function weekFoodStats(){
  const T=nutritionTarget(), rows=[], filled=[];
  for(let d=0; d<7; d++){
    const on=dayFilled(d), t=on ? totalsOfDay(d) : null;
    const diff=t ? t.k-T.k : null;
    rows.push({d, on, t, diff, cls: !t ? 'empty' : Math.abs(diff)<=150 ? 'ok' : (diff>0 ? 'over' : 'under')});
    if(on && t) filled.push({d, k:t.k, diff});
  }
  if(filled.length<2) return {T, rows, filled, enough:false};
  const avg=Math.round(filled.reduce((a,x)=>a+x.k,0)/filled.length), avgDiff=avg-T.k;
  const over=filled.filter(x=>x.diff>150), under=filled.filter(x=>x.diff<-150);
  let verdict;
  if(Math.abs(avgDiff)<=100) verdict={lvl:'ok', b:`Среднее ${avg} ккал при цели ${T.k} — попадание.`, x:'Отдельные дни могут гулять — организм считает неделями, а не сутками.'};
  else if(avgDiff>0) verdict={lvl:'over', b:`Среднее ${avg} ккал — на ${avgDiff} выше цели.`, x: state.cycle===1 ? 'Сейчас сушка, так что перебор съедает дефицит: талия стоит — ищи, откуда эти калории.' : 'При наборе массы это не катастрофа, но если талия перестала уходить — стоит подровнять.'};
  else verdict={lvl:'under', b:`Среднее ${avg} ккал — на ${-avgDiff} ниже цели.`, x: state.cycle===1 ? 'На сушке недобор больше 300 ккал бьёт по силе и сну: добери белком, а не сладким.' : 'Вот из-за этого вес и уезжает вниз. Добирать проще всего вторым шейкером — он не занимает объём.'};
  const notes=[];
  if(over.length){
    notes.push(`Перебор: ${over.map(x=>DOW_IDX[x.d]).join(', ')}.`);
    const weekend=over.filter(x=>x.d>=5).length;
    if(weekend && weekend>=over.length/2) notes.push('Перебор приходится на выходные — самый частый вариант. В будни день расписан парами, а в выходные еда перестаёт быть по расписанию, и вечер собирает всё, что не съел днём.');
  }
  if(under.length) notes.push(`Недобор: ${under.map(x=>DOW_IDX[x.d]).join(', ')}. Почти всегда это дни, где выпал завтрак или обед.`);
  return {T, rows, filled, enough:true, avg, avgDiff, over, under, verdict, notes, advice: over.length>0};
}
/* Как не улетать в перебор — показывается, когда на неделе есть перебор */
const OVER_ADVICE=[
  ['Это не про силу воли.','Перебор вечером почти всегда означает, что днём было мало. Тело добирает своё, и добирает единственным доступным способом — за один заход. Чинить надо день, а не вечер.'],
  ['Не пропускай первые два приёма.','Если утром и днём съедено по плану, вечером физически не влезет столько же, сколько влезает после голодного дня.'],
  ['Пей до и после, а не во время.','Литр чая вместе с ужином занимает тот же объём, что и еда — отсюда и тяжесть, и ощущение «аж плохо».'],
  ['Ешь медленнее.','Сигнал насыщения приходит с задержкой минут в двадцать. За это время после голодного дня съедается заметно больше нужного.'],
  ['Выходные держи по тому же расписанию.','Не строже, а просто по времени: тот же шейкер утром, тот же контейнер днём.'],
  ['И главное:','один день с перебором ничего не портит — считается неделя. Наедаться до состояния «плохо» не стоит не потому, что это много калорий, а потому что так хуже усваивается и портится сон.']
];

/* ############################################################
   ОТЧЁТ ЗА НЕДЕЛЮ
   Собирает всё в один текст: питание по дням, тренировки,
   ежедневный блок, сдвиг прогрессии. Копируешь и присылаешь.
   ############################################################ */

const pad = (t,n) => String(t).padEnd(n,' ');
const lpad = (t,n) => String(t).padStart(n,' ');

function buildReport(){
  const T=nutritionTarget(), info=weekInfo(), week=buildWeek();
  const L=[];

  L.push(`ОТЧЁТ ЗА НЕДЕЛЮ`);
  L.push(isSession() ? `Цикл 1 · ${info.label}`
    : (state.cycle===3 && state.week>24) ? `Цикл 3, повтор последнего блока, неделя ${(state.week-25)%6+1} из 6 · ${weekKind(3,state.week)==='deload'?'разгрузочная':'рабочая'}`
    : `Цикл ${state.cycle}, неделя ${state.week} из ${state.cycle===1?12:maxWeek(state.cycle)} · ${info.label}`);
  if(info.shift) L.push(`Прогрессия сдвинута на ${info.shift} нед. из-за пропусков`);
  L.push('');

  /* --- ПИТАНИЕ --- */
  L.push(`ПИТАНИЕ · цель ${T.k} ккал, Б${T.p} Ж${T.f} У${T.c}`);
  let sk=0,sp=0,sf=0,sc=0,n=0;
  for(let d=0; d<7; d++){
    const t=dayFilled(d) ? totalsOfDay(d) : null;
    if(!t){ L.push(`${pad(DOW_IDX[d],3)} —`); continue; }
    sk+=t.k; sp+=t.p; sf+=t.f; sc+=t.c; n++;
    const diff=t.k-T.k;
    L.push(`${pad(DOW_IDX[d],3)} ${lpad(t.k,5)} ккал  Б${lpad(t.p,3)} Ж${lpad(t.f,3)} У${lpad(t.c,3)}  ${diff>0?'+':''}${diff}`);
  }
  if(n){
    const a=x=>Math.round(x/n);
    L.push('');
    L.push(`Среднее за ${n} дн.: ${a(sk)} ккал, Б${a(sp)} Ж${a(sf)} У${a(sc)}`);
    L.push(`Отклонение: ккал ${a(sk)-T.k>0?'+':''}${a(sk)-T.k}, белок ${a(sp)-T.p>0?'+':''}${a(sp)-T.p}, жир ${a(sf)-T.f>0?'+':''}${a(sf)-T.f}`);
  } else {
    L.push('Дни не заполнены.');
  }

  /* --- ЧТО ЕЛ ВРУЧНУЮ --- */
  const extras=[];
  for(let d=0; d<7; d++){
    const e=foodLog[`${state.cycle}-${state.week}-${d}`];
    if(e && e.custom) e.custom.forEach(x=>extras.push(`${DOW_IDX[d]} ${x.name} — ${x.k} ккал, Б${x.p} Ж${x.f} У${x.c}`));
  }
  if(extras.length){
    L.push('');
    L.push('ДОБАВЛЕНО ВРУЧНУЮ');
    extras.forEach(x=>L.push('  '+x));
  }

  /* --- ТРЕНИРОВКИ --- */
  L.push('');
  L.push('ТРЕНИРОВКИ');
  week.forEach(e=>{
    const dow = e.dow===0 ? 6 : e.dow-1;
    if(e.type==='rest'){ L.push(`${pad(DOW_IDX[dow],3)} ${e.title}`); return; }
    if(isDropped(e.id)){ L.push(`${pad(DOW_IDX[dow],3)} ${e.type==='gym'?e.day.title:e.title} — ОТМЕНЕНО`); return; }
    if(e.type==='run'){
      const done=!!marks[key(e.id,e.ex)];
      L.push(`${pad(DOW_IDX[dow],3)} ${e.title} ${e.dur} — ${done?'сделано':'не отмечено'} · мяч ${marks[key(e.id,'ball')]?'да':'нет'}`);
      return;
    }
    const total=e.day.ex.length;
    const done=e.day.ex.filter(x=>marks[key(e.id,x.id)]).length;
    const mv=e.moveNote ? ' (перенесена)' : '';
    L.push(`${pad(DOW_IDX[dow],3)} ${e.day.title}${mv} — ${done}/${total} упражнений`);
    if(noPE() && e.id==='d2') L.push('     (физры не было, домашняя замена)');
  });

  /* --- ЕЖЕДНЕВНЫЙ БЛОК --- */
  const need=[], got=[];
  for(let i=0;i<7;i++){
    need.push(DOW_IDX[i]);
    if(marks[`${state.cycle}-${state.week}-daily-${i}`]) got.push(DOW_IDX[i]);
  }
  L.push('');
  L.push(`ЕЖЕДНЕВНЫЙ БЛОК: ${got.length} из ${need.length}${got.length?' ('+got.join(', ')+')':''}`);
  if(got.length<need.length){
    const miss=need.filter(x=>!got.includes(x));
    L.push(`Пропущено: ${miss.join(', ')}`);
  }

  /* --- РАБОЧИЕ ВЕСА --- */
  const lw=Object.keys(logs).filter(k=>k.startsWith(`${state.cycle}-${state.week}-`) && hasData(logs[k]));
  if(lw.length){
    L.push('');
    L.push('РАБОЧИЕ ВЕСА');
    lw.forEach(k=>{
      const x=logs[k], sets=x.sets.filter(y=>num(y.r)!=null).map(y=>(num(y.w)?`${fmtW(num(y.w))}×`:'')+y.r).join(', ');
      L.push(`  ${x.n}: ${sets}${x.rpe?` · тяжесть ${x.rpe}`:''}`);
    });
  }

  /* --- ЗАМЕРЫ --- */
  const t=isoDay(), a7=avgWin(t,7), a14=avgWin(addDays(t,-7),7);
  const ks=kneeStatus();
  const wk=Object.keys(body).filter(d=>daysBetween(d,t)<7).sort();
  const hrs=wk.map(d=>num(body[d].hr)).filter(v=>v!=null);
  if(a7 || ks || hrs.length){
    L.push('');
    L.push('ЗАМЕРЫ');
    if(a7) L.push(`  Вес, среднее за 7 дней: ${fmt1(a7.v)} кг (${a7.n} взвеш.)${a14?`, неделю назад ${fmt1(a14.v)}`:''}`);
    if(hrs.length) L.push(`  Пульс утром: ${hrs.join(', ')}`);
    if(ks) L.push(`  Колено: ${ks.v}/10 (${ks.lvl==='g'?'зелёный':ks.lvl==='y'?'жёлтый':'красный'})`);
    const ct=circ.filter(c=>daysBetween(c.d,t)<7);
    ct.forEach(c=>L.push(`  Обхваты ${shortDate(c.d)}: талия ${c.a??'—'} / ${c.b??'—'}, бедро ${c.h??'—'}`));
  }
  const tw=tests.filter(x=>daysBetween(x.d,t)<7);
  if(tw.length){
    L.push('');
    L.push('ТЕСТЫ');
    tw.forEach(x=>L.push(`  ${TESTS[x.t]?TESTS[x.t].n:x.t}: ${String(x.v).replace('.',',')} ${TESTS[x.t]?TESTS[x.t].u:''}`));
  }

  L.push('');
  L.push('---');
  L.push('Что скорректировать на следующую неделю?');
  return L.join('\n');
}

