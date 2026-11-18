"use strict";
/* ############################################################
   «ЕДА» (E3.2, макет А «Лента»): компактное кольцо и БЖУ сверху, лента записей дня,
   внизу закреплённая панель: фишки «как обычно в это время» и строка «Своё: шаурма 650».
   Контейнеры недели, каталог, «Собрать день», фастфуд, режим дня - в меню «⋯».
   Данные те же: дневник дня (блюда, граммы, своё, время) и готовка недели.
   ############################################################ */
const isFoodToday=()=>foodDay===todayIdx() && isNowWeek();
const FOOD_MSG={add:x=>`${x} — записано${isFoodToday()?', '+nowHM():''}`};

/* Снимок дня — для «Отменить» после массовых действий */
function snapDay(d){
  const k=`${weekTag()}-${d==null?foodDay:d}`, s=JSON.stringify(foodLog[k]||null);
  return ()=>{ const v=JSON.parse(s); if(v) foodLog[k]=v; else delete foodLog[k]; loadFoodDay(); saveFood(); renderAll(); };
}
/* Записи с «Сейчас» и из ленты идут в сегодняшний день */
function toToday(){ if(foodDay!==todayIdx()){ foodDay=todayIdx(); loadFoodDay(); } }

/* ---------- Быстрые фишки: блюдо, избранное, частое ---------- */
function quickPill(u,i){
  if(u.kind==='dish'){ const d=dishById(u.id); return `<button type="button" class="pill" data-q="${i}">${esc(d.name)} <small>${dishTotals(d).k}</small></button>`; }
  return `<button type="button" class="pill${u.x.bad?' bad':''}" data-q="${i}">${esc(u.x.name)} <small>${esc(u.x.k)}</small></button>`;
}
function quickChip(u,i){
  const nm=u.kind==='dish' ? dishById(u.id).name : u.x.name, k=u.kind==='dish' ? dishTotals(dishById(u.id)).k : u.x.k, bad=u.kind!=='dish' && u.x.bad;
  return `<button type="button" class="fchip${bad?' bad':''}" data-q="${i}">${esc(nm)}<small>${k}</small></button>`;
}
function addCustom(x){
  const it={name:x.name, k:x.k, p:x.p, f:x.f, c:x.c, t:x.t||nowHM()};
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

/* ---------- Ввод своей еды ---------- */
const strictNum=s=>/^\d+([.,]\d+)?$/.test(s) ? num(s) : null;
/* «шаурма 650», «Шаурма, 650 ккал»: название и калории из одной строки. Буквы вместо калорий и пустые калории не проходят */
function parseOwn(s){
  s=String(s||'').trim().replace(/\s+/g,' ');
  if(/^\d+$/.test(s)) return {err:'Впиши название и калории: шаурма 650'};
  const m=/^(.*?)[\s,;:=]+(\d+(?:[.,]\d+)?)\s*(?:ккал|кал|к|kcal)?\.?$/i.exec(s);
  if(!m) return {err:'В конце строки нужны калории числом: шаурма 650'};
  const name=m[1].trim(), k=Math.round(+m[2].replace(',','.'));
  if(!name) return {err:'Впиши название и калории: шаурма 650'};
  if(!(k>=1) || k>5000) return {err:'Калории от 1 до 5000'};
  return {name, k};
}
function foodFormHTML(x){
  x=x||{};
  const v=f=>x[f]!=null&&x[f]!==''&&x[f]!==0 ? esc(String(x[f])) : '';
  return `<input class="inp small" data-n placeholder="Что это было" aria-label="Название" value="${esc(x.name||'')}">
    <div class="btnrow" style="grid-template-columns:repeat(4,1fr)">
      <input class="inp small" data-k inputmode="numeric" placeholder="ккал" aria-label="Калории" value="${v('k')}">
      <input class="inp small" data-p inputmode="numeric" placeholder="Б, г" aria-label="Белки" value="${v('p')}">
      <input class="inp small" data-f inputmode="numeric" placeholder="Ж, г" aria-label="Жиры" value="${v('f')}">
      <input class="inp small" data-c inputmode="numeric" placeholder="У, г" aria-label="Углеводы" value="${v('c')}"></div>
    <div class="set-row"><span class="grow"><b>Время</b><span>когда съел</span></span><input type="time" data-t value="${esc(x.t||'')}" aria-label="Время приёма"></div>
    <div class="errtxt" hidden></div>`;
}
/* Читает форму. Названия и калорий достаточно, Б, Ж, У можно пустыми. null - ошибка уже показана */
function readFoodForm(el){
  const err=el.querySelector('.errtxt'); let msg='';
  const q=f=>el.querySelector(`[data-${f}]`), mark=(f,bad,text)=>{ q(f).classList.toggle('err',bad); if(bad && !msg) msg=text; };
  const name=q('n').value.trim(); mark('n', !name, 'Впиши название');
  const k=strictNum(q('k').value.trim()); mark('k', k==null || k<1 || k>5000, 'Калории: число от 1 до 5000');
  const g={};
  ['p','f','c'].forEach(f=>{ const s=q(f).value.trim(), x=s===''?0:strictNum(s); mark(f, x==null || x>500, 'Граммы: число от 0 до 500'); g[f]=Math.round(x||0); });
  if(msg){ err.hidden=false; err.textContent=msg; return null; }
  err.hidden=true;
  return {name, k:Math.round(k), ...g, t:q('t').value||''};
}
function ownFoodSheet(pre){
  openSheet(`<h2>Своё блюдо</h2><div class="sub">Название и калории обязательны, Б, Ж, У можно не заполнять.</div>
    ${foodFormHTML(pre)}
    <button type="button" class="btn big pri" style="margin-top:14px" data-add>Добавить в день</button>`,
    (el,close)=>el.querySelector('[data-add]').addEventListener('click',()=>{
      const v=readFoodForm(el); if(!v) return;
      close(); foodDraft=''; addCustom(v);
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
  openSheet(`<h2>${esc(x.name)}</h2><div class="sub">Правка записи: название, калории, Б, Ж, У и время.</div>
    ${foodFormHTML(x)}
    <button type="button" class="btn big pri" style="margin-top:14px" data-save>Сохранить</button>
    <div class="btnrow"><button type="button" class="btn" data-fav>☆ В избранное</button><button type="button" class="btn danger" data-del>Удалить</button></div>`,
    (el,close)=>{
      el.querySelector('[data-save]').addEventListener('click',()=>{
        const v=readFoodForm(el); if(!v) return;
        x.name=v.name; x.k=v.k; x.p=v.p; x.f=v.f; x.c=v.c; if(v.t) x.t=v.t; else delete x.t;
        saveFood(); close(); renderAll(); toast('Запись сохранена');
      });
      el.querySelector('[data-fav]').addEventListener('click',()=>{ const f=getFavs(); if(f.some(y=>y.name===x.name)){ toast('Уже в избранном'); return; } f.unshift({name:x.name,k:x.k,p:x.p,f:x.f,c:x.c}); setFavs(f); toast('Добавлено в избранное'); });
      el.querySelector('[data-del]').addEventListener('click',()=>{ close(); const at=custom.indexOf(x); custom.splice(at,1); saveFood(); renderAll();
        toast(`${x.name} - удалено`, ()=>{ custom.splice(at,0,x); saveFood(); renderAll(); }); });
    }, {onClose:()=>renderAll()});
}

/* ---------- Готовка на неделю: блюдо + гарнир + порции ---------- */
function cookSheet(){
  const meats=DISHES.filter(d=>d.cat==='meat'), carbs=DISHES.filter(d=>d.cat==='carb');
  let m=null, g=null, n=4;
  const draw=el=>{
    const list=cookList();
    el.querySelector('[data-have]').innerHTML = list.length ? list.map((c,i)=>`<div class="row"><span class="grow"><div class="nm">${esc(dishById(c.m).name)}${c.g?` + ${esc(dishById(c.g).name.toLowerCase())}`:''}</div><div class="ds">осталось ${cookLeft(c)} из ${c.n} · ${containerTotals(c).k} ккал порция</div></span>
      <button type="button" class="btn" style="width:auto" data-ceat="${i}" ${cookLeft(c)>0?'':'disabled'}>Съел</button><span class="stepper"><button type="button" data-cn="${i}" data-d="-1" aria-label="Меньше порций">−</button><b class="n">${c.n}</b><button type="button" data-cn="${i}" data-d="1" aria-label="Больше порций">+</button></span><button type="button" class="del" data-cdel="${i}" aria-label="Убрать">×</button></div>`).join('')
      : '<div class="t2">Пока ничего. Выбери блюдо и гарнир ниже.</div>';
    const sug=m && PAIR[m] ? PAIR[m] : [];
    el.querySelector('[data-meat]').innerHTML=meats.map(d=>`<button type="button" class="pill${m===d.id?' ghost':''}" style="${m===d.id?'outline:3px solid var(--acc)':''}" data-m="${d.id}">${esc(d.name)}</button>`).join('');
    el.querySelector('[data-carb]').innerHTML=`<button type="button" class="pill" style="${g===''?'outline:3px solid var(--acc)':''}" data-g="">Без гарнира</button>`+carbs.map(d=>`<button type="button" class="pill" style="${g===d.id?'outline:3px solid var(--acc)':''}" data-g="${d.id}">${esc(d.name)}${sug.includes(d.id)?' <small>★</small>':''}</button>`).join('');
    el.querySelector('[data-n]').textContent=n;
    el.querySelector('[data-addc]').disabled=!m;
    el.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ m=b.dataset.m; if(g==null && PAIR[m]) g=PAIR[m][0]; draw(el); }));
    el.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>{ g=b.dataset.g; draw(el); }));
    el.querySelectorAll('[data-ceat]').forEach(b=>b.addEventListener('click',()=>{ const c=cookList()[+b.dataset.ceat]; if(!c) return; closeSheets(); eatContainer(c); }));
    el.querySelectorAll('[data-cn]').forEach(b=>b.addEventListener('click',()=>{ const L=cookList(), c=L[+b.dataset.cn]; c.n=Math.max(1,Math.min(14,(c.n|0)+(+b.dataset.d))); cook[cookKey()]=L; saveCook(); draw(el); }));
    el.querySelectorAll('[data-cdel]').forEach(b=>b.addEventListener('click',()=>{ const L=cookList(), at=+b.dataset.cdel, x=L.splice(at,1)[0]; cook[cookKey()]=L; saveCook(); draw(el);
      toast('Убрано из готовки', ()=>{ const L2=cookList(); L2.splice(at,0,x); cook[cookKey()]=L2; saveCook(); renderAll(); }); }));
  };
  openSheet(`<h2>Готовка на неделю</h2><div class="sub">Один заход на 30–40 минут. Порция контейнера — блюдо и гарнир; съел — «Съел» в строке.</div>
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
function dayPickSheet(){
  const dayKcal=d=>{ const t=dayFilled(d)?totalsOfDay(d):null; return t?kfmt(t.k):'·'; };
  openSheet(`<h2>Другой день</h2><div class="sub">Записи и фишки пойдут в выбранный день.</div>
    <div class="days7" style="margin-top:8px">${DOW_IDX.map((n,i)=>`<button type="button" class="${i===foodDay?'on':''}${dayFilled(i)?' full':''}" data-fd="${i}" style="${i===todayIdx()&&isNowWeek()?'box-shadow:inset 0 -3px 0 var(--acc)':''}"><b>${n}</b><span class="n">${dayKcal(i)}</span></button>`).join('')}</div>
    <button type="button" class="btn" style="margin-top:14px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-fd]').forEach(b=>b.addEventListener('click',()=>{ foodDay=+b.dataset.fd; loadFoodDay(); close(); renderFoodTab(); })));
}
/* ---------- «⋯» ---------- */
function foodMenu(){
  const o=[['day','Другой день','записать или посмотреть день недели'],['cook','Контейнеры недели','что приготовил, сколько порций, «Съел»'],['all','Все блюда и рецепты','граммы, время, рецепт'],
    ['assemble','Собрать день','завтрак, два мяса с гарнирами, овощи — порции под цель'],['base','Базовый набор','стандартные блюда и граммовки'],
    ['ff','Фастфуд','цифры примерные'],['fav','Избранное','изменить список'],['timing','Режим дня','когда есть и сколько белка'],
    ['clear','Обнулить день','с «Отменить»'],['week','Очистить неделю','все 7 дней еды']];
  openSheet(`<h2>Еда · ${DOW_IDX[foodDay]}</h2>${o.map(([a,t,s])=>`<button type="button" class="opt${a==='week'?' danger':''}" data-a="${a}"><span class="grow"><b>${t}</b><span>${s}</span></span></button>`).join('')}
    <button type="button" class="btn" style="margin-top:8px" data-close>Закрыть</button>`,
    (el,close)=>el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',async()=>{
      const a=b.dataset.a; close();
      if(a==='day') dayPickSheet();
      else if(a==='cook') cookSheet();
      else if(a==='all') dishesPage();
      else if(a==='fav') favSheet();
      else if(a==='ff') fastFoodSheet();
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
let foodRingWas=null;   /* {f}: что кольцо показывало до перерисовки - от него и докручиваем */
let foodDraft='';       /* текст строки «Своё», пока не записан */
function renderFoodTab(){
  const box=$('#scr-food'); if(!box) return;
  const old=box.querySelector('.fscroll'), keepY=old?old.scrollTop:0;
  const T=nutritionTarget(foodDay), D=dayTotals(), mt=mealTiming(foodDay), ms=missedSessions();
  const iso=dateOfCW(state.cycle, state.week, foodDay), over=D.k>T.k+120;
  const kind={gym:'день с тренировкой', pe:'день с тренировкой', cardio:'день с велосипедом'}[mt.kind]||'день отдыха';
  const usual=usualNow(6);
  const eaten=[
    ...DISHES.filter(d=>dishOn[d.id]).map(d=>({t:mealTimes[d.id]||'', nm:d.name, k:dishTotals(d).k, dish:d.id})),
    ...custom.map((x,i)=>({t:x.t||'', nm:x.name, k:x.k, ci:i, own:true}))
  ].sort((a,b)=>(a.t||'99')<(b.t||'99')?-1:1);
  const mac=(lab,v,t,col)=>`<div class="mrow"><div class="ml"><em>${lab}</em><span><b class="n">${v}</b> / ${t}</span></div><i><u style="width:${t?Math.min(100,Math.round(v/t*100)):0}%;background:${col}"></u></i></div>`;
  const today=foodDay===todayIdx() && isNowWeek();

  box.innerHTML=`<div class="fscroll" id="fscroll">
    <div class="hd"><div class="tt"><div class="h1">Еда</div><div class="hsub">${esc(ruDate(iso))} · ${kind}${ms.total?' · цель снижена':''}${today?'':' · <button type="button" class="link small" style="min-height:44px" data-fday>К сегодня</button>'}</div></div>
      <button type="button" class="icbtn" data-menu aria-label="Ещё">${IC.more}</button></div>
    <div class="card fsum"><div class="fring">${ringSVG(130,13,T.k?D.k/T.k:0,over?'var(--wn)':'var(--kc)')}<div class="c"><b class="n"${over?' style="color:var(--wn)"':''}>${kfmt(D.k)}</b><span>из ${kfmt(T.k)}</span></div></div>
      <div class="mcol">${mac('Белок',D.p,T.p,'var(--pr)')}${mac('Жиры',D.f,T.f,'var(--ft)')}${mac('Углеводы',D.c,T.c,'var(--cb)')}</div></div>
    <div class="card flist">${eaten.length ? eaten.map(x=>`<button type="button" class="frow" ${x.dish?`data-dish="${x.dish}"`:`data-ci="${x.ci}"`}>
        <span class="tm n">${x.t||'-'}</span><span class="nm">${esc(x.nm)}${x.own?' <small>своё</small>':''}</span><span class="val n">${x.k}</span></button>`).join('')
      : '<div class="fempty">Пока ничего. Нажми фишку внизу или впиши своё.</div>'}</div>
  </div>
  <div class="fpanel" id="fpanel"><div class="plbl">Как обычно в это время</div>
    <div class="fchips">${usual.map((u,i)=>quickChip(u,i)).join('')}</div>
    <div class="fown"><input class="fin" data-line placeholder="Своё: название и калории" aria-label="Своё: название и калории" enterkeyhint="done" autocomplete="off" value="${esc(foodDraft)}">
      <button type="button" class="fmore" data-more>ещё</button><button type="button" class="fgo" data-add aria-label="Записать своё">${IC.up}</button></div>
    <div class="errtxt" data-lineerr hidden></div></div>`;

  const sc=box.querySelector('.fscroll'); sc.scrollTop=keepY;
  /* кольцо докручивается от прежнего значения: съел - дорисовалось, сменил день - перетекло */
  const ringF=T.k?D.k/T.k:0, rf=box.querySelector('.fring .rfill');
  if(rf && foodRingWas) fillRing(rf, foodRingWas.f, 200);
  foodRingWas={f:ringF};
  box.querySelector('[data-menu]').addEventListener('click',foodMenu);
  const fd=box.querySelector('[data-fday]'); if(fd) fd.addEventListener('click',()=>{ foodDay=todayIdx(); loadFoodDay(); renderFoodTab(); });
  box.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>eatQuick(usual[+b.dataset.q])));
  box.querySelectorAll('[data-dish]').forEach(b=>b.addEventListener('click',()=>dishSheet(b.dataset.dish)));
  box.querySelectorAll('[data-ci]').forEach(b=>b.addEventListener('click',()=>customSheet(+b.dataset.ci)));
  /* строка «Своё»: «шаурма 650» - название и калории */
  const line=box.querySelector('[data-line]'), err=box.querySelector('[data-lineerr]');
  const addLine=()=>{
    const r=parseOwn(line.value);
    if(r.err){ line.classList.add('err'); err.hidden=false; err.textContent=r.err; return; }
    foodDraft=''; addCustom({name:r.name, k:r.k, p:0, f:0, c:0});
  };
  line.addEventListener('input',()=>{ foodDraft=line.value; line.classList.remove('err'); err.hidden=true; });
  line.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addLine(); } });
  box.querySelector('[data-add]').addEventListener('click',addLine);
  box.querySelector('[data-more]').addEventListener('click',()=>{
    const r=parseOwn(line.value), s=line.value.trim(), m=/^(.*?)[\s,;:=-]*(\d+)?\s*$/.exec(s);
    ownFoodSheet(r.err ? {name:(m&&m[1]||s).trim()} : {name:r.name, k:r.k});
  });
}
