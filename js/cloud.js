(window.__V = window.__V || {})['cloud.js'] = '8.0.1';
/* Mis finanzas — sincronización con Firebase (Auth + Firestore).
   Solo se activa si js/config.js tiene la configuración de tu proyecto. */
// Acepta window.FIREBASE_CONFIG = {...} o el bloque tal cual lo da Firebase: const firebaseConfig = {...};
const conf = window.FIREBASE_CONFIG || (typeof firebaseConfig != 'undefined' ? firebaseConfig : null);
const C = window.Cloud = { enabled: !!(conf && conf.apiKey && conf.projectId), ready: false, user: null, uid: null, hid: null, status: '', error: '', active: false, myName: '', members: [], names: {}, joinCode: null };
const notify = k => { try { window.onCloudChange && window.onCloudChange(k); } catch (e) { console.error(e); } };
const HID_KEY = 'fin_hid';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
const strip = o => JSON.parse(JSON.stringify(o ?? null));
const ERR = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Correo o contraseña incorrectos.', 'auth/user-not-found': 'No hay cuenta con ese correo. Toca “Crear cuenta”.',
  'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Toca “Entrar”.', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/invalid-email': 'Ese correo no es válido.',
  'auth/network-request-failed': 'Sin conexión a internet.', 'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.', 'unavailable': 'Sin conexión a internet.',
  'permission-denied': 'Sin permiso. Revisa el código, o publica las reglas nuevas de firestore.rules (ver README).', 'not-found': 'Ese código de hogar no existe.', 'auth/operation-not-allowed': 'Activa “Correo/contraseña” en Firebase Authentication (ver README).'
};
const msg = e => ERR[e && e.code] || (e && e.message) || String(e);

if (C.enabled) start().catch(e => { C.ready = true; C.error = 'No se pudo iniciar la nube: ' + msg(e); notify('state'); });

