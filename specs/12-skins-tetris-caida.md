# SPEC 12 — Skins clásico, neón y retro de Tetris (`caida`)

> **Status:** Approved
> **Depends on:** SPEC 10 (contrato de skins), SPEC 07 (adaptación de Tetris), SPEC 05 (contrato de juego y registro)
> **Date:** 2026-09-15
> **Objective:** Dar a `caida` las tres skins obligatorias agrupando sus colores en un registro de paletas, sin que la skin `clasico` cambie ni un píxel.
>
> **Enmienda 2026-09-15 (tras revisión en navegador):** las paletas originales de
> `neon` y `retro` se descartan. En pantalla `neon` se leía como «`clasico` más
> saturado» y los siete ámbares de `retro` no se distinguían entre sí. Las dos se
> rehacen a partir de capturas de referencia aportadas por el autor, muestreadas
> píxel a píxel: `neon` pasa a **celda hueca** (relleno tenue + trazo brillante +
> halo) sobre negro puro, y `retro` abandona el ámbar monocromo por un fondo
> azul-pizarra con siete matices apagados pero distintos. `clasico` sigue
> intacta. Cambian: el tipo `Palette` (gana estilo de celda), las dos paletas,
> tres entradas de `## Decisiones` que quedaban invertidas, sus tablas de
> contraste y los criterios de aceptación correspondientes. El plan gana un
> paso 6 y los dos últimos se renumeran a 7 y 8.
>
> **Segunda enmienda 2026-09-15 (medición contra la referencia):** la primera
> enmienda acertó los colores y falló la forma del halo. Medido sobre la captura:
> con celda de 30 px, el halo de la referencia cae a cero **20 px** más allá del
> trazo (0,67 celdas) y el interior del bloque es un **degradado** —R=78 en el
> centro, R=113 junto al trazo—, no un relleno plano. Tres correcciones, todas
> dentro del lienzo: `glow` se escala con el lienzo (`shadowBlur` se aplica en
> píxeles del búfer y la transformación del canvas NO lo escala) y sube a 18; el
> trazo se pinta **dos veces**, una con halo y otra nítida encima, para que el
> bloom sangre hacia dentro; y el trazo pasa de 2 a 3 px con el relleno plano
> bajando de α 0.30 a α 0.15. Queda **fuera**: el viñeteado y las scanlines de
> `.crt-screen` (`app/globals.css:662-674`), que oscurecen hasta un 65 % justo en
> los bordes del tablero y se comen el halo. Son chrome de plataforma, iguales
> para las tres pieles y los cuatro juegos, y van en su propia spec.
>
> **Tercera enmienda 2026-09-15 (revisión de `retro`):** los siete matices
> apagados de la primera enmienda se sustituyen por **siete pastel**, y el bloque
> de `retro` pasa a **color pleno sin barra de brillo**: la barra de 4 px era
> literalmente una franja clara sobre cada bloque, y con pastel se lee como
> rayado en vez de como volumen. `cellStyle` gana un tercer valor, `flat`, para
> el bloque macizo sin barra. La junta entre bloques contiguos la sigue marcando
> el margen de 1 px por lado —2 px de fondo entre bloque y bloque—, así que la
> excepción de forma se mantiene sin depender de la barra. `clasico` conserva la
> suya y sigue intacta.
>
> **Cuarta enmienda 2026-09-15 (`retro` frente a `clasico`):** el pastel se
> descarta: se veía igual que `clasico` y con las franjas de las scanlines muy
> marcadas. Dos mediciones lo explican. **(1)** Las franjas **no son de la
> paleta**: dentro de un bloque, el color alterna cada 2 px entre `#a1e4a7` y
> `#84bb89` —exactamente ×0,82—, que es `.crt-screen::after`
> (`app/globals.css:665`, `rgba(0,0,0,0.18)` en `multiply`). Cambiar de paleta
> mueve el salto de 41 a 36 niveles: no lo arregla. **(2)** La paleta de la
> captura de referencia es, en hexadecimal, **nuestro `clasico`**: distancia RGB
> media de 24 sobre 441, con T a 8,4 y S a 7,3. Copiarla habría hecho a `retro`
> indistinguible de `clasico`. Así que `retro` pasa a una **paleta saturada**
> —distancia media 62,8 a `clasico`, saturación 0,74 frente a 0,49— que es lo
> que de verdad separa las dos pieles. Suavizar las scanlines queda **fuera**:
> es chrome de plataforma y va en su propia spec.

