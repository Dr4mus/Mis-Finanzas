'use strict';
(window.__V = window.__V || {})['herramientas.js'] = '10.2.0';
/* Mis finanzas — Herramientas: suscripciones detectadas, presupuesto sugerido, simulador de metas,
   lo mío / lo tuyo / lo nuestro, pegar alerta del banco, importar estado de cuenta, reglas de categoría,
   etiquetas y eventos, y cierre de mes. */
let toolView = '';
const TOOLS = [
  ['subs', 'repeat', 'Suscripciones', 'Cobros que se repiten cada mes'],
  ['alert', 'message-square', 'Pegar alerta del banco', 'Convierte el SMS o correo en un movimiento'],
  ['import', 'file-up', 'Importar estado de cuenta', 'Excel o CSV del banco, sin duplicados'],
  ['rules', 'wand-sparkles', 'Reglas de categoría', '“Uber” → Transporte, automático'],
  ['tags', 'tag', 'Etiquetas y eventos', 'Un viaje, una boda… con su presupuesto'],
  ['close', 'circle-check', 'Cierre de mes', 'Compara tus saldos con los del banco'],
  ['calc', 'calculator', 'Calculadora de préstamos', 'Cuota, intereses y abonos extra'],
];
function renderTools(app) {
  const v = { subs: toolSubsHTML, rules: toolRulesHTML, tags: toolTagsHTML, close: toolCloseHTML }[toolView];
  if (v) { app.innerHTML = `<button class="back" onclick="toolView='';render()"><i class="icon-chevron-left"></i> Herramientas</button><div class="top"><h1>${esc((TOOLS.find(t => t[0] == toolView) || [])[2] || '')}</h1><div class="tools">${syncBadge()}${eyeBtn()}</div></div>${v()}`; return; }
  app.innerHTML = `${head('Herramientas', true)}<div class="card list">${TOOLS.map(([k, ic, t, d]) => `<button class="lrow" onclick="openTool('${k}')">${circ(t, ic)}<div><b>${t}</b><small>${d}</small></div><i class="icon-chevron-right mut"></i></button>`).join('')}</div>`;
}
function openTool(k) {
  if (k == 'alert') return openAlertPaste();
  if (k == 'import') return openImport();
  if (k == 'calc') return openCalc();
  toolView = k; render(); scrollTo(0, 0);
}

// ============ suscripciones detectadas ============
const subKey = x => norm(x.sub || x.n || '').replace(/[^a-z0-9 ]/g, '').trim();
function detectSubs() {
  const td = today(), from = addMonths(td.slice(0, 7), -6) + '-01', ign = new Set(cfg.subsIgnore || []), G = {};
  txs.filter(x => x.t == 'e' && !x.rec && x.d >= from).forEach(x => { const k = subKey(x); if (!k) return; const key = x.c + '|' + k; (G[key] = G[key] || []).push(x); });
  const out = [];
  for (const [key, L] of Object.entries(G)) {
    if (ign.has(key)) continue;
    const months = [...new Set(L.map(x => x.d.slice(0, 7)))].sort(); if (months.length < 2) continue;
    const vals = L.map(x => x.v), avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (vals.some(v => Math.abs(v - avg) > avg * 0.15)) continue; // montos parecidos
    if (L.length > months.length + 1) continue; // más de una vez al mes: no parece suscripción
    const last = L.slice().sort((a, b) => b.d.localeCompare(a.d))[0];
    if (months[months.length - 1] < addMonths(td.slice(0, 7), -1)) continue; // ya no se cobra
    if (recs.some(r => r.t == 'e' && r.c == last.c && Math.abs(recDOP(r, td) - avg) <= avg * 0.15)) continue; // ya es recurrente
    out.push({ key, name: last.sub || last.n || last.c, c: last.c, avg: round2(avg), months: months.length, last, day: +last.d.slice(8, 10) });
  }
  return out.sort((a, b) => b.avg - a.avg);
}
function toolSubsHTML() {
  const found = detectSubs(), known = recs.filter(r => r.t == 'e' && r.active !== false && r.freq == 'mensual');
  const totKnown = known.reduce((s, r) => s + recDOP(r, today()), 0), totFound = found.reduce((s, x) => s + x.avg, 0);
  return `<div class="kp"><div><small>Pagos fijos al mes</small><b>${money(totKnown + totFound)}</b><span class="delta mut">${money((totKnown + totFound) * 12)} al año</span></div></div>
<div class="card"><h2><i class="icon-sparkles"></i> Encontradas en tus gastos</h2>${found.length ? found.map(x => `<div class="trow"><div class="row" style="border:0">${circ(x.name, icoFor(x.c, 'e'))}<div><b>${esc(x.name)}</b><small>${esc(x.c)} · ${x.months} meses seguidos · último ${fdate(x.last.d)}</small></div><b class="num">${money(x.avg)}</b></div>
<div class="tact"><span></span><div style="display:flex;gap:6px"><button data-k="${esc(x.key)}" onclick="ignoreSub(this.dataset.k)">No es fijo</button><button class="p" data-k="${esc(x.key)}" onclick="subToRec(this.dataset.k)">Volverlo recurrente</button></div></div></div>`).join('')
      : '<p class="mini" style="margin:0">No encontré cobros que se repitan con el mismo monto. Se detectan con el detalle o la nota del gasto (por ejemplo “Netflix”) después de 2 meses.</p>'}</div>
<div class="card"><h2><i class="icon-repeat"></i> Ya en Recurrentes</h2>${known.length ? known.map(r => `<div class="row tap" onclick="openRecForm('${r.id}')">${circ(r.name, recIcon(r))}<div><b>${esc(r.name)}</b><small>${esc(r.c || '')} · ${esc(dayLabel(r))}</small></div><b class="num">${money(r.amount, r.currency)}</b></div>`).join('') : '<p class="mini" style="margin:0">Ninguno.</p>'}</div>`;
}
function ignoreSub(k) { const c = deep(cfg); c.subsIgnore = [...new Set([...(c.subsIgnore || []), k])]; saveCfg(c); toast('Listo, no lo vuelvo a mostrar'); }
function subToRec(k) {
  const x = detectSubs().find(s => s.key == k); if (!x) return;
  openRecForm(null, { name: x.name, t: 'e', c: x.c, amount: x.avg, accId: x.last.accId, w: x.last.w, freq: 'mensual', day: Math.min(28, x.day), startDate: addMonths(today().slice(0, 7), 1) + '-01' });
}

