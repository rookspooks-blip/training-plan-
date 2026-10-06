"use strict";
/* ############################################################
   1 · СХЕМЫ ДВИЖЕНИЙ (SVG внутри файла, работает офлайн)
   ############################################################ */
const ST = 'fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"';
const AC = 'fill="none" stroke="var(--accent)" stroke-width="3.2" stroke-linecap="round"';
const WK = 'fill="none" stroke="var(--warmc)" stroke-width="3" stroke-linecap="round"';

/* Голова с глазом. По глазу видно, куда смотрит человек —
   это важнее, чем кажется: взгляд задаёт положение шеи и спины.
   dx,dy — направление взгляда: 1,0 = вправо; 0,1 = вниз; 0,-1 = вверх. */
function head(cx,cy,dx,dy,r){
  r = r || 9;
  const ex = (cx + (dx||0)*r*0.55).toFixed(1);
  const ey = (cy + (dy||0)*r*0.55 - r*0.10).toFixed(1);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--fig-head)"/>`
       + `<circle cx="${ex}" cy="${ey}" r="2.2" fill="var(--fig-eye)" stroke="none"/>`;
}
const CAP = (x,y,t) => `<text x="${x}" y="${y}" fill="var(--muted)" font-size="11">${t}</text>`;

const S = {

/* ---------- ШТАНГА ---------- */
squat:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(68,22,1,0)}<path d="M66 31l-2 31"/><path d="M64 62l3 22-2 22"/><path d="M64 62l-1 22 1 22"/><path d="M58 107h16"/>
 ${head(202,42,1,0.2)}<path d="M194 50l-20 38"/><path d="M174 88l32-4-12 22"/><path d="M174 88l28 0-12 18"/><path d="M186 107h16"/></g>
 <circle cx="60" cy="36" r="6" fill="var(--accent)"/><circle cx="188" cy="54" r="6" fill="var(--accent)"/>
 <path d="M206 84v22" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 3"/>
 ${CAP(40,126,'гриф на трапеции · взгляд вперёд')}${CAP(146,126,'бедро ниже колена · колено над носком')}</svg>`,

trap:`<svg viewBox="0 0 260 132" style="color:var(--muted)"><g ${ST}>
 ${head(62,30,1,0.4)}<path d="M62 39l6 26"/><path d="M68 65l-8 22v18"/><path d="M68 65l10 22 2 18"/><path d="M50 105h16M72 105h14"/><path d="M55 42v26M79 42v26"/>
 ${head(182,24,1,0)}<path d="M182 33v30"/><path d="M182 63l-9 24v18"/><path d="M182 63l9 24v18"/><path d="M165 105h16M185 105h14"/><path d="M172 36v34M192 36v34"/></g>
 <ellipse cx="67" cy="70" rx="24" ry="7" fill="none" stroke="var(--accent)" stroke-width="3.2"/>
 <ellipse cx="182" cy="72" rx="24" ry="7" fill="none" stroke="var(--accent)" stroke-width="3.2"/>
 ${CAP(24,126,'старт · таз ниже плеч')}${CAP(158,126,'финиш · стоишь прямо')}</svg>`,

ohp:`<svg viewBox="0 0 260 132" style="color:var(--muted)"><g ${ST}>
 ${head(65,34,1,0)}<path d="M65 43v30"/><path d="M65 73l-8 32M65 73l8 32"/><path d="M53 105h12M65 105h12"/><path d="M65 48l-14-4M65 48l14-4"/>
 ${head(185,40,1,0)}<path d="M185 49v24"/><path d="M185 73l-8 32M185 73l8 32"/><path d="M173 105h12M185 105h12"/><path d="M185 52l-13-26M185 52l13-26"/></g>
 <path d="M45 44h40M165 26h40" ${AC}/>
 ${CAP(22,126,'гриф на ключицах')}${CAP(150,126,'гриф над макушкой')}</svg>`,

row:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(44,40,1,0.7)}<path d="M52 46l40 18"/><path d="M92 64l4 24v22"/><path d="M84 110h18"/><path d="M62 52v34"/>
 ${head(164,40,1,0.7)}<path d="M172 46l40 18"/><path d="M212 64l4 24v22"/><path d="M204 110h18"/><path d="M182 52v14l12 14"/></g>
 <path d="M52 86h20M176 80h20" ${AC}/>
 ${CAP(20,128,'старт · руки прямые')}${CAP(146,128,'локоть к поясу, лопатка назад')}</svg>`,

pullup:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M20 18h100M140 18h100" ${AC}/><g ${ST}>
 ${head(70,52,0,-1)}<path d="M70 61v28"/><path d="M70 89l-7 22M70 89l7 22"/><path d="M70 46l-14-28M70 46l14-28"/>
 ${head(190,30,0,-1)}<path d="M190 39v30"/><path d="M190 69l-7 24M190 69l7 24"/><path d="M190 30l-16-12M190 30l16-12"/></g>
 ${CAP(20,128,'вис · руки прямые')}${CAP(136,128,'подбородок выше грифа')}</svg>`,

/* ---------- СВОЙ ВЕС ---------- */
pushup:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(34,66,1,0.7)}<path d="M42 70l44 12 38 18"/><path d="M48 72v38"/><path d="M116 110h16"/>
 ${head(154,88,1,0.7)}<path d="M162 91l44 6 38 12"/><path d="M168 93l14 10-14 7"/><path d="M236 110h10"/></g>
 ${CAP(18,128,'верх · тело прямой линией')}${CAP(146,128,'низ · локти назад под 45°')}</svg>`,

