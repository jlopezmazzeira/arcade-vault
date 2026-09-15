# SPEC 12 — Skins clásico, neón y retro de Tetris (`caida`)

> **Status:** Approved
> **Depends on:** SPEC 10 (contrato de skins), SPEC 07 (adaptación de Tetris), SPEC 05 (contrato de juego y registro)
> **Date:** 2026-09-15
> **Objective:** Dar a `caida` las tres skins obligatorias agrupando sus colores en un registro de paletas, sin que la skin `clasico` cambie ni un píxel.

## Alcance

**Dentro:**

- **`app/_components/games/TetrisGame.tsx`** y su paleta por skin. Es el único fichero de juego que se toca.
- **Consumo del contrato de la SPEC 10, ya implementado.** `SkinId` y `DEFAULT_SKIN` se importan de `app/_components/games/skins.ts`; `PlayableGameProps` ya declara `skin?: SkinId` (`app/_components/games/types.ts:28-34`); el selector del HUD (`app/_components/GamePlayerScreen.tsx:174-190`) y la persistencia en `av-skin-caida` (`GamePlayerScreen.tsx:66`, `:105-107`, `:116`) ya están montados. Esta spec no añade nada a ninguno de los tres.
- **Paso previo de extracción de dos literales.** `caida` es un caso mixto de fuente: los siete colores de pieza ya viven en `COLORS` (`TetrisGame.tsx:52-58`) y los cuatro de decorado en constantes con nombre (`TetrisGame.tsx:140-143`), pero quedan **dos literales sueltos** dentro de las llamadas de dibujo: el fondo `"#000"` (`TetrisGame.tsx:655`) y el brillo superior del bloque `"rgba(255,255,255,0.12)"` (`TetrisGame.tsx:375`). El primer paso los recoge **sin cambiar ni un valor**, y se commitea solo.
- **Las tres paletas** en el módulo del juego, como un `Record<SkinId, Palette>`, con la misma forma que `AsteroidsGame.tsx:62-119`. `clasico` copia literalmente los valores actuales.
- **`setSkin(next: SkinId)` en el `GameController`** de `TetrisGame.tsx:405-410`, como quinto método junto a `start`, `stop`, `restart` y `setPaused` (`TetrisGame.tsx:772`). Reasigna la paleta activa y repinta el frame; **no toca `board`, `current`, `next`, `score`, `lines`, `level` ni `dropInterval`**.
- **Un `useEffect` aparte** en el componente React que propaga `skin` llamando a `setSkin()`, con `skin` como única dependencia. Es el patrón exacto del efecto de `paused` de `TetrisGame.tsx:822` y del de `skin` ya escrito en `AsteroidsGame.tsx:915-921`.
- **Once superficies pintables**, todas vectoriales: fondo del lienzo, rejilla, tinte del tablero, borde del tablero, borde del recuadro de `SIGUIENTE`, rótulo `SIGUIENTE`, brillo superior del bloque y los siete colores de pieza.
- **No regresión explícita**: los cuatro ids que hoy están en `app/_components/games/registry.ts` — `rocas`, `caida`, `bloque-buster` y `serpentina` — siguen jugándose igual, y `rocas` conserva las tres paletas de la SPEC 11. El testigo mock es **`/juegos/gloton/jugar`**, un id sin entrada en el registro, que conserva su mock y no muestra selector.

**Fuera de alcance (para futuras specs):**

