"use strict";
/* ############################################################
   КАЛЕНДАРЬ (.ics) ИЗ ДАТ ПЛАНА
   Один источник для двух мест: кнопка «Скачать .ics» в приложении
   (учитывает твою дату старта и длину сессии) и файл plan.ics на
   сайте для подписки (собирается этой же функцией: tools/make-ics.mjs).
   Функция чистая — не трогает состояние приложения.
   ############################################################ */
const ICS_KCAL_DEFAULT={cut:'2600 ккал · Б165 · Ж78 · У310', session:2850, c2:[2950,3075,3175]};
const ICS_JUMP_WEEKS=[1,4,8,12];
/* Длительность силовых и скоростных в минутах. Считается по составу дня
   (dayMinutes → typicalMinutes в js/rules.js), тест сверяет эту таблицу с расчётом */
const ICS_DUR={d1:85, d2:80, d3:75, d4:30, d5:40, s1:50, s2:45, s3:55};

/* legacy=true - весь календарь по v1 (циклы 1-3). По умолчанию: v1 до 15.11.2026, дальше программа v2 (plan-v2.js, B.5):
   блок 1 до 27.12, блок 2 (сессия) 28.12 - 24.01. Блоки 3-7 без дат (зависят от операции), в календарь не ставятся */
function buildIcs(start, session, kcal, legacy){
  kcal=kcal||ICS_KCAL_DEFAULT;
  session=session|0;
  const D=iso=>{ const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)); };
  const plus=(iso,n)=>{ const d=D(iso); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
  const ymd=iso=>iso.replace(/-/g,'');
  /* RRULE UNTIL — конец дня по Москве (UTC+3) в UTC */
  const until=iso=>`${ymd(iso)}T205959Z`;
  const esc=s=>s.replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  /* строки длиннее 75 байт переносятся с пробелом, как требует формат */
  const fold=line=>{
    const out=[]; let cur='', bytes=0;
    for(const ch of line){
      const b=new TextEncoder().encode(ch).length;
      if(bytes+b>(out.length?74:75)){ out.push(cur); cur=''; bytes=0; }
      cur+=ch; bytes+=b;
    }
    out.push(cur);
    return out.join('\r\n ');
  };

  const cutEnd0=plus(start, 12*7-1);                /* воскресенье 12-й недели */
  const V2_LIVE='2026-11-15', V2_B1_END='2026-12-27', V2_B2_START='2026-12-28', V2_B2_END='2027-01-24';
  const cutEnd=legacy||cutEnd0<V2_LIVE ? cutEnd0 : V2_LIVE;   /* v1 кончается в воскресенье перед 16.11 */
  const sesStart=plus(start, 12*7);
  const sesEnd=plus(start, (12+session)*7-1);
  const c2Start=plus(start, (12+session)*7);

  let n=0;
  const ev=[];
  const addMin=(hhmm,m)=>{ const t=(+hhmm.slice(0,2))*60+(+hhmm.slice(2))+m; return String(Math.floor(t/60)).padStart(2,'0')+String(t%60).padStart(2,'0'); };
  const timed=(day, from, to, title, desc, opt={})=>{
    if(typeof to==='number') to=addMin(from,to);   /* минуты → конец */
    n++;
    const L=['BEGIN:VEVENT', `UID:tri-cikla-${n}@training-plan`, 'DTSTAMP:20260930T120000Z',
      `DTSTART;TZID=Europe/Moscow:${ymd(day)}T${from}00`, `DTEND;TZID=Europe/Moscow:${ymd(day)}T${to}00`];
    if(opt.until) L.push(`RRULE:FREQ=${opt.daily?'DAILY':'WEEKLY'};${opt.interval?`INTERVAL=${opt.interval};`:''}${opt.byday?`BYDAY=${opt.byday};`:''}UNTIL=${until(opt.until)}`);
    L.push(`SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${opt.alarm??30}M`, 'END:VALARM', 'END:VEVENT');
    ev.push(...L);
  };
  const allDay=(day, title, desc)=>{
    n++;
    ev.push('BEGIN:VEVENT', `UID:tri-cikla-${n}@training-plan`, 'DTSTAMP:20260930T120000Z',
      `DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(plus(day,1))}`,
      `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT');
  };

  /* Цикл 1: сушка, 12 недель. Пн, Вт, Чт, Сб, Вс */
  timed(start,          '1700',ICS_DUR.d1,'Силовая А','Сначала старты и торможение в подъезде, потом сплит-присед, румынская, подтягивания, отжимания, махи. Веса и повторы — в приложении.',{until:cutEnd});
  timed(plus(start,1),  '1900','1945','Велосипед + мяч','Велосипед 20–35 мин, 80–85 об/мин, пульс 135–140. Потом 10 мин дриблинга.',{until:cutEnd});
  timed(plus(start,3),  '1140',ICS_DUR.d2,'Скоростная после физры','Ускорения, торможение на скорости, боковые старты, прыжки. Колено ноет — перед прыжками изометрия у стены 5 × 45 сек. В конце 5 мин бросков у кольца.',{until:cutEnd});
  timed(plus(start,5),  '1200',ICS_DUR.d3,'Силовая Б','Присед на одной ноге, мостик, скольжение пяток, подтягивания, жим, копенгаген. Веса — в приложении.',{until:cutEnd});
  timed(plus(start,6),  '1200','1245','Велосипед + мяч','Велосипед 20–35 мин спокойно. Потом 10 мин дриблинга.',{until:cutEnd});
  /* Сессионный блок */
  if(legacy && session>0){
    timed(sesStart,         '1700',ICS_DUR.s1,'Сессия А · дома','Удержать силу: каждый подход с запасом 2–3 повтора.',{until:sesEnd});
    timed(plus(sesStart,3), '1700',ICS_DUR.s2,'Прыжки и мяч','Приземления 2 × 5, выпрыгивания 3 × 3, дриблинг 10 мин.',{until:sesEnd});
    timed(plus(sesStart,5), '1200',ICS_DUR.s3,'Сессия Б · дома','Присед на одной ноге, брусья, румынская, копенгаген.',{until:sesEnd});
  }
  /* Утренние замеры: весь цикл 1 и сессия */
  timed(start,         '0830','0835','Взвеситься натощак','Каждое утро, минимум 3 раза в неделю. Вес, пульс, колено, поясница и пах — на экране «Сейчас».',{until:legacy?sesEnd:V2_B2_END, daily:true, alarm:0});
  timed(plus(start,4), '0835','0840','Колено: оценка 0–10','Медленный присед на одной ноге, оцени боль 0–10 и запиши на экране «Сейчас».',{until:legacy?sesEnd:V2_B2_END, alarm:0});
  /* Тест прыжка — в субботу тестовых недель, до тренировки */
  ICS_JUMP_WEEKS.filter(w=>legacy || plus(start,(w-1)*7+5)<=V2_LIVE).forEach(w=>timed(plus(start,(w-1)*7+5),'1150','1200','Тест прыжка',
    'После разминки, до тренировки. Телефон на полу сбоку, slo-mo. Считать: «Я» → «Прыжок по видео».',{alarm:60}));
  /* Пятничного «Первого шага» больше нет: после физры сразу пара, старты — в подъезде в понедельник */
  /* Вехи */
  allDay(start, 'Старт сушки · неделя 1', kcal.cut);
  if(legacy){
    allDay(sesStart, session>0 ? 'Конец сушки → сессионный блок' : 'Конец сушки', `Калории на поддержание: ${kcal.session}.`);
    allDay(c2Start, 'Старт цикла 2 · штанга', `Калории ступенями: ${kcal.c2.join(' → ')}.`);
  } else {
    allDay('2026-11-16', 'Программа v2 · блок 1, неделя 2', 'База и площадка, 7 недель: мягкий дефицит, бросок до операции, интервалы. Калории: четверг 2850, тренировочный день 2600, без тренировки 2400.');
    allDay('2026-11-26', 'Итог калибровки калорий', 'Среднее веса за 7 дней: минус 0,5-0,8 кг за 14 дней - цифра верная; меньше 0,4 - минус 150 ккал; больше 1,0 - плюс 150.');
    allDay(V2_B2_START, 'Блок 2 · сессия', 'Поддержание, калории на уровне расхода (ориентир 2850). Силовые 2 раза по 40 минут, интервалы раз в неделю, мяч 5 раз.');
    allDay(plus(V2_B2_END,1), 'Конец блока 2', 'Дальше блок 3 от даты операции, если она задана, иначе поддержание продолжается.');
  }
  if(!legacy){
    /* Блок 1: с 16.11 по 27.12 */
    timed('2026-11-16','1700',60,'Силовая А','Старты и прыжки на свежие ноги, потом болгарский, румынская, подтягивания и отжимания, носки и махи, dead bug. Веса и повторы - в приложении.',{until:V2_B1_END});
    timed('2026-11-17','1900',45,'Интервалы на велосипеде + мяч','Интервалы по неделе (в приложении), потом 10 минут мяча.',{until:V2_B1_END});
    timed('2026-11-19','1140',45,'Площадка: 45 минут кольца','После физры: старты и прыжки, бросок (батарея, серия), завершение, повторные рывки. Недели 2 и 7: Yo-Yo.',{until:V2_B1_END});
    timed('2026-11-20','0950',90,'Физра: игра, броски','Игра и 40-60 бросков, если дают бросать.',{until:V2_B1_END, alarm:60});
    timed('2026-11-21','1200',75,'Силовая Б','Блок скорости 0а, присед на одной ноге, мост, сгибание ног, верхняя тяга и жим, сведение, подъём на носки. Потом 10 минут мяча.',{until:V2_B1_END});
    timed('2026-11-22','1200',50,'Велосипед спокойно + мяч','Спокойно, по желанию. Или отдых.',{until:V2_B1_END});
    timed('2026-12-05','1150','1200','Тест прыжка','Суббота недели 4: после разминки, до тренировки. «Я» → «Прыжок по видео».',{alarm:60});
    timed('2026-12-26','1150','1200','Тест прыжка','Суббота недели 7: после разминки, до тренировки.',{alarm:60});
    timed('2026-11-19','1140','1255','Yo-Yo IR1','Неделя 2: тест выносливости вместо повторных рывков, 10-15 минут из 45.',{alarm:60});
    timed('2026-12-24','1140','1255','Yo-Yo IR1 и батарея два раза','Неделя 7: все тесты, точка возврата перед операцией.',{alarm:60});
    /* Блок 2: сессия с 28.12 по 24.01 */
    timed(V2_B2_START,'1700',40,'Сессия А','Силовые по 2 подхода, вес не снижать.',{until:V2_B2_END});
    timed(plus(V2_B2_START,1),'1900',45,'Интервалы 4 × 4 мин + мяч','Раз в неделю.',{until:V2_B2_END});
    timed(plus(V2_B2_START,3),'1700',30,'Прыжки и мяч','Прыжки 15 в неделю в полную силу, мяч 10 минут.',{until:V2_B2_END});
    timed(plus(V2_B2_START,5),'1200',40,'Сессия Б','Силовые по 2 подхода, вес не снижать.',{until:V2_B2_END});
    timed(plus(V2_B2_START,6),'1200',40,'Велосипед спокойно + мяч','По желанию.',{until:V2_B2_END});
  }
  /* Силовая В · верх — среда, с 3-й недели. Тоже в конце, чтобы номера событий не сдвигались.
     Числитель — вечером 18:00, знаменатель — утром 8:30 (вечером семинар): два события через неделю.
     Осенний семестр 2026: неделя 1 с 31.08, чётные недели — знаменатель */
  const wed1=plus(start,16), denom=iso=>{ const n=Math.floor((D(iso)-D('2026-08-31'))/864e5/7)+1; return iso>='2026-08-31' && iso<='2026-12-31' ? n%2===0 : null; };
  const known=denom(wed1)!==null;
  const eveFirst = known ? !denom(wed1) : true;
  const what='Тяга гантели, брусья, махи, задняя дельта, руки. Дома, только верх.';
  if(!known){
    timed(wed1, '1800',ICS_DUR.d5,'Силовая В · верх',what+' Если в среду вечером пара — утром до пар.',{until:cutEnd});
  } else {
    timed(eveFirst?wed1:plus(wed1,7), '1800',ICS_DUR.d5,'Силовая В · верх',what+' Числитель: вечером дома.',{until:cutEnd, interval:2});
    timed(eveFirst?plus(wed1,7):wed1, '0830',ICS_DUR.d5,'Силовая В · верх',what+' Знаменатель: вечером семинар, поэтому утром до пар.',{until:cutEnd, interval:2});
  }

  /* v2: среда, верх 40 + 10 минут (числитель вечером, знаменатель утром до пар), с 18.11 по 27.12 */
  if(!legacy){
    const w2='2026-11-18', eve2=!denom(w2), whatV2='Тяга, брусья, махи, задняя дельта, бицепс и французский жим. Дома, только верх. Потом 10 минут мяча.';
    timed(eve2?w2:plus(w2,7), '1800',50,'Верх',whatV2+' Числитель: вечером дома.',{until:V2_B1_END, interval:2});
    timed(eve2?plus(w2,7):w2, '0830',50,'Верх',whatV2+' Знаменатель: вечером семинар, поэтому утром до пар.',{until:V2_B1_END, interval:2});
  }

  const head=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tri cikla//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:Три цикла · тренировки','X-WR-TIMEZONE:Europe/Moscow',
    'BEGIN:VTIMEZONE','TZID:Europe/Moscow','BEGIN:STANDARD','DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300','TZOFFSETTO:+0300','TZNAME:MSK','END:STANDARD','END:VTIMEZONE'];
  return [...head, ...ev, 'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
