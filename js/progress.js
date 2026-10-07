"use strict";
/* ############################################################
   ПРОГРЕСС: замеры, выводы, тесты, прыжок по видео
   ############################################################ */
let body={};    // "2026-10-05" → {w, hr, knee, feel}
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
    text:'Прыжков вдвое меньше: половина подходов, ускорения на 80 %. Перед прыжками — изометрия у стены 5 × 45 сек.'};
  return {lvl:'g', v, d:ks[0], title:`Колено ${v}/10 — зелёный`, text:'Прыжки по плану. Перед ними — изометрия у стены 5 × 45 сек.'};
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

/* ---------- Сегодня утром ---------- */
function renderProgToday(){
  const box=document.getElementById('progToday');
  const t=isoDay(), e=body[t]||{};
  const ws=weightsSorted().filter(p=>p.d<t);
  const prev=ws.length?ws[ws.length-1]:null;
  const kneeCls=v=> v>=6?'r':(v>=4?'y':'');
  box.innerHTML=`<div class="card"><h3>Сегодня утром</h3>
    <div class="pform">
      <label>Вес натощак, кг<input id="pfW" type="text" inputmode="decimal" value="${esc(e.w)}" placeholder="${prev?fmt1(prev.w):'75,0'}"></label>
      <label>Пульс лёжа<input id="pfHR" type="text" inputmode="numeric" value="${esc(e.hr)}" placeholder="уд/мин"></label>
      <label class="wide">Поясница: тянет или «забита», 0–10
        <div class="scale knee" id="pfBack">${Array.from({length:11},(_,i)=>`<button type="button" data-v="${i}" class="${kneeCls(i)}" aria-pressed="${num(e.back)===i}">${i}</button>`).join('')}</div></label>
      <label class="wide">Колено: боль в приседе на одной ноге, 0–10
        <div class="scale knee" id="pfKnee">${Array.from({length:11},(_,i)=>`<button type="button" data-v="${i}" class="${kneeCls(i)}" aria-pressed="${num(e.knee)===i}">${i}</button>`).join('')}</div></label>
      <label class="wide">Самочувствие после тренировки, 1–10
        <div class="scale" id="pfFeel">${Array.from({length:10},(_,i)=>`<button type="button" data-v="${i+1}" aria-pressed="${num(e.feel)===i+1}">${i+1}</button>`).join('')}</div></label>
    </div>
    <button type="button" class="btn btn-primary" id="pfSave" style="width:100%;margin-top:14px">Сохранить</button>
    <div id="pfStatus" style="font-size:13px;margin-top:10px"></div>
    <p style="font-size:12.5px;color:var(--muted);margin:8px 0 0">${prev?`Прошлое взвешивание: ${fmt1(prev.w)} кг, ${shortDate(prev.d)}. `:''}Вес — 3 раза в неделю, колено — утром после прыжкового дня.</p>
  </div>`;
  /* Что уже записано сегодня — чтобы было видно, что сохранилось */
  const status=()=>{
    const x=body[t]||{}, parts=[];
    if(num(x.w)!=null) parts.push(`вес ${String(num(x.w)).replace('.',',')} кг`);
    if(num(x.hr)!=null) parts.push(`пульс ${x.hr}`);
    if(num(x.back)!=null) parts.push(`поясница ${x.back}/10`);
    if(num(x.knee)!=null) parts.push(`колено ${x.knee}/10`);
    if(num(x.feel)!=null) parts.push(`самочувствие ${x.feel}/10`);
    box.querySelector('#pfStatus').innerHTML = parts.length
      ? `<span style="color:var(--carb)">✓ Записано сегодня:</span> ${parts.join(' · ')}`
      : `<span style="color:var(--muted)">Сегодня ещё ничего не записано</span>`;
  };
  const upd=(f,v)=>{
    const cur=body[t]||{};
    if(v===''||v==null) delete cur[f]; else cur[f]=v;
    if(Object.keys(cur).length) body[t]=cur; else delete body[t];
    saveBody();
  };
  const wIn=box.querySelector('#pfW'), hIn=box.querySelector('#pfHR');
  /* пишем сразу при вводе, чтобы ничего не терялось, даже без кнопки */
  wIn.addEventListener('input',()=>{ upd('w', num(wIn.value)); status(); });
  hIn.addEventListener('input',()=>{ upd('hr', num(hIn.value)); status(); });
  wIn.addEventListener('change',()=>renderProgressParts());
  hIn.addEventListener('change',()=>renderProgressParts());
  box.querySelector('#pfSave').addEventListener('click',()=>{
    upd('w', num(wIn.value)); upd('hr', num(hIn.value));
    wIn.blur(); hIn.blur();
    status(); renderProgressParts(); renderDays();
    toast(Object.keys(body[t]||{}).length ? 'Сохранено' : 'Нечего сохранять — впиши вес или отметь колено');
  });
  status();
  [['#pfBack','back'],['#pfKnee','knee'],['#pfFeel','feel']].forEach(([sel,f])=>{
    box.querySelectorAll(sel+' button').forEach(b=>b.addEventListener('click',()=>{
      const v=+b.dataset.v, same=num((body[t]||{})[f])===v;
      upd(f, same?null:v);
      box.querySelectorAll(sel+' button').forEach(x=>x.setAttribute('aria-pressed', String(!same && +x.dataset.v===v)));
      status(); renderProgressParts(); if(f==='knee'||f==='back') renderDays();
    }));
  });
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
      if(pw>0.25) out.push({c:'y',b:'Набор слишком быстрый',x:`${pwT}. Больше 0,8 кг в месяц — это жир. Минус 150 ккал.`, act:-150});
      else if(pw<0.05) out.push({c:'y',b:'Вес не растёт',x:`${pwT}. Для набора нужен плюс 0,5–0,8 кг в месяц — плюс 150 ккал.`, act:+150});
      else out.push({c:'g',b:'Темп набора в норме',x:`${pwT}.`});
    } else {
      out.push({c: Math.abs(pw)>0.3?'y':'g', b:'Сессия: поддержание', x:`${pwT}. ${Math.abs(pw)>0.3?'Вес заметно гуляет — проверь, хватает ли еды в дни экзаменов.':'Вес стабилен, так и надо.'}`});
    }
  } else {
    out.push({c:'',b:'Мало данных по весу',x:'Взвешивайся 3 раза в неделю утром натощак. Через две недели здесь появится вывод: держать калории или двигать.'});
  }
  if(adj) out.push({c:'',b:`Поправка калорий: ${adj>0?'+':''}${adj} ккал`,x:`Действует в цикле ${state.cycle}, уже учтена во вкладке «Еда».`, reset:true});

  /* пульс покоя */
  const hrs=Object.keys(body).filter(d=>num(body[d].hr)!=null).sort();
  const recent=hrs.filter(d=>daysBetween(d,t)<=2).map(d=>num(body[d].hr));
  const base=hrs.filter(d=>{ const k=daysBetween(d,t); return k>=4 && k<=31; }).map(d=>num(body[d].hr));
  if(recent.length && base.length>=5){
    const r=recent.reduce((a,x)=>a+x,0)/recent.length, m=median(base);
    if(r>=m+7) out.push({c:'y',b:`Пульс покоя выше обычного на ${Math.round(r-m)}`,x:'Признак недовосстановления: приоритет сну, убери одно кардио на этой неделе, силовые — с запасом.'});
  }
  /* самочувствие */
  const fs=Object.keys(body).filter(d=>num(body[d].feel)!=null).sort().slice(-2).map(d=>num(body[d].feel));
  if(fs.length===2 && fs.every(v=>v<=4)) out.push({c:'y',b:'Две тренировки подряд тяжело',x:'Если так же и на третьей — сделай неделю как разгрузочную: подходов на треть меньше.'});
  /* колено */
  const ks=kneeStatus();
  if(ks) out.push({c:ks.lvl,b:ks.title,x:ks.text});
  const bs=backStatus();
  if(bs) out.push({c:bs.lvl,b:bs.title,x:bs.text});
  return out;
}
function renderCoach(){
  const box=document.getElementById('progCoach');
  const items=coachItems();
  box.innerHTML=`<div class="card"><h3>Выводы</h3>${items.map((it,i)=>`
    <div class="coach ${it.c}"><b>${it.b}</b>${it.x}
      ${it.act?`<button type="button" class="btn" data-act="${it.act}">${it.act>0?'Добавить':'Убрать'} ${Math.abs(it.act)} ккал</button>`:''}
      ${it.reset?`<button type="button" class="btn" data-reset="1">Сбросить поправку</button>`:''}
    </div>`).join('')}</div>`;
  box.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>{
    const c=state.cycle, cur=(settings.kcalAdj[c]||0)+(+b.dataset.act);
    settings.kcalAdj[c]=Math.max(-300, Math.min(300, cur)); saveSettings();
    renderNutrition(); renderCoach(); toast(`Калории: ${nutritionTarget().k} в день`);
  }));
  box.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>{
    delete settings.kcalAdj[state.cycle]; saveSettings(); renderNutrition(); renderCoach(); toast('Поправка снята');
  }));
}

