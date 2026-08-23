# SPEC 09 — Adaptación del juego Snake (`serpentina`) a la plataforma

> **Status:** Approved
> **Depends on:** SPEC 05 (contrato de juego y registro), SPEC 06 (catálogo y puntuaciones), SPEC 07 (`types.ts` y HUD condicional), SPEC 08 (patrón de carga de spritesheet)
> **Date:** 2026-08-23
> **Objective:** Construir un Snake original en TypeScript, jugable en `/juegos/serpentina/jugar`, con frutas dibujadas desde el atlas de `references/source-assets/snake-assets/` y guardado real de puntuación.

## Alcance

**Dentro:**

- Nuevo componente cliente **`app/_components/games/SnakeGame.tsx`**. A diferencia de las SPEC 05, 07 y 08, **no hay `game.js` de referencia que portar**: la mecánica se escribe desde cero según esta spec. Serpiente, fruta, rejilla, colisiones y tick encapsulados en `createGame(canvas, ctx, hooks)`; sin estado mutable a nivel de módulo.
- Su hoja **`app/_components/games/SnakeGame.module.css`** con el escalado del canvas dentro del `crt-screen`. CSS scopeado; `app/globals.css` no se toca.
- **Lienzo de 800×600 lógicos, celda de 25 px, rejilla de 32×24 casillas.** Ya es 4/3, el ratio del marco CRT: llena el marco sin pilarbox ni panel lateral.
- **Movimiento por casillas con tick discreto**, no interpolado. Arranca en 130 ms/paso y **baja 4 ms por fruta comida hasta un suelo de 60 ms**.
- **Muros mortales.** Salir de la rejilla mata; no hay wrap-around.
- **Autocolisión mortal.** Entrar en una casilla ocupada por el propio cuerpo mata.
- **Arranque inmediato:** 3 segmentos en el centro de la rejilla, avanzando a la derecha desde el primer tick. Sin cuenta atrás ni respiro inicial.
- **Puntuación `10 + 2 × frutasComidas`**: la primera fruta suma 12, la trigésima suma 70. Premia sobrevivir sin necesitar tabla de valores ni temporizadores.
- **Controles de teclado**: flechas y `WASD`. Giro de 180° prohibido. **Cola de un solo giro por tick**: se encola la primera tecla válida del tick y las siguientes esperan al siguiente paso, para que dos pulsaciones rápidas no puedan invertir la marcha.
- **Assets gráficos**: `fruits.png` copiado tal cual a **`public/games/snake/fruits.png`** (585 KB), y `sprites.js` portado a una constante tipada dentro del componente con **las 22 frutas** del atlas. En cada aparición se elige una al azar; **todas valen lo mismo**. Se dibuja centrada en su casilla **respetando su relación de aspecto** — los recortes van de 110×160 a 170×160 y no son cuadrados. Se sigue el patrón de carga de la SPEC 08 (`new Image()` con `onload`/`onerror` anulables al desmontar).
- **Fallback sin sprite**: si el PNG no carga, la fruta se dibuja como un rombo verde vectorial y la partida continúa con normalidad.
- **Serpiente 100 % vectorial**: verde `serpentina`, cabeza con ojos orientados según la dirección. El atlas solo trae frutas.
- **Aparición de fruta siempre en casilla libre**, nunca bajo el cuerpo de la serpiente.
- **Emisión de snapshot**: `score` y `extra: [{ label: "Longitud", value }]`. **Sin `lives` ni `level`** — Snake no tiene ninguna de las dos, y el HUD omite ambos huecos.
- **Registro**: la línea `serpentina: dynamic(() => import("./SnakeGame"))` en `app/_components/games/registry.ts`.
- **Guardado real de puntuación**: no se escribe nada. `saveScore` y `getTopScores` ya son genéricos por `game_id`.
- **Sin migración ni cover art nuevo.** Se reutiliza el id `serpentina`, ya sembrado con `cover-snake`, categoría `ARCADE`, color `green` y leaderboard.
- **Consumo de `types.ts`, sin extenderlo.** La SPEC 07 ya extrajo el contrato y volvió condicional el HUD; esta spec solo importa de `./types`.
- **No regresión explícita**: `rocas`, `caida` y `bloque-buster` siguen funcionando igual, y `gloton` mantiene su mock intacto.

