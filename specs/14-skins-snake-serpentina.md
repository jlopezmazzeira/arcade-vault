# SPEC 14 — Skins clásico, neón y retro de Snake (`serpentina`)

> **Status:** Approved
> **Depends on:** SPEC 10 (contrato de skins), SPEC 09 (adaptación de Snake), SPEC 05 (contrato de juego y registro)
> **Date:** 2026-09-15
> **Objective:** Dar a `serpentina` las tres skins obligatorias vistiendo su mitad vectorial con un registro de paletas y su mitad de sprites con teñido perezoso por fruta, sin que la skin `clasico` cambie ni un píxel.

## Alcance

**Dentro:**

- **`app/_components/games/SnakeGame.tsx`** y su paleta por skin. Es el único fichero de juego que se toca.
- **Consumo del contrato de la SPEC 10, ya implementado.** `SkinId` y `DEFAULT_SKIN` se importan de `app/_components/games/skins.ts`; `PlayableGameProps` ya declara `skin?: SkinId` (`app/_components/games/types.ts:28-34`); el selector del HUD (`app/_components/GamePlayerScreen.tsx:174-190`) y la persistencia en `av-skin-serpentina` (`GamePlayerScreen.tsx:66`, `:105-107`, `:116`) ya están montados. Esta spec no añade nada a ninguno de los tres.
- **Las dos mitades del juego, tratadas por separado.** `serpentina` es un caso mixto:
  - **Mitad vectorial**, con colores ya en constantes con nombre (`SnakeGame.tsx:69-72`): fondo, rejilla, cuerpo, cabeza, ojos y la fruta de reserva en rombo (`drawFruitFallback` `:255-267`). No necesita paso de extracción.
  - **Mitad de sprites**: los 22 recortes de `public/games/snake/fruits.png` (3790×442, comprobado con `ls` y `sips`), declarados en `FRUITS` (`SnakeGame.tsx:144-165`) y blitados en `drawFruitSprite` (`:288`).
- **Teñido perezoso por fruta, con caché**, para las skins `neon` y `retro`. Solo se tiñe el recorte que está en juego, a un canvas fuera de pantalla del tamaño del recorte, y se guarda en una caché por skin. La fruta solo cambia al comerla, así que el coste por frame es cero.
- **El PNG no se toca.** No se edita, no se regenera y no se añade ningún asset nuevo a `public/games/snake/`.
- **Las tres paletas** en el módulo del juego, como un `Record<SkinId, Palette>`, con la misma forma que `AsteroidsGame.tsx:62-119`. `clasico` copia literalmente los valores actuales.
- **`setSkin(next: SkinId)` en el `GameController`** de `SnakeGame.tsx:352-357`, como quinto método junto a `start`, `stop`, `restart` y `setPaused` (`SnakeGame.tsx:702`). Reasigna la paleta activa y repinta el frame; **no toca `snake`, `dir`, `fruit`, `fruitIndex` ni `score`**.
- **Un `useEffect` aparte** en el componente React que propaga `skin` llamando a `setSkin()`, con `skin` como única dependencia. Es el patrón exacto del efecto de `paused` de `SnakeGame.tsx:753` y del de `skin` ya escrito en `AsteroidsGame.tsx:915-921`.
- **Seis superficies pintables:** fondo del lienzo, rejilla, cuerpo, cabeza, ojos y fruta —la de sprite y la de reserva—.
- **No regresión explícita**: los cuatro ids que hoy están en `app/_components/games/registry.ts` — `rocas`, `caida`, `bloque-buster` y `serpentina` — siguen jugándose igual, y `rocas` conserva las tres paletas de la SPEC 11. El testigo mock es **`/juegos/ranaria/jugar`**, un id sin entrada en el registro, que conserva su mock y no muestra selector.

**Fuera de alcance (para futuras specs):**

