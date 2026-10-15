# Mis finanzas

App de finanzas personales y de pareja: cuentas, movimientos, presupuesto, recurrentes y metas de ahorro.
Se instala en el teléfono desde el navegador (sin tiendas), funciona sin internet y, si la configuras, se sincroniza en tiempo real entre los dos.

- **Sin configurar nada:** funciona en un solo dispositivo y guarda los datos en ese navegador.
- **Con Firebase (gratis):** cada uno entra con su correo, se unen al mismo "hogar" y ven lo mismo al instante.

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
2. En la app nueva, ve a **Ajustes → Respaldo**, pega el texto en la caja y toca **Importar texto**.

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
1. **Persona 1:** en la app, **Ajustes → Sincronización en la nube** → escribe tu correo y una contraseña → **Crear cuenta** → **Crear hogar con mis datos**.
2. Toca **Copiar código** y envíaselo a tu pareja (por WhatsApp, por ejemplo).
3. **Persona 2:** **Crear cuenta** con su propio correo → pega el código → **Unirme**.
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
js/core.js            datos, cálculos (saldos, presupuesto, recurrentes, metas)
js/views.js           pantallas y formularios
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