/* ---------- График веса ---------- */
function cutTargets(){
  const st=settings.start; if(!st) return [];
  const base=avgWin(addDays(st,6),14);
  if(!base) return [];
  return [[4, base.v-1.5],[8,74],[12,72.5]].map(([w,v])=>({d:addDays(st, w*7-1), v, w}));
}
function renderWeight(){
  const box=document.getElementById('progWeight');
  const pts=weightsSorted();
  if(pts.length<2){
    box.innerHTML=`<div class="card"><h3>Вес</h3><p style="color:var(--muted);font-size:14px;margin:0">График появится после двух взвешиваний. Смотри на линию среднего, а не на точки: вес за день гуляет на 1–1,5 кг от воды и соли.</p></div>`;
    return;
  }
  const t=isoDay();
  let x0=pts[0].d, x1=pts[pts.length-1].d > t ? pts[pts.length-1].d : t;
  if(daysBetween(x0,x1)>98) x0=addDays(x1,-98);
  const shown=pts.filter(p=>p.d>=x0);
  const tg=(state.cycle===1 ? cutTargets() : []).filter(g=>g.d>=x0 && daysBetween(x1,g.d)<=35);
  tg.forEach(g=>{ if(g.d>x1) x1=g.d; });
  const avg=shown.map(p=>({d:p.d, v:avgWin(p.d,7).v}));
  const vals=[...shown.map(p=>p.w), ...tg.map(g=>g.v)];
  let lo=Math.floor(Math.min(...vals)-0.5), hi=Math.ceil(Math.max(...vals)+0.5);
  if(hi-lo<3){ const m=(hi+lo)/2; lo=Math.floor(m-1.5); hi=Math.ceil(m+1.5); }
  const W=320,H=180,L=30,R=10,T=12,B=24;
  const span=Math.max(1,daysBetween(x0,x1));
  const X=d=>L+(W-L-R)*daysBetween(x0,d)/span, Y=v=>T+(H-T-B)*(hi-v)/(hi-lo);
  const step=(hi-lo)>6?2:1;
  let grid='';
  for(let v=lo; v<=hi; v+=step) grid+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/>
    <text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  const line=avg.map((p,i)=>`${i?'L':'M'}${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  const tgPath = tg.length ? (()=>{ const b=avgWin(addDays(settings.start,6),14); const p0={d:settings.start,v:b?b.v:tg[0].v};
      const ps=[p0,...tg].filter(p=>p.d>=x0); return ps.map((p,i)=>`${i?'L':'M'}${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(''); })() : '';
  box.innerHTML=`<div class="card"><h3>Вес</h3>
    <div class="chart" id="wChart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="График веса">
        ${grid}
        ${tgPath?`<path d="${tgPath}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4"/>`:''}
        ${tg.map(g=>`<path d="M${X(g.d)} ${Y(g.v)-5}l5 5-5 5-5-5z" fill="var(--surface)" stroke="var(--muted)" stroke-width="1.5"/>`).join('')}
        ${shown.map(p=>`<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="2.6" fill="var(--muted)" opacity=".75"/>`).join('')}
        <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        <line id="wCross" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="var(--text)" stroke-width="1" opacity="0"/>
        <circle id="wDot" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
        <text x="${L}" y="${H-6}" font-size="10" fill="var(--muted)">${shortDate(x0)}</text>
        <text x="${W-R}" y="${H-6}" font-size="10" fill="var(--muted)" text-anchor="end">${shortDate(x1)}</text>
      </svg>
      <div class="tt" id="wTT"></div>
    </div>
    <div class="legend"><span><i style="background:var(--accent)"></i>среднее за 7 дней</span><span><i style="background:var(--muted);height:5px;width:5px;border-radius:50%"></i>взвешивания</span>${tg.length?'<span><i style="background:none;border-top:2px dashed var(--muted);height:0"></i>ориентир сушки</span>':''}</div>
    <details style="margin-top:10px"><summary style="font-size:13px;color:var(--muted);cursor:pointer">Все взвешивания</summary>
      <div class="hist">${[...pts].reverse().slice(0,30).map(p=>`<div class="hist-row"><span class="hd">${shortDate(p.d)}</span><span class="hv">${fmt1(p.w)} кг</span><button class="del" type="button" data-d="${p.d}" aria-label="Удалить">×</button></div>`).join('')}</div>
    </details></div>`;
  const svg=box.querySelector('svg'), tt=box.querySelector('#wTT'), cross=box.querySelector('#wCross'), dot=box.querySelector('#wDot');
  const show=ev=>{
    const r=svg.getBoundingClientRect(), px=(ev.clientX-r.left)*W/r.width;
    let best=shown[0]; shown.forEach(p=>{ if(Math.abs(X(p.d)-px)<Math.abs(X(best.d)-px)) best=p; });
    const a=avgWin(best.d,7).v;
    cross.setAttribute('x1',X(best.d)); cross.setAttribute('x2',X(best.d)); cross.setAttribute('opacity','.35');
    dot.setAttribute('cx',X(best.d)); dot.setAttribute('cy',Y(a)); dot.setAttribute('opacity','1');
    tt.innerHTML=`${shortDate(best.d)} · ${fmt1(best.w)} кг · ср. ${fmt1(a)}`;
    tt.style.left=Math.max(60, Math.min(r.width-60, X(best.d)*r.width/W))+'px'; tt.classList.add('on');
  };
  const hide=()=>{ tt.classList.remove('on'); cross.setAttribute('opacity','0'); dot.setAttribute('opacity','0'); };
  svg.addEventListener('pointerdown',show); svg.addEventListener('pointermove',show);
  svg.addEventListener('pointerleave',hide); svg.addEventListener('pointerup',()=>setTimeout(hide,1500));
  box.querySelectorAll('.del').forEach(b=>b.addEventListener('click',()=>{
    const d=b.dataset.d; if(body[d]){ delete body[d].w; if(!Object.keys(body[d]).length) delete body[d]; }
    saveBody(); renderProgressParts(); renderProgToday();
  }));
}

