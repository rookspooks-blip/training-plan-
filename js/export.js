"use strict";
/* ############################################################
   ВЫГРУЗКА ДНЯ: всё, что записано за дату, одним текстом / JSON / CSV
   ############################################################ */
const WD_FULL=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const pad2=n=>String(n).padStart(2,'0');
const nowHM=()=>{ const d=new Date(); return pad2(d.getHours())+':'+pad2(d.getMinutes()); };
const dateOfCW=(c,w,dow)=>{
  const ses=settings.session|0, g = c===1 ? w-1 : (c===2 ? 12+ses+w-1 : 24+ses+w-1);
  return addDays(settings.start, g*7+dow);
};
/* Считаем в чужой неделе: подменяем положение в плане и возвращаем обратно */
function withWeek(c,w,fn){
  const sv={c:state.cycle,w:state.week};
  state.cycle=c; state.week=w;
  try{ return fn(); } finally{ state.cycle=sv.c; state.week=sv.w; loadFoodDay(); }
}

function dayExport(iso){
  const dow=(dOf(iso).getDay()+6)%7;
  const pos=posForDate(iso);
  return withWeek(pos.cycle,pos.week,()=>{
    const info=weekInfo(), T=nutritionTarget();
    const D={date:iso, weekday:WD_FULL[dow], cycle:pos.cycle, week:pos.week, weekLabel:info.label,
             preStart:!!pos.pre, target:{kcal:T.k, p:T.p, f:T.f, c:T.c}};

    /* до старта плана недели ещё нет: тренировки и еда по расписанию не считаются */
    if(pos.pre){
      D.training={type:'rest', title:'до старта плана'}; D.dailyBlock=null;
      D.food={meals:[], total:{kcal:0,p:0,f:0,c:0}};
      D.body=body[iso]?{...body[iso]}:null;
      D.circ=circ.filter(x=>x.d===iso).map(x=>({waistNarrow:x.a, waistNavel:x.b, thigh:x.h}));
      D.tests=tests.filter(x=>x.d===iso).map(x=>({test:TESTS[x.t]?TESTS[x.t].n:x.t, value:x.v, unit:TESTS[x.t]?TESTS[x.t].u:''}));
      return D;
    }

    /* --- тренировка дня --- */
    const e=buildWeek().find(x=>(x.dow===0?6:x.dow-1)===dow);
    let tr={type:'rest', title:'Отдых'};
    if(e && e.type==='gym'){
      const day=e.day, dropped=isDropped(e.id), moved=isMoved(e.id)&&!dropped;
      const warm=warmupOf(day, state.week);
      const exs=day.ex.map(x=>{
        const L=logs[logKey(day.id,x.id)];
        const sets=L?L.sets.filter(s=>num(s.r)!=null).map(s=>({kg:num(s.w)||0, reps:num(s.r)})):[];
        return {name:x.name, plan:x.dose, rest:x.rest, done:!!marks[key(day.id,x.id)], sets, rpe:L&&L.rpe||null};
      });
      const wd=watch[`${state.cycle}-${state.week}-${day.id}`]||null;
      tr={type:'gym', title:day.title, status:dropped?'отменена':(moved?'перенесена':'по плану'), watch:wd?{start:wd.s||null, end:wd.e||null, minutes:watchMinutes(wd), avgHr:num(wd.hr), maxHr:num(wd.mx), kcal:num(wd.kc)}:null,
          noPE: day.swap?true:false,
          warmupDone:day.noWarm?0:warm.list.filter(s=>marks[key(day.id,s.id)]).length, warmupTotal:day.noWarm?0:warm.list.length,
          exercises:exs, done:exs.filter(x=>x.done).length, total:exs.length,
          volumeKg:Math.round(exs.reduce((a,x)=>a+x.sets.reduce((b,s)=>b+s.kg*s.reps,0),0))};
    } else if(e && e.type==='run'){
      const wd=watch[`${state.cycle}-${state.week}-${e.id}`]||null;
      tr={type:'cardio', title:e.title, dur:e.dur, note:e.note, done:!!marks[key(e.id,e.ex)], ball:!!marks[key(e.id,'ball')], skipped:isSkipped(e.id),
          watch:wd?{start:wd.s||null, end:wd.e||null, minutes:watchMinutes(wd), avgHr:num(wd.hr), maxHr:num(wd.mx), kcal:num(wd.kc)}:null};
    } else if(e){ tr={type:'rest', title:e.title}; }
    D.training=tr;
    D.dailyBlock = !!marks[`${state.cycle}-${state.week}-daily-${dow}`];

    /* --- еда --- */
    const fe=foodLog[`${state.cycle}-${state.week}-${dow}`];
    const meals=[]; let k=0,p=0,f=0,c=0;
    if(fe){
      DISHES.forEach(dish=>{
        if(!fe.dishOn || !fe.dishOn[dish.id]) return;
        let dk=0,dp=0,df=0,dc=0; const ing=[];
        dish.ing.forEach(([fid,base])=>{
          const kk=`${dish.id}-${fid}`;
          const g=(fe.grams && fe.grams[kk]!=null) ? fe.grams[kk] : Math.round(base*portionFactor()/5)*5;
          const F=FOOD[fid];
          dk+=F.k*g/100; dp+=F.p*g/100; df+=F.f*g/100; dc+=F.c*g/100;
          ing.push({food:F.n, g});
        });
        meals.push({time:(fe.times||{})[dish.id]||null, name:dish.name, kcal:Math.round(dk), p:Math.round(dp), f:Math.round(df), c:Math.round(dc), ing});
        k+=dk; p+=dp; f+=df; c+=dc;
      });
      (fe.custom||[]).forEach(x=>{
        meals.push({time:x.t||null, name:x.name, custom:true, kcal:x.k, p:x.p, f:x.f, c:x.c, ing:[]});
        k+=x.k; p+=x.p; f+=x.f; c+=x.c;
      });
    }
    meals.sort((a,b)=> (a.time||'99:99')<(b.time||'99:99') ? -1 : ((a.time||'99:99')>(b.time||'99:99') ? 1 : 0));
    D.food={meals, total:{kcal:Math.round(k), p:Math.round(p), f:Math.round(f), c:Math.round(c)}};

    /* --- утренние замеры, обхваты, тесты --- */
    D.body=body[iso]?{...body[iso]}:null;
    D.circ=circ.filter(x=>x.d===iso).map(x=>({waistNarrow:x.a, waistNavel:x.b, thigh:x.h}));
    D.tests=tests.filter(x=>x.d===iso).map(x=>({test:TESTS[x.t]?TESTS[x.t].n:x.t, value:x.v, unit:TESTS[x.t]?TESTS[x.t].u:''}));
    return D;
  });
}

