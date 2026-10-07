"use strict";
/* ############################################################
   17 · IPHONE: ЗАДАЧИ, РЕЗЕРВНАЯ КОПИЯ, УСТАНОВКА, ОФЛАЙН
   ############################################################ */
/* Дата сборки — видна в «Справка → Данные», чтобы проверить, что обновление пришло */
const APP_VERSION='гантели в сплит-приседе с 5-й недели';
let toastTimer=0;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
}

/* Цели и цифры — из заметки sport.md (обновлено 30.09.2026) */
const NOW={
  updated:'30.09.2026',
  phase:[
    ['Этап','Цикл 1 — сушка, рестарт с недели 1 в пн 05.10'],
    ['Питание','2600 ккал · Б165 · Ж78 · У310'],
    ['К неделе 12','72–73 кг, талия −5 см, ~12 % жира'],
    ['Темп','−0,3…0,6 кг в неделю, не быстрее 0,7']
  ],
  goals:[
    ['Присед','135–145 × 5'],
    ['Трэп-тяга','155–170 × 5'],
    ['Жим стоя','52–58 × 5'],
    ['Подтягивания','18–20'],
    ['Состав тела','79–81 кг, 10–11 % жира']
  ],
  results:[
    ['Подтягивания','8 чистых (было 5)'],
    ['60 м','8.1 с — перезамер не раньше чем через 4 нед.'],
    ['Велотренажёр','28 мин, ср. пульс 143, пик 159'],
    ['Вес','74–78 кг — смотри среднее за 7 дней']
  ],
  todo:[
    ['t1','Перемерить талию и бедро утром натощак (талия в двух местах: самое узкое и по пупку)'],
    ['t2','Купить напольные весы, контейнеры (5–6 шт) и мячик для стопы — ~4 тыс ₽'],
    ['t3','Сходить к ортопеду за индивидуальными стельками (вальгус правой стопы)'],
    ['t4','Заменить сэндвичи на «юрский набор», убрать «мега сыр»'],
    ['t5','Записывать утренний пульс лёжа и самочувствие 1–10 после тренировки'],
    ['t6','Перезамерить 60 м через 4 недели — свежим, первым делом после разминки'],
    ['t7','По желанию: рентген кисти на костный возраст + IGF-1 и ТТГ у эндокринолога']
  ]
};
let todo=store.get('planTodo',{});

function renderNow(){
  const box=document.getElementById('nowBox');
  if(!box) return;
  const kv=rows=>`<dl class="kv">${rows.map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`;
  const left=NOW.todo.filter(t=>!todo[t[0]]).length;
  box.innerHTML=`
    <h5>Сейчас</h5>${kv(NOW.phase)}
    <h5>Цели года</h5>${kv(NOW.goals)}
    <h5>Последние результаты</h5>${kv(NOW.results)}
    <h5>Следующие шаги · осталось ${left} из ${NOW.todo.length}</h5>
    <ul class="todo">${NOW.todo.map(t=>`
      <li class="${todo[t[0]]?'done':''}">
        <button class="check" type="button" role="checkbox" aria-checked="${!!todo[t[0]]}" data-todo="${t[0]}" aria-label="${t[1]}"></button>
        <span class="todo-t">${t[1]}</span>
      </li>`).join('')}</ul>
    <p style="font-size:12.5px;color:var(--muted);margin-top:10px">Данные из заметки от ${NOW.updated}.</p>`;
  box.querySelectorAll('[data-todo]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.todo;
    todo[id]=!todo[id]; if(!todo[id]) delete todo[id];
    store.set('planTodo',todo); renderNow();
  }));
}

/* Резервная копия: всё, что приложение хранит, — ключи plan* */
function makeBackup(){
  const data={};
  DATA_KEYS.forEach(k=>{ try{ const v=localStorage.getItem(k); if(v!=null) data[k]=JSON.parse(v); }catch(e){} });
  return {app:'tri-cikla', version:1, schema:SCHEMA, saved:new Date().toISOString(), data};
}
async function exportBackup(){
  const json=JSON.stringify(makeBackup());
  const d=new Date();
  const name=`plan-backup-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`;
  const file=new File([json], name, {type:'application/json'});
  /* На iPhone — системное меню: «Сохранить в Файлы», Telegram, AirDrop */
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:'Резервная копия плана'}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  const a=document.createElement('a');
  a.href=URL.createObjectURL(file); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
