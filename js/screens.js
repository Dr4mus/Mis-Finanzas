'use strict';
(window.__V = window.__V || {})['screens.js'] = '8.0.1';
/* Mis finanzas — pantallas. */
let repYm = today().slice(0, 7);
const bar = (pct, col) => `<div class="bar"><div style="width:${Math.max(0, Math.min(100, pct))}%;background:${col}"></div></div>`;
const pill = (t, k) => `<span class="pill ${k || ''}">${esc(t)}</span>`;
const axisFmt = v => (HIDE ? '•••' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'k' : v);
function chartBase() {
  const cs = getComputedStyle(document.body), V = n => cs.getPropertyValue(n).trim();
  Chart.defaults.color = V('--mut'); Chart.defaults.font.family = 'Figtree,system-ui'; Chart.defaults.borderColor = V('--line');
  const o = { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { boxWidth: 12, boxHeight: 12 } }, tooltip: { callbacks: { label: c => (c.dataset.label ? c.dataset.label + ': ' : '') + money(c.raw) } } }, scales: { y: { ticks: { callback: axisFmt } } } };
  return { V, o, pal: [V('--brand'), V('--pink'), V('--yellow'), V('--teal'), V('--blue'), V('--out'), '#8d6e63', '#6b5b95', '#5b8c5a', '#c9a227', '#4a90a4', '#e07a5f'] };
}
const noCharts = () => typeof Chart == 'undefined' && (document.querySelectorAll('#app canvas').forEach(c => c.outerHTML = '<p class="empty">No se pudieron cargar las gráficas.</p>'), true);

// ============ filas de movimientos ============
function histRow(x, gone) {
  const acc = accs.find(c => c.id == x.accId), to = accs.find(c => c.id == x.accIdTo), goal = goals.find(g => g.id == x.goalId);
  let ic, ti, amt, cls, open, sub = [];
  if (x.t == 'tr') {
    ic = 'arrow-left-right'; ti = 'Transferencia'; amt = money(x.a, acc ? acc.currency : 'DOP'); cls = ''; open = `openTransferForm('${x.id}')`;
    sub.push(`${acc ? esc(acc.name) : '(borrada)'} → ${to ? esc(to.name) : '(borrada)'}`);
  } else if (x.t == 'g') {
    ic = 'target'; ti = (x.v >= 0 ? 'Aporte: ' : 'Retiro: ') + (goal ? esc(goal.name) : '(meta borrada)'); amt = (x.v >= 0 ? '' : '−') + money(Math.abs(x.v)); cls = x.v >= 0 ? 'in' : 'out';
    open = `openContribForm('${x.goalId}','${x.id}')`; if (acc) sub.push(esc(acc.name));
  } else if (x.t == 'st') {
    ic = 'users'; ti = `Saldo: ${esc(x.w)} → ${esc(x.to)}`; amt = money(x.v); cls = ''; open = `openSettle(null,null,null,'${x.id}')`;
  } else {
    ic = icoFor(x.c, x.t); ti = esc(x.c) + (x.sub ? ' · ' + esc(x.sub) : ''); amt = (x.t == 'i' ? '+' : '−') + money(x.v); cls = x.t == 'i' ? 'in' : 'out'; open = `openForm('${x.id}')`;
    if (acc) sub.push(esc(acc.name));
  }
  if (x.w && x.t != 'st') sub.push(esc(x.w) + (x.split ? ' · ' + esc(splitLabel(x)) : ''));
  if (x.byName && x.byName != x.w) sub.push('por ' + esc(x.byName));
  if (x.cu && x.cu != 'DOP' && (x.t == 'i' || x.t == 'e')) sub.push(money(x.a, x.cu));
  if (x.n) sub.push(esc(x.n));
  return `<div class="row${gone ? ' gone' : ' tap'}"${gone ? '' : ` onclick="${open}"`}>${circ(x.c || x.t, ic)}
<div><b>${ti}</b><small>${sub.join(' · ')}${gone ? ' · borrado' : ''}</small></div>
<b class="${cls} num">${amt}</b>${gone ? `<button onclick="restoreTx('${x.id}')">Restaurar</button>` : ''}</div>`;
}