const R1=x=>String(x).replace('.',',');
function watchLine(w){
  const p=[];
  if(w.start||w.end) p.push(`${w.start||'—'}–${w.end||'—'}${w.minutes!=null?` (${fmtDur(w.minutes)})`:''}`);
  if(w.avgHr!=null) p.push(`пульс ${w.avgHr}${w.maxHr!=null?'/'+w.maxHr:''}`);
  if(w.kcal!=null) p.push(`${w.kcal} ккал по часам`);
  return '  Часы: '+(p.join(' · ')||'—');
}
function dayText(D){
  const L=[];
  const [y,m,d]=D.date.split('-');
  L.push(`ДЕНЬ · ${D.weekday} ${d}.${m}.${y}`);
  L.push(D.cycle===1&&D.week>12 ? `Сессионный блок, неделя ${D.week-12}` : `Цикл ${D.cycle}, неделя ${D.week} · ${D.weekLabel}`);
  if(D.preStart) L.push('(дата до старта плана — только замеры и тесты)');
  L.push('');
  const B=D.body;
  L.push('ЗАМЕРЫ УТРОМ');
  if(B && (B.w!=null||B.hr!=null||B.knee!=null||B.back!=null||B.groin!=null||B.feel!=null)){
    L.push(`  Вес: ${B.w!=null?R1(B.w)+' кг':'—'} · пульс: ${B.hr!=null?B.hr:'—'} · поясница: ${B.back!=null?B.back+'/10':'—'} · колено: ${B.knee!=null?B.knee+'/10':'—'}${B.groin!=null?` · пах: ${B.groin}/10`:''} · самочувствие: ${B.feel!=null?B.feel+'/10':'—'}`);
  } else L.push('  ничего не записано');
  D.circ.forEach(c=>L.push(`  Обхваты: талия узкая ${c.waistNarrow??'—'}, по пупку ${c.waistNavel??'—'}, бедро ${c.thigh??'—'}`));
  D.tests.forEach(t=>L.push(`  Тест: ${t.test} — ${R1(t.value)} ${t.unit}`));
  if(D.preStart) return L.join('\n');
  L.push('');
  const T=D.training;
  L.push('ТРЕНИРОВКА');
  if(T.type==='gym'){
    L.push(`  ${T.title} (${T.status}) — сделано ${T.done}/${T.total}${T.warmupTotal?`, разминка ${T.warmupDone}/${T.warmupTotal}`:''}${T.noPE?', физры не было':''}`);
    T.exercises.forEach((x,i)=>{
      const sets=x.sets.map(s=>(s.kg?R1(s.kg)+'×':'')+s.reps).join(', ');
      L.push(`  ${i+1}. ${x.name} — ${x.plan}${x.done?' ✓':''}`);
      if(sets||x.rpe) L.push(`     ${sets||'подходы не записаны'}${x.rpe?` · тяжесть ${x.rpe}`:''}`);
    });
    if(T.volumeKg) L.push(`  Тоннаж: ${T.volumeKg} кг`);
    if(T.watch) L.push(watchLine(T.watch));
  } else if(T.type==='cardio'){
    L.push(`  ${T.title} ${T.dur} — ${T.skipped?'пропущено':(T.done?'сделано':'не отмечено')}${T.ball?' · мяч сделан':''}`);
    if(T.watch) L.push(watchLine(T.watch));
  } else L.push(`  ${T.title}`);
  if(D.dailyBlock!==null) L.push(`  Ежедневный блок: ${D.dailyBlock?'сделан':'не отмечен'}`);
  L.push('');
  const tg=D.target, F=D.food;
  L.push(`ЕДА · цель ${tg.kcal} ккал, Б${tg.p} Ж${tg.f} У${tg.c}`);
  if(F.meals.length){
    F.meals.forEach(x=>{
      L.push(`  ${x.time||'—:—'}  ${x.name}${x.custom?' (вручную)':''} — ${x.kcal} ккал, Б${x.p} Ж${x.f} У${x.c}`);
      if(x.ing.length) L.push(`         ${x.ing.map(i=>`${i.food.toLowerCase()} ${i.g} г`).join(', ')}`);
    });
    const dk=F.total.kcal-tg.kcal;
    L.push(`  ИТОГО: ${F.total.kcal} ккал (${dk>0?'+':''}${dk}), Б${F.total.p} Ж${F.total.f} У${F.total.c}`);
  } else L.push('  ничего не записано');
  return L.join('\n');
}