- **La corrección de los hallazgos de contraste de `clasico`.** Esta spec documenta que las tres frutas más oscuras del atlas quedan a 2.87:1, 3.23:1 y 3.60:1 contra el fondo negro, y **no las corrige**: `clasico` reproduce el estado actual y es la red de no regresión. La corrección vive en la SPEC 15.
- **Skins de `caida` y `bloque-buster`.** Cada juego va en su propia spec: la SPEC 12 y la SPEC 13.
- **Sustituir los sprites de fruta por primitivas vectoriales** en las skins no clásicas. Cambiaría la identidad del juego, no solo su color.
- **Pre-teñir la hoja completa por skin.** Ver `## Decisiones`: costaría ~13,4 MB de RAM extra.
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas.
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma y son iguales para las tres skins.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`.
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.** Sigue sin haber runner en el proyecto.

## Modelo de datos

### (a) Contrato con la plataforma

El juego importa el contrato ya existente y no define nada propio:

```ts
import { DEFAULT_SKIN, type SkinId } from "./skins";
```

`skin` llega como prop opcional de `PlayableGameProps`. `GamePlayerScreen` la gobierna con el selector del HUD y la persiste en la clave `av-skin-serpentina`.

**Cambiar de skin no reinicia la partida.** El `GameController` gana un quinto método, `setSkin(next: SkinId)`, que solo reasigna la paleta activa del closure y llama a `draw()` para repintar el frame en curso. El componente lo propaga desde un **`useEffect` aparte**:

```ts
// `skin` NUNCA entra en las deps del efecto de montaje: si entrase, cada
// cambio de skin destruiría y recrearía el juego, y el jugador perdería la
// serpiente entera y la puntuación al tocar el selector.
useEffect(() => {
  gameRef.current?.setSkin(skin ?? DEFAULT_SKIN);
}, [skin]);
```

La paleta activa se lee en el momento de dibujar: `drawGrid`, `drawSnake`, `drawEyes` y `drawFruitFallback` reciben la paleta como argumento en vez de leer las constantes de módulo, igual que las entidades de `AsteroidsGame.tsx:204`, `:266`, `:315`.

**El teñido de la fruta es perezoso y cacheado.** Con la skin `clasico`, `drawFruitSprite` (`SnakeGame.tsx:277-289`) blita desde la `HTMLImageElement` original, exactamente como hoy. Con `neon` o `retro`, blita desde un canvas del tamaño del recorte que se genera la primera vez que esa fruta aparece con esa skin, y que queda guardado en una caché `Map<string, HTMLCanvasElement>` con clave `<skin>:<índice>`. El teñido es un `fillRect` del color de la skin a alpha declarada con `globalCompositeOperation = "source-atop"`, que respeta el canal alfa del PNG.

El color resultante de un píxel es por tanto `P·(1−α) + C·α`, con `P` el color del PNG y `C` el tinte. De ahí que los ratios de la mitad de sprites sean **calculados y no estimados**: se aplica la misma fórmula al color medio muestreado de cada recorte.

Forma del registro de paletas:

```ts
type Palette = {
  background: string;
  grid: string;
  snakeHead: string;
  snakeBody: string;
  /** Color de los ojos. Hoy es el propio fondo. */
  eyes: string;
  /** Rombo de reserva mientras carga `fruits.png` o si falla. */
  fruitFallback: string;
  /** `null` en `clasico`: el recorte se blita tal cual sale del PNG. */
  fruitTint: string | null;
  /** Alpha del `fillRect` con `source-atop`. Ignorado si `fruitTint` es `null`. */
  fruitTintAlpha: number;
  /** `shadowBlur` del halo. 0 en `clasico` y en `retro`. */
  glow: number;
};

const PALETTES: Record<SkinId, Palette> = { clasico, neon, retro };
```

### (b) Las tres paletas

Las seis superficies pintables y su origen actual, comprobado con `grep`:

| #   | Superficie       | Dónde hoy                          | Valor actual                    |
| --- | ---------------- | ---------------------------------- | ------------------------------- |
| 1   | Fondo del lienzo | `BACKGROUND` `:72`, `:303`, `:569` | `#000`                          |
| 2   | Rejilla          | `GRID_LINE` `:71`, `:232`          | `#141827`                       |
| 3   | Cabeza           | `SNAKE_HEAD` `:69`, `:338`         | `#00ff88`                       |
| 4   | Cuerpo           | `SNAKE_BODY` `:70`, `:327`         | `#00cc6a`                       |
| 5   | Ojos             | `BACKGROUND` `:303`                | `#000`                          |
| 6   | Fruta de reserva | `SNAKE_HEAD` `:259`                | `#00ff88`                       |
| 7   | Fruta de sprite  | `drawFruitSprite` `:288`           | los 22 recortes de `fruits.png` |

#### `clasico` — la skin por defecto

```ts
const clasico: Palette = {
  background: "#000",
  grid: "#141827",
  snakeHead: "#00ff88",
  snakeBody: "#00cc6a",
  eyes: "#000",
  fruitFallback: "#00ff88",
  fruitTint: null, // el recorte NO se tiñe ni se filtra
  fruitTintAlpha: 0,
  glow: 0,
};
```

