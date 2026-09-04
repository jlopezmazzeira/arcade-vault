# SPEC JAM 01 — Adaptación del juego Frogger (`ranaria`) a la plataforma

> **Status:** Draft
> **Depends on:** SPEC 05 (contrato de juego y registro), SPEC 06 (catálogo y puntuaciones), SPEC 07 (`types.ts` y HUD condicional)
> **Date:** 2026-09-03
> **Objective:** Construir un Frogger original en TypeScript, jugable en `/juegos/ranaria/jugar`, 100 % vectorial, con temporizador por travesía, multiplicador de racha y guardado real de puntuación.
> **Jam:** tema «Frogger y los arcade de cruzar carriles» — spec 1 de 2

## Por qué este juego

El tema se entendió como **el subgénero de avanzar fila a fila por carriles hostiles de velocidad constante hasta una fila-meta**, con la pantalla fija y la muerte a un solo toque.

- **Freeway** (Activision, 1981) — descartado: su puntuación es «+1 por cruce» y una partida buena se queda en 30-50. Es el defecto exacto que hundió a `aleteo` en la ronda 2 de `game-planner`: granularidad tan gruesa que `getTopScores` acaba desempatando por `created_at`, es decir por hora de llegada.
- **Frostbite** (Activision, 1983) — descartado: su score sí acumula, pero sería el tercer `ARCADE` **gastando un id nuevo** mientras `ranaria` sigue sembrado y en mock. Es el patrón que hundió a `piramide`, `subsuelo` y `escalada`.
- **Crossy Road** (2014) — descartado dos veces: «+1 por fila» repite el defecto de Freeway, y es un juego de móvil de 2014 que rompe la ficción de recreativa del catálogo.
- **Frogger** (Konami, 1981) — **gana**. Es el arquetipo del tema, tiene id sembrado con ficha, portada y leaderboard, y su HUD completo cabe en `GameSnapshot`.

Frogger llegaba con **descarte blando** de `game-planner` (rondas 1 y 2, marcado «reevaluable») por dos motivos. El primero, **exceso de `ARCADE`**, sigue siendo cierto y esta spec no lo niega: pesa menos aquí porque un jam es una spec candidata, no un alta de catálogo. El segundo, **«el techo de score más bajo de la ronda»**, se ataca de frente: la tabla de puntuación de esta spec no es la del arcade original, sino que añade **bono de tiempo restante**, **multiplicador de racha hasta ×5** y **bono de ronda `1000 × nivel`**, lo que lleva una partida experta de ~15 niveles por encima de los **200 000 puntos**. Ver `## Modelo de datos` y `## Decisiones`.

## Alcance

**Dentro:**

- **Componente cliente `app/_components/games/FroggerGame.tsx`.** No hay `game.js` de referencia ni carpeta en `references/started-games/`: la mecánica se escribe desde cero según esta spec, igual que hizo la SPEC 09 con Snake. Rana, carriles, entidades, temporizador y colisiones viven dentro de `createGame(canvas, ctx, hooks)`; sin estado mutable a nivel de módulo.
- **Hoja `app/_components/games/FroggerGame.module.css`** con el escalado del canvas dentro del `.crt-screen`. CSS scopeado; `app/globals.css` no se toca.
- **Lienzo de 800×600 lógicos, celda de 50 px, rejilla de 16×12 casillas.** Ya es 4/3, el ratio que impone `.crt-screen` (`app/globals.css:654-656`): llena el marco sin pilarbox ni panel lateral.
- **Tablero de 12 filas**: fila `0` la orilla con 5 nenúfares, filas `1`–`5` el río, fila `6` la mediana segura, filas `7`–`10` la carretera y fila `11` la acera de salida.
- **Nueve carriles de velocidad constante** con dirección alterna y wrap por el borde: cuatro de tráfico y cinco de troncos, con las velocidades, largos y densidades de la tabla del `## Modelo de datos`.
- **Movimiento por saltos discretos**, una casilla por pulsación, sin animación interpolada, con `HOP_COOLDOWN_MS = 90` y repetición de tecla ignorada.
- **Arrastre sobre troncos.** En el río la rana guarda una `x` continua en píxeles y se mueve con el tronco; el salto horizontal parte de la columna más cercana (`round(x / CELL)`), y el vertical **conserva la `x` exacta**, que es lo que hace que alinear con un nenúfar sea una habilidad.
- **Cinco condiciones de muerte**: choque con un vehículo, caer al agua, ser arrastrado fuera del lienzo sobre un tronco, agotar el temporizador y aterrizar en la orilla fuera de un nenúfar o sobre uno ya ocupado.
- **Temporizador por travesía**: 30 s en el nivel 1, −2 s por nivel, suelo de 18 s. Se reinicia entero en cada salida de la acera.
- **Tres vidas iniciales y rana extra cada 20 000 puntos**, con tope de 5 vidas simultáneas.
- **Puntuación de cuatro eventos** con multiplicador de racha hasta ×5, detallada con números concretos en el `## Modelo de datos` y repetida literalmente en los criterios de aceptación.
- **Niveles infinitos**: completar los 5 nenúfares sube de nivel, vacía la orilla, suma `1000 × nivel` y multiplica la velocidad de todos los carriles por `1.12` acumulativo, capado a ×2,5.
- **Emisión de snapshot**: `score`, `status`, `lives`, `level` y `extra: [Tiempo, Orilla, Racha]`. Es el primer juego del vault que emite los cuatro campos a la vez. El tiempo se emite **redondeado a segundos enteros**, de modo que el temporizador provoca como mucho una emisión por segundo.
- **Uso real de `status: "dead"`** durante los 700 ms de congelación tras morir. Hasta hoy solo `rocas` lo usaba.
- **Registro**: la línea `ranaria: dynamic(() => import("./FroggerGame"))` en `app/_components/games/registry.ts`, más la actualización del comentario de cabecera del archivo, que hoy enumera cuatro juegos adaptados.
- **Guardado real de puntuación**: no se escribe nada. `saveScore` y `getTopScores` ya son genéricos por `game_id`.
- **Sin migración ni cover art nuevo.** Se reutiliza el id `ranaria`, sembrado en `supabase/migrations/001_games.sql:76` con `position 6`, `cover-rana`, categoría `ARCADE`, color `green` y 12 filas de leaderboard en `supabase/migrations/002_scores.sql:125-136`.
- **Consumo de `app/_components/games/types.ts`, sin extenderlo.** La SPEC 07 ya extrajo el contrato y volvió condicional el HUD; esta spec solo importa de `./types`.
- **Juego 100 % vectorial.** `references/source-assets/` solo contiene `snake-assets/`: no hay ni un sprite ni un sonido de Frogger en el repo, y no se añade ninguno.
- **No regresión explícita**: `rocas`, `caida`, `bloque-buster` y `serpentina` siguen funcionando igual, y `gloton` mantiene su mock intacto como testigo.

