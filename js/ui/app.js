"use strict";
/* ############################################################
   СБОРКА: вкладки, страницы, строки статуса, первый запуск
   ############################################################ */

/* ---------- Строка статуса: только когда есть что сказать ---------- */
function statusNotes(){
  const info=weekInfo(), out=[];
  if(info.shift) out.push({lvl:'i', html:`<b>Прогрессия сдвинута на ${info.shift} ${plural(info.shift,'неделю','недели','недель')}</b>Пропущенные силовые не выкинуты — веса догоняют, выровняется на разгрузке.`});
  if(settings.auto && settings.start && daysBetween(isoDay(), settings.start)>0)
    out.push({lvl:'i', html:`<b>Старт плана — пн ${shortDate(settings.start)}</b>До него можно осмотреться и сделать первый замер прыжка.`});
  if(/План пройден/.test(info.label)) out.push({lvl:'i', html:`<b>${info.label}</b>${info.where}.`});
  const sm=summerMode();
  if(sm) out.push({lvl:'y', html:{exam:'<b>Летняя сессия</b>Как зимняя: две короткие силовые и прыжки, подходов вдвое меньше, вес без прибавки.',
    practice:'<b>Практика</b>Тренировки вечером, физры нет — скоростные на свежих ногах.',
    vacation:'<b>Каникулы — главный блок года</b>Пн, Ср, Пт — «высокие» дни: утром скорость, вечером ноги. В цикле 3 — сила и прыжок, а не масса.'}[sm]});
  if(info.kind==='deload') out.push({lvl:'g', html:'<b>Разгрузка</b>Меньше подходов и веса — так закрепляется рост прошлых недель.'});
  if(earlyDlOn()) out.push({lvl:'g', html:'<b>Досрочная разгрузка на этой неделе</b>Подходов вдвое меньше, вес ~90 %, скорость в полную силу. <button type="button" class="link" data-early="0">Отменить</button>'});
  else { const E=earlyDlSignal(); if(E) out.push({lvl:'y', html:`<b>Похоже, пора разгрузиться раньше</b>${E.why} — нервная система не успевает восстановиться. Плановые разгрузки остаются как были. <button type="button" class="link" data-early="1">Сделать эту неделю разгрузочной</button>`}); }
  if(info.kind==='test') out.push({lvl:'i', html:'<b>Тестовая неделя</b>Замеры на свежую голову: прыжок, тесты, рабочие максимумы.'});
  return out;
}

/* Кнопка в строке статуса: досрочная разгрузка включается и отменяется здесь */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-early]'); if(!b) return;
  const on=b.dataset.early==='1';
  setEarlyDl(on); renderAll();
  toast(on?'Эта неделя — разгрузочная':'Досрочная разгрузка отменена', ()=>{ setEarlyDl(!on); renderAll(); });
});

/* ---------- Вкладки: рисуем видимую, остальные — при переходе ---------- */
const TABS=['now','plan','food','me'];
const TAB_ALIAS={today:'now', prog:'me', body:'me', ref:'me', plan:'plan', food:'food', now:'now', me:'me'};
const TAB_RENDER={now:()=>renderNowScreen(), plan:()=>renderWeekTab(), food:()=>renderFoodTab(), me:()=>renderMe()};
const dirty=new Set(TABS);
const curTab=()=>document.body.dataset.tab||'now';
/* keep — переход «в тот день»: «Еда» не сбрасывает выбранный день, «Сейчас» перерисовывается под него */
function goTab(name, keep){
  name=TAB_ALIAS[name]||'now';
  if(name==='food' && curTab()!=='food' && !keep){ foodDay=todayIdx(); loadFoodDay(); dirty.add('food'); }
  if(name==='food' && keep) dirty.add('food');
  if(name==='now' && keep) dirty.add('now');
  store.set('planTab', name);
  document.body.dataset.tab=name;
  TABS.forEach(t=>{ $(`#scr-${t}`).hidden = t!==name; });

  $$('#tabbar [data-go]').forEach(b=>{ b.classList.toggle('on', b.dataset.go===name); b.setAttribute('aria-current', b.dataset.go===name?'page':'false'); });
  if(pageStack.length) closePage(true);
  if(dirty.has(name)){ dirty.delete(name); TAB_RENDER[name](); }
  enterFx($(`#scr-${name}`));
  window.scrollTo(0,0);
}
function renderAll(){
  TABS.forEach(t=>dirty.add(t));
  const t=curTab(), box=$(`#scr-${t}`);
  const prev=$$('.ck', box).map(e=>e.classList.contains('on'));
  box.classList.remove('enter');   /* перерисовка после нажатия не запускает вход заново */
  dirty.delete(t); TAB_RENDER[t]();
  popNewChecks(box, prev);
  updateMini(); plRefresh(); updateBadge();
}
$$('#tabbar [data-go]').forEach(b=>b.addEventListener('click',()=>{
  /* вкладка «Сейчас» из нижней панели — всегда сегодня */
  if(b.dataset.go==='now' && nowDay!=null){ nowDay=null; nowPick=null; dirty.add('now'); if(curTab()==='now'){ goTab('now'); return; } }
  if(b.dataset.go===curTab() && !pageStack.length){ window.scrollTo({top:0, behavior:'smooth'}); return; }
  goTab(b.dataset.go);
}));