## Alcance

**Dentro:**

- **`app/_components/games/TetrisGame.tsx`** y su paleta por skin. Es el único fichero de juego que se toca.
- **Consumo del contrato de la SPEC 10, ya implementado.** `SkinId` y `DEFAULT_SKIN` se importan de `app/_components/games/skins.ts`; `PlayableGameProps` ya declara `skin?: SkinId` (`app/_components/games/types.ts:28-34`); el selector del HUD (`app/_components/GamePlayerScreen.tsx:174-190`) y la persistencia en `av-skin-caida` (`GamePlayerScreen.tsx:66`, `:105-107`, `:116`) ya están montados. Esta spec no añade nada a ninguno de los tres.
- **Paso previo de extracción de dos literales.** `caida` es un caso mixto de fuente: los siete colores de pieza ya viven en `COLORS` (`TetrisGame.tsx:52-58`) y los cuatro de decorado en constantes con nombre (`TetrisGame.tsx:140-143`), pero quedan **dos literales sueltos** dentro de las llamadas de dibujo: el fondo `"#000"` (`TetrisGame.tsx:655`) y el brillo superior del bloque `"rgba(255,255,255,0.12)"` (`TetrisGame.tsx:375`). El primer paso los recoge **sin cambiar ni un valor**, y se commitea solo.
- **Las tres paletas** en el módulo del juego, como un `Record<SkinId, Palette>`, con la misma forma que `AsteroidsGame.tsx:62-119`. `clasico` copia literalmente los valores actuales.
- **`setSkin(next: SkinId)` en el `GameController`** de `TetrisGame.tsx:405-410`, como quinto método junto a `start`, `stop`, `restart` y `setPaused` (`TetrisGame.tsx:772`). Reasigna la paleta activa y repinta el frame; **no toca `board`, `current`, `next`, `score`, `lines`, `level` ni `dropInterval`**.
- **Un `useEffect` aparte** en el componente React que propaga `skin` llamando a `setSkin()`, con `skin` como única dependencia. Es el patrón exacto del efecto de `paused` de `TetrisGame.tsx:822` y del de `skin` ya escrito en `AsteroidsGame.tsx:915-921`.
- **Once superficies pintables**, todas vectoriales: fondo del lienzo, rejilla, tinte del tablero, borde del tablero, borde del recuadro de `SIGUIENTE`, rótulo `SIGUIENTE`, brillo superior del bloque y los siete colores de pieza.
- **El estilo de celda es parte de la piel, no solo su color.** `clasico` pinta el bloque macizo con barra de brillo (`solid`); `retro` lo pinta macizo de color pleno, sin barra (`flat`); `neon` lo pinta hueco: relleno del color de la pieza a alpha `0.15` y trazo de 3 px del color pleno encima, pintado dos veces —con halo y nítido— para que el bloom sangre hacia dentro. `drawCell` se bifurca por `palette.cellStyle`.
- **El halo se escala con el lienzo.** `shadowBlur` se aplica en píxeles del búfer y la transformación del canvas no lo escala, así que `glow` se multiplica por el factor de escala vigente antes de pasarlo a `withGlow`. Sin eso, con DPR 2 y la pantalla CRT a ~760 px (`scaleX ≈ 1.9`), un `glow: 12` acaba valiendo ~6 px lógicos sobre una celda de 30.
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
  boardTint: string; // relleno del tablero; transparente en `neon` y `retro`
  boardBorder: string; // borde del tablero y del recuadro de SIGUIENTE
  label: string; // rótulo "SIGUIENTE"
  /** Macizo con barra (`clasico`), macizo pleno (`retro`) o hueco (`neon`). */
  cellStyle: "solid" | "flat" | "outline";
  cellHighlight: string; // barra de brillo superior; SOLO en `solid`
  cellFillAlpha: number; // alpha del relleno interior; SOLO en `outline`
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
  cellStyle: "solid",
  cellHighlight: "rgba(255,255,255,0.12)",
  cellFillAlpha: 1, // sin uso en `solid`
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

