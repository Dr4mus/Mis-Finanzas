'use strict';
(window.__V = window.__V || {})['plan.js'] = '10.1.0';
/* Mis finanzas — Planificar: te alcanza, saldo proyectado, comparación con tu promedio,
   calendario de pagos y recordatorios para el calendario del teléfono. */
let planDays = 30, planDaily = true, calYm = today().slice(0, 7), calDay = '';
const nDias = n => n + (n == 1 ? ' día' : ' días');

// ============ ¿Te alcanza? ============
function alcanzaCard(full) {
  const s = safeToSpend();
  if (!s) return full ? `<div class="card"><h2><i class="icon-wallet"></i> ¿Te alcanza?</h2><p class="empty">Agrega una cuenta en pesos (efectivo o banco) para calcularlo.</p></div>` : '';
  const td = today(), finMes = !s.income && s.until == monthEnd(td.slice(0, 7));
  const hasta = finMes ? 'hasta fin de mes' : 'hasta el ' + fdate(s.until), ok = s.left >= 0;
  const rows = s.items.map(x => `<div class="row">${circ(x.name, x.icon)}<div><b>${esc(x.name)}</b><small>${fdate(x.d)}${x.late ? ' ' + pill('pendiente', 'warn') : ''}</small></div><b class="num out">−${money(x.v)}</b></div>`).join('');
  return `<div class="card"><h2><i class="icon-wallet"></i> ${ok ? 'Te alcanza' : 'No te alcanza'} ${hasta}</h2>
<div class="big2 num ${ok ? '' : 'out'}">${money(Math.abs(s.left))}</div>
<small class="mut">${ok ? `puedes gastar · ~${money(s.perDay)} por día durante ${nDias(s.days)}` : 'te faltan para cubrir lo que viene'}</small>
${full ? `<p class="mini" style="margin:8px 0 0">Libre hoy ${money(s.free)} − por pagar ${money(s.committed)}${s.items.length ? ` (${s.items.length})` : ''}${s.income ? ` · antes de “${esc(s.income.r.name)}”` : ''}.</p>` : s.committed ? `<p class="mini" style="margin:6px 0 0">Ya descontados ${money(s.committed)} por pagar (${s.items.length}).</p>` : ''}
${!s.income ? `<p class="mini" style="margin:4px 0 0">Agrega tu salario en <button class="link" style="display:inline;padding:0;min-height:0" onclick="go('rec')">Recurrentes</button> para que el cálculo llegue hasta tu próximo cobro.</p>` : ''}
${full ? (rows ? `<div style="margin-top:8px">${rows}</div>` : '<p class="mini">No hay pagos pendientes antes de esa fecha.</p>') + `<p class="mini" style="margin:8px 0 0">“Libre” es lo que tienes en tus cuentas en pesos (sin tarjetas) menos lo apartado para metas. “Por pagar” son tus recurrentes de gasto, aportes a metas y pagos de tarjeta que vencen antes de esa fecha.</p>`
      : `<button class="link" onclick="go('plan')">Ver detalle</button>`}</div>`;
}