// ============ presupuesto sugerido (50/30/20) ============
const NEEDS = ['Vivienda', 'Comida', 'Transporte', 'Salud', 'Educación', 'Servicios', 'Deudas', 'Intereses'];
const SAVE = ['Ahorro'];
const catGroup = n => (NEEDS.includes(n) ? 'need' : SAVE.includes(n) ? 'save' : 'want');
function suggestBudget() {
  const td = today(), months = [1, 2, 3].map(k => addMonths(td.slice(0, 7), -k));
  const inc = months.reduce((s, m) => s + monthStats(m).inc, 0) / 3, sp = {};
  txs.filter(x => x.t == 'e' && months.includes(x.d.slice(0, 7))).forEach(x => sp[x.c] = (sp[x.c] || 0) + x.v / 3);
  const target = { need: inc * 0.5, want: inc * 0.3, save: inc * 0.2 }, tot = { need: 0, want: 0, save: 0 };
  Object.entries(sp).forEach(([c, v]) => tot[catGroup(c)] += v);
  const rows = Object.entries(sp).filter(([, v]) => v > 0).map(([c, v]) => {
    const g = catGroup(c), scale = g != 'save' && inc > 0 && tot[g] > target[g] ? target[g] / tot[g] : 1;
    return { c, g, avg: round2(v), sug: Math.max(100, Math.round(v * scale / 100) * 100) };
  }).sort((a, b) => a.g.localeCompare(b.g) || b.avg - a.avg);
  return { inc: round2(inc), target, tot, rows };
}
function openSuggest() {
  const s = suggestBudget(), G = { need: 'Necesidades (50%)', want: 'Gustos (30%)', save: 'Ahorro (20%)' };
  if (!s.rows.length) { dlg.innerHTML = `<h2>Presupuesto sugerido</h2><p class="mut">Hace falta al menos un mes de gastos anotados para sugerirte topes.</p><div class="seg"><button onclick="dlg.close()">Cerrar</button></div>`; return dlgShow(); }
  dlg.innerHTML = `<form onsubmit="return applySuggest(event)"><h2><i class="icon-wand-sparkles"></i> Presupuesto sugerido</h2>
<p class="note">Según tus últimos 3 meses: ingresas ~${money(s.inc)} al mes. La regla 50/30/20 sugiere ${money(s.target.need)} para necesidades, ${money(s.target.want)} para gustos y ${money(s.target.save)} para ahorro.</p>
${['need', 'want', 'save'].map(g => { const L = s.rows.filter(r => r.g == g); if (!L.length) return ''; const over = s.inc && g != 'save' && s.tot[g] > s.target[g]; return `<h3 class="calh">${G[g]} ${over ? pill('gastas más de lo sugerido', 'warn') : ''}</h3>${L.map(r => `<div class="row"><div><b>${esc(r.c)}</b><small>Promedio ${money(r.avg)}</small></div><input type="number" inputmode="decimal" step="100" min="0" style="width:110px" data-c="${esc(r.c)}" value="${r.sug}"></div>`).join('')}`; }).join('')}
<p class="mini" style="margin:0">Puedes cambiar cada monto antes de aplicarlo. Se guardan como topes de todos los meses.</p>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Aplicar topes</button></div></form>`;
  dlgShow();
}
function applySuggest(e) {
  e.preventDefault(); const c = deep(cfg); c.budgetCats = c.budgetCats || {}; let tot = 0;
  dlg.querySelectorAll('input[data-c]').forEach(i => { const v = parseFloat(i.value); if (v > 0) { c.budgetCats[i.dataset.c] = v; tot += v; } });
  if (!c.budgetTotal) c.budgetTotal = round2(tot);
  saveCfg(c); dlg.close(); toast('Topes aplicados', { kind: 'ok' }); return false;
}

// ============ simulador de metas ============
let gsim = {};
function openGoalSim(id) { const g = goals.find(x => x.id == id); if (!g) return; const pl = goalPlan(g), p = goalProjection(g); gsim = { id, per: pl ? Math.round(pl.amount * PLAN_FREQ[pl.freq].pm) : p && p.perMonth ? Math.round(p.perMonth) : '', date: g.due || '' }; drawGoalSim(); }
function drawGoalSim() {
  const f = gsim, g = goals.find(x => x.id == f.id), p = goalProgress(g), td = today();
  const months = +f.per > 0 ? Math.ceil(p.remaining / +f.per) : null;
  const need = f.date && f.date > td ? round2(p.remaining / Math.max(1, Math.ceil(daysBetween(td, f.date) / 30.44))) : null;
  dlg.innerHTML = `<form onsubmit="return false"><h2><i class="icon-target"></i> Simular “${esc(g.name)}”</h2>
<p class="note">Llevas ${money(p.saved)} de ${money(g.target)}: faltan <b>${money(p.remaining)}</b>.</p>
<label>Si aporto al mes…<input type="number" inputmode="decimal" step="100" min="0" value="${esc(f.per)}" oninput="gsim.per=this.value" onchange="drawGoalSim()"></label>
${months != null ? `<p class="mini" style="margin:0">…llego en <b>${months} ${months == 1 ? 'mes' : 'meses'}</b>, alrededor de <b>${fdate(addMonthsISO(td, months), 1)}</b>${+f.per ? ` (o ${money(+f.per / 2)} por quincena)` : ''}.</p>` : ''}
<label>Quiero llegar para el…<input type="date" value="${esc(f.date)}" onchange="gsim.date=this.value;drawGoalSim()"></label>
${need != null ? `<p class="mini" style="margin:0">…necesito aportar <b>${money(need)} al mes</b> (${money(need / 2)} por quincena).</p>` : ''}
<div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button>${+f.per > 0 ? `<button type="button" class="p" onclick="openGoalForm('${g.id}','plan');Object.assign(gform,{freq:'mensual',amount:${+f.per},day:''});drawGoalForm()">Usar como plan</button>` : ''}</div></form>`;
  dlgShow();
}