**Fuera de alcance (para futuras specs):**

- **Tortugas sumergibles** en los carriles del río, con su ciclo de flote, parpadeo e inmersión. Va en la SPEC JAM 02 de esta carpeta.
- **Cocodrilos en los nenúfares**, que convierten una casilla-meta en trampa. Va en la SPEC JAM 02 de esta carpeta.
- **Mosca bonus** sobre un nenúfar libre y sus 200 puntos. Va en la SPEC JAM 02 de esta carpeta.
- **Serpiente sobre la mediana y rana escolta.** Son las otras dos entidades del Frogger original; no hacen falta para que el juego sea jugable y competitivo.
- **Audio.** No hay assets de sonido en el repo y ningún juego del vault suena todavía.
- **Sprites o spritesheet.** No existe fichero de referencia; todo se dibuja con primitivas de canvas.
- **Controles táctiles o por swipe.** Ningún juego adaptado los tiene y hacerlo bien es una spec transversal a los cinco.
- **Teclas `P` / `Escape` de pausa.** La pausa es estado declarativo de la plataforma.
- **`best` y `plays` derivados** de las puntuaciones reales. Siguen estáticos, por decisión de la SPEC 06.
- **Realtime del leaderboard.** El aside y `/salon` siguen siendo lectura en servidor.
- **Adaptar los tres juegos que seguirán en mock** tras esta spec: `gloton`, `invasores` y `duelo-pixel`.
- **Promover esta spec a la serie numerada de `specs/`.** Es una spec candidata de jam; moverla y renumerarla es una decisión del usuario.
- **Tests.** El proyecto sigue sin runner configurado.

## Modelo de datos

Esta spec **no crea tablas ni migraciones** y **no extiende el contrato**: la SPEC 07 ya extrajo `types.ts` y volvió condicional el HUD. Los «datos» son tres cosas: qué emite este juego, sus constantes, y la fila de catálogo que ya existe.

### (a) Contrato con la plataforma

`FroggerGame.tsx` importa `PlayableStatus`, `GameSnapshot`, `PlayableGameProps` y `PlayableGameHandle` de **`./types`** — no de `./AsteroidsGame`. No se añade ningún campo a `GameSnapshot`.

El juego emite los cuatro campos:

- **`score`** — la puntuación acumulada de la partida.
- **`lives`** — ranas restantes, de 0 a 5.
- **`level`** — número de ronda, empezando en 1 y sin techo.
- **`extra`** — tres entradas: `{ label: "Tiempo", value: "23 s" }` con los segundos enteros restantes de la travesía, `{ label: "Orilla", value: "3/5" }` con los nenúfares ocupados, y `{ label: "Racha", value: "×4" }` con el multiplicador vigente.

| Juego                      | `score` | `lives`            | `level` | `extra`                       |
| -------------------------- | ------- | ------------------ | ------- | ----------------------------- |
| `rocas` (Asteroids)        | sí      | sí (3)             | sí      | `[{ label: "Poder", … }]`     |
| `caida` (Tetris)           | sí      | no                 | sí      | `[{ label: "Líneas", … }]`    |
| `bloque-buster` (Arkanoid) | sí      | sí (3)             | sí      | ninguna                       |
| `serpentina` (Snake)       | sí      | no                 | no      | `[{ label: "Longitud", … }]`  |
| `ranaria` (Frogger)        | sí      | **sí (3, máx. 5)** | **sí**  | **`[Tiempo, Orilla, Racha]`** |

`status` recorre los tres valores: `"playing"` durante la travesía, **`"dead"`** durante los 700 ms de congelación tras perder una rana, y `"gameover"` al agotar la última. `GamePlayerScreen.tsx:92` solo desestructura `score`, `lives`, `level` y `extra`, así que `"dead"` no cambia nada en el HUD de hoy; se emite porque el contrato lo define y porque describe el estado real del juego.

