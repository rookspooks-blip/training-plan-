"use strict";
/* ############################################################
   ТАЙМЕР ТЕМПА
   Живёт в листе «Как делать» (с рабочего экрана ушёл, E3.1).
   Один повтор = фазы из TEMPO («вниз 3, вверх 1»). Нажал - пошёл повтор: голос
   называет фазу («вниз», «вверх», «стоп»), после повтора - его номер. Руки заняты,
   на слух проще, чем по сигналам. Нет синтеза речи - вместо слов тоны.
   «Сам дальше»: следующий повтор через 1,5 сек после номера.
   Наушники: пока таймер включён, играет беззвучная дорожка - так iPhone отдаёт
   кнопку наушников приложению (музыка при этом встанет). Любое нажатие - следующий повтор.
   Число сделанных повторов уходит в правку значений текущего подхода: на панели оно уже стоит.
   ############################################################ */
const TM_GAP=1500;
const TM={on:false, key:'', rep:0, target:0, auto:false, run:null, audio:null, raf:0, last:0, to:0, sched:[], st:null};
function tempoOf(ex, v){
  if(v.P.timed){ const s=Math.round(num(v.r)||v.P.lo||30); return {hold:true, ph:[['держи',s]]}; }
  let ph=TEMPO[ex.tech]; if(!ph) return null;
  if(ex.tech==='bulgarian' && state.cycle===1 && loadWeek()<=4) ph=[['вниз',3],['вверх',3]];
  if(ex.tech==='calf' && /пауза внизу/.test(ex.dose)) ph=[['вверх',1],['вниз',3],['стоп',1]];
  return {hold:false, ph};
}
const tmText=T=>T.ph.map(([n,s,x])=>`${s} ${n}${x?' '+x:''}`).join(' · ');
const tmLen=T=>T.ph.reduce((a,p)=>a+p[1],0);
/* вид фазы для цвета на экране и тона без голоса: вниз/назад, удержание, вверх/тяни */
const tmKind=n=> /вниз|назад|шаг/.test(n) ? 'd' : /стоп|держи/.test(n) ? 'h' : 'u';
function tmCtx(){ plAudio(); return PL.ctx; }
function tmTone(t, f, dur, vol){
  const c=PL.ctx; if(!c) return;
  try{ const o=c.createOscillator(), g=c.createGain();
    o.frequency.value=f; o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.02); }catch(e){}
}
/* голос: русский, если есть; список голосов в Safari приходит не сразу */
let tmVoiceCache=null;
const tmCanSay=()=>'speechSynthesis' in window && typeof SpeechSynthesisUtterance!=='undefined';
function tmVoice(){
  if(tmVoiceCache) return tmVoiceCache;
  try{ const vs=speechSynthesis.getVoices()||[];
    tmVoiceCache=vs.find(v=>/^ru/i.test(v.lang) && v.localService) || vs.find(v=>/^ru/i.test(v.lang)) || null; }catch(e){}
  return tmVoiceCache;
}
if(tmCanSay()) try{ speechSynthesis.addEventListener('voiceschanged',()=>{ tmVoiceCache=null; tmVoice(); }); }catch(e){}
function tmSay(text){
  if(!tmCanSay()) return false;
  try{
    const sy=speechSynthesis; if(sy.speaking||sy.pending) sy.cancel();
    const u=new SpeechSynthesisUtterance(text); u.lang='ru-RU'; u.rate=1.1; u.volume=1;
    const v=tmVoice(); if(v) u.voice=v;
    sy.speak(u); return true;
  }catch(e){ return false; }
}
function tmClearSched(){ TM.sched.forEach(clearTimeout); TM.sched=[]; }
/* беззвучная дорожка: 1 сек, 8 кГц, 8 бит - нужна только для кнопки наушников */
function tmSilent(){
  const n=8000, b=new Uint8Array(44+n), d=new DataView(b.buffer), w=(o,s)=>[...s].forEach((ch,i)=>b[o+i]=ch.charCodeAt(0));
  w(0,'RIFF'); d.setUint32(4,36+n,true); w(8,'WAVEfmt '); d.setUint32(16,16,true); d.setUint16(20,1,true); d.setUint16(22,1,true);
  d.setUint32(24,8000,true); d.setUint32(28,8000,true); d.setUint16(32,1,true); d.setUint16(34,8,true); w(36,'data'); d.setUint32(40,n,true);
  for(let i=0;i<n;i++) b[44+i]=128+(i&1);
  return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
}
const TM_ACTS=['play','pause','nexttrack','previoustrack'];
function tmMedia(on, title){
  const ms='mediaSession' in navigator ? navigator.mediaSession : null;
  if(on){
    try{ if(!TM.audio){ TM.audio=new Audio(tmSilent()); TM.audio.loop=true; TM.audio.setAttribute('playsinline',''); }
      const p=TM.audio.play(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
    if(ms){
      try{ ms.metadata=new MediaMetadata({title:title||'Темп', artist:'Нажми на наушниках - следующий повтор', album:'Три цикла'}); }catch(e){}
      TM_ACTS.forEach(a=>{ try{ ms.setActionHandler(a, ()=>{ try{ TM.audio.play(); }catch(e){} ms.playbackState='playing'; tmPress(); }); }catch(e){} });
      try{ ms.playbackState='playing'; }catch(e){}
    }
  } else {
    try{ TM.audio && TM.audio.pause(); }catch(e){}
    if(ms){ TM_ACTS.forEach(a=>{ try{ ms.setActionHandler(a, null); }catch(e){} }); try{ ms.playbackState='none'; ms.metadata=null; }catch(e){} }
  }
}
/* подход, к которому открыт лист «Как делать», и его темп */
function tmCur(){
  const st=TM.st; if(!st || !PL.id) return null;
  const v=plValues(st), T=tempoOf(st.ex, v);
  return T ? {st, v, T, key:plSig(st)} : null;
}
const plSig=st=>st ? `${st.k}|${st.id}|${st.si??''}` : '';
function tmOn(){
  const c=tmCur(); if(!c) return;
  tmCtx(); TM.on=true; TM.key=c.key; TM.rep=0; TM.run=null; TM.target=c.T.hold?1:Math.round(num(c.v.r)||c.v.P.lo||8);
  tmMedia(true, c.st.ex.name); plWakeOn();
  /* первое слово - по касанию: iPhone разрешает голос только после жеста */
  tmSay('готов');
  tmRender();
}
function tmOff(){
  clearTimeout(TM.to); tmClearSched(); cancelAnimationFrame(TM.raf);
  try{ tmCanSay() && speechSynthesis.cancel(); }catch(e){}
  TM.on=false; TM.run=null; TM.key=''; tmMedia(false);
}
/* нажатие: экран или наушники */
function tmPress(){
  const now=Date.now(); if(now-TM.last<350) return; TM.last=now;
  const c=tmCur(); if(!TM.on || !c) return;
  if(c.key!==TM.key){ TM.key=c.key; TM.rep=0; TM.run=null; TM.target=c.T.hold?1:Math.round(num(c.v.r)||c.v.P.lo||8); }
  if(TM.run) tmRepEnd(true);   /* нажал посреди повтора - он засчитан, сразу следующий */
  clearTimeout(TM.to);
  tmRep(c);
}
function tmRep(c){
  const T=c.T, voice=tmCanSay();
  tmClearSched();
  let off=0;
  T.ph.forEach(([n,s])=>{
    const at=off*1000;
    if(voice) TM.sched.push(setTimeout(()=>tmSay(n), at));
    else { const ctx=tmCtx(); if(ctx) tmTone(ctx.currentTime+0.05+off, tmKind(n)==='d'?440:tmKind(n)==='h'?660:880, 0.16, 0.4); }
    /* удержание на время: последние три секунды вслух */
    if(T.hold && voice && s>=6) [3,2,1].forEach(k=>TM.sched.push(setTimeout(()=>tmSay(String(k)), (off+s-k)*1000)));
    off+=s;
  });
  TM.run={start:Date.now(), len:tmLen(T)*1000, T};
  clearTimeout(TM.to); TM.to=setTimeout(()=>tmRepEnd(false), TM.run.len);
  tmPaint();
}
function tmRepEnd(early){
  clearTimeout(TM.to); tmClearSched();
  if(!TM.run) return;
  TM.run=null; TM.rep++;
  const c=tmCur(), mine=c && TM.key===c.key, done=TM.rep>=TM.target;
  if(mine && !c.v.rec){ plSetEdit(c.st.ex, 'r', c.T.hold?tmLen(c.T):TM.rep); plNormEdit(c.st); }
  if(!early){
    /* номер повтора; на последнем - «всё» */
    const said = c && c.T.hold ? tmSay('всё') : tmSay(done ? `${TM.rep}. Всё` : String(TM.rep));
    if(!said){ if(done) plBeep(); else if(PL.ctx) tmTone(PL.ctx.currentTime, 1200, 0.06, 0.25); }
    if(!done && TM.auto && c) TM.to=setTimeout(()=>{ if(TM.on && !TM.run){ const c2=tmCur(); if(c2 && c2.key===TM.key) tmRep(c2); } }, TM_GAP);
  }
  tmRender();
}
/* живая подпись фазы и секунд - пока лист виден */
function tmPaint(){
  cancelAnimationFrame(TM.raf);
  const el=document.querySelector('.sheet [data-tpbig]');
  if(!el || !TM.run) return;
  const t=(Date.now()-TM.run.start)/1000;
  let acc=0, name='', left=0;
  for(const [n,s] of TM.run.T.ph){ if(t<acc+s){ name=n; left=Math.ceil(acc+s-t); break; } acc+=s; }
  if(!name){ name=TM.run.T.ph[TM.run.T.ph.length-1][0]; left=0; }
  el.innerHTML=`${esc(name)} <span class="n">${Math.max(0,left)}</span>`;
  el.dataset.ph=tmKind(name);
  TM.raf=requestAnimationFrame(tmPaint);
}
function tmHTML(ex, v){
  const T=tempoOf(ex, v); if(!T) return '';
  const cur=TM.on && TM.key===plSig(TM.st);
  if(!TM.on) return `<button type="button" class="tempo-start" data-tpon>${IC.play}<span><b>Таймер темпа</b><small>${T.hold?`держишь ${tmLen(T)} сек`:esc(tmText(T))} · можно с наушников</small></span></button>`;
  const rep=cur?TM.rep:0, tgt=T.hold?1:(cur&&TM.target?TM.target:Math.round(num(v.r)||v.P.lo||8));
  return `<div class="tempo" data-tpgo role="button" tabindex="0" aria-label="Следующий повтор">
    <div class="tp-ph">${T.hold?`держишь ${tmLen(T)} сек`:esc(tmText(T))}</div>
    <div class="tp-big" data-tpbig>${TM.run&&cur?'':(T.hold?'нажми - пошло время':'нажми - следующий повтор')}</div>
    <div class="tp-rep">${T.hold?(rep?'готово':''):`повтор <b class="n">${rep}</b> из ${tgt}`}</div>
  </div>
  <div class="tp-ctl"><button type="button" class="pill${TM.auto?' on':''}" data-tpauto>${TM.auto?'Сам дальше: да':'Сам дальше: нет'}</button><button type="button" class="pill" data-tpoff>Выключить таймер</button></div>
  <div class="small muted" style="margin-top:6px">Голос говорит фазу и номер повтора. Наушники: одно нажатие - следующий повтор. «Сам дальше» - повторы идут сами, между ними 1,5 сек. Музыка на время таймера встанет.</div>`;
}
/* перерисовать блок таймера внутри открытого листа */
function tmRender(){
  const box=document.querySelector('.sheet [data-tempo]'); if(!box || !TM.st) return;
  box.innerHTML=tmHTML(TM.st.ex, plValues(TM.st));
  tmBind(box);
  if(TM.on && TM.run) tmPaint();
  plPatchPanel && plPatchPanel();
}
function tmBind(box){
  const on=(sel,f)=>{ const b=box.querySelector(sel); if(b) b.addEventListener('click',f); };
  on('[data-tpon]',()=>{ tmOn(); vibe(); });
  on('[data-tpgo]',()=>{ tmCtx(); tmPress(); vibe(15); });
  on('[data-tpauto]',()=>{ TM.auto=!TM.auto; tmRender(); });
  on('[data-tpoff]',()=>{ tmOff(); tmRender(); });
}
