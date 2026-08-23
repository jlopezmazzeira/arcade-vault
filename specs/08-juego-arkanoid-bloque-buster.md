# SPEC 08 — Adaptación del juego Arkanoid (`bloque-buster`) a la plataforma

> **Status:** Approved
> **Depends on:** SPEC 05 (contrato de juego y registro), SPEC 06 (catálogo y puntuaciones), SPEC 07 (`types.ts` y HUD condicional)
> **Date:** 2026-08-23
> **Objective:** Portar el Arkanoid de `references/started-games/04-arkanoid/` a un componente cliente TypeScript jugable en `/juegos/bloque-buster/jugar`, con sus sprites, sus 5 patrones de nivel en bucle infinito y guardado real de puntuación.

## Alcance

**Dentro:**

- Nuevo componente cliente **`app/_components/games/ArkanoidGame.tsx`**: el Arkanoid de `references/started-games/04-arkanoid/game.js` y `levels.js` portado a TypeScript. Paleta, pelota, bloques, colisiones, vidas, niveles y explosiones encapsulados en `createGame(canvas, ctx, hooks)`; sin estado mutable a nivel de módulo.
- Su hoja **`app/_components/games/ArkanoidGame.module.css`** con el escalado del canvas dentro del `crt-screen`. CSS scopeado; `app/globals.css` no se toca.
- **Lienzo de 800×600 lógicos**, el mismo de la referencia. Ya es 4/3, el ratio del marco CRT: llena el marco sin pilarbox ni panel lateral.
- **Assets gráficos**: `spritesheet-breakout.png` copiado a **`public/games/arkanoid/spritesheet-breakout.png`** (30 KB), y `assets/spritesheet.js` portado a helpers tipados dentro del componente (`SPRITES`, `EXPLOSION_FRAMES`, `drawSprite`, `drawFrame`). Se conserva la **animación de explosión de 4 frames / 150 ms** al romper un bloque.
- **Los 5 patrones de nivel** de `levels.js` (parrilla, pirámide, ajedrez, filas con huecos, marco+cruz), portados como generadores tipados.
- **Bucle infinito de niveles**: al limpiar el nivel N se carga el patrón `(N mod 5)` y el nivel sigue subiendo. El estado `win` de la referencia **desaparece**; la partida solo termina al agotar las 3 vidas.
- **Progresión de velocidad** `speed = min(2.0, 1.1^(nivel−1))`, que reproduce exactamente los cinco multiplicadores de la referencia y topa en ×2.0 a partir del nivel 9. La velocidad de la paleta escala con el mismo factor.
- **Física de rebote mejorada** respecto a la referencia: en la paleta, el punto de impacto determina el ángulo de salida conservando la rapidez; en los bloques se invierte el eje de menor penetración en vez de siempre `vy`.
- **Emisión de snapshot**: `score`, `lives` y `level`. **Sin `extra`** — las tres métricas del original encajan en los campos nativos del HUD.
- **Controles de teclado**: `←`/`→` mueven la paleta. Nada más en producción.
- **Selector de nivel solo en desarrollo**: teclas `1`–`5` con el juego en pausa, dentro de un `if (process.env.NODE_ENV === "development")` que Turbopack elimina del bundle de producción.
- **Registro**: la línea `"bloque-buster": dynamic(() => import("./ArkanoidGame"))` en `app/_components/games/registry.ts`.
- **Guardado real de puntuación**: no se escribe nada. `saveScore` y `getTopScores` ya son genéricos por `game_id`.
- **Sin migración ni cover art nuevo.** Se reutiliza el id `bloque-buster`, ya sembrado con `cover-bricks`, categoría `ARCADE`, color `cyan` y leaderboard.
- **Consumo de `types.ts`, sin extenderlo.** La SPEC 07 ya extrajo el contrato y volvió condicional el HUD; esta spec solo importa de `./types`.
- **No regresión explícita**: `rocas` y `caida` siguen funcionando igual, y `serpentina` mantiene su mock intacto.

**Fuera de alcance (para futuras specs):**

- **Audio.** Los dos MP3 de la referencia no se portan.
- **Control por ratón.** El original mueve la paleta con `mousemove`; aquí solo teclado, como `rocas` y `caida`.
- **Teclas `P` / `Escape` de pausa.** La pausa es estado declarativo de la plataforma.
- **Selector de nivel en producción.** Existe solo en desarrollo.
- **Power-ups, multibola, paleta que se encoge, bloques de varios impactos.** No están en la referencia.
- **Controles táctiles / móvil.**
- **`best` y `plays` derivados** de las puntuaciones reales. Siguen estáticos, por decisión de la SPEC 06.
- **Adaptar los 5 juegos aún mock.**
- **Tests.** Sigue sin haber runner.

## Modelo de datos

Esta spec **no crea tablas ni migraciones**, y **no extiende el contrato**: la SPEC 07 ya extrajo `types.ts` y volvió condicional el HUD. Los "datos" son tres cosas: qué emite este juego, sus constantes, y la fila de catálogo que ya existe.

### (a) Contrato con la plataforma

`ArkanoidGame.tsx` importa `PlayableStatus`, `GameSnapshot`, `PlayableGameProps` y `PlayableGameHandle` de **`./types`** — no de `./AsteroidsGame`. No se añade ningún campo a `GameSnapshot`.

El juego emite `score`, `lives`, `level` y `status`. **No emite `extra`**: las tres métricas que el original dibuja en su canvas (Score, Nivel, pelotitas de vidas) encajan una a una en los campos nativos del HUD.

| Juego                      | `score` | `lives` | `level` | `extra`                                             |
| -------------------------- | ------- | ------- | ------- | --------------------------------------------------- |
| `rocas` (Asteroids)        | sí      | sí (3)  | sí      | `[{ label: "Poder", … }]` mientras dure el power-up |
| `caida` (Tetris)           | sí      | no      | sí      | `[{ label: "Líneas", … }]`                          |
| `bloque-buster` (Arkanoid) | sí      | sí (3)  | sí      | **ninguna**                                         |

`status` vale `"playing"` o `"gameover"`. **`"dead"` no se usa**: al perder una vida la pelota se relanza en el acto, así que no hay estado intermedio que representar. Nadie consume `status` en el HUD — quien abre el modal de fin es `onGameOver`.