**Regla de emisión:** `onSnapshot` se llama **solo cuando cambia un campo** respecto al último emitido, nunca por frame. El único campo que late solo es `Tiempo`, y se compara **ya redondeado a segundos enteros**: una travesía de 8 segundos produce unas 9 emisiones, no 480.

### (b) Constantes del juego

Viven dentro de `FroggerGame.tsx`, tipadas, fuera de `createGame` por ser inmutables:

```ts
const CELL = 50; // px lógicos por casilla
const COLS = 16; // 16 × 50 = 800
const ROWS = 12; // 12 × 50 = 600
const ROW_HOME = 0; // orilla con nenúfares
const ROW_MEDIAN = 6; // mediana segura
const ROW_START = 11; // acera de salida
const START_COL = 7; // columna inicial de la rana
const PAD_COLS = [1, 4, 7, 10, 13]; // casilla izquierda de cada nenúfar
const PAD_W = 2; // cada nenúfar mide 2 casillas
const HOP_COOLDOWN_MS = 90; // salto mínimo entre pulsaciones
const DEATH_PAUSE_MS = 700; // congelación tras perder una rana
const TIMER_START_MS = 30_000; // temporizador de travesía en el nivel 1
const TIMER_STEP_MS = 2_000; // se resta por nivel
const TIMER_MIN_MS = 18_000; // suelo del temporizador
const LIVES_START = 3;
const LIVES_MAX = 5;
const EXTRA_LIFE_EVERY = 20_000; // rana extra por cada tramo de puntos
const SCORE_ROW = 10; // por fila nueva alcanzada en la travesía
const SCORE_ARRIVAL_BASE = 50; // base del bono de llegada
const SCORE_PER_SECOND = 10; // × segundos enteros restantes
const SCORE_ROUND = 1_000; // × nivel, al completar los 5 nenúfares
const STREAK_MAX = 5; // tope del multiplicador de racha
const SPEED_STEP = 1.12; // multiplicador de velocidad por nivel
const SPEED_CAP = 2.5; // tope acumulado del multiplicador
const DT_CAP_MS = 50; // cap de dt del bucle
```

Colores del canvas, como literales con el token de `app/globals.css` anotado al lado (mismo criterio que la SPEC 09):

```ts
const C_FROG = "#00ff88"; // --green
const C_PAD = "#00f5ff"; // --cyan, nenúfar libre
const C_CAR = "#ff006e"; // --magenta
const C_TRUCK = "#f5ff00"; // --yellow
const C_LOG = "#5a3a1e"; // madera, fuera de la paleta de tokens
const C_RIVER = "#062033"; // agua
const C_ROAD = "#141827"; // asfalto
const C_SAFE = "#1d2b1f"; // mediana y acera
```

**Los nueve carriles**, definidos como una constante `readonly` de `{ row, kind, dir, speed, len, count }`. `dir` es `+1` hacia la derecha y `−1` hacia la izquierda; `speed` está en píxeles lógicos por segundo a nivel 1; `count` es el número de entidades del carril. La cobertura es `count × len / (800 + len)` y es el número que decide si el carril es cruzable:

| Fila | Zona      | Entidad      | `dir` | `speed` | `len` | `count` | Cobertura |
| ---- | --------- | ------------ | ----- | ------- | ----- | ------- | --------- |
| 10   | carretera | coche        | ←     | 70      | 50    | 3       | 18 %      |
| 9    | carretera | coche        | →     | 95      | 50    | 3       | 18 %      |
| 8    | carretera | camión       | ←     | 60      | 100   | 2       | 22 %      |
| 7    | carretera | deportivo    | →     | 130     | 50    | 4       | 24 %      |
| 5    | río       | tronco largo | →     | 55      | 150   | 3       | 47 %      |
| 4    | río       | tronco medio | ←     | 85      | 100   | 4       | 44 %      |
| 3    | río       | tronco doble | →     | 60      | 200   | 2       | 40 %      |
| 2    | río       | tronco largo | ←     | 100     | 150   | 3       | 47 %      |
| 1    | río       | tronco medio | →     | 70      | 100   | 4       | 44 %      |

Un carril **no guarda un array de entidades**: guarda un solo escalar `offset` que avanza `dir × speed × mult × dt` y se normaliza con módulo `WRAP = 800 + len`. La entidad `k` se dibuja en `x = ((offset + k × WRAP / count) mod WRAP + WRAP) mod WRAP − len`. Así el espaciado es exactamente uniforme, el wrap es continuo y no hay que crear ni destruir objetos en tiempo de ejecución.

**Tabla de puntuación**, con la racha `r` (número de llegadas consecutivas sin morir, capado a `STREAK_MAX`) y los segundos enteros restantes `s`:

| Evento                                            | Fórmula                          | Ejemplo                               |
| ------------------------------------------------- | -------------------------------- | ------------------------------------- |
| Alcanzar una fila **nueva** de la travesía actual | `10`                             | travesía limpia de 11 filas → **110** |
| Llegar a un nenúfar libre                         | `(50 + 10 × s) × r`              | `s = 22`, `r = 1` → **270**           |
| Completar los 5 nenúfares (fin de ronda)          | `1000 × nivel`                   | nivel 7 → **7 000**                   |
| Rana extra                                        | cada 20 000 puntos, máx. 5 vidas | —                                     |

