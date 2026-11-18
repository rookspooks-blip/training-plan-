"use strict";
/* ############################################################
   ПЛЕЕР ТРЕНИРОВКИ · МОДЕЛЬ (E3.1)
   Что в этом файле: состояние идущей тренировки, шаги, значения подхода,
   запись, отдых, автозакрытие, пропуски. Экран - в player.js.

   Главная мысль: шаги и «текущий шаг» не хранятся, они считаются из данных
   (журнал подходов, отметки, пропуски). Перезагрузка, замена упражнения,
   «не достал метку» ничего не сдвигают: после пересчёта первый незаписанный
   шаг остаётся тем же.

   Что хранится кроме данных (служебный ключ planLive, вне копии):
   время конца отдыха, правки значений, «сделать позже», «короткая версия»,
   время отметок разминки и счёта. Формат: docs/migration-5.md, раздел 1.
   Поля подходов и сессии растут только добавлением:
   planLog[...].sets[i].t - время подхода, planWatch[...].lt/ac - последняя
   запись и автозакрытие, planSkips["...-xs-день-упражнение"] - пропущенный шаг.
   ############################################################ */
const PL={id:null, wake:null, ctx:null, lastDone:0, undo:null, saveBad:false, beeped:false, hold:null, ask:null, tick:0};
const AUTO_CLOSE_MS=30*60*1000;   /* без записей дольше - тренировка закрывается сама */
const REST_STALE_MS=30*60*1000;   /* отдых старше получаса после нуля не показываем */
const DONE_GUARD_MS=600;          /* повторный «Готово» в этом окне игнорируется */
const UNDO_MS=5000;

const plEntry=()=>PL.id ? buildWeek().find(e=>e.id===PL.id && e.type==='gym') : null;
const plSkipDose=ex=>/пропустить/.test(ex.dose);
const mmss=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const plSide=ex=>{ const m=ex.dose.match(/на (ногу|руку|сторону)/); return m ? `на ${m[1]==='ногу'?'каждую ногу':m[1]==='руку'?'каждую руку':'каждую сторону'}` : ''; };
const plUnit=P=>P.timed?'сек':'повт.';
const plWStep=WK=> WK.ph==='штанга'||WK.ph==='доп.'||WK.ph==='тренажёр' ? 2.5 : WK.ph==='рюкзак' ? 1 : 0.5;
const plCanW=WK=> WK.ph!=='—' || /пусто, если без веса/.test(WK.hint);
const hmOf=ms=>{ const d=new Date(ms); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };

/* ---------- Служебное состояние сессии: planLive ----------
   Пишем напрямую в localStorage, не через store.set: счётчик данных не растёт на каждое нажатие «+» */
const LIVE_KEY='planLive';
let LIVE=null;
const liveBlank=sid=>({v:1, sid, restUntil:0, restSec:0, later:[], short:false, ed:{}, tm:{}, lx:null, hold:null, rep:{}, iv:null, scn:null});
function liveRead(sid){
  try{ const o=JSON.parse(ls.get(LIVE_KEY)||'null'); return o && o.v===1 && o.sid===sid ? {...liveBlank(sid), ...o} : null; }catch(e){ return null; }
}
/* состояние открытой сессии; чужое (другая тренировка, старый день) выбрасывается */
function live(){
  const sid=PL.id ? watchKey(PL.id) : null;
  if(!LIVE || LIVE.sid!==sid) LIVE=liveRead(sid) || liveBlank(sid);
  return LIVE;
}
const liveSave=()=>{ if(LIVE && LIVE.sid) ls.put(LIVE_KEY, JSON.stringify(LIVE)); };
const liveFor=id=>{ const sid=watchKey(id); return LIVE && LIVE.sid===sid ? LIVE : liveRead(sid); };
function liveClear(){ LIVE=null; ls.del(LIVE_KEY); }

/* ---------- Упражнения и шаги ---------- */
/* Необязательные: изоляция и кор. «Короткая версия» убирает их; два главных упражнения на ноги остаются.
   Состав программы v2 меняется на следующем этапе, список подправят там */
