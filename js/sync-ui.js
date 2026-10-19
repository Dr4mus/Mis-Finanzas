'use strict';
(window.__V = window.__V || {})['sync-ui.js'] = '10.2.0';
/* Mis finanzas — interfaz de la nube, aplicación de cambios remotos y arranque. */
const APP_VERSION = '10.2.0';
const KIND_KEY = { tx: 'txs', acc: 'accs', adj: 'adjs', rec: 'recs', goal: 'goals', debt: 'debts', asset: 'assets' };
const strip = o => JSON.parse(JSON.stringify(o)); // Firestore no acepta "undefined"

// Todo lo sincronizable como elementos {id, k, u, del, d}
function toItem(k, x, del) { const { id, ...d } = x; delete d.del; return { id, k, u: x.u || x.createdAt || 0, del: del || null, d: strip(d) }; }
function getAllItems() {
  const it = toItem;
  return [
    ...txs.map(x => it('tx', x)), ...trash.map(x => it('tx', x, x.del || 1)),
    ...accs.map(x => it('acc', x)), ...adjs.map(x => it('adj', x)), ...recs.map(x => it('rec', x)), ...goals.map(x => it('goal', x)),
    ...debts.map(x => it('debt', x)), ...assets.map(x => it('asset', x)),
    ...bin.map(x => ({ id: x.id, k: x.k, u: x.del, del: x.del, d: strip(x.d) }))
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
    const ru = data.u || 0, list0 = listOf(key);
    const cur = list0.find(x => x.id == id), inTrash = key == 'txs' && trash.find(x => x.id == id);
    if (data.del) {
      if ((dels[id] || 0) >= data.del && !cur) continue;
      if (cur && (cur.u || cur.createdAt || 0) > data.del) continue; // se restauró después
      dels[id] = data.del;
      const rest = list0.filter(x => x.id != id);
      if (key == 'txs') { txs = rest; if (data.d) { const t = cleanTx({ ...data.d, id }); if (t) trash = trash.filter(x => x.id != id).concat({ ...t, del: data.del }); } }
      else { assign(key, rest); if (data.d) bin = bin.filter(x => x.id != id).concat({ k: data.k, id, del: data.del, d: data.d }); }
      changed = true;
    } else {
      const lu = cur ? (cur.u || cur.createdAt || 0) : 0;
      if (cur && lu >= ru) continue; // ya lo tengo igual o más nuevo
      if (!cur && ((inTrash && (inTrash.del || 0) > ru) || (dels[id] || 0) > ru)) continue; // se borró después de esta versión
      if (key != 'txs') bin = bin.filter(x => x.id != id);
      let obj = { ...data.d, id };
      if (key == 'txs') { obj = cleanTx(obj); if (!obj) continue; trash = trash.filter(x => x.id != id); }
      else obj = (cleanState({ [key]: [obj] })[key] || [])[0];
      if (!obj) continue;
      assign(key, list0.filter(x => x.id != id).concat(obj));
      delete dels[id]; changed = true;
    }
  }
  if (changed) { purgeOld(); local(); render(); }
}
function assign(key, v) { if (key == 'txs') txs = v; else if (key == 'accs') accs = v; else if (key == 'adjs') adjs = v; else if (key == 'recs') recs = v; else if (key == 'debts') debts = v; else if (key == 'assets') assets = v; else goals = v; }
function listOf(key) { return { txs, accs, adjs, recs, goals, debts, assets }[key]; }

