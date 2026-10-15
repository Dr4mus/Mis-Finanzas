'use strict';
/* Mis finanzas — acciones (guardar/borrar), pantallas y formularios. */
const dlg = document.getElementById('dlg');
const $ = id => document.getElementById(id);
const deep = o => JSON.parse(JSON.stringify(o));

// ============ acciones: cada una guarda local + nube ============
function saveCfg(c) { cfg = c; cfgT = now(); local(); cloudCfg(); render(); }
function saveTx(t) {
  const id = t.id || uid(), { id: _, del: __, ...o } = t, prev = txs.find(x => x.id == id) || trash.find(x => x.id == id) || {};
  const obj = { id, ...o, cr: o.cr || prev.cr || now(), u: now() };
  trash = trash.filter(x => x.id != id); txs = txs.filter(x => x.id != id).concat(obj); delete dels[id];
  local(); cloudPut('tx', obj); render();
}
function delTx(id) {
  const x = txs.find(t => t.id == id);
  if (!confirm('¿Borrar este movimiento? Quedará tachado en el historial y podrás restaurarlo.')) return;
  const n = now(); txs = txs.filter(t => t.id != id); dels[id] = n;
  if (x) { trash = trash.filter(t => t.id != id).concat({ ...x, del: n }); cloudDel('tx', x, n); }
  local(); render();
}
function restoreTx(id) { const x = trash.find(t => t.id == id); if (x) saveTx(x); }
function saveAcc(a) {
  const id = a.id || uid(), { id: _, ...o } = a, prev = accs.find(x => x.id == id) || {};
  const obj = { ...prev, id, ...o, u: now() };
  accs = accs.filter(x => x.id != id).concat(obj); local(); cloudPut('acc', obj); render();
}
function delAcc(id) {
  if (goals.some(g => g.accId == id)) return alert('Esta cuenta tiene metas atadas (' + goals.filter(g => g.accId == id).map(g => g.name).join(', ') + '). Cambia o borra esas metas primero.');
  const n = txs.filter(x => x.accId == id || x.accIdTo == id).length;
  if (!confirm(n ? `Esta cuenta tiene ${n} movimientos. Se conservarán en el historial. ¿Borrar la cuenta?` : '¿Borrar esta cuenta?')) return;
  const a = accs.find(x => x.id == id), ts = now();
  accs = accs.filter(x => x.id != id); dels[id] = ts; local(); if (a) cloudDel('acc', a, ts); render();
}
function saveAdj(a) {
  const id = a.id || uid(), { id: _, ...o } = a, obj = { id, ...o, createdAt: now(), u: now() };
  adjs = adjs.filter(x => x.id != id).concat(obj); local(); cloudPut('adj', obj); render();
}
function saveRec(r) {
  const id = r.id || uid(), { id: _, ...o } = r, prev = recs.find(x => x.id == id) || {};
  const obj = { ...prev, id, ...o, u: now() };
  recs = recs.filter(x => x.id != id).concat(obj); local(); cloudPut('rec', obj); render();
}
function saveGoal(g) {
  const id = g.id || uid(), { id: _, ...o } = g, prev = goals.find(x => x.id == id) || {};
  const obj = { ...prev, id, ...o, u: now() };
  goals = goals.filter(x => x.id != id).concat(obj); local(); cloudPut('goal', obj); render();
}
function removeItem(kind, id) {
  const key = { acc: 'accs', adj: 'adjs', rec: 'recs', goal: 'goals' }[kind];
  const list = { accs, adjs, recs, goals }[key], it = list.find(x => x.id == id), ts = now();
  const rest = list.filter(x => x.id != id);
  if (key == 'adjs') adjs = rest; else if (key == 'recs') recs = rest; else if (key == 'goals') goals = rest; else accs = rest;
  dels[id] = ts; local(); if (it) cloudDel(kind, it, ts);
}
function resetAll() {
  const shared = cloudOn();
  if (!confirm(shared ? 'Esto borra TODO en la nube y en todos los dispositivos del hogar: cuentas, movimientos, metas, recurrentes y presupuesto. ¿Ya descargaste un respaldo?' : 'Esto borra TODO en este dispositivo: cuentas, movimientos, metas, recurrentes, presupuesto y categorías personalizadas. ¿Ya descargaste un respaldo?')) return;
  if (!confirm('¿Seguro? No se puede deshacer (salvo importando un respaldo).')) return;
  if (shared) window.Cloud.wipeAll(getAllItems());
  setState({ cfg: fresh(), cfgT: now(), txs: [], accs: [], adjs: [], recs: [], goals: [], dels: {}, trash: [] });
  F = {}; local(); if (shared) cloudCfg(); go('home');
}

// ============ navegación ============
const TABS = ['home', 'hist', 'acc', 'bud', 'rec', 'goal', 'set'];
function go(t) { tab = t; render(); scrollTo(0, 0); }
function pre(k) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), f = (mm, d) => new Date(Date.UTC(y, mm, d)).toISOString().slice(0, 10);
  if (k == 'mes') { F.f = f(m, 1); F.u = f(m + 1, 0); }
  else if (k == 'ant') { F.f = f(m - 1, 1); F.u = f(m, 0); }
  else if (k == 'año') { F.f = f(0, 1); F.u = f(11, 31); }
  else F.f = F.u = '';
  render();
}
const sf = (k, v) => { F[k] = v; render(); };
const opts = (a, s) => a.map(x => `<option value="${esc(x)}"${x == s ? ' selected' : ''}>${esc(x)}</option>`).join('');
const sel = (l, k, a) => `<label>${l}<select onchange="sf('${k}',this.value)"><option value="">Todos</option>${a.map(x => `<option value="${esc(x.v ?? x)}"${F[k] == (x.v ?? x) ? ' selected' : ''}>${esc(x.l ?? x)}</option>`).join('')}</select></label>`;
function fbar(hist) {
  const all = [...new Set(cfg.cats.map(c => c.n))];
  const types = [{ v: 'i', l: 'Ingresos' }, { v: 'e', l: 'Egresos' }].concat(hist ? [{ v: 'tr', l: 'Transferencias' }, { v: 'g', l: 'Metas' }] : []);
  return `<section class="card fb"><div class="chips">${[['mes', 'Este mes'], ['ant', 'Mes pasado'], ['año', 'Este año'], ['todo', 'Todo']].map(([k, l]) => `<button onclick="pre('${k}')">${l}</button>`).join('')}</div>
<label>Desde<input type="date" value="${esc(F.f || '')}" onchange="sf('f',this.value)"></label><label>Hasta<input type="date" value="${esc(F.u || '')}" onchange="sf('u',this.value)"></label>
${sel('Tipo', 't', types)}${sel('Categoría', 'c', all)}${sel('Persona', 'w', cfg.people)}${sel('Cuenta', 'acc', accs.map(a => ({ v: a.id, l: a.name })))}</section>`;
}
function dlgShow() { if (!dlg.open) dlg.showModal(); }

function render() {
  TABS.forEach(t => { const el = $('n-' + t); if (el) el.className = tab == t ? 'on' : ''; });
  const rb = $('rec-badge-holder');
  if (rb) { const n = pendingRecurring().length, old = rb.querySelector('.badge'); if (old) old.remove(); if (n) { const s = document.createElement('span'); s.className = 'badge'; s.textContent = n > 9 ? '9+' : n; rb.appendChild(s); } }
  ch.forEach(c => c.destroy()); ch = [];
  const app = $('app');
  ({ home: renderHome, hist: renderHist, acc: renderAcc, bud: renderBud, rec: renderRec, goal: renderGoal, set: renderSet }[tab] || renderHome)(app);
}