**Regla de emisión:** `onSnapshot` se llama solo cuando cambia `score`, `lives`, `level` o `status` respecto al último emitido, nunca por frame.

### (b) Constantes del juego

Portadas 1:1 desde `game.js`, `levels.js` y `assets/spritesheet.js`, tipadas, dentro de `ArkanoidGame.tsx`:

| Constante                             | Valor                                                                | Origen                |
| ------------------------------------- | -------------------------------------------------------------------- | --------------------- |
| `VIEW_W` / `VIEW_H`                   | `800` / `600`                                                        | `index.html`, 4/3     |
| `PADDLE_W` / `PADDLE_H` / `PADDLE_Y`  | `81` / `14` / `560`                                                  | `game.js:15`          |
| `PADDLE_BASE_SPEED`                   | `400` px/s                                                           | `game.js:4`           |
| `BALL_SIZE`                           | `16`                                                                 | `game.js:16`          |
| `BASE_BALL_VX` / `BASE_BALL_VY`       | `200` / `-300`                                                       | `game.js:12-13`       |
| `BLOCK_COLS` / `BLOCK_ROWS`           | `10` / `6`                                                           | `game.js:5-6`         |
| `BLOCK_W` / `BLOCK_H`                 | `64` / `24`                                                          | `game.js:7-8`         |
| `BLOCKS_ORIGIN_X` / `BLOCKS_ORIGIN_Y` | `80` / `80`                                                          | `game.js:10-11`       |
| `BLOCK_SCORE`                         | `10` por bloque                                                      | `game.js:140`         |
| `INITIAL_LIVES`                       | `3`                                                                  | `game.js:23`          |
| `EXPLOSION_DURATION` / frames         | `150` ms / `4`                                                       | `spritesheet.js:11`   |
| `SPRITES` / `EXPLOSION_FRAMES`        | Rects `{ sx, sy, sw, sh }` de paleta, pelota, 7 bloques y 7×4 frames | `spritesheet.js:1-25` |

Constantes **nuevas**, propias de la adaptación:

| Constante                               | Valor                                      | Motivo                                                                                                        |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `SPEED_STEP` / `SPEED_CAP`              | `1.1` / `2.0`                              | `speed(level) = min(2.0, 1.1^(level−1))`. Reproduce los 5 multiplicadores de `levels.js` y topa en el nivel 9 |
| `MIN_BOUNCE_ANGLE` / `MAX_BOUNCE_ANGLE` | `15°` / `60°`                              | Ángulo de salida de la paleta según el punto de impacto, acotado por ambos lados                              |
| `BALL_SPEED_BASE`                       | `hypot(200, 300) ≈ 360.6` px/s             | Rapidez de la pelota, invariante en los rebotes; solo la escala `speed(level)`                                |
| `MAX_STEP_PX`                           | `8`                                        | Desplazamiento máximo por sub-paso de física, contra el _tunneling_ a ×2.0                                    |
| `SPRITE_SRC`                            | `/games/arkanoid/spritesheet-breakout.png` | Ruta pública del spritesheet copiado                                                                          |
| `DT_CAP`                                | `50` ms                                    | Exigido por el contrato de plataforma                                                                         |

Tipos internos del juego:

```ts
type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";
type SpriteRect = { sx: number; sy: number; sw: number; sh: number };
type LevelCell = { col: number; row: number; color: BlockColor };
type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
};
type Paddle = { x: number; y: number; w: number; h: number };
type Ball = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};
```

**Reglas derivadas, escritas para que no haya que inferirlas:**

1. **Velocidad del nivel:** `speed = Math.min(SPEED_CAP, SPEED_STEP ** (level - 1))`. Al nivel 1 vale exactamente `1.00`; a los niveles 2–5, `1.10 / 1.21 / 1.331 / 1.4641`, los valores de `levels.js`.
2. **Paleta:** su velocidad es `PADDLE_BASE_SPEED * speed`, así que la relación paleta/pelota es constante en toda la partida.
3. **Patrón del nivel:** `LEVEL_PATTERNS[(level - 1) % 5]`. El nivel 6 reutiliza el patrón 1, el 7 el 2, y así indefinidamente.
4. **Rebote en la paleta:** `offset = clamp((ballCx − paddleCx) / (PADDLE_W / 2), −1, 1)`; `angle = offset * MAX_BOUNCE_ANGLE`, elevado a `MIN_BOUNCE_ANGLE` con el signo de `offset` (o el de `vx` si `offset` es exactamente 0) para que la pelota nunca quede vertical. La velocidad resultante es `vx = mag·sin(angle)`, `vy = −mag·cos(angle)`, con `mag = BALL_SPEED_BASE * speed`.
5. **Rebote en bloque:** se compara el solape en X con el solape en Y; se invierte el eje de **menor** penetración y se reposiciona la pelota justo fuera del bloque por ese eje.
6. **Sub-pasos:** cada frame, el movimiento de la pelota se parte en `ceil(distancia / MAX_STEP_PX)` sub-pasos, y las colisiones se resuelven en cada uno. Sin esto, a ×2.0 con un `dt` capado a 50 ms la pelota avanzaría 36 px por frame y atravesaría bloques de 24 px de alto.
7. **Un bloque por sub-paso**, no por frame: es la traducción correcta del `break` del original una vez introducidos los sub-pasos.
8. **Pérdida de vida:** `ball.y > VIEW_H` → `lives--`. Si queda alguna, la pelota se reposiciona sobre la paleta y sale disparada al instante. A 0 vidas, `status: "gameover"` y `onGameOver(score)`.

### (c) Fila del catálogo

**Reutiliza el id `bloque-buster`, ya sembrado en `public.games` por la SPEC 06: no hay migración, ni cover art nuevo, ni entrada nueva en la unión `CoverArt`.** Su fila ya trae `title: "BLOQUE BUSTER"`, `cat: "ARCADE"`, `cover: "cover-bricks"`, `color: "cyan"`, `best: 28450`, `plays: "12.4K"` y sus 12 filas de siembra en `public.scores`. Ninguna de esas columnas se toca. `data/games.ts` tampoco.

