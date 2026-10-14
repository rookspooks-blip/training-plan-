"use strict";
/* ############################################################
   «Я» — иду ли я к цели.
   Прыжок (главная цифра года) → вес и выводы → тело (колено,
   поясница, пах, пульс) → тесты → обхваты → цели и задачи.
   Внизу — Библиотека и «Настройки и данные».
   ############################################################ */
const R1c=v=>String(Math.round(v*100)/100).replace('.',',');

/* ---------- График веса: среднее за 7 дней, точки, ориентиры сушки ---------- */
function weightChartHTML(){
  const pts=weightsSorted();
  if(pts.length<2) return null;
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
  const W=320,H=180,L=30,R=10,T=12,B=24, span=Math.max(1,daysBetween(x0,x1));
  const X=d=>L+(W-L-R)*daysBetween(x0,d)/span, Y=v=>T+(H-T-B)*(hi-v)/(hi-lo);
  const step=(hi-lo)>6?2:1;
  let grid='';
  for(let v=lo; v<=hi; v+=step) grid+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--ln)" stroke-width="1"/><text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end" font-size="10" fill="var(--t3)">${v}</text>`;
  const line=avg.map((p,i)=>`${i?'L':'M'}${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  const tgPath = tg.length ? (()=>{ const b=avgWin(addDays(settings.start,6),14); const p0={d:settings.start,v:b?b.v:tg[0].v};
    return [p0,...tg].filter(p=>p.d>=x0).map((p,i)=>`${i?'L':'M'}${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(''); })() : '';
  return {shown, X, Y, W, H, T, B, html:`<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="График веса">${grid}
      ${tgPath?`<path d="${tgPath}" fill="none" stroke="var(--t3)" stroke-width="1.5" stroke-dasharray="4 4"/>`:''}
      ${tg.map(g=>`<path d="M${X(g.d)} ${Y(g.v)-5}l5 5-5 5-5-5z" fill="var(--s1)" stroke="var(--t3)" stroke-width="1.5"/>`).join('')}
      ${shown.map(p=>`<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="2.6" fill="var(--t3)" opacity=".75"/>`).join('')}
      <path class="draw" pathLength="1" d="${line}" fill="none" stroke="var(--acc)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <line data-cross x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="var(--tx)" stroke-width="1" opacity="0"/>
      <circle data-dot r="4.5" fill="var(--acc)" stroke="var(--s1)" stroke-width="2" opacity="0"/>
      <text x="${L}" y="${H-6}" font-size="10" fill="var(--t3)">${shortDate(x0)}</text><text x="${W-R}" y="${H-6}" font-size="10" fill="var(--t3)" text-anchor="end">${shortDate(x1)}</text></svg>
      <div class="tt"></div></div>
    <div class="legend"><span><i style="background:var(--acc)"></i>среднее за 7 дней</span><span><i style="background:var(--t3);height:6px;width:6px;border-radius:50%"></i>взвешивания</span>${tg.length?'<span><i style="background:none;border-top:2px dashed var(--t3);height:0"></i>ориентир сушки</span>':''}</div>`};
}
function bindWeightChart(root, C){
  const svg=root.querySelector('.chart svg'); if(!svg) return;
  const tt=root.querySelector('.chart .tt'), cross=svg.querySelector('[data-cross]'), dot=svg.querySelector('[data-dot]');
  const show=ev=>{
    const r=svg.getBoundingClientRect(), px=(ev.clientX-r.left)*C.W/r.width;
    let best=C.shown[0]; C.shown.forEach(p=>{ if(Math.abs(C.X(p.d)-px)<Math.abs(C.X(best.d)-px)) best=p; });
    const a=avgWin(best.d,7).v;
    cross.setAttribute('x1',C.X(best.d)); cross.setAttribute('x2',C.X(best.d)); cross.setAttribute('opacity','.35');
    dot.setAttribute('cx',C.X(best.d)); dot.setAttribute('cy',C.Y(a)); dot.setAttribute('opacity','1');
    tt.textContent=`${shortDate(best.d)} · ${fmt1(best.w)} кг · ср. ${fmt1(a)}`;
    tt.style.left=Math.max(60, Math.min(r.width-60, C.X(best.d)*r.width/C.W))+'px'; tt.classList.add('on');
  };
  const hide=()=>{ tt.classList.remove('on'); cross.setAttribute('opacity','0'); dot.setAttribute('opacity','0'); };
  svg.addEventListener('pointerdown',show); svg.addEventListener('pointermove',show);
  svg.addEventListener('pointerleave',hide); svg.addEventListener('pointerup',()=>setTimeout(hide,1500));
}
function weightsSheet(){
  const draw=el=>{
    const pts=[...weightsSorted()].reverse();
    el.querySelector('[data-l]').innerHTML = pts.length ? pts.map(p=>`<div class="row"><span class="grow"><div class="nm n">${fmt1(p.w)} кг</div><div class="ds">${shortDate(p.d)}</div></span><button type="button" class="del" data-d="${p.d}" aria-label="Удалить">×</button></div>`).join('')
      : '<div class="t2">Взвешиваний нет.</div>';
    el.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{
      const d=b.dataset.d, w=body[d].w; setBody(d,'w',null); draw(el); renderAll();
      toast(`${shortDate(d)}: ${fmt1(num(w))} кг — удалено`, ()=>{ setBody(d,'w',w); renderAll(); });
    }));
  };
  openSheet(`<h2>Все взвешивания</h2><div class="sub">Смотри на линию среднего, а не на точки: вес за день гуляет на 1–1,5 кг от воды и соли.</div>
    <div class="card hist" style="padding:4px 16px" data-l></div><button type="button" class="btn" data-close>Готово</button>`, el=>draw(el));
}

/* ---------- Тело: колено, поясница, пах, пульс ---------- */
function pulseStatus(){
  const t=isoDay(), hrs=Object.keys(body).filter(d=>num(body[d].hr)!=null).sort();
  if(!hrs.length) return null;
  const last=hrs[hrs.length-1], base=hrs.filter(d=>{ const k=daysBetween(d,t); return k>=4 && k<=31; }).map(d=>num(body[d].hr));
  const m=base.length>=5 ? median(base) : null, v=num(body[last].hr);
  const hi = m!=null && daysBetween(last,t)<=2 && v>=m+7;
  return {lvl: hi?'y':'g', v, d:last, title:`Пульс покоя ${v}`, text: m!=null ? `Обычно ${m}.${hi?' Выше на 7 и больше — недовосстановление: приоритет сну, убери одно кардио, силовые — с запасом 2–3 повтора.':' В норме.'}` : 'Обычный уровень появится после 5 замеров за месяц.'};
}
const ZONES=[
  {id:'knee', n:'Колено', st:()=>kneeStatus(), lib:'Колено: профилактика', empty:'Оцени утром: боль в приседе на одной ноге, 0–10'},
  {id:'back', n:'Поясница', st:()=>backStatus(), lib:'Как расти в весах', empty:'Оцени утром: тянет или «забита», 0–10'},
  {id:'groin', n:'Пах', st:()=>groinStatus(), lib:'Пах и колени', empty:'Оцени утром, 0–10. Растягивать пах нельзя — только изометрия'},
  {id:'hr', n:'Пульс покоя', st:()=>pulseStatus(), lib:'Мониторинг', empty:'Лёжа, сразу после пробуждения'}
];
function bodyMapSVG(S){
  const c=id=>{ const s=S[id]; return s ? 'lv-'+s.lvl : 'lv-n'; };
  return `<svg viewBox="0 0 120 250" aria-hidden="true">
    <circle class="sil" cx="60" cy="22" r="16"/>
    <rect class="sil" x="37" y="42" width="46" height="84" rx="16"/>
    <rect class="sil" x="20" y="46" width="13" height="74" rx="6.5"/><rect class="sil" x="87" y="46" width="13" height="74" rx="6.5"/>
    <rect class="sil" x="39" y="118" width="19" height="126" rx="9"/><rect class="sil" x="62" y="118" width="19" height="126" rx="9"/>
    <circle class="${c('back')}" cx="60" cy="102" r="9" data-z="back"/>
    <circle class="${c('groin')}" cx="60" cy="126" r="7.5" data-z="groin"/>
    <circle class="${c('knee')}" cx="48.5" cy="186" r="9" data-z="knee"/><circle class="${c('knee')}" cx="71.5" cy="186" r="9" data-z="knee"/>
    <circle class="${c('hr')}" cx="70" cy="60" r="6" data-z="hr"/></svg>`;
}
function zoneSheet(z){
  const s=z.st();
  openSheet(`<h2>${z.n}</h2>${s?`<div class="note ${s.lvl}"><b>${esc(s.title)}</b>${s.text}</div>`:`<div class="sub">${z.empty}</div>`}
    <button type="button" class="btn big pri" data-m>Утренний замер</button>
    <button type="button" class="btn" style="margin-top:10px" data-lib>Правило в Библиотеке</button>`,
    (el,close)=>{ el.querySelector('[data-m]').addEventListener('click',()=>{ close(); morningSheet(); });
      el.querySelector('[data-lib]').addEventListener('click',()=>{ close(); openLibrarySection(z.lib); }); });
}

/* ---------- Тесты ---------- */
function sparkSVG(list){
  if(list.length<2) return '';
  const W=200,H=38,P=4, vs=list.map(x=>x.v), lo=Math.min(...vs), hi=Math.max(...vs), r=(hi-lo)||1;
  const X=i=>P+(W-2*P)*i/(list.length-1), Y=v=>P+(H-2*P)*(hi-v)/r;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:38px;margin-top:6px" aria-hidden="true"><path d="${list.map((x,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(x.v).toFixed(1)}`).join('')}" fill="none" stroke="var(--acc)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function testRecordSheet(t0){
  let t=t0||'jump';
  openSheet(`<h2>Записать тест</h2>
    <div class="pills" data-tt>${Object.keys(TESTS).map(k=>`<button type="button" class="pill${k===t?' ghost':''}" style="${k===t?'outline:3px solid var(--acc)':''}" data-t="${k}">${TESTS[k].n}</button>`).join('')}</div>
    <div class="btnrow" style="grid-template-columns:1fr 1fr;margin-top:14px">
      <div><div class="small t2" style="font-weight:700;margin-bottom:6px" data-u>Результат, ${TESTS[t].u}</div><input class="inp" data-v inputmode="decimal" placeholder="число" aria-label="Результат"></div>
      <div><div class="small t2" style="font-weight:700;margin-bottom:6px">Дата</div><input class="inp small" type="date" data-d value="${isoDay()}" aria-label="Дата"></div></div>
    <div class="errtxt" hidden>Впиши число</div>
    <button type="button" class="btn big pri" style="margin-top:14px" data-ok>Записать</button>`,
    (el,close)=>{
      el.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>{ t=b.dataset.t;
        el.querySelectorAll('[data-t]').forEach(x=>{ const on=x.dataset.t===t; x.classList.toggle('ghost',on); x.style.outline=on?'3px solid var(--acc)':''; });
        el.querySelector('[data-u]').textContent=`Результат, ${TESTS[t].u}`; }));
      el.querySelector('[data-ok]').addEventListener('click',()=>{
        const inp=el.querySelector('[data-v]'), v=num(inp.value);
        if(v==null || v<=0 || v>1000){ inp.classList.add('err'); el.querySelector('.errtxt').hidden=false; return; }
        const rec={d:el.querySelector('[data-d]').value||isoDay(), t, v};
        tests.push(rec); saveTests(); close(); renderAll();
        toast(`${TESTS[t].n}: ${R1c(v)} ${TESTS[t].u} — записано`, ()=>{ const i=tests.indexOf(rec); if(i>=0) tests.splice(i,1); saveTests(); renderAll(); });
      });
    });
}
function testSheet(t){
  const S=testSummary(t);
  const draw=el=>{
    const L=tests.map((x,i)=>({x,i})).filter(o=>o.x.t===t).sort((a,b)=>a.x.d<b.x.d?1:-1);
    el.querySelector('[data-l]').innerHTML = L.length ? L.map(({x,i})=>`<div class="row"><span class="grow"><div class="nm n">${R1c(x.v)} ${TESTS[t].u}</div><div class="ds">${shortDate(x.d)}</div></span><button type="button" class="del" data-i="${i}" aria-label="Удалить">×</button></div>`).join('') : '<div class="t2">Записей нет.</div>';
    el.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{ const at=+b.dataset.i, x=tests.splice(at,1)[0]; saveTests(); draw(el); renderAll();
      toast(`${shortDate(x.d)}: ${R1c(x.v)} — удалено`, ()=>{ tests.splice(at,0,x); saveTests(); renderAll(); }); }));
  };
  openSheet(`<h2>${TESTS[t].n}</h2>${S.empty?'<div class="sub">Ещё не замерял.</div>':`<div class="sub">Лучший ${R1c(S.best.v)} ${TESTS[t].u}${S.avg!=null?` · средняя за день ${S.avg}`:''}</div>${sparkSVG(S.list)}`}
    <div class="card hist" style="padding:4px 16px;margin-top:10px" data-l></div>
    <button type="button" class="btn big pri" data-add>Записать тест</button>
    ${t==='jump'?'<button type="button" class="btn" style="margin-top:10px" data-jt>Прыжок по видео</button>':''}`,
    (el,close)=>{ draw(el); el.querySelector('[data-add]').addEventListener('click',()=>{ close(); testRecordSheet(t); });
      const j=el.querySelector('[data-jt]'); if(j) j.addEventListener('click',()=>{ close(); openJumpTool(); }); });
}