// ============ Inicio ============
function renderHome(app) {
  const a = fl(), asOf = F.u || undefined, td = today(), ym = td.slice(0, 7);
  const monthTx = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), spent = monthTx.reduce((s, x) => s + x.v, 0);
  const inc = txs.filter(x => x.t == 'i' && x.d.slice(0, 7) == ym).reduce((s, x) => s + x.v, 0);
  const b = budgetFor(ym), bst = budgetStatus(spent, b.total);
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), dd = +td.slice(8, 10), pace = Math.round(dd / dim * 100), left = b.total - spent;
  const col = bst ? barCol(bst.level) : 'var(--purple)', pct = bst ? Math.min(100, bst.pct) : 0;
  const pend = pendingRecurring(), soon = [];
  recs.filter(r => r.active !== false).forEach(r => nextDates(r, maxISO(addDay(td), recFrom(r)), addDays(td, 7)).filter(d => !(r.done || []).includes(d)).forEach(d => soon.push({ r, d })));
  soon.sort((x, y) => x.d.localeCompare(y.d));
  const cs = {}; monthTx.forEach(x => cs[x.c] = (cs[x.c] || 0) + x.v);
  const warn = Object.entries(b.cats || {}).filter(([c, l]) => l > 0 && (cs[c] || 0) / l >= 0.8).map(([c, l]) => ({ c, sp: cs[c] || 0, l, p: Math.round((cs[c] || 0) / l * 100) }));
  const tot = totalsByCurrency(asOf), dop = tot.DOP || { disp: 0, deuda: 0, neto: 0 }, others = Object.entries(tot).filter(([c]) => c != 'DOP');
  const nw = others.length ? netWorthApprox(asOf) : null;
  app.innerHTML = `<div class="top"><h1>Inicio</h1>${syncBadge()}</div>
<div class="card" style="text-align:center"><h2 style="text-align:left"><i class="icon-pie-chart"></i> Resumen de este mes</h2>
<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center">
<div style="width:132px;height:132px;border-radius:50%;background:conic-gradient(${col} ${pct}%,var(--bg) 0);display:grid;place-items:center"><div style="width:96px;height:96px;border-radius:50%;background:var(--card);display:grid;place-items:center"><b style="font-size:22px">${bst ? bst.pct + '%' : '—'}</b></div></div>
<div style="text-align:left"><small style="color:var(--mut)">${b.total ? (left >= 0 ? 'Te queda para gastar' : 'Te pasaste por') : 'Gastado este mes'}</small><div style="font-size:26px;font-weight:800;color:${left < 0 && b.total ? 'var(--out)' : 'var(--ink)'}">${money(b.total ? Math.abs(left) : spent)}</div>
<small style="color:var(--mut)">${b.total ? money(spent) + ' de ' + money(b.total) : 'Define un tope en Presupuesto'}</small></div></div>
<div style="margin-top:12px;text-align:left"><small style="color:var(--mut)">Día ${dd} de ${dim} · ${pace}% del mes${bst && bst.pct > pace + 10 ? ' · vas más rápido que el mes' : ''}</small><div style="background:var(--bg);border-radius:99px;height:8px;overflow:hidden;margin-top:4px"><div style="width:${pace}%;height:100%;background:var(--purple)"></div></div></div></div>
<div class="card" style="text-align:center"><small style="color:var(--mut)">Patrimonio neto en pesos (cuentas en DOP − deudas en DOP)${asOf ? ' al ' + esc(asOf) : ''}</small><div style="font-size:30px;font-weight:800">${money(dop.neto)}</div>
${others.map(([c, t]) => `<small class="mini" style="display:block">En ${c}: ${money(t.neto, c)}${t.deuda ? ' (deuda ' + money(t.deuda, c) + ')' : ''}</small>`).join('')}
${nw ? `<small class="mini" style="display:block;margin-top:4px">Todo convertido a pesos ≈ <b>${money(nw.total)}</b>${nw.missing.length ? ' · sin tasa para ' + nw.missing.join(', ') : ' · con la tasa de tu último movimiento en esa moneda'}</small>` : ''}</div>
<div class="kp"><div><small>Disponible en DOP${asOf ? ' al ' + esc(asOf) : ''}</small><b>${money(dop.disp)}</b></div><div><small>Deuda en tarjetas (DOP)</small><b class="out">${money(dop.deuda)}</b></div><div><small>Ingresos del mes</small><b class="in">${money(inc)}</b></div><div><small>Egresos del mes</small><b class="out">${money(spent)}</b></div></div>
<div class="grid"><div class="card"><h2><i class="icon-repeat"></i> Próximos y alertas</h2>
${pend.length ? `<p style="margin:0 0 6px">⚠️ <b>${pend.length}</b> recurrente${pend.length > 1 ? 's' : ''} por confirmar</p>` + pend.slice(0, 3).map(q => { const r = recs.find(x => x.id == q.recId); return r ? `<div class="row"><div><b>${esc(r.name)}</b><small>${q.date} · ${money(r.amount, r.currency)}</small></div><button class="p" onclick="confirmRec('${q.recId}','${q.date}')">Confirmar</button></div>` : ''; }).join('') + (pend.length > 3 ? `<button onclick="go('rec')">Ver los ${pend.length}</button>` : '') : ''}
${soon.slice(0, 4).map(({ r, d }) => `<div class="row"><div><b>${esc(r.name)}</b><small>${d}</small></div><b>${money(r.amount, r.currency)}</b></div>`).join('')}
${warn.map(w => `<p style="margin:6px 0 0">🔶 ${esc(w.c)}: <b>${w.p}%</b> del tope (${money(w.sp)} de ${money(w.l)})</p>`).join('')}
${!pend.length && !soon.length && !warn.length ? '<p style="color:var(--mut);margin:0">Todo tranquilo: nada pendiente ni cerca del límite.</p>' : ''}</div>
${goals.length ? `<div class="card"><h2><i class="icon-target"></i> Metas de ahorro</h2>${goals.map(g => { const p = goalProgress(g), c = accentFor(g.name); return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><b>${esc(g.name)}</b><span style="color:var(--${c})">${p.pct}%</span></div><div style="background:var(--bg);border-radius:99px;height:8px;overflow:hidden;margin-top:4px"><div style="width:${p.pct}%;height:100%;background:var(--${c})"></div></div></div>`; }).join('')}<button onclick="go('goal')">Ver metas</button></div>` : ''}</div>
<div class="card"><h2>Gasto de los últimos 6 meses</h2><canvas id="c4"></canvas></div>
<div class="card"><h2>Este mes vs mes pasado, por categoría</h2><canvas id="c5"></canvas></div>
<div class="card"><h2>Gasto por persona y categoría</h2><canvas id="c3"></canvas></div>
<h2 style="margin:16px 0 4px">Explorar con filtros</h2>${fbar(false)}
${a.length ? `<div class="card"><h2>Ingresos vs egresos por mes</h2><canvas id="c1"></canvas></div><div class="card"><h2>Egresos por categoría</h2><canvas id="c2"></canvas><div id="catlist"></div></div>` : '<p class="empty">No hay movimientos con estos filtros.</p>'}`;
  charts(a);
}
function charts(a) {
  if (typeof Chart == 'undefined') { document.querySelectorAll('#app canvas').forEach(c => c.outerHTML = '<p class="empty">No se pudieron cargar las gráficas.</p>'); return; }
  const cs = getComputedStyle(document.body), V = n => cs.getPropertyValue(n).trim();
  Chart.defaults.color = cs.color; Chart.defaults.font.family = 'Figtree,system-ui';
  const g = V('--in'), r = V('--out'), pur = V('--purple');
  const o = { responsive: true, plugins: { tooltip: { callbacks: { label: c => (c.dataset.label ? c.dataset.label + ': ' : '') + money(c.raw) } } } };
  const pal = [V('--blue'), V('--pink'), V('--yellow'), V('--purple'), g, r, '#6b5b95', '#e07a5f', '#5b8c5a', '#c9a227', '#8d6e63', '#4a90a4'];
  if (a.length && $('c1')) {
    const ms = [...new Set(a.map(x => x.d.slice(0, 7)))].sort(), mi = ms.map(m => sum(a.filter(x => x.d.slice(0, 7) == m), 'i')), me = ms.map(m => sum(a.filter(x => x.d.slice(0, 7) == m), 'e'));
    let acc = 0; const bal = ms.map((m, i) => acc += mi[i] - me[i]);
    ch.push(new Chart($('c1'), { data: { labels: ms, datasets: [{ type: 'bar', label: 'Ingresos', data: mi, backgroundColor: g }, { type: 'bar', label: 'Egresos', data: me, backgroundColor: r }, { type: 'line', label: 'Balance acumulado', data: bal, borderColor: pur, backgroundColor: pur, tension: .25 }] }, options: o }));
    const ec = Object.entries(grp(a.filter(x => x.t == 'e'), 'c')).sort((x, y) => y[1] - x[1]);
    if (ec.length) {
      const colors = ec.map((_, i) => pal[i % pal.length]);
      ch.push(new Chart($('c2'), { type: 'doughnut', data: { labels: ec.map(x => x[0]), datasets: [{ data: ec.map(x => x[1]), backgroundColor: colors, borderWidth: 0 }] }, options: { ...o, plugins: { ...o.plugins, tooltip: { callbacks: { label: c => c.label + ': ' + money(c.raw) } }, legend: { display: false } } } }));
      const tot = ec.reduce((s, x) => s + x[1], 0);
      $('catlist').innerHTML = ec.map(([n, v], i) => `<div class="row"><div class="circ" style="background:${colors[i]}22;color:${colors[i]}"><i class="icon-${icoFor(n, 'e')}"></i></div><div><b>${esc(n)}</b><small>${Math.round(v / tot * 100)}%</small></div><b>${money(v)}</b></div>`).join('');
    }
  }
  const E = txs.filter(x => x.t == 'e'), m6 = [];
  { const d = new Date(); d.setDate(1); for (let k = 5; k >= 0; k--) { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); m6.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); } }
  ch.push(new Chart($('c4'), { type: 'line', data: { labels: m6, datasets: [{ label: 'Egresos', data: m6.map(m => sum(E.filter(x => x.d.slice(0, 7) == m), 'e')), borderColor: r, backgroundColor: r + '33', fill: true, tension: .3 }] }, options: { ...o, plugins: { ...o.plugins, legend: { display: false } } } }));
  const cm = m6[5], pm = m6[4], g1 = grp(E.filter(x => x.d.slice(0, 7) == cm), 'c'), g0 = grp(E.filter(x => x.d.slice(0, 7) == pm), 'c');
  const cats = [...new Set([...Object.keys(g1), ...Object.keys(g0)])].sort((x, y) => (g1[y] || 0) - (g1[x] || 0)).slice(0, 7);
  ch.push(new Chart($('c5'), { type: 'bar', data: { labels: cats, datasets: [{ label: 'Mes pasado', data: cats.map(k => g0[k] || 0), backgroundColor: V('--mut') }, { label: 'Este mes', data: cats.map(k => g1[k] || 0), backgroundColor: pur }] }, options: { ...o, indexAxis: 'y' } }));
  const byCat = grp(E, 'c'), pc = Object.keys(byCat).sort((x, y) => byCat[y] - byCat[x]).slice(0, 7);
  const pp = [...new Set([...cfg.people, ...E.map(x => x.w).filter(Boolean)])], pcol = [V('--blue'), V('--pink'), V('--yellow'), V('--purple')];
  ch.push(new Chart($('c3'), { type: 'bar', data: { labels: pc, datasets: pp.map((n, i) => ({ label: n, data: pc.map(k => E.filter(x => x.c == k && x.w == n).reduce((s, x) => s + x.v, 0)), backgroundColor: pcol[i % pcol.length] })).filter(ds => ds.data.some(v => v > 0)) }, options: { ...o, scales: { x: { stacked: true }, y: { stacked: true } } } }));
}

// ============ Historial ============
function histRow(x, gone) {
  const acc = accs.find(c => c.id == x.accId), to = accs.find(c => c.id == x.accIdTo), goal = goals.find(g => g.id == x.goalId);
  let ic, ti, amt, cls;
  if (x.t == 'tr') { ic = 'arrow-left-right'; ti = `Transferencia: ${acc ? esc(acc.name) : '(cuenta borrada)'} → ${to ? esc(to.name) : '(cuenta borrada)'}`; amt = money(x.a, acc ? acc.currency : 'DOP'); cls = ''; }
  else if (x.t == 'g') { ic = 'target'; ti = (x.v >= 0 ? 'Aporte a meta: ' : 'Retiro de meta: ') + (goal ? esc(goal.name) : '(meta borrada)'); amt = money(Math.abs(x.v)); cls = x.v >= 0 ? 'in' : 'out'; }
  else { ic = icoFor(x.c, x.t); ti = esc(x.c) + (x.sub ? ' · ' + esc(x.sub) : ''); amt = (x.t == 'i' ? '+' : '−') + money(x.v); cls = x.t == 'i' ? 'in' : 'out'; }
  const fx = x.cu && x.cu != 'DOP' && (x.t == 'i' || x.t == 'e') ? ` · ${money(x.a, x.cu)} × ${x.r}` : '';
  const edit = x.t == 'i' || x.t == 'e' ? `<button aria-label="Editar" onclick="openForm('${x.id}')"><i class="icon-pencil"></i></button>` : '';
  return `<div class="row${gone ? ' gone' : ''}">${circ(x.c || x.t, ic)}
<div><b style="white-space:normal">${ti}</b><small>${esc(x.d)}${x.w ? ' · ' + esc(x.w) : ''}${acc && x.t != 'tr' ? ' · ' + esc(acc.name) : ''}${fx}${x.n ? ' · ' + esc(x.n) : ''}${gone ? ' · borrado' : ''}</small></div>
<b class="${cls}">${amt}</b>${gone ? `<button onclick="restoreTx('${x.id}')">Restaurar</button>` : `${edit}<button class="d" aria-label="Borrar" onclick="delTx('${x.id}')"><i class="icon-trash-2"></i></button>`}</div>`;
}
function renderHist(app) {
  const all = [...txs.filter(histMatch).map(x => ({ x, g: 0 })), ...trash.filter(histMatch).map(x => ({ x, g: 1 }))].sort((p, q) => q.x.d.localeCompare(p.x.d) || (q.x.cr || 0) - (p.x.cr || 0));
  const shown = all.slice(0, F.lim || 300);
  app.innerHTML = `<div class="top"><h1>Historial</h1>${syncBadge()}</div>${fbar(true)}<div class="card">${shown.length ? shown.map(({ x, g }) => histRow(x, g)).join('') : '<p class="empty">Sin movimientos con estos filtros.</p>'}
${all.length > shown.length ? `<button onclick="F.lim=(F.lim||300)+300;render()">Ver más (${all.length - shown.length} restantes)</button>` : ''}</div>`;
}

// ============ Cuentas ============
function renderAcc(app) {
  const asOf = F.accAsOf || undefined, tot = totalsByCurrency(asOf);
  app.innerHTML = `<div class="top"><h1>Cuentas</h1>${syncBadge()}</div>
<div class="card"><label>Ver saldos al<input type="date" value="${esc(asOf || '')}" onchange="F.accAsOf=this.value;render()"></label>${asOf ? `<button style="margin-top:8px" onclick="F.accAsOf='';render()">Volver a hoy</button>` : ''}</div>
<div class="kp">${(Object.keys(tot).length ? Object.entries(tot) : [['DOP', { disp: 0, deuda: 0 }]]).map(([c, t]) => `<div><small>Disponible (${c})${asOf ? ' al ' + esc(asOf) : ''}</small><b>${money(t.disp, c)}</b></div><div><small>Deuda en tarjetas (${c})</small><b class="out">${money(t.deuda, c)}</b></div>`).join('')}</div>
${accs.length ? accs.map(a => {
    const bal = acctBalance(a, asOf), isDebt = isCard(a), col = accentFor(a.name), e = earm(a);
    const early = txs.filter(x => (x.accId == a.id || x.accIdTo == a.id) && a.openDate && x.d < a.openDate).length;
    return `<div class="acccard" style="border-color:color-mix(in srgb,var(--${col}) 35%,var(--line))">${circ(a.name, acctIcon(a.type))}
<div style="flex:1;min-width:0"><b>${esc(a.name)}<span class="pill">${esc(a.type)}</span></b><small>${a.note ? esc(a.note) + ' · ' : ''}${e > 0 ? 'Reservado en metas ' + money(e) + ' · Libre ' + money(bal - e) + ' · ' : ''}Desde ${esc(a.openDate)}</small>
${early ? `<small class="warnline">⚠ ${early} movimiento${early > 1 ? 's' : ''} con fecha anterior a la apertura no cuenta${early > 1 ? 'n' : ''} en el saldo. Edita la fecha de apertura o esos movimientos.</small>` : ''}</div>
<div style="text-align:right"><b class="${bal < 0 ? 'out' : ''}">${money(isDebt ? Math.abs(bal) : bal, a.currency)}</b><br><small>${isDebt ? (bal < 0 ? 'debes' : 'a favor') : 'disponible'}</small><br><button type="button" style="margin-top:6px;padding:5px 10px;font-size:13px" onclick="openAdj('${a.id}')">Ajustar saldo</button></div>
<button aria-label="Editar cuenta" onclick="openAccForm('${a.id}')"><i class="icon-pencil"></i></button></div>`;
  }).join('') : '<p class="empty">Aún no tienes cuentas. Agrega la primera.</p>'}
<div class="seg"><button class="p" onclick="openAccForm()"><i class="icon-plus"></i> Agregar cuenta</button>${accs.length >= 2 ? `<button onclick="openTransferForm()"><i class="icon-arrow-left-right"></i> Transferir entre cuentas</button>` : ''}</div>
${txs.some(x => x.t == 'tr') ? `<div class="card" style="margin-top:12px"><h2>Transferencias recientes</h2>${txs.filter(x => x.t == 'tr').sort((a, b) => b.d.localeCompare(a.d)).slice(0, 15).map(x => histRow(x, false)).join('')}</div>` : ''}`;
}
let am = {};
function openAccForm(id) { const x = accs.find(a => a.id == id) || {}; am = { id: x.id, name: x.name || '', type: x.type || cfg.accTypes[0], currency: x.currency || 'DOP', note: x.note || '', openDate: x.openDate || today(), openBalance: x.openBalance ?? '' }; drawAccForm(); }
function drawAccForm() {
  const f = am, cu = [...new Set(['DOP', f.currency, ...cfg.cur])];
  dlg.innerHTML = `<form onsubmit="return svAcc(event)"><h2>${f.id ? 'Editar' : 'Nueva'} cuenta</h2>
<label>Nombre<input required value="${esc(f.name)}" oninput="am.name=this.value" placeholder="Ej: Efectivo, BHD Ahorros…"></label>
<label>Tipo<select onchange="am.type=this.value">${opts(cfg.accTypes, f.type)}</select></label>
<label>Moneda<select onchange="am.currency=this.value">${opts(cu, f.currency)}</select></label>
<label>Saldo inicial${f.id ? ' (en tarjetas, lo que debías va en negativo)' : ''}<input type="number" step="0.01" required value="${esc(f.openBalance)}" oninput="am.openBalance=this.value"></label>
<label>Fecha del saldo inicial<input type="date" required value="${esc(f.openDate)}" onchange="am.openDate=this.value"></label>
${f.id ? '<p class="note">Para corregir el saldo de hoy sin tocar el historial, usa “Ajustar saldo”. Cambia el saldo o la fecha inicial solo si te equivocaste al crear la cuenta.</p>' : '<p class="note">En tarjetas de crédito, si ya debes algo, escribe el saldo en negativo (ej: -15000).</p>'}
<label>Nota o detalle (opcional)<input value="${esc(f.note)}" oninput="am.note=this.value" placeholder="Ej: cuenta conjunta, para emergencias…"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div>${f.id ? `<button type="button" class="d" onclick="delAcc('${f.id}');if(!accs.some(a=>a.id=='${f.id}'))dlg.close()"><i class="icon-trash-2"></i> Borrar cuenta</button>` : ''}</form>`;
  dlgShow();
}
function svAcc(e) {
  e.preventDefault(); const f = am; if (!f.name.trim()) return false;
  const prev = f.id && accs.find(a => a.id == f.id);
  if (f.id && goals.some(g => g.accId == f.id) && (f.currency != 'DOP' || f.type == 'Tarjeta de crédito')) return alert('Esta cuenta tiene metas atadas: debe seguir siendo una cuenta en pesos y no una tarjeta.'), false;
  const b = parseFloat(f.openBalance); if (isNaN(b)) return alert('Escribe el saldo inicial (puede ser 0).'), false;
  if (prev && prev.currency != f.currency && txs.some(x => x.accId == f.id || x.accIdTo == f.id) && !confirm(`Esta cuenta ya tiene movimientos en ${prev.currency}. Si cambias la moneda a ${f.currency}, los montos viejos se interpretarán en ${f.currency}. ¿Continuar?`)) return false;
  saveAcc({ id: f.id, name: f.name.trim(), type: f.type, currency: f.currency, note: f.note.trim(), openDate: f.openDate, openBalance: b });
  dlg.close(); return false;
}
let gm = {};
function openAdj(accId) { const a = accs.find(x => x.id == accId); gm = { accId, date: today(), balance: acctBalance(a), note: '' }; drawAdj(a); }
function drawAdj(a) {
  const f = gm, cur = acctBalance(a), prev = adjs.filter(x => x.accId == a.id).sort((x, y) => y.date.localeCompare(x.date));
  dlg.innerHTML = `<form onsubmit="return svAdj(event)"><h2>Ajustar saldo — ${esc(a.name)}</h2>
<p style="color:var(--mut);margin:0 0 4px;font-size:13px">Saldo calculado hoy: <b>${money(cur, a.currency)}</b>. Si el saldo real es distinto, ajústalo aquí; la diferencia no se cuenta como gasto ni ingreso.</p>
<label>Fecha del saldo real<input type="date" required value="${esc(f.date)}" onchange="gm.date=this.value"></label>
<label>Saldo real en esa fecha<input type="number" step="0.01" required value="${esc(f.balance)}" oninput="gm.balance=this.value"></label>
<label>¿Qué pasó? (opcional, pero ayuda a recordar)<input value="${esc(f.note)}" oninput="gm.note=this.value" placeholder="Ej: no anoté varios gastos chiquitos"></label>
${prev.length ? `<p style="font-size:12px;color:var(--mut);margin:10px 0 4px">Ajustes anteriores de esta cuenta</p>${prev.map(x => `<div class="row" style="padding:6px 0"><div><b>${esc(x.date)}</b><small>${money(x.balance, a.currency)}${x.note ? ' · ' + esc(x.note) : ''}</small></div><button type="button" class="d" onclick="delAdj('${x.id}')"><i class="icon-trash-2"></i></button></div>`).join('')}` : ''}
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar ajuste</button></div></form>`;
  dlgShow();
}
function svAdj(e) { e.preventDefault(); const f = gm, b = parseFloat(f.balance); if (isNaN(b)) return false; saveAdj({ accId: f.accId, date: f.date, balance: b, note: f.note.trim() }); dlg.close(); return false; }
function delAdj(id) {
  if (!confirm('¿Borrar este ajuste? El saldo volverá a calcularse sin él.')) return;
  removeItem('adj', id); const a = accs.find(x => x.id == gm.accId);
  if (a) { gm.balance = acctBalance(a); drawAdj(a); } render();
}

// ---- transferencias ----
let trform = {};
const accOpt = (a, s, d) => `<option value="${a.id}"${a.id == s ? ' selected' : ''}>${esc(a.name)} (${a.currency}) · ${money(acctBalance(a, d), a.currency)}${earm(a) > 0 ? ' · libre ' + money(freeBal(a, d), a.currency) : ''}</option>`;
function mvTabs(c) { return `<div class="seg">${[['m', 'Ingreso / Egreso', 'openForm()'], ['t', 'Transferir', 'goTr()'], ['g', 'Metas', 'openContribForm()']].map(([k, l, fn]) => `<button type="button" class="${c == k ? 'on' : ''}" onclick="${fn}">${l}</button>`).join('')}</div>`; }
function goTr() { if (accs.length < 2) return alert('Necesitas al menos dos cuentas para transferir.'); openTransferForm(); }
function openTransferForm() { if (accs.length < 2) return alert('Necesitas al menos dos cuentas para transferir.'); trform = { date: today(), from: accs[0].id, to: accs[1].id, amount: '', amountTo: '', note: '' }; drawTransferForm(); }
function trSet(k, v) {
  trform[k] = v;
  if (k == 'from' && trform.to == trform.from) trform.to = (accs.find(a => a.id != trform.from) || {}).id;
  trform.amountTo = ''; // al cambiar de cuenta, el monto de destino anterior ya no aplica
  drawTransferForm();
}
function drawTransferForm() {
  const f = trform, from = accs.find(a => a.id == f.from), to = accs.find(a => a.id == f.to), same = from && to && from.currency == to.currency;
  dlg.innerHTML = `<form onsubmit="return svTransfer(event)"><h2>Nuevo movimiento</h2>${mvTabs('t')}
<label>Fecha<input type="date" required value="${esc(f.date)}" onchange="trform.date=this.value;drawTransferForm()"></label>
<label>Desde<select onchange="trSet('from',this.value)">${accs.map(a => accOpt(a, f.from, f.date)).join('')}</select></label>
<label>Hacia<select onchange="trSet('to',this.value)">${accs.filter(a => a.id != f.from).map(a => accOpt(a, f.to, f.date)).join('')}</select></label>
<label>Monto que sale de “${from ? esc(from.name) : ''}” (${from ? from.currency : ''})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amount)}" oninput="trform.amount=this.value"></label>
${!same ? `<label>Monto que entra a “${to ? esc(to.name) : ''}” (${to ? to.currency : ''})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amountTo)}" oninput="trform.amountTo=this.value"></label>
<p class="mini" style="margin:0">Monedas distintas: escribe cuánto recibiste realmente, según la tasa del día.</p>` : ''}
<label>Nota (opcional)<input value="${esc(f.note)}" oninput="trform.note=this.value"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar transferencia</button></div></form>`;
  dlgShow();
}
function svTransfer(e) {
  e.preventDefault(); const f = trform; if (f.from == f.to) return alert('Elige dos cuentas distintas.'), false;
  const fa = accs.find(x => x.id == f.from), ta = accs.find(x => x.id == f.to);
  const a = parseFloat(f.amount), same = fa && ta && fa.currency == ta.currency, aTo = same ? a : parseFloat(f.amountTo);
  if (!(a > 0)) return alert('Escribe un monto mayor que cero.'), false;
  if (!(aTo > 0)) return alert('Escribe el monto que entra a la otra cuenta.'), false;
  for (const x of [fa, ta]) if (x && x.openDate && f.date < x.openDate) return alert(`La cuenta “${x.name}” empieza el ${x.openDate}. Cambia la fecha de la transferencia o la fecha inicial de la cuenta.`), false;
  const av = fa ? freeBal(fa, f.date) : 0;
  if (fa && !isCard(fa) && a > av + 0.005) return alert(`No hay saldo suficiente en “${fa.name}”. Libre: ${money(av, fa.currency)}${earm(fa) > 0 ? ' (el resto está reservado para metas)' : ''}.`), false;
  dlg.close(); saveTx({ t: 'tr', d: f.date, accId: f.from, accIdTo: f.to, a, aTo, n: f.note.trim() }); return false;
}

// ============ Presupuesto ============
function renderBud(app) {
  const ym = budYm, monthTx = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), spentTotal = monthTx.reduce((s, x) => s + x.v, 0);
  const b = budgetFor(ym), st = budgetStatus(spentTotal, b.total), ov = (cfg.budgetOverrides || {})[ym] || {};
  const catNames = [...new Set([...cfg.cats.filter(c => c.t == 'e').map(c => c.n), ...Object.keys(b.cats)])];
  const mesTxt = MONTHS[+ym.slice(5, 7) - 1].toLowerCase() + ' ' + ym.slice(0, 4);
  app.innerHTML = `<div class="top"><h1>Presupuesto</h1>${syncBadge()}</div>