Notas de diseño:

1. **El spritesheet vive en `public/`, no en el bundle.** Se carga con `new Image()` dentro de `createGame` y se sirve como archivo estático. No interviene `next/image`: el destino es un `drawImage` sobre canvas, no un `<img>`.
2. **La partida no empieza hasta que la imagen está lista.** El bucle arranca de inmediato pero `update()` no avanza mientras `!ready`, así que ninguna vida se pierde por un sprite que aún no ha llegado.
3. **El original copia el PNG a un canvas intermedio** antes de dibujarlo (`spritesheet.js:38-44`). Ese paso se conserva: evita el coste de decodificación repetida en algunos navegadores.
4. **`imageSmoothingEnabled = false`** tras cada reescalado del contexto. El spritesheet es pixel art y el canvas se amplía a la resolución real × DPR; con suavizado, los bordes quedan borrosos.

## Plan de implementación

Antes de escribir el componente, **leer** en `node_modules/next/dist/docs/01-app/…` la guía de componentes cliente (`"use client"`) y de `next/dynamic` en Next 16, como exige `AGENTS.md`. El original usa listeners globales de `document`, estado mutable a nivel de archivo, `Audio` y escrituras al canvas para HUD y overlays; **todo eso desaparece o cambia de sitio**: el estado va dentro de `createGame`, las métricas salen por `onSnapshot`, y el HUD, la pausa y el modal de fin los pone la plataforma.

Cada paso deja la app arrancable con `npm run dev` y es commiteable por separado.

1. **Asset y helpers de spritesheet.**
   Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` a **`public/games/arkanoid/spritesheet-breakout.png`**. Crear `app/_components/games/ArkanoidGame.tsx` con `"use client"` y portar tipados `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` y los helpers `drawSprite(ctx, sheet, name, x, y, w, h)` y `drawFrame(ctx, sheet, frame, x, y, w, h)` — ahora reciben el sheet como parámetro, en vez de leerlo de una variable de módulo como hace `spritesheet.js:27-29`. El cargador (`new Image()` → canvas intermedio) también vive dentro de la fábrica, no en el módulo.
   Verificación: `npx tsc --noEmit` pasa; `curl -I http://localhost:3000/games/arkanoid/spritesheet-breakout.png` devuelve 200.

2. **Niveles y reglas puras en TypeScript.**
   Portar `levels.js` como `LEVEL_PATTERNS: LevelCell[][]`, con los cinco generadores (parrilla, pirámide con `pyStart`/`pyEnd`, ajedrez `(col + row) % 2 === 0`, filas con huecos `gaps4`, marco+cruz) y sus paletas de color por fila. Portar `speedForLevel`, `buildBlocks`, `collideAABB`, `resolveBlockBounce` (eje de menor penetración), `paddleBounce` (ángulo por punto de impacto, acotado a 15°–60°) y `stepBall` (sub-pasos de `MAX_STEP_PX`). Los tipos del modelo de datos.
   Verificación: `npx tsc --noEmit` pasa; el módulo no declara variables mutables fuera de la fábrica; `LEVEL_PATTERNS` suma 60 / 40 / 30 / 39 / 39 celdas.

3. **Bucle, dibujo y fábrica `createGame`.**
   `createGame(canvas, ctx, hooks): GameController` con `{ start, stop, restart, setPaused }`, encerrando todo el estado (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `level`, `paused`, `gameOver`, `ready`, `sheet`, `animId`, `keys`). El bucle capa `dt` a `DT_CAP`, y **no avanza `update` mientras `!ready`, en pausa o en game over, pero sigue dibujando** el último fotograma, para que el overlay de PAUSA y el modal de fin de la plataforma se vean sobre el juego. `update` mueve la paleta, avanza la pelota por sub-pasos resolviendo paredes, paleta y bloques, envejece las explosiones y descuenta vida al salir la pelota por abajo. Al quedar todos los bloques muertos: `level++` y `buildBlocks(LEVEL_PATTERNS[(level − 1) % 5])`, con la pelota relanzada a la velocidad del nuevo nivel. `draw` pinta fondo negro, bloques vivos, explosiones (frame `min(floor(elapsed / EXPLOSION_DURATION * 4), 3)`), paleta y pelota — **sin score, sin nivel, sin pelotitas de vidas y sin overlays**. `restart()` deja `level 1`, `lives 3`, `score 0`, paleta centrada, patrón 1 y explosiones vacías.
   Verificación: la pelota rebota, rompe bloques con su explosión, limpiar un nivel carga el siguiente, y limpiar el nivel 5 vuelve al patrón 1 con el nivel en 6.

4. **Cablear el ciclo de vida React.**
   `ArkanoidGame` con `forwardRef<PlayableGameHandle, PlayableGameProps>`: `useRef` al `<canvas>`, `useEffect` de montaje que crea el juego, lo arranca, y en el **cleanup** cancela el `rAF`, quita los listeners de teclado, desconecta el `ResizeObserver` y anula `img.onload` para que la carga en vuelo no toque un juego ya desmontado. `useImperativeHandle` expone `restart()`. Un `useEffect` **aparte** propaga `paused` → `setPaused()`. Los callbacks entran por refs espejo, no por dependencias del efecto.
   Verificación: entrar y salir de `/juegos/bloque-buster/jugar` varias veces no deja bucles ni listeners vivos; en desarrollo, el doble montaje de Strict Mode deja un solo juego y una sola pelota.

5. **Emisión de snapshot y game over.**
   Emitir `{ score, lives, level, status }` **solo cuando cambia un campo** respecto al último emitido. Al llegar `lives` a 0: `status: "gameover"` e invocar `onGameOver(score)`.
   Verificación: romper un bloque sube la Puntuación de 10 en 10 en el HUD real; perder la pelota baja Vidas; limpiar el nivel sube Nivel; agotar las 3 vidas abre el modal "FIN DEL JUEGO" con la puntuación real.

6. **Registro.**
   Añadir `"bloque-buster": dynamic(() => import("./ArkanoidGame"))` a `PLAYABLE_GAMES` en `app/_components/games/registry.ts`.
   Verificación: `getPlayableGame("bloque-buster")` devuelve componente; `getPlayableGame("serpentina")` devuelve `null`.