// ============ Comparado con tu promedio ============
const markBar = (pct, col, mark) => `<div class="bar mk"><div style="width:${Math.max(0, Math.min(100, pct))}%;background:${col}"></div>${mark != null ? `<i style="left:${Math.max(0, Math.min(100, mark))}%"></i>` : ''}</div>`;
function promedioCard() {
  const cc = catCompare(today().slice(0, 7)); if (!cc) return '';
  const ahead = r => r.v - r.exp;
  const hot = cc.rows.filter(r => r.avg > 0 && r.pace > 1.15 && ahead(r) > Math.max(300, r.avg * 0.1)).sort((a, b) => ahead(b) - ahead(a)).slice(0, 3);
  const tp = cc.expTot ? cc.vTot / cc.expTot : null;
  const tag = tp == null ? '' : tp > 1.1 ? pill('vas más rápido', 'warn') : tp < 0.9 ? pill('vas por debajo', 'in') : pill('vas a tu ritmo');
  return `<div class="card"><h2><i class="icon-gauge"></i> Comparado con tu promedio</h2>
<p class="mini" style="margin:0 0 6px">Llevas <b>${money(cc.vTot)}</b> · promedio ${money(cc.avgTot)}/mes ${tag}</p>
${hot.length ? hot.map(r => `<div class="row" style="flex-wrap:wrap">${circ(r.c, icoFor(r.c, 'e'))}<div><b>${esc(r.c)}</b><small>${money(r.v)} · promedio ${money(r.avg)}/mes</small></div><b class="num warn">${r.pct > 0 ? '+' : ''}${r.pct}%</b>
<div style="flex-basis:100%;padding-left:54px">${markBar(r.v / r.avg * 100, r.v > r.avg ? 'var(--out)' : 'var(--yellow)', r.exp / r.avg * 100)}</div></div>`).join('')
      : '<p class="mut" style="margin:0">Ninguna categoría va por encima de su ritmo normal. 👍</p>'}
<button class="link" onclick="repTab='cat';go('rep')">Ver todas las categorías</button></div>`;
}
// Tabla completa para Reportes
function compareTable(ym) {
  const cc = catCompare(ym);
  if (!cc) return `<div class="card"><h2>Comparado con tu promedio</h2><p class="empty">Hace falta al menos un mes anterior con movimientos.</p></div>`;
  const isCur = ym == today().slice(0, 7);
  return `<div class="card"><h2>Comparado con tu promedio (${cc.months == 1 ? 'mes anterior' : cc.months + ' meses anteriores'})</h2>
${isCur ? `<p class="mini" style="margin:0 0 6px">El mes va por el día ${+today().slice(8, 10)}: la rayita marca lo que sueles llevar gastado a esta altura del mes.</p>` : ''}
${cc.rows.filter(r => r.v || r.avg).map(r => {
    const col = !r.avg ? 'var(--brand)' : r.v > r.avg ? 'var(--out)' : r.pace > 1.15 ? 'var(--yellow)' : 'var(--in)';
    const d = r.pct == null ? pill('nuevo') : `<b class="num ${r.pct > 0 ? 'out' : 'in'}">${r.pct > 0 ? '+' : ''}${r.pct}%</b>`;
    return `<div class="row" style="flex-wrap:wrap">${circ(r.c, icoFor(r.c, 'e'))}<div><b>${esc(r.c)}</b><small>${money(r.v)} · promedio ${money(r.avg)}</small></div>${d}
<div style="flex-basis:100%;padding-left:54px">${markBar(r.avg ? r.v / r.avg * 100 : 100, col, isCur && r.avg ? r.exp / r.avg * 100 : null)}</div></div>`;
  }).join('')}</div>`;
}