// Ayudantes que usa cloud.js
// Asegura que tu nombre esté en la lista de personas (tras unirte a un hogar)
function ensureMe() {
  const me = myPerson(); if (!me || cfg.people.includes(me)) return;
  const c = deep(cfg), ph = c.people.find(p => /^Persona \d$/.test(p) && !txs.some(x => x.w == p));
  if (ph) { c.people = c.people.map(p => p == ph ? me : p); recs.filter(r => r.w == ph).forEach(r => saveRec({ ...r, w: me }, { noRender: true })); }
  else c.people.push(me);
  saveCfg(c);
}
function hasLocalData() { return txs.length + trash.length + accs.length + goals.length + recs.length + adjs.length + debts.length + assets.length > 0; }
function resetLocalData() { setState({ cfg: fresh(), cfgT: 0, txs: [], accs: [], adjs: [], recs: [], goals: [], dels: {}, trash: [], bin: [], debts: [], assets: [] }); local(); render(); }
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
  const st = { ok: ['ok', 'Sincronizado'], pend: ['pend', 'Enviando…'], off: ['off', 'Sin conexión'], err: ['off', 'Error'] }[C.status] || ['', 'Conectando…'];
  return `<span class="sync ${st[0]}" role="button" onclick="setSub='nube';go('set')" title="Sincronización: ${st[1]}" aria-label="Sincronización: ${st[1]}"><i class="dot"></i><span class="stx">${st[1]}</span></span>`;
}
function cloudSection() {
  const C = window.Cloud;
  const head = '<h2><i class="icon-cloud"></i> Nube y hogar</h2>';
  if (!C || !C.enabled) {
    const bad = (window.__ERRS || []).find(e => /config\.js/.test(e)), missing = bad && /No se pudo cargar/.test(bad);
    const msg = !bad ? '' : missing ? `<p class="mini" style="margin:0 0 8px">Todavía no hay un archivo <code>js/config.js</code> en tu GitHub. Se crea en el paso “Conectar la app con tu Firebase” de la guía.</p>`
      : `<p class="warnline" style="margin:0 0 8px">Tu archivo <code>js/config.js</code> tiene un error: ${esc(bad)}. Copia solo el bloque <code>const firebaseConfig = { … };</code> de Firebase (sin las líneas <code>import</code>).</p>`;
    return `<div class="card">${head}${msg}<p class="mini" style="margin:0">Aún no está configurada: los datos se guardan solo en este teléfono. Para activarla, sigue la guía PDF (parte “Firebase”) y pega tu configuración en <code>js/config.js</code> en GitHub.</p></div>`;
  }
  if (!C.ready) return `<div class="card">${head}<p class="mini">Conectando…</p></div>`;
  const err = C.error ? `<p class="warnline" style="margin:6px 0">${esc(C.error)}</p>` : '';
  if (!C.user) return `<div class="card">${head}<p class="mini" style="margin:0 0 8px">Entra con tu correo. Cada uno usa su propia cuenta y luego se unen al mismo hogar.</p>${err}
<form onsubmit="return cloudAuth(event,'in')" style="display:grid;gap:8px">
<label>Correo<input type="email" id="ce" required autocomplete="email"></label>
<label>Contraseña (mínimo 6 caracteres)<input type="password" id="cpw" required minlength="6" autocomplete="current-password"></label>
<div class="seg"><button class="p">Entrar</button><button type="button" onclick="cloudAuth(event,'up')">Crear cuenta</button></div>
<button type="button" class="link" onclick="cloudReset()">Olvidé mi contraseña</button></form></div>`;
  const nameRow = `<label>Tu nombre en la app (se elige solo en “Quién”)<div class="add"><input id="myname" value="${esc(C.myName || '')}" placeholder="Ej: Tomas" autocomplete="given-name"><button onclick="saveMyName()">Guardar</button></div></label>`;
  if (!C.hid) return `<div class="card">${head}<p class="mini" style="margin:0 0 8px">Conectado como <b>${esc(C.user)}</b>. Crea un hogar (la primera persona) o únete al de tu pareja con su código.</p>${err}${nameRow}
<button class="p" style="margin-top:10px;width:100%" onclick="cloudCreate()">Crear hogar con mis datos</button>
<div class="add" style="margin-top:10px"><input id="hcode" placeholder="Código, ej: K7P2-9QXM" autocapitalize="characters" autocorrect="off"><button onclick="cloudJoin()">Unirme</button></div>
<button class="link" style="margin-top:6px" onclick="window.Cloud.signOut()">Cerrar sesión</button></div>`;
  const members = (C.members || []).map(uid => { const n = (C.names || {})[uid] || {}; return `<div class="row"><div class="circ tint" style="--c:var(--${accentFor(n.name || uid)})"><i class="icon-user"></i></div><div><b>${esc(n.name || 'Sin nombre')}${uid == C.uid ? ' ' + pill('tú') : ''}</b><small>${esc(n.email || '')}</small></div>${uid != C.uid ? `<button class="d" onclick="cloudKick('${esc(uid)}')">Sacar</button>` : ''}</div>`; }).join('');
  const code = C.joinCode || C.hid, legacy = !C.joinCode;
  return `<div class="card">${head}<p style="margin:0 0 6px">${syncBadge()}</p><p class="mini" style="margin:0 0 10px">Conectado como <b>${esc(C.user)}</b>. Los cambios llegan a los demás teléfonos al instante; sin internet se envían cuando vuelva.</p>${err}
${nameRow}
<h2 style="margin-top:14px"><i class="icon-users"></i> Miembros del hogar</h2>${members || '<p class="mini">Cargando…</p>'}
<p class="mini" style="margin:12px 0 4px">Código para invitar (compártelo solo con quien quieras agregar):</p><div class="code">${esc(code)}</div>
${legacy ? '<p class="warnline" style="margin-top:6px">Este es el código antiguo y no se puede cambiar. Genera uno nuevo: el antiguo dejará de servir.</p>' : ''}
<div class="add" style="margin-top:8px;flex-wrap:wrap"><button onclick="copyText(window.Cloud.joinCode||window.Cloud.hid,'Código copiado')"><i class="icon-copy"></i> Copiar</button><button onclick="cloudRegen()"><i class="icon-refresh"></i> Código nuevo</button></div>
<div class="add" style="margin-top:8px;flex-wrap:wrap"><button class="link" onclick="cloudLeave()">Salir del hogar</button><button class="link" onclick="window.Cloud.signOut()">Cerrar sesión</button></div></div>`;
}
function copyText(t, msg) { try { navigator.clipboard.writeText(t).then(() => toast(msg, { kind: 'ok' }), () => prompt('Copia este texto:', t)); } catch (e) { prompt('Copia este texto:', t); } }
async function cloudAuth(e, mode) {
  e.preventDefault(); const em = $('ce').value.trim(), pw = $('cpw').value;
  if (!em || pw.length < 6) return fail('Escribe tu correo y una contraseña de al menos 6 caracteres.');
  await window.Cloud[mode == 'up' ? 'signUp' : 'signIn'](em, pw); return false;
}
async function cloudReset() { const em = ($('ce') || {}).value; if (!em) return fail('Escribe tu correo arriba y vuelve a tocar “Olvidé mi contraseña”.'); await window.Cloud.resetPw(em.trim()); }
async function cloudCreate() { if (await ask('Se creará un hogar nuevo y se subirán los datos de este teléfono.', { title: '¿Crear hogar?', ok: 'Crear' })) await window.Cloud.createHousehold(); }
async function cloudJoin() {
  const code = ($('hcode').value || '').trim(); if (!code) return fail('Pega el código del hogar.');
  let mode = 'replace';
  if (hasLocalData()) mode = (await ask('Este teléfono ya tiene datos. ¿Los agregas al hogar (se suman a los de tu pareja) o los descartas y usas solo los del hogar?', { title: 'Datos de este teléfono', ok: 'Agregarlos', cancel: 'Descartarlos' })) ? 'merge' : 'replace';
  await window.Cloud.joinHousehold(code, mode);
}
async function cloudLeave() { if (await ask('Este teléfono dejará de sincronizarse. Tus datos se quedan aquí y en la nube.', { title: '¿Salir del hogar?', ok: 'Salir' })) await window.Cloud.leaveHousehold(); }
async function cloudRegen() { if (await ask('El código actual dejará de funcionar y se creará uno nuevo. Quien ya es miembro no se ve afectado.', { title: '¿Generar código nuevo?', ok: 'Generar' })) await window.Cloud.regenerateCode(); }
async function cloudKick(uid) { const n = ((window.Cloud.names || {})[uid] || {}).name || 'esta persona'; if (await ask(`${n} dejará de ver y editar los datos del hogar. Te recomendamos generar un código nuevo después.`, { title: '¿Sacar del hogar?', ok: 'Sacar', danger: true })) await window.Cloud.removeMember(uid); }
async function saveMyName() {
  const n = ($('myname').value || '').trim(); if (!n) return fail('Escribe tu nombre.');
  // Si ya había un nombre (o el genérico "Persona 1"), ofrece reemplazarlo en todos los movimientos
  const old = myPerson() && cfg.people.includes(myPerson()) ? myPerson() : (cfg.people.find(p => /^Persona \d$/.test(p)) || '');
  if (old && old != n && !cfg.people.includes(n) && await ask(`¿Cambiar “${old}” por “${n}” en todos los movimientos?`, { title: 'Tu nombre', ok: 'Sí, cambiar', cancel: 'No, solo agregarlo' })) renamePerson(old, n);
  else if (!cfg.people.includes(n)) { const c = deep(cfg); c.people = [...c.people, n]; saveCfg(c, true); }
  setMyPerson(n); await window.Cloud.setMyName(n); render(); toast('Nombre guardado', { kind: 'ok' });
}
// 'status' solo actualiza las etiquetas (no borra lo que estés escribiendo); 'state' vuelve a dibujar.
window.onCloudChange = kind => {
  if (kind == 'status') { const h = syncBadge(); document.querySelectorAll('.sync').forEach(el => { el.outerHTML = h; }); if (h && !document.querySelector('.sync')) { const t = document.querySelector('#app .tools'); if (t) t.insertAdjacentHTML('afterbegin', h); } return; }
  const a = document.activeElement; if (a && /INPUT|TEXTAREA/.test(a.tagName) && $('app').contains(a) && a.id != 'q') return; // no interrumpir mientras escribes
  render();
};
window.ask = ask;