Son **los valores literales que el fichero tiene hoy**, copiados uno a uno, formas cortas incluidas. Los ojos y el fondo comparten valor porque hoy `drawEyes` (`:303`) usa la constante `BACKGROUND`; se separan en dos campos para que una skin futura pueda desacoplarlos, pero en las tres de esta spec valen lo mismo.

| Skin      | Entidad                 | Color     | Fondo     | Ratio       | Suelo   | ✅          |
| --------- | ----------------------- | --------- | --------- | ----------- | ------- | ----------- |
| `clasico` | Cabeza                  | `#00ff88` | `#000000` | **15.66:1** | ≥4.5    | ✅          |
| `clasico` | Cuerpo                  | `#00cc6a` | `#000000` | **9.85:1**  | ≥4.5    | ✅          |
| `clasico` | Ojos vs cabeza          | `#000`    | `#00ff88` | **15.66:1** | ≥4.5    | ✅          |
| `clasico` | Fruta de reserva        | `#00ff88` | `#000000` | **15.66:1** | ≥4.5    | ✅          |
| `clasico` | Rejilla                 | `#141827` | `#000000` | **1.19:1**  | 1.1–2.5 | ✅          |
| `clasico` | Cabeza vs cuerpo        | —         | —         | **1.59:1**  | ≥1.5    | ✅          |
| `clasico` | Fruta `sx=540` (media)  | `#8c259e` | `#000000` | **2.87:1**  | ≥4.5    | ⚠️ hallazgo |
| `clasico` | Fruta `sx=1066` (media) | `#8c3c9a` | `#000000` | **3.23:1**  | ≥4.5    | ⚠️ hallazgo |
| `clasico` | Fruta `sx=1228` (media) | `#b7390b` | `#000000` | **3.60:1**  | ≥4.5    | ⚠️ hallazgo |

Los tres hallazgos son del **estado actual**, no de esta spec: son las tres frutas más oscuras de las 22, medidas por el color medio de sus píxeles opacos. Las otras diecinueve pasan el suelo, y la mejor —`sx=894`— llega a 13.56:1. **No se corrigen aquí.** Ver `## Decisiones`.

#### `neon` — fondo `#05010f`, con halo

Mismo fondo que la `neon` de `rocas` (`AsteroidsGame.tsx:95`).

```ts
const neon: Palette = {
  background: "#05010f",
  grid: "#0e2136",
  snakeHead: "#00f5ff", // token --cyan
  snakeBody: "#0d90b5",
  eyes: "#05010f",
  fruitFallback: "#00f5ff",
  fruitTint: "#c8fbff",
  fruitTintAlpha: 0.35,
  glow: 8,
};
```

| Skin   | Entidad                | Color                 | Fondo     | Ratio       | Suelo   | ✅  |
| ------ | ---------------------- | --------------------- | --------- | ----------- | ------- | --- |
| `neon` | Cabeza                 | `#00f5ff`             | `#05010f` | **15.24:1** | ≥4.5    | ✅  |
| `neon` | Cuerpo                 | `#0d90b5`             | `#05010f` | **5.58:1**  | ≥4.5    | ✅  |
| `neon` | Ojos vs cabeza         | `#05010f`             | `#00f5ff` | **15.24:1** | ≥4.5    | ✅  |
| `neon` | Fruta de reserva       | `#00f5ff`             | `#05010f` | **15.24:1** | ≥4.5    | ✅  |
| `neon` | Rejilla                | `#0e2136`             | `#05010f` | **1.27:1**  | 1.1–2.5 | ✅  |
| `neon` | Cabeza vs cuerpo       | —                     | —         | **2.73:1**  | ≥1.5    | ✅  |
| `neon` | Fruta `sx=540` teñida  | `#8c259e` → `#a170c0` | `#05010f` | **5.50:1**  | ≥4.5    | ✅  |
| `neon` | Fruta `sx=1066` teñida | `#8c3c9a` → `#a17fbd` | `#05010f` | **6.18:1**  | ≥4.5    | ✅  |
| `neon` | Fruta `sx=1228` teñida | `#b7390b` → `#bd7d60` | `#05010f` | **6.16:1**  | ≥4.5    | ✅  |
| `neon` | Fruta `sx=894` teñida  | `#cbd2c4` → `#cae0d9` | `#05010f` | **14.91:1** | ≥4.5    | ✅  |

