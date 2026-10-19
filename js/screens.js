'use strict';
(window.__V = window.__V || {})['screens.js'] = '10.2.0';
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
// Las gráficas (Chart.js, 200 KB) se cargan solo cuando una pantalla las necesita: la app abre más rápido.
let chartLoad = null;
function noCharts() {
  if (typeof Chart != 'undefined') return false;
  if (chartLoad == 'ok') chartLoad = 'fail'; // cargó pero no trajo Chart
  if (!chartLoad) chartLoad = loadScript('vendor/chart.umd.js').then(() => { chartLoad = 'ok'; render(); }, () => { chartLoad = 'fail'; render(); });
  document.querySelectorAll('#app canvas').forEach(c => c.outerHTML = `<p class="empty">${chartLoad == 'fail' ? 'No se pudieron cargar las gráficas. Revisa tu conexión y vuelve a abrir esta pantalla.' : 'Cargando gráficas…'}</p>`);
  if (chartLoad == 'fail') chartLoad = null; // la próxima vez lo intenta de nuevo
  return true;
}

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
  } else if (x.t == 'dm') {
    const dbt = debts.find(q => q.id == x.debtId), who = dbt ? dbt.who : '(deuda borrada)', owe = dbt ? dbt.dir == 'owe' : x.a > 0;
    ic = 'hand-coins'; ti = x.kind == 'open' ? (owe ? 'Te prestó ' : 'Le prestaste a ') + esc(who) : (owe ? 'Pago a ' : 'Cobro a ') + esc(who);
    amt = (x.a > 0 ? '+' : x.a < 0 ? '−' : '') + money(Math.abs(x.v), x.cu || 'DOP'); cls = x.a > 0 ? 'in' : x.a < 0 ? 'out' : ''; open = dbt ? `openDebt('${dbt.id}')` : `go('debts')`;
    if (acc) sub.push(esc(acc.name)); else sub.push('sin cuenta');
  } else {
    ic = icoFor(x.c, x.t); ti = x.sub ? esc(x.sub) : esc(x.c); amt = (x.t == 'i' ? '+' : '−') + money(x.v); cls = x.t == 'i' ? 'in' : 'out'; open = `openForm('${x.id}')`;
    if (x.sub) sub.push(esc(x.c));
    if (acc) sub.push(esc(acc.name));
  }
  if (x.w && x.t != 'st' && x.t != 'dm') sub.push(esc(x.w) + (x.split ? ' · ' + esc(splitLabel(x)) : ''));
  if (x.byName && x.byName != x.w) sub.push('por ' + esc(x.byName));
  if (x.cu && x.cu != 'DOP' && (x.t == 'i' || x.t == 'e')) sub.push(money(x.a, x.cu));
  if (x.n) sub.push(esc(x.n));
  if ((x.tags || []).length) sub.push(x.tags.map(t => '#' + esc(t)).join(' '));
  return `<div class="row${gone ? ' gone' : ' tap'}"${gone ? '' : ` onclick="${open}"`}>${circ(x.c || x.t, ic)}
<div><b>${ti}${x.rev && !gone ? '<span class="revtag">revisar</span>' : ''}</b><small>${sub.join(' · ')}${gone ? ' · borrado' : ''}</small></div>
<b class="${cls} num">${amt}</b>${gone ? `<button onclick="restoreTx('${x.id}')">Restaurar</button>` : ''}</div>`;
}

// ============ Inicio ============
// Cada aviso de Inicio es { k, r, l, t, ic, ig, h }:
//   k = este aviso en particular (“Ignorar” lo esconde hasta que cambie: otro corte, otro mes, otra fecha)
//   r = la regla (“No volver a avisar” la silencia para siempre) y l su nombre para la lista de silenciados
//   t, ic = título e ícono para la hoja de opciones; ig = cuándo vuelve si lo ignoras; h = el HTML (%M% = botón ⋯)
const AL = (k, r, l, t, ic, ig, h) => ({ k, r, l, t, ic, ig, h });
const alRow = (body, extra) => `<div class="alert"${extra || ''}>${body}%M%</div>`;
function homeAlerts() {
  const td = today(), out = [];
  pendingRecurring().forEach(q => {
    const r = recs.find(x => x.id == q.recId); if (!r) return; const dl = dueLabel(q.date);
    out.push(AL(`pend:${r.id}:${q.date}`, 'pend:' + r.id, `Confirmar “${r.name}” (recurrente)`, r.name, recIcon(r), 'Sigue pendiente en Recurrentes. Vuelve a salir con el próximo pago.',
      alRow(`${circ(r.name, recIcon(r))}<div><b>${esc(r.name)}</b><small>${money(r.amount, r.currency)} · ${fdate(q.date)} ${pill(dl.t, dl.k || 'warn')}</small></div><button class="p" onclick="confirmRec('${q.recId}','${q.date}')">Confirmar</button>`)));
  });
  accs.forEach(a => {
    const cy = cardCycle(a); if (!cy || cy.left <= 0 || cy.days > 10) return; const dl = dueLabel(cy.pay);
    out.push(AL(`card:${a.id}:${cy.cut}`, 'card:' + a.id, `Pago de la tarjeta ${a.name}`, 'Pagar ' + a.name, 'credit-card', 'Vuelve a salir con el próximo corte.',
      alRow(`${circ(a.name, 'credit-card')}<div><b>Pagar ${esc(a.name)}</b><small>${money(cy.left, a.currency)} del corte del ${fdate(cy.cut)} · pago ${fdate(cy.pay)} ${pill(dl.t, dl.k || '')}</small></div><button onclick="openTransferForm(null,'${a.id}',${cy.left})">Pagar</button>`)));
  });
  const soon = [];
  recs.filter(r => r.active !== false).forEach(r => nextDates(r, maxISO(addDay(td), recFrom(r)), addDays(td, 7)).filter(d => !(r.done || []).includes(d)).forEach(d => soon.push({ r, d })));
  soon.sort((x, y) => x.d.localeCompare(y.d)).forEach(({ r, d }) => {
    const dl = dueLabel(d);
    out.push(AL(`soon:${r.id}:${d}`, 'soon:' + r.id, `Aviso antes de cada “${r.name}”`, r.name, recIcon(r), 'Vuelve a salir antes del próximo pago.',
      alRow(`${circ(r.name, recIcon(r))}<div><b>${esc(r.name)}</b><small>${fdate(d)} ${pill(dl.t, dl.k)}</small></div><b class="num">${money(r.amount, r.currency)}</b>`)));
  });
  settlements().forEach(s => out.push(AL(`set:${s.from}>${s.to}:${round2(s.amount)}`, `set:${s.from}>${s.to}`, `Gastos compartidos: ${s.from} le debe a ${s.to}`, `${s.from} le debe a ${s.to}`, 'users', 'Vuelve a salir si cambia el monto.',
    alRow(`${circ(s.from, 'users')}<div><b>${esc(s.from)} le debe a ${esc(s.to)}</b><small>Gastos compartidos · ${money(s.amount)}</small></div><button onclick="go('shared')">Ver</button>`))));
  const ym = td.slice(0, 7), b = budgetFor(ym), cs = grp(txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), 'c');
  Object.entries(b.cats || {}).filter(([c, l]) => l > 0 && (cs[c] || 0) / l >= 0.8).forEach(([c, l]) => {
    const p = Math.round((cs[c] || 0) / l * 100), lvl = p >= 100 ? 100 : 80;
    out.push(AL(`bud:${c}:${ym}:${lvl}`, 'bud:' + c, `Presupuesto de ${c}`, `${c}: ${p}% del tope`, icoFor(c, 'e'), lvl < 100 ? 'Vuelve a salir si llegas al 100% o el mes que viene.' : 'Vuelve a salir el mes que viene.',
      alRow(`${circ(c, icoFor(c, 'e'))}<div><b>${esc(c)}: ${p}% del tope</b><small>${money(cs[c] || 0)} de ${money(l)}</small>${bar(p, barCol(p >= 100 ? 'out' : 'yellow'))}</div>`, ` role="button" style="cursor:pointer" data-c="${esc(c)}" onclick="budYm='${ym}';openBudCat(this.dataset.c)"`)));
  });
  out.push(...debtAlerts());
  const ca = closeAlert(); if (ca) out.push(ca);
  try {
    projection(30).negatives.forEach(n => out.push(AL(`neg:${n.acc.id}:${n.now ? 'ya' : n.d}`, 'neg:' + n.acc.id, `Saldo negativo en ${n.acc.name}`, `${n.acc.name} quedaría en negativo`, 'alert-triangle', 'Vuelve a salir si cambia la fecha en que quedaría en negativo.',
      alRow(`${circ(n.acc.name, 'alert-triangle')}<div><b>${esc(n.acc.name)} quedaría en negativo</b><small>${n.now ? 'Ya está en negativo' : 'Desde el ' + fdate(n.d) + ' con tus recurrentes'} · hasta ${money(n.v, n.acc.currency)}</small></div><button onclick="go('plan')">Ver</button>`))));
  } catch (e) { console.error(e); }
  const bk = backupAlert(); if (bk) out.push(bk);
  return out;
}

