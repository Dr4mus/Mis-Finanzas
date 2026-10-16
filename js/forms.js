'use strict';
(window.__V = window.__V || {})['forms.js'] = '8.0.1';
/* Mis finanzas — formularios y diálogos. */
const accOpt = (a, s, d) => `<option value="${a.id}"${a.id == s ? ' selected' : ''}>${esc(a.name)} (${a.currency}) · ${money(acctBalance(a, d), a.currency)}${earm(a) > 0 ? ' · libre ' + money(freeBal(a, d), a.currency) : ''}</option>`;
function mvTabs(c) { return `<div class="seg sm">${[['m', 'Ingreso / Egreso', 'openForm()'], ['t', 'Transferir', 'goTr()'], ['g', 'Metas', 'openContribForm()']].map(([k, l, fn]) => `<button type="button" class="${c == k ? 'on' : ''}" onclick="${fn}">${l}</button>`).join('')}</div>`; }
const footer = (id, delFn, extra = '') => `<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div>${id ? `<div class="seg sm">${extra}<button type="button" class="d" onclick="${delFn}"><i class="icon-trash-2"></i> Borrar</button></div>` : ''}`;
// Saldo insuficiente: avisa, pero deja guardar (por si olvidaste anotar un ingreso)
async function enoughOrAsk(acc, amount, date, exceptId) {
  if (!acc || isCard(acc)) return true;
  const av = exceptId ? without(exceptId, () => freeBal(acc, date)) : freeBal(acc, date);
  if (amount <= av + 0.005) return true;
  return ask(`En “${acc.name}” quedan ${money(av, acc.currency)} libres${earm(acc) > 0 ? ' (el resto está reservado para metas)' : ''}. Si guardas, la cuenta quedará en negativo.\n\nSi el saldo real es mayor, corrígelo luego con “Ajustar saldo”.`, { title: 'Saldo insuficiente', ok: 'Guardar igual' });
}
const beforeOpen = (acc, d) => acc && acc.openDate && d < acc.openDate ? fail(`La cuenta “${acc.name}” empieza el ${fdate(acc.openDate, 1)}. Cambia la fecha o la fecha inicial de la cuenta.`) || true : false;