// ============ arranque ============
// Verifica que todos los archivos sean de la misma versión (evita la pantalla en blanco por archivos viejos)
(function boot() {
  const want = (document.querySelector('meta[name=app-version]') || {}).content || APP_VERSION;
  const bad = ['core.js', 'ui.js', 'screens.js', 'forms.js', 'plan.js', 'extras.js', 'iconos.js', 'deudas.js', 'herramientas.js', 'lock.js', 'sync-ui.js'].filter(f => window.__V[f] != want)
    .map(f => window.__V[f] ? `js/${f} es de la versión ${window.__V[f]} (se esperaba ${want})` : `js/${f} no cargó o es de una versión anterior`);
  if (bad.length) { window.__showFail('Hay archivos de versiones distintas', bad.concat(window.__ERRS)); return; }
  try { if (shouldWelcome()) tab = 'welcome'; applyTheme(); render(); window.__booted = true; }
  catch (e) { console.error(e); window.__showFail('La app no pudo arrancar', [String(e && e.message || e)].concat(window.__ERRS)); }
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state == 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva de la app', { action: 'Actualizar', ms: 20000, onAction: () => nw.postMessage('skip') }); });
    });
  }).catch(() => { });
  let reloaded = false; const hadController = !!navigator.serviceWorker.controller; // en la primera instalación no recarga
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
