'use strict';
/* Mis finanzas — núcleo: utilidades, estado, almacenamiento y cálculos.
   Los demás scripts (views.js, sync-ui.js) comparten estas variables globales. */

// ============ utilidades ============
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CUR_RE = /^[A-Z]{3}$/, ISO_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const round2 = n => Math.round((+n || 0) * 100) / 100;
const fmtCache = {};
function money(n, c = 'DOP') {
  c = CUR_RE.test(c || '') ? c : 'DOP';
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
let cfg = fresh(), txs = [], accs = [], adjs = [], recs = [], goals = [], cfgT = 0, dels = {}, trash = [];
let F = {}, tab = 'home', ch = [], budYm = today().slice(0, 7), budMode = 'base';

// ---- limpieza de datos (al cargar o importar): evita datos corruptos o código inyectado ----
const num = v => (Number.isFinite(+v) ? +v : 0);
const okId = x => x && ID_RE.test(String(x.id || ''));
const okDate = d => ISO_RE.test(String(d || ''));
function cleanTx(x) {
  if (!okId(x) || !okDate(x.d) || !['i', 'e', 'tr', 'g'].includes(x.t)) return null;
  const o = { ...x, a: num(x.a), v: num(x.v) };
  if (x.cu != null && !CUR_RE.test(x.cu)) o.cu = 'DOP';
  if (x.aTo != null) o.aTo = num(x.aTo);
  if (x.aa != null) o.aa = num(x.aa);
  if (x.r != null) o.r = num(x.r);
  for (const k of ['accId', 'accIdTo', 'goalId', 'home']) if (o[k] != null && !ID_RE.test(String(o[k]))) o[k] = null;
  return o;
}
function cleanState(o) {
  const arr = (a, f) => (Array.isArray(a) ? a.map(f).filter(Boolean) : []);
  const c = { ...fresh(), ...(o.cfg || {}) };
  c.cur = (c.cur || []).filter(x => CUR_RE.test(x) && x != 'DOP');
  c.cats = (c.cats || []).filter(x => x && x.n && (x.t == 'i' || x.t == 'e')).map(x => ({ ...x, icon: ICONS.includes(x.icon) ? x.icon : 'tag' }));
  return {
    cfg: c, cfgT: num(o.cfgT),
    txs: arr(o.txs, cleanTx),
    trash: arr(o.trash, x => { const y = cleanTx(x); return y ? { ...y, del: num(x.del) } : null; }),
    accs: arr(o.accs, x => (okId(x) ? { ...x, currency: CUR_RE.test(x.currency) ? x.currency : 'DOP', openBalance: num(x.openBalance), openDate: okDate(x.openDate) ? x.openDate : '2000-01-01' } : null)),
    adjs: arr(o.adjs, x => (okId(x) && okDate(x.date) && ID_RE.test(String(x.accId)) ? { ...x, balance: num(x.balance), u: num(x.u || x.createdAt), createdAt: num(x.createdAt || x.u) } : null)),
    recs: arr(o.recs, x => (okId(x) && ID_RE.test(String(x.accId || 'x')) ? { ...x, amount: num(x.amount), currency: CUR_RE.test(x.currency) ? x.currency : 'DOP', done: Array.isArray(x.done) ? x.done.filter(okDate) : [], lastConfirmed: okDate(x.lastConfirmed) ? x.lastConfirmed : undefined, startDate: okDate(x.startDate) ? x.startDate : today() } : null)),
    goals: arr(o.goals, x => (okId(x) ? { ...x, target: num(x.target) } : null)),
    dels: Object.fromEntries(Object.entries(o.dels || {}).filter(([k, v]) => ID_RE.test(k)).map(([k, v]) => [k, num(v)]))
  };
}
function setState(s) { ({ cfg, cfgT, txs, accs, adjs, recs, goals, dels, trash } = s); }
const snapshot = () => ({ cfg, cfgT, txs, accs, adjs, recs, goals, dels, trash });

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
  return (best || after || {}).r || 0;
}

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
  for (const [c, v] of Object.entries(t)) { const r = rateOf(c, asOf || today()); if (r) s += v.neto * r; else missing.push(c); }
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
const histMatch = x => inF(x) && (!F.t || x.t == F.t) && (!F.c || x.c == F.c) && (!F.w || x.w == F.w) && (!F.acc || x.accId == F.acc || x.accIdTo == F.acc);
const sum = (a, t) => a.filter(x => x.t == t).reduce((s, x) => s + x.v, 0);
const grp = (a, k) => a.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + x.v, o), {});
const icoFor = (catName, type) => (cfg.cats.find(x => x.n == catName && x.t == type) || {}).icon || 'tag';