«Fila nueva» significa **récord de avance de la travesía en curso**: retroceder y volver a subir no vuelve a puntuar, y el récord se reinicia en cada salida de la acera. Morir pone la racha a 0; completar una ronda **no** la reinicia, así que un jugador perfecto entra en el nivel 2 ya con ×5.

### (c) Fila del catálogo

**Reutiliza el id `ranaria`, ya sembrado: no hay migración ni cover art nuevo.**

| Campo      | Valor                                                  |
| ---------- | ------------------------------------------------------ |
| `id`       | `ranaria`                                              |
| `position` | `6`                                                    |
| `title`    | `RANARIA`                                              |
| `cat`      | `ARCADE`                                               |
| `cover`    | `cover-rana` (clase ya existente en `globals.css:522`) |
| `color`    | `green`                                                |
| `best`     | `18900` (estático, no derivado)                        |
| `plays`    | `6.4K` (estático)                                      |

Su ficha larga en `data/games.ts` ya describe exactamente este juego: «Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo». Su leaderboard ya tiene 12 filas de siembra, de 49 903 a 274 036 puntos. `data/games.ts` **no se toca**, y la unión `CoverArt` tampoco: `cover-rana` ya está en ella. Esta spec **no añade ningún archivo fuera de `app/_components/games/`**.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Lógica pura del juego, sin React

Crear `app/_components/games/FroggerGame.tsx` con `"use client"`, las constantes de la sección anterior y la fábrica `createGame(canvas, ctx, hooks): GameController`. Dentro, y solo dentro, el estado de la partida: la rana como `{ x: number; row: number }` con `x` en píxeles lógicos, los nueve `offset` de carril, el array de 5 booleanos de nenúfares ocupados, el temporizador, `lives`, `level`, `score`, `streak` y `bestRow` de la travesía.

El bucle de `requestAnimationFrame` avanza los `offset`, descuenta el temporizador, resuelve colisiones y dibuja. El dibujo es 100 % vectorial: bandas de zona, rectángulos redondeados para vehículos y troncos, nenúfares como marcos `--cyan` que se rellenan al ocuparse, y la rana como un cuerpo verde con dos ojos orientados según el último salto.

_Verificación:_ `npx tsc --noEmit` pasa y el módulo no declara ni una variable mutable fuera de `createGame`.

### 2. Ciclo de vida React

Envolver la fábrica en el componente: `forwardRef`, efecto de montaje que crea y arranca el juego y **en el cleanup lo detiene** (`cancelAnimationFrame`, `removeEventListener`, `ResizeObserver.disconnect()`). `onSnapshot` y `onGameOver` entran por **refs espejo**, nunca como dependencias. `paused` se propaga en un `useEffect` **aparte** que llama a `setPaused()`. `restart()` se expone con `useImperativeHandle`. **Cap de `dt` a `DT_CAP_MS`** en el bucle.

_Verificación:_ montar, desmontar y volver a montar en desarrollo (Strict Mode) deja **una sola** partida viva; navegar fuera no deja `rAF` corriendo.

### 3. Colisiones, muerte y vidas

Resolver por zona. En la carretera, AABB entre el rectángulo de la rana y cada entidad del carril de su fila. En el río, se busca el tronco cuyo intervalo `[x, x + len)` contiene el **centro** de la rana: si lo hay, la rana adopta su velocidad; si no, se ahoga. Fuera del lienzo mientras cabalga, muere. En la orilla, se comprueba a qué nenúfar corresponde el centro: si es libre se ocupa, si está ocupado o es agua, muere.

Cada muerte resta una vida, pone `streak` a 0, emite `status: "dead"`, congela `DEATH_PAUSE_MS` y devuelve la rana a `ROW_START` / `START_COL` con el temporizador entero. Sin vidas, `status: "gameover"` y `onGameOver(score)` **una sola vez**, con el bucle ya detenido.

_Verificación:_ las cinco condiciones de muerte se disparan a mano una por una, y el HUD baja de 3 a 2 a 1 a 0 corazones antes del modal.

### 4. Puntuación, temporizador y niveles

Implementar la tabla del `## Modelo de datos`: `SCORE_ROW` por récord de fila, `(50 + 10 × s) × r` por llegada, `1000 × nivel` por ronda y la rana extra cada `EXTRA_LIFE_EVERY` con tope `LIVES_MAX`. Al completar los 5 nenúfares: `level + 1`, orilla vaciada, `mult = min(mult × SPEED_STEP, SPEED_CAP)` y temporizador `max(TIMER_START_MS − TIMER_STEP_MS × (level − 1), TIMER_MIN_MS)`.

_Verificación:_ llegar a un nenúfar con 22 s en el HUD y racha ×1 suma exactamente 270 puntos; la segunda llegada consecutiva con 20 s suma exactamente 500.

### 5. Emisión de snapshot

Guardar el último snapshot emitido y comparar `score`, `lives`, `level`, `status` y los tres valores de `extra` **ya formateados como cadena** antes de llamar a `onSnapshot`. El tiempo se formatea con `Math.floor(msRestantes / 1000)`, de modo que solo cambia una vez por segundo.

_Verificación:_ una travesía de 8 segundos que acaba en nenúfar produce unas 9 llamadas a `onSnapshot`, no 480.

### 6. Registro

Añadir `ranaria: dynamic(() => import("./FroggerGame"))` a `app/_components/games/registry.ts` y actualizar su comentario de cabecera, que hoy enumera cuatro juegos adaptados. Va **después** del componente: si no, el player importaría algo que aún no existe.