pistol:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(62,26,1,0)}<path d="M62 35v26"/><path d="M62 61l-2 28v21"/><path d="M52 110h18"/><path d="M62 61l16 4 18-2"/><path d="M62 42l18 6"/>
 ${head(180,52,1,0)}<path d="M180 61v18"/><path d="M180 79l-14 16v15"/><path d="M158 110h16"/><path d="M180 79l26 4 24-8"/><path d="M180 64l24 2"/></g>
 ${CAP(24,128,'стоишь на одной')}${CAP(140,128,'вниз 3 сек, колено наружу')}</svg>`,

bulgarian:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <path d="M150 80h70" ${AC}/><path d="M175 80v26M215 80v26" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>
 <g ${ST}>
 ${head(112,30,1,0)}<path d="M112 39v28"/><path d="M112 67l-14 22v21"/><path d="M88 110h18"/><path d="M112 67l24 8 22 6"/><path d="M112 44l-8 24M112 44l6 24"/></g>
 ${CAP(14,128,'голень передней ноги вертикальна, задняя стопа на опоре')}</svg>`,

hipthrust:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <path d="M30 74h56" ${AC}/><path d="M40 74v36M78 74v36" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>
 <g ${ST}>
 ${head(52,64,1,0)}<path d="M61 66h34"/><path d="M95 66l36-4"/><path d="M131 62l16 26v22"/><path d="M139 110h18"/>
 <path d="M131 62l24-16"/></g>
 <path d="M70 48h70" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 ${CAP(66,44,'линия колено–таз–плечо')}
 ${CAP(14,128,'толчок пяткой, пауза 2 сек, рёбра опущены')}</svg>`,

calf:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M30 96h60M170 96h60" ${AC}/><path d="M30 96v14M170 96v14" ${AC}/>
 <g ${ST}>
 ${head(60,30,1,0)}<path d="M60 39v30"/><path d="M60 69v22"/><path d="M60 91l-8 18"/><path d="M60 91h14"/>
 ${head(200,22,1,0)}<path d="M200 31v30"/><path d="M200 61v22"/><path d="M200 83l-2 10"/><path d="M200 83h16"/></g>
 <path d="M48 104h18" ${WK}/>${CAP(30,126,'пятка ниже носка')}
 <path d="M188 88h18" ${WK}/>${CAP(160,126,'наверх максимально, пауза 1 сек')}</svg>`,

plank:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(46,58,1,0)}<path d="M54 62l60 18 56 20"/><path d="M56 64l-6 22"/><path d="M42 86h20"/><path d="M162 110h20"/>
 <path d="M114 80l24-16"/></g>
 <path d="M54 46h100" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 ${CAP(56,42,'прямая линия стопа–таз–макушка')}
 ${CAP(14,128,'таз поднят, верхняя нога может подниматься')}</svg>`,

pallof:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M226 20v90" ${AC}/>
 <path d="M226 62q-26 4-50 2" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-dasharray="6 4"/>
 <g ${ST}>
 ${head(100,28,1,0)}<path d="M100 37v30"/><path d="M100 67l-10 22v21"/><path d="M100 67l10 22 2 21"/><path d="M80 110h16M104 110h16"/>
 <path d="M100 48h76"/></g>
 <path d="M74 50a20 20 0 010 26" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="4 3"/>
 ${CAP(14,128,'корпус не разворачивается, руки прямо перед грудью')}</svg>`,

/* ---------- ТЯГИ И РУКИ ---------- */
rdl:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(56,26,1,0)}<path d="M56 35v28"/><path d="M56 63v26"/><path d="M46 110h20"/><path d="M56 44v26"/>
 ${head(146,52,1,0.5)}<path d="M154 56l46 10"/><path d="M200 66l4 22v22"/><path d="M194 110h20"/><path d="M200 66l-42-2"/><path d="M176 62v28"/></g>
 <path d="M170 92h16" ${AC}/>
 ${CAP(30,128,'стоишь')}${CAP(120,128,'таз назад, спина и задняя нога одной линией')}</svg>`,

curl:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(70,22,1,0)}<path d="M70 31v34"/><path d="M70 65l-4 20 0 22M70 65l4 20 2 22"/><path d="M62 107h10M72 107h12"/>
 <path d="M70 38l4 22 2 24"/>
 ${head(186,22,1,0)}<path d="M186 31v34"/><path d="M186 65l-4 20 0 22M186 65l4 20 2 22"/><path d="M178 107h10M188 107h12"/>
 <path d="M186 38l2 24 18-18"/></g>
 <path d="M68 86h16M198 40h16" ${AC}/>
 <path d="M188 62m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 3"/>
 ${CAP(30,126,'руки прямые')}${CAP(146,126,'локоть на месте, вверх')}</svg>`,