// ============ Saldo proyectado ============
function projectionCard() {
  const daily = planDaily ? dailyVariable() : 0, p = projection(planDays, daily), dv = dailyVariable();
  const neg = p.negatives.map(n => `<div class="alert">${circ(n.acc.name, 'alert-triangle')}<div><b>${esc(n.acc.name)} quedaría en negativo</b><small>${n.now ? 'Ya está en negativo' : 'Desde el ' + fdate(n.d)} · hasta ${money(n.v, n.acc.currency)}</small></div></div>`).join('');
  return `<div class="card"><h2><i class="icon-chart-line"></i> Saldo proyectado</h2>
<div class="chips" style="margin-bottom:8px">${[30, 60, 90].map(n => `<button class="${planDays == n ? 'on' : ''}" onclick="planDays=${n};render()">${n} días</button>`).join('')}</div>
<div class="kp" style="margin-bottom:8px"><div><small>Hoy</small><b>${money(p.start.v)}</b></div><div><small>En ${planDays} días</small><b class="${p.end.v < 0 ? 'out' : ''}">${money(p.end.v)}</b></div><div><small>Punto más bajo</small><b class="${p.min.v < 0 ? 'out' : ''}">${money(p.min.v)}</b><span class="delta mut">${fdate(p.min.d)}</span></div></div>
<canvas id="c-proj"></canvas>
${neg ? `<div style="margin-top:10px">${neg}</div>` : ''}
${dv ? `<label class="toggle" style="margin-top:10px"><input type="checkbox" ${planDaily ? 'checked' : ''} onchange="planDaily=this.checked;render()"> Restar mi gasto del día a día (~${money(dv)} por día, según los últimos 3 meses)</label>` : ''}
<p class="mini" style="margin:8px 0 0">Disponible en tus cuentas en pesos. Incluye tus recurrentes (ingresos, facturas, aportes y transferencias) y el próximo pago de cada tarjeta${dv && planDaily ? ', y resta tu gasto diario promedio' : ''}. Es una estimación: lo que anotes cambia el cálculo.</p></div>`;
}
function drawProjection() {
  const el = $('c-proj'); if (!el || noCharts()) return;
  const { V, o } = chartBase(), p = projection(planDays, planDaily ? dailyVariable() : 0);
  const step = planDays > 30 ? 15 : 7;
  ch.push(new Chart(el, {
    type: 'line',
    data: { labels: p.series.map(s => fdate(s.d)), datasets: [{ label: 'Disponible', data: p.series.map(s => s.v), borderColor: V('--brand'), backgroundColor: V('--brand') + '22', fill: true, tension: .2, pointRadius: 0, segment: { borderColor: c => (c.p1.parsed.y < 0 ? V('--out') : undefined) } }] },
    options: { ...o, plugins: { ...o.plugins, legend: { display: false } }, scales: { x: { ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % step == 0 ? p.series[i] && fdate(p.series[i].d) : '') } }, y: { ticks: { callback: axisFmt } } } }
  }));
}