- **La corrección de los hallazgos de contraste de `clasico`.** Esta spec documenta que el tinte del tablero queda a 1.03:1, por debajo del piso de decorado, y **no lo corrige**: `clasico` reproduce el estado actual y es la red de no regresión. Los arreglos de legibilidad de las paletas actuales van en la SPEC 15.
- **Skins de `bloque-buster` y `serpentina`.** Cada juego va en su propia spec: la SPEC 13 y la SPEC 14.
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas.
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma y son iguales para las tres skins.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`. No tienen canvas que vestir.
- **Animación de transición al cambiar de skin.** El cambio es instantáneo, en el frame siguiente.
- **Audio por skin.**
- **Tests.** Sigue sin haber runner en el proyecto.

## Modelo de datos

### (a) Contrato con la plataforma

El juego importa el contrato ya existente y no define nada propio:

```ts
import { DEFAULT_SKIN, type SkinId } from "./skins";
```

`skin` llega como prop opcional de `PlayableGameProps`. `GamePlayerScreen` la gobierna con el selector del HUD y la persiste en la clave `av-skin-caida`.

**Cambiar de skin no reinicia la partida.** El `GameController` gana un quinto método, `setSkin(next: SkinId)`, que solo reasigna la paleta activa del closure y llama a `draw()` para repintar el frame en curso. El componente lo propaga desde un **`useEffect` aparte**:

```ts
// `skin` NUNCA entra en las deps del efecto de montaje: si entrase, cada
// cambio de skin destruiría y recrearía el juego, y el jugador perdería la
// pila de piezas y la puntuación al tocar el selector.
useEffect(() => {
  gameRef.current?.setSkin(skin ?? DEFAULT_SKIN);
}, [skin]);
```

La paleta activa se lee en el momento de dibujar. `drawCell` deja de leer `COLORS` de módulo y recibe la paleta como argumento, igual que las entidades de `AsteroidsGame.tsx:204`, `:266`, `:315`. Así una pieza ya fijada en el tablero antes del cambio de skin se pinta con la piel nueva en el frame siguiente.

Forma del registro de paletas:

```ts
type Palette = {
  background: string;
  grid: string; // rejilla de todo el lienzo
  boardTint: string; // relleno del tablero de juego
  boardBorder: string; // borde del tablero y del recuadro de SIGUIENTE
  label: string; // rótulo "SIGUIENTE"
  cellHighlight: string; // barra de brillo superior del bloque
  pieces: Record<PieceType, string>; // los siete tetrominós
  glow: number; // shadowBlur; 0 en clasico y retro
};

const PALETTES: Record<SkinId, Palette> = { clasico, neon, retro };
```

### (b) Las tres paletas

Las once superficies pintables y su origen actual, comprobado con `grep`:

| #   | Superficie                 | Dónde hoy                    | Valor actual              |
| --- | -------------------------- | ---------------------------- | ------------------------- |
| 1   | Fondo del lienzo           | `draw()` `:655`              | `#000`                    |
| 2   | Rejilla                    | `GRID_COLOR` `:140`          | `rgba(0, 245, 255, 0.08)` |
| 3   | Tinte del tablero          | `BOARD_TINT` `:141`          | `rgba(0, 245, 255, 0.03)` |
| 4   | Borde del tablero          | `BOARD_BORDER` `:142`        | `rgba(0, 245, 255, 0.25)` |
| 5   | Borde de `SIGUIENTE`       | `BOARD_BORDER` `:605`        | `rgba(0, 245, 255, 0.25)` |
| 6   | Rótulo `SIGUIENTE`         | `LABEL_COLOR` `:143`, `:600` | `#8a8fb5`                 |
| 7   | Brillo superior del bloque | `drawCell` `:375`            | `rgba(255,255,255,0.12)`  |
| 8   | Siete colores de pieza     | `COLORS` `:52-58`            | ver `clasico`             |

La pieza fantasma no es una superficie propia: se pinta con el color de su pieza y `GHOST_ALPHA = 0.2` (`TetrisGame.tsx:115`, `:587`).

#### `clasico` — la skin por defecto

```ts
const clasico: Palette = {
  background: "#000",
  grid: "rgba(0, 245, 255, 0.08)",
  boardTint: "rgba(0, 245, 255, 0.03)",
  boardBorder: "rgba(0, 245, 255, 0.25)",
  label: "#8a8fb5",
  cellHighlight: "rgba(255,255,255,0.12)",
  pieces: {
    1: "#4dd0e1", // I
    2: "#ffd54f", // O
    3: "#ba68c8", // T
    4: "#81c784", // S
    5: "#e57373", // Z
    6: "#90caf9", // J
    7: "#ffb74d", // L
  },
  glow: 0,
};
```

Son **los valores literales que el fichero tiene hoy**, copiados uno a uno, formas cortas incluidas. Ninguno se ajusta ni se normaliza.