triceps:`<svg viewBox="0 0 260 132" style="color:var(--muted)"><g ${ST}>
 ${head(64,34,1,0)}<path d="M64 43v30"/><path d="M64 73l-8 32M64 73l8 32"/><path d="M52 105h12M64 105h12"/>
 <path d="M64 48l6-22 -16 -6"/>
 ${head(186,34,1,0)}<path d="M186 43v30"/><path d="M186 73l-8 32M186 73l8 32"/><path d="M174 105h12M186 105h12"/>
 <path d="M186 48l6-22 4-14"/></g>
 <path d="M44 22h20M188 8h20" ${AC}/>
 ${CAP(14,126,'низ · трицепс растянут за головой')}${CAP(152,126,'верх · руки прямые')}</svg>`,

facepull:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M36 16v94" ${AC}/>
 <path d="M36 44q30 -2 56 4" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-dasharray="6 4"/>
 <path d="M36 60q26 6 50 12" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-dasharray="6 4"/>
 <g ${ST}>
 ${head(140,36,-1,0)}<path d="M140 45v30"/><path d="M140 75l-10 20v15"/><path d="M140 75l10 20v15"/><path d="M120 110h16M144 110h16"/>
 <path d="M140 48l-22 -4 -26 4"/><path d="M140 54l-22 6 -30 12"/></g>
 ${CAP(14,128,'тянешь к переносице, локти выше кистей, лопатки сводятся')}</svg>`,

/* ---------- ПРЫЖКИ И СКОРОСТЬ ---------- */
jump:`<svg viewBox="0 0 260 132" style="color:var(--muted)"><g ${ST}>
 ${head(58,46,1,0)}<path d="M58 55v18"/><path d="M58 73l-12 16v16M58 73l12 16v16"/><path d="M40 105h14M66 105h14"/><path d="M58 58l-16 8M58 58l16 8"/>
 ${head(130,24,1,0)}<path d="M130 33v26"/><path d="M130 59l-8 24v20M130 59l8 24v20"/><path d="M130 36l-14-14M130 36l14-14"/>
 ${head(205,40,1,0)}<path d="M205 49v20"/><path d="M205 69l-11 18v18M205 69l11 18v18"/><path d="M188 105h14M212 105h14"/></g>
 ${CAP(34,126,'подсед')}${CAP(110,126,'вылет')}${CAP(172,126,'мягкая посадка')}</svg>`,

nordic:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <rect x="26" y="96" width="16" height="9" rx="3" fill="var(--accent)"/><rect x="138" y="96" width="16" height="9" rx="3" fill="var(--accent)"/><g ${ST}>
 ${head(76,34,1,0)}<path d="M75 44l-1 32"/><path d="M74 76l-2 30"/><path d="M72 106H40"/><path d="M75 52l12 10-6 4"/>
 ${head(222,56,1,0.6)}<path d="M214 63l-24 22"/><path d="M190 85l-16 21"/><path d="M174 106h-34"/><path d="M211 67l16 20"/></g>
 <path d="M236 30a44 44 0 0 1 4 44" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="4 4"/>
 <path d="M236 70l4 6 4-7" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 ${CAP(20,126,'старт · тело прямое, пятки зажаты')}${CAP(150,126,'вниз 3–4 сек · ловишь руками')}</svg>`,

copenhagen:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <g fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M92 70h34M96 70v40M122 70v40"/><path d="M212 70h34M216 70v40M242 70v40"/></g><g ${ST}>
 ${head(22,72,1,-0.2)}<path d="M28 106h16"/><path d="M30 106l2-20"/><path d="M32 86l38-8"/><path d="M70 78l30-8 18-2"/><path d="M70 78l18 16 4 14"/>
 ${head(142,72,1,-0.2)}<path d="M148 106h16"/><path d="M150 106l2-20"/><path d="M152 86l40-8"/><path d="M192 78l46-12"/><path d="M192 78l14 16 4 14"/></g>
 <path d="M60 74v-12M182 74v-12" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 <path d="M56 66l4-5 4 5M178 66l4-5 4 5" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 ${CAP(18,126,'лёгкий · колено на скамье')}${CAP(140,126,'тяжёлый · стопа на скамье')}</svg>`,

landing:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <rect x="18" y="84" width="40" height="26" rx="3" fill="none" stroke="var(--accent)" stroke-width="3"/><g ${ST}>
 ${head(82,24,1,0.2)}<path d="M82 33v27"/><path d="M82 60l6 16-4 16M82 60l-4 16-6 14"/><path d="M82 40l14 12M82 40l10 14"/>
 ${head(206,42,1,0.3)}<path d="M203 51l-12 24"/><path d="M191 75l20 14-4 19"/><path d="M191 75l14 16-6 17"/><path d="M200 56l22 8M200 56l20 12"/>
 <path d="M200 108h14"/></g>
 <path d="M60 76q12-4 18 6" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 3"/>
 <path d="M212 88v20" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 3"/>
 ${CAP(16,126,'шаг с тумбы 20–30 см')}${CAP(150,126,'замри · колено над носком')}</svg>`,