Son **los valores literales que el fichero tiene hoy**, copiados uno a uno, formas cortas incluidas. Ninguno se ajusta ni se normaliza. `cellStyle` y `cellFillAlpha` son los dos únicos campos que `clasico` no tenía: el primero nombra lo que ya hacía —bloque macizo con barra de brillo— y el segundo no se usa en ese estilo.

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

#### `neon` — negro puro, celda hueca y halo

Muestreada de la captura de referencia. Tres colores de pieza (`T`, `Z`, `L`) salen
medidos píxel a píxel; los otros cuatro se derivan con la misma saturación y
luminosidad. El fondo es **negro puro**, no el `#05010f` de la `neon` de `rocas`:
la referencia lo es, y con celda hueca el halo necesita negro para leerse.

```ts
const neon: Palette = {
  background: "#000000",
  grid: "rgba(255, 255, 255, 0.07)",
  boardTint: "rgba(0, 0, 0, 0)",
  boardBorder: "#292b39",
  label: "#8a8fb5",
  cellStyle: "outline",
  cellHighlight: "rgba(255,255,255,0.12)", // sin uso en `outline`
  cellFillAlpha: 0.15,
  pieces: {
    1: "#00f5ff", // I — token --cyan
    2: "#ffe23d", // O
    3: "#db36f3", // T — medido en la referencia
    4: "#2bff88", // S
    5: "#ff1849", // Z — medido en la referencia
    6: "#3d7bff", // J
    7: "#ff8e2d", // L — medido en la referencia
  },
  glow: 18, // se multiplica por la escala del lienzo antes de dibujar
};
```

**El tablero de `neon` no se tiñe:** `boardTint` es **transparente**, como en la
referencia, y lo que delimita el tablero es su borde a 1.50:1. Transparente y no
`#000000`: el tablero se pinta después de la rejilla, así que un tinte opaco la
borraría justo dentro del tablero. Por eso las piezas se miden contra `#000000`
directamente, sin tablero compuesto.

| Skin   | Entidad             | Color     | Fondo     | Ratio       | Suelo   | ✅  |
| ------ | ------------------- | --------- | --------- | ----------- | ------- | --- |
| `neon` | Pieza I             | `#00f5ff` | `#000000` | **15.50:1** | ≥4.5    | ✅  |
| `neon` | Pieza O             | `#ffe23d` | `#000000` | **16.20:1** | ≥4.5    | ✅  |
| `neon` | Pieza T             | `#db36f3` | `#000000` | **5.83:1**  | ≥4.5    | ✅  |
| `neon` | Pieza S             | `#2bff88` | `#000000` | **15.76:1** | ≥4.5    | ✅  |
| `neon` | Pieza Z             | `#ff1849` | `#000000` | **5.48:1**  | ≥4.5    | ✅  |
| `neon` | Pieza J             | `#3d7bff` | `#000000` | **5.48:1**  | ≥4.5    | ✅  |
| `neon` | Pieza L             | `#ff8e2d` | `#000000` | **9.16:1**  | ≥4.5    | ✅  |
| `neon` | Rótulo `SIGUIENTE`  | `#8a8fb5` | `#000000` | **6.68:1**  | ≥4.5    | ✅  |
| `neon` | Rejilla → `#121212` | α 0.07    | `#000000` | **1.12:1**  | 1.1–2.5 | ✅  |
| `neon` | Borde               | `#292b39` | `#000000` | **1.50:1**  | 1.1–2.5 | ✅  |

Los ratios se miden sobre el **trazo**, que es el color pleno: es lo conservador,
porque el halo solo suma brillo alrededor. El relleno interior (color a α 0.15
sobre negro) queda entre 1.10:1 y 1.32:1 contra el fondo —banda de decorado— y a
entre 4.86:1 y 12.32:1 contra su propio trazo, que es lo que da la lectura de tubo
de neón: el bloque se ve por su contorno, no por su masa. El interior no queda
plano: el segundo trazo, el que lleva halo, sangra hacia dentro y reproduce el
degradado medido en la referencia.