<div class="card"><label>Mes<input type="month" value="${esc(ym)}" onchange="if(this.value){budYm=this.value;render()}"></label></div>
<div class="card"><h2>Presupuesto total de ${mesTxt}</h2>
${st ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>${money(spentTotal)} de ${money(b.total)}</span><b style="color:${barCol(st.level)}">${st.pct}%</b></div>
<div style="background:var(--bg);border-radius:99px;height:10px;overflow:hidden"><div style="width:${Math.min(100, st.pct)}%;height:100%;background:${barCol(st.level)}"></div></div>
${st.level == 'out' ? '<p style="color:var(--out);margin:8px 0 0;font-size:13px">Te pasaste del presupuesto de este mes.</p>' : st.level == 'yellow' ? '<p style="color:var(--yellow);margin:8px 0 0;font-size:13px">Vas llegando al límite (80% o más).</p>' : ''}`
      : `<p style="color:var(--mut)">${money(spentTotal)} gastado. Aún no hay tope para este mes.</p>`}
<div class="add" style="margin-top:10px"><label style="flex:1">Tope base para todos los meses (DOP)<input type="number" step="0.01" min="0" value="${cfg.budgetTotal || ''}" id="bt-base"></label><button class="p" onclick="setBudgetBase($('bt-base').value)">Guardar</button></div>
<div class="add" style="margin-top:8px"><label style="flex:1">Tope distinto solo para ${mesTxt} (opcional)<input type="number" step="0.01" min="0" value="${ov.total ?? ''}" id="bt-mes" placeholder="Usa el base"></label><button onclick="setBudgetMonth('${ym}',$('bt-mes').value)">Guardar</button></div>
${ov.total != null ? `<button class="d" style="margin-top:6px" onclick="setBudgetMonth('${ym}','')">Quitar excepción de ${mesTxt}</button>` : ''}</div>
<div class="card"><h2>Presupuesto por categoría</h2>
<div class="seg" style="margin-bottom:8px"><button type="button" class="${budMode == 'base' ? 'on' : ''}" onclick="budMode='base';render()">Editar límites base</button><button type="button" class="${budMode == 'mes' ? 'on' : ''}" onclick="budMode='mes';render()">Solo ${mesTxt}</button></div>
<p class="mini" style="margin:0 0 6px">${budMode == 'base' ? 'Estos límites aplican a todos los meses. Deja vacío para quitar el límite.' : 'Cambios solo para este mes. Vacío = usar el límite base; 0 = sin límite este mes.'}</p>
${catNames.map(n => {
    const spent = monthTx.filter(x => x.c == n).reduce((s, x) => s + x.v, 0), lim = b.cats[n], s2 = budgetStatus(spent, lim), ic = icoFor(n, 'e');
    const val = budMode == 'base' ? (cfg.budgetCats || {})[n] : (b.catOverrides || {})[n];
    const hasOv = (b.catOverrides || {})[n] != null;
    return `<div class="row" style="flex-direction:column;align-items:stretch;gap:6px"><div style="display:flex;align-items:center;gap:10px">${circ(n, ic)}
<div style="flex:1;min-width:0"><b>${esc(n)}</b><small>${lim ? money(spent) + ' de ' + money(lim) : money(spent) + ' (sin límite)'}${hasOv && budMode == 'base' ? ' · este mes tiene excepción' : ''}</small></div>
<input type="number" step="0.01" min="0" placeholder="${budMode == 'base' ? 'Límite' : 'Base: ' + ((cfg.budgetCats || {})[n] ?? '—')}" value="${val ?? ''}" style="width:120px" data-n="${esc(n)}" onchange="setBudgetCat('${ym}',this.dataset.n,this.value)">
</div>${s2 ? `<div style="background:var(--bg);border-radius:99px;height:6px;overflow:hidden;margin-left:56px"><div style="width:${Math.min(100, s2.pct)}%;height:100%;background:${barCol(s2.level)}"></div></div>` : ''}</div>`;
  }).join('')}</div>`;
}
function tidyOverrides(c) { for (const [k, o] of Object.entries(c.budgetOverrides)) { if (o.cats && !Object.keys(o.cats).length) delete o.cats; if (o.total == null) delete o.total; if (!Object.keys(o).length) delete c.budgetOverrides[k]; } }
function setBudgetBase(v) { const n = parseFloat(v), c = deep(cfg); c.budgetTotal = isNaN(n) || n < 0 ? 0 : n; saveCfg(c); }
function setBudgetMonth(ym, v) {
  const n = parseFloat(v), c = deep(cfg); c.budgetOverrides = c.budgetOverrides || {};
  const o = c.budgetOverrides[ym] = c.budgetOverrides[ym] || {};
  if (isNaN(n) || n < 0) delete o.total; else o.total = n;
  tidyOverrides(c); saveCfg(c);
}
function setBudgetCat(ym, cat, v) {
  const n = parseFloat(v), c = deep(cfg); c.budgetCats = c.budgetCats || {}; c.budgetOverrides = c.budgetOverrides || {};
  if (budMode == 'base') { if (isNaN(n) || n <= 0) delete c.budgetCats[cat]; else c.budgetCats[cat] = n; }
  else { const o = c.budgetOverrides[ym] = c.budgetOverrides[ym] || {}; o.cats = o.cats || {}; if (isNaN(n) || n < 0) delete o.cats[cat]; else o.cats[cat] = n; }
  tidyOverrides(c); saveCfg(c);
}

