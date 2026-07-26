# SPEC 05 — Adaptación del juego Asteroids (`rocas`) a la plataforma

> **Status:** Implemented
> **Depends on:** SPEC 01 (pantallas/HUD/CRT), SPEC 02 (home), SPEC 04 (auth — solo para el nombre del jugador, opcional)
> **Date:** 2026-07-25
> **Objective:** Portar el juego Asteroids de `references/started-games/02-asteroids/` a un componente cliente en TypeScript que se renderice dentro del chrome existente de la plataforma (HUD, marco CRT y modal de fin) en la ruta `/juegos/rocas/jugar`, sustituyendo el mock para ese juego mediante un registro que deja intacto el mock para el resto.

## Alcance

**Dentro:**

- Nuevo componente cliente **`app/_components/games/AsteroidsGame.tsx`**: el juego Asteroids portado desde `game.js` a TypeScript. Canvas con `ref`, bucle de juego en `useEffect` con `requestAnimationFrame`, y **cleanup total al desmontar** (cancelar el `rAF`, quitar listeners de teclado). Sin estado global de módulo: todo el estado del juego vive dentro del efecto/instancia.
- El componente **eleva su estado a React** mediante callbacks (`onScore`, `onLives`, `onLevel`, `onGameOver`) y recibe control desde fuera (pausa y reinicio). El canvas solo dibuja nave, asteroides, balas, partículas y power-ups; **no dibuja HUD ni overlays de texto** (los pone la plataforma).
- **Registro de juegos jugables** en **`app/_components/games/registry.ts`**: mapa `id → componente` (vía `dynamic()` de `next/dynamic`). Hoy solo contiene `rocas → AsteroidsGame`.
- **`GamePlayerScreen.tsx`** se modifica para: si el `game.id` está en el registro, montar el componente real dentro del `<div className="crt-screen">` y **cablear su HUD/botones al juego real** (score/vidas/nivel reales, PAUSA real, FIN, JUGAR DE NUEVO); si **no** está en el registro, mantener **exactamente** el mock actual (ticker falso, enemigos CSS).
- Se porta el **juego completo** tal cual el código de referencia: rotación/propulsión con inercia y drag, wrap toroidal, disparo con cooldown, split de asteroides (grande→mediano→pequeño), partículas de explosión, 3 vidas con invencibilidad y parpadeo al reaparecer, avance de nivel, y el **power-up de triple disparo** (drop, TTL, duración).
- **Controles de teclado**: `←`/`→` rotar, `↑` propulsar, `Espacio` disparar. Los listeners se atan de forma que no rompan el scroll/pausa de la página, y **`Space`/flechas hacen `preventDefault`** solo mientras el juego está activo y con foco.
- **Puntuación (score)** de la partida real alimenta el HUD y el modal de "FIN DEL JUEGO" existente; el guardado sigue siendo el mock actual (`GUARDAR PUNTUACIÓN` → toast, sin backend).
- El juego se detiene/pausa correctamente al pulsar **PAUSA** y al perder el foco de la pestaña (sin "spiral of death": `dt` capado como en el original).

**Fuera de alcance (para futuras specs):**

- **Persistencia real de puntuación** y leaderboards reales (Supabase). El modal de guardado y los `seededScores` siguen siendo mock.
- **Controles táctiles / móvil**. Solo teclado; el detalle seguirá anunciando "TÁCTIL" pero no se implementa aquí.
- **Prellenado del nombre del jugador con la sesión** de SPEC 04. El nombre arranca en `INVITADO` como hoy.
- **Sonido / efectos de audio.** El original no tiene; no se añade.
- **Adaptar los otros 7 juegos** del catálogo. Siguen con el mock vía el fallback del registro. Cada uno irá en su propia spec enchufándose al registro.
- **Cambiar el catálogo** (`data/games.ts`): título, cover, descripción, `best`, `plays` de `rocas` no se tocan.
- **Tests.** Sigue sin haber runner.

## Modelo de datos

Esta spec **no crea tablas ni persistencia**. Los "datos" son tipos en memoria: el contrato entre el juego (canvas) y la plataforma (React), más el registro de juegos jugables. No se toca `data/games.ts` ni los mocks.

**Contrato del componente de juego** (`app/_components/games/AsteroidsGame.tsx`):

