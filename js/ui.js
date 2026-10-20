'use strict';
(window.__V = window.__V || {})['ui.js'] = '10.3.0';
/* Mis finanzas — utilidades de interfaz, acciones (guardar/borrar) y navegación. */
const dlg = document.getElementById('dlg');
const $ = id => document.getElementById(id);
const deep = o => JSON.parse(JSON.stringify(o));

// ============ avisos propios (reemplazan alert/confirm del navegador) ============
function toast(msg, opts = {}) {
  const host = dlg.open ? dlg : document.body;
  let box = host.querySelector(':scope > .toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; host.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + (opts.kind || '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>` + (opts.action ? `<button type="button">${esc(opts.action)}</button>` : '');
  if (opts.action) el.querySelector('button').onclick = () => { el.remove(); opts.onAction && opts.onAction(); };
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove(); // máximo 3 avisos a la vez
  setTimeout(() => el.remove(), opts.ms || (opts.action ? 7000 : opts.kind == 'err' ? 5000 : 3000));
}
const fail = msg => (toast(msg, { kind: 'err' }), false);
// Pregunta con botones propios. Devuelve una promesa con true/false.
function ask(msg, { ok = 'Aceptar', cancel = 'Cancelar', danger = false, title = '' } = {}) {
  return new Promise(res => {
    const d = $('ask');
    d.innerHTML = `<form method="dialog">${title ? `<h2>${esc(title)}</h2>` : ''}<p>${esc(msg).replace(/\n/g, '<br>')}</p>
<div class="seg"><button value="0">${esc(cancel)}</button><button value="1" class="${danger ? 'danger fill' : 'p'}">${esc(ok)}</button></div></form>`;
    d.returnValue = '';
    d.onclose = () => { if (history.state && history.state.ask) { ignorePop++; history.back(); } res(d.returnValue == '1'); };
    d.showModal(); history.pushState({ ...(history.state || {}), ask: 1 }, ''); // el botón Atrás del teléfono la cierra
  });
}

// ============ quién usa este teléfono ============
const myPerson = () => { try { return (window.Cloud && window.Cloud.myName) || localStorage.getItem('fin_me') || ''; } catch (e) { return ''; } };
function setMyPerson(n) { try { n ? localStorage.setItem('fin_me', n) : localStorage.removeItem('fin_me'); } catch (e) { } }
const defaultWho = () => { const me = myPerson(); return me ? me : (lastUsed().w && cfg.people.includes(lastUsed().w) ? lastUsed().w : cfg.people[0]); };
// Recuerda la última cuenta, moneda y persona usadas
function lastUsed() { try { return JSON.parse(localStorage.getItem('fin_last')) || {}; } catch (e) { return {}; } }
function rememberLast(o) { try { localStorage.setItem('fin_last', JSON.stringify({ ...lastUsed(), ...o })); } catch (e) { } }

// ============ acciones: cada una guarda local + nube ============
function saveCfg(c, silent) { cfg = c; cfgT = now(); local(); cloudCfg(); if (!silent) render(); }
function saveTx(t, opts = {}) {
  const id = t.id || uid(), { id: _, del: __, ...o } = t, prev = txs.find(x => x.id == id) || trash.find(x => x.id == id) || {};
  const obj = { id, ...o, cr: o.cr || prev.cr || now(), u: now() };
  if (!prev.id && !obj.byName && myPerson()) obj.byName = myPerson(); // quién lo anotó
  trash = trash.filter(x => x.id != id); txs = txs.filter(x => x.id != id).concat(obj); delete dels[id];
  local(); cloudPut('tx', obj); if (!opts.noRender) render();
  return obj;
}
// Guarda muchos movimientos de una vez (renombrar categorías o personas)
function bulkTxs(list) {
  if (!list.length) return;
  const t = now(), map = new Map(list.map(x => [x.id, { ...x, u: t }]));
  txs = txs.map(x => map.get(x.id) || x); local();
  if (cloudOn()) window.Cloud.pushItems([...map.values()].map(x => toItem('tx', x)));
}
function delTx(id, opts = {}) {
  const x = txs.find(t => t.id == id); if (!x) return;
  const n = now(); txs = txs.filter(t => t.id != id); dels[id] = n;
  trash = trash.filter(t => t.id != id).concat({ ...x, del: n }); cloudDel('tx', x, n);
  local(); if (dlg.open) dlg.close(); render();
  toast(opts.msg || 'Movimiento borrado', { action: 'Deshacer', onAction: () => { restoreTx(id); toast('Restaurado', { kind: 'ok' }); } });
}
function restoreTx(id) { const x = trash.find(t => t.id == id); if (x) saveTx(x); }
function saveAcc(a) {
  const id = a.id || uid(), { id: _, ...o } = a, prev = accs.find(x => x.id == id) || {};
  const obj = { ...prev, id, ...o, u: now() };
  accs = accs.filter(x => x.id != id).concat(obj); local(); cloudPut('acc', obj); render();
}
async function delAcc(id) {
  const tied = goals.filter(g => g.accId == id);
  if (tied.length) return fail('Esta cuenta tiene metas atadas (' + tied.map(g => g.name).join(', ') + '). Cambia o borra esas metas primero.');
  const n = txs.filter(x => x.accId == id || x.accIdTo == id).length;
  if (!(await ask(n ? `Esta cuenta tiene ${n} movimientos. Se conservarán en el historial.` : 'La cuenta se borrará.', { title: '¿Borrar la cuenta?', ok: 'Borrar', danger: true }))) return;
  removeItem('acc', id); if (dlg.open) dlg.close(); render(); toast('Cuenta borrada');
}
function saveAdj(a) {
  const id = a.id || uid(), { id: _, ...o } = a, obj = { id, ...o, createdAt: now(), u: now() };
  adjs = adjs.filter(x => x.id != id).concat(obj); local(); cloudPut('adj', obj); render();
}
function saveRec(r, opts = {}) {
  const id = r.id || uid(), { id: _, ...o } = r, prev = recs.find(x => x.id == id) || {};
  const obj = { ...prev, id, ...o, u: now() };
  recs = recs.filter(x => x.id != id).concat(obj); local(); cloudPut('rec', obj); if (!opts.noRender) render();
}
function saveGoal(g) {
  const id = g.id || uid(), { id: _, ...o } = g, prev = goals.find(x => x.id == id) || {};
  const obj = { ...prev, id, ...o, u: now() };
  goals = goals.filter(x => x.id != id).concat(obj); local(); cloudPut('goal', obj); render();
}
function removeItem(kind, id) {
  const key = KIND_KEY[kind];
  const list = listOf(key), it = list.find(x => x.id == id), ts = now();
  assign(key, list.filter(x => x.id != id));
  dels[id] = ts; if (it) { bin = bin.filter(x => x.id != id).concat({ k: kind, id, del: ts, d: deep(it) }); cloudDel(kind, it, ts); }
  local();
}
// Restaura algo de la papelera (movimiento, cuenta, recurrente, meta o ajuste)
function restoreItem(id) {
  const t = trash.find(x => x.id == id);
  if (t) { restoreTx(id); toast('Restaurado', { kind: 'ok' }); return; }
  const b = bin.find(x => x.id == id); if (!b) return;
  const key = KIND_KEY[b.k], list = listOf(key);
  const obj = (cleanState({ [key]: [{ ...b.d, id, u: now() }] })[key] || [])[0]; if (!obj) return fail('No se pudo restaurar.');
  assign(key, list.filter(x => x.id != id).concat(obj)); bin = bin.filter(x => x.id != id); delete dels[id];
  local(); cloudPut(b.k, obj); render(); toast('Restaurado', { kind: 'ok' });
}
async function resetAll() {
  const shared = cloudOn();
  if (!(await ask(shared ? 'Se borra TODO en la nube y en todos los teléfonos del hogar: cuentas, movimientos, metas, recurrentes y presupuesto.' : 'Se borra TODO en este teléfono: cuentas, movimientos, metas, recurrentes, presupuesto y categorías.', { title: '¿Borrar todos los datos?', ok: 'Sí, borrar', danger: true }))) return;
  if (!(await ask('No se puede deshacer, salvo importando un respaldo. ¿Ya descargaste uno?', { title: 'Última confirmación', ok: 'Borrar todo', danger: true }))) return;
  if (shared) window.Cloud.wipeAll(getAllItems());
  setState({ cfg: fresh(), cfgT: now(), txs: [], accs: [], adjs: [], recs: [], goals: [], dels: {}, trash: [], bin: [], debts: [], assets: [] });
  F = {}; local(); if (shared) cloudCfg(); go('home'); toast('Datos borrados');
}

// ============ navegación ============
const NAV = ['home', 'hist', 'acc', 'more'];
const UNDER_MORE = ['more', 'bud', 'rep', 'rec', 'goal', 'set', 'shared', 'plan', 'trash', 'debts', 'tools'];
function go(t) { tab = t; if (dlg.open) dlg.close(); render(); scrollTo(0, 0); }
function pre(k) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), f = (mm, d) => new Date(Date.UTC(y, mm, d)).toISOString().slice(0, 10);
  if (k == 'mes') { F.f = f(m, 1); F.u = f(m + 1, 0); }
  else if (k == 'ant') { F.f = f(m - 1, 1); F.u = f(m, 0); }
  else if (k == 'año') { F.f = f(0, 1); F.u = f(11, 31); }
  else F.f = F.u = '';
  F.pre = k; render();
}
const sf = (k, v) => { F[k] = v; if (k == 'f' || k == 'u') F.pre = ''; render(); };
const opts = (a, s) => a.map(x => `<option value="${esc(x)}"${x == s ? ' selected' : ''}>${esc(x)}</option>`).join('');
const sel = (l, k, a) => `<label>${l}<select onchange="sf('${k}',this.value)"><option value="">Todos</option>${a.map(x => `<option value="${esc(x.v ?? x)}"${F[k] == (x.v ?? x) ? ' selected' : ''}>${esc(x.l ?? x)}</option>`).join('')}</select></label>`;
const activeFilters = () => ['f', 'u', 't', 'c', 'w', 'acc'].filter(k => F[k]).length;
function fbar(hist) {
  const all = [...new Set(cfg.cats.map(c => c.n))];
  const types = [{ v: 'i', l: 'Ingresos' }, { v: 'e', l: 'Egresos' }].concat(hist ? [{ v: 'tr', l: 'Transferencias' }, { v: 'g', l: 'Metas' }, { v: 'st', l: 'Saldos de pareja' }] : []);
  return `<div class="chips" style="margin-bottom:8px">${[['mes', 'Este mes'], ['ant', 'Mes pasado'], ['año', 'Este año'], ['todo', 'Todo']].map(([k, l]) => `<button class="${F.pre == k ? 'on' : ''}" onclick="pre('${k}')">${l}</button>`).join('')}</div>
<div class="fb"><label>Desde<input type="date" value="${esc(F.f || '')}" onchange="sf('f',this.value)"></label><label>Hasta<input type="date" value="${esc(F.u || '')}" onchange="sf('u',this.value)"></label>
${sel('Tipo', 't', types)}${sel('Categoría', 'c', all)}${sel('Persona', 'w', cfg.people)}${sel('Cuenta', 'acc', accs.map(a => ({ v: a.id, l: a.name })))}</div>
${activeFilters() ? `<button class="link" style="margin-top:6px" onclick="F={q:F.q,open:F.open,showDel:F.showDel};render()">Quitar filtros</button>` : ''}`;
}
function dlgShow() { if (!dlg.open) { dlg.showModal(); if (!dlgEntry) { history.pushState({ ...(history.state || {}), dlg: 1 }, ''); dlgEntry = true; } } const f = document.activeElement; if (f && f.closest && f.closest('#dlg .segc, #dlg .sheethd')) f.blur(); } // sin anillo de foco en las pestañas al abrir
// Tocar fuera de la hoja la cierra (como en las apps del teléfono)
dlg.addEventListener('click', e => { if (e.target != dlg) return; const r = dlg.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dlg.close(); });

function eyeBtn() { return `<button class="iconbtn" aria-label="${HIDE ? 'Mostrar montos' : 'Ocultar montos'}" title="${HIDE ? 'Mostrar montos' : 'Ocultar montos'}" onclick="toggleHide()"><i class="icon-${HIDE ? 'eye-off' : 'eye'}"></i></button>`; }
function toggleHide() { HIDE = !HIDE; try { localStorage.setItem('fin_hide', HIDE ? '1' : '0'); } catch (e) { } render(); }
function head(title, back) {
  return `${back ? `<button class="back" onclick="go('more')"><i class="icon-chevron-left"></i> Más</button>` : ''}<div class="top"><h1>${title}</h1><div class="tools">${syncBadge()}${eyeBtn()}</div></div>`;
}
// Selector de mes compacto (‹ Octubre 2026 ›)
const monthNav = (ym, v) => `<div class="mnav"><button class="iconbtn" aria-label="Mes anterior" onclick="${v}=addMonths(${v},-1);render()"><i class="icon-chevron-left"></i></button><b>${ymLabel(ym)}</b><button class="iconbtn" aria-label="Mes siguiente" onclick="${v}=addMonths(${v},1);render()"><i class="icon-chevron-right"></i></button></div>`;

function render() {
  const active = UNDER_MORE.includes(tab) ? 'more' : tab;
  NAV.forEach(t => { const el = $('n-' + t); if (el) el.className = active == t ? 'on' : ''; });
  const rb = $('more-badge-holder');
  if (rb) { const n = pendingRecurring().length, old = rb.querySelector('.badge'); if (old) old.remove(); if (n) { const s = document.createElement('span'); s.className = 'badge'; s.textContent = n > 9 ? '9+' : n; rb.appendChild(s); } }
  ch.forEach(c => c.destroy()); ch = [];
  const app = $('app');
  try {
    document.documentElement.classList.toggle('wiz', tab == 'welcome');
    ({ home: renderHome, hist: renderHist, acc: renderAcc, bud: renderBud, more: renderMore, rep: renderRep, rec: renderRec, goal: renderGoal, set: renderSet, shared: renderShared, plan: renderPlan, trash: renderTrash, welcome: renderWelcome, debts: renderDebts, tools: renderTools }[tab] || renderHome)(app);
    syncHistory();
  } catch (e) {
    // Si una pantalla falla, se muestra el error en vez de dejar todo en blanco; el menú sigue funcionando
    console.error(e);
    app.innerHTML = `<div class="card" style="margin-top:20px"><h2 class="out"><i class="icon-alert-triangle"></i> Esta pantalla tuvo un problema</h2>
<p class="mini">${esc(e && e.message || e)}</p><p class="mini">Prueba otra pestaña, o repara la app (tus datos están a salvo).</p>
<button class="p" onclick="__repair()">Reparar y recargar</button></div>`;
  }
}

// ============ paletas ============
const PALETTES = {"original": {"name": "Original", "sw": ["#5b3fd6", "#b0447e", "#f6f4fa", "#178a5c"]}, ...(window.MARCA && window.MARCA.paleta ? { escudo: window.MARCA.paleta } : {}), "veranda": {"name": "Veranda", "sw": ["#6BB1AD", "#A7BCBD", "#EDECDB", "#E5A9A9", "#E6748E"]}, "cielo": {"name": "Cielo", "sw": ["#E2EFF6", "#B7D7EA", "#8DBEDC", "#64A4CE", "#4893C6"]}, "clasico": {"name": "Clásico", "sw": ["#4f5232", "#6b1e24", "#e2d6c3"]}, "winewood": {"name": "Winewood", "sw": ["#2A1016", "#51202C", "#6B3543", "#2F4736", "#586759"]}, "bosque": {"name": "Bosque", "sw": ["#005308", "#1C996B", "#780A39", "#F2D2CC", "#D84F7A"]}};
// La paleta del escudo depende de la marca (js/marca.js)
const MARCA = window.MARCA || { nombre: '', paleta: null };
let palette = 'original'; try { palette = localStorage.getItem('fin_palette') || 'original'; } catch (e) { }
if (!PALETTES[palette]) palette = 'original';
function setPalette(id) { if (!PALETTES[id]) return; palette = id; try { localStorage.setItem('fin_palette', id); } catch (e) { } applyTheme(); render(); toast('Paleta: ' + PALETTES[id].name, { kind: 'ok' }); }

// ============ tema ============
let theme = 'auto'; try { theme = localStorage.getItem('fin_theme') || 'auto'; } catch (e) { }
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme == 'auto' ? '' : (theme == 'claro' ? 'light' : 'dark'));
  document.documentElement.setAttribute('data-palette', palette);
  const m = document.querySelector('meta[name=theme-color]'); if (m) setTimeout(() => m.content = getComputedStyle(document.body).backgroundColor, 0);
}
function setTheme(t) { theme = t; try { localStorage.setItem('fin_theme', t); } catch (e) { } applyTheme(); render(); }

// ============ botón Atrás del teléfono y hojas que se deslizan ============
// Cada pantalla (y cada subpantalla de Ajustes y Herramientas) es una entrada del historial: Atrás vuelve a la anterior.
// Una hoja abierta también: Atrás la cierra sin salir de la app. En Inicio, Atrás cierra la app como siempre.
let dlgEntry = false, ignorePop = 0;
const navKey = () => tab + '|' + (tab == 'set' ? setSub : '') + '|' + (tab == 'tools' ? toolView : '');
function syncHistory() {
  const st = history.state || {}, k = navKey();
  if (st.k == k) return;
  const s = { k, tab, setSub: tab == 'set' ? setSub : '', toolView: tab == 'tools' ? toolView : '' };
  if (!st.k || st.dlg || st.ask) { history.replaceState(s, ''); dlgEntry = false; } else history.pushState(s, '');
}
addEventListener('popstate', e => {
  if (ignorePop > 0) { ignorePop--; return; }
  const ak = $('ask');
  if (ak.open) { ak.close(); return; }
  if (dlg.open) { dlgEntry = false; dlg.close(); return; }
  const s = e.state || {}; if (!s.k) return;
  tab = s.tab || 'home'; if (tab == 'set') setSub = s.setSub || ''; if (tab == 'tools') toolView = s.toolView || '';
  render(); scrollTo(0, 0);
});
// Al cerrar la hoja con un botón, se quita su entrada del historial (si no se abrió otra enseguida)
dlg.addEventListener('close', () => setTimeout(() => {
  dlg.style.animation = '';
  if (dlg.open || !dlgEntry) return; dlgEntry = false;
  if (history.state && history.state.dlg) { ignorePop++; history.back(); }
}, 0));
// Deslizar la hoja hacia abajo (desde la línea de arriba, o desde cualquier parte si no hay nada que desplazar) la cierra
(function sheetDrag() {
  let y0 = null, x0 = 0, dy = 0, t0 = 0, on = false;
  const small = () => matchMedia('(max-width: 640px)').matches;
  const scrolled = el => { for (; el && el != dlg; el = el.parentElement) if (el.scrollTop > 0) return true; return dlg.scrollTop > 0; };
  dlg.addEventListener('touchstart', e => {
    y0 = null; if (!small() || e.touches.length != 1) return;
    const r = dlg.getBoundingClientRect(), t = e.touches[0], onHandle = t.clientY - r.top < 52;
    if (!onHandle && scrolled(e.target)) return;
    y0 = t.clientY; x0 = t.clientX; dy = 0; t0 = Date.now(); on = false;
  }, { passive: true });
  dlg.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const t = e.touches[0], d = t.clientY - y0, dx = t.clientX - x0;
    if (!on) {
      if (d > 8 && d > Math.abs(dx) * 1.2) { on = true; dlg.style.transition = 'none'; dlg.style.animation = 'none'; }
      else { if (d < -4 || Math.abs(dx) > 10) y0 = null; return; }
    }
    dy = Math.max(0, d); dlg.style.transform = `translateY(${dy}px)`; e.preventDefault(); // también evita que la app se recargue al jalar
  }, { passive: false });
  const end = () => {
    if (y0 == null) return; y0 = null; if (!on) return; on = false;
    const fast = dy / Math.max(1, Date.now() - t0) > 0.6;
    dlg.style.transition = 'transform .2s ease-out';
    if (dy > Math.min(140, dlg.offsetHeight * 0.28) || (fast && dy > 30)) { dlg.style.transform = 'translateY(105%)'; setTimeout(() => { dlg.close(); dlg.style.transform = dlg.style.transition = dlg.style.animation = ''; }, 190); }
    else { dlg.style.transform = ''; setTimeout(() => { dlg.style.transition = ''; }, 220); }
  };
  dlg.addEventListener('touchend', end); dlg.addEventListener('touchcancel', end);
})();

// Celebración al cumplir una meta (se salta con “Reducir movimiento” o con los íconos quietos)
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || (typeof iconMotion != 'undefined' && iconMotion == 'off')) return;
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const cols = ['var(--brand)', 'var(--pink)', 'var(--yellow)', 'var(--teal)', 'var(--blue)', 'var(--in)'];
  box.innerHTML = [...Array(36)].map((_, i) => `<i style="--x:${Math.round(Math.random() * 100)}vw;--dx:${Math.round(Math.random() * 160 - 80)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--d:${(Math.random() * 0.35).toFixed(2)}s;--t:${(1.3 + Math.random() * 0.9).toFixed(2)}s;background:${cols[i % cols.length]}"></i>`).join('');
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
}