dribble:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(76,30,1,0.1)}<path d="M74 39l6 28"/><path d="M80 67l-14 18 0 22M80 67l16 16-4 24"/><path d="M76 46l18 20 8 8"/><path d="M76 46l-12 18"/>
 <path d="M60 107h10M88 107h12"/>
 ${head(190,30,1,0.1)}<path d="M188 39l6 28"/><path d="M194 67l-14 18 0 22M194 67l16 16-4 24"/><path d="M190 46l-20 18-8 8"/><path d="M190 46l12 18"/>
 <path d="M174 107h10M202 107h12"/></g>
 <circle cx="108" cy="94" r="10" fill="var(--warn)" fill-opacity=".18" stroke="var(--warn)" stroke-width="3"/>
 <circle cx="158" cy="94" r="10" fill="var(--warn)" fill-opacity=".18" stroke="var(--warn)" stroke-width="3"/>
 <path d="M118 94q15-10 30 0" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 3"/>
 <path d="M144 90l4 4-5 3" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 ${CAP(20,126,'мяч ниже колена · бьёшь сильно')}${CAP(150,126,'перевод в другую руку')}</svg>`,

shoot:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <path d="M238 8v60" fill="none" stroke="var(--accent)" stroke-width="3"/>
 <path d="M206 32h32" fill="none" stroke="var(--warn)" stroke-width="3" stroke-linecap="round"/>
 <path d="M208 32l4 12h20l4-12" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".6"/><g ${ST}>
 ${head(80,34,1,-0.6)}<path d="M80 43v30"/><path d="M80 73l-6 18v16M80 73l8 16v18"/><path d="M80 50l10-8 2-18"/><path d="M80 52l14-6"/>
 <path d="M68 107h10M84 107h12"/></g>
 <circle cx="94" cy="14" r="9" fill="var(--warn)" fill-opacity=".18" stroke="var(--warn)" stroke-width="3"/>
 <path d="M104 10q50-26 104 16" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 4"/>
 ${CAP(20,126,'1–2 м от кольца · одна рука · локоть под мячом · кисть «в корзину»')}</svg>`,

jumptest:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <rect x="30" y="96" width="30" height="12" rx="3" fill="var(--accent)" fill-opacity=".2" stroke="var(--accent)" stroke-width="2.4"/>
 <circle cx="56" cy="102" r="2.6" fill="var(--accent)"/>
 <path d="M60 100L150 90M60 104L150 110" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 4"/><g ${ST}>
 ${head(170,20,0,-0.4)}<path d="M170 29v28"/><path d="M170 57l-3 24 1 14M170 57l3 24-1 14"/><path d="M170 34l-12-16M170 34l12-16"/></g>
 <path d="M196 95v15M196 95h-6M196 110h-6" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 <text x="200" y="106" fill="var(--muted)" font-size="10">время</text>
 ${CAP(16,126,'телефон на полу сбоку · slo-mo')}${CAP(146,126,'ноги прямые, приземлиться туда же')}</svg>`,

reach:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><path d="M228 6v104" ${WK}/>
 <rect x="214" y="10" width="14" height="6" rx="2" fill="var(--accent)"/><g ${ST}>
 ${head(60,44,1,0)}<path d="M58 53l-6 26"/><path d="M52 79l14 12-2 16M52 79l-10 14-8 12"/><path d="M58 58l14 10M58 58l-12 12"/>
 ${head(196,30,1,-0.6)}<path d="M196 39v28"/><path d="M196 67l-3 22 1 12M196 67l4 20-2 13"/><path d="M196 44l16-30"/><path d="M196 46l-12-10"/></g>
 <path d="M84 104q60-90 104-40" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="4 4"/>
 ${CAP(20,126,'1–2 шага разбега, толчок')}${CAP(150,126,'касание выше метки')}</svg>`,

hamslide:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <rect x="84" y="106" width="30" height="5" rx="2" fill="var(--accent)"/><rect x="212" y="106" width="40" height="5" rx="2" fill="var(--accent)"/><g ${ST}>
 ${head(24,98,0,-1)}<path d="M34 102L64 90"/><path d="M64 90l24-24"/><path d="M88 66l8 40"/><path d="M92 108h14"/>
 ${head(142,98,0,-1)}<path d="M152 102L182 90"/><path d="M182 90l62 18"/></g>
 <path d="M198 76q22-10 40 6" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="4 4"/>
 <path d="M232 76l8 6-10 3" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 ${CAP(14,126,'пятки на полотенце у таза, таз поднят')}${CAP(146,126,'выкатываешь пятки 3–4 сек, таз не опускаешь')}</svg>`,

pogo:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(60,26,1,0)}<path d="M60 35v32"/><path d="M60 67l-3 20 1 18M60 67l3 20 2 18"/><path d="M60 42l-8 14 4 8M60 42l8 14-2 8"/>
 ${head(130,14,1,0)}<path d="M130 23v32"/><path d="M130 55l-3 20 2 18M130 55l3 20 3 17"/><path d="M130 30l-8 14 4 8M130 30l8 14-2 8"/>
 ${head(200,26,1,0)}<path d="M200 35v32"/><path d="M200 67l-3 20 1 18M200 67l3 20 2 18"/><path d="M200 42l-8 14 4 8M200 42l8 14-2 8"/></g>
 <path d="M50 106h24M190 106h24" ${WK}/>
 <path d="M122 104h24" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 ${CAP(14,128,'колени почти прямые, работает только стопа, высота 5–10 см')}</svg>`,

