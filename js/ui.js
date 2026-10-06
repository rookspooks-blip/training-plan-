"use strict";
/* ############################################################
   13 · ОСТАЛЬНЫЕ СЕКЦИИ
   ############################################################ */
function renderSleep(){
  const info=weekInfo();
  document.getElementById('sleepLede').textContent = info.kind==='deload'
    ? 'Разгрузочная неделя — восстановление важнее объёма.'
    : 'Делается каждый день, включая дни отдыха.';
  document.getElementById('sleepBox').innerHTML=sleepPlan();

  document.querySelectorAll('#habits .habit').forEach(h=>{
    const k=h.dataset.k, cb=h.querySelector('.check');
    cb.addEventListener('click',()=>{
      const now=!marks[k];
      if(now) marks[k]=true; else delete marks[k];
      cb.setAttribute('aria-checked',now?'true':'false');
      h.classList.toggle('done',now);
      saveMarks(); updateProgress();
    });
  });
}

/* ############################################################
   ВОССТАНОВЛЕНИЕ
   Растяжка, самомассаж, душ, ментальная часть, добавки.
   Состав зависит от дня: после силовой холод нельзя,
   после игры можно.
   ############################################################ */

const STRETCH=[
  {id:'s1', name:'Икроножная', dose:'30–45 сек на ногу', tech:'st_calf'},
  {id:'s2', name:'Камбаловидная', dose:'30–45 сек на ногу', tech:'st_soleus'},
  {id:'s3', name:'Квадрицепс', dose:'30–45 сек на ногу', tech:'st_quad'},
  {id:'s4', name:'Задняя поверхность бедра', dose:'30–45 сек на ногу', tech:'st_ham'},
  {id:'s5', name:'Ягодичная', dose:'30–45 сек на сторону', tech:'st_glute'},
  {id:'s6', name:'Сгибатели бедра', dose:'30–45 сек на сторону', tech:'st_hipflex'},
  {id:'s7', name:'Грудной отдел', dose:'30–45 сек', tech:'st_thoracic'}
];

const ROLL=[
  {id:'r1', name:'Икры', dose:'60 сек на ногу', tech:'roll_calf'},
  {id:'r2', name:'Квадрицепс', dose:'60 сек на ногу', tech:'roll_quad'},
  {id:'r3', name:'Боковая поверхность бедра', dose:'45 сек на сторону', tech:'roll_it'},
  {id:'r4', name:'Ягодичные', dose:'45 сек на сторону', tech:'roll_glute'},
  {id:'r5', name:'Задняя поверхность', dose:'45 сек на ногу', tech:'roll_ham'},
  {id:'r6', name:'Верх спины', dose:'60 сек', tech:'roll_back'},
  {id:'r7', name:'Стопа мячиком', dose:'1–2 мин на стопу', tech:'ball_foot'}
];

/* Список упражнений с раскрытием техники */
function recList(items, cls, prefix){
  return `<div class="recgrid">${items.map((x,i)=>{
    const t=TECH[x.tech]||{text:''};
    return `<div class="recitem ${cls}">
      <div class="rec-head" tabindex="0" role="button" aria-expanded="false">
        <div class="rec-n">${i+1}</div>
        <div class="rec-main">
          <div class="rec-name">${x.name}</div>
          <div class="rec-dose">${x.dose}</div>
        </div>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="fold"><div class="fold-inner"><div class="rec-body">
        ${t.fig?`<div class="fig">${S[t.fig]}</div>`:''}
        <div class="tech">${t.text}</div>
      </div></div></div>
    </div>`;
  }).join('')}</div>`;
}

/* Какой сегодня день: после силовой холод запрещён */
function todayKind(){
  const td=todayIdx();
  const w=buildWeek();
  const e=w.find(x=>(x.dow===0?6:x.dow-1)===td);
  if(!e) return 'rest';
  if(e.type==='gym') return e.id==='d2' ? 'speed' : 'strength';
  if(e.type==='run') return 'cardio';
  return 'rest';
}

