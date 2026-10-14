"use strict";
/* ############################################################
   ПРОГРЕСС: замеры, выводы, тесты, прыжок по видео
   ############################################################ */
let body={};    // "2026-10-05" → {w, hr, back, knee, groin, feel}
let circ=[];    // [{d, a, b, h}] талия узкая / по пупку / бедро
let tests=[];   // [{d, t, v}]
const TESTS={
  jump:{n:'Прыжок с места', u:'см', better:1},
  sprint34:{n:'Спринт 3/4 площадки', u:'с', better:-1},
  m60:{n:'60 м', u:'с', better:-1},
  pull:{n:'Подтягивания', u:'раз', better:1},
  bike20:{n:'Велосипед 20 мин · средний пульс', u:'уд/мин', better:-1}
};
/* Результаты из заметки — чтобы графикам было от чего считать */
const SEED_TESTS=[{d:'2026-09-20',t:'pull',v:8},{d:'2026-09-20',t:'m60',v:8.1}];
const saveBody =()=>store.set('planBody',body);
const saveCirc =()=>store.set('planCirc',circ);
const saveTests=()=>store.set('planTests',tests);

const dOf = iso => new Date(iso+'T12:00:00');
const addDays = (iso,n) => { const d=dOf(iso); d.setDate(d.getDate()+n); return isoDay(d); };
const daysBetween = (a,b) => Math.round((dOf(b)-dOf(a))/864e5);
const fmt1 = x => (Math.round(x*10)/10).toFixed(1).replace('.',',');

function weightsSorted(){
  return Object.keys(body).filter(d=>num(body[d].w)!=null).sort().map(d=>({d, w:num(body[d].w)}));
}
/* Среднее веса за days дней, заканчивая end включительно */
function avgWin(end, days){
  const from=addDays(end, -days+1);
  const xs=weightsSorted().filter(p=>p.d>=from && p.d<=end);
  return xs.length ? {v:xs.reduce((a,p)=>a+p.w,0)/xs.length, n:xs.length} : null;
}
const median = a => { const b=[...a].sort((x,y)=>x-y); return b.length ? b[Math.floor(b.length/2)] : null; };

/* Светофор колена: последняя оценка за 3 дня и динамика */
function kneeStatus(){
  const ks=Object.keys(body).filter(d=>num(body[d].knee)!=null && d<=isoDay()).sort().reverse();
  /* красный держится неделю: «неделю без прыжков», даже если потом не отмечал */
  const red=ks.find(d=>daysBetween(d, isoDay())<7 && num(body[d].knee)>=6);
  if(red && (!ks.length || daysBetween(ks[0], isoDay())>3 || num(body[ks[0]].knee)<6)){
    const till=addDays(red,7);
    return {lvl:'r', v:num(body[red].knee), d:red, title:`Колено: красный с ${shortDate(red)} — до ${shortDate(till)} без прыжков`,
      text:`${shortDate(red)} было ${num(body[red].knee)}/10. Неделя без прыжков и ускорений нужна сухожилию, даже если сегодня стало легче. Изометрия у стены 5 × 45 сек каждый день.`};
  }
  if(!ks.length || daysBetween(ks[0], isoDay())>3) return null;
  const v=num(body[ks[0]].knee), p1=ks[1]?num(body[ks[1]].knee):null, p2=ks[2]?num(body[ks[2]].knee):null;
  const worse = p1!=null && v>p1, worse2 = worse && p2!=null && p1>p2;
  if(v>=6 || worse2) return {lvl:'r', v, d:ks[0], title:`Колено ${v}/10 — красный`,
    text:'Неделю без прыжков и ускорений. Изометрия у стены 5 × 45 сек, силовые — только то, что не болит. Если не проходит — к спортивному врачу.'};
  if(v>=4 || worse) return {lvl:'y', v, d:ks[0], title:`Колено ${v}/10 — жёлтый`,
    text:'Прыжков вдвое меньше: половина подходов, ускорения на 80 %. Перед прыжками в четверг — полуприсед у стены 5 × 45 сек, он уже в плане дня.'};
  return {lvl:'g', v, d:ks[0], title:`Колено ${v}/10 — зелёный`, text:'Прыжки по плану. Полуприсед у стены — в зарядке для колен.'};
}