// ============ Inicio ============
function alertsHTML() {
  const td = today(), out = [];
  const pend = pendingRecurring();
  pend.slice(0, 4).forEach(q => {
    const r = recs.find(x => x.id == q.recId); if (!r) return; const dl = dueLabel(q.date);
    out.push(`<div class="alert">${circ(r.name, recIcon(r))}<div><b>${esc(r.name)}</b><small>${money(r.amount, r.currency)} · ${fdate(q.date)} ${pill(dl.t, dl.k || 'warn')}</small></div><button class="p" onclick="confirmRec('${q.recId}','${q.date}')">Confirmar</button></div>`);
  });
  if (pend.length > 4) out.push(`<button class="link" onclick="go('rec')">Ver los ${pend.length} pendientes</button>`);
  accs.forEach(a => {
    const cy = cardCycle(a); if (!cy || cy.left <= 0 || cy.days > 10) return; const dl = dueLabel(cy.pay);
    out.push(`<div class="alert">${circ(a.name, 'credit-card')}<div><b>Pagar ${esc(a.name)}</b><small>${money(cy.left, a.currency)} del corte del ${fdate(cy.cut)} · pago ${fdate(cy.pay)} ${pill(dl.t, dl.k || '')}</small></div><button onclick="openTransferForm(null,'${a.id}',${cy.left})">Pagar</button></div>`);
  });
  const soon = [];
  recs.filter(r => r.active !== false).forEach(r => nextDates(r, maxISO(addDay(td), recFrom(r)), addDays(td, 7)).filter(d => !(r.done || []).includes(d)).forEach(d => soon.push({ r, d })));
  soon.sort((x, y) => x.d.localeCompare(y.d)).slice(0, 4).forEach(({ r, d }) => { const dl = dueLabel(d); out.push(`<div class="alert">${circ(r.name, recIcon(r))}<div><b>${esc(r.name)}</b><small>${fdate(d)} ${pill(dl.t, dl.k)}</small></div><b class="num">${money(r.amount, r.currency)}</b></div>`); });
  settlements().forEach(s => out.push(`<div class="alert">${circ(s.from, 'users')}<div><b>${esc(s.from)} le debe a ${esc(s.to)}</b><small>Gastos compartidos · ${money(s.amount)}</small></div><button onclick="go('shared')">Ver</button></div>`));
  const ym = td.slice(0, 7), b = budgetFor(ym), cs = grp(txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), 'c');
  Object.entries(b.cats || {}).filter(([c, l]) => l > 0 && (cs[c] || 0) / l >= 0.8).forEach(([c, l]) => {
    const p = Math.round((cs[c] || 0) / l * 100);
    out.push(`<div class="alert">${circ(c, icoFor(c, 'e'))}<div><b>${esc(c)}: ${p}% del tope</b><small>${money(cs[c] || 0)} de ${money(l)}</small>${bar(p, barCol(p >= 100 ? 'out' : 'yellow'))}</div></div>`);
  });
  try {
    projection(30).negatives.forEach(n => out.push(`<div class="alert">${circ(n.acc.name, 'alert-triangle')}<div><b>${esc(n.acc.name)} quedaría en negativo</b><small>${n.now ? 'Ya está en negativo' : 'Desde el ' + fdate(n.d) + ' con tus recurrentes'} · hasta ${money(n.v, n.acc.currency)}</small></div><button onclick="go('plan')">Ver</button></div>`));
  } catch (e) { console.error(e); }
  out.push(backupAlert());
  return out.join('');
}
function renderHome(app) {
  const td = today(), ym = td.slice(0, 7), me = myPerson();
  const cards = {
    saldo: () => {
      const tot = totalsByCurrency(), dop = tot.DOP || { disp: 0, deuda: 0, neto: 0 }, others = Object.entries(tot).filter(([c]) => c != 'DOP'), nw = others.length ? netWorthApprox() : null;
      return `<div class="card hero"><small>Disponible en pesos</small><div class="big">${money(dop.disp)}</div>
<div class="split"><div><small>Patrimonio neto</small><b>${money(nw ? nw.total : dop.neto)}${nw ? '*' : ''}</b></div><div><small>Deuda en tarjetas</small><b>${money(dop.deuda)}</b></div></div>
${others.map(([c, t]) => `<small style="display:block;margin-top:6px">En ${c}: ${money(t.disp, c)} disponible${t.deuda ? ' · deuda ' + money(t.deuda, c) : ''}</small>`).join('')}
${nw ? `<small style="display:block;margin-top:2px">* Todo convertido a pesos${nw.missing.length ? ' (sin tasa para ' + nw.missing.join(', ') + ')' : ''}</small>` : ''}</div>`;
    },
    alcanza: () => alcanzaCard(false),
    atajos: () => atajosCard(),
    mes: () => {
      const st = monthStats(ym), b = budgetFor(ym), bst = budgetStatus(st.exp, b.total);
      const dim = +monthEnd(ym).slice(8, 10), dd = +td.slice(8, 10), pace = Math.round(dd / dim * 100), left = b.total - st.exp;
      const col = bst ? barCol(bst.level) : 'var(--brand)', pct = bst ? Math.min(100, bst.pct) : 0;
      return `<div class="card"><h2><i class="icon-pie-chart"></i> ${ymLabel(ym)[0].toUpperCase() + ymLabel(ym).slice(1)}</h2>
<div class="month"><div class="ring" style="background:conic-gradient(${col} ${pct}%,var(--soft) 0)"><div>${bst ? bst.pct + '%' : '—'}</div></div>
<div style="min-width:0;flex:1"><small class="mut">${b.total ? (left >= 0 ? 'Te queda para gastar' : 'Te pasaste por') : 'Gastado este mes'}</small>
<div class="num" style="font-size:24px;font-weight:800;color:${left < 0 && b.total ? 'var(--out)' : 'var(--ink)'}">${money(b.total ? Math.abs(left) : st.exp)}</div>
<small class="mut">${b.total ? money(st.exp) + ' de ' + money(b.total) : `<button class="link" onclick="go('bud')">Define un tope</button>`}</small></div></div>
<div style="margin-top:12px"><small class="mut">Día ${dd} de ${dim}${bst && bst.pct > pace + 10 ? ' · <b class="warn">vas más rápido que el mes</b>' : ''}</small>${bar(pace, 'var(--brand)')}</div>
<div class="trio"><div><small>Ingresos</small><b class="in">${money(st.inc)}</b></div><div><small>Egresos</small><b class="out">${money(st.exp)}</b></div><div><small>Ahorro</small><b>${st.rate == null ? '—' : st.rate + '%'}</b></div></div></div>`;
    },
    alertas: () => { const al = alertsHTML(); return `<div class="card"><h2><i class="icon-calendar"></i> Pendientes y alertas</h2>${al || '<p class="mut" style="margin:0">Todo tranquilo: nada pendiente ni cerca del límite.</p>'}</div>`; },
    promedio: () => promedioCard(),
    metas: () => goals.length ? `<div class="card"><h2><i class="icon-target"></i> Metas</h2>${goals.map(g => { const p = goalProgress(g), c = accentFor(g.name); return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(g.name)}</b><span class="num" style="color:var(--${c});font-weight:700">${p.pct}%</span></div>${bar(p.pct, `var(--${c})`)}<small class="mut">${money(p.saved)} de ${money(g.target)}</small></div>`; }).join('')}<button class="link" onclick="go('goal')">Ver metas</button></div>` : '',
    recientes: () => {
      const recent = txs.slice().sort((p, q) => q.d.localeCompare(p.d) || (q.cr || 0) - (p.cr || 0)).slice(0, 5);
      return `<div class="card"><h2><i class="icon-list"></i> Últimos movimientos</h2>${recent.length ? recent.map(x => histRow(x)).join('') + `<button class="link" onclick="go('hist')">Ver historial</button>` : '<p class="empty">Aún no hay movimientos. Toca “+ Movimiento” para empezar.</p>'}</div>`;
    }
  };
  const body = homeLayout().filter(c => c.on && cards[c.id]).map(c => { try { return cards[c.id](); } catch (e) { console.error(e); return `<div class="card"><p class="warnline" style="margin:0">No se pudo mostrar esta tarjeta: ${esc(e.message)}</p></div>`; } }).join('');
  app.innerHTML = `${head(`<span class="hello"><img class="crest-sm" src="icons/escudo-mini.webp" alt="">${me ? 'Hola, ' + esc(me) : 'Inicio'}</span>`)}