plyo:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <path d="M92 110v-18M96 92h-8M172 110v-18M176 92h-8" ${AC}/>
 <g ${ST}>
 ${head(46,50,1,0)}<path d="M46 59v20"/><path d="M46 79l-8 16v15M46 79l8 16v15"/><path d="M30 110h14M50 110h14"/>
 ${head(132,34,1,0)}<path d="M132 43v22"/><path d="M132 65l-10 16 2 14M132 65l10 16-2 14"/>
 ${head(214,50,1,0)}<path d="M214 59v20"/><path d="M214 79l-8 16v15M214 79l8 16v15"/><path d="M198 110h14M218 110h14"/></g>
 ${CAP(14,128,'контакт с полом минимальный, приземление и отталкивание слитно')}</svg>`,

sprint:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(40,44,1,0.3)}<path d="M47 49l26 22"/><path d="M73 71l18 26 8 13"/><path d="M73 71l-18 12-4 24"/><path d="M46 52l-16 14M52 54l24-4"/>
 ${head(140,34,1,0.2)}<path d="M146 40l22 24"/><path d="M168 64l16 28 6 18"/><path d="M168 64l-14 20 6 26"/><path d="M146 44l-18 8M152 44l22 -8"/></g>
 <path d="M28 60l14 -12" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="4 3"/>
 ${CAP(14,128,'первые шаги · корпус наклонён')}${CAP(140,128,'дальше · корпус выпрямляется')}</svg>`,

shuttle:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <rect x="16" y="24" width="228" height="76" rx="2" fill="none" stroke="var(--accent)" stroke-width="2.4"/>
 <path d="M16 24v76" fill="none" stroke="var(--accent)" stroke-width="4"/>
 <rect x="16" y="46" width="48" height="32" fill="none" stroke="var(--accent)" stroke-width="2"/>
 <path d="M64 46v32" fill="none" stroke="var(--accent)" stroke-width="2.6"/>
 <path d="M84 40a30 30 0 010 44" fill="none" stroke="var(--accent)" stroke-width="2.4"/>
 <path d="M16 40h12M16 84h12" fill="none" stroke="var(--accent)" stroke-width="2"/>
 <circle cx="29" cy="62" r="4" fill="none" stroke="var(--accent)" stroke-width="2"/>
 <path d="M130 24v76" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-dasharray="6 4"/>
 <g ${WK}>
  <path d="M20 112h40"/><path d="M54 107l7 5-7 5"/>
  <path d="M20 120h60"/><path d="M74 115l7 5-7 5"/>
  <path d="M20 128h106"/><path d="M120 123l7 5-7 5"/>
 </g>
 <text x="68" y="16" text-anchor="end" fill="var(--muted)" font-size="9">штрафная</text>
 <text x="78" y="16" fill="var(--muted)" font-size="9">трёха</text>
 <text x="130" y="16" text-anchor="middle" fill="var(--muted)" font-size="9">центр</text>
 <text x="190" y="66" text-anchor="middle" fill="var(--muted)" font-size="9">старт от лицевой</text></svg>`,

hillint:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M30 106L210 62" ${AC}/><path d="M30 106v10M210 62v54" fill="none" stroke="var(--accent)" stroke-width="2.4"/>
 <path d="M30 116h180" fill="none" stroke="var(--line)" stroke-width="2"/>
 <g ${ST}>
 ${head(112,40,1,0.2)}<path d="M118 46l20 22"/><path d="M138 68l14 14 4 12"/><path d="M138 68l-18 10-6 14"/><path d="M118 50l-18 10M124 50l20 -6"/></g>
 <path d="M150 96a34 34 0 00-24 -30" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="4 3"/>
 ${CAP(156,50,'наклон 10–12%')}
 ${CAP(14,128,'20 секунд работы · 90 секунд стоя на бортах, полотно не выключаешь')}</svg>`,

shortfoot:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 104h232" ${AC}/>
 <g ${ST}>
  <path d="M40 104c0 -14 10 -22 26 -24 18 -2 34 -2 46 2 10 3 12 8 10 12"/>
  <path d="M112 94c-14 6 -34 10 -50 10"/>
  <path d="M120 96h10M122 90h10M124 84h9"/>
 </g>
 <path d="M56 100q22 -6 44 -2" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="3 3"/>
 <g ${ST}>
  <path d="M170 104c0 -18 10 -28 26 -30 18 -2 34 0 46 6 10 4 12 9 10 13"/>
  <path d="M242 93c-14 7 -34 11 -50 11"/>
  <path d="M250 96h10M252 90h10M254 84h9"/>
 </g>
 <path d="M186 100q22 -16 44 -6" ${WK}/>
 <path d="M206 66l0 14M202 76l4 6 4 -6" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-linecap="round"/>
 ${CAP(20,126,'расслабленная стопа')}${CAP(150,126,'свод подтянут, пальцы прямые')}</svg>`,

balance:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(78,26,1,0)}<path d="M78 35v30"/><path d="M78 65v45"/><path d="M68 110h20"/><path d="M78 44l-22 10M78 44l22 10"/>
 <path d="M78 65l22 10 4 22"/>
 ${head(184,26,0,0)}<path d="M184 35v30"/><path d="M184 65v45"/><path d="M174 110h20"/><path d="M184 44l-22 10M184 44l22 10"/>
 <path d="M184 65l22 10 4 22"/></g>
 <path d="M70 100v-6M86 100v-6" ${WK}/>
 <path d="M176 100v-6M192 100v-6" ${WK}/>
 <path d="M176 20h16" fill="none" stroke="var(--warmc)" stroke-width="2.4" stroke-linecap="round"/>
 ${CAP(24,128,'30 сек, глаза открыты')}${CAP(140,128,'30 сек, глаза закрыты')}</svg>`,


