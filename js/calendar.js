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

function buildIcs(start, session, kcal){
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

  const cutEnd=plus(start, 12*7-1);                 /* воскресенье 12-й недели */
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
  if(session>0){
    timed(sesStart,         '1700',ICS_DUR.s1,'Сессия А · дома','Удержать силу: каждый подход с запасом 2–3 повтора.',{until:sesEnd});
    timed(plus(sesStart,3), '1700',ICS_DUR.s2,'Прыжки и мяч','Приземления 2 × 5, выпрыгивания 3 × 3, дриблинг 10 мин.',{until:sesEnd});
    timed(plus(sesStart,5), '1200',ICS_DUR.s3,'Сессия Б · дома','Присед на одной ноге, брусья, румынская, копенгаген.',{until:sesEnd});
  }
  /* Утренние замеры: весь цикл 1 и сессия */
  timed(start,         '0830','0835','Взвеситься натощак','Каждое утро, минимум 3 раза в неделю. Вес, пульс, колено, поясница и пах — на экране «Сейчас».',{until:sesEnd, daily:true, alarm:0});
  timed(plus(start,4), '0835','0840','Колено: оценка 0–10','Медленный присед на одной ноге, оцени боль 0–10 и запиши на экране «Сейчас».',{until:sesEnd, alarm:0});
  /* Тест прыжка — в субботу тестовых недель, до тренировки */
  ICS_JUMP_WEEKS.forEach(w=>timed(plus(start,(w-1)*7+5),'1150','1200','Тест прыжка',
    'После разминки, до тренировки. Телефон на полу сбоку, slo-mo. Считать: «Я» → «Прыжок по видео».',{alarm:60}));
  /* Пятничного «Первого шага» больше нет: после физры сразу пара, старты — в подъезде в понедельник */
  /* Вехи */
  allDay(start, 'Старт сушки · неделя 1', kcal.cut);
  allDay(sesStart, session>0 ? 'Конец сушки → сессионный блок' : 'Конец сушки', `Калории на поддержание: ${kcal.session}.`);
  allDay(c2Start, 'Старт цикла 2 · штанга', `Калории ступенями: ${kcal.c2.join(' → ')}.`);
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

  const head=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tri cikla//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:Три цикла · тренировки','X-WR-TIMEZONE:Europe/Moscow',
    'BEGIN:VTIMEZONE','TZID:Europe/Moscow','BEGIN:STANDARD','DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300','TZOFFSETTO:+0300','TZNAME:MSK','END:STANDARD','END:VTIMEZONE'];
  return [...head, ...ev, 'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