// ============ Calendario de pagos ============
const CAL_COL = { i: 'var(--in)', e: 'var(--out)', g: 'var(--brand)', tr: 'var(--blue)', pay: 'var(--warn)', cut: 'var(--mut)', loan: 'var(--purple)', debt: 'var(--pink)' };
const CAL_ST = { done: ['Hecho', 'in'], late: ['Pendiente', 'warn'], next: ['', ''] };
function calRow(e) {
  const st = e.k == 'cut' ? ['Corte', ''] : CAL_ST[e.st] || ['', ''];
  const inflow = e.k == 'i' || (e.k == 'debt' && e.dir == 'owed');
  const amt = e.v != null && e.v > 0 ? `<b class="num ${inflow ? 'in' : e.k == 'cut' ? '' : 'out'}">${inflow ? '+' : '−'}${money(e.v, e.cu)}</b>` : '';
  const act = e.st == 'late' && e.rec ? `<button class="p" onclick="confirmRec('${e.rec}','${e.d}')">Confirmar</button>` : e.k == 'pay' && e.st != 'done' && e.v > 0 ? `<button onclick="openTransferForm(null,'${e.acc}',${e.v})">Pagar</button>` : e.k == 'loan' && e.st != 'done' ? `<button onclick="openLoanPay('${e.loan}')">Pagar</button>` : e.k == 'debt' && e.st != 'done' ? `<button onclick="openDebtPay('${e.debt}')">${e.dir == 'owe' ? 'Pagar' : 'Cobrar'}</button>` : '';
  return `<div class="row">${circ(e.name, e.icon || 'calendar')}<div><b>${esc(e.name)}</b><small>${fday(e.d)}${st[0] ? ' ' + pill(st[0], st[1]) : ''}</small></div>${amt}${act}</div>`;
}
function calendarCard() {
  const ev = calendarEvents(calYm), td = today(), by = {};
  ev.forEach(e => (by[e.d] = by[e.d] || []).push(e));
  if (!calDay || calDay.slice(0, 7) != calYm) calDay = td.slice(0, 7) == calYm ? td : (ev[0] || { d: calYm + '-01' }).d;
  const first = new Date(calYm + '-01T00:00:00Z'), lead = (first.getUTCDay() + 6) % 7, dim = +monthEnd(calYm).slice(8, 10);
  let cells = '<span></span>'.repeat(lead);
  for (let k = 1; k <= dim; k++) {
    const d = calYm + '-' + String(k).padStart(2, '0'), list = by[d] || [];
    const dots = [...new Set(list.map(e => e.k))].slice(0, 3).map(k2 => `<i style="background:${CAL_COL[k2]}"></i>`).join('');
    const late = list.some(e => e.st == 'late');
    cells += `<button type="button" class="cd${d == td ? ' today' : ''}${d == calDay ? ' sel' : ''}${late ? ' late' : ''}" data-d="${d}" onclick="calPick(this.dataset.d)" aria-label="${fday(d)}${list.length ? ', ' + list.length + ' pagos' : ''}"><span>${k}</span><b>${dots}</b></button>`;
  }
  const out = ev.filter(e => e.k == 'e' || e.k == 'pay' || e.k == 'loan').reduce((s, e) => s + (e.v > 0 ? convert(e.v, e.cu || 'DOP', 'DOP', e.d) : 0), 0);
  const inc = ev.filter(e => e.k == 'i').reduce((s, e) => s + convert(e.v, e.cu || 'DOP', 'DOP', e.d), 0);
  return `<div class="card"><h2><i class="icon-calendar-days"></i> Calendario de pagos</h2>
<div class="add" style="align-items:center;margin-bottom:8px"><button class="iconbtn" aria-label="Mes anterior" onclick="calYm=addMonths(calYm,-1);render()"><i class="icon-chevron-left"></i></button>
<b style="flex:1;text-align:center;text-transform:capitalize">${ymLabel(calYm)}</b><button class="iconbtn" aria-label="Mes siguiente" onclick="calYm=addMonths(calYm,1);render()"><i class="icon-chevron-right"></i></button></div>
<div class="cal"><small>L</small><small>M</small><small>M</small><small>J</small><small>V</small><small>S</small><small>D</small>${cells}</div>
<div class="legend">${[['i', 'Ingreso'], ['e', 'Factura'], ['g', 'Meta'], ['tr', 'Transferencia'], ['pay', 'Tarjeta'], ['loan', 'Préstamo'], ['debt', 'Deuda'], ['cut', 'Corte']].map(([k, l]) => `<span><i style="background:${CAL_COL[k]}"></i>${l}</span>`).join('')}</div>
<div id="calsel">${calSelHTML(by)}</div>
<p class="mini" style="margin:8px 0 0">En el mes: ingresos programados ${money(inc)} · pagos ${money(out)}.</p></div>`;
}
function calSelHTML(by) {
  by = by || calendarEvents(calYm).reduce((o, e) => ((o[e.d] = o[e.d] || []).push(e), o), {});
  const list = by[calDay] || [];
  return `<h3 class="calh">${fday(calDay)}</h3>${list.length ? list.map(calRow).join('') : '<p class="mini" style="margin:0">Nada programado este día.</p>'}`;
}
function calPick(d) {
  calDay = d; document.querySelectorAll('.cal .cd').forEach(b => b.classList.toggle('sel', b.dataset.d == d));
  const el = $('calsel'); if (el) el.innerHTML = calSelHTML();
}

