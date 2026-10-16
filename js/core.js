'use strict';
(window.__V = window.__V || {})['core.js'] = '8.0.1';
/* Mis finanzas — núcleo: utilidades, estado, almacenamiento y cálculos.
   Los demás scripts (views.js, sync-ui.js) comparten estas variables globales. */

// ============ utilidades ============
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CUR_RE = /^[A-Z]{3}$/, ISO_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const round2 = n => Math.round((+n || 0) * 100) / 100;
const fmtCache = {};
// Modo privado: oculta las cifras en pantalla
let HIDE = false; try { HIDE = localStorage.getItem('fin_hide') == '1'; } catch (e) { }
const CUR_SYM = { DOP: 'RD$', USD: 'US$', EUR: '€' };
function money(n, c = 'DOP') {
  c = CUR_RE.test(c || '') ? c : 'DOP';
  if (HIDE) return (CUR_SYM[c] || c + ' ') + '•••••';
  try {
    fmtCache[c] = fmtCache[c] || new Intl.NumberFormat('es-DO', { style: 'currency', currency: c, maximumFractionDigits: 2 });
    return fmtCache[c].format(n || 0);
  } catch (e) { return c + ' ' + (+n || 0).toFixed(2); }
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addDay = iso => addDays(iso, 1);
const daysBetween = (a, b) => (new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5;
const now = () => Date.now();
const maxISO = (a, b) => (a > b ? a : b);
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
// "13 oct" (y el año si no es el actual)
function fdate(iso, withYear) {
  if (!ISO_RE.test(iso || '')) return iso || '';
  const y = iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10);
  return d + ' ' + MES3[m - 1] + (withYear || y != today().slice(0, 4) ? ' ' + y : '');
}
function fday(iso) {
  const td = today(), diff = daysBetween(iso, td), wd = DIA3[new Date(iso + 'T00:00:00Z').getUTCDay()];
  if (diff == 0) return 'Hoy · ' + wd + ' ' + fdate(iso);
  if (diff == 1) return 'Ayer · ' + wd + ' ' + fdate(iso);
  return wd[0].toUpperCase() + wd.slice(1) + ' ' + fdate(iso);
}
// "Vence hoy", "En 3 días", "Venció hace 2 días"
function dueLabel(iso) {
  const n = daysBetween(today(), iso);
  if (n == 0) return { t: 'Vence hoy', k: 'warn' };
  if (n == 1) return { t: 'Vence mañana', k: 'warn' };
  if (n > 1) return { t: 'En ' + n + ' días', k: n <= 3 ? 'warn' : '' };
  return { t: 'Venció hace ' + (-n) + (n == -1 ? ' día' : ' días'), k: 'out' };
}
const ymLabel = ym => { const n = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+ym.slice(5, 7) - 1]; return n + ' ' + ym.slice(0, 4); };
const addMonths = (ym, k) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + k, 1)); return d.toISOString().slice(0, 7); };
const monthEnd = ym => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);

// ============ íconos y colores ============
const ICONS = ['home', 'utensils-crossed', 'car', 'heart-pulse', 'graduation-cap', 'plug-zap', 'clapperboard', 'shirt', 'credit-card', 'piggy-bank', 'briefcase', 'trending-up', 'gift', 'shopping-cart', 'dumbbell', 'plane', 'dog', 'baby', 'wrench', 'phone', 'wifi', 'book-open', 'coffee', 'beer', 'music', 'film', 'gamepad-2', 'scissors', 'stethoscope', 'pill', 'fuel', 'bus', 'train', 'bike', 'sofa', 'lightbulb', 'droplet', 'shield', 'landmark', 'wallet', 'banknote', 'receipt', 'tag'];
const acctIcon = type => ({ 'Efectivo': 'wallet', 'Cuenta de ahorro': 'piggy-bank', 'Cuenta corriente': 'landmark', 'Tarjeta de crédito': 'credit-card' }[type] || 'wallet');
const ACCENTS = ['blue', 'pink', 'yellow', 'purple'];
function accentFor(name) { let h = 0; for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ACCENTS[h % 4]; }
// Círculo de ícono con fondo tenue (antes usaba "var(--x)22", que es CSS inválido)
const circ = (name, icon) => `<div class="circ tint" style="--c:var(--${accentFor(name)})"><i class="icon-${esc(icon)}"></i></div>`;

