"use strict";
/* ############################################################
   НАБОР ДЕТАЛЕЙ ИНТЕРФЕЙСА
   Иконки, листы снизу, тост с отменой, ввод числа, ползунок 0–10,
   барабан веса, кольца. Экраны собираются из этих деталей.
   ############################################################ */
const $=s=>document.querySelector(s);
const $$=(s,root)=>[...(root||document).querySelectorAll(s)];
const svgI=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC={
  check:svgI('<path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus:svgI('<path d="M12 5v14M5 12h14"/>'),
  minus:svgI('<path d="M5 12h14"/>'),
  close:svgI('<path d="M6 6l12 12M18 6L6 18"/>'),
  more:svgI('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  gear:svgI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  book:svgI('<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>'),
  back:svgI('<path d="M15 18l-6-6 6-6"/>'),
  next:svgI('<path d="M9 18l6-6-6-6"/>'),
  share:svgI('<path d="M12 3v12M7 8l5-5 5 5M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8"/>'),
  play:svgI('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  info:svgI('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>')
};

/* ---------- Тост: короткое подтверждение, у обратимых действий — «Отменить» ---------- */
let toastT=0, toastUndo=null;
function toast(msg, undo){
  const t=$('#toast'); if(!t) return;
  t.querySelector('span').textContent=msg;
  const b=t.querySelector('button');
  toastUndo=typeof undo==='function' ? undo : null;
  b.hidden=!toastUndo;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>{ t.classList.remove('show'); toastUndo=null; }, toastUndo ? 5000 : 2200);
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#toast button')) return;
  const f=toastUndo; toastUndo=null; $('#toast').classList.remove('show');
  if(f){ f(); vibe(); }
});
/* Отклик на касание. Safari на iPhone не знает navigator.vibrate, но даёт отклик переключателю
   (iOS 17.4+): щёлкаем скрытый <input switch>. Вне касания пальцем iOS может его не дать */
let hapticEl=null;
function haptic(){
  try{
    if(!hapticEl){ const l=document.createElement('label'); l.setAttribute('aria-hidden','true');
      l.style.cssText='position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none'; l.innerHTML='<input type="checkbox" switch tabindex="-1">';
      document.body.appendChild(l); hapticEl=l; }
    hapticEl.click();
  }catch(e){}
}
const vibe=(ms)=>{ try{ if(navigator.vibrate) navigator.vibrate(ms||12); else haptic(); }catch(e){} };

/* ---------- Лист снизу: второй уровень, один за раз ---------- */
let sheetStack=[];
function openSheet(html, bind, opt){
  opt=opt||{};
  const root=$('#sheets');
  const dim=document.createElement('div'); dim.className='dim';
  const sh=document.createElement('div'); sh.className='sheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
  sh.innerHTML=`<div class="grab"></div>${html}`;
  root.appendChild(dim); root.appendChild(sh);
  document.body.classList.add('locked');
  let dragged=false;   /* лист уже уехал вниз под пальцем — убираем без второй анимации */
  const close=()=>{
    if(!sh.isConnected) return;
    /* уходит плавно; при «уменьшить движение» — сразу */
    if(reducedMotion() || dragged){ dim.remove(); sh.remove(); }
    else{ const gone=()=>{ dim.remove(); sh.remove(); }; dim.classList.add('out'); sh.classList.add('out'); sh.style.pointerEvents='none'; dim.style.pointerEvents='none';
      sh.addEventListener('animationend',gone,{once:true}); setTimeout(gone,450); }
    sheetStack=sheetStack.filter(x=>x!==api);
    if(!sheetStack.length && $('#page').hidden && $('#player').hidden) document.body.classList.remove('locked');
    if(opt.onClose) opt.onClose();
    if(api.after) api.after();   /* кто открыл лист чужой функцией, может узнать, что его закрыли */
  };
  const api={el:sh, close};
  sheetStack.push(api);
  sheetDrag(sh, dim, ()=>{ dragged=true; close(); });
  dim.addEventListener('click', close);
  $$('[data-close]', sh).forEach(b=>b.addEventListener('click', close));
  if(bind) bind(sh, close);
  return api;
}
/* Свайп вниз закрывает лист: тянем за полоску или за любое место, когда лист прокручен до верха.
   Лист идёт за пальцем, фон гаснет; отпустил далеко или резко — уезжает, иначе пружиной назад */
function sheetDrag(sh, dim, dismiss){
  const NO='input,textarea,select,.sl,.wheel,[data-nodrag]';
  let y0=0, x0=0, on=false, live=false, dy=0, hist=[];
  const set=(y)=>{ dy=Math.max(0,y); sh.style.transform=`translateY(${dy}px)`; dim.style.opacity=String(Math.max(0,1-dy/(sh.offsetHeight||600))); };
  const begin=(x,y,target)=>{
    if(target.closest(NO)) return;
    on=true; live=false; x0=x; y0=y; dy=0; hist=[{y,t:Date.now()}];
  };
  /* true — палец ведёт лист, прокрутку нужно гасить */
  const move=(x,y,fromGrab)=>{
    if(!on) return false;
    if(!live){
      const ddx=Math.abs(x-x0), ddy=y-y0;
      if(Math.abs(ddy)<6 && ddx<6) return false;
      if(ddx>Math.abs(ddy) || ddy<0 || (!fromGrab && sh.scrollTop>0)){ on=false; return false; }
      live=true; y0=y; sh.style.animation='none'; sh.style.transition='none'; dim.style.animation='none'; dim.style.transition='none';
    }
    set(y-y0); hist.push({y,t:Date.now()}); if(hist.length>5) hist.shift();
    return true;
  };
  const end=()=>{
    if(!on) return; on=false;
    if(!live) return; live=false;
    const a=hist[0], b=hist[hist.length-1], v=(b.y-a.y)/Math.max(1,b.t-a.t);   /* px/мс */
    if(dy>110 || (v>0.6 && dy>20)){
      if(reducedMotion()){ dismiss(); return; }
      sh.style.transition='transform .22s cubic-bezier(.4,0,1,1)'; dim.style.transition='opacity .22s';
      sh.style.transform='translateY(100%)'; dim.style.opacity='0'; sh.style.pointerEvents='none'; dim.style.pointerEvents='none';
      vibe(8); setTimeout(dismiss,230);
    }else{
      sh.style.transition=reducedMotion()?'none':'transform .38s var(--spring)'; dim.style.transition='opacity .25s';
      sh.style.transform=''; dim.style.opacity='';
    }
  };
  sh.addEventListener('touchstart',e=>{ if(e.touches.length===1) begin(e.touches[0].clientX,e.touches[0].clientY,e.target); else on=false; },{passive:true});
  sh.addEventListener('touchmove',e=>{ const t=e.touches[0]; if(move(t.clientX,t.clientY,!!e.target.closest('.grab')) && e.cancelable) e.preventDefault(); },{passive:false});
  sh.addEventListener('touchend',end); sh.addEventListener('touchcancel',end);
  /* мышью — только за полоску, чтобы не мешать выделению текста */
  const grab=sh.querySelector('.grab');
  grab.addEventListener('mousedown',e=>{
    begin(e.clientX,e.clientY,e.target); e.preventDefault();
    const mm=ev=>move(ev.clientX,ev.clientY,true);
    const mu=()=>{ end(); window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); };
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu);
  });
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && sheetStack.length) sheetStack[sheetStack.length-1].close(); });
const closeSheets=()=>{ [...sheetStack].forEach(s=>s.close()); };