// ============ Recordatorios en el calendario del teléfono (.ics) ============
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsDate = iso => iso.replace(/-/g, '');
// Las líneas de un .ics no deben pasar de 75 bytes: se cortan y siguen con un espacio
function icsFold(line) {
  if (line.length * 3 <= 74) return line; // corta segura: aunque cada letra ocupe 3 bytes, cabe
  const enc = new TextEncoder(), out = []; let cur = '';
  for (const ch2 of line) { if (enc.encode(cur + ch2).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; } cur += ch2; }
  out.push(cur); return out.join('\r\n ');
}
const WD2 = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// Día del mes en una regla: 29–31 usan "el último que exista hasta ese día" (febrero no se salta)
const byMonthDay = day => (day == 'ultimo' ? 'BYMONTHDAY=-1' : +day >= 29 ? 'BYMONTHDAY=' + [...Array(+day - 27)].map((_, i) => 28 + i).join(',') + ';BYSETPOS=-1' : 'BYMONTHDAY=' + (+day));
function recRule(r) {
  if (r.freq == 'semanal') return 'FREQ=WEEKLY;BYDAY=' + WD2[Math.min(6, Math.max(0, Number(r.day) || 0))];
  if (r.freq == 'quincenal') return 'FREQ=MONTHLY;BYMONTHDAY=1,15';
  if (r.freq == 'anual') return 'FREQ=YEARLY;BYMONTH=' + recMonth(r) + ';' + byMonthDay(r.day);
  return 'FREQ=MONTHLY;' + byMonthDay(r.day);
}
function buildIcs(opt) {
  const td = today(), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), ev = [];
  const alarm = { '0': 'PT9H', '1': '-PT15H', '2': '-P1DT15H' }[opt.when]; // 9:00 a. m. del mismo día, del día antes o de dos días antes
  const add = (uid, d, rule, title, desc) => {
    const L = ['BEGIN:VEVENT', 'UID:' + uid + '@mis-finanzas', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(d), 'DTEND;VALUE=DATE:' + icsDate(addDay(d)), 'RRULE:' + rule, 'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), 'TRANSP:TRANSPARENT'];
    if (alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'TRIGGER:' + alarm, 'END:VALARM');
    L.push('END:VEVENT'); ev.push(...L);
  };
  const what = { e: 'Pagar', i: 'Cobro', g: 'Aporte a meta', tr: 'Transferir' };
  recs.filter(r => r.active !== false).forEach(r => {
    const d = nextDates(r, maxISO(td, r.startDate || td), addDays(td, 400))[0]; if (!d) return;
    const m = opt.amounts ? ' · ' + money(r.amount, recCur(r)) : '';
    add(r.id, d, recRule(r), `${what[r.t] || 'Pago'}: ${r.name}${m}`, `Recordatorio de Mis finanzas. ${dayLabel(r)}${r.cutDay ? ', corte el día ' + r.cutDay : ''}. Abre la app para confirmarlo.`);
  });
  accs.filter(a => isCard(a) && a.payDay).forEach(a => {
    const d = nextDayAfter(+a.payDay, addDays(td, -1)); if (!d) return;
    add('tarjeta-' + a.id, d, 'FREQ=MONTHLY;' + byMonthDay(a.payDay), `Pagar tarjeta ${a.name}`, `Fecha límite de pago${a.cutDay ? ' (corte el día ' + a.cutDay + ')' : ''}. En la app, Cuentas → ${a.name} → Pagar te dice cuánto.`);
  });
  accs.filter(a => isLoan(a) && a.payDay >= 1 && loanOwed(a) > 0.004).forEach(a => {
    const d = nextDayAfter(+a.payDay, addDays(td, -1)); if (!d) return;
    add('prestamo-' + a.id, d, 'FREQ=MONTHLY;' + byMonthDay(a.payDay), `Cuota: ${a.name}${opt.amounts && a.payment ? ' · ' + money(a.payment, a.currency) : ''}`, `Cuota del préstamo${a.lender ? ' con ' + a.lender : ''}. En la app: Más → Deudas → Pagar cuota.`);
  });
  debts.filter(x => x.status == 'open' && x.due && x.due >= td).forEach(x => {
    const L = ['BEGIN:VEVENT', 'UID:deuda-' + x.id + '@mis-finanzas', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(x.due), 'DTEND;VALUE=DATE:' + icsDate(addDay(x.due)), 'SUMMARY:' + icsEsc((x.dir == 'owe' ? 'Pagarle a ' : 'Cobrarle a ') + x.who + (opt.amounts ? ' · ' + money(debtLeft(x), x.cu) : '')), 'DESCRIPTION:' + icsEsc('Fecha límite de la deuda. En la app: Más → Deudas → Personas.'), 'TRANSP:TRANSPARENT'];
    if (alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Deuda con ' + x.who), 'TRIGGER:' + alarm, 'END:VALARM');
    L.push('END:VEVENT'); ev.push(...L);
  });
  const n = ev.filter(l => l == 'BEGIN:VEVENT').length;
  // el texto se arma solo cuando se pide (para contar no hace falta)
  return { n, get text() { return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mis finanzas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Finanzas', ...ev, 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n'; } };
}
let icsOpt = { amounts: false, when: '1' };
function remindersCard() {
  const n = buildIcs(icsOpt).n;
  return `<div class="card"><h2><i class="icon-bell"></i> Recordatorios en tu calendario</h2>
<p class="mini" style="margin:0 0 8px">Pasa tus facturas, cobros, aportes y pagos de tarjeta al calendario del teléfono, para que te avise aunque no abras la app.${n ? ` Hay <b>${n}</b> recordatorio${n > 1 ? 's' : ''} para agregar.` : ''}</p>
${n ? `<button class="p" style="width:100%" onclick="openIcs()"><i class="icon-calendar-plus"></i> Agregar a mi calendario</button>` : '<p class="empty" style="margin:0">Primero agrega recurrentes o tarjetas con día de pago.</p>'}</div>`;
}
function openIcs() {
  const f = icsOpt;
  dlg.innerHTML = `<form onsubmit="return false"><h2>Agregar a mi calendario</h2>
<label>Avisarme<select onchange="icsOpt.when=this.value">${[['1', 'El día antes, 9:00 a. m.'], ['2', 'Dos días antes, 9:00 a. m.'], ['0', 'El mismo día, 9:00 a. m.'], ['none', 'Sin aviso']].map(([v, l]) => `<option value="${v}"${f.when == v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
<label class="toggle"><input type="checkbox" ${f.amounts ? 'checked' : ''} onchange="icsOpt.amounts=this.checked"> Poner los montos en el calendario</label>
<p class="mini" style="margin:0">Si tu calendario lo ve alguien más (por ejemplo, el del trabajo), deja los montos apagados.</p>
<div class="note"><b>iPhone:</b> toca “Abrir en Calendario” y luego <b>Agregar todo</b>. Si no aparece, toca “Compartir archivo”, envíatelo por correo y ábrelo desde la app Mail.<br><b>Android:</b> toca “Compartir archivo” y ábrelo con tu app de calendario. Con Google Calendar, impórtalo desde una computadora en calendar.google.com → Configuración → Importar.</div>
<div class="seg"><button type="button" onclick="icsGo('open')"><i class="icon-calendar-plus"></i> Abrir en Calendario</button><button type="button" class="p" onclick="icsGo('share')">Compartir archivo</button></div>
<p class="mini" style="margin:0">Si después cambias tus recurrentes, borra los recordatorios viejos antes de agregarlos de nuevo para que no se dupliquen.</p>
<div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button></div></form>`;
  dlgShow();
}
function icsGo(mode) {
  const { text } = buildIcs(icsOpt), name = 'recordatorios-finanzas.ics';
  if (mode == 'share') return download(name, text, 'text/calendar');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' })), a = document.createElement('a');
  a.href = url; if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ============ pantalla Planificar ============
function renderPlan(app) {
  app.innerHTML = `${head('Planificar', true)}${alcanzaCard(true)}${projectionCard()}${calendarCard()}${remindersCard()}`;
  drawProjection();
}