7. **Escalado del canvas dentro del marco CRT.**
   Crear `app/_components/games/ArkanoidGame.module.css` con `.stage` (absoluto, `inset: 0`, centrado, fondo negro) y `.canvas` (`width: 100%`, `height: 100%`, `touch-action: none`), siguiendo el patrón de `AsteroidsGame.module.css`. El búfer se redimensiona a la resolución real × DPR (capado a 2) con un `ResizeObserver`, el contexto se escala y se pone **`imageSmoothingEnabled = false`** tras cada reescalado. Las coordenadas lógicas 800×600 no cambian. `app/globals.css` no se toca.
   Verificación: el juego llena el marco CRT sin bandas ni deformación; los sprites se ven nítidos, no borrosos; el `body` no hace scroll horizontal.

8. **Foco, teclado y selector de desarrollo.**
   Listeners atados a `window` en `start()` y quitados en `stop()`. `isTypingTarget(e.target)` para que el input de iniciales del modal no mueva la paleta. `preventDefault` en `←`/`→` **solo con el juego activo** (`isActive()`: ni cargando, ni en pausa, ni en game over). Al pausar se sueltan todas las teclas. Dentro de `if (process.env.NODE_ENV === "development")`, las teclas `1`–`5` **con el juego en pausa** cargan ese patrón de nivel; sin `preventDefault`, porque los dígitos no scrollean.
   Verificación: mantener `←` desliza la paleta de forma continua; `←`/`→` no scrollean la página; en pausa la paleta no se mueve; en un `npm run build`, `grep -r "NODE_ENV" .next/static` no encuentra el bloque del selector.

9. **Prueba manual de extremo a extremo.**
   En `/juegos/bloque-buster/jugar`: romper bloques y ver la explosión, comprobar que el punto de impacto en la paleta cambia el ángulo, que la pelota no atraviesa bloques ni se queda rebotando en vertical, limpiar el nivel 1 y notar la aceleración del 2, perder las tres vidas, pausar y reanudar, pulsar FIN, "JUGAR DE NUEVO", guardar la puntuación en el modal y comprobarla en `/juegos/bloque-buster` y en `/salon`. Como invitado y con sesión. Salir a `/juegos/bloque-buster` y volver a entrar: la partida arranca limpia. En desarrollo, saltar a los niveles 2–5 con las teclas para revisar los cuatro patrones restantes.

10. **Pasada final.**
    `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación en `/juegos/bloque-buster/jugar`, `/juegos/rocas/jugar`, `/juegos/caida/jugar` ni `/juegos/serpentina/jugar`. No hay migración, así que `get_advisors` no aplica.

Apuntes sobre el orden:

- **El asset va en el paso 1, antes que la lógica.** Todo el dibujo de este juego depende del spritesheet: sin él, los pasos 2 y 3 no se pueden verificar mirando la pantalla, solo leyendo el código. Es además el paso más barato de revertir si el PNG diera problemas de ruta.
- **La lógica pura (2–3) va antes que el cableado React (4)**: primero un juego que corre, luego su ciclo de vida.
- **No hay paso de extensión del contrato.** El orden canónico lo coloca aquí, pero la SPEC 07 ya extrajo `types.ts` y volvió condicional el HUD. Esta spec solo consume, y por eso `ArkanoidGame.tsx` importa de `./types` y no de `./AsteroidsGame`.
- **No hay paso de migración ni de cover art.** Se reutiliza `bloque-buster`, ya sembrado.
- **El registro (6) va después del componente (1–5)**: al revés, el player importaría un módulo que aún no existe.
- **Los sub-pasos de física (2) van antes que el escalado del canvas (7)** aunque el tunneling se note al jugar rápido: es una regla del modelo, no de la presentación, y meterla después obligaría a reescribir `update`.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/bloque-buster/jugar`, `/juegos/rocas/jugar`, `/juegos/caida/jugar` ni `/juegos/serpentina/jugar`.

**Estructura y registro**

- [ ] Existen `app/_components/games/ArkanoidGame.tsx` y `app/_components/games/ArkanoidGame.module.css`.
- [ ] `ArkanoidGame.tsx` empieza con `"use client"` y no declara estado mutable a nivel de módulo: todo vive dentro de `createGame`, incluidos `sheet` y `ready`.
- [ ] `ArkanoidGame` se exporta con `forwardRef` y expone `restart()` vía `useImperativeHandle`.
- [ ] `ArkanoidGame.tsx` importa sus tipos de `./types`, no de `./AsteroidsGame`.
- [ ] `getPlayableGame("bloque-buster")` devuelve un componente; `getPlayableGame("serpentina")` devuelve `null`.
- [ ] No se ha añadido ningún campo a `GameSnapshot` en `app/_components/games/types.ts`.

**Assets**

- [ ] Existe `public/games/arkanoid/spritesheet-breakout.png` y la ruta `/games/arkanoid/spritesheet-breakout.png` responde 200.
- [ ] Paleta, pelota y bloques se dibujan desde el spritesheet, no con primitivas de canvas.
- [ ] Romper un bloque reproduce la animación de explosión de 4 frames del color del bloque, durante 150 ms.
- [ ] Mientras el spritesheet no ha cargado, la partida no avanza: no se mueve la pelota ni se pierden vidas.
- [ ] Los sprites se ven nítidos, sin suavizado, tanto en pantalla normal como en pantalla de DPR 2.
- [ ] No se ha añadido ningún archivo de audio al repositorio.

**Juego real en `/juegos/bloque-buster/jugar`**

