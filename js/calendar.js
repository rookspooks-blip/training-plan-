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
  const timed=(day, from, to, title, desc, opt={})=>{
    n++;
    const L=['BEGIN:VEVENT', `UID:tri-cikla-${n}@training-plan`, 'DTSTAMP:20260930T120000Z',
      `DTSTART;TZID=Europe/Moscow:${ymd(day)}T${from}00`, `DTEND;TZID=Europe/Moscow:${ymd(day)}T${to}00`];
    if(opt.until) L.push(`RRULE:FREQ=WEEKLY;${opt.byday?`BYDAY=${opt.byday};`:''}UNTIL=${until(opt.until)}`);
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
  timed(start,          '1700','1830','Силовая А','Сплит-присед, подтягивания, отжимания, нордические (недели 1–4 — скольжение пяток). Веса и повторы — в приложении.',{until:cutEnd});
  timed(plus(start,1),  '0900','0945','Велосипед + мяч','Велосипед 20–35 мин, 80–85 об/мин, пульс 135–140. Потом 10 мин дриблинга.',{until:cutEnd});
  timed(plus(start,3),  '1140','1240','Скоростная после физры','Перед прыжками — изометрия у стены 5 × 45 сек. В конце 5 мин бросков у кольца.',{until:cutEnd});
  timed(plus(start,5),  '1300','1430','Силовая Б','Присед на одной ноге, брусья, мостик, копенгаген. Веса — в приложении.',{until:cutEnd});
  timed(plus(start,6),  '1100','1145','Велосипед + мяч','Велосипед 20–35 мин спокойно. Потом 10 мин дриблинга.',{until:cutEnd});
  /* Сессионный блок */
  if(session>0){
    timed(sesStart,         '1700','1745','Сессия А · дома','Удержать силу: каждый подход с запасом 2–3 повтора.',{until:sesEnd});
    timed(plus(sesStart,3), '1700','1725','Прыжки и мяч','Приземления 2 × 5, выпрыгивания 3 × 3, дриблинг 10 мин.',{until:sesEnd});
    timed(plus(sesStart,5), '1300','1345','Сессия Б · дома','Присед на одной ноге, брусья, румынская, копенгаген.',{until:sesEnd});
  }
  /* Утренние замеры: весь цикл 1 и сессия */
  timed(start,         '0830','0835','Взвеситься натощак','Вес и пульс лёжа — во вкладку «Прогресс».',{until:sesEnd, byday:'MO,WE,FR', alarm:0});
  timed(plus(start,4), '0835','0840','Колено: оценка 0–10','Медленный присед на одной ноге, оцени боль 0–10 и запиши в «Прогресс».',{until:sesEnd, alarm:0});
  /* Тест прыжка — в субботу тестовых недель, до тренировки */
  ICS_JUMP_WEEKS.forEach(w=>timed(plus(start,(w-1)*7+5),'1250','1300','Тест прыжка',
    'После разминки, до тренировки. Телефон на полу сбоку, slo-mo. Считать во вкладке «Прогресс».',{alarm:60}));
  /* Пятница: первый шаг после физры — в конце, чтобы номера старых событий не сдвигались */
  const friday=()=>timed(plus(start,4), '1125','1140','Первый шаг после физры','Старты из стойки 6 × 5–10 м и ускорения 3 × 20 м. Без прыжков.',{until:cutEnd});
  /* Вехи */
  allDay(start, 'Старт сушки · неделя 1', kcal.cut);
  allDay(sesStart, session>0 ? 'Конец сушки → сессионный блок' : 'Конец сушки', `Калории на поддержание: ${kcal.session}.`);
  allDay(c2Start, 'Старт цикла 2 · штанга', `Калории ступенями: ${kcal.c2.join(' → ')}.`);
  friday();

  const head=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tri cikla//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:Три цикла · тренировки','X-WR-TIMEZONE:Europe/Moscow',
    'BEGIN:VTIMEZONE','TZID:Europe/Moscow','BEGIN:STANDARD','DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300','TZOFFSETTO:+0300','TZNAME:MSK','END:STANDARD','END:VTIMEZONE'];
  return [...head, ...ev, 'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