/* ---------- Обхваты ---------- */
function renderCirc(){
  const box=document.getElementById('progCirc');
  const last=circ[circ.length-1];
  const dl=(k,i)=>{ if(i===0) return ''; const d=num(circ[i][k])-num(circ[i-1][k]); return isFinite(d)&&d!==0?` <span style="color:${d<0?'var(--carb)':'var(--warn)'}">${d>0?'+':''}${fmt1(d)}</span>`:''; };
  box.innerHTML=`<div class="card"><h3>Обхваты · раз в месяц</h3>
    <div class="pform">
      <label>Талия, узкое место<input id="cA" type="text" inputmode="decimal" placeholder="${last&&last.a?last.a:'см'}"></label>
      <label>Талия по пупку<input id="cB" type="text" inputmode="decimal" placeholder="${last&&last.b?last.b:'см'}"></label>
      <label>Бедро под ягодицей<input id="cH" type="text" inputmode="decimal" placeholder="${last&&last.h?last.h:'см'}"></label>
      <label>&nbsp;<button class="btn btn-primary" type="button" id="cAdd">Записать</button></label>
    </div>
    <p style="font-size:12.5px;color:var(--muted);margin:10px 0 0">Утром натощак, лента параллельно полу, живот расслаблен.</p>
    ${circ.length?`<div class="hist" style="margin-top:8px">${circ.map((c,i)=>({c,i})).reverse().map(({c,i})=>`<div class="hist-row">
      <span class="hd">${shortDate(c.d)}</span>
      <span class="hv" style="font-size:12.5px">${c.a??'—'}${dl('a',i)} · ${c.b??'—'}${dl('b',i)} · ${c.h??'—'}${dl('h',i)}</span>
      <button class="del" type="button" data-i="${i}" aria-label="Удалить">×</button></div>`).join('')}</div>`:''}
  </div>`;
  box.querySelector('#cAdd').addEventListener('click',()=>{
    const a=num(box.querySelector('#cA').value), b=num(box.querySelector('#cB').value), h=num(box.querySelector('#cH').value);
    if(a==null && b==null && h==null){ toast('Впиши хотя бы одно число'); return; }
    circ.push({d:isoDay(), a, b, h}); circ.sort((x,y)=>x.d<y.d?-1:1); saveCirc(); renderCirc(); renderCoach(); toast('Замер записан');
  });
  box.querySelectorAll('.del').forEach(b=>b.addEventListener('click',()=>{ circ.splice(+b.dataset.i,1); saveCirc(); renderCirc(); renderCoach(); }));
}