/* Подтверждение необратимого или массового действия: глагол на кнопке */
function confirmSheet(title, text, verb, danger){
  return new Promise(res=>{
    let done=false;
    openSheet(`<h2>${title}</h2><div class="sub">${text}</div>
      <button type="button" class="btn big ${danger?'danger':'pri'}" data-ok>${verb}</button>
      <button type="button" class="btn" style="margin-top:10px" data-close>Отмена</button>`,
      (el,close)=>{ el.querySelector('[data-ok]').addEventListener('click',()=>{ done=true; close(); res(true); }); },
      {onClose:()=>{ if(!done) res(false); }});
  });
}

/* Ввод числа: крупно, − и + с шагом, можно с клавиатуры */
function numberSheet(o){
  return new Promise(res=>{
    let v=o.value==null||o.value==='' ? (o.start??0) : +o.value, done=false;
    const dec=o.decimals??(o.step<1?1:0);
    const fmt=x=>(Math.round(x*10**dec)/10**dec).toFixed(dec).replace('.',',');
    openSheet(`<h2>${o.title}</h2>${o.sub?`<div class="sub">${o.sub}</div>`:''}
      <div style="display:grid;grid-template-columns:64px 1fr 64px;gap:10px;align-items:center;margin:10px 0 6px">
        <button type="button" class="btn" style="min-height:64px" data-d="-1">${IC.minus}</button>
        <input class="inp" style="text-align:center;font-size:40px;min-height:76px" inputmode="decimal" value="${fmt(v)}" aria-label="${o.title}">
        <button type="button" class="btn" style="min-height:64px" data-d="1">${IC.plus}</button>
      </div>
      <div class="muted small" style="text-align:center;margin-bottom:12px">${o.unit||''}${o.step?` · шаг ${String(o.step).replace('.',',')}`:''}</div>
      <div class="errtxt" hidden></div>
      <button type="button" class="btn big pri" data-ok>${o.verb||'Готово'}</button>
      ${o.clear?`<button type="button" class="btn" style="margin-top:10px" data-clear>${o.clear}</button>`:''}`,
      (el,close)=>{
        const inp=el.querySelector('input'), err=el.querySelector('.errtxt');
        const read=()=>{ const x=num(inp.value); return x; };
        el.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{
          const x=read()??v; v=Math.max(o.min??-1e9, Math.min(o.max??1e9, x+(+b.dataset.d)*(o.step||1))); inp.value=fmt(v); vibe(8); }));
        el.querySelector('[data-ok]').addEventListener('click',()=>{
          const x=read();
          if(x==null || (o.min!=null && x<o.min) || (o.max!=null && x>o.max)){ inp.classList.add('err'); err.hidden=false; err.textContent=`Проверь число${o.min!=null?`: от ${o.min} до ${o.max}`:''}`; return; }
          done=true; close(); res(x);
        });
        const cl=el.querySelector('[data-clear]'); if(cl) cl.addEventListener('click',()=>{ done=true; close(); res(''); });
        inp.addEventListener('focus',()=>inp.select());
      }, {onClose:()=>{ if(!done) res(null); }});
  });
}

