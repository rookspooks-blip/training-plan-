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
/* Частая еда в один тап. Цифры — из его же дневника (sport.md, неделя 1) */
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
let favEdit=false;
const getFavs=()=>store.get('planFav', null) || FAV_SEED.slice();
const setFavs=f=>store.set('planFav', f);

function renderCustom(){
  const box=document.getElementById('customBox');
  const rows = custom.length
    ? custom.map((x,i)=>`<div class="cust-row">
        <div class="cust-main">
          <div class="cust-name">${esc(x.name)}</div>
          <div class="cust-mac">${x.k} ккал · Б ${x.p} · Ж ${x.f} · У ${x.c}</div>
          <input type="time" class="tinp cust-t" data-i="${i}" value="${esc(x.t)}" aria-label="Время приёма">
        </div>
        <button class="cust-fav" type="button" data-i="${i}" aria-label="В избранное">☆</button>
        <button class="cust-del" type="button" data-i="${i}" aria-label="Удалить">×</button>
      </div>`).join('')
    : `<p style="font-size:14px;color:var(--muted);margin:0">Пока пусто. Сюда добавляй всё, что съел не из списка — столовую, перекус, что-то дома.</p>`;

  const favs=getFavs();
  box.innerHTML=`
    <h3>Съел ещё</h3>
    <div class="favhead"><span>Быстро добавить</span><button type="button" id="favEdit">${favEdit?'Готово':'Изменить'}</button></div>
    <div class="favs">${favs.map((x,i)=>`<button type="button" class="fav${x.bad?' bad':''}" data-i="${i}">${favEdit?'<span class="x">×</span>':''}${esc(x.name)} <small>${esc(x.k)}</small></button>`).join('')}</div>
    <div class="favhead"><span>Фастфуд · цифры примерные</span></div>
    <div class="favs">${FASTFOOD.map((x,i)=>`<button type="button" class="fav ff${x.bad?' bad':''}" data-i="${i}">${x.name} <small>${x.k}</small></button>`).join('')}</div>
    <p style="font-size:12px;color:var(--muted);margin:-6px 0 14px">На сушке лучший выбор — двойной чизбургер и стрипсы: больше всего белка на калорию. Шаурма 700 г — больше половины дневной нормы: бери половину или без лишнего соуса, в этот день остальное — мясо и овощи. Фри и газировку заменяй на второй бургер или наггетсы.</p>
    ${favs.some(x=>x.bad)&&!favEdit?`<p style="font-size:12px;color:var(--muted);margin:-6px 0 14px">Оранжевая рамка — то, что план советует заменить: много жира или сахара и мало белка.</p>`:''}
    ${rows}
    <div class="cust-form">
      <input class="wide" id="cuName" type="text" placeholder="Что это было">
      <input id="cuK" type="number" inputmode="numeric" placeholder="ккал">
      <input id="cuP" type="number" inputmode="numeric" placeholder="белки, г">
      <input id="cuF" type="number" inputmode="numeric" placeholder="жиры, г">
      <input id="cuC" type="number" inputmode="numeric" placeholder="углеводы, г">
    </div>
    <div class="btn-row"><button class="btn" type="button" id="cuAdd">Добавить в день</button></div>
    <p style="font-size:12.5px;color:var(--muted);margin:12px 0 0">
      Если знаешь только калории — впиши их, остальное оставь пустым. Сумма всё равно обновится.
    </p>`;

  box.querySelectorAll('.cust-del').forEach(b=>{
    b.addEventListener('click',()=>{
      custom.splice(+b.dataset.i,1);
      saveFood(); renderCustom(); renderSummary(); renderWeekStats(); renderFoodDays();
    });
  });

  box.querySelector('#favEdit').addEventListener('click',()=>{ favEdit=!favEdit; renderCustom(); });
  box.querySelectorAll('.cust-t').forEach(inp=>inp.addEventListener('change',()=>{
    const x=custom[+inp.dataset.i]; if(!x) return;
    if(inp.value) x.t=inp.value; else delete x.t;
    saveFood();
  }));
  box.querySelectorAll('.fav.ff').forEach(b=>b.addEventListener('click',()=>{
    const x=FASTFOOD[+b.dataset.i];
    custom.push({name:x.name, k:x.k, p:x.p, f:x.f, c:x.c, t:nowHM()});
    saveFood(); renderCustom(); renderSummary(); renderWeekStats(); renderFoodDays();
    toast(`${x.name} — добавлено, ${nowHM()}`);
  }));
  box.querySelectorAll('.fav:not(.ff)').forEach(b=>b.addEventListener('click',()=>{
    const f=getFavs(), x=f[+b.dataset.i];
    if(favEdit){ f.splice(+b.dataset.i,1); setFavs(f); renderCustom(); return; }
    custom.push({name:x.name, k:x.k, p:x.p, f:x.f, c:x.c, t:nowHM()});
    saveFood(); renderCustom(); renderSummary(); renderWeekStats(); renderFoodDays();
    toast(`${x.name} — добавлено, ${nowHM()}`);
  }));
  box.querySelectorAll('.cust-fav').forEach(b=>b.addEventListener('click',()=>{
    const x=custom[+b.dataset.i], f=getFavs();
    if(f.some(y=>y.name===x.name)){ toast('Уже в избранном'); return; }
    f.unshift({name:x.name, k:x.k, p:x.p, f:x.f, c:x.c}); setFavs(f); renderCustom(); toast('Добавлено в избранное');
  }));

  box.querySelector('#cuAdd').addEventListener('click',()=>{
    const name=box.querySelector('#cuName').value.trim();
    const num=id=>Math.max(0, Math.round(+box.querySelector(id).value||0));
    const k=num('#cuK');
    if(!name && !k) return;
    custom.push({name:name||'Без названия', k, p:num('#cuP'), f:num('#cuF'), c:num('#cuC'), t:nowHM()});
    saveFood(); renderCustom(); renderSummary(); renderWeekStats(); renderFoodDays();
  });
}