function renderRecovery(){
  const kind=todayKind();
  document.getElementById('recLede').textContent =
    'Растяжка, самомассаж, душ и голова. Делается после тренировки или в отдельный день — не до.';

  const SHOWER = {
    strength:`<div class="warnbox"><b>Сегодня силовая — холод отменяется.</b>
      Холодное воздействие после силовой притупляет рост мышц: оно гасит воспалительный сигнал, а именно он запускает адаптацию. При твоей цели набора массы это прямой минус.
      <br><br>Сегодня только тёплый душ. Контрастный можно через 4–6 часов или завтра.</div>`,
    speed:`<div class="swapnote"><b>Сегодня скоростная — контрастный можно.</b>
      Прыжковая работа не про гипертрофию, гасить там нечего. После физры и спринтов контраст ускорит восстановление к субботе.</div>`,
    cardio:`<div class="swapnote"><b>Сегодня кардио — контрастный можно.</b> На аэробную адаптацию холод не влияет.</div>`,
    rest:`<div class="swapnote"><b>День отдыха — контрастный можно в полном объёме.</b></div>`
  };

  document.getElementById('recBox').innerHTML=`
    <div class="card"><h3>Растяжка · 8–10 минут</h3>
      <p>После тренировки, вечером или в дни отдыха. <b>Перед силовой статическую растяжку не делай</b> — она снижает силу на ближайший час. Перед тренировкой работает динамическая, она в разминке.</p>
      <p>Заходишь до ощущения натяжения, но не боли. Держишь 30–45 секунд, дышишь ровно, не пружинишь. Два подхода на зону.</p>
      <div class="warnbox"><b>Приводящие не растягивать никогда.</b> Никаких бабочек, разведений ног, попыток сесть на шпагат. Зона крепления и так раздражена, растяжение мешает ей укрепляться. Там работает только изометрия из ежедневного блока.</div>
    </div>
    <div class="sub" data-group><div class="sub-head" tabindex="0" role="button" aria-expanded="false">
      <span>Показать 7 упражнений</span>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
    </div><div class="fold"><div class="fold-inner"><div style="padding:12px 0 0">
      ${recList(STRETCH,'stretch','st')}
    </div></div></div></div>

    <div class="card"><h3>Самомассаж · 8–10 минут</h3>
      <p>Катишь медленно, два-три сантиметра в секунду. Нашёл болезненную точку — <b>останавливаешься на ней</b> и держишь 20–30 секунд, пока не отпустит примерно наполовину. Работает именно остановка, а не быстрое катание туда-сюда.</p>
      <p>Перед тренировкой можно коротко, по 20–30 секунд на зону: в отличие от статической растяжки, ролик силу не снижает.</p>
      <div class="warnbox"><b>Не катать:</b> поясницу (нет рёбер, чтобы принять давление), шею, подколенную ямку, пах, места прикрепления сухожилий к кости.</div>
    </div>
    <div class="sub" data-group><div class="sub-head" tabindex="0" role="button" aria-expanded="false">
      <span>Показать 7 зон</span>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
    </div><div class="fold"><div class="fold-inner"><div style="padding:12px 0 0">
      ${recList(ROLL,'roll','rl')}
    </div></div></div></div>

    <div class="card"><h3>Душ после тренировки</h3>
      ${SHOWER[kind]}
      <p><b>Схема контрастного:</b> 1–2 минуты тепло, 20–30 секунд прохладно, три-четыре цикла, заканчиваешь прохладным. Не ледяным — «прохладно, но терпимо».</p>
      <p>Сильный напор используй как массаж: направляй на икры и переднюю поверхность бедра. Работает не хуже ролика, а времени не занимает вообще.</p>
      <table style="margin-top:12px">
        <tr><th>После чего</th><th>Что можно</th></tr>
        <tr><td>Силовая</td><td>только тёплый</td></tr>
        <tr><td>Скоростная, физра, игра</td><td>контрастный</td></tr>
        <tr><td>Кардио</td><td>контрастный</td></tr>
        <tr><td>День отдыха</td><td>любой</td></tr>
      </table>
      <p style="margin-top:12px">Баня и сауна — по тому же правилу: не сразу после силовой, а через 4–6 часов или в день отдыха. На гипертрофию тепло отрицательно не влияет, в отличие от холода.</p>
    </div>

    <div class="card"><h3>Голова</h3>
      <p><b>Визуализация · 5–10 минут перед сном.</b> Прокручиваешь бросок или первый шаг от первого лица — как ложится мяч, как отталкивается стопа. Не смотришь на себя со стороны, а изнутри. Самая доказанная ментальная практика в спорте: работает на моторные паттерны почти как реальное повторение.</p>
      <p><b>Квадратное дыхание</b> перед игрой или тяжёлым подходом: вдох 4 счёта, задержка 4, выдох 4, пауза 4. Две минуты снимают предстартовый мандраж.</p>
      <p><b>Дыхание между подходами.</b> Выдох длиннее вдоха — пульс возвращается быстрее. В четверг это прямо помогает уложиться в 130 перед следующим ускорением.</p>
      <p><b>Ритуал перед штрафным.</b> Одинаковая последовательность каждый раз: столько-то ударов мячом, вдох, бросок. Мозг получает якорь и не вязнет в мыслях. Любой стабильный ритуал лучше, чем никакого.</p>
      <p><b>NSDR при недосыпе.</b> Спал 3–4 часа — двадцать минут лёжа с закрытыми глазами частично отыгрывают потерю. Сон не заменяет, но лучше, чем кофе поверх кофе.</p>
    </div>

    <div class="card"><h3>Мониторинг</h3>
      <p>Три показателя, все бесплатные. Записывай в дневник тренировок.</p>
      <table>
        <tr><th>Что</th><th>Когда</th><th>О чём говорит</th></tr>
        <tr><td>Пульс лёжа</td><td>сразу после пробуждения</td><td>вырос на 7–10 — недовосстановление, скинь объём</td></tr>
        <tr><td>Самочувствие 1–10</td><td>после тренировки</td><td>тренд за месяц важнее отдельной цифры</td></tr>
        <tr><td>Рабочие веса</td><td>каждая тренировка</td><td>те же веса идут тяжелее — не восстановился</td></tr>
      </table>
      <p style="margin-top:12px">Про сон: гормон роста выбрасывается в первых глубоких циклах, то есть в первые 2–3 часа. Поэтому короткая ночь бьёт непропорционально — три часа это не «половина от шести», а почти полное отсутствие восстановления.</p>
      <p>Дневной сон 20–30 минут работает хорошо. Больше 30 — попадаешь в глубокую фазу и просыпаешься разбитым.</p>
      <p>Кофеин не позже 14:00. Период полувыведения 5–6 часов: выпитый в 18:00 мешает в час ночи, даже если ты засыпаешь.</p>
    </div>

    <div class="card"><h3>Добавки</h3>
      <p>Список с твёрдой доказательной базой короткий. Всё остальное — ситуативно или маркетинг.</p>
      <table>
        <tr><th>Что</th><th>Доза</th><th>Зачем</th></tr>
        <tr><td>Креатин моногидрат</td><td class="tnum">5 г в день</td><td>самая изученная добавка в спорте, без загрузки и пауз</td></tr>
        <tr><td>Витамин D</td><td class="tnum">по анализу</td><td>Москва, октябрь–апрель; сдать 25(OH)D</td></tr>
        <tr><td>Кофеин</td><td class="tnum">3 мг/кг за 40 мин</td><td>перед силовой и скоростной, около 220 мг</td></tr>
        <tr><td>Протеин</td><td class="tnum">по нехватке</td><td>не добавка, а способ добрать белок</td></tr>
      </table>
      <p style="margin-top:12px"><b>Ситуативно:</b> омега-3 (если рыбы меньше двух раз в неделю), магний (при судорогах и плохом засыпании), мелатонин (только для сдвига режима, не как снотворное).</p>
      <p class="err"><b>Не тратить деньги:</b> BCAA — бесполезны при достаточном белке. Тестобустеры — в 19 лет гормональный фон на пике, поднимать нечего. Глютамин. Предтренировочные комплексы: там работает кофеин, остальное для этикетки.</p>
    </div>

    <div class="card"><h3>Активное восстановление</h3>
      <p>Работает лучше полного покоя: кровоток уносит продукты обмена быстрее, чем лежание.</p>
      <ul>
        <li>8 тысяч шагов в дни без тренировок</li>
        <li>Электровелосипед до универа — если скинуть помощь мотора, пульс встаёт на 110–120, это восстановительная зона. В дни силовых наоборот, помощь побольше: ноги должны приехать свежими</li>
        <li>Заминка 5 минут после тренировки — спокойная ходьба, пульс вниз</li>
        <li>Дыхание носом на кардио: не можешь дышать носом — едешь слишком быстро</li>
      </ul>
      <p><b>Разгрузочная неделя — тоже восстановление</b>, и самое недооценённое. На восьмой неделе будет казаться, что она не нужна: самочувствие хорошее, веса идут. Это ровно тот момент, когда она нужнее всего — усталость сухожилий не ощущается, пока не станет травмой.</p>
    </div>`;

  /* аккордеоны: сначала группы, потом упражнения внутри */
  document.querySelectorAll('#recBox .sub[data-group]').forEach(x=>bindFold(x.querySelector('.sub-head'), x));
  document.querySelectorAll('#recBox .recitem').forEach(x=>bindFold(x.querySelector('.rec-head'), x));
}