/* ---------- Обхваты ---------- */
function circSheet(){
  const last=circ[circ.length-1];
  const f=(k,lab)=>`<div><div class="small t2" style="font-weight:700;margin-bottom:6px">${lab}</div><input class="inp small" data-k="${k}" inputmode="decimal" placeholder="${last&&last[k]!=null?String(last[k]).replace('.',','):'см'}" aria-label="${lab}"></div>`;
  const draw=el=>{
    const dl=(k,i)=>{ if(i===0) return ''; const d=num(circ[i][k])-num(circ[i-1][k]); return isFinite(d)&&d!==0?` <span style="color:${d<0?'var(--ok)':'var(--wn)'}">${d>0?'+':''}${fmt1(d)}</span>`:''; };
    el.querySelector('[data-l]').innerHTML = circ.length ? circ.map((c,i)=>({c,i})).reverse().map(({c,i})=>`<div class="row"><span class="grow"><div class="nm">${shortDate(c.d)}</div><div class="ds">${c.a??'—'}${dl('a',i)} · ${c.b??'—'}${dl('b',i)} · ${c.h??'—'}${dl('h',i)}</div></span><button type="button" class="del" data-i="${i}" aria-label="Удалить">×</button></div>`).join('') : '<div class="t2">Замеров нет.</div>';
    el.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{ const at=+b.dataset.i, x=circ.splice(at,1)[0]; saveCirc(); draw(el); renderAll();
      toast('Замер удалён', ()=>{ circ.splice(at,0,x); saveCirc(); renderAll(); }); }));
  };
  openSheet(`<h2>Обхваты · раз в месяц</h2><div class="sub">Утром натощак, лента параллельно полу, живот расслаблен.</div>
    <div class="btnrow three">${f('a','Талия, узкое')}${f('b','Талия по пупку')}${f('h','Бедро')}</div>
    <div class="errtxt" hidden></div>
    <button type="button" class="btn big pri" style="margin-top:12px" data-ok>Записать</button>
    <div class="sec">История · талия узкая · по пупку · бедро</div><div class="card hist" style="padding:4px 16px" data-l></div>`,
    el=>{ draw(el); el.querySelector('[data-ok]').addEventListener('click',()=>{
      const v={}, err=el.querySelector('.errtxt'); let bad=false;
      ['a','b','h'].forEach(k=>{ const i=el.querySelector(`[data-k="${k}"]`), s=i.value.trim(), x=s===''?null:num(s); const b=s!=='' && (x==null||x<20||x>200); i.classList.toggle('err',b); if(b) bad=true; v[k]=x; });
      if(bad){ err.hidden=false; err.textContent='Обхват от 20 до 200 см'; return; }
      if(v.a==null && v.b==null && v.h==null){ err.hidden=false; err.textContent='Впиши хотя бы одно число'; return; }
      err.hidden=true; circ.push({d:isoDay(), ...v}); circ.sort((x,y)=>x.d<y.d?-1:1); saveCirc();
      el.querySelectorAll('[data-k]').forEach(i=>i.value=''); draw(el); renderAll(); toast('Замер записан');
    }); });
}