// ============ lo mío / lo tuyo / lo nuestro ============
function mineYoursOurs(ym) {
  const E = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), out = {}, ppl = cfg.people;
  let ours = 0;
  ppl.forEach(p => out[p] = 0);
  E.forEach(x => {
    if (x.split == 'half') ours += x.v;
    else if (x.split && x.split.startsWith('for:')) out[x.split.slice(4)] = (out[x.split.slice(4)] || 0) + x.v;
    else if (x.w) out[x.w] = (out[x.w] || 0) + x.v; else ours += x.v;
  });
  return { per: out, ours: round2(ours) };
}
function mineYoursOursCard(ym) {
  if (cfg.people.length < 2) return '';
  const m = mineYoursOurs(ym), tot = Object.values(m.per).reduce((a, b) => a + b, 0) + m.ours; if (!tot) return '';
  const rows = [...Object.entries(m.per).map(([p, v]) => [p, v, 'user']), ['Nuestro (compartido)', m.ours, 'users']].filter(r => r[1] > 0);
  return `<div class="card"><h2><i class="icon-users"></i> Lo mío, lo tuyo, lo nuestro</h2><p class="mini" style="margin:0 0 6px">Gastos personales de cada uno (incluye lo que se pagó para esa persona) y los compartidos del hogar.</p>
${rows.map(([n, v, ic]) => `<div class="row">${circ(n, ic)}<div><b>${esc(n)}</b>${bar(v / tot * 100, 'var(--' + accentFor(n) + ')')}</div><b class="num">${money(v)}</b></div>`).join('')}</div>`;
}

// ============ reglas de categoría ============
// cfg.rules = [{ id, m: texto a buscar, t: 'e'|'i', c: categoría, sub }]
function matchRule(text, t) {
  const n = norm(text); if (!n) return null;
  return (cfg.rules || []).find(r => (!t || r.t == t) && r.m && n.includes(norm(r.m))) || null;
}
function toolRulesHTML() {
  const R = cfg.rules || [];
  return `<p class="note" style="margin-bottom:12px">Cuando el detalle, la nota o el comercio de un movimiento contenga el texto, la app pone la categoría sola. Funciona al anotar, al pegar alertas y al importar.</p>
<div class="card">${R.length ? R.map(r => `<div class="row">${circ(r.c, icoFor(r.c, r.t))}<div><b>“${esc(r.m)}”</b><small>→ ${esc(r.c)}${r.sub ? ' · ' + esc(r.sub) : ''} (${r.t == 'i' ? 'ingreso' : 'egreso'})</small></div><button class="d" aria-label="Borrar regla" data-id="${esc(r.id)}" onclick="delRule(this.dataset.id)"><i class="icon-trash-2"></i></button></div>`).join('') : '<p class="mini" style="margin:0">Aún no tienes reglas.</p>'}</div>
<div class="card"><h2>Nueva regla</h2>
<label>Si el texto contiene<input id="ru-m" placeholder="Ej: uber, sirena, edesur, claro"></label>
<div class="two"><label>Tipo<select id="ru-t" onchange="$('ru-c').innerHTML=opts(cfg.cats.filter(c=>c.t==this.value).map(c=>c.n),'')"><option value="e">Egreso</option><option value="i">Ingreso</option></select></label><label>Categoría<select id="ru-c">${opts(cfg.cats.filter(c => c.t == 'e').map(c => c.n), '')}</select></label></div>
<input id="ru-s" placeholder="Detalle (opcional)">
<button class="p" style="width:100%;margin-top:8px" onclick="addRule()">Agregar regla</button></div>`;
}
function addRule() {
  const m = ($('ru-m').value || '').trim(), t = $('ru-t').value, c = $('ru-c').value, sub = ($('ru-s').value || '').trim();
  if (!m) return fail('Escribe el texto a buscar.');
  if (!cfg.cats.some(x => x.n == c && x.t == t)) return fail('Esa categoría no es de ese tipo.');
  const cf = deep(cfg); cf.rules = [...(cf.rules || []), { id: uid(), m, t, c, sub }]; saveCfg(cf); toast('Regla agregada', { kind: 'ok' });
}
function delRule(id) { const cf = deep(cfg); cf.rules = (cf.rules || []).filter(r => r.id != id); saveCfg(cf); toast('Regla borrada'); }