```ts
// Estado del juego que interesa a la plataforma
export type PlayableStatus = "playing" | "dead" | "gameover";

// Lo que el juego emite hacia React (HUD + modal de fin)
export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  status: PlayableStatus;
};

export type PlayableGameProps = {
  paused: boolean;                       // control externo (botón PAUSA)
  onSnapshot: (s: GameSnapshot) => void; // el juego avisa de cada cambio relevante
  onGameOver: (finalScore: number) => void;
};

// Handle imperativo para los botones de la plataforma (reinicio)
export type PlayableGameHandle = {
  restart: () => void;
};
```

- `AsteroidsGame` se define con `forwardRef<PlayableGameHandle, PlayableGameProps>` para exponer `restart()` (lo llama el botón "JUGAR DE NUEVO").
- `paused` entra por prop; dentro del efecto, un `ref` espejo evita reejecutar el efecto y recrear el juego en cada pausa.
- `onSnapshot` se llama solo cuando cambia algún campo (no en cada frame), para no saturar React. El HUD deriva `score`/`lives`/`level`/`status` de ahí.

**Registro de juegos jugables** (`app/_components/games/registry.ts`):

```ts
import type { ComponentType } from "react";
import type { PlayableGameProps, PlayableGameHandle } from "./AsteroidsGame";

// Componente con ref imperativo
type PlayableGame = ComponentType<
  PlayableGameProps & { ref?: React.Ref<PlayableGameHandle> }
>;

// id de data/games.ts → componente real (carga diferida)
export const PLAYABLE_GAMES: Record<string, PlayableGame> = {
  rocas: dynamic(() => import("./AsteroidsGame")),
};

export function getPlayableGame(id: string): PlayableGame | null {
  return PLAYABLE_GAMES[id] ?? null;
}
```

**Constantes del juego** (portadas 1:1 desde `game.js`, tipadas): `W=800`, `H=600`, `RADII`, `SPEEDS`, `POINTS`, `POWERUP_DROP_CHANCE=0.15`, `POWERUP_DURATION=5`, `POWERUP_TTL=12`, `TRIPLE_SPREAD=0.18`, y las de la nave (`ROT`, `THRUST`, `DRAG`, cooldown, invencibilidad). Viven dentro del módulo del juego, no en `data/`.

Notas de diseño:

1. **`onSnapshot` en vez de un callback por métrica.** Un solo snapshot discriminado por `status` simplifica el cableado del HUD y evita cuatro props de callback separadas.
2. **Handle imperativo solo para `restart`.** Pausa va por prop (estado declarativo de React); reiniciar es una orden puntual, encaja mejor como método imperativo que como toggle de prop.
3. **El canvas sigue siendo 800×600 lógicos.** El escalado responsivo (encajar en el `crt-screen`) se hace por CSS (`max-width`/`aspect-ratio`), no cambiando el sistema de coordenadas del juego.

## Plan de implementación

Antes de escribir el componente, **leer** `node_modules/next/dist/docs/01-app/…` la guía relevante de `next/dynamic` y de componentes cliente (`"use client"`) en Next 16, tal como exige `AGENTS.md`. El original usa listeners globales de `window` y `rAF` sin cleanup; en React eso hay que traducirlo a un efecto con desmontaje limpio.

Cada paso deja la app arrancable con `npm run dev`.

