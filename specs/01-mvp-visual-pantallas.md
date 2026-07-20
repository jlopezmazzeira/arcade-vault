# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-07-19
> **Objective:** Portar las cinco pantallas de `references/templates/` a Next.js 16 con App Router, rutas reales y datos mock, sin lógica de juego, sin backend y sin sesiones.

## Alcance

**Dentro:**

- Cinco rutas reales del App Router, una por pantalla de la plantilla:
  - `/` → Biblioteca (`biblioteca.jsx`)
  - `/juegos/[id]` → Detalle (`detalle.jsx`)
  - `/juegos/[id]/jugar` → Reproductor (`reproductor.jsx`)
  - `/auth` → Acceso (`auth.jsx`)
  - `/salon` → Salón de la Fama (`salon.jsx`)
- Barra de navegación persistente con panel móvil (`nav.jsx`), movida a `app/layout.tsx` junto con `<main class="av-main">` y el pie de página, que hoy viven en `app.jsx`.
- Datos mock tipados en `data/games.ts`: `GAMES`, `CATS`, `PLAYERS` y `seededScores()`.
- Componentes en `app/_components/`.
- `app/not-found.tsx` temático, servido con `notFound()` cuando el `id` de juego no existe.
- Biblioteca: búsqueda por título y filtro por categoría, ambos en cliente.
- Detalle: portada, ficha, tira de estadísticas y tabla de mejores puntuaciones.
- Reproductor: HUD, marco CRT con arena animada, simulación de puntuación con `setInterval`, pausa, y modal de fin de partida con estado visual de guardado.
- Salón: pestañas por juego, podio de tres puestos y tabla de doce filas.
- Auth: pestañas iniciar sesión / crear cuenta, campos, botones sociales inertes. El envío redirige a `/` sin guardar nada.
- Dos añadidos a `app/globals.css`: bloque `@media (prefers-reduced-motion: reduce)` y estilos `:focus-visible` para `.btn`, `.chip`, enlaces de nav e inputs.
- Sustitución completa de `app/page.tsx` (hoy es el landing de Create Next App).

**Fuera de alcance (para futuras specs):**

- Cualquier juego real. La arena del reproductor es CSS animado, no un bucle de juego.
- Sesiones, registro, login social y backend. `/auth` es una pantalla muerta.
- Persistencia de puntuaciones. El botón "GUARDAR PUNTUACIÓN" solo cambia de estado visual; no se escribe `localStorage`.
- Bloque "▸ TU MEJOR MARCA" del Salón. Depende de que exista un usuario, así que se omite; las reglas `.tr.you` y `.tr.you-label` de `globals.css` quedan sin uso a propósito.
- Contador "CRÉDITOS · 03" de la nav: se pinta fijo, no cuenta nada.
- Reescritura de los estilos a utilidades Tailwind. El CSS migrado se queda como está.
- Tests. No hay runner configurado en el proyecto.

Dos cambios afectan a archivos ya escritos:

1. **`app/layout.tsx` se modifica.** Hoy renderiza `<div id="root">{children}</div>` a secas. La plantilla mete `Nav`, `main.av-main` y el `footer` dentro de ese `#root`, y como `.av-main { flex: 1 }` depende de ser hijo directo, la nav y el pie tienen que subir al layout.
2. **`app/page.tsx` se reemplaza entero**, no se edita. Con él dejan de usarse `public/next.svg`, `vercel.svg` y demás, aunque esta spec no los borra.

## Modelo de datos

No hay datos persistidos ni nuevos: todo es mock estático en memoria. `data/games.ts` exporta cuatro cosas, tipadas en `strict`.

