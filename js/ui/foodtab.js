"use strict";
/* ############################################################
   «ЕДА» — сколько ещё и из чего.
   Кольцо «осталось» → контейнеры недели → как обычно в это время →
   съедено по времени → режим дня. Всё остальное — в «⋯».
   Данные те же: дневник дня (блюда, граммы, своё, время) и готовка недели.
   ############################################################ */
const isFoodToday=()=>foodDay===todayIdx() && isNowWeek();
const FOOD_MSG={add:x=>`${x} — записано${isFoodToday()?', '+nowHM():''}`};

/* Снимок дня — для «Отменить» после массовых действий */
function snapDay(d){
  const k=`${state.cycle}-${state.week}-${d==null?foodDay:d}`, s=JSON.stringify(foodLog[k]||null);
  return ()=>{ const v=JSON.parse(s); if(v) foodLog[k]=v; else delete foodLog[k]; loadFoodDay(); saveFood(); renderAll(); };
}
/* Записи с «Сейчас» и из ленты идут в сегодняшний день */
function toToday(){ if(foodDay!==todayIdx()){ foodDay=todayIdx(); loadFoodDay(); } }

/* ---------- Быстрые фишки: блюдо, избранное, частое ---------- */
function quickPill(u,i){
  if(u.kind==='dish'){ const d=dishById(u.id); return `<button type="button" class="pill" data-q="${i}">${esc(d.name)} <small>${dishTotals(d).k}</small></button>`; }
  return `<button type="button" class="pill${u.x.bad?' bad':''}" data-q="${i}">${esc(u.x.name)} <small>${esc(u.x.k)}</small></button>`;
}
function addCustom(x){
  const it={name:x.name, k:x.k, p:x.p, f:x.f, c:x.c, t:nowHM()};
  custom.push(it); saveFood(); renderAll();
  toast(FOOD_MSG.add(x.name), ()=>{ const i=custom.indexOf(it); if(i>=0) custom.splice(i,1); saveFood(); renderAll(); });
}
function eatQuick(u, fromNow){
  if(fromNow) toToday();
  if(u.kind==='dish'){
    const added=eatDish([u.id]); renderAll();
    if(!added.length){ toast('Уже записано в этом дне'); return; }
    toast(FOOD_MSG.add(dishById(u.id).name), ()=>{ uneatDish(added); renderAll(); });
  } else addCustom(u.x);
}
function eatContainer(item, fromNow){
  if(fromNow) toToday();
  if(cookLeft(item)<=0){ toast('Порции кончились — приготовь ещё в «Готовке»'); return; }
  const added=eatDish([item.m, item.g]); renderAll();
  if(!added.length){ toast('Это блюдо уже записано в этом дне'); return; }
  toast(`Порция: ${dishById(item.m).name} — записано${isFoodToday()?', '+nowHM():''}`, ()=>{ uneatDish(added); renderAll(); });
}