function renderExtra(){
  const body=document.getElementById('extraBody');
  body.innerHTML=EXTRA.map(b=>`
    <div class="sub">
      <div class="sub-head" tabindex="0" role="button" aria-expanded="false">
        <span>${b[0]}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="fold"><div class="fold-inner"><div class="sub-body">${b[1]}</div></div></div>
    </div>`).join('');
  body.querySelectorAll('.sub').forEach(s=>bindFold(s.querySelector('.sub-head'), s));
}

/* ############################################################
   14 · ШАПКА, ПРОГРЕСС, ПЕРЕРИСОВКА
   ############################################################ */
function renderHeader(){
  const info=weekInfo();
  document.getElementById('wbTitle').textContent = isSession() ? `Сессия · неделя ${state.week-12}` : `Цикл ${state.cycle} · Неделя ${state.week}`;
  document.getElementById('wbSub').textContent=info.where;

  const el=document.getElementById('status');
  el.className='status'+(info.kind==='deload'?' is-deload':info.kind==='test'?' is-test':(info.shift?' is-shift':''));
  const shiftNote = info.shift
    ? `<span class="where">Прогрессия сдвинута на ${info.shift} ${info.shift===1?'неделю':'недели'}: пропущенные силовые не выкинуты, веса догоняют. Выровняется на разгрузке.</span>`
    : '';
  const of = state.cycle===1 ? (isSession() ? '' : ' из 12') : ` из ${maxWeek(state.cycle)}`;
  const pre = (settings.auto && settings.start && daysBetween(isoDay(), settings.start)>0)
    ? `<span class="where">Старт плана — пн ${shortDate(settings.start)}. До него можно осмотреться и сделать первый замер прыжка.</span>` : '';
  el.innerHTML = isSession() ? `<b>${info.label}</b>${pre}` : `<b>Неделя ${state.week}${of}</b> · ${info.label}${shiftNote}${pre}`;
}