// ============ ingreso / egreso (formulario rápido) ============
let fm = {};
function openForm(id) {
  if (!accs.length) { dlg.innerHTML = `<h2>Primero crea una cuenta</h2><p class="mut">Todo movimiento pertenece a una cuenta (efectivo, banco, tarjeta…).</p><div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button><button class="p" onclick="dlg.close();go('acc');openAccForm()">Crear cuenta</button></div>`; return dlgShow(); }
  const x = txs.find(t => t.id == id) || {}, L = lastUsed();
  let accId = x.accId || (!x.id && accs.some(a => a.id == L.accId) ? L.accId : '');
  if (accId && !accs.some(a => a.id == accId)) accId = '';
  if (!accId) accId = accs[0].id;
  fm = { id: x.id, t: x.t || 'e', d: x.d || today(), a: x.a || '', cu: x.cu || (!x.id && L.cu) || 'DOP', r: x.r || '', aa: x.aa ?? '', c: x.c, sub: x.sub || '', w: x.w || defaultWho(), accId, n: x.n || '', split: x.split || '', cr: x.cr, rec: x.rec, byName: x.byName, accWasMissing: !!(x.accId && x.accId != accId) };
  if (fm.cu != 'DOP' && !fm.r) fm.r = rateOf(fm.cu, fm.d) || '';
  drawForm(); dlgShow();
  if (!fm.id) setTimeout(() => { const el = $('amt'); if (el) el.focus(); }, 60);
}
const needAA = f => { const ac = accs.find(a => a.id == f.accId); return ac && f.cu != ac.currency && ac.currency != 'DOP' ? ac : null; };
function drawForm() {
  const f = fm, cats = cfg.cats.filter(c => c.t == f.t), names = cats.map(c => c.n);
  if (!f.c || (!names.includes(f.c) && !f.id)) f.c = names[0];
  const extra = f.c && !names.includes(f.c) ? [{ n: f.c, icon: 'tag' }] : [];
  const ppl = [...new Set([...cfg.people, f.w].filter(Boolean))], cu = [...new Set(['DOP', f.cu, ...cfg.cur])], subs = (cfg.subs || {})[f.c] || [];
  const ac = needAA(f), ra = ac && rateOf(ac.currency, f.d), est = ac && f.a && ra && (f.cu == 'DOP' || f.r) ? round2(f.a * (f.cu == 'DOP' ? 1 : f.r) / ra) : '';
  dlg.innerHTML = `<form onsubmit="return sv(event)"><h2>${f.id ? 'Editar' : 'Nuevo'} movimiento</h2>${f.id ? '' : mvTabs('m')}
${f.accWasMissing ? '<p class="note">La cuenta original ya no existe. Elige otra abajo.</p>' : ''}
<div class="seg"><button type="button" class="e${f.t == 'e' ? ' on' : ''}" onclick="sk('t','e')">Egreso</button><button type="button" class="i${f.t == 'i' ? ' on' : ''}" onclick="sk('t','i')">Ingreso</button></div>
<div class="amount"><input id="amt" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="0.00" aria-label="Monto" value="${esc(f.a)}" oninput="fm.a=this.value" onchange="if(needAA(fm))drawForm()"><select aria-label="Moneda" onchange="sk('cu',this.value)">${opts(cu, f.cu)}</select></div>
${f.cu != 'DOP' ? `<label>Tasa: 1 ${esc(f.cu)} = ? DOP<input type="number" inputmode="decimal" step="0.0001" min="0.0001" required value="${esc(f.r)}" oninput="fm.r=this.value" onchange="if(needAA(fm))drawForm()"></label>` : ''}
<div class="catgrid" role="listbox" aria-label="Categoría">${[...extra, ...cats].map(c => `<button type="button" class="${c.n == f.c ? 'on' : ''}" data-n="${esc(c.n)}" onclick="sk('c',this.dataset.n)"><i class="icon-${esc(c.icon)}"></i>${esc(c.n)}</button>`).join('')}</div>
${subs.length ? `<div class="chips">${['', ...subs].map(s => `<button type="button" class="${(f.sub || '') == s ? 'on' : ''}" data-s="${esc(s)}" onclick="fm.sub=this.dataset.s;drawForm()">${s ? esc(s) : 'Sin detalle'}</button>`).join('')}</div>`
      : `<input value="${esc(f.sub)}" oninput="fm.sub=this.value" placeholder="Detalle (opcional): pizza, gasolina…" aria-label="Detalle">`}
<div class="two"><label>Fecha<input type="date" required value="${esc(f.d)}" onchange="sk('d',this.value)"></label>
<label>Cuenta<select onchange="sk('accId',this.value)">${accs.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)}${a.currency != 'DOP' ? ' (' + a.currency + ')' : ''}</option>`).join('')}</select></label></div>
${ac ? `<label>Monto que ${f.t == 'e' ? 'sale de' : 'entra a'} la cuenta (${ac.currency})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.aa)}" placeholder="${est ? '≈ ' + est : ''}" oninput="fm.aa=this.value"></label>${est ? `<button type="button" class="link" style="justify-self:start" onclick="fm.aa='${est}';drawForm()">Usar estimado: ${est}</button>` : ''}` : ''}
<div><small class="mut">${f.t == 'e' ? 'Quién pagó' : 'Quién'}</small><div class="chips" style="margin-top:4px">${ppl.map(p => `<button type="button" class="${p == f.w ? 'on' : ''}" data-p="${esc(p)}" onclick="fm.w=this.dataset.p;if(fm.split=='for:'+fm.w)fm.split='';drawForm()">${esc(p)}</button>`).join('')}</div></div>
${f.t == 'e' && cfg.people.length > 1 ? `<div><small class="mut">¿Para quién?</small><div class="chips" style="margin-top:4px">${[['', 'Personal'], ['half', 'Compartido'], ...cfg.people.filter(p => p != f.w).map(p => ['for:' + p, 'Para ' + p])].map(([v, l]) => `<button type="button" class="${(f.split || '') == v ? 'on' : ''}" data-v="${esc(v)}" onclick="fm.split=this.dataset.v;drawForm()">${esc(l)}</button>`).join('')}</div>${f.split ? `<small class="mini">${f.split == 'half' ? 'Se divide entre ' + cfg.people.length + ': cada quien pone ' + money((+f.a || 0) / cfg.people.length) + '.' : esc(f.split.slice(4)) + ' le deberá el total a ' + esc(f.w) + '.'} Lo ves en Más → Cuentas claras.</small>` : ''}</div>` : ''}
<input value="${esc(f.n)}" oninput="fm.n=this.value" placeholder="Nota (opcional)" aria-label="Nota">
${f.id ? '' : `<button type="button" class="link" style="justify-self:start" onclick="shortcutFromForm()"><i class="icon-zap"></i> Crear un atajo con esto</button>`}
${footer(f.id, `delTx('${f.id}')`, `<button type="button" onclick="dupTx()"><i class="icon-copy"></i> Duplicar</button>`)}</form>`;
  dlgShow();
}
function sk(k, v) {
  fm[k] = v;
  if (k == 't') { fm.c = null; fm.sub = ''; fm.split = ''; }
  if (k == 'c') fm.sub = '';
  if (k == 'cu' || k == 'accId') fm.aa = '';
  if ((k == 'cu' || k == 'd') && fm.cu != 'DOP') fm.r = rateOf(fm.cu, fm.d) || fm.r;
  drawForm();
}
function dupTx() { Object.assign(fm, { id: undefined, d: today(), cr: undefined, rec: undefined, byName: undefined }); drawForm(); toast('Copia lista con fecha de hoy: revisa y guarda.'); }
async function sv(e) {
  e.preventDefault(); const f = fm, a = parseFloat(f.a), r = f.cu == 'DOP' ? 1 : parseFloat(f.r);
  if (!(a > 0)) return fail('Escribe un monto mayor que cero.');
  if (!(r > 0)) return fail('Escribe la tasa en DOP.');
  const ac = accs.find(x => x.id == f.accId); if (!ac) return fail('Elige una cuenta.');
  if (beforeOpen(ac, f.d)) return false;
  const v = round2(a * r);
  let aa;
  if (f.cu == ac.currency) aa = a;
  else if (ac.currency == 'DOP') aa = v;
  else { aa = parseFloat(f.aa); if (!(aa > 0)) return fail(`Escribe cuánto ${f.t == 'e' ? 'salió de' : 'entró a'} la cuenta en ${ac.currency}.`); }
  if (f.t == 'e' && !(await enoughOrAsk(ac, aa, f.d, f.id))) return false;
  const o = { id: f.id, t: f.t, d: f.d, c: f.c, sub: (f.sub || '').trim(), w: f.w, accId: f.accId, a, cu: f.cu, r, v, aa: round2(aa), n: f.n.trim(), cr: f.cr };
  if (f.rec) o.rec = f.rec; if (f.byName) o.byName = f.byName;
  if (f.t == 'e' && f.split && f.split != 'for:' + f.w) o.split = f.split;
  rememberLast({ accId: f.accId, cu: f.cu, w: f.w });
  const isNew = !f.id; saveTx(o); dlg.close(); toast(isNew ? 'Movimiento guardado' : 'Cambios guardados', { kind: 'ok' }); return false;
}

// ============ cuentas ============
let am = {};
function openAccForm(id) { const x = accs.find(a => a.id == id) || {}; am = { id: x.id, name: x.name || '', type: x.type || cfg.accTypes[0], currency: x.currency || 'DOP', note: x.note || '', openDate: x.openDate || today(), openBalance: x.openBalance ?? '', cutDay: x.cutDay || '', payDay: x.payDay || '' }; drawAccForm(); }
function drawAccForm() {
  const f = am, cu = [...new Set(['DOP', f.currency, ...cfg.cur])], card = f.type == 'Tarjeta de crédito';
  const days = (v, k) => `<select onchange="am.${k}=this.value"><option value="">—</option>${[...Array(31)].map((_, i) => `<option value="${i + 1}"${+v == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>`;
  dlg.innerHTML = `<form onsubmit="return svAcc(event)"><h2>${f.id ? 'Editar' : 'Nueva'} cuenta</h2>
<label>Nombre<input required value="${esc(f.name)}" oninput="am.name=this.value" placeholder="Ej: Efectivo, BHD Ahorros…"></label>
<div class="two"><label>Tipo<select onchange="am.type=this.value;drawAccForm()">${opts(cfg.accTypes, f.type)}</select></label>
<label>Moneda<select onchange="am.currency=this.value">${opts(cu, f.currency)}</select></label></div>
${card ? `<div class="two"><label>Día de corte${days(f.cutDay, 'cutDay')}</label><label>Día límite de pago${days(f.payDay, 'payDay')}</label></div><p class="mini" style="margin:0">Con estas fechas la app te avisa cuánto pagar y cuándo vence.</p>` : ''}
<div class="two"><label>Saldo inicial<input type="number" inputmode="decimal" step="0.01" required value="${esc(f.openBalance)}" oninput="am.openBalance=this.value"></label>
<label>Fecha del saldo<input type="date" required value="${esc(f.openDate)}" onchange="am.openDate=this.value"></label></div>
<p class="note">${card ? 'En tarjetas, si ya debes algo, escribe el saldo en negativo (ej: -15000). ' : ''}${f.id ? 'Para corregir el saldo de hoy sin tocar el historial, usa “Ajustar saldo”.' : ''}</p>
<input value="${esc(f.note)}" oninput="am.note=this.value" placeholder="Nota (opcional): cuenta conjunta, emergencias…" aria-label="Nota">
${footer(f.id, `delAcc('${f.id}')`)}</form>`;
  dlgShow();
}
async function svAcc(e) {
  e.preventDefault(); const f = am; if (!f.name.trim()) return false;
  const prev = f.id && accs.find(a => a.id == f.id);
  if (f.id && goals.some(g => g.accId == f.id) && (f.currency != 'DOP' || f.type == 'Tarjeta de crédito')) return fail('Esta cuenta tiene metas atadas: debe seguir siendo una cuenta en pesos y no una tarjeta.');
  const b = parseFloat(f.openBalance); if (isNaN(b)) return fail('Escribe el saldo inicial (puede ser 0).');
  if (prev && prev.currency != f.currency && txs.some(x => x.accId == f.id || x.accIdTo == f.id) && !(await ask(`Esta cuenta ya tiene movimientos en ${prev.currency}. Si cambias a ${f.currency}, los montos viejos se leerán en ${f.currency}.`, { title: '¿Cambiar la moneda?', ok: 'Cambiar' }))) return false;
  const o = { id: f.id, name: f.name.trim(), type: f.type, currency: f.currency, note: f.note.trim(), openDate: f.openDate, openBalance: b };
  if (f.type == 'Tarjeta de crédito') { o.cutDay = +f.cutDay || null; o.payDay = +f.payDay || null; }
  saveAcc(o); dlg.close(); toast('Cuenta guardada', { kind: 'ok' }); return false;
}
let gm = {};
function openAdj(accId) { const a = accs.find(x => x.id == accId); gm = { accId, date: today(), balance: acctBalance(a), note: '' }; drawAdj(a); }
function drawAdj(a) {
  const f = gm, cur = acctBalance(a), prev = adjs.filter(x => x.accId == a.id).sort((x, y) => y.date.localeCompare(x.date));
  dlg.innerHTML = `<form onsubmit="return svAdj(event)"><h2>Ajustar saldo — ${esc(a.name)}</h2>
<p class="note">Saldo calculado hoy: <b>${money(cur, a.currency)}</b>. Si el real es distinto, ajústalo; la diferencia no cuenta como gasto ni ingreso.</p>
<div class="two"><label>Fecha<input type="date" required value="${esc(f.date)}" onchange="gm.date=this.value"></label>
<label>Saldo real<input type="number" inputmode="decimal" step="0.01" required value="${esc(f.balance)}" oninput="gm.balance=this.value"></label></div>
<input value="${esc(f.note)}" oninput="gm.note=this.value" placeholder="¿Qué pasó? (opcional)" aria-label="Nota">
${prev.length ? `<small class="mut">Ajustes anteriores</small>${prev.map(x => `<div class="row" style="padding:6px 0"><div><b>${fdate(x.date, 1)}</b><small>${money(x.balance, a.currency)}${x.note ? ' · ' + esc(x.note) : ''}</small></div><button type="button" class="d" aria-label="Borrar ajuste" onclick="delAdj('${x.id}')"><i class="icon-trash-2"></i></button></div>`).join('')}` : ''}
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar ajuste</button></div></form>`;
  dlgShow();
}
function svAdj(e) { e.preventDefault(); const f = gm, b = parseFloat(f.balance); if (isNaN(b)) return false; saveAdj({ accId: f.accId, date: f.date, balance: b, note: f.note.trim() }); dlg.close(); toast('Saldo ajustado', { kind: 'ok' }); return false; }
async function delAdj(id) {
  if (!(await ask('El saldo volverá a calcularse sin este ajuste.', { title: '¿Borrar el ajuste?', ok: 'Borrar', danger: true }))) return;
  removeItem('adj', id); const a = accs.find(x => x.id == gm.accId);
  if (a) { gm.balance = acctBalance(a); drawAdj(a); } render();
}

// ============ transferencias ============
let trform = {};
function goTr() { if (accs.length < 2) return fail('Necesitas al menos dos cuentas para transferir.'); openTransferForm(); }
// openTransferForm(id) edita; openTransferForm(null, destino, monto) prepara un pago de tarjeta
function openTransferForm(id, toId, amount) {
  if (accs.length < 2) return fail('Necesitas al menos dos cuentas para transferir.');
  const x = id && txs.find(t => t.id == id);
  if (x) trform = { id: x.id, date: x.d, from: x.accId, to: x.accIdTo, amount: x.a, amountTo: x.aTo, note: x.n || '', cr: x.cr, rec: x.rec };
  else {
    const to = toId || accs[1].id, from = (accs.find(a => a.id != to && !isCard(a)) || accs.find(a => a.id != to)).id;
    trform = { date: today(), from, to, amount: amount || '', amountTo: '', note: toId ? 'Pago de tarjeta' : '' };
  }
  drawTransferForm();
}
function trSet(k, v) {
  trform[k] = v;
  if (k == 'from' && trform.to == trform.from) trform.to = (accs.find(a => a.id != trform.from) || {}).id;
  trform.amountTo = '';
  drawTransferForm();
}
function drawTransferForm() {
  const f = trform, from = accs.find(a => a.id == f.from), to = accs.find(a => a.id == f.to), same = from && to && from.currency == to.currency;
  dlg.innerHTML = `<form onsubmit="return svTransfer(event)"><h2>${f.id ? 'Editar transferencia' : 'Nuevo movimiento'}</h2>${f.id ? '' : mvTabs('t')}
<label>Desde<select onchange="trSet('from',this.value)">${accs.map(a => accOpt(a, f.from, f.date)).join('')}</select></label>
<label>Hacia<select onchange="trSet('to',this.value)">${accs.filter(a => a.id != f.from).map(a => accOpt(a, f.to, f.date)).join('')}</select></label>
<div class="amount"><input type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="0.00" aria-label="Monto que sale" value="${esc(f.amount)}" oninput="trform.amount=this.value"><select disabled aria-label="Moneda"><option>${from ? from.currency : ''}</option></select></div>
${!same ? `<label>Monto que entra a “${to ? esc(to.name) : ''}” (${to ? to.currency : ''})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amountTo)}" oninput="trform.amountTo=this.value"></label>
<p class="mini" style="margin:0">Monedas distintas: escribe cuánto recibiste realmente.</p>` : ''}
<label>Fecha<input type="date" required value="${esc(f.date)}" onchange="trform.date=this.value;drawTransferForm()"></label>
<input value="${esc(f.note)}" oninput="trform.note=this.value" placeholder="Nota (opcional)" aria-label="Nota">
${footer(f.id, `delTx('${f.id}',{msg:'Transferencia borrada'})`)}</form>`;
  dlgShow();
}
async function svTransfer(e) {
  e.preventDefault(); const f = trform; if (f.from == f.to) return fail('Elige dos cuentas distintas.');
  const fa = accs.find(x => x.id == f.from), ta = accs.find(x => x.id == f.to);
  const a = parseFloat(f.amount), same = fa && ta && fa.currency == ta.currency, aTo = same ? a : parseFloat(f.amountTo);
  if (!(a > 0)) return fail('Escribe un monto mayor que cero.');
  if (!(aTo > 0)) return fail('Escribe el monto que entra a la otra cuenta.');
  for (const x of [fa, ta]) if (beforeOpen(x, f.date)) return false;
  if (!(await enoughOrAsk(fa, a, f.date, f.id))) return false;
  const o = { id: f.id, t: 'tr', d: f.date, accId: f.from, accIdTo: f.to, a, aTo, n: f.note.trim(), cr: f.cr };
  if (f.rec) o.rec = f.rec;
  saveTx(o); dlg.close(); toast('Transferencia guardada', { kind: 'ok' }); return false;
}