// ============ configuración base ============
const DEF = {
  cats: [
    { n: 'Vivienda', t: 'e', icon: 'home' }, { n: 'Comida', t: 'e', icon: 'utensils-crossed' }, { n: 'Transporte', t: 'e', icon: 'car' },
    { n: 'Salud', t: 'e', icon: 'heart-pulse' }, { n: 'Educación', t: 'e', icon: 'graduation-cap' }, { n: 'Servicios', t: 'e', icon: 'plug-zap' },
    { n: 'Entretenimiento', t: 'e', icon: 'clapperboard' }, { n: 'Ropa', t: 'e', icon: 'shirt' }, { n: 'Deudas', t: 'e', icon: 'credit-card' },
    { n: 'Ahorro', t: 'e', icon: 'piggy-bank' }, { n: 'Otros', t: 'e', icon: 'tag' },
    { n: 'Salario', t: 'i', icon: 'briefcase' }, { n: 'Negocio o freelance', t: 'i', icon: 'trending-up' }, { n: 'Inversiones', t: 'i', icon: 'landmark' },
    { n: 'Regalos', t: 'i', icon: 'gift' }, { n: 'Otros', t: 'i', icon: 'tag' }
  ],
  subs: { 'Entretenimiento': ['Netflix', 'Spotify', 'Cine', 'Salidas'] },
  people: ['Persona 1', 'Persona 2'], cur: ['USD', 'EUR'],
  accTypes: ['Efectivo', 'Cuenta de ahorro', 'Cuenta corriente', 'Tarjeta de crédito'],
  budgetTotal: 0, budgetCats: {}, budgetOverrides: {}
};
const DEF0 = JSON.stringify(DEF), fresh = () => JSON.parse(DEF0);

// ============ estado ============
const LS = 'fin4';
let cfg = fresh(), txs = [], accs = [], adjs = [], recs = [], goals = [], cfgT = 0, dels = {}, trash = [], bin = [];
// trash: movimientos borrados · bin: cuentas, recurrentes, metas y ajustes borrados ({k, id, del, d}). Se guardan 30 días.
let F = {}, tab = 'home', ch = [], budYm = today().slice(0, 7), budMode = 'base';

// ---- limpieza de datos (al cargar o importar): evita datos corruptos o código inyectado ----
const num = v => (Number.isFinite(+v) ? +v : 0);
const okId = x => x && ID_RE.test(String(x.id || ''));
const okDate = d => ISO_RE.test(String(d || ''));
function cleanTx(x) {
  if (!okId(x) || !okDate(x.d) || !['i', 'e', 'tr', 'g', 'st'].includes(x.t)) return null;
  const o = { ...x, a: num(x.a), v: num(x.v) };
  if (x.cu != null && !CUR_RE.test(x.cu)) o.cu = 'DOP';
  if (x.aTo != null) o.aTo = num(x.aTo);
  if (x.aa != null) o.aa = num(x.aa);
  if (x.r != null) o.r = num(x.r);
  if (x.split != null && !(x.split == 'half' || /^for:/.test(String(x.split)))) delete o.split;
  for (const k of ['accId', 'accIdTo', 'goalId', 'home']) if (o[k] != null && !ID_RE.test(String(o[k]))) o[k] = null;
  return o;
}
function cleanState(o) {
  const arr = (a, f) => (Array.isArray(a) ? a.map(f).filter(Boolean) : []);
  const c = { ...fresh(), ...(o.cfg || {}) };
  c.cur = (c.cur || []).filter(x => CUR_RE.test(x) && x != 'DOP');
  c.cats = (c.cats || []).filter(x => x && x.n && (x.t == 'i' || x.t == 'e')).map(x => ({ ...x, icon: ICONS.includes(x.icon) ? x.icon : 'tag' }));
  c.shortcuts = (Array.isArray(c.shortcuts) ? c.shortcuts : []).filter(x => x && ID_RE.test(String(x.id || '')) && x.name && (x.t == 'i' || x.t == 'e')).map(x => ({ ...x, a: x.a ? num(x.a) : null, cu: CUR_RE.test(x.cu || '') ? x.cu : 'DOP' }));
  return {
    cfg: c, cfgT: num(o.cfgT),
    txs: arr(o.txs, cleanTx),
    trash: arr(o.trash, x => { const y = cleanTx(x); return y ? { ...y, del: num(x.del) } : null; }),
    accs: arr(o.accs, x => (okId(x) ? { ...x, currency: CUR_RE.test(x.currency) ? x.currency : 'DOP', openBalance: num(x.openBalance), openDate: okDate(x.openDate) ? x.openDate : '2000-01-01' } : null)),
    adjs: arr(o.adjs, x => (okId(x) && okDate(x.date) && ID_RE.test(String(x.accId)) ? { ...x, balance: num(x.balance), u: num(x.u || x.createdAt), createdAt: num(x.createdAt || x.u) } : null)),
    recs: arr(o.recs, x => (okId(x) && ID_RE.test(String(x.accId || 'x')) ? { ...x, amount: num(x.amount), currency: CUR_RE.test(x.currency) ? x.currency : 'DOP', done: Array.isArray(x.done) ? x.done.filter(okDate) : [], lastConfirmed: okDate(x.lastConfirmed) ? x.lastConfirmed : undefined, startDate: okDate(x.startDate) ? x.startDate : today() } : null)),
    goals: arr(o.goals, x => (okId(x) ? { ...x, target: num(x.target) } : null)),
    bin: arr(o.bin, x => (x && ['acc', 'adj', 'rec', 'goal'].includes(x.k) && ID_RE.test(String(x.id || '')) && x.d && typeof x.d == 'object' ? { k: x.k, id: x.id, del: num(x.del), d: x.d } : null)),
    dels: Object.fromEntries(Object.entries(o.dels || {}).filter(([k, v]) => ID_RE.test(k)).map(([k, v]) => [k, num(v)]))
  };
}
function setState(s) { ({ cfg, cfgT, txs, accs, adjs, recs, goals, dels, trash } = s); bin = s.bin || []; purgeOld(); }
const snapshot = () => ({ cfg, cfgT, txs, accs, adjs, recs, goals, dels, trash, bin });
// La papelera guarda lo borrado 30 días
const KEEP_DAYS = 30;
function purgeOld() { const lim = Date.now() - KEEP_DAYS * 864e5; trash = trash.filter(x => (x.del || 0) > lim); bin = bin.filter(x => (x.del || 0) > lim); }

