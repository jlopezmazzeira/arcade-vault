# SPEC 02 — Página de inicio

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-07-21
> **Objective:** Portar la landing de `references/templates/home-about/home.jsx` a la raíz del sitio, moviendo la Biblioteca a `/biblioteca`.

## Alcance

**Dentro:**

- Nueva `app/page.tsx` con la landing portada de `home.jsx`, en siete secciones: hero, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", stats, "ACTIVIDAD EN VIVO", "PRECIOS" y CTA final.
- Mudanza de la Biblioteca de `app/page.tsx` a `app/biblioteca/page.tsx`, sin cambios en su contenido.
- Actualización de los seis enlaces que hoy apuntan a `/` esperando la Biblioteca: `app/auth/page.tsx` (dos: el `router.push` y "JUGAR COMO INVITADO"), `app/salon/page.tsx`, `app/_components/GamePlayerScreen.tsx`, `app/not-found.tsx` y `app/juegos/[id]/page.tsx`.
- `app/_components/Nav.tsx`: se añaden los enlaces "Inicio" (`/`) y "Acerca de" (`/about`), y "Biblioteca" pasa a `/biblioteca`. El logo sigue apuntando a `/`, que ahora es la home.
- `data/home.ts` con tres constantes mock tipadas: `TICKER`, `TOP_TODAY` y `HOME_STATS`. La primera stat toma su cifra de `GAMES.length`, no de un literal.
- Tres componentes nuevos en `app/_components/`: `FloatingSilhouettes.tsx`, `FeatureIcon.tsx` y `MiniCard.tsx`.
- Tres bloques nuevos al final de `app/globals.css`, copiados de `references/templates/home-about/styles.css`: `HOME PAGE` (líneas 930-1070), `ACTIVITY` (1621-1671) y `PRICING` (1672-1725).
- El efecto `useReveal` con `IntersectionObserver`, anulado bajo `prefers-reduced-motion`.

**Fuera de alcance (para futuras specs):**

- La página `/about`. El enlace de la nav existe y cae en `not-found.tsx` a propósito, hasta que llegue su spec.
- Las secciones `ABOUT PAGE`, `GAMEPAD` y `Theme variants` de la hoja de estilos de la plantilla. `home.jsx` no usa ninguna de esas clases.
- Datos reales en el ticker y el top de jugadores. Son mock estático; no hay backend ni puntuaciones guardadas.
- El bloque de precios como funcionalidad. Es texto: no hay pasarela de pago, ni planes, ni nada que cobrar.
- Coherencia entre el resto de cifras de la home y datos reales. "MILES DE PARTIDAS" y las puntuaciones del ticker siguen siendo inventadas.
- Redirección de `/biblioteca` desde `/`. La raíz deja de ser la Biblioteca sin más; no se añade `redirect()` ni entrada en `next.config`.
- Tests. Sigue sin haber runner.

## Modelo de datos

No hay persistencia. Todo es mock estático en memoria, igual que en la SPEC 01.

```ts
// data/games.ts — un solo cambio
export type AccentColor = "cyan" | "magenta" | "yellow" | "green";
```

```ts
// data/home.ts
import { GAMES, type AccentColor } from "@/data/games";

type TickerRow = {
  player: string;   // "NEONFOX"
  game: string;     // texto libre, NO es un id de GAMES
  score: number;    // se formatea con toLocaleString("es-ES")
  when: string;     // ya viene formateado: "hace 2 min"
  color: AccentColor;
};

type TopRow = {
  rank: number;     // 1..5
  player: string;
  score: number;
};

type HomeStat = {
  n: string;        // cifra grande: "8", "MILES", "GLOBAL"
  u: string;        // unidad: "JUEGOS"
  s: string;        // pie: "Y CONTANDO"
};

export const TICKER: readonly TickerRow[];      // 7 filas
export const TOP_TODAY: readonly TopRow[];      // 5 filas
export const HOME_STATS: readonly HomeStat[];   // 3 bloques
```

Convenciones:

- `HOME_STATS[0].n` es `String(GAMES.length)`. Las otras dos cifras son literales.
- `TickerRow.game` es texto libre y no enlaza a ningún sitio. Es deliberado: el ticker cita juegos que no están en `GAMES`.
- `AccentColor` se importa de `data/games.ts`, donde pasa a exportarse. Es el único cambio de esta spec en ese archivo.

Dos decisiones dentro de esos tipos:

1. **`when` es una cadena ya formateada, no una fecha.** Con `Date` habría que calcular el "hace N min" en render, y eso desincroniza servidor y cliente: error de hidratación garantizado.
2. **La anchura de la barra del top no se guarda.** La plantilla la calcula como `100 - i * 16`. Es presentación, se queda en el componente.

## Plan de implementación

Cada paso deja la aplicación arrancable con `npm run dev`.

1. **Mudanza de la Biblioteca.** Mover `app/page.tsx` a `app/biblioteca/page.tsx` sin tocar su contenido. La raíz queda sin `page.tsx`.
   Verificación: `/biblioteca` renderiza las 8 tarjetas; `/` muestra `not-found.tsx`. Ese 404 es esperado y dura hasta el paso 6.

2. **Reapuntar los seis enlaces** que esperaban la Biblioteca en `/`: `app/auth/page.tsx` (el `router.push("/")` y el `href` de "JUGAR COMO INVITADO"), `app/salon/page.tsx`, `app/_components/GamePlayerScreen.tsx`, `app/not-found.tsx` y `app/juegos/[id]/page.tsx`. Todos a `/biblioteca`. El `href="/"` del logo en `Nav.tsx` **no** se toca.
   Verificación: "VOLVER AL VAULT" desde `/juegos/caida` aterriza en la Biblioteca, no en un 404.

3. **`app/_components/Nav.tsx`.** Añadir "Inicio" (`/`) y "Acerca de" (`/about`) en la barra y en el panel móvil. `isLibrary` pasa a `pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos")`, y se añade `isHome` como `pathname === "/"` exacto — sin `startsWith`, o "Inicio" quedaría activo en todas las rutas.
   Verificación: en `/biblioteca` solo se marca "Biblioteca"; en `/` solo "Inicio"; "Acerca de" lleva al 404 temático.

4. **`data/games.ts`.** Exportar `AccentColor`. Un cambio de una palabra.
   Verificación: `npx tsc --noEmit` pasa.

5. **`data/home.ts`.** Portar `TICKER`, `TOP_TODAY` y `HOME_STATS` desde los literales incrustados en `home.jsx`, con los tipos de la sección anterior. `HOME_STATS[0].n` sale de `GAMES.length`.

6. **Tres bloques de CSS al final de `app/globals.css`**, copiados literalmente de `references/templates/home-about/styles.css`: `HOME PAGE` (930-1070), `ACTIVITY` (1621-1671) y `PRICING` (1672-1725, **no hasta el final del archivo**). Las líneas 1726-1744 de esa hoja son utilidades ya migradas en la SPEC 01 —`.fade-in`, `.slide-in`, `.spinner`, `.tw-section`, `.tw-label` y los `@keyframes` `fadeIn`, `slideIn` y `spinpix`— y **no se copian**. Tampoco se copian las secciones `ABOUT PAGE`, `GAMEPAD` ni `Theme variants`. Nada del CSS existente se modifica.
   Verificación: `.home-hero`, `.feature-grid`, `.activity-grid` y `.pricing-grid` existen en `globals.css`, y `.fade-in` sigue definida una sola vez.

7. **`app/_components/FloatingSilhouettes.tsx`.** Las ocho siluetas SVG decorativas del hero. Sin estado, sin props, `aria-hidden="true"`.

8. **`app/_components/FeatureIcon.tsx`.** Los cuatro iconos pixel (`GAMEPAD`, `FREE`, `TROPHY`, `ROCKET`) con la prop `kind` tipada como unión de esos cuatro literales, no como `string`.