// ============ Recurrentes ============
function renderRec(app) {
  const pend = pendingRecurring();
  app.innerHTML = `<div class="top"><h1>Recurrentes</h1>${syncBadge()}</div>
${pend.length ? `<div class="card"><h2>Pendientes por confirmar (${pend.length})</h2>${pend.map(p => {
    const r = recs.find(x => x.id == p.recId); if (!r) return '';
    return `<div class="row">${circ(r.name, icoFor(r.c, r.t))}
<div><b>${esc(r.name)}</b><small>${p.date} · ${money(r.amount, r.currency)}${r.currency != 'DOP' ? ' (pide tasa al confirmar)' : ''}</small></div>
<button class="p" onclick="confirmRec('${r.id}','${p.date}')">Confirmar</button><button onclick="skipRec('${r.id}','${p.date}')">Omitir</button></div>`;
  }).join('')}</div>` : ''}
<div class="card"><h2>Todos tus recurrentes</h2>${recs.length ? recs.map(r => `<div class="row">${circ(r.name, icoFor(r.c, r.t))}
<div><b>${esc(r.name)}${r.active === false ? ' <span class="pill">Pausado</span>' : ''}</b><small>${esc(r.c)}${r.sub ? ' · ' + esc(r.sub) : ''} · ${freqLabel[r.freq] || ''} · ${esc(dayLabel(r))} · ${money(r.amount, r.currency)}</small></div>
<button aria-label="Editar" onclick="openRecForm('${r.id}')"><i class="icon-pencil"></i></button></div>`).join('') : '<p class="empty">Aún no tienes movimientos recurrentes.</p>'}</div>
<button class="p" onclick="openRecForm()"><i class="icon-plus"></i> Agregar recurrente</button>`;
}
let rm2 = {};
function openRecForm(id) {
  const x = recs.find(r => r.id == id) || {};
  rm2 = { id: x.id, name: x.name || '', t: x.t || 'e', c: x.c, sub: x.sub || '', w: x.w || cfg.people[0], accId: x.accId || (accs[0] && accs[0].id) || '', amount: x.amount || '', currency: x.currency || 'DOP', freq: x.freq || 'mensual', day: x.day ?? 1, month: x.month || recMonth(x.startDate ? x : { startDate: today() }), startDate: x.startDate || today(), active: x.active !== false };
  drawRecForm();
}
// Al cambiar la frecuencia, el día se reinicia a algo válido (antes "Domingo"=0 pasaba a mensual como "día 0").
function recFreq(v) {
  const f = rm2, sd = new Date(f.startDate + 'T00:00:00Z'); f.freq = v;
  if (v == 'semanal') f.day = sd.getUTCDay();
  else if (v == 'mensual' || v == 'anual') { if (f.day != 'ultimo' && !(Number(f.day) >= 1 && Number(f.day) <= 28)) f.day = Math.min(28, sd.getUTCDate()); if (v == 'anual' && !f.month) f.month = sd.getUTCMonth() + 1; }
  drawRecForm();
}
function drawRecForm() {
  const f = rm2, cats = cfg.cats.filter(c => c.t == f.t).map(c => c.n), ins = [...cats];
  if (f.c && !ins.includes(f.c)) ins.unshift(f.c); if (!f.c) f.c = ins[0];
  const cu = [...new Set(['DOP', f.currency, ...cfg.cur])];
  dlg.innerHTML = accs.length ? `<form onsubmit="return svRec(event)"><h2>${f.id ? 'Editar' : 'Nuevo'} recurrente</h2>
<label>Nombre<input required value="${esc(f.name)}" oninput="rm2.name=this.value" placeholder="Ej: Netflix, Alquiler, Salario…"></label>
<div class="seg"><button type="button" class="i${f.t == 'i' ? ' on' : ''}" onclick="rm2.t='i';rm2.c=null;drawRecForm()">Ingreso</button><button type="button" class="e${f.t == 'e' ? ' on' : ''}" onclick="rm2.t='e';rm2.c=null;drawRecForm()">Egreso</button></div>
<label>Categoría<select onchange="rm2.c=this.value">${opts(ins, f.c)}</select></label>
<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><label>Monto<input type="number" step="0.01" min="0.01" required value="${esc(f.amount)}" oninput="rm2.amount=this.value"></label><label>Moneda<select onchange="rm2.currency=this.value">${opts(cu, f.currency)}</select></label></div>
<label>Cuenta<select onchange="rm2.accId=this.value">${accs.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('')}</select></label>
<label>Quién<select onchange="rm2.w=this.value">${opts(cfg.people, f.w)}</select></label>
<label>Frecuencia<select onchange="recFreq(this.value)">${Object.entries(freqLabel).map(([k, l]) => `<option value="${k}"${f.freq == k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
${f.freq == 'semanal' ? `<label>Día de la semana<select onchange="rm2.day=parseInt(this.value)">${WEEKDAYS.map((n, i) => `<option value="${i}"${Number(f.day) == i ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
${f.freq == 'anual' ? `<label>Mes<select onchange="rm2.month=parseInt(this.value)">${MONTHS.map((n, i) => `<option value="${i + 1}"${Number(f.month) == i + 1 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
${f.freq == 'mensual' || f.freq == 'anual' ? `<label>Día del mes<select onchange="rm2.day=this.value=='ultimo'?'ultimo':parseInt(this.value)">${[...Array(28)].map((_, i) => `<option value="${i + 1}"${f.day == i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}<option value="ultimo"${f.day == 'ultimo' ? ' selected' : ''}>Último día del mes</option></select></label>` : ''}
<label>Desde<input type="date" required value="${esc(f.startDate)}" onchange="rm2.startDate=this.value"></label>
<label class="toggle"><input type="checkbox" ${f.active ? 'checked' : ''} onchange="rm2.active=this.checked"> Activo</label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div>${f.id ? `<button type="button" class="d" onclick="delRec('${f.id}')"><i class="icon-trash-2"></i> Borrar recurrente</button>` : ''}</form>`
    : `<h2>Primero crea una cuenta</h2><div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button><button class="p" onclick="dlg.close();go('acc');openAccForm()">Crear cuenta</button></div>`;
  dlgShow();
}
function svRec(e) {
  e.preventDefault(); const f = rm2, a = parseFloat(f.amount);
  if (!(a > 0)) return alert('Escribe un monto mayor que cero.'), false;
  if (!f.accId) return alert('Elige una cuenta.'), false;
  const o = { id: f.id, name: f.name.trim(), t: f.t, c: f.c, sub: f.sub, w: f.w, accId: f.accId, amount: a, currency: f.currency, freq: f.freq, day: f.day, startDate: f.startDate, active: f.active };
  if (f.freq == 'anual') o.month = Number(f.month) || 1;
  saveRec(o); dlg.close(); return false;
}
function delRec(id) { if (!confirm('¿Borrar este recurrente? Los movimientos ya confirmados no se borran.')) return; removeItem('rec', id); dlg.close(); render(); }
let crf = {};
function confirmRec(id, date) {
  const r = recs.find(x => x.id == id); if (!r) return;
  const acc = accs.find(a => a.id == r.accId);
  if (!acc) { alert(`La cuenta de “${r.name}” ya no existe. Edítalo para elegir otra cuenta antes de confirmar.`); openRecForm(id); return; }
  const pc = acc.currency, fx = r.currency || 'DOP';
  // Monto sugerido en la moneda de la cuenta (antes, un recurrente en DOP en cuenta USD sugería el número en pesos)
  let amt = '';
  if (fx == pc) amt = r.amount;
  else { const rf = rateOf(fx, date), rp = rateOf(pc, date); if (rf && rp) amt = round2(r.amount * rf / rp); }
  crf = { id, date, d: date, amt, rate: pc == 'DOP' ? 1 : (rateOf(pc, date) || ''), pc, fx, base: r.amount };
  drawConfirmRec();
}
function drawConfirmRec() {
  const f = crf, r = recs.find(x => x.id == f.id); if (!r) return;
  dlg.innerHTML = `<form onsubmit="return svConfirmRec(event)"><h2>Confirmar “${esc(r.name)}”</h2>
<p style="font-size:13px;color:var(--mut);margin:0">Corresponde al ${f.date}. Base: ${money(f.base, f.fx)}. Escribe lo que realmente se pagó.</p>
<label>Fecha del pago<input type="date" required value="${esc(f.d)}" onchange="crf.d=this.value"></label>
<label>Monto final (${f.pc}, moneda de la cuenta)<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amt)}" oninput="crf.amt=this.value"></label>
${f.pc != 'DOP' ? `<label>Tasa: 1 ${f.pc} = ? DOP<input type="number" inputmode="decimal" step="0.0001" min="0.0001" required value="${esc(f.rate)}" oninput="crf.rate=this.value"></label>` : ''}
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Confirmar</button></div></form>`;
  dlgShow();
}
function svConfirmRec(e) {
  e.preventDefault(); const f = crf, r = recs.find(x => x.id == f.id); if (!r) return false;
  const a = parseFloat(f.amt), rt = f.pc == 'DOP' ? 1 : parseFloat(f.rate);
  if (!(a > 0) || !(rt > 0)) return alert('Revisa el monto y la tasa.'), false;
  const ac = accs.find(x => x.id == r.accId);
  if (ac && ac.openDate && f.d < ac.openDate) return alert(`La cuenta “${ac.name}” empieza el ${ac.openDate}. Cambia la fecha del pago.`), false;
  if (r.t == 'e' && ac && !isCard(ac)) { const av = freeBal(ac, f.d); if (a > av + 0.005) return alert(`No hay saldo suficiente en “${ac.name}”. Libre: ${money(av, ac.currency)}.`), false; }
  dlg.close();
  saveTx({ t: r.t, d: f.d, c: r.c, sub: r.sub, w: r.w, accId: r.accId, a, aa: a, cu: f.pc, r: rt, v: round2(a * rt), n: 'Recurrente: ' + r.name + (f.fx != f.pc ? ` (base ${money(f.base, f.fx)})` : ''), rec: r.id });
  saveRec(recMarkDone(recs.find(x => x.id == f.id), f.date));
  return false;
}
function skipRec(id, date) { const r = recs.find(x => x.id == id); if (!r || !confirm('¿Omitir este movimiento? No se registrará.')) return; saveRec(recMarkDone(r, date)); }

// ============ Metas ============
function renderGoal(app) {
  app.innerHTML = `<div class="top"><h1>Metas de ahorro</h1>${syncBadge()}</div>
${goals.length ? goals.map(g => {
    const p = goalProgress(g), proj = goalProjection(g), col = accentFor(g.name), acc = accs.find(a => a.id == g.accId);
    const m = txs.filter(x => x.t == 'g' && x.goalId == g.id).sort((a, b) => b.d.localeCompare(a.d) || (b.u || 0) - (a.u || 0)).slice(0, 6);
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h2 style="margin:0">${esc(g.name)}</h2><small style="color:var(--mut)">${acc ? 'Ahorrando en ' + esc(acc.name) + ' · ' : '⚠ Sin cuenta: edítala y átala a una · '}${g.note ? esc(g.note) : ''}</small></div><button aria-label="Editar" onclick="openGoalForm('${g.id}')"><i class="icon-pencil"></i></button></div>
<div style="display:flex;justify-content:space-between;margin:10px 0 6px"><span>${money(p.saved)} de ${money(g.target)}</span><b style="color:var(--${col})">${p.pct}%</b></div>
<div style="background:var(--bg);border-radius:99px;height:12px;overflow:hidden"><div style="width:${p.pct}%;height:100%;background:var(--${col})"></div></div>
<p style="font-size:13px;color:var(--mut);margin:8px 0 0">${p.remaining > 0 ? 'Faltan ' + money(p.remaining) : '¡Meta alcanzada! 🎉'}${proj && proj.monthsLeft > 0 ? ` · Ahorrando ~${money(proj.perMonth)}/mes, en ~${proj.monthsLeft} ${proj.monthsLeft == 1 ? 'mes' : 'meses'}` : ''}</p>
${m.length ? `<div style="margin-top:8px">${m.map(x => { const ac = accs.find(a => a.id == x.accId); return `<div class="row" style="padding:4px 0"><div><b class="${x.v > 0 ? 'in' : 'out'}">${x.v > 0 ? '+' : '−'}${money(Math.abs(x.v))}</b><small>${esc(x.d)} · ${esc(x.w || '')} · ${ac ? esc(ac.name) : '(cuenta borrada)'}</small></div><button class="d" onclick="delTx('${x.id}')"><i class="icon-trash-2"></i></button></div>`; }).join('')}</div>` : ''}
<button class="p" style="margin-top:10px" onclick="openContribForm('${g.id}')"><i class="icon-plus"></i> Mover dinero</button></div>`;
  }).join('') : '<p class="empty">Aún no tienes metas. Crea la primera.</p>'}
<button class="p" onclick="openGoalForm()"><i class="icon-plus"></i> Nueva meta</button>
${(() => {
      const orphan = txs.filter(x => x.t == 'g' && !goals.some(g => g.id == x.goalId)); if (!orphan.length) return '';
      const s = orphan.reduce((t, x) => t + x.v, 0);
      return `<div class="card" style="margin-top:12px"><h2>Aportes sin meta (${money(s)})</h2><p style="color:var(--mut);margin:0 0 8px;font-size:13px">Quedaron de metas que borraste. Puedes reasignarlos a una meta activa o borrarlos.</p>
${orphan.map(x => `<div class="row"><div><b>${money(x.v)}</b><small>${esc(x.d)} · ${esc(x.w)}${x.n ? ' · ' + esc(x.n) : ''}</small></div>
${goals.length ? `<select onchange="reassignContrib('${x.id}',this.value)"><option value="">Reasignar a…</option>${goals.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>` : ''}
<button class="d" onclick="delTx('${x.id}')"><i class="icon-trash-2"></i></button></div>`).join('')}</div>`;
    })()}`;
}
function reassignContrib(id, goalId) {
  if (!goalId) return; const x = txs.find(t => t.id == id), g = goals.find(q => q.id == goalId); if (!x || !g) return;
  const oldHome = goalHome(x);
  if (g.accId && g.accId != oldHome && !confirm('La meta elegida está en otra cuenta: este dinero pasará a contarse en esa cuenta. ¿Continuar?')) return render();
  saveTx({ ...x, goalId, home: g.accId });
}
let gform = {};
function openGoalForm(id) { const x = goals.find(g => g.id == id) || {}; gform = { id: x.id, name: x.name || '', target: x.target || '', accId: x.accId || '', note: x.note || '' }; drawGoalForm(); }
function drawGoalForm() {
  const f = gform, ok = accs.filter(a => !isCard(a) && a.currency == 'DOP');
  dlg.innerHTML = `<form onsubmit="return svGoal(event)"><h2>${f.id ? 'Editar' : 'Nueva'} meta</h2>
<label>Nombre<input required value="${esc(f.name)}" oninput="gform.name=this.value" placeholder="Ej: Fondo de emergencia, Viaje…"></label>
<label>Monto objetivo (DOP)<input type="number" step="0.01" min="0.01" required value="${esc(f.target)}" oninput="gform.target=this.value"></label>
${ok.length ? `<label>Cuenta donde está este ahorro<select required onchange="gform.accId=this.value"><option value="" disabled${ok.some(a => a.id == f.accId) ? '' : ' selected'}>Elige una cuenta…</option>${ok.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)} · ${money(acctBalance(a), a.currency)}</option>`).join('')}</select></label><p class="mini" style="margin:0">Varias metas pueden compartir la misma cuenta; cada meta lleva su propio avance.</p>`
      : `<p class="note">Toda meta va atada a una cuenta en pesos (no tarjetas). Primero agrégala en la pestaña <b>Cuentas</b>.</p>`}
<label>Nota (opcional)<input value="${esc(f.note)}" oninput="gform.note=this.value"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div>${f.id ? `<button type="button" class="d" onclick="delGoal('${f.id}')"><i class="icon-trash-2"></i> Borrar meta</button>` : ''}</form>`;
  dlgShow();
}
function svGoal(e) {
  e.preventDefault(); const f = gform, t = parseFloat(f.target);
  if (!(t > 0)) return alert('Escribe un monto objetivo mayor que cero.'), false;
  const na = accs.find(a => a.id == f.accId && !isCard(a) && a.currency == 'DOP');
  if (!na) return alert('Elige la cuenta donde está este ahorro. Si no tienes una, agrégala primero en Cuentas.'), false;
  const prev = f.id && goals.find(g => g.id == f.id);
  if (prev && (prev.accId || '') != (f.accId || '')) {
    const sv = goalProgress(prev).saved;
    if (sv > 0) {
      if (freeBal(na) < sv - 0.005) return alert(`“${na.name}” no tiene suficiente saldo libre para guardar los ${money(sv)} de esta meta.`), false;
      if (!confirm(`Los ${money(sv)} ahorrados pasarán a contarse dentro de “${na.name}” y saldrán de la cuenta anterior. ¿Continuar?`)) return false;
    }
  }
  saveGoal({ id: f.id, name: f.name.trim(), target: t, accId: f.accId, note: f.note.trim() }); dlg.close(); return false;
}
function delGoal(id) { if (!confirm('¿Borrar esta meta? El dinero ahorrado se queda en la cuenta, solo deja de estar apartado para la meta.')) return; removeItem('goal', id); dlg.close(); render(); }
let cform = {};
const tiedAcc = gid => { const g = goals.find(x => x.id == gid); return g && accs.find(a => a.id == g.accId && !isCard(a)); };
function syncGoalAcc() { const t = tiedAcc(cform.goalId); if (t) cform.accId = t.id; else if (!accs.some(a => a.id == cform.accId)) cform.accId = accs[0].id; }
function needTie(gid) { if (tiedAcc(gid)) return false; alert('Esta meta no está atada a una cuenta. Edítala y elige la cuenta donde está el ahorro.'); dlg.close(); openGoalForm(gid); return true; }
function pickGoal(gid) { cform.goalId = gid; if (needTie(gid)) return; syncGoalAcc(); drawContribForm(); }
function openContribForm(goalId) {
  if (!goals.length) return alert('Primero crea una meta.');
  if (!accs.length) return alert('Primero crea una cuenta.');
  const g0 = goals.find(x => x.id == goalId) || goals[0];
  cform = { goalId: g0.id, date: today(), dir: 'in', accId: accs[0].id, amount: '', vdop: '', w: cfg.people[0], note: '' };
  if (needTie(g0.id)) return; syncGoalAcc(); drawContribForm();
}
function drawContribForm() {
  const f = cform, acc = accs.find(a => a.id == f.accId), fx = acc && acc.currency != 'DOP', h = tiedAcc(f.goalId), other = h && f.accId != h.id;
  dlg.innerHTML = `<form onsubmit="return svContrib(event)"><h2>Nuevo movimiento</h2>${mvTabs('g')}
<div class="seg"><button type="button" class="${f.dir == 'in' ? 'on' : ''}" onclick="cform.dir='in';drawContribForm()">Cuenta → Meta</button><button type="button" class="${f.dir == 'out' ? 'on' : ''}" onclick="cform.dir='out';drawContribForm()">Meta → Cuenta</button></div>
<label>Fecha<input type="date" required value="${esc(f.date)}" onchange="cform.date=this.value;drawContribForm()"></label>
<label>Meta<select onchange="pickGoal(this.value)">${goals.map(g => `<option value="${g.id}"${g.id == f.goalId ? ' selected' : ''}>${esc(g.name)} · ahorrado ${money(goalProgress(g).saved)}</option>`).join('')}</select></label>
<label>${f.dir == 'in' ? 'Cuenta de origen' : 'Cuenta destino'}<select onchange="cform.accId=this.value;drawContribForm()">${accs.map(a => accOpt(a, f.accId, f.date)).join('')}</select></label>
<p class="mini" style="margin:0">${h ? (other ? 'La meta está en “' + esc(h.name) + '”: el dinero se transfiere entre las dos cuentas.' : 'El dinero ya está en “' + esc(h.name) + '”; solo se aparta para esta meta.') : ''}</p>
<label>Monto${acc ? ' (' + acc.currency + ')' : ''}<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.amount)}" oninput="cform.amount=this.value"></label>
${fx ? `<label>Equivale en DOP<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.vdop)}" oninput="cform.vdop=this.value"></label>` : ''}
<label>Quién<select onchange="cform.w=this.value">${opts(cfg.people, f.w)}</select></label>
<label>Nota (opcional)<input value="${esc(f.note)}" oninput="cform.note=this.value"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div></form>`;
  dlgShow();
}
function svContrib(e) {
  e.preventDefault(); if (needTie(cform.goalId)) return false;
  const f = cform, acc = accs.find(a => a.id == f.accId), a = parseFloat(f.amount);
  if (!acc || !(a > 0)) return alert('Escribe un monto mayor que cero.'), false;
  const fx = acc.currency != 'DOP', vd = fx ? parseFloat(f.vdop) : a;
  if (!(vd > 0)) return alert('Escribe el equivalente en DOP.'), false;
  const hm = tiedAcc(f.goalId);
  for (const x of [acc, hm]) if (x && x.openDate && f.date < x.openDate) return alert(`La cuenta “${x.name}” empieza el ${x.openDate}. Cambia la fecha.`), false;
  if (f.dir == 'out') {
    const g = goals.find(x => x.id == f.goalId);
    if (g && vd > goalProgress(g).saved + 0.005) return alert(`No hay suficiente en la meta “${g.name}”. Ahorrado: ${money(goalProgress(g).saved)}.`), false;
    if (hm && hm.id != acc.id && vd > acctBalance(hm, f.date) + 0.005) return alert(`La cuenta “${hm.name}” no tiene ${money(vd)} para entregar.`), false;
  } else if (!isCard(acc)) {
    const av = freeBal(acc, f.date);
    if (a > av + 0.005) return alert(`No hay saldo suficiente en “${acc.name}”. Libre: ${money(av, acc.currency)}${earm(acc) > 0 ? ' (el resto está reservado para metas)' : ''}.`), false;
  }
  const sg = f.dir == 'out' ? -1 : 1; dlg.close();
  saveTx({ t: 'g', goalId: f.goalId, home: (hm || {}).id, accId: f.accId, d: f.date, w: f.w, a: sg * a, cu: acc.currency, r: fx ? vd / a : 1, v: sg * vd, n: f.note.trim(), c: sg > 0 ? 'Aporte a meta' : 'Retiro de meta' });
  return false;
}

// ============ Ajustes ============
function renderSet(app) {
  app.innerHTML = `<div class="top"><h1>Ajustes</h1>${syncBadge()}</div>
${cloudSection()}
<div class="card"><h2>Apariencia</h2><div class="seg">
<button type="button" class="${theme == 'claro' ? 'on' : ''}" onclick="setTheme('claro')"><i class="icon-sun"></i> Claro</button>
<button type="button" class="${theme == 'dark' ? 'on' : ''}" onclick="setTheme('dark')"><i class="icon-moon"></i> Oscuro</button>
<button type="button" class="${theme == 'auto' ? 'on' : ''}" onclick="setTheme('auto')"><i class="icon-monitor"></i> Automático</button>
</div></div>
${lst('Categorías de ingreso', 'ci')}${lst('Categorías de egreso', 'ce')}${lst('Personas o fuentes', 'people')}${lst('Otras monedas (además de DOP)', 'cur')}
<div class="card"><h2>Respaldo</h2><p style="color:var(--mut);margin:0 0 8px">Guarda una copia de todos tus datos. También sirve para traer los datos de la versión anterior: ábrela, toca “Copiar respaldo” y pégalo aquí.</p>
<div class="add" style="flex-wrap:wrap"><button class="p" onclick="bk()">Descargar respaldo</button><button onclick="cp()">Copiar respaldo</button></div>
<label style="margin-top:10px">Importar archivo de respaldo<input type="file" accept=".json,application/json,text/plain" onchange="fi(this)"></label>
<label style="margin-top:10px">O pega aquí el texto del respaldo<textarea id="paste" rows="3"></textarea></label>
<div class="add" style="margin-top:8px;flex-wrap:wrap"><button class="p" onclick="merge($('paste').value,$('rp').checked)">Importar texto</button><label class="toggle"><input type="checkbox" id="rp">Reemplazar todo lo de este dispositivo</label></div></div>
<div class="card"><h2>Exportar a Excel</h2><p style="color:var(--mut);margin:0 0 8px">Descarga los ingresos y egresos que coinciden con los filtros de Inicio o Historial, más un resumen por categoría.</p><button class="p" onclick="xl()">Descargar Excel</button></div>
<div class="card"><h2>Empezar de cero</h2><p style="color:var(--mut);margin:0 0 8px">${cloudOn() ? 'Borra todos los datos del hogar en la nube y en todos sus dispositivos.' : 'Borra todos los datos de este dispositivo y deja la app como nueva.'} Descarga un respaldo antes.</p><button class="d" onclick="resetAll()"><i class="icon-trash-2"></i> Borrar todos los datos</button></div>
<p class="mini" style="text-align:center">Mis finanzas · versión ${APP_VERSION}</p>`;
}
function lst(t, k) {
  const arr = k == 'ci' ? cfg.cats.filter(c => c.t == 'i') : k == 'ce' ? cfg.cats.filter(c => c.t == 'e') : cfg[k];
  return `<div class="card"><h2>${t}</h2><div class="tags">${arr.map(x => { const n = x.n || x; return `<span>${x.icon ? `<i class="icon-${esc(x.icon)}"></i>` : ''}${esc(n)}<button onclick="rm('${k}',this.dataset.n)" data-n="${esc(n)}" aria-label="Borrar ${esc(n)}">✕</button></span>`; }).join('') || '<small>Vacío</small>'}</div>
${k == 'ci' || k == 'ce' ? catAdder(k) : `<div class="add"><input id="a-${k}" placeholder="${k == 'cur' ? 'Código de 3 letras, ej: USD' : 'Agregar…'}" ${k == 'cur' ? 'maxlength="3" autocapitalize="characters"' : ''} onkeydown="if(event.key=='Enter')ad('${k}')"><button class="p" onclick="ad('${k}')">Agregar</button></div>`}</div>`;
}
let newIcon = 'tag';
function catAdder(k) {
  return `<div class="add"><input id="a-${k}" placeholder="Nombre de la categoría…"><button class="p" onclick="ad('${k}')">Agregar</button></div>
<p style="font-size:12px;color:var(--mut);margin:8px 0 4px">Ícono</p><div class="icogrid">${ICONS.map(i => `<button type="button" aria-label="${i}" class="${i == newIcon ? 'on' : ''}" onclick="newIcon='${i}';this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));this.classList.add('on')"><i class="icon-${i}"></i></button>`).join('')}</div>`;
}
function ad(k) {
  const el = $('a-' + k), v = el.value.trim(); if (!v) return;
  const c = deep(cfg);
  if (k == 'ci' || k == 'ce') {
    const t = k == 'ci' ? 'i' : 'e';
    if (c.cats.some(x => x.t == t && x.n.toLowerCase() == v.toLowerCase())) return alert('Ya existe.');
    c.cats.push({ n: v, t, icon: newIcon }); newIcon = 'tag';
  } else {
    const u = k == 'cur' ? v.toUpperCase() : v;
    // Corrección: un código como "RD$" hacía fallar la app al mostrar montos
    if (k == 'cur' && !CUR_RE.test(u)) return alert('Usa el código de 3 letras de la moneda (ej: USD, EUR, CAD).');
    if (c[k].some(x => x.toLowerCase() == u.toLowerCase()) || u == 'DOP') return alert('Ya existe.');
    c[k] = [...c[k], u];
  }
  saveCfg(c);
}
function rm(k, n) {
  const used = k == 'people' ? txs.filter(x => x.w == n).length : k == 'cur' ? txs.filter(x => x.cu == n).length + accs.filter(a => a.currency == n).length : txs.filter(x => x.c == n && x.t == (k == 'ci' ? 'i' : 'e')).length;
  if (!confirm(used ? `“${n}” tiene ${used} movimientos o cuentas. Se conservarán, pero ya no podrás elegirla. ¿Borrar?` : `¿Borrar “${n}”?`)) return;
  const c = deep(cfg);
  if (k == 'ci' || k == 'ce') {
    const t = k == 'ci' ? 'i' : 'e'; c.cats = c.cats.filter(x => !(x.t == t && x.n == n));
    if (t == 'e') { delete (c.budgetCats || {})[n]; for (const o of Object.values(c.budgetOverrides || {})) if (o.cats) delete o.cats[n]; tidyOverrides(c); }
  } else c[k] = c[k].filter(x => x != n);
  saveCfg(c);
}

// ============ formulario de ingreso/egreso ============
let fm = {};
function openForm(id) {
  const x = txs.find(t => t.id == id) || {};
  let accId = x.accId || ''; if (accId && !accs.some(a => a.id == accId)) accId = ''; if (!accId) accId = (accs[0] && accs[0].id) || '';
  fm = { id: x.id, t: x.t || 'e', d: x.d || today(), a: x.a || '', cu: x.cu || 'DOP', r: x.r || '', aa: x.aa ?? '', c: x.c, sub: x.sub || '', w: x.w || cfg.people[0], accId, n: x.n || '', cr: x.cr, rec: x.rec, accWasMissing: !!(x.accId && x.accId != accId) };
  drawForm(); dlgShow();
}
// ¿Hace falta pedir el monto en la moneda de la cuenta? (moneda del movimiento ≠ cuenta y la cuenta no es DOP)
const needAA = f => { const ac = accs.find(a => a.id == f.accId); return ac && f.cu != ac.currency && ac.currency != 'DOP' ? ac : null; };
function drawForm() {
  const f = fm, cats = cfg.cats.filter(c => c.t == f.t).map(c => c.n), ins = [...cats];
  if (f.c && !ins.includes(f.c)) ins.unshift(f.c); if (!f.c) f.c = ins[0];
  const ppl = [...new Set([f.w, ...cfg.people])].filter(Boolean), cu = [...new Set(['DOP', f.cu, ...cfg.cur])], subs = (cfg.subs && cfg.subs[f.c]) || [];
  const ac = needAA(f), est = ac && f.a && (f.cu == 'DOP' || f.r) && rateOf(ac.currency, f.d) ? round2(f.a * (f.cu == 'DOP' ? 1 : f.r) / rateOf(ac.currency, f.d)) : '';
  dlg.innerHTML = accs.length ? `<form onsubmit="return sv(event)"><h2>${f.id ? 'Editar' : 'Nuevo'} movimiento</h2>${f.id ? '' : mvTabs('m')}
${f.accWasMissing ? '<p class="note">La cuenta original de este movimiento ya no existe. Elige otra cuenta abajo.</p>' : ''}
<div class="seg"><button type="button" class="i${f.t == 'i' ? ' on' : ''}" onclick="sk('t','i')">Ingreso</button><button type="button" class="e${f.t == 'e' ? ' on' : ''}" onclick="sk('t','e')">Egreso</button></div>
<label>Fecha<input type="date" required value="${esc(f.d)}" onchange="sk('d',this.value)"></label>
<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><label>Monto<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.a)}" oninput="fm.a=this.value" onchange="if(needAA(fm))drawForm()"></label><label>Moneda<select onchange="sk('cu',this.value)">${opts(cu, f.cu)}</select></label></div>
${f.cu != 'DOP' ? `<label>Tasa: 1 ${esc(f.cu)} = ? DOP (en esa fecha)<input type="number" inputmode="decimal" step="0.0001" min="0.0001" required value="${esc(f.r)}" oninput="fm.r=this.value" onchange="if(needAA(fm))drawForm()"></label>` : ''}
<label>Cuenta<select onchange="sk('accId',this.value)">${accs.map(a => `<option value="${a.id}"${f.accId == a.id ? ' selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('')}</select></label>
${ac ? `<label>Monto que ${f.t == 'e' ? 'sale de' : 'entra a'} la cuenta (${ac.currency})<input type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(f.aa)}" placeholder="${est ? '≈ ' + est : ''}" oninput="fm.aa=this.value"></label><p class="mini" style="margin:0">La cuenta está en ${ac.currency}: escribe cuánto se movió realmente en esa moneda.${est ? ' Estimado con tu última tasa: ' + est + '.' : ''}</p>` : ''}
<label>Categoría<select onchange="sk('c',this.value)">${opts(ins, f.c)}</select></label>
${subs.length ? `<label>Detalle<select onchange="fm.sub=this.value"><option value="">(ninguno)</option>${opts(subs, f.sub)}</select></label>` : `<label>Detalle (opcional)<input value="${esc(f.sub)}" oninput="fm.sub=this.value" placeholder="Ej: Netflix, pizza…"></label>`}
<label>Quién<select onchange="fm.w=this.value">${opts(ppl, f.w)}</select></label>
<label>Nota (opcional)<input value="${esc(f.n)}" oninput="fm.n=this.value"></label><div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div></form>`
    : `<h2>Primero crea una cuenta</h2><p style="color:var(--mut)">Todo movimiento pertenece a una cuenta (Efectivo, banco, tarjeta…). Crea la primera en la pestaña Cuentas.</p><div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button><button class="p" onclick="dlg.close();go('acc');openAccForm()">Crear cuenta</button></div>`;
  dlgShow();
}
function sk(k, v) {
  fm[k] = v;
  if (k == 't') { fm.c = null; fm.sub = ''; }
  if (k == 'c') fm.sub = '';
  if (k == 'cu' || k == 'accId') fm.aa = '';
  if ((k == 'cu' || k == 'd') && fm.cu != 'DOP') fm.r = rateOf(fm.cu, fm.d) || fm.r;
  drawForm();
}
function sv(e) {
  e.preventDefault(); const f = fm, a = parseFloat(f.a), r = f.cu == 'DOP' ? 1 : parseFloat(f.r);
  if (!(a > 0) || !(r > 0)) return alert(f.cu == 'DOP' ? 'Escribe un monto mayor que cero.' : 'Escribe el monto y la tasa en DOP.'), false;
  const ac = accs.find(x => x.id == f.accId); if (!ac) return alert('Elige una cuenta.'), false;
  if (ac.openDate && f.d < ac.openDate) return alert(`La cuenta “${ac.name}” empieza el ${ac.openDate}. Cambia la fecha del movimiento, o la fecha inicial de la cuenta en Cuentas.`), false;
  const v = round2(a * r);
  let aa;
  if (f.cu == ac.currency) aa = a;
  else if (ac.currency == 'DOP') aa = v;
  else { aa = parseFloat(f.aa); if (!(aa > 0)) return alert(`Escribe cuánto ${f.t == 'e' ? 'salió de' : 'entró a'} la cuenta en ${ac.currency}.`), false; }
  if (f.t == 'e' && !isCard(ac)) {
    const av = without(f.id, () => freeBal(ac, f.d));
    if (aa > av + 0.005) return alert(`No hay saldo suficiente en “${ac.name}”. Libre: ${money(av, ac.currency)}${earm(ac) > 0 ? ' (el resto está reservado para metas)' : ''}. Si el saldo real es mayor, usa “Ajustar saldo” en Cuentas.`), false;
  }
  const o = { id: f.id, t: f.t, d: f.d, c: f.c, sub: f.sub.trim(), w: f.w, accId: f.accId, a, cu: f.cu, r, v, aa: round2(aa), n: f.n.trim(), cr: f.cr };
  if (f.rec) o.rec = f.rec;
  saveTx(o); dlg.close(); return false;
}

// ============ respaldo ============
const pack = () => JSON.stringify({ app: 'mis-finanzas', v: 5, ...snapshot() });
function mergeCfg(mine, theirs, theirsNewer) {
  // Une categorías, personas y monedas de ambos lados (antes ganaba toda la configuración del más reciente)
  const base = theirsNewer ? deep(theirs) : deep(mine), other = theirsNewer ? mine : theirs;
  for (const c of other.cats || []) if (!base.cats.some(x => x.n == c.n && x.t == c.t)) base.cats.push(c);
  for (const k of ['people', 'cur', 'accTypes']) base[k] = [...new Set([...(base[k] || []), ...(other[k] || [])])];
  base.subs = { ...(other.subs || {}), ...(base.subs || {}) };
  return base;
}
function merge(s, rep) {
  let o; try { o = JSON.parse(s); } catch (e) { return alert('El texto no es un respaldo válido.'); }
  if (!o || o.app != 'mis-finanzas') return alert('Eso no es un respaldo de Mis finanzas.');
  const inc = cleanState(o), wasEmpty = !hasLocalData(), before = new Map(getAllItems().map(x => [x.id, x.u + ':' + (x.del || 0)]));
  if (rep) {
    if (!confirm(cloudOn() ? 'Esto reemplaza lo que hay en este dispositivo y lo envía a la nube del hogar. ¿Continuar?' : 'Esto reemplaza todo lo que tienes en este dispositivo. ¿Continuar?')) return;
    if (cloudOn()) window.Cloud.wipeAll(getAllItems().filter(x => !inc.txs.concat(inc.accs, inc.adjs, inc.recs, inc.goals, inc.trash).some(y => y.id == x.id)));
    setState({ ...inc, cfgT: now() }); alert('Respaldo cargado.');
  } else {
    const lu = x => x.u || x.createdAt || 0;
    const mrg = (mine, theirs) => { const m = new Map(mine.map(x => [x.id, x])); theirs.forEach(x => { const y = m.get(x.id); if (!y || lu(x) > lu(y)) m.set(x.id, x); }); return [...m.values()]; };
    const d = { ...dels }; Object.entries(inc.dels).forEach(([k, v]) => d[k] = Math.max(v, d[k] || 0));
    let a = 0, u = 0; const m = new Map(txs.map(x => [x.id, x]));
    inc.txs.forEach(x => { const y = m.get(x.id); if (!y) { m.set(x.id, x); a++; } else if ((x.u || 0) > (y.u || 0)) { m.set(x.id, x); u++; } });
    const tm = new Map(trash.map(x => [x.id, x])); inc.trash.forEach(x => { const y = tm.get(x.id); if (!y || (x.del || 0) > (y.del || 0)) tm.set(x.id, x); });
    Object.entries(d).forEach(([k, v]) => { const y = m.get(k); if (y && v >= (y.u || 0)) { tm.set(k, { ...y, del: v }); m.delete(k); } });
    dels = d; txs = [...m.values()]; trash = [...tm.values()].filter(x => !(m.has(x.id) && (m.get(x.id).u || 0) > (x.del || 0)));
    const alive = x => !(d[x.id] && d[x.id] >= lu(x));
    accs = mrg(accs, inc.accs).filter(alive); adjs = mrg(adjs, inc.adjs).filter(alive); recs = mrg(recs, inc.recs).filter(alive); goals = mrg(goals, inc.goals).filter(alive);
    // Si este dispositivo estaba vacío, se toma la configuración del respaldo tal cual (presupuesto, personas…)
    cfg = wasEmpty ? inc.cfg : mergeCfg(cfg, inc.cfg, inc.cfgT > cfgT); cfgT = now();
    alert(`Listo: ${a} movimientos nuevos y ${u} actualizados (además de cuentas, recurrentes y metas).`);
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
function bk() { download('finanzas-respaldo-' + today() + '.json', pack(), 'application/json'); }
function cp() {
  const t = pack(), ta = $('paste'), ok1 = () => alert('Respaldo copiado. Pégalo en WhatsApp, un correo o en la otra app.');
  const fb = () => { ta.value = t; ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } if (ok) ok1(); else alert('Copia el texto de la caja de abajo (mantén presionado y elige Copiar).'); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok1, fb); else fb(); } catch (e) { fb(); }
}
function fi(el) { const f = el.files[0]; if (f) f.text().then(t => merge(t, $('rp').checked)); el.value = ''; }

// ============ exportar a Excel (la librería se carga solo cuando hace falta) ============
function loadScript(src) { return new Promise((ok, ko) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
async function xl() {
  const a = fl(); if (!a.length) return alert('No hay movimientos para exportar con estos filtros.');
  try { if (typeof XLSX == 'undefined') await loadScript('vendor/xlsx.mini.min.js'); } catch (e) { return alert('No se pudo cargar el exportador de Excel. Revisa tu conexión e intenta de nuevo.'); }
  const rows = a.map(x => ({ Fecha: x.d, Tipo: x.t == 'i' ? 'Ingreso' : 'Egreso', Categoría: x.c, Detalle: x.sub || '', Persona: x.w, Cuenta: (accs.find(c => c.id == x.accId) || {}).name || '', Monto: x.a, Moneda: x.cu || 'DOP', Tasa: x.r, 'Monto en DOP': x.v, Nota: x.n || '' }));
  const cat = {}; a.forEach(x => { const k = x.t + '|' + x.c; cat[k] = (cat[k] || 0) + x.v; });
  const res = Object.entries(cat).map(([k, v]) => ({ Tipo: k[0] == 'i' ? 'Ingreso' : 'Egreso', Categoría: k.slice(2), 'Total DOP': round2(v) })).sort((p, q) => p.Tipo.localeCompare(q.Tipo) || q['Total DOP'] - p['Total DOP']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Movimientos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res), 'Resumen');
  download('finanzas-' + today() + '.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// ============ tema ============
let theme = 'auto'; try { theme = localStorage.getItem('fin_theme') || 'auto'; } catch (e) { }
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme == 'auto' ? '' : (theme == 'claro' ? 'light' : 'dark'));
  const m = document.querySelector('meta[name=theme-color]'); if (m) setTimeout(() => m.content = getComputedStyle(document.body).backgroundColor, 0);
}
function setTheme(t) { theme = t; try { localStorage.setItem('fin_theme', t); } catch (e) { } applyTheme(); render(); }