- [ ] Al entrar se ve el canvas real dentro del marco CRT (no la `game-arena` mock), con los bloques del nivel 1 en parrilla 10×6, la paleta abajo y la pelota sobre ella.
- [ ] `←`/`→` mueven la paleta y la bloquean contra los bordes del lienzo.
- [ ] Romper un bloque suma **10 puntos** y elimina ese bloque.
- [ ] Golpear la paleta cerca del borde izquierdo devuelve la pelota hacia la izquierda, y cerca del borde derecho hacia la derecha; golpear el centro la devuelve casi vertical, pero **nunca del todo vertical**.
- [ ] La rapidez de la pelota no cambia al rebotar: solo cambia su dirección.
- [ ] Golpear un bloque por el lateral invierte la componente horizontal de la pelota, no la vertical.
- [ ] La pelota no atraviesa bloques sin romperlos, ni siquiera en el nivel 9 o superior.
- [ ] Limpiar todos los bloques carga el nivel siguiente con su patrón y su velocidad, sin perder la puntuación acumulada.
- [ ] Los cinco patrones son los de la referencia: parrilla completa, pirámide centrada, tablero de ajedrez, filas con huecos, y marco con cruz central.
- [ ] Limpiar el nivel 5 carga el **patrón 1 con el nivel en 6**: la partida no termina y no aparece ninguna pantalla de victoria.
- [ ] Limpiar cinco niveles consecutivos desde el 1 suma exactamente **2080 puntos** (60 + 40 + 30 + 39 + 39 bloques × 10).
- [ ] La velocidad sigue `min(2.0, 1.1^(nivel−1))`: al nivel 2 la pelota va visiblemente más rápida que al 1, y del nivel 9 en adelante ya no acelera más.
- [ ] La paleta se mueve más rápido conforme sube el nivel, con el mismo multiplicador que la pelota.
- [ ] Dejar caer la pelota resta una vida y la relanza al instante desde la paleta.
- [ ] Perder la tercera vida termina la partida y abre el modal "FIN DEL JUEGO" con la puntuación final real.
- [ ] El canvas **no** dibuja score, ni nivel, ni pelotitas de vidas, ni overlay de PAUSA, ni overlay de GAME OVER: todo eso lo pone la plataforma.
- [ ] El HUD muestra Jugador, Puntuación, Vidas y Nivel, y **ninguna métrica de `extra`**.

**Selector de nivel de desarrollo**

- [ ] En `npm run dev`, con el juego en pausa, las teclas `1`–`5` cargan ese patrón de nivel.
- [ ] Con el juego activo (sin pausa), las teclas `1`–`5` no hacen nada.
- [ ] Tras `npm run build`, el bloque del selector no aparece en el bundle de producción (`grep` sobre `.next/static` no lo encuentra).

**Controles de la plataforma cableados al juego**

- [ ] "PAUSA" congela la pelota, la paleta y las explosiones; "REANUDAR" continúa sin que la pelota salte de posición.
- [ ] "FIN" fuerza el fin de la partida y abre el modal con la puntuación real.
- [ ] "JUGAR DE NUEVO" reinicia vía `restart()`: nivel 1, 3 vidas, puntuación 0, paleta centrada y velocidad inicial; el modal se cierra.
- [ ] "SALIR" / "VOLVER AL VAULT" navegan fuera sin dejar bucles `rAF` ni listeners vivos; al volver a entrar la partida arranca limpia.
- [ ] `←`/`→` hacen `preventDefault` solo con el juego activo; en pausa o game over no mueven la paleta ni scrollean la página.
- [ ] Con el foco en el input de iniciales del modal, escribir no mueve la paleta.

**Guardado y leaderboard**

- [ ] Terminar una partida de `bloque-buster` y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `public.scores` con `game_id = 'bloque-buster'` y el `score` real de la partida.
- [ ] Como invitado, la fila lleva las iniciales escritas y `user_id = null`.
- [ ] Con sesión, la fila lleva el `display_name` y el `user_id` del usuario.
- [ ] La puntuación guardada aparece en el aside de `/juegos/bloque-buster` y en la pestaña de `bloque-buster` de `/salon` tras recargar.
- [ ] No se ha creado ninguna migración nueva ni se ha modificado `public.games`.

**No regresión**

- [ ] `/juegos/rocas/jugar` sigue funcionando igual: HUD con vidas y nivel, power-up de triple disparo, pausa, reinicio y guardado real.
- [ ] `/juegos/caida/jugar` sigue funcionando igual: HUD sin vidas, con Nivel y Líneas, y guardado real.
- [ ] `/juegos/serpentina/jugar` (y el resto de ids sin entrada en el registro) mantiene el mock intacto: ticker de score falso, enemigos CSS y guardado por toast.
- [ ] `app/globals.css` no cambia; todo el CSS nuevo va en `ArkanoidGame.module.css`.
- [ ] `data/games.ts`, `app/_components/games/types.ts` y `app/_components/GamePlayerScreen.tsx` no cambian.
- [ ] Las rutas de specs anteriores (`/`, `/biblioteca`, `/juegos/rocas`, `/juegos/caida`, `/juegos/bloque-buster`, `/salon`, `/about`, `/auth`) siguen respondiendo 200.
- [ ] El `body` no hace scroll horizontal por el canvas en `/juegos/bloque-buster/jugar`.

## Decisiones

**Id del catálogo**

- **Sí:** reutilizar el id `bloque-buster`, ya sembrado por la SPEC 06. Su ficha describe Arkanoid palabra por palabra ("Rebota la pelota y destruye muros de neón", "Cada nivel reorganiza la grilla en patrones imposibles"), y ya tiene portada `cover-bricks`, categoría `ARCADE`, color `cyan` y leaderboard con 12 filas.
- **No:** un id `arkanoid` nuevo. Habría exigido migración con `position` 9, clase `.cover-…` en `globals.css` y entrada en la unión `CoverArt`, y habría dejado `bloque-buster` como mock huérfano describiendo el mismo juego.

**Fin de partida: bucle infinito en vez de victoria**

- **Sí:** eliminar el estado `win` de la referencia y encadenar los cinco patrones indefinidamente (`LEVEL_PATTERNS[(level − 1) % 5]`), con el nivel subiendo sin techo. La partida solo acaba al agotar las 3 vidas.
- **No:** portar el `win` de los 5 niveles. Los 208 bloques de la referencia valen **2080 puntos** como máximo absoluto; en una plataforma cuyo eje es el leaderboard, eso significa que todo jugador competente empata en la cima y la tabla deja de ordenar nada. La columna `best: 28450` de la ficha, además, quedaría inalcanzable para siempre.
- **No:** escalar los puntos por nivel (10 × nivel) manteniendo el `win`. Sube el techo a ~2900 pero sigue siendo un techo, y se aleja de la referencia sin resolver el empate.
- **Sí:** conservar los 10 puntos planos por bloque. Con niveles infinitos, la puntuación ya mide cuánto aguantas; multiplicarla además por el nivel haría que los primeros niveles fueran ruido estadístico.