9. **`app/_components/MiniCard.tsx`.** Tarjeta reducida del rail de juegos. Toma `game: Game` y envuelve todo en un `<Link>` a `/juegos/[id]`, igual que hizo `GameCard` en la SPEC 01. Sin `onClick`.

10. **`app/_components/useReveal.ts`.** Hook cliente con el `IntersectionObserver` que añade `.in` al entrar en viewport, con `threshold: 0.12` y `unobserve` tras disparar. Devuelve el observer limpiado en el `useEffect`.

11. **`app/page.tsx` — hero y "¿POR QUÉ".** Componente cliente por el hook del paso 10. Hero con siluetas, título de tres líneas y los dos CTA ("EXPLORAR JUEGOS" → `/biblioteca`, "CREAR CUENTA" → `/auth`), más la rejilla de cuatro `feature-card`.
    Verificación: `/` responde 200 y las cuatro tarjetas aparecen al hacer scroll.

12. **`app/page.tsx` — rail de juegos y stats.** Sección "JUEGOS DISPONIBLES AHORA" con `GAMES.slice(0, 6)` en `MiniCard`, el botón "VER TODOS LOS JUEGOS" a `/biblioteca`, y la tira de tres `HOME_STATS`.
    Verificación: se ven 6 mini-tarjetas; la primera stat dice "8".

13. **`app/page.tsx` — actividad en vivo.** Las dos `activity-card`: ticker desde `TICKER` y top desde `TOP_TODAY`, con "VER SALÓN" a `/salon`. La anchura de `.tp-fill` se calcula como `100 - i * 16`.

14. **`app/page.tsx` — precios y CTA final.** Tarjeta de plan único con sus seis items y el botón a `/auth`, las tres preguntas del FAQ, y la sección de cierre con "INSERTAR MONEDA" a `/biblioteca`.
    Verificación: la home entera renderiza sus siete secciones.

15. **`prefers-reduced-motion` y salvaguarda sin JS.** Extender el bloque existente de `globals.css` con las animaciones nuevas de la home, forzando `.reveal { opacity: 1; transform: none }`. Añadir la misma regla bajo `@media (scripting: none)`, para que la home siga legible si el JS no llega a ejecutarse.
    Verificación: con "reducir movimiento" activo, todas las secciones se ven sin hacer scroll. Con JavaScript desactivado en el navegador, la home se ve entera.

16. **Pasada final.** `npm run lint` y `npm run build` sin errores ni avisos.

Dos apuntes sobre el orden:

- **El paso 1 deja `/` en 404 durante cinco pasos.** Es incómodo pero cada commit sigue siendo coherente, y hacer la mudanza y la landing en un solo paso daría un commit de varios cientos de líneas donde no se distingue lo movido de lo nuevo.
- **`app/page.tsx` se construye en cuatro pasos (11-14)** en lugar de uno. La página son ~200 líneas de JSX; partirla por secciones mantiene cada commit por debajo del límite de 50 líneas de la plantilla.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] La consola no muestra errores ni avisos de hidratación en `/` ni en `/biblioteca`.
- [ ] `npx tsc --noEmit` pasa.

**Rutas y mudanza**

- [ ] `/` responde 200 y muestra la landing.
- [ ] `/biblioteca` responde 200 y muestra las 8 tarjetas de `GAMES`.
- [ ] `/juegos/caida`, `/juegos/caida/jugar`, `/auth` y `/salon` siguen respondiendo 200.
- [ ] `/about` muestra `not-found.tsx`, con nav y pie.
- [ ] "VOLVER AL VAULT" en `/juegos/caida`, en el modal del reproductor y en `not-found.tsx` lleva a `/biblioteca`.
- [ ] "VOLVER A LA BIBLIOTECA" en `/salon` lleva a `/biblioteca`.
- [ ] Enviar el formulario de `/auth` aterriza en `/biblioteca`.
- [ ] "JUGAR COMO INVITADO" lleva a `/biblioteca`.
- [ ] El logo de la nav lleva a `/`.

