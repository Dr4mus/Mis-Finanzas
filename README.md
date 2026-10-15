# Mis finanzas

App de finanzas personales y de pareja: cuentas, movimientos, presupuesto, recurrentes y metas de ahorro.
Se instala en el teléfono desde el navegador (sin tiendas), funciona sin internet y, si la configuras, se sincroniza en tiempo real entre los dos.

- **Sin configurar nada:** funciona en un solo dispositivo y guarda los datos en ese navegador.
- **Con Firebase (gratis):** cada uno entra con su correo, se unen al mismo "hogar" y ven lo mismo al instante.

---

## Actualizar la app (si ya la tienes funcionando)

**Tus datos no se pierden al actualizar**: viven en tu teléfono y en Firebase, no en los archivos de GitHub. Aun así, antes de empezar, en la app ve a **Más → Ajustes → Respaldo y Excel → Descargar respaldo** (o **Copiar respaldo** y pégalo en una nota). Es solo por seguridad: no hace falta importarlo después.

1. **GitHub → tu repositorio → Add file → Upload files.** Arrastra todo el contenido de la carpeta del zip (`index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `firestore.rules` y las carpetas `css`, `js`, `icons`, `vendor`). El zip **no trae `js/config.js`**, así que tu conexión con Firebase se queda igual. Toca **Commit changes**.
2. Si en el repositorio todavía existen `js/views.js` o `icons/icon.svg`, bórralos (abre el archivo → **⋯ → Delete file → Commit changes**). Ya no se usan.
3. **Firebase → Firestore → Rules:** solo si nunca publicaste las reglas de la versión 6. Pega el contenido de `firestore.rules` y toca **Publish**. Volver a publicarlas no hace daño.
4. Espera 1–2 minutos y abre la app. Cuando salga **"Hay una versión nueva"**, toca **Actualizar**. Si no sale, ciérrala por completo y ábrela otra vez.
5. **iPhone:** para ver el ícono nuevo con el escudo, borra el ícono de la pantalla de inicio y vuelve a agregarlo desde Safari (**Compartir → Agregar a pantalla de inicio**). Tus datos no se borran: siguen en la nube.

### Qué hay de nuevo en la 7

- **Escudo Vélez García** en el ícono de la app, en Inicio, en Más y en la pantalla de bloqueo.
- **7 paletas de colores** en **Más → Ajustes → Apariencia**: Original, Escudo Vélez García, Veranda, Cielo, Clásico, Winewood y Bosque. Cada una tiene versión clara y oscura, y cada teléfono elige la suya.
- **iPhone ya no hace zoom** al tocar un campo para escribir.
- **Cuentas claras (gastos compartidos):** al anotar un egreso eliges "Personal", "Compartido" o "Para otra persona". En **Más → Cuentas claras** ves quién le debe a quién y registras cuando se saldan.

### Qué hay de nuevo en la 6

- **Inicio más limpio**: disponible y patrimonio arriba, el resumen del mes, pendientes y alertas, metas y los últimos movimientos. Las gráficas están en **Más → Reportes**.
- **Reportes**: mes a mes, con ingresos, egresos, ahorro, tasa de ahorro y comparación con el mes anterior; gráficas de 12 meses y de la evolución del patrimonio.
- **Historial** agrupado por día con el total de cada día, buscador, filtros plegables y fechas como "13 oct". Tocar un movimiento lo abre para editarlo.
- **Menú de 5 pestañas** (Inicio, Historial, Cuentas, Presupuesto y Más), un color principal con mejor contraste y cuentas más claras.
- **Avisos propios**: ya no salen las alertas del navegador. Al borrar aparece **Deshacer**.
- **Agregar más rápido**: monto grande, categorías con íconos, y la app recuerda la última cuenta.
- **"Quién" automático**: cada uno pone su nombre y la app lo elige sola. Cada movimiento muestra quién lo anotó.
- **Editar y duplicar**: transferencias y aportes a metas se pueden editar; cualquier movimiento se puede duplicar. Las categorías y personas se pueden renombrar (se actualiza todo el historial) y las subcategorías se manejan desde Ajustes.
- **Tarjetas de crédito con día de corte y de pago**: la app calcula cuánto debías al corte, cuánto has pagado y te avisa antes de que venza. Tiene un botón **Pagar**.
- **Facturas con corte y pago** (luz, internet…): en Recurrentes cada una muestra "vence en X días" o "venció".
- **Recurrentes a metas y transferencias**: por ejemplo, "cada quincena pasar RD$5,000 de Nómina a Viaje". Llega a Inicio y lo confirmas con un toque.
- **PIN, Face ID / huella** y botón para **ocultar montos** (el ojo de arriba).
- **Tasa de cambio de referencia** por moneda, en Ajustes.
- **Saldo insuficiente** ahora es una advertencia y no un bloqueo.
- **Seguridad del hogar**: lista de miembros, sacar a alguien y generar un código nuevo de 8 caracteres (ej. `K7P2-9QXM`).

> **Face ID / huella**: funciona con la app instalada en la pantalla de inicio (iPhone con iOS 16 o más nuevo, Android con Chrome). Es un bloqueo de la app en ese teléfono; tus datos de la nube, además, siempre necesitan tu correo y contraseña. En iPhone hay que tocar el ícono de la cara en la pantalla de bloqueo.

---

## 1. Publicarla en GitHub Pages

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Arriba a la derecha, toca **+ → New repository**. Ponle un nombre (ej. `mis-finanzas`).
   - Puede ser **Private**, pero GitHub Pages en repositorios privados necesita un plan de pago. En un repositorio **Public** el código se ve, pero **tus datos no**: viven en tu teléfono y en tu Firebase, nunca en GitHub.
3. En el repositorio nuevo, toca **Add file → Upload files**, arrastra **todo el contenido** de esta carpeta (no la carpeta en sí) y toca **Commit changes**.
4. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`, y toca **Save**.
5. En uno o dos minutos aparece la dirección, algo como `https://tu-usuario.github.io/mis-finanzas/`.

## 2. Instalarla en el teléfono

- **iPhone (Safari):** abre la dirección, toca **Compartir → Agregar a pantalla de inicio**.
- **Android (Chrome):** abre la dirección, toca **⋮ → Instalar app** (o "Agregar a pantalla principal").

Ya queda con su ícono, se abre a pantalla completa y funciona sin internet.

## 3. Traer tus datos de la versión anterior

1. Abre la versión anterior (la de Claude), ve a **Ajustes** y toca **Copiar respaldo**.
2. En la app nueva, ve a **Más → Ajustes → Respaldo y Excel → Importar un respaldo**, pega el texto en la caja y toca **Importar texto**.

Se importan cuentas, movimientos, recurrentes, metas, presupuesto, categorías y personas. Hazlo **antes** de crear el hogar en la nube: así tus datos suben al hogar.

---

## 4. Configurar Firebase (sincronización en la nube)

Firebase es un servicio de Google con un plan gratuito que alcanza de sobra para dos personas. Toma unos 10 minutos y se hace una sola vez.

### 4.1 Crear el proyecto
1. Entra a [console.firebase.google.com](https://console.firebase.google.com) con una cuenta de Google.
2. **Crear un proyecto** → nombre `mis-finanzas` → puedes desactivar Google Analytics → **Crear**.

### 4.2 Activar el inicio de sesión con correo
1. En el menú izquierdo: **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** → **Correo electrónico/contraseña** → activa el primer interruptor → **Guardar**.
3. Pestaña **Configuración → Dominios autorizados** → **Agregar dominio** → escribe `tu-usuario.github.io` (sin `https://` ni la carpeta).

### 4.3 Crear la base de datos
1. **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: la más cercana (ej. `nam5 (United States)`). Modo: **producción**.
3. Cuando termine, abre la pestaña **Reglas**, borra lo que hay, pega todo el contenido del archivo **`firestore.rules`** de esta carpeta y toca **Publicar**.

> Las reglas son las que protegen tus datos: solo los miembros de un hogar pueden leerlo o escribirlo. No te saltes este paso.

### 4.4 Conectar la app
1. En Firebase, toca el engrane ⚙ → **Configuración del proyecto** → abajo, en *Tus apps*, toca el ícono **`</>`** (Web).
2. Ponle un nombre (ej. `web`). **No** marques Firebase Hosting. Toca **Registrar app**.
3. Te muestra un bloque `const firebaseConfig = { ... }`. Copia lo que está entre las llaves.
4. En GitHub, abre el archivo **`js/config.js`**, toca el lápiz ✏️ para editarlo y cambia la última línea por:

```js
window.FIREBASE_CONFIG = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…"
};
```

5. Toca **Commit changes**. En un minuto la app publicada ya tiene la nube activada (si estaba abierta, ciérrala y vuelve a abrirla).

> Esos datos **no son secretos**: Firebase los diseñó para ir en el código de la página. La seguridad la ponen las reglas del paso 4.3.

### 4.5 Unirse los dos
1. **Persona 1:** en la app, **Más → Ajustes → Nube y hogar** → escribe tu correo y una contraseña → **Crear cuenta** → escribe tu nombre → **Crear hogar con mis datos**.
2. Toca **Copiar código** y envíaselo a tu pareja (por WhatsApp, por ejemplo).
3. **Persona 2:** **Crear cuenta** con su propio correo → escribe su nombre → pega el código → **Unirme**.
   - Si en su teléfono ya tenía datos, la app pregunta si los quiere **agregar** al hogar o **descartar**.
4. Listo. Arriba de cada pantalla aparece el estado: **Sincronizado**, **Enviando…** o **Sin conexión** (en ese caso los cambios se envían solos cuando vuelve el internet).

Si cambias de teléfono, solo entra con tu correo: la app recuerda tu hogar y baja todo.

---

## Qué se corrigió respecto a la versión anterior

| # | Problema | Corrección |
|---|---|---|
| 1 | Un gasto en pesos desde una cuenta en dólares restaba el número en pesos como si fueran dólares | Pide cuánto se movió en la moneda de la cuenta; los movimientos viejos se convierten con la última tasa conocida |
| 2 | En una transferencia, al cambiar la cuenta destino se guardaba un monto viejo (salían 100 USD y entraban 5,900 USD) | Si las dos cuentas usan la misma moneda, entra lo mismo que sale; al cambiar de cuenta se borra el monto anterior |
| 3 | Confirmar u omitir un recurrente borraba sin avisar los pendientes anteriores | Cada fecha se resuelve por separado |
| 4 | Los recurrentes anuales siempre caían en enero | Se agregó el selector de mes |
| 5 | No se podía cambiar el presupuesto base, y un límite borrado reaparecía al recargar | Ahora hay un tope base y otro opcional solo para el mes; cada uno se edita aparte y los límites borrados se borran de verdad |
| 6 | La deuda y el patrimonio sumaban dólares como si fueran pesos | Totales separados por moneda, más un estimado en pesos |
| 7 | El día de un recurrente mensual salía como día de la semana ("Día 5" → "Viernes") | Etiqueta según la frecuencia |
| 8 | Al cambiar de semanal a mensual quedaba "día 0" (último día del mes anterior) | El día se reinicia a uno válido |
| 9 | El mes de Presupuesto movía los filtros de Inicio/Historial | Presupuesto tiene su propio selector de mes |
| 10 | La proyección de metas era muy optimista | Usa el promedio real de los últimos 6 meses, contado hasta hoy |
| 11 | Agregar una moneda como "RD$" hacía fallar la app | Solo acepta códigos de 3 letras, y los montos nunca rompen la pantalla |
| 12 | Los movimientos con fecha anterior a la apertura de la cuenta no contaban en el saldo y no había aviso | Se bloquean al guardar y se avisa en la cuenta si ya existían |
| 13 | El historial solo mostraba transferencias y movimientos de metas cuando estaban borrados | Ahora aparecen siempre, con filtro por tipo |
| 14 | Sin internet, la pestaña Inicio quedaba en blanco | Las librerías vienen incluidas y la app funciona sin conexión |
| 15 | "Descargar respaldo" y "Exportar a Excel" solo funcionaban dentro de Claude | Descargan en cualquier navegador; en el teléfono abren el menú para compartir |
| 16 | Los datos podían perderse si el navegador limpiaba su almacenamiento | Sincronización en la nube y almacenamiento persistente |
| 17 | Los círculos de los íconos no tenían color de fondo (CSS inválido) | Se corrigió con `color-mix` |
| 18 | Los nombres de las personas estaban fijos en el código | Se leen de Ajustes |
| 19 | Un respaldo manipulado podía meter código en la página | Los datos importados se validan y se escapan |
| 20 | Al sincronizar, la configuración de uno borraba la del otro | Categorías, personas y monedas se unen; en la nube los cambios llegan al instante |

---

## Estructura

```
index.html            la página
css/app.css           estilos e íconos
js/core.js            datos y cálculos (saldos, presupuesto, recurrentes, metas, tarjetas, reportes)
js/ui.js              avisos, acciones (guardar/borrar) y navegación
js/screens.js         pantallas
js/forms.js           formularios, categorías, respaldo y Excel
js/lock.js            PIN y Face ID / huella
icons/                escudo familiar e íconos de la app
js/sync-ui.js         pantalla de la nube y arranque
js/cloud.js           conexión con Firebase
js/config.js          tu configuración de Firebase
sw.js                 permite usarla sin internet
firestore.rules       reglas de seguridad para Firestore
vendor/               Chart.js, SheetJS y Firebase incluidos (no depende de otros sitios)
```

Al publicar cambios en el código, sube la versión en `sw.js` (`CACHE = 'mis-finanzas-v…'`) para que los teléfonos ofrezcan actualizar.

## Licencias de terceros
Íconos [Lucide](https://lucide.dev) (ISC) · [Chart.js](https://www.chartjs.org) (MIT) · [SheetJS](https://sheetjs.com) (Apache 2.0) · [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk) (Apache 2.0).
