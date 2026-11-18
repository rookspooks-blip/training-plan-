"use strict";
/* ############################################################
   17 · IPHONE: ЗАДАЧИ, РЕЗЕРВНАЯ КОПИЯ, УСТАНОВКА, ОФЛАЙН
   ############################################################ */
/* Версия — видна в «Настройках и данных», чтобы проверить, что обновление пришло */
const APP_VERSION='новый дизайн: «Сейчас», «Еда», плеер';
/* Номер сборки — тот же, что VERSION в sw.js (тест сверяет). По нему приложение понимает, что открыта старая копия */
const BUILD='v83';

/* Цели и цифры — из заметки sport.md (обновлено 30.09.2026) */
const NOW={
  updated:'30.09.2026',
  phase:[
    ['Этап','Цикл 1 — сушка, рестарт с недели 1 в пн 05.10'],
    ['Питание','2600 ккал · Б165 · Ж78 · У310'],
    ['К неделе 12','72–73 кг, талия −5 см, ~12 % жира'],
    ['Темп','−0,3…0,6 кг в неделю, не быстрее 0,7']
  ],
  /* реально / отлично — по ресерчу справки: темп набора мышц у среднего уровня
     0,4–0,75 кг в месяц (Aragon, McDonald), прирост приседа +35 кг за полгода — верх */
  goals:[
    ['Присед','реально 120–135 × 5 · отлично 135–145'],
    ['Трэп-тяга','реально 140–160 × 5 · отлично 155–170'],
    ['Жим стоя','52–58 × 5'],
    ['Подтягивания','реально 14–18 · отлично 18–20'],
    ['Состав тела','реально 77–79 кг, 11–13 % · отлично 79–81 кг, 10–11 %'],
    ['Прыжок','хорошо +10–15 % к первому замеру · отлично +20 %'],
    ['3/4 площадки','−0,2–0,3 с от первого замера']
  ],
  results:[
    ['Подтягивания','8 чистых (было 5)'],
    ['60 м','8.1 с — перезамер не раньше чем через 4 нед.'],
    ['Велотренажёр','28 мин, ср. пульс 143, пик 159'],
    ['Вес','74–78 кг — смотри среднее за 7 дней']
  ],
  todo:[
    ['t1','Перемерить талию и бедро утром натощак (талия в двух местах: самое узкое и по пупку)'],
    ['t2','Купить напольные весы и контейнеры (5–6 шт) — ~3 тыс ₽'],
    ['t3','Сходить к ортопеду: оценить стопу и подобрать стельки (готовые с поддержкой свода — нормальный старт)'],
    ['t4','Заменить сэндвичи на «юрский набор», убрать «мега сыр»'],
    ['t5','Записывать утренний пульс лёжа и самочувствие 1–10 после тренировки'],
    ['t6','Перезамерить 60 м через 4 недели — свежим, первым делом после разминки'],
    ['t7','Стоит сходить к эндокринологу: поздний пубертат, мягкость под сосками. Рентген кисти на костный возраст, анализы — по его назначению'],
    ['t8','Замерить спринт 3/4 площадки свежим — точка отсчёта для цели']
  ]
};
let todo=store.get('planTodo',{});

/* Резервная копия: всё, что приложение хранит, — ключи plan*. Значение, которое не разобралось как JSON,
   не выбрасываем: его строка идёт отдельно в bad и вернётся при восстановлении как есть.
   schema — номер формата, который реально стоит в хранилище (миграция могла не пройти) */
function makeBackup(){
  const data={}, bad={};
  DATA_KEYS.forEach(k=>{ const v=ls.get(k); if(v==null) return; try{ data[k]=JSON.parse(v); }catch(e){ bad[k]=v; } });
  const b={app:'tri-cikla', version:1, schema:schemaOf(ls.get('planSchema')), saved:new Date().toISOString(), data};
  if(Object.keys(bad).length) b.bad=bad;
  return b;
}
async function exportBackup(){
  const json=JSON.stringify(makeBackup());
  const d=new Date();
  const name=`plan-backup-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`;
  const file=new File([json], name, {type:'application/json'});
  /* На iPhone — системное меню: «Сохранить в Файлы», Telegram, AirDrop */
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:'Резервная копия плана'}); markBackup(); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  markBackup();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(file); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
/* Когда последний раз сохранял копию: напоминание раз в 7 дней */
const markBackup=()=>store.set('planLastBackup', isoDay());
function backupDue(){
  const last=store.get('planLastBackup', null);
  const hasData=Object.keys(marks).length || Object.keys(logs).length || Object.keys(body).length;
  if(!hasData) return null;
  if(!last) return {days:null};
  const d=daysBetween(last, isoDay());
  return d>=7 ? {days:d} : null;
}
/* Полная замена данных копией: ключей, которых нет в копии, после восстановления тоже нет.
   Порядок: копия текущих данных в planPreOp (обязательна, проверяется чтением) → замена → при сбое посередине
   автоматический возврат из planPreOp. Результат:
   'ok'     — восстановлено;
   'bad'    — это не копия;
   'nocopy' — копию текущих данных записать не вышло, ничего не изменено;
   'full'   — замена не дописалась, данные возвращены как были;
   'broken' — замена не дописалась и возврат тоже; копия текущих данных лежит в planPreOp.
   b — файл копии или слот автокопии; opts.src={key,str} — слот, из которого восстанавливаем */