/* Светофор поясницы: наклонные упражнения с весом зависят от него */
const BACK_LOAD=['rdl','row','trap','squat','ohp'];
function backStatus(){
  const ks=Object.keys(body).filter(d=>num(body[d].back)!=null).sort().reverse();
  if(!ks.length || daysBetween(ks[0], isoDay())>3) return null;
  const v=num(body[ks[0]].back), p1=ks[1]?num(body[ks[1]].back):null, p2=ks[2]?num(body[ks[2]].back):null;
  const worse = p1!=null && v>p1, worse2 = worse && p2!=null && p1>p2;
  if(v>=6 || worse2) return {lvl:'r', v, d:ks[0], title:`Поясница ${v}/10 — красный`,
    text:'Без наклонов с весом: румынская тяга, тяга в наклоне и трап-тяга сегодня пропускаются. Ходьба, «кошка-верблюд», тепло. Присед и жим — на 40 % легче. К врачу, если отдаёт в ногу, немеет нога или не проходит 3–4 дня.'};
  if(v>=4 || worse) return {lvl:'y', v, d:ks[0], title:`Поясница ${v}/10 — жёлтый`,
    text:'Наклоны только без веса и с опорой рукой. Трап-тягу и тягу в наклоне с весом не делай. Присед и жим — вес на 20 % меньше.'};
  return {lvl:'g', v, d:ks[0], title:`Поясница ${v}/10 — зелёный`, text:'Наклоны по плану. Ощущение в пояснице выше 2 из 10 во время подхода — стоп.'};
}

/* Пах: утренняя оценка 0–10. Правило копенгагенской планки — боль выше 3 из 10
   или тянет на следующий день: шаг назад, на колено и меньшее время */
function groinStatus(){
  const ks=Object.keys(body).filter(d=>num(body[d].groin)!=null && d<=isoDay()).sort().reverse();
  if(!ks.length || daysBetween(ks[0], isoDay())>3) return null;
  const v=num(body[ks[0]].groin);
  if(v>3) return {lvl: v>=6?'r':'y', v, d:ks[0], title:`Пах ${v}/10 — ${v>=6?'красный':'жёлтый'}`,
    text:'Копенгагенская планка сегодня — шаг назад: на колено и меньшее время, или замени на изометрию паха. Растягивать пах нельзя — только изометрия.'};
  return {lvl:'g', v, d:ks[0], title:`Пах ${v}/10 — зелёный`, text:'Копенгагенская планка по плану. Боль выше 3 из 10 — шаг назад.'};
}

