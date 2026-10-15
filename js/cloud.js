/* Mis finanzas — sincronización con Firebase (Auth + Firestore).
   Solo se activa si js/config.js tiene la configuración de tu proyecto. */
const conf = window.FIREBASE_CONFIG;
const C = window.Cloud = { enabled: !!(conf && conf.apiKey && conf.projectId), ready: false, user: null, uid: null, hid: null, status: '', error: '', active: false };
const notify = k => { try { window.onCloudChange && window.onCloudChange(k); } catch (e) { console.error(e); } };
const HID_KEY = 'fin_hid';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
const strip = o => JSON.parse(JSON.stringify(o ?? null));
const ERR = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Correo o contraseña incorrectos.', 'auth/user-not-found': 'No hay cuenta con ese correo. Toca “Crear cuenta”.',
  'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Toca “Entrar”.', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/invalid-email': 'Ese correo no es válido.',
  'auth/network-request-failed': 'Sin conexión a internet.', 'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.', 'unavailable': 'Sin conexión a internet.',
  'permission-denied': 'Código de hogar no válido, o no tienes permiso.', 'not-found': 'Ese código de hogar no existe.', 'auth/operation-not-allowed': 'Activa “Correo/contraseña” en Firebase Authentication (ver README).'
};
const msg = e => ERR[e && e.code] || (e && e.message) || String(e);

if (C.enabled) start().catch(e => { C.ready = true; C.error = 'No se pudo iniciar la nube: ' + msg(e); notify('state'); });

