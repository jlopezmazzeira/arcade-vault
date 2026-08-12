# SPEC 07 — Adaptación del juego Tetris (`caida`) a la plataforma

> **Status:** Approved
> **Depends on:** SPEC 05 (contrato de juego y registro), SPEC 06 (catálogo y puntuaciones)
> **Date:** 2026-08-11
> **Objective:** Portar el Tetris de `references/started-games/03-tetris/` a un componente cliente TypeScript jugable en `/juegos/caida/jugar` dentro del chrome existente (HUD, marco CRT, modal de fin y guardado real), extrayendo de paso el contrato juego↔plataforma a `types.ts` para que el HUD admita juegos sin vidas.

## Alcance

**Dentro:**

- Nuevo componente cliente **`app/_components/games/TetrisGame.tsx`**: el Tetris de `references/started-games/03-tetris/game.js` portado a TypeScript. Toda la lógica (tablero, piezas, colisión, rotación con wall kicks, ghost piece, limpieza de líneas, puntuación, niveles) encapsulada en `createGame(canvas, ctx, hooks)`; sin estado mutable a nivel de módulo.
- Su hoja **`app/_components/games/TetrisGame.module.css`** con el escalado del canvas dentro del `crt-screen`. CSS scopeado; `app/globals.css` no se toca.
- **Puerto de la referencia con las 7 piezas estándar** (I, O, T, S, Z, J, L). La octava pieza que `game.js` implementa —la `N` ("tuerca", anillo 3×3 gris), que el README no menciona— **se descarta por decisión del autor** (ver Decisiones).
- **Un único canvas de 800×600 lógicos** (4/3, el ratio del marco CRT) que compone: el tablero de 10×20 celdas de 30 px centrado horizontalmente (x = 250–550) y, a su derecha, el panel con el rótulo `SIGUIENTE` y la vista previa de la pieza siguiente. El fondo restante lleva la misma rejilla tenue del tablero. Un solo canvas, un solo `ResizeObserver`.
- **Extensión del contrato juego↔plataforma** — esta es la primera spec que la necesita, y por tanto la que carga con ella:
  - Nuevo **`app/_components/games/types.ts`** con `PlayableStatus`, `GameSnapshot`, `PlayableGameProps` y `PlayableGameHandle`. `GameSnapshot` pasa a tener `lives?` y `level?` opcionales y un `extra?: { label: string; value: string }[]`.
  - `AsteroidsGame.tsx` **re-exporta** esos tipos, para no romper los imports de `registry.ts:12` ni de `GamePlayerScreen.tsx:14`.
  - El `tripleShot: number` de Asteroids deja de ser campo propio del snapshot y pasa a una entrada de `extra` (`{ label: "Poder", value: "3× TRIPLE" }`).
  - El HUD de `GamePlayerScreen` se vuelve **condicional**: `Vidas` y `Nivel` solo se pintan si el snapshot trae el campo, y cada entrada de `extra` se pinta como un `hud-stat` más. `INITIAL_SNAPSHOT` deja de inventar vidas y niveles.
- **Emisión de snapshot**: el juego emite `score`, `level` y `extra: [{ label: "Líneas", value }]`. **No emite `lives`** — Tetris no tiene vidas, y el HUD omite ese hueco.
- **Controles de teclado**: `←`/`→` mover, `↑` o `X` rotar en sentido horario, `↓` soft drop, `Espacio` hard drop. Con **DAS propio** (retardo inicial ~170 ms, repetición ~50 ms) sobre el mapa de teclas presionadas, en lugar de la repetición nativa del sistema operativo.
- **Registro**: la línea `caida: dynamic(() => import("./TetrisGame"))` en `app/_components/games/registry.ts`. Con eso `/juegos/caida/jugar` conmuta solo de la rama mock a la real.
- **Guardado real de puntuación**: no se escribe nada. `saveScore` y `getTopScores` ya son genéricos por `game_id` (SPEC 06); registrar el juego basta para que el modal de fin inserte la puntuación real de la partida en `public.scores`.
- **Sin migración ni cover art nuevo.** Se reutiliza el id `caida`, ya sembrado en `public.games` con su portada `cover-tetro`, categoría `PUZZLE` y leaderboard.
- **No regresión explícita**: `rocas` sigue funcionando igual (HUD con vidas, nivel y power-up, pausa, reinicio, guardado real), y un juego aún mock mantiene su ticker falso y su toast. Como `caida` deja de ser mock, **el testigo pasa a ser `serpentina`**.

**Fuera de alcance (para futuras specs):**