/* ---------- РАЗМИНКА ---------- */
joints:`<svg viewBox="0 0 260 132" style="color:var(--muted)"><g ${ST}>
 ${head(130,26,1,0,10)}<path d="M130 36v34"/><path d="M130 70l-12 20v16M130 70l12 20v16"/><path d="M112 92h14M134 92h14"/><path d="M130 44l-24 10M130 44l24 10"/></g>
 <g ${WK}><path d="M96 20a16 16 0 100 12"/><path d="M164 20a16 16 0 110 12"/><path d="M74 60a14 14 0 100 10"/><path d="M186 60a14 14 0 110 10"/></g>
 ${CAP(14,128,'шея, плечи, локти, таз, колени, голеностоп — сверху вниз')}</svg>`,

wallsit:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M70 12v100M70 112h150" ${WK}/><g ${ST}>
 ${head(86,34,1,0)}<path d="M78 44v24"/><path d="M78 68h44"/><path d="M122 68v44"/><path d="M86 46l24 6"/></g>
 <path d="M100 60h28" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 ${CAP(132,58,'90°')}
 ${CAP(20,128,'спина прижата к стене, бёдра параллельны полу')}</svg>`,

groin:`<svg viewBox="0 0 260 132" style="color:var(--muted)"><g ${ST}>
 ${head(130,26,0,1)}<path d="M130 35v24"/><path d="M130 59l-26 16-6 26M130 59l26 16 6 26"/><path d="M92 101h14M154 101h14"/></g>
 <circle cx="130" cy="76" r="13" fill="none" stroke="var(--warmc)" stroke-width="3.2"/>
 <path d="M108 76h8M144 76h8" stroke="var(--warmc)" stroke-width="3" stroke-linecap="round"/>
 ${CAP(20,128,'мяч между коленями, сводить и держать ровно, без пульсации')}</svg>`,

legswing:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M40 20v90" ${WK}/><g ${ST}>
 ${head(120,28,1,0)}<path d="M120 37v30"/><path d="M120 67l-4 40"/><path d="M108 107h16"/><path d="M120 44l-72 4"/></g>
 <g ${WK}><path d="M120 67l40 22"/><path d="M120 67l38-20"/></g>
 <path d="M156 52a34 34 0 016 34" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="4 3"/>
 ${CAP(14,128,'держишься за опору, нога идёт маятником вбок и внутрь')}</svg>`,

bridge:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M20 106h220" ${AC}/><g ${ST}>
 ${head(54,96,0,-1)}<path d="M63 96h30"/><path d="M93 96l34-32"/><path d="M127 64l22 24"/><path d="M149 88v18"/><path d="M141 106h18"/><path d="M63 92l-14-8"/></g>
 <path d="M96 56h44" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 ${CAP(76,52,'колено–таз–плечо')}
 ${CAP(14,128,'толчок пяткой, пауза наверху, рёбра опущены')}</svg>`,

birddog:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(170,52,1,0.6)}<path d="M160 60l-58 4"/><path d="M158 60v46"/><path d="M152 107h12"/>
 <path d="M102 64v42"/><path d="M102 106H76"/>
 <path d="M160 60l46-6"/><path d="M102 64l-52-6"/></g>
 <path d="M102 50h58" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="4 4"/>
 <path d="M214 54l6-1M42 57l-6-1" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
 ${CAP(14,128,'противоположные рука и нога, таз параллелен полу')}</svg>`,

lunge:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M20 108h220" ${AC}/><g ${ST}>
 ${head(120,26,1,0)}<path d="M120 35v28"/><path d="M120 63l30 18v27"/><path d="M140 108h20"/><path d="M120 63l-26 26-14 19"/><path d="M70 108h18"/><path d="M120 44l34-10M120 44l-14 16"/></g>
 <path d="M154 34a26 26 0 01-8 22" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="4 3"/>
 ${CAP(14,128,'глубокий выпад, поворот корпуса к передней ноге')}</svg>`,

inchworm:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 108h232" ${AC}/><g ${ST}>
 ${head(44,52,0,1,8)}<path d="M44 60l6 22"/><path d="M50 82l-6 26"/><path d="M44 58l10 26 4 24"/>
 ${head(130,82,1,0.6,8)}<path d="M138 84l30 8"/><path d="M130 90l14 18"/><path d="M168 92l6 16"/>
 ${head(204,72,0,1,8)}<path d="M204 80l16 12v16"/><path d="M204 78l-14 12-6 18"/></g>
 ${CAP(14,128,'наклон · руками вперёд в планку · шаг стопой к рукам')}</svg>`,

