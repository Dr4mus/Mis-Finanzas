/* Service worker: permite abrir la app sin internet. Sube CACHE al publicar una versión nueva. */
const CACHE = 'mis-finanzas-v5.0.0';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/core.js', 'js/views.js', 'js/sync-ui.js', 'js/cloud.js',
  'vendor/chart.umd.js', 'vendor/firebase.js', 'vendor/xlsx.mini.min.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k != CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data == 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method != 'GET') return;
  if (u.origin == location.origin) {
    // Primero la red (para tener siempre lo último); si no hay internet, la copia guardada.
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode == 'navigate' ? caches.match('index.html') : Response.error()))));
  } else if (u.hostname.endsWith('fonts.googleapis.com') || u.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })));
  }
  // Firebase y demás: sin interceptar (Firestore maneja su propio modo sin conexión).
});