```ts
// data/games.ts

type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
type FilterCategory = "TODOS" | GameCategory;
type CoverArt =
  | "cover-bricks" | "cover-tetro" | "cover-snake" | "cover-glot"
  | "cover-invaders" | "cover-rocas" | "cover-rana" | "cover-duelo";
type AccentColor = "cyan" | "magenta" | "yellow" | "green";

type Game = {
  id: string;          // slug de la URL: "bloque-buster"
  title: string;       // "BLOQUE BUSTER"
  short: string;       // una línea, tarjeta de biblioteca
  long: string;        // párrafo, pantalla de detalle
  cat: GameCategory;
  cover: CoverArt;     // clase CSS de portada, ya existe en globals.css
  color: AccentColor;  // acento del botón JUGAR de la tarjeta
  best: number;        // se formatea con toLocaleString("es-ES")
  plays: string;       // ya viene formateado: "12.4K"
};

type ScoreRow = {
  rank: number;        // recalculado tras ordenar, empieza en 1
  name: string;        // de PLAYERS
  score: number;       // mínimo 1000
  date: string;        // "DD/MM/2026"
};

export const GAMES: readonly Game[];          // los 8 juegos de data.jsx, sin cambios
export const CATS: readonly FilterCategory[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Convenciones:

- `seededScores` es un PRNG lineal determinista. Misma semilla, misma tabla, siempre. Se porta tal cual desde `data.jsx`; `PLAYERS` queda privado del módulo.
- Semillas fijadas por pantalla, copiadas de las plantillas:
  - Detalle: `seededScores(id.length * 17 + 3, 10)`
  - Salón: `seededScores(id.length * 23 + 7, 12)`
- Todas las cifras se formatean con `toLocaleString("es-ES")`. La UI está en español.

Tres decisiones implícitas en esos tipos:

1. **`GameCategory` y `FilterCategory` son tipos distintos.** `"TODOS"` es un valor de filtro de la biblioteca, nunca la categoría de un juego.
2. **`seededScores` es determinista, y eso importa.** Detalle puede ser un Server Component sin desajuste de hidratación. Con `Math.random()`, todas estas pantallas tendrían que ser cliente.
3. **`color: "green"` no tiene estilo propio.** El botón de la tarjeta solo ramifica a `magenta` y `yellow`; `cyan` y `green` caen ambos en el `.btn` por defecto. Es así en la plantilla y se porta igual.

## Plan de implementación

Cada paso deja la aplicación arrancable con `npm run dev`.

1. **`data/games.ts`.** Portar `GAMES`, `CATS`, `PLAYERS` y `seededScores()` desde `references/templates/data.jsx`, con los tipos de la sección anterior. `PLAYERS` no se exporta. Sin `window.*`.
   Verificación: `npx tsc --noEmit` pasa.

2. **Añadidos a `app/globals.css`.** Al final del archivo, dos bloques nuevos: `:focus-visible` con contorno cian para `.btn`, `.chip`, `.av-nav .links a`, `.av-mobile-panel a` e `input`; y `@media (prefers-reduced-motion: reduce)` que anula `flicker`, `blink`, `gridscroll`, `pulse`, `bob`, `drift`, `rise`, `typewriter`, `caret`, `fadeIn` y `slideIn`. Nada del CSS existente se modifica.
   Verificación: con "reducir movimiento" activo en el sistema, el fondo deja de desplazarse y el título deja de parpadear.

3. **`app/_components/Nav.tsx`.** Componente cliente (`"use client"`). Porta `nav.jsx` con tres cambios: los `<a>` pasan a `<Link>`, el estado activo se calcula con `usePathname()` en lugar de comparar `route.name`, y el botón de sesión es siempre "Iniciar Sesión" apuntando a `/auth`. `/` marca activo también bajo `/juegos/...`. El panel móvil conserva su `useState`.

4. **Reescribir `app/layout.tsx`.** Dentro de `#root`: `<Nav />`, `<main className="av-main">{children}</main>` y el `<footer>` de `app.jsx`. Los estilos del pie se mueven de `style` en línea a una clase `.av-footer` nueva en `globals.css`.
   Verificación: la nav aparece sobre la página por defecto de Next y `/auth` da 404 propio de Next todavía.