/* Полная замена данных копией: ключей, которых нет в копии, после восстановления тоже нет */
function restoreData(b, reason){
  if(!b || b.app!=='tri-cikla' || !asObj(b.data)) return 'bad';
  const keys=[...DATA_KEYS, ...LEGACY_KEYS].filter(k=>k in b.data);
  if(!keys.length) return 'bad';
  if(reason) snapshot(reason);   /* текущие данные — в автокопию, чтобы можно было откатить */
  try{
    [...DATA_KEYS, ...LEGACY_KEYS].forEach(k=>localStorage.removeItem(k));
    keys.forEach(k=>localStorage.setItem(k, JSON.stringify(b.data[k])));
    /* старая копия пройдёт миграцию при перезапуске */
    localStorage.setItem('planSchema', JSON.stringify(b.schema||1));
  }catch(e){ return 'full'; }
  return 'ok';
}
function afterRestore(res){
  if(res==='ok'){ toast('Данные восстановлены'); setTimeout(()=>location.reload(),700); }
  else toast(res==='full' ? 'Не хватило памяти телефона для восстановления' : 'Это не файл резервной копии');
}
function importBackup(file){
  const r=new FileReader();
  r.onload=()=>{
    let b=null;
    try{ b=JSON.parse(r.result); }catch(e){}
    afterRestore(restoreData(b, 'перед восстановлением'));
  };
  r.readAsText(file);
}
/* Первый запуск: три пункта, как пользоваться. Показывается, пока нет ни одной записи */
function renderOnboard(){
  const box=document.getElementById('onboard');
  const empty=!Object.keys(logs).length && !Object.keys(marks).length && !Object.keys(body).length
    && !Object.values(foodLog).some(d=>d && (Object.values(d.dishOn||{}).some(Boolean) || (d.custom||[]).length));
  if(!empty || store.get('planOnboarded',false)){ box.innerHTML=''; return; }
  box.innerHTML=`<div class="onboard">
    <h3>Как пользоваться</h3>
    <ol>
      <li><b>Неделя выбирается по дате.</b> Старт плана — ${planDates().start}. Поменять — нажми на карточку недели сверху.</li>
      <li><b>В день тренировки</b> нажми «Начать тренировку» и записывай подходы: вес на следующий раз приложение подберёт само.</li>
      <li><b>Утром</b> во вкладке «Прогресс» — вес, колено и поясница 0–10. По ним план подстраивается.</li>
    </ol>
    <button type="button" class="btn btn-primary" id="obOk" style="width:100%">Понятно</button></div>`;
  box.querySelector('#obOk').addEventListener('click',()=>{ store.set('planOnboarded',true); box.innerHTML=''; });
}

