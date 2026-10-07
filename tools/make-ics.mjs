/* Собирает plan.ics из js/calendar.js с датами по умолчанию (как в приложении).
   Запуск: node tools/make-ics.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { TextEncoder };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/calendar.js'), 'utf8') + '\nthis.buildIcs=buildIcs;', ctx);
/* те же значения, что в settings по умолчанию (js/store.js) */
const store = fs.readFileSync(path.join(ROOT, 'js/store.js'), 'utf8');
const start = store.match(/start:'(\d{4}-\d\d-\d\d)'/)[1];
const session = +store.match(/session:(\d+)/)[1];
fs.writeFileSync(path.join(ROOT, 'plan.ics'), ctx.buildIcs(start, session));
console.log(`plan.ics: старт ${start}, сессия ${session} нед.`);