// ============ pegar alerta del banco ============
// Lee montos como "RD$1,500.00", "DOP 1500", "US$ 25.99", "1.500,00"; el comercio después de "en"; fechas dd/mm(/aaaa);
// y los últimos 4 dígitos de la tarjeta o cuenta para elegir la cuenta.
function parseNum(s) {
  s = String(s).trim().replace(/[.,]+$/, '');
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.500,50 o 845,50
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.500 = mil quinientos
  else s = s.replace(/,/g, ''); // 1,500.50
  const n = parseFloat(s); return isNaN(n) ? null : n;
}
function parseAlert(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(), r = {};
  let m = t.match(/(RD\$|DOP|US\$|USD|EUR|€|\$)\s?([\d][\d.,]*)/i) || t.match(/([\d][\d.,]*)\s?(DOP|USD|pesos|d[oó]lares)/i);
  if (m) { const cur = /US|USD|d[oó]lar/i.test(m[1] + (m[2] || '')) && !/RD/i.test(m[1]) ? 'USD' : /EUR|€/i.test(m[1]) ? 'EUR' : 'DOP'; const num = /[\d]/.test(m[1][0]) ? m[1] : m[2]; r.a = parseNum(num); r.cu = cfg.cur.includes(cur) || cur == 'DOP' ? cur : 'DOP'; }
  r.t = /(cr[eé]dito a tu|dep[oó]sito|recibi(ste|do)|acredit|transferencia recibida|abono a (tu|su) cuenta|n[oó]mina|pago recibido)/i.test(t) ? 'i' : 'e';
  m = t.match(/\b(?:en|EN|comercio:?|establecimiento:?|merchant:?)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9&*'.\- ]{3,40}?)(?=\s+(?:por|el|con|fecha|a las|monto|RD|US|DOP|USD)\b|[,.;]|$)/);
  if (m) r.who = m[1].replace(/\s+/g, ' ').trim();
  m = t.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (m) { const y = m[3] ? (m[3].length == 2 ? '20' + m[3] : m[3]) : today().slice(0, 4), mo = +m[2], d = +m[1]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) r.d = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  m = t.match(/(?:terminad[ao]\s+en|final(?:izada)?\s+en|\*{2,}|x{2,}|#)\s?(\d{4})\b/i); if (m) r.last4 = m[1];
  return r;
}
function openAlertPaste() {
  dlg.innerHTML = `<form onsubmit="return useAlert(event)"><h2><i class="icon-message-square"></i> Pegar alerta del banco</h2>
<p class="mini" style="margin:0">Copia el SMS o correo de tu banco (“Compra por RD$1,500.00 en SUPERMERCADO… tarjeta terminada en 1234”) y pégalo aquí.</p>
<textarea id="al-t" rows="5" placeholder="Pega aquí la alerta"></textarea>
<p class="mini" style="margin:0">Para que elija la cuenta sola, pon los últimos 4 dígitos en la cuenta o tarjeta (Cuentas → editar). Lo que no reconozca lo completas tú antes de guardar.</p>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Leer alerta</button></div></form>`;
  dlgShow(); setTimeout(() => { const el = $('al-t'); if (el) el.focus(); }, 60);
}
function useAlert(e) {
  e.preventDefault(); const raw = $('al-t').value, r = parseAlert(raw);
  if (!r.a) return fail('No encontré el monto. Revisa que pegaste la alerta completa.');
  const acc = (r.last4 && accs.find(a => a.last4 == r.last4)) || accs.find(a => a.id == lastUsed().accId) || accs[0];
  if (!acc) return fail('Primero crea una cuenta.');
  const rule = matchRule((r.who || '') + ' ' + raw, r.t);
  openForm();
  Object.assign(fm, { t: r.t, a: String(r.a), cu: r.cu || 'DOP', d: r.d || today(), accId: acc.id, sub: r.who ? r.who.slice(0, 40) : '', c: rule ? rule.c : null, n: '' });
  if (rule && rule.sub) fm.sub = rule.sub;
  if (fm.cu != 'DOP') fm.r = rateOf(fm.cu, fm.d) || '';
  drawForm(); toast(rule ? 'Alerta leída · categoría por regla' : 'Alerta leída: revisa y guarda');
}

// ============ importar estado de cuenta (CSV / Excel) ============
let imp = null;
function openImport() {
  if (!accs.length) return fail('Primero crea una cuenta.');
  dlg.innerHTML = `<form onsubmit="return false"><h2><i class="icon-file-up"></i> Importar estado de cuenta</h2>
<p class="mini" style="margin:0">Descarga de la página de tu banco el estado de cuenta en <b>Excel</b> o <b>CSV</b> y elígelo aquí. La app detecta las columnas y marca los movimientos que ya tienes para no duplicarlos.</p>
<label>Cuenta<select id="im-acc">${accs.map(a => `<option value="${a.id}">${esc(a.name)} (${a.currency})</option>`).join('')}</select></label>
<label>Archivo<input type="file" accept=".csv,.xlsx,.xls,text/csv" onchange="readImport(this)"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cerrar</button></div></form>`;
  dlgShow();
}
async function readImport(el) {
  const f = el.files[0]; if (!f) return; const accId = $('im-acc').value;
  try { if (typeof XLSX == 'undefined') await loadScript('vendor/xlsx.mini.min.js'); } catch (e) { return fail('No se pudo cargar el lector de Excel.'); }
  let rows; // raw: en CSV no adivina fechas (01/10 es 1 de octubre, no 10 de enero)
  try {
    const buf = await f.arrayBuffer(), text = /\.(csv|txt)$/i.test(f.name) || /^text\//.test(f.type) ? csvText(buf) : null;
    const wb = text != null ? XLSX.read(text, { type: 'string', raw: true }) : XLSX.read(buf, { type: 'array', cellDates: false, raw: true });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  }
  catch (e) { return fail('No se pudo leer el archivo.'); }
  rows = rows.filter(r => r.some(c => String(c).trim()));
  // la fila de títulos es la primera que tenga una palabra de fecha y otra de monto
  if (!rows.length) return fail('El archivo está vacío.');
  let h = rows.findIndex(r => r.some(c => /fecha|date/.test(norm(c))) && r.some(c => /monto|importe|valor|amount|debito|credito|cargo|abono/.test(norm(c))));
  if (h < 0) h = 0;
  const head = rows[h].map(c => String(c).trim()), find = re => head.findIndex(c => re.test(norm(c)));
  imp = { accId, head, rows: rows.slice(h + 1), col: { d: find(/fecha|date/), desc: find(/descrip|concepto|detalle|referencia|comercio|description|memo/), amt: find(/^(monto|importe|valor|amount)/), deb: find(/debito|cargo|retiro|debit/), cred: find(/credito|abono|deposito|credit/) } };
  drawImport();
}
// Texto de un CSV: UTF-8 si es válido; si no, Windows-1252 (el de Excel en español). Sin la marca BOM.
function csvText(buf) {
  let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('windows-1252').decode(buf); }
  return t.replace(/^\uFEFF/, '');
}
function parseDateCell(v) {
  if (typeof v == 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (m) { const y = m[3].length == 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
function importRows() {
  const I = imp, c = I.col, acc = accs.find(a => a.id == I.accId), out = [];
  for (const r of I.rows) {
    const d = parseDateCell(r[c.d]); if (!d) continue;
    let a = null;
    if (c.amt >= 0 && String(r[c.amt]).trim() !== '') { const raw = String(r[c.amt]); a = typeof r[c.amt] == 'number' ? r[c.amt] : parseNum(raw.replace(/[()RD$US\s]/g, '')); if (a != null && /^\(.*\)$/.test(raw.trim())) a = -Math.abs(a); }
    else { const db = c.deb >= 0 ? (typeof r[c.deb] == 'number' ? r[c.deb] : parseNum(String(r[c.deb]).replace(/[RD$US\s]/g, ''))) : null, cr = c.cred >= 0 ? (typeof r[c.cred] == 'number' ? r[c.cred] : parseNum(String(r[c.cred]).replace(/[RD$US\s]/g, ''))) : null; a = cr ? Math.abs(cr) : db ? -Math.abs(db) : null; }
    if (!a) continue;
    const desc = c.desc >= 0 ? String(r[c.desc]).trim() : '', t = a > 0 ? 'i' : 'e', amt = Math.abs(a), rule = matchRule(desc, t);
    const dup = txs.some(x => (x.t == 'i' || x.t == 'e') && x.accId == acc.id && Math.abs((x.aa ?? x.a) - amt) < 0.01 && Math.abs(daysBetween(x.d, d)) <= 2);
    out.push({ d, desc, t, amt, c: rule ? rule.c : 'Otros', sub: rule && rule.sub ? rule.sub : desc.slice(0, 40), dup, on: !dup, rule: !!rule });
  }
  return out;
}
function drawImport() {
  const I = imp, L = I.list || (I.list = importRows()), acc = accs.find(a => a.id == I.accId);
  const colSel = (k, l) => `<label>${l}<select onchange="imp.col.${k}=+this.value;imp.list=null;drawImport()"><option value="-1">—</option>${I.head.map((h, i) => `<option value="${i}"${I.col[k] == i ? ' selected' : ''}>${esc(h || 'Columna ' + (i + 1))}</option>`).join('')}</select></label>`;
  const n = L.filter(x => x.on).length;
  dlg.innerHTML = `<form onsubmit="return doImport(event)"><h2>Importar a ${esc(acc.name)}</h2>
<details${L.length ? '' : ' open'}><summary>Columnas detectadas ›</summary><div class="two">${colSel('d', 'Fecha')}${colSel('desc', 'Descripción')}</div><div class="two">${colSel('amt', 'Monto (+/−)')}${colSel('deb', 'Débito')}</div>${colSel('cred', 'Crédito')}</details>
<p class="mini" style="margin:0">${L.length} movimientos leídos · ${L.filter(x => x.dup).length} parecen repetidos (desmarcados) · se importarán <b>${n}</b>.</p>
<div class="implist">${L.slice(0, 300).map((x, i) => `<label class="toggle irow${x.dup ? ' dup' : ''}"><input type="checkbox" ${x.on ? 'checked' : ''} onchange="imp.list[${i}].on=this.checked"><span><b>${fdate(x.d, 1)} · ${esc(x.desc || '(sin descripción)')}</b><small>${esc(x.c)}${x.dup ? ' · ya lo tienes' : ''}</small></span><b class="num ${x.t == 'i' ? 'in' : 'out'}">${x.t == 'i' ? '+' : '−'}${money(x.amt, acc.currency)}</b></label>`).join('')}</div>
<p class="mini" style="margin:0">Los que no coinciden con una regla quedan en “Otros”; te quedan en <b>Inicio → Por revisar</b> para confirmarlos en un toque.</p>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Importar ${n}</button></div></form>`;
  dlgShow();
}
function doImport(e) {
  e.preventDefault(); const I = imp, acc = accs.find(a => a.id == I.accId), L = (I.list || []).filter(x => x.on);
  if (!L.length) return fail('No hay movimientos marcados.');
  const r = acc.currency == 'DOP' ? 1 : rateOf(acc.currency) || 1, me = defaultWho();
  L.forEach(x => { ensureCat(x.c, x.t, 'tag'); saveTx({ t: x.t, d: x.d, c: x.c, sub: x.sub, w: me, accId: acc.id, a: x.amt, cu: acc.currency, r, v: round2(x.amt * r), aa: x.amt, n: 'Importado', tags: [], ...(x.rule ? {} : { rev: 1 }) }, { noRender: true }); });
  const nr = L.filter(x => !x.rule).length;
  imp = null; dlg.close(); render(); toast(`Importados ${L.length} movimientos` + (nr ? ` · ${nr} por revisar en Inicio` : ''), { kind: 'ok', ...(nr ? { action: 'Revisar', onAction: openReview } : {}) }); return false;
}

// ============ etiquetas y eventos ============
// tx.tags = ['viaje-punta-cana']; cfg.events = { etiqueta: { budget } }
const allTags = () => [...new Set(txs.flatMap(x => x.tags || []))].sort();
function toolTagsHTML() {
  const tags = [...new Set([...allTags(), ...Object.keys(cfg.events || {})])];
  return `<p class="note" style="margin-bottom:12px">Ponle una etiqueta a los movimientos de un viaje, una boda o una remodelación (en el formulario, “Más opciones”). Aquí ves cuánto llevas en cada una, sin importar la categoría.</p>
${tags.length ? tags.map(t => {
    const L = txs.filter(x => (x.tags || []).includes(t)), sp = round2(sum(L, 'e')), inc = round2(sum(L, 'i')), b = ((cfg.events || {})[t] || {}).budget, st = budgetStatus(sp, b);
    return `<div class="card"><div class="row" style="border:0;padding-top:0">${circ(t, 'tag')}<div><b>#${esc(t)}</b><small>${L.length} movimientos${inc ? ' · entradas ' + money(inc) : ''}</small></div><b class="num out">${money(sp)}</b></div>
${st ? bar(st.pct, barCol(st.level)) + `<small class="mut">${st.pct}% de ${money(b)}</small>` : ''}
<div class="acts" style="margin-top:8px"><button data-t="${esc(t)}" onclick="F={q:'#'+this.dataset.t};go('hist')">Ver movimientos</button><button data-t="${esc(t)}" onclick="setTagBudget(this.dataset.t)">${b ? 'Cambiar presupuesto' : 'Ponerle presupuesto'}</button></div></div>`;
  }).join('') : '<div class="card"><p class="empty" style="margin:0">Aún no hay etiquetas.</p></div>'}
<button style="width:100%" onclick="setTagBudget()"><i class="icon-plus"></i> Nuevo evento con presupuesto</button>`;
}
function setTagBudget(t) {
  dlg.innerHTML = `<form onsubmit="return svTagBudget(event)"><h2>${t ? '#' + esc(t) : 'Nuevo evento'}</h2>
${t ? `<input type="hidden" id="tg-n" value="${esc(t)}">` : `<label>Nombre (sin espacios)<input id="tg-n" required placeholder="Ej: viaje-samana"></label>`}
<label>Presupuesto (DOP)<input id="tg-b" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(((cfg.events || {})[t] || {}).budget || '')}" placeholder="Vacío = sin presupuesto"></label>
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div></form>`;
  dlgShow();
}
const tagClean = s => norm(s).replace(/^#/, '').replace(/[^a-z0-9ñ_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
function svTagBudget(e) {
  e.preventDefault(); const t = tagClean($('tg-n').value), b = parseFloat($('tg-b').value); if (!t) return fail('Escribe un nombre.');
  const c = deep(cfg); c.events = c.events || {}; if (b > 0) c.events[t] = { budget: b }; else if (!allTags().includes(t)) delete c.events[t]; else c.events[t] = {};
  saveCfg(c); dlg.close(); toast('Guardado', { kind: 'ok' }); return false;
}

// ============ cierre de mes ============
let closeYm = addMonths(today().slice(0, 7), -1);
function toolCloseHTML() {
  const ym = closeYm, end = monthEnd(ym) < today() ? monthEnd(ym) : today(), done = (cfg.closed || {})[ym];
  const L = accs.filter(a => !isLoan(a) && a.openDate <= end);
  return `<div class="card"><div class="add" style="align-items:center"><button class="iconbtn" aria-label="Mes anterior" onclick="closeYm=addMonths(closeYm,-1);render()"><i class="icon-chevron-left"></i></button>
<b style="flex:1;text-align:center;text-transform:capitalize">${ymLabel(ym)}</b><button class="iconbtn" aria-label="Mes siguiente" onclick="closeYm=addMonths(closeYm,1);render()"><i class="icon-chevron-right"></i></button></div></div>
<p class="note" style="margin-bottom:12px">Escribe el saldo que dice el banco al ${fdate(end, 1)} (lo ves en el estado de cuenta). Si no cuadra con la app, puedes ajustarlo o revisar qué faltó anotar.${done ? `<br><b>Cerrado el ${fdate(done, 1)} ✓</b>` : ''}</p>
<div class="card">${L.map(a => { const b = acctBalance(a, end); return `<div class="row" style="flex-wrap:wrap">${circ(a.name, acctIcon(a.type))}<div><b>${esc(a.name)}</b><small>En la app: ${money(isCard(a) ? -b : b, a.currency)}${isCard(a) ? ' (deuda)' : ''}</small></div><input type="number" inputmode="decimal" step="0.01" style="width:120px" placeholder="Banco" data-a="${a.id}" oninput="closeDiff(this)"><small class="cdiff" id="cd-${a.id}" style="flex-basis:100%;padding-left:54px"></small></div>`; }).join('') || '<p class="mini">No hay cuentas.</p>'}</div>
<button class="p" style="width:100%" onclick="markClosed('${ym}')"><i class="icon-circle-check"></i> Marcar ${ymLabel(ym)} como cerrado</button>`;
}
function closeDiff(el) {
  const a = accs.find(x => x.id == el.dataset.a), ym = closeYm, end = monthEnd(ym) < today() ? monthEnd(ym) : today(), app = acctBalance(a, end), out = $('cd-' + a.id);
  const v = parseFloat(el.value); if (isNaN(v)) { out.innerHTML = ''; return; }
  const real = isCard(a) ? -Math.abs(v) : v, d = round2(real - app);
  out.innerHTML = Math.abs(d) < 0.01 ? '<span class="in">✓ Cuadra</span>' : `<span class="warn">Diferencia: ${money(d, a.currency)}</span> <button type="button" class="link" style="display:inline;min-height:0;padding:0 6px" onclick="saveAdj({accId:'${a.id}',date:'${end}',balance:${real},note:'Cierre de ${ymLabel(ym)}'});toast('Saldo ajustado',{kind:'ok'})">Ajustar</button>`;
}
function markClosed(ym) { const c = deep(cfg); c.closed = { ...(c.closed || {}), [ym]: today() }; saveCfg(c); toast(ymLabel(ym) + ' cerrado', { kind: 'ok' }); }
// Aviso en Inicio los primeros días del mes si el anterior no está cerrado (solo si ya usas la app hace más de un mes)
function closeAlert() {
  const td = today(), prev = addMonths(td.slice(0, 7), -1);
  if (+td.slice(8, 10) > 10 || (cfg.closed || {})[prev] || !accs.some(a => a.openDate <= prev + '-01')) return null;
  try { if (localStorage.getItem('fin_close_snooze') == prev) return null; } catch (e) { } // “Luego” de la versión 10.1
  return AL('close:' + prev, 'close', 'Recordatorio del cierre de mes', 'Cierre de ' + ymLabel(prev), 'circle-check', 'Vuelve a salir el mes que viene.',
    `<div class="alert bka">${circ('cierre', 'circle-check')}<div><b>Haz el cierre de ${ymLabel(prev)}</b><small>Compara tus saldos con los del banco (2 minutos).</small></div>%M%<div class="acts2"><button onclick="alertSkip('close:${prev}')">Luego</button><button class="p" onclick="closeYm='${prev}';toolView='close';go('tools')">Hacer cierre</button></div></div>`);
}

// ============ por revisar (lo importado sin regla) ============
// Cada movimiento importado sin regla queda marcado (rev) hasta que confirmes su categoría.
const revList = () => txs.filter(x => x.rev && (x.t == 'e' || x.t == 'i')).sort((a, b) => b.d.localeCompare(a.d));
function reviewCard() {
  const n = revList().length; if (!n) return '';
  return `<div class="card revc" role="button" onclick="openReview()">${circ('revisar', 'file-up')}<div><b>${n} movimiento${n > 1 ? 's' : ''} por revisar</b><small>Importados del banco: confirma su categoría en un toque</small></div><i class="icon-chevron-right mut"></i></div>`;
}
function openReview() {
  const L = revList();
  if (!L.length) { if (dlg.open) dlg.close(); render(); return toast('Todo revisado ✓', { kind: 'ok' }); }
  const top = t => { const c = {}; txs.filter(x => x.t == t && !x.rev).forEach(x => c[x.c] = (c[x.c] || 0) + 1); return cfg.cats.filter(x => x.t == t).map(x => x.n).sort((a, b) => (c[b] || 0) - (c[a] || 0)); };
  const TE = top('e'), TI = top('i');
  dlg.innerHTML = `<h2>Por revisar <span class="pill">${L.length}</span></h2>
<p class="mini" style="margin:0 0 6px">Toca la categoría correcta. Si el comercio se repite, los demás iguales se cambian solos y puedes crear una regla.</p>
${L.slice(0, 40).map(x => { const T = x.t == 'e' ? TE : TI, cs = [x.c, ...T.filter(c => c != x.c)].slice(0, 6); return `<div class="trow"><div class="row" style="border:0">${circ(x.c, icoFor(x.c, x.t))}<div><b>${esc(x.sub || x.c)}</b><small>${fdate(x.d)} · ${esc((accs.find(a => a.id == x.accId) || {}).name || '')}</small></div><b class="num ${x.t == 'i' ? 'in' : 'out'}">${x.t == 'i' ? '+' : '−'}${money(x.v)}</b></div>
<div class="chips" style="padding-left:54px">${cs.map(c => `<button type="button" class="${c == x.c ? 'on' : ''}" data-id="${x.id}" data-c="${esc(c)}" onclick="revSet(this.dataset.id,this.dataset.c)">${c == x.c ? '✓ ' : ''}${esc(c)}</button>`).join('')}<button type="button" data-id="${x.id}" onclick="dlg.close();openForm(this.dataset.id)">Otra…</button></div></div>`; }).join('')}
${L.length > 40 ? `<p class="mini">Y ${L.length - 40} más.</p>` : ''}
<div class="seg" style="margin-top:6px"><button type="button" onclick="dlg.close();render()">Cerrar</button><button type="button" class="p" onclick="revAll()">Todo está bien</button></div>`;
  dlgShow();
}
function revSet(id, c) {
  const x = txs.find(t => t.id == id); if (!x) return;
  const key = norm(x.sub), same = key ? revList().filter(y => y.id != id && y.t == x.t && norm(y.sub) == key) : [];
  const fix = y => { const { rev, ...o } = y; return { ...o, c }; };
  bulkTxs([x, ...same].map(fix));
  openReview(); // primero se redibuja la hoja; luego el aviso (si no, el aviso se borra con la hoja)
  if (key && c != x.c && !matchRule(x.sub, x.t)) toast(`¿Siempre “${x.sub}” → ${c}?`, { action: 'Crear regla', ms: 8000, onAction: () => { const cf = deep(cfg); cf.rules = [...(cf.rules || []), { id: uid(), m: x.sub.trim().toLowerCase().slice(0, 40), t: x.t, c, sub: '' }]; saveCfg(cf); toast('Regla creada', { kind: 'ok' }); } });
  else if (same.length) toast(`También ${same.length} más de “${x.sub}”`, { kind: 'ok' });
}
function revAll() { const L = revList(); bulkTxs(L.map(y => { const { rev, ...o } = y; return o; })); dlg.close(); render(); toast(`${L.length} revisados ✓`, { kind: 'ok' }); }

// Valor para poner dentro de onclick="…" sin romper el HTML
const jsAttr = v => JSON.stringify(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '\\u003c');
// ============ “Para ti”: lo más importante de tus números, en frases cortas ============
// Cada frase lleva k / r / l / ig como los avisos de Inicio (ver homeAlerts) para poder ignorarla o silenciarla.
// insights(true) = todas, sin filtrar ni recortar (para Ajustes → Avisos de Inicio).
const insTag = (o, k, r, l, ig) => Object.assign(o, { k, r, l: 'Para ti: ' + l, ig, ins: 1 });
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function insights(all) {
  const td = today(), ym = td.slice(0, 7), day = +td.slice(8, 10), out = [], mes = m => ymLabel(m).split(' ')[0], nextM = 'Vuelve a salir el mes que viene.';
  const E = txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), spent = E.reduce((q, x) => q + x.v, 0);
  const cc = catCompare(ym);
  let hot = null;
  if (cc && cc.avgTot > 0 && day >= 5) {
    const tp = cc.expTot > 0 ? cc.vTot / cc.expTot : 1;
    if (tp > 1.15 && cc.vTot - cc.expTot > 1000) out.push(insTag({ p: 90, ic: 'gauge', c: 'out', t: `Vas ${Math.round((tp - 1) * 100)}% por encima de lo normal`, s: `Llevas ${money(cc.vTot)}; a esta altura del mes sueles llevar ${money(cc.expTot)}.`, go: "repTab='cat';go('rep')" }, 'ins:pace:hi:' + ym, 'ins:pace', 'si vas por encima o por debajo de lo normal', nextM));
    else if (tp < 0.85 && cc.expTot - cc.vTot > 1000) out.push(insTag({ p: 40, ic: 'trending-down', c: 'in', t: `Vas ${Math.round((1 - tp) * 100)}% por debajo de lo normal`, s: `Llevas ${money(cc.vTot)}; a esta altura sueles llevar ${money(cc.expTot)}. ¡Bien!`, go: "repTab='cat';go('rep')" }, 'ins:pace:lo:' + ym, 'ins:pace', 'si vas por encima o por debajo de lo normal', nextM));
    hot = cc.rows.filter(r => r.avg > 0 && r.pace > 1.3 && r.v - r.exp > Math.max(500, r.avg * 0.15)).sort((a, b) => (b.v - b.exp) - (a.v - a.exp))[0];
    if (hot) out.push(insTag({ p: 80, ic: icoFor(hot.c, 'e'), c: 'warn', t: `${esc(hot.c)}: ${money(hot.v)} este mes`, s: `A esta altura sueles llevar ${money(hot.exp)} (${money(hot.avg)} en todo el mes).`, go: `F={c:${jsAttr(hot.c)}};pre('mes');go('hist')` }, `ins:hot:${hot.c}:${ym}`, 'ins:hot:' + hot.c, `${hot.c} por encima de lo normal`, nextM));
  }
  // pagos de los próximos 7 días
  const lim = addDays(td, 7), ev = [...calendarEvents(ym), ...calendarEvents(addMonths(ym, 1))].filter(e => e.d > td && e.d <= lim && e.st != 'done' && (e.k == 'e' || e.k == 'pay' || e.k == 'loan' || (e.k == 'debt' && e.dir == 'owe')));
  if (ev.length) { const tot = ev.reduce((q, e) => q + (e.v ? convert(e.v, e.cu || 'DOP', 'DOP', td) : 0), 0); const wk = addDays(td, -((new Date(td + 'T12:00:00').getDay() + 6) % 7)); out.push(insTag({ p: 70, ic: 'calendar-days', c: 'blue', t: tot ? `Esta semana pagas ${money(tot)}` : `Esta semana tienes ${ev.length} pago${ev.length > 1 ? 's' : ''}`, s: ev.slice(0, 3).map(e => esc(e.name)).join(', ') + (ev.length > 3 ? ` y ${ev.length - 3} más` : '') + '.', go: "go('plan')" }, 'ins:week:' + wk, 'ins:week', 'pagos de la semana', 'Vuelve a salir la semana que viene.')); }
  // comercio que más se repite
  const bySub = {}; E.filter(x => x.sub).forEach(x => { const k = norm(x.sub); (bySub[k] = bySub[k] || { n: 0, v: 0, name: x.sub }).n++; bySub[k].v += x.v; });
  const fr = Object.values(bySub).filter(b => b.n >= 3).sort((a, b) => b.n - a.n || b.v - a.v)[0];
  if (fr) out.push(insTag({ p: 50, ic: 'repeat', c: 'purple', t: `${esc(fr.name)}: ${fr.n} veces este mes`, s: `Suman ${money(fr.v)}.`, go: `F={q:${jsAttr(fr.name)}};go('hist')` }, `ins:freq:${norm(fr.name)}:${ym}`, 'ins:freq:' + norm(fr.name), `cuántas veces vas a ${fr.name}`, nextM));
  // la categoría más grande del mes
  if (!hot && spent > 0) { const g = Object.entries(grp(E, 'c')).sort((a, b) => b[1] - a[1])[0]; if (g) out.push(insTag({ p: 30, ic: icoFor(g[0], 'e'), c: 'pink', t: `${esc(g[0])} es tu mayor gasto del mes`, s: `${money(g[1])} · ${Math.round(g[1] / spent * 100)}% de lo que llevas gastado.`, go: "repTab='cat';go('rep')" }, `ins:big:${g[0]}:${ym}`, 'ins:big', 'tu mayor gasto del mes', nextM)); }
  // cómo cerró el mes pasado
  const pm = addMonths(ym, -1), pv = monthStats(pm);
  if (pv.inc > 0 && day <= 12) out.push(insTag(pv.net < 0 ? { p: 85, ic: 'alert-triangle', c: 'out', t: `En ${mes(pm)} gastaste más de lo que entró`, s: `Saliste ${money(-pv.net)} abajo. Revisa tus topes en Presupuesto.`, go: "go('bud')" }
    : { p: 35, ic: 'piggy-bank', c: 'in', t: `En ${mes(pm)} ahorraste ${pv.rate}%`, s: `Entraron ${money(pv.inc)} y salieron ${money(pv.exp)}.`, go: "repYm='" + pm + "';repTab='res';go('rep')" }, 'ins:prev:' + pm, 'ins:prev', 'cómo cerró el mes pasado', nextM));
  // meta más cercana
  const fcs = activeGoals().map(g => ({ g, f: goalForecast(g) }));
  const won = fcs.find(x => x.f.reached);
  if (won) out.push(insTag({ p: 75, ic: 'party-popper', c: 'in', t: `¡Lograste “${esc(won.g.name)}”! 🎉`, s: 'Márcala como cumplida para que deje de contar como activa.', go: "go('goal')" }, 'ins:won:' + won.g.id, 'ins:goal:' + won.g.id, `la meta “${won.g.name}”`, 'No vuelve a salir para esta meta.'));
  const late = fcs.find(x => x.f.late && x.g.due);
  if (late) out.push(insTag({ p: 60, ic: 'target', c: 'warn', t: `“${esc(late.g.name)}” va atrasada`, s: `Para el ${fdate(late.g.due, 1)} necesitas ${money(late.f.need)} cada ${PLAN_FREQ[late.f.pl.freq].u}.`, go: "go('goal')" }, `ins:late:${late.g.id}:${ym}`, 'ins:goal:' + late.g.id, `la meta “${late.g.name}”`, 'Vuelve a salir el mes que viene si todavía no llegas a tiempo.'));
  const gl = fcs.filter(x => !x.f.reached && (x.f.date || (x.f.pace && x.f.pace.monthsLeft > 0))).sort((a, b) => (a.f.date || addMonthsISO(today(), a.f.pace.monthsLeft)).localeCompare(b.f.date || addMonthsISO(today(), b.f.pace.monthsLeft)))[0];
  if (gl && gl != late) out.push(insTag({ p: 25, ic: 'target', c: 'teal', t: gl.f.date ? `“${esc(gl.g.name)}”: llegas ~${fdate(gl.f.date, 1)}` : `“${esc(gl.g.name)}”: llegas en ~${gl.f.pace.monthsLeft} ${gl.f.pace.monthsLeft == 1 ? 'mes' : 'meses'}`, s: `Vas por ${gl.f.p.pct}%${gl.f.pl ? ` con ${money(gl.f.pl.amount)} ${PLAN_FREQ[gl.f.pl.freq].l}` : ` al ritmo de ~${money(gl.f.pace.perMonth)} al mes`}.`, go: "go('goal')" }, `ins:next:${gl.g.id}:${ym}`, 'ins:goal:' + gl.g.id, `la meta “${gl.g.name}”`, nextM));
  out.forEach(x => { x.mt = unesc(x.t); }); // título sin HTML para la hoja de opciones y Ajustes
  if (all) return out;
  const p = alertPrefs();
  return out.filter(x => alertOn(x, p)).sort((a, b) => b.p - a.p).slice(0, 3);
}
function insightsCard() {
  const L = insights(); if (!L.length) return '';
  return `<div class="card"><h2><i class="icon-sparkles"></i> Para ti</h2>${L.map(x => `<div class="ins" role="button" onclick="${x.go}"><div class="circ tint" style="--c:var(--${x.c})"><i class="icon-${x.ic}"></i></div><div><b>${x.t}</b><small>${x.s}</small></div>${alMore(x)}</div>`).join('')}</div>`;
}