**Nav**

- [ ] La barra muestra cuatro enlaces: Inicio, Biblioteca, Salón de la Fama, Acerca de.
- [ ] En `/` solo "Inicio" está marcado como activo.
- [ ] En `/biblioteca`, `/juegos/caida` y `/juegos/caida/jugar` solo "Biblioteca" está activo.
- [ ] En `/salon` solo "Salón de la Fama" está activo.
- [ ] El panel móvil muestra los mismos cuatro enlaces más "Iniciar Sesión".

**Home (`/`)**

- [ ] Se renderizan las siete secciones: hero, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", stats, "ACTIVIDAD EN VIVO", "PRECIOS" y CTA final.
- [ ] "EXPLORAR JUEGOS" lleva a `/biblioteca`; "CREAR CUENTA" lleva a `/auth`.
- [ ] La rejilla de características muestra 4 tarjetas, cada una con su icono pixel.
- [ ] El rail muestra exactamente 6 mini-tarjetas.
- [ ] Pulsar una mini-tarjeta navega a `/juegos/[id]` del juego correspondiente.
- [ ] "VER TODOS LOS JUEGOS" lleva a `/biblioteca`.
- [ ] La primera stat muestra "8", que es `GAMES.length`.
- [ ] El ticker muestra 7 filas y el top 5 filas.
- [ ] Las barras del top decrecen: la primera al 100 % y la quinta al 36 %.
- [ ] "VER SALÓN" lleva a `/salon`.
- [ ] La tarjeta de precios muestra "$0", sus 6 items y el FAQ de 3 preguntas.
- [ ] "EMPEZAR GRATIS" lleva a `/auth`; "INSERTAR MONEDA" lleva a `/biblioteca`.

**Animación y accesibilidad**

- [ ] Al cargar `/` y sin hacer scroll, las secciones bajo el hero están ocultas.
- [ ] Al hacer scroll, cada sección aparece una sola vez y no vuelve a animarse al subir.
- [ ] Con "reducir movimiento" activo, todas las secciones se ven de entrada y el CTA deja de pulsar.
- [ ] Con JavaScript desactivado, la home se ve entera.
- [ ] Tabulando por `/` se ve indicador de foco en todos los botones y enlaces.
- [ ] Ninguna regla preexistente de `globals.css` ha cambiado.
- [ ] `.fade-in`, `.slide-in`, `.spinner`, `.tw-section` y `.tw-label` están definidas exactamente una vez en `globals.css`.

## Decisiones

**Routing**

- **Sí:** Home en `/` y Biblioteca en `/biblioteca`. Es lo que asume `home.jsx` con su `navigate({ name: "biblioteca" })`, y una landing con hero, precios y CTA de registro que no viva en la raíz obliga a explicar por qué cada vez.
- **No:** Home en `/home` dejando la Biblioteca en `/`. Cero cambios en lo existente, pero deja la raíz siendo una pantalla intermedia y la landing escondida.
- **No:** `redirect()` de `/` a `/biblioteca` para no romper enlaces viejos. No hay usuarios ni enlaces que romper, y una redirección en la raíz es justo lo que impide poner una landing ahí después.
- **Sí:** "Acerca de" en la nav apuntando a `/about`, que hoy da 404. El coste es un enlace roto visible; la ventaja es que la nav queda completa y la spec del about no tiene que volver a tocarla.

**Datos**

- **Sí:** `data/home.ts` separado de `data/games.ts`. Son mock igual que `GAMES`, pero de otra pantalla; mezclarlos haría crecer un archivo que ya usan cinco rutas.
- **No:** dejar los literales dentro del JSX como en la plantilla. La SPEC 01 ya separó datos de UI; volver atrás en una sola pantalla es la clase de inconsistencia que nadie recuerda haber decidido.
- **Sí:** `HOME_STATS[0].n` derivado de `GAMES.length`. La plantilla decía "12+" con 8 juegos en el catálogo; una cifra inventada que contradice datos que la propia página muestra es un bug esperando a ser reportado.
- **Sí:** el resto de cifras se quedan inventadas ("MILES DE PARTIDAS", el ticker, el top). No hay nada real de donde sacarlas, y a diferencia del número de juegos, no se contradicen con nada visible.
- **Sí:** `TickerRow.when` como cadena ya formateada ("hace 2 min"). Con `Date` habría que calcular el delta en render, y eso desincroniza servidor y cliente.
- **Sí:** `AccentColor` se exporta desde `data/games.ts` y se reusa. Duplicar una unión de cuatro literales en dos archivos es lo primero que se desincroniza.