/* ---------- Листы ---------- */
function ownFoodSheet(){
  openSheet(`<h2>Своё блюдо</h2><div class="sub">Знаешь только калории — впиши их, остальное оставь пустым.</div>
    <input class="inp small" data-n placeholder="Что это было" aria-label="Название">
    <div class="btnrow" style="grid-template-columns:repeat(4,1fr)">
      <input class="inp small" data-k inputmode="numeric" placeholder="ккал" aria-label="Калории">
      <input class="inp small" data-p inputmode="numeric" placeholder="Б, г" aria-label="Белки">
      <input class="inp small" data-f inputmode="numeric" placeholder="Ж, г" aria-label="Жиры">
      <input class="inp small" data-c inputmode="numeric" placeholder="У, г" aria-label="Углеводы"></div>
    <div class="errtxt" hidden></div>
    <button type="button" class="btn big pri" style="margin-top:14px" data-add>Добавить в день</button>`,
    (el,close)=>el.querySelector('[data-add]').addEventListener('click',()=>{
      const name=el.querySelector('[data-n]').value.trim(), err=el.querySelector('.errtxt');
      const vals={}; let bad=false;
      ['k','p','f','c'].forEach(f=>{ const i=el.querySelector(`[data-${f}]`), s=i.value.trim(), x=s===''?0:num(s);
        const b=x==null || x<0 || x>(f==='k'?5000:500); i.classList.toggle('err',b); if(b) bad=true; vals[f]=Math.round(x||0); });
      if(bad){ err.hidden=false; err.textContent='Проверь числа: калории до 5000, граммы до 500'; return; }
      if(!name && !vals.k){ err.hidden=false; err.textContent='Впиши хотя бы название или калории'; return; }
      close(); addCustom({name:name||'Без названия', ...vals});
    }));
}
function fastFoodSheet(){
  openSheet(`<h2>Фастфуд</h2><div class="sub">Цифры примерные, по данным сетей и типичным порциям.</div>
    <div class="pills">${FASTFOOD.map((x,i)=>`<button type="button" class="pill${x.bad?' bad':''}" data-i="${i}">${esc(x.name)} <small>${x.k}</small></button>`).join('')}</div>
    <p class="small t2" style="margin-top:12px">На сушке лучший выбор — двойной чизбургер и стрипсы: больше всего белка на калорию. Шаурма 700 г — больше половины дневной нормы: бери половину или без лишнего соуса, в этот день остальное — мясо и овощи.</p>
    <p class="small muted">Оранжевая рамка — то, что план советует заменить: много жира или сахара и мало белка.</p>`,
    (el,close)=>el.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{ close(); addCustom(FASTFOOD[+b.dataset.i]); })));
}
function favSheet(){
  const draw=el=>{
    const f=getFavs();
    el.querySelector('[data-list]').innerHTML = f.length ? f.map((x,i)=>`<div class="row"><span class="grow"><div class="nm">${esc(x.name)}</div><div class="ds">${x.k} ккал · Б ${x.p} · Ж ${x.f} · У ${x.c}${x.bad?' · лучше заменить':''}</div></span>
      <button type="button" class="btn" style="width:auto" data-add="${i}">Съел</button><button type="button" class="del" data-del="${i}" aria-label="Убрать из избранного">×</button></div>`).join('')
      : '<div class="t2">Избранного нет. Звёздочка у своей еды в «Съедено» — добавит сюда.</div>';
    el.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ const all=getFavs(), x=all.splice(+b.dataset.del,1)[0]; setFavs(all); draw(el);
      toast(`${x.name} — убрано из избранного`, ()=>{ const a=getFavs(); a.splice(+b.dataset.del,0,x); setFavs(a); renderAll(); }); }));
    el.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{ closeSheets(); addCustom(getFavs()[+b.dataset.add]); }));
  };
  openSheet(`<h2>Избранное</h2><div class="sub">Частая еда — записать одним нажатием.</div><div class="card" style="padding:4px 16px" data-list></div>
    <button type="button" class="btn" data-close>Готово</button>`, el=>draw(el), {onClose:()=>renderAll()});
}
function timingSheet(d){
  const t=mealTiming(d);
  openSheet(`<h2>Когда есть · ${DOW_FULL[d===6?0:d+1]}</h2><div class="sub">${esc(t.title)}</div>
    ${t.warn?`<div class="note y"><b>Внимание</b>${t.warn}</div>`:''}
    <div class="card" style="padding:4px 16px">${t.rows.map(r=>`<div class="row"><span class="n" style="width:56px;font-weight:800">${r[0]}</span><span class="grow">${esc(r[1])}</span><span class="n t2">${r[2]?r[2]+' г белка':''}</span></div>`).join('')}</div>
    <div class="doc">${MEAL_NOTES.map(n=>`<p>${n}</p>`).join('')}</div>
    <button type="button" class="btn big" data-close>Закрыть</button>`);
}
/* Блюдо: время, граммы, рецепт */
function dishSheet(id){
  const d=dishById(id);
  const ingHTML=()=>d.ing.map(([fid,base])=>{ const F=FOOD[fid], g=gramOf(d.id,fid,base);
    return `<div class="row" data-fid="${fid}" data-base="${base}"><span class="grow"><div class="nm">${F.n}</div><div class="ds">${Math.round(F.k*g/100)} ккал · Б ${(F.p*g/100).toFixed(1)}</div></span>
      <span class="stepper"><button type="button" data-st="-10" aria-label="Минус 10 грамм">−</button><b class="n" data-g>${g}</b><button type="button" data-st="10" aria-label="Плюс 10 грамм">+</button></span><span class="muted small">г</span></div>`; }).join('');
  const head=()=>{ const t=dishTotals(d); return `${t.k} ккал · Б ${t.p} · Ж ${t.f} · У ${t.c}`; };
  openSheet(`<h2>${esc(d.name)}</h2><div class="sub" data-h>${esc(d.when)} · ${head()}</div>
    <div class="set-row"><span class="grow"><b>В этом дне</b><span>${dishOn[d.id]?'записано':'не записано'}</span></span><label class="switch"><input type="checkbox" data-on ${dishOn[d.id]?'checked':''} aria-label="В этом дне"><i></i></label></div>
    <div class="set-row"><span class="grow"><b>Время</b><span>когда съел</span></span><input type="time" data-t value="${esc(mealTimes[d.id])}" aria-label="Время приёма"><button type="button" class="btn" style="width:auto" data-now>Сейчас</button></div>
    <div class="sec">Граммы</div><div class="card" style="padding:4px 16px" data-ing>${ingHTML()}</div>
    <details class="lx"><summary><b>Рецепт</b><span>${d.steps.length} шага</span></summary><ol>${d.steps.map(s=>`<li>${s}</li>`).join('')}</ol>${d.tip?`<p class="t2">${d.tip}</p>`:''}</details>
    <button type="button" class="btn big" style="margin-top:14px" data-close>Готово</button>`,
    el=>{
      const on=el.querySelector('[data-on]'), ti=el.querySelector('[data-t]');
      const refresh=()=>{ el.querySelector('[data-h]').textContent=`${d.when} · ${head()}`; on.checked=!!dishOn[d.id]; on.closest('.set-row').querySelector('.grow span').textContent=dishOn[d.id]?'записано':'не записано'; ti.value=mealTimes[d.id]||''; };
      on.addEventListener('change',()=>{ if(on.checked){ dishOn[d.id]=true; if(!mealTimes[d.id] && isFoodToday()) mealTimes[d.id]=nowHM(); } else { dishOn[d.id]=false; delete mealTimes[d.id]; } saveFood(); refresh(); });
      const setT=v=>{ if(v){ mealTimes[d.id]=v; dishOn[d.id]=true; } else delete mealTimes[d.id]; saveFood(); refresh(); };
      ti.addEventListener('change',()=>setT(ti.value));
      el.querySelector('[data-now]').addEventListener('click',()=>{ setT(nowHM()); toast(`${d.name} · ${nowHM()}`); });
      const bindIng=()=>el.querySelectorAll('[data-ing] .row').forEach(row=>row.querySelectorAll('[data-st]').forEach(b=>b.addEventListener('click',()=>{
        const fid=row.dataset.fid, base=+row.dataset.base, g=gramOf(d.id,fid,base)+(+b.dataset.st);
        grams[`${d.id}-${fid}`]=Math.max(0,Math.min(2000,Math.round(g))); saveFood();
        el.querySelector('[data-ing]').innerHTML=ingHTML(); bindIng(); refresh(); vibe(6); })));
      bindIng();
    }, {onClose:()=>renderAll()});
}
function customSheet(i){
  const x=custom[i]; if(!x) return;
  openSheet(`<h2>${esc(x.name)}</h2><div class="sub">${x.k} ккал · Б ${x.p} · Ж ${x.f} · У ${x.c}</div>
    <div class="set-row"><span class="grow"><b>Время</b><span>когда съел</span></span><input type="time" data-t value="${esc(x.t)}" aria-label="Время приёма"></div>
    <div class="btnrow"><button type="button" class="btn" data-fav>☆ В избранное</button><button type="button" class="btn danger" data-del>Удалить</button></div>
    <button type="button" class="btn big" style="margin-top:10px" data-close>Готово</button>`,
    (el,close)=>{
      el.querySelector('[data-t]').addEventListener('change',e=>{ if(e.target.value) x.t=e.target.value; else delete x.t; saveFood(); });
      el.querySelector('[data-fav]').addEventListener('click',()=>{ const f=getFavs(); if(f.some(y=>y.name===x.name)){ toast('Уже в избранном'); return; } f.unshift({name:x.name,k:x.k,p:x.p,f:x.f,c:x.c}); setFavs(f); toast('Добавлено в избранное'); });
      el.querySelector('[data-del]').addEventListener('click',()=>{ close(); const at=custom.indexOf(x); custom.splice(at,1); saveFood(); renderAll();
        toast(`${x.name} — удалено`, ()=>{ custom.splice(at,0,x); saveFood(); renderAll(); }); });
    }, {onClose:()=>renderAll()});
}