const OPT_TECH=['lateral','reardelt','curl','triceps','facepull','pallof','plank','deadbug','copenhagen','calf'];
const plOptional=ex=>isLogged(ex) && OPT_TECH.includes(ex.tech);
const xsKey=exId=>`${weekTag()}-xs-${PL.id}-${exId}`;
const plSkipped=exId=>!!skips[xsKey(exId)];
const plLog=ex=>logs[logKey(PL.id,ex.id)];
const plSetFull=(ex,si)=>{ const L=plLog(ex); return !!(L && L.sets && L.sets[si] && num(L.sets[si].r)!=null); };
const plHasRec=ex=>{ const L=plLog(ex); return !!(L && hasData(L)); };
const plRecCount=ex=>{ const L=plLog(ex); return L&&L.sets ? L.sets.filter(x=>num(x.r)!=null).length : 0; };
const plAnyLogged=e=>plExList(e).some(plHasRec);
/* замена при боли (программа v2, лист «Заменить»): хранится в состоянии сессии, id упражнения тот же */
function plApplyRep(ex){
  const R=live().rep && live().rep[ex.id]; if(!R) return ex;
  return {...ex, name:R.name||ex.name, tech:R.tech||ex.tech, dose:R.dose||ex.dose, warm:R.note?R.note:ex.warm, sub:{from:ex.name, why:V2_WHY[R.why]||R.why, live:true, key:R.why, note:R.note||''}};
}
function plExList(e){ return e.day.ex.filter(x=>!plSkipDose(x)).map(plApplyRep); }
/* порядок: программа, «сделать позже» уезжает в конец; в короткой версии необязательное скрыто
   (если по нему уже есть записи, оно остаётся) */
function plOrdered(e){
  const L=live(); let list=plExList(e);
  if(L.short) list=list.filter(x=>!plOptional(x) || plHasRec(x) || plSkipped(x.id));
  const later=(L.later||[]).filter(id=>list.some(x=>x.id===id));
  if(later.length) list=[...list.filter(x=>!later.includes(x.id)), ...later.map(id=>list.find(x=>x.id===id))];
  return list;
}
/* тип шага по упражнению: готовность, счёт (одно нажатие), удержание, подход */
function plType(ex){
  if(ex.step) return ex.step;   /* 'iv' интервалы, 'scn' сценарий, 'test' тест */
  if(!isLogged(ex)) return ex.action==='ready' && isNowWeek() ? 'ready' : 'count';
  return parseDose(ex.dose).timed ? 'hold' : 'set';
}
function plSets(ex){ const P=parseDose(ex.dose), L=plLog(ex); return Math.max(P.sets, L&&L.sets?L.sets.length:0); }
/* Шаги тренировки. Пары чередуются: подход A, подход B, потом отдых.
   Место под интервалы, сценарий четверга и тесты (программа v2): новые значения k ('iv', 'scn', 'test')
   со своими панелями; плеер выбирает панель по k, остальной экран тот же */
function plBuild(e){
  const out=[], list=plOrdered(e);
  if(!e.day.noWarm) out.push({k:'warm', id:'warm'});
  const isPair=x=>/^в паре/.test(x.rest||'') && isLogged(x);
  for(let n=0;n<list.length;n++){
    const ex=list[n], nx=list[n+1];
    if(isPair(ex) && nx && isPair(nx)){
      const A=plSets(ex), B=plSets(nx);
      for(let s=0;s<Math.max(A,B);s++){
        if(s<A) out.push({k:'set', id:ex.id, ex, si:s, n:A, t:plType(ex), mate:s<B?nx:null, first:true});
        if(s<B) out.push({k:'set', id:nx.id, ex:nx, si:s, n:B, t:plType(nx), mate:s<A?ex:null});
      }
      n++; continue;
    }
    if(isLogged(ex)){ const N=plSets(ex); for(let s=0;s<N;s++) out.push({k:'set', id:ex.id, ex, si:s, n:N, t:plType(ex)}); }
    else out.push({k:'ex', id:ex.id, ex, t:plType(ex)});
  }
  return out;
}
function plDone(st, e){
  if(plSkipped(st.id)) return true;
  if(st.k==='warm') return warmupOf(e.day,state.week).list.every(s=>marks[key(PL.id,s.id)]) || plAnyLogged(e);
  if(st.k==='set') return plSetFull(st.ex, st.si);
  return !!marks[key(PL.id,st.ex.id)];
}
const plCur=(e,steps)=>(steps||plBuild(e)).find(st=>!plDone(st,e)) || null;
/* группы для штрихов и счёта «4 из 7»: разминка и каждое упражнение */
function plGroups(e){
  const g=[]; if(!e.day.noWarm) g.push({id:'warm', warm:true});
  plOrdered(e).forEach(ex=>g.push({id:ex.id, ex}));
  return g;
}
/* статус группы: skip, done, part (часть подходов), todo */
function plGroupState(g, e, steps){
  const sts=steps.filter(s=>s.id===g.id);
  if(plSkipped(g.id)) return 'skip';
  if(!sts.length) return 'todo';
  const d=sts.filter(s=>plDone(s,e)).length;
  return d===sts.length ? 'done' : d>0 ? 'part' : 'todo';
}

