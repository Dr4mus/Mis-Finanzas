/* Configuración de Firebase para la sincronización en la nube.
   Déjalo en null para usar la app solo en este dispositivo.
   Para activarla, reemplaza null por el objeto que te da Firebase (ver README, "Configurar Firebase"), por ejemplo:

window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "mis-finanzas-xxxx.firebaseapp.com",
  projectId: "mis-finanzas-xxxx",
  storageBucket: "mis-finanzas-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};

   Estos datos no son secretos: la seguridad la ponen las reglas de firestore.rules. */
window.FIREBASE_CONFIG = null;