/* ---------- Готовка на неделю: блюдо + гарнир + порции ---------- */
function cookSheet(){
  const meats=DISHES.filter(d=>d.cat==='meat'), carbs=DISHES.filter(d=>d.cat==='carb');
  let m=null, g=null, n=4;
  const draw=el=>{
    const list=cookList();
    el.querySelector('[data-have]').innerHTML = list.length ? list.map((c,i)=>`<div class="row"><span class="grow"><div class="nm">${esc(dishById(c.m).name)}${c.g?` + ${esc(dishById(c.g).name.toLowerCase())}`:''}</div><div class="ds">осталось ${cookLeft(c)} из ${c.n} · ${containerTotals(c).k} ккал порция</div></span>
      <span class="stepper"><button type="button" data-cn="${i}" data-d="-1" aria-label="Меньше порций">−</button><b class="n">${c.n}</b><button type="button" data-cn="${i}" data-d="1" aria-label="Больше порций">+</button></span><button type="button" class="del" data-cdel="${i}" aria-label="Убрать">×</button></div>`).join('')
      : '<div class="t2">Пока ничего. Выбери блюдо и гарнир ниже.</div>';
    const sug=m && PAIR[m] ? PAIR[m] : [];
    el.querySelector('[data-meat]').innerHTML=meats.map(d=>`<button type="button" class="pill${m===d.id?' ghost':''}" style="${m===d.id?'outline:3px solid var(--acc)':''}" data-m="${d.id}">${esc(d.name)}</button>`).join('');
    el.querySelector('[data-carb]').innerHTML=`<button type="button" class="pill" style="${g===''?'outline:3px solid var(--acc)':''}" data-g="">Без гарнира</button>`+carbs.map(d=>`<button type="button" class="pill" style="${g===d.id?'outline:3px solid var(--acc)':''}" data-g="${d.id}">${esc(d.name)}${sug.includes(d.id)?' <small>★</small>':''}</button>`).join('');
    el.querySelector('[data-n]').textContent=n;
    el.querySelector('[data-addc]').disabled=!m;
    el.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ m=b.dataset.m; if(g==null && PAIR[m]) g=PAIR[m][0]; draw(el); }));
    el.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>{ g=b.dataset.g; draw(el); }));
    el.querySelectorAll('[data-cn]').forEach(b=>b.addEventListener('click',()=>{ const L=cookList(), c=L[+b.dataset.cn]; c.n=Math.max(1,Math.min(14,(c.n|0)+(+b.dataset.d))); cook[cookKey()]=L; saveCook(); draw(el); }));
    el.querySelectorAll('[data-cdel]').forEach(b=>b.addEventListener('click',()=>{ const L=cookList(), at=+b.dataset.cdel, x=L.splice(at,1)[0]; cook[cookKey()]=L; saveCook(); draw(el);
      toast('Убрано из готовки', ()=>{ const L2=cookList(); L2.splice(at,0,x); cook[cookKey()]=L2; saveCook(); renderAll(); }); }));
  };
  openSheet(`<h2>Готовка на неделю</h2><div class="sub">Один заход на 30–40 минут. Порция контейнера — блюдо и гарнир; съел — «+» на «Еде».</div>
    <div class="card" style="padding:4px 16px" data-have></div>
    <div class="sec">Мясо и соусы</div><div class="pills" data-meat></div>
    <div class="sec">Гарнир <span class="aux muted">★ — лучше всего подходит</span></div><div class="pills" data-carb></div>
    <div class="set-row" style="margin-top:12px"><span class="grow"><b>Порций</b><span>сколько контейнеров</span></span><span class="stepper"><button type="button" data-pn="-1" aria-label="Меньше">−</button><b class="n" data-n></b><button type="button" data-pn="1" aria-label="Больше">+</button></span></div>
    <button type="button" class="btn big pri" style="margin-top:12px" data-addc>Добавить в готовку</button>
    <button type="button" class="btn" style="margin-top:10px" data-close>Готово</button>`,
    el=>{
      el.querySelectorAll('[data-pn]').forEach(b=>b.addEventListener('click',()=>{ n=Math.max(1,Math.min(14,n+(+b.dataset.pn))); el.querySelector('[data-n]').textContent=n; }));
      el.querySelector('[data-addc]').addEventListener('click',()=>{ if(!m) return; const L=cookList(); L.push({m, g:g||'', n}); cook[cookKey()]=L; saveCook(); toast(`${dishById(m).name} — ${n} ${plural(n,'порция','порции','порций')}`); m=null; g=null; n=4; draw(el); });
      draw(el);
    }, {onClose:()=>renderAll()});
}