El tinte de `neon` es deliberadamente suave —α 0.35— para que las 22 frutas conserven su identidad de tono en vez de quedar todas iguales, y aun así levanta la más oscura de 2.82:1 a 5.50:1 contra el fondo de esta skin.

El halo (`shadowBlur: 8`, `shadowColor` igual al color de la entidad) solo suma brillo alrededor del núcleo: todos los ratios están calculados sobre el color del núcleo, que es lo conservador.

#### `retro` — fondo `#1a1206`, fósforo ámbar, sin halo

Mismo fondo que la `retro` de `rocas` (`AsteroidsGame.tsx:109`).

```ts
const retro: Palette = {
  background: "#1a1206",
  grid: "#2e2109",
  snakeHead: "#ffd98a",
  snakeBody: "#c9862a",
  eyes: "#1a1206",
  fruitFallback: "#ffd98a",
  fruitTint: "#ffb000",
  fruitTintAlpha: 0.7,
  glow: 0,
};
```

| Skin    | Entidad                | Color                 | Fondo     | Ratio       | Suelo   | ✅  |
| ------- | ---------------------- | --------------------- | --------- | ----------- | ------- | --- |
| `retro` | Cabeza                 | `#ffd98a`             | `#1a1206` | **13.72:1** | ≥4.5    | ✅  |
| `retro` | Cuerpo                 | `#c9862a`             | `#1a1206` | **6.11:1**  | ≥4.5    | ✅  |
| `retro` | Ojos vs cabeza         | `#1a1206`             | `#ffd98a` | **13.72:1** | ≥4.5    | ✅  |
| `retro` | Fruta de reserva       | `#ffd98a`             | `#1a1206` | **13.72:1** | ≥4.5    | ✅  |
| `retro` | Rejilla                | `#2e2109`             | `#1a1206` | **1.18:1**  | 1.1–2.5 | ✅  |
| `retro` | Cabeza vs cuerpo       | —                     | —         | **2.24:1**  | ≥1.5    | ✅  |
| `retro` | Fruta `sx=540` teñida  | `#8c259e` → `#dd862f` | `#1a1206` | **6.64:1**  | ≥4.5    | ✅  |
| `retro` | Fruta `sx=1066` teñida | `#8c3c9a` → `#dd8d2e` | `#1a1206` | **6.99:1**  | ≥4.5    | ✅  |
| `retro` | Fruta `sx=1228` teñida | `#b7390b` → `#e98c03` | `#1a1206` | **7.25:1**  | ≥4.5    | ✅  |
| `retro` | Fruta `sx=894` teñida  | `#cbd2c4` → `#efba3b` | `#1a1206` | **10.38:1** | ≥4.5    | ✅  |

Con α 0.7 las 22 frutas convergen a ámbar y dejan de distinguirse entre sí. Es aceptable y no pierde información de juego: la puntuación depende de cuántas frutas llevas comidas y no de cuál comes (`SCORE_BASE` y `SCORE_STEP`, `SnakeGame.tsx:55-56`).

#### Cabeza contra cuerpo — sin excepción de forma en `neon` ni en `retro`

El par cabeza/cuerpo pasa el suelo de 1.5:1 **por color** en las tres skins: 1.59:1 en `clasico`, 2.73:1 en `neon` y 2.24:1 en `retro`. Además difieren por forma en las tres: la cabeza lleva dos ojos del color del fondo (`drawEyes` `:292-315`), colocados según hacia dónde mira, y cada segmento se pinta con un margen de 1 px por lado que dibuja la junta entre segmentos contiguos (`drawSnake` `:318-341`). El 1.59:1 de `clasico` es el más ajustado de los tres y es el que estaba medido en la auditoría de este eje.

### (c) Persistencia

- **Clave:** `av-skin-serpentina`, generada por `skinKey` (`GamePlayerScreen.tsx:66`). Ya implementada por la SPEC 10; esta spec no la toca.
- **Lectura en efecto, no en render** (`GamePlayerScreen.tsx:100-110`), validada con `isSkinId` de `skins.ts` y con salida a `clasico`.
- **Acceso envuelto en `try/catch`,** tanto en lectura como en escritura.
- **Sin migración.** No se crea nada en `supabase/migrations/`, no se toca `public.games` y no se llama a ningún MCP de escritura.
- **La caché de frutas teñidas no se persiste.** Vive dentro de `createGame` y muere con el desmontaje, como el resto del estado de partida.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Definir las tres paletas

