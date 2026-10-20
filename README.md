# Mis finanzas · Vélez García

App de finanzas personales y de pareja: cuentas, movimientos, presupuesto, recurrentes, metas, gastos compartidos y planificación. Versión 10.3.0.

Se instala en el teléfono desde el navegador (sin tiendas de apps), funciona sin internet y, si conectas tu propio Firebase, se sincroniza entre los teléfonos del hogar.

**Las instrucciones completas están en la guía PDF que viene con este zip** (con la consola de Firebase en inglés y en español).

## Resumen

1. **GitHub:** sube todo el contenido de esta carpeta a tu repositorio y activa **Settings → Pages** (rama `main`, carpeta `/ (root)`).
2. **Firebase (opcional, para la nube):** crea tu proyecto, activa Email/Password, autoriza `TU-USUARIO.github.io`, crea Firestore (Standard, `(default)`, modo producción) y publica `firestore.rules`.
3. **Conecta:** en GitHub crea `js/config.js` y pega el bloque `const firebaseConfig = { … };` que te da Firebase.
4. **Instala** la app en el teléfono desde Safari (Compartir → Agregar a pantalla de inicio) o Chrome (⋮ → Instalar app).

## Actualizar

Sube el contenido del zip nuevo encima del anterior (**Add file → Upload files → Commit changes**). Los zips **nunca traen `js/config.js`**, así que tu conexión con Firebase no se borra. Luego abre la app y toca **Actualizar** cuando lo pida. En **Ajustes**, abajo, verás la versión.

## Qué hay en la versión 10.3.0

- **¿Te alcanza?** hasta tu próximo cobro, **saldo proyectado** a 30/60/90 días y **calendario de pagos** (Más → Planificar).
- **Comparado con tu promedio** por categoría (Inicio y Reportes).
- **Recordatorios en el calendario** del teléfono (archivo .ics).
- **Atajos** de movimientos frecuentes, **Inicio personalizable**, **bienvenida guiada**, **papelera** de 30 días y **recordatorio de respaldo** mensual.

## Estructura

```
index.html            la página
css/app.css           estilos e íconos
css/marca.css         paleta del escudo (cambia según la versión)
js/marca.js           nombre y paleta del escudo (cambia según la versión)
js/core.js            datos y cálculos (saldos, presupuesto, recurrentes, metas, tarjetas, planificación)
js/ui.js              avisos, acciones (guardar, borrar, restaurar) y navegación
js/screens.js         pantallas principales
js/forms.js           formularios, categorías, respaldo y Excel
js/plan.js            Planificar: te alcanza, proyección, promedio, calendario y recordatorios
js/extras.js          atajos, Inicio personalizable, bienvenida, papelera y respaldo mensual
js/lock.js            PIN y Face ID / huella
js/sync-ui.js         pantalla de la nube y arranque
js/cloud.js           conexión con Firebase
js/config.js          tu configuración de Firebase (lo creas tú; no viene en el zip)
icons/                escudo Vélez García e íconos de la app
sw.js                 permite usarla sin internet
firestore.rules       reglas de seguridad para Firestore
vendor/               Chart.js, SheetJS y Firebase incluidos (no depende de otros sitios)
```

## Licencias de terceros
Íconos [Lucide](https://lucide.dev) (ISC) · [Chart.js](https://www.chartjs.org) (MIT) · [SheetJS](https://sheetjs.com) (Apache 2.0) · [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk) (Apache 2.0).