/* ---------- Значения подхода: подстановка и правка ---------- */
function plValues(st){
  const ex=st.ex, P=parseDose(ex.dose), k=logKey(PL.id,ex.id), L=logs[k];
  const pl=planFor(ex,P,k), WK=weightKind(ex,P);
  const rec = plSetFull(ex, st.si) ? L.sets[st.si] : null;
  const ed=live().ed[ex.id] || {};
  const ps=pl.sets[st.si] || pl.sets[pl.sets.length-1] || {};
  /* вес: правка, затем прошлый записанный подход сегодня, затем план (он уже учитывает прошлый раз и прогрессию) */
  let prevW; for(let i=st.si-1;i>=0;i--) if(plSetFull(ex,i)){ prevW=num(L.sets[i].w)||0; break; }
  const last=lastLog(ex.name, k);
  const lastR=last && last.sets.find(x=>num(x.r)!=null);
  const defW = prevW!==undefined ? prevW : (ps.w ?? 0);
  const defR = ps.r ?? (last&&last.sets[st.si]&&num(last.sets[st.si].r)) ?? (lastR?num(lastR.r):null) ?? P.lo ?? (P.timed?30:8);
  const w = rec ? (num(rec.w)||0) : ('w' in ed ? ed.w : defW);
  const r = rec ? num(rec.r) : ('r' in ed ? ed.r : defR);
  const lastTop = last ? Math.max(0, ...last.sets.map(x=>num(x.w)||0)) : 0;
  /* показывать ли вес: есть в плане, прошлых записях или упражнение с весом по природе */
  const hasW = (pl.w>0) || (ps.w>0) || w>0 || lastTop>0 || ['штанга','гантель','тренажёр','рюкзак','доп.'].includes(WK.ph) && pl.kind!=='back' && pl.kind!=='body';
  return {ex, P, k, L, pl, WK, rec, w, r, defW, defR, ed, last, lastTop, hasW, canW:plCanW(WK), ps};
}
function plSetEdit(ex, f, v){
  const L=live(), ed=L.ed[ex.id]=L.ed[ex.id]||{};
  ed[f]=v; liveSave();
}
/* правка совпала с тем, что подставилось бы само: правкой не считается */
function plNormEdit(st){
  const v=plValues(st), L=live(), ed=L.ed[st.ex.id]; if(!ed) return;
  if('w' in ed && ed.w===v.defW) delete ed.w;
  if('r' in ed && ed.r===v.defR) delete ed.r;
  if(!Object.keys(ed).length) delete L.ed[st.ex.id];
  liveSave();
}