Añadir el tipo `Palette`, los tres objetos `clasico`, `neon` y `retro`, y el `PALETTES: Record<SkinId, Palette>`. `clasico` recoge las cuatro constantes de `SnakeGame.tsx:69-72` **con sus valores literales**. Nadie las usa todavía.

_Verificación:_ `npx tsc --noEmit` y `npm run lint` pasan; el juego se ve idéntico píxel a píxel en `/juegos/serpentina/jugar`.

### 2. Pasar la paleta a la mitad vectorial

`drawGrid` (`:231-247`), `drawSnake` (`:318-341`), `drawEyes` (`:292-315`), `drawFruitFallback` (`:255-267`) y `draw()` reciben la paleta como argumento en vez de leer las constantes de módulo. Se declara `let palette: Palette = PALETTES[DEFAULT_SKIN]` dentro de `createGame`, como en `AsteroidsGame.tsx:549`. Las cuatro constantes viejas desaparecen absorbidas por `clasico`.

_Verificación:_ el juego se ve idéntico; `npm run lint` sigue en verde sin variables sin usar.

### 3. Teñido perezoso de la fruta, con caché

Dentro de `createGame`, una caché `Map<string, HTMLCanvasElement>` con clave `<skin>:<índice de FRUITS>`. Una función `tintedFruit(index, skin)` devuelve la entrada cacheada o la crea: canvas del tamaño del recorte, `drawImage` del recorte, `globalCompositeOperation = "source-atop"` y `fillRect` del `fruitTint` a `fruitTintAlpha`. Con `fruitTint` a `null` —es decir, en `clasico`— devuelve `null` y `drawFruitSprite` blita desde la `HTMLImageElement` original, como hoy.

_Verificación:_ con `clasico` el juego se ve idéntico; forzando `PALETTES.retro` a mano en el código, la fruta sale ámbar y el contador de frames no baja.

### 4. `setSkin()` en el `GameController`

Añadir `setSkin: (skin: SkinId) => void` al tipo de `SnakeGame.tsx:352-357` y devolverlo en `:702`. El cuerpo reasigna `palette` y llama a `draw()` para repintar el frame en curso, porque en pausa el bucle no dibuja. **No toca `snake`, `dir`, `fruit`, `fruitIndex` ni `score`.** La caché no se vacía: sus claves llevan la skin dentro, así que volver a una skin ya vista no vuelve a teñir nada.

_Verificación:_ `npx tsc --noEmit` pasa; llamado con `"neon"` a mitad de partida, la serpiente conserva su longitud, su rumbo y la casilla de la fruta.

### 5. El `useEffect` aparte que propaga `skin`

El componente desestructura `skin` de sus props y añade un efecto con `[skin]` como única dependencia, junto al de `paused` de `:753`. **`skin` no entra en las deps del efecto de montaje.**

_Verificación:_ cambiar de skin con una partida en curso conserva la serpiente entera, la fruta y el marcador.

### 6. Prueba manual de extremo a extremo

Una persona, en el navegador: entrar en `/juegos/serpentina/jugar`, comer seis o siete frutas hasta que la serpiente sea larga, recorrer las tres skins con el selector del HUD, comprobar que la fruta en pantalla se tiñe en el acto al cambiar de skin, comer una fruta más en cada skin, pausar y reanudar, morir contra un muro y reiniciar, salir a `/juegos/serpentina` y volver a entrar. Comprobar que `/juegos/rocas/jugar` conserva sus tres paletas y que `/juegos/ranaria/jugar` sigue con su mock y sin selector.

_Verificación:_ ningún paso reinicia la partida, la serpiente no se entrecorta al cambiar de skin y la consola del navegador queda limpia.

### 7. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas previas en 200: `/`, `/biblioteca`, `/juegos/serpentina`, `/salon`, `/about`, `/auth`.

_Verificación:_ los tres comandos terminan en verde y las seis rutas responden 200.

### Apuntes sobre el orden

- La mitad vectorial (paso 2) va antes que la de sprites (paso 3) porque es la barata y la que tiene ratios cerrados: si la serpiente ya se ve bien en las tres skins, lo que quede por depurar es solo la fruta.
- El paso 3 va antes que el 4 porque `setSkin()` tiene que poder cambiar también la fruta; si el teñido no existiera, cambiar de skin dejaría una fruta a todo color sobre un tablero ámbar.
- El paso 4 va antes que el 5 porque el efecto necesita un método al que llamar; al revés, `tsc` fallaría.
- La caché se declara dentro de `createGame` y no a nivel de módulo desde el primer momento: con estado de módulo, el doble montaje de React 19 en `strict` haría que el segundo juego heredara los canvas del primero.
- La prueba manual va antes de la pasada final para que los fallos de fluidez al comer fruta se arreglen antes de firmar el build.