**Progresión de velocidad y su cap**

- **Sí:** `speed = min(2.0, 1.1^(nivel − 1))`. La fórmula reproduce **exactamente** los cinco multiplicadores que `levels.js` lista a mano (1.00, 1.10, 1.21, 1.331, 1.4641), así que los niveles 1–5 se juegan igual que en la referencia, y extiende la progresión sin inventar nada.
- **Sí:** topar en ×2.0, que entra en el nivel 9. Sin cap, al nivel 20 la pelota iría a ×6.1 — unos 2200 px/s en un lienzo de 600 px de alto — y el bucle infinito dejaría de ser un reto para ser un muro. Del nivel 9 en adelante la dificultad la aporta el patrón.
- **No:** topar en ×1.46, el máximo de la referencia. Nunca jugaríamos a una velocidad que el original no tuviera, pero la partida dejaría de escalar en el nivel 5 y el resto sería repetición sin tensión.
- **Sí:** escalar la velocidad de la paleta con el mismo factor (`400 × speed`). Al ser solo teclado, una paleta fija a 400 px/s contra una pelota a ×2.0 haría que los niveles altos se perdieran por limitación del control, no por habilidad. Al nivel 1 son los 400 px/s de la referencia, idénticos.

**Física del rebote**

- **Sí:** el punto de impacto en la paleta determina el ángulo de salida, acotado entre 15° y 60°, conservando la rapidez. Es el rebote clásico de Arkanoid y lo que convierte la paleta en un instrumento de puntería.
- **No:** portar el rebote de la referencia, que **solo invierte `vy`** tanto en la paleta como en los bloques. La pelota nunca cambiaría de ángulo horizontal en toda la partida: el jugador solo decide si sigue viva, no adónde va. Con 5 niveles eso se tolera; con niveles infinitos y un leaderboard, el score pasaría a medir suerte.
- **Sí:** el mínimo de 15°. Sin él, un impacto centrado deja la pelota perfectamente vertical y la partida entra en un rebote estéril entre paleta y techo por la misma columna.
- **Sí:** en los bloques, invertir el eje de **menor penetración** en vez de siempre `vy`. Con el rebote original, una pelota que entra por el lateral de una columna la atraviesa horizontalmente sin que el rebote tenga sentido físico.
- **Sí:** sub-pasos de física de 8 px como máximo. A ×2.0 con el `dt` capado a 50 ms que exige el contrato, la pelota avanzaría 36 px por frame y atravesaría bloques de 24 px de alto sin tocarlos. Es un bug que solo aparece en niveles altos, es decir justo donde nadie prueba.
- **Sí:** un bloque por **sub-paso**, no por frame. Es la traducción correcta del `break` del original una vez que el movimiento se subdivide.

**Assets gráficos**

- **Sí:** copiar `spritesheet-breakout.png` a `public/games/arkanoid/` y portar `drawSprite`/`drawFrame`. Son 30 KB, y en este juego **todo** se dibuja desde el spritesheet: paleta, pelota, siete colores de bloque y las explosiones de 4 frames. Conserva la spec 02 de la referencia entera.
- **No:** sustituirlo por primitivas de canvas al estilo neón del vault. Habría que rediseñar la explosión desde cero, que es una mecánica ya implementada y probada, y perderíamos la identidad visual que la ficha promete.
- **Sí:** cargar la imagen dentro de `createGame`, no en una variable de módulo como hace `spritesheet.js:27-29`. El contrato prohíbe estado mutable de módulo, y un `ssLoaded` compartido sobreviviría al desmontaje.
- **Sí:** no dejar avanzar `update()` hasta que la imagen esté lista. El original arranca el bucle dentro del callback de carga; aquí el bucle arranca antes para poder dibujar, así que el freno va en `update`. Sin él, la primera partida podría perder una vida contra un canvas invisible.
- **Sí:** `imageSmoothingEnabled = false`. El spritesheet es pixel art y el canvas se amplía a la resolución real × DPR; con suavizado los sprites salen borrosos dentro del marco CRT.

**Controles**

- **Sí:** solo `←`/`→`. Es lo coherente con `rocas` y `caida`, y deja una superficie menos que limpiar en el desmontaje.
- **No:** portar el control por ratón (`mousemove` sobre el canvas). Es el control nativo de Arkanoid y es más preciso, pero introduce un listener sobre un canvas que además está escalado dentro del marco CRT, y ningún otro juego de la plataforma lo usa. Se compensa escalando la velocidad de la paleta con el nivel.
- **Sí:** eliminar las teclas `P` y `Escape` del original. `paused` es estado declarativo de la plataforma; si el juego lo conmutara por su cuenta, el botón PAUSA/REANUDAR del HUD quedaría desincronizado. Misma decisión que la SPEC 07.

**Selector de nivel**

- **Sí:** teclas `1`–`5` con el juego **en pausa**, dentro de `if (process.env.NODE_ENV === "development")`. Es el mismo gesto del original —el selector vivía en su overlay de pausa— trasladado a teclado, y Turbopack elimina el bloque del bundle de producción.
- **No:** portar los botones dibujados en el canvas con clic (`game.js:70-85, 183-212`). El overlay de PAUSA lo pinta la plataforma; unos botones dibujados debajo competirían visualmente con él, y exigirían el listener de ratón que ya se descartó.
- **No:** dejarlo disponible en producción. Volver al nivel 1 desde uno alto devuelve 60 bloques frescos a velocidad ×1.0, lo que permite acumular puntuación indefinidamente y contaminaría `public.scores` con marcas no comparables.
- **No:** dejarlo en producción pero restringido a saltos hacia adelante. Es inexplotable, pero sigue siendo un atajo no documentado en ningún sitio del HUD, y su único propósito real es depurar patrones.

**Campos del HUD**