- **Audio.** El original no tiene sonido; no se añade.
- **Controles táctiles / móvil.** Solo teclado.
- **Tecla `P` de pausa.** La pausa es estado declarativo de la plataforma (prop `paused` + botón PAUSA/REANUDAR). Que el juego la conmutara por su cuenta desincronizaría el botón del HUD.
- **Pieza en reserva (_hold_).** No está en la referencia.
- **Bolsa de 7 (_7-bag_).** Se conserva el `random` uniforme del original, ahora sobre las 7 piezas.
- **Kicks SRS completos.** Se portan los kicks básicos `[0, −1, +1, −2, +2]` de la referencia.
- **_Lock delay_.** La pieza se fija en cuanto colisiona, como en el original.
- **Toggle de tema claro/oscuro con `localStorage`.** Es chrome del original; Arcade Vault tiene el suyo.
- **`best` y `plays` derivados** de las puntuaciones reales de `caida`. Siguen siendo columnas estáticas (decisión de la SPEC 06).
- **Adaptar los 6 juegos aún mock.** Cada uno irá en su propia spec enchufándose al registro.
- **Tests.** Sigue sin haber runner.

## Modelo de datos

Esta spec **no crea tablas ni migraciones**. Los "datos" son tres cosas: el contrato tipado entre el juego y la plataforma, las constantes del juego, y la fila de catálogo que ya existe.

### (a) Contrato con la plataforma

Los tipos se extraen de `AsteroidsGame.tsx` a **`app/_components/games/types.ts`**:

```ts
export type PlayableStatus = "playing" | "dead" | "gameover";

export type GameSnapshot = {
  score: number; // única métrica obligatoria
  status: PlayableStatus;
  lives?: number; // el HUD omite "Vidas" si no viene
  level?: number; // el HUD omite "Nivel" si no viene
  extra?: { label: string; value: string }[]; // Líneas, Poder…
};

export type PlayableGameProps = {
  paused: boolean;
  onSnapshot: (s: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

export type PlayableGameHandle = { restart: () => void };
```

`AsteroidsGame.tsx` re-exporta los cuatro tipos; `registry.ts` y `GamePlayerScreen.tsx` no cambian sus imports.

**Qué emite cada juego:**

| Juego               | `score` | `lives` | `level` | `extra`                                                              |
| ------------------- | ------- | ------- | ------- | -------------------------------------------------------------------- |
| `rocas` (Asteroids) | sí      | sí (3)  | sí      | `[{ label: "Poder", value: "3× TRIPLE" }]` mientras dure el power-up |
| `caida` (Tetris)    | sí      | **no**  | sí      | `[{ label: "Líneas", value: String(lines) }]`                        |

`status` es siempre `"playing"` o `"gameover"` en Tetris; el estado `"dead"` (muerte con vidas restantes) no aplica.

**Regla de emisión:** `onSnapshot` se llama solo cuando cambia un campo respecto al último emitido, nunca por frame.

### (b) Constantes del juego

Portadas 1:1 desde `game.js` y tipadas, dentro de `TetrisGame.tsx` (no en `data/`):

| Constante                              | Valor                                                                                                                            | Origen          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `COLS` / `ROWS` / `BLOCK`              | `10` / `20` / `30`                                                                                                               | `game.js:3-5`   |
| `COLORS`                               | 7 colores indexados 1–7 (`#4dd0e1` I, `#ffd54f` O, `#ba68c8` T, `#81c784` S, `#e57373` Z, `#90caf9` J, `#ffb74d` L)              | `game.js:7-17`  |
| `PIECES`                               | 7 matrices de forma, indexadas 1–7 (sin la `N` del original)                                                                     | `game.js:19-29` |
| `LINE_SCORES`                          | `[0, 100, 300, 500, 800]`, multiplicado por `level`                                                                              | `game.js:31`    |
| `KICKS`                                | `[0, -1, 1, -2, 2]`                                                                                                              | `game.js:81`    |
| `HARD_DROP_POINTS`                     | `2` por celda recorrida                                                                                                          | `game.js:125`   |
| `SOFT_DROP_POINTS`                     | `1` por fila                                                                                                                     | `game.js:133`   |
| `LINES_PER_LEVEL`                      | `10` → `level = floor(lines / 10) + 1`                                                                                           | `game.js:111`   |
| `DROP_BASE` / `DROP_STEP` / `DROP_MIN` | `1000` / `90` / `100` → `dropInterval = max(100, 1000 - (level - 1) * 90)` ms                                                    | `game.js:112`   |
| `GHOST_ALPHA`                          | `0.2`                                                                                                                            | `game.js:204`   |

Constantes **nuevas**, propias de la adaptación:

| Constante                  | Valor             | Motivo                                                                            |
| -------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `VIEW_W` / `VIEW_H`        | `800` / `600`     | Lienzo lógico 4/3, el ratio del `crt-screen`                                      |
| `BOARD_X` / `BOARD_Y`      | `250` / `0`       | Tablero (300×600) centrado horizontalmente: ocupa x = 250–550                     |
| `PANEL_X`                  | `550`             | Panel de `SIGUIENTE` a la derecha del tablero (250 px de ancho)                   |
| `PREVIEW_CELL`             | `30`              | Rejilla 4×4 de la vista previa → 120×120, centrada en el panel                    |
| `DAS_DELAY` / `DAS_REPEAT` | `170` / `50` (ms) | Repetición propia de `←`/`→`/`↓`, en vez de la del sistema operativo              |
| `DT_CAP`                   | `50` (ms)         | Exigido por el contrato: evita el salto al volver de una pestaña en segundo plano |

