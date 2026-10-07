"use strict";
/* ############################################################
   18 · СТАРТ
   ############################################################ */
loadAll();
renderExtra();
renderNow();
renderBackup();
renderAll();
renderInstallHint();
renderOnboard();
{ const t=store.get('planTab','today'); if(t!=='today' && document.querySelector(`.tab[data-tab="${t}"]`)) goTab(t); }