// ---- ignorar / no volver a avisar: se guarda por persona (cfg.alertsOff[nombre]) y viaja con la nube del hogar ----
const AL_KEEP = 120; // días que se recuerda un aviso ignorado
const alWho = () => myPerson() || '_';
function alertPrefs() { const a = (cfg.alertsOff || {})[alWho()] || {}; return { mute: a.mute || {}, skip: a.skip || {} }; }
const alertOn = (a, p) => { p = p || alertPrefs(); return !p.mute[a.r] && !p.skip[a.k]; };
function setAlertPrefs(fn) {
  const all = deep(cfg.alertsOff || {}), cur = alertPrefs(), nx = { mute: { ...cur.mute }, skip: { ...cur.skip } }, lim = addDays(today(), -AL_KEEP);
  fn(nx);
  Object.keys(nx.skip).forEach(k => { if (!(nx.skip[k] >= lim)) delete nx.skip[k]; });
  if (Object.keys(nx.mute).length || Object.keys(nx.skip).length) all[alWho()] = nx; else delete all[alWho()];
  saveCfg({ ...cfg, alertsOff: all });
}
let alReg = [], menuAlert = null; // avisos en pantalla (el botón ⋯ los busca por número); se vacía en cada Inicio
const alMore = a => { alReg.push(a); return `<button type="button" class="almore" aria-label="Opciones de este aviso" onclick="event.stopPropagation();alertMenu(${alReg.length - 1})"><i class="icon-ellipsis"></i></button>`; };
const alertSkip = k => setAlertPrefs(p => { p.skip[k] = today(); });
function alertsHTML() {
  const all = homeAlerts(), p = alertPrefs(), vis = all.filter(a => alertOn(a, p));
  const pend = vis.filter(a => a.k.startsWith('pend:')), soon = vis.filter(a => a.k.startsWith('soon:'));
  const list = vis.filter(a => !(a.k.startsWith('pend:') && pend.indexOf(a) >= 4) && !(a.k.startsWith('soon:') && soon.indexOf(a) >= 4));
  const html = list.map(a => { const j = a.h.lastIndexOf('%M%'); return a.h.slice(0, j) + alMore(a) + a.h.slice(j + 3); }); // el último %M% (un nombre podría traer ese texto)
  if (pend.length > 4) html.splice(4, 0, `<button class="link" onclick="go('rec')">Ver los ${pend.length} pendientes</button>`);
  const hid = all.length - vis.length;
  if (html.length && hid) html.push(`<button class="link alhid" onclick="setSub='avisos';go('set')"><i class="icon-bell-off"></i> ${hid} aviso${hid > 1 ? 's' : ''} oculto${hid > 1 ? 's' : ''}</button>`);
  return html.join('');
}
function alertMenu(i) {
  const a = menuAlert = alReg[i]; if (!a) return; const tt = a.mt || a.t;
  dlg.innerHTML = `<div class="sheethd">${circ(tt, a.ic)}<div><b>${esc(tt)}</b><small>${a.ins ? 'Para ti' : 'Pendientes y alertas'}</small></div><button class="iconbtn" aria-label="Cerrar" onclick="dlg.close()"><i class="icon-x"></i></button></div>
<div class="list almenu"><button type="button" class="lrow" onclick="alertAct('skip')">${circ('ignorar', 'clock')}<div><b>Ignorar por ahora</b><small>${esc(a.ig)}</small></div></button>
<button type="button" class="lrow" onclick="alertAct('mute')">${circ('silenciar', 'bell-off')}<div><b>No volver a avisarme</b><small>${esc(a.l)}. Lo puedes reactivar en Ajustes → Avisos de Inicio.</small></div></button></div>
<p class="mini" style="margin:10px 2px 0">${alWho() == '_' ? 'Se guarda en este teléfono.' : `Solo para ${esc(alWho())}: a los demás del hogar les sigue saliendo.`}</p>
<div class="seg" style="margin-top:12px"><button type="button" onclick="dlg.close()">Cancelar</button></div>`;
  dlgShow();
}
function alertAct(how) {
  const a = menuAlert; if (!a) return; const before = alertPrefs(); menuAlert = null;
  if (a.snooze && how == 'skip') { dlg.close(); return a.snooze(); } // el respaldo tiene su propio “luego”
  setAlertPrefs(p => { if (how == 'mute') p.mute[a.r] = { l: a.l, d: today() }; else p.skip[a.k] = today(); });
  if (dlg.open) dlg.close();
  toast(how == 'mute' ? 'No te volveremos a avisar de esto' : 'Aviso ignorado', { action: 'Deshacer', onAction: () => { setAlertPrefs(p => { p.mute = { ...before.mute }; p.skip = { ...before.skip }; }); toast('Listo, el aviso volvió', { kind: 'ok' }); } });
}
function unmuteAlert(r) { // también quita los “ignorar” que tenga ese mismo aviso ahora, para que salga de verdad
  const now = [...homeAlerts(), ...insights(true)].filter(a => a.r == r);
  setAlertPrefs(p => { delete p.mute[r]; now.forEach(a => delete p.skip[a.k]); }); toast('Te volveremos a avisar', { kind: 'ok' });
}
function unskipAlert(k) { setAlertPrefs(p => { delete p.skip[k]; }); toast('El aviso volvió a Inicio', { kind: 'ok' }); }
async function resetAlerts() {
  if (!(await ask('Todos los avisos que ignoraste o silenciaste vuelven a salir en Inicio.', { title: '¿Volver a mostrar todo?', ok: 'Mostrar todo' }))) return;
  setAlertPrefs(p => { p.mute = {}; p.skip = {}; }); toast('Todos los avisos están activos', { kind: 'ok' });
}
// Ajustes → Avisos de Inicio
function alertsSettingsHTML() {
  const p = alertPrefs(), muted = Object.entries(p.mute).sort((x, y) => (y[1].d || '').localeCompare(x[1].d || ''));
  const cur = [...homeAlerts(), ...insights(true)], ign = cur.filter(a => !p.mute[a.r] && p.skip[a.k]);
  const who = alWho() == '_' ? 'Se guarda en este teléfono.' : `Esto es solo para <b>${esc(alWho())}</b>: a los demás del hogar les siguen saliendo sus avisos.`;
  return `<div class="card alset"><h2><i class="icon-bell-off"></i> Silenciados</h2><p class="mini" style="margin:0 0 6px">${who} En cada aviso de Inicio toca <b>⋯</b> para ignorarlo o silenciarlo.</p>
${muted.length ? muted.map(([r, m]) => `<div class="row">${circ(m.l || r, 'bell-off')}<div><b>${esc(m.l || r)}</b><small>Silenciado el ${fdate(m.d, 1)}</small></div><button onclick="unmuteAlert(${jsAttr(r)})">Reactivar</button></div>`).join('') : '<p class="mini" style="margin:6px 0 0">No has silenciado ningún aviso.</p>'}</div>
<div class="card alset"><h2><i class="icon-clock"></i> Ignorados por ahora</h2>
${ign.length ? ign.map(a => `<div class="row">${circ(a.mt || a.t, a.ic)}<div><b>${esc(a.mt || a.t)}</b><small>${esc(a.ig)}</small></div><button onclick="unskipAlert(${jsAttr(a.k)})">Mostrar</button></div>`).join('') : '<p class="mini" style="margin:0">No hay avisos ignorados en este momento.</p>'}</div>
${muted.length || ign.length ? '<div class="add" style="justify-content:center"><button class="link" onclick="resetAlerts()"><i class="icon-rotate-ccw"></i> Volver a mostrar todo</button></div>' : ''}`;
}
function renderHome(app) {
  alReg = [];
  const td = today(), ym = td.slice(0, 7), me = myPerson();
  const cards = {
    saldo: () => {
      const tot = totalsByCurrency(), dop = tot.DOP || { disp: 0, deuda: 0, neto: 0 }, others = Object.entries(tot).filter(([c]) => c != 'DOP'), nw = netWorthApprox(), approx = others.length || nw.missing.length;
      const deuda = round2(dop.deuda + debts.filter(d => d.dir == 'owe').reduce((q, d) => q + convert(debtLeft(d), d.cu, 'DOP', td), 0));
      return `<div class="card hero" role="button" onclick="go('acc')"><small>Disponible en pesos</small><div class="big">${money(dop.disp)}</div>
<div class="split"><div onclick="event.stopPropagation();repTab='nw';go('rep')"><small>Patrimonio neto${approx ? '*' : ''}</small><b>${money(nw.total)}</b></div><div onclick="event.stopPropagation();debtTab='loans';go('debts')"><small>Deudas</small><b>${money(deuda)}</b></div></div>
${others.map(([c, t]) => `<small class="hx">En ${c}: ${money(t.disp, c)} disponible${t.deuda ? ' · deuda ' + money(t.deuda, c) : ''}</small>`).join('')}
${approx ? `<small class="hx">* Todo convertido a pesos${nw.missing.length ? ' (sin tasa para ' + nw.missing.join(', ') + ')' : ''}</small>` : ''}</div>`;
    },
    accesos: () => `<div class="qa">${[['pie-chart', 'Presupuesto', "go('bud')", 'brand'], ['calendar-days', 'Planificar', "go('plan')", 'blue'], ['arrow-left-right', 'Transferir', 'goTr()', 'teal'], ['bar-chart-3', 'Reportes', "repTab='res';go('rep')", 'pink']].map(([ic, l, f, c]) => `<button type="button" onclick="${f}"><span class="circ" style="color:var(--${c})"><i class="icon-${ic}"></i></span>${l}</button>`).join('')}</div>`,
    revisar: () => reviewCard(),
    parati: () => insightsCard(),
    alcanza: () => alcanzaCard(false),
    atajos: () => atajosCard(),
    mes: () => {
      const st = monthStats(ym), b = budgetFor(ym), bst = budgetStatus(st.exp, b.total);
      const dim = +monthEnd(ym).slice(8, 10), dd = +td.slice(8, 10), pace = Math.round(dd / dim * 100), left = b.total - st.exp;
      const cc = catCompare(ym), usual = cc && cc.avgTot > 0 ? Math.round(Math.min(1, cc.expTot / cc.avgTot) * 100) : pace; // lo que sueles llevar a esta altura
      const col = bst ? barCol(bst.level) : 'var(--brand)', pct = bst ? Math.min(100, bst.pct) : 0;
      return `<div class="card"><h2><i class="icon-pie-chart"></i> ${ymLabel(ym)[0].toUpperCase() + ymLabel(ym).slice(1)}</h2>
<div class="month" role="button" onclick="go('bud')"><div class="ring" style="background:conic-gradient(${col} ${pct}%,var(--soft) 0)"><div>${bst ? bst.pct + '%' : '—'}</div></div>
<div style="min-width:0;flex:1"><small class="mut">${b.total ? (left >= 0 ? 'Te queda para gastar' : 'Te pasaste por') : 'Gastado este mes'}</small>
<div class="num" style="font-size:26px;font-weight:800;letter-spacing:-.02em;color:${left < 0 && b.total ? 'var(--out)' : 'var(--ink)'}">${money(b.total ? Math.abs(left) : st.exp)}</div>
<small class="mut">${b.total ? money(st.exp) + ' de ' + money(b.total) : 'Toca para definir un tope'}</small></div></div>
<div style="margin-top:12px"><small class="mut">Día ${dd} de ${dim}${bst && bst.pct > usual + 10 ? ' · <b class="warn">vas más rápido de lo normal</b>' : ''}</small>${bar(pace, 'var(--brand)')}</div>
<div class="trio"><div><small>Ingresos</small><b class="in">${money(st.inc)}</b></div><div><small>Egresos</small><b class="out">${money(st.exp)}</b></div><div><small>Ahorro</small><b>${st.rate == null ? '—' : st.rate + '%'}</b></div></div></div>`;
    },
    alertas: () => { const al = alertsHTML(); return al ? `<div class="card"><h2><i class="icon-bell alarm"></i> Pendientes y alertas</h2>${al}</div>` : ''; },
    promedio: () => promedioCard(),
    metas: () => activeGoals().length ? `<div class="card"><h2><i class="icon-target"></i> Metas</h2>${activeGoals().map(g => { const fc = goalForecast(g), p = fc.p, c = accentFor(g.name); return `<div style="margin-bottom:12px" role="button" onclick="go('goal')"><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:5px"><b>${esc(g.name)}</b><span class="num" style="color:var(--${c});font-weight:800">${p.pct}%</span></div>${bar(p.pct, `var(--${c})`)}<small class="mut">${money(p.saved)} de ${money(g.target)}${fc.reached ? ' · ¡lograda! 🎉' : fc.date ? ' · llegas ~' + fdate(fc.date, 1) : fc.pace && fc.pace.monthsLeft ? ' · ~' + fc.pace.monthsLeft + ' meses' : ''}</small></div>`; }).join('')}</div>` : '',
    recientes: () => {
      const recent = latestTxs(5);
      return `<div class="card"><h2><i class="icon-list"></i> Últimos movimientos</h2>${recent.length ? recent.map(x => histRow(x)).join('') + `<button class="link" onclick="go('hist')">Ver todos</button>` : '<p class="empty">Aún no hay movimientos. Toca el botón <b>+</b> de abajo para anotar el primero.</p>'}</div>`;
    }
  };
  const body = homeLayout().filter(c => c.on && cards[c.id]).map(c => { try { return cards[c.id](); } catch (e) { console.error(e); return `<div class="card"><p class="warnline" style="margin:0">No se pudo mostrar esta tarjeta: ${esc(e.message)}</p></div>`; } }).join('');
  const f0 = new Date(td + 'T12:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' }), fecha = f0[0].toUpperCase() + f0.slice(1);
  app.innerHTML = `<div class="top"><span class="hello"><img class="crest-sm" src="icons/escudo-mini.webp" alt=""><span><b>${me ? 'Hola, ' + esc(me) : 'Inicio'}</b><small>${fecha}</small></span></span><div class="tools">${syncBadge()}${eyeBtn()}</div></div>
${body}
<button class="link homeedit" onclick="openHomeEdit()"><i class="icon-sliders"></i> Personalizar Inicio</button>`;
}