${body}
<div class="seg" style="margin-top:4px"><button onclick="go('rep')"><i class="icon-bar-chart-3"></i> Reportes</button><button onclick="go('plan')"><i class="icon-calendar-days"></i> Planificar</button></div>
<button class="link" style="margin:6px auto 0;display:flex" onclick="openHomeEdit()"><i class="icon-sliders"></i> Personalizar Inicio</button>`;
}

// ============ Reportes ============
function renderRep(app) {
  const ym = repYm, st = monthStats(ym), pv = monthStats(addMonths(ym, -1));
  const d = (a, b, goodUp) => { const p = pctChange(a, b); if (p == null) return ''; const good = goodUp ? p >= 0 : p <= 0; return `<span class="delta ${good ? 'in' : 'out'}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p)}% vs mes anterior</span>`; };
  const E = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), ec = Object.entries(grp(E, 'c')).sort((x, y) => y[1] - x[1]);
  const a = fl();
  app.innerHTML = `${head('Reportes', true)}
<div class="card"><div class="add" style="align-items:center"><button class="iconbtn" aria-label="Mes anterior" onclick="repYm=addMonths(repYm,-1);render()"><i class="icon-chevron-left"></i></button>
<b style="flex:1;text-align:center;text-transform:capitalize">${ymLabel(ym)}</b><button class="iconbtn" aria-label="Mes siguiente" onclick="repYm=addMonths(repYm,1);render()"><i class="icon-chevron-right"></i></button></div></div>
<div class="kp"><div><small>Ingresos</small><b class="in">${money(st.inc)}</b>${d(st.inc, pv.inc, true)}</div><div><small>Egresos</small><b class="out">${money(st.exp)}</b>${d(st.exp, pv.exp, false)}</div>
<div><small>Ahorro del mes</small><b class="${st.net < 0 ? 'out' : ''}">${money(st.net)}</b></div><div><small>Tasa de ahorro</small><b>${st.rate == null ? '—' : st.rate + '%'}</b><span class="delta mut">${pv.rate == null ? '' : 'antes ' + pv.rate + '%'}</span></div></div>
<div class="card"><h2>Ingresos, egresos y ahorro (12 meses)</h2><canvas id="c-trend"></canvas></div>
<div class="card"><h2>Patrimonio neto (12 meses)</h2><canvas id="c-nw"></canvas><p class="mini" style="margin:6px 0 0">En pesos, convirtiendo otras monedas con tu tasa de referencia o la última conocida.</p></div>
<div class="grid"><div class="card"><h2>Egresos por categoría</h2>${ec.length ? `<canvas id="c-pie"></canvas><div id="catlist"></div>` : '<p class="empty">Sin egresos este mes.</p>'}</div>
<div class="card"><h2>Este mes vs el anterior</h2><canvas id="c-cmp"></canvas></div></div>
${compareTable(ym)}
<div class="card"><h2>Por persona</h2><canvas id="c-person"></canvas></div>
<details class="card"${F.open ? ' open' : ''}><summary>Explorar con filtros ›</summary><div style="margin-top:10px">${fbar(false)}</div>
${a.length ? `<canvas id="c1" style="margin-top:12px"></canvas>` : '<p class="empty">No hay movimientos con estos filtros.</p>'}</details>`;
  if (noCharts()) return;
  const { V, o, pal } = chartBase();
  const months = [...Array(12)].map((_, i) => addMonths(ym, i - 11)), S = months.map(monthStats);
  ch.push(new Chart($('c-trend'), { data: { labels: months.map(m => MES3[+m.slice(5, 7) - 1]), datasets: [{ type: 'bar', label: 'Ingresos', data: S.map(s => s.inc), backgroundColor: V('--in'), borderRadius: 4 }, { type: 'bar', label: 'Egresos', data: S.map(s => s.exp), backgroundColor: V('--out'), borderRadius: 4 }, { type: 'line', label: 'Ahorro', data: S.map(s => s.net), borderColor: V('--brand'), backgroundColor: V('--brand'), tension: .3 }] }, options: o }));
  const td = today(), nw = months.map(m => netWorthApprox(m >= td.slice(0, 7) ? td : monthEnd(m)).total);
  ch.push(new Chart($('c-nw'), { type: 'line', data: { labels: months.map(m => MES3[+m.slice(5, 7) - 1]), datasets: [{ label: 'Patrimonio', data: nw, borderColor: V('--brand'), backgroundColor: V('--brand') + '22', fill: true, tension: .3 }] }, options: { ...o, plugins: { ...o.plugins, legend: { display: false } } } }));
  if (ec.length) {
    const colors = ec.map((_, i) => pal[i % pal.length]), tot = ec.reduce((s, x) => s + x[1], 0);
    ch.push(new Chart($('c-pie'), { type: 'doughnut', data: { labels: ec.map(x => x[0]), datasets: [{ data: ec.map(x => x[1]), backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, aspectRatio: 1.6, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ': ' + money(c.raw) } } } } }));
    $('catlist').innerHTML = ec.map(([n, v], i) => `<div class="row tap" data-n="${esc(n)}" onclick="F={c:this.dataset.n,t:'e',f:'${ym}-01',u:'${monthEnd(ym)}',open:true};go('hist')"><div class="circ" style="background:${colors[i]}22;color:${colors[i]}"><i class="icon-${icoFor(n, 'e')}"></i></div><div><b>${esc(n)}</b><small>${Math.round(v / tot * 100)}%</small></div><b class="num">${money(v)}</b></div>`).join('');
  }
  const g1 = grp(E, 'c'), g0 = grp(txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == addMonths(ym, -1)), 'c');
  const cats = [...new Set([...Object.keys(g1), ...Object.keys(g0)])].sort((x, y) => (g1[y] || 0) - (g1[x] || 0)).slice(0, 7);
  ch.push(new Chart($('c-cmp'), { type: 'bar', data: { labels: cats, datasets: [{ label: 'Mes anterior', data: cats.map(k => g0[k] || 0), backgroundColor: V('--line'), borderRadius: 4 }, { label: ymLabel(ym), data: cats.map(k => g1[k] || 0), backgroundColor: V('--brand'), borderRadius: 4 }] }, options: { ...o, indexAxis: 'y', scales: { x: { ticks: { callback: axisFmt } } } } }));
  const byCat = grp(E, 'c'), pc = Object.keys(byCat).sort((x, y) => byCat[y] - byCat[x]).slice(0, 7);
  const pp = [...new Set([...cfg.people, ...E.map(x => x.w).filter(Boolean)])];
  ch.push(new Chart($('c-person'), { type: 'bar', data: { labels: pc, datasets: pp.map((n, i) => ({ label: n, data: pc.map(k => E.filter(x => x.c == k && x.w == n).reduce((s, x) => s + x.v, 0)), backgroundColor: pal[i % pal.length], borderRadius: 4 })).filter(ds => ds.data.some(v => v > 0)) }, options: { ...o, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: axisFmt } } } } }));
  if (a.length && $('c1')) {
    const ms = [...new Set(a.map(x => x.d.slice(0, 7)))].sort(), mi = ms.map(m => sum(a.filter(x => x.d.slice(0, 7) == m), 'i')), me = ms.map(m => sum(a.filter(x => x.d.slice(0, 7) == m), 'e'));
    let acc = 0; const bal = ms.map((m, i) => acc += mi[i] - me[i]);
    ch.push(new Chart($('c1'), { data: { labels: ms, datasets: [{ type: 'bar', label: 'Ingresos', data: mi, backgroundColor: V('--in'), borderRadius: 4 }, { type: 'bar', label: 'Egresos', data: me, backgroundColor: V('--out'), borderRadius: 4 }, { type: 'line', label: 'Balance acumulado', data: bal, borderColor: V('--brand'), backgroundColor: V('--brand'), tension: .25 }] }, options: o }));
  }
}