// ---- almacenamiento local (solo guarda; la nube se actualiza aparte en cada acción) ----
function local() { try { localStorage.setItem(LS, JSON.stringify(snapshot())); } catch (e) { console.warn('No se pudo guardar localmente', e); } }
try { const o = JSON.parse(localStorage.getItem(LS)); if (o) setState(cleanState(o)); } catch (e) { }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

// ---- puente a la nube (no hace nada si no hay sesión) ----
const cloudOn = () => !!(window.Cloud && window.Cloud.active);
const cloudPut = (k, o) => { if (cloudOn()) window.Cloud.put(k, o); };
const cloudDel = (k, o, ts) => { if (cloudOn()) window.Cloud.del(k, o, ts); };
const cloudCfg = () => { if (cloudOn()) window.Cloud.putCfg(cfg, cfgT); };

// ============ tasas de cambio ============
// Última tasa conocida (DOP por 1 unidad) para una moneda en o antes de una fecha; si no hay, la más cercana posterior.
function rateOf(cu, d) {
  if (!cu || cu == 'DOP') return 1;
  d = d || today();
  let best = null, after = null;
  for (const x of txs) {
    if (x.cu != cu || !(x.r > 0) || x.r == 1) continue;
    if (x.d <= d) { if (!best || x.d > best.d) best = x; }
    else if (!after || x.d < after.d) after = x;
  }
  return (best || after || {}).r || refRate(cu);
}
// Tasa de referencia que el usuario define en Ajustes
const refRate = cu => +((cfg.rates || {})[cu]) || 0;

// ============ saldos ============
const isCard = a => a && a.type == 'Tarjeta de crédito';
const goalHome = x => { const g = goals.find(q => q.id == x.goalId); return g ? (g.accId || null) : (x.home || null); };

// Monto de un ingreso/egreso expresado en la moneda de la cuenta.
// Corrección: antes, un gasto en DOP desde una cuenta en USD restaba el número en pesos como si fueran dólares.
function amtInAcc(x, acc) {
  if (x.aa != null && Number.isFinite(x.aa)) return x.aa;
  const cu = x.cu || 'DOP';
  if (cu == acc.currency) return x.a;
  if (acc.currency == 'DOP') return x.v;
  const r = rateOf(acc.currency, x.d);
  return r ? round2(x.v / r) : x.a;
}

function acctBalance(acc, asOf) {
  asOf = asOf || '9999-12-31';
  if (acc.openDate && asOf < acc.openDate) return 0;
  const myAdjs = adjs.filter(a => a.accId == acc.id && a.date <= asOf).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  let base = acc.openBalance || 0, from = acc.openDate || '0000-01-01', adj = null;
  if (myAdjs.length) { adj = myAdjs[0]; base = adj.balance; from = adj.date; }
  let bal = base;
  for (const x of txs) {
    if (x.d > asOf || x.d < from) continue;
    // el ajuste ya incluye lo anotado antes de él ese mismo día; lo anotado después sí cuenta
    if (adj && x.d == from && (x.cr || 0) < (adj.createdAt || 0)) continue;
    if (x.t == 'tr') {
      if (x.accId == acc.id) bal -= x.a;
      if (x.accIdTo == acc.id) bal += x.aTo;
    } else if (x.t == 'g') {
      const h = goalHome(x);
      if (x.accId != h) { if (x.accId == acc.id) bal -= x.a; if (h == acc.id) bal += x.v; }
    } else if (x.accId == acc.id) {
      const am = amtInAcc(x, acc);
      bal += x.t == 'i' ? am : -am;
    }
  }
  return round2(bal);
}