Las piezas se miden contra el tablero compuesto, no contra el fondo: `rgba(0,245,255,0.03)` sobre `#000` da `#000708`.

| Skin      | Entidad                   | Color     | Fondo     | Ratio       | Suelo   | ✅          |
| --------- | ------------------------- | --------- | --------- | ----------- | ------- | ----------- |
| `clasico` | Pieza I                   | `#4dd0e1` | `#000708` | **11.05:1** | ≥4.5    | ✅          |
| `clasico` | Pieza O                   | `#ffd54f` | `#000708` | **14.39:1** | ≥4.5    | ✅          |
| `clasico` | Pieza T                   | `#ba68c8` | `#000708` | **5.71:1**  | ≥4.5    | ✅          |
| `clasico` | Pieza S                   | `#81c784` | `#000708` | **10.09:1** | ≥4.5    | ✅          |
| `clasico` | Pieza Z                   | `#e57373` | `#000708` | **6.80:1**  | ≥4.5    | ✅          |
| `clasico` | Pieza J                   | `#90caf9` | `#000708` | **11.61:1** | ≥4.5    | ✅          |
| `clasico` | Pieza L                   | `#ffb74d` | `#000708` | **11.73:1** | ≥4.5    | ✅          |
| `clasico` | Rótulo `SIGUIENTE`        | `#8a8fb5` | `#000000` | **6.68:1**  | ≥4.5    | ✅          |
| `clasico` | Rejilla → `#001414`       | α 0.08    | `#000000` | **1.11:1**  | 1.1–2.5 | ✅          |
| `clasico` | Borde → `#003d40`         | α 0.25    | `#000000` | **1.74:1**  | 1.1–2.5 | ✅          |
| `clasico` | Tinte tablero → `#000708` | α 0.03    | `#000000` | **1.03:1**  | 1.1–2.5 | ⚠️ hallazgo |

El 1.03:1 del tinte del tablero queda por debajo del piso de decorado: es tan tenue que en la práctica no se ve. **Es un hallazgo, no un defecto a corregir en esta spec.** Ver `## Decisiones`.

#### `neon` — fondo `#05010f`, con halo

Mismo fondo que la `neon` de `rocas` (`AsteroidsGame.tsx:95`), para que las skins se lean como una familia.

```ts
const neon: Palette = {
  background: "#05010f",
  grid: "rgba(0, 245, 255, 0.16)",
  boardTint: "rgba(0, 245, 255, 0.10)",
  boardBorder: "rgba(0, 245, 255, 0.32)",
  label: "#7ad9ff",
  cellHighlight: "rgba(255,255,255,0.12)",
  pieces: {
    1: "#00f5ff", // I — token --cyan
    2: "#f5ff00", // O — token --yellow
    3: "#c04dff", // T
    4: "#00ff88", // S — token --green
    5: "#ff3d6e", // Z
    6: "#4d8bff", // J
    7: "#ff9d00", // L
  },
  glow: 8,
};
```

Tablero compuesto: `rgba(0,245,255,0.10)` sobre `#05010f` da `#051927`.

| Skin   | Entidad                   | Color     | Fondo     | Ratio       | Suelo   | ✅  |
| ------ | ------------------------- | --------- | --------- | ----------- | ------- | --- |
| `neon` | Pieza I                   | `#00f5ff` | `#051927` | **13.20:1** | ≥4.5    | ✅  |
| `neon` | Pieza O                   | `#f5ff00` | `#051927` | **16.33:1** | ≥4.5    | ✅  |
| `neon` | Pieza T                   | `#c04dff` | `#051927` | **4.89:1**  | ≥4.5    | ✅  |
| `neon` | Pieza S                   | `#00ff88` | `#051927` | **13.33:1** | ≥4.5    | ✅  |
| `neon` | Pieza Z                   | `#ff3d6e` | `#051927` | **5.23:1**  | ≥4.5    | ✅  |
| `neon` | Pieza J                   | `#4d8bff` | `#051927` | **5.49:1**  | ≥4.5    | ✅  |
| `neon` | Pieza L                   | `#ff9d00` | `#051927` | **8.58:1**  | ≥4.5    | ✅  |
| `neon` | Rótulo `SIGUIENTE`        | `#7ad9ff` | `#05010f` | **12.97:1** | ≥4.5    | ✅  |
| `neon` | Tinte tablero → `#051927` | α 0.10    | `#05010f` | **1.15:1**  | 1.1–2.5 | ✅  |
| `neon` | Rejilla → `#042835`       | α 0.16    | `#05010f` | **1.34:1**  | 1.1–2.5 | ✅  |
| `neon` | Borde → `#034f5c`         | α 0.32    | `#05010f` | **2.24:1**  | 1.1–2.5 | ✅  |