/* ---------- Прыжок по видео ----------
   Высота = g·t²/8, где t — время в воздухе. Замедленное видео iPhone
   при выборе из галереи обычно приходит уже растянутым во времени,
   поэтому время делится на коэффициент замедления. */
function openJumpTool(){
  openPage('Прыжок по видео', ()=>`<div class="jt">
    <p class="t2">Сними прыжок в режиме «Замедленно», телефон на полу сбоку. Пролистай до кадра, где носки оторвались от пола, нажми «Отрыв», потом до касания пола — «Приземление».</p>
    <label class="btn big pri">Выбрать видео<input type="file" accept="video/*" data-file hidden></label>
    <div data-body hidden style="margin-top:14px">
      <video playsinline muted preload="auto"></video>
      <input type="range" min="0" max="1000" value="0" step="1" aria-label="Позиция в видео" data-rg>
      <div class="steps"><button type="button" class="btn" data-s="-0.1">−0,1 с</button><button type="button" class="btn" data-s="-1">− кадр</button><button type="button" class="btn" data-s="1">+ кадр</button><button type="button" class="btn" data-s="0.1">+0,1 с</button></div>
      <div class="n" style="text-align:center;font-weight:800;margin:10px 0" data-time>0,000 с</div>
      <div class="btnrow" style="margin-top:0"><button type="button" class="btn" data-off>Отрыв</button><button type="button" class="btn" data-on>Приземление</button></div>
      <div class="sec">Какое это видео</div>
      <div class="seg" data-slow><button type="button" class="on" data-v="8">240 к/с</button><button type="button" data-v="4">120 к/с</button><button type="button" data-v="1">Обычное</button></div>
      <div class="small muted" style="margin-top:6px">Замедленное 240 кадров/с — обычно так.</div>
      <div class="res" data-res><div class="t2">Отметь отрыв и приземление</div></div>
      <button type="button" class="btn big pri" data-save disabled>Записать в тесты</button>
    </div></div>`, (box)=>{
    const f=box.querySelector('[data-file]'), v=box.querySelector('video'), rg=box.querySelector('[data-rg]');
    const tEl=box.querySelector('[data-time]'), res=box.querySelector('[data-res]'), sv=box.querySelector('[data-save]');
    let tOff=null, tOn=null, h=null, slow=8;
    const frame=()=> slow>1 ? 1/30 : 1/120;
    const upd=()=>{ tEl.textContent=v.currentTime.toFixed(3).replace('.',',')+' с'; if(v.duration) rg.value=Math.round(v.currentTime/v.duration*1000); };
    const calc=()=>{
      box.querySelector('[data-off]').textContent = tOff!=null ? `Отрыв · ${tOff.toFixed(3).replace('.',',')}` : 'Отрыв';
      box.querySelector('[data-on]').textContent  = tOn!=null  ? `Приземление · ${tOn.toFixed(3).replace('.',',')}` : 'Приземление';
      if(tOff==null || tOn==null || tOn<=tOff){ h=null; sv.disabled=true;
        res.innerHTML=`<div class="${tOff!=null&&tOn!=null?'errtxt':'t2'}">${tOff!=null&&tOn!=null?'Приземление должно быть позже отрыва':'Отметь отрыв и приземление'}</div>`; return; }
      const t=(tOn-tOff)/slow; h=9.81*t*t/8*100;
      const odd = t>1.0 ? 'Слишком долго в воздухе — похоже, видео замедленное сильнее: проверь выбор выше.' : t<0.25 ? 'Очень мало — если видео обычное, выбери «Обычное» выше.' : '';
      res.innerHTML=`<div class="big n">${Math.round(h)} см</div><div class="t2">в воздухе ${t.toFixed(3).replace('.',',')} с${odd?`<br><span style="color:var(--wn)">${odd}</span>`:''}</div>`;
      sv.disabled=false;
    };
    f.addEventListener('change',()=>{ const file=f.files[0]; if(!file) return; if(v.src) URL.revokeObjectURL(v.src);
      v.src=URL.createObjectURL(file); tOff=tOn=null; calc(); box.querySelector('[data-body]').hidden=false;
      /* iOS разрешает перематывать только после старта воспроизведения */
      v.play().then(()=>v.pause()).catch(()=>{}); });
    v.addEventListener('timeupdate',upd); v.addEventListener('seeked',upd); v.addEventListener('loadedmetadata',upd);
    rg.addEventListener('input',()=>{ if(v.duration){ v.pause(); v.currentTime=rg.value/1000*v.duration; } });
    box.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{ const s=+b.dataset.s; v.pause();
      v.currentTime=Math.max(0, Math.min(v.duration||0, v.currentTime + (Math.abs(s)===1 ? s*frame() : s))); }));
    box.querySelector('[data-off]').addEventListener('click',()=>{ tOff=v.currentTime; calc(); });
    box.querySelector('[data-on]').addEventListener('click',()=>{ tOn=v.currentTime; calc(); });
    box.querySelectorAll('[data-slow] button').forEach(b=>b.addEventListener('click',()=>{ slow=+b.dataset.v; box.querySelectorAll('[data-slow] button').forEach(x=>x.classList.toggle('on',x===b)); calc(); }));
    sv.addEventListener('click',()=>{ if(h==null) return; const rec={d:isoDay(), t:'jump', v:Math.round(h)}; tests.push(rec); saveTests(); renderAll();
      toast(`Прыжок ${Math.round(h)} см записан`, ()=>{ const i=tests.indexOf(rec); if(i>=0) tests.splice(i,1); saveTests(); renderAll(); }); });
  });
}