/* На «Сегодня» виден один день, поэтому неделю считаем по данным, а не по экрану */
function updateProgress(){
  let total=0, done=0;
  const warm=warmupFor(state.week);
  const add=k=>{ total++; if(marks[k]) done++; };
  buildWeek().forEach(e=>{
    if(e.type==='gym'){
      if(isDropped(e.id)) return;
      warm.list.forEach(x=>add(key(e.day.id,x.id)));
      e.day.ex.forEach(x=>add(key(e.day.id,x.id)));
    } else if(e.type==='run'){
      if(isSkipped(e.id)) return;
      add(key(e.id,e.ex)); add(key(e.id,'ball'));
    }
  });
  total+=document.querySelectorAll('.habit, .dcell[data-k]').length;
  done +=document.querySelectorAll('.habit.done, .dcell[data-k].done').length;
  document.getElementById('progCount').textContent=`${done} / ${total}`;
  document.getElementById('progBar').style.width = total ? (done/total*100)+'%' : '0%';
}

function renderAll(){
  renderHeader(); renderDays(); renderDaily(); renderNutrition();
  renderSleep(); renderRecovery(); renderProgress(); updateProgress();
}

/* ############################################################
   15 · МОДАЛЬНОЕ ОКНО
   ############################################################ */
const backdrop=document.getElementById('backdrop');

function renderModal(){
  const cycles=[[1,'Цикл 1','Сушка, свой вес, связки · 12 недель + сессия'],
                [2,'Цикл 2','Абсолютная сила, штанга · 12 недель'],
                [3,'Цикл 3','Гипертрофия и реконверсия · 24 недели']];
  document.getElementById('pickCycle').innerHTML=cycles.map(c=>
    `<button type="button" data-c="${c[0]}" aria-pressed="${draft.cycle===c[0]}">${c[1]}<span class="cs">${c[2]}</span></button>`).join('');

  const mw=maxWeek(draft.cycle);
  let html='';
  for(let w=1; w<=mw; w++){
    const kind=weekKind(draft.cycle,w);
    const flag=(kind==='deload'||kind==='test')?'dl':(kind==='session'?'ss':'');
    const lbl = kind==='session' ? 'С'+(w-12) : w;
    html+=`<button type="button" data-w="${w}" class="${flag}" aria-pressed="${draft.week===w}">${lbl}</button>`;
  }
  document.getElementById('pickWeek').innerHTML=html;

  document.querySelectorAll('#pickCycle button').forEach(b=>b.addEventListener('click',()=>{
    draft.cycle=+b.dataset.c;
    if(draft.week>maxWeek(draft.cycle)) draft.week=maxWeek(draft.cycle);
    renderModal();
  }));
  document.querySelectorAll('#pickWeek button').forEach(b=>b.addEventListener('click',()=>{
    draft.week=+b.dataset.w; renderModal();
  }));
  document.getElementById('setAuto').checked=!!settings.auto;
  document.getElementById('setStart').value=settings.start||'';
  document.getElementById('sesN').textContent=settings.session|0;
}