El halo (`shadowBlur: 8`, `shadowColor` igual al color de la pieza) solo suma brillo alrededor del núcleo: todos los ratios están calculados sobre el color del núcleo, que es lo conservador.

#### `retro` — fondo `#1a1206`, fósforo ámbar, sin halo

Mismo fondo que la `retro` de `rocas` (`AsteroidsGame.tsx:109`).

```ts
const retro: Palette = {
  background: "#1a1206",
  grid: "rgba(255, 176, 0, 0.13)",
  boardTint: "rgba(255, 176, 0, 0.08)",
  boardBorder: "rgba(255, 176, 0, 0.35)",
  label: "#c08a2e",
  cellHighlight: "rgba(255,255,255,0.12)",
  pieces: {
    1: "#fff0c9", // I
    2: "#ffd98a", // O
    3: "#f0b24a", // T
    4: "#d99a3c", // S
    5: "#c98a2e", // Z
    6: "#c2822d", // J
    7: "#ffc266", // L
  },
  glow: 0,
};
```

Tablero compuesto: `rgba(255,176,0,0.08)` sobre `#1a1206` da `#2c1f06`.

| Skin    | Entidad                   | Color     | Fondo     | Ratio       | Suelo   | ✅  |
| ------- | ------------------------- | --------- | --------- | ----------- | ------- | --- |
| `retro` | Pieza I                   | `#fff0c9` | `#2c1f06` | **14.21:1** | ≥4.5    | ✅  |
| `retro` | Pieza O                   | `#ffd98a` | `#2c1f06` | **11.90:1** | ≥4.5    | ✅  |
| `retro` | Pieza T                   | `#f0b24a` | `#2c1f06` | **8.56:1**  | ≥4.5    | ✅  |
| `retro` | Pieza S                   | `#d99a3c` | `#2c1f06` | **6.62:1**  | ≥4.5    | ✅  |
| `retro` | Pieza Z                   | `#c98a2e` | `#2c1f06` | **5.48:1**  | ≥4.5    | ✅  |
| `retro` | Pieza J                   | `#c2822d` | `#2c1f06` | **5.00:1**  | ≥4.5    | ✅  |
| `retro` | Pieza L                   | `#ffc266` | `#2c1f06` | **10.08:1** | ≥4.5    | ✅  |
| `retro` | Rótulo `SIGUIENTE`        | `#c08a2e` | `#1a1206` | **6.10:1**  | ≥4.5    | ✅  |
| `retro` | Tinte tablero → `#2c1f06` | α 0.08    | `#1a1206` | **1.15:1**  | 1.1–2.5 | ✅  |
| `retro` | Rejilla → `#382705`       | α 0.13    | `#1a1206` | **1.29:1**  | 1.1–2.5 | ✅  |
| `retro` | Borde → `#6a4904`         | α 0.35    | `#1a1206` | **2.27:1**  | 1.1–2.5 | ✅  |

#### Pares entre piezas — excepción de forma

El suelo de 1.5:1 entre entidades **no se cumple por color en ninguna de las tres skins**, y es deliberado:

| Skin      | Par más flojo | Ratio      | Suelo |                    |
| --------- | ------------- | ---------- | ----- | ------------------ |
| `clasico` | I / J         | **1.05:1** | ≥1.5  | excepción de forma |
| `neon`    | I / S         | **1.01:1** | ≥1.5  | excepción de forma |
| `retro`   | Z / J         | **1.10:1** | ≥1.5  | excepción de forma |

