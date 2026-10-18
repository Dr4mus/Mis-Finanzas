'use strict';
(window.__V = window.__V || {})['lock.js'] = '10.1.0';
/* Mis finanzas — bloqueo con PIN y Face ID / huella (WebAuthn del propio teléfono).
   Es un bloqueo local de la app en este teléfono; los datos de la nube además requieren tu cuenta. */
const LOCK = { key: 'fin_pin', bio: 'fin_bio', after: 'fin_lock_after' };
const lsJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const lockCfg = () => lsJSON(LOCK.key);
const bioId = () => { try { return localStorage.getItem(LOCK.bio); } catch (e) { return null; } };
const lockAfter = () => { try { const v = localStorage.getItem(LOCK.after); return v == null ? 60 : +v; } catch (e) { return 60; } };
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const rand = n => crypto.getRandomValues(new Uint8Array(n));
async function hashPin(pin, salt) { return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))); }

let lockEntry = '', lockFails = 0, lockUntil = 0, hiddenAt = 0, BIO_OK = null, bioBusy = false, bioTried = false;
const isLocked = () => !$('lock').hidden;
function showLock() {
  if (!lockCfg()) return;
  if (dlg.open) dlg.close();
  document.documentElement.classList.add('locked');
  $('lock').hidden = false; lockEntry = ''; bioTried = false; drawLock();
  setTimeout(autoBio, 350);
}
// Pide Face ID / huella sola al abrir o al volver a la app (Android, y iPhone con iOS 16 o más nuevo).
// Si el teléfono no lo permite sin un toque, queda el botón grande "Desbloquear con Face ID / huella".
function autoBio() {
  if (!bioId() || !isLocked() || bioBusy || bioTried || document.visibilityState != 'visible') return;
  bioTried = true; bioUnlock(true);
}
function drawLock(msg, shake) {
  const c = lockCfg(), L = c ? c.len : 4;
  $('lock').innerHTML = `<img src="icons/escudo.webp" alt=""><h2>Mis finanzas</h2>
<p class="mut" style="margin:0;min-height:20px">${msg || (bioId() ? 'Usa Face ID / huella o escribe tu PIN' : 'Escribe tu PIN')}</p>
${bioId() ? `<button class="p biobtn" onclick="bioUnlock()"><i class="icon-scan-face"></i> Desbloquear con Face ID / huella</button>` : ''}
<div class="dots${shake ? ' shake' : ''}">${[...Array(L)].map((_, i) => `<span class="${i < lockEntry.length ? 'f' : ''}"></span>`).join('')}</div>
<div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button onclick="lockKey('${n}')">${n}</button>`).join('')}
${bioId() ? `<button class="ghost" onclick="bioUnlock()" aria-label="Face ID o huella"><i class="icon-scan-face" style="font-size:30px"></i></button>` : '<span></span>'}
<button onclick="lockKey('0')">0</button><button class="ghost" aria-label="Borrar" onclick="lockKey('del')"><i class="icon-delete" style="font-size:24px"></i></button></div>`;
}
async function lockKey(k) {
  if (Date.now() < lockUntil) return drawLock(`Demasiados intentos. Espera ${Math.ceil((lockUntil - Date.now()) / 1000)} s`);
  const c = lockCfg(); if (!c) return unlock();
  if (k == 'del') { lockEntry = lockEntry.slice(0, -1); return drawLock(); }
  if (lockEntry.length >= c.len) return;
  lockEntry += k; drawLock();
  if (lockEntry.length < c.len) return;
  if (await hashPin(lockEntry, c.salt) == c.hash) return unlock();
  lockFails++; lockEntry = '';
  if (lockFails >= 5) { lockUntil = Date.now() + 30000; lockFails = 0; return drawLock('Demasiados intentos. Espera 30 s', true); }
  drawLock('PIN incorrecto', true);
}
function unlock() { $('lock').hidden = true; document.documentElement.classList.remove('locked'); lockEntry = ''; lockFails = 0; }
async function bioUnlock(auto) {
  const id = bioId(); if (!id || !isLocked() || bioBusy) return;
  bioBusy = true;
  try {
    await navigator.credentials.get({ publicKey: { challenge: rand(32), allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal', 'hybrid'] }], userVerification: 'required', timeout: 60000 } });
    unlock();
  } catch (e) { if (isLocked()) drawLock(auto ? 'Toca el botón para usar Face ID / huella, o escribe tu PIN' : 'No se pudo. Inténtalo otra vez o usa tu PIN'); }
  finally { bioBusy = false; }
}
async function bioAvailable() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } }
async function enrollBio() {
  try {
    const cred = await navigator.credentials.create({ publicKey: { challenge: rand(32), rp: { name: 'Mis finanzas', id: location.hostname }, user: { id: rand(16), name: 'Mis finanzas', displayName: 'Mis finanzas' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } });
    localStorage.setItem(LOCK.bio, b64(cred.rawId)); render(); toast('Face ID / huella activado', { kind: 'ok' });
  } catch (e) { fail(e && e.name == 'NotAllowedError' ? 'Se canceló. Inténtalo de nuevo.' : 'Este teléfono o navegador no permitió activar Face ID / huella.'); }
}
function removeBio() { try { localStorage.removeItem(LOCK.bio); } catch (e) { } render(); toast('Face ID / huella desactivado'); }
function openPinSetup() {
  dlg.innerHTML = `<form onsubmit="return savePin(event)"><h2>${lockCfg() ? 'Cambiar' : 'Crear'} PIN</h2>