const csvCell=v=>{ if(v==null) return ''; const s=String(v); return /[",;\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
const CSV_COLS=['date','weekday','cycle','week','training','training_status','exercises_done','exercises_total','sets_logged','tonnage_kg','top_rpe','warmup_done','cardio_done','ball_done','daily_block',
  'kcal','kcal_target','protein','protein_target','fat','carb','meals','first_meal','last_meal','weight_kg','pulse','back_0_10','knee_0_10','feel_1_10','workout_start','workout_end','workout_min','workout_avg_hr','workout_max_hr','watch_kcal','groin_0_10'];
function dayRow(D){
  const T=D.training, F=D.food, B=D.body||{};
  const times=F.meals.map(m=>m.time).filter(Boolean).sort();
  const sets=T.type==='gym'?T.exercises.reduce((a,x)=>a+x.sets.length,0):'';
  const rp=T.type==='gym'?Math.max(0,...T.exercises.map(x=>x.rpe||0)):0;
  return [D.date,D.weekday,D.cycle,D.week,T.title,T.status||'',
    T.type==='gym'?T.done:'', T.type==='gym'?T.total:'', sets, T.type==='gym'?T.volumeKg:'', rp||'',
    T.type==='gym'&&T.warmupTotal?`${T.warmupDone}/${T.warmupTotal}`:'',
    T.type==='cardio'?(T.done?1:0):'', T.type==='cardio'?(T.ball?1:0):'',
    D.dailyBlock===null?'':(D.dailyBlock?1:0),
    F.meals.length?F.total.kcal:'', D.target.kcal, F.meals.length?F.total.p:'', D.target.p, F.meals.length?F.total.f:'', F.meals.length?F.total.c:'',
    F.meals.length, times[0]||'', times[times.length-1]||'',
    B.w??'', B.hr??'', B.back??'', B.knee??'', B.feel??'',
    (T.watch&&T.watch.start)||'', (T.watch&&T.watch.end)||'', (T.watch&&T.watch.minutes)??'', (T.watch&&T.watch.avgHr)??'', (T.watch&&T.watch.maxHr)??'', (T.watch&&T.watch.kcal)??'', B.groin??''];
}
/* Все даты, по которым что-то записано */
function datesWithData(){
  const set=new Set();
  const addWeek=(c,w)=>{ for(let i=0;i<7;i++) set.add(dateOfCW(c,w,i)); };
  Object.keys(foodLog).forEach(k=>{ const [c,w,d]=k.split('-').map(Number); if(foodLog[k] && (Object.values(foodLog[k].dishOn||{}).some(Boolean)||(foodLog[k].custom||[]).length)) set.add(dateOfCW(c,w,d)); });
  [marks,logs,watch].forEach(src=>Object.keys(src).forEach(k=>{ const [c,w]=k.split('-').map(Number); if(c&&w&&src[k]&&(src!==logs||hasData(src[k]))) addWeek(c,w); }));
  Object.keys(body).forEach(d=>set.add(d)); circ.forEach(x=>set.add(x.d)); tests.forEach(x=>set.add(x.d));
  return [...set].filter(Boolean).sort();
}
function allDays(){
  return datesWithData().map(d=>dayExport(d)).filter(D=>
    D.body || D.food.meals.length || D.circ.length || D.tests.length || D.dailyBlock===true ||
    (D.training.watch) ||
    (D.training.type==='gym' && (D.training.done||D.training.sets||D.training.exercises.some(x=>x.sets.length))) ||
    (D.training.type==='cardio' && (D.training.done||D.training.ball)));
}

async function shareFile(name, text, mime, title){
  const file=new File([text], name, {type:mime});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  const a=document.createElement('a');
  a.href=URL.createObjectURL(file); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
async function copyText(t){
  try{ if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(t); return true; } }catch(e){}
  const ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,999999);
  let ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  ta.remove(); return ok;
}