/* ---------- Запись: сначала в хранилище, потом экран ---------- */
function plSnap(st){
  const k=logKey(PL.id,st.ex.id), mk=key(PL.id,st.ex.id), wk=watchKey(PL.id);
  return {t:Date.now(), id:st.id, si:st.si, k, mk, wk, L:logs[k]?JSON.stringify(logs[k]):null, mv:marks[mk], W:watch[wk]?JSON.stringify(watch[wk]):null, live:JSON.stringify(live())};
}
/* отметка в сессии: время последней записи, повторное открытие закрытой */
function plTouch(){
  const k=watchKey(PL.id), W=watch[k]; if(!W || !W.s) return;
  W.lt=Date.now(); delete W.e; delete W.ac;
  if(!saveWatch()) PL.saveBad=true;
}
function plPersistOk(ok){ if(ok===false) PL.saveBad=true; else if(ok===true) PL.saveBad=false; }
/* Записать подход. w - вес (0 = без веса), r - повторы или секунды */
function plRecord(st, w, r, opt){
  const e=plEntry(); if(!e) return false;
  const ex=st.ex, k=logKey(PL.id,ex.id), P=parseDose(ex.dose);
  PL.undo=plSnap(st);
  const L=logs[k] || {n:ex.name, d:null, sets:[], rpe:null};
  while(L.sets.length<P.sets) L.sets.push({w:'',r:''});
  while(L.sets.length<=st.si) L.sets.push({w:'',r:''});
  L.sets[st.si]={w: w ? fmtW(w) : '', r:String(r), t:nowHM()};
  L.n=ex.name; L.tr=P.lo; L.th=P.hi; L.ns=P.sets; L.wk=earlyDlOn()?'deload':weekKind(state.cycle,state.week);
  if(ex.sub && ex.sub.live) L.sub={n:ex.name, why:ex.sub.key};   /* замена: имя того, что сделано, и причина */
  if(!L.d && hasData(L)) L.d=isoDay();
  logs[k]=L;
  plPersistOk(saveLogs());
  const mk=key(PL.id,ex.id);
  if(L.sets.length && L.sets.every(x=>num(x.r)!=null)){ marks[mk]=true; plPersistOk(saveMarks()); }
  plTouch();
  const LV=live(); LV.lx=ex.id; LV.tm[ex.id]=hmOf(Date.now());
  const steps=plBuild(e), nx=plCur(e,steps);
  /* значения этого упражнения: когда оно закончено, правки больше не нужны */
  if(!steps.some(s=>s.id===ex.id && !plDone(s,e))) delete LV.ed[ex.id];
  /* отдых: после подхода, кроме середины пары и самого последнего шага */
  let rs=0;
  if(nx && !(st.first && st.mate && nx.k==='set' && nx.ex===st.mate)) rs=restSec(ex.rest);
  plRestSet(rs);
  PL.beeped=false; PL.hold=null; LV.hold=null;
  liveSave();
  plCheckEnd(e, steps);
  return true;
}
/* Записан последний шаг: тренировка закрывается сама, концом ставится время этого шага */
function plCheckEnd(e, steps){
  const W=watch[watchKey(PL.id)];
  if(plCur(e,steps)) return;
  plRestSet(0); liveSave();
  if(W && W.s && !W.e){ W.e=nowHM(); plPersistOk(saveWatch()); }
}
function plRestSet(sec){
  const L=live();
  if(sec>0){ L.restUntil=Date.now()+sec*1000; L.restSec=sec; } else { L.restUntil=0; L.restSec=0; }
}
/* Отметка шага без подходов: разминка, счёт, готовность */
function plMarkEx(st, e){
  PL.undo={t:Date.now(), id:st.id, kind:'ex', mk:key(PL.id,st.id), mv:marks[key(PL.id,st.id)], wk:watchKey(PL.id), W:watch[watchKey(PL.id)]?JSON.stringify(watch[watchKey(PL.id)]):null, live:JSON.stringify(live()), warm:null};
  if(st.k==='warm'){
    const list=warmupOf(e.day,state.week).list;
    PL.undo.warm=list.map(s=>[key(PL.id,s.id), marks[key(PL.id,s.id)]]);
    list.forEach(s=>{ marks[key(PL.id,s.id)]=true; });
  }else marks[key(PL.id,st.id)]=true;
  plPersistOk(saveMarks());
  plTouch();
  const LV=live(); LV.tm[st.id]=hmOf(Date.now()); LV.lx=null; plRestSet(0); liveSave();
  plCheckEnd(e, plBuild(e));
}
/* Вернуть как было до последней записи. Действует, пока видна кнопка «Отменить» (5 секунд) */
function plUndoLast(){
  const U=PL.undo; if(!U || !PL.id) return false;
  if(U.kind==='ex'){
    if(U.warm) U.warm.forEach(([mk,v])=>{ if(v) marks[mk]=v; else delete marks[mk]; });
    else if(U.mv) marks[U.mk]=U.mv; else delete marks[U.mk];
    saveMarks();
  }else{
    if(U.L) logs[U.k]=JSON.parse(U.L); else delete logs[U.k];
    saveLogs();
    if(U.mv) marks[U.mk]=U.mv; else delete marks[U.mk];
    saveMarks();
  }
  if(U.W) watch[U.wk||watchKey(PL.id)]=JSON.parse(U.W); else if(U.wk) delete watch[U.wk];
  if(U.W || U.wk) saveWatch();
  LIVE=JSON.parse(U.live); liveSave();
  PL.undo=null; return true;
}
/* Убрать записанный подход (свайп, лист правки). Дальше шаг снова незаписан */
function plDeleteSet(ex, si){
  const k=logKey(PL.id,ex.id), L=logs[k]; if(!L || !L.sets || !L.sets[si]) return null;
  const before=JSON.stringify(L), mb=marks[key(PL.id,ex.id)];
  L.sets[si]={w:'',r:''};
  delete marks[key(PL.id,ex.id)];
  plPersistOk(saveLogs()); saveMarks();
  PL.undo=null;
  return ()=>{ logs[k]=JSON.parse(before); if(mb) marks[key(PL.id,ex.id)]=mb; saveLogs(); saveMarks(); };
}
/* Исправить записанный подход */
function plEditSet(ex, si, w, r){
  const k=logKey(PL.id,ex.id), L=logs[k]; if(!L || !L.sets[si]) return;
  const t=L.sets[si].t;
  L.sets[si]={w: w ? fmtW(w) : '', r:String(r), ...(t?{t}:{})};
  plPersistOk(saveLogs());
}
/* Запас повторов: пишется как 10 минус запас в то же поле rpe (0 - 10, 1 - 9, 2 - 8, 3+ - 7). Повторный тап снимает */
const ZAP=[[0,10],[1,9],[2,8],['3+',7]];
function plSetZap(ex, rpe){
  const k=logKey(PL.id,ex.id), P=parseDose(ex.dose), L=logs[k]; if(!L) return;
  L.rpe = L.rpe===rpe ? null : rpe;
  L.n=ex.name; L.tr=P.lo; L.th=P.hi; L.ns=P.sets;
  plPersistOk(saveLogs());
}
/* Пропустить упражнение: шаг считается пройденным, «перенос» не запускается */
function plSkipEx(id){
  skips[xsKey(id)]=true; plPersistOk(saveSkips());
  const L=live(); L.later=(L.later||[]).filter(x=>x!==id); liveSave();
}
function plUnskipEx(id){ delete skips[xsKey(id)]; plPersistOk(saveSkips()); }
function plLater(id){ const L=live(); L.later=(L.later||[]).filter(x=>x!==id); L.later.push(id); liveSave(); }
function plShort(on){ const L=live(); L.short=!!on; liveSave(); }
/* Закончить сейчас: остальное помечается пропущенным, время конца - сейчас */
function plFinishNow(e){
  plBuild(e).forEach(st=>{ if(!plDone(st,e)) skips[xsKey(st.id)]=true; });
  plPersistOk(saveSkips());
  const W=watch[watchKey(PL.id)];
  if(W && W.s){ W.e=nowHM(); delete W.ac; plPersistOk(saveWatch()); }
  plRestSet(0); liveSave();
}
/* Вернуться в закрытую тренировку: пропущенные шаги снова на очереди, конец снимается */
function plResume(e){
  plGroups(e).forEach(g=>{ delete skips[xsKey(g.id)]; });
  plPersistOk(saveSkips());
  const W=watch[watchKey(PL.id)];
  if(W && W.s){ delete W.e; delete W.ac; W.lt=Date.now(); plPersistOk(saveWatch()); }
}