## Criterios de aceptación

### No regresión de clásico

- [ ] Con la skin `clasico`, el fondo del lienzo se pinta con `#000`.
- [ ] Con la skin `clasico`, la rejilla se pinta con `#141827`.
- [ ] Con la skin `clasico`, la cabeza se pinta con `#00ff88` y el cuerpo con `#00cc6a`.
- [ ] Con la skin `clasico`, los ojos se pintan con `#000`.
- [ ] Con la skin `clasico`, la fruta de reserva en rombo se pinta con `#00ff88`.
- [ ] Con la skin `clasico`, la fruta de sprite se blita desde la `HTMLImageElement` original: `fruitTint` vale `null` y no se crea ningún canvas teñido.
- [ ] `public/games/snake/fruits.png` no se modifica: `git diff --stat` no lo menciona.
- [ ] `clasico` es la skin activa la primera vez que se abre `/juegos/serpentina/jugar` sin clave previa en `localStorage`.

### Las tres skins

- [ ] El selector del HUD ofrece `CLÁSICO`, `NEÓN` y `RETRO` en `/juegos/serpentina/jugar`.
- [ ] Con `neon` el fondo es `#05010f`, la cabeza `#00f5ff`, el cuerpo `#0d90b5` y la rejilla `#0e2136`.
- [ ] Con `neon` la serpiente se pinta con halo (`shadowBlur` 8) y la fruta se tiñe con `#c8fbff` a alpha 0.35.
- [ ] Con `retro` el fondo es `#1a1206`, la cabeza `#ffd98a`, el cuerpo `#c9862a` y la rejilla `#2e2109`.
- [ ] Con `retro` ninguna superficie se pinta con halo y la fruta se tiñe con `#ffb000` a alpha 0.7.
- [ ] `PALETTES` es un `Record<SkinId, Palette>` con exactamente tres claves.

### Contraste

- [ ] La cabeza contrasta **15.66:1** en `clasico`, **15.24:1** en `neon` y **13.72:1** en `retro` contra el fondo de su propia skin.
- [ ] El cuerpo contrasta **9.85:1** en `clasico`, **5.58:1** en `neon` y **6.11:1** en `retro` contra el fondo de su propia skin: los tres pasan el suelo de 4.5:1.
- [ ] La cabeza contrasta con el cuerpo **1.59:1** en `clasico`, **2.73:1** en `neon` y **2.24:1** en `retro`: los tres pasan el suelo de 1.5:1 por color.
- [ ] La rejilla contrasta **1.19:1** en `clasico`, **1.27:1** en `neon` y **1.18:1** en `retro` contra el fondo de su propia skin: dentro de la banda de decorado 1.1–2.5.
- [ ] La fruta más oscura del atlas (`sx=540`) sube de **2.87:1** en `clasico` a **5.50:1** en `neon` y **6.64:1** en `retro`.
- [ ] La fruta `sx=1066` sube de **3.23:1** en `clasico` a **6.18:1** en `neon` y **6.99:1** en `retro`.
- [ ] La fruta `sx=1228` sube de **3.60:1** en `clasico` a **6.16:1** en `neon` y **7.25:1** en `retro`.
- [ ] Las tres frutas oscuras de `clasico` siguen por debajo del suelo de 4.5:1: están documentadas como hallazgo y no se corrigen aquí.

### Verificación visual de la mitad de sprites

Esta mitad no se mide solo con ratios porque el sprite no es un color plano; cada ítem se responde con sí o no mirando la pantalla.

- [ ] Con la skin `retro`, la fruta se distingue del fondo y de la rejilla desde el otro extremo del tablero.
- [ ] Con la skin `neon`, la fruta se distingue del fondo y las 22 frutas siguen diferenciándose entre sí por tono.
- [ ] Con la skin `retro`, la fruta sale en un único matiz ámbar: ninguna conserva su color original.
- [ ] La silueta de la fruta conserva su recorte en las tres skins: no aparecen halos rectangulares ni bordes opacos alrededor.
- [ ] Con las tres skins, la fruta sigue centrada en su casilla y sin deformar.

### Cambio en caliente