- **Sí:** emitir `score`, `lives` y `level`. Son exactamente las tres métricas que el original dibuja en su canvas, y las tres tienen campo nativo en el HUD de la plataforma.
- **Sí:** **no** emitir `extra`. Este es el primer juego que encaja entero en los campos nativos, y esa es la señal de que el contrato de la SPEC 07 quedó bien dimensionado.
- **No:** añadir "Bloques restantes" como entrada de `extra`. El dato ya se ve en pantalla —son los bloques dibujados— y añade un campo más que emitir y comparar en cada frame.
- **Sí:** no usar `status: "dead"`. La pelota se relanza en el acto al perder una vida, así que no hay estado intermedio que representar; y nadie consume `status` en el HUD.

**Vida perdida**

- **Sí:** relanzamiento inmediato, como la referencia. La pelota reaparece sobre la paleta y sale disparada; `status` sigue en `"playing"` y el HUD refleja la vida perdida por el snapshot.
- **No:** saque manual con `Espacio` y `status: "dead"` mientras espera. Evitaría perder dos vidas seguidas por no haber recolocado la paleta, pero añade un estado a la máquina del juego y una tecla más para resolver un problema que la referencia no tiene.

**Chrome del original que se elimina**

- **Sí:** quitar el score de la esquina, el nivel centrado, las pelotitas de vidas, el overlay `GAME OVER`, el overlay `¡Completaste el juego!` y el overlay de PAUSA con su selector. El HUD, la pausa y el modal de fin los pone la plataforma; dos HUD compitiendo es el error clásico al portar un juego vanilla.
- **Sí:** conservar la animación de explosión dibujada en el canvas. Es información de juego, no HUD de plataforma.

**Lo que esta spec NO carga**

- **Sí:** consumir `types.ts` sin tocarlo. La SPEC 07 ya extrajo el contrato y volvió condicional el HUD, así que esta spec no modifica `GamePlayerScreen.tsx` en absoluto — lo que reduce a cero el riesgo de regresión sobre `rocas` y `caida`.
- **Sí:** no crear migraciones ni tocar `app/globals.css`. Al reutilizar `bloque-buster` no hay cover art nuevo, así que la excepción que el contrato de plataforma concede a las portadas del catálogo no aplica aquí.

**Testigo de no-regresión**

- **Sí:** el juego mock testigo sigue siendo **`serpentina`**, el que fijó la SPEC 07. Esta spec convierte `bloque-buster` en juego real, pero `serpentina` no estaba implicado y no hay que moverlo.

**Exclusiones deliberadas**

- **Sí:** sin audio, pese a que la referencia sí tiene dos MP3 —a diferencia de Asteroids y Tetris—. El sonido en la plataforma necesita decisiones que ningún juego tiene resueltas todavía: gesto de activación que exigen los navegadores, un mute persistente en el chrome, y volumen compartido entre juegos. Resolver eso dentro de una spec de puerto mezcla dos problemas; va en su propia spec, y entonces beneficiará a los tres juegos.
- **Sí:** sin power-ups, multibola, paleta que se encoge ni bloques de varios impactos. No están en la referencia; modernizar el Arkanoid es otra spec, aquí se porta.
- **Sí:** solo teclado, sin controles táctiles. Como ya decidieron la SPEC 05 y la 07.
- **Sí:** `best` y `plays` de `bloque-buster` siguen estáticos. Derivarlos de `scores` es una vertical aparte, declarada fuera de alcance desde la SPEC 06.

## Riesgos