// Totales separados por moneda (antes se sumaban tarjetas en USD como si fueran pesos).
function totalsByCurrency(asOf) {
  const out = {};
  for (const a of accs) {
    const c = a.currency || 'DOP', b = acctBalance(a, asOf);
    const t = out[c] = out[c] || { disp: 0, deuda: 0, neto: 0 };
    if (isCard(a)) t.deuda += Math.max(0, -b); else t.disp += b;
    t.neto += b;
  }
  for (const t of Object.values(out)) { t.disp = round2(t.disp); t.deuda = round2(t.deuda); t.neto = round2(t.neto); }
  return out;
}
const totalDisponibleDOP = asOf => (totalsByCurrency(asOf).DOP || {}).disp || 0;
const totalDeudaDOP = asOf => (totalsByCurrency(asOf).DOP || {}).deuda || 0;
// Patrimonio aproximado en DOP usando la última tasa conocida de cada moneda.
function netWorthApprox(asOf) {
  const t = totalsByCurrency(asOf); let s = 0, missing = [];
  for (const [c, v] of Object.entries(t)) { const r = c == 'DOP' ? 1 : (refRate(c) || rateOf(c, asOf || today())); if (r) s += v.neto * r; else missing.push(c); }
  return { total: round2(s), missing };
}

// ============ metas ============
function goalProgress(g) {
  const saved = txs.filter(x => x.t == 'g' && x.goalId == g.id).reduce((s, c) => s + c.v, 0);
  return { saved: round2(saved), pct: g.target > 0 ? Math.max(0, Math.min(100, Math.round(saved / g.target * 100))) : 0, remaining: Math.max(0, round2(g.target - saved)) };
}
// Proyección: promedio mensual neto de los últimos 6 meses (o desde el primer aporte), medido hasta hoy.
// Corrección: antes contaba el primer aporte como ahorrado en 0 días y no notaba si dejaste de aportar.
function goalProjection(g) {
  const mine = txs.filter(x => x.t == 'g' && x.goalId == g.id).sort((a, b) => a.d.localeCompare(b.d));
  if (!mine.length) return null;
  const p = goalProgress(g);
  if (p.remaining <= 0) return { monthsLeft: 0 };
  const td = today(), start = maxISO(mine[0].d, addDays(td, -182));
  const net = mine.filter(x => x.d >= start && x.d <= td).reduce((s, x) => s + x.v, 0);
  const months = Math.max(1, daysBetween(start, td) / 30.44);
  const perMonth = net / months;
  if (perMonth <= 0) return null;
  return { monthsLeft: Math.ceil(p.remaining / perMonth), perMonth: round2(perMonth) };
}
const earm = a => goals.filter(g => g.accId == a.id).reduce((t, g) => t + goalProgress(g).saved, 0);
const freeBal = (a, d) => round2(acctBalance(a, d) - earm(a));
// Calcula algo como si un movimiento no existiera (para validar al editar)
function without(id, fn) { const keep = txs; txs = txs.filter(t => t.id != id); try { return fn(); } finally { txs = keep; } }

// ============ presupuesto ============
// Base (todos los meses) + excepciones por mes. Un límite borrado se elimina de verdad (antes volvía al recargar).
function budgetFor(ym) {
  const o = (cfg.budgetOverrides || {})[ym] || {};
  const cats = { ...(cfg.budgetCats || {}) };
  for (const [k, v] of Object.entries(o.cats || {})) if (v == null) delete cats[k]; else cats[k] = v;
  return { total: o.total != null ? o.total : (cfg.budgetTotal || 0), cats, hasTotalOverride: o.total != null, catOverrides: o.cats || {} };
}
function budgetStatus(spent, limit) { if (!limit) return null; const p = spent / limit; return { pct: Math.round(p * 100), level: p >= 1 ? 'out' : p >= 0.8 ? 'yellow' : 'in' }; }
const barCol = level => (level == 'out' ? 'var(--out)' : level == 'yellow' ? 'var(--yellow)' : 'var(--in)');