- [ ] Cambiar de skin con una partida en curso conserva la puntuación, la longitud de la serpiente, su rumbo y la casilla de la fruta: no reinicia.
- [ ] Cambiar de skin repinta la fruta que ya estaba en pantalla con la piel nueva, sin esperar a comerla.
- [ ] Cambiar de skin estando en pausa repinta el lienzo con la piel nueva y mantiene el juego en pausa.
- [ ] Cambiar de skin no produce ningún tirón visible: la serpiente mantiene su cadencia de paso.
- [ ] En `SnakeGame.tsx`, `skin` no aparece en el array de dependencias del efecto de montaje.
- [ ] En `SnakeGame.tsx` hay un `useEffect` cuya única dependencia es `skin`.

### Persistencia

- [ ] Elegir `retro` en `/juegos/serpentina/jugar` y recargar la página deja el selector en `retro`.
- [ ] Salir a `/juegos/serpentina` y volver a entrar a jugar deja el selector en `retro`.
- [ ] La clave escrita en `localStorage` se llama `av-skin-serpentina`.
- [ ] La consola del navegador no muestra ningún error de hidratación al cargar `/juegos/serpentina/jugar`.

### No regresión

- [ ] `rocas` conserva sus tres paletas de la SPEC 11 y `caida` y `bloque-buster` siguen jugándose exactamente igual que antes de esta spec.
- [ ] `/juegos/ranaria/jugar` conserva su mock y no muestra selector de skin.
- [ ] `git diff app/globals.css` no devuelve ninguna línea.
- [ ] `git diff app/_components/games/skins.ts` no devuelve ninguna línea.
- [ ] `SnakeGame.tsx` no declara ninguna variable mutable a nivel de módulo: la paleta activa y la caché de frutas viven dentro de `createGame`.
- [ ] Salir del juego y volver a entrar arranca con una caché de frutas vacía, sin canvas del montaje anterior.
- [ ] Si `fruits.png` no carga, el rombo de reserva se pinta con el color de la skin activa y la partida sigue siendo jugable.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.

## Decisiones

- **Teñido perezoso por fruta, con caché. No pre-teñir la hoja completa por skin.** `fruits.png` mide 3790×442, y el propio código ya documenta por qué no se copia a un canvas intermedio: «copiar 3790×442 costaría ~6,7 MB de RAM para dibujar UN recorte por frame» (`SnakeGame.tsx:176-178`). Pre-teñir la hoja entera para `neon` y para `retro` multiplicaría ese coste por dos, **~13,4 MB extra**, para dibujar exactamente un recorte por frame. Con la caché perezosa solo se materializa lo que se ha visto: como mucho 22 canvas de ~130×160 por skin, y en una partida típica bastante menos. El coste por frame sigue siendo cero, que es lo que la estrategia preferida buscaba.
- **La clave de la caché lleva la skin dentro (`<skin>:<índice>`). No hay una caché por skin que se vacíe al cambiar.** Volver a una skin ya vista no vuelve a teñir nada, y el cambio de skin se reduce a reasignar la paleta: es lo que sostiene el criterio de «cambiar de skin no produce ningún tirón».
- **`neon` tiñe con α 0.35 y `retro` con α 0.7. No el mismo alpha para las dos.** `neon` quiere levantar la luminancia de las frutas oscuras sin borrar su identidad de tono; `retro` quiere justo lo contrario, un fósforo ámbar monocromo. Los dos valores se ajustaron hasta que la fruta más oscura del atlas pasó el suelo de 4.5:1, y se recalcularon con el script.
- **En `retro` las 22 frutas convergen a ámbar y dejan de distinguirse entre sí. Se acepta.** No se pierde información de juego: la puntuación depende de cuántas frutas llevas y no de cuál comes (`SCORE_BASE` y `SCORE_STEP`, `SnakeGame.tsx:55-56`). Un fósforo ámbar con frutas a todo color no sería una skin retro, sería un parche.
- **La cabeza y el cuerpo se separan por color en las tres skins, no solo por forma.** Los ojos y el margen de 1 px entre segmentos ya bastarían para invocar la excepción de forma, pero un jugador con daltonismo que solo tuviera el matiz se quedaría sin la señal. Por eso los pares están en 1.59:1, 2.73:1 y 2.24:1: se distinguen por brillo además de por matiz y por forma.
- **`neon` y `retro` usan los fondos `#05010f` y `#1a1206` de las paletas homónimas de `rocas`.** Las tres skins de la plataforma deben leerse como una familia: cambiar de juego con la misma skin no debe cambiar el ambiente.
- **La fruta de reserva en rombo se tiñe con el color de cabeza de cada skin. No se deja en `#00ff88`.** Es lo que se ve mientras carga el PNG y lo que queda si la carga falla (`SnakeGame.tsx:249-254`): dejarla verde en un tablero ámbar delataría la costura.
- **Los ojos se declaran como campo propio de la paleta aunque hoy valgan siempre el fondo.** Separar los dos campos cuesta una línea y deja preparado el día en que una skin quiera ojos que no sean un agujero al fondo; unificarlos obligaría a reabrir el tipo.
- **`clasico` sigue blitando el recorte original sin teñir ni filtrar. No pasa por el pipeline de tinte.** Es la regla dura de todo este eje y lo que hace verificable el grupo «No regresión de clásico».
- **Los tres hallazgos de contraste de `clasico` se documentan y NO se corrigen aquí.** Corregirlos en esta spec destruiría su red de no regresión. **La corrección vive en la SPEC 15**, que declara abiertamente que rompe la invariante de `clasico` y explica qué deja de reproducir.
- **Exclusión deliberada de la animación de transición y del audio por skin.** Ninguna de las dos afecta a la legibilidad, que es lo que este eje debe garantizar.