_Verificación:_ `getPlayableGame("ranaria")` devuelve un componente y no `null`; `/juegos/ranaria/jugar` muestra el juego real en vez del mock.

### 7. Escalado del canvas dentro del marco CRT

Crear `app/_components/games/FroggerGame.module.css` con el patrón `.stage` / `.canvas` de los cuatro juegos anteriores. El búfer del canvas se redimensiona a la resolución real × DPR (capado a 2) con un `ResizeObserver`; el contexto se escala. Las **coordenadas lógicas (800×600) no cambian**. `app/globals.css` no se toca.

_Verificación:_ el tablero llena el marco sin bandas negras (es 4/3 nativo), los bordes de los carriles se ven nítidos en pantalla Retina y el `body` no gana scroll horizontal.

### 8. Teclado y foco

Listeners atados a `window` en `start()` y quitados en `stop()`. Flechas y `WASD` saltan una casilla. `isTypingTarget(e.target)` para que el input de iniciales del modal de fin no mueva la rana. Se ignora `e.repeat`, y además se respeta `HOP_COOLDOWN_MS`, para que mantener una tecla pulsada no dispare una ráfaga de saltos. `preventDefault` **solo con el juego activo** (ni en pausa ni en game over). Al pausar se sueltan todas las teclas y **se congela el temporizador**.

_Verificación:_ mantener `↑` pulsada avanza a lo sumo un salto cada 90 ms; con el juego en pausa las flechas scrollean la página con normalidad y el `Tiempo` del HUD no baja.

### 9. Prueba manual de extremo a extremo

Partida completa: cruzar la carretera, montar en un tronco, llegar a un nenúfar, morir de las cinco maneras, completar una ronda y ver el salto de nivel y la aceleración, agotar las tres vidas, guardar la puntuación en el modal, comprobarla en `/juegos/ranaria` y en `/salon`, pulsar «JUGAR DE NUEVO», salir de la ruta y volver a entrar.

### 10. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación. **`get_advisors` no aplica**: esta spec no toca la base de datos.

### Apuntes sobre el orden

- **Las colisiones (3) van antes que la puntuación (4)** porque la racha y el bono de tiempo se definen sobre el evento «llegada» y sobre el evento «muerte». Sin muerte implementada, la racha no se puede probar: siempre valdría ×1 creciente.
- **El registro (6) va antes del escalado (7) y del teclado (8)** aunque el juego aún no se vea bien: hasta que `ranaria` no está en el registro, `GamePlayerScreen` sirve el mock y no hay nada que probar en el navegador.
- **La emisión de snapshot (5) va después de la puntuación (4)**, no antes: los tres `extra` que hay que comparar (`Tiempo`, `Orilla`, `Racha`) no existen como valores hasta que el paso 4 los calcula.
- **El cleanup (2) va antes que el teclado (8)**, no al revés: los listeners del paso 8 dependen de que `stop()` ya exista y se llame de verdad al desmontar.
- **El cap de `dt` (2) va antes que los carriles se aceleren por nivel (4)** a propósito: a ×2,5 de multiplicador, un `dt` de 2 s teletransportaría un camión de lado a lado y mataría al jugador al volver de otra pestaña.

## Criterios de aceptación

Checklist booleano: cada ítem se responde con sí o no.

### Build y calidad

