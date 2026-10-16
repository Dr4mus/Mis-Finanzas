/* Service worker: permite abrir la app sin internet.
   Siempre pregunta primero al servidor por la versión más nueva (sin usar copias viejas del navegador);
   solo si no hay internet usa la copia guardada. Sube CACHE al publicar una versión nueva. */
const CACHE = 'mis-finanzas-v8.0.1';
const SHELL = ['./', 'index.html', 'css/app.css', 'css/marca.css', 'js/config.js', 'js/marca.js', 'js/core.js', 'js/ui.js', 'js/screens.js', 'js/forms.js', 'js/plan.js', 'js/extras.js', 'js/lock.js', 'js/sync-ui.js', 'js/cloud.js',
  'vendor/chart.umd.js', 'vendor/firebase.js', 'vendor/xlsx.mini.min.js', 'manifest.webmanifest', 'icons/favicon.png', 'icons/escudo.webp', 'icons/escudo-mini.webp', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok && c.put(u, r)).catch(() => { }))))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k != CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data == 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method != 'GET') return;
  if (u.origin == location.origin) {
    e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(new Request(u.origin + u.pathname), cp)); } return r; })
      .catch(() => caches.match(new Request(u.origin + u.pathname)).then(r => r || caches.match(e.request, { ignoreSearch: true }))
        .then(r => r || (e.request.mode == 'navigate' ? caches.match('index.html').then(x => x || caches.match('./')) : Response.error()))));
  } else if (u.hostname.endsWith('fonts.googleapis.com') || u.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })));
  }
});