Tipos internos del juego:

```ts
type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Cell = 0 | PieceType; // 0 = celda vacía
type Board = Cell[][]; // ROWS × COLS
type Piece = { type: PieceType; shape: Cell[][]; x: number; y: number };
```

### (c) Fila del catálogo

**Reutiliza el id `caida`, ya sembrado en `public.games` por la SPEC 06: no hay migración, ni cover art nuevo, ni entrada nueva en la unión `CoverArt`.** Su fila ya trae `title: "CAÍDA"`, `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`, `best: 184220`, `plays: "31.8K"` y sus 12 filas de siembra en `public.scores`. Ninguna de esas columnas se toca.

Notas de diseño:

1. **`extra` es `{ label, value: string }`, no un número.** El juego formatea; el HUD solo pinta. Así "Líneas" (número) y "3× TRIPLE" (texto) caben en la misma estructura sin que el HUD tenga que saber de cuál se trata.
2. **`tripleShot` sale del snapshot.** Mantenerlo como campo propio obligaba a que todo juego futuro conociera un concepto de Asteroids. Como entrada de `extra`, el HUD deja de tener ramas por juego.
3. **Un solo canvas para tablero y preview.** El original usa dos (`#board` y `#next-canvas`); aquí se compone en uno para tener un único `ResizeObserver` y un único escalado DPR.
4. **El tablero conserva sus coordenadas de celda.** El desplazamiento a x = 250 se aplica solo al dibujar; `collide()`, `ghostY()` y `merge()` siguen trabajando en coordenadas de rejilla 10×20, idénticas al original.

## Plan de implementación

Antes de escribir el componente, **leer** en `node_modules/next/dist/docs/01-app/…` la guía de componentes cliente (`"use client"`) y de `next/dynamic` en Next 16, como exige `AGENTS.md`. El original usa listeners globales de `document`, estado mutable a nivel de archivo y escrituras directas al DOM (`scoreEl.textContent`, overlay, botón de reinicio, toggle de tema con `localStorage`); **todo eso desaparece**: el estado va dentro de `createGame` y las métricas salen por `onSnapshot`.

Cada paso deja la app arrancable con `npm run dev` y es commiteable por separado.

1. **Extraer el contrato a `types.ts` y volver condicional el HUD.**
   Crear `app/_components/games/types.ts` con `PlayableStatus`, `GameSnapshot` (con `lives?`, `level?` y `extra?`), `PlayableGameProps` y `PlayableGameHandle`. Hacer que `AsteroidsGame.tsx` los re-exporte, para no tocar los imports de `registry.ts:12` ni de `GamePlayerScreen.tsx:14`. En `GamePlayerScreen.tsx`: pintar `Vidas` (`:96-124`) solo si `snap.lives !== undefined`, `Nivel` solo si `snap.level !== undefined`, y mapear `snap.extra` a `hud-stat` adicionales sustituyendo el bloque condicional de `tripleShot` (`:116-123`). Ajustar `INITIAL_SNAPSHOT` (`:48-54`) para que no invente vidas ni nivel. En `AsteroidsGame.tsx`, emitir el power-up como `extra: [{ label: "Poder", value: "3× TRIPLE" }]` en vez de `tripleShot: number`.
   Verificación: `npx tsc --noEmit` pasa; `/juegos/rocas/jugar` muestra el HUD **idéntico** al de antes (Jugador, Puntuación, Vidas, Nivel, y "Poder / 3× TRIPLE" solo mientras dura el power-up).

