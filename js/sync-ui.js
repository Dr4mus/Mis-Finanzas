'use strict';
/* Mis finanzas — interfaz de la nube, aplicación de cambios remotos y arranque. */
const APP_VERSION = '5.0.0';
const KIND_KEY = { tx: 'txs', acc: 'accs', adj: 'adjs', rec: 'recs', goal: 'goals' };
const strip = o => JSON.parse(JSON.stringify(o)); // Firestore no acepta "undefined"

// Todo lo sincronizable como elementos {id, k, u, del, d}
function getAllItems() {
  const it = (k, x, del) => { const { id, ...d } = x; delete d.del; return { id, k, u: x.u || x.createdAt || 0, del: del || null, d: strip(d) }; };
  return [
    ...txs.map(x => it('tx', x)), ...trash.map(x => it('tx', x, x.del || 1)),
    ...accs.map(x => it('acc', x)), ...adjs.map(x => it('adj', x)), ...recs.map(x => it('rec', x)), ...goals.map(x => it('goal', x))
  ];
}

// Aplica cambios que llegan de la nube (de otro dispositivo o el eco de los propios)
function applyRemote(list) {
  let changed = false;
  for (const { id, data } of list) {
    if (!data || !ID_RE.test(id)) continue;
    if (id == 'cfg') {
      if ((data.u || 0) > cfgT && data.d) { cfg = cleanState({ cfg: data.d }).cfg; cfgT = data.u; changed = true; }
      continue;
    }
    const key = KIND_KEY[data.k]; if (!key) continue;
    const ru = data.u || 0, list0 = { txs, accs, adjs, recs, goals }[key];
    const cur = list0.find(x => x.id == id), inTrash = key == 'txs' && trash.find(x => x.id == id);
    if (data.del) {
      if ((dels[id] || 0) >= data.del && !cur) continue;
      if (cur && (cur.u || cur.createdAt || 0) > data.del) continue; // se restauró después
      dels[id] = data.del;
      const rest = list0.filter(x => x.id != id);
      if (key == 'txs') { txs = rest; if (data.d) { const t = cleanTx({ ...data.d, id }); if (t) trash = trash.filter(x => x.id != id).concat({ ...t, del: data.del }); } }
      else assign(key, rest);
      changed = true;
    } else {
      const lu = cur ? (cur.u || cur.createdAt || 0) : 0;
      if (cur && lu >= ru) continue; // ya lo tengo igual o más nuevo
      if (!cur && inTrash && (inTrash.del || 0) > ru) continue;
      let obj = { ...data.d, id };
      if (key == 'txs') { obj = cleanTx(obj); if (!obj) continue; trash = trash.filter(x => x.id != id); }
      else obj = (cleanState({ [key]: [obj] })[key] || [])[0];
      if (!obj) continue;
      assign(key, list0.filter(x => x.id != id).concat(obj));
      delete dels[id]; changed = true;
    }
  }
  if (changed) { local(); render(); }
}
function assign(key, v) { if (key == 'txs') txs = v; else if (key == 'accs') accs = v; else if (key == 'adjs') adjs = v; else if (key == 'recs') recs = v; else goals = v; }

// Ayudantes que usa cloud.js
function hasLocalData() { return txs.length + trash.length + accs.length + goals.length + recs.length + adjs.length > 0; }
function resetLocalData() { setState({ cfg: fresh(), cfgT: 0, txs: [], accs: [], adjs: [], recs: [], goals: [], dels: {}, trash: [] }); local(); render(); }
function currentCfg() { return deep(cfg); }
function mergeCloudCfg(localCfg, remoteHas) {
  if (!localCfg) return;
  const merged = mergeCfg(cfg, localCfg, false);
  if (!remoteHas || JSON.stringify(merged) != JSON.stringify(cfg)) saveCfg(merged);
}