1. **Portar la lógica pura a TypeScript (sin React todavía).**
   Crear `app/_components/games/AsteroidsGame.tsx` con `"use client"`. Trasladar las clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` y las utilidades (`wrap`, `dist`, `rand`, `randInt`) tipadas, y las funciones `spawnAsteroids`, `initGame`, `nextLevel`, `explode`, `killShip`, `update`, `draw`, `loop`. Todo **encapsulado en una función de fábrica** (`createGame(canvas, ctx, hooks)`) que devuelve `{ start, stop, restart, setPaused }` y recibe callbacks para emitir el snapshot — nada de estado a nivel de módulo.
   Verificación: `npx tsc --noEmit` pasa; el módulo no declara variables mutables fuera de `createGame`.

2. **Cablear el ciclo de vida React.**
   El componente `AsteroidsGame` (con `forwardRef<PlayableGameHandle, PlayableGameProps>`): `useRef` para el `<canvas>`; `useEffect` de montaje que crea el juego con `createGame`, ata los listeners de teclado (a `window`, pero **removidos en el cleanup**), arranca el `rAF` y **cancela `rAF` + quita listeners al desmontar**. `useImperativeHandle` expone `restart()`. Un `useEffect` aparte propaga `paused` → `game.setPaused()`. El snapshot se emite vía `onSnapshot`/`onGameOver` (con `useRef` a los callbacks para no recrear el juego).
   Verificación: montar y desmontar la ruta no deja listeners ni bucles vivos (sin warnings en consola; el `rAF` se detiene).

3. **Emisión de snapshot y game over.**
   Dentro de `update`, cuando cambie `score`, `lives`, `level` o `state`, invocar el hook de snapshot (comparando con el último emitido para no llamar cada frame). Al pasar a `gameover`, invocar `onGameOver(score)`. El manejo de `Space` para reiniciar del original se **elimina** del canvas (lo gobierna la plataforma vía `restart()`).
   Verificación: en pantalla, destruir un asteroide sube el score del HUD real; perder 3 vidas dispara el modal.

4. **Registro de juegos jugables.**
   Crear `app/_components/games/registry.ts` con `PLAYABLE_GAMES` (`rocas → dynamic(() => import("./AsteroidsGame"))`) y `getPlayableGame(id)`.
   Verificación: `getPlayableGame("rocas")` devuelve componente; `getPlayableGame("caida")` devuelve `null`.

5. **Integrar en `GamePlayerScreen`.**
   En el componente cliente: `const Playable = getPlayableGame(game.id)`. Si existe, montar `<Playable ref/paused/onSnapshot/onGameOver />` dentro de `crt-screen` en lugar de la `game-arena` mock, y **derivar el HUD** (score/vidas/nivel/estado) del snapshot en vez del ticker `setInterval`. PAUSA controla la prop `paused`; FIN fuerza game over; "JUGAR DE NUEVO" llama a `ref.current.restart()` y limpia el modal. Si `Playable` es `null`, se mantiene **intacta** la rama mock actual (ticker, enemigos CSS, botones tal cual).
   Verificación: `/juegos/rocas/jugar` muestra el juego real; `/juegos/caida/jugar` sigue mostrando el mock idéntico a antes.

6. **Escalado responsivo del canvas dentro del CRT.**
   Ajustar el canvas (800×600 lógicos) para que encaje en `crt-screen` vía CSS (`width:100%`, `height:auto`, `aspect-ratio:4/3`, `image-rendering` acorde al estilo retro) sin tocar las coordenadas del juego ni las reglas globales de `globals.css` que usan otras pantallas. Si hace falta CSS nuevo, va **scopeado** (módulo o `style` local del componente), no en `globals.css`.
   Verificación: el juego se ve completo y nítido dentro del marco CRT en desktop; el `body` no hace scroll horizontal.

7. **Foco y teclado.**
   Asegurar que las flechas y `Space` hacen `preventDefault` **solo** cuando el juego está activo (no en pausa/gameover) para no scrollear la página, y que al pausar se liberan. Los botones de la plataforma no roban el disparo.
   Verificación: jugar no scrollea la página con `Space`; en pausa, `Space` no dispara.

8. **Pasada de pausa/blur.**
   Confirmar que PAUSA congela el juego (sin avanzar `update`) y que el cap de `dt` (≤ 50 ms) evita el salto al volver de una pestaña en segundo plano.
   Verificación: pausar y esperar; al reanudar la nave no "teletransporta".

9. **Prueba manual de extremo a extremo.**
   Jugar una partida completa en `/juegos/rocas/jugar`: rotar, propulsar, disparar, partir asteroides, recoger el power-up de triple disparo, subir de nivel, morir 3 veces, abrir el modal, guardar (mock) y "JUGAR DE NUEVO". Salir a `/juegos/rocas` y volver a entrar (verificar que no quedan bucles del render anterior).

10. **Pasada final.**
    `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación en `/juegos/rocas/jugar` ni en `/juegos/caida/jugar`.

Apuntes sobre el orden:

- **La lógica pura (1) va antes que el cableado React (2)**: primero un juego que corre, luego su ciclo de vida.
- **El registro (4) va antes de tocar `GamePlayerScreen` (5)**: si no, el player importaría algo que aún no existe.
- **El fallback al mock (5) es el seguro de no-regresión**: los otros 7 juegos no deben cambiar en absoluto.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/rocas/jugar` ni en `/juegos/caida/jugar`.

**Estructura y registro**

- [ ] Existen `app/_components/games/AsteroidsGame.tsx` y `app/_components/games/registry.ts`.
- [ ] `AsteroidsGame.tsx` empieza con `"use client"` y no declara estado mutable a nivel de módulo (todo dentro de `createGame`/el componente).
- [ ] `getPlayableGame("rocas")` devuelve un componente; `getPlayableGame("caida")` (y cualquier otro id) devuelve `null`.
- [ ] `AsteroidsGame` se exporta con `forwardRef` y expone `restart()` vía `useImperativeHandle`.

**Juego real en `/juegos/rocas/jugar`**

- [ ] Al entrar, se ve el canvas del juego real dentro del marco CRT (no la `game-arena` mock).
- [ ] `←`/`→` rotan la nave, `↑` propulsa (con inercia y drag), `Espacio` dispara con cooldown.
- [ ] Los asteroides se envuelven en los bordes (wrap toroidal) y se parten grande→mediano→pequeño; los pequeños no se parten.
- [ ] Destruir un asteroide suma puntos según tamaño (100/50/20) y **el HUD de la plataforma refleja el score real** (no un ticker aleatorio).
- [ ] El HUD muestra vidas y nivel reales; al limpiar todos los asteroides se avanza de nivel.
- [ ] Aparece el power-up de triple disparo, se puede recoger, y el HUD indica el triple disparo activo mientras dura.
- [ ] Al reaparecer tras morir, la nave parpadea y es invencible temporalmente.
- [ ] Al perder las 3 vidas se abre el modal "FIN DEL JUEGO" con la **puntuación final real**.

**Controles de la plataforma cableados al juego**

- [ ] "PAUSA" congela el juego (no avanza `update`); "REANUDAR" lo continúa sin salto de posición.
- [ ] "FIN" fuerza el fin de la partida y abre el modal.
- [ ] "JUGAR DE NUEVO" reinicia el juego vía `restart()` (score 0, 3 vidas, nivel 1) y cierra el modal.
- [ ] "SALIR"/"VOLVER AL VAULT" navegan fuera y **no dejan bucles `rAF` ni listeners vivos** (al volver a entrar el juego arranca limpio).
- [ ] `Espacio` y flechas hacen `preventDefault` solo con el juego activo; en pausa/gameover no disparan ni scrollean la página.

**No regresión**

- [ ] `/juegos/caida/jugar` (y cualquier juego sin entrada en el registro) muestra el **mock idéntico** al de antes: ticker de score, enemigos CSS, botones PAUSA/FIN/SALIR.
- [ ] `data/games.ts` no cambia (título, cover, descripción, `best`, `plays` de `rocas` intactos).
- [ ] `app/globals.css` no cambia; cualquier CSS nuevo del juego va scopeado al componente.
- [ ] Las rutas de specs anteriores (`/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about`, `/auth`) siguen respondiendo 200.
- [ ] El `body` no hace scroll horizontal por el canvas en `/juegos/rocas/jugar`.

## Decisiones

**Mapeo al catálogo**

- **Sí:** reutilizar el id `rocas` existente. Ya describe "pulveriza asteroides", ya tiene cover, categoría SHOOTER y leaderboard. Crear un id nuevo duplicaría la ficha sin ganar nada.
- **No:** un id `asteroids`/`asteroides` nuevo. Dejaría `rocas` como mock huérfano y partiría el catálogo.

**Forma de integrar el código**

- **Sí:** reescribir a un componente cliente TypeScript con el juego encapsulado en `createGame`, listeners atados y removidos en el efecto, `rAF` cancelado al desmontar. Es lo idiomático en React 19 / `strict` y lo único que garantiza no dejar bucles vivos al navegar.
- **No:** cargar el `game.js` vanilla tal cual. Su estado global de módulo y sus listeners de `window` sin cleanup se llevan mal con el montaje/desmontaje de React y con `strict`.

**HUD y chrome**

- **Sí:** reusar el HUD, el marco CRT y el modal de fin de la plataforma; el canvas solo dibuja entidades. Mantiene coherencia visual con el resto del sitio y evita dos HUD compitiendo.
- **No:** que el canvas pinte su propio HUD/overlays. Chocaría con el chrome existente y duplicaría la puntuación en pantalla.

**Contrato juego ↔ React**

- **Sí:** `onSnapshot` (un objeto discriminado por `status`) para las métricas, y `restart()` imperativo vía `forwardRef`/`useImperativeHandle`. Pausa es estado declarativo (prop); reiniciar es una orden puntual y encaja como método.
- **No:** cuatro callbacks separados por métrica, ni reinicio por prop `runId`. Más ruido de props para el mismo efecto.
- **Sí:** emitir snapshot solo al cambiar un campo, no cada frame. Evita saturar React con 60 renders/s.

**Alcance del juego**

- **Sí:** portar el juego completo tal cual el código, incluido el power-up de triple disparo que el README no menciona pero el código sí implementa. Portar "lo que hay" evita decidir qué recortar y da paridad con la referencia.
- **No:** recortar a lo del README. Perdería features ya hechas sin motivo.

**Patrón reutilizable**

- **Sí:** un registro `id → componente` con fallback al mock. El siguiente juego solo se enchufa al registro; `GamePlayerScreen` no vuelve a tocarse por juego.
- **No:** solución puntual solo para `rocas`. Obligaría a reescribir el player en cada juego nuevo.
- **Sí:** carga diferida con `next/dynamic`. El código del juego no entra en el bundle de rutas que no lo juegan.

**Exclusiones deliberadas**

- **Sí:** dejar el guardado de puntuación como mock. La persistencia real (Supabase + leaderboards) es otro corte que dependerá de esta spec.
- **Sí:** solo teclado. Los controles táctiles son una spec propia; meterlos aquí mezcla dos problemas.
- **Sí:** nombre del jugador en `INVITADO`. Prellenarlo con la sesión de SPEC 04 es cosmético y arrastra auth a esta spec sin necesidad.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **`rAF` y listeners que sobreviven al desmontaje.** Al salir del juego y volver, quedan bucles y teclado duplicados corriendo en segundo plano (score fantasma, doble disparo, fugas). | El `useEffect` de montaje cancela el `rAF` y quita los listeners en su cleanup. Paso 2 y criterio explícito de "no deja bucles ni listeners vivos". |
| **Estado global de módulo al portar `game.js`.** El original usa variables mutables a nivel de archivo; en React eso se comparte entre montajes y rompe con `strict` (doble montaje en dev). | Todo el estado se encapsula en `createGame`; criterio de aceptación que prohíbe estado mutable a nivel de módulo. |
| **Doble montaje de React Strict Mode en dev.** El efecto corre dos veces; sin cleanup correcto se crean dos juegos. | El cleanup completo (paso 2) hace el efecto idempotente: montar→desmontar→montar deja un solo juego. |
| **`onSnapshot` llamado cada frame.** 60 `setState`/s degradan el HUD y saturan React. | Emitir snapshot solo cuando cambia un campo, comparando con el último. Decisión y paso 3. |
| **`Space`/flechas scrollean la página o roban foco.** `Space` hace scroll y las flechas mueven la página mientras se juega. | `preventDefault` solo con el juego activo (paso 7); en pausa/gameover se libera. Criterio de aceptación. |
| **`paused` recreando el juego.** Si `paused` está en las deps del efecto de montaje, cada pausa reinicia la partida. | `paused` va por un `useEffect` aparte que llama a `game.setPaused()`; el efecto de montaje no depende de `paused`. Paso 2. |
| **Salto de posición al volver de pestaña en segundo plano.** `dt` enorme teletransporta la nave y los asteroides. | Cap de `dt` ≤ 50 ms portado del original; verificado en el paso 8. |
| **Regresión del mock en los otros 7 juegos.** Tocar `GamePlayerScreen` rompe la rama que hoy funciona para los juegos sin adaptar. | El registro con fallback deja la rama mock intacta; criterio de no-regresión que compara `/juegos/caida/jugar` con el comportamiento previo. |
| **Canvas 800×600 desbordando el marco CRT** en pantallas pequeñas, provocando scroll horizontal. | Escalado por CSS scopeado (`aspect-ratio`, `width:100%`) sin tocar coordenadas ni `globals.css`. Paso 6 y criterio de "sin scroll horizontal". |
