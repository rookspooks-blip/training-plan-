"use strict";
/* ############################################################
   БИБЛИОТЕКА — вся справка в шести разделах и поиск.
   Тексты те же, что были в «Справке» и «Теле»; меняется только
   место: раздел → список → текст. Техника — каталог упражнений с фото.
   ############################################################ */
const LIB_GROUPS=[
  {id:'why', cls:'g1', t:'Почему план такой', s:'наука, неделя, веса', items:['Почему план такой','Неделя целиком','Отдых между подходами','Как расти в весах','Прыжки: на цель, с разбега, контраст','Кардио · зачем и сколько','Сессия и переход на набор','Акценты и внешний вид','Что будет на 5–6 неделе','Чего в плане нет и почему','Где что делается','Что купить']},
  {id:'tech', cls:'g2', t:'Техника', s:'все упражнения с фото'},
  {id:'knee', cls:'g3', t:'Колено, пах, стопа', s:'профилактика и правила', items:['Колено: профилактика','Пах и колени','Стопа и вальгус']},
  {id:'miss', cls:'g4', t:'Пропуски и переносы', s:'что куда переезжает', items:['Пропуски и переносы']},
  {id:'food', cls:'g5', t:'Еда и замеры', s:'тесты, отчёт, добавки', items:['Замеры и на что смотреть','Тесты на площадке','Мониторинг','Отчёт за неделю','Добавки']},
  {id:'rec', cls:'g6', t:'Восстановление и сон', s:'сон, растяжка, душ', lede:'Растяжка, самомассаж, душ и голова. Делается после тренировки или в отдельный день — не до.', items:['Сон: норма недели','Ранние дни','Режим дня','Растяжка','Самомассаж','Душ после тренировки','Голова','Активное восстановление']}
];
const extraHTML=sec=>typeof sec[1]==='function' ? sec[1]() : sec[1];
const extraByTitle=t=>EXTRA.find(x=>x[0]===t);
/* Раздел справки, который не попал ни в одну группу, — в «Почему план такой», не теряем */
function libItems(g){
  if(g.id!=='why') return g.items;
  const used=new Set(LIB_GROUPS.flatMap(x=>x.items||[]));
  return [...g.items, ...EXTRA.map(x=>x[0]).filter(t=>!used.has(t))];
}
const stripTags=h=>String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');

/* Каталог техники: название берём из плана, разминок, ежедневного блока, восстановления */
function techCatalog(){
  const seen={}, add=(tech,name,group)=>{ if(tech && TECH[tech] && !seen[tech]) seen[tech]={tech,name,group}; };
  const weeks=[[1,1],[1,5],[1,9],[1,13],[2,1],[2,5],[3,1],[3,7],[3,13]];
  weeks.forEach(([c,w])=>{ try{ withWeek(c,w,()=>buildDays(c,w).forEach(day=>{
    day.ex.forEach(ex=>{ add(ex.tech, ex.name, ex.badge[0]); const A=ALTS[ex.name]; if(A) add(A.tech, A.name, ex.badge[0]); });
    (warmupOf(day,w).list||[]).forEach(s=>add(s.tech, s.name, 'Разминка'));
  })); }catch(e){} });
  DAILY.forEach(x=>add(x.tech, x.name, 'Каждый день'));
  add(BALL.tech, BALL.name, 'Мяч');
  add('bike_setup','Велосипед: настройка','Кардио'); add('run_setup','Бег: настройка','Кардио');
  STRETCH.forEach(x=>add(x.tech, 'Растяжка: '+x.name.toLowerCase(), 'Восстановление'));
  ROLL.forEach(x=>add(x.tech, 'Ролик: '+x.name.toLowerCase(), 'Восстановление'));
  return Object.values(seen);
}