/* Расписание приёмов пищи для выбранного дня.
   Зависит от того, что это за день: силовая вечером,
   физра утром или свободный. */
function mealTiming(d){
  const w=buildWeek();
  const e=w.find(x=>(x.dow===0?6:x.dow-1)===d);
  const kind = !e ? 'rest'
             : e.type==='gym' ? (e.id==='d2' ? 'pe' : 'gym')
             : e.type==='run' ? 'cardio' : 'rest';

  const T=nutritionTarget();
  const P=T.p;

  /* доли белка по приёмам */
  const share = a => Math.round(P*a);

  if(kind==='pe') return {
    title:'Физра в 9:50, скоростная сразу после',
    warn:'Ранний подъём. Завтрак обязателен: физра плюс спринты на пустом баке — это забитые ноги и медленный первый шаг.',
    rows:[
      ['07:30','Подъём',''],
      ['07:45','Шейкер — не лезет твёрдое, глотается за минуту', share(.23)],
      ['09:50','Физра',''],
      ['11:30','Быстрый перекус перед скоростной: банан, онигири', share(.05)],
      ['13:30','Контейнер 1', share(.26)],
      ['16:30','Контейнер 2 и сырые овощи', share(.23)],
      ['20:00','Ужин', share(.13)],
      ['22:30','Молоко и сыр', share(.13)]
    ]};

  if(kind==='gym') return {
    title:'Силовая ' + (e && e.dow>=6||e&&e.dow===0 ? 'днём' : 'в 17:00'),
    warn:'',
    rows:[
      ['08:45','Подъём',''],
      ['09:00','Шейкер', share(.23)],
      ['12:30','Контейнер 1', share(.26)],
      ['15:20','Контейнер 2 — за 1.5 часа до зала', share(.23)],
      ['17:00','Тренировка',''],
      ['18:45','Сразу после зала — не тяни до дома', share(.26)],
      ['22:30','Молоко и сыр', share(.13)]
    ]};

  return {
    title: kind==='cardio' ? 'Кардио утром' : 'День без тренировки',
    warn:'',
    rows:[
      ['08:45','Подъём',''],
      ['09:00','Шейкер', share(.23)],
      ['12:30','Контейнер 1', share(.26)],
      ['15:30','Контейнер 2 и сырые овощи', share(.23)],
      ['20:00','Ужин', share(.26)],
      ['22:30','Молоко и сыр', share(.13)]
    ]};
}

