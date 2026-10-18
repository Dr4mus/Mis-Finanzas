'use strict';
(window.__V = window.__V || {})['extras.js'] = '10.1.0';
/* Mis finanzas — atajos, Inicio personalizable, bienvenida, papelera y recordatorio de respaldo. */

// ============ atajos de movimientos frecuentes ============
// Se guardan en la configuración del hogar (cfg.shortcuts), así los dos teléfonos los ven.
const shortcuts = () => cfg.shortcuts || [];
function scLabel(s) { return esc(s.name) + (s.a ? ' · ' + money(s.a, s.cu) : ''); }
function atajosCard() {
  const list = shortcuts(); if (!list.length) return ''; // sin atajos no ocupa espacio (se crean en Ajustes o desde el formulario)
  return `<div class="card"><h2><i class="icon-zap"></i> Atajos <button class="link" style="margin-left:auto;font-size:13px" onclick="setSub='atajos';go('set')">Editar</button></h2>
<div class="chips sc">${list.map(s => `<button type="button" data-id="${esc(s.id)}" onclick="useShortcut(this.dataset.id)"><i class="icon-${esc(icoFor(s.c, s.t))}"></i>${scLabel(s)}</button>`).join('')}</div></div>`;
}
async function useShortcut(id) {
  const s = shortcuts().find(x => x.id == id); if (!s) return;
  if (!accs.length) return openForm();
  const ac = accs.find(a => a.id == s.accId) || accs.find(a => a.id == lastUsed().accId) || accs[0];
  const r = s.cu == 'DOP' ? 1 : rateOf(s.cu);
  const who = s.w && cfg.people.includes(s.w) ? s.w : defaultWho();
  // Sin monto fijo, o si hace falta una tasa o un monto en otra moneda: abre el formulario ya lleno
  if (!(s.a > 0) || !(r > 0) || (s.cu != ac.currency && ac.currency != 'DOP')) {
    openForm(); Object.assign(fm, { t: s.t, c: s.c, sub: s.sub || '', a: s.a || '', cu: s.cu, r: r || '', accId: ac.id, w: who, split: s.t == 'e' ? (s.split || '') : '', n: '' }); drawForm();
    setTimeout(() => { const el = $('amt'); if (el && !s.a) el.focus(); }, 60); return;
  }
  const a = s.a, v = round2(a * r), aa = s.cu == ac.currency ? a : v;
  if (s.t == 'e' && !(await enoughOrAsk(ac, aa, today()))) return;
  const o = { t: s.t, d: today(), c: s.c, sub: s.sub || '', w: who, accId: ac.id, a, cu: s.cu, r, v, aa: round2(aa), n: '' };
  if (s.t == 'e' && s.split && s.split != 'for:' + who) o.split = s.split;
  const saved = saveTx(o);
  toast(`${s.name}: ${money(a, s.cu)} anotado`, { kind: 'ok', action: 'Deshacer', onAction: () => { delTx(saved.id, { msg: 'Atajo deshecho' }); } });
}
let scf = {};
function openShortcut(id, preset) {
  const x = shortcuts().find(s => s.id == id) || preset || {};
  scf = { id: x.id, name: x.name || '', t: x.t || 'e', c: x.c || '', sub: x.sub || '', a: x.a || '', cu: x.cu || 'DOP', accId: x.accId || '', w: x.w || '', split: x.split || '' };
  drawShortcut();
}
function drawShortcut() {
  const f = scf, cats = cfg.cats.filter(c => c.t == f.t).map(c => c.n);
  if (!cats.includes(f.c)) f.c = cats[0] || '';
  const cu = [...new Set(['DOP', f.cu, ...cfg.cur])];
  dlg.innerHTML = `<form onsubmit="return svShortcut(event)"><h2>${f.id ? 'Editar' : 'Nuevo'} atajo</h2>
<label>Nombre del botón<input required maxlength="30" value="${esc(f.name)}" oninput="scf.name=this.value" placeholder="Ej: Gasolina, Colmado, Almuerzo"></label>
<div class="seg"><button type="button" class="e${f.t == 'e' ? ' on' : ''}" onclick="scf.t='e';scf.c='';scf.split='';drawShortcut()">Egreso</button><button type="button" class="i${f.t == 'i' ? ' on' : ''}" onclick="scf.t='i';scf.c='';scf.split='';drawShortcut()">Ingreso</button></div>
<label>Categoría<select onchange="scf.c=this.value">${opts(cats, f.c)}</select></label>
<input value="${esc(f.sub)}" oninput="scf.sub=this.value" placeholder="Detalle (opcional)" aria-label="Detalle">
<div class="two"><label>Monto fijo (opcional)<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(f.a)}" oninput="scf.a=this.value" placeholder="Vacío = preguntar"></label>
<label>Moneda<select onchange="scf.cu=this.value">${opts(cu, f.cu)}</select></label></div>
<label>Cuenta<select onchange="scf.accId=this.value"><option value="">La última que usé</option>${accs.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('')}</select></label>
<label>Quién<select onchange="scf.w=this.value"><option value="">Quien use el teléfono</option>${opts(cfg.people, f.w)}</select></label>
${f.t == 'e' && cfg.people.length > 1 ? `<label>¿Para quién?<select onchange="scf.split=this.value">${[['', 'Personal'], ['half', 'Compartido'], ...cfg.people.map(p => ['for:' + p, 'Para ' + p])].map(([v, l]) => `<option value="${esc(v)}"${f.split == v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
<p class="mini" style="margin:0">Con monto fijo, un toque lo anota de una vez (y puedes deshacerlo). Sin monto, se abre el formulario listo para escribirlo.</p>
${footer(f.id, `delShortcut('${f.id}')`)}</form>`;
  dlgShow();
}
function svShortcut(e) {
  e.preventDefault(); const f = scf, name = f.name.trim(); if (!name) return fail('Ponle un nombre.');
  if (!f.c) return fail('Elige una categoría.');
  const a = parseFloat(f.a), o = { id: f.id || uid(), name, t: f.t, c: f.c, sub: f.sub.trim(), a: a > 0 ? round2(a) : null, cu: f.cu, accId: f.accId || '', w: f.w || '', split: f.t == 'e' ? f.split : '' };
  const c = deep(cfg), list = c.shortcuts || [], i = list.findIndex(x => x.id == o.id);
  if (i >= 0) list[i] = o; else list.push(o);
  c.shortcuts = list; saveCfg(c); dlg.close(); toast('Atajo guardado', { kind: 'ok' }); return false;
}
async function delShortcut(id) {
  if (!(await ask('Solo se borra el botón; los movimientos ya anotados no cambian.', { title: '¿Borrar el atajo?', ok: 'Borrar', danger: true }))) return;
  const c = deep(cfg); c.shortcuts = (c.shortcuts || []).filter(x => x.id != id); saveCfg(c); dlg.close(); toast('Atajo borrado');
}
function moveShortcut(id, dir) {
  const c = deep(cfg), l = c.shortcuts || [], i = l.findIndex(x => x.id == id), j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; saveCfg(c);
}
function shortcutFromForm() {
  const f = fm, ac = accs.find(a => a.id == f.accId);
  openShortcut(null, { name: (f.sub || f.c || '').slice(0, 30), t: f.t, c: f.c, sub: f.sub, a: parseFloat(f.a) > 0 ? parseFloat(f.a) : '', cu: f.cu, accId: ac ? ac.id : '', w: '', split: f.split });
}
function shortcutsSection() {
  const l = shortcuts();
  return `<div class="card" id="sc-card"><h2><i class="icon-zap"></i> Atajos</h2><p class="mini" style="margin:0 0 6px">Botones en Inicio para anotar con un toque. Se comparten con tu hogar.</p>
${l.map((s, i) => `<div class="row">${circ(s.name, icoFor(s.c, s.t))}<div><b>${esc(s.name)}</b><small>${esc(s.c)}${s.a ? ' · ' + money(s.a, s.cu) : ' · monto variable'}</small></div>
<button class="iconbtn" aria-label="Subir" ${i == 0 ? 'disabled' : ''} onclick="moveShortcut('${s.id}',-1)"><i class="icon-chevron-up"></i></button><button class="iconbtn" aria-label="Bajar" ${i == l.length - 1 ? 'disabled' : ''} onclick="moveShortcut('${s.id}',1)"><i class="icon-chevron-down"></i></button><button class="iconbtn" aria-label="Editar" onclick="openShortcut('${s.id}')"><i class="icon-pencil"></i></button></div>`).join('') || '<p class="empty" style="margin:0">Aún no tienes atajos.</p>'}
<button class="link" onclick="openShortcut()"><i class="icon-plus"></i> Nuevo atajo</button></div>`;
}

// ============ Inicio personalizable (en cada teléfono) ============
const HOME_CARDS = [
  ['saldo', 'Saldo disponible y patrimonio'], ['accesos', 'Accesos rápidos'], ['revisar', 'Movimientos por revisar'], ['parati', 'Para ti (lo más importante)'],
  ['alertas', 'Pendientes y alertas'], ['alcanza', '¿Te alcanza hasta el próximo ingreso?'], ['mes', 'Resumen del mes'], ['atajos', 'Atajos (si tienes)'],
  ['promedio', 'Comparado con tu promedio'], ['metas', 'Metas'], ['recientes', 'Últimos movimientos']
];
function homeLayout() {
  let saved = null; try { saved = JSON.parse(localStorage.getItem('fin_home')); } catch (e) { }
  const ids = HOME_CARDS.map(c => c[0]);
  if (!Array.isArray(saved)) return ids.map(id => ({ id, on: true }));
  const out = saved.filter(x => x && ids.includes(x.id)).map(x => ({ id: x.id, on: x.on !== false }));
  ids.forEach((id, i) => { if (!out.some(x => x.id == id)) out.splice(Math.min(i, out.length), 0, { id, on: true }); }); // tarjetas nuevas aparecen
  return out;
}
function saveHomeLayout(l) { try { localStorage.setItem('fin_home', JSON.stringify(l)); } catch (e) { } }
let homeEdit = null;
function openHomeEdit() { homeEdit = homeLayout(); drawHomeEdit(); }
function drawHomeEdit() {
  const l = homeEdit, name = id => (HOME_CARDS.find(c => c[0] == id) || [, id])[1];
  dlg.innerHTML = `<form onsubmit="return svHomeEdit(event)"><h2>Personalizar Inicio</h2><p class="mini" style="margin:0">Elige qué tarjetas ves y en qué orden. Solo cambia en este teléfono.</p>
<div>${l.map((c, i) => `<div class="row"><label class="toggle" style="flex:1"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="homeEdit[${i}].on=this.checked"> ${esc(name(c.id))}</label>
<button type="button" class="iconbtn" aria-label="Subir" ${i == 0 ? 'disabled' : ''} onclick="homeMove(${i},-1)"><i class="icon-chevron-up"></i></button><button type="button" class="iconbtn" aria-label="Bajar" ${i == l.length - 1 ? 'disabled' : ''} onclick="homeMove(${i},1)"><i class="icon-chevron-down"></i></button></div>`).join('')}</div>
<button type="button" class="link" onclick="homeEdit=HOME_CARDS.map(c=>({id:c[0],on:true}));drawHomeEdit()">Volver al orden original</button>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div></form>`;
  dlgShow();
}
function homeMove(i, d) { const l = homeEdit, j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; drawHomeEdit(); }
function svHomeEdit(e) { e.preventDefault(); saveHomeLayout(homeEdit); dlg.close(); render(); toast('Inicio actualizado', { kind: 'ok' }); return false; }

// ============ recordatorio de respaldo mensual ============
function backupDue() {
  if (!hasLocalData()) return false;
  const g = k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
  const last = g('fin_lastbk'), snooze = g('fin_bk_snooze'), n = Date.now();
  if (snooze > n) return false;
  if (!last) { // primera vez: espera unos días desde que empezaste a usar la app
    let first = g('fin_first'); if (!first) { try { localStorage.setItem('fin_first', String(n)); } catch (e) { } return false; }
    return n - first > 7 * 864e5;
  }
  return n - last > 30 * 864e5;
}
function backupAlert() {
  if (!backupDue()) return '';
  let last = 0; try { last = +localStorage.getItem('fin_lastbk') || 0; } catch (e) { }
  const txt = last ? `Tu último respaldo fue hace ${Math.floor((Date.now() - last) / 864e5)} días.` : 'Aún no has descargado un respaldo.';
  return `<div class="alert bka">${circ('respaldo', 'download')}<div><b>Toca hacer un respaldo</b><small>${txt} Guárdalo en tu correo o en la nube.</small></div><div class="acts2"><button onclick="snoozeBackup()">Luego</button><button class="p" onclick="bk()">Descargar</button></div></div>`;
}
function snoozeBackup() { try { localStorage.setItem('fin_bk_snooze', String(Date.now() + 7 * 864e5)); } catch (e) { } render(); toast('Te lo recuerdo en una semana'); }

// ============ papelera ============
function trashItems() {
  const lim = Date.now() - KEEP_DAYS * 864e5, out = [];
  trash.filter(x => (x.del || 0) > lim).forEach(x => out.push({ id: x.id, del: x.del, html: histRow(x, false).replace(/ onclick="[^"]*"/, '').replace('row tap', 'row') }));
  const lbl = { acc: ['Cuenta', 'wallet'], rec: ['Recurrente', 'repeat'], goal: ['Meta', 'target'], adj: ['Ajuste de saldo', 'sliders'] };
  bin.filter(x => (x.del || 0) > lim).forEach(x => {
    const d = x.d || {}, [t, ic] = lbl[x.k] || ['Elemento', 'tag'];
    const title = x.k == 'adj' ? 'Ajuste de ' + esc((accs.find(a => a.id == d.accId) || {}).name || 'una cuenta') : esc(d.name || '(sin nombre)');
    const amt = x.k == 'rec' ? money(d.amount, d.currency) : x.k == 'goal' ? money(d.target) : x.k == 'adj' ? money(d.balance) : x.k == 'acc' ? esc(d.type || '') : '';
    out.push({ id: x.id, del: x.del, html: `<div class="row">${circ(title, ic)}<div><b>${title}</b><small>${t}</small></div><b class="num">${amt}</b></div>` });
  });
  return out.sort((a, b) => b.del - a.del);
}
function renderTrash(app) {
  const it = trashItems(), ago = t => { const d = Math.floor((Date.now() - t) / 864e5); return d == 0 ? 'hoy' : d == 1 ? 'ayer' : 'hace ' + d + ' días'; };
  app.innerHTML = `<button class="back" onclick="setSub='datos';go('set')"><i class="icon-chevron-left"></i> Respaldo y datos</button><div class="top"><h1>Papelera</h1><div class="tools">${syncBadge()}${eyeBtn()}</div></div>
<p class="note" style="margin-bottom:12px">Aquí queda lo que borras (movimientos, cuentas, recurrentes, metas, deudas, bienes y ajustes) durante ${KEEP_DAYS} días. Si restauras algo, vuelve también en los demás teléfonos del hogar.</p>
${it.length ? `<div class="card">${it.map(x => `<div class="trow">${x.html}<div class="tact"><small class="mut">Borrado ${ago(x.del)}</small><button data-id="${esc(x.id)}" onclick="restoreItem(this.dataset.id)"><i class="icon-rotate-ccw"></i> Restaurar</button></div></div>`).join('')}</div>`
      : '<p class="empty">La papelera está vacía.</p>'}`;
}

// ============ bienvenida guiada (la primera vez) ============
const WELCOME = 'fin_welcome';
function shouldWelcome() {
  try { if (localStorage.getItem(WELCOME) || localStorage.getItem('fin_hid')) return false; } catch (e) { return false; }
  return !hasLocalData();
}
function endWelcome(to) { try { localStorage.setItem(WELCOME, '1'); } catch (e) { } go(to || 'home'); }
let wz = { step: 0 };
function renderWelcome(app) {
  if (hasLocalData() && wz.step == 0 && !wz.force) { try { localStorage.setItem(WELCOME, '1'); } catch (e) { } tab = 'home'; return renderHome(app); } // llegaron datos de la nube
  const N = 5, dots = `<div class="wdots">${[...Array(N)].map((_, i) => `<i class="${i == wz.step ? 'on' : i < wz.step ? 'done' : ''}"></i>`).join('')}</div>`;
  const back = wz.step ? `<button type="button" onclick="wz.step--;render()">Atrás</button>` : '';
  let body = '';
  if (wz.step == 0) body = `<img class="wcrest" src="icons/escudo.webp" alt=""><h1>¡Te damos la bienvenida a Mis finanzas!</h1>
<p>Lleva tus cuentas, gastos, presupuesto y metas, solo o en pareja. Te ayudamos a dejarla lista en un minuto.</p>
<div class="wlist"><div><i class="icon-wallet"></i><span>Anota ingresos y gastos en segundos</span></div><div><i class="icon-calendar-days"></i><span>Te avisa de facturas y pagos de tarjeta</span></div><div><i class="icon-target"></i><span>Ahorra para tus metas</span></div></div>
<button class="p big" onclick="wz.step=1;render()">Empezar</button>
<button onclick="endWelcome('set')">Me voy a unir al hogar de mi pareja</button>
<button class="link" onclick="endWelcome()">Saltar</button>`;
  else if (wz.step == 1) body = `<h1>¿Cómo te llamas?</h1><p class="mut">Tu nombre aparece en “Quién” al anotar.</p>
<label>Tu nombre<input id="wz-me" value="${esc(wz.me || '')}" autocomplete="given-name" placeholder="Ej: Ana"></label>
<label>¿Compartes la app con alguien? (opcional)<input id="wz-p2" value="${esc(wz.p2 || '')}" placeholder="Nombre de tu pareja"></label>
<div class="seg">${back}<button class="p" onclick="wzPeople()">Siguiente</button></div>`;
  else if (wz.step == 2) body = `<h1>Tu primera cuenta</h1><p class="mut">Donde tienes tu dinero: efectivo, un banco o una tarjeta. Luego puedes agregar más en Cuentas.</p>
<label>Nombre<input id="wz-an" value="${esc(wz.an || '')}" placeholder="Ej: Efectivo, BHD Ahorros"></label>
<label>Tipo<select id="wz-at">${opts(cfg.accTypes, wz.at || cfg.accTypes[1])}</select></label>
<label>¿Cuánto tiene hoy? (DOP)<input id="wz-ab" type="number" inputmode="decimal" step="0.01" value="${esc(wz.ab || '')}" placeholder="0.00"></label>
<p class="mini">En tarjetas, escribe lo que debes en negativo (ej: -15000).</p>
<div class="seg">${back}<button class="p" onclick="wzAccount()">Crear cuenta</button></div><button class="link" onclick="wz.step=3;render()">Lo hago después</button>`;
  else if (wz.step == 3) body = `<h1>Escoge tus colores</h1><p class="mut">Puedes cambiarlos cuando quieras en Ajustes.</p>
<div class="palgrid">${Object.entries(PALETTES).map(([id, p]) => `<button type="button" class="${palette == id ? 'on' : ''}" onclick="palette='${id}';try{localStorage.setItem('fin_palette','${id}')}catch(e){};applyTheme();render()"><span class="sw">${p.sw.map(c => `<span style="background:${c}"></span>`).join('')}</span>${esc(p.name)}</button>`).join('')}</div>
<div class="seg sm" style="margin-top:10px">${[['claro', 'sun', 'Claro'], ['dark', 'moon', 'Oscuro'], ['auto', 'monitor', 'Auto']].map(([t, i, l]) => `<button type="button" class="${theme == t ? 'on' : ''}" onclick="theme='${t}';try{localStorage.setItem('fin_theme','${t}')}catch(e){};applyTheme();render()"><i class="icon-${i}"></i> ${l}</button>`).join('')}</div>
<div class="seg">${back}<button class="p" onclick="wz.step=4;render()">Siguiente</button></div>`;
  else body = `<h1>¡Todo listo!</h1>
<div class="wlist"><div><i class="icon-plus"></i><span>Toca el botón <b>+</b> de abajo para anotar un gasto o ingreso.</span></div><div><i class="icon-zap"></i><span>Crea <b>atajos</b> para lo que anotas seguido.</span></div><div><i class="icon-repeat"></i><span>Pon tu salario y facturas en <b>Más → Recurrentes</b>.</span></div><div><i class="icon-lock"></i><span>Protege la app con PIN o Face ID en <b>Ajustes</b>.</span></div></div>
${window.Cloud && window.Cloud.enabled ? `<p class="mini">Para tener tus datos respaldados en la nube y compartirlos con tu pareja: <b>Más → Ajustes → Nube y hogar</b>.</p>` : `<p class="mini">Por ahora todo se guarda en este teléfono. Para respaldar en la nube y compartir con tu pareja, sigue la parte “Firebase” de la guía PDF.</p>`}
<button class="p big" onclick="endWelcome()">Ir a Inicio</button>${window.Cloud && window.Cloud.enabled ? `<button onclick="endWelcome('set')">Configurar la nube ahora</button>` : ''}`;
  app.innerHTML = `<div class="welcome">${dots}${body}</div>`;
}
function wzPeople() {
  const me = $('wz-me').value.trim(), p2 = $('wz-p2').value.trim(); wz.me = me; wz.p2 = p2;
  if (!me) return fail('Escribe tu nombre.');
  if (p2 && p2.toLowerCase() == me.toLowerCase()) return fail('Escribe dos nombres distintos.');
  const c = deep(cfg), gen = /^Persona \d$/;
  const keep = c.people.filter(p => !gen.test(p) && p != me && p != p2);
  c.people = [me, ...(p2 ? [p2] : []), ...keep];
  setMyPerson(me); saveCfg(c, true); wz.step = 2; render();
}
function wzAccount() {
  const n = $('wz-an').value.trim(), t = $('wz-at').value, b = parseFloat($('wz-ab').value || '0');
  Object.assign(wz, { an: n, at: t, ab: $('wz-ab').value });
  if (!n) return fail('Ponle un nombre a la cuenta.');
  if (isNaN(b)) return fail('Escribe el saldo (puede ser 0).');
  saveAcc({ name: n, type: t, currency: 'DOP', openDate: today(), openBalance: b, note: '' });
  wz.step = 3; render(); toast('Cuenta creada', { kind: 'ok' });
}
