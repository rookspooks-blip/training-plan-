"use strict";
/* ############################################################
   НАСТРОЙКИ И ДАННЫЕ
   Тема · неделя и даты · выгрузки · резервная копия · календарь ·
   о приложении. Всё, что было в окне недели, «Данных» и «Выгрузке».
   ############################################################ */
let exDate=null;
let setCycle=null;   /* какой цикл раскрыт в выборе недели */

function settingsHTML(){
  const auto=asObj(store.get('planAutoBackup',null),null);
  const customDates = settings.start!==SETTINGS_DEFAULT.start || (settings.session|0)!==SETTINGS_DEFAULT.session;
  const last=store.get('planLastBackup', null), due=backupDue();
  const c=setCycle||state.cycle, mw=maxWeek(c);
  let weeks='';
  for(let w=1; w<=mw; w++){
    const k=weekKind(c,w), fl=(k==='deload'||k==='test')?'dl':(k==='session'?'ss':'');
    weeks+=`<button type="button" class="${fl}${state.cycle===c&&state.week===w?' on':''}" data-w="${w}" aria-label="Неделя ${k==='session'?'сессии '+(w-12):w}">${k==='session'?'С'+(w-12):w}</button>`;
  }
  const th=settings.theme||'auto';
  return `
    <div class="sec">Оформление</div>
    <div class="card"><div class="seg" data-theme>${[['auto','Как в iPhone'],['light','Светлая'],['dark','Тёмная']].map(([v,t])=>`<button type="button" class="${th===v?'on':''}" data-v="${v}">${t}</button>`).join('')}</div>
      <div class="small muted" style="margin-top:8px">Светлая — «Чистый лист», тёмная — «Табло». «Как в iPhone» переключает сама.</div></div>

    <div class="sec" id="set-week">Неделя и даты</div>
    <div class="card"><div class="small t2" style="margin-bottom:6px">Меняет всё приложение: веса, разминку, калории, кардио и сон.</div>
      <div class="set-row"><span class="grow"><b>Неделя по дате</b><span>${settings.auto?'приложение само переключает неделю':'выбрана вручную'}</span></span><label class="switch"><input type="checkbox" data-auto ${settings.auto?'checked':''} aria-label="Неделя по дате"><i></i></label></div>
      <div class="set-row" style="display:block;padding:10px 0">
        <div class="seg" data-cyc>${[1,2,3].map(x=>`<button type="button" class="${x===c?'on':''}" data-c="${x}">Цикл ${x}</button>`).join('')}</div>
        <div class="small t2" style="margin-top:8px">${c===1?'Сушка, свой вес, связки · 12 недель + сессия':c===2?'Абсолютная сила, штанга · 12 недель':'Гипертрофия и реконверсия · 24 недели'}</div>
        <div class="wpick">${weeks}</div>
        <div class="small muted" style="margin-top:6px">Жёлтая рамка — разгрузка или тест, синяя — сессия.</div></div>
      <div class="set-row"><span class="grow"><b>Старт плана</b><span>понедельник недели 1</span></span><input type="date" data-start value="${esc(settings.start)}" aria-label="Старт плана"></div>
      <div class="set-row"><span class="grow"><b>Сессионный блок</b><span>недель после сушки, до цикла 2 · 0–8</span></span><span class="stepper"><button type="button" data-ses="-1" aria-label="Меньше">−</button><b class="n">${settings.session|0}</b><button type="button" data-ses="1" aria-label="Больше">+</button></span></div>
      <div class="set-row"><span class="grow"><b>Практика летом до</b><span>после неё — каникулы до 31 августа</span></span><input type="date" data-prac value="${esc(summerDates().practiceEnd)}" aria-label="Конец практики"></div>
    </div>

    <div class="sec">Выгрузки</div>
    <div class="card"><div class="t2" style="margin-bottom:10px">Всё, что записано за день: замеры, тренировка с подходами, еда с временем и граммами, итоги.</div>
      <div class="exnav"><button type="button" class="btn" data-exd="-1" aria-label="Предыдущий день">‹</button><input type="date" data-exdate value="${exDate}" aria-label="День"><button type="button" class="btn" data-exd="1" aria-label="Следующий день">›</button></div>
      <pre class="expre" style="margin-top:10px" data-pre></pre>
      <div class="btnrow"><button type="button" class="btn pri" data-excopy>Скопировать</button><button type="button" class="btn" data-exshare>Поделиться</button></div>
      <button type="button" class="btn" style="margin-top:10px" data-exjson>День · JSON</button>
      <div class="sec" style="margin-top:18px">Все дни</div>
      <div class="btnrow" style="margin-top:0"><button type="button" class="btn" data-csv>Таблица CSV</button><button type="button" class="btn" data-alljson>Всё в JSON</button></div>
      <button type="button" class="btn" style="margin-top:10px" data-report>Отчёт за неделю</button>
      <div class="small muted" style="margin-top:10px">CSV открывается в Numbers и Excel: по строке на день, колонки — калории, белок, время первого и последнего приёма, тоннаж, вес, пульс, колено, пах. «Поделиться» отправляет в Telegram, Файлы, почту.</div></div>

    <div class="sec">Импорт из «Здоровья»</div>
    <div class="card"><p class="t2">Вес, пульс, сон и данные тренировки с часов можно не вводить: команда на iPhone достаёт их из «Здоровья» и копирует строкой, а здесь — одно нажатие.</p>
      <button type="button" class="btn big pri" data-health>Вставить из «Здоровья»</button>
      <details class="lx" style="margin-top:12px"><summary><b>Как настроить команду</b><span>один раз</span></summary>
        <ol class="small t2" style="padding-left:20px">
          <li>«Команды» → «+» → «Найти образцы Здоровья»: тип «Масса тела», сначала новые, лимит 1.</li>
          <li>Так же для «Пульс в покое» и для сна («Время во сне»: сумма за прошлую ночь в часах).</li>
          <li>Для тренировки: «Найти тренировки», последняя → начало и конец в виде <b>ЧЧ:ММ</b>, активные ккал, средний пульс.</li>
          <li>«Текст» из этих значений в виде <b>${HEALTH_SAMPLE}</b>, затем «Скопировать в буфер обмена».</li>
          <li>Запускай команду утром (можно автоматизацией «Когда выключу будильник»), потом открой приложение и нажми кнопку выше.</li>
        </ol>
        <p class="small muted">Пропущенные поля можно не писать. <b>d=2026-10-22</b> — другая дата. Пульс «в покое» из «Здоровья» близок к пульсу лёжа, но не тот же: сравнивай только со своими же числами. Названия действий в «Командах» зависят от версии iOS.</p>
        <button type="button" class="btn" data-sample>Скопировать пример строки</button>
      </details></div>

    <div class="sec">Резервная копия</div>
    <div class="card">
      <div class="note ${due?'y':'g'}" style="margin-bottom:12px"><b>${last?`Последняя копия: ${shortDate(last)}${due&&due.days!=null?` — ${due.days} ${plural(due.days,'день','дня','дней')} назад`:''}`:'Копий ещё не было'}</b>${due?'Сохрани копию — раз в неделю хватает.':'Напомню через 7 дней.'}</div>
      <p class="t2">Тренировки, еда, замеры и выбранная неделя хранятся <b>только на этом телефоне</b>, внутри приложения. Интернет для работы не нужен.</p>
      <p class="t2">Приложение на экране «Домой» и сайт в Safari хранят данные <b>раздельно</b>. Отмечай всё в приложении, а раз в неделю сохраняй копию: она спасёт при смене телефона или удалении иконки.</p>
      <div class="btnrow"><button type="button" class="btn pri" data-backup>Сохранить копию</button><button type="button" class="btn" data-restore>Восстановить</button></div>
      <input type="file" data-file accept="application/json,.json" hidden>
      ${auto?`<div class="small muted" style="margin-top:10px">Автокопия от ${esc(new Date(auto.saved).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}))} — ${esc(auto.reason||'')}. <button type="button" class="link" data-auto-back>Вернуть её</button></div>`:''}
      <div class="small muted" style="margin-top:10px">«Сохранить копию» открывает меню iPhone: выбери «Сохранить в Файлы» или отправь себе в Telegram. «Восстановить» — выбери этот файл, текущие данные заменятся.</div>
      ${badgeSupported() && isStandalone && 'Notification' in window && Notification.permission==='default' ? `<button type="button" class="btn" style="margin-top:12px" data-badge>Значок на иконке, когда пора сохранить копию</button>` : ''}
      <button type="button" class="btn danger" style="margin-top:12px" data-wipe>Удалить все данные с телефона</button></div>

    <div class="sec">Календарь iPhone</div>
    <div class="card"><p class="t2">Тренировки сушки и сессионного блока (с ${shortDate(settings.start)}), напоминание взвеситься каждое утро — в стандартный Календарь iPhone. За 30 минут до тренировки придёт уведомление.</p>
      <div class="btnrow"><a class="btn" style="text-decoration:none" data-sub href="plan.ics">Подписаться</a><button type="button" class="btn" data-ics>Скачать .ics</button></div>
      ${customDates?`<div class="note y" style="margin-top:10px"><b>Свои даты</b>У тебя своя дата старта или длина сессии. «Подписаться» ведёт на общий календарь с датами по умолчанию — бери «Скачать .ics»: он собран по твоим датам.</div>`:''}
      <div class="small muted" style="margin-top:10px">«Подписаться» добавляет календарь, который обновляется сам. Если перенёс тренировку в приложении, в календаре она останется на старом месте — календарь только напоминает.</div></div>

    <div class="sec">О приложении</div>
    <div class="card small t2"><p>Версия: <b>${APP_VERSION}</b>. Если обновление вышло, а тут старая версия — закрой приложение смахиванием и открой через пару минут.</p>
      <p>Фото упражнений — <a href="https://github.com/yuhonas/free-exercise-db" style="color:inherit">free-exercise-db</a>, общественное достояние (Unlicense).</p>
      <button type="button" class="link" data-onb>Показать подсказку «Как пользоваться»</button></div>`;
}