// ============ Historial ============
function renderHist(app) {
  const n = activeFilters();
  app.innerHTML = `${head('Historial')}
<div class="add" style="margin-bottom:10px"><div class="search"><i class="icon-search"></i><input id="q" type="search" placeholder="Buscar: súper, Netflix, 1500…" value="${esc(F.q || '')}" oninput="F.q=this.value;histList()" autocomplete="off"></div>
<button class="${n ? 'p' : ''}" onclick="F.open=!F.open;render()"><i class="icon-sliders"></i> Filtros${n ? ' (' + n + ')' : ''}</button></div>
${F.open ? `<div class="card">${fbar(true)}<label class="toggle" style="margin-top:10px"><input type="checkbox" ${F.showDel ? 'checked' : ''} onchange="F.showDel=this.checked;render()"> Mostrar movimientos borrados</label></div>` : ''}
<div id="hlist"></div>`;
  histList();
}
function histList() {
  const el = $('hlist'); if (!el) return;
  const all = [...txs.filter(histMatch).map(x => ({ x, g: 0 })), ...(F.showDel ? trash.filter(histMatch).map(x => ({ x, g: 1 })) : [])].sort((p, q) => q.x.d.localeCompare(p.x.d) || (q.x.cr || 0) - (p.x.cr || 0));
  const shown = all.slice(0, F.lim || 200), live = all.filter(r => !r.g).map(r => r.x);
  const inc = sum(live, 'i'), exp = sum(live, 'e');
  let html = '', day = '';
  for (const { x, g } of shown) {
    if (x.d != day) {
      day = x.d; const dl = live.filter(y => y.d == day), net = sum(dl, 'i') - sum(dl, 'e');
      html += `<div class="dayhead"><span>${fday(day)}</span><span class="num ${net > 0 ? 'in' : net < 0 ? 'out' : ''}">${net ? (net > 0 ? '+' : '−') + money(Math.abs(net)) : ''}</span></div>`;
    }
    html += histRow(x, g);
  }
  el.innerHTML = all.length ? `<p class="mini" style="margin:0 0 8px">${all.length} movimiento${all.length > 1 ? 's' : ''} · <span class="in">+${money(inc)}</span> · <span class="out">−${money(exp)}</span></p>
<div class="card">${html}${all.length > shown.length ? `<button class="link" onclick="F.lim=(F.lim||200)+200;histList()">Ver más (${all.length - shown.length})</button>` : ''}</div>`
    : `<p class="empty">${F.q ? 'Nada coincide con “' + esc(F.q) + '”.' : 'Sin movimientos con estos filtros.'}</p>`;
}