function renderTiming(){
  const box=document.getElementById('mealTiming');
  if(!box) return;
  const bind=()=>{ const sub=box.querySelector('.sub'); if(sub) bindFold(sub.querySelector('.sub-head'), sub); };
  setTimeout(bind,0);
  const t=mealTiming(foodDay);
  box.innerHTML=`<div class="card">
    <div class="sub" style="margin:0;background:transparent;border:0">
      <div class="sub-head" tabindex="0" role="button" aria-expanded="false" style="padding:0 0 10px">
        <span>Когда есть · ${DOW_FULL[foodDay===6?0:foodDay+1]}<br>
          <span style="font-size:12.5px;color:var(--muted);font-weight:500">${t.title}</span></span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="fold"><div class="fold-inner"><div>
    ${t.warn?`<div class="warnbox">${t.warn}</div>`:''}
    <table>
      <tr><th>Время</th><th>Что</th><th>Белок</th></tr>
      ${t.rows.map(r=>`<tr><td class="tnum">${r[0]}</td><td>${r[1]}</td><td class="tnum">${r[2]?r[2]+' г':''}</td></tr>`).join('')}
    </table>
    <p style="margin-top:12px">Белок раскидан на четыре приёма намеренно. Синтез мышечного белка запускается порцией и держится 3–4 часа, потом затухает: четыре средних приёма дают четыре всплеска, два больших — два. Калории при этом те же.</p>
    <p>Углеводы ставь вокруг тренировки, а не размазывай ровно. Вечерние углеводы не вредят — это миф, они скорее помогают засыпать.</p>
    <p>Вода: 2.5–3 литра в день плюс 500–700 мл за тренировку. Ты много потеешь, соли еду щедрее обычного.</p>
    </div></div></div></div>
  </div>`;
}

/* Сводка за день. Рисуется отдельно от списка блюд, чтобы можно
   было обновлять цифры, не пересоздавая карточки и не закрывая их. */
function renderSummary(){
  const T=nutritionTarget(), D=dayTotals();
  const delta=D.k-T.k;
  const cls=Math.abs(delta)<=120?'ok':(delta<0?'under':'over');
  const txt=Math.abs(delta)<=120?'В цель':(delta<0?`Не хватает ${-delta} ккал`:`Перебор ${delta} ккал`);
  const pct=(a,b)=>Math.min(100, b? a/b*100 : 0);

  document.getElementById('macroSummary').innerHTML=`
    <div class="macro-summary">
      <div class="kcal-row"><div class="kcal-big num">${D.k}</div><div class="kcal-goal">цель ${T.k} ккал</div></div>
      <div class="bar"><i style="width:${pct(D.k,T.k)}%"></i></div>
      <div class="kcal-delta ${cls}">${txt}</div>
      <div class="mgrid">
        <div class="mcell m-prot"><div class="mtop"><span class="mname">Белки</span><span class="mval num">${D.p}/${T.p}</span></div><div class="mbar"><i style="width:${pct(D.p,T.p)}%"></i></div></div>
        <div class="mcell m-fat"><div class="mtop"><span class="mname">Жиры</span><span class="mval num">${D.f}/${T.f}</span></div><div class="mbar"><i style="width:${pct(D.f,T.f)}%"></i></div></div>
        <div class="mcell m-carb"><div class="mtop"><span class="mname">Углеводы</span><span class="mval num">${D.c}/${T.c}</span></div><div class="mbar"><i style="width:${pct(D.c,T.c)}%"></i></div></div>
      </div>
    </div>`;
}

/* Обновляет цифры внутри одной карточки блюда на месте.
   Ничего не пересоздаёт, поэтому раскрытый аккордеон остаётся раскрытым. */
function refreshDish(card, d){
  const t=dishTotals(d);
  const m=card.querySelector('.dish-macros');
  m.querySelector('.k').textContent=`${t.k} ккал`;
  m.querySelector('.p').textContent=`Б ${t.p}`;
  m.querySelector('.f').textContent=`Ж ${t.f}`;
  m.querySelector('.c').textContent=`У ${t.c}`;

  card.querySelectorAll('.ing').forEach(row=>{
    const fid=row.dataset.food, base=+row.dataset.base;
    const F=FOOD[fid], g=gramOf(d.id,fid,base);
    row.querySelector('input').value=g;
    row.querySelector('.ing-kcal').textContent=`${Math.round(F.k*g/100)} ккал · Б ${(F.p*g/100).toFixed(1)}`;
  });
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
const dishOpen={};   /* какие блоки развёрнуты целиком */
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
  renderNutrition();
}