// ============ Reportes ============
let repTab = 'res';
function renderRep(app) {
  const ym = repYm, st = monthStats(ym), pv = monthStats(addMonths(ym, -1));
  const d = (a, b, goodUp) => { const p = pctChange(a, b); if (p == null) return ''; const good = goodUp ? p >= 0 : p <= 0; return `<span class="delta ${good ? 'in' : 'out'}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p)}% vs mes anterior</span>`; };
  const E = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), ec = Object.entries(grp(E, 'c')).sort((x, y) => y[1] - x[1]);
  const a = fl(), tabs = [['res', 'Resumen'], ['cat', 'Categorías'], ['per', 'Personas'], ['nw', 'Patrimonio'], ['exp', 'Explorar']];
  let body = '';
  if (repTab == 'res') body = `<div class="kp"><div><small>Ingresos</small><b class="in">${money(st.inc)}</b>${d(st.inc, pv.inc, true)}</div><div><small>Egresos</small><b class="out">${money(st.exp)}</b>${d(st.exp, pv.exp, false)}</div>
<div><small>Ahorro del mes</small><b class="${st.net < 0 ? 'out' : ''}">${money(st.net)}</b></div><div><small>Tasa de ahorro</small><b>${st.rate == null ? '—' : st.rate + '%'}</b><span class="delta mut">${pv.rate == null ? '' : 'antes ' + pv.rate + '%'}</span></div></div>
<div class="card"><h2>Ingresos, egresos y ahorro (12 meses)</h2><canvas id="c-trend"></canvas></div>
<div class="card"><h2>Este mes vs el anterior</h2><canvas id="c-cmp"></canvas></div>`;
  else if (repTab == 'cat') body = `<div class="card"><h2>Egresos por categoría</h2>${ec.length ? `<canvas id="c-pie"></canvas><div id="catlist"></div>` : '<p class="empty">Sin egresos este mes.</p>'}</div>${compareTable(ym)}`;
  else if (repTab == 'per') body = `${mineYoursOursCard(ym)}<div class="card"><h2>Por persona y categoría</h2><canvas id="c-person"></canvas></div>`;
  else if (repTab == 'nw') { const nw = netWorthApprox(), t = totalsByCurrency(), ex = extraWorth(); const cash = Object.entries(t).reduce((q, [c, v]) => q + convert(v.disp, c, 'DOP', today()), 0), debt = Object.entries(t).reduce((q, [c, v]) => q + convert(v.deuda, c, 'DOP', today()), 0) + ex.debo.reduce((q, x) => q + convert(x.v, x.cu, 'DOP', today()), 0), goods = ex.bienes.reduce((q, x) => q + convert(x.v, x.cu, 'DOP', today()), 0), owed = ex.meDeben.reduce((q, x) => q + convert(x.v, x.cu, 'DOP', today()), 0);
    body = `<div class="kp"><div><small>Patrimonio neto</small><b class="${nw.total < 0 ? 'out' : ''}">${money(nw.total)}</b></div><div><small>Dinero</small><b>${money(cash)}</b></div><div><small>Bienes</small><b>${money(goods)}</b></div><div><small>Te deben</small><b class="in">${money(owed)}</b></div><div><small>Deudas</small><b class="out">${money(debt)}</b></div></div>
<div class="card"><h2>Patrimonio neto (12 meses)</h2><canvas id="c-nw"></canvas><p class="mini" style="margin:6px 0 0">Lo que tienes (cuentas, bienes y lo que te deben) menos lo que debes, en pesos.</p></div>
<button style="width:100%" onclick="go('debts')"><i class="icon-hand-coins"></i> Ver deudas y bienes</button>`; }
  else body = `<div class="card">${fbar(false)}${a.length ? `<canvas id="c1" style="margin-top:12px"></canvas>` : '<p class="empty">No hay movimientos con estos filtros.</p>'}</div>`;
  app.innerHTML = `${head('Reportes', true)}
${monthNav(ym, 'repYm')}
<div class="chips tabs" style="margin-bottom:12px">${tabs.map(([k, l]) => `<button class="${repTab == k ? 'on' : ''}" onclick="repTab='${k}';render()">${l}</button>`).join('')}</div>
${body}`;
  if (noCharts()) return;
  const { V, o, pal } = chartBase();
  const months = [...Array(12)].map((_, i) => addMonths(ym, i - 11)), lab = months.map(m => MES3[+m.slice(5, 7) - 1]);
  if ($('c-trend')) { const S = months.map(monthStats); ch.push(new Chart($('c-trend'), { data: { labels: lab, datasets: [{ type: 'bar', label: 'Ingresos', data: S.map(s => s.inc), backgroundColor: V('--in'), borderRadius: 4 }, { type: 'bar', label: 'Egresos', data: S.map(s => s.exp), backgroundColor: V('--out'), borderRadius: 4 }, { type: 'line', label: 'Ahorro', data: S.map(s => s.net), borderColor: V('--brand'), backgroundColor: V('--brand'), tension: .3 }] }, options: o })); }
  if ($('c-nw')) { const td = today(), nw = months.map(m => netWorthApprox(m >= td.slice(0, 7) ? td : monthEnd(m)).total); ch.push(new Chart($('c-nw'), { type: 'line', data: { labels: lab, datasets: [{ label: 'Patrimonio', data: nw, borderColor: V('--brand'), backgroundColor: V('--brand') + '22', fill: true, tension: .3 }] }, options: { ...o, plugins: { ...o.plugins, legend: { display: false } } } })); }
  if ($('c-pie') && ec.length) {
    const colors = ec.map((_, i) => pal[i % pal.length]), tot = ec.reduce((s2, x) => s2 + x[1], 0);
    ch.push(new Chart($('c-pie'), { type: 'doughnut', data: { labels: ec.map(x => x[0]), datasets: [{ data: ec.map(x => x[1]), backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, aspectRatio: 1.6, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ': ' + money(c.raw) } } } } }));
    $('catlist').innerHTML = ec.map(([n, v], i) => `<div class="row tap" data-n="${esc(n)}" onclick="F={c:this.dataset.n,t:'e',f:'${ym}-01',u:'${monthEnd(ym)}',open:true};go('hist')"><div class="circ" style="background:${colors[i]}22;color:${colors[i]}"><i class="icon-${icoFor(n, 'e')}"></i></div><div><b>${esc(n)}</b><small>${Math.round(v / tot * 100)}%</small></div><b class="num">${money(v)}</b></div>`).join('');
  }
  if ($('c-cmp')) {
    const g1 = grp(E, 'c'), g0 = grp(txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == addMonths(ym, -1)), 'c');
    const cats = [...new Set([...Object.keys(g1), ...Object.keys(g0)])].sort((x, y) => (g1[y] || 0) - (g1[x] || 0)).slice(0, 7);
    ch.push(new Chart($('c-cmp'), { type: 'bar', data: { labels: cats, datasets: [{ label: 'Mes anterior', data: cats.map(k => g0[k] || 0), backgroundColor: V('--line'), borderRadius: 4 }, { label: ymLabel(ym), data: cats.map(k => g1[k] || 0), backgroundColor: V('--brand'), borderRadius: 4 }] }, options: { ...o, indexAxis: 'y', scales: { x: { ticks: { callback: axisFmt } } } } }));
  }
  if ($('c-person')) {
    const byCat = grp(E, 'c'), pc = Object.keys(byCat).sort((x, y) => byCat[y] - byCat[x]).slice(0, 7), pp = [...new Set([...cfg.people, ...E.map(x => x.w).filter(Boolean)])];
    ch.push(new Chart($('c-person'), { type: 'bar', data: { labels: pc, datasets: pp.map((n, i) => ({ label: n, data: pc.map(k => E.filter(x => x.c == k && x.w == n).reduce((s2, x) => s2 + x.v, 0)), backgroundColor: pal[i % pal.length], borderRadius: 4 })).filter(ds => ds.data.some(v => v > 0)) }, options: { ...o, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: axisFmt } } } } }));
  }
  if (a.length && $('c1')) {
    const ms = [...new Set(a.map(x => x.d.slice(0, 7)))].sort(), mi = ms.map(m => sum(a.filter(x => x.d.slice(0, 7) == m), 'i')), me = ms.map(m => sum(a.filter(x => x.d.slice(0, 7) == m), 'e'));
    let acc = 0; const bal = ms.map((m, i) => acc += mi[i] - me[i]);
    ch.push(new Chart($('c1'), { data: { labels: ms, datasets: [{ type: 'bar', label: 'Ingresos', data: mi, backgroundColor: V('--in'), borderRadius: 4 }, { type: 'bar', label: 'Egresos', data: me, backgroundColor: V('--out'), borderRadius: 4 }, { type: 'line', label: 'Balance acumulado', data: bal, borderColor: V('--brand'), backgroundColor: V('--brand'), tension: .25 }] }, options: o }));
  }
}

