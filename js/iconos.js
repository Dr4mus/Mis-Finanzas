'use strict';
(window.__V = window.__V || {})['iconos.js'] = '10.1.0';
/* Mis finanzas — Temas de íconos. Cada tema tiene un equivalente para TODOS los íconos de la app
   (lo revisa herramientas/temas_iconos.py). Lineal viene dentro de css/app.css; los demás se cargan
   solo si los eliges (css/iconos-<tema>.css). Todo se guarda solo en este teléfono, como la paleta. */
const ICON_THEMES = {
  lineal: { name: 'Lineal', desc: 'Trazo limpio' },
  suave: { name: 'Suave', desc: 'Redondeado y ligero' },
  relleno: { name: 'Relleno', desc: 'Sólido, con más peso' },
  duotono: { name: 'Duotono', desc: 'Dos tonos' },
  material: { name: 'Material', desc: 'Estilo Google' },
};
const ICON_SAMPLE = ['wallet', 'piggy-bank', 'shopping-cart', 'home', 'heart-pulse'];
const icGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const icSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
let iconTheme = ICON_THEMES[icGet('fin_icons', 'lineal')] ? icGet('fin_icons', 'lineal') : 'lineal';
let iconColor = icGet('fin_icolor', 'normal') == 'degradado' ? 'degradado' : 'normal';
// Movimiento: 'live' = siempre (cada ícono se mueve a su manera, de vez en cuando), 'tap' = solo al tocar y al cambiar de pantalla, 'off' = quietos
const MOTION = { live: 'Siempre', tap: 'Al tocar', off: 'Quietos' };
let iconMotion = (() => { const v = icGet('fin_imov', ''); return MOTION[v] ? v : icGet('fin_imotion', '') == '0' ? 'off' : 'live'; })();

const appVer = () => (document.querySelector('meta[name="app-version"]') || {}).content || '';
// Carga el CSS de un tema (una sola vez). Resuelve true si quedó listo.
function loadIconCss(t) {
  if (t == 'lineal' || !ICON_THEMES[t]) return Promise.resolve(true);
  const id = 'ic-css-' + t, ya = document.getElementById(id);
  if (ya) return ya.__p || Promise.resolve(true);
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.id = id; l.setAttribute('data-opt', '1'); l.href = 'css/iconos-' + t + '.css?v=' + appVer();
  l.__p = new Promise(ok => { l.onload = () => ok(true); l.onerror = () => { l.remove(); ok(false); }; });
  document.head.appendChild(l);
  return l.__p;
}
function applyIcons() {
  const c = document.documentElement.classList;
  Object.keys(ICON_THEMES).forEach(t => c.toggle('ic-' + t, t == iconTheme));
  c.toggle('ic-grad', iconColor == 'degradado');
  c.toggle('ic-anim', iconMotion != 'off');
  c.toggle('ic-live', iconMotion == 'live');
}
async function setIconTheme(t) {
  if (!ICON_THEMES[t] || t == iconTheme) return;
  if (!await loadIconCss(t)) return toast('No se pudo cargar ese tema. Revisa tu conexión e intenta de nuevo.', { kind: 'err' });
  iconTheme = t; icSet('fin_icons', t); applyIcons(); render();
  toast('Íconos: ' + ICON_THEMES[t].name, { kind: 'ok' });
}
function setIconColor(v) { iconColor = v == 'degradado' ? 'degradado' : 'normal'; icSet('fin_icolor', iconColor); applyIcons(); render(); }
function setIconMotion(v) { iconMotion = MOTION[v] ? v : v === true ? 'live' : v === false ? 'off' : 'live'; icSet('fin_imov', iconMotion); applyIcons(); render(); }

function iconThemeHTML() {
  Object.keys(ICON_THEMES).forEach(t => loadIconCss(t).then(ok => { if (!ok) { const b = document.querySelector(`.icopt[data-t="${t}"]`); if (b) b.classList.add('nocss'); } }));
  const samp = ICON_SAMPLE.map(i => `<i class="icon-${i}"></i>`).join('');
  return `<div class="card"><h2><i class="icon-sparkles"></i> Íconos</h2><p class="mini" style="margin:0 0 8px">Todos los temas tienen los mismos íconos, solo cambia el dibujo. Solo en este teléfono.</p>
<div class="icthemes">${Object.entries(ICON_THEMES).map(([id, t]) => `<button type="button" data-t="${id}" class="icopt icprev ic-${id}${iconTheme == id ? ' on' : ''}" aria-pressed="${iconTheme == id}" onclick="setIconTheme('${id}')"><span class="icsamp">${samp}</span><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div>
<small class="mut" style="display:block;margin:12px 0 6px">Color</small>
<div class="seg sm"><button type="button" class="${iconColor == 'normal' ? 'on' : ''}" onclick="setIconColor('normal')"><span class="circ tint mini-circ" style="--c:var(--blue)"><i class="icon-wallet"></i></span> Normal</button>
<button type="button" class="icgrad-prev ${iconColor == 'degradado' ? 'on' : ''}" onclick="setIconColor('degradado')"><span class="circ tint mini-circ" style="--c:var(--blue)"><i class="icon-wallet"></i></span> Degradado</button></div>
<small class="mut" style="display:block;margin:14px 0 6px">Movimiento</small>
<div class="seg sm">${Object.entries(MOTION).map(([k, l]) => `<button type="button" class="${iconMotion == k ? 'on' : ''}" onclick="setIconMotion('${k}')">${l}</button>`).join('')}</div>
<div class="mvdemo" aria-hidden="true">${['bell', 'wallet', 'heart-pulse', 'sparkles', 'chart-line', 'car', 'refresh'].map(i => `<i class="icon-${i}"></i>`).join('')}</div>
<p class="mini" style="margin:6px 0 0">${iconMotion == 'live' ? 'Cada ícono se mueve a su manera de vez en cuando: la campana suena, la cartera brinca, el corazón late.' : iconMotion == 'tap' ? 'Se mueven solo al tocarlos y al cambiar de pantalla.' : 'Los íconos no se mueven.'} Si tu teléfono tiene activado “Reducir movimiento”, no se mueven.</p></div>`;
}
applyIcons();