#### `retro` — azul-pizarra, siete saturados de color pleno, sin halo

Siete colores saturados, uno por tetrominó, sobre el fondo azul-pizarra medido en
la captura. El bloque es **macizo y de color pleno**: `cellStyle: "flat"`, sin
barra de brillo. La saturación es lo que separa esta piel de `clasico`, cuya
paleta Material es clara y desaturada: distancia RGB media de **62,8** frente a
los 24 que daba copiar la captura de referencia. El cuarto intento de esta
paleta; los tres anteriores —ámbar monocromo, matices apagados y pastel— están
en `## Decisiones`, tachados, con el motivo de cada descarte.

```ts
const retro: Palette = {
  background: "#191b24",
  grid: "rgba(255, 255, 255, 0.04)",
  boardTint: "rgba(0, 0, 0, 0)",
  boardBorder: "#292b39",
  label: "#8a8fb5",
  cellStyle: "flat",
  cellHighlight: "rgba(255,255,255,0.12)", // sin uso en `flat`
  cellFillAlpha: 1, // sin uso en `flat`
  pieces: {
    1: "#19c3c9", // I
    2: "#e8bb2a", // O
    3: "#b968e8", // T
    4: "#3fbf55", // S
    5: "#f2564a", // Z
    6: "#4f8bf5", // J
    7: "#e8861a", // L
  },
  glow: 0,
};
```

**El tablero de `retro` tampoco se tiñe:** `boardTint` es transparente, igual que
en la referencia, y lo delimita su borde a 1.23:1.

| Skin    | Entidad             | Color     | Fondo     | Ratio      | Suelo   | ✅  |
| ------- | ------------------- | --------- | --------- | ---------- | ------- | --- |
| `retro` | Pieza I             | `#19c3c9` | `#191b24` | **7.92:1** | ≥4.5    | ✅  |
| `retro` | Pieza O             | `#e8bb2a` | `#191b24` | **9.46:1** | ≥4.5    | ✅  |
| `retro` | Pieza T             | `#b968e8` | `#191b24` | **5.07:1** | ≥4.5    | ✅  |
| `retro` | Pieza S             | `#3fbf55` | `#191b24` | **7.19:1** | ≥4.5    | ✅  |
| `retro` | Pieza Z             | `#f2564a` | `#191b24` | **5.07:1** | ≥4.5    | ✅  |
| `retro` | Pieza J             | `#4f8bf5` | `#191b24` | **5.18:1** | ≥4.5    | ✅  |
| `retro` | Pieza L             | `#e8861a` | `#191b24` | **6.42:1** | ≥4.5    | ✅  |
| `retro` | Rótulo `SIGUIENTE`  | `#8a8fb5` | `#191b24` | **5.46:1** | ≥4.5    | ✅  |
| `retro` | Rejilla → `#22242d` | α 0.04    | `#191b24` | **1.11:1** | 1.1–2.5 | ✅  |
| `retro` | Borde               | `#292b39` | `#191b24` | **1.23:1** | 1.1–2.5 | ✅  |

La pieza fantasma de `retro` (la `L` a α 0.2 sobre el fondo, `#423022`) queda a
1.37:1: decorado, como en las otras dos skins.

#### Pares entre piezas — excepción de forma

El suelo de 1.5:1 entre entidades **no se cumple por color en ninguna de las tres skins**, y es deliberado:

| Skin      | Par más flojo | Ratio      | Mediana entre pares | Suelo |                    |
| --------- | ------------- | ---------- | ------------------- | ----- | ------------------ |
| `clasico` | I / J         | **1.05:1** | 1.05:1              | ≥1.5  | excepción de forma |
| `neon`    | Z / J         | **1.00:1** | **1.72:1**          | ≥1.5  | excepción de forma |
| `retro`   | T / Z         | **1.00:1** | **1.32:1**          | ≥1.5  | excepción de forma |

El ratio WCAG solo mide luminancia, así que dos colores de matices opuestos y
brillo idéntico dan 1.00:1 aunque a ojo no se parezcan en nada — es el caso de
`Z`/`J` en `neon` (rojo contra azul) y `T`/`Z` en `retro` (morado contra rojo).
Lo que sí mejora de forma medible frente a las paletas descartadas es la
**mediana** entre los 21 pares, que era ~1.05:1 con la rampa ámbar y ahora sube a
1.72:1 en `neon` y 1.32:1 en `retro`. En `retro` la separación la llevan sobre
todo el matiz y la junta de 2 px entre bloques, no el brillo.

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