**Qué rasgo de forma hace el trabajo:** los siete tetrominós son siete siluetas distintas de cuatro celdas; cada bloque se pinta con un margen de 1 px por lado (`drawCell` `:372`, `fillRect(x + 1, y + 1, size - 2, size - 2)`) y con una barra de brillo de 4 px en su borde superior (`:375-376`), de modo que dos bloques contiguos siempre muestran una junta y una arista iluminada. Ninguna decisión del jugador depende de distinguir dos colores de pieza entre sí: la pieza que cae es una sola y su forma está siempre visible en el recuadro `SIGUIENTE`.

La pieza fantasma queda entre 1.21:1 y 1.83:1 sobre el tablero en las tres skins. Es decorado por definición —marca dónde aterrizará la pieza— y se distingue además porque no lleva barra de brillo.

### (c) Persistencia

- **Clave:** `av-skin-caida`, generada por `skinKey` (`GamePlayerScreen.tsx:66`). Ya implementada por la SPEC 10; esta spec no la toca.
- **Lectura en efecto, no en render** (`GamePlayerScreen.tsx:100-110`), validada con `isSkinId` de `skins.ts` y con salida a `clasico`.
- **Acceso envuelto en `try/catch`,** tanto en lectura como en escritura.
- **Sin migración.** No se crea nada en `supabase/migrations/`, no se toca `public.games` y no se llama a ningún MCP de escritura.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Extraer los dos literales sueltos

Sacar `"#000"` de `TetrisGame.tsx:655` y `"rgba(255,255,255,0.12)"` de `TetrisGame.tsx:375` a dos constantes de módulo con nombre, junto a las de `:140-143`. **Sin cambiar ni un valor.** Se commitea solo.

_Verificación:_ el juego se ve idéntico píxel a píxel en `/juegos/caida/jugar` y `npx tsc --noEmit` pasa.

### 2. Definir las tres paletas

Añadir el tipo `Palette`, los tres objetos `clasico`, `neon` y `retro`, y el `PALETTES: Record<SkinId, Palette>`. `clasico` recoge las constantes del paso 1 y las de `:52-58` y `:140-143` **con sus valores literales**. Nadie las usa todavía.

_Verificación:_ `npx tsc --noEmit` y `npm run lint` pasan; el juego sigue viéndose idéntico porque el dibujo aún lee las constantes viejas.

### 3. Pasar la paleta a las funciones de dibujo

`drawCell`, `drawGrid`, `drawBoard`, `drawPiece`, `drawPanel` y `draw` reciben la paleta como argumento en vez de leer las constantes de módulo. Se declara `let palette: Palette = PALETTES[DEFAULT_SKIN]` dentro de `createGame`, como en `AsteroidsGame.tsx:549`. Las constantes viejas desaparecen absorbidas por `clasico`.

_Verificación:_ el juego se ve idéntico; `npm run lint` sigue en verde sin variables sin usar.

### 4. `setSkin()` en el `GameController`

Añadir `setSkin: (skin: SkinId) => void` al tipo de `TetrisGame.tsx:405-410` y devolverlo en `:772`. El cuerpo reasigna `palette` y llama a `draw()` para repintar el frame en curso, porque en pausa el bucle no dibuja. **No toca `state.board`, `state.current`, `state.next`, `state.score`, `state.lines`, `state.level` ni `state.dropInterval`.**

_Verificación:_ `npx tsc --noEmit` pasa; llamado desde la consola del navegador con `"neon"`, la pila de piezas y la puntuación no cambian.

### 5. El `useEffect` aparte que propaga `skin`

El componente desestructura `skin` de sus props y añade un efecto con `[skin]` como única dependencia, junto al de `paused` de `:822`. **`skin` no entra en las deps del efecto de montaje.**

_Verificación:_ cambiar de skin con una partida en curso conserva la pila, la pieza que cae, la siguiente y el marcador.

### 6. Prueba manual de extremo a extremo