// ============ Historial ============
function renderHist(app) {
  const n = activeFilters();
  const nr = revList().length, qt = [['', 'Todos'], ['e', 'Egresos'], ['i', 'Ingresos'], ['tr', 'Transferencias'], ...(nr || F.rev ? [['rev', `Por revisar (${nr})`]] : [])];
  app.innerHTML = `${head('Movimientos')}
<div class="add" style="margin-bottom:10px"><div class="search"><i class="icon-search"></i><input id="q" type="search" placeholder="Buscar: súper, Netflix, 1500…" value="${esc(F.q || '')}" oninput="F.q=this.value;histList()" autocomplete="off"></div>
<button class="iconbtn${n ? ' on' : ''}" style="${n ? 'background:var(--brand);color:var(--brand-ink)' : ''}" aria-label="Filtros${n ? ' (' + n + ')' : ''}" onclick="F.open=!F.open;render()"><i class="icon-sliders"></i></button></div>
<div class="chips tabs" style="margin-bottom:10px">${qt.map(([k, l]) => `<button class="${(k == 'rev' ? F.rev : !F.rev && (F.t || '') == k) ? 'on' : ''}" onclick="${k == 'rev' ? 'F.rev=!F.rev;F.t=\'\'' : `F.rev=false;F.t='${k}'`};render()">${l}</button>`).join('')}</div>
${F.open ? `<div class="card">${fbar(true)}<label class="toggle" style="margin-top:10px"><input type="checkbox" ${F.showDel ? 'checked' : ''} onchange="F.showDel=this.checked;render()"> Mostrar movimientos borrados</label></div>` : ''}
<div id="hlist"></div>`;
  histList();
}
function histList() {
  const el = $('hlist'); if (!el) return;
  const all = [...txs.filter(histMatch).map(x => ({ x, g: 0 })), ...(F.showDel ? trash.filter(histMatch).map(x => ({ x, g: 1 })) : [])].sort((p, q) => (p.x.d < q.x.d ? 1 : p.x.d > q.x.d ? -1 : (q.x.cr || 0) - (p.x.cr || 0)));
  const shown = all.slice(0, F.lim || 200), live = all.filter(r => !r.g).map(r => r.x);
  const inc = sum(live, 'i'), exp = sum(live, 'e'), dayNet = {};
  live.forEach(y => { if (y.t == 'i') dayNet[y.d] = (dayNet[y.d] || 0) + y.v; else if (y.t == 'e') dayNet[y.d] = (dayNet[y.d] || 0) - y.v; });
  let html = '', day = '';
  for (const { x, g } of shown) {
    if (x.d != day) {
      day = x.d; const net = dayNet[day] || 0;
      html += `<div class="dayhead"><span>${fday(day)}</span><span class="num ${net > 0 ? 'in' : net < 0 ? 'out' : ''}">${net ? (net > 0 ? '+' : '−') + money(Math.abs(net)) : ''}</span></div>`;
    }
    html += histRow(x, g);
  }
  el.innerHTML = all.length ? `<p class="mini" style="margin:0 0 8px 4px">${all.length} movimiento${all.length > 1 ? 's' : ''} · <span class="in">+${money(inc)}</span> · <span class="out">−${money(exp)}</span></p>
<div class="card">${html}${all.length > shown.length ? `<button class="link" onclick="F.lim=(F.lim||200)+200;histList()">Ver más (${all.length - shown.length})</button>` : ''}</div>`
    : `<p class="empty">${!txs.length ? 'Aún no hay movimientos. Toca el botón <b>+</b> de abajo para anotar el primero.' : F.q ? 'Nada coincide con “' + esc(F.q) + '”.' : 'Sin movimientos con estos filtros.'}</p>`;
}