/* ---------- Кольцо ---------- */
function ringSVG(size, stroke, frac, color){
  const r=(size-stroke)/2, c=2*Math.PI*r, f=Math.max(0,Math.min(1,frac||0));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" fill="none"/>
    ${f>0?`<circle class="rfill" style="--circ:${c.toFixed(1)}" cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-f)).toFixed(1)}"/>`:''}
  </svg>`;
}

/* ---------- Ползунок 0–10 цветом светофора ---------- */
function sliderHTML(v, hint){
  const set=v!=null && v!=='';
  return `<div class="sl${set?'':' unset'}" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${set?v:''}">
    <div class="tr"></div><div class="hint">${hint||'Оцени от 0 до 10'}</div>
    <div class="th" style="left:calc(26px + (100% - 52px) * ${set?(+v)/10:0})">${set?v:''}</div></div>
    <div class="ticks"><span>0</span><span>4</span><span>6</span><span>10</span></div>`;
}
function bindSlider(sl, onChange){
  const th=sl.querySelector('.th');
  const show=v=>{ sl.classList.toggle('unset', v==null); if(v==null) return; th.style.left=`calc(26px + (100% - 52px) * ${v/10})`; th.textContent=v; sl.setAttribute('aria-valuenow',v); };
  const cur=sl.getAttribute('aria-valuenow');
  let v=cur===''?null:+cur;
  const at=x=>{ const r=sl.getBoundingClientRect(); return Math.max(0,Math.min(10,Math.round((x-r.left-26)/(r.width-52)*10))); };
  let drag=false;
  sl.addEventListener('pointerdown',e=>{ drag=true; sl.setPointerCapture(e.pointerId); const n=at(e.clientX); if(n!==v){ v=n; show(v); vibe(6); } });
  sl.addEventListener('pointermove',e=>{ if(!drag) return; const n=at(e.clientX); if(n!==v){ v=n; show(v); vibe(4); } });
  const end=()=>{ if(!drag) return; drag=false; onChange(v); };
  sl.addEventListener('pointerup',end); sl.addEventListener('pointercancel',end);
  sl.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ e.preventDefault(); v=Math.max(0,Math.min(10,(v??0)+(e.key==='ArrowRight'?1:-1))); show(v); onChange(v); } });
}

/* ---------- Барабан веса: прокрутка по 0,1 кг вокруг вчерашнего ---------- */
function wheelHTML(center, value){
  const c=Math.round((value??center)*10)/10, from=Math.round((center-6)*10), to=Math.round((center+6)*10);
  let h='<div class="pad"></div>';
  for(let i=from;i<=to;i++){ const x=i/10; h+=`<div data-v="${x.toFixed(1)}"${value!=null&&Math.abs(x-c)<0.05?' class="sel"':''}>${fmt1(x)}</div>`; }
  return h+'<div class="pad"></div>';
}
function bindWheel(wh, value, center, onPick){
  const items=$$('[data-v]', wh);
  const go=x=>{ const it=items.find(i=>Math.abs(+i.dataset.v-x)<0.05); if(it) wh.scrollTop=it.offsetTop-wh.clientHeight/2+it.clientHeight/2; };
  requestAnimationFrame(()=>go(value??center));
  /* запись — только после касания: программная прокрутка к вчерашнему весу ничего не пишет */
  let t=0, last=value, touched=false;
  ['pointerdown','touchstart','wheel','keydown'].forEach(ev=>wh.addEventListener(ev,()=>{ touched=true; },{passive:true}));
  const pick=()=>{
    if(!touched) return;
    const mid=wh.scrollTop+wh.clientHeight/2;
    let best=items[0]; items.forEach(i=>{ if(Math.abs(i.offsetTop+i.clientHeight/2-mid)<Math.abs(best.offsetTop+best.clientHeight/2-mid)) best=i; });
    items.forEach(i=>i.classList.toggle('sel', i===best));
    const x=+best.dataset.v;
    if(x!==last){ last=x; onPick(x); }
  };
  wh.addEventListener('scroll',()=>{ clearTimeout(t); t=setTimeout(pick,140); },{passive:true});
  items.forEach(i=>i.addEventListener('click',()=>{ touched=true; go(+i.dataset.v); }));
}

/* ---------- Цвет и подписи по типу дня ---------- */
function typeClass(e){
  if(!e) return 'c-rest';
  if(e.type==='run') return 'c-car';
  if(e.type==='rest') return 'c-rest';
  const id=e.id||(e.day&&e.day.id);
  if(id==='d2'||id==='d4') return 'c-spd';
  if(id==='d5'||id==='d6') return 'c-up';
  return 'c-str';
}
const TYPE_SHORT={d1:'Сил. А', d3:'Сил. Б', d2:'Скор.', d4:'Пт', d5:'Верх', d6:'Верх'};
const kfmt=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const plural=(n,a,b,c)=>{ n=Math.abs(n)%100; const m=n%10; return n>10&&n<20?c:m>1&&m<5?b:m===1?a:c; };

/* ---------- Тема: «Как в iPhone», «Светлая», «Тёмная» ---------- */
function applyTheme(){
  const t=settings.theme||'auto', r=document.documentElement;
  if(t==='light'||t==='dark') r.dataset.theme=t; else delete r.dataset.theme;
}

/* ---------- Движение ---------- */
const reducedMotion=()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };
/* Число набегает от нуля. Если кадры не идут, остаётся итоговое значение из разметки */
function countUp(el, ms){
  if(reducedMotion()) return;
  const to=+el.dataset.count, k=el.dataset.fmt==='k', dec=+(el.dataset.dec||0), t0=performance.now(), d=ms||750;
  const show=v=>{ el.textContent = k ? kfmt(v) : (dec ? v.toFixed(dec).replace('.',',') : String(Math.round(v))); };
  const f=t=>{ const p=Math.min(1,(t-t0)/d); show(to*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(f); else show(to); };
  requestAnimationFrame(f);
}
/* Вкладка появилась: карточки всплывают по очереди, кольца и линии рисуются, числа набегают */
/* Кольцо заполняется от from (0–1) до своего значения. Через Web Animations, а не CSS:
   Safari на iPhone не всегда понимает var() внутри @keyframes, и кольцо просто появлялось готовым */
function fillRing(el, from, ms, delay){
  if(reducedMotion() || !el.animate) return;
  const c=parseFloat(el.getAttribute('stroke-dasharray')), to=parseFloat(el.getAttribute('stroke-dashoffset'));
  if(!(c>0)) return;
  const start=c*(1-Math.max(0,Math.min(1,from||0)));
  if(Math.abs(start-to)<0.5) return;
  el.animate([{strokeDashoffset:start},{strokeDashoffset:to}], {duration:ms||1100, delay:delay||0, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'});
}
function enterFx(box){
  /* перезапуск нужен, только если прошлое появление ещё идёт: иначе принудительный пересчёт раскладки — лишний кадр работы */
  if(box.classList.contains('enter')){ box.classList.remove('enter'); void box.offsetWidth; }
  box.classList.add('enter');
  box.querySelectorAll('.rfill').forEach(el=>fillRing(el, 0, 1100, 150));
  box.querySelectorAll('[data-count]').forEach(el=>countUp(el));
  clearTimeout(box._fx); box._fx=setTimeout(()=>box.classList.remove('enter'), 1100);
}
/* Отметка, поставленная этим нажатием, «выскакивает» и дорисовывается */
function popNewChecks(box, prev){
  const now=$$('.ck', box);
  if(now.length!==prev.length) return;
  now.forEach((e,i)=>{ if(!prev[i] && e.classList.contains('on')) e.classList.add('pop'); });
}