- [ ] `npm run lint` termina sin errores ni avisos.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npm run build` termina sin errores ni avisos.
- [ ] La consola de `/juegos/ranaria/jugar` no muestra errores de hidratación ni advertencias de React.

### Estructura y registro

- [ ] Existen `app/_components/games/FroggerGame.tsx` y `app/_components/games/FroggerGame.module.css`.
- [ ] `FroggerGame.tsx` empieza con `"use client"`.
- [ ] `FroggerGame.tsx` importa sus tipos de `./types`, no de `./AsteroidsGame`.
- [ ] El módulo **no declara ninguna variable mutable a nivel de módulo**: solo constantes, funciones puras y la fábrica.
- [ ] `getPlayableGame("ranaria")` devuelve un componente, no `null`.
- [ ] `app/_components/games/registry.ts` carga el juego con `next/dynamic` y su comentario de cabecera menciona los cinco juegos adaptados.
- [ ] `data/games.ts`, `app/globals.css` y `supabase/migrations/` no tienen ningún cambio.
- [ ] No se ha añadido ningún archivo bajo `public/`.

### Juego real en `/juegos/ranaria/jugar`

- [ ] El tablero es de 16×12 casillas de 50 px sobre un lienzo lógico de 800×600 y llena el marco CRT sin bandas negras.
- [ ] Al cargar, la rana está en la fila `11`, columna `7`, con 3 vidas, nivel 1 y 30 s de temporizador.
- [ ] Las flechas y `W`/`A`/`S`/`D` mueven la rana **una casilla por pulsación**; mantener la tecla no produce más de un salto cada 90 ms.
- [ ] Saltar contra el borde izquierdo o derecho no mueve la rana y no la mata.
- [ ] Alcanzar una fila nueva de la travesía suma **10** puntos; bajar y volver a subir a esa misma fila **no** vuelve a sumar.
- [ ] Una travesía desde la acera hasta un nenúfar sin retroceder suma **110** puntos por filas.
- [ ] Chocar con un coche, un camión o un deportivo en las filas 7 a 10 resta una vida.
- [ ] Estar en una fila del río (1 a 5) sin tronco bajo el centro de la rana resta una vida.
- [ ] Ser arrastrado por un tronco fuera del lienzo resta una vida.
- [ ] Aterrizar en la fila 0 fuera de un nenúfar, o sobre uno ya ocupado, resta una vida.
- [ ] Agotar el temporizador resta una vida y devuelve la rana a la acera con el temporizador entero.
- [ ] Llegar al primer nenúfar de la partida con 22 s restantes suma exactamente **270** puntos; la segunda llegada consecutiva con 20 s suma exactamente **500**; la quinta consecutiva con 18 s suma exactamente **1 150**.
- [ ] Morir pone el `Racha` del HUD a **×1** para la siguiente llegada; completar una ronda **no** lo reinicia.
- [ ] Completar los 5 nenúfares suma **1 000** puntos en el nivel 1 y **7 000** en el nivel 7, vacía la orilla y sube `level` en 1.
- [ ] Cada nivel multiplica la velocidad de los nueve carriles por **1,12** acumulativo, sin pasar de **×2,5**.
- [ ] Cada nivel resta **2 s** al temporizador de travesía, sin bajar de **18 s**: en el nivel 7 y siguientes son 18 s.
- [ ] Alcanzar 20 000 puntos concede una rana extra, y el HUD nunca muestra más de **5** corazones.
- [ ] El HUD muestra **Puntuación**, **Vidas**, **Nivel**, **Tiempo**, **Orilla** y **Racha**, y el `Tiempo` cambia una vez por segundo.
- [ ] Agotar la última vida abre el modal de fin **una sola vez**, con la puntuación real de la partida.
- [ ] El botón PAUSA congela los carriles **y el temporizador**; al reanudar, el `Tiempo` sigue donde estaba.
- [ ] Con el juego en pausa o en game over, las flechas scrollean la página con normalidad.
- [ ] Escribiendo las iniciales en el input del modal, `W`/`A`/`S`/`D` se escriben en el campo y no mueven la rana.
- [ ] «JUGAR DE NUEVO» reinicia a 0 puntos, 3 vidas, nivel 1, orilla `0/5`, racha ×1 y 30 s.

### Guardado y leaderboard

- [ ] El modal de fin guarda la puntuación real en `public.scores` con `game_id = 'ranaria'`.
- [ ] Con sesión iniciada, la fila guardada lleva `user_id` y el `display_name` del perfil, ignorando el nombre del formulario.
- [ ] Como invitado, la fila se guarda con `user_id null` y el nombre tecleado.
- [ ] Una partida de unos 8 niveles supera los 49 903 puntos de la fila sembrada más baja de `ranaria` y **aparece de verdad** en el aside de `/juegos/ranaria`, sin necesidad de consultar la tabla a mano.
- [ ] No se ha escrito ninguna consulta ni Server Action nueva: `saveScore` y `getTopScores` se usan tal cual.

### No regresión

- [ ] `/juegos/rocas/jugar` sigue igual: HUD con Vidas y Nivel, power-up en `extra`, pausa, reinicio y guardado real.
- [ ] `/juegos/caida/jugar` sigue igual: HUD con Nivel y Líneas, sin Vidas.
- [ ] `/juegos/bloque-buster/jugar` sigue igual: HUD con Vidas y Nivel, sprites y niveles encadenados.
- [ ] `/juegos/serpentina/jugar` sigue igual: HUD con Puntuación y Longitud, sin Vidas ni Nivel.
- [ ] `/juegos/gloton/jugar` mantiene el **mock intacto**: ticker de puntuación falsa, enemigos CSS y guardado por toast.
- [ ] `GamePlayerScreen.tsx` no tiene cambios; si los tuviera, la rama `MockGamePlayer` sigue sin tocar.
- [ ] Responden 200: `/`, `/biblioteca`, `/juegos/ranaria`, `/juegos/rocas`, `/salon`, `/about`, `/auth`.
- [ ] Ninguna ruta gana scroll horizontal en el `body`.
- [ ] Salir de `/juegos/ranaria/jugar` y volver a entrar arranca una partida limpia, sin `rAF` ni listeners del render anterior.

## Decisiones

- **Id del catálogo: `ranaria`, reutilizado. No un id nuevo.** La ficha sembrada en `001_games.sql:76` describe literalmente este juego —carriles de coches, troncos a la deriva, nenúfares y temporizador—, y la portada `cover-rana`, el color `green`, la `position 6` y las 12 filas de leaderboard ya existen. Un id nuevo costaría migración, clase `.cover-<x>` y entrada en `CoverArt` para dejar además un mock huérfano en `/biblioteca`.
- **Frogger frente a Freeway, Frostbite y Crossy Road.** Los otros tres representan el tema, pero dos de ellos puntúan «+1 por cruce» —el defecto de granularidad que ya descartó a `aleteo`— y los tres pagarían un id nuevo teniendo `ranaria` sembrado y libre.
- **Se asume el desequilibrio de `ARCADE`, no se disimula.** Con `rocas`, `caida`, `bloque-buster` y `serpentina` jugables, el reparto es `ARCADE` 2, `PUZZLE` 1, `SHOOTER` 1, `VERSUS` 0, y `ranaria` lo llevaría a 3 de 5. Es la objeción de `game-planner` que **sigue vigente**: esta spec no la resuelve, solo la contextualiza. Un jam produce specs candidatas que se leen en frío; el criterio de reparto vuelve a mandar en el momento de promoverla a la serie numerada.
- **Tabla de puntuación rediseñada. No la del arcade original.** Era la segunda objeción de `game-planner`: «el techo de score más bajo de la ronda». El Frogger de 1981 da 10 por fila y 50 por llegada, un goteo que en 10 minutos no pasa de unos miles. Aquí el bono de tiempo (`10 × s`), el multiplicador de racha (hasta ×5) y el bono de ronda (`1000 × nivel`) hacen que una ronda perfecta valga ~4 000 puntos en el nivel 1 y ~13 000 en el nivel 8. Una partida experta de 15 rondas pasa de **200 000**, que es el orden de magnitud de la siembra de `ranaria` (49 903 a 274 036) y del `best` de `caida`. La objeción queda atacada por diseño, no por decreto.
- **Multiplicador de racha que sobrevive al cambio de ronda. No uno que se reinicia cada nivel.** Reiniciarlo caparía la puntuación por nivel a ~4 000 y aplanaría la curva justo cuando el juego se pone difícil. Que persista premia exactamente lo que un leaderboard quiere ordenar: jugar limpio mucho rato. Además reparte los scores y evita empates.
- **Racha capada a ×5. No sin tope.** Sin tope, una partida excepcional se dispararía por dos órdenes de magnitud sobre una buena y el ranking dejaría de discriminar en su cabeza. ×5 iguala el número de nenúfares, así que el jugador entiende el tope sin que se lo expliquen.
- **Bono de tiempo por segundos enteros. No por décimas.** Con décimas, el `Tiempo` del HUD cambiaría 10 veces por segundo y `onSnapshot` dispararía 10 `setState`/s sin que el jugador pudiera leer el número. Los segundos enteros dejan la emisión en ~1/s.
- **Tres vidas iniciales con rana extra cada 20 000 puntos, tope 5. No cinco de salida.** Tres es lo que ya usan `rocas` y `bloque-buster`, así que el HUD es coherente entre juegos. La rana extra alarga las partidas buenas, que es otra palanca sobre el techo de score. El tope de 5 existe porque el HUD pinta vidas como `"♥ ".repeat(lives)` y una fila de corazones sin fin desbordaría la barra.
- **Lienzo 800×600 con celda de 50 px. No pilarbox ni panel lateral.** 16×12 es 4/3 exacto, el ratio de `.crt-screen`. Es la única geometría de rejilla entera que evita la decisión del §7 del contrato de plataforma, y por eso el tablero tiene 12 filas y no las 14 del arcade.
- **Doce filas: 1 orilla + 5 río + 1 mediana + 4 carretera + 1 acera.** El recorte respecto al 5+5 del original se hace en la carretera, no en el río: el río es la mitad que exige precisión —se muere por **no** estar sobre algo— y con cinco carriles alternando dirección 3–2 se lee bien. La carretera escala su dificultad por velocidad y densidad, y con cuatro carriles ya tiene coches lentos, camiones y deportivos.
- **Cinco nenúfares de dos casillas de ancho, en las columnas 1, 4, 7, 10 y 13.** Dos casillas dejan el reparto simétrico dentro de las 16 columnas (un margen de una casilla a cada lado) y el nenúfar central perfectamente centrado sobre la columna de salida. Con nenúfares de una casilla, el reparto quedaría descuadrado en una columna.
- **El salto vertical conserva la `x` exacta; el horizontal parte de la columna más cercana.** Es lo que convierte «llegar al nenúfar» en una decisión de temporización sobre el tronco, que es el núcleo del juego. Si el salto vertical hiciera _snap_ a la rejilla, montar en un tronco no tendría consecuencias y el río sería una carretera más.
- **Carriles como un escalar `offset` con módulo. No como arrays de entidades.** El espaciado sale exactamente uniforme, el wrap es continuo, no hay que crear ni destruir objetos por frame, y la aceleración por nivel es multiplicar una variable. Un array de coches obligaría a reciclarlos en los bordes, que es de donde salen los huecos irregulares.
- **Muerte con congelación de 700 ms y `status: "dead"`. No respawn instantáneo.** Sin pausa, el jugador no ve qué le mató y la partida parece un salto. Es además la primera vez que un juego del vault emite `"dead"` fuera de `rocas`, y el contrato ya lo define.
- **HUD con tres `extra`: Tiempo, Orilla y Racha.** Es el máximo que ha usado un juego del vault, pero los tres son estado que el jugador **necesita** para decidir: cuánto le queda, qué nenúfares faltan y cuánto vale la siguiente llegada. Esconder la racha haría opaco el 80 % de la puntuación.
- **Juego 100 % vectorial. Sin sprites ni audio.** `ls references/source-assets/` devuelve solo `snake-assets/`: no hay un solo asset de Frogger en el repo. Inventar una ruta de PNG sería inventar un fichero que nadie va a poder colocar.
- **`app/globals.css` no se toca.** La excepción de cover art que contempla el contrato de plataforma **no aplica**: `.cover-rana` y su entrada en la unión `CoverArt` existen desde la SPEC 01.
- **Tortugas, cocodrilos y mosca bonus se aplazan a la SPEC JAM 02.** Las tres son entidades del río y de la orilla que cambian la dificultad y el score, pero el juego es completo y competitivo sin ellas. Meterlas aquí haría de esta spec dos specs mal cosidas.
- **Serpiente sobre la mediana y rana escolta se aplazan para siempre.** Son las dos entidades más marginales del original: la serpiente convierte la única fila de descanso en una trampa y la escolta añade un estado que arrastrar por el tablero. Ninguna aporta nada que la racha no aporte ya.
- **Sin audio, sin controles táctiles y sin teclas `P`/`Escape`.** El audio no tiene assets. El táctil pide un esquema de swipe que ningún juego del vault tiene, y hacerlo bien es una spec transversal a los cinco. La pausa es estado declarativo de la plataforma: si el juego capturara `P`, habría dos fuentes de verdad para el mismo estado.

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `rAF` y listeners que sobreviven al desmontaje (bucles fantasma, score fantasma)              | Cleanup completo en el efecto de montaje (paso 2); criterio de aceptación que exige salir de la ruta y volver a entrar      |
| Estado mutable a nivel de módulo al escribir el juego                                         | Todo dentro de `createGame` (paso 1); criterio de estructura que lo prohíbe explícitamente                                  |
| Doble montaje de React Strict Mode en desarrollo                                              | El cleanup hace el efecto idempotente: montar→desmontar→montar deja una sola partida (paso 2)                               |
| `onSnapshot` llamado cada frame (60 `setState`/s), agravado aquí por el temporizador          | Comparar el snapshot ya formateado, con el tiempo en segundos enteros (paso 5); criterio que cuenta ~9 emisiones en 8 s     |
| `paused` en las deps del efecto de montaje reinicia la partida                                | Efecto aparte que llama a `setPaused()` (paso 2)                                                                            |
| Flechas y `WASD` scrollean la página o roban el foco al input de iniciales                    | `preventDefault` solo con el juego activo e `isTypingTarget` en cada `keydown` (paso 8)                                     |
| Salto de posición al volver de una pestaña en segundo plano, letal con los carriles a ×2,5    | Cap de `dt` a 50 ms (paso 2); apunte de orden que lo justifica                                                              |
| `position` duplicada en `games` (índice único)                                                | No aplica: se reutiliza `ranaria`, ya sembrado con `position 6`; criterio que verifica que `supabase/migrations/` no cambia |
| Siembra no idempotente                                                                        | No aplica: esta spec no escribe ninguna migración                                                                           |
| Regresión del mock al tocar `GamePlayerScreen`                                                | Esta spec **no toca** `GamePlayerScreen.tsx`; criterio con `/juegos/gloton/jugar` como testigo                              |
| **El temporizador sigue corriendo con el juego en pausa** y mata al jugador mientras no juega | `setPaused(true)` congela el descuento; criterio de aceptación dedicado                                                     |
| **Ráfaga de saltos por auto-repetición del teclado**, que cruza el tablero de una tecla       | Se ignora `e.repeat` y se respeta `HOP_COOLDOWN_MS = 90` (paso 8); criterio de aceptación dedicado                          |
| **Carril de río con hueco imposible** que bloquea el avance en niveles altos                  | Cobertura fijada por carril entre el 40 % y el 47 % y espaciado exactamente uniforme por el modelo de `offset` con módulo   |
| **La rana se queda «entre» dos troncos** por comparar bordes en vez de centro                 | El río se resuelve por el **centro** de la rana contra el intervalo del tronco (paso 3)                                     |
| **Deriva de la `x` al montar y desmontar troncos** en saltos verticales encadenados           | La `x` es un `number` continuo y solo hace _snap_ en el salto horizontal, con `round(x / CELL)` (paso 1)                    |
| **Doble llegada al mismo nenúfar** o ronda que se completa dos veces                          | El array de nenúfares ocupados se comprueba antes de puntuar; llegar a uno ocupado es muerte, no puntos (paso 3)            |
| **Puntuación desbocada por la racha** que hace ilegible el leaderboard                        | Racha capada a `STREAK_MAX = 5`; el techo estimado (~250 000) queda dentro del rango de la siembra existente                |
| Velocidad atada al refresco del monitor si el movimiento fuera por frame                      | Los carriles avanzan por `dt` en segundos, no por frame: a 144 Hz los coches van igual que a 60 Hz                          |

## Lo que **no** entra en esta spec

- **Tortugas sumergibles** en el río. Van en la SPEC JAM 02 de esta carpeta.
- **Cocodrilos en los nenúfares.** Van en la SPEC JAM 02 de esta carpeta.
- **Mosca bonus** sobre un nenúfar libre. Va en la SPEC JAM 02 de esta carpeta.
- **Serpiente sobre la mediana y rana escolta.** Aplazadas para siempre.
- **Audio.** No hay assets de sonido y no se añaden.
- **Sprites o spritesheet.** El juego es 100 % vectorial.
- **Controles táctiles o por swipe.**
- **Teclas `P` / `Escape` de pausa.**
- **`best` y `plays` derivados** de las puntuaciones reales: siguen estáticos, por decisión de la SPEC 06.
- **Realtime del leaderboard.**
- **Adaptar los tres juegos que seguirán en mock**: `gloton`, `invasores` y `duelo-pixel`.
- **Promover esta spec a la serie numerada de `specs/`.** Es una candidata de jam.
- **Tests.** El proyecto sigue sin runner.

_Cada uno de esos, si llega, va en su propia spec._