// ============ Cuentas ============
let accOwner = '';
function renderAcc(app) {
  const asOf = F.accAsOf || undefined, tot = totalsByCurrency(asOf), td = today();
  const owners = cfg.people.length > 1 && accs.some(a => a.owner) ? ['', ...cfg.people.filter(p => accs.some(a => a.owner == p)), '~'] : null;
  const list = accs.filter(a => !accOwner || (accOwner == '~' ? !a.owner : a.owner == accOwner));
  const groups = [['Efectivo y bancos', 'wallet', list.filter(a => !isDebtAcc(a))], ['Tarjetas de crédito', 'credit-card', list.filter(isCard)], ['Préstamos', 'hand-coins', list.filter(isLoan)]];
  const dop = tot.DOP || { disp: 0, deuda: 0 }, others = Object.entries(tot).filter(([c]) => c != 'DOP');
  const gsum = l => { const c = {}; l.forEach(a => { const b = acctBalance(a, asOf); c[a.currency] = (c[a.currency] || 0) + (isDebtAcc(a) ? Math.max(0, -b) : b); }); return Object.entries(c).map(([k, v]) => money(v, k)).join(' · '); };
  app.innerHTML = `${head('Cuentas')}
<div class="card sumc"><small>Disponible${asOf ? ' al ' + fdate(asOf) : ''}</small><b class="big">${money(dop.disp)}</b>
<div class="sum3"><div><small>Deudas en cuentas</small><b class="out">${money(dop.deuda)}</b></div><div><small>Neto</small><b class="${dop.disp - dop.deuda < 0 ? 'out' : ''}">${money(round2(dop.disp - dop.deuda))}</b></div></div>
${others.map(([c, t]) => `<small class="mini" style="display:block;margin-top:8px">En ${c}: ${money(t.disp, c)} disponible${t.deuda ? ' · deuda ' + money(t.deuda, c) : ''}</small>`).join('')}</div>
${owners ? `<div class="chips tabs" style="margin-bottom:4px">${owners.map(o => `<button class="${accOwner == o ? 'on' : ''}" data-o="${esc(o)}" onclick="accOwner=this.dataset.o;render()">${o == '' ? 'Todas' : o == '~' ? 'Del hogar' : esc(o)}</button>`).join('')}</div>` : ''}
${accs.length ? groups.filter(g => g[2].length).map(([t, ic, l]) => `<div class="ghd"><span><i class="icon-${ic}"></i> ${t}</span><b class="mut">${gsum(l)}</b></div><div class="card agrp">${l.slice().sort((x, y) => x.name.localeCompare(y.name)).map(accRow).join('')}</div>`).join('') : '<div class="card"><p class="empty" style="margin:0">Aún no tienes cuentas. Agrega la primera: efectivo, banco o tarjeta.</p></div>'}
<div class="seg" style="margin-top:4px"><button class="p" onclick="openAccForm()"><i class="icon-plus"></i> Nueva cuenta</button>${accs.length >= 2 ? `<button onclick="openTransferForm()"><i class="icon-arrow-left-right"></i> Transferir</button>` : ''}</div>
<details class="card" style="margin-top:14px"${asOf ? ' open' : ''}><summary>Ver saldos a otra fecha ›</summary><div class="add" style="margin-top:8px"><input type="date" value="${esc(asOf || '')}" onchange="F.accAsOf=this.value;render()">${asOf ? `<button onclick="F.accAsOf='';render()">Hoy</button>` : ''}</div></details>`;
}
// Transferir desde una cuenta
function trFrom(id) { openTransferForm(null, null, ''); trform.from = id; if (trform.to == id) trform.to = (accs.find(x => x.id != id) || {}).id; trform.note = ''; drawTransferForm(); }
// Estado corto de una cuenta (para la fila y la hoja)
function accStatus(a, short) {
  const asOf = F.accAsOf || undefined, cy = asOf ? null : cardCycle(a), ly = asOf ? null : loanCycle(a), out = [];
  if (cy) { const dl = dueLabel(cy.pay); out.push(cy.debtAtCut <= 0 ? pill('Sin saldo al corte', 'in') : cy.left <= 0 ? pill('Corte pagado ✓', 'in') : pill(short ? `Pagar ${dl.t.toLowerCase()}` : `Pagar ${money(cy.left, a.currency)} · ${dl.t.toLowerCase()}`, dl.k || 'warn')); }
  if (ly && !ly.done) { const dl = dueLabel(ly.due); out.push(ly.missed ? pill('Cuota atrasada', 'out') : ly.paid ? pill('Cuota del mes pagada ✓', 'in') : pill('Cuota ' + dl.t.toLowerCase(), dl.k || '')); }
  return { cy, ly, pills: out };
}
function accRow(a) {
  const asOf = F.accAsOf || undefined, bal = acctBalance(a, asOf), loan = isLoan(a), debtA = isDebtAcc(a), st = accStatus(a, true), e = earm(a);
  const sub = loan ? esc(a.lender || a.loanKind || 'Préstamo') : esc(a.type) + (a.currency != 'DOP' ? ' · ' + a.currency : '') + (a.owner ? ' · ' + esc(a.owner) : '');
  return `<div class="arow" role="button" onclick="openAccSheet('${a.id}')">${circ(a.name, loan ? loanIcon(a.loanKind) : acctIcon(a.type))}
<div><b>${esc(a.name)}</b><small>${st.pills.length ? st.pills.join(' ') : sub}${e > 0 ? ' · ' + pill('Metas ' + money(e)) : ''}</small></div>
<div class="bal"><b class="num ${bal < 0 ? 'out' : ''}">${money(debtA ? Math.abs(bal) : bal, a.currency)}</b><small class="mut">${debtA ? (bal < 0 ? 'debes' : bal > 0 ? 'a favor' : 'al día') : 'disponible'}</small></div></div>`;
}
// Hoja de una cuenta: saldo, estado, acciones y últimos movimientos
function openAccSheet(id) {
  const a = accs.find(x => x.id == id); if (!a) return;
  const bal = acctBalance(a), card = isCard(a), loan = isLoan(a), debtA = card || loan, st = accStatus(a), e = earm(a), cy = st.cy, ly = st.ly;
  const early = txs.filter(x => (x.accId == a.id || x.accIdTo == a.id) && a.openDate && x.d < a.openDate).length;
  const meta = [...st.pills];
  if (card && a.cutDay && a.payDay) meta.push(pill(`Corte día ${a.cutDay} · pago día ${a.payDay}`));
  if (loan && a.payment) meta.push(pill('Cuota ' + money(a.payment, a.currency)));
  if (e > 0) meta.push(pill('Metas ' + money(e)), pill('Libre ' + money(bal - e), 'in'));
  if (a.note) meta.push(pill(a.note));
  const B = (ic, l, f, p) => `<button type="button" class="${p ? 'p' : ''}" onclick="${f}"><i class="icon-${ic}"></i>${l}</button>`;
  const acts = loan ? [ly && !ly.done ? B('hand-coins', 'Pagar cuota', `openLoanPay('${a.id}')`, 1) : '', B('list', 'Tabla de pagos', `openSchedule('${a.id}')`), B('arrow-left-right', 'Abonar', `openTransferForm(null,'${a.id}','');trform.note='Abono a capital';drawTransferForm()`), B('pencil', 'Editar', `openAccForm('${a.id}')`)]
    : [card && cy && cy.left > 0 ? B('credit-card', 'Pagar ' + money(cy.left, a.currency), `openTransferForm(null,'${a.id}',${cy.left})`, 1) : '', B('list', 'Movimientos', `F={acc:'${a.id}'};go('hist')`), accs.length > 1 ? B('arrow-left-right', 'Transferir', card ? `openTransferForm(null,'${a.id}','')` : `trFrom('${a.id}')`) : '', B('sliders', 'Ajustar saldo', `openAdj('${a.id}')`), B('pencil', 'Editar', `openAccForm('${a.id}')`)];
  const last = latestTxs(4, x => x.accId == a.id || x.accIdTo == a.id);
  dlg.innerHTML = `<div class="sheethd">${circ(a.name, loan ? loanIcon(a.loanKind) : acctIcon(a.type))}<div><b>${esc(a.name)}</b><small>${loan ? esc(a.lender || a.loanKind || 'Préstamo') : esc(a.type)} · ${a.currency}${a.owner ? ' · de ' + esc(a.owner) : ''}</small></div><button class="iconbtn" aria-label="Cerrar" onclick="dlg.close()"><i class="icon-x"></i></button></div>
<div style="margin:14px 0 8px"><small class="mut">${debtA ? (bal < 0 ? 'Debes' : 'Saldo') : 'Disponible'}</small><div class="bigbal ${bal < 0 ? 'out' : ''}">${money(debtA ? Math.abs(bal) : bal, a.currency)}</div></div>
${meta.length ? `<div class="meta" style="margin-bottom:12px">${meta.join('')}</div>` : ''}
${early ? `<small class="warnline" style="margin-bottom:10px">⚠ ${early} movimiento${early > 1 ? 's' : ''} con fecha anterior a la apertura (${fdate(a.openDate, 1)}) no cuenta${early > 1 ? 'n' : ''} en el saldo.</small>` : ''}
<div class="actgrid">${acts.join('')}</div>
${last.length ? `<h3 class="grph" style="margin-top:18px">Últimos movimientos</h3>${last.map(x => histRow(x)).join('')}` : ''}`;
  dlgShow();
}