function openLibrary(){
  openPage('Библиотека', ()=>`<input class="search" type="search" placeholder="Поиск по справке и технике" aria-label="Поиск" data-q>
    <div data-res></div>
    <div class="lib" data-tiles>${LIB_GROUPS.map(g=>`<button type="button" class="lb ${g.cls}" data-g="${g.id}"><b>${g.t}</b><span>${g.s}</span></button>`).join('')}</div>`,
  (el)=>{
    el.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>openLibGroup(b.dataset.g)));
    const q=el.querySelector('[data-q]'), res=el.querySelector('[data-res]'), tiles=el.querySelector('[data-tiles]');
    q.addEventListener('input',()=>{
      const s=q.value.trim().toLowerCase();
      tiles.hidden=!!s;
      if(!s){ res.innerHTML=''; return; }
      const secs=EXTRA.filter(x=>x[0].toLowerCase().includes(s) || stripTags(extraHTML(x)).toLowerCase().includes(s));
      const techs=techCatalog().filter(x=>x.name.toLowerCase().includes(s) || stripTags(TECH[x.tech].text).toLowerCase().includes(s));
      res.innerHTML = (secs.length||techs.length) ? `
        ${secs.length?`<div class="sec">Справка</div><div class="card" style="padding:4px 16px">${secs.map(x=>`<button type="button" class="secrow" data-sec="${esc(x[0])}"><span>${esc(x[0])}</span><span class="chev" style="flex:none">›</span></button>`).join('')}</div>`:''}
        ${techs.length?`<div class="sec">Техника</div><div class="card" style="padding:4px 16px">${techs.slice(0,30).map(x=>`<button type="button" class="secrow" data-tech="${x.tech}" data-nm="${esc(x.name)}"><span>${esc(x.name)}</span><span class="chev" style="flex:none">›</span></button>`).join('')}</div>`:''}`
        : '<div class="t2" style="margin-top:14px">Ничего не нашлось.</div>';
      res.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>openLibrarySection(b.dataset.sec, true)));
      res.querySelectorAll('[data-tech]').forEach(b=>b.addEventListener('click',()=>techSheet(b.dataset.tech, b.dataset.nm)));
    });
  });
}
function openLibGroup(id){
  const g=LIB_GROUPS.find(x=>x.id===id);
  if(id==='tech'){
    openPage('Техника', ()=>{
      const cat=techCatalog(), groups={};
      cat.forEach(x=>{ (groups[x.group]=groups[x.group]||[]).push(x); });
      return `<p class="t2">Тап — фото начала и конца движения, как делать, частые ошибки.</p>`+Object.entries(groups).map(([gr,list])=>`<div class="sec">${esc(gr)}</div><div class="card" style="padding:4px 16px">${list.map(x=>`<button type="button" class="secrow" data-tech="${x.tech}" data-nm="${esc(x.name)}"><span>${esc(x.name)}</span><span class="chev" style="flex:none">›</span></button>`).join('')}</div>`).join('');
    }, el=>el.querySelectorAll('[data-tech]').forEach(b=>b.addEventListener('click',()=>techSheet(b.dataset.tech, b.dataset.nm))));
    return;
  }
  openPage(g.t, ()=>`${g.lede?`<p class="t2">${g.lede}</p>`:''}<div class="card" style="padding:4px 16px">${libItems(g).filter(extraByTitle).map(t=>`<button type="button" class="secrow" data-sec="${esc(t)}"><span>${esc(t)}</span><span class="chev" style="flex:none">›</span></button>`).join('')}</div>`,
    el=>el.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>openLibrarySection(b.dataset.sec, true))));
}
/* Раздел справки по названию — из «Сейчас», «Плана», «Я» и плеера */
function openLibrarySection(title, nested){
  const sec=extraByTitle(title);
  if(!sec){ openLibrary(); return; }
  if(!nested) openLibrary();
  openPage(title, ()=>`<div class="doc">${extraHTML(sec)}</div>`, el=>{
    el.querySelectorAll('.doc [data-todo]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.todo; todo[id]=!todo[id]; if(!todo[id]) delete todo[id]; store.set('planTodo',todo); }));
  });
}