deadbug:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(42,96,0,-1)}<path d="M52 100h62"/>
 <path d="M60 99V56"/><path d="M56 101L20 92"/>
 <path d="M114 100l2-36 30 0"/><path d="M114 100l66-6"/></g>
 <path d="M76 106h28" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
 <path d="M24 80a38 38 0 0 1 30-26M176 80a60 60 0 0 0-24-14" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="4 4"/>
 ${CAP(14,128,'поясница прижата к полу, противоположные рука и нога идут вниз')}</svg>`,
/* ---------- РАСТЯЖКА ---------- */
st_calf:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M30 14v104" ${WK}/><path d="M14 118h232" ${AC}/><g ${ST}>
 ${head(96,30,-1,0.3)}<path d="M100 38l-8 30"/><path d="M92 68l-22 34-10 16"/><path d="M48 118h20"/>
 <path d="M92 68l28 30 14 20"/><path d="M126 118h20"/><path d="M98 36l-46 14M98 42l-48 22"/></g>
 <path d="M52 108h22" ${WK}/>
 ${CAP(14,130,'задняя нога прямая, пятка прижата к полу · икроножная')}</svg>`,

st_soleus:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M30 14v104" ${WK}/><path d="M14 118h232" ${AC}/><g ${ST}>
 ${head(104,36,-1,0.3)}<path d="M106 44l-6 28"/><path d="M100 72l-28 26-6 20"/><path d="M54 118h22"/>
 <path d="M100 72l26 26 12 20"/><path d="M130 118h20"/><path d="M106 42l-50 16M106 48l-50 24"/></g>
 <path d="M64 92a18 18 0 01-4 22" fill="none" stroke="var(--warmc)" stroke-width="1.8" stroke-dasharray="4 3"/>
 ${CAP(14,130,'то же, но заднее колено согнуто · камбаловидная')}</svg>`,

st_quad:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><path d="M176 14v96" ${WK}/><g ${ST}>
 ${head(124,22,1,0)}<path d="M124 31v34"/><path d="M124 65l2 22-2 20"/><path d="M118 107h16"/>
 <path d="M124 65l-2 26-24-16"/>
 <path d="M124 38l-20 32"/><path d="M124 38l50 8"/></g>
 <path d="M104 88a26 26 0 0 0 10 14" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="3 3"/>
 ${CAP(14,130,'колено смотрит вниз, таз подвёрнут, пятка к ягодице · квадрицепс')}</svg>`,

st_ham:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 118h232" ${AC}/><path d="M150 76h70" ${AC}/><path d="M170 76v42M210 76v42" fill="none" stroke="var(--accent)" stroke-width="2.4"/>
 <g ${ST}>
 ${head(76,40,1,0.6)}<path d="M82 46l14 26"/><path d="M96 72l-4 26v20"/><path d="M82 118h20"/>
 <path d="M96 72l38 4 28-2"/><path d="M82 48l40 18"/></g>
 <path d="M84 40l26 16" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 ${CAP(14,130,'нога прямая, наклон с прямой спиной · задняя поверхность')}</svg>`,

st_glute:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/><g ${ST}>
 ${head(46,96,0,-1)}<path d="M56 100h60"/>
 <path d="M116 100l26-36 16 42"/><path d="M152 107h14"/>
 <path d="M116 100l46-12-20-24"/>
 <path d="M64 99l66-18"/></g>
 <circle cx="150" cy="80" r="16" fill="none" stroke="var(--warmc)" stroke-width="2" stroke-dasharray="4 4"/>
 ${CAP(14,128,'щиколотка на колене, притянуть нижнее бедро к груди · ягодичная')}</svg>`,

st_hipflex:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 118h232" ${AC}/><g ${ST}>
 ${head(118,24,1,0)}<path d="M118 33v36"/><path d="M118 69l32 22v27"/><path d="M140 118h22"/>
 <path d="M118 69l-30 28"/><path d="M88 97l-34 20"/><path d="M50 118h16"/>
 <path d="M118 44l16 12M118 44l-14 14"/></g>
 <path d="M96 84a30 30 0 0116 -16" fill="none" stroke="var(--warmc)" stroke-width="1.8" stroke-dasharray="4 3"/>
 ${CAP(14,130,'таз подвёрнут вперёд, ягодица задней ноги сжата · сгибатели')}</svg>`,

st_thoracic:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 118h232" ${AC}/><path d="M150 62h74" ${AC}/><path d="M164 62v56M212 62v56" fill="none" stroke="var(--accent)" stroke-width="2.4"/>
 <g ${ST}>
 ${head(64,60,1,0.8)}<path d="M70 66l44 8"/><path d="M114 74l44 -10"/><path d="M114 74l2 26v18"/><path d="M104 118h22"/></g>
 <path d="M76 84q30 -14 60 -12" fill="none" stroke="var(--warmc)" stroke-width="1.8" stroke-dasharray="4 3"/>
 ${CAP(14,130,'руки на опоре, провисаешь грудью вниз · грудной отдел')}</svg>`,