function openSettings(focus){
  if(!exDate) exDate=isoDay();
  setCycle=state.cycle;
  openPage('Настройки и данные', settingsHTML, (el, redraw)=>{
    const on=(sel,ev,f)=>el.querySelectorAll(sel).forEach(b=>b.addEventListener(ev,()=>f(b)));
    /* тема */
    on('[data-theme] [data-v]','click',b=>{ settings.theme=b.dataset.v; saveSettings(); applyTheme(); redraw(); });
    /* неделя */
    on('[data-auto]','change',b=>{
      settings.auto=b.checked; saveSettings();
      if(settings.auto){ applyAuto(); foodDay=todayIdx(); loadFoodDay(); toast('Неделя снова по дате'); }
      setCycle=state.cycle; renderAll(); redraw();
    });
    on('[data-cyc] [data-c]','click',b=>{ setCycle=+b.dataset.c; redraw(); });
    on('.wpick [data-w]','click',b=>{ const w=+b.dataset.w, c=setCycle, wasAuto=settings.auto; setWeekManual(c,w); if(!wasAuto || settings.auto) toast(`Открыта ${weekTitle(c,w).toLowerCase()}, цикл ${c}`); redraw(); });
    on('[data-start]','change',b=>{ if(!b.value) return; settings.start=b.value; saveSettings(); if(settings.auto) applyAuto(); setCycle=state.cycle; renderAll(); redraw(); });
    on('[data-ses]','click',b=>{
      settings.session=Math.max(0, Math.min(8, (settings.session|0)+(+b.dataset.ses))); saveSettings();
      if(state.cycle===1 && state.week>maxWeek(1)){ state.week=maxWeek(1); savePos(); }
      if(settings.auto) applyAuto(); renderAll(); redraw();
    });
    on('[data-prac]','change',b=>{ if(!b.value) return; settings.practiceEnd=b.value; saveSettings(); renderAll(); redraw(); });
    /* выгрузки */
    const pre=el.querySelector('[data-pre]'), di=el.querySelector('[data-exdate]');
    let D=null;
    const show=()=>{ D=dayExport(exDate); pre.textContent=dayText(D); };
    on('[data-exd]','click',b=>{ exDate=addDays(exDate,+b.dataset.exd); di.value=exDate; show(); });
    di.addEventListener('change',()=>{ if(di.value){ exDate=di.value; show(); } });
    on('[data-excopy]','click',async()=>{ toast(await copyText(pre.textContent)?'Скопировано':'Не удалось скопировать — выдели текст вручную'); });
    on('[data-exshare]','click',()=>{ if(navigator.share) navigator.share({text:pre.textContent}).catch(()=>{}); else shareFile(`den-${exDate}.txt`, pre.textContent, 'text/plain', 'День '+exDate); });
    on('[data-exjson]','click',()=>shareFile(`den-${exDate}.json`, JSON.stringify(D,null,1), 'application/json', 'День '+exDate));
    on('[data-csv]','click',()=>{
      const rows=allDays().map(dayRow);
      if(!rows.length){ toast('Пока нечего выгружать'); return; }
      const csv='﻿'+[CSV_COLS,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
      shareFile(`tri-cikla-dni-${isoDay()}.csv`, csv, 'text/csv', 'Три цикла · все дни');
    });
    on('[data-alljson]','click',()=>{
      const days=allDays();
      if(!days.length){ toast('Пока нечего выгружать'); return; }
      shareFile(`tri-cikla-dni-${isoDay()}.json`, JSON.stringify({app:'tri-cikla', exported:new Date().toISOString(), days},null,1), 'application/json', 'Три цикла · все дни');
    });
    on('[data-report]','click',async()=>{ const ok=await copyText(buildReport()); toast(ok?'Отчёт за неделю скопирован':'Не вышло скопировать — открой отчёт в «Плане»'); });
    show();
    /* Здоровье, значок */
    on('[data-health]','click',pasteHealth);
    on('[data-sample]','click',async()=>{ toast(await copyText(HEALTH_SAMPLE)?'Пример скопирован':'Не удалось скопировать'); });
    on('[data-badge]','click',async()=>{ await enableBadge(); redraw(); });
    /* копия */
    on('[data-backup]','click',async()=>{ await exportBackup(); renderAll(); redraw(); });
    const inp=el.querySelector('[data-file]');
    on('[data-restore]','click',()=>inp.click());
    inp.addEventListener('change',async()=>{
      const f=inp.files[0]; inp.value=''; if(!f) return;
      if(await confirmSheet('Восстановить из файла?','Текущие данные заменятся данными из копии. Перед этим приложение сохранит автокопию — её можно вернуть здесь же.','Восстановить',true)) importBackup(f);
    });
    on('[data-auto-back]','click',async()=>{
      const auto=asObj(store.get('planAutoBackup',null),null); if(!auto) return;
      if(await confirmSheet('Вернуть автокопию?','Текущие данные заменятся данными из автокопии.','Вернуть',true)) afterRestore(restoreData(auto, null));
    });
    on('[data-wipe]','click',async()=>{
      if(!await confirmSheet('Удалить все данные?','Тренировки, еда, замеры, настройки. Перед удалением приложение сохранит автокопию — её можно будет вернуть здесь же.','Удалить всё',true)) return;
      snapshot('перед удалением всех данных');
      [...DATA_KEYS, ...LEGACY_KEYS, 'planTab','planOnboarded','planLastBackup'].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
      toast('Данные удалены'); setTimeout(()=>location.reload(),700);
    });
    /* календарь: webcal:// — подписка в Календаре iPhone */
    const sub=el.querySelector('[data-sub]');
    if(location.protocol==='https:') sub.href='webcal://'+location.host+location.pathname.replace(/[^/]*$/,'')+'plan.ics';
    on('[data-ics]','click',()=>shareFile('tri-cikla.ics', buildIcs(settings.start, settings.session), 'text/calendar', 'Три цикла · календарь'));
    on('[data-onb]','click',()=>{ store.set('planOnboarded',false); onbForce=true; closePage(true); goTab('now'); renderAll(); });
    if(focus==='week'){ const t=el.querySelector('#set-week'); if(t) requestAnimationFrame(()=>t.scrollIntoView({block:'start'})); }
  });
}