// ============ Cuentas ============
function renderAcc(app) {
  const asOf = F.accAsOf || undefined, tot = totalsByCurrency(asOf);
  app.innerHTML = `${head('Cuentas')}
<div class="kp">${(Object.keys(tot).length ? Object.entries(tot) : [['DOP', { disp: 0, deuda: 0 }]]).map(([c, t]) => `<div><small>Disponible ${c}${asOf ? ' al ' + fdate(asOf) : ''}</small><b>${money(t.disp, c)}</b></div>${accs.some(a => isCard(a) && a.currency == c) ? `<div><small>Deuda tarjetas ${c}</small><b class="out">${money(t.deuda, c)}</b></div>` : ''}`).join('')}</div>
${accs.length ? accs.slice().sort((a, b) => (isCard(a) - isCard(b)) || a.name.localeCompare(b.name)).map(accCard).join('') : '<p class="empty">Aún no tienes cuentas. Agrega la primera.</p>'}
<div class="seg" style="margin-top:4px"><button class="p" onclick="openAccForm()"><i class="icon-plus"></i> Agregar cuenta</button>${accs.length >= 2 ? `<button onclick="openTransferForm()"><i class="icon-arrow-left-right"></i> Transferir</button>` : ''}</div>
<details class="card" style="margin-top:12px"${asOf ? ' open' : ''}><summary>Ver saldos a otra fecha ›</summary><div class="add" style="margin-top:8px"><input type="date" value="${esc(asOf || '')}" onchange="F.accAsOf=this.value;render()">${asOf ? `<button onclick="F.accAsOf='';render()">Hoy</button>` : ''}</div></details>`;
}
function accCard(a) {
  const asOf = F.accAsOf || undefined, bal = acctBalance(a, asOf), card = isCard(a), e = earm(a), cy = asOf ? null : cardCycle(a);
  const early = txs.filter(x => (x.accId == a.id || x.accIdTo == a.id) && a.openDate && x.d < a.openDate).length;
  const meta = [];
  if (a.note) meta.push(pill(a.note));
  if (e > 0) meta.push(pill('Metas ' + money(e)), pill('Libre ' + money(bal - e), 'in'));
  if (card && a.cutDay && a.payDay) meta.push(pill(`Corte día ${a.cutDay} · pago día ${a.payDay}`));
  if (cy) { const dl = dueLabel(cy.pay); meta.push(cy.debtAtCut <= 0 ? pill('Sin saldo al corte', 'in') : cy.left <= 0 ? pill('Corte pagado ✓', 'in') : pill(`Pagar ${money(cy.left, a.currency)} · ${dl.t.toLowerCase()}`, dl.k || 'warn')); }
  return `<div class="card acc" onclick="openAccForm('${a.id}')"><div class="head">${circ(a.name, acctIcon(a.type))}
<div><b>${esc(a.name)}</b><small class="mut">${esc(a.type)} · ${a.currency}</small></div>
<div class="bal"><b class="${bal < 0 && !card ? 'out' : card && bal < 0 ? 'out' : ''}">${money(card ? Math.abs(bal) : bal, a.currency)}</b><small class="mut">${card ? (bal < 0 ? 'debes' : 'a favor') : 'disponible'}</small></div></div>
${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
${early ? `<small class="warnline" style="margin-top:8px">⚠ ${early} movimiento${early > 1 ? 's' : ''} con fecha anterior a la apertura (${fdate(a.openDate, 1)}) no cuenta${early > 1 ? 'n' : ''} en el saldo.</small>` : ''}
<div class="acts" onclick="event.stopPropagation()"><button onclick="openAdj('${a.id}')">Ajustar saldo</button><button onclick="F={acc:'${a.id}'};go('hist')">Movimientos</button>${card && cy && cy.left > 0 ? `<button class="p" onclick="openTransferForm(null,'${a.id}',${cy.left})">Pagar</button>` : ''}</div></div>`;
}

// ============ Presupuesto ============
function renderBud(app) {
  const ym = budYm, monthTx = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), spentTotal = monthTx.reduce((s, x) => s + x.v, 0);
  const b = budgetFor(ym), st = budgetStatus(spentTotal, b.total), ov = (cfg.budgetOverrides || {})[ym] || {};
  const catNames = [...new Set([...cfg.cats.filter(c => c.t == 'e').map(c => c.n), ...Object.keys(b.cats)])];
  const mesTxt = ymLabel(ym);
  app.innerHTML = `${head('Presupuesto')}
<div class="card"><div class="add" style="align-items:center"><button class="iconbtn" aria-label="Mes anterior" onclick="budYm=addMonths(budYm,-1);render()"><i class="icon-chevron-left"></i></button>
<b style="flex:1;text-align:center;text-transform:capitalize">${mesTxt}</b><button class="iconbtn" aria-label="Mes siguiente" onclick="budYm=addMonths(budYm,1);render()"><i class="icon-chevron-right"></i></button></div></div>
<div class="card"><h2>Total del mes</h2>
${st ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="num">${money(spentTotal)} de ${money(b.total)}</span><b style="color:${barCol(st.level)}">${st.pct}%</b></div>${bar(st.pct, barCol(st.level))}
${st.level == 'out' ? '<p class="out" style="margin:8px 0 0;font-size:13px">Te pasaste del presupuesto de este mes.</p>' : st.level == 'yellow' ? '<p class="warn" style="margin:8px 0 0;font-size:13px">Vas llegando al límite (80% o más).</p>' : ''}`
      : `<p class="mut" style="margin:0">${money(spentTotal)} gastado. Aún no hay tope para este mes.</p>`}