5. **`app/_components/GameCard.tsx`.** Componente cliente. Porta `GameCard` de `biblioteca.jsx`, incluido el efecto de inclinación con `useRef` y `onMouseMove`. La tarjeta entera es un `<Link>` a `/juegos/[id]`; se elimina el `onSelect` y el `stopPropagation` del botón, que ya no hace falta.

6. **`app/page.tsx`.** Reemplazo completo del landing de Create Next App por la Biblioteca: hero, buscador, chips de categoría, rejilla y estado vacío. Componente cliente por el `useState` de búsqueda y filtro.
   Verificación: `/` muestra 8 tarjetas; escribir "cai" deja una; "zzz" muestra "NO HAY RESULTADOS".

7. **`app/not-found.tsx`.** Pantalla 404 temática, reutilizando `.pixel`, `.neon-magenta` y `.btn` con un enlace de vuelta a `/`.
   Verificación: `/ruta-inexistente` la muestra dentro del layout, con nav y pie.

8. **`app/juegos/[id]/page.tsx`.** Detalle, como Server Component. `params` es una Promise y se espera (`const { id } = await params`); tipar con `PageProps<'/juegos/[id]'>` tras ejecutar `npx next typegen`. Si `GAMES` no contiene el `id`, llamar a `notFound()`. Incluye portada, etiquetas, tira de estadísticas, acciones y tabla lateral.
   Verificación: `/juegos/caida` renderiza; `/juegos/nope` cae en el 404 del paso 7.

9. **`app/_components/GamePlayerScreen.tsx`.** Componente cliente con el HUD, el marco CRT, la arena y la superposición de pausa. La simulación de puntuación usa `setInterval` a 220 ms dentro de un `useEffect` que se limpia al desmontar.

10. **Modal de fin de partida**, en el mismo componente del paso 9. Puntuación final, campo de iniciales y botón "GUARDAR PUNTUACIÓN" que solo conmuta al estado visual `▸ PUNTUACIÓN GUARDADA_`. No escribe en `localStorage`.

11. **`app/juegos/[id]/jugar/page.tsx`.** Espera `params`, resuelve el juego contra `GAMES`, llama a `notFound()` si no existe y monta el componente del paso 9.
    Verificación: en `/juegos/caida/jugar` la puntuación sube sola, PAUSA la congela y FIN abre el modal.

12. **`app/salon/page.tsx`.** Componente cliente. Pestañas por juego, podio de tres puestos y tabla de doce filas con `animationDelay` escalonado. Sin el bloque "TU MEJOR MARCA".
    Verificación: cambiar de pestaña cambia las doce filas y el podio.

13. **`app/auth/page.tsx`.** Componente cliente. Pestañas iniciar sesión / crear cuenta, campo de correo que aparece con `.slide-in` solo en "crear cuenta", botones sociales con `type="button"` e inertes. El envío hace `preventDefault()` y navega a `/` con `useRouter().push("/")`.
    Verificación: enviar el formulario aterriza en la biblioteca.

14. **Pasada final de limpieza.** `npm run lint` y `npm run build` sin errores ni avisos. Revisar que ninguna pantalla mantenga referencias a `user`, `navigate` u `onSaveScore`.

Dos apuntes sobre el orden:

- **El paso 4 "rompe" visualmente antes de arreglar.** Tras él conviven la nav nueva y el landing viejo de Next. Es feo pero arranca, y separarlo del paso 6 mantiene ambos commits por debajo de 50 líneas.
- **`npx next typegen` aparece en el paso 8** porque es el primero que necesita `PageProps`. Es el punto donde esta versión de Next se aparta más de lo esperable: `params` ya no es un objeto, y el shim síncrono de v15 está eliminado del todo.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en ninguna de las cinco rutas.
- [ ] No queda ninguna referencia a `window.GAMES`, `window.Nav` ni al resto de asignaciones globales de las plantillas.

**Navegación**