| Riesgo                                                                                                                                                                                                                                                                       | Mitigación                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El spritesheet no ha cargado al arrancar la partida.** El original arranca el bucle dentro del callback de carga (`game.js:264`); aquí el bucle arranca antes para poder dibujar, así que una pelota invisible podría caerse y costar una vida.                            | El bucle dibuja siempre, pero `update()` no avanza mientras `!ready`. Criterio de aceptación explícito: "mientras el spritesheet no ha cargado, la partida no avanza".                                    |
| **`img.onload` dispara sobre un juego ya desmontado.** Navegar fuera antes de que el PNG llegue dejaría un callback tocando estado muerto.                                                                                                                                   | `stop()` anula `img.onload` además de cancelar el `rAF` y quitar listeners. Paso 4.                                                                                                                       |
| **Ruta del asset mal resuelta.** `spritesheet.js:48` usa la ruta relativa `assets/spritesheet-breakout.png`; copiarla tal cual la rompería, porque la página se sirve desde `/juegos/bloque-buster/jugar`.                                                                   | Ruta absoluta desde `public/`: `/games/arkanoid/spritesheet-breakout.png`, en una constante `SPRITE_SRC`. Criterio que verifica un 200 sobre esa URL.                                                     |
| **_Tunneling_ a velocidades altas.** A ×2.0 con el `dt` capado a 50 ms que exige el contrato, la pelota avanza 36 px por frame y atraviesa bloques de 24 px de alto sin romperlos. Solo se manifiesta del nivel 9 en adelante, es decir donde nadie prueba.                  | Sub-pasos de `MAX_STEP_PX` = 8 px, resolviendo colisiones en cada uno. Criterio explícito: "la pelota no atraviesa bloques ni siquiera en el nivel 9 o superior".                                         |
| **Pelota atrapada en vertical.** Con el rebote por punto de impacto, un golpe perfectamente centrado da ángulo 0 y la pelota rebota eternamente entre paleta y techo por la misma columna.                                                                                   | `MIN_BOUNCE_ANGLE` de 15° con el signo del offset (o el de `vx` si el offset es exactamente 0). Criterio: "golpear el centro la devuelve casi vertical, pero nunca del todo vertical".                    |
| **Pelota atrapada en casi horizontal.** El extremo opuesto: un ángulo próximo a 90° deja la pelota rebotando entre paredes laterales sin acercarse a los bloques.                                                                                                            | `MAX_BOUNCE_ANGLE` de 60°, que garantiza una componente vertical de al menos el 50 % de la rapidez.                                                                                                       |
| **Re-colisión con el mismo bloque en sub-pasos consecutivos**, que invertiría el eje dos veces y dejaría la pelota atravesando la fila.                                                                                                                                      | Al resolver, el bloque se marca `alive: false` y la pelota se reposiciona **fuera** del bloque por el eje de menor penetración antes de continuar. Un bloque por sub-paso.                                |
| **La paleta se dibuja a 162 px "porque es lo que mide el sprite".** `SPRITES.paddle` es de 162×14 pero `game.js:15` declara `w: 81`: el original comprime el sprite a la mitad. Al portar, la tentación de "arreglarlo" duplica el ancho de la paleta y destruye el balance. | `PADDLE_W = 81` documentado en las constantes con esa nota. El ancho del sprite es `sw`, el de la paleta es `w`, y son cosas distintas.                                                                   |
| **Explosiones del nivel anterior sobreviven al cambio de nivel.** El original vacía `explosions` en `loadLevel` (`game.js:54`); olvidarlo deja restos flotando sobre el patrón nuevo.                                                                                        | `buildBlocks` vacía `explosions` en la misma operación. Prueba manual del paso 9 al limpiar un nivel.                                                                                                     |
| **El array de explosiones crece sin límite** si se olvida el filtrado por `elapsed`.                                                                                                                                                                                         | Filtro por `exp.elapsed < EXPLOSION_DURATION` en cada `update`, portado literalmente de `game.js:153`.                                                                                                    |
| **`imageSmoothingEnabled` se pierde al redimensionar.** Reescalar el contexto tras un `ResizeObserver` restablece el suavizado por defecto, y los sprites vuelven a salir borrosos sin que nadie lo note hasta ver una captura.                                              | Se fija `imageSmoothingEnabled = false` **después** de cada reescalado, no una sola vez al crear el contexto. Paso 7 y criterio de nitidez en DPR 2.                                                      |
| **El selector de nivel llega a producción.** `process.env.NODE_ENV` mal escrito (una variable intermedia, una comparación indirecta) impide que el bundler elimine el bloque, y el atajo queda disponible para farmear puntuación.                                           | Comparación literal `process.env.NODE_ENV === "development"` envolviendo el bloque entero. Criterio que verifica su ausencia en `.next/static` tras el build.                                             |
| **`rAF` y listeners que sobreviven al desmontaje** (bucles fantasma, teclado duplicado, score que sigue subiendo al salir).                                                                                                                                                  | Cleanup completo en el efecto de montaje: `cancelAnimationFrame`, `removeEventListener`, `ResizeObserver.disconnect()` y `img.onload = null`. Criterio de "al volver a entrar la partida arranca limpia". |
| **Estado global de módulo al portar `game.js` y `spritesheet.js`.** El original declara `paddle`, `ball`, `blocks`, `score`, `lives` y también `ssImg`/`ssLoaded` a nivel de archivo.                                                                                        | Todo dentro de `createGame(canvas, ctx, hooks)`, incluidos `sheet` y `ready`; los helpers de dibujo reciben el sheet como parámetro. Criterio de aceptación que lo prohíbe.                               |
| **Doble montaje de React Strict Mode en desarrollo.** Sin cleanup correcto se crean dos juegos y aparecen dos pelotas.                                                                                                                                                       | El cleanup hace el efecto idempotente: montar→desmontar→montar deja un solo juego. Verificación del paso 4.                                                                                               |
| **`onSnapshot` llamado cada frame** (60 `setState`/s).                                                                                                                                                                                                                       | Emitir solo cuando cambia `score`, `lives`, `level` o `status` respecto al último snapshot. Paso 5.                                                                                                       |
| **`paused` en las dependencias del efecto de montaje** reiniciaría la partida en cada pausa.                                                                                                                                                                                 | Efecto aparte que llama a `setPaused()`. Paso 4.                                                                                                                                                          |
| **Detener el `rAF` al terminar la partida deja el canvas sin repintar.** El modal de fin se dibuja **encima** del canvas; al redimensionar la ventana el búfer se recrearía en blanco tras el modal.                                                                         | En pausa y en game over el bucle **no avanza `update` pero sigue dibujando** el último estado. El `rAF` solo se cancela en el cleanup. Paso 3.                                                            |
| **Teclas pegadas al pausar.** Una flecha marcada como pulsada movería la paleta sola al reanudar.                                                                                                                                                                            | Al pausar se sueltan todas las teclas. Criterio de "en pausa la paleta no se mueve".                                                                                                                      |
| **`←`/`→` scrollean la página o roban foco**, y el input de iniciales del modal mueve la paleta al escribir.                                                                                                                                                                 | `preventDefault` solo con el juego activo (`isActive()`), e `isTypingTarget(e.target)` para ignorar el teclado cuando el foco está en un `input`. Paso 8.                                                 |

## Lo que **no** entra en esta spec

- **Audio.** La referencia sí tiene `ball-bounce.mp3` y `break-sound.mp3`, y aun así no se portan. El sonido necesita antes una decisión de plataforma —gesto de activación, mute persistente en el chrome, volumen compartido— que ningún juego tiene resuelta.
- **Control por ratón.** El original mueve la paleta con `mousemove` sobre el canvas; aquí solo `←`/`→`.
- **Teclas `P` / `Escape` de pausa.** La pausa la gobierna la plataforma con la prop `paused` y el botón PAUSA/REANUDAR.
- **Selector de nivel en producción.** Existe solo bajo `process.env.NODE_ENV === "development"`.
- **Los botones de nivel dibujados en el canvas** con clic, del overlay de pausa original.
- **Estado de victoria.** Los niveles se encadenan indefinidamente; la partida solo acaba al agotar las vidas.
- **Power-ups, multibola, paleta que se encoge y bloques de varios impactos.** No están en la referencia.
- **Controles táctiles / móvil.** Solo teclado.
- **`best` y `plays` de `bloque-buster` derivados de las puntuaciones reales.** Siguen siendo columnas estáticas, por decisión de la SPEC 06.
- **Migraciones y cover art.** Se reutiliza `bloque-buster`, ya sembrado; `app/globals.css` y `data/games.ts` no se tocan.
- **Cambios en el contrato juego↔plataforma.** `app/_components/games/types.ts` y `app/_components/GamePlayerScreen.tsx` no se modifican: la SPEC 07 ya los dejó listos.
- **Adaptar los 5 juegos aún mock** (`serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`). Cada uno se enchufará al registro en su propia spec.
- **Tests.** Sigue sin haber runner.

Cada uno de esos, si llega, va en su propia spec.
