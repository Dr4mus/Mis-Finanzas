'use strict';
(window.__V = window.__V || {})['deudas.js'] = '10.2.0';
/* Mis finanzas — Deudas y bienes: préstamos con tabla de pagos, deudas con personas (yo debo / me deben),
   bienes (casa, vehículo…), plan para salir de deudas y calculadora de préstamos. */
let debtTab = 'loans', planExtra = '', planStrat = 'avalanche';
const ASSET_KINDS = [['Casa', 'home'], ['Apartamento', 'building'], ['Terreno', 'map-pin'], ['Vehículo', 'car'], ['Negocio', 'briefcase'], ['Inversión', 'trending-up'], ['Otro', 'gem']];
const assetIcon = k => (ASSET_KINDS.find(x => x[0] == k) || [, 'gem'])[1];
const loanIcon = k => ({ Hipoteca: 'home', Vehículo: 'car', Estudios: 'graduation-cap', Negocio: 'briefcase' }[k] || 'hand-coins');
const toDOP = (v, cu, d) => convert(v, cu || 'DOP', 'DOP', d || today());
// Para tablas: número sin moneda ni centavos y mes corto (“nov 26”)
const num0 = v => (HIDE ? '•••' : Math.round(v || 0).toLocaleString('en-US'));
const mesCorto = iso => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+iso.slice(5, 7) - 1] + ' ' + iso.slice(2, 4);
// Monto sin centavos para resúmenes (los números grandes no caben con decimales)
const money0 = (n, c) => (HIDE ? money(n, c) : money(Math.round(n || 0), c).replace(/\.00$/, ''));

// ============ resumen ============
function debtSummary() {
  const td = today(), loans = accs.filter(isLoan), cards = accs.filter(isCard);
  const loanTot = loans.reduce((s, a) => s + toDOP(loanOwed(a), a.currency), 0);
  const cardTot = cards.reduce((s, a) => s + toDOP(Math.max(0, -acctBalance(a)), a.currency), 0);
  const owe = debts.filter(d => d.dir == 'owe').reduce((s, d) => s + toDOP(debtLeft(d), d.cu), 0);
  const owed = debts.filter(d => d.dir == 'owed').reduce((s, d) => s + toDOP(debtLeft(d), d.cu), 0);
  const goods = assets.reduce((s, a) => s + toDOP(a.value, a.cu), 0);
  return { loanTot: round2(loanTot), cardTot: round2(cardTot), owe: round2(owe), owed: round2(owed), goods: round2(goods), total: round2(loanTot + cardTot + owe), nw: netWorthApprox().total };
}