### 6. Estilo de celda por piel y paletas de referencia (enmienda)

Añadir `cellStyle`, `cellFillAlpha` y el estilo `outline` a `Palette`, sustituir
las paletas `neon` y `retro` por las de la enmienda, y bifurcar `drawCell` por
`palette.cellStyle`:

- **`solid`** (`clasico`): exactamente lo que ya hace hoy —relleno pleno con
  margen de 1 px y barra de brillo de 4 px arriba.
- **`flat`** (`retro`): el mismo relleno pleno con margen de 1 px, **sin** barra
  de brillo. La junta entre bloques contiguos la marcan los 2 px de fondo que
  dejan los dos márgenes.
- **`outline`** (`neon`): relleno del color a `cellFillAlpha` (0.15) y encima el
  trazo de 3 px del color pleno, pintado **dos veces** —primero con halo, luego
  nítido sobre él—, por dentro del margen. **Sin barra de brillo**: en una celda
  hueca taparía el trazo superior, que es justo lo que da la lectura de tubo.

El halo se pasa ya multiplicado por la escala del lienzo: `drawCell` recibe el
`shadowBlur` efectivo en píxeles del búfer, no `palette.glow` crudo.

La pieza fantasma sigue saliendo del mismo `drawCell` con `GHOST_ALPHA`, así que
en `neon` es un contorno tenue y en las otras dos un bloque tenue.

_Verificación:_ `clasico` sigue idéntica píxel a píxel —es la que no toca este
paso—; `neon` pinta bloques huecos con halo y `retro` bloques macizos de siete
matices distintos sobre `#191b24`.

### 7. Prueba manual de extremo a extremo

Una persona, en el navegador: entrar en `/juegos/caida/jugar`, apilar ocho o diez piezas, recorrer las tres skins con el selector del HUD, hacer una línea en cada skin, pausar y reanudar, morir y reiniciar, salir a `/juegos/caida` y volver a entrar. Comprobar que `/juegos/rocas/jugar` conserva sus tres paletas y que `/juegos/gloton/jugar` sigue con su mock y sin selector.

_Verificación:_ ningún paso reinicia la partida ni deja errores en la consola del navegador.

### 8. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas previas en 200: `/`, `/biblioteca`, `/juegos/caida`, `/salon`, `/about`, `/auth`.

_Verificación:_ los tres comandos terminan en verde y las seis rutas responden 200.

### Apuntes sobre el orden

- La extracción de los dos literales (paso 1) va primero y sola porque es el único cambio de esta spec que puede introducir una regresión invisible: si el fondo o el brillo cambian, se detecta con el juego aún sin skins, no mezclado con siete colores nuevos.
- El paso 3 va antes que el 4 porque `setSkin()` no tiene nada que reasignar hasta que el dibujo lee de una paleta variable en vez de constantes de módulo.
- El paso 4 va antes que el 5 porque el efecto necesita un método al que llamar; al revés, el efecto llamaría a un `setSkin` inexistente y `tsc` fallaría.
- El paso 5 es el último del código porque es el que hace visible el cambio de skin: hasta entonces el juego compila y juega, pero siempre en `clasico`.
- La prueba manual va antes de la pasada final para que los fallos de comportamiento se arreglen antes de firmar el build.
- El paso 6 se añadió en la enmienda y va después del 5 a propósito: hasta que el cambio de piel no es visible de extremo a extremo no se puede juzgar si una paleta funciona en pantalla, que es exactamente lo que obligó a rehacer `neon` y `retro`.

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
- [ ] Con `neon` el fondo del lienzo es `#000000` y las piezas son `#00f5ff`, `#ffe23d`, `#db36f3`, `#2bff88`, `#ff1849`, `#3d7bff` y `#ff8e2d`.
- [ ] Con `neon` las piezas se pintan con halo: `glow` vale 18 y llega a `withGlow` multiplicado por la escala vigente del lienzo.
- [ ] Con `neon` el bloque es **hueco**: relleno del color a α 0.15 y trazo de 3 px del color pleno encima, pintado dos veces —con halo y nítido—.
- [ ] Con `neon` el bloque **no** lleva barra de brillo superior.
- [ ] Con `retro` el fondo del lienzo es `#191b24` y las piezas son `#19c3c9`, `#e8bb2a`, `#b968e8`, `#3fbf55`, `#f2564a`, `#4f8bf5` y `#e8861a`.
- [ ] Con `retro` el bloque es **macizo de color pleno** y **no** lleva barra de brillo.
- [ ] Con `retro` ninguna superficie se pinta con halo: `shadowBlur` vale 0.
- [ ] `PALETTES` es un `Record<SkinId, Palette>` con exactamente tres claves.
- [ ] `clasico` declara `cellStyle: "solid"`, `retro` declara `cellStyle: "flat"` y `neon` declara `cellStyle: "outline"`.