**Componentes y animación**

- **Sí:** portar `useReveal` con `IntersectionObserver` tal cual. Obliga a que `app/page.tsx` sea componente cliente.
- **No:** renderizar todo visible y mantener la home como Server Component. Habría ahorrado el JS y el riesgo del punto siguiente, pero deja la página plana.
- **Sí:** salvaguarda `@media (scripting: none)` que fuerza `.reveal` visible. `.reveal` arranca en `opacity: 0` y depende del JS para mostrarse: sin esa regla, un fallo de JS deja media home en blanco de forma permanente y silenciosa.
- **Sí:** `FloatingSilhouettes`, `FeatureIcon` y `MiniCard` en archivos propios. Son ~150 líneas de SVG que, inline, entierran la estructura de la página.
- **Sí:** `FeatureIcon.kind` tipado como unión de cuatro literales. Con `string`, un typo devuelve `null` y el icono desaparece sin error.
- **Sí:** `MiniCard` envuelta entera en `<Link>`, como `GameCard` en la SPEC 01. Misma interacción, mismo patrón.

**CSS**

- **Sí:** copiar solo las tres secciones que usa la home. `home-about/styles.css` es superconjunto de la hoja ya migrada, pero traer `ABOUT PAGE`, `GAMEPAD` y `Theme variants` serían ~570 líneas de CSS muerto hasta que exista el about.
- **No:** reemplazar `globals.css` entera por la hoja nueva. Más simple de ejecutar, pero imposible de revisar: el diff mezcla lo añadido con lo ya probado.
- **Sí:** copia literal, sin reescribir a utilidades Tailwind. Misma decisión que la SPEC 01, por el mismo motivo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Copiar de más al portar el CSS y redefinir reglas ya migradas de la SPEC 01. | El rango de `PRICING` termina en 1725, no al final del archivo. Criterio de aceptación que verifica que `.fade-in` y compañía aparecen una sola vez. |
| `.reveal` arranca en `opacity: 0`; si el JS falla, media home queda en blanco de forma silenciosa. | Regla bajo `@media (scripting: none)` que la fuerza visible, más la misma regla bajo `prefers-reduced-motion`. |
| El `IntersectionObserver` vuelve a animar las secciones al hacer scroll hacia arriba. | `unobserve` sobre el elemento tras dispararse. Criterio de aceptación explícito. |
| Queda algún enlace apuntando a `/` esperando la Biblioteca. | Los seis puntos están enumerados en el paso 2 y cada uno tiene su criterio de aceptación. |
| "Inicio" se marca activo en todas las rutas por usar `startsWith("/")`. | `isHome` compara `pathname === "/"` exacto. Indicado en el paso 3. |
| El enlace "Acerca de" lleva a un 404 hasta que llegue su spec. | Aceptado a propósito. El 404 es `not-found.tsx`, temático y con salida a `/biblioteca`. |

## Lo que **no** entra en esta spec

- La página `/about`, aunque su enlace ya esté en la nav.
- El CSS del about: secciones `ABOUT PAGE`, `GAMEPAD` y `Theme variants`.
- Datos reales en el ticker, el top de jugadores y las partidas jugadas.
- Cobros, planes o pasarela de pago. La sección de precios es texto.
- Redirección de `/` a `/biblioteca`.
- Reescritura de estilos a Tailwind.
- Tests.

Cada uno de esos, si llega, va en su propia spec.