/* ---------- Все блюда с рецептами ---------- */
function dishesPage(){
  openPage('Все блюда', ()=>DISH_GROUPS.map(([cat,title,lede])=>{
    const list=DISHES.filter(d=>catOf(d)===cat); if(!list.length) return '';
    return `<div class="sec">${title}<span class="aux">${list.filter(d=>dishOn[d.id]).length?`в дне ${list.filter(d=>dishOn[d.id]).length}`:''}</span></div>${lede?`<p class="small t2">${lede}</p>`:''}
      <div class="card" style="padding:4px 16px">${list.map(d=>{ const t=dishTotals(d);
        return `<div class="row"><button type="button" class="grow" style="text-align:left" data-dish="${d.id}"><div class="nm">${esc(d.name)}</div><div class="ds">${esc(d.when)} · ${t.k} ккал · Б ${t.p}</div></button>
          <button type="button" class="ck${dishOn[d.id]?' on':''}" data-tog="${d.id}" aria-label="${esc(d.name)} в дне">${IC.check}</button></div>`; }).join('')}</div>`;
  }).join(''), (el, redraw)=>{
    el.querySelectorAll('[data-dish]').forEach(b=>b.addEventListener('click',()=>dishSheet(b.dataset.dish)));
    el.querySelectorAll('[data-tog]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.tog;
      if(dishOn[id]){ uneatDish([id]); } else { dishOn[id]=true; if(isFoodToday()) mealTimes[id]=nowHM(); saveFood(); }
      vibe(); redraw(); renderAll(); }));
  });
}