**Fuera de alcance (para futuras specs):**

- **Audio.** El directorio de assets no trae sonidos y no se añaden.
- **Frutas especiales con valor y caducidad.** La variante de frutas raras (+50, parpadeo, temporizador) queda aplazada; aquí todas valen igual.
- **Obstáculos internos, muros por nivel o niveles como tales.** La dificultad la lleva solo la velocidad.
- **Wrap-around por los bordes.** Se descartó a favor del muro mortal.
- **Sprites de serpiente.** El atlas de `spriters-resource` solo trae la fila de frutas; cabeza y cuerpo son vectoriales.
- **Controles táctiles o por swipe.**
- **Teclas `P` / `Escape` de pausa.** La pausa es estado declarativo de la plataforma, como en los tres juegos ya adaptados.
- **Recortar o comprimir `fruits.png`.** Entra tal cual, sin pasada de optimización.
- **`best` y `plays` derivados** de las puntuaciones reales. Siguen estáticos, por decisión de la SPEC 06.
- **Reconciliar la siembra de `public.scores` con las puntuaciones reales.** Las 12 filas sembradas de `serpentina` van de 23 452 a 270 582 puntos, y con `10 + 2 × frutasComidas` harían falta unas 150 frutas —serpiente de 153 segmentos— para asomar por el último puesto. Una partida real se guarda correctamente, pero no aparece en el top 10 del aside ni en el top 12 de `/salon`. No es propio de este juego: `caida` está igual desde la SPEC 07, con una fila real de 216 puntos enterrada bajo su siembra. Rebajar o retirar la siembra toca la base de datos, así que va en su propia spec.
- **Adaptar los 4 juegos aún mock** (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- **Tests.** Sigue sin haber runner en el proyecto.

## Modelo de datos

Esta spec **no crea tablas ni migraciones**, y **no extiende el contrato**: la SPEC 07 ya extrajo `types.ts` y volvió condicional el HUD. Los "datos" son tres cosas: qué emite este juego, sus constantes, y la fila de catálogo que ya existe.

### (a) Contrato con la plataforma

`SnakeGame.tsx` importa `PlayableStatus`, `GameSnapshot`, `PlayableGameProps` y `PlayableGameHandle` de **`./types`** — no de `./AsteroidsGame`. No se añade ningún campo a `GameSnapshot`.

El juego emite `score`, `status` y `extra: [{ label: "Longitud", value }]`, donde `value` es el número de segmentos formateado como cadena. **No emite `lives`** (no hay vidas: la primera colisión acaba la partida) **ni `level`** (la dificultad es una rampa continua de velocidad, no escalones).

| Juego                      | `score` | `lives` | `level` | `extra`                      |
| -------------------------- | ------- | ------- | ------- | ---------------------------- |
| `rocas` (Asteroids)        | sí      | sí (3)  | sí      | `[{ label: "Poder", … }]`    |
| `caida` (Tetris)           | sí      | no      | sí      | `[{ label: "Líneas", … }]`   |
| `bloque-buster` (Arkanoid) | sí      | sí (3)  | sí      | ninguna                      |
| `serpentina` (Snake)       | sí      | **no**  | **no**  | `[{ label: "Longitud", … }]` |

`status` vale `"playing"` o `"gameover"`. **`"dead"` no se usa**: sin vidas no hay estado intermedio entre chocar y terminar.

**Regla de emisión:** `onSnapshot` se llama solo cuando cambia `score`, la longitud o `status` respecto al último emitido — en la práctica, una vez por fruta comida más una al morir. Nunca por frame.

### (b) Constantes del juego

Viven dentro de `SnakeGame.tsx`, tipadas, fuera de `createGame` por ser inmutables:

```ts
const CELL = 25; // px lógicos por casilla
const COLS = 32; // 32 × 25 = 800
const ROWS = 24; // 24 × 25 = 600
const TICK_START_MS = 130; // paso inicial
const TICK_STEP_MS = 4; // se resta por cada fruta comida
const TICK_MIN_MS = 60; // suelo de velocidad
const START_LENGTH = 3;
const START_CELL = { col: 16, row: 12 }; // cabeza; cuerpo hacia la izquierda
const START_DIR = { col: 1, row: 0 }; // derecha
const SCORE_BASE = 10; // puntos = SCORE_BASE + SCORE_STEP × frutasComidas
const SCORE_STEP = 2;
const FRUIT_SCALE = 0.9; // la fruta ocupa el 90 % de su casilla
const SPRITE_SRC = "/games/snake/fruits.png";
```

Colores del canvas, como literales con el token de `globals.css` anotado al lado (mismo criterio que `TetrisGame.tsx:143`):

```ts
const SNAKE_HEAD = "#00ff88"; // --green
const SNAKE_BODY = "#00cc6a"; // --green oscurecido
const GRID_LINE = "#141827"; // rejilla tenue de fondo
```

**Atlas de frutas**, portado 1:1 de `references/source-assets/snake-assets/sprites.js` — las **22 entradas** de la fila `y = 136`, alto 160, anchos entre 110 y 170:

```ts
type FruitRect = { sx: number; sy: number; sw: number; sh: number };
const FRUITS: readonly FruitRect[] = [
  /* banana, orange, grape, garlic, eggplant, strawberry, cherry, carrot,
     mushroom, broccoli, watermelon, pepper, kiwi, lemon, peach, peanut,
     apple, tomato, berries, grapes2, pineapple, melon */
];
```

El `window.SPRITE_ATLAS` del original **desaparece**: nada de estado global de módulo ni de escritura en `window`.

### (c) Fila del catálogo

**No hay migración.** Se reutiliza el id `serpentina`, ya sembrado por la SPEC 06:

| Campo   | Valor                                               |
| ------- | --------------------------------------------------- |
| `id`    | `serpentina`                                        |
| `title` | `SERPENTINA`                                        |
| `cat`   | `ARCADE`                                            |
| `cover` | `cover-snake` (clase ya existente en `globals.css`) |
| `color` | `green`                                             |
| `best`  | `7820` (estático, no derivado)                      |
| `plays` | `9.1K` (estático)                                   |

Su leaderboard ya tiene las 12 filas de siembra en `public.scores`. `data/games.ts` **no se toca**, y la unión `CoverArt` tampoco: `cover-snake` ya está en ella.

**Único archivo nuevo fuera de `app/`:** `public/games/snake/fruits.png`, copia literal del asset de referencia.

## Plan de implementación

Nueve pasos. Cada uno deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Lógica pura del juego, sin React

Crear `app/_components/games/SnakeGame.tsx` con `"use client"`, las constantes de la sección anterior y la fábrica `createGame(canvas, ctx, hooks): GameController`. Dentro, y solo dentro, el estado de la partida:

- La serpiente como **array de casillas** `{ col, row }`, la cabeza en el índice 0.
- **Tick discreto por acumulador**: el bucle de `requestAnimationFrame` acumula `dt` y ejecuta un paso cada `tickMs`, no un paso por frame.
- **Dirección actual + cola de un giro**, con la regla de no-inversión aplicada al encolar.
- **Avance**: nueva cabeza en la casilla contigua; si es fruta, la cola no se recorta (la serpiente crece), se recalcula `tickMs = max(TICK_MIN_MS, tickMs − TICK_STEP_MS)` y se suma `SCORE_BASE + SCORE_STEP × frutasComidas`; si no, se recorta la cola.
- **Muerte**: cabeza fuera de la rejilla o sobre una casilla del cuerpo.
- **Generador de fruta**: casilla al azar entre las libres; si no queda ninguna, fin de partida.
- **Dibujo provisional 100 % vectorial**: rejilla tenue, cuerpo, cabeza con ojos y fruta como rombo verde.

_Verificación:_ `npx tsc --noEmit` pasa y el módulo no declara ni una variable mutable fuera de `createGame`.

### 2. Ciclo de vida React

Envolver la fábrica en el componente: `forwardRef`, efecto de montaje que crea y arranca el juego y **en el cleanup lo detiene** (`cancelAnimationFrame`, `removeEventListener`, `ResizeObserver.disconnect()`). `onSnapshot` y `onGameOver` entran por **refs espejo**, nunca como dependencias. `paused` se propaga en un `useEffect` **aparte** que llama a `setPaused()`. `restart()` se expone con `useImperativeHandle`. **Cap de `dt` a 50 ms** en el bucle.

_Verificación:_ montar, desmontar y volver a montar en desarrollo (Strict Mode) deja **una sola** partida viva; navegar fuera no deja `rAF` corriendo.

### 3. Emisión de snapshot y fin de partida

Guardar el último snapshot emitido y comparar `score`, longitud y `status` antes de llamar a `onSnapshot`. Al morir: emitir `status: "gameover"` y llamar a `onGameOver(score)` **una sola vez**, con el bucle ya detenido.

_Verificación:_ una partida de 10 frutas produce 11 llamadas a `onSnapshot` (una por fruta más la de muerte), no 600.

### 4. Registro

Añadir `serpentina: dynamic(() => import("./SnakeGame"))` a `app/_components/games/registry.ts` y actualizar el comentario de cabecera del archivo, que hoy enumera los tres juegos adaptados. Va **después** del componente: si no, el player importaría algo que aún no existe.

_Verificación:_ `/juegos/serpentina/jugar` muestra el juego real en vez del mock, y el HUD pinta **Puntos** y **Longitud**, sin huecos de Vidas ni Nivel.

### 5. Escalado del canvas dentro del marco CRT

Crear `app/_components/games/SnakeGame.module.css` con el patrón `.stage` / `.canvas` de los tres juegos anteriores. El búfer del canvas se redimensiona a la resolución real × DPR (capado a 2) con un `ResizeObserver`; el contexto se escala. Las **coordenadas lógicas (800×600) no cambian**. `globals.css` no se toca.

_Verificación:_ la rejilla llena el marco sin bandas negras (es 4/3 nativo), las líneas se ven nítidas en pantalla Retina y el `body` no gana scroll horizontal.

### 6. Teclado y foco

Listeners atados a `window` en `start()` y quitados en `stop()`. `isTypingTarget(e.target)` para que el input de iniciales del modal de fin no mueva la serpiente. `preventDefault` **solo con el juego activo** (ni en pausa ni en game over), para que las flechas no scrolleen la página. Al pausar se **vacía la cola de giro**, para que un giro encolado antes de la pausa no se dispare al reanudar.

_Verificación:_ con el juego en pausa las flechas scrollean la página con normalidad; escribiendo las iniciales en el modal, las teclas `W`/`A`/`S`/`D` se escriben y no tocan el juego.

### 7. Frutas con sprite

Copiar `references/source-assets/snake-assets/fruits.png` a **`public/games/snake/fruits.png`**. Portar el atlas a la constante `FRUITS` con las 22 entradas. Cargar la hoja con el patrón de `ArkanoidGame.tsx:266-288`: `new Image()`, `onload` que entrega la hoja a la fábrica, `onerror` que registra el fallo — ambos **anulables al desmontar**, para que una carga en vuelo no toque un juego muerto.

Dibujo: la fruta se escala con `k = FRUIT_SCALE × CELL / max(sw, sh)` y se centra en su casilla, conservando la relación de aspecto del recorte. Mientras la hoja no esté cargada —o si falló— se dibuja el **rombo verde** del paso 1.

_Verificación:_ frutas distintas aparecen a lo largo de una partida, ninguna sale deformada, y renombrando el PNG a mano el juego sigue siendo jugable con rombos.

### 8. Prueba manual de extremo a extremo

Partida completa: comer varias frutas, notar la aceleración, morir contra un muro, morir contra el propio cuerpo, pausar y reanudar, guardar la puntuación en el modal, comprobarla en `/juegos/serpentina` y en `/salon`, pulsar "JUGAR DE NUEVO", salir de la ruta y volver a entrar.

### 9. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación. **`get_advisors` no aplica**: esta spec no toca la base de datos.

### Apuntes sobre el orden

- **El registro (4) va antes del escalado (5) y del teclado (6)** aunque el juego aún no se vea bien: hasta que `serpentina` no está en el registro, `GamePlayerScreen` sirve el mock y no hay forma de probar nada en el navegador.
- **Los sprites (7) van los últimos** de la parte de código a propósito. La mecánica se valida entera con el rombo vectorial; así, si algo falla al dibujar frutas, ya se sabe que el fallo está en la carga de la imagen y no en el juego.
- **El cleanup (2) va antes que el teclado (6)**, no al revés: los listeners que se atan en el paso 6 dependen de que `stop()` ya exista y se llame de verdad al desmontar.

## Criterios de aceptación

Checklist booleano: cada ítem se responde con sí o no.

### Build y calidad

- [ ] `npm run lint` termina sin errores ni avisos.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npm run build` termina sin errores ni avisos.
- [ ] La consola de `/juegos/serpentina/jugar` no muestra errores de hidratación ni advertencias de React.

### Estructura y registro

- [ ] Existen `app/_components/games/SnakeGame.tsx` y `app/_components/games/SnakeGame.module.css`.
- [ ] `SnakeGame.tsx` empieza con `"use client"`.
- [ ] `SnakeGame.tsx` importa sus tipos de `./types`, no de `./AsteroidsGame`.
- [ ] El módulo **no declara ninguna variable mutable a nivel de módulo**: solo constantes, funciones puras y clases. En particular, no escribe en `window`.
- [ ] `getPlayableGame("serpentina")` devuelve un componente, no `null`.
- [ ] `app/_components/games/registry.ts` carga el juego con `next/dynamic`, y su comentario de cabecera menciona los cuatro juegos adaptados.
- [ ] Existe `public/games/snake/fruits.png`.
- [ ] `data/games.ts` y `app/globals.css` no tienen ningún cambio.

### Juego real en `/juegos/serpentina/jugar`

- [ ] La rejilla es de 32×24 casillas de 25 px sobre un lienzo lógico de 800×600, y llena el marco CRT sin bandas negras.
- [ ] Al cargar, la serpiente mide **3 segmentos**, está en el centro y avanza **hacia la derecha** sin esperar ninguna tecla.
- [ ] Las flechas y `W`/`A`/`S`/`D` cambian la dirección.
- [ ] Pulsar la dirección **contraria** a la marcha no hace nada: la serpiente sigue su rumbo.
- [ ] Pulsar dos direcciones distintas dentro del mismo tick aplica **solo la primera**; la segunda se descarta.
- [ ] Comer una fruta alarga la serpiente en **un segmento** y suma `10 + 2 × frutasComidas` puntos: la primera fruta suma **12**, la segunda **14**, la décima **30**.
- [ ] El HUD muestra **Puntos** y **Longitud**, y **no** muestra Vidas ni Nivel.
- [ ] La longitud del HUD coincide con los segmentos en pantalla tras cada fruta.
- [ ] Cada fruta comida acelera el paso en 4 ms, y la velocidad **no baja de 60 ms** por paso por muchas frutas que se coman.
- [ ] La fruta nunca aparece sobre una casilla ocupada por la serpiente.
- [ ] Chocar contra cualquiera de los cuatro bordes termina la partida.
- [ ] Chocar contra el propio cuerpo termina la partida.
- [ ] Al morir se abre el modal de fin **una sola vez**, con la puntuación real de la partida.
- [ ] El botón PAUSA congela la serpiente; al reanudar sigue en la misma dirección y **no ejecuta ningún giro encolado** antes de la pausa.
- [ ] Con el juego en pausa o en game over, las flechas scrollean la página con normalidad.
- [ ] Escribiendo las iniciales en el input del modal, `W`/`A`/`S`/`D` se escriben en el campo y no mueven la serpiente.
- [ ] "JUGAR DE NUEVO" reinicia a 3 segmentos, 0 puntos y 130 ms por paso.

### Assets

- [ ] Las frutas se dibujan desde `fruits.png`, y a lo largo de una partida aparecen frutas visualmente distintas.
- [ ] Ninguna fruta sale deformada: se respeta la relación de aspecto de su recorte y ocupa el 90 % de la casilla.
- [ ] Renombrando `public/games/snake/fruits.png` a mano, el juego sigue siendo jugable: la fruta se dibuja como rombo verde y no se lanza ninguna excepción.
- [ ] Salir de la ruta mientras la imagen aún carga no produce ningún error en consola.

### Guardado y leaderboard

- [ ] El modal de fin guarda la puntuación real en `public.scores` con `game_id = 'serpentina'`.
- [ ] La puntuación guardada aparece en el aside de `/juegos/serpentina` y en la pestaña correspondiente de `/salon`. **Se verifica por consulta a `public.scores`, no visualmente:** la siembra de la SPEC 06 sepulta cualquier puntuación real, y reconciliarla queda aplazado a su propia spec (ver "Fuera de alcance"). El criterio se da por cumplido si la fila existe con su `game_id`, `player_name` y `user_id` correctos.
- [ ] Con sesión iniciada, la fila guardada lleva `user_id` y el `display_name` del perfil, ignorando el nombre del formulario.
- [ ] Como invitado, la fila se guarda con `user_id null` y el nombre tecleado.
- [ ] No se ha escrito ninguna consulta ni Server Action nueva: `saveScore` y `getTopScores` se usan tal cual.

### No regresión

- [ ] `/juegos/rocas/jugar` sigue igual: HUD con Vidas y Nivel, power-up en `extra`, pausa, reinicio y guardado real.
- [ ] `/juegos/caida/jugar` sigue igual: HUD con Nivel y Líneas, sin Vidas.
- [ ] `/juegos/bloque-buster/jugar` sigue igual: HUD con Vidas y Nivel, sprites y niveles encadenados.
- [ ] `/juegos/gloton/jugar` mantiene el **mock intacto**: ticker de puntuación falsa, enemigos CSS y guardado por toast.
- [ ] `GamePlayerScreen.tsx` no tiene cambios; si los tuviera, la rama `MockGamePlayer` sigue sin tocar.
- [ ] Responden 200: `/`, `/biblioteca`, `/juegos/serpentina`, `/juegos/rocas`, `/salon`, `/about`, `/auth`.
- [ ] Ninguna ruta gana scroll horizontal en el `body`.
- [ ] Salir de `/juegos/serpentina/jugar` y volver a entrar arranca una partida limpia, sin `rAF` ni listeners del render anterior.

## Decisiones

- **Id del catálogo: `serpentina`, reutilizado. No un id nuevo.** La ficha ya describe exactamente este juego ("una serpiente de luz recorre la grilla"), y la portada `cover-snake`, el color `green` y las 12 filas de leaderboard ya están sembradas desde la SPEC 06. Un id nuevo duplicaría la ficha y dejaría un mock huérfano en `/biblioteca`.
- **Juego escrito desde cero. No portado.** No existe carpeta en `references/started-games/` para Snake: lo único que aporta la referencia es el atlas de sprites. Es la primera spec de juego del proyecto que define la mecánica en vez de heredarla, y por eso el plan fija tick, puntuación y colisiones con números concretos: no hay `game.js` al que volver a preguntar.
- **Muros mortales. No wrap-around.** Con bordes que se atraviesan, la dificultad se aplana y morir pasa a depender solo de la longitud. El muro mantiene la tensión desde el primer minuto y encaja con la ficha del catálogo.
- **Aceleración continua por fruta. No niveles.** Restar 4 ms por fruta da una rampa suave y una sola variable de dificultad. Los escalones obligarían a emitir `level` y a inventar un umbral arbitrario. Consecuencia asumida: el HUD no tiene campo Nivel.
- **Puntuación creciente `10 + 2 × frutasComidas`. No 10 fijos.** Sin vidas ni niveles, es lo único que diferencia una partida larga de una corta más allá del recuento de frutas: premia sobrevivir cuando la serpiente ya es peligrosamente larga. El coste es nulo — un contador que ya existe.
- **Todas las frutas valen lo mismo. No frutas raras con caducidad.** La variante por rareza añade temporizador, parpadeo de aviso y una segunda entidad que testear, y no es imprescindible para que el juego funcione. Se aplaza a su propia spec; los 22 sprites ya dan la variedad visual sin coste de lógica.
- **Cola de un solo giro por tick. No de dos.** Es la defensa contra el suicidio clásico: dos teclas en el mismo tick invirtiendo la marcha. Una cola de dos giros da esquinas más ágiles a cambio de reintroducir ese riesgo por la puerta de atrás.
- **Las 22 frutas del atlas. No un subconjunto.** Los recortes ya están medidos en `sprites.js`; quedarse con 8 sería trabajo extra para tener menos variedad, y el PNG entra entero de todos modos.
- **`fruits.png` se copia tal cual, sin recortar ni comprimir.** Son 585 KB, pero la carga es diferida con el propio juego (`next/dynamic`) y no entra en el bundle de ninguna otra ruta. Optimizarlo es una tarea de assets, no de esta spec, y recortarlo obligaría a recalcular las 22 coordenadas.
- **Serpiente vectorial. No sprites.** El atlas de `spriters-resource` solo trae la fila de frutas; dibujar el cuerpo con rectángulos verdes `--green` además encaja mejor con la estética neón del vault que un sprite ajeno.
- **HUD: `score` + `extra: Longitud`. Sin `lives` ni `level`.** El juego no tiene ninguna de las dos, y desde la SPEC 07 el HUD omite los huecos que el snapshot no trae. Inventar "Vidas: 1" para llenar el hueco sería mentirle al jugador.
- **Arranque inmediato. Sin cuenta atrás ni respiro inicial.** Los tres juegos ya adaptados arrancan al montar; una excepción aquí rompería la expectativa. Con 3 segmentos en el centro y 16 casillas hasta el muro derecho, hay margen de sobra para reaccionar.
- **Rejilla llena = fin de partida.** Cuando no queda casilla libre para la fruta, la partida termina con la puntuación acumulada. Es prácticamente inalcanzable (768 casillas), pero deja el generador de fruta acotado en vez de dejarlo buscando hueco en un bucle infinito.
- **`app/globals.css` no se toca.** La excepción de cover art que contempla el contrato de plataforma **no aplica**: `cover-snake` y su entrada en la unión `CoverArt` existen desde la SPEC 01.
- **Sin audio, sin controles táctiles y sin teclas `P`/`Escape`.** El audio no tiene assets. El táctil pide un esquema de swipe que ningún otro juego del vault tiene todavía, y hacerlo bien es una spec transversal a los cuatro juegos, no un añadido a este. La pausa es estado declarativo de la plataforma: si el juego capturara `P`, habría dos fuentes de verdad para el mismo estado.
- **Los sprites se implementan al final del plan, no al principio.** Validar la mecánica completa con un rombo vectorial separa los fallos de juego de los fallos de carga de imagen. Es la lección de la SPEC 08, donde el spritesheet y la física llegaron juntos.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `rAF` y listeners que sobreviven al desmontaje (bucles fantasma, score fantasma)            | Cleanup completo en el efecto de montaje; criterio de aceptación que exige entrar y salir de la ruta              |
| Estado mutable a nivel de módulo (el `window.SPRITE_ATLAS` del original invita a ello)      | Todo dentro de `createGame`; el atlas es una `const readonly` y nada escribe en `window`; criterio explícito      |
| Doble montaje de React Strict Mode en desarrollo                                            | El cleanup hace el efecto idempotente: montar→desmontar→montar deja una sola partida                              |
| `onSnapshot` llamado cada frame (60 `setState`/s)                                           | Emitir solo al cambiar `score`, longitud o `status`; criterio que cuenta 11 emisiones en una partida de 10 frutas |
| `paused` en las deps del efecto de montaje reinicia la partida                              | Efecto aparte que llama a `setPaused()`                                                                           |
| Flechas y `WASD` scrollean la página o roban el foco al input de iniciales                  | `preventDefault` solo con el juego activo; `isTypingTarget` en cada `keydown`                                     |
| **Suicidio por doble pulsación**: dos teclas en el mismo tick invierten la marcha           | Cola de un solo giro por tick, con la no-inversión comprobada al encolar; criterio de aceptación dedicado         |
| **Giro encolado que se dispara al reanudar** tras una pausa                                 | La cola de giro se vacía en `setPaused(true)`                                                                     |
| **Salto de varias casillas al volver de una pestaña en segundo plano** (acumulador de tick) | Cap de `dt` a 50 ms antes de acumular: como mucho se ejecuta un paso extra, nunca una ráfaga                      |
| **Fruta generada sobre el cuerpo** de la serpiente, incomible o comida por accidente        | El generador elige entre las casillas libres, no al azar en toda la rejilla; criterio explícito                   |
| **Bucle infinito buscando casilla libre** con la rejilla casi llena                         | Sin casilla libre, la partida termina; el generador nunca reintenta indefinidamente                               |
| **Carga en vuelo de `fruits.png` que toca un juego ya desmontado**                          | `onload`/`onerror` anulables en `stop()`, como en `ArkanoidGame.tsx:266-288`                                      |
| **Frutas deformadas** al meter recortes de 110×160 a 170×160 en casillas cuadradas de 25 px | Escalado por `min` conservando la relación de aspecto y centrado en la casilla; criterio de aceptación dedicado   |
| El PNG no llega a producción o falla la ruta y el juego se queda sin dibujar la fruta       | Fallback a rombo vectorial: la partida es jugable sin la imagen; criterio que lo verifica renombrando el archivo  |
| Regresión del mock al tocar `GamePlayerScreen`                                              | Esta spec **no toca** `GamePlayerScreen.tsx`; criterio que verifica `/juegos/gloton/jugar` como testigo mock      |
| Movimiento por frame en vez de por tick, que ataría la velocidad al refresco del monitor    | Acumulador de tiempo con paso fijo `tickMs`; en 144 Hz la serpiente avanza igual que en 60 Hz                     |

## Lo que **no** entra en esta spec

- **Audio.** No hay assets de sonido y no se añaden.
- **Frutas especiales con valor propio y caducidad** (+50, parpadeo, temporizador).
- **Obstáculos internos, muros por nivel o niveles como concepto.**
- **Wrap-around por los bordes.**
- **Sprites para la serpiente.** Cabeza y cuerpo son vectoriales.
- **Controles táctiles o por swipe.**
- **Teclas `P` / `Escape` de pausa.**
- **Optimizar, recortar o comprimir `fruits.png`.**
- **`best` y `plays` derivados** de las puntuaciones reales: siguen estáticos, por decisión de la SPEC 06.
- **Reconciliar la siembra de `public.scores` con las puntuaciones reales**, que hoy la sepultan por dos órdenes de magnitud (ver "Fuera de alcance").
- **Adaptar los cuatro juegos aún mock**: `gloton`, `invasores`, `ranaria`, `duelo-pixel`.
- **Tests.** El proyecto sigue sin runner.

_Cada uno de esos, si llega, va en su propia spec._