Una persona, en el navegador: entrar en `/juegos/caida/jugar`, apilar ocho o diez piezas, recorrer las tres skins con el selector del HUD, hacer una línea en cada skin, pausar y reanudar, morir y reiniciar, salir a `/juegos/caida` y volver a entrar. Comprobar que `/juegos/rocas/jugar` conserva sus tres paletas y que `/juegos/gloton/jugar` sigue con su mock y sin selector.

_Verificación:_ ningún paso reinicia la partida ni deja errores en la consola del navegador.

### 7. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas previas en 200: `/`, `/biblioteca`, `/juegos/caida`, `/salon`, `/about`, `/auth`.

_Verificación:_ los tres comandos terminan en verde y las seis rutas responden 200.

### Apuntes sobre el orden

- La extracción de los dos literales (paso 1) va primero y sola porque es el único cambio de esta spec que puede introducir una regresión invisible: si el fondo o el brillo cambian, se detecta con el juego aún sin skins, no mezclado con siete colores nuevos.
- El paso 3 va antes que el 4 porque `setSkin()` no tiene nada que reasignar hasta que el dibujo lee de una paleta variable en vez de constantes de módulo.
- El paso 4 va antes que el 5 porque el efecto necesita un método al que llamar; al revés, el efecto llamaría a un `setSkin` inexistente y `tsc` fallaría.
- El paso 5 es el último del código porque es el que hace visible el cambio de skin: hasta entonces el juego compila y juega, pero siempre en `clasico`.
- La prueba manual va antes de la pasada final para que los fallos de comportamiento se arreglen antes de firmar el build.

## Criterios de aceptación

### No regresión de clásico

- [ ] Con la skin `clasico`, el fondo del lienzo se pinta con `#000`.
- [ ] Con la skin `clasico`, las siete piezas se pintan con `#4dd0e1`, `#ffd54f`, `#ba68c8`, `#81c784`, `#e57373`, `#90caf9` y `#ffb74d`, en ese orden de I a L.
- [ ] Con la skin `clasico`, la rejilla se pinta con `rgba(0, 245, 255, 0.08)`.
- [ ] Con la skin `clasico`, el tinte del tablero se pinta con `rgba(0, 245, 255, 0.03)`.
- [ ] Con la skin `clasico`, el borde del tablero y el del recuadro de `SIGUIENTE` se pintan con `rgba(0, 245, 255, 0.25)`.
- [ ] Con la skin `clasico`, el rótulo `SIGUIENTE` se pinta con `#8a8fb5`.
- [ ] Con la skin `clasico`, la barra de brillo del bloque se pinta con `rgba(255,255,255,0.12)`.
- [ ] Con la skin `clasico`, la pieza fantasma se pinta con `GHOST_ALPHA = 0.2`.
- [ ] `clasico` es la skin activa la primera vez que se abre `/juegos/caida/jugar` sin clave previa en `localStorage`.

### Las tres skins

- [ ] El selector del HUD ofrece `CLÁSICO`, `NEÓN` y `RETRO` en `/juegos/caida/jugar`.
- [ ] Con `neon` el fondo del lienzo es `#05010f` y las piezas son `#00f5ff`, `#f5ff00`, `#c04dff`, `#00ff88`, `#ff3d6e`, `#4d8bff` y `#ff9d00`.
- [ ] Con `neon` las piezas se pintan con halo (`shadowBlur` 8).
- [ ] Con `retro` el fondo del lienzo es `#1a1206` y las piezas son `#fff0c9`, `#ffd98a`, `#f0b24a`, `#d99a3c`, `#c98a2e`, `#c2822d` y `#ffc266`.
- [ ] Con `retro` ninguna superficie se pinta con halo: `shadowBlur` vale 0.
- [ ] `PALETTES` es un `Record<SkinId, Palette>` con exactamente tres claves.

### Contraste