/* ---------- Тесты ---------- */
function spark(list){
  if(list.length<2) return '';
  const W=200,H=38,P=4, vs=list.map(x=>x.v), lo=Math.min(...vs), hi=Math.max(...vs), r=(hi-lo)||1;
  const X=i=>P+(W-2*P)*i/(list.length-1), Y=v=>P+(H-2*P)*(hi-v)/r;
  const d=list.map((x,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(x.v).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    ${list.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(x.v)}" r="${i===list.length-1?3.5:2.4}" fill="var(--accent)"/>`).join('')}</svg>`;
}
function renderTests(){
  const box=document.getElementById('progTests');
  const byT=t=>tests.filter(x=>x.t===t).sort((a,b)=>a.d<b.d?-1:1);
  const cards=Object.keys(TESTS).map(t=>{
    const T=TESTS[t], L=byT(t);
    if(!L.length) return `<div class="tcard"><div class="th"><span class="tn">${T.n}</span><span class="tv" style="color:var(--muted)">—</span></div><div class="ts">Ещё не замерял</div></div>`;
    const last=L[L.length-1], prev=L[L.length-2];
    const best=L.reduce((b,x)=> (T.better>0 ? x.v>b.v : x.v<b.v) ? x : b, L[0]);
    let delta='';
    if(prev){ const d=last.v-prev.v, good=d*T.better>0; if(d) delta=`<span class="${good?'up':'down'}">${d>0?'+':''}${String(Math.round(d*100)/100).replace('.',',')} ${T.u}</span> к прошлому · `; }
    return `<div class="tcard"><div class="th"><span class="tn">${T.n}</span><span class="tv">${String(last.v).replace('.',',')}<small>${T.u}</small></span></div>
      <div class="ts">${delta}лучший ${String(best.v).replace('.',',')} · ${shortDate(last.d)}</div>${spark(L)}</div>`;
  }).join('');
  box.innerHTML=`<div class="card"><h3>Тесты</h3>
    <div class="tests">${cards}</div>
    <div class="pform" style="margin-top:14px">
      <label>Тест<select id="tT">${Object.keys(TESTS).map(t=>`<option value="${t}">${TESTS[t].n}</option>`).join('')}</select></label>
      <label>Результат<input id="tV" type="text" inputmode="decimal" placeholder="число"></label>
      <label>Дата<input id="tD" type="date" value="${isoDay()}"></label>
      <label>&nbsp;<button class="btn btn-primary" type="button" id="tAdd">Записать</button></label>
    </div>
    <details style="margin-top:10px"><summary style="font-size:13px;color:var(--muted);cursor:pointer">Все записи</summary>
      <div class="hist">${tests.map((x,i)=>({x,i})).sort((a,b)=>a.x.d<b.x.d?1:-1).map(({x,i})=>`<div class="hist-row"><span class="hd">${shortDate(x.d)} · ${TESTS[x.t]?TESTS[x.t].n:x.t}</span><span class="hv">${String(x.v).replace('.',',')} ${TESTS[x.t]?TESTS[x.t].u:''}</span><button class="del" type="button" data-i="${i}" aria-label="Удалить">×</button></div>`).join('')}</div>
    </details></div>`;
  box.querySelector('#tAdd').addEventListener('click',()=>{
    const v=num(box.querySelector('#tV').value);
    if(v==null){ toast('Впиши результат'); return; }
    tests.push({d:box.querySelector('#tD').value||isoDay(), t:box.querySelector('#tT').value, v}); saveTests(); renderTests(); toast('Тест записан');
  });
  box.querySelectorAll('.del').forEach(b=>b.addEventListener('click',()=>{ tests.splice(+b.dataset.i,1); saveTests(); renderTests(); }));
}

/* ---------- Прыжок по видео ----------
   Высота = g·t²/8, где t — время в воздухе. Замедленное видео iPhone
   при выборе из галереи обычно приходит уже растянутым во времени,
   поэтому время делится на коэффициент замедления. */
function renderJumpTool(){
  const box=document.getElementById('jumpTool');
  box.innerHTML=`<h3>Прыжок по видео</h3>
    <p style="font-size:14px;margin:0 0 10px">Сними прыжок в режиме «Замедленно», телефон на полу сбоку. Здесь пролистай до кадра, где носки оторвались от пола, нажми «Отрыв», потом до касания пола — «Приземление».</p>
    <label class="btn btn-primary filebtn">Выбрать видео<input type="file" accept="video/*" id="jtFile" hidden></label>
    <div id="jtBody" hidden>
      <video id="jtVideo" playsinline muted preload="auto"></video>
      <input type="range" id="jtRange" min="0" max="1000" value="0" step="1" aria-label="Позиция в видео">
      <div class="jt-steps">
        <button type="button" data-s="-0.1">−0,1 с</button><button type="button" data-s="-1">− кадр</button>
        <button type="button" data-s="1">+ кадр</button><button type="button" data-s="0.1">+0,1 с</button>
      </div>
      <div class="jt-time" id="jtTime">0,000 с</div>
      <div class="btn-row">
        <button type="button" class="btn" id="jtOff">Отрыв</button>
        <button type="button" class="btn" id="jtOn">Приземление</button>
      </div>
      <div class="pform" style="margin-top:12px">
        <label class="wide">Какое это видео
          <select id="jtSlow">
            <option value="8">Замедленное 240 кадров/с (обычно так)</option>
            <option value="4">Замедленное 120 кадров/с</option>
            <option value="1">Обычное, в реальном времени</option>
          </select></label>
      </div>
      <div class="jt-res" id="jtRes"><div class="sm">Отметь отрыв и приземление</div></div>
      <button type="button" class="btn btn-primary" id="jtSave" style="width:100%" disabled>Записать в тесты</button>
    </div>`;
  const f=box.querySelector('#jtFile'), v=box.querySelector('#jtVideo'), rg=box.querySelector('#jtRange');
  const tEl=box.querySelector('#jtTime'), res=box.querySelector('#jtRes'), sv=box.querySelector('#jtSave'), slow=box.querySelector('#jtSlow');
  let tOff=null, tOn=null, h=null;
  const frame=()=> +slow.value>1 ? 1/30 : 1/120;
  const upd=()=>{ tEl.textContent=v.currentTime.toFixed(3).replace('.',',')+' с'; if(v.duration) rg.value=Math.round(v.currentTime/v.duration*1000); };
  const calc=()=>{
    box.querySelector('#jtOff').textContent = tOff!=null ? `Отрыв · ${tOff.toFixed(3).replace('.',',')}` : 'Отрыв';
    box.querySelector('#jtOn').textContent  = tOn!=null  ? `Приземление · ${tOn.toFixed(3).replace('.',',')}` : 'Приземление';
    if(tOff==null || tOn==null || tOn<=tOff){ h=null; sv.disabled=true;
      res.innerHTML=`<div class="sm">${tOff!=null&&tOn!=null?'Приземление должно быть позже отрыва':'Отметь отрыв и приземление'}</div>`; return; }
    const t=(tOn-tOff)/(+slow.value);
    h=9.81*t*t/8*100;
    const odd = t>1.0 ? 'Слишком долго в воздухе — похоже, видео замедленное сильнее: проверь выбор выше.'
              : t<0.25 ? 'Очень мало — если видео обычное, выбери «Обычное» выше.' : '';
    res.innerHTML=`<div class="big">${Math.round(h)} см</div><div class="sm">в воздухе ${t.toFixed(3).replace('.',',')} с${odd?`<br><span style="color:var(--warn)">${odd}</span>`:''}</div>`;
    sv.disabled=false;
  };
  f.addEventListener('change',()=>{
    const file=f.files[0]; if(!file) return;
    if(v.src) URL.revokeObjectURL(v.src);
    v.src=URL.createObjectURL(file); tOff=tOn=null; calc();
    box.querySelector('#jtBody').hidden=false;
    /* iOS разрешает перематывать только после старта воспроизведения */
    v.play().then(()=>v.pause()).catch(()=>{});
  });
  v.addEventListener('timeupdate',upd); v.addEventListener('seeked',upd); v.addEventListener('loadedmetadata',upd);
  rg.addEventListener('input',()=>{ if(v.duration){ v.pause(); v.currentTime=rg.value/1000*v.duration; } });
  box.querySelectorAll('.jt-steps button').forEach(b=>b.addEventListener('click',()=>{
    const s=+b.dataset.s; v.pause();
    v.currentTime=Math.max(0, Math.min(v.duration||0, v.currentTime + (Math.abs(s)===1 ? s*frame() : s)));
  }));
  box.querySelector('#jtOff').addEventListener('click',()=>{ tOff=v.currentTime; calc(); });
  box.querySelector('#jtOn').addEventListener('click',()=>{ tOn=v.currentTime; calc(); });
  slow.addEventListener('change',calc);
  sv.addEventListener('click',()=>{
    if(h==null) return;
    tests.push({d:isoDay(), t:'jump', v:Math.round(h)}); saveTests(); renderTests();
    toast(`Прыжок ${Math.round(h)} см записан`);
  });
}

function renderProgressParts(){ renderCoach(); renderWeight(); }
function renderProgress(){
  renderProgToday(); renderCoach(); renderWeight(); renderCirc(); renderTests();
  if(!document.getElementById('jtFile')) renderJumpTool();
  renderExport();
}