/* ---------- Экран ---------- */
function renderMe(){
  const box=$('#scr-me'); if(!box) return;
  const J=testSummary('jump');
  /* прыжок */
  let jump;
  if(J.empty) jump=`<div class="hero c-spd"><div class="k">Прыжок — главная цифра года</div><div class="t">Первый замер</div>
      <div class="s">До старта сушки. По нему считается цель: хорошо +10–15 %, отлично +20 %.</div>
      <div class="btnrow"><button type="button" class="btn white" data-jt>Прыжок по видео</button><button type="button" class="btn white" data-jrec>Записать</button></div></div>`;
  else {
    const f=J.first.v, v=J.shown.v, gain=(v-f)/f, fill=Math.max(0,Math.min(1,gain/0.2));
    jump=`<div class="hero c-spd tap" data-jsheet><div class="k">Прыжок с места · ${shortDate(J.last.d)}</div>
      <div style="display:flex;align-items:flex-end;gap:10px;margin-top:6px"><span class="n" data-count="${v}" data-dec="${Number.isInteger(v)?0:1}" style="font-size:64px;font-weight:900;letter-spacing:-.03em;line-height:.9">${R1c(v)}</span><span style="font-size:20px;font-weight:800;margin-bottom:6px">см</span>
        <span style="margin-left:auto;font-weight:800;margin-bottom:8px">${gain>=0?'+':''}${R1c(v-f)} см · ${gain>=0?'+':''}${Math.round(gain*100)} %</span></div>
      <div class="goal" style="background:rgba(255,255,255,.25)"><i style="width:${fill*100}%;background:#fff"></i><u style="left:50%"></u><u style="left:75%"></u></div>
      <div class="gl" style="color:inherit;opacity:.9"><span>старт ${R1c(f)}</span><span>хорошо ${Math.round(f*1.1)}–${Math.round(f*1.15)}</span><span>отлично ${Math.round(f*1.2)}</span></div>
      ${J.avg!=null?`<div class="s">Средняя за день ${J.avg} — по ней видна усталость.</div>`:''}
      <div class="btnrow"><button type="button" class="btn white" data-jt>Прыжок по видео</button><button type="button" class="btn white" data-jrec>Записать</button></div></div>`;
  }
  /* вес */
  const C=weightChartHTML(), items=coachItems(), adj=(settings.kcalAdj||{})[state.cycle]||0;
  const coach=items.filter(i=>!/^(Колено|Поясница|Пах)/.test(i.b));
  /* тело */
  const S={}; ZONES.forEach(z=>S[z.id]=z.st());
  const due=backupDue();

  box.innerHTML=`
    <div class="hd"><div class="tt"><div class="kick">${cycleShort()} · ${weekTitle(state.cycle,state.week).toLowerCase()}</div><div class="h1">Я</div></div>
      <button type="button" class="icbtn" data-lib aria-label="Библиотека">${IC.book}</button>
      <button type="button" class="icbtn${due?' dot-badge':''}" data-set aria-label="Настройки и данные">${IC.gear}</button></div>
    ${jump}
    <div class="sec">Вес<span class="aux">${weightsSorted().length?`${fmt1(weightsSorted().slice(-1)[0].w)} кг · ${shortDate(weightsSorted().slice(-1)[0].d)}`:''}</span></div>
    <div class="card">${C?C.html:'<div class="t2">Взвешивайся каждое утро натощак — график появится после двух взвешиваний, вывод — через две недели.</div>'}
      ${coach.map(it=>`<div class="note ${it.c||''}" style="margin-top:10px"><b>${esc(it.b)}</b>${it.x}
        ${it.act?`<button type="button" class="btn" style="margin-top:8px;background:var(--s1)" data-act="${it.act}">${it.act>0?'Добавить':'Убрать'} ${Math.abs(it.act)} ккал</button>`:''}
        ${it.reset?`<button type="button" class="btn" style="margin-top:8px;background:var(--s1)" data-reset>Сбросить поправку</button>`:''}</div>`).join('')}
      <div class="btnrow"><button type="button" class="btn" data-wall>Все взвешивания</button><button type="button" class="btn" data-morning>Записать вес</button></div></div>
    <div class="sec">Тело</div>
    <div class="card"><div class="body-map">${bodyMapSVG(S)}<div>${ZONES.map(z=>{ const s=S[z.id];
      return `<button type="button" class="zone" data-z="${z.id}"><i class="${s?'lv-'+s.lvl:'lv-n'}"></i><span><b>${z.n}${s&&s.v!=null&&z.id!=='hr'?` ${s.v}/10`:''}</b><span>${s ? (s.lvl==='g' ? (z.id==='hr'?esc(s.title):'зелёный') : (s.lvl==='y'?'жёлтый':'красный')+' · подробнее') : 'оцени утром'}</span></span></button>`; }).join('')}</div></div></div>
    <div class="sec">Тесты<button type="button" class="aux link" data-trec>Записать тест</button></div>
    <div class="tests">${Object.keys(TESTS).filter(t=>t!=='jump').map(t=>{ const s=testSummary(t);
      return `<button type="button" class="tst" data-t="${t}"><div class="k">${TESTS[t].n}</div>${s.empty?'<div class="v muted">—</div><div class="d">ещё не замерял</div>'
        :`<div class="v n">${R1c(s.shown.v)}<small>${TESTS[t].u}</small></div><div class="d">${s.delta!=null&&s.delta?`<span style="color:${s.good?'var(--ok)':'var(--wn)'}">${s.delta>0?'+':''}${R1c(s.delta)}</span> · `:''}${shortDate(s.last.d)}</div>`}</button>`; }).join('')}
      <button type="button" class="tst" data-jt><div class="k">Прыжок</div><div class="v" style="font-size:18px;margin-top:8px">По видео</div><div class="d">замедленная съёмка</div></button></div>
    <div class="sec">Обхваты · раз в месяц</div>
    <button type="button" class="card tap" style="width:100%;text-align:left" data-circ>${circ.length?(()=>{ const c=circ[circ.length-1]; return `<dl class="kv"><dt>Талия, узкое</dt><dd class="n">${c.a??'—'} см</dd><dt>По пупку</dt><dd class="n">${c.b??'—'} см</dd><dt>Бедро</dt><dd class="n">${c.h??'—'} см</dd></dl><div class="small muted" style="margin-top:6px">${shortDate(c.d)} · записать новый</div>`; })():'<div class="t2">Ещё не мерил. Утром натощак, раз в месяц.</div><div class="link">Записать</div>'}</button>
    <div class="sec">Цели года</div>
    <div class="card"><dl class="kv">${NOW.phase.map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      <div class="sec" style="margin-top:16px">Цели</div><dl class="kv">${NOW.goals.map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      <div class="sec" style="margin-top:16px">Последние результаты</div><dl class="kv">${NOW.results.map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      <div class="small muted" style="margin-top:10px">Данные из заметки от ${NOW.updated}.</div></div>
    <div class="sec">Задачи<span class="aux">осталось ${NOW.todo.filter(t=>!todo[t[0]]).length} из ${NOW.todo.length}</span></div>
    <div class="card">${NOW.todo.map(t=>`<div class="todo-li${todo[t[0]]?' on':''}"><button type="button" class="ck${todo[t[0]]?' on':''}" data-todo="${t[0]}" aria-label="${esc(t[1])}">${IC.check}</button><span>${t[1]}</span></div>`).join('')}</div>
    <div class="card" style="padding:4px 16px;margin-top:22px">
      <button type="button" class="secrow" data-lib>${IC.book.replace('<svg','<svg width="22" height="22"')}<span>Библиотека</span><span class="chev" style="flex:none">›</span></button>
      <button type="button" class="secrow" data-set>${IC.gear.replace('<svg','<svg width="22" height="22"')}<span>Настройки и данные${due?`<br><small style="color:var(--bad);font-weight:700">${due.days==null?'Копий ещё не было':`Последняя копия ${due.days} ${plural(due.days,'день','дня','дней')} назад`}</small>`:''}</span><span class="chev" style="flex:none">›</span></button>
    </div>`;

  const on=(sel,f)=>box.querySelectorAll(sel).forEach(b=>b.addEventListener('click',ev=>f(b,ev)));
  on('[data-jt]',(b,ev)=>{ ev.stopPropagation(); openJumpTool(); });
  on('[data-jrec]',(b,ev)=>{ ev.stopPropagation(); testRecordSheet('jump'); });
  on('[data-jsheet]',()=>testSheet('jump'));
  on('[data-lib]',()=>openLibrary());
  on('[data-set]',()=>openSettings());
  if(C) bindWeightChart(box, C);
  on('[data-act]',b=>{ const before=(settings.kcalAdj||{})[state.cycle]||0; const k=adjustKcal(+b.dataset.act); renderAll();
    toast(`Калории: ${kfmt(k)} в день`, ()=>{ if(before) settings.kcalAdj[state.cycle]=before; else delete settings.kcalAdj[state.cycle]; saveSettings(); renderAll(); }); });
  on('[data-reset]',()=>{ const before=adj; resetKcal(); renderAll(); toast('Поправка снята', ()=>{ settings.kcalAdj[state.cycle]=before; saveSettings(); renderAll(); }); });
  on('[data-wall]',weightsSheet);
  on('[data-morning]',morningSheet);
  on('[data-z]',b=>zoneSheet(ZONES.find(z=>z.id===b.dataset.z)));
  on('[data-t]',b=>testSheet(b.dataset.t));
  on('[data-trec]',()=>testRecordSheet());
  on('[data-circ]',circSheet);
  on('[data-todo]',b=>{ const id=b.dataset.todo; todo[id]=!todo[id]; if(!todo[id]) delete todo[id]; store.set('planTodo',todo); vibe(); renderMe(); });
}