- [ ] La pieza T de `neon` contrasta **4.89:1** contra su tablero `#051927`; es la peor de esa skin y pasa el suelo de 4.5:1.
- [ ] La pieza J de `retro` contrasta **5.00:1** contra su tablero `#2c1f06`; es la peor de esa skin y pasa el suelo de 4.5:1.
- [ ] La pieza T de `clasico` contrasta **5.71:1** contra su tablero `#000708`; es la peor de esa skin y pasa el suelo de 4.5:1.
- [ ] El rótulo `SIGUIENTE` contrasta **6.68:1** en `clasico`, **12.97:1** en `neon` y **6.10:1** en `retro` contra el fondo de su propia skin.
- [ ] El tinte del tablero de `neon` contrasta **1.15:1** y el de `retro` **1.15:1** contra el fondo de su propia skin: dentro de la banda de decorado 1.1–2.5.
- [ ] La rejilla contrasta **1.11:1** en `clasico`, **1.34:1** en `neon` y **1.29:1** en `retro` contra el fondo de su propia skin.
- [ ] El borde del tablero contrasta **1.74:1** en `clasico`, **2.24:1** en `neon` y **2.27:1** en `retro` contra el fondo de su propia skin.
- [ ] El tinte del tablero de `clasico` contrasta **1.03:1** contra `#000000` y queda por debajo de la banda de decorado: está documentado como hallazgo y no se corrige aquí.
- [ ] El par de piezas más flojo es I/J a **1.05:1** en `clasico`, I/S a **1.01:1** en `neon` y Z/J a **1.10:1** en `retro`: los tres quedan por debajo de 1.5:1 y se resuelven por la excepción de forma declarada en `## Decisiones`.

### Cambio en caliente

- [ ] Cambiar de skin con una partida en curso conserva la puntuación, las líneas, el nivel, la pila del tablero, la pieza que cae y la pieza siguiente: no reinicia.
- [ ] Cambiar de skin estando en pausa repinta el lienzo con la piel nueva y mantiene el juego en pausa.
- [ ] En `TetrisGame.tsx`, `skin` no aparece en el array de dependencias del efecto de montaje.
- [ ] En `TetrisGame.tsx` hay un `useEffect` cuya única dependencia es `skin`.

### Persistencia

- [ ] Elegir `retro` en `/juegos/caida/jugar` y recargar la página deja el selector en `retro`.
- [ ] Salir a `/juegos/caida` y volver a entrar a jugar deja el selector en `retro`.
- [ ] La clave escrita en `localStorage` se llama `av-skin-caida`.
- [ ] La consola del navegador no muestra ningún error de hidratación al cargar `/juegos/caida/jugar`.

### No regresión

- [ ] `rocas` conserva sus tres paletas de la SPEC 11 y `bloque-buster` y `serpentina` siguen jugándose exactamente igual que antes de esta spec.
- [ ] `/juegos/gloton/jugar` conserva su mock y no muestra selector de skin.
- [ ] `git diff app/globals.css` no devuelve ninguna línea.
- [ ] `git diff app/_components/games/skins.ts` no devuelve ninguna línea.
- [ ] `TetrisGame.tsx` no declara ninguna variable mutable a nivel de módulo: `palette` vive dentro de `createGame`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.

## Decisiones