async function start() {
  const fb = await import('../vendor/firebase.js?v=8.0.1');
  const app = fb.initializeApp(conf);
  let auth; try { auth = fb.initializeAuth(app, { persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence] }); } catch (e) { auth = fb.getAuth(app); }
  let db; try { db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) }); } catch (e) { db = fb.initializeFirestore(app, {}); }

  let unsub = null, unsubH = null, firstSnap = true, mergeMode = null, localCfg = null;
  const itemRef = id => fb.doc(db, 'hogares', C.hid, 'items', id);
  const hogarRef = (hid = C.hid) => fb.doc(db, 'hogares', hid);
  const wrap = o => ({ ...o, by: C.uid });
  const fail = e => { console.error(e); C.error = msg(e); C.status = 'err'; notify('state'); };
  const toastErr = m => (window.toast ? window.toast(m, { kind: 'err' }) : alert(m));
  // Código para invitar: 8 caracteres fáciles de dictar (sin 0/O ni 1/I)
  const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8)); let s = ''; r.forEach((b, i) => { s += A[b % A.length]; if (i == 3) s += '-'; }); return s; };

  function stop() { if (unsub) { unsub(); unsub = null; } if (unsubH) { unsubH(); unsubH = null; } C.active = false; C.members = []; C.names = {}; C.joinCode = null; }
  function setStatus(meta) {
    C.status = !navigator.onLine ? 'off' : meta && meta.hasPendingWrites ? 'pend' : meta && meta.fromCache ? '' : 'ok';
    notify('status');
  }
  // Si te sacaron del hogar, las lecturas fallan por permisos
  function kicked() { stop(); C.hid = null; lsSet(HID_KEY, null); C.error = 'Ya no eres miembro de ese hogar. Tus datos siguen en este teléfono.'; fb.setDoc(fb.doc(db, 'users', C.uid), { hid: null }, { merge: true }).catch(() => { }); notify('state'); }
  function listen() {
    stop(); firstSnap = true; C.active = true;
    unsub = fb.onSnapshot(fb.collection(db, 'hogares', C.hid, 'items'), { includeMetadataChanges: true }, snap => {
      const ch = snap.docChanges().filter(c => c.type != 'removed').map(c => ({ id: c.doc.id, data: c.doc.data() }));
      if (ch.length) window.applyRemote(ch);
      if (firstSnap && !snap.metadata.fromCache) { firstSnap = false; afterFirst(snap); }
      setStatus(snap.metadata);
    }, e => (e && e.code == 'permission-denied' ? kicked() : fail(e)));
    unsubH = fb.onSnapshot(hogarRef(), snap => {
      if (!snap.exists()) return;
      const d = snap.data(), sig = JSON.stringify([d.members, d.names, d.joinCode]);
      if (C.uid && !(d.members || []).includes(C.uid)) return kicked();
      C.members = d.members || []; C.names = d.names || {}; C.joinCode = d.joinCode || null;
      if (C.myName && (!C.names[C.uid] || C.names[C.uid].name != C.myName)) C.setMyName(C.myName, true);
      if (sig != C._sig) { C._sig = sig; notify('state'); }
    }, e => (e && e.code == 'permission-denied' ? kicked() : console.warn(e)));
  }
  function afterFirst(snap) {
    const remote = new Map(snap.docs.map(d => [d.id, d.data()]));
    if (mergeMode == 'merge') {
      const up = window.getAllItems().filter(x => { const r = remote.get(x.id); return !r || (x.u || 0) > (r.u || 0) || ((x.del || 0) > (r.del || 0)); });
      if (up.length) C.pushItems(up);
      window.mergeCloudCfg(localCfg, remote.has('cfg'));
    } else if (!remote.has('cfg')) C.putCfg(window.currentCfg(), Date.now());
    mergeMode = null; localCfg = null;
    setTimeout(() => window.ensureMe && window.ensureMe(), 300);
  }
  async function bind(hid, mode) {
    const bound = lsGet(HID_KEY) == C.uid + ':' + hid;
    if (!mode) mode = bound ? 'resume' : (window.hasLocalData() ? ((await window.ask('Este teléfono tiene datos que no están en el hogar. ¿Los agregas al hogar o los descartas y usas solo los del hogar?', { title: 'Datos de este teléfono', ok: 'Agregarlos', cancel: 'Descartarlos' })) ? 'merge' : 'replace') : 'replace');
    if (mode == 'replace') window.resetLocalData();
    mergeMode = mode == 'merge' ? 'merge' : null; localCfg = mode == 'merge' ? window.currentCfg() : null;
    C.hid = hid; C.error = ''; lsSet(HID_KEY, C.uid + ':' + hid);
    listen(); notify('state');
  }

  fb.onAuthStateChanged(auth, async u => {
    stop(); C.ready = true; C.error = ''; C.user = u ? u.email : null; C.uid = u ? u.uid : null; C.hid = null;
    if (!u) { C.myName = ''; notify('state'); return; }
    notify('state');
    let hid = null, name = '';
    try { const s = await fb.getDoc(fb.doc(db, 'users', u.uid)); if (s.exists()) { hid = s.data().hid || null; name = s.data().name || ''; } }
    catch (e) { const b = lsGet(HID_KEY); if (b && b.startsWith(u.uid + ':')) hid = b.slice(u.uid.length + 1); } // sin internet: usa el último hogar
    C.myName = name || lsGet('fin_me') || '';
    if (C.myName) lsSet('fin_me', C.myName);
    if (hid) await bind(hid); else notify('state');
  });
  addEventListener('online', () => setStatus(null));
  addEventListener('offline', () => setStatus(null));

  Object.assign(C, {
    async signIn(e, p) { C.error = ''; try { await fb.signInWithEmailAndPassword(auth, e, p); } catch (x) { C.error = msg(x); notify('state'); } },
    async signUp(e, p) { C.error = ''; try { await fb.createUserWithEmailAndPassword(auth, e, p); } catch (x) { C.error = msg(x); notify('state'); } },
    async resetPw(e) { try { await fb.sendPasswordResetEmail(auth, e); window.toast('Te enviamos un correo para cambiar la contraseña (revisa también spam).', { kind: 'ok', ms: 6000 }); } catch (x) { toastErr(msg(x)); } },
    async signOut() { if (!(await window.ask('Los datos se quedan en este teléfono pero dejan de sincronizarse.', { title: '¿Cerrar sesión?', ok: 'Cerrar sesión' }))) return; stop(); lsSet(HID_KEY, null); await fb.signOut(auth); },
    // Tu nombre: se guarda en tu perfil y en el hogar (para la lista de miembros)
    async setMyName(name, quiet) {
      C.myName = name; lsSet('fin_me', name);
      try {
        await fb.setDoc(fb.doc(db, 'users', C.uid), { name }, { merge: true });
        if (C.hid) await fb.updateDoc(hogarRef(), { ['names.' + C.uid]: { name, email: C.user || '' } });
      } catch (e) { if (!quiet) console.warn(e); }
    },
    async createHousehold() {
      if (!navigator.onLine) return toastErr('Necesitas internet para crear el hogar.');
      try {
        const ref = fb.doc(fb.collection(db, 'hogares')), code = newCode();
        await fb.setDoc(ref, { members: [C.uid], createdBy: C.uid, createdAt: fb.serverTimestamp(), joinCode: code, names: { [C.uid]: { name: C.myName || '', email: C.user || '' } } });
        await fb.setDoc(fb.doc(db, 'invites', code), { hid: ref.id, by: C.uid });
        await fb.setDoc(fb.doc(db, 'users', C.uid), { hid: ref.id }, { merge: true });
        C.hid = ref.id; lsSet(HID_KEY, C.uid + ':' + ref.id);
        C.pushItems(window.getAllItems()); C.putCfg(window.currentCfg(), Date.now());
        mergeMode = null; listen(); notify('state'); window.toast && window.toast('Hogar creado. Comparte el código con tu pareja.', { kind: 'ok' });
      } catch (e) { fail(e); }
    },
    // Acepta el código nuevo (K7P2-9QXM) o el antiguo (el identificador largo del hogar)
    async joinHousehold(input, mode) {
      const raw = String(input || '').trim(), up = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!navigator.onLine) return toastErr('Necesitas internet para unirte al hogar.');
      try {
        let hid;
        if (up.length == 8) {
          const code = up.slice(0, 4) + '-' + up.slice(4), inv = await fb.getDoc(fb.doc(db, 'invites', code));
          if (!inv.exists()) return toastErr('Ese código no existe o ya fue cambiado. Pide el código actual.');
          hid = inv.data().hid;
          await fb.updateDoc(hogarRef(hid), { members: fb.arrayUnion(C.uid), joinWith: code + ':' + C.uid });
        } else if (/^[A-Za-z0-9]{15,40}$/.test(raw)) {
          hid = raw;
          await fb.updateDoc(hogarRef(hid), { members: fb.arrayUnion(C.uid) });
        } else return toastErr('Ese código no tiene el formato correcto. Cópialo de nuevo desde Ajustes en el otro teléfono.');
        await fb.setDoc(fb.doc(db, 'users', C.uid), { hid }, { merge: true });
        await bind(hid, mode);
        if (C.myName) C.setMyName(C.myName, true);
        window.toast && window.toast('¡Listo! Ya estás en el hogar.', { kind: 'ok' });
      } catch (e) { fail(e); }
    },
    async regenerateCode() {
      if (!navigator.onLine) return toastErr('Necesitas internet para cambiar el código.');
      try {
        const code = newCode(), old = C.joinCode;
        await fb.setDoc(fb.doc(db, 'invites', code), { hid: C.hid, by: C.uid });
        await fb.updateDoc(hogarRef(), { joinCode: code });
        if (old) await fb.deleteDoc(fb.doc(db, 'invites', old)).catch(() => { });
        window.toast('Código nuevo listo. El anterior ya no sirve.', { kind: 'ok' });
      } catch (e) { fail(e); }
    },
    async removeMember(uid) {
      try { await fb.updateDoc(hogarRef(), { members: fb.arrayRemove(uid), ['names.' + uid]: fb.deleteField() }); window.toast('Persona sacada del hogar', { kind: 'ok' }); }
      catch (e) { fail(e); }
    },
    async leaveHousehold() {
      const hid = C.hid, uid = C.uid; stop(); C.hid = null; lsSet(HID_KEY, null); notify('state');
      try { await fb.setDoc(fb.doc(db, 'users', uid), { hid: null }, { merge: true }); await fb.updateDoc(hogarRef(hid), { members: fb.arrayRemove(uid), ['names.' + uid]: fb.deleteField() }); } catch (e) { console.warn(e); }
    },
    // Escrituras: no se esperan; Firestore las guarda y las envía cuando haya internet.
    put(k, obj) { if (!C.hid) return; const { id, del, ...d } = obj; fb.setDoc(itemRef(id), wrap({ k, u: obj.u || obj.createdAt || Date.now(), del: null, d: strip(d) })).catch(fail); },
    // Al borrar se guarda una copia (para la papelera de 30 días en todos los teléfonos)
    del(k, obj, ts) { if (!C.hid) return; const { id, del, ...d } = obj; fb.setDoc(itemRef(id), wrap({ k, u: ts, del: ts, d: strip(d) })).catch(fail); },
    putCfg(cfg, t) { if (!C.hid) return; fb.setDoc(itemRef('cfg'), wrap({ k: 'cfg', u: t || Date.now(), del: null, d: strip(cfg) })).catch(fail); },
    pushItems(list) {
      if (!C.hid) return;
      for (let i = 0; i < list.length; i += 400) {
        const b = fb.writeBatch(db);
        list.slice(i, i + 400).forEach(x => b.set(itemRef(x.id), wrap({ k: x.k, u: x.u || Date.now(), del: x.del || null, d: x.d ?? null })));
        b.commit().catch(fail);
      }
    },
    wipeAll(list) { const t = Date.now(); C.pushItems(list.map(x => ({ ...x, u: t, del: t, d: x.k == 'tx' ? x.d : null }))); }
  });
}