/* ---------- Отдых: хранится время конца, а не счётчик ---------- */
function plRest(){
  if(!PL.id) return null;
  const L=live(); if(!L.restUntil) return null;
  const left=Math.round((L.restUntil-Date.now())/1000);
  if(-left*1000>REST_STALE_MS){ L.restUntil=0; L.restSec=0; liveSave(); return null; }
  return {left, total:L.restSec||0, over:left<=0};
}
async function plWakeOn(){ try{ if('wakeLock' in navigator && !PL.wake) PL.wake=await navigator.wakeLock.request('screen'); }catch(e){} }
function plWakeOff(){ try{ PL.wake && PL.wake.release(); }catch(e){} PL.wake=null; }
function plAudio(){
  try{ PL.ctx=PL.ctx||new (window.AudioContext||window.webkitAudioContext)(); if(PL.ctx.state==='suspended') PL.ctx.resume(); }catch(e){}
}
function plBeep(){
  try{
    const c=PL.ctx; if(c){
      [0,0.22,0.44].forEach(t=>{
        const o=c.createOscillator(), g=c.createGain();
        o.frequency.value=880; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(0.0001,c.currentTime+t);
        g.gain.exponentialRampToValueAtTime(0.35,c.currentTime+t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+t+0.18);
        o.start(c.currentTime+t); o.stop(c.currentTime+t+0.2);
      });
    }
  }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); else [0,180,360].forEach(t=>setTimeout(haptic,t)); }catch(e){}
}