- **`neon` ancla las piezas I, O y S a los tokens `--cyan`, `--yellow` y `--green` de `app/globals.css`. No inventa siete matices nuevos.** Las tres skins de la plataforma deben leerse como una familia, y `rocas` ya tiró de esos mismos tokens en la SPEC 11. Las otras cuatro piezas se eligen para separarse en matiz de las tres ancladas.
- **`neon` usa fondo `#05010f` y `retro` fondo `#1a1206`. No `#000` en ninguna de las dos.** Son exactamente los fondos de las paletas homónimas de `rocas` (`AsteroidsGame.tsx:95` y `:109`). Un negro puro con entidades ámbar no lee como fósforo CRT, y repetir el fondo hace que cambiar de juego con la misma skin no cambie el ambiente.
- **`retro` es un único matiz ámbar separado por brillo. No siete matices apagados.** Un monitor de fósforo ámbar no tiene siete colores; lo que tiene son siete niveles de excitación del fósforo. La rampa va de `#fff0c9` a `#c2822d` y cada escalón tiene su ratio calculado.
- **Excepción de forma para los pares entre piezas.** El par más flojo es 1.01:1 (I/S en `neon`), y se acepta porque los tetrominós son siete siluetas distintas, cada bloque lleva margen de 1 px y barra de brillo superior, y ninguna decisión del jugador depende de distinguir dos colores entre sí. Está escrito así también para `clasico`, cuyo peor par es 1.05:1 y que es intocable por definición.
- **La barra de brillo se mantiene en `rgba(255,255,255,0.12)` en las tres skins. No se tiñe.** Es una señal de volumen, no de color: teñirla de ámbar en `retro` la haría desaparecer contra la pieza y se perdería la junta entre bloques contiguos, que es justo lo que sostiene la excepción de forma.
- **La paleta se pasa como argumento a cada función de dibujo. No se captura al construir el estado.** Es el patrón que ya usa `AsteroidsGame.tsx:204`, y garantiza que una pieza fijada antes del cambio de skin se repinta con la piel nueva en vez de dejar el tablero con dos pieles a la vez.
- **`setSkin()` llama a `draw()`. No espera al siguiente frame del bucle.** En pausa y en fin de partida el bucle no avanza pero sí dibuja; aun así, repintar explícitamente hace que el cambio se vea también en el instante en que se pulsa, sin depender del estado del bucle.
- **El hallazgo del tinte del tablero de `clasico` a 1.03:1 se documenta y NO se corrige aquí.** Esta spec vale como red de no regresión precisamente porque `clasico` reproduce el estado actual píxel a píxel; corregirlo aquí dejaría la spec sin testigo. **La corrección vive en la SPEC 15**, que declara abiertamente que rompe esa invariante.
- **Exclusión deliberada de la animación de transición y del audio por skin.** Ninguna de las dos afecta a la legibilidad, que es lo que este eje debe garantizar.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `skin` en las deps del efecto de montaje reinicia la partida al cambiarla     | Efecto aparte con `[skin]` como única dependencia, paso 5; grupo de criterios «Cambio en caliente» |
| La skin por defecto altera algún color y se cuela una regresión               | `clasico` copia los valores actuales literalmente; grupo entero «No regresión de clásico»          |
| La extracción de los dos literales cambia un valor sin que nadie lo note      | Paso 1 aislado y commiteable solo, con verificación de render idéntico antes de tocar nada más     |
| Una skin queda ilegible sobre el fondo oscuro                                 | Suelos de contraste calculados con el script WCAG; un criterio por ratio en «Contraste»            |
| Piezas que solo se distinguen por matiz                                       | Excepción de forma declarada en `## Decisiones`; margen de 1 px y barra de brillo por bloque       |
| La rampa ámbar de `retro` hace ilegible el borde entre bloques contiguos      | La barra de brillo no se tiñe en ninguna skin; criterio de `cellHighlight` en «No regresión»       |
| Un tinte de tablero demasiado fuerte tapa la rejilla y compite con las piezas | Banda de decorado 1.1–2.5 verificada: 1.15:1 en `neon` y en `retro`                                |
| Leer `localStorage` durante el render da error de hidratación                 | Lectura en efecto, ya implementada por la SPEC 10; criterio de consola limpia                      |
| `localStorage` lanza en navegación privada                                    | Acceso envuelto en `try/catch` por la SPEC 10, con salida a `clasico`                              |
| Variables sin usar tras absorber las constantes viejas rompen `npm run lint`  | Paso 3 elimina las constantes al mismo tiempo que las sustituye; verificación de lint en el paso   |
| Estado de módulo al introducir la paleta activa                               | `palette` se declara dentro de `createGame`, como `AsteroidsGame.tsx:549`; criterio explícito      |

## Lo que **no** entra en esta spec

- **La corrección de los hallazgos de contraste de `clasico`.** El tinte del tablero a 1.03:1 se documenta y se deja como está; el arreglo va en la SPEC 15.
- **Skins de `bloque-buster` y `serpentina`.** Van en la SPEC 13 y en la SPEC 14.
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas.
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma.
- **Cambios en `app/_components/games/skins.ts`, `types.ts`, `GamePlayerScreen.tsx` o `GamePlayerScreen.module.css`.** Son de la SPEC 10; esta spec solo los consume.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`.
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.**

_Cada uno de esos, si llega, va en su propia spec._