- [ ] `/`, `/juegos/caida`, `/juegos/caida/jugar`, `/auth` y `/salon` responden 200.
- [ ] La nav y el pie de página aparecen en las cinco rutas.
- [ ] "Biblioteca" está marcado como activo en `/`, `/juegos/caida` y `/juegos/caida/jugar`.
- [ ] "Salón de la Fama" está marcado como activo solo en `/salon`.
- [ ] `/juegos/no-existe` y `/ruta-inexistente` muestran `not-found.tsx`, con nav y pie.
- [ ] Recargar `/juegos/caida` directamente en el navegador renderiza la ficha de CAÍDA.
- [ ] Por debajo de 840 px de ancho, los enlaces de la nav se ocultan y aparece el botón `≡`.
- [ ] El botón `≡` abre el panel lateral; el fondo oscuro lo cierra al pulsarlo.

**Biblioteca (`/`)**

- [ ] Se muestran las 8 tarjetas de `GAMES`.
- [ ] Escribir "cai" en el buscador deja solo CAÍDA.
- [ ] Escribir "CAI" en mayúsculas deja el mismo resultado.
- [ ] Pulsar el chip "PUZZLE" deja solo CAÍDA; "TODOS" restaura las 8.
- [ ] Buscar "zzz" muestra el bloque "NO HAY RESULTADOS".
- [ ] Pulsar una tarjeta, en cualquier punto, navega a `/juegos/[id]`.
- [ ] El botón "JUGAR" de la tarjeta navega a `/juegos/[id]`, no al reproductor.

**Detalle (`/juegos/[id]`)**

- [ ] Se muestran título, párrafo largo, las cuatro etiquetas y la tira de tres estadísticas.
- [ ] La tabla lateral muestra exactamente 10 filas.
- [ ] Las filas 1, 2 y 3 se pintan en oro, plata y bronce.
- [ ] "▶ JUGAR AHORA" navega a `/juegos/[id]/jugar`.
- [ ] "VOLVER AL VAULT" navega a `/`.

**Reproductor (`/juegos/[id]/jugar`)**

- [ ] La puntuación sube sola desde 0 al cargar.
- [ ] "PAUSA" detiene la subida y muestra la superposición "EN PAUSA".
- [ ] "REANUDAR" la reactiva.
- [ ] "FIN" abre el modal con la puntuación alcanzada.
- [ ] "GUARDAR PUNTUACIÓN" sustituye el campo por `▸ PUNTUACIÓN GUARDADA_`.
- [ ] Tras guardar, `localStorage` sigue sin la clave `av_scores`.
- [ ] "JUGAR DE NUEVO" cierra el modal y reinicia puntuación, vidas y nivel.
- [ ] "SALIR" navega a `/juegos/[id]`.
- [ ] Salir de la ruta con la partida en curso no deja el `setInterval` vivo.

**Salón (`/salon`)**

- [ ] El podio muestra tres puestos y la tabla exactamente 12 filas.
- [ ] Cambiar de pestaña cambia los nombres del podio y de la tabla.
- [ ] Volver a una pestaña ya visitada muestra los mismos datos que la primera vez.
- [ ] No aparece el bloque "▸ TU MEJOR MARCA".

**Auth (`/auth`)**

- [ ] La pestaña "CREAR CUENTA" añade el campo de correo; "INICIAR SESIÓN" lo quita.
- [ ] Enviar el formulario navega a `/` sin recargar la página.
- [ ] Los botones GOOGLE y GITHUB no envían el formulario ni navegan.
- [ ] "JUGAR COMO INVITADO" navega a `/`.

**Accesibilidad y estilos**

- [ ] Con "reducir movimiento" activo, el fondo deja de desplazarse, el título deja de parpadear y "▶ JUGAR AHORA" deja de pulsar.
- [ ] Tabulando por `/` se ve un indicador de foco en buscador, chips, tarjetas y botones.
- [ ] Ninguna regla preexistente de `globals.css` ha cambiado respecto a `references/templates/styles.css`.

## Decisiones

**Arquitectura y routing**