/* ---------- Страницы второго уровня: Библиотека, Настройки, все блюда ---------- */
const pageStack=[];
function openPage(title, htmlFn, bind){
  const el=$('#page');
  if(pageStack.length) pageStack[pageStack.length-1].y=el.scrollTop;
  closeSheets();
  pageStack.push({title, htmlFn, bind, y:0});
  drawPage();
  if(!reducedMotion()){ el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
}
function drawPage(){
  const p=pageStack[pageStack.length-1], el=$('#page');
  if(!p){ el.hidden=true; el.innerHTML=''; if(!sheetStack.length && $('#player').hidden) document.body.classList.remove('locked'); return; }
  el.hidden=false; document.body.classList.add('locked');
  el.innerHTML=`<div class="pghd"><button type="button" class="icbtn" data-back aria-label="Назад">${IC.back}</button><div class="h2">${esc(p.title)}</div></div><div class="wrap" data-body style="padding-bottom:30px">${p.htmlFn()}</div>`;
  el.querySelector('[data-back]').addEventListener('click',()=>closePage());
  const body=el.querySelector('[data-body]');
  const redraw=()=>{ const y=el.scrollTop; body.innerHTML=p.htmlFn(); if(p.bind) p.bind(body, redraw); el.scrollTop=y; };
  if(p.bind) p.bind(body, redraw);
  el.scrollTop=p.y||0;
}
function closePage(all){ if(all) pageStack.length=0; else pageStack.pop(); drawPage(); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !sheetStack.length && pageStack.length) closePage(); });

/* ---------- Подсказка установки: только iPhone в Safari и только пока не установлено ---------- */
function renderInstallHint(){
  const box=$('#installSlot'); if(!box) return;
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if(isStandalone || !ios || store.get('planHintOff',false) || location.protocol==='file:'){ box.innerHTML=''; return; }
  box.innerHTML=`<div class="install"><div class="grow">Поставь план на экран «Домой» — откроется как приложение и будет работать без интернета: нажми ${IC.share} <b>Поделиться</b> внизу Safari, потом <b>«На экран Домой»</b>.</div>
    <button type="button" class="del" data-x aria-label="Скрыть">×</button></div>`;
  box.querySelector('[data-x]').addEventListener('click',()=>{ store.set('planHintOff',true); box.innerHTML=''; });
}

/* ---------- Первый запуск: три шага ---------- */
let onbForce=false;
function renderOnboard(){
  const box=$('#onbSlot'); if(!box) return;
  const empty=!Object.keys(logs).length && !Object.keys(marks).length && !Object.keys(body).length
    && !Object.values(foodLog).some(d=>d && (Object.values(d.dishOn||{}).some(Boolean) || (d.custom||[]).length));
  if(!onbForce && (!empty || store.get('planOnboarded',false))){ box.innerHTML=''; return; }
  box.innerHTML=`<div class="onb"><h3>Как пользоваться</h3><ol>
      <li>${settings.auto?`<b>Неделя выбирается по дате.</b> Старт плана — ${planDates().start}.`:'<b>Неделя выбрана вручную.</b> По дате — включи в настройках.'} Поменять — «Я» → «Настройки и данные».</li>
      <li><b>В день тренировки</b> нажми «Начать тренировку». Плеер покажет подход и вес — жми «Готово». Вес на следующий раз подберётся сам.</li>
      <li><b>Утром</b> — замер здесь же: вес, пульс, колено, поясница и пах 0–10. По ним план подстраивается.</li></ol>
    <button type="button" class="btn big" data-ok>Понятно</button></div>`;
  box.querySelector('[data-ok]').addEventListener('click',()=>{ store.set('planOnboarded',true); onbForce=false; box.innerHTML=''; });
}

/* ---------- Старт ---------- */
loadAll();
applyTheme();
{ const t=store.get('planTab','now'); document.body.dataset.tab=TAB_ALIAS[t]||'now'; goTab(TAB_ALIAS[t]||'now'); }
updateMini();
persistStorage();
importFromLocation();
updateBadge();