/* ---------- Выводы ---------- */
function coachItems(){
  const out=[], t=isoDay();
  const now=avgWin(t,7), before=avgWin(addDays(t,-14),7);
  const cut = state.cycle===1 && !isSession();
  const gain = state.cycle>=2;
  const adj=(settings.kcalAdj||{})[state.cycle]||0;
  if(now && before && now.n>=2 && before.n>=2){
    const pw=(now.v-before.v)/2;
    const pwT=`${pw>0?'+':''}${fmt1(pw)} кг в неделю (среднее за 7 дней: ${fmt1(now.v)} кг)`;
    /* талия за последние 2+ недели */
    let waist=null;
    if(circ.length>=2){
      const last=circ[circ.length-1], old=[...circ].reverse().find(c=>daysBetween(c.d,last.d)>=14);
      if(old && num(last.b)!=null && num(old.b)!=null) waist=num(last.b)-num(old.b);
    }
    if(cut){
      if(pw>-0.15){
        if(waist!=null && waist<=-1) out.push({c:'g',b:'Вес стоит, но талия уходит',x:`${pwT}. Талия ${fmt1(waist)} см — это рекомпозиция, калории не трогай.`});
        else out.push({c:'y',b:'Вес стоит две недели',x:`${pwT}. По правилу сушки — минус 150 ккал за счёт углеводов.`, act:-150});
      } else if(pw<-0.8) out.push({c:'r',b:'Худеешь слишком быстро',x:`${pwT}. Быстрее 0,7 кг в неделю уходят мышцы и прыжок — плюс 150 ккал.`, act:+150});
      else out.push({c:'g',b:'Темп сушки в норме',x:`${pwT}. Ничего не меняй.`});
    } else if(gain){
      /* набор 0,6–1,0 кг в месяц: быстрее 1 кг — жир, медленнее 0,5 — мышцам не из чего расти (Iraki 2019) */
      if(pw>0.25) out.push({c:'y',b:'Набор слишком быстрый',x:`${pwT}. Больше 1 кг в месяц — это уже жир. Минус 150 ккал.`, act:-150});
      else if(pw<0.12) out.push({c:'y',b:'Вес растёт медленно',x:`${pwT}. Для набора нужно плюс 0,6–1,0 кг в месяц — плюс 150 ккал.`, act:+150});
      else out.push({c:'g',b:'Темп набора в норме',x:`${pwT}.`});
    } else {
      out.push({c: Math.abs(pw)>0.3?'y':'g', b:'Сессия: поддержание', x:`${pwT}. ${Math.abs(pw)>0.3?'Вес заметно гуляет — проверь, хватает ли еды в дни экзаменов.':'Вес стабилен, так и надо.'}`});
    }
  } else {
    out.push({c:'',b:'Мало данных по весу',x:'Взвешивайся каждое утро натощак (минимум 3 раза в неделю). Через две недели здесь появится вывод: держать калории или двигать.'});
  }
  if(adj) out.push({c:'',b:`Поправка калорий: ${adj>0?'+':''}${adj} ккал`,x:`Действует в цикле ${state.cycle}, уже учтена во вкладке «Еда».`, reset:true});

  /* пульс покоя */
  const hrs=Object.keys(body).filter(d=>num(body[d].hr)!=null).sort();
  const recent=hrs.filter(d=>daysBetween(d,t)<=2).map(d=>num(body[d].hr));
  const base=hrs.filter(d=>{ const k=daysBetween(d,t); return k>=4 && k<=31; }).map(d=>num(body[d].hr));
  if(recent.length && base.length>=5){
    const r=recent.reduce((a,x)=>a+x,0)/recent.length, m=median(base);
    if(r>=m+7) out.push({c:'y',b:`Пульс покоя выше обычного на ${Math.round(r-m)}`,x:'Признак недовосстановления: приоритет сну, убери одно кардио на этой неделе, силовые — с запасом 2–3 повтора.'});
  }
  /* самочувствие */
  const fs=Object.keys(body).filter(d=>num(body[d].feel)!=null).sort().slice(-2).map(d=>num(body[d].feel));
  if(fs.length===2 && fs.every(v=>v<=4)) out.push({c:'y',b:'Две тренировки подряд тяжело',x:'Если так же и на третьей — сделай неделю как разгрузочную: подходов вдвое меньше.'});
  /* силовые падают две тренировки подряд — на сушке плюс 150 ккал */
  const sd=strengthDrop();
  if(sd && cut) out.push({c:'y',b:'Силовые падают две тренировки подряд',x:`${sd.text} На сушке это сигнал добавить еды: плюс 150 ккал за счёт углеводов. Если ещё и сон разваливается — тем более.`, act:+150});
  /* колено */
  const ks=kneeStatus();
  if(ks) out.push({c:ks.lvl,b:ks.title,x:ks.text});
  const bs=backStatus();
  if(bs) out.push({c:bs.lvl,b:bs.title,x:bs.text});
  const gs=groinStatus();
  if(gs && gs.lvl!=='g') out.push({c:gs.lvl,b:gs.title,x:gs.text});
  return out;
}
/* Поправка калорий по выводам: шаг ±150, предел ±300, своя для каждого цикла */
function adjustKcal(delta){
  const c=state.cycle, cur=(settings.kcalAdj[c]||0)+delta;
  settings.kcalAdj[c]=Math.max(-300, Math.min(300, cur)); saveSettings();
  return nutritionTarget().k;
}
function resetKcal(){ delete settings.kcalAdj[state.cycle]; saveSettings(); }