// ============ interfaz ============
function syncBadge() {
  const C = window.Cloud;
  if (!C || !C.enabled || !C.hid) return '';
  const st = { ok: ['ok', 'Sincronizado'], pend: ['pend', 'Enviando…'], off: ['off', 'Sin conexión: se enviará luego'], err: ['off', 'Error de sincronización'] }[C.status] || ['', 'Conectando…'];
  return `<span class="sync ${st[0]}" onclick="go('set')" title="Ver sincronización"><i class="dot"></i>${st[1]}</span>`;
}
function cloudSection() {
  const C = window.Cloud;
  const head = '<h2><i class="icon-repeat"></i> Sincronización en la nube</h2>';
  if (!C || !C.enabled) return `<div class="card">${head}<p class="mini" style="margin:0">Aún no está configurada. Los datos se guardan solo en este dispositivo. Para compartirlos con tu pareja en tiempo real, sigue la guía “Configurar Firebase” del README y pega tu configuración en <code>js/config.js</code>.</p></div>`;
  if (!C.ready) return `<div class="card">${head}<p class="mini">Conectando…</p></div>`;
  const err = C.error ? `<p class="warnline" style="margin:6px 0">${esc(C.error)}</p>` : '';
  if (!C.user) return `<div class="card">${head}<p class="mini" style="margin:0 0 8px">Entra con tu correo. Cada uno usa su propia cuenta y luego se unen al mismo hogar.</p>${err}
<form onsubmit="return cloudAuth(event,'in')" style="display:grid;gap:8px">
<label>Correo<input type="email" id="ce" required autocomplete="email"></label>
<label>Contraseña (mínimo 6 caracteres)<input type="password" id="cpw" required minlength="6" autocomplete="current-password"></label>
<div class="seg"><button class="p">Entrar</button><button type="button" onclick="cloudAuth(event,'up')">Crear cuenta</button></div>
<button type="button" onclick="cloudReset()" style="border:0;background:none;color:var(--mut);min-height:auto;padding:4px">Olvidé mi contraseña</button></form></div>`;
  if (!C.hid) return `<div class="card">${head}<p class="mini" style="margin:0 0 8px">Conectado como <b>${esc(C.user)}</b>. Ahora crea un hogar (la primera persona) o únete al de tu pareja con su código.</p>${err}
<button class="p" onclick="cloudCreate()">Crear hogar con mis datos</button>
<div class="add" style="margin-top:10px"><input id="hcode" placeholder="Código del hogar" autocapitalize="off" autocorrect="off"><button onclick="cloudJoin()">Unirme</button></div>
<button style="margin-top:10px" onclick="window.Cloud.signOut()">Cerrar sesión</button></div>`;
  return `<div class="card">${head}<p style="margin:0 0 6px">${syncBadge()}</p><p class="mini" style="margin:0 0 8px">Conectado como <b>${esc(C.user)}</b>. Los cambios llegan a los demás dispositivos del hogar al instante, y si no hay internet se envían cuando vuelva.</p>${err}
<p class="mini" style="margin:0 0 4px">Código del hogar (compártelo solo con tu pareja; con él puede unirse):</p><div class="code">${esc(C.hid)}</div>
<div class="add" style="margin-top:8px;flex-wrap:wrap"><button onclick="copyText(window.Cloud.hid,'Código copiado.')">Copiar código</button><button onclick="cloudLeave()">Salir del hogar</button><button onclick="window.Cloud.signOut()">Cerrar sesión</button></div></div>`;
}
function copyText(t, msg) { try { navigator.clipboard.writeText(t).then(() => alert(msg), () => prompt('Copia este texto:', t)); } catch (e) { prompt('Copia este texto:', t); } }
async function cloudAuth(e, mode) {
  e.preventDefault(); const em = $('ce').value.trim(), pw = $('cpw').value;
  if (!em || pw.length < 6) return alert('Escribe tu correo y una contraseña de al menos 6 caracteres.'), false;
  await window.Cloud[mode == 'up' ? 'signUp' : 'signIn'](em, pw); return false;
}
async function cloudReset() { const em = ($('ce') || {}).value; if (!em) return alert('Escribe tu correo arriba y vuelve a tocar “Olvidé mi contraseña”.'); await window.Cloud.resetPw(em.trim()); }
async function cloudCreate() { if (confirm('Se creará un hogar nuevo y se subirán los datos de este dispositivo. ¿Continuar?')) await window.Cloud.createHousehold(); }
async function cloudJoin() {
  const code = ($('hcode').value || '').trim(); if (!code) return alert('Pega el código del hogar.');
  const has = txs.length + accs.length + goals.length + recs.length > 0;
  let mode = 'replace';
  if (has) mode = confirm('Este dispositivo ya tiene datos.\n\nAceptar = agregarlos al hogar (se suman a los de tu pareja).\nCancelar = descartarlos y usar solo los del hogar.') ? 'merge' : 'replace';
  await window.Cloud.joinHousehold(code, mode);
}
async function cloudLeave() { if (confirm('Este dispositivo dejará de sincronizarse. Tus datos se quedan aquí y en la nube. ¿Salir del hogar?')) await window.Cloud.leaveHousehold(); }
// 'status' solo actualiza las etiquetas (no borra lo que estés escribiendo); 'state' vuelve a dibujar.
window.onCloudChange = kind => {
  if (kind == 'status') { const h = syncBadge(); document.querySelectorAll('.sync').forEach(el => { el.outerHTML = h; }); if (h && !document.querySelector('.sync')) { const t = document.querySelector('#app .top'); if (t) t.insertAdjacentHTML('beforeend', h); } return; }
  render();
};

// ============ arranque ============
applyTheme(); render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state == 'installed' && navigator.serviceWorker.controller && confirm('Hay una versión nueva de la app. ¿Actualizar ahora?')) { nw.postMessage('skip'); } });
    });
  }).catch(() => { });
  let reloaded = false; const hadController = !!navigator.serviceWorker.controller; // en la primera instalación no recarga
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