async function start() {
  const fb = await import('../vendor/firebase.js');
  const app = fb.initializeApp(conf);
  let auth; try { auth = fb.initializeAuth(app, { persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence] }); } catch (e) { auth = fb.getAuth(app); }
  let db; try { db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) }); } catch (e) { db = fb.initializeFirestore(app, {}); }

  let unsub = null, firstSnap = true, mergeMode = null, localCfg = null;
  const itemRef = id => fb.doc(db, 'hogares', C.hid, 'items', id);
  const wrap = o => ({ ...o, by: C.uid });
  const fail = e => { console.error(e); C.error = msg(e); C.status = 'err'; notify('state'); };

  function stop() { if (unsub) { unsub(); unsub = null; } C.active = false; }
  function setStatus(meta) {
    C.status = !navigator.onLine ? 'off' : meta && meta.hasPendingWrites ? 'pend' : meta && meta.fromCache ? '' : 'ok';
    notify('status');
  }
  function listen() {
    stop(); firstSnap = true; C.active = true;
    unsub = fb.onSnapshot(fb.collection(db, 'hogares', C.hid, 'items'), { includeMetadataChanges: true }, snap => {
      const ch = snap.docChanges().filter(c => c.type != 'removed').map(c => ({ id: c.doc.id, data: c.doc.data() }));
      if (ch.length) window.applyRemote(ch);
      if (firstSnap && !snap.metadata.fromCache) { firstSnap = false; afterFirst(snap); }
      setStatus(snap.metadata);
    }, fail);
  }
  // Al unirse con datos propios: sube lo que la nube no tiene o tiene más viejo, y une categorías/personas.
  function afterFirst(snap) {
    const remote = new Map(snap.docs.map(d => [d.id, d.data()]));
    if (mergeMode == 'merge') {
      const up = window.getAllItems().filter(x => { const r = remote.get(x.id); return !r || (x.u || 0) > (r.u || 0) || ((x.del || 0) > (r.del || 0)); });
      if (up.length) C.pushItems(up);
      window.mergeCloudCfg(localCfg, remote.has('cfg'));
    } else if (!remote.has('cfg')) C.putCfg(window.currentCfg(), Date.now());
    mergeMode = null; localCfg = null;
  }
  async function bind(hid, mode) {
    const bound = lsGet(HID_KEY) == C.uid + ':' + hid;
    if (!mode) mode = bound ? 'resume' : (window.hasLocalData() ? (confirm('Este dispositivo tiene datos que no están en el hogar.\n\nAceptar = agregarlos al hogar.\nCancelar = descartarlos y usar solo los del hogar.') ? 'merge' : 'replace') : 'replace');
    if (mode == 'replace') window.resetLocalData();
    mergeMode = mode == 'merge' ? 'merge' : null; localCfg = mode == 'merge' ? window.currentCfg() : null;
    C.hid = hid; C.error = ''; lsSet(HID_KEY, C.uid + ':' + hid);
    listen(); notify('state');
  }

  fb.onAuthStateChanged(auth, async u => {
    stop(); C.ready = true; C.error = ''; C.user = u ? u.email : null; C.uid = u ? u.uid : null; C.hid = null;
    if (!u) { notify('state'); return; }
    notify('state');
    let hid = null;
    try { const s = await fb.getDoc(fb.doc(db, 'users', u.uid)); hid = s.exists() ? s.data().hid || null : null; }
    catch (e) { const b = lsGet(HID_KEY); if (b && b.startsWith(u.uid + ':')) hid = b.slice(u.uid.length + 1); } // sin internet: usa el último hogar
    if (hid) await bind(hid); else notify('state');
  });
  addEventListener('online', () => setStatus(null));
  addEventListener('offline', () => setStatus(null));

  Object.assign(C, {
    async signIn(e, p) { C.error = ''; try { await fb.signInWithEmailAndPassword(auth, e, p); } catch (x) { C.error = msg(x); notify('state'); } },
    async signUp(e, p) { C.error = ''; try { await fb.createUserWithEmailAndPassword(auth, e, p); } catch (x) { C.error = msg(x); notify('state'); } },
    async resetPw(e) { try { await fb.sendPasswordResetEmail(auth, e); alert('Te enviamos un correo para cambiar la contraseña (revisa también spam).'); } catch (x) { alert(msg(x)); } },
    async signOut() { if (!confirm('¿Cerrar sesión? Los datos se quedan en este dispositivo pero dejan de sincronizarse.')) return; stop(); lsSet(HID_KEY, null); await fb.signOut(auth); },
    async createHousehold() {
      if (!navigator.onLine) return alert('Necesitas internet para crear el hogar.');
      try {
        const ref = fb.doc(fb.collection(db, 'hogares'));
        await fb.setDoc(ref, { members: [C.uid], createdBy: C.uid, createdAt: fb.serverTimestamp() });
        await fb.setDoc(fb.doc(db, 'users', C.uid), { hid: ref.id });
        C.hid = ref.id; lsSet(HID_KEY, C.uid + ':' + ref.id);
        C.pushItems(window.getAllItems()); C.putCfg(window.currentCfg(), Date.now());
        mergeMode = null; listen(); notify('state');
      } catch (e) { fail(e); }
    },
    async joinHousehold(code, mode) {
      if (!/^[A-Za-z0-9]{10,40}$/.test(code)) return alert('Ese código no tiene el formato correcto. Cópialo de nuevo desde Ajustes en el otro teléfono.');
      if (!navigator.onLine) return alert('Necesitas internet para unirte al hogar.');
      try {
        await fb.updateDoc(fb.doc(db, 'hogares', code), { members: fb.arrayUnion(C.uid) });
        await fb.setDoc(fb.doc(db, 'users', C.uid), { hid: code });
        await bind(code, mode);
      } catch (e) { fail(e); }
    },
    async leaveHousehold() {
      const hid = C.hid; stop(); C.hid = null; lsSet(HID_KEY, null); notify('state');
      try { await fb.setDoc(fb.doc(db, 'users', C.uid), { hid: null }); await fb.updateDoc(fb.doc(db, 'hogares', hid), { members: fb.arrayRemove(C.uid) }); } catch (e) { console.warn(e); }
    },
    // Escrituras: no se esperan; Firestore las guarda y las envía cuando haya internet.
    put(k, obj) { if (!C.hid) return; const { id, del, ...d } = obj; fb.setDoc(itemRef(id), wrap({ k, u: obj.u || obj.createdAt || Date.now(), del: null, d: strip(d) })).catch(fail); },
    del(k, obj, ts) { if (!C.hid) return; const { id, del, ...d } = obj; fb.setDoc(itemRef(id), wrap({ k, u: ts, del: ts, d: k == 'tx' ? strip(d) : null })).catch(fail); },
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
