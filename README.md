# Pokédex TCG — deck building e inventario

App 100% estática (sin backend, sin base de datos) enfocada en dos cosas:
**armar mazos** y **administrar tu inventario** de cartas de Pokémon TCG.
Buscas la carta en **TCGdex** (nombre, imagen, set, rareza, regulation mark
y precios de TCGPlayer/Cardmarket), la agregas a tu colección con cantidad y
edición, y luego organizas esas copias en **binders** (portafolio, para
guardar/vender) y **mazos** (para jugar). Pensada para publicarse gratis en
**GitHub Pages** y usarse tanto en computadora como en el teléfono.

## Stack

- **Next.js 14** (App Router, exportado como sitio 100% estático) + TypeScript
- **Tailwind CSS**
- **Sin servidor ni base de datos** — todo vive en `localStorage`, en el
  navegador (ver "Cómo se guardan tus datos")
- **API de [TCGdex](https://tcgdex.dev)** — gratuita, sin llave, sin límite
  de peticiones publicado, con precios de TCGPlayer/Cardmarket embebidos

## Cómo se guardan tus datos

No hay base de datos: tu colección, binders, mazos y ajustes se guardan con
`localStorage` en el navegador que uses. Eso permite que la app sea un sitio
100% estático (GitHub Pages), pero **no se sincroniza sola entre tu teléfono
y tu computadora** — cada dispositivo tiene la suya. Para mover datos entre
dispositivos usa **Ajustes → Respaldo completo** (exporta/importa todo), o la
exportación/importación por binder/mazo.

## Colecciones: binders y mazos (v2)

- **Binder**: portafolio — inventario real para guardar o vender. Cada carta
  que agregas es una impresión específica (set/condición/idioma) de tu
  colección; nunca se agrupan reimpresiones distintas entre sí.
- **Mazo**: para jugar. Puede activar **modo trabajo**, que permite planear
  cartas que todavía no tienes (aparecen en "Cartas que faltan", con el valor
  total en USD/GTQ de lo que te falta comprar).
- Una misma carta de tu colección (ej. 10 Ultra Ball) se reparte por
  cantidades específicas entre binders/mazos — hay un registro (`Allocation`)
  de cuántas copias de cada impresión están en cada uno. Lo que no has
  asignado aparece como "disponible" en Mi colección.
- **Mover cartas**: entre binder↔binder, binder↔mazo y mazo↔mazo. Al mover
  (o agregar) una carta que tiene varias impresiones en tu colección, la app
  te las muestra por separado para que elijas cuál mover.
- **Reimpresiones**: las cartas de Trainer (y Energy) con el mismo nombre
  siempre cuentan como la misma carta, sin importar el set. Las cartas
  Pokémon con el mismo nombre pero ataques/habilidades distintos NO se
  agrupan — la app compara automáticamente esos datos y solo agrupa
  reimpresiones que son jugablemente idénticas. Este agrupamiento **solo
  aplica en la vista de mazos**; en binders cada impresión se ve por separado
  siempre, porque ahí importa el inventario real.

## Búsqueda avanzada (v2)

Además del nombre, dos filtros togglables e independientes (funcionan solos,
juntos, o sin nombre):
- **Expansión + número**: elige un set y opcionalmente el número dentro de
  ese set.
- **Regulation mark**: una letra sola (ej. "D") o un rango (ej. "H" a "J").

## Compartir (v2)

"Compartir (vista)" genera un enlace de solo lectura para un binder o mazo.
Todos los datos necesarios viajan codificados en el propio enlace (después
del `#`), no en un servidor — quien lo abre ve una copia estática (se listan
las cartas consultando TCGdex en vivo), sin necesidad de cuenta ni backend.
**Limitación**: no hay un directorio público de binders para "explorar" —
solo funciona por enlace directo, coherente con no tener servidor.

## Exportar / Importar (v2.1)

- **Respaldo completo** (Ajustes): descarga/restaura un `.json` con toda tu
  colección, binders, mazos y ajustes.
- **Por binder**: exporta/importa un `.json` con la lista de cartas
  (solo asigna lo que ya tengas disponible en tu colección).
- **Por mazo**: exporta/importa en el **formato de texto de Pokémon TCG
  Live** (compatible para pegar y copiar directo en la app oficial):

  ```
  Pokémon: 19
  4 Dreepy TWM 128
  ...

  Trainer: 33
  4 Ultra Ball MEG 131
  ...

  Energy: 8
  3 Psychic Energy MEE 5
  ...
  ```

  El código de 2-5 letras de cada set (TWM, MEG…) viene del campo
  `abbreviation` que expone TCGdex. **Nota**: ese campo es relativamente
  nuevo en su API y no necesariamente cubre el 100% de sets antiguos; si un
  set no tiene abbreviation registrada, la exportación usa el id interno de
  TCGdex en mayúsculas como respaldo (puede no coincidir exactamente con el
  código oficial de Play/Live para sets muy viejos). Al importar, las líneas
  cuyo código de set no se reconoce se reportan como "sin coincidencia".

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Cómo publicarlo en GitHub Pages

Ya incluye `.github/workflows/deploy.yml`:

1. Sube el proyecto a un repo de GitHub (rama `main`).
2. **Settings → Pages → Source → GitHub Actions**.
3. Cada push a `main` compila (`next build`, `output: "export"`) y publica en
   `https://tu-usuario.github.io/tu-repo/`.

Compilar a mano:
```bash
NEXT_PUBLIC_BASE_PATH=/nombre-de-tu-repo npm run build
```

## Estructura

```
app/
  page.tsx              → Mi colección (disponible vs. asignado)
  buscar/page.tsx        → Buscar cartas (nombre, expansión+número, regulation mark)
  colecciones/page.tsx    → Listado de binders y mazos, crear nuevos
  coleccion/page.tsx       → Detalle de un binder/mazo (agregar, mover, exportar…)
  ver/page.tsx               → Vista de solo lectura de un binder/mazo compartido
  ajustes/page.tsx            → Tipo de cambio + respaldo completo
components/                    → UI (diálogos de agregar/mover/exportar, íconos, tarjetas…)
lib/
  tcgdex.ts                     → cliente de TCGdex (búsqueda, sets, filtros)
  storage.ts                     → colección, binders/mazos, asignaciones — todo en localStorage
  reprints.ts                     → detección/agrupación de reimpresiones jugablemente iguales
  pokemonLiveFormat.ts             → parseo/generación del formato de texto de Pokémon TCG Live
  deckImport.ts                     → empareja una lista importada con cartas reales de TCGdex
  share.ts                           → codifica/decodifica enlaces de "vista" compartida
  exportImport.ts                     → respaldo completo (JSON) de toda la app
  types.ts, currency.ts, rarity.ts     → tipos de la API, conversión de moneda, color por rareza
```

## Novedades v2.7

- **Lista de compra** (nueva página): junta en un solo lugar todo lo que te falta comprar —
  cartas faltantes de todos tus mazos + tu lista de deseos — agrupado por carta, con el costo
  total y de dónde viene cada una (qué mazo, o "lista de deseos"). Con "Ya la compré" se agrega
  de una vez a tu colección y se asigna sola a los mazos que la pedían (y sale de la lista de
  deseos si estaba ahí).

## Novedades v2.6

- **Lista de deseos** (nueva página, "Deseos" en el navbar): cartas que quieres conseguir, separadas
  de tus mazos — no necesitan modo trabajo ni pertenecer a ningún mazo. Cada carta tiene prioridad
  (alta/media/baja), precio estimado, link directo a comprar en TCGPlayer, y un botón "Ya la tengo"
  que la mueve directo a tu colección. Se ve el costo total estimado de toda la lista. También
  puedes agregar una carta a deseos desde su ficha de detalle (botón "♡ Agregar a deseos"), sin
  importar dónde la estés viendo.

## Novedades v2.5.2

- **El validador de legalidad ahora reconoce reimpresiones de Trainer/Energy**: si una carta como
  Boss's Orders o Pokégear 3.0 tiene alguna reimpresión con marca vigente en cualquier expansión,
  ya no se marca como ilegal solo porque la copia física que tienes es de un set más viejo — es una
  regla real del TCG (Trainer/Energy con el mismo nombre siempre tiene el mismo efecto, así que
  cualquier copia sirve si existe una versión vigente). Esta revisión consulta TCGdex en segundo
  plano (se ve "revisando reimpresiones…" mientras corre) y no aplica a Pokémon, porque ahí sí puede
  cambiar el kit de ataques entre reimpresiones.

## Novedades v2.5.1

- Arreglado: en el listado de Colecciones, el conteo de "cartas asignadas" de cada mazo no incluía
  las energías — ahora suma igual que en el detalle del mazo.

## Novedades v2.5

Investigué qué ofrecen las apps más usadas de este tipo (Dex, pkmn.gg, Pokéllector) para ver qué le
faltaba a esta. Lo que sí encajaba con una app sin backend:

- **Historial de valor**: cada vez que abres Estadísticas se guarda una foto del valor de tu
  colección (una por día). Se ve como una línea de tendencia, con el cambio de los últimos 7 días.
- **Progreso por expansión**: cuántas cartas distintas tienes de cada set que ya tocaste, contra el
  total oficial de esa expansión (ej. "45/191").
- **Botón "Comprar en TCGPlayer"** en las cartas que le faltan a un mazo (antes solo existía el
  link de precio para cartas que ya tienes).

(De lo que hacen esas apps, el escáner de cámara y el sistema de amigos/perfiles quedan fuera:
necesitan infraestructura — reconocimiento de imagen, cuentas de usuario — que no tiene sentido
para una app sin backend ni base de datos.)

## Novedades v2.4

- **Detalle de carta**: al hacer clic en la imagen o el nombre de cualquier carta (en Buscar, Mi
  colección, dentro de un mazo/binder, o en la vista de solo lectura) se abre una ficha con imagen
  en alta calidad, tipo, HP, ataques (con costo y daño), habilidades, texto de efecto para
  Trainer/Energy, debilidades/resistencias, regulation mark, legalidad Standard/Expanded (cuando
  TCGdex la trae), ilustrador, y el precio con link a TCGPlayer.

## Novedades v2.3

- **Validador de legalidad de mazo**: en cada mazo se ve si tiene exactamente 60 cartas, si alguna
  carta pasa de 4 copias (la energía básica no cuenta), y — si configuras un rango de regulation
  mark en Ajustes ("Formato Standard") — si alguna carta queda fuera de ese rango.
- **Estadísticas de la colección** (nueva página): valor total, cartas distintas, unidades, cuántas
  son bulk, distribución por tipo (Pokémon/Trainer/Energy) y por expansión, y tus 10 cartas más
  valiosas.
- **Ordenar** por nombre, precio o cantidad, tanto en Mi colección como en los resultados de
  Buscar cartas.
- **Las cartas bulk ya no suman al valor total** — en Mi colección, en el valor de cada binder/mazo,
  y en el "Valor total" de Estadísticas (se muestra aparte cuánto suman, sin incluirlo en el total).

## Novedades v2.2.3

- **Vista de solo lectura, por defecto**: al abrir un binder o mazo ahora se ve primero en modo
  "Vista" — las cartas en recuadros grandes, como la vista compartida, pero sin necesitar generar
  ningún link. El toggle **Vista / Construcción** cambia a la vista de administración de siempre
  (agregar, mover, ajustar cantidades…).
- **Valor del mazo** visible en el encabezado (además de "te faltan…", ahora también se ve cuánto
  vale lo que ya tienes armado).
- **Botón "↻ Actualizar"** en mazos: revisa todas las cartas que faltan contra tu colección actual
  y asigna automáticamente las que ya tengas disponibles — como correr "Ya la conseguí" en todas a
  la vez.
- **Bug de los links compartidos corregido**: el codificador no le devolvía el relleno (padding) al
  texto en Base64 antes de decodificarlo, así que el enlace nunca lograba abrir — por eso no se
  podía ver nada al abrir un link compartido. Ya está corregido.

## Novedades v2.2.2

- **Corrección real de los códigos de set**: al ver qué id de respaldo aparecía en tus
  exportaciones (ej. "ME02.5 155" para una carta que es "ASC 155"), pude confirmar directamente
  los ids internos de varios sets de TCGdex (sv05, sv06, sv08, sv09, me01, me02.5, me03…) y
  reconstruir la tabla con datos verificados en vez de solo nombres — debería resolver
  correctamente ahora toda tu lista de ejemplo (serie Mega Evolution y Scarlet & Violet).
- **Corregido un bug grave de pérdida de datos al importar**: si el mazo no tenía el modo trabajo
  activo, las cartas que no poseías se descartaban por completo, sin dejar rastro (por eso varias
  líneas de tu lista, como los 4 N's Zorua o las 8 Darkness Energy, desaparecían enteras). Ahora
  la importación **siempre** registra lo que falta en "Cartas que faltan" — el modo trabajo ya solo
  controla si puedes buscar y agregar a mano cartas que no tienes; nunca vuelve a perderse nada al
  importar. Con esto ya puedes usar "Ya la conseguí" en cualquier carta faltante para asignarla en
  cuanto aparezca en tu colección.

## Novedades v2.2.1

- **Energías junto a las cartas del mazo**: ya no aparecen en "cartas que faltan" — ahora viven en
  "Cartas en el mazo" (genéricas o no) y cuentan en el total de cartas del mazo.
- **Códigos de set corregidos de raíz**: el sistema que resuelve el código de Pokémon TCG Live
  (TWM, JTG, MEG…) ahora compara por el **nombre real del set** contra una tabla verificada
  (incluye toda la serie "Mega Evolution" 2025-2026: MEG, PFL, ASC, POR, CRI, MEE, y la serie
  Scarlet & Violet completa), en vez de adivinar por el id interno de TCGdex — eso es lo que
  causaba que algunos sets sí resolvieran bien y otros no. Esto también arregla por qué varias
  líneas no se importaban: al no encontrarse el set, la línea completa se descartaba.
- Se quitó la opción de corregir el código de set a mano (ya no debería hacer falta).
- **Import de energías más preciso**: cuando una línea de energía no coincide con la impresión
  exacta, ahora se revisan varias coincidencias por nombre y se prefiere la que sí tenga el mismo
  código de set que el de la línea importada.
- **Link a TCGPlayer corregido**: TCGdex todavía no expone de forma confiable un link directo por
  carta (según su propio FAQ, ese campo sigue en desarrollo), así que ahora el precio enlaza a una
  búsqueda en TCGPlayer con el nombre de la carta — siempre funciona, en vez de depender de un
  campo que casi nunca venía.

## Novedades v2.2

- **Filtro por tipo de carta** (Pokémon / Trainer · Item, Supporter, Stadium, Tool / Energy ·
  Basic, Special) disponible en Buscar, en Mi colección, y al agregar cartas a un mazo (modo
  normal y modo trabajo).
- **Paginación real** en la búsqueda por nombre — "Ver más resultados" trae la siguiente página en
  vez de cortar en ~24.
- **Buscador y filtro bulk dentro de Mi colección.**
- **"¿Dónde tengo esta carta?"**: cada entrada con copias asignadas muestra en qué binders/mazos
  están, con la cantidad en cada uno.
- **Energías básicas genéricas**: en un mazo puedes agregar Grass/Fire/Water/Lightning/Psychic/
  Fighting/Darkness/Metal Energy sin tenerlas en tu colección — no cuentan en el valor de cartas
  faltantes.
- **"Ya la conseguí"**: sustituye copias de una carta faltante por copias reales de tu colección.
- **Precio → TCGPlayer**: el precio de una carta en Mi colección es un link directo a su página en
  TCGPlayer (si no hay precio pero sí hay link, igual lleva ahí).
- **Reemplazo de imagen**: cartas sin imagen muestran un ícono tipo Poké Ball en vez de romperse.
- **Notas visibles y editables** en cada carta de Mi colección (antes se guardaban pero no se
  mostraban en ningún lado).
- **Modo bulk** (Ajustes): oculta por defecto cartas de bajo valor; cada carta también se puede
  marcar como bulk a mano sin importar su precio; filtro para mostrarlas/ocultarlas en Mi colección.
- **Agrupación automática**: agregar una carta que ya tienes (misma impresión/condición/idioma) le
  suma la cantidad a la entrada existente en vez de crear una fila aparte. Las cartas marcadas como
  holográficas nunca se agrupan con la versión normal de la misma carta, y viceversa.
- **Corrección de exportación/importación**: el código de set para el formato Pokémon Live ahora se
  resuelve de forma más confiable (antes podía usar el id interno de TCGdex — ej. "SV09" — en vez
  del código real como "JTG"); se añadió una tabla de respaldo para los sets Scarlet & Violet
  recientes, y cada carta tiene un campo de código de set editable a mano (ícono ✎ junto al set en
  Mi colección) por si algún set no está cubierto. Los números ya no llevan ceros a la izquierda al
  exportar, y las líneas de la sección "Energy:" al importar hacen match solo por nombre (no
  necesitan coincidir en set/número exacto).
- **Corrección de un error** que podía romper la app al abrir un binder/mazo con datos incompletos.

## Próximos pasos sugeridos

- Reglas de formato (Standard/Expanded, 60 cartas, máx. 4 copias) al armar un mazo
- Historial de precios (snapshots de `priceUsd` en el tiempo)
- Convertir automáticamente un renglón de "cartas que faltan" en una carta
  real cuando la agregues a tu colección
- Estadísticas de la colección (valor total, distribución por set/rareza)