2. **Modelo y reglas de Tetris en TypeScript puro.**
   Crear `app/_components/games/TetrisGame.tsx` con `"use client"`. Portar tipados: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES` (las 7), `LINE_SCORES`, `KICKS`, y las funciones `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`. Los tipos `PieceType`, `Cell`, `Board` y `Piece` del modelo de datos. Puntuación: `LINE_SCORES[cleared] * level`, hard drop `+2` por celda, soft drop `+1` por fila; `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)`.
   Verificación: `npx tsc --noEmit` pasa; el módulo no declara variables mutables fuera de la fábrica.

3. **Bucle, dibujo y fábrica `createGame`.**
   `createGame(canvas, ctx, hooks): GameController` con `{ start, stop, restart, setPaused }`, encerrando todo el estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `animId`). El bucle acumula `dt` **capado a `DT_CAP` (50 ms)** y baja la pieza al superar `dropInterval`. El dibujo compone en 800×600: rejilla tenue de fondo, tablero en x = 250–550, ghost con `globalAlpha = 0.2`, pieza actual, y el panel derecho (x ≥ 550) con el rótulo `SIGUIENTE` y la vista previa 4×4. En pausa **no avanza `update` pero sigue dibujando** el último fotograma, para que el overlay de la plataforma se vea sobre el tablero. `restart()` deja tablero vacío, `score 0`, `lines 0`, `level 1`, `dropInterval 1000` y dos piezas nuevas.
   Verificación: el canvas dibuja tablero, pieza, ghost y preview; las piezas caen y se aceleran al subir de nivel.

4. **Cablear el ciclo de vida React.**
   `TetrisGame` con `forwardRef<PlayableGameHandle, PlayableGameProps>`: `useRef` al `<canvas>`, `useEffect` de montaje que crea el juego, lo arranca, y en el **cleanup** cancela el `rAF`, quita los listeners de teclado y desconecta el `ResizeObserver`. `useImperativeHandle` expone `restart()`. Un `useEffect` **aparte** propaga `paused` → `setPaused()`. Los callbacks entran por refs espejo, no por dependencias del efecto.
   Verificación: entrar y salir de `/juegos/caida/jugar` varias veces no deja bucles ni listeners vivos; en desarrollo, el doble montaje de Strict Mode deja un solo juego.

5. **Emisión de snapshot y game over.**
   Emitir `{ score, level, extra: [{ label: "Líneas", value: String(lines) }], status }` **solo cuando cambia un campo** respecto al último emitido. Sin `lives`. Al colisionar una pieza recién generada en `spawn()`, pasar a `status: "gameover"` e invocar `onGameOver(score)`.
   Verificación: limpiar una línea sube el score y el contador de Líneas del HUD real; a las 10 líneas sube el Nivel; el HUD **no muestra el hueco de Vidas**; apilar hasta el techo abre el modal "FIN DEL JUEGO" con la puntuación real.

6. **Registro.**
   Añadir `caida: dynamic(() => import("./TetrisGame"))` a `PLAYABLE_GAMES` en `app/_components/games/registry.ts`.
   Verificación: `getPlayableGame("caida")` devuelve componente; `getPlayableGame("serpentina")` devuelve `null`.

7. **Escalado del canvas dentro del marco CRT.**
   Crear `app/_components/games/TetrisGame.module.css` con `.stage` (absoluto, `inset: 0`, centrado, fondo negro) y `.canvas` (`width: 100%`, `height: 100%`, `touch-action: none`), siguiendo el patrón de `AsteroidsGame.module.css`. El búfer se redimensiona a la resolución real × DPR (capado a 2) con un `ResizeObserver` y el contexto se escala; las coordenadas lógicas 800×600 no cambian. `app/globals.css` no se toca.
   Verificación: el tablero y el panel se ven completos y nítidos dentro del marco CRT, sin deformación ni bandas; el `body` no hace scroll horizontal.

8. **Foco, teclado y DAS.**
   Listeners atados a `window` en `start()` y quitados en `stop()`. `isTypingTarget(e.target)` para que el input de iniciales del modal no mueva piezas. `preventDefault` en flechas y `Espacio` **solo con el juego activo** (`isActive()`: ni en pausa ni en game over). Al pausar se sueltan todas las teclas. `←`/`→`/`↓` con DAS propio: primera acción inmediata, repetición tras `DAS_DELAY` (170 ms) cada `DAS_REPEAT` (50 ms), contada con el `dt` del bucle. `↑` y `X` rotan **sin** repetición (una rotación por pulsación). `Espacio` hace hard drop, también sin repetición.
   Verificación: mantener `←` desliza la pieza de forma continua y fluida; mantener `↑` no rota sin parar; `Espacio` no scrollea la página; en pausa ninguna tecla mueve nada.

9. **Prueba manual de extremo a extremo.**
   En `/juegos/caida/jugar`: mover, rotar contra la pared (wall kick), soft drop, hard drop, ver el ghost, limpiar una línea y un tetris (4 líneas), pasar de nivel y notar la aceleración, pausar y reanudar, pulsar FIN, apilar hasta el techo, guardar la puntuación en el modal y comprobarla en `/juegos/caida` y en `/salon`. Como invitado y con sesión. Salir a `/juegos/caida` y volver a entrar: la partida arranca limpia.

10. **Pasada final.**
    `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación en `/juegos/caida/jugar`, `/juegos/rocas/jugar` ni `/juegos/serpentina/jugar`. No hay migración, así que `get_advisors` no aplica.

Apuntes sobre el orden:

- **El paso 1 va primero, fuera del orden canónico.** El template coloca la extensión del contrato después de la emisión de snapshot, pero aquí hay una dependencia real: el snapshot de Tetris **no compila** contra el `GameSnapshot` rígido, que exige `lives` y `tripleShot`. Hacerlo primero además lo deja commiteable solo, con `rocas` como única superficie que verificar — si se rompe algo, se sabe en el acto y no mezclado con código de Tetris.
- **La lógica pura (2–3) va antes que el cableado React (4)**: primero un juego que corre, luego su ciclo de vida.
- **El registro (6) va después del componente (2–5)**: al revés, el player importaría un módulo que aún no existe.
- **El DAS (8) va después del bucle (3)**: la repetición se cuenta con el `dt` del bucle, no con un `setInterval` aparte, para que respete la pausa y el cap de `dt` sin lógica duplicada.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/caida/jugar`, `/juegos/rocas/jugar` ni `/juegos/serpentina/jugar`.

**Estructura y registro**

- [ ] Existen `app/_components/games/TetrisGame.tsx`, `app/_components/games/TetrisGame.module.css` y `app/_components/games/types.ts`.
- [ ] `TetrisGame.tsx` empieza con `"use client"` y no declara estado mutable a nivel de módulo: todo vive dentro de `createGame`.
- [ ] `TetrisGame` se exporta con `forwardRef` y expone `restart()` vía `useImperativeHandle`.
- [ ] `getPlayableGame("caida")` devuelve un componente; `getPlayableGame("serpentina")` devuelve `null`.
- [ ] `TetrisGame.tsx` importa sus tipos de `./types`, no de `./AsteroidsGame`.

**Contrato y HUD condicional**

- [ ] `types.ts` exporta `PlayableStatus`, `GameSnapshot`, `PlayableGameProps` y `PlayableGameHandle`, con `lives`, `level` y `extra` opcionales en `GameSnapshot`.
- [ ] `AsteroidsGame.tsx` re-exporta esos cuatro tipos; `registry.ts` y `GamePlayerScreen.tsx` compilan sin cambiar la ruta de sus imports.
- [ ] `GameSnapshot` ya no tiene el campo `tripleShot`.
- [ ] En `/juegos/caida/jugar` el HUD muestra Jugador, Puntuación, Nivel y Líneas, y **no muestra el hueco de Vidas**.
- [ ] En `/juegos/rocas/jugar` el HUD muestra Jugador, Puntuación, Vidas, Nivel y —solo mientras dura el power-up— "Poder / 3× TRIPLE", igual que antes de esta spec.

**Juego real en `/juegos/caida/jugar`**

- [ ] Al entrar se ve el canvas real dentro del marco CRT (no la `game-arena` mock), con el tablero de 10×20 centrado y el panel `SIGUIENTE` a su derecha.
- [ ] `←`/`→` mueven la pieza una columna; el movimiento se bloquea contra la pared y contra bloques ya fijados.
- [ ] `↑` y `X` rotan en sentido horario; una rotación pegada a la pared se resuelve desplazando la pieza hasta ±2 columnas (wall kick) o se descarta si ninguna posición cabe.
- [ ] `↓` baja una fila y suma **1 punto**; si no puede bajar, fija la pieza.
- [ ] `Espacio` cae al instante hasta la posición del ghost, sumando **2 puntos por celda recorrida**, y fija la pieza.
- [ ] El ghost se dibuja en la posición de aterrizaje de la pieza actual, semitransparente.
- [ ] Limpiar líneas suma `100 / 300 / 500 / 800` puntos por 1 / 2 / 3 / 4 líneas, **multiplicado por el nivel actual**.
- [ ] El contador de Líneas del HUD sube con cada línea limpiada; el Nivel sube a `floor(líneas / 10) + 1`.
- [ ] La velocidad de caída sigue `max(100, 1000 − (nivel − 1) × 90)` ms: al nivel 2 la pieza cae visiblemente más rápido que al nivel 1.
- [ ] Salen las **7 piezas estándar** (I, O, T, S, Z, J, L). La tuerca `N` de la referencia **no** aparece nunca.
- [ ] La vista previa del panel `SIGUIENTE` muestra la pieza que saldrá a continuación, y se actualiza al fijar la actual.
- [ ] La partida termina cuando una pieza recién generada ya colisiona; se abre el modal "FIN DEL JUEGO" con la puntuación final real.
- [ ] Mantener pulsada `←` o `→` desliza la pieza de forma continua tras ~170 ms, a ~50 ms por paso (DAS propio, no la repetición del sistema operativo).
- [ ] Mantener pulsada `↑` no rota de forma continua: una rotación por pulsación.

**Controles de la plataforma cableados al juego**

- [ ] "PAUSA" congela la caída y las teclas; "REANUDAR" continúa sin que la pieza salte de posición.
- [ ] "FIN" fuerza el fin de la partida y abre el modal con la puntuación real.
- [ ] "JUGAR DE NUEVO" reinicia vía `restart()`: tablero vacío, puntuación 0, líneas 0, nivel 1 y velocidad inicial; el modal se cierra.
- [ ] "SALIR" / "VOLVER AL VAULT" navegan fuera sin dejar bucles `rAF` ni listeners vivos; al volver a entrar la partida arranca limpia.
- [ ] `Espacio` y flechas hacen `preventDefault` solo con el juego activo; en pausa o game over no mueven piezas ni scrollean la página.
- [ ] Con el foco en el input de iniciales del modal, escribir no mueve ni rota la pieza.

**Guardado y leaderboard**

- [ ] Terminar una partida de `caida` y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `public.scores` con `game_id = 'caida'` y el `score` real de la partida.
- [ ] Como invitado, la fila lleva las iniciales escritas y `user_id = null`.
- [ ] Con sesión, la fila lleva el `display_name` y el `user_id` del usuario.
- [ ] La puntuación guardada aparece en el aside de `/juegos/caida` y en la pestaña de `caida` de `/salon` tras recargar.
- [ ] No se ha creado ninguna migración nueva ni se ha modificado `public.games`.

**No regresión**

- [ ] `/juegos/rocas/jugar` sigue funcionando igual: HUD con vidas y nivel, power-up de triple disparo visible, pausa, reinicio y guardado real.
- [ ] `/juegos/serpentina/jugar` (y el resto de ids sin entrada en el registro) mantiene el mock intacto: ticker de score falso, enemigos CSS y guardado por toast.
- [ ] `app/globals.css` no cambia; todo el CSS nuevo va en `TetrisGame.module.css`.
- [ ] `data/games.ts` no cambia.
- [ ] Las rutas de specs anteriores (`/`, `/biblioteca`, `/juegos/rocas`, `/juegos/caida`, `/salon`, `/about`, `/auth`) siguen respondiendo 200.
- [ ] El `body` no hace scroll horizontal por el canvas en `/juegos/caida/jugar`.

## Decisiones

**Id del catálogo**

- **Sí:** reutilizar el id `caida`, ya sembrado por la SPEC 06. Su ficha describe Tetris palabra por palabra ("Encaja las piezas antes de que el techo te aplaste", "La velocidad aumenta sin piedad cada 10 líneas"), y ya tiene portada `cover-tetro`, categoría `PUZZLE` y leaderboard con 12 filas.
- **No:** un id `tetris` nuevo. Habría exigido migración, clase `.cover-…` en `globals.css` y entrada en la unión `CoverArt`, y habría dejado `caida` como mock huérfano partiendo el catálogo.

**Alcance del puerto**

- **Sí:** portar la referencia, pero **solo con las 7 piezas estándar**. `game.js` implementa una octava —la tuerca `N`, un anillo 3×3 que el README no menciona— y `randomPiece()` la genera; queda **descartada por decisión del autor** (revisión del 2026-08-11, durante el paso 9): un anillo 3×3 con un hueco interior no encaja con nadie, sube mucho la dificultad y desdibuja el Tetris que la ficha de `caida` promete.
- **No:** portarla "porque está". Fue la propuesta inicial de esta spec, por paridad con la referencia y por darle identidad propia a `CAÍDA`; el autor la rechazó tras verla en juego.
- **No:** recortar a las 7 piezas estándar del README. Perdería una mecánica ya implementada sin motivo.
- **Sí:** portar ghost piece, wall kicks básicos y la tabla de puntuación clásica tal cual.
- **No:** añadir mecánicas que la referencia no tiene (hold, 7-bag, SRS completo, lock delay). Modernizar el Tetris es otra spec; aquí se porta.

**Campos del HUD**

- **Sí:** emitir `score`, `level` y `extra: [{ label: "Líneas", value }]`. Son las tres métricas que el panel del original muestra, y las tres que un jugador de Tetris necesita.
- **Sí:** **no** emitir `lives`, y que el HUD omita ese hueco. Tetris no tiene vidas; pintar "Vidas —" sería ruido, y pintar un 3 falso sería mentira.
- **No:** dejar "Líneas" solo en el modal de fin. Es la métrica que gobierna el nivel y la velocidad; sin ella en pantalla no se anticipa la aceleración.

**Quién carga con la extensión del contrato**

- **Sí:** esta spec extrae los tipos a `types.ts`, vuelve opcionales `lives`/`level`, añade `extra[]` y hace condicional el HUD. Es la primera que lo necesita, y el contrato lo asigna a la primera que lo necesite.
- **No:** que `TetrisGame` emitiera `lives: 0` para encajar en el `GameSnapshot` rígido. Habría dejado el HUD mostrando "Vidas" vacío en un juego sin vidas, y el problema intacto para el siguiente juego.
- **Sí:** que `AsteroidsGame.tsx` **re-exporte** los tipos. Evita tocar los imports de `registry.ts` y `GamePlayerScreen.tsx`, y reduce la superficie del refactor sobre código que ya funciona.
- **Sí:** `extra` como array de `{ label, value: string }` ya formateados. El HUD solo pinta, sin saber qué métrica es. Si en su lugar `GameSnapshot` creciera con un campo por métrica (`lines?`, `combo?`, `paddleSize?`), cada juego nuevo volvería a modificar `GamePlayerScreen`.
- **Sí:** migrar el `tripleShot: number` de Asteroids a una entrada de `extra`. Mantenerlo como campo propio del snapshot obligaba a todo juego futuro a conocer un concepto exclusivo de Asteroids.

**Composición del lienzo**

- **Sí:** un único canvas de **800×600 lógicos** que compone el tablero (300×600, centrado en x = 250–550) y el panel `SIGUIENTE` a su derecha. El ratio coincide con el 4/3 que impone `.crt-screen`, así que llena el marco sin bandas ni deformación, con un solo `ResizeObserver` y un solo escalado DPR.
- **No:** pilarboxear el tablero solo con bandas negras. Desperdiciaba la mayor parte del marco y dejaba la vista previa sin sitio.
- **No:** dos canvas (tablero + preview) maquetados con flex, como el original. Duplicaba el escalado DPR y el `ResizeObserver` para ganar fidelidad con un HTML que aquí no existe.
- **Sí:** el desplazamiento a x = 250 se aplica **solo al dibujar**. `collide()`, `ghostY()` y `merge()` siguen en coordenadas de rejilla 10×20, idénticas al original, que es donde están los bugs difíciles.

**Teclado**

- **Sí:** DAS propio (retardo inicial 170 ms, repetición 50 ms) contado con el `dt` del bucle. La repetición nativa del sistema operativo arranca a los ~500 ms y varía por máquina; en un juego de caída eso es la diferencia entre jugable e injugable a partir del nivel 8.
- **No:** un `setInterval` aparte para la repetición. Habría que pausarlo y limpiarlo en paralelo al bucle; contarlo con el `dt` respeta la pausa y el cap de `dt` sin lógica duplicada.
- **Sí:** eliminar la tecla `P` del original. `paused` es estado declarativo de la plataforma (prop + botón PAUSA/REANUDAR); si el juego la conmutara por su cuenta, el botón del HUD quedaría desincronizado del estado real. Mantenerla exigía añadir un `onTogglePause` al contrato, que ya se toca bastante en esta spec.
- **Sí:** rotación y hard drop sin repetición. Mantener `↑` pulsada no debe girar la pieza en bucle.

**Chrome del original que se elimina**

- **Sí:** quitar el panel lateral con `SCORE`/`LINES`/`LEVEL`, la lista de controles, el overlay compartido PAUSA/GAME OVER y su botón "Reiniciar". El HUD, el overlay de pausa y el modal de fin los pone la plataforma; dos HUD compitiendo es el error clásico al portar un juego vanilla.
- **Sí:** quitar el toggle de tema claro/oscuro y su `localStorage`. Arcade Vault tiene su propio chrome visual; el tema del original no tiene dónde encajar.
- **Sí:** conservar la vista previa de la pieza siguiente, dibujada dentro del canvas. Es información de juego, no HUD de plataforma: depende del estado interno y no encaja en `GameSnapshot`.

**Sin migración ni `globals.css`**

- **Sí:** esta spec **no** toca `app/globals.css` ni crea migraciones. Al reutilizar `caida` no hay cover art nuevo, así que la excepción que el contrato de plataforma concede a las portadas del catálogo no aplica aquí.

**Testigo de no-regresión**

- **Sí:** el juego mock testigo pasa de `caida` a **`serpentina`**. Las SPEC 05 y 06 usaban `/juegos/caida/jugar` para verificar que el mock seguía intacto; esta spec convierte precisamente ese id en juego real, así que el testigo tenía que moverse o el criterio quedaba vacío.

**Exclusiones deliberadas**

- **Sí:** sin audio. La referencia no tiene sonido y añadirlo mezcla dos problemas.
- **Sí:** solo teclado. Los controles táctiles son una spec propia, como ya decidió la SPEC 05.
- **Sí:** `best` y `plays` de `caida` siguen estáticos. Derivarlos de `scores` es una vertical aparte, declarada fuera de alcance desde la SPEC 06.

## Riesgos

| Riesgo                                                                                                                                                                                                                                                              | Mitigación                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El refactor de `types.ts` rompe el HUD de `rocas`.** Al volver condicionales `Vidas` y `Nivel` y migrar `tripleShot` a `extra`, Asteroids puede quedarse sin pintar métricas que hoy muestra.                                                                     | El paso 1 es commiteable solo y su única verificación es que `/juegos/rocas/jugar` muestra el HUD idéntico al de antes. Grupo propio de criterios de aceptación ("Contrato y HUD condicional"). |
| **`rAF` y listeners que sobreviven al desmontaje** (bucles fantasma, teclado duplicado, score que sigue subiendo al salir).                                                                                                                                         | Cleanup completo en el efecto de montaje: `cancelAnimationFrame`, `removeEventListener` y `ResizeObserver.disconnect()`. Criterio explícito de "al volver a entrar la partida arranca limpia".  |
| **Estado global de módulo al portar `game.js`.** El original declara `board`, `current`, `score`, `animId` y compañía a nivel de archivo; en React eso se comparte entre montajes.                                                                                  | Todo dentro de `createGame(canvas, ctx, hooks)`; criterio de aceptación que prohíbe estado mutable a nivel de módulo.                                                                           |
| **Doble montaje de React Strict Mode en desarrollo.** Sin cleanup correcto se crean dos juegos y las piezas caen al doble de velocidad.                                                                                                                             | El cleanup hace el efecto idempotente: montar→desmontar→montar deja un solo juego. Verificación del paso 4.                                                                                     |
| **`onSnapshot` llamado cada frame** (60 `setState`/s). El original llama a `updateHUD()` en cada `keydown` y en cada limpieza de líneas.                                                                                                                            | Emitir solo cuando cambia `score`, `level`, `lines` o `status` respecto al último snapshot. Paso 5 y regla del contrato.                                                                        |
| **`paused` en las dependencias del efecto de montaje** reiniciaría la partida en cada pausa.                                                                                                                                                                        | Efecto aparte que llama a `setPaused()`; el efecto de montaje no depende de `paused`. Paso 4.                                                                                                   |
| **`clearLines()` mal portado.** El original recorre de abajo arriba con `splice` + `unshift` y compensa el índice con `r++` dentro de un bucle decreciente. Traducirlo sin ese ajuste se salta una fila o entra en bucle infinito.                                  | Portar el bucle literalmente, con el ajuste de índice incluido. Criterio que verifica limpiar 1, 2, 3 y 4 líneas de una vez.                                                                    |
| **`dropAccum = 0` en vez de `dropAccum -= dropInterval`.** El original descarta el resto acumulado; a niveles altos (`dropInterval` de 100–190 ms) eso hace que la caída real sea más lenta que la nominal.                                                         | Restar `dropInterval` en vez de poner a cero, conservando el resto. Criterio que compara la velocidad visible entre nivel 1 y nivel 2.                                                          |
| **El cap de `dt` a 50 ms choca con el bucle de caída.** Al volver de una pestaña en segundo plano, sin cap la pieza caería decenas de filas de golpe.                                                                                                               | Cap de `dt` ≤ 50 ms antes de acumular en `dropAccum`. Como `dropInterval` mínimo es 100 ms, el cap nunca frena la caída legítima.                                                               |
| **Detener el `rAF` al terminar la partida deja el canvas sin repintar.** El original hace `cancelAnimationFrame` en `endGame()`; aquí el modal de fin se dibuja **encima** del canvas, y al redimensionar la ventana el búfer se recrearía en blanco tras el modal. | En pausa y en game over el bucle **no avanza `update` pero sigue dibujando** el último estado. El `rAF` solo se cancela en el cleanup del desmontaje. Paso 3.                                   |
| **Olvidar el desplazamiento `BOARD_X` en alguno de los dibujos.** El tablero, el ghost, la pieza actual y la rejilla se pintan con offset x = 250; la vista previa usa su propio origen. Un olvido descuadra una capa sobre las demás.                              | Un único helper de dibujo de celda que recibe el origen; las coordenadas de juego nunca llevan el offset. Prueba manual del paso 9 con ghost y pieza superpuestos.                              |
| **Teclas pegadas al pausar o al terminar.** Con DAS propio, una tecla marcada como pulsada seguiría repitiendo al reanudar y movería la pieza sola.                                                                                                                 | Al pausar se sueltan todas las teclas y se resetean los temporizadores de DAS; el DAS solo corre con el juego activo. Paso 8 y criterio de "en pausa ninguna tecla mueve nada".                 |
| **Hard drop encadenado.** Si `Espacio` entrara en la repetición de DAS, una pulsación mantenida fijaría varias piezas seguidas y vaciaría la cola.                                                                                                                  | `Espacio`, `↑` y `X` actúan una vez por pulsación, sin repetición. Criterio explícito.                                                                                                          |
| **`Espacio` y flechas scrollean la página o roban foco**, y el input de iniciales del modal mueve piezas al escribir.                                                                                                                                               | `preventDefault` solo con el juego activo (`isActive()`), e `isTypingTarget(e.target)` para ignorar el teclado cuando el foco está en un `input`. Paso 8.                                       |
| **Regresión del mock al tocar `GamePlayerScreen`.** El HUD condicional se comparte con la rama real; un error ahí podría alcanzar la rama mock.                                                                                                                     | Solo se toca la rama del juego real; la rama `MockGamePlayer` no se modifica. Criterio que verifica `/juegos/serpentina/jugar` con su ticker y su toast intactos.                               |
| **El texto `SIGUIENTE` dibujado en canvas con una fuente aún no cargada.** `next/font` carga Geist de forma asíncrona; el primer fotograma podría pintar con la fuente de sistema.                                                                                  | El rótulo se redibuja en cada fotograma, así que se corrige solo en cuanto la fuente está lista; no hay estado que invalidar.                                                                   |

## Lo que **no** entra en esta spec

- **Audio.** La referencia no tiene sonido y no se añade.
- **Controles táctiles / móvil.** Solo teclado.
- **Tecla `P` de pausa.** La pausa la gobierna la plataforma con la prop `paused` y el botón PAUSA/REANUDAR.
- **Pieza en reserva (_hold_).** No está en la referencia.
- **Bolsa de 7 (_7-bag_).** Se conserva el `random` uniforme del original, ahora sobre las 7 piezas.
- **Kicks SRS completos.** Se portan los kicks básicos `[0, −1, +1, −2, +2]` de la referencia.
- **_Lock delay_.** La pieza se fija en cuanto colisiona, como en el original.
- **Toggle de tema claro/oscuro con `localStorage`.** Es chrome del original; Arcade Vault tiene el suyo.
- **`best` y `plays` de `caida` derivados de las puntuaciones reales.** Siguen siendo columnas estáticas, por decisión de la SPEC 06.
- **Adaptar los 6 juegos aún mock** (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`). Cada uno se enchufará al registro en su propia spec.
- **Migraciones y cover art.** Se reutiliza `caida`, ya sembrado; `app/globals.css` y `data/games.ts` no se tocan.
- **Tests.** Sigue sin haber runner.

Cada uno de esos, si llega, va en su propia spec.