function openModal(){
  draft={cycle:state.cycle, week:state.week};
  renderModal();
  backdrop.classList.add('open');
  document.body.classList.add('locked');
}
function closeModal(){
  backdrop.classList.remove('open');
  document.body.classList.remove('locked');
}

document.getElementById('openModal').addEventListener('click', openModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);
/* Настройки меняются сразу; выбор недели — по «Применить» */
document.getElementById('setAuto').addEventListener('change',e=>{
  settings.auto=e.target.checked; saveSettings();
  if(settings.auto){ const p=posForDate(isoDay()); draft={cycle:p.cycle, week:p.week}; }
  renderModal();
});
document.getElementById('setStart').addEventListener('change',e=>{
  if(!e.target.value) return;
  settings.start=e.target.value; saveSettings();
  if(settings.auto){ const p=posForDate(isoDay()); draft={cycle:p.cycle, week:p.week}; }
  renderModal();
});
const setSes=d=>{
  settings.session=Math.max(0, Math.min(8, (settings.session|0)+d)); saveSettings();
  if(draft.cycle===1 && draft.week>maxWeek(1)) draft.week=maxWeek(1);
  if(settings.auto){ const p=posForDate(isoDay()); draft={cycle:p.cycle, week:p.week}; }
  renderModal();
};
document.getElementById('sesMinus').addEventListener('click',()=>setSes(-1));
document.getElementById('sesPlus').addEventListener('click',()=>setSes(+1));

document.getElementById('applyModal').addEventListener('click',()=>{
  /* выбрал неделю руками, не совпадающую с датой — автовыбор выключается */
  if(settings.auto){
    const p=posForDate(isoDay());
    if(p.cycle!==draft.cycle || p.week!==draft.week){ settings.auto=false; saveSettings(); toast('Неделя выбрана вручную — автовыбор по дате выключен'); }
  }
  if(state.week>maxWeek(state.cycle)) state.week=maxWeek(state.cycle);
  state.cycle=draft.cycle; state.week=draft.week;
  foodDay=todayIdx(); loadFoodDay();
  savePos(); closeModal(); renderAll();
  window.scrollTo({top:0,behavior:'smooth'});
});
backdrop.addEventListener('click',e=>{ if(e.target===backdrop) closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && backdrop.classList.contains('open')) closeModal(); });

/* ############################################################
   16 · КНОПКИ И ПРОКРУТКА
   ############################################################ */
document.getElementById('btnAssemble').addEventListener('click', assembleDay);
/* Стандартный набор с эталонными граммовками */
document.getElementById('btnResetFood').addEventListener('click',()=>{
  Object.keys(grams).forEach(k=>delete grams[k]);
  DISHES.forEach(d=>{ dishOn[d.id]=d.on; });
  saveFood(); renderNutrition();
});

/* Обнулить текущий день */
document.getElementById('btnClearDay').addEventListener('click',()=>{
  clearDay(); saveFood(); renderNutrition();
});

/* Очистить всю неделю — с подтверждением, чтобы не снести случайно */
document.getElementById('btnClearWeek').addEventListener('click',(e)=>{
  const b=e.currentTarget;
  if(b.dataset.armed!=='1'){
    b.dataset.armed='1'; b.textContent='Точно очистить?'; b.classList.add('danger');
    setTimeout(()=>{ if(b.dataset.armed==='1'){ b.dataset.armed=''; b.textContent='Очистить неделю'; b.classList.remove('danger'); } },4000);
    return;
  }
  b.dataset.armed=''; b.textContent='Очистить неделю'; b.classList.remove('danger');
  for(let d=0; d<7; d++) clearDay(d);
  loadFoodDay(); saveFood(); renderNutrition();
});

const toTop=document.getElementById('toTop');
toTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

/* Вкладки: на экране только один раздел, страница перестаёт быть простынёй */
const tabs=document.querySelectorAll('.tab');
const navBtns=document.querySelectorAll('nav.quick button');

function goTab(name, scrollTo){
  store.set('planTab', name);
  document.body.dataset.tab=name;
  tabs.forEach(t=>{ t.hidden = (t.dataset.tab!==name); });
  navBtns.forEach(b=>b.classList.toggle('on', b.dataset.go===name));
  if(scrollTo){
    const el=document.querySelector(scrollTo);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  } else {
    window.scrollTo({top:0, behavior:'auto'});
  }
}
navBtns.forEach(b=>b.addEventListener('click',()=>goTab(b.dataset.go)));

window.addEventListener('scroll',()=>{
  toTop.classList.toggle('show', window.scrollY>500);
},{passive:true});