/* Полоса выбора дня. Точка сверху — сегодня, зелёная снизу — день заполнен. */
function renderFoodDays(){
  const box=document.getElementById('foodDays');
  const td=todayIdx();
  box.innerHTML=DOW_IDX.map((d,i)=>
    `<button class="fday${i===foodDay?' on':''}${i===td?' today':''}${dayFilled(i)?' filled':''}" type="button" data-d="${i}">
       ${d}<span class="dot"></span></button>`).join('');
  box.querySelectorAll('.fday').forEach(b=>{
    b.addEventListener('click',()=>{
      foodDay=+b.dataset.d;
      loadFoodDay();
      renderNutrition();
    });
  });
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

/* Сводка за неделю: где перебор, где недобор, и что с этим делать */
function renderWeekStats(){
  const box=document.getElementById('weekStats');
  const T=nutritionTarget();
  const rows=[], filled=[];

  for(let d=0; d<7; d++){
    const on=dayFilled(d);
    const t=on ? totalsOfDay(d) : null;
    rows.push({d, on, t});
    if(on && t) filled.push({d, k:t.k, diff:t.k-T.k});
  }

  if(filled.length < 2){
    box.innerHTML=`<div class="wstat"><h3>Сводка за неделю</h3>
      <p style="font-size:14px;color:var(--muted);margin:0">Отметь хотя бы два дня, и здесь появится картина по неделе: в какие дни перебор, в какие недобор и что с этим делать.</p></div>`;
    return;
  }

  const scale = T.k*0.6;                       /* ширина полосы = ±60% цели */
  const bars = rows.map(r=>{
    if(!r.on) return `<div class="wsrow empty"><span class="wsd">${DOW_IDX[r.d]}</span>
      <span class="wsbar"><span class="mid" style="left:50%"></span></span><span class="wsv">—</span></div>`;
    const diff=r.t.k-T.k;
    const cls = Math.abs(diff)<=150 ? 'ok' : (diff>0 ? 'over' : 'under');
    const w = Math.min(50, Math.abs(diff)/scale*100);
    const style = diff>=0
      ? `left:50%;width:${w}%;background:${cls==='ok'?'var(--carb)':'var(--warn)'}`
      : `right:50%;width:${w}%;background:${cls==='ok'?'var(--carb)':'var(--cardc)'}`;
    return `<div class="wsrow ${cls}"><span class="wsd">${DOW_IDX[r.d]}</span>
      <span class="wsbar"><span class="mid" style="left:50%"></span><i style="${style}"></i></span>
      <span class="wsv">${diff>0?'+':''}${diff}</span></div>`;
  }).join('');

  const avg=Math.round(filled.reduce((a,x)=>a+x.k,0)/filled.length);
  const over=filled.filter(x=>x.diff>150);
  const under=filled.filter(x=>x.diff<-150);
  const avgDiff=avg-T.k;

  let verdict;
  if(Math.abs(avgDiff)<=100){
    verdict=`<p><b>Среднее за неделю ${avg} ккал при цели ${T.k}.</b> Это попадание. Отдельные дни могут гулять — организм считает неделями, а не сутками.</p>`;
  } else if(avgDiff>0){
    verdict=`<p><b>Среднее за неделю ${avg} ккал, это на ${avgDiff} выше цели.</b> ${state.cycle===1 ? 'Сейчас сушка, так что перебор съедает дефицит: талия стоит — ищи, откуда эти калории.' : 'При наборе массы это не катастрофа, но если талия перестала уходить — стоит подровнять.'}</p>`;
  } else {
    verdict=`<p><b>Среднее за неделю ${avg} ккал, это на ${-avgDiff} ниже цели.</b> ${state.cycle===1 ? 'На сушке недобор больше 300 ккал бьёт по силе и сну: добери белком, а не сладким.' : 'Вот из-за этого вес и уезжает вниз. Добирать проще всего вторым шейкером — он не занимает объём.'}</p>`;
  }

  let pattern='';
  if(over.length){
    const names=over.map(x=>DOW_IDX[x.d]).join(', ');
    const weekend=over.filter(x=>x.d>=5).length;
    pattern += `<p><b>Перебор:</b> ${names}.</p>`;
    if(weekend && weekend>=over.length/2){
      pattern += `<p>Перебор приходится на выходные — самый частый вариант. В будни день расписан парами, а в выходные еда перестаёт быть по расписанию, и вечер собирает всё, что не съел днём.</p>`;
    }
  }
  if(under.length){
    pattern += `<p><b>Недобор:</b> ${under.map(x=>DOW_IDX[x.d]).join(', ')}. Почти всегда это дни, где выпал завтрак или обед.</p>`;
  }

  const hasOver = over.length>0;
  const advice = hasOver ? `
    <div class="card" style="margin:14px 0 0;background:var(--surface2)">
      <h3>Как не улетать в перебор</h3>
      <p><b>Это не про силу воли.</b> Перебор вечером почти всегда означает, что днём было мало. Тело добирает своё, и добирает единственным доступным способом — за один заход. Чинить надо день, а не вечер.</p>
      <p><b>Не пропускай первые два приёма.</b> Если утром и днём съедено по плану, вечером физически не влезет столько же, сколько влезает после голодного дня.</p>
      <p><b>Пей до и после, а не во время.</b> Литр чая вместе с ужином занимает тот же объём, что и еда — отсюда и тяжесть, и ощущение «аж плохо».</p>
      <p><b>Ешь медленнее.</b> Сигнал насыщения приходит с задержкой минут в двадцать. За это время после голодного дня съедается заметно больше нужного.</p>
      <p><b>Выходные держи по тому же расписанию.</b> Не строже, а просто по времени: тот же шейкер утром, тот же контейнер днём.</p>
      <p>И главное: один день с перебором ничего не портит — считается неделя. Наедаться до состояния «плохо» не стоит не потому, что это много калорий, а потому что так хуже усваивается и портится сон.</p>
    </div>` : '';

  box.innerHTML=`<div class="wstat"><h3>Сводка за неделю · заполнено ${filled.length} из 7</h3>
    ${bars}
    <div style="margin-top:14px;font-size:14.5px;line-height:1.55">${verdict}${pattern}</div>
    ${advice}</div>`;
}

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
  L.push(isSession() ? `Цикл 1 · ${info.label}` : `Цикл ${state.cycle}, неделя ${state.week} из ${state.cycle===1?12:maxWeek(state.cycle)} · ${info.label}`);
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
  const gym=gymDays();
  const need=[], got=[];
  for(let i=0;i<7;i++){
    if(gym.has(i)) continue;
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

function renderReport(){
  const box=document.getElementById('weekReport');
  let filled=0;
  for(let d=0; d<7; d++) if(dayFilled(d)) filled++;

  box.innerHTML=`<div class="report">
    <h3>Отчёт за неделю</h3>
    <p class="rl">Питание, тренировки, рабочие веса и замеры одним текстом. Скопируй и пришли — разберу, что подправить.${filled<3?` Питание пока заполнено за ${filled} ${filled===1?'день':'дня'} — эта часть будет неполной.`:''}</p>
    <div class="btn-row" style="margin:0 0 12px">
      <button class="btn btn-primary" type="button" id="btnReport">Собрать отчёт</button>
      <button class="btn" type="button" id="btnShareReport" hidden>Поделиться</button>
    <button class="btn" type="button" id="btnCopyReport">Скопировать</button>
    </div>
    <textarea id="reportText" readonly placeholder="Нажми «Собрать отчёт»"></textarea>
    <div class="ok" id="reportOk" style="display:none">Скопировано</div>
  </div>`;

  const ta=box.querySelector('#reportText');
  const ok=box.querySelector('#reportOk');

  box.querySelector('#btnReport').addEventListener('click',()=>{
    ta.value=buildReport();
    ok.style.display='none';
  });

  const shareBtn=box.querySelector('#btnShareReport');
  if(navigator.share) shareBtn.hidden=false;
  shareBtn.addEventListener('click',()=>{
    if(!ta.value) ta.value=buildReport();
    navigator.share({text:ta.value}).catch(()=>{});
  });

  box.querySelector('#btnCopyReport').addEventListener('click',()=>{
    if(!ta.value) ta.value=buildReport();
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(ta.value)
        .then(()=>{ ok.style.display='block'; toast('Отчёт скопирован'); })
        .catch(()=>{});
      return;
    }
    ta.removeAttribute('readonly');
    ta.select();
    ta.setSelectionRange(0, 999999);
    let done=false;
    try{ done=document.execCommand('copy'); }catch(e){}
    ta.setAttribute('readonly','');
    if(!done && navigator.clipboard){
      navigator.clipboard.writeText(ta.value).then(()=>{ ok.style.display='block'; }).catch(()=>{});
    } else if(done){
      ok.style.display='block';
    }
  });
}

function renderNutrition(){
  const info=weekInfo();
  const m=missedSessions();
  document.getElementById('foodLede').textContent =
      m.total ? `Пропущено сессий: ${m.total}. Цель снижена — поправка небольшая, недоедать не надо.`
    : info.kind==='deload' ? 'Разгрузочная неделя: калорий чуть меньше, белок тот же.'
    : 'Один заход готовки на 30–40 минут. В будни только достать и разогреть.';

  renderFoodDays();
  renderTiming();
  renderSummary();
  renderWeekStats();
  renderReport();

  const root=document.getElementById('dishes');
  root.innerHTML='';

  DISH_GROUPS.forEach(([cat,title,lede])=>{
    const list=DISHES.filter(d=>catOf(d)===cat);
    if(!list.length) return;
    const on=list.filter(d=>dishOn[d.id]);
    const gh=document.createElement('div');
    gh.className='dgroup';
    gh.innerHTML=`<div class="dgroup-top"><h3>${title}</h3><span class="dgroup-n">${on.length?`выбрано ${on.length}`:'не выбрано'}</span></div>${lede?`<p>${lede}</p>`:''}`;
    root.appendChild(gh);
    /* длинный блок: сначала выбранное, остальное — по кнопке */
    const open = dishOpen[cat] || list.length<=3;
    const shown = open ? list : (on.length ? on : list.slice(0,3));
    shown.forEach(d=>root.appendChild(dishCard(d)));
    if(list.length>3){
      const b=document.createElement('button');
      b.type='button'; b.className='btn morebtn';
      const rest=list.length-shown.length;
      b.textContent = open ? 'Свернуть' : `Ещё варианты · ${rest}`;
      b.addEventListener('click',()=>{ dishOpen[cat]=!open; renderNutrition(); if(!open) gh.scrollIntoView({block:'start'}); });
      root.appendChild(b);
    }
  });
  renderCustom();
}

/* Карточка блюда: тумблер «в дне», граммовки, рецепт */
function dishCard(d){
    const on=!!dishOn[d.id], t=dishTotals(d);
    const card=document.createElement('article');
    card.className='dish'+(on?'':' off');
    card.innerHTML=`
      <div class="dish-head" tabindex="0" role="button" aria-expanded="false">
        <div class="dish-ic">${ICON[d.icon]}</div>
        <div class="dish-main">
          <div class="dish-name">${d.name}</div>
          <div class="dish-when">${d.when}</div>
          <div class="dish-macros">
            <span class="k num">${t.k} ккал</span><span class="p num">Б ${t.p}</span>
            <span class="f num">Ж ${t.f}</span><span class="c num">У ${t.c}</span>
          </div>
          <div class="dish-time">
            <button type="button" class="tbtn now">Съел сейчас</button>
            <input type="time" class="tinp" value="${esc(mealTimes[d.id])}" aria-label="Время приёма">
            <button type="button" class="tclr" aria-label="Убрать время" ${mealTimes[d.id]?'':'hidden'}>×</button>
          </div>
        </div>
        <button class="dish-toggle" role="switch" aria-checked="${on}" aria-label="Включить в день"></button>
      </div>
      <div class="fold"><div class="fold-inner"><div class="dish-body">
        ${d.ing.map(([fid,base])=>{
          const F=FOOD[fid], g=gramOf(d.id,fid,base);
          return `<div class="ing" data-food="${fid}" data-base="${base}">
            <span class="ing-main"><span class="ing-name">${F.n}</span>
              <span class="ing-kcal">${Math.round(F.k*g/100)} ккал · Б ${(F.p*g/100).toFixed(1)}</span></span>
            <span class="gram">
              <button type="button" data-step="-10" aria-label="Минус 10 грамм">−</button>
              <input type="number" value="${esc(g)}" min="0" max="2000" step="5" inputmode="numeric">
              <button type="button" data-step="10" aria-label="Плюс 10 грамм">+</button>
              <span class="u">г</span>
            </span></div>`;
        }).join('')}
        <div class="sub">
          <div class="sub-head" tabindex="0" role="button" aria-expanded="false">
            <span>Рецепт</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <div class="fold"><div class="fold-inner"><div class="sub-body">
            <h5>Как готовить</h5>
            <ol>${d.steps.map(s=>`<li>${s}</li>`).join('')}</ol>
            ${d.tip?`<div class="tip">${d.tip}</div>`:''}
          </div></div></div>
        </div>
      </div></div></div>`;

    bindFold(card.querySelector('.dish-head'), card);
    const sub=card.querySelector('.sub');
    bindFold(sub.querySelector('.sub-head'), sub);

    /* Тумблер «блюдо в дне»: меняем только вид карточки и сводку */
    const tg=card.querySelector('.dish-toggle');
    tg.addEventListener('click',e=>{
      e.stopPropagation();
      const now=!dishOn[d.id];
      dishOn[d.id]=now;
      tg.setAttribute('aria-checked', now?'true':'false');
      card.classList.toggle('off', !now);
      saveFood();
      renderSummary(); renderWeekStats(); renderFoodDays(); refreshGroupCounts();
    });

    /* Граммовки: пересчитываем цифры на месте, карточку не трогаем,
       поэтому раскрытый список ингредиентов не закрывается */
    card.querySelectorAll('.ing').forEach(row=>{
      const fid=row.dataset.food, input=row.querySelector('input');
      const commit=v=>{
        grams[`${d.id}-${fid}`]=Math.max(0,Math.min(2000,Math.round(v)));
        saveFood();
        refreshDish(card, d);
        renderSummary(); renderWeekStats(); renderFoodDays();
      };
      row.querySelectorAll('button[data-step]').forEach(b=>{
        b.addEventListener('click',e=>{
          e.stopPropagation();
          e.preventDefault();
          commit((+input.value||0)+(+b.dataset.step));
        });
      });
      input.addEventListener('change',()=>commit(+input.value||0));
      input.addEventListener('click',e=>e.stopPropagation());
      input.addEventListener('keydown',e=>e.stopPropagation());
    });

    /* время приёма: «Съел сейчас» пишет текущее, поле — любое. Время отмечает блюдо как съеденное */
    const tinp=card.querySelector('.tinp'), clr=card.querySelector('.tclr');
    const setTime=v=>{
      if(v){
        mealTimes[d.id]=v;
        if(!dishOn[d.id]){ dishOn[d.id]=true; tg.setAttribute('aria-checked','true'); card.classList.remove('off'); }
      } else delete mealTimes[d.id];
      tinp.value=v||''; clr.hidden=!v;
      saveFood(); renderSummary(); renderWeekStats(); renderFoodDays(); refreshGroupCounts();
    };
    card.querySelector('.tbtn.now').addEventListener('click',e=>{ e.stopPropagation(); const v=nowHM(); setTime(v); toast(`${d.name} · ${v}`); });
    tinp.addEventListener('change',()=>setTime(tinp.value));
    clr.addEventListener('click',e=>{ e.stopPropagation(); setTime(''); });
    /* выключил блюдо — время тоже убираем */
    tg.addEventListener('click',()=>{ if(!dishOn[d.id] && mealTimes[d.id]){ delete mealTimes[d.id]; tinp.value=''; clr.hidden=true; saveFood(); } });
    return card;
}
function refreshGroupCounts(){
  document.querySelectorAll('#dishes .dgroup').forEach((g,i)=>{
    const cat=DISH_GROUPS.filter(([c])=>DISHES.some(d=>catOf(d)===c))[i][0];
    const n=DISHES.filter(d=>catOf(d)===cat && dishOn[d.id]).length;
    g.querySelector('.dgroup-n').textContent = n ? `выбрано ${n}` : 'не выбрано';
  });
}