- **Sí:** rutas reales del App Router, una por pantalla. Da URLs compartibles, recarga directa y 404 real. Es el motivo de usar Next.
- **No:** replicar la SPA con `location.hash` y un estado `route`. Funcionaría, pero reduce el framework a un empaquetador y tira la navegación del navegador.
- **Sí:** `/juegos/[id]` y `/juegos/[id]/jugar` anidadas. El reproductor es un estado del juego, no un hermano suyo, y así "SALIR" tiene un destino evidente.
- **Sí:** Detalle como Server Component. `seededScores` es determinista, así que no hay desajuste de hidratación y no hay razón para enviar esa pantalla al cliente.
- **No:** convertirlo todo en componentes cliente por comodidad. Biblioteca, Salón, Auth, Nav y Reproductor lo son porque tienen estado; Detalle no lo tiene.

**Sesiones**

- **Sí:** sin sesiones en este MVP. Es una spec visual; un `AuthProvider` con Context y `localStorage` sería infraestructura sosteniendo una pantalla que no decide nada.
- **No:** cookies con Server Components. Correcto en Next 16, pero arrastra `proxy` y Server Actions a un MVP sin backend.
- **Sí:** `/auth` redirige a `/` al enviar. Alternativa descartada: `preventDefault` sin navegar, que deja el formulario aparentemente roto al pulsarlo.
- **Sí:** omitir el bloque "▸ TU MEJOR MARCA" del Salón. Depende de un usuario que no existe. Se descartó inventar un jugador ficticio fijo: sería la única cifra de la aplicación que finge ser tuya.
- **Consecuencia aceptada:** `.tr.you` y `.tr.you-label` quedan sin uso en `globals.css`. No se borran; vuelven a hacer falta en cuanto lleguen las sesiones.

**Reproductor**

- **Sí:** portar la simulación de puntuación. No es un juego: es un HUD animado, y sin ella no se puede ver ni el modal de fin de partida ni el estado de pausa.
- **No:** dejar el marcador congelado en 0. Deja media pantalla inalcanzable.
- **Sí:** "GUARDAR PUNTUACIÓN" solo cambia de estado visual. La plantilla escribía en `localStorage["av_scores"]` y no lo leía nunca; persistir lo que nadie lee es complejidad invisible.

**Datos**

- **Sí:** `data/games.ts` en la raíz, accesible como `@/data/games`. Son datos, no UI.
- **Sí:** componentes en `app/_components/`. El prefijo `_` los excluye del routing y mantiene cerca lo que solo usa la aplicación.
- **Sí:** `GameCategory` y `FilterCategory` separados. `"TODOS"` es un filtro, no una categoría; unirlos permitiría escribir un juego con `cat: "TODOS"`.
- **Sí:** conservar `seededScores` tal cual, con su PRNG lineal. Determinista y suficiente. Se descartó `Math.random()`: obligaría a que todo fuese cliente.

**Estilos**

- **Sí:** `globals.css` se queda como está. La migración es 1:1 con `references/templates/styles.css` — mismo conjunto de selectores, sin faltantes. Verificado comparando ambos archivos.
- **No:** reescribir las pantallas con utilidades Tailwind sobre los tokens del `@theme inline`. Es riesgo puro sobre un CSS ya probado, sin ganancia visual.
- **Sí:** añadir `prefers-reduced-motion`. Siete animaciones infinitas simultáneas sin ninguna vía de escape es el hueco más serio del CSS heredado.
- **Sí:** añadir `:focus-visible`. Con rutas reales los enlaces de la nav pasan a ser enfocables, y `.btn` y `.chip` solo tenían `:hover`: navegando por teclado no se ve dónde estás.
- **Sí:** mover los estilos en línea del pie a una clase `.av-footer`. Van al layout, que se lee más que un componente suelto.

## Lo que **no** entra en esta spec

- Juegos reales. Ninguno de los ocho es jugable al terminar.
- Sesiones, registro y login social.
- Persistencia de puntuaciones, propias o ajenas.
- Backend, base de datos y API.
- Bloque "TU MEJOR MARCA" del Salón.
- Reescritura de estilos a Tailwind.
- Tests.

Cada uno de esos, si llega, va en su propia spec.