function renderBackup(){
  const box=document.getElementById('backupBox');
  if(!box) return;
  const auto=asObj(store.get('planAutoBackup',null),null);
  const customDates = settings.start!==SETTINGS_DEFAULT.start || (settings.session|0)!==SETTINGS_DEFAULT.session;
  box.innerHTML=`
    <p>Галочки, дневник питания, переносы и выбранная неделя хранятся <b>только на этом телефоне</b>, внутри приложения. Интернет для работы не нужен.</p>
    <p>Приложение на экране «Домой» и сайт в Safari хранят данные <b>раздельно</b>. Отмечай всё в приложении, а раз в неделю сохраняй копию: она спасёт при смене телефона или удалении иконки.</p>
    <div class="btn-row">
      <button class="btn btn-primary" type="button" id="btnBackup">Сохранить копию</button>
      <button class="btn" type="button" id="btnRestore">Восстановить</button>
    </div>
    <input type="file" id="restoreFile" accept="application/json,.json" hidden>
    <button class="linkbtn danger" type="button" id="btnWipe" style="margin-top:12px">Удалить все данные с телефона</button>
    ${auto ? `<p style="font-size:12.5px;color:var(--muted);margin-top:10px">Автокопия от ${esc(new Date(auto.saved).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}))} — ${esc(auto.reason||'')}. <button class="linkbtn" type="button" id="btnAuto">Вернуть её</button></p>` : ''}
    <h5 style="margin-top:16px">Календарь</h5>
    <p>Тренировки сушки и сессионного блока (с ${shortDate(settings.start)}) и напоминания взвеситься — в стандартный Календарь iPhone. За 30 минут до тренировки придёт уведомление.</p>
    <div class="btn-row">
      <a class="btn" style="text-align:center;text-decoration:none" id="icsSub" href="plan.ics">Подписаться</a>
      <button class="btn" type="button" id="icsGet">Скачать .ics</button>
    </div>
    ${customDates ? `<p style="font-size:12.5px;color:var(--warn,#F5B841);margin-top:10px">У тебя своя дата старта или длина сессии. «Подписаться» ведёт на общий календарь с датами по умолчанию — бери «Скачать .ics»: он собран по твоим датам.</p>` : ''}
    <p style="font-size:12.5px;color:var(--muted);margin-top:10px">Фото упражнений — <a href="https://github.com/yuhonas/free-exercise-db" style="color:inherit">free-exercise-db</a>, общественное достояние (Unlicense).</p>
    <p style="font-size:12.5px;color:var(--muted);margin-top:10px">Версия приложения: <b>${APP_VERSION}</b>. Если я сказал, что обновил, а тут старая дата — закрой приложение смахиванием и открой через пару минут.</p>
    <p style="font-size:12.5px;color:var(--muted);margin-top:10px">«Подписаться» добавляет календарь, который обновляется сам. Если перенёс тренировку в приложении, в календаре она останется на старом месте — календарь только напоминает.</p>
    <p style="font-size:12.5px;color:var(--muted);margin-top:10px">«Сохранить копию» открывает меню iPhone: выбери «Сохранить в Файлы» или отправь себе в Telegram. «Восстановить» — выбери этот файл, текущие данные заменятся.</p>`;
  box.querySelector('#btnBackup').addEventListener('click', exportBackup);
  /* webcal:// — подписка в Календаре iPhone */
  if(location.protocol==='https:') box.querySelector('#icsSub').href='webcal://'+location.host+location.pathname.replace(/[^/]*$/,'')+'plan.ics';
  /* календарь по датам из настроек — та же функция, что собирает plan.ics */
  box.querySelector('#icsGet').addEventListener('click',()=>
    shareFile('tri-cikla.ics', buildIcs(settings.start, settings.session), 'text/calendar', 'Три цикла · календарь'));
  const inp=box.querySelector('#restoreFile');
  box.querySelector('#btnRestore').addEventListener('click',()=>inp.click());
  inp.addEventListener('change',()=>{ if(inp.files[0]) importBackup(inp.files[0]); inp.value=''; });
  box.querySelector('#btnWipe').addEventListener('click',()=>{
    if(!confirm('Удалить все записи: тренировки, еду, замеры, настройки? Перед удалением приложение сохранит автокопию — её можно будет вернуть здесь же.')) return;
    snapshot('перед удалением всех данных');
    [...DATA_KEYS, ...LEGACY_KEYS, 'planTab','planOnboarded'].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
    toast('Данные удалены'); setTimeout(()=>location.reload(),700);
  });
  const ab=box.querySelector('#btnAuto');
  if(ab) ab.addEventListener('click',()=>{
    if(confirm('Вернуть данные из автокопии? Текущие данные заменятся.')) afterRestore(restoreData(auto, null));
  });
}

/* Подсказка установки: только iPhone в Safari и только пока не установлено */
const isStandalone = window.navigator.standalone===true || matchMedia('(display-mode: standalone)').matches;
function renderInstallHint(){
  const box=document.getElementById('installHint');
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if(isStandalone || !ios || store.get('planHintOff',false) || location.protocol==='file:') return;
  box.innerHTML=`<div class="install">
    <div>Поставь план на экран «Домой», чтобы он открывался как приложение и работал без интернета: нажми
      <svg class="share-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 8l5-5 5 5M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8"/></svg>
      <b>Поделиться</b> внизу Safari, потом <b>«На экран Домой»</b>.</div>
    <button class="x" type="button" aria-label="Скрыть">×</button></div>`;
  box.querySelector('.x').addEventListener('click',()=>{ store.set('planHintOff',true); box.innerHTML=''; });
}

/* Офлайн: service worker кэширует приложение после первого открытия */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      reg.addEventListener('updatefound',()=>{
        const w=reg.installing;
        w && w.addEventListener('statechange',()=>{
          if(w.state==='installed' && navigator.serviceWorker.controller) toast('План обновлён — перезапусти приложение');
        });
      });
    }).catch(()=>{});
  });
}

/* Новый день: приложение на iPhone может неделями висеть в памяти,
   поэтому при возврате на экран перерисовываем «сегодня» */
let lastDay=todayIdx();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  if(todayIdx()!==lastDay || applyAuto()){ lastDay=todayIdx(); foodDay=lastDay; selDow=new Date().getDay(); loadFoodDay(); renderAll(); }
});