### Contraste

- [ ] Las piezas Z y J de `neon` contrastan **5.48:1** contra `#000000`; son las peores de esa skin y pasan el suelo de 4.5:1.
- [ ] Las piezas T y Z de `retro` contrastan **5.07:1** contra `#191b24`; son las peores de esa skin y pasan el suelo de 4.5:1.
- [ ] La pieza T de `clasico` contrasta **5.71:1** contra su tablero `#000708`; es la peor de esa skin y pasa el suelo de 4.5:1.
- [ ] El rótulo `SIGUIENTE` contrasta **6.68:1** en `clasico`, **6.68:1** en `neon` y **5.46:1** en `retro` contra el fondo de su propia skin.
- [ ] Ni `neon` ni `retro` tiñen el tablero: `boardTint` es `rgba(0, 0, 0, 0)`, y la banda de decorado no aplica a una superficie deliberadamente ausente.
- [ ] La rejilla contrasta **1.11:1** en `clasico`, **1.12:1** en `neon` y **1.11:1** en `retro` contra el fondo de su propia skin, y se ve también **dentro** del tablero en las tres.
- [ ] El borde del tablero contrasta **1.74:1** en `clasico`, **1.50:1** en `neon` y **1.23:1** en `retro` contra el fondo de su propia skin.
- [ ] El tinte del tablero de `clasico` contrasta **1.03:1** contra `#000000` y queda por debajo de la banda de decorado: está documentado como hallazgo y no se corrige aquí.
- [ ] El relleno interior de `neon` queda entre **1.10:1 y 1.32:1** contra el fondo y entre **4.86:1 y 12.32:1** contra su propio trazo.
- [ ] El par de piezas más flojo es I/J a **1.05:1** en `clasico`, Z/J a **1.00:1** en `neon` y T/Z a **1.00:1** en `retro`: los tres quedan por debajo de 1.5:1 y se resuelven por la excepción de forma declarada en `## Decisiones`.
- [ ] La mediana entre los 21 pares de piezas es **1.72:1** en `neon` y **1.32:1** en `retro`.
- [ ] La paleta de `retro` está a una distancia RGB media de **62,8** de la de `clasico`: las dos pieles no se confunden.

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
- [ ] El halo de `neon` mide aproximadamente 0,67 celdas, como el de la referencia, y no ~0,21.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.

## Decisiones