## Riesgos

| Riesgo                                                                       | Mitigación                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `skin` en las deps del efecto de montaje reinicia la partida al cambiarla    | Efecto aparte con `[skin]` como única dependencia, paso 5; grupo de criterios «Cambio en caliente»                    |
| La skin por defecto altera algún color y se cuela una regresión              | `clasico` copia los valores actuales literalmente y declara `fruitTint: null`; grupo entero «No regresión de clásico» |
| Pre-teñir la hoja de 3790×442 dispara la memoria                             | Teñido perezoso por recorte, con caché, paso 3; se descarta la hoja completa en `## Decisiones`                       |
| Teñir la fruta cada frame degrada la fluidez                                 | La fruta teñida se cachea por `<skin>:<índice>`; criterio de cadencia de paso sin tirón                               |
| El teñido opaca el canal alfa y deja un rectángulo alrededor de la fruta     | `source-atop`, que solo pinta donde el sprite ya tiene alfa; criterio visual de silueta recortada                     |
| Una skin queda ilegible sobre el fondo oscuro                                | Suelos de contraste calculados con el script WCAG; un criterio por ratio en «Contraste»                               |
| Cabeza y cuerpo que solo se distinguen por matiz                             | Pares por color en 1.59, 2.73 y 2.24:1, más ojos y margen de 1 px; declarado en `## Decisiones`                       |
| La caché sobrevive al desmontaje y el segundo juego hereda canvas viejos     | La caché se declara dentro de `createGame`; criterio de caché vacía al volver a entrar                                |
| Un fallo de carga de `fruits.png` deja la partida sin fruta visible          | El rombo de reserva se pinta con el color de la skin activa; criterio explícito de carga fallida                      |
| Leer `localStorage` durante el render da error de hidratación                | Lectura en efecto, ya implementada por la SPEC 10; criterio de consola limpia                                         |
| `localStorage` lanza en navegación privada                                   | Acceso envuelto en `try/catch` por la SPEC 10, con salida a `clasico`                                                 |
| Variables sin usar tras absorber las constantes viejas rompen `npm run lint` | Paso 2 elimina las cuatro constantes al mismo tiempo que las sustituye; verificación de lint en el paso               |

## Lo que **no** entra en esta spec

- **La corrección de los hallazgos de contraste de `clasico`.** Las tres frutas oscuras a 2.87:1, 3.23:1 y 3.60:1 se documentan y se dejan como están; el arreglo va en la SPEC 15.
- **Skins de `caida` y `bloque-buster`.** Van en la SPEC 12 y en la SPEC 13.
- **Sustituir los sprites de fruta por primitivas vectoriales** en las skins no clásicas.
- **Pre-teñir la hoja completa por skin.** Costaría ~13,4 MB de RAM extra.
- **Modificar, regenerar o sustituir `public/games/snake/fruits.png`.**
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas.
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma.
- **Cambios en `app/_components/games/skins.ts`, `types.ts`, `GamePlayerScreen.tsx` o `GamePlayerScreen.module.css`.** Son de la SPEC 10; esta spec solo los consume.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`.
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.**

_Cada uno de esos, si llega, va en su propia spec._