// ============ pantalla Deudas ============
function renderDebts(app) {
  const s = debtSummary();
  const tabs = [['loans', 'Préstamos'], ['people', 'Personas'], ['assets', 'Bienes'], ['plan', 'Plan']];
  const body = { loans: debtsLoansHTML, people: debtsPeopleHTML, assets: debtsAssetsHTML, plan: debtsPlanHTML }[debtTab] || debtsLoansHTML;
  app.innerHTML = `${head('Deudas y bienes', true)}
<div class="card sumc"><small>Patrimonio neto</small><b class="big ${s.nw < 0 ? 'out' : ''}">${money0(s.nw)}</b>
<div class="sum3"><div><small>Debes</small><b class="out">${money0(s.total)}</b></div><div><small>Te deben</small><b class="in">${money0(s.owed)}</b></div><div><small>Bienes</small><b>${money0(s.goods)}</b></div></div></div>
<div class="seg sm" style="margin-bottom:12px">${tabs.map(([k, l]) => `<button type="button" class="${debtTab == k ? 'on' : ''}" onclick="debtTab='${k}';render()">${l}</button>`).join('')}</div>
${body()}`;
}
// ---- préstamos y tarjetas ----
function loanCardHTML(a) {
  const owed = loanOwed(a), cy = loanCycle(a), orig = +a.principal || owed, pct = orig > 0 ? Math.max(0, Math.min(100, Math.round((1 - owed / orig) * 100))) : 0;
  const am = cy && !cy.done && a.payment ? amortize(owed, +a.rate || 0, +a.payment, cy.paid ? addMonthsISO(cy.due, 1) : cy.due) : null;
  const dl = cy && !cy.done ? dueLabel(cy.due) : null;
  const st = !cy ? '' : cy.done ? pill('Pagado ✓', 'in') : cy.missed ? pill('Cuota atrasada', 'out') : cy.paid ? pill('Cuota de este mes pagada ✓', 'in') : pill(`Cuota ${dl.t.toLowerCase()}`, dl.k || '');
  return `<div class="card"><div class="row tap" style="border:0;padding-top:0" onclick="openAccForm('${a.id}')" title="Editar préstamo">${circ(a.name, loanIcon(a.loanKind))}<div><b>${esc(a.name)}</b><small>${esc(a.lender || a.loanKind || 'Préstamo')}${+a.rate ? ' · ' + (+a.rate) + '% anual' : ''}</small></div><b class="num out">${money(owed, a.currency)}</b></div>
${bar(pct, 'var(--in)')}<div style="display:flex;justify-content:space-between;margin-top:4px"><small class="mut">Pagado ${pct}% de ${money(orig, a.currency)}</small><small class="mut">${a.payment ? 'Cuota ' + money(a.payment, a.currency) : ''}</small></div>
<div class="meta" style="margin-top:8px">${st}${am && !am.never ? pill(`Terminas en ${fdate(am.end, 1)}`) + pill(`Faltan ~${money(am.interest, a.currency)} de interés`) : am && am.never ? pill('La cuota no cubre los intereses', 'out') : ''}</div>
<div class="acts" style="margin-top:10px">${cy && !cy.done ? `<button class="p" onclick="openLoanPay('${a.id}')">Pagar cuota</button>` : ''}<button onclick="openTransferForm(null,'${a.id}','');trform.note='Abono a capital';drawTransferForm()">Abonar</button><button onclick="openSchedule('${a.id}')">Tabla</button></div></div>`;
}
function debtsLoansHTML() {
  const loans = accs.filter(isLoan), cards = accs.filter(a => isCard(a) && acctBalance(a) < -0.004);
  return `${loans.length ? loans.map(loanCardHTML).join('') : `<div class="card"><p class="empty" style="margin:0">Aún no tienes préstamos. Agrega tu hipoteca, préstamo del carro o personal para ver tu tabla de pagos y cuándo terminas.</p></div>`}
<button class="p" style="width:100%;margin-bottom:12px" onclick="openAccForm(null,{type:'Préstamo'})"><i class="icon-plus"></i> Agregar préstamo</button>
${cards.length ? `<div class="card"><h2><i class="icon-credit-card"></i> Tarjetas con saldo</h2>${cards.map(a => { const cy = cardCycle(a); return `<div class="row tap" onclick="openAccForm('${a.id}')">${circ(a.name, 'credit-card')}<div><b>${esc(a.name)}</b><small>${+a.rate ? a.rate + '% anual' : 'Sin tasa: agrégala para el plan'}${cy && cy.left > 0 ? ' · pagar ' + money(cy.left, a.currency) + ' antes del ' + fdate(cy.pay) : ''}</small></div><b class="num out">${money(-acctBalance(a), a.currency)}</b></div>`; }).join('')}</div>` : ''}
<button style="width:100%" onclick="openCalc()"><i class="icon-calculator"></i> Calculadora de préstamos</button>`;
}
// ---- pagar cuota: separa interés (gasto) y capital (baja la deuda) ----
let lpf = {};
function openLoanPay(id) {
  const a = accs.find(x => x.id == id); if (!a) return;
  const cy = loanCycle(a), owed = loanOwed(a), it = round2(owed * (+a.rate || 0) / 1200), pay = cy ? cy.payment : (+a.payment || 0);
  const from = (accs.find(x => x.id == lastUsed().accId && !isDebtAcc(x) && x.currency == a.currency) || accs.find(x => !isDebtAcc(x) && x.currency == a.currency) || {}).id;
  if (!from) return fail(`Necesitas una cuenta en ${a.currency} (que no sea tarjeta) para pagar.`);
  lpf = { id, from, d: today(), pay: pay || '', it: Math.min(it, pay || it), extra: '' };
  drawLoanPay();
}
function drawLoanPay() {
  const f = lpf, a = accs.find(x => x.id == f.id), cap = round2((+f.pay || 0) - (+f.it || 0)) + (+f.extra || 0);
  dlg.innerHTML = `<form onsubmit="return svLoanPay(event)"><h2>Pagar cuota — ${esc(a.name)}</h2>
<p class="note">Debes ${money(loanOwed(a), a.currency)}. De la cuota, el <b>interés</b> se anota como gasto (categoría Intereses) y el <b>capital</b> baja la deuda.</p>
<label>Desde la cuenta<select onchange="lpf.from=this.value">${accs.filter(x => !isDebtAcc(x) && x.currency == a.currency).map(x => accOpt(x, f.from, f.d)).join('')}</select></label>
<div class="two"><label>Cuota pagada<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.pay)}" oninput="lpf.pay=this.value" onchange="drawLoanPay()"></label>
<label>De eso, interés<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(f.it)}" oninput="lpf.it=this.value" onchange="drawLoanPay()"></label></div>
<label>Abono extra a capital (opcional)<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(f.extra)}" oninput="lpf.extra=this.value" onchange="drawLoanPay()"></label>
<p class="mini" style="margin:0">Capital que baja la deuda: <b>${money(Math.max(0, cap), a.currency)}</b>. Si tu banco te dio otros montos, cámbialos aquí.</p>
<label>Fecha<input type="date" required value="${esc(f.d)}" onchange="lpf.d=this.value"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Pagar</button></div></form>`;
  dlgShow();
}
async function svLoanPay(e) {
  e.preventDefault(); const f = lpf, a = accs.find(x => x.id == f.id), src = accs.find(x => x.id == f.from);
  const pay = parseFloat(f.pay), it = parseFloat(f.it) || 0, extra = parseFloat(f.extra) || 0, cap = round2(pay - it + extra);
  if (!(pay > 0)) return fail('Escribe la cuota.'); if (it < 0 || it > pay) return fail('El interés no puede ser mayor que la cuota.');
  if (!src) return fail('Elige la cuenta.');
  for (const x of [src, a]) if (beforeOpen(x, f.d)) return false;
  if (!(await enoughOrAsk(src, pay + extra, f.d))) return false;
  ensureCat('Intereses', 'e', 'percent');
  const grp = uid();
  if (cap > 0) saveTx({ t: 'tr', d: f.d, accId: src.id, accIdTo: a.id, a: cap, aTo: cap, n: (extra ? 'Cuota + abono: ' : 'Cuota: ') + a.name, grp, loanPay: true }, { noRender: true });
  if (it > 0) { const r = a.currency == 'DOP' ? 1 : rateOf(a.currency, f.d) || 1; saveTx({ t: 'e', d: f.d, c: 'Intereses', sub: a.name, w: defaultWho(), accId: src.id, a: it, cu: a.currency, r, v: round2(it * r), aa: it, n: 'Interés de la cuota', grp }, { noRender: true }); }
  rememberLast({ accId: src.id }); dlg.close(); render(); toast('Cuota pagada', { kind: 'ok' }); return false;
}
function ensureCat(n, t, icon) { if (cfg.cats.some(c => c.n == n && c.t == t)) return; const c = deep(cfg); c.cats.push({ n, t, icon }); saveCfg(c, true); }
function openSchedule(id) {
  const a = accs.find(x => x.id == id); if (!a) return;
  const cy = loanCycle(a), owed = loanOwed(a);
  if (!a.payment || !cy || cy.done) { dlg.innerHTML = `<h2>Tabla de pagos</h2><p class="mut">${cy && cy.done ? 'Este préstamo ya está pagado. 🎉' : 'Falta la cuota o el día de pago del préstamo. Edítalo para agregarlos.'}</p><div class="seg"><button onclick="dlg.close()">Cerrar</button></div>`; return dlgShow(); }
  const t = amortize(owed, +a.rate || 0, +a.payment, cy.paid ? addMonthsISO(cy.due, 1) : cy.due);
  dlg.innerHTML = `<h2 tabindex="-1" autofocus>Tabla de pagos — ${esc(a.name)}</h2>
${t.never ? '<p class="warnline">La cuota no alcanza ni para el interés: la deuda nunca bajaría. Revisa la cuota o la tasa.</p>' : `<p class="note">Desde lo que debes hoy (${money(owed, a.currency)}): ${t.months} cuotas más, terminas el <b>${fdate(t.end, 1)}</b> y pagas <b>${money(t.interest, a.currency)}</b> de interés.</p>
<small class="mut">Montos en ${a.currency == 'DOP' ? 'RD$' : a.currency}, redondeados.</small>
<div class="tbl" tabindex="-1"><div class="th"><span>#</span><span>Mes</span><span>Interés</span><span>Capital</span><span>Queda</span></div>${t.rows.map(r => `<div><span>${r.n}</span><span>${mesCorto(r.d)}</span><span>${num0(r.it)}</span><span>${num0(r.cap)}</span><span>${num0(r.b)}</span></div>`).join('')}</div>`}
<div class="seg"><button onclick="dlg.close()">Cerrar</button></div>`;
  dlgShow();
}
// ---- deudas con personas (yo debo / me deben) ----
function debtRowHTML(d) {
  const left = debtLeft(d), paid = debtPaid(d), pct = d.amount > 0 ? Math.round(paid / d.amount * 100) : 0, dl = d.due && d.status == 'open' ? dueLabel(d.due) : null;
  const tag = d.status == 'forgiven' ? pill('Perdonada') : d.status == 'closed' ? pill('Saldada ✓', 'in') : dl ? pill(dl.t, dl.k) : '';
  return `<div class="trow"><div class="row tap" onclick="openDebt('${d.id}')" style="border:0">${circ(d.who, 'user')}<div><b>${esc(d.who)}</b><small>${fdate(d.date)}${d.note ? ' · ' + esc(d.note) : ''} ${tag}</small></div><b class="num ${d.dir == 'owe' ? 'out' : 'in'}">${money(left, d.cu)}</b></div>
${d.status == 'open' ? `<div style="padding-left:54px">${bar(pct, d.dir == 'owe' ? 'var(--out)' : 'var(--in)')}<small class="mut">${pct}% de ${money(d.amount, d.cu)}</small></div>
<div class="tact"><span></span><div style="display:flex;gap:6px"><button onclick="openDebtPay('${d.id}')">${d.dir == 'owe' ? 'Pagar' : 'Cobrar'}</button></div></div>` : ''}</div>`;
}
function debtsPeopleHTML() {
  const sec = (dir, title, hint) => {
    const open = debts.filter(d => d.dir == dir && d.status == 'open').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    const done = debts.filter(d => d.dir == dir && d.status != 'open');
    return `<div class="card"><h2><i class="icon-${dir == 'owe' ? 'arrow-up' : 'arrow-down'}"></i> ${title}</h2>${open.length ? open.map(debtRowHTML).join('') : `<p class="mini" style="margin:0 0 6px">${hint}</p>`}
${done.length ? `<details style="margin-top:6px"><summary>Cerradas (${done.length}) ›</summary>${done.map(debtRowHTML).join('')}</details>` : ''}
<button class="link" onclick="openDebt(null,'${dir}')"><i class="icon-plus"></i> ${dir == 'owe' ? 'Anotar lo que debo' : 'Anotar lo que me deben'}</button></div>`;
  };
  return sec('owe', 'Yo debo', 'Dinero que te prestaron una persona, familiar, amigo o un negocio (fuera de tus préstamos de banco).')
    + sec('owed', 'Me deben', 'Dinero que prestaste y te tienen que devolver.')
    + '<p class="note">Los gastos compartidos del hogar siguen en <b>Más → Cuentas claras</b>.</p>';
}
let dbf = {};
function openDebt(id, dir) {
  const x = debts.find(d => d.id == id) || {}, open = id && txs.find(t => t.t == 'dm' && t.debtId == id && t.kind == 'open');
  dbf = { id: x.id, dir: x.dir || dir || 'owe', who: x.who || '', amount: x.amount || '', cu: x.cu || 'DOP', date: x.date || today(), due: x.due || '', note: x.note || '', accId: open ? open.accId : '', status: x.status || 'open', openTx: open ? open.id : null };
  drawDebt();
}
function drawDebt() {
  const f = dbf, cu = [...new Set(['DOP', f.cu, ...cfg.cur])], names = [...new Set([...cfg.people, ...debts.map(d => d.who)].filter(Boolean))];
  const accOk = accs.filter(a => !isDebtAcc(a) && a.currency == f.cu);
  dlg.innerHTML = `<form onsubmit="return svDebt(event)"><h2>${f.id ? 'Editar deuda' : 'Nueva deuda'}</h2>
<div class="seg"><button type="button" class="e${f.dir == 'owe' ? ' on' : ''}" onclick="dbf.dir='owe';drawDebt()">Yo debo</button><button type="button" class="i${f.dir == 'owed' ? ' on' : ''}" onclick="dbf.dir='owed';drawDebt()">Me deben</button></div>
<label>${f.dir == 'owe' ? '¿A quién le debes?' : '¿Quién te debe?'}<input required list="dl-who" value="${esc(f.who)}" oninput="dbf.who=this.value" placeholder="Persona, familiar, negocio…"><datalist id="dl-who">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
<div class="amount"><input type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="0.00" aria-label="Monto" value="${esc(f.amount)}" oninput="dbf.amount=this.value"><select aria-label="Moneda" onchange="dbf.cu=this.value;dbf.accId='';drawDebt()">${opts(cu, f.cu)}</select></div>
<div class="two"><label>Fecha<input type="date" required value="${esc(f.date)}" onchange="dbf.date=this.value"></label><label>Fecha límite (opcional)<input type="date" value="${esc(f.due)}" onchange="dbf.due=this.value"></label></div>
<label>${f.dir == 'owe' ? '¿El dinero entró a una cuenta?' : '¿El dinero salió de una cuenta?'}<select onchange="dbf.accId=this.value"><option value="">No / fue antes de usar la app</option>${accOk.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
<p class="mini" style="margin:0">Si eliges una cuenta, su saldo ${f.dir == 'owe' ? 'sube' : 'baja'} por este monto. No cuenta como ingreso ni gasto.</p>
<input value="${esc(f.note)}" oninput="dbf.note=this.value" placeholder="¿Para qué? (opcional)" aria-label="Nota">
${f.id ? `<div class="seg sm">${f.status == 'open' ? `<button type="button" onclick="closeDebt('${f.id}','closed')">Marcar saldada</button>${f.dir == 'owed' ? `<button type="button" onclick="closeDebt('${f.id}','forgiven')">Perdonar</button>` : ''}` : `<button type="button" onclick="closeDebt('${f.id}','open')">Reabrir</button>`}</div>` : ''}
${footer(f.id, `delDebt('${f.id}')`)}</form>`;
  dlgShow();
}
function svDebt(e) {
  e.preventDefault(); const f = dbf, amt = parseFloat(f.amount);
  if (!f.who.trim()) return fail('Escribe con quién es la deuda.'); if (!(amt > 0)) return fail('Escribe el monto.');
  const ac = accs.find(a => a.id == f.accId); if (ac && beforeOpen(ac, f.date)) return false;
  const prev = debts.find(d => d.id == f.id) || {}, id = f.id || uid();
  const obj = { ...prev, id, dir: f.dir, who: f.who.trim(), amount: amt, cu: f.cu, date: f.date, due: f.due || '', note: f.note.trim(), status: prev.status || 'open', u: now() };
  debts = debts.filter(d => d.id != id).concat(obj); local(); cloudPut('debt', obj);
  // movimiento de apertura (si el dinero pasó por una cuenta)
  if (ac) saveTx({ id: f.openTx || undefined, t: 'dm', kind: 'open', debtId: id, d: f.date, accId: ac.id, a: f.dir == 'owe' ? amt : -amt, v: toDOP(amt, f.cu, f.date), cu: f.cu, r: 1, n: (f.dir == 'owe' ? 'Préstamo de ' : 'Préstamo a ') + obj.who }, { noRender: true });
  else if (f.openTx) { const t = txs.find(x => x.id == f.openTx); if (t) { txs = txs.filter(x => x.id != t.id); const n2 = now(); dels[t.id] = n2; trash = trash.concat({ ...t, del: n2 }); cloudDel('tx', t, n2); local(); } }
  dlg.close(); render(); toast('Deuda guardada', { kind: 'ok' }); return false;
}
function closeDebt(id, status) {
  const d = debts.find(x => x.id == id); if (!d) return;
  const obj = { ...d, status, closedAt: status == 'open' ? '' : today(), u: now() };
  debts = debts.map(x => x.id == id ? obj : x); local(); cloudPut('debt', obj); dlg.close(); render();
  toast(status == 'open' ? 'Deuda reabierta' : status == 'forgiven' ? 'Deuda perdonada' : 'Deuda saldada', { kind: 'ok' });
}
async function delDebt(id) {
  if (!(await ask('Los pagos ya anotados se quedan en el historial (y en el saldo de sus cuentas).', { title: '¿Borrar esta deuda?', ok: 'Borrar', danger: true }))) return;
  removeItem('debt', id); dlg.close(); render(); toast('Deuda borrada');
}
let dpf = {};
function openDebtPay(id) {
  const d = debts.find(x => x.id == id); if (!d) return;
  dpf = { id, a: debtLeft(d), d: today(), accId: (accs.find(a => !isDebtAcc(a) && a.currency == d.cu) || {}).id || '', n: '' };
  drawDebtPay();
}
function drawDebtPay() {
  const f = dpf, d = debts.find(x => x.id == f.id), owe = d.dir == 'owe';
  dlg.innerHTML = `<form onsubmit="return svDebtPay(event)"><h2>${owe ? 'Pagar a ' : 'Cobrar a '}${esc(d.who)}</h2>
<p class="note">Falta ${money(debtLeft(d), d.cu)} de ${money(d.amount, d.cu)}.</p>
<div class="amount"><input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.a)}" oninput="dpf.a=this.value" aria-label="Monto"><select disabled><option>${d.cu}</option></select></div>
<label>${owe ? 'Sale de la cuenta' : 'Entra a la cuenta'}<select onchange="dpf.accId=this.value"><option value="">Ninguna (fue en efectivo fuera de la app)</option>${accs.filter(a => !isDebtAcc(a) && a.currency == d.cu).map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
<label>Fecha<input type="date" required value="${esc(f.d)}" onchange="dpf.d=this.value"></label>
<input value="${esc(f.n)}" oninput="dpf.n=this.value" placeholder="Nota (opcional)" aria-label="Nota">
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">${owe ? 'Pagar' : 'Cobrar'}</button></div></form>`;
  dlgShow();
}
async function svDebtPay(e) {
  e.preventDefault(); const f = dpf, d = debts.find(x => x.id == f.id), amt = parseFloat(f.a), owe = d.dir == 'owe';
  if (!(amt > 0)) return fail('Escribe el monto.');
  const left = debtLeft(d); if (amt > left + 0.005 && !(await ask(`Es más de lo que falta (${money(left, d.cu)}).`, { title: '¿Anotar igual?', ok: 'Anotar' }))) return false;
  const ac = accs.find(a => a.id == f.accId); if (ac && beforeOpen(ac, f.d)) return false;
  if (ac && owe && !(await enoughOrAsk(ac, amt, f.d))) return false;
  saveTx({ t: 'dm', kind: 'pay', debtId: d.id, d: f.d, accId: ac ? ac.id : null, a: ac ? (owe ? -amt : amt) : 0, v: toDOP(amt, d.cu, f.d), cu: d.cu, r: 1, n: (owe ? 'Pago a ' : 'Cobro a ') + d.who + (f.n ? ' · ' + f.n.trim() : '') }, { noRender: true });
  if (debtLeft(d) <= 0.004) closeDebt(d.id, 'closed'); else { dlg.close(); render(); }
  toast(owe ? 'Pago anotado' : 'Cobro anotado', { kind: 'ok' }); return false;
}
// ---- bienes ----
function debtsAssetsHTML() {
  const rows = assets.map(a => {
    const loan = accs.find(x => x.id == a.loanId), owed = loan ? toDOP(loanOwed(loan), loan.currency) : 0, val = toDOP(a.value, a.cu), mine = Math.max(0, val - owed);
    return `<div class="card"><div class="row tap" style="border:0;padding-top:0" onclick="openAsset('${a.id}')">${circ(a.name, assetIcon(a.kind))}<div><b>${esc(a.name)}</b><small>${esc(a.kind || '')} · valor al ${fdate(a.date || today(), 1)}</small></div><b class="num">${money(a.value, a.cu)}</b></div>
${loan ? `${bar(val > 0 ? mine / val * 100 : 0, 'var(--in)')}<small class="mut">Tuyo: ${money(mine)} · debes ${money(owed)} de “${esc(loan.name)}”</small>` : ''}</div>`;
  }).join('');
  return `${rows || `<div class="card"><p class="empty" style="margin:0">Agrega tu casa, vehículo, terreno u otros bienes con su valor aproximado: así tu patrimonio neto refleja lo que de verdad tienes.</p></div>`}
<button class="p" style="width:100%" onclick="openAsset()"><i class="icon-plus"></i> Agregar bien</button>`;
}
let asf = {};
function openAsset(id) { const x = assets.find(a => a.id == id) || {}; asf = { id: x.id, name: x.name || '', kind: x.kind || 'Casa', value: x.value ?? '', cu: x.cu || 'DOP', date: today(), loanId: x.loanId || '', note: x.note || '' }; drawAsset(); }
function drawAsset() {
  const f = asf, cu = [...new Set(['DOP', f.cu, ...cfg.cur])], a0 = assets.find(a => a.id == f.id);
  dlg.innerHTML = `<form onsubmit="return svAsset(event)"><h2>${f.id ? 'Editar bien' : 'Nuevo bien'}</h2>
<label>Nombre<input required value="${esc(f.name)}" oninput="asf.name=this.value" placeholder="Ej: Casa de Santiago, Corolla 2021"></label>
<div class="two"><label>Tipo<select onchange="asf.kind=this.value">${opts(ASSET_KINDS.map(k => k[0]), f.kind)}</select></label><label>Moneda<select onchange="asf.cu=this.value">${opts(cu, f.cu)}</select></label></div>
<div class="two"><label>Valor aproximado hoy<input type="number" inputmode="decimal" step="0.01" min="0" required value="${esc(f.value)}" oninput="asf.value=this.value"></label><label>Fecha de ese valor<input type="date" required value="${esc(f.date)}" onchange="asf.date=this.value"></label></div>
<label>Préstamo con el que lo pagas (opcional)<select onchange="asf.loanId=this.value"><option value="">Ninguno</option>${accs.filter(isLoan).map(a => `<option value="${a.id}"${f.loanId == a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
<input value="${esc(f.note)}" oninput="asf.note=this.value" placeholder="Nota (opcional)" aria-label="Nota">
${a0 && (a0.hist || []).length > 1 ? `<small class="mut">Valores anteriores: ${a0.hist.slice(-4).map(h => fdate(h.d, 1) + ' ' + money(h.v, a0.cu)).join(' · ')}</small>` : ''}
${footer(f.id, `delAsset('${f.id}')`)}</form>`;
  dlgShow();
}
function svAsset(e) {
  e.preventDefault(); const f = asf, v = parseFloat(f.value); if (!f.name.trim()) return fail('Ponle un nombre.'); if (!(v >= 0)) return fail('Escribe el valor.');
  const prev = assets.find(a => a.id == f.id) || {}, id = f.id || uid();
  const hist = (prev.hist || []).filter(h => h.d != f.date).concat({ d: f.date, v }).sort((a, b) => a.d.localeCompare(b.d));
  const latest = hist[hist.length - 1];
  const obj = { ...prev, id, name: f.name.trim(), kind: f.kind, cu: f.cu, loanId: f.loanId || '', note: f.note.trim(), value: latest.v, date: latest.d, hist, u: now() };
  assets = assets.filter(a => a.id != id).concat(obj); local(); cloudPut('asset', obj); dlg.close(); render(); toast('Bien guardado', { kind: 'ok' }); return false;
}
async function delAsset(id) { if (!(await ask('Se quitará de tu patrimonio. Puedes recuperarlo en la Papelera.', { title: '¿Borrar este bien?', ok: 'Borrar', danger: true }))) return; removeItem('asset', id); dlg.close(); render(); toast('Bien borrado'); }

// ============ plan para salir de deudas ============
function payoffDebts() {
  const L = [];
  accs.filter(isLoan).forEach(a => { const b = loanOwed(a); if (b > 0.004) L.push({ id: a.id, name: a.name, b: toDOP(b, a.currency), rate: +a.rate || 0, min: toDOP(+a.payment || pmt(b, +a.rate || 0, +a.term || 12), a.currency), icon: loanIcon(a.loanKind) }); });
  accs.filter(isCard).forEach(a => { const b = Math.max(0, -acctBalance(a)); if (b > 0.004) L.push({ id: a.id, name: a.name, b: toDOP(b, a.currency), rate: +a.rate || 0, min: toDOP(+a.minPay || Math.max(500, round2(b * 0.05)), a.currency), icon: 'credit-card', noRate: !(+a.rate) }); });
  debts.filter(d => d.dir == 'owe' && d.status == 'open').forEach(d => { const b = debtLeft(d); if (b > 0.004) L.push({ id: d.id, name: d.who, b: toDOP(b, d.cu), rate: 0, min: 0, icon: 'user' }); });
  return L;
}
// Simula mes a mes: todos pagan su mínimo y lo que sobra (extra + mínimos de las ya pagadas) va a la deuda elegida
function simulatePayoff(list, extra, strat) {
  const D = list.map(x => ({ ...x })), budget = D.reduce((s, x) => s + x.min, 0) + (+extra || 0), order = [];
  let month = 0, interest = 0;
  if (!(budget > 0)) return { months: Infinity, interest: Infinity, order: [] };
  while (D.some(x => x.b > 0.004) && month < 600) {
    month++; let money2 = budget;
    D.forEach(x => { if (x.b > 0.004) { const it = x.b * x.rate / 1200; x.b += it; interest += it; } });
    D.forEach(x => { if (x.b > 0.004) { const p = Math.min(x.min, x.b, money2); x.b -= p; money2 -= p; } });
    const live = D.filter(x => x.b > 0.004).sort(strat == 'snowball' ? (a, b) => a.b - b.b : (a, b) => b.rate - a.rate || a.b - b.b);
    for (const x of live) { if (money2 <= 0) break; const p = Math.min(x.b, money2); x.b -= p; money2 -= p; }
    D.forEach(x => { if (x.b <= 0.004 && !x.doneAt) { x.doneAt = month; order.push({ name: x.name, month, icon: x.icon }); } });
    if (month > 1 && interest > 1e12) break;
  }
  return { months: D.some(x => x.b > 0.004) ? Infinity : month, interest: round2(interest), order };
}
function debtsPlanHTML() {
  const L = payoffDebts();
  if (!L.length) return `<div class="card"><h2><i class="icon-flag"></i> Plan para salir de deudas</h2><p class="mut" style="margin:0">¡No tienes deudas anotadas! 🎉</p></div><button style="width:100%" onclick="openCalc()"><i class="icon-calculator"></i> Calculadora de préstamos</button>`;
  const ex = +planExtra || 0, base = simulatePayoff(L, 0, planStrat), sb = simulatePayoff(L, ex, 'snowball'), av = simulatePayoff(L, ex, 'avalanche');
  const end = m => (m == Infinity ? 'nunca (los pagos no cubren los intereses)' : fdate(addMonthsISO(today(), m), 1) + ` (${m} ${m == 1 ? 'mes' : 'meses'})`);
  const pick = planStrat == 'snowball' ? sb : av, best = av.interest <= sb.interest ? 'avalanche' : 'snowball';
  return `<div class="card"><h2><i class="icon-flag"></i> Plan para salir de deudas</h2>
<p class="mini" style="margin:0 0 8px">Cada mes pagas el mínimo de todas; lo que pongas de más (y lo que se libera al terminar una) va a la deuda que toca según la estrategia.</p>
<label>¿Cuánto más puedes poner al mes? (DOP)<input type="number" inputmode="decimal" step="100" min="0" value="${esc(planExtra)}" onchange="planExtra=this.value;render()" placeholder="Ej: 3000"></label>
<div class="seg sm" style="margin:10px 0"><button type="button" class="${planStrat == 'avalanche' ? 'on' : ''}" onclick="planStrat='avalanche';render()"><i class="icon-mountain"></i> Avalancha</button><button type="button" class="${planStrat == 'snowball' ? 'on' : ''}" onclick="planStrat='snowball';render()"><i class="icon-snowflake"></i> Bola de nieve</button></div>
<p class="mini" style="margin:0 0 8px">${planStrat == 'avalanche' ? '<b>Avalancha:</b> primero la de mayor interés. Es la que menos interés paga.' : '<b>Bola de nieve:</b> primero la más pequeña. Ves resultados más rápido y motiva.'}</p>
<div class="facts"><div><span>Libre de deudas</span><b>${pick.months == Infinity ? '—' : fdate(addMonthsISO(today(), pick.months), 1) + ` <small>(${pick.months} meses)</small>`}</b></div>
<div><span>Interés que pagarás</span><b class="out">${pick.interest == Infinity ? '—' : money0(pick.interest)}</b></div>
<div><span>Te ahorras vs. solo mínimos</span><b class="in">${base.interest == Infinity || pick.interest == Infinity ? '—' : money0(Math.max(0, base.interest - pick.interest))}${base.months == Infinity || pick.months == Infinity ? '' : ` <small>· ${Math.max(0, base.months - pick.months)} meses antes</small>`}</b></div></div>
${ex && sb.interest != av.interest ? `<p class="mini">Con estos números conviene <b>${best == 'avalanche' ? 'Avalancha' : 'Bola de nieve'}</b>: ${money(Math.abs(sb.interest - av.interest))} menos de interés.</p>` : ''}
<h3 class="calh">Orden en que se pagan</h3>${pick.order.map((o, i) => `<div class="row">${circ(o.name, o.icon)}<div><b>${i + 1}. ${esc(o.name)}</b><small>Pagada en ${end(o.month)}</small></div></div>`).join('') || '<p class="mini">No se alcanza a pagar con estos montos.</p>'}
${L.some(x => x.noRate) ? '<p class="warnline">Hay tarjetas sin tasa de interés: edítalas para que el cálculo sea correcto.</p>' : ''}
<p class="mini" style="margin:6px 0 0">Solo mínimos: ${end(base.months)}. Las deudas con personas cuentan sin interés.</p></div>
<button style="width:100%" onclick="openCalc()"><i class="icon-calculator"></i> Calculadora de préstamos</button>`;
}

// ============ calculadora de préstamos ============
let calc = { P: '', rate: '', n: '', extra: '' };
function openCalc() { drawCalc(); }
function drawCalc() {
  const f = calc, P = +f.P, n = +f.n, r = +f.rate || 0, pay = P > 0 && n > 0 ? pmt(P, r, n) : 0;
  const base = pay ? amortize(P, r, pay, today()) : null, ext = pay && +f.extra > 0 ? amortize(P, r, pay, today(), +f.extra) : null;
  dlg.innerHTML = `<form onsubmit="return false"><h2><i class="icon-calculator"></i> Calculadora de préstamos</h2>
<div class="two"><label>Monto<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(f.P)}" oninput="calc.P=this.value" onchange="drawCalc()" placeholder="Ej: 1500000"></label><label>Tasa anual (%)<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(f.rate)}" oninput="calc.rate=this.value" onchange="drawCalc()" placeholder="Ej: 11.5"></label></div>
<div class="two"><label>Plazo (meses)<input type="number" inputmode="numeric" step="1" min="1" value="${esc(f.n)}" oninput="calc.n=this.value" onchange="drawCalc()" placeholder="Ej: 240 = 20 años"></label><label>Abono extra al mes<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(f.extra)}" oninput="calc.extra=this.value" onchange="drawCalc()" placeholder="Opcional"></label></div>
${pay ? `<div class="kp"><div><small>Cuota mensual</small><b>${money(pay)}</b></div><div><small>Interés total</small><b class="out">${money(base.interest)}</b></div><div><small>Pagas en total</small><b>${money(P + base.interest)}</b></div></div>
${ext ? `<p class="note">Con <b>${money(+f.extra)}</b> extra al mes terminas <b>${base.months - ext.months} meses antes</b> y te ahorras <b>${money(base.interest - ext.interest)}</b> de interés.</p>` : ''}` : '<p class="mini">Escribe el monto, la tasa y el plazo.</p>'}
<div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button><button type="button" class="p" onclick="drawCalc()">Calcular</button></div></form>`;
  dlgShow();
}

// ============ avisos y fechas para otras pantallas ============
function debtAlerts() {
  const out = [], td = today();
  accs.filter(isLoan).forEach(a => {
    const cy = loanCycle(a); if (!cy || cy.done || cy.paid || (!cy.missed && cy.days > 10)) return; const dl = dueLabel(cy.due);
    out.push(AL(`loan:${a.id}:${cy.due}`, 'loan:' + a.id, `Cuota de ${a.name}`, 'Cuota de ' + a.name, loanIcon(a.loanKind), 'Vuelve a salir con la próxima cuota.',
      alRow(`${circ(a.name, loanIcon(a.loanKind))}<div><b>Cuota de ${esc(a.name)}</b><small>${money(cy.payment, a.currency)} · ${fdate(cy.due)} ${pill(cy.missed ? 'Atrasada' : dl.t, cy.missed ? 'out' : dl.k || '')}</small></div><button onclick="openLoanPay('${a.id}')">Pagar</button>`)));
  });
  debts.filter(d => d.status == 'open' && d.due && daysBetween(td, d.due) <= 7).forEach(d => {
    const dl = dueLabel(d.due);
    const tt = (d.dir == 'owe' ? 'Pagarle a ' : 'Cobrarle a ') + d.who;
    out.push(AL(`debt:${d.id}:${d.due}`, 'debt:' + d.id, tt, tt, 'user', 'Vuelve a salir si cambias la fecha.',
      alRow(`${circ(d.who, 'user')}<div><b>${esc(tt)}</b><small>${money(debtLeft(d), d.cu)} · ${fdate(d.due)} ${pill(dl.t, dl.k)}</small></div><button onclick="openDebtPay('${d.id}')">${d.dir == 'owe' ? 'Pagar' : 'Cobrar'}</button>`)));
  });
  return out; // avisos de Inicio (ver homeAlerts)
}
// Fechas de cuotas de préstamos entre dos fechas (para proyección, calendario y te alcanza)
function loanDues(from, to) {
  const out = [];
  accs.filter(isLoan).forEach(a => {
    const cy = loanCycle(a); if (!cy || cy.done || !(a.payDay >= 1)) return;
    let d = cy.paid ? addMonthsISO(cy.due, 1) : cy.due, owed = cy.owed;
    for (let k = 0; k < 40 && d <= to && owed > 0.004; k++) {
      const it = round2(owed * (+a.rate || 0) / 1200), pay = Math.min(cy.payment, round2(owed + it));
      if (d >= from) out.push({ acc: a, d, pay, cap: round2(pay - it), late: d < today() });
      owed = round2(owed - (pay - it)); d = addMonthsISO(d, 1);
    }
  });
  return out;
}
