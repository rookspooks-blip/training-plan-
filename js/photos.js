"use strict";
/* ############################################################
   ФОТО ДВИЖЕНИЙ
   Два кадра: начало и конец. В карточке они сменяют друг друга —
   видно само движение, а не застывшую позу. Нажатие — оба кадра рядом.
   Источник: free-exercise-db (github.com/yuhonas/free-exercise-db),
   лицензия Unlicense — общественное достояние. Где подходящего фото
   нет (копенгаген, ахилл, ускорения, изометрия у стены), остаётся схема.
   ############################################################ */
const PHOTO_BY_TECH={
  squat:'barbell-full-squat', trap:'trap-bar-deadlift', ohp:'standing-military-press',
  row:'one-arm-dumbbell-row', pullup:'pullups', pushup:'pushups', pistol:'kettlebell-pistol-squat',
  bulgarian:'split-squat-with-dumbbells', hipthrust:'single-leg-glute-bridge',
  rdl:'kettlebell-one-legged-deadlift', calf:'calf-raise-on-a-dumbbell', plank:'side-bridge',
  pallof:'pallof-press', deadbug:'dead-bug', curl:'dumbbell-bicep-curl',
  triceps:'dumbbell-one-arm-triceps-extension', facepull:'face-pull', jump:'freehand-jump-squat',
  nordic:'natural-glute-ham-raise', hamslide:'platform-hamstring-slides', plyo:'hurdle-hops',
  w_inchworm:'inchworm', w_bridge:'butt-lift-bridge',
  st_calf:'calf-stretch-hands-against-wall', st_soleus:'standing-soleus-and-achilles-stretch',
  st_ham:'hamstring-stretch', st_glute:'it-band-and-glute-stretch', st_hipflex:'kneeling-hip-flexor',
  roll_quad:'quadriceps-smr', roll_ham:'hamstring-smr', roll_it:'iliotibial-tract-smr',
  roll_calf:'calves-smr', roll_glute:'piriformis-smr'
};
/* Название точнее техники: тот же приём, другой снаряд или хват.
   null — фото по технике вводило бы в заблуждение, лучше схема */
const PHOTO_BY_NAME={
  'Жим гантелей стоя':'standing-dumbbell-press',
  'Жим гантелей сидя со спинкой':'dumbbell-shoulder-press',
  'Тяга штанги в наклоне':'bent-over-barbell-row',
  'Подтягивания обратным хватом':'chin-up',
  'Жим штанги лёжа':'barbell-bench-press---medium-grip',
  'Отжимания на брусьях':'dips---chest-version', 'Брусья с весом':'dips---chest-version',
  'Прыжки на тумбу':'front-box-jump', 'Выпрыгивания на тумбу':'front-box-jump',
  'Латеральные прыжки':'lateral-cone-hops',
  'Тяга гантели лёжа грудью на скамье':null, 'Тяга гантелей лёжа грудью на скамье':null
};
function photoOf(tech, name){
  if(name && name in PHOTO_BY_NAME) return PHOTO_BY_NAME[name];
  return PHOTO_BY_TECH[tech] || null;
}
/* Картинка к упражнению: фото, если есть, иначе схема */
function figFor(tech, name){
  const p=photoOf(tech, name);
  if(p) return `<figure class="photo" role="button" tabindex="0" aria-label="${esc(name||'')}: начало и конец движения, нажми — оба кадра рядом">
      <img src="img/ex/${p}-0.webp" alt="${esc(name||'')} — начало" loading="lazy" decoding="async">
      <img src="img/ex/${p}-1.webp" alt="${esc(name||'')} — конец" loading="lazy" decoding="async" class="p2">
      <figcaption><span class="pa">1 · начало</span><span class="pb">2 · конец</span></figcaption>
    </figure>`;
  const t=TECH[tech];
  return t && t.fig ? `<div class="fig">${S[t.fig]}</div>` : '';
}
/* Нажатие на фото: анимация ↔ оба кадра рядом */
document.addEventListener('click',e=>{
  const f=e.target.closest && e.target.closest('.photo');
  if(!f) return;
  e.stopPropagation();
  f.classList.toggle('split');
}, true);