/* ---------- «⋯» ---------- */
function foodMenu(){
  const o=[['cook','Готовка на неделю','что приготовил и сколько порций'],['all','Все блюда и рецепты','граммы, время, рецепт'],
    ['assemble','Собрать день','завтрак, два мяса с гарнирами, овощи — порции под цель'],['base','Базовый набор','стандартные блюда и граммовки'],
    ['fav','Избранное','изменить список'],['timing','Режим дня','когда есть и сколько белка'],
    ['clear','Обнулить день','с «Отменить»'],['week','Очистить неделю','все 7 дней еды']];
  openSheet(`<h2>Еда · ${DOW_IDX[foodDay]}</h2>${o.map(([a,t,s])=>`<button type="button" class="opt${a==='week'?' danger':''}" data-a="${a}"><span class="grow"><b>${t}</b><span>${s}</span></span></button>`).join('')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',async()=>{
      const a=b.dataset.a; close();
      if(a==='cook') cookSheet();
      else if(a==='all') dishesPage();
      else if(a==='fav') favSheet();
      else if(a==='timing') timingSheet(foodDay);
      else if(a==='assemble'){ const u=snapDay(); assembleDay(); toast('День собран под цель', u); }
      else if(a==='base'){ const u=snapDay(); Object.keys(grams).forEach(k=>delete grams[k]); DISHES.forEach(d=>{ dishOn[d.id]=d.on; }); saveFood(); renderAll(); toast('Базовый набор', u); }
      else if(a==='clear'){ const u=snapDay(); clearDay(); saveFood(); renderAll(); toast('День обнулён', u); }
      else if(a==='week'){
        if(!await confirmSheet('Очистить неделю?','Вся еда за 7 дней этой недели удалится. Тренировки и замеры не тронутся.','Очистить неделю',true)) return;
        const keep=[0,1,2,3,4,5,6].map(d=>snapDay(d));
        for(let d=0; d<7; d++) clearDay(d); loadFoodDay(); saveFood(); renderAll();
        toast('Неделя очищена', ()=>keep.forEach(f=>f()));
      }
    })));
}

/* ---------- Экран ---------- */
let foodRingWas=null;   /* {d, f}: что кольцо показывало до перерисовки — от него и докручиваем */
function renderFoodTab(){
  const box=$('#scr-food'); if(!box) return;
  const T=nutritionTarget(), D=dayTotals(), mt=mealTiming(foodDay), info=weekInfo(), ms=missedSessions();
  const left=T.k-D.k, inTarget=D.k && Math.abs(left)<=120, over=D.k && left<-120;
  const ringCol = !D.k ? 'var(--s3)' : over ? 'var(--wn)' : inTarget ? 'var(--ok)' : 'var(--kc)';
  const center = !D.k ? `<div class="v n">${kfmt(T.k)}</div><div class="l">цель · отметь, что съел</div>`
    : inTarget ? `<div class="v n" data-count="${D.k}" data-fmt="k">${kfmt(D.k)}</div><div class="l" style="color:var(--ok)">в цель</div>`
    : over ? `<div class="v n" style="color:var(--wn)">+${kfmt(-left)}</div><div class="l">перебор, ккал</div>`
    : `<div class="v n" data-count="${left}" data-fmt="k">${kfmt(left)}</div><div class="l">ккал осталось</div>`;
  const rem=(a,b,n)=>{ const x=b-a; return x>=0 ? `<b class="n" data-count="${x}">${x}</b><span>${n} ещё, г</span>` : `<b class="n" style="color:var(--wn)">+${-x}</b><span>${n} сверх, г</span>`; };

  const conts=cookList();
  const usual=usualNow(6);
  /* съедено: блюда и своё по времени */
  const eaten=[
    ...DISHES.filter(d=>dishOn[d.id]).map(d=>({t:mealTimes[d.id]||'', nm:d.name, k:dishTotals(d).k, dish:d.id})),
    ...custom.map((x,i)=>({t:x.t||'', nm:x.name, k:x.k, ci:i, bad:FASTFOOD.some(f=>f.name===x.name&&f.bad)||getFavs().some(f=>f.name===x.name&&f.bad)}))
  ].sort((a,b)=>(a.t||'99')<(b.t||'99')?-1:1);
  const dayKcal=d=>{ const t=dayFilled(d)?totalsOfDay(d):null; return t?kfmt(t.k):'·'; };
  const lede = ms.total ? `<div class="note i"><b>Пропущено сессий: ${ms.total}</b>Цель снижена — поправка небольшая, недоедать не надо.</div>`
    : info.kind==='deload' ? `<div class="note"><b>Разгрузочная неделя</b>Калорий чуть меньше, белок тот же.</div>` : '';

  box.innerHTML=`
    <div class="hd"><div class="tt"><div class="kick">${foodDay===todayIdx()&&isNowWeek()?'Сегодня':DOW_FULL[foodDay===6?0:foodDay+1]} · ${esc(mt.title)}</div><div class="h1">Еда</div></div>
      <button type="button" class="icbtn" data-menu aria-label="Ещё">${IC.more}</button></div>
    <div class="days7">${DOW_IDX.map((n,i)=>`<button type="button" class="${i===foodDay?'on':''}${dayFilled(i)?' full':''}" data-fd="${i}" style="${i===todayIdx()&&isNowWeek()?'box-shadow:inset 0 -3px 0 var(--acc)':''}"><b>${n}</b><span class="n">${dayKcal(i)}</span></button>`).join('')}</div>
    <div class="card" style="margin-top:12px">
      <div class="kring">${ringSVG(210,18,T.k?D.k/T.k:0,ringCol)}<div class="c">${center}</div></div>
      <div class="mac">${D.k?`<div>${rem(D.p,T.p,'белка')}</div><div>${rem(D.f,T.f,'жира')}</div><div>${rem(D.c,T.c,'углев.')}</div>`
        :`<div><b class="n">${T.p}</b><span>белок, г</span></div><div><b class="n">${T.f}</b><span>жиры, г</span></div><div><b class="n">${T.c}</b><span>углев., г</span></div>`}</div>
      <div class="muted small" style="text-align:center;margin-top:8px">цель ${kfmt(T.k)} ккал · Б ${T.p} · Ж ${T.f} · У ${T.c}</div>
    </div>
    ${lede}
    <div class="sec">Контейнеры недели<button type="button" class="aux link" data-cook>Готовка</button></div>
    <div class="grid2">${conts.map((c,i)=>{ const l=cookLeft(c), t=containerTotals(c);
      return l>0 ? `<div class="tile cont tap" data-cont="${i}"><div class="t">${esc(dishById(c.m).name)}</div><div class="s">${c.g?esc(dishById(c.g).name)+' · ':''}${t.k} ккал</div><span class="left">осталось ${l} из ${c.n}</span><button type="button" class="plus" data-eat="${i}" aria-label="Съел порцию">${IC.plus}</button></div>`
        : `<button type="button" class="tile empty" data-cook><span>${esc(dishById(c.m).name)}: порции кончились<br><span class="link">Приготовить ещё?</span></span></button>`; }).join('')}
      ${conts.length?'':`<button type="button" class="tile empty" data-cook>Что приготовил на неделю?</button>`}</div>
    <div class="sec">Как обычно в это время</div>
    <div class="pills">${usual.map((u,i)=>quickPill(u,i)).join('')}
      <button type="button" class="pill ghost" data-own>${IC.plus} Своё</button><button type="button" class="pill ghost" data-ff>Фастфуд</button><button type="button" class="pill ghost" data-fav>☆ Избранное</button></div>
    <div class="sec">Съедено<span class="aux">${D.k?`${kfmt(D.k)} ккал`:''}</span></div>
    <div class="card" style="padding:4px 16px">${eaten.length ? eaten.map(x=>`<button type="button" class="row" style="width:100%;text-align:left" ${x.dish?`data-dish="${x.dish}"`:`data-ci="${x.ci}"`}>
        <span class="n" style="width:52px;font-weight:800;color:var(--t2)">${x.t||'—'}</span><span class="grow"><div class="nm">${esc(x.nm)}${x.bad?' <small style="color:var(--wn)">●</small>':''}</div></span><span class="val n">${x.k}</span></button>`).join('')
      : '<div class="t2" style="padding:14px 0">Пока ничего. Отмечай фишками выше или «+» у контейнера.</div>'}</div>
    <button type="button" class="card tap" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px" data-timing>
      <span class="grow" style="flex:1"><b>Режим дня</b><div class="small t2">${esc(mt.title)} · ${mt.rows.filter(r=>r[2]).length} ${plural(mt.rows.filter(r=>r[2]).length,'приём','приёма','приёмов')} с белком</div></span><span class="chev">›</span></button>
  `;

  /* кольцо докручивается от прежнего значения: съел — дорисовалось, сменил день — перетекло */
  const ringF=T.k?D.k/T.k:0, rf=box.querySelector('.kring .rfill');
  if(rf && foodRingWas) fillRing(rf, foodRingWas.f, 700);
  foodRingWas={f:ringF};
  box.querySelector('[data-menu]').addEventListener('click',foodMenu);
  box.querySelectorAll('[data-fd]').forEach(b=>b.addEventListener('click',()=>{ foodDay=+b.dataset.fd; loadFoodDay(); renderFoodTab(); }));
  box.querySelectorAll('[data-cook]').forEach(b=>b.addEventListener('click',cookSheet));
  box.querySelectorAll('[data-eat]').forEach(b=>b.addEventListener('click',ev=>{ ev.stopPropagation(); eatContainer(conts[+b.dataset.eat]); }));
  box.querySelectorAll('[data-cont]').forEach(b=>b.addEventListener('click',()=>{ const c=conts[+b.dataset.cont]; dishSheet(c.m); }));
  box.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>eatQuick(usual[+b.dataset.q])));
  box.querySelector('[data-own]').addEventListener('click',ownFoodSheet);
  box.querySelector('[data-ff]').addEventListener('click',fastFoodSheet);
  box.querySelector('[data-fav]').addEventListener('click',favSheet);
  box.querySelectorAll('[data-dish]').forEach(b=>b.addEventListener('click',()=>dishSheet(b.dataset.dish)));
  box.querySelectorAll('[data-ci]').forEach(b=>b.addEventListener('click',()=>customSheet(+b.dataset.ci)));
  box.querySelector('[data-timing]').addEventListener('click',()=>timingSheet(foodDay));
}