// ============ Presupuesto ============
function renderBud(app) {
  const ym = budYm, monthTx = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), spentTotal = monthTx.reduce((s, x) => s + x.v, 0);
  const b = budgetFor(ym), st = budgetStatus(spentTotal, b.total), ov = (cfg.budgetOverrides || {})[ym] || {};
  const catNames = [...new Set([...cfg.cats.filter(c => c.t == 'e').map(c => c.n), ...Object.keys(b.cats)])];
  const withLim = catNames.filter(n => b.cats[n] > 0 || monthTx.some(x => x.c == n)), rest = catNames.filter(n => !withLim.includes(n));
  const mesTxt = ymLabel(ym);
  const row = n => {
    const spent = monthTx.filter(x => x.c == n).reduce((q, x) => q + x.v, 0), lim = b.cats[n], s2 = budgetStatus(spent, lim), k = (b.carry || {})[n], roll = (cfg.rollCats || {})[n];
    return `<div class="row tap" style="flex-wrap:wrap" data-n="${esc(n)}" onclick="openBudCat(this.dataset.n)">${circ(n, icoFor(n, 'e'))}
<div><b>${esc(n)}${roll ? ' <i class="icon-repeat" title="Se arrastra" style="font-size:13px;color:var(--brand)"></i>' : ''}</b><small>${lim ? money(spent) + ' de ' + money(lim) : money(spent) + ' · sin tope'}${k ? ` · ${k > 0 ? 'incluye ' + money(k) + ' que sobró' : money(-k) + ' de menos (te pasaste antes)'}` : ''}${(b.catOverrides || {})[n] != null ? ' · tope solo de este mes' : ''}</small></div>
${s2 ? `<b class="num" style="color:${barCol(s2.level)}">${s2.pct}%</b><div style="flex-basis:100%;padding-left:54px">${bar(s2.pct, barCol(s2.level))}</div>` : `<i class="icon-chevron-right mut"></i>`}</div>`;
  };
  app.innerHTML = `${head('Presupuesto', true)}
${monthNav(ym, 'budYm')}
<div class="card"><h2>Total del mes</h2>
${st ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="num">${money(spentTotal)} de ${money(b.total)}</span><b style="color:${barCol(st.level)}">${st.pct}%</b></div>${bar(st.pct, barCol(st.level))}
${st.level == 'out' ? '<p class="out" style="margin:8px 0 0;font-size:13px">Te pasaste del presupuesto de este mes.</p>' : st.level == 'yellow' ? '<p class="warn" style="margin:8px 0 0;font-size:13px">Vas llegando al límite (80% o más).</p>' : ''}`
      : `<p class="mut" style="margin:0">${money(spentTotal)} gastado. Aún no hay tope para este mes.</p>`}
<details style="margin-top:10px"><summary>Cambiar el tope total ›</summary>
<div class="add" style="margin-top:8px"><label style="flex:1">Tope base, todos los meses (DOP)<input type="number" inputmode="decimal" step="0.01" min="0" value="${cfg.budgetTotal || ''}" id="bt-base"></label><button class="p" style="align-self:flex-end" onclick="setBudgetBase($('bt-base').value)">Guardar</button></div>
<div class="add" style="margin-top:8px"><label style="flex:1">Solo para ${mesTxt} (opcional)<input type="number" inputmode="decimal" step="0.01" min="0" value="${ov.total ?? ''}" id="bt-mes" placeholder="Usa el base"></label><button style="align-self:flex-end" onclick="setBudgetMonth('${ym}',$('bt-mes').value)">Guardar</button></div>
${ov.total != null ? `<button class="link" style="color:var(--out)" onclick="setBudgetMonth('${ym}','')">Quitar excepción de ${mesTxt}</button>` : ''}</details></div>
<button style="width:100%;margin-bottom:12px" onclick="openSuggest()"><i class="icon-wand-sparkles"></i> Sugerir topes según mis gastos</button>
<div class="card"><h2>Por categoría</h2><p class="mini" style="margin:0 0 6px">Toca una categoría para ver sus movimientos, cambiar el tope o hacer que lo que sobre pase al mes siguiente.</p>
${withLim.map(row).join('') || '<p class="mini">Aún no hay gastos ni topes este mes.</p>'}
${rest.length ? `<details style="margin-top:6px"><summary>Otras categorías (${rest.length}) ›</summary>${rest.map(row).join('')}</details>` : ''}</div>`;
}
let bcf = {};
// Al tocar una categoría: lo gastado este mes y los movimientos que lo forman
function openBudCat(n) {
  const ym = budYm, L = txs.filter(x => x.t == 'e' && x.c == n && x.d.slice(0, 7) == ym).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b.cr || 0) - (a.cr || 0)));
  const b = budgetFor(ym), lim = b.cats[n], spent = round2(L.reduce((q, x) => q + x.v, 0)), st = budgetStatus(spent, lim), k = (b.carry || {})[n], roll = (cfg.rollCats || {})[n];
  const subs = Object.entries(L.reduce((o, x) => { const s0 = x.sub || 'Sin detalle'; o[s0] = (o[s0] || 0) + x.v; return o; }, {})).sort((a, c) => c[1] - a[1]);
  const [y, m] = ym.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  dlg.innerHTML = `<div class="sheethd">${circ(n, icoFor(n, 'e'))}<div><b>${esc(n)}</b><small>${ymLabel(ym)}${roll ? ' · lo que sobra pasa al mes siguiente' : ''}</small></div><button class="iconbtn" aria-label="Cerrar" onclick="dlg.close()"><i class="icon-x"></i></button></div>
<div style="margin:14px 0 6px"><small class="mut">${lim ? 'Gastado de ' + money(lim) : 'Gastado (sin tope)'}</small><div class="bigbal ${st && st.level == 'out' ? 'out' : ''}">${money(spent)}</div></div>
${st ? `${bar(st.pct, barCol(st.level))}<div style="display:flex;justify-content:space-between;margin:6px 0 2px"><small class="mut">${lim - spent >= 0 ? 'Te quedan ' + money(lim - spent) : 'Te pasaste por ' + money(spent - lim)}</small><b style="color:${barCol(st.level)}">${st.pct}%</b></div>` : ''}
${k ? `<p class="mini" style="margin:2px 0 0">${k > 0 ? 'El tope incluye ' + money(k) + ' que te sobró antes.' : 'El tope tiene ' + money(-k) + ' menos porque te pasaste antes.'}</p>` : ''}
<div class="seg sm" style="margin:12px 0 4px"><button type="button" data-n="${esc(n)}" onclick="openBudLimit(this.dataset.n)"><i class="icon-sliders"></i> ${lim ? 'Cambiar tope' : 'Ponerle tope'}</button><button type="button" data-n="${esc(n)}" onclick="F={c:this.dataset.n,t:'e',f:'${ym}-01',u:'${ym}-${String(last).padStart(2, '0')}'};go('hist')"><i class="icon-list"></i> Ver en Movimientos</button></div>
${subs.length > 1 ? `<div class="meta" style="margin:8px 0 2px">${subs.slice(0, 6).map(([s0, v]) => pill(s0 + ' · ' + money(v))).join('')}</div>` : ''}
<h3 class="grph" style="margin-top:16px">${L.length} movimiento${L.length == 1 ? '' : 's'} este mes</h3>
${L.length ? L.map(x => histRow(x)).join('') : '<p class="empty" style="padding:8px 0">Aún no hay gastos en esta categoría este mes.</p>'}`;
  dlgShow();
}
// Cambiar el tope de una categoría
function openBudLimit(n) {
  const ym = budYm, ov = ((cfg.budgetOverrides || {})[ym] || {}).cats || {};
  bcf = { n, base: (cfg.budgetCats || {})[n] ?? '', mes: ov[n] ?? '', roll: !!(cfg.rollCats || {})[n] };
  dlg.innerHTML = `<form onsubmit="return svBudCat(event)"><h2>${esc(n)}</h2>