// ============ presupuesto ============
function tidyOverrides(c) { for (const [k, o] of Object.entries(c.budgetOverrides || {})) { if (o.cats && !Object.keys(o.cats).length) delete o.cats; if (o.total == null) delete o.total; if (!Object.keys(o).length) delete c.budgetOverrides[k]; } }
function setBudgetBase(v) { const n = parseFloat(v), c = deep(cfg); c.budgetTotal = isNaN(n) || n < 0 ? 0 : n; saveCfg(c); toast('Tope base guardado', { kind: 'ok' }); }
function setBudgetMonth(ym, v) {
  const n = parseFloat(v), c = deep(cfg); c.budgetOverrides = c.budgetOverrides || {};
  const o = c.budgetOverrides[ym] = c.budgetOverrides[ym] || {};
  if (isNaN(n) || n < 0) delete o.total; else o.total = n;
  tidyOverrides(c); saveCfg(c); toast(isNaN(n) ? 'Excepción quitada' : 'Tope del mes guardado', { kind: 'ok' });
}
function setBudgetCat(ym, cat, v) {
  const n = parseFloat(v), c = deep(cfg); c.budgetCats = c.budgetCats || {}; c.budgetOverrides = c.budgetOverrides || {};
  if (budMode == 'base') { if (isNaN(n) || n <= 0) delete c.budgetCats[cat]; else c.budgetCats[cat] = n; }
  else { const o = c.budgetOverrides[ym] = c.budgetOverrides[ym] || {}; o.cats = o.cats || {}; if (isNaN(n) || n < 0) delete o.cats[cat]; else o.cats[cat] = n; }
  tidyOverrides(c); saveCfg(c);
}