function restoreData(b, reason, opts){
  if(!b || b.app!=='tri-cikla') return 'bad';
  const src=slotRaw(b);
  if(!src || !Object.keys(src).length) return 'bad';
  const schema=normSchema(b.schema);
  const pre=makePreOp(reason||'перед восстановлением', opts && opts.src && opts.src.key);
  if(!pre.ok) return 'nocopy';
  if(!applyRaw(src, String(schema))){
    const back=rollbackRaw(pre);
    /* слот, из которого восстанавливали, был planPreOp: он теперь занят копией текущих данных, возвращаем его содержимое */
    if(back && opts && opts.src && opts.src.key===KEY_PREOP) ls.put(KEY_PREOP, opts.src.str);
    return back ? 'full' : 'broken';
  }
  /* служебное состояние чужих данных: таймер, прошлый сдвиг. Данные формата 4 и новее уже привязаны к числам */
  ls.del('planLive'); ls.del('planShiftFix');
  if(schema>=4) ls.put('planShiftChecked','true');
  return 'ok';
}
/* Что сказать пользователю, когда операция с копией не выполнена (restoreData, wipeData) */
function opFailText(res, what){
  return res==='nocopy' ? `Не получилось записать копию текущих данных: в памяти телефона не хватает места. ${what} не выполнено, ничего не изменено. Сохрани файл копии, он не зависит от места в приложении.`
    : res==='full' ? `${what} не дописалось: не хватило памяти телефона. Данные возвращены как были, ничего не потеряно.`
    : `${what} не дописалось, и вернуть данные автоматически тоже не вышло. Копия текущих данных лежит в «Вернуть копию» (слот «Копия перед…»). Не удаляй приложение и не очищай данные Safari.`;
}
function afterRestore(res){
  if(res==='ok'){ toast('Данные восстановлены'); setTimeout(()=>location.reload(),700); }
  else if(res==='bad') toast('Это не файл резервной копии');
  else opFailSheet('Восстановление не выполнено', opFailText(res,'Восстановление'));
}
/* «Удалить все данные»: тот же порядок, что у восстановления */
function wipeData(){
  const pre=makePreOp('перед удалением всех данных');
  if(!pre.ok) return 'nocopy';
  const ui=['planTab','planOnboarded','planLastBackup'], uiRaw={}; ui.forEach(k=>{ const v=ls.get(k); if(v!=null) uiRaw[k]=v; });
  let ok=true;
  [...ALL_KEYS(), ...ui].forEach(k=>{ if(!ls.del(k)) ok=false; });
  if(!ok){
    const back=rollbackRaw(pre);
    Object.keys(uiRaw).forEach(k=>ls.put(k,uiRaw[k]));
    return back ? 'full' : 'broken';
  }
  ls.del('planLive'); ls.del('planShiftFix');
  return 'ok';
}
function importBackup(file){
  const r=new FileReader();
  r.onload=()=>{
    let b=null;
    try{ b=JSON.parse(r.result); }catch(e){}
    afterRestore(restoreData(b, 'перед восстановлением из файла'));
  };
  r.readAsText(file);
}
/* Установлено ли на экран «Домой» */
const isStandalone = window.navigator.standalone===true || matchMedia('(display-mode: standalone)').matches;

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

/* Старая копия: iPhone держит приложение «Домой» в памяти и не перезагружает страницу сам.
   Раз в минуту при возврате на экран сверяем номер сборки на сервере; отличается — плашка «Обновить» */
async function serverBuild(){
  try{
    const t=await (await fetch('sw.js',{cache:'no-store'})).text();
    const m=t.match(/VERSION\s*=\s*'(v\d+)'/); return m?m[1]:null;
  }catch(e){ return null; }
}
async function hardReload(){
  try{
    const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister()));
    const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k)));
  }catch(e){}
  location.replace(location.pathname+'?v='+Date.now());
}
let updBarShown=false, lastBuildCheck=0;
async function checkBuild(force){
  if(!location.protocol.startsWith('http')) return false;
  if(!force && Date.now()-lastBuildCheck<60000) return false;
  lastBuildCheck=Date.now();
  const sv=await serverBuild();
  if(!sv || sv===BUILD) return false;
  if(updBarShown) return true; updBarShown=true;
  const bar=document.createElement('div'); bar.id='updbar'; bar.setAttribute('role','status');
  bar.innerHTML=`<span>Вышла новая версия (${sv}), у тебя ${BUILD}</span><button type="button">Обновить</button>`;
  bar.querySelector('button').addEventListener('click',hardReload);
  document.body.appendChild(bar); return true;
}
window.addEventListener('load',()=>setTimeout(()=>checkBuild(true),1500));
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkBuild(); });

/* Новый день: приложение на iPhone может неделями висеть в памяти,
   поэтому при возврате на экран перерисовываем «сегодня» */
let lastDay=todayIdx();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible') return;
  autoRotate();   /* приложение висит в памяти днями: ежедневная автокопия при возврате на экран */
  if(todayIdx()!==lastDay || applyAuto()){ lastDay=todayIdx(); foodDay=lastDay; selDow=new Date().getDay(); loadFoodDay(); renderAll(); }
});