<label>Tope todos los meses (DOP)<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(bcf.base)}" oninput="bcf.base=this.value" placeholder="Sin tope"></label>
<label>Solo para ${ymLabel(ym)} (opcional)<input type="number" inputmode="decimal" step="0.01" min="0" value="${esc(bcf.mes)}" oninput="bcf.mes=this.value" placeholder="Usa el de todos los meses"></label>
<label class="toggle"><input type="checkbox" ${bcf.roll ? 'checked' : ''} onchange="bcf.roll=this.checked"> Lo que sobre pasa al mes siguiente</label>
<p class="mini" style="margin:0">Si un mes no gastas todo, la diferencia se suma al tope del siguiente (y si te pasas, se resta). Cuenta desde este mes.</p>
<div class="seg"><button type="button" onclick="openBudCat(bcf.n)">Cancelar</button><button class="p">Guardar</button></div></form>`;
  dlgShow();
}
function svBudCat(e) {
  e.preventDefault(); const f = bcf, ym = budYm, c = deep(cfg); c.budgetCats = c.budgetCats || {}; c.budgetOverrides = c.budgetOverrides || {}; c.rollCats = c.rollCats || {};
  const base = parseFloat(f.base), mes = parseFloat(f.mes);
  if (base > 0) c.budgetCats[f.n] = base; else delete c.budgetCats[f.n];
  const o = c.budgetOverrides[ym] = c.budgetOverrides[ym] || {}; o.cats = o.cats || {};
  if (mes >= 0 && f.mes !== '') o.cats[f.n] = mes; else delete o.cats[f.n];
  if (f.roll) c.rollCats[f.n] = c.rollCats[f.n] || ym; else delete c.rollCats[f.n];
  tidyOverrides(c); saveCfg(c); toast('Tope guardado', { kind: 'ok' }); openBudCat(f.n); return false;
}

// ============ Más ============
function renderMore(app) {
  const pend = pendingRecurring().length, st = settlements(), ds = debtSummary(), nb = (MARCA && MARCA.nombre) || '';
  const tile = (t, ic, title, sub, badge, c) => `<button class="tile" onclick="${t.includes('(') ? t : `go('${t}')`}"><div class="circ tint" style="--c:var(--${c || 'brand'})"><i class="icon-${ic}"></i>${badge ? `<span class="badge">${badge}</span>` : ''}</div><div><b>${title}</b>${sub ? `<span class="tsub">${sub}</span>` : ''}</div></button>`;
  app.innerHTML = `${head('Más')}
<div class="mhead"><img src="icons/escudo.webp" alt="${esc(nb ? 'Escudo ' + nb : 'Escudo')}" loading="lazy"><div><b>${nb ? 'Familia ' + esc(nb) : 'Mis finanzas'}</b><small>Mis finanzas · versión ${APP_VERSION}</small></div></div>
<h3 class="grph">Tu dinero</h3><div class="tiles">
${tile('bud', 'pie-chart', 'Presupuesto', '', 0, 'brand')}
${tile('plan', 'calendar-days', 'Planificar', '', 0, 'blue')}
${tile('rec', 'repeat', 'Recurrentes', pend ? pend + ' por confirmar' : '', pend, 'teal')}
${tile('goal', 'target', 'Metas', activeGoals().length ? activeGoals().length + ' activa' + (activeGoals().length > 1 ? 's' : '') : '', 0, 'pink')}
${tile('rep', 'bar-chart-3', 'Reportes', '', 0, 'purple')}
${tile("debtTab='loans';go('debts')", 'hand-coins', 'Deudas y bienes', ds.total ? money(ds.total) : '', 0, 'yellow')}</div>
<h3 class="grph">Hogar y herramientas</h3><div class="tiles">
${tile('shared', 'users', 'Cuentas claras', st.length ? esc(st[0].from) + ' debe' : '', 0, 'blue')}
${tile("toolView='';go('tools')", 'wrench', 'Herramientas', '', 0, 'teal')}
${tile("setSub='';go('set')", 'settings', 'Ajustes', '', 0, 'purple')}</div>`;
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
// Texto del pronóstico de una meta (plan, fecha objetivo y ritmo real)
function goalForecastHTML(g, fc) {
  const L = [], pl = fc.pl;
  if (fc.reached) return `<p class="mini" style="margin:8px 0 0">¡Meta alcanzada! 🎉 Márcala como cumplida para que deje de contar como activa.</p>`;
  L.push(`Faltan <b>${money(fc.p.remaining)}</b>`);
  if (pl) L.push(`Plan: ${money(pl.amount)} ${PLAN_FREQ[pl.freq].l}${pl.rec ? ' (automático)' : ''}${fc.date ? ` → llegas ~<b>${fdate(fc.date, 1)}</b>` : ''}`);
  if (g.due && g.due >= today()) {
    if (pl && fc.need != null) L.push(`Para el ${fdate(g.due, 1)} necesitas ${money(fc.need)} cada ${PLAN_FREQ[pl.freq].u} ${fc.late ? pill('no llegas a tiempo', 'warn') : pill('llegas a tiempo', 'in')}`);
    else if (fc.needMonth) L.push(`Para el ${fdate(g.due, 1)} necesitas ~${money(fc.needMonth)} al mes`);
  } else if (g.due) L.push(`La fecha objetivo (${fdate(g.due, 1)}) ya pasó ${pill('revisa la fecha', 'warn')}`);
  if (fc.pace && fc.pace.perMonth) L.push(`Tu ritmo real: ~${money(fc.pace.perMonth)} al mes${!pl && fc.pace.monthsLeft ? ` (llegas en ~${fc.pace.monthsLeft} ${fc.pace.monthsLeft == 1 ? 'mes' : 'meses'})` : ''}`);
  return `<div class="gfc">${L.map(x => `<p class="mini" style="margin:0">${x}</p>`).join('')}${pl ? '' : `<button class="link" style="padding:2px 0" onclick="openGoalForm('${g.id}','plan')"><i class="icon-calendar-days"></i> Ponerle un plan de aportes</button>`}</div>`;
}
function renderGoal(app) {
  const act = activeGoals(), done = goals.filter(g => g.done).sort((a, b) => b.done.localeCompare(a.done));
  app.innerHTML = `${head('Metas', true)}