// ============ recurrentes ============
let rm2 = {};
function openRecForm(id, preset) {
  if (!accs.length) return fail('Primero crea una cuenta.');
  const x = { ...(recs.find(r => r.id == id) || {}), ...(preset || {}) };
  if (preset && preset.goalId && !x.name) { const g = goals.find(q => q.id == preset.goalId); x.name = g ? 'Aporte a ' + g.name : ''; }
  const fromDefault = (accs.find(a => !isCard(a) && a.currency == 'DOP') || accs[0]).id;
  rm2 = { id: x.id, name: x.name || '', t: x.t || 'e', c: x.c, sub: x.sub || '', w: x.w || defaultWho(), accId: x.accId || fromDefault, accIdTo: x.accIdTo || (accs.find(a => a.id != (x.accId || fromDefault)) || {}).id, goalId: x.goalId || (goals[0] && goals[0].id) || '', amount: x.amount || '', currency: x.currency || 'DOP', freq: x.freq || 'mensual', day: x.day ?? (x.freq == 'semanal' ? 1 : Math.min(28, +today().slice(8, 10))), month: x.month || recMonth(x.startDate ? x : { startDate: today() }), cutDay: x.cutDay || '', startDate: x.startDate || today(), active: x.active !== false };
  drawRecForm();
}
function recFreq(v) {
  const f = rm2, sd = new Date(f.startDate + 'T00:00:00Z'); f.freq = v;
  if (v == 'semanal') f.day = sd.getUTCDay();
  else if (v == 'mensual' || v == 'anual') { if (f.day != 'ultimo' && !(Number(f.day) >= 1 && Number(f.day) <= 28)) f.day = Math.min(28, sd.getUTCDate()); if (v == 'anual' && !f.month) f.month = sd.getUTCMonth() + 1; }
  drawRecForm();
}
function drawRecForm() {
  const f = rm2, money_t = f.t == 'i' || f.t == 'e';
  if (money_t) { const names = cfg.cats.filter(c => c.t == f.t).map(c => c.n); if (!f.c || !names.includes(f.c)) f.c = f.c && names.includes(f.c) ? f.c : names[0]; }
  const cu = [...new Set(['DOP', f.currency, ...cfg.cur])], from = accs.find(a => a.id == f.accId);
  const dayOpts = `<option value="ultimo"${f.day == 'ultimo' ? ' selected' : ''}>Último día</option>` + [...Array(28)].map((_, i) => `<option value="${i + 1}"${f.day == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('');
  dlg.innerHTML = `<form onsubmit="return svRec(event)"><h2>${f.id ? 'Editar' : 'Nuevo'} recurrente</h2>
<div class="seg sm">${Object.entries(REC_T).map(([k, l]) => `<button type="button" class="${f.t == k ? 'on' : ''}" onclick="rm2.t='${k}';rm2.c=null;drawRecForm()">${l.replace('Aporte a meta', 'A meta')}</button>`).join('')}</div>
<label>Nombre<input required value="${esc(f.name)}" oninput="rm2.name=this.value" placeholder="${f.t == 'g' ? 'Ej: Ahorro quincenal' : f.t == 'tr' ? 'Ej: Pago de tarjeta' : 'Ej: Luz, Internet, Salario…'}"></label>
${money_t ? `<label>Categoría<select onchange="rm2.c=this.value">${opts(cfg.cats.filter(c => c.t == f.t).map(c => c.n), f.c)}</select></label>` : ''}
${f.t == 'g' ? (goals.length ? `<label>Meta<select onchange="rm2.goalId=this.value">${goals.map(g => `<option value="${g.id}"${g.id == f.goalId ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>` : '<p class="note">Primero crea una meta en Más → Metas.</p>') : ''}
<label>${f.t == 'g' || f.t == 'tr' ? 'Desde la cuenta' : 'Cuenta'}<select onchange="rm2.accId=this.value;drawRecForm()">${accs.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('')}</select></label>
${f.t == 'tr' ? `<label>Hacia la cuenta<select onchange="rm2.accIdTo=this.value">${accs.filter(a => a.id != f.accId).map(a => `<option value="${a.id}"${f.accIdTo == a.id ? ' selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('')}</select></label>` : ''}
<div class="two"><label>Monto<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amount)}" oninput="rm2.amount=this.value"></label>
${money_t ? `<label>Moneda<select onchange="rm2.currency=this.value">${opts(cu, f.currency)}</select></label>` : `<label>Moneda<select disabled><option>${from ? from.currency : 'DOP'}</option></select></label>`}</div>
${money_t ? `<label>Quién<select onchange="rm2.w=this.value">${opts(cfg.people, f.w)}</select></label>` : ''}
<div class="two"><label>Frecuencia<select onchange="recFreq(this.value)">${Object.entries(freqLabel).map(([k, l]) => `<option value="${k}"${f.freq == k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
${f.freq == 'semanal' ? `<label>Día<select onchange="rm2.day=parseInt(this.value)">${WEEKDAYS.map((n, i) => `<option value="${i}"${Number(f.day) == i ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`
      : f.freq == 'quincenal' ? '<label>Días<select disabled><option>1 y 15</option></select></label>'
        : `<label>${f.t == 'e' ? 'Día de pago' : 'Día'}<select onchange="rm2.day=this.value=='ultimo'?'ultimo':parseInt(this.value)">${dayOpts}</select></label>`}</div>
${f.freq == 'anual' ? `<label>Mes<select onchange="rm2.month=parseInt(this.value)">${MONTHS.map((n, i) => `<option value="${i + 1}"${Number(f.month) == i + 1 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
${f.t == 'e' && f.freq != 'semanal' ? `<label>Día de corte (opcional, para facturas como luz o internet)<select onchange="rm2.cutDay=this.value"><option value="">—</option>${[...Array(31)].map((_, i) => `<option value="${i + 1}"${+f.cutDay == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>` : ''}
<div class="two"><label>Desde<input type="date" required value="${esc(f.startDate)}" onchange="rm2.startDate=this.value"></label><label class="toggle" style="align-self:end;padding-bottom:10px"><input type="checkbox" ${f.active ? 'checked' : ''} onchange="rm2.active=this.checked"> Activo</label></div>
<p class="mini" style="margin:0">Cuando llegue la fecha aparecerá en Inicio para que lo confirmes con un toque.</p>
${footer(f.id, `delRec('${f.id}')`)}</form>`;
  dlgShow();
}
function svRec(e) {
  e.preventDefault(); const f = rm2, a = parseFloat(f.amount);
  if (!f.name.trim()) return fail('Ponle un nombre.');
  if (!(a > 0)) return fail('Escribe un monto mayor que cero.');
  const from = accs.find(x => x.id == f.accId); if (!from) return fail('Elige una cuenta.');
  if (f.t == 'g' && !goals.some(g => g.id == f.goalId)) return fail('Elige una meta.');
  if (f.t == 'tr' && (!f.accIdTo || f.accIdTo == f.accId)) return fail('Elige la cuenta destino.');
  const o = { id: f.id, name: f.name.trim(), t: f.t, accId: f.accId, amount: a, freq: f.freq, day: f.day, startDate: f.startDate, active: f.active };
  if (f.t == 'i' || f.t == 'e') Object.assign(o, { c: f.c, sub: f.sub, w: f.w, currency: f.currency }); else o.currency = from.currency;
  if (f.t == 'g') o.goalId = f.goalId;
  if (f.t == 'tr') o.accIdTo = f.accIdTo;
  if (f.freq == 'anual') o.month = Number(f.month) || 1;
  o.cutDay = f.t == 'e' && f.cutDay ? +f.cutDay : null;
  saveRec(o); dlg.close(); toast('Recurrente guardado', { kind: 'ok' }); return false;
}
async function delRec(id) { if (!(await ask('Los movimientos ya confirmados no se borran.', { title: '¿Borrar este recurrente?', ok: 'Borrar', danger: true }))) return; removeItem('rec', id); dlg.close(); render(); toast('Recurrente borrado'); }
let crf = {};
function confirmRec(id, date) {
  const r = recs.find(x => x.id == id); if (!r) return;
  const acc = accs.find(a => a.id == r.accId);
  if (!acc) { toast(`La cuenta de “${r.name}” ya no existe. Elige otra.`, { kind: 'err' }); return openRecForm(id); }
  const t = r.t || 'e';
  if (t == 'g') {
    const g = goals.find(q => q.id == r.goalId); if (!g) { toast('La meta de este recurrente ya no existe. Edítalo.', { kind: 'err' }); return openRecForm(id); }
    const rt = rateOf(acc.currency, date);
    crf = { id, t, date, d: date, amt: r.amount, vdop: acc.currency == 'DOP' ? '' : (rt ? round2(r.amount * rt) : ''), pc: acc.currency };
  } else if (t == 'tr') {
    const to = accs.find(a => a.id == r.accIdTo); if (!to) { toast('La cuenta destino ya no existe. Edítalo.', { kind: 'err' }); return openRecForm(id); }
    const rf = rateOf(acc.currency, date), rp = rateOf(to.currency, date);
    crf = { id, t, date, d: date, amt: r.amount, amtTo: acc.currency == to.currency ? '' : (rf && rp ? round2(r.amount * rf / rp) : ''), pc: acc.currency, tc: to.currency };
  } else {
    const pc = acc.currency, fx = r.currency || 'DOP';
    let amt = '';
    if (fx == pc) amt = r.amount;
    else { const rf = rateOf(fx, date), rp = rateOf(pc, date); if (rf && rp) amt = round2(r.amount * rf / rp); }
    crf = { id, t, date, d: date, amt, rate: pc == 'DOP' ? 1 : (rateOf(pc, date) || ''), pc, fx, base: r.amount };
  }
  drawConfirmRec();
}
function drawConfirmRec() {
  const f = crf, r = recs.find(x => x.id == f.id); if (!r) return;
  const acc = accs.find(a => a.id == r.accId), to = accs.find(a => a.id == r.accIdTo), g = goals.find(q => q.id == r.goalId);
  const what = f.t == 'g' ? `De “${esc(acc.name)}” a la meta “${esc(g.name)}”.` : f.t == 'tr' ? `De “${esc(acc.name)}” a “${esc(to.name)}”.` : `Base: ${money(f.base, f.fx)}. Escribe lo que realmente se ${f.t == 'i' ? 'recibió' : 'pagó'}.`;
  dlg.innerHTML = `<form onsubmit="return svConfirmRec(event)"><h2>Confirmar “${esc(r.name)}”</h2>
<p class="note">Corresponde al ${fdate(f.date, 1)}. ${what}</p>
<label>Monto (${f.pc}${f.t == 'e' || f.t == 'i' ? ', moneda de la cuenta' : ''})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amt)}" oninput="crf.amt=this.value"></label>
${(f.t == 'e' || f.t == 'i') && f.pc != 'DOP' ? `<label>Tasa: 1 ${f.pc} = ? DOP<input type="number" inputmode="decimal" step="0.0001" min="0.0001" required value="${esc(f.rate)}" oninput="crf.rate=this.value"></label>` : ''}
${f.t == 'g' && f.pc != 'DOP' ? `<label>Equivale en DOP<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.vdop)}" oninput="crf.vdop=this.value"></label>` : ''}
${f.t == 'tr' && f.pc != f.tc ? `<label>Monto que entra (${f.tc})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amtTo)}" oninput="crf.amtTo=this.value"></label>` : ''}
<label>Fecha<input type="date" required value="${esc(f.d)}" onchange="crf.d=this.value"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Confirmar</button></div></form>`;
  dlgShow();
}
async function svConfirmRec(e) {
  e.preventDefault(); const f = crf, r = recs.find(x => x.id == f.id); if (!r) return false;
  const a = parseFloat(f.amt); if (!(a > 0)) return fail('Revisa el monto.');
  const ac = accs.find(x => x.id == r.accId); if (beforeOpen(ac, f.d)) return false;
  let o;
  if (f.t == 'g') {
    const vd = f.pc == 'DOP' ? a : parseFloat(f.vdop); if (!(vd > 0)) return fail('Escribe el equivalente en DOP.');
    if (!(await enoughOrAsk(ac, a, f.d))) return false;
    const home = tiedAcc(r.goalId);
    o = { t: 'g', goalId: r.goalId, home: home && home.id, accId: r.accId, d: f.d, w: myPerson() || defaultWho(), a, cu: f.pc, r: f.pc == 'DOP' ? 1 : vd / a, v: vd, n: 'Recurrente: ' + r.name, c: 'Aporte a meta', rec: r.id };
  } else if (f.t == 'tr') {
    const aTo = f.pc == f.tc ? a : parseFloat(f.amtTo); if (!(aTo > 0)) return fail('Escribe el monto que entra.');
    if (beforeOpen(accs.find(x => x.id == r.accIdTo), f.d)) return false;
    if (!(await enoughOrAsk(ac, a, f.d))) return false;
    o = { t: 'tr', d: f.d, accId: r.accId, accIdTo: r.accIdTo, a, aTo, n: 'Recurrente: ' + r.name, rec: r.id };
  } else {
    const rt = f.pc == 'DOP' ? 1 : parseFloat(f.rate); if (!(rt > 0)) return fail('Revisa la tasa.');
    if (r.t == 'e' && !(await enoughOrAsk(ac, a, f.d))) return false;
    o = { t: r.t, d: f.d, c: r.c, sub: r.sub, w: r.w, accId: r.accId, a, aa: a, cu: f.pc, r: rt, v: round2(a * rt), n: 'Recurrente: ' + r.name + (f.fx != f.pc ? ` (base ${money(f.base, f.fx)})` : ''), rec: r.id };
  }
  dlg.close(); saveTx(o, { noRender: true }); saveRec(recMarkDone(recs.find(x => x.id == f.id), f.date)); toast('Confirmado', { kind: 'ok' });
  return false;
}
async function skipRec(id, date) { const r = recs.find(x => x.id == id); if (!r || !(await ask('No se registrará nada para esta fecha.', { title: '¿Omitir este pago?', ok: 'Omitir' }))) return; saveRec(recMarkDone(r, date)); toast('Omitido'); }

// ============ metas ============
function reassignContrib(id, goalId) {
  if (!goalId) return; const x = txs.find(t => t.id == id), g = goals.find(q => q.id == goalId); if (!x || !g) return;
  saveTx({ ...x, goalId, home: g.accId }); toast('Aporte reasignado', { kind: 'ok' });
}
let gform = {};
function openGoalForm(id) { const x = goals.find(g => g.id == id) || {}; gform = { id: x.id, name: x.name || '', target: x.target || '', accId: x.accId || '', note: x.note || '' }; drawGoalForm(); }
function drawGoalForm() {
  const f = gform, ok = accs.filter(a => !isCard(a) && a.currency == 'DOP');
  dlg.innerHTML = `<form onsubmit="return svGoal(event)"><h2>${f.id ? 'Editar' : 'Nueva'} meta</h2>
<label>Nombre<input required value="${esc(f.name)}" oninput="gform.name=this.value" placeholder="Ej: Fondo de emergencia, Viaje…"></label>
<label>Monto objetivo (DOP)<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.target)}" oninput="gform.target=this.value"></label>
${ok.length ? `<label>Cuenta donde está este ahorro<select required onchange="gform.accId=this.value"><option value="" disabled${ok.some(a => a.id == f.accId) ? '' : ' selected'}>Elige una cuenta…</option>${ok.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)} · ${money(acctBalance(a), a.currency)}</option>`).join('')}</select></label><p class="mini" style="margin:0">Varias metas pueden compartir una cuenta; cada una lleva su avance.</p>`
      : `<p class="note">Toda meta va atada a una cuenta en pesos (no tarjetas). Primero agrégala en Cuentas.</p>`}
<input value="${esc(f.note)}" oninput="gform.note=this.value" placeholder="Nota (opcional)" aria-label="Nota">
${footer(f.id, `delGoal('${f.id}')`)}</form>`;
  dlgShow();
}
async function svGoal(e) {
  e.preventDefault(); const f = gform, t = parseFloat(f.target);
  if (!(t > 0)) return fail('Escribe un monto objetivo mayor que cero.');
  const na = accs.find(a => a.id == f.accId && !isCard(a) && a.currency == 'DOP');
  if (!na) return fail('Elige la cuenta donde está este ahorro.');
  const prev = f.id && goals.find(g => g.id == f.id);
  if (prev && (prev.accId || '') != (f.accId || '')) {
    const sv = goalProgress(prev).saved;
    if (sv > 0) {
      if (freeBal(na) < sv - 0.005) return fail(`“${na.name}” no tiene saldo libre para los ${money(sv)} de esta meta.`);
      if (!(await ask(`Los ${money(sv)} ahorrados pasarán a contarse dentro de “${na.name}” y saldrán de la cuenta anterior.`, { title: '¿Cambiar de cuenta?', ok: 'Cambiar' }))) return false;
    }
  }
  saveGoal({ id: f.id, name: f.name.trim(), target: t, accId: f.accId, note: f.note.trim() }); dlg.close(); toast('Meta guardada', { kind: 'ok' }); return false;
}
async function delGoal(id) { if (!(await ask('El dinero ahorrado se queda en la cuenta; solo deja de estar apartado.', { title: '¿Borrar esta meta?', ok: 'Borrar', danger: true }))) return; removeItem('goal', id); dlg.close(); render(); toast('Meta borrada'); }
let cform = {};
const tiedAcc = gid => { const g = goals.find(x => x.id == gid); return g && accs.find(a => a.id == g.accId && !isCard(a)); };
function syncGoalAcc() { const t = tiedAcc(cform.goalId); if (t && !cform.id) cform.accId = t.id; else if (!accs.some(a => a.id == cform.accId)) cform.accId = accs[0].id; }
function needTie(gid) { if (tiedAcc(gid)) return false; toast('Esta meta no está atada a una cuenta. Elige la cuenta donde está el ahorro.', { kind: 'err' }); openGoalForm(gid); return true; }
function pickGoal(gid) { cform.goalId = gid; if (needTie(gid)) return; syncGoalAcc(); drawContribForm(); }
// openContribForm(meta) nuevo; openContribForm(meta, id) edita un aporte o retiro
function openContribForm(goalId, id) {
  if (!goals.length) return fail('Primero crea una meta en Más → Metas.');
  if (!accs.length) return fail('Primero crea una cuenta.');
  const x = id && txs.find(t => t.id == id);
  const g0 = goals.find(q => q.id == (x ? x.goalId : goalId)) || goals[0];
  if (x) cform = { id: x.id, goalId: g0.id, date: x.d, dir: x.v < 0 ? 'out' : 'in', accId: x.accId, amount: Math.abs(x.a), vdop: Math.abs(x.v), w: x.w || defaultWho(), note: x.n || '', cr: x.cr, rec: x.rec };
  else cform = { goalId: g0.id, date: today(), dir: 'in', accId: accs[0].id, amount: '', vdop: '', w: defaultWho(), note: '' };
  if (needTie(g0.id)) return; syncGoalAcc(); drawContribForm();
}
function drawContribForm() {
  const f = cform, acc = accs.find(a => a.id == f.accId), fx = acc && acc.currency != 'DOP', h = tiedAcc(f.goalId), other = h && f.accId != h.id;
  dlg.innerHTML = `<form onsubmit="return svContrib(event)"><h2>${f.id ? 'Editar aporte' : 'Nuevo movimiento'}</h2>${f.id ? '' : mvTabs('g')}
<div class="seg"><button type="button" class="${f.dir == 'in' ? 'on' : ''}" onclick="cform.dir='in';drawContribForm()">Cuenta → Meta</button><button type="button" class="${f.dir == 'out' ? 'on' : ''}" onclick="cform.dir='out';drawContribForm()">Meta → Cuenta</button></div>
<label>Meta<select onchange="pickGoal(this.value)">${goals.map(g => `<option value="${g.id}"${g.id == f.goalId ? ' selected' : ''}>${esc(g.name)} · ${money(goalProgress(g).saved)}</option>`).join('')}</select></label>
<label>${f.dir == 'in' ? 'Cuenta de origen' : 'Cuenta destino'}<select onchange="cform.accId=this.value;drawContribForm()">${accs.map(a => accOpt(a, f.accId, f.date)).join('')}</select></label>
<p class="mini" style="margin:0">${h ? (other ? 'La meta está en “' + esc(h.name) + '”: el dinero se mueve entre las dos cuentas.' : 'El dinero ya está en “' + esc(h.name) + '”; solo se aparta para la meta.') : ''}</p>
<div class="amount"><input type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="0.00" aria-label="Monto" value="${esc(f.amount)}" oninput="cform.amount=this.value"><select disabled aria-label="Moneda"><option>${acc ? acc.currency : 'DOP'}</option></select></div>
${fx ? `<label>Equivale en DOP<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.vdop)}" oninput="cform.vdop=this.value"></label>` : ''}
<div class="two"><label>Fecha<input type="date" required value="${esc(f.date)}" onchange="cform.date=this.value;drawContribForm()"></label><label>Quién<select onchange="cform.w=this.value">${opts(cfg.people, f.w)}</select></label></div>
<input value="${esc(f.note)}" oninput="cform.note=this.value" placeholder="Nota (opcional)" aria-label="Nota">
${footer(f.id, `delTx('${f.id}',{msg:'Aporte borrado'})`)}</form>`;
  dlgShow();
}
async function svContrib(e) {
  e.preventDefault(); if (needTie(cform.goalId)) return false;
  const f = cform, acc = accs.find(a => a.id == f.accId), a = parseFloat(f.amount);
  if (!acc || !(a > 0)) return fail('Escribe un monto mayor que cero.');
  const fx = acc.currency != 'DOP', vd = fx ? parseFloat(f.vdop) : a;
  if (!(vd > 0)) return fail('Escribe el equivalente en DOP.');
  const hm = tiedAcc(f.goalId);
  for (const x of [acc, hm]) if (beforeOpen(x, f.date)) return false;
  if (f.dir == 'out') {
    const g = goals.find(x => x.id == f.goalId), saved = without(f.id, () => goalProgress(g).saved);
    if (vd > saved + 0.005) return fail(`No hay suficiente en la meta “${g.name}”. Ahorrado: ${money(saved)}.`);
    if (hm && hm.id != acc.id && vd > acctBalance(hm, f.date) + 0.005) return fail(`La cuenta “${hm.name}” no tiene ${money(vd)} para entregar.`);
  } else if (!(await enoughOrAsk(acc, a, f.date, f.id))) return false;
  const sg = f.dir == 'out' ? -1 : 1; dlg.close();
  const o = { id: f.id, t: 'g', goalId: f.goalId, home: (hm || {}).id, accId: f.accId, d: f.date, w: f.w, a: sg * a, cu: acc.currency, r: fx ? vd / a : 1, v: sg * vd, n: f.note.trim(), c: sg > 0 ? 'Aporte a meta' : 'Retiro de meta', cr: f.cr };
  if (f.rec) o.rec = f.rec;
  saveTx(o); toast(f.id ? 'Cambios guardados' : 'Guardado', { kind: 'ok' });
  return false;
}

// ============ saldar cuentas entre ustedes ============
let sf2 = {};
function openSettle(from, to, amount, id) {
  if (cfg.people.length < 2) return fail('Agrega al menos dos personas en Ajustes.');
  const x = id && txs.find(t => t.id == id);
  sf2 = x ? { id: x.id, from: x.w, to: x.to, amount: x.v, date: x.d, note: x.n || '', cr: x.cr }
    : { from: from || cfg.people[1], to: to || cfg.people[0], amount: amount || '', date: today(), note: '' };
  if (sf2.from == sf2.to) sf2.to = cfg.people.find(p => p != sf2.from);
  drawSettle();
}
function drawSettle() {
  const f = sf2;
  dlg.innerHTML = `<form onsubmit="return svSettle(event)"><h2>${f.id ? 'Editar pago entre ustedes' : 'Saldar cuentas'}</h2>
<p class="note">Registra cuando uno le paga al otro lo que le debía de los gastos compartidos. No mueve dinero de tus cuentas en la app; si fue una transferencia entre cuentas, anótala también en Transferir.</p>
<div class="two"><label>Pagó<select onchange="sf2.from=this.value">${opts(cfg.people, f.from)}</select></label><label>A<select onchange="sf2.to=this.value">${opts(cfg.people, f.to)}</select></label></div>
<div class="amount"><input type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="0.00" aria-label="Monto" value="${esc(f.amount)}" oninput="sf2.amount=this.value"><select disabled><option>DOP</option></select></div>
<label>Fecha<input type="date" required value="${esc(f.date)}" onchange="sf2.date=this.value"></label>
<input value="${esc(f.note)}" oninput="sf2.note=this.value" placeholder="Nota (opcional)" aria-label="Nota">
${footer(f.id, `delTx('${f.id}',{msg:'Pago borrado'})`)}</form>`;
  dlgShow();
}
function svSettle(e) {
  e.preventDefault(); const f = sf2, a = parseFloat(f.amount);
  if (f.from == f.to) return fail('Elige dos personas distintas.');
  if (!(a > 0)) return fail('Escribe un monto mayor que cero.');
  saveTx({ id: f.id, t: 'st', d: f.date, w: f.from, to: f.to, a, v: a, cu: 'DOP', r: 1, n: f.note.trim(), cr: f.cr });
  dlg.close(); toast('Pago registrado', { kind: 'ok' }); return false;
}

// ============ categorías y personas ============
let ce = {};
function openCatEdit(t, n) {
  const c = cfg.cats.find(x => x.t == t && x.n == n);
  ce = { t, old: c ? c.n : null, n: c ? c.n : '', icon: c ? c.icon : 'tag', subs: [...((cfg.subs || {})[n] || [])] };
  drawCatEdit();
}
function drawCatEdit() {
  const f = ce, used = f.old ? txs.filter(x => x.c == f.old && x.t == f.t).length : 0;
  dlg.innerHTML = `<form onsubmit="return svCat(event)"><h2>${f.old ? 'Editar' : 'Nueva'} categoría de ${f.t == 'e' ? 'egreso' : 'ingreso'}</h2>
<label>Nombre<input required value="${esc(f.n)}" oninput="ce.n=this.value"></label>
${f.old && used ? `<p class="mini" style="margin:0">Si cambias el nombre, se actualizan sus ${used} movimientos.</p>` : ''}
<small class="mut">Ícono</small><div class="icogrid">${ICONS.map(i => `<button type="button" aria-label="${i}" class="${i == f.icon ? 'on' : ''}" onclick="ce.icon='${i}';drawCatEdit()"><i class="icon-${i}"></i></button>`).join('')}</div>
<small class="mut">Subcategorías (opcional): aparecen como botones al anotar</small>
<div class="tags" style="margin:0">${f.subs.map((s, i) => `<button type="button" onclick="ce.subs.splice(${i},1);drawCatEdit()">${esc(s)} <i class="icon-x"></i></button>`).join('') || '<small class="mut">Ninguna</small>'}</div>
<div class="add"><input id="subin" placeholder="Ej: Supermercado, Restaurantes…" onkeydown="if(event.key=='Enter'){event.preventDefault();addSub()}"><button type="button" onclick="addSub()">Agregar</button></div>
${footer(f.old, `delCat()`)}</form>`;
  dlgShow();
}
function addSub() { const el = $('subin'), v = el.value.trim(); if (!v) return; if (ce.subs.some(s => s.toLowerCase() == v.toLowerCase())) return fail('Ya existe.'); ce.n = ce.n || ''; ce.subs.push(v); drawCatEdit(); setTimeout(() => $('subin') && $('subin').focus(), 30); }
function svCat(e) {
  e.preventDefault(); const f = ce, n = f.n.trim(); if (!n) return fail('Escribe un nombre.');
  if (cfg.cats.some(x => x.t == f.t && x.n.toLowerCase() == n.toLowerCase() && x.n != f.old)) return fail('Ya existe una categoría con ese nombre.');
  const c = deep(cfg); c.subs = c.subs || {};
  if (f.old) {
    c.cats = c.cats.map(x => x.t == f.t && x.n == f.old ? { ...x, n, icon: f.icon } : x);
    if (n != f.old) {
      delete c.subs[f.old];
      if (f.t == 'e') {
        if (c.budgetCats && c.budgetCats[f.old] != null) { c.budgetCats[n] = c.budgetCats[f.old]; delete c.budgetCats[f.old]; }
        for (const o of Object.values(c.budgetOverrides || {})) if (o.cats && o.cats[f.old] != null) { o.cats[n] = o.cats[f.old]; delete o.cats[f.old]; }
      }
      bulkTxs(txs.filter(x => x.c == f.old && x.t == f.t).map(x => ({ ...x, c: n })));
      recs.filter(r => r.c == f.old && r.t == f.t).forEach(r => saveRec({ ...r, c: n }, { noRender: true }));
    }
  } else c.cats.push({ n, t: f.t, icon: f.icon });
  if (f.subs.length) c.subs[n] = f.subs; else delete c.subs[n];
  saveCfg(c); dlg.close(); toast('Categoría guardada', { kind: 'ok' }); return false;
}
async function delCat() { dlg.close(); await rm(ce.t == 'i' ? 'ci' : 'ce', ce.old); }
let pe = {};
function openPersonEdit(n) {
  pe = { old: n, n };
  dlg.innerHTML = `<form onsubmit="return svPerson(event)"><h2>Editar persona</h2>
<label>Nombre<input required value="${esc(n)}" oninput="pe.n=this.value"></label>
<p class="mini" style="margin:0">Al cambiar el nombre se actualizan todos sus movimientos y recurrentes.</p>
${footer(true, `dlg.close();rm('people',pe.old)`)}</form>`;
  dlgShow();
}
function svPerson(e) {
  e.preventDefault(); const n = pe.n.trim(), old = pe.old; if (!n) return fail('Escribe un nombre.');
  if (n != old && cfg.people.some(p => p.toLowerCase() == n.toLowerCase())) return fail('Ya existe esa persona.');
  if (n != old) renamePerson(old, n);
  dlg.close(); return false;
}
function renamePerson(old, n) {
  const c = deep(cfg); c.people = c.people.map(p => p == old ? n : p); if (!c.people.includes(n)) c.people.push(n);
  bulkTxs(txs.filter(x => x.w == old || x.byName == old || x.to == old || x.split == 'for:' + old).map(x => ({ ...x, w: x.w == old ? n : x.w, byName: x.byName == old ? n : x.byName, ...(x.to == old ? { to: n } : {}), ...(x.split == 'for:' + old ? { split: 'for:' + n } : {}) })));
  recs.filter(r => r.w == old).forEach(r => saveRec({ ...r, w: n }, { noRender: true }));
  if (myPerson() == old) { setMyPerson(n); if (cloudOn() && window.Cloud.setMyName) window.Cloud.setMyName(n); }
  saveCfg(c); toast('Nombre actualizado', { kind: 'ok' });
}
function ad(k) {
  const el = $('a-' + k), v = el.value.trim(); if (!v) return;
  const c = deep(cfg), u = k == 'cur' ? v.toUpperCase() : v;
  if (k == 'cur' && !CUR_RE.test(u)) return fail('Usa el código de 3 letras de la moneda (ej: USD, EUR, CAD).');
  if (c[k].some(x => x.toLowerCase() == u.toLowerCase()) || u == 'DOP') return fail('Ya existe.');
  c[k] = [...c[k], u]; saveCfg(c); toast('Agregado', { kind: 'ok' });
}
async function rm(k, n) {
  const used = k == 'people' ? txs.filter(x => x.w == n).length : k == 'cur' ? txs.filter(x => x.cu == n).length + accs.filter(a => a.currency == n).length : txs.filter(x => x.c == n && x.t == (k == 'ci' ? 'i' : 'e')).length;
  if (!(await ask(used ? `“${n}” tiene ${used} movimientos o cuentas. Se conservan, pero ya no podrás elegirla.` : `Se quitará “${n}”.`, { title: '¿Borrar?', ok: 'Borrar', danger: true }))) return;
  const c = deep(cfg);
  if (k == 'ci' || k == 'ce') {
    const t = k == 'ci' ? 'i' : 'e'; c.cats = c.cats.filter(x => !(x.t == t && x.n == n));
    if (t == 'e') { delete (c.budgetCats || {})[n]; for (const o of Object.values(c.budgetOverrides || {})) if (o.cats) delete o.cats[n]; tidyOverrides(c); }
  } else c[k] = c[k].filter(x => x != n);
  saveCfg(c); toast('Borrado');
}
function setRefRate(cu, v) { const n = parseFloat(v), c = deep(cfg); c.rates = c.rates || {}; if (n > 0) c.rates[cu] = n; else delete c.rates[cu]; saveCfg(c); toast('Tasa de ' + cu + ' guardada', { kind: 'ok' }); }

// ============ respaldo ============
const pack = () => JSON.stringify({ app: 'mis-finanzas', v: 6, ...snapshot() });
function mergeCfg(mine, theirs, theirsNewer) {
  const base = theirsNewer ? deep(theirs) : deep(mine), other = theirsNewer ? mine : theirs;
  for (const c of other.cats || []) if (!base.cats.some(x => x.n == c.n && x.t == c.t)) base.cats.push(c);
  for (const k of ['people', 'cur', 'accTypes']) base[k] = [...new Set([...(base[k] || []), ...(other[k] || [])])];
  base.shortcuts = [...(base.shortcuts || []), ...(other.shortcuts || []).filter(x => !(base.shortcuts || []).some(y => y.id == x.id))];
  base.subs = { ...(other.subs || {}), ...(base.subs || {}) };
  base.rates = { ...(other.rates || {}), ...(base.rates || {}) };
  return base;
}
async function merge(s, rep) {
  let o; try { o = JSON.parse(s); } catch (e) { return fail('El texto no es un respaldo válido.'); }
  if (!o || o.app != 'mis-finanzas') return fail('Eso no es un respaldo de Mis finanzas.');
  const inc = cleanState(o), wasEmpty = !hasLocalData(), before = new Map(getAllItems().map(x => [x.id, x.u + ':' + (x.del || 0)]));
  if (rep) {
    if (!(await ask(cloudOn() ? 'Se reemplaza lo de este teléfono y se envía a la nube del hogar.' : 'Se reemplaza todo lo de este teléfono.', { title: '¿Reemplazar todo?', ok: 'Reemplazar', danger: true }))) return;
    if (cloudOn()) window.Cloud.wipeAll(getAllItems().filter(x => !inc.txs.concat(inc.accs, inc.adjs, inc.recs, inc.goals, inc.trash).some(y => y.id == x.id)));
    setState({ ...inc, cfgT: now() }); toast('Respaldo cargado', { kind: 'ok' });
  } else {
    const lu = x => x.u || x.createdAt || 0;
    const mrg = (mine, theirs) => { const m = new Map(mine.map(x => [x.id, x])); theirs.forEach(x => { const y = m.get(x.id); if (!y || lu(x) > lu(y)) m.set(x.id, x); }); return [...m.values()]; };
    const d = { ...dels }; Object.entries(inc.dels).forEach(([k, v]) => d[k] = Math.max(v, d[k] || 0));
    let a = 0, u = 0; const m = new Map(txs.map(x => [x.id, x]));
    inc.txs.forEach(x => { const y = m.get(x.id); if (!y) { m.set(x.id, x); a++; } else if ((x.u || 0) > (y.u || 0)) { m.set(x.id, x); u++; } });
    const tm = new Map(trash.map(x => [x.id, x])); inc.trash.forEach(x => { const y = tm.get(x.id); if (!y || (x.del || 0) > (y.del || 0)) tm.set(x.id, x); });
    const bm = new Map(bin.map(x => [x.id, x])); inc.bin.forEach(x => { const y = bm.get(x.id); if (!y || (x.del || 0) > (y.del || 0)) bm.set(x.id, x); }); bin = [...bm.values()];
    Object.entries(d).forEach(([k, v]) => { const y = m.get(k); if (y && v >= (y.u || 0)) { tm.set(k, { ...y, del: v }); m.delete(k); } });
    dels = d; txs = [...m.values()]; trash = [...tm.values()].filter(x => !(m.has(x.id) && (m.get(x.id).u || 0) > (x.del || 0)));
    const alive = x => !(d[x.id] && d[x.id] >= lu(x));
    accs = mrg(accs, inc.accs).filter(alive); adjs = mrg(adjs, inc.adjs).filter(alive); recs = mrg(recs, inc.recs).filter(alive); goals = mrg(goals, inc.goals).filter(alive);
    const live = new Set([...accs, ...adjs, ...recs, ...goals].map(x => x.id)); bin = bin.filter(x => !live.has(x.id)); purgeOld();
    cfg = wasEmpty ? inc.cfg : mergeCfg(cfg, inc.cfg, inc.cfgT > cfgT); cfgT = now();
    toast(`Listo: ${a} movimientos nuevos y ${u} actualizados.`, { kind: 'ok', ms: 5000 });
  }
  local();
  if (cloudOn()) { window.Cloud.pushItems(getAllItems().filter(x => before.get(x.id) != x.u + ':' + (x.del || 0))); cloudCfg(); }
  render();
}
function download(filename, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (matchMedia('(pointer:coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: filename }).catch(() => { });
  } catch (e) { }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// Recordatorio de respaldo: se guarda cuándo fue el último
const markBackup = () => { try { localStorage.setItem('fin_lastbk', String(Date.now())); localStorage.removeItem('fin_bk_snooze'); } catch (e) { } };
function bk() { download('finanzas-respaldo-' + today() + '.json', pack(), 'application/json'); markBackup(); }
function cp() {
  const t = pack(), ok1 = () => { markBackup(); toast('Respaldo copiado. Pégalo en WhatsApp, un correo o la otra app.', { kind: 'ok' }); };
  const fb = () => { const ta = $('paste'); if (!ta) return fail('No se pudo copiar.'); ta.closest('details') && (ta.closest('details').open = true); ta.value = t; ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ok ? ok1() : toast('Copia el texto de la caja (mantén presionado → Copiar).'); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok1, fb); else fb(); } catch (e) { fb(); }
}
function fi(el) { const f = el.files[0]; if (f) f.text().then(t => merge(t, $('rp').checked)); el.value = ''; }

// ============ Excel (la librería se carga solo al usarla) ============
function loadScript(src) { return new Promise((ok, ko) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
async function xl() {
  const a = fl(); if (!a.length) return fail('No hay ingresos ni egresos para exportar con los filtros del Historial.');
  try { if (typeof XLSX == 'undefined') await loadScript('vendor/xlsx.mini.min.js'); } catch (e) { return fail('No se pudo cargar el exportador de Excel. Revisa tu conexión.'); }
  const rows = a.map(x => ({ Fecha: x.d, Tipo: x.t == 'i' ? 'Ingreso' : 'Egreso', Categoría: x.c, Detalle: x.sub || '', Persona: x.w, 'Para quién': splitLabel(x), 'Anotado por': x.byName || '', Cuenta: (accs.find(c => c.id == x.accId) || {}).name || '', Monto: x.a, Moneda: x.cu || 'DOP', Tasa: x.r, 'Monto en DOP': x.v, Nota: x.n || '' }));
  const cat = {}; a.forEach(x => { const k = x.t + '|' + x.c; cat[k] = (cat[k] || 0) + x.v; });
  const res = Object.entries(cat).map(([k, v]) => ({ Tipo: k[0] == 'i' ? 'Ingreso' : 'Egreso', Categoría: k.slice(2), 'Total DOP': round2(v) })).sort((p, q) => p.Tipo.localeCompare(q.Tipo) || q['Total DOP'] - p['Total DOP']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Movimientos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res), 'Resumen');
  download('finanzas-' + today() + '.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