// ============ recurrentes ============
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const recMonth = r => +(r.month || (r.startDate ? +r.startDate.slice(5, 7) : 1));
function nextDates(rec, fromISO, toISO) {
  const out = [];
  if (!(fromISO <= toISO)) return out;
  const from = new Date(fromISO + 'T00:00:00Z'), to = new Date(toISO + 'T00:00:00Z');
  const push = dt => { if (isNaN(dt)) return; const s = dt.toISOString().slice(0, 10); if (s >= fromISO && s <= toISO) out.push(s); };
  const eachMonth = fn => { let y = from.getUTCFullYear(), m = from.getUTCMonth(); while (Date.UTC(y, m, 1) <= +to) { fn(y, m); m++; if (m > 11) { m = 0; y++; } } };
  const dayIn = (y, m) => { const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return rec.day == 'ultimo' ? last : Math.min(Math.max(1, Number(rec.day) || 1), last); };
  if (rec.freq == 'semanal') {
    const wd = Math.min(6, Math.max(0, Number(rec.day) || 0)), d = new Date(from);
    d.setUTCDate(d.getUTCDate() + ((7 + wd - d.getUTCDay()) % 7));
    while (d <= to) { push(new Date(d)); d.setUTCDate(d.getUTCDate() + 7); }
  } else if (rec.freq == 'quincenal') {
    eachMonth((y, m) => { push(new Date(Date.UTC(y, m, 1))); push(new Date(Date.UTC(y, m, 15))); });
  } else if (rec.freq == 'anual') {
    const mo = recMonth(rec) - 1;
    for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) push(new Date(Date.UTC(y, mo, dayIn(y, mo))));
  } else {
    eachMonth((y, m) => push(new Date(Date.UTC(y, m, dayIn(y, m)))));
  }
  return out.sort();
}
// Desde cuándo buscar pendientes: respeta la fecha de inicio aunque haya confirmaciones viejas.
const recFrom = r => { const s = r.startDate || '2000-01-01'; return r.lastConfirmed ? maxISO(s, addDay(r.lastConfirmed)) : s; };
function pendingRecurring() {
  const td = today(), out = [];
  recs.filter(r => r.active !== false).forEach(r => {
    const done = new Set(r.done || []);
    nextDates(r, recFrom(r), td).forEach(date => { if (!done.has(date)) out.push({ recId: r.id, date }); });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// Marca una fecha como resuelta sin perder las anteriores pendientes (antes confirmar una fecha borraba las previas).
function recMarkDone(r, date) {
  const done = new Set([...(r.done || []), date]);
  let last = r.lastConfirmed;
  const maxDone = [...done].sort().pop();
  for (const d of nextDates(r, recFrom(r), maxDone)) { if (done.has(d)) { last = d; done.delete(d); } else break; }
  for (const d of [...done]) if (last && d <= last) done.delete(d);
  return { ...r, lastConfirmed: last, done: [...done].sort() };
}
const freqLabel = { mensual: 'Mensual', quincenal: 'Quincenal (1 y 15)', semanal: 'Semanal', anual: 'Anual' };
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
// Corrección: antes un recurrente mensual del día 5 se mostraba como "Viernes".
function dayLabel(r) {
  if (r.freq == 'semanal') return WEEKDAYS[Number(r.day)] || '';
  if (r.freq == 'quincenal') return 'Días 1 y 15';
  const d = r.day == 'ultimo' ? 'Último día' : 'Día ' + r.day;
  return r.freq == 'anual' ? `${d} de ${MONTHS[recMonth(r) - 1].toLowerCase()}` : d + (r.day == 'ultimo' ? ' del mes' : '');
}

// ============ filtros ============
const inF = x => (!F.f || x.d >= F.f) && (!F.u || x.d <= F.u);
// Ingresos y egresos (para gráficas y Excel)
const fl = () => txs.filter(x => (x.t == 'i' || x.t == 'e') && inF(x) && (!F.t || x.t == F.t) && (!F.c || x.c == F.c) && (!F.w || x.w == F.w) && (!F.acc || x.accId == F.acc)).sort((a, b) => b.d.localeCompare(a.d));
// Historial: incluye transferencias y movimientos de metas (antes solo aparecían cuando estaban borrados)
const histMatch = x => (!F.q || txText(x).includes(norm(F.q))) && inF(x) && (!F.t || x.t == F.t) && (!F.c || x.c == F.c) && (!F.w || x.w == F.w) && (!F.acc || x.accId == F.acc || x.accIdTo == F.acc);
const sum = (a, t) => a.filter(x => x.t == t).reduce((s, x) => s + x.v, 0);
const grp = (a, k) => a.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + x.v, o), {});
const icoFor = (catName, type) => (cfg.cats.find(x => x.n == catName && x.t == type) || {}).icon || 'tag';

// ============ tarjetas de crédito: corte y pago ============
const clampDay = (y, m, day) => Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
function lastDayOn(day, iso) { // fecha más reciente <= iso que cae en ese día del mes
  let y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1;
  for (let k = 0; k < 3; k++) { const d = new Date(Date.UTC(y, m, clampDay(y, m, day))).toISOString().slice(0, 10); if (d <= iso) return d; m--; if (m < 0) { m = 11; y--; } }
}
function nextDayAfter(day, iso) { // primera fecha > iso que cae en ese día del mes
  let y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1;
  for (let k = 0; k < 3; k++) { const d = new Date(Date.UTC(y, m, clampDay(y, m, day))).toISOString().slice(0, 10); if (d > iso) return d; m++; if (m > 11) { m = 0; y++; } }
}
// Saldo al corte, lo pagado desde entonces y cuánto falta antes de la fecha de pago
function cardCycle(a) {
  if (!isCard(a) || !(a.cutDay >= 1) || !(a.payDay >= 1)) return null;
  const td = today(), cut = lastDayOn(+a.cutDay, td), pay = nextDayAfter(+a.payDay, cut);
  const debtAtCut = Math.max(0, -acctBalance(a, cut));
  const paid = txs.filter(x => x.d > cut && x.d <= td && ((x.t == 'tr' && x.accIdTo == a.id) || (x.t == 'i' && x.accId == a.id)))
    .reduce((s, x) => s + (x.t == 'tr' ? x.aTo : amtInAcc(x, a)), 0);
  const left = Math.max(0, round2(debtAtCut - paid));
  return { cut, pay, nextCut: nextDayAfter(+a.cutDay, td), debtAtCut: round2(debtAtCut), paid: round2(paid), left, days: daysBetween(td, pay) };
}

// ============ reportes ============
function monthStats(ym) {
  const m = txs.filter(x => x.d.slice(0, 7) == ym);
  const inc = sum(m, 'i'), exp = sum(m, 'e'), net = inc - exp;
  return { inc: round2(inc), exp: round2(exp), net: round2(net), rate: inc > 0 ? Math.round(net / inc * 100) : null };
}
const pctChange = (a, b) => (b ? Math.round((a - b) / Math.abs(b) * 100) : null);

// ============ búsqueda en historial ============
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function txText(x) {
  const a = accs.find(c => c.id == x.accId), b = accs.find(c => c.id == x.accIdTo), g = goals.find(q => q.id == x.goalId);
  return norm([x.c, x.sub, x.n, x.w, x.byName, a && a.name, b && b.name, g && g.name, x.t == 'tr' ? 'transferencia' : '', x.t == 'st' ? 'saldo pareja' : '', x.to, x.split ? 'compartido' : '', x.a, x.v].join(' '));
}

// ============ gastos compartidos ============
// Cada gasto puede ser personal, compartido entre todos o pagado para otra persona.
// Devuelve el saldo neto de cada persona: positivo = le deben; negativo = debe.
function sharedNet() {
  const net = {}, add = (p, v) => { if (p) net[p] = round2((net[p] || 0) + v); };
  for (const x of txs) {
    if (x.t == 'e' && x.split && x.w) {
      if (x.split == 'half') {
        const others = cfg.people.filter(p => p != x.w), share = x.v / (others.length + 1);
        others.forEach(o => { add(o, -share); add(x.w, share); });
      } else { const o = x.split.slice(4); if (o && o != x.w) { add(o, -x.v); add(x.w, x.v); } }
    } else if (x.t == 'st') { add(x.w, x.v); add(x.to, -x.v); }
  }
  return net;
}
// Quién le debe a quién, simplificado en pagos mínimos
function settlements() {
  const net = sharedNet(), deud = [], acre = [];
  for (const [p, v] of Object.entries(net)) { if (v < -0.005) deud.push([p, -v]); else if (v > 0.005) acre.push([p, v]); }
  const out = []; deud.sort((a, b) => b[1] - a[1]); acre.sort((a, b) => b[1] - a[1]);
  let i = 0, j = 0;
  while (i < deud.length && j < acre.length) { const m = Math.min(deud[i][1], acre[j][1]); out.push({ from: deud[i][0], to: acre[j][0], amount: round2(m) }); deud[i][1] -= m; acre[j][1] -= m; if (deud[i][1] < 0.005) i++; if (acre[j][1] < 0.005) j++; }
  return out;
}
const splitLabel = x => (!x.split ? '' : x.split == 'half' ? 'compartido' : 'para ' + x.split.slice(4));

// ============ planificación (v8): te alcanza, proyección, promedio y calendario ============
// Convierte un monto entre monedas con la última tasa conocida
function convert(amount, from, to, d) {
  if (from == to) return amount;
  const rf = rateOf(from, d), rt = rateOf(to, d);
  return rf && rt ? round2(amount * rf / rt) : amount;
}
const recCur = r => r.currency || 'DOP';
const recDOP = (r, d) => convert(r.amount, recCur(r), 'DOP', d);
const liquidAccs = () => accs.filter(a => !isCard(a) && (a.currency || 'DOP') == 'DOP');
const isLiquid = id => liquidAccs().some(a => a.id == id);
// Fechas de un recurrente que aún no se han confirmado ni omitido, hasta "to" (incluye las vencidas)
const recOpen = (r, to) => r.active === false ? [] : nextDates(r, recFrom(r), to).filter(d => !(r.done || []).includes(d));
const paidByRec = a => recs.some(r => r.active !== false && r.t == 'tr' && r.accIdTo == a.id);
// Próximo ingreso recurrente después de hoy
function nextIncome() {
  const td = today(); let best = null;
  recs.filter(r => r.t == 'i' && r.active !== false).forEach(r => {
    const d = recOpen(r, addDays(td, 70)).find(x => x > td);
    if (d && (!best || d < best.d)) best = { d, r };
  });
  return best;
}
// ¿Cuánto puedes gastar hasta el próximo ingreso? Dinero libre (sin lo apartado para metas)
// menos lo que ya está comprometido antes de esa fecha: facturas, aportes a metas, pagos de tarjeta.
function safeToSpend() {
  const liq = liquidAccs(); if (!liq.length) return null;
  const td = today(), ym = td.slice(0, 7), ni = nextIncome();
  const until = ni ? ni.d : (monthEnd(ym) > td ? monthEnd(ym) : monthEnd(addMonths(ym, 1)));
  const free = round2(liq.reduce((s, a) => s + freeBal(a), 0)), items = [];
  recs.forEach(r => {
    if (!isLiquid(r.accId)) return; // lo que se paga con tarjeta no sale hoy de tus cuentas
    const out = r.t == 'e' || r.t == 'g' || (r.t == 'tr' && !isLiquid(r.accIdTo));
    if (!out) return;
    recOpen(r, addDays(until, -1)).forEach(d => items.push({ name: r.name, d, v: recDOP(r, d), late: d < td, icon: recIcon(r), rec: r.id }));
  });
  accs.filter(isCard).forEach(a => {
    const cy = cardCycle(a); if (!cy || cy.left <= 0 || cy.pay >= until || paidByRec(a)) return;
    items.push({ name: 'Pagar ' + a.name, d: cy.pay, v: convert(cy.left, a.currency, 'DOP', td), late: cy.pay < td, icon: 'credit-card', card: a.id });
  });
  items.sort((x, y) => x.d.localeCompare(y.d));
  const committed = round2(items.reduce((s, x) => s + x.v, 0)), left = round2(free - committed), days = Math.max(1, daysBetween(td, until));
  return { until, income: ni, free, items, committed, left, days, perDay: left > 0 ? round2(left / days) : 0 };
}
// Saldo proyectado: parte del saldo de hoy y aplica los recurrentes y pagos de tarjeta pendientes.
// Devuelve la serie diaria del disponible en pesos y las cuentas que quedarían en negativo (desde qué día y su peor saldo).
function projection(days, daily = 0) {
  const td = today(), end = addDays(td, days), ev = [];
  recs.forEach(r => {
    const from = accs.find(a => a.id == r.accId); if (!from) return;
    recOpen(r, end).forEach(d0 => {
      const d = d0 < td ? td : d0, amt = convert(r.amount, recCur(r), from.currency, d0);
      if (r.t == 'i') ev.push({ d, id: from.id, v: amt, name: r.name });
      else if (r.t == 'e') ev.push({ d, id: from.id, v: -amt, name: r.name });
      else if (r.t == 'tr') { const to = accs.find(a => a.id == r.accIdTo); ev.push({ d, id: from.id, v: -r.amount, name: r.name }); if (to) ev.push({ d, id: to.id, v: convert(r.amount, from.currency, to.currency, d0), name: r.name }); }
      else if (r.t == 'g') { const g = goals.find(q => q.id == r.goalId), home = g && g.accId; if (home && home != from.id) { ev.push({ d, id: from.id, v: -r.amount, name: r.name }); ev.push({ d, id: home, v: convert(r.amount, from.currency, 'DOP', d0), name: r.name }); } }
    });
  });
  accs.filter(isCard).forEach(a => {
    const cy = cardCycle(a); if (!cy || cy.left <= 0 || cy.pay > end || paidByRec(a)) return;
    const d = cy.pay < td ? td : cy.pay;
    ev.push({ d, id: a.id, v: cy.left, name: 'Pago ' + a.name }); // la deuda baja…
    ev.push({ d, id: null, v: -convert(cy.left, a.currency, 'DOP', td), name: 'Pago ' + a.name }); // …y sale de tus cuentas (sin cuenta fija)
  });
  ev.sort((x, y) => x.d.localeCompare(y.d));
  const bal = Object.fromEntries(accs.map(a => [a.id, acctBalance(a)])), liq = new Set(liquidAccs().map(a => a.id));
  let total = round2([...liq].reduce((s, id) => s + bal[id], 0));
  const series = [], neg = {}; let i = 0, min = { d: td, v: total };
  accs.forEach(a => { if (!isCard(a) && bal[a.id] < -0.005) neg[a.id] = { acc: a, d: td, v: bal[a.id], now: true }; }); // ya está en negativo hoy
  for (let k = 0; k <= days; k++) {
    const d = addDays(td, k);
    while (i < ev.length && ev[i].d <= d) {
      const e = ev[i++];
      if (e.id == null) total += e.v;
      else { bal[e.id] = round2((bal[e.id] || 0) + e.v); if (liq.has(e.id)) total += e.v; }
      const a = e.id && accs.find(x => x.id == e.id);
      if (a && !isCard(a) && bal[a.id] < -0.005) { if (!neg[a.id]) neg[a.id] = { acc: a, d, v: bal[a.id] }; else neg[a.id].v = Math.min(neg[a.id].v, bal[a.id]); }
    }
    if (k > 0 && daily) total -= daily; // gasto del día a día estimado
    total = round2(total); series.push({ d, v: total });
    if (total < min.v) min = { d, v: total };
  }
  return { series, min, end: series[series.length - 1], start: series[0], negatives: Object.values(neg), events: ev };
}
// Gasto del día a día: egresos que no vienen de un recurrente, promedio diario de los últimos 90 días
function dailyVariable() {
  const td = today(), first = txs.reduce((m, x) => (x.t == 'e' && (!m || x.d < m) ? x.d : m), null); if (!first) return 0;
  const from = maxISO(first, addDays(td, -90)), days = daysBetween(from, td) + 1; if (days < 14) return 0;
  return round2(txs.filter(x => x.t == 'e' && !x.rec && x.d >= from && x.d <= td).reduce((s, x) => s + x.v, 0) / days);
}
// Promedio por categoría de los 3 meses anteriores (solo desde que empezaste a anotar)
function catCompare(ym, n = 3) {
  const first = txs.reduce((m, x) => (x.t == 'e' && (!m || x.d < m) ? x.d : m), null); if (!first) return null;
  const months = []; for (let k = 1; k <= n; k++) { const m = addMonths(ym, -k); if (m >= first.slice(0, 7)) months.push(m); }
  if (!months.length) return null;
  const tot = {}; txs.filter(x => x.t == 'e' && months.includes(x.d.slice(0, 7))).forEach(x => tot[x.c] = (tot[x.c] || 0) + x.v);
  const cur = grp(txs.filter(x => x.t == 'e' && x.d.slice(0, 7) == ym), 'c');
  const isCur = ym == today().slice(0, 7), frac = isCur ? +today().slice(8, 10) / +monthEnd(ym).slice(8, 10) : 1;
  const rows = [...new Set([...Object.keys(tot), ...Object.keys(cur)])].map(c => {
    const avg = round2((tot[c] || 0) / months.length), v = round2(cur[c] || 0);
    return { c, v, avg, pct: avg ? Math.round((v - avg) / avg * 100) : null, pace: avg ? v / (avg * frac) : null };
  }).sort((a, b) => b.v - a.v || b.avg - a.avg);
  const avgTot = round2(rows.reduce((s, r) => s + r.avg, 0)), vTot = round2(rows.reduce((s, r) => s + r.v, 0));
  return { months: months.length, frac, rows, avgTot, vTot };
}
// Fechas de un mes que caen en cierto día (para cortes y pagos de tarjetas y facturas)
function daysOnMonth(day, ym) { const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; return new Date(Date.UTC(y, m, clampDay(y, m, +day))).toISOString().slice(0, 10); }
// Eventos de un mes para el calendario de pagos
function calendarEvents(ym) {
  const from = ym + '-01', to = monthEnd(ym), td = today(), out = [];
  recs.filter(r => r.active !== false).forEach(r => {
    const rf = recFrom(r), done = r.done || [];
    nextDates(r, maxISO(from, r.startDate || from), to).forEach(d => {
      const ok = d < rf || done.includes(d);
      out.push({ d, k: r.t, name: r.name, v: r.amount, cu: recCur(r), st: ok ? 'done' : d < td ? 'late' : 'next', rec: r.id, icon: recIcon(r) });
    });
    if (r.t == 'e' && r.cutDay) { const d = daysOnMonth(r.cutDay, ym); if (d >= (r.startDate || '')) out.push({ d, k: 'cut', name: 'Corte ' + r.name, st: d < td ? 'done' : 'next', icon: 'receipt' }); }
  });
  accs.filter(isCard).forEach(a => {
    const cy = cardCycle(a);
    if (a.payDay) { const d = daysOnMonth(a.payDay, ym); out.push({ d, k: 'pay', name: 'Pagar ' + a.name, v: cy && cy.pay == d ? cy.left : null, cu: a.currency, st: cy && cy.pay == d ? (cy.left <= 0 ? 'done' : d < td ? 'late' : 'next') : d < td ? 'done' : 'next', acc: a.id, icon: 'credit-card' }); }
    if (a.cutDay) { const d = daysOnMonth(a.cutDay, ym); out.push({ d, k: 'cut', name: 'Corte ' + a.name, st: d < td ? 'done' : 'next', icon: 'credit-card' }); }
  });
  return out.sort((x, y) => x.d.localeCompare(y.d) || x.name.localeCompare(y.name));
}