${act.length ? act.map(g => {
    const fc = goalForecast(g), p = fc.p, col = accentFor(g.name), acc = accs.find(a => a.id == g.accId);
    const m = txs.filter(x => x.t == 'g' && x.goalId == g.id).sort((a, b) => b.d.localeCompare(a.d) || (b.u || 0) - (a.u || 0)).slice(0, 4);
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="min-width:0"><h2 style="margin:0">${esc(g.name)}</h2><small class="mut">${acc ? 'En ' + esc(acc.name) : '⚠ Sin cuenta: edítala y átala a una'}${g.note ? ' · ' + esc(g.note) : ''}</small></div><button class="iconbtn" aria-label="Editar meta" onclick="openGoalForm('${g.id}')"><i class="icon-pencil"></i></button></div>
<div style="display:flex;justify-content:space-between;margin:12px 0 6px"><span class="num">${money(p.saved)} de ${money(g.target)}</span><b style="color:var(--${col})">${p.pct}%</b></div>${bar(p.pct, `var(--${col})`)}
${goalForecastHTML(g, fc)}
${m.length ? `<div style="margin-top:8px">${m.map(x => histRow(x)).join('')}</div>` : ''}
${fc.reached ? `<button class="p" style="width:100%;margin-top:10px" onclick="completeGoal('${g.id}','reached')"><i class="icon-party-popper"></i> Marcar como cumplida</button>` : ''}
<div class="seg sm" style="margin-top:10px"><button class="${fc.reached ? '' : 'p'}" onclick="openContribForm('${g.id}')"><i class="icon-plus"></i> Aportar</button><button onclick="openGoalForm('${g.id}','plan')"><i class="icon-calendar-days"></i> Plan</button><button onclick="openGoalSim('${g.id}')"><i class="icon-sparkles"></i> Simular</button></div></div>`;
  }).join('') : `<div class="card"><p class="empty" style="margin:0">${done.length ? 'No tienes metas activas. ¡Crea la próxima!' : 'Aún no tienes metas. Crea la primera: un viaje, un fondo de emergencia, algo para la casa…'}</p></div>`}
<button class="p" style="width:100%" onclick="openGoalForm()"><i class="icon-plus"></i> Nueva meta</button>
${done.length ? `<details class="card" style="margin-top:14px"><summary>Cumplidas y cerradas (${done.length}) ›</summary>${done.map(g => { const p = goalProgress(g); return `<div class="row">${circ(g.name, g.doneHow == 'closed' ? 'archive' : 'party-popper')}<div><b>${esc(g.name)}</b><small>${g.doneHow == 'closed' ? 'Cerrada' : 'Cumplida'} el ${fdate(g.done, 1)} · ${money(p.saved)} de ${money(g.target)}</small></div><button onclick="reopenGoal('${g.id}')">Reactivar</button></div>`; }).join('')}</details>` : ''}
${(() => {
      const orphan = txs.filter(x => x.t == 'g' && !goals.some(g => g.id == x.goalId)); if (!orphan.length) return '';
      const s = orphan.reduce((t, x) => t + x.v, 0);
      return `<div class="card" style="margin-top:12px"><h2>Aportes sin meta (${money(s)})</h2><p class="mini" style="margin:0 0 8px">Quedaron de metas que borraste. Reasígnalos o bórralos.</p>
${orphan.map(x => `<div class="row"><div><b class="num">${money(x.v)}</b><small>${fdate(x.d)} · ${esc(x.w)}${x.n ? ' · ' + esc(x.n) : ''}</small></div>
${activeGoals().length ? `<select style="width:auto;flex:none" onchange="reassignContrib('${x.id}',this.value)"><option value="">Reasignar…</option>${activeGoals().map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>` : ''}
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
// ============ Ajustes (por secciones) ============
let setSub = '';
const SET_SECTIONS = [
  ['nube', 'cloud', 'Nube y hogar', () => { const C = window.Cloud; return !C || !C.enabled ? 'Sin configurar: datos solo en este teléfono' : C.hid ? 'Sincronizado con tu hogar' : C.user ? 'Conectado, sin hogar' : 'Sin iniciar sesión'; }],
  ['seguridad', 'lock', 'Seguridad y privacidad', () => (lockCfg() ? 'PIN activado' + (bioId() ? ' · Face ID / huella' : '') : 'Sin bloqueo')],
  ['apariencia', 'palette', 'Apariencia', () => `${(PALETTES[palette] || {}).name || ''} · íconos ${(ICON_THEMES[iconTheme] || {}).name || ''}`],
  ['avisos', 'bell', 'Avisos de Inicio', () => { const n = Object.keys(alertPrefs().mute).length; return n ? n + ' silenciado' + (n > 1 ? 's' : '') : 'Ignora o silencia los que no te sirven'; }],
  ['personas', 'users', 'Personas', () => cfg.people.join(', ')],
  ['categorias', 'tag', 'Categorías', () => cfg.cats.length + ' categorías'],
  ['atajos', 'zap', 'Atajos', () => (shortcuts().length ? shortcuts().length + ' atajos' : 'Botones para anotar con un toque')],
  ['monedas', 'banknote', 'Monedas y tasas', () => ['DOP', ...cfg.cur].join(', ')],
  ['datos', 'download', 'Respaldo y datos', () => 'Respaldo, Excel, papelera, borrar todo'],
];
function renderSet(app) {
  const sec = SET_SECTIONS.find(x => x[0] == setSub);
  if (!sec) {
    app.innerHTML = `${head('Ajustes', true)}<div class="card list">${SET_SECTIONS.map(([k, ic, t, d]) => `<button class="lrow" onclick="setSub='${k}';render();scrollTo(0,0)">${circ(t, ic)}<div><b>${t}</b><small>${esc(d())}</small></div><i class="icon-chevron-right mut"></i></button>`).join('')}</div>
<div class="add" style="flex-wrap:wrap;justify-content:center"><button class="link" onclick="wz={step:0,force:true};go('welcome')"><i class="icon-sparkles"></i> Ver la bienvenida</button></div>
<p class="mini" style="text-align:center">Mis finanzas${MARCA.nombre ? ' · ' + esc(MARCA.nombre) : ''} · versión ${APP_VERSION}</p>`;
    return;
  }
  const me = myPerson(), back = `<button class="back" onclick="setSub='';render()"><i class="icon-chevron-left"></i> Ajustes</button><div class="top"><h1>${sec[2]}</h1><div class="tools">${syncBadge()}${eyeBtn()}</div></div>`;
  const body = {
    nube: () => cloudSection(),
    seguridad: () => securitySection(),
    apariencia: () => `<div class="card"><h2><i class="icon-palette"></i> Paleta de colores</h2><p class="mini" style="margin:0 0 6px">Solo en este teléfono.</p>
<div class="palgrid">${Object.entries(PALETTES).map(([id, p]) => `<button type="button" class="${palette == id ? 'on' : ''}" onclick="setPalette('${id}')"><span class="sw">${p.sw.map(c => `<span style="background:${c}"></span>`).join('')}</span>${esc(p.name)}</button>`).join('')}</div></div>
${iconThemeHTML()}
<div class="card"><h2><i class="icon-sun"></i> Modo</h2><div class="seg sm">
<button type="button" class="${theme == 'claro' ? 'on' : ''}" onclick="setTheme('claro')"><i class="icon-sun"></i> Claro</button>
<button type="button" class="${theme == 'dark' ? 'on' : ''}" onclick="setTheme('dark')"><i class="icon-moon"></i> Oscuro</button>
<button type="button" class="${theme == 'auto' ? 'on' : ''}" onclick="setTheme('auto')"><i class="icon-monitor"></i> Auto</button></div></div>
<button style="width:100%" onclick="openHomeEdit()"><i class="icon-sliders"></i> Personalizar Inicio</button>`,
    personas: () => `<div class="card"><p class="mini" style="margin:0 0 6px">Toca un nombre para cambiarlo (se actualiza en todos los movimientos) o borrarlo.</p>
<div class="tags">${cfg.people.map(p => `<button onclick="openPersonEdit(this.dataset.n)" data-n="${esc(p)}"><i class="icon-user"></i>${esc(p)}${p == me ? ' <span class="pill">tú</span>' : ''}</button>`).join('')}</div>
<div class="add"><input id="a-people" placeholder="Agregar persona…" onkeydown="if(event.key=='Enter')ad('people')"><button class="p" onclick="ad('people')">Agregar</button></div>
${cloudOn() ? '' : `<label style="margin-top:10px">Este teléfono es de (se elige solo en “Quién”)<select onchange="setMyPerson(this.value);render()"><option value="">Nadie en particular</option>${opts(cfg.people, me)}</select></label>`}</div>`,
    categorias: () => `${catCard('Categorías de egreso', 'e')}${catCard('Categorías de ingreso', 'i')}<button style="width:100%" onclick="toolView='rules';go('tools')"><i class="icon-wand-sparkles"></i> Reglas automáticas de categoría</button>`,
    atajos: () => shortcutsSection(),
    avisos: () => alertsSettingsHTML(),
    monedas: () => `<div class="card"><p class="mini" style="margin:0 0 8px">La tasa de referencia se usa para convertir tus saldos en otras monedas al patrimonio, y como sugerencia en los formularios.</p>
${cfg.cur.map(c => `<div class="row"><div><b>${c}</b><small>Última tasa usada: ${rateOf(c) && rateOf(c) != refRate(c) ? rateOf(c) : '—'}</small></div><input type="number" inputmode="decimal" step="0.0001" min="0" style="width:120px" placeholder="1 ${c} = ? DOP" value="${(cfg.rates || {})[c] || ''}" onchange="setRefRate('${c}',this.value)"><button class="d" aria-label="Quitar ${c}" onclick="rm('cur','${c}')"><i class="icon-x"></i></button></div>`).join('')}
<div class="add" style="margin-top:8px"><input id="a-cur" placeholder="Código de 3 letras, ej: CAD" maxlength="3" autocapitalize="characters" onkeydown="if(event.key=='Enter')ad('cur')"><button class="p" onclick="ad('cur')">Agregar</button></div></div>`,
    datos: () => `<div class="card"><h2><i class="icon-download"></i> Respaldo y Excel</h2><p class="mini" style="margin:0 0 8px">Guarda una copia de todos tus datos, o exporta los ingresos y egresos a Excel (según los filtros de Movimientos).</p>
<div class="add" style="flex-wrap:wrap"><button class="p" onclick="bk()">Descargar respaldo</button><button onclick="cp()">Copiar respaldo</button><button onclick="xl()">Excel</button></div>
<details style="margin-top:10px"><summary>Importar un respaldo ›</summary>
<label style="margin-top:8px">Archivo<input type="file" accept=".json,application/json,text/plain" onchange="fi(this)"></label>
<label style="margin-top:8px">O pega el texto<textarea id="paste" rows="3"></textarea></label>
<div class="add" style="margin-top:8px;flex-wrap:wrap"><button class="p" onclick="merge($('paste').value,$('rp').checked)">Importar texto</button><label class="toggle"><input type="checkbox" id="rp">Reemplazar todo</label></div></details></div>
<div class="card list"><button class="lrow" onclick="go('trash')">${circ('Papelera', 'archive')}<div><b>Papelera</b><small>${(() => { const n = trashItems().length; return n ? n + ' borrados en los últimos ' + KEEP_DAYS + ' días' : 'Recupera lo que borraste (30 días)'; })()}</small></div><i class="icon-chevron-right mut"></i></button>
<button class="lrow" onclick="openImport()">${circ('Importar', 'file-up')}<div><b>Importar estado de cuenta</b><small>Excel o CSV del banco</small></div><i class="icon-chevron-right mut"></i></button></div>
<div class="card"><h2 class="out"><i class="icon-trash-2"></i> Empezar de cero</h2><p class="mini" style="margin:0 0 8px">${cloudOn() ? 'Borra los datos del hogar en la nube y en todos sus teléfonos.' : 'Borra los datos de este teléfono.'} Descarga un respaldo antes.</p><button class="d" onclick="resetAll()">Borrar todos los datos</button></div>`,
  }[setSub];
  app.innerHTML = back + body();
}
function catCard(title, t) {
  return `<div class="card"><h2><i class="icon-tag"></i> ${title}</h2><p class="mini" style="margin:0 0 6px">Toca una para renombrarla, cambiar su ícono o sus subcategorías.</p>
<div class="tags">${cfg.cats.filter(c => c.t == t).map(c => `<button onclick="openCatEdit('${t}',this.dataset.n)" data-n="${esc(c.n)}"><i class="icon-${esc(c.icon)}"></i>${esc(c.n)}${(cfg.subs || {})[c.n] && cfg.subs[c.n].length ? ` <span class="pill">${cfg.subs[c.n].length}</span>` : ''}</button>`).join('')}</div>
<button class="link" onclick="openCatEdit('${t}')"><i class="icon-plus"></i> Nueva categoría</button></div>`;
}