/* Силовые падают: по журналу две последние тренировки подряд хуже предыдущей.
   Сила в подходе — вес × (1 + повторы / 30), по упражнениям, которые есть в обеих */
function strengthDrop(){
  return memo('sdrop', ()=>{
    const by={};
    for(const k in logs){ const L=logs[k]; if(!L || !L.d || !hasData(L) || L.wk==='deload' || L.wk==='test') continue;
      const best=Math.max(...L.sets.filter(x=>num(x.r)!=null).map(x=>(num(x.w)||0)*(1+num(x.r)/30)+(num(x.w)?0:num(x.r))));
      (by[L.d]=by[L.d]||{})[L.n]=Math.max(best, (by[L.d]||{})[L.n]||0); }
    const days=Object.keys(by).sort();
    if(days.length<3 || daysBetween(days[days.length-1], isoDay())>7) return null;
    const ratio=(a,b)=>{ const xs=Object.keys(by[b]).map(n=>{ const prev=days.slice(0,days.indexOf(b)).reverse().find(d=>by[d][n]!=null); return prev?by[b][n]/by[prev][n]:null; }).filter(x=>x!=null); return xs.length ? xs.reduce((s,x)=>s+x,0)/xs.length : null; };
    const r1=ratio(null, days[days.length-1]), r2=ratio(null, days[days.length-2]);
    if(r1!=null && r2!=null && r1<0.97 && r2<0.97) return {text:`Рабочие веса и повторы ниже прошлых: ${Math.round((1-r2)*100)} % и ${Math.round((1-r1)*100)} %.`};
    return null;
  });
}

/* ---------- График веса ---------- */
function cutTargets(){
  const st=settings.start; if(!st) return [];
  const base=avgWin(addDays(st,6),14);
  if(!base) return [];
  return [[4, base.v-1.5],[8,74],[12,72.5]].map(([w,v])=>({d:addDays(st, w*7-1), v, w}));
}
/* ---------- Тесты ----------
   Прыжок: лучшая попытка дня — в зачёт, средняя за день точнее показывает усталость (Claudino 2017) */
function testSummary(t){
  const T=TESTS[t], L=tests.filter(x=>x.t===t).sort((a,b)=>a.d<b.d?-1:1);
  if(!L.length) return {t, T, empty:true, list:[]};
  const better=(a,b)=> T.better>0 ? a.v>b.v : a.v<b.v;
  const last=L[L.length-1], best=L.reduce((b,x)=>better(x,b)?x:b, L[0]);
  const day=L.filter(x=>x.d===last.d), top=day.reduce((b,x)=>better(x,b)?x:b, day[0]);
  const avg = t==='jump' && day.length>=2 ? Math.round(day.reduce((a,x)=>a+x.v,0)/day.length) : null;
  /* прошлый замер — по дням: у прыжка в день несколько попыток */
  const prevDay=[...L].reverse().find(x=>x.d<last.d);
  const prevTop = prevDay ? L.filter(x=>x.d===prevDay.d).reduce((b,x)=>better(x,b)?x:b, prevDay) : null;
  const shown = t==='jump' ? top : last;
  const ref = t==='jump' ? prevTop : (L.length>=2 ? L[L.length-2] : null);
  const delta = ref ? Math.round((shown.v-ref.v)*100)/100 : null;
  const first=L[0], firstDay=L.filter(x=>x.d===first.d), firstTop=firstDay.reduce((b,x)=>better(x,b)?x:b, firstDay[0]);
  return {t, T, empty:false, list:L, last, shown, best, avg, delta, good: delta!=null && delta*T.better>0, first: t==='jump'?firstTop:first};
}