/* ---------- САМОМАССАЖ ---------- */
roll_calf:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 112h232" ${AC}/><g ${ST}>
 ${head(50,58,1,0.4)}<path d="M58 64l24 20"/><path d="M82 84l52 14"/><path d="M134 98l40 -6"/>
 <path d="M82 84l44 -6 34 6"/><path d="M58 62l30 26"/></g>
 <circle cx="180" cy="100" r="12" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 <path d="M168 100h-8M192 100h8" stroke="var(--warmc)" stroke-width="2.4" stroke-linecap="round"/>
 ${CAP(14,128,'сидя, вторую ногу сверху для давления · 60 сек на каждую')}</svg>`,

roll_quad:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 112h232" ${AC}/><g ${ST}>
 ${head(44,74,1,0.3)}<path d="M52 78l40 12"/><path d="M92 90l58 8"/><path d="M150 98l36 4"/>
 <path d="M52 72l-14 -16M56 76l-16 20"/></g>
 <circle cx="124" cy="100" r="12" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 <path d="M112 100h-8M136 100h8" stroke="var(--warmc)" stroke-width="2.4" stroke-linecap="round"/>
 ${CAP(14,128,'лёжа на животе, вес на предплечьях · 60 сек')}</svg>`,

roll_it:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 112h232" ${AC}/><g ${ST}>
 ${head(48,60,1,0.5)}<path d="M56 66l30 22"/><path d="M86 88l56 10"/><path d="M142 98l40 2"/>
 <path d="M56 64l-16 -14"/><path d="M104 92l16 -22 14 8"/></g>
 <circle cx="116" cy="102" r="11" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 ${CAP(14,128,'лёжа на боку, ролик под внешней стороной бедра · 45 сек')}</svg>`,

roll_glute:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 116h232" ${AC}/><g ${ST}>
 ${head(112,32,1,0)}<path d="M112 41v34"/><path d="M112 75l34 12 26 24"/><path d="M164 116h18"/>
 <path d="M112 75l-18 14"/><path d="M94 89l18 16"/><path d="M112 58l28 18"/></g>
 <circle cx="108" cy="94" r="12" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 ${CAP(14,130,'сидя на ролике, щиколотка на противоположном колене · 45 сек')}</svg>`,

roll_ham:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 116h232" ${AC}/><g ${ST}>
 ${head(66,42,1,0.2)}<path d="M66 51v26"/><path d="M66 77l50 14"/><path d="M116 91l48 8"/><path d="M164 99l22 16"/>
 <path d="M60 60l-22 34"/><path d="M38 94v20"/></g>
 <circle cx="130" cy="102" r="12" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 ${CAP(14,130,'сидя, руками приподнимаешь таз · 45 сек')}</svg>`,

roll_back:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 116h232" ${AC}/><g ${ST}>
 ${head(150,50,1,-0.4)}<path d="M144 58l-40 26"/><path d="M104 84l-32 24"/><path d="M60 108h22"/>
 <path d="M146 56l16 -22 20 6"/><path d="M104 84l24 18 22 14"/><path d="M146 116h20"/></g>
 <circle cx="112" cy="94" r="12" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 <path d="M100 94h-10M124 94h10" stroke="var(--warmc)" stroke-width="2.4" stroke-linecap="round"/>
 ${CAP(14,130,'ролик поперёк, катаешь только между лопатками · 60 сек')}</svg>`,

ball_foot:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <path d="M14 110h232" ${AC}/>
 <g ${ST}>
  <path d="M60 110c0 -24 14 -36 34 -38 24 -3 46 0 60 8 14 6 16 12 12 18"/>
  <path d="M166 98c-18 9 -44 12 -66 12"/>
  <path d="M178 100h14M180 92h14M182 84h13"/>
 </g>
 <circle cx="104" cy="100" r="10" fill="none" stroke="var(--warmc)" stroke-width="3"/>
 <path d="M76 104h-10M132 100h12" stroke="var(--warmc)" stroke-width="2.4" stroke-linecap="round"/>
 ${CAP(14,128,'катаешь свод от пятки к пальцам · 1–2 мин на стопу')}</svg>`,
bike:`<svg viewBox="0 0 260 132" style="color:var(--muted)">
 <circle cx="58" cy="94" r="22" fill="none" stroke="var(--accent)" stroke-width="2.6"/>
 <circle cx="196" cy="94" r="22" fill="none" stroke="var(--accent)" stroke-width="2.6"/>
 <path d="M58 94l34 -30 46 0 58 30M92 64l32 30M138 64l-14 30" ${AC}/>
 <path d="M124 94l-10 8M124 94l10 -8" fill="none" stroke="var(--warmc)" stroke-width="3" stroke-linecap="round"/>
 <circle cx="124" cy="94" r="9" fill="none" stroke="var(--warmc)" stroke-width="2.4"/>
 <g ${ST}>
  ${head(150,28,-1,0)}<path d="M148 37l-12 22"/><path d="M136 59l-14 28"/><path d="M122 87l-8 14"/>
  <path d="M146 40l-24 8"/></g>
 <path d="M104 44h44" fill="none" stroke="var(--warmc)" stroke-width="1.6" stroke-dasharray="3 3"/>
 <text x="8" y="26" fill="var(--muted)" font-size="10">колено почти прямое</text>
 ${CAP(14,128,'80–85 оборотов, пульс 135–140 · крути круг, а не дави вниз')}</svg>`
};