/* ---------- Автозакрытие: 30 минут без записей ----------
   Берём все сессии с началом и без конца: сегодняшнюю и забытые с прошлых дней.
   Концом ставится время последней записи (нет записей - время начала) */
function plAutoClose(){
  let closed=0;
  const nowW=isNowWeek() ? buildWeek() : [];
  for(const k in watch){
    const W=watch[k]; if(!W || !W.s || W.e) continue;
    let lt=W.lt;
    if(!lt){
      /* сессия из прежней версии: время старта сегодня - можно посчитать, иначе она давно забыта */
      const m=TAG_RE.exec(k), id=m&&m[2]?m[2].slice(1):null;
      const en=nowW.find(x=>x.id===id && x.type==='gym');
      lt = en && en.dow===new Date().getDay() ? Date.parse(isoDay()+'T'+W.s+':00') : 0;
    }
    if(lt && Date.now()-lt<=AUTO_CLOSE_MS) continue;
    const end = lt ? hmOf(lt) : W.s;
    W.e=end; W.ac=1; closed++;
  }
  if(closed){
    saveWatch();
    if(LIVE && LIVE.sid){ const L=LIVE; if(L.restUntil){ L.restUntil=0; L.restSec=0; liveSave(); } }
  }
  return closed;
}

/* ---------- Мини-плашка над вкладками ---------- */
function runningEntry(){
  if(PL.id){ const e=plEntry(); if(e && sessionState(PL.id)==='run') return e; }
  if(!isNowWeek()) return null;
  return buildWeek().find(e=>e.type==='gym' && sessionState(e.id)==='run') || null;
}
/* короткое имя для плашки: «Болгарский» из «Болгарский сплит-присед» */
const plShortName=n=> n.length<=14 ? n : n.split(/[\s-]/)[0];
function plMiniText(e){
  PL.id=e.id;
  const st=plCur(e);
  const part = !st ? 'итог' : st.k==='warm' ? 'Разминка' : st.k==='set' ? `${plShortName(st.ex.name)} ${st.si+1} из ${st.n}` : plShortName(st.ex.name);
  return `${e.day.title} · ${part}`;
}
function updateMini(){
  const m=$('#mini'); if(!m) return;
  const e=$('#player').hidden ? runningEntry() : null;
  if(!e){ m.hidden=true; document.body.classList.remove('has-mini'); return; }
  const txt=plMiniText(e), R=plRest();
  const right = R ? `${R.over?'+':''}${mmss(Math.abs(R.left))}` : '';
  m.hidden=false; document.body.classList.add('has-mini');
  m.innerHTML=`<span class="grow"><b>${esc(txt)}</b></span>${right?`<span class="mt">${right}</span>`:`<span class="rb" style="width:36px;height:36px;border-radius:18px;background:rgba(127,127,127,.25);display:grid;place-items:center;color:inherit">${IC.play}</span>`}`;
  m.onclick=()=>openPlayer(e.id);
}


/* ============ Новые шаги программы v2: интервалы, сценарий четверга, тест (E4) ============
   Время идёт от сохранённого времени начала (planLive), поэтому переживает перезагрузку.
   Интервалы: live().iv={id, t0, pause}; сценарий: live().scn={id, t0, blk, bt0, bt:[время начала блоков]}.
   Детали интервалов пишутся в planWatch[...].iv, броски четверга - в planWatch[...].sh, тесты - в planTests (новые поля только добавлением) */