- **~~`neon` usa fondo `#05010f` y `retro` fondo `#1a1206`~~ → los dos fondos salen de las capturas de referencia: `#000000` y `#191b24`.** _(Invertida por la enmienda.)_ La decisión original era repetir los fondos de `rocas` para que las skins se leyeran como una familia. En pantalla eso hizo que `neon` no se distinguiese de `clasico`, porque `#000` y `#05010f` son el mismo negro a ojo y las piezas eran los mismos matices más saturados. La familia se paga cara si la piel no se nota: manda la referencia.
- **~~ámbar monocromo~~ → ~~siete matices apagados~~ → ~~siete pastel~~ → `retro` son siete colores saturados de color pleno sobre azul-pizarra.** _(Invertida tres veces: primera, tercera y cuarta enmienda.)_ El ámbar monocromo no dejaba distinguir las piezas; los matices apagados eran la paleta de `clasico` con otro nombre —distancia RGB media de 24—; el pastel se parecía aún más a `clasico` y marcaba muchísimo las scanlines. Lo que separa a `retro` de `clasico` no es el brillo ni el fondo: es la **saturación**, 0,74 frente a 0,49.
- **Las franjas que se ven sobre los bloques son de la plataforma, no de la paleta.** Medido dentro de un bloque: el color alterna cada 2 px entre `#a1e4a7` y `#84bb89`, exactamente ×0,82, que es `.crt-screen::after` con `rgba(0,0,0,0.18)` en `multiply`. Ninguna paleta lo arregla —el salto pasa de 41 a 36 niveles—, así que esta spec no lo intenta. Suavizarlo es una decisión de plataforma, para las tres pieles y los cuatro juegos a la vez. La rampa de siete ámbares era correcta como teoría de fósforo CRT y falló como interfaz: los pares quedaban a 1.10:1 y el jugador no distinguía una pieza de otra. La referencia separa por matiz y baja la saturación, que consigue el aire retro sin fundir las siete piezas en una.
- **`neon` pinta la celda hueca: relleno a α 0.15, trazo de 3 px pintado dos veces y halo. No bloque macizo.** _(Nueva en la enmienda.)_ Es lo que la captura hace y es lo que separa de verdad `neon` de `clasico`: no es un color distinto, es otra forma de pintar el mismo bloque. Medido en la referencia: interior `#4f2907` y borde `#ff8e2d` en la misma celda.
- **El halo se multiplica por la escala del lienzo antes de pasarlo a `withGlow`. No se pasa `palette.glow` crudo.** _(Segunda enmienda.)_ `shadowBlur` se aplica en píxeles del búfer del canvas y la transformación no lo escala, así que un mismo número da halos distintos según el tamaño en pantalla y el DPR. Escalarlo es lo que hace que el halo mida siempre la misma fracción de celda, que es lo que se comparó con la referencia.
- **El trazo de `neon` se pinta dos veces: una con halo y otra nítida encima.** _(Segunda enmienda.)_ Medido en la referencia, el interior del bloque no es plano: va de R=78 en el centro a R=113 junto al trazo. Ese degradado no es un relleno, es el propio halo sangrando hacia dentro, y la única forma de reproducirlo es dejar que el trazo con sombra pinte primero y recuperar el núcleo nítido después.
- **En `neon` el bloque hueco no lleva barra de brillo.** El trazo superior ya es la arista iluminada; superponerle la barra blanca lo taparía justo donde la celda hueca necesita leerse. En `clasico` y en `retro`, que son macizas, la barra se mantiene.
- **`neon` conserva `#00f5ff` (token `--cyan`) para la pieza I.** Es el único ancla a `app/globals.css` que sobrevive a la enmienda, y coincide con el cian que la referencia usa en esa pieza.
- **Excepción de forma para los pares entre piezas.** El par más flojo es 1.00:1 (Z/J en `neon`, rojo contra azul), y se acepta porque el ratio WCAG solo mide luminancia: dos matices opuestos con el mismo brillo dan 1.00:1 y a ojo no se parecen en nada. Además los tetrominós son siete siluetas distintas y cada bloque lleva margen de 1 px —barra de brillo en las macizas, trazo en la hueca—, de modo que dos bloques contiguos siempre muestran una junta. Está escrito así también para `clasico`, cuyo peor par es 1.05:1 y que es intocable por definición.
- **La barra de brillo sobrevive solo en `clasico`.** _(Tercera enmienda, confirmada en la cuarta.)_ Sobre los colores de `retro` la franja blanca al 12 % contrasta entre 1.11:1 y 1.17:1 con la propia pieza: apenas aporta volumen, y prescindir de ella da a `retro` un acabado plano que la separa de `clasico` también por forma, no solo por color. En `retro` se deja de pintar y en `neon` nunca se pintó. `clasico` la conserva porque es intocable por definición, y ahí sí funciona: sus piezas son más oscuras y la franja se ve.
- **La junta entre bloques contiguos la sostiene el margen, no la barra.** Cada bloque se pinta con 1 px de margen por lado, así que entre dos bloques pegados quedan 2 px de fondo. Eso es lo que mantiene en pie la excepción de forma en las tres pieles, también sin barra de brillo.
- **Ni `neon` ni `retro` tiñen el tablero.** Las dos referencias pintan el interior del tablero del mismo color que el fondo y lo delimitan solo con el borde. Un tinte propio sobraba: `clasico` lo tiene a 1.03:1, es decir, invisible, que fue el hallazgo que esta spec documentó desde el principio.
- **La paleta se pasa como argumento a cada función de dibujo. No se captura al construir el estado.** Es el patrón que ya usa `AsteroidsGame.tsx:204`, y garantiza que una pieza fijada antes del cambio de skin se repinta con la piel nueva en vez de dejar el tablero con dos pieles a la vez.
- **`setSkin()` llama a `draw()`. No espera al siguiente frame del bucle.** En pausa y en fin de partida el bucle no avanza pero sí dibuja; aun así, repintar explícitamente hace que el cambio se vea también en el instante en que se pulsa, sin depender del estado del bucle.
- **El hallazgo del tinte del tablero de `clasico` a 1.03:1 se documenta y NO se corrige aquí.** Esta spec vale como red de no regresión precisamente porque `clasico` reproduce el estado actual píxel a píxel; corregirlo aquí dejaría la spec sin testigo. **La corrección vive en la SPEC 15**, que declara abiertamente que rompe esa invariante.
- **Exclusión deliberada de la animación de transición y del audio por skin.** Ninguna de las dos afecta a la legibilidad, que es lo que este eje debe garantizar.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `skin` en las deps del efecto de montaje reinicia la partida al cambiarla     | Efecto aparte con `[skin]` como única dependencia, paso 5; grupo de criterios «Cambio en caliente»                                          |
| La skin por defecto altera algún color y se cuela una regresión               | `clasico` copia los valores actuales literalmente; grupo entero «No regresión de clásico»                                                   |
| La extracción de los dos literales cambia un valor sin que nadie lo note      | Paso 1 aislado y commiteable solo, con verificación de render idéntico antes de tocar nada más                                              |
| Una skin queda ilegible sobre el fondo oscuro                                 | Suelos de contraste calculados con el script WCAG; un criterio por ratio en «Contraste»                                                     |
| Piezas que solo se distinguen por matiz                                       | Excepción de forma declarada en `## Decisiones`; margen de 1 px y barra de brillo por bloque                                                |
| La rampa ámbar de `retro` hace ilegible el borde entre bloques contiguos      | Descartada por la enmienda: `retro` pasa a siete matices distintos, con mediana entre pares de 1.43:1                                       |
| La celda hueca de `neon` se lee mal cuando hay muchos bloques contiguos       | Trazo de 2 px por dentro del margen de 1 px: dos bloques pegados muestran cuatro líneas y dos juntas; paso 6 y prueba manual del paso 7     |
| Un halo grande convierte el tablero lleno en una mancha de luz                | `glow` medido contra la referencia (0,67 celdas) en vez de elegido a ojo; se verifica con el tablero apilado en la prueba manual del paso 7 |
| El fantasma de `neon` queda demasiado tenue al ser un contorno a α 0.2        | Mismo `drawCell` y mismo `GHOST_ALPHA` que las otras skins; se verifica a mano en el paso 7                                                 |
| Un tinte de tablero demasiado fuerte tapa la rejilla y compite con las piezas | Banda de decorado 1.1–2.5 verificada: 1.15:1 en `neon` y en `retro`                                                                         |
| Leer `localStorage` durante el render da error de hidratación                 | Lectura en efecto, ya implementada por la SPEC 10; criterio de consola limpia                                                               |
| `localStorage` lanza en navegación privada                                    | Acceso envuelto en `try/catch` por la SPEC 10, con salida a `clasico`                                                                       |
| Variables sin usar tras absorber las constantes viejas rompen `npm run lint`  | Paso 3 elimina las constantes al mismo tiempo que las sustituye; verificación de lint en el paso                                            |
| Estado de módulo al introducir la paleta activa                               | `palette` se declara dentro de `createGame`, como `AsteroidsGame.tsx:549`; criterio explícito                                               |

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