<p class="mini" style="margin:0">De 4 a 6 números. Se guarda solo en este teléfono (cifrado).</p>
<input id="p1" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required placeholder="Nuevo PIN" autocomplete="new-password" aria-label="Nuevo PIN">
<input id="p2" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required placeholder="Repite el PIN" autocomplete="new-password" aria-label="Repite el PIN">
<div class="seg"><button type="button" onclick="dlg.close()">Cancelar</button><button class="p">Guardar</button></div></form>`;
  dlgShow(); setTimeout(() => $('p1') && $('p1').focus(), 60);
}
async function savePin(e) {
  e.preventDefault(); const a = $('p1').value, b = $('p2').value;
  if (!/^\d{4,6}$/.test(a)) return fail('El PIN debe tener de 4 a 6 números.');
  if (a != b) return fail('Los dos PIN no coinciden.');
  const salt = b64(rand(16));
  localStorage.setItem(LOCK.key, JSON.stringify({ salt, hash: await hashPin(a, salt), len: a.length }));
  dlg.close(); render(); toast('PIN activado', { kind: 'ok' }); return false;
}
async function removePin() {
  if (!(await ask('La app ya no pedirá PIN ni Face ID / huella al abrirla.', { title: '¿Quitar el bloqueo?', ok: 'Quitar', danger: true }))) return;
  localStorage.removeItem(LOCK.key); localStorage.removeItem(LOCK.bio); render(); toast('Bloqueo desactivado');
}
function setLockAfter(v) { try { localStorage.setItem(LOCK.after, v); } catch (e) { } toast('Guardado', { kind: 'ok' }); }
function securitySection() {
  const c = lockCfg(), bio = bioId();
  return `<div class="card"><h2><i class="icon-lock"></i> Seguridad y privacidad</h2>
<div class="row"><div><b>Bloqueo con PIN</b><small>${c ? 'Activado en este teléfono' : 'Pide un PIN al abrir la app'}</small></div>${c ? `<button onclick="openPinSetup()">Cambiar</button><button class="d" onclick="removePin()">Quitar</button>` : `<button class="p" onclick="openPinSetup()">Activar</button>`}</div>
${c ? `<div class="row"><div><b>Face ID / huella</b><small>${BIO_OK === false && !bio ? 'No disponible en este teléfono o navegador' : bio ? 'Activado' : 'Desbloquea sin escribir el PIN'}</small></div>${bio ? `<button class="d" onclick="removeBio()">Quitar</button>` : BIO_OK ? `<button class="p" onclick="enrollBio()">Activar</button>` : ''}</div>
<div class="row"><div><b>Bloquear al salir</b><small>Tiempo fuera de la app</small></div><select style="width:auto;flex:none" onchange="setLockAfter(this.value)">${[[0, 'Al instante'], [60, '1 minuto'], [300, '5 minutos'], [900, '15 minutos'], [1800, '30 minutos'], [3600, '1 hora']].map(([v, l]) => `<option value="${v}"${lockAfter() == v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
<button class="link" onclick="showLock()"><i class="icon-lock"></i> Bloquear ahora</button>` : ''}
<div class="row"><div><b>Ocultar montos</b><small>Esconde las cifras; también con el ojo de arriba</small></div><label class="toggle"><input type="checkbox" ${HIDE ? 'checked' : ''} onchange="toggleHide()" aria-label="Ocultar montos"></label></div>
<p class="mini" style="margin:6px 0 0">El bloqueo protege la app en este teléfono. Tus datos en la nube, además, solo se abren con tu correo y contraseña.</p></div>`;
}
document.addEventListener('visibilitychange', () => {
  if (!lockCfg()) return;
  if (document.hidden) { hiddenAt = Date.now(); if (lockAfter() == 0) showLock(); }
  else if (hiddenAt && Date.now() - hiddenAt >= lockAfter() * 1000 && !isLocked()) showLock();
  else if (isLocked()) { bioTried = false; setTimeout(autoBio, 350); } // volvió a la app con la pantalla bloqueada
});
document.addEventListener('keydown', e => { if (!isLocked()) return; if (/^\d$/.test(e.key)) lockKey(e.key); else if (e.key == 'Backspace') lockKey('del'); });
bioAvailable().then(v => { BIO_OK = v; if (tab == 'set') render(); });
if (lockCfg()) showLock(); else document.documentElement.classList.remove('locked');