function ivPhases(ex){
  const I=ex.iv, out=[];
  for(let i=0;i<I.n;i++){ out.push({k:'work', i, sec:I.work}); if(i<I.n-1) out.push({k:'easy', i, sec:I.easy}); }
  return out;
}
/* Состояние интервалов: idle, run, pause, end. left - секунд до конца фазы, idx - номер фазы */
function ivState(ex){
  const L=live().iv;
  if(!L || L.id!==ex.id) return {st:'idle'};
  const ph=ivPhases(ex), total=ph.reduce((a,x)=>a+x.sec,0);
  const now=L.pause||Date.now(), el=Math.max(0,Math.floor((now-L.t0)/1000));
  if(el>=total) return {st:'end', ph, total, el, idx:ph.length};
  let acc=0, idx=0;
  for(;idx<ph.length;idx++){ if(el<acc+ph[idx].sec) break; acc+=ph[idx].sec; }
  return {st:L.pause?'pause':'run', ph, total, el, idx, cur:ph[idx], left:acc+ph[idx].sec-el, into:el-acc};
}
const ivLabel=S=> S.cur.k==='work' ? `Работа ${S.cur.i+1} из ${Math.ceil(S.ph.length/2)}` : 'Легко';
function plIvStart(ex){ const L=live(); L.iv={id:ex.id, t0:Date.now(), pause:0}; PL.ivIdx=0; liveSave(); }
function plIvPause(ex){ const L=live(); if(L.iv && !L.iv.pause){ L.iv.pause=Date.now(); liveSave(); } }
function plIvResume(ex){ const L=live(); if(L.iv && L.iv.pause){ L.iv.t0+=Date.now()-L.iv.pause; L.iv.pause=0; liveSave(); } }
/* Закончить: пульс в конце необязательный. Детали - в planWatch, шаг отмечается */
function plIvFinish(st, e, hrEnd){
  const ex=st.ex, S=ivState(ex), L=live();
  const W=watch[watchKey(PL.id)];
  const doneWork=S.st==='end' ? ex.iv.n : (S.cur ? S.cur.i+(S.cur.k==='easy'?1:0) : 0);
  if(W){ W.iv={n:ex.iv.n, work:ex.iv.work, easy:ex.iv.easy, done:doneWork, ...(hrEnd!=null?{hrEnd}:{})}; plPersistOk(saveWatch()); }
  L.iv=null; liveSave();
  plMarkEx(st, e);
}
/* Сценарий */
const scnBlocks=ex=>ex.blocks||[];
function scnState(ex){ const L=live().scn; return L && L.id===ex.id ? L : null; }
function plScnStart(ex){ const t=Date.now(); live().scn={id:ex.id, t0:t, blk:0, bt0:t, bt:[t]}; liveSave(); }
function plScnNext(st, e){
  const ex=st.ex, L=live(), S=L.scn; if(!S) return;
  if(S.blk>=scnBlocks(ex).length-1){ plScnEnd(st, e); return; }
  S.blk++; S.bt0=Date.now(); S.bt.push(S.bt0); liveSave();
}
function plScnEnd(st, e){ const L=live(); L.scn=null; liveSave(); plMarkEx(st, e); }
/* Броски: два счётчика на бросковый блок. Хранятся числами в planWatch[...].sh = [{b, h, n}] */
function shotsOf(bid){ const W=watch[watchKey(PL.id)]||{}; return (W.sh||[]).find(x=>x.b===bid)||{b:bid, h:0, n:0}; }
function plShotAdj(bid, f, d){
  const k=watchKey(PL.id), W=watch[k]||(watch[k]={});
  W.sh=W.sh||[]; let r=W.sh.find(x=>x.b===bid); if(!r){ r={b:bid, h:0, n:0}; W.sh.push(r); }
  r[f]=Math.max(0, Math.min(999, r[f]+d));
  if(f==='h' && r.h>r.n) r.n=r.h;         /* попал не больше, чем бросил */
  if(f==='n' && r.n<r.h) r.h=r.n;
  plPersistOk(saveWatch());
}
/* Тест: число и единица, запись в planTests. Второй тест того же вида в тот же день (батарея два раза) - отдельная запись (поле s) */
function plTestWrite(ex, v, slot){
  const t=ex.test.t, d=isoDay();
  for(let i=tests.length-1;i>=0;i--) if(tests[i].t===t && tests[i].d===d && (tests[i].s||'')===(slot||'')) tests.splice(i,1);
  tests.push({d, t, v, ...(slot?{s:slot}:{})});
  plPersistOk(saveTests());
}
const plTestOf=ex=>{ const d=isoDay(), slot=ex.id==='sB2'?'2':''; const r=tests.find(x=>x.t===ex.test.t && x.d===d && (x.s||'')===slot); return r?r.v:null; };