<div class="add" style="margin-top:12px"><label style="flex:1">Tope base, todos los meses (DOP)<input type="number" inputmode="decimal" step="0.01" min="0" value="${cfg.budgetTotal || ''}" id="bt-base"></label><button class="p" style="align-self:flex-end" onclick="setBudgetBase($('bt-base').value)">Guardar</button></div>
<div class="add" style="margin-top:8px"><label style="flex:1">Solo para ${mesTxt} (opcional)<input type="number" inputmode="decimal" step="0.01" min="0" value="${ov.total ?? ''}" id="bt-mes" placeholder="Usa el base"></label><button style="align-self:flex-end" onclick="setBudgetMonth('${ym}',$('bt-mes').value)">Guardar</button></div>
${ov.total != null ? `<button class="link" style="color:var(--out)" onclick="setBudgetMonth('${ym}','')">Quitar excepción de ${mesTxt}</button>` : ''}</div>
<div class="card"><h2>Por categoría</h2>
<div class="seg sm" style="margin-bottom:8px"><button type="button" class="${budMode == 'base' ? 'on' : ''}" onclick="budMode='base';render()">Límites base</button><button type="button" class="${budMode == 'mes' ? 'on' : ''}" onclick="budMode='mes';render()">Solo ${mesTxt}</button></div>
<p class="mini" style="margin:0 0 6px">${budMode == 'base' ? 'Aplican a todos los meses. Deja vacío para quitar el límite.' : 'Solo este mes. Vacío = usar el base; 0 = sin límite este mes.'}</p>
${catNames.map(n => {
    const spent = monthTx.filter(x => x.c == n).reduce((s, x) => s + x.v, 0), lim = b.cats[n], s2 = budgetStatus(spent, lim);
    const val = budMode == 'base' ? (cfg.budgetCats || {})[n] : (b.catOverrides || {})[n], hasOv = (b.catOverrides || {})[n] != null;
    return `<div class="row" style="flex-wrap:wrap">${circ(n, icoFor(n, 'e'))}
<div><b>${esc(n)}</b><small>${lim ? money(spent) + ' de ' + money(lim) : money(spent) + ' · sin límite'}${hasOv && budMode == 'base' ? ' · este mes tiene excepción' : ''}</small></div>
<input type="number" inputmode="decimal" step="0.01" min="0" placeholder="${budMode == 'base' ? 'Límite' : 'Base: ' + ((cfg.budgetCats || {})[n] ?? '—')}" value="${val ?? ''}" style="width:110px" data-n="${esc(n)}" onchange="setBudgetCat('${ym}',this.dataset.n,this.value)">
${s2 ? `<div style="flex-basis:100%;padding-left:54px">${bar(s2.pct, barCol(s2.level))}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

// ============ Más ============
function renderMore(app) {
  const pend = pendingRecurring().length;
  const tile = (t, ic, title, sub, badge) => `<button class="tile" onclick="go('${t}')"><div class="circ tint" style="--c:var(--brand)"><i class="icon-${ic}"></i>${badge ? `<span class="badge">${badge}</span>` : ''}</div><div><b>${title}</b><br><small>${sub}</small></div></button>`;
  const st = settlements();
  app.innerHTML = `${head('Más')}<div class="card crest-card"><img src="icons/escudo.webp" alt="${esc(MARCA.nombre ? 'Escudo ' + MARCA.nombre : 'Escudo')}" loading="lazy"></div><div class="tiles">
${tile('plan', 'calendar-days', 'Planificar', 'Te alcanza, proyección y calendario')}
${tile('rep', 'bar-chart-3', 'Reportes', 'Gráficas y resumen mensual')}
${tile('rec', 'repeat', 'Recurrentes', pend ? pend + ' por confirmar' : 'Pagos, ingresos y aportes fijos', pend)}
${tile('goal', 'target', 'Metas', goals.length ? goals.length + ' meta' + (goals.length > 1 ? 's' : '') : 'Ahorra para algo')}
${tile('shared', 'users', 'Cuentas claras', st.length ? esc(st[0].from) + ' debe ' + money(st[0].amount) : 'Gastos compartidos al día')}
${tile('set', 'settings', 'Ajustes', 'Nube, seguridad, atajos, categorías')}
${tile('trash', 'archive', 'Papelera', (() => { const n = trashItems().length; return n ? n + ' en los últimos ' + KEEP_DAYS + ' días' : 'Recupera lo que borraste'; })())}</div>`;
}

// ============ Recurrentes ============
const REC_T = { i: 'Ingreso', e: 'Egreso', g: 'Aporte a meta', tr: 'Transferencia' };
const recIcon = r => (r.t == 'g' ? 'target' : r.t == 'tr' ? 'arrow-left-right' : icoFor(r.c, r.t));
function recDesc(r) {
  const a = accs.find(x => x.id == r.accId), b = accs.find(x => x.id == r.accIdTo), g = goals.find(x => x.id == r.goalId);
  const what = r.t == 'g' ? `${a ? esc(a.name) : '?'} → ${g ? esc(g.name) : '(meta borrada)'}` : r.t == 'tr' ? `${a ? esc(a.name) : '?'} → ${b ? esc(b.name) : '?'}` : esc(r.c) + (r.sub ? ' · ' + esc(r.sub) : '');
  return `${what} · ${freqLabel[r.freq] || ''} · ${esc(dayLabel(r))}${r.cutDay ? ' · corte día ' + r.cutDay : ''}`;
}
function renderRec(app) {
  const pend = pendingRecurring();
  app.innerHTML = `${head('Recurrentes', true)}
${pend.length ? `<div class="card"><h2>Por confirmar (${pend.length})</h2>${pend.map(p => {
    const r = recs.find(x => x.id == p.recId); if (!r) return ''; const dl = dueLabel(p.date);
    return `<div class="row prow">${circ(r.name, recIcon(r))}<div><b>${esc(r.name)}</b><small>${fdate(p.date)} · ${money(r.amount, r.currency)} ${pill(dl.t, dl.k || 'warn')}</small></div>
<div class="acts2"><button onclick="skipRec('${r.id}','${p.date}')">Omitir</button><button class="p" onclick="confirmRec('${r.id}','${p.date}')">Confirmar</button></div></div>`;
  }).join('')}</div>` : ''}
<div class="card"><h2>Todos</h2>${recs.length ? recs.slice().sort((a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name)).map(r => {
    const nx = r.active === false ? null : nextDates(r, maxISO(today(), recFrom(r)), addDays(today(), 400)).find(d => !(r.done || []).includes(d));
    return `<div class="row tap" onclick="openRecForm('${r.id}')">${circ(r.name, recIcon(r))}
<div><b>${esc(r.name)} ${r.active === false ? pill('Pausado') : pill(REC_T[r.t] || '')}</b><small>${recDesc(r)}${nx ? ' · próximo ' + fdate(nx) : ''}</small></div><b class="num">${money(r.amount, r.currency)}</b></div>`;
  }).join('') : '<p class="empty">Aún no tienes recurrentes: alquiler, luz, internet, salario o un aporte quincenal a una meta.</p>'}</div>
<button class="p" style="width:100%" onclick="openRecForm()"><i class="icon-plus"></i> Agregar recurrente</button>`;
}

// ============ Metas ============
function renderGoal(app) {
  app.innerHTML = `${head('Metas', true)}
${goals.length ? goals.map(g => {
    const p = goalProgress(g), proj = goalProjection(g), col = accentFor(g.name), acc = accs.find(a => a.id == g.accId);
    const m = txs.filter(x => x.t == 'g' && x.goalId == g.id).sort((a, b) => b.d.localeCompare(a.d) || (b.u || 0) - (a.u || 0)).slice(0, 6);
    const rr = recs.filter(r => r.t == 'g' && r.goalId == g.id && r.active !== false);
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="min-width:0"><h2 style="margin:0">${esc(g.name)}</h2><small class="mut">${acc ? 'En ' + esc(acc.name) : '⚠ Sin cuenta: edítala y átala a una'}${g.note ? ' · ' + esc(g.note) : ''}</small></div><button class="iconbtn" aria-label="Editar meta" onclick="openGoalForm('${g.id}')"><i class="icon-pencil"></i></button></div>
<div style="display:flex;justify-content:space-between;margin:12px 0 6px"><span class="num">${money(p.saved)} de ${money(g.target)}</span><b style="color:var(--${col})">${p.pct}%</b></div>${bar(p.pct, `var(--${col})`)}
<p class="mini" style="margin:8px 0 0">${p.remaining > 0 ? 'Faltan ' + money(p.remaining) : '¡Meta alcanzada! 🎉'}${proj && proj.monthsLeft > 0 ? ` · al ritmo de ~${money(proj.perMonth)}/mes, en ~${proj.monthsLeft} ${proj.monthsLeft == 1 ? 'mes' : 'meses'}` : ''}${rr.length ? ' · ' + rr.map(r => `aporte ${freqLabel[r.freq].toLowerCase()} de ${money(r.amount, r.currency)}`).join(', ') : ''}</p>
${m.length ? `<div style="margin-top:8px">${m.map(x => histRow(x)).join('')}</div>` : ''}
<div class="seg sm" style="margin-top:10px"><button class="p" onclick="openContribForm('${g.id}')"><i class="icon-plus"></i> Mover dinero</button><button onclick="openRecForm(null,{t:'g',goalId:'${g.id}',freq:'quincenal'})"><i class="icon-repeat"></i> Aporte automático</button></div></div>`;
  }).join('') : '<p class="empty">Aún no tienes metas. Crea la primera.</p>'}
<button class="p" style="width:100%" onclick="openGoalForm()"><i class="icon-plus"></i> Nueva meta</button>
${(() => {
      const orphan = txs.filter(x => x.t == 'g' && !goals.some(g => g.id == x.goalId)); if (!orphan.length) return '';
      const s = orphan.reduce((t, x) => t + x.v, 0);
      return `<div class="card" style="margin-top:12px"><h2>Aportes sin meta (${money(s)})</h2><p class="mini" style="margin:0 0 8px">Quedaron de metas que borraste. Reasígnalos o bórralos.</p>
${orphan.map(x => `<div class="row"><div><b class="num">${money(x.v)}</b><small>${fdate(x.d)} · ${esc(x.w)}${x.n ? ' · ' + esc(x.n) : ''}</small></div>
${goals.length ? `<select style="width:auto;flex:none" onchange="reassignContrib('${x.id}',this.value)"><option value="">Reasignar…</option>${goals.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>` : ''}
<button class="d" aria-label="Borrar" onclick="delTx('${x.id}')"><i class="icon-trash-2"></i></button></div>`).join('')}</div>`;
    })()}`;
}

// ============ Cuentas claras (gastos compartidos) ============
function renderShared(app) {
  const st = settlements(), net = sharedNet();
  const list = txs.filter(x => (x.t == 'e' && x.split) || x.t == 'st').sort((a, b) => b.d.localeCompare(a.d)).slice(0, 60);
  app.innerHTML = `${head('Cuentas claras', true)}
<div class="card"><h2><i class="icon-users"></i> Balance</h2>
${st.length ? st.map(s => `<div class="alert">${circ(s.from, 'users')}<div><b>${esc(s.from)} le debe a ${esc(s.to)}</b><small class="num">${money(s.amount)}</small></div><button class="p" data-f="${esc(s.from)}" data-t="${esc(s.to)}" onclick="openSettle(this.dataset.f,this.dataset.t,${s.amount})">Saldar</button></div>`).join('')
      : '<p class="mut" style="margin:0">Están a mano: nadie le debe a nadie. 🙌</p>'}
${Object.values(net).some(v => Math.abs(v) > 0.005) ? `<p class="mini" style="margin:8px 0 0">${Object.entries(net).filter(([p, v]) => Math.abs(v) > 0.005).map(([p, v]) => `${esc(p)}: ${v >= 0 ? 'le deben ' : 'debe '}${money(Math.abs(v))}`).join(' · ')}</p>` : ''}</div>
<p class="note" style="margin-bottom:12px">Al anotar un egreso, elige en <b>“¿Para quién?”</b>: <b>Compartido</b> (se divide entre todos) o <b>Para otra persona</b> (se lo debe completo a quien pagó). Los gastos personales no cuentan aquí.</p>
<div class="card"><h2>Gastos compartidos y saldos</h2>${list.length ? list.map(x => histRow(x)).join('') : '<p class="empty">Aún no hay gastos compartidos.</p>'}</div>
<button style="width:100%" onclick="openSettle()"><i class="icon-plus"></i> Registrar un pago entre ustedes</button>`;
}

// ============ Ajustes ============
function renderSet(app) {
  const me = myPerson();
  app.innerHTML = `${head('Ajustes', true)}
${cloudSection()}
${securitySection()}
<div class="card"><h2><i class="icon-users"></i> Personas</h2><p class="mini" style="margin:0 0 6px">Toca un nombre para cambiarlo (se actualiza en todos los movimientos) o borrarlo.</p>
<div class="tags">${cfg.people.map(p => `<button onclick="openPersonEdit(this.dataset.n)" data-n="${esc(p)}"><i class="icon-user"></i>${esc(p)}${p == me ? ' <span class="pill">tú</span>' : ''}</button>`).join('')}</div>
<div class="add"><input id="a-people" placeholder="Agregar persona…" onkeydown="if(event.key=='Enter')ad('people')"><button class="p" onclick="ad('people')">Agregar</button></div>
${cloudOn() ? '' : `<label style="margin-top:10px">Este teléfono es de (se elige solo en “Quién”)<select onchange="setMyPerson(this.value);render()"><option value="">Nadie en particular</option>${opts(cfg.people, me)}</select></label>`}</div>
${shortcutsSection()}
${catCard('Categorías de egreso', 'e')}${catCard('Categorías de ingreso', 'i')}
<div class="card"><h2><i class="icon-banknote"></i> Monedas y tasas</h2><p class="mini" style="margin:0 0 8px">La tasa de referencia se usa para convertir tus saldos en otras monedas al patrimonio, y como sugerencia en los formularios.</p>
${cfg.cur.map(c => `<div class="row"><div><b>${c}</b><small>Última tasa usada: ${rateOf(c) && rateOf(c) != refRate(c) ? rateOf(c) : '—'}</small></div><input type="number" inputmode="decimal" step="0.0001" min="0" style="width:120px" placeholder="1 ${c} = ? DOP" value="${(cfg.rates || {})[c] || ''}" onchange="setRefRate('${c}',this.value)"><button class="d" aria-label="Quitar ${c}" onclick="rm('cur','${c}')"><i class="icon-x"></i></button></div>`).join('')}
<div class="add" style="margin-top:8px"><input id="a-cur" placeholder="Código de 3 letras, ej: CAD" maxlength="3" autocapitalize="characters" onkeydown="if(event.key=='Enter')ad('cur')"><button class="p" onclick="ad('cur')">Agregar</button></div></div>
<div class="card"><h2><i class="icon-palette"></i> Apariencia</h2>
<small class="mut">Paleta de colores (solo en este teléfono)</small>
<div class="palgrid" style="margin:6px 0 12px">${Object.entries(PALETTES).map(([id, p]) => `<button type="button" class="${palette == id ? 'on' : ''}" onclick="setPalette('${id}')"><span class="sw">${p.sw.map(c => `<span style="background:${c}"></span>`).join('')}</span>${esc(p.name)}</button>`).join('')}</div>
<small class="mut">Modo</small><div class="seg sm" style="margin-top:6px">
<button type="button" class="${theme == 'claro' ? 'on' : ''}" onclick="setTheme('claro')"><i class="icon-sun"></i> Claro</button>
<button type="button" class="${theme == 'dark' ? 'on' : ''}" onclick="setTheme('dark')"><i class="icon-moon"></i> Oscuro</button>
<button type="button" class="${theme == 'auto' ? 'on' : ''}" onclick="setTheme('auto')"><i class="icon-monitor"></i> Auto</button></div></div>
<div class="card"><h2><i class="icon-download"></i> Respaldo y Excel</h2><p class="mini" style="margin:0 0 8px">Guarda una copia de todos tus datos, o exporta los ingresos y egresos a Excel (según los filtros del Historial).</p>
<div class="add" style="flex-wrap:wrap"><button class="p" onclick="bk()">Descargar respaldo</button><button onclick="cp()">Copiar respaldo</button><button onclick="xl()">Excel</button></div>
<details style="margin-top:10px"><summary>Importar un respaldo ›</summary>
<label style="margin-top:8px">Archivo<input type="file" accept=".json,application/json,text/plain" onchange="fi(this)"></label>
<label style="margin-top:8px">O pega el texto<textarea id="paste" rows="3"></textarea></label>
<div class="add" style="margin-top:8px;flex-wrap:wrap"><button class="p" onclick="merge($('paste').value,$('rp').checked)">Importar texto</button><label class="toggle"><input type="checkbox" id="rp">Reemplazar todo</label></div></details></div>
<div class="card"><h2 class="out"><i class="icon-trash-2"></i> Empezar de cero</h2><p class="mini" style="margin:0 0 8px">${cloudOn() ? 'Borra los datos del hogar en la nube y en todos sus teléfonos.' : 'Borra los datos de este teléfono.'} Descarga un respaldo antes.</p><button class="d" onclick="resetAll()">Borrar todos los datos</button></div>
<div class="add" style="flex-wrap:wrap;justify-content:center"><button class="link" onclick="go('trash')"><i class="icon-archive"></i> Papelera</button><button class="link" onclick="openHomeEdit()"><i class="icon-sliders"></i> Personalizar Inicio</button><button class="link" onclick="wz={step:0,force:true};go('welcome')"><i class="icon-sparkles"></i> Ver la bienvenida</button></div>
<p class="mini" style="text-align:center">Mis finanzas${MARCA.nombre ? ' · ' + esc(MARCA.nombre) : ''} · versión ${APP_VERSION}</p>`;
}
function catCard(title, t) {
  return `<div class="card"><h2><i class="icon-tag"></i> ${title}</h2><p class="mini" style="margin:0 0 6px">Toca una para renombrarla, cambiar su ícono o sus subcategorías.</p>
<div class="tags">${cfg.cats.filter(c => c.t == t).map(c => `<button onclick="openCatEdit('${t}',this.dataset.n)" data-n="${esc(c.n)}"><i class="icon-${esc(c.icon)}"></i>${esc(c.n)}${(cfg.subs || {})[c.n] && cfg.subs[c.n].length ? ` <span class="pill">${cfg.subs[c.n].length}</span>` : ''}</button>`).join('')}</div>
<button class="link" onclick="openCatEdit('${t}')"><i class="icon-plus"></i> Nueva categoría</button></div>`;
}
