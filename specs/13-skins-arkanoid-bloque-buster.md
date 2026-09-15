# SPEC 13 — Skins clásico, neón y retro de Arkanoid (`bloque-buster`)

> **Status:** Approved
> **Depends on:** SPEC 10 (contrato de skins), SPEC 08 (adaptación de Arkanoid), SPEC 05 (contrato de juego y registro)
> **Date:** 2026-09-15
> **Objective:** Dar a `bloque-buster` las tres skins obligatorias tiñendo el spritesheet a canvas una sola vez por skin al cargar, sin que la skin `clasico` deje de pintar el PNG original.

## Alcance

**Dentro:**

- **`app/_components/games/ArkanoidGame.tsx`** y su paleta por skin. Es el único fichero de juego que se toca.
- **Consumo del contrato de la SPEC 10, ya implementado.** `SkinId` y `DEFAULT_SKIN` se importan de `app/_components/games/skins.ts`; `PlayableGameProps` ya declara `skin?: SkinId` (`app/_components/games/types.ts:28-34`); el selector del HUD (`app/_components/GamePlayerScreen.tsx:174-190`) y la persistencia en `av-skin-bloque-buster` (`GamePlayerScreen.tsx:66`, `:105-107`, `:116`) ya están montados. Esta spec no añade nada a ninguno de los tres.
- **Teñido previo a canvas, una vez por skin.** `bloque-buster` es un caso de spritesheet puro: todo lo que pinta sale de `public/games/arkanoid/spritesheet-breakout.png` (559×337, comprobado con `ls` y `sips`), salvo el fondo `"#000"` de `ArkanoidGame.tsx:748`. `loadSpritesheet` (`ArkanoidGame.tsx:269-291`) **ya** copia el PNG a un `HTMLCanvasElement` fuera de pantalla; esta spec aprovecha ese paso para generar además las dos hojas teñidas.
- **El PNG no se toca.** No se edita, no se regenera y no se añade ningún asset nuevo a `public/games/arkanoid/`.
- **Las tres paletas** en el módulo del juego, como un `Record<SkinId, Palette>`, con la misma forma que `AsteroidsGame.tsx:62-119`. `clasico` no tiene colores de tinte: tiene el fondo actual y la hoja sin transformar.
- **`setSkin(next: SkinId)` en el `GameController`** de `ArkanoidGame.tsx:576-581`, como quinto método junto a `start`, `stop`, `restart` y `setPaused` (`ArkanoidGame.tsx:934`). Reasigna la paleta y la hoja activas y repinta el frame; **no toca `paddle`, `ball`, `blocks`, `explosions`, `score`, `lives` ni `level`**.
- **Un `useEffect` aparte** en el componente React que propaga `skin` llamando a `setSkin()`, con `skin` como única dependencia. Es el patrón exacto del efecto de `paused` de `ArkanoidGame.tsx:984` y del de `skin` ya escrito en `AsteroidsGame.tsx:915-921`.
- **Diez superficies pintables:** el fondo del lienzo —vectorial— más la pala, la pelota, los siete colores de bloque (`ArkanoidGame.tsx:31-33`) y los frames de explosión (`EXPLOSION_FRAMES` `ArkanoidGame.tsx:204-212`), todos de sprite.
- **No regresión explícita**: los cuatro ids que hoy están en `app/_components/games/registry.ts` — `rocas`, `caida`, `bloque-buster` y `serpentina` — siguen jugándose igual, y `rocas` conserva las tres paletas de la SPEC 11. El testigo mock es **`/juegos/invasores/jugar`**, un id sin entrada en el registro, que conserva su ticker de score falso, sus enemigos CSS y su guardado por toast.

**Fuera de alcance (para futuras specs):**

- **La corrección de los hallazgos de contraste de `clasico`.** Esta spec documenta que `block_gray` queda a 1.65:1, `block_magenta` a 3.24:1 y `block_red` a 3.64:1 contra el fondo negro, y **no los corrige**: `clasico` reproduce el estado actual y es la red de no regresión. La corrección vive en la SPEC 15.
- **Skins de `caida` y `serpentina`.** Cada juego va en su propia spec: la SPEC 12 y la SPEC 14.
- **Redibujar las entidades con primitivas vectoriales** en las skins no clásicas. Cambiaría la silueta del juego, no solo su color.
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

`skin` llega como prop opcional de `PlayableGameProps`. `GamePlayerScreen` la gobierna con el selector del HUD y la persiste en la clave `av-skin-bloque-buster`.

**Cambiar de skin no reinicia la partida.** El `GameController` gana un quinto método, `setSkin(next: SkinId)`, que solo reasigna la paleta y la hoja activas del closure y llama a `draw()` para repintar el frame en curso. El componente lo propaga desde un **`useEffect` aparte**:

```ts
// `skin` NUNCA entra en las deps del efecto de montaje: si entrase, cada
// cambio de skin destruiría y recrearía el juego, y el jugador perdería los
// bloques ya rotos, las vidas y la puntuación al tocar el selector.
useEffect(() => {
  gameRef.current?.setSkin(skin ?? DEFAULT_SKIN);
}, [skin]);
```

**Las tres hojas se generan al cargar, no al cambiar de skin.** `loadSpritesheet` pasa de devolver una `Spritesheet` a devolver un `Record<SkinId, Spritesheet>`: la de `clasico` es la copia sin transformar que ya se hacía hoy, y las de `neon` y `retro` se pintan encima con `globalCompositeOperation = "source-atop"`. Si el jugador cambia de skin con la partida en curso, no se decodifica ni se tiñe nada: solo se elige otra hoja del registro. **Coste por frame: cero.**

El teñido es, por sprite, un `fillRect` del color de la skin a alpha declarada sobre la región de ese sprite, con `source-atop` para respetar el canal alfa del PNG. El color resultante de un píxel es por tanto `P·(1−α) + C·α`, con `P` el color del PNG y `C` el tinte. De ahí que los ratios de abajo sean **calculados y no estimados**: se aplica la misma fórmula al color dominante muestreado de cada recorte.

### (b) Las tres paletas

Las diez superficies pintables y su origen actual, comprobado con `grep` y muestreando el PNG recorte a recorte:

| #   | Superficie       | Dónde hoy                       | Color dominante actual |
| --- | ---------------- | ------------------------------- | ---------------------- |
| 1   | Fondo del lienzo | `draw()` `:748`                 | `#000` (vectorial)     |
| 2   | Pala             | `SPRITES.paddle` `:184`         | `#babac5`              |
| 3   | Pelota           | `SPRITES.ball` `:185`           | `#babac5`              |
| 4   | `block_red`      | `SPRITES.blocks.red` `:188`     | `#c02a3e`              |
| 5   | `block_cyan`     | `SPRITES.blocks.cyan` `:190`    | `#4fc99c`              |
| 6   | `block_green`    | `SPRITES.blocks.green` `:193`   | `#44aaf3`              |
| 7   | `block_magenta`  | `SPRITES.blocks.magenta` `:191` | `#632ff4`              |
| 8   | `block_yellow`   | `SPRITES.blocks.yellow` `:189`  | `#d9bd4c`              |
| 9   | `block_hotpink`  | `SPRITES.blocks.hotpink` `:192` | `#fc7d1c`              |
| 10  | `block_gray`     | `SPRITES.blocks.gray` `:187`    | `#323142`              |

**Los nombres de `BlockColor` no describen lo que pinta el PNG.** `green` es azul (`#44aaf3`), `magenta` es morado (`#632ff4`) y `hotpink` es naranja (`#fc7d1c`). No es un error: el puerto de la SPEC 08 conservó los nombres del original. Las paletas de abajo se indexan por **nombre de `BlockColor`**, no por el color que uno esperaría del nombre.

Los frames de explosión (`EXPLOSION_FRAMES` `:204-212`) comparten fila con su bloque en la hoja, así que el teñido abarca **la fila entera de cada color**: el bloque y sus cuatro frames quedan de la misma piel. `gray` reutiliza la fila de `red` (`:203`, `:211`), así que hereda su tinte en la explosión.

Forma del registro de paletas:

```ts
type Palette = {
  background: string;
  /** `null` en `clasico`: la hoja se usa tal cual sale del PNG. */
  tints: Record<SpriteTintKey, string> | null;
  /** Alpha del `fillRect` con `source-atop`. Ignorado si `tints` es `null`. */
  tintAlpha: number;
  /** `shadowBlur` del halo. 0 en `clasico` y en `retro`. */
  glow: number;
};

const PALETTES: Record<SkinId, Palette> = { clasico, neon, retro };
```

#### `clasico` — la skin por defecto

```ts
const clasico: Palette = {
  background: "#000",
  tints: null, // la hoja NO se tiñe ni se filtra
  tintAlpha: 0,
  glow: 0,
};
```

`background` es el literal que `ArkanoidGame.tsx:748` tiene hoy, copiado tal cual en su forma corta. La hoja de `clasico` es exactamente la copia a canvas que `loadSpritesheet` ya hace (`:275-282`): ninguna transformación se aplica a la skin por defecto.

| Skin      | Entidad         | Color     | Fondo     | Ratio       | Suelo | ✅          |
| --------- | --------------- | --------- | --------- | ----------- | ----- | ----------- |
| `clasico` | Pala            | `#babac5` | `#000000` | **10.92:1** | ≥4.5  | ✅          |
| `clasico` | Pelota          | `#babac5` | `#000000` | **10.92:1** | ≥4.5  | ✅          |
| `clasico` | `block_cyan`    | `#4fc99c` | `#000000` | **10.17:1** | ≥4.5  | ✅          |
| `clasico` | `block_yellow`  | `#d9bd4c` | `#000000` | **11.33:1** | ≥4.5  | ✅          |
| `clasico` | `block_green`   | `#44aaf3` | `#000000` | **8.29:1**  | ≥4.5  | ✅          |
| `clasico` | `block_hotpink` | `#fc7d1c` | `#000000` | **8.09:1**  | ≥4.5  | ✅          |
| `clasico` | `block_red`     | `#c02a3e` | `#000000` | **3.64:1**  | ≥4.5  | ⚠️ hallazgo |
| `clasico` | `block_magenta` | `#632ff4` | `#000000` | **3.24:1**  | ≥4.5  | ⚠️ hallazgo |
| `clasico` | `block_gray`    | `#323142` | `#000000` | **1.65:1**  | ≥4.5  | ⚠️ hallazgo |

Los tres hallazgos son del **estado actual**, no de esta spec. Las dos entidades jugables —pala y pelota— están a 10.92:1 y pasan de sobra; lo que queda corto son tres colores de bloque, que son blancos y no entidades jugables. **No se corrigen aquí.** Ver `## Decisiones`.

#### `neon` — fondo `#05010f`, tinte con α 0.85, con halo

Mismo fondo que la `neon` de `rocas` (`AsteroidsGame.tsx:95`).

```ts
const neon: Palette = {
  background: "#05010f",
  tints: {
    paddle: "#00f5ff", // token --cyan
    ball: "#ffffff", // blanco a propósito: ver la nota de pelota vs bloque
    red: "#ff2d95",
    cyan: "#00c8d6",
    green: "#4d8bff",
    magenta: "#c04dff",
    yellow: "#c9d400",
    hotpink: "#ff7a00",
    gray: "#8f9bc9",
  },
  tintAlpha: 0.85,
  glow: 8,
};
```

Resultado del teñido sobre el color dominante de cada recorte, y su ratio contra `#05010f`:

| Skin   | Entidad         | Tinte     | Resultado | Fondo     | Ratio       | Suelo | ✅  |
| ------ | --------------- | --------- | --------- | --------- | ----------- | ----- | --- |
| `neon` | Pala            | `#00f5ff` | `#1cecf6` | `#05010f` | **14.13:1** | ≥4.5  | ✅  |
| `neon` | Pelota          | `#ffffff` | `#f5f5f6` | `#05010f` | **18.94:1** | ≥4.5  | ✅  |
| `neon` | `block_red`     | `#ff2d95` | `#f62d88` | `#05010f` | **5.55:1**  | ≥4.5  | ✅  |
| `neon` | `block_cyan`    | `#00c8d6` | `#0cc8cd` | `#05010f` | **9.98:1**  | ≥4.5  | ✅  |
| `neon` | `block_green`   | `#4d8bff` | `#4c90fd` | `#05010f` | **6.60:1**  | ≥4.5  | ✅  |
| `neon` | `block_magenta` | `#c04dff` | `#b249fd` | `#05010f` | **5.17:1**  | ≥4.5  | ✅  |
| `neon` | `block_yellow`  | `#c9d400` | `#cbd10b` | `#05010f` | **12.44:1** | ≥4.5  | ✅  |
| `neon` | `block_hotpink` | `#ff7a00` | `#ff7a04` | `#05010f` | **7.90:1**  | ≥4.5  | ✅  |
| `neon` | `block_gray`    | `#8f9bc9` | `#818bb5` | `#05010f` | **6.18:1**  | ≥4.5  | ✅  |

Par crítico —**pelota contra el bloque más parecido**, que es el que decide si la pelota se pierde de vista al tunelar por el muro:

| Par                                          | Ratio      | Suelo | ✅  |
| -------------------------------------------- | ---------- | ----- | --- |
| Pelota `#f5f5f6` vs `block_yellow` `#cbd10b` | **1.52:1** | ≥1.5  | ✅  |
| Pelota vs `block_magenta` `#b249fd`          | **3.66:1** | ≥1.5  | ✅  |

Por eso la pelota de `neon` se tiñe de blanco y no del token `--yellow`: con un tinte amarillo, la pelota y los bloques amarillos quedaban a 1.02:1 y la pelota desaparecía justo al tunelar.

El halo (`shadowBlur: 8`, `shadowColor` igual al tinte del sprite) solo suma brillo alrededor del núcleo: todos los ratios están calculados sobre el color del núcleo, que es lo conservador.

#### `retro` — fondo `#1a1206`, tinte ámbar con α 0.94, sin halo

Mismo fondo que la `retro` de `rocas` (`AsteroidsGame.tsx:109`).

```ts
const retro: Palette = {
  background: "#1a1206",
  tints: {
    paddle: "#ffe9c2",
    ball: "#fff8e8",
    red: "#c4762f",
    cyan: "#d9a24a",
    green: "#b8823c",
    magenta: "#b87a36",
    yellow: "#e8bd63",
    hotpink: "#cf8f3a",
    gray: "#ab8a5e",
  },
  tintAlpha: 0.94,
  glow: 0,
};
```

| Skin    | Entidad         | Tinte     | Resultado | Fondo     | Ratio       | Suelo | ✅  |
| ------- | --------------- | --------- | --------- | --------- | ----------- | ----- | --- |
| `retro` | Pala            | `#ffe9c2` | `#fbe6c2` | `#1a1206` | **15.18:1** | ≥4.5  | ✅  |
| `retro` | Pelota          | `#fff8e8` | `#fbf4e6` | `#1a1206` | **16.93:1** | ≥4.5  | ✅  |
| `retro` | `block_red`     | `#c4762f` | `#c47130` | `#1a1206` | **5.08:1**  | ≥4.5  | ✅  |
| `retro` | `block_cyan`    | `#d9a24a` | `#d1a44f` | `#1a1206` | **8.06:1**  | ≥4.5  | ✅  |
| `retro` | `block_green`   | `#b8823c` | `#b18447` | `#1a1206` | **5.53:1**  | ≥4.5  | ✅  |
| `retro` | `block_magenta` | `#b87a36` | `#b37641` | `#1a1206` | **4.93:1**  | ≥4.5  | ✅  |
| `retro` | `block_yellow`  | `#e8bd63` | `#e7bd62` | `#1a1206` | **10.46:1** | ≥4.5  | ✅  |
| `retro` | `block_hotpink` | `#cf8f3a` | `#d28e38` | `#1a1206` | **6.77:1**  | ≥4.5  | ✅  |
| `retro` | `block_gray`    | `#ab8a5e` | `#a4855c` | `#1a1206` | **5.37:1**  | ≥4.5  | ✅  |

| Par                                          | Ratio      | Suelo | ✅  |
| -------------------------------------------- | ---------- | ----- | --- |
| Pelota `#fbf4e6` vs `block_yellow` `#e7bd62` | **1.62:1** | ≥1.5  | ✅  |
| Pelota vs `block_magenta` `#b37641`          | **3.44:1** | ≥1.5  | ✅  |

El alpha de `retro` es 0.94 y no 0.85 porque tres de los siete bloques parten de un color muy oscuro en el PNG: con α 0.85 el resultado de `block_magenta` se quedaba en 4.12:1, por debajo del suelo. Con 0.94 el tinte domina y el bisel del sprite sobrevive como modulación fina.

#### Pares entre bloques — excepción de forma

El suelo de 1.5:1 entre entidades no se cumple por color entre bloques en ninguna skin:

| Skin      | Par más flojo     | Ratio      | Suelo |                    |
| --------- | ----------------- | ---------- | ----- | ------------------ |
| `clasico` | `red` / `magenta` | **1.12:1** | ≥1.5  | excepción de forma |
| `neon`    | `green` / `gray`  | **1.07:1** | ≥1.5  | excepción de forma |
| `retro`   | `green` / `gray`  | **1.03:1** | ≥1.5  | excepción de forma |

**Qué rasgo de forma hace el trabajo:** los bloques son rectángulos idénticos de 64×24 px lógicos (`BLOCK_W` / `BLOCK_H`, `ArkanoidGame.tsx:88-89`) colocados en una parrilla fija de 10×6 (`BLOCK_COLS` / `BLOCK_ROWS`, `:86-87`), y cada sprite lleva su propio bisel de dos tonos que dibuja la junta entre bloques contiguos. Además **todos los bloques valen los mismos 10 puntos** (`BLOCK_SCORE`, `ArkanoidGame.tsx:93`, `:707`) y todos caen de un solo impacto: ninguna decisión del jugador depende de distinguir dos colores de bloque entre sí. Lo que sí importa es distinguir la pelota del muro, y eso está cubierto con número: 1.52:1 en `neon` y 1.62:1 en `retro`.

### (c) Persistencia

- **Clave:** `av-skin-bloque-buster`, generada por `skinKey` (`GamePlayerScreen.tsx:66`). Ya implementada por la SPEC 10; esta spec no la toca.
- **Lectura en efecto, no en render** (`GamePlayerScreen.tsx:100-110`), validada con `isSkinId` de `skins.ts` y con salida a `clasico`.
- **Acceso envuelto en `try/catch`,** tanto en lectura como en escritura.
- **Sin migración.** No se crea nada en `supabase/migrations/`, no se toca `public.games` y no se llama a ningún MCP de escritura.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Extraer el literal del fondo

Sacar `"#000"` de `ArkanoidGame.tsx:748` a una constante de módulo con nombre. **Sin cambiar el valor.** Es el único color escrito a mano del fichero. Se commitea solo.

_Verificación:_ el juego se ve idéntico píxel a píxel en `/juegos/bloque-buster/jugar` y `npx tsc --noEmit` pasa.

### 2. Definir las tres paletas

Añadir el tipo `Palette`, el tipo `SpriteTintKey`, los tres objetos `clasico`, `neon` y `retro`, y el `PALETTES: Record<SkinId, Palette>`. `clasico` recoge la constante del paso 1 y declara `tints: null`. Nadie las usa todavía.

_Verificación:_ `npx tsc --noEmit` y `npm run lint` pasan; el juego sigue viéndose idéntico.

### 3. Generar las tres hojas al cargar

`loadSpritesheet` pasa a devolver un `Record<SkinId, Spritesheet>`. La entrada de `clasico` es la copia sin transformar que ya se hace hoy (`ArkanoidGame.tsx:275-282`). Las de `neon` y `retro` se construyen en sendos canvas fuera de pantalla de 559×337: se dibuja la hoja original y luego, por cada clave de `tints`, un `fillRect` del color a `tintAlpha` con `globalCompositeOperation = "source-atop"`, acotado a la región de ese sprite. La región de un bloque abarca **la fila entera de la hoja**, para que sus cuatro frames de explosión queden de la misma piel.

_Verificación:_ el juego sigue pintando `clasico` y se ve idéntico; en el inspector, la memoria del canvas sube en dos hojas de 559×337 y no más.

### 4. Elegir la hoja por skin en el dibujo

`draw()` (`ArkanoidGame.tsx:746-785`) y las funciones `drawSprite` (`:246`) y `drawFrame` (`:259`) reciben la hoja activa y la paleta activa en vez de la única de hoy. Se declara `let palette: Palette = PALETTES[DEFAULT_SKIN]` dentro de `createGame`, como en `AsteroidsGame.tsx:549`.

_Verificación:_ el juego se ve idéntico con `clasico`; forzando `PALETTES.neon` a mano en el código, el muro aparece teñido y la partida sigue jugándose.

### 5. `setSkin()` en el `GameController`

Añadir `setSkin: (skin: SkinId) => void` al tipo de `ArkanoidGame.tsx:576-581` y devolverlo en `:934`. El cuerpo reasigna la paleta y la hoja activas y llama a `draw()` para repintar el frame en curso. **No toca `paddle`, `ball`, `blocks`, `explosions`, `score`, `lives` ni `level`.** Si la hoja aún no ha cargado, solo reasigna la paleta: el fondo cambia y los sprites aparecen ya teñidos cuando la carga termine.

_Verificación:_ `npx tsc --noEmit` pasa; llamado con `"retro"` a mitad de partida, los bloques ya rotos siguen rotos y la puntuación no cambia.

### 6. El `useEffect` aparte que propaga `skin`

El componente desestructura `skin` de sus props y añade un efecto con `[skin]` como única dependencia, junto al de `paused` de `:984`. **`skin` no entra en las deps del efecto de montaje.**

_Verificación:_ cambiar de skin con una partida en curso conserva el muro, las vidas, la posición de la pala y la de la pelota.

### 7. Prueba manual de extremo a extremo

Una persona, en el navegador: entrar en `/juegos/bloque-buster/jugar`, romper diez o doce bloques, recorrer las tres skins con el selector del HUD, comprobar que una explosión en `retro` sale ámbar y no con el color original, pasar de nivel, perder una vida, morir y reiniciar, salir a `/juegos/bloque-buster` y volver a entrar. Comprobar que `/juegos/rocas/jugar` conserva sus tres paletas y que `/juegos/invasores/jugar` sigue con su mock y sin selector.

_Verificación:_ ningún paso reinicia la partida, la animación sigue fluida al cambiar de skin y la consola del navegador queda limpia.

### 8. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas previas en 200: `/`, `/biblioteca`, `/juegos/bloque-buster`, `/salon`, `/about`, `/auth`.

_Verificación:_ los tres comandos terminan en verde y las seis rutas responden 200.

### Apuntes sobre el orden

- El paso 3 va antes que el 4 porque no se puede elegir hoja por skin hasta que existen tres hojas; al revés, el dibujo indexaría un registro con una sola entrada.
- El teñido se hace en la carga (paso 3) y no en `setSkin()` (paso 5) a propósito: con el teñido en `setSkin()`, cada clic del selector recorrería 559×337 píxeles nueve veces y el jugador vería un tirón en mitad de la partida.
- El paso 5 va antes que el 6 porque el efecto necesita un método al que llamar; al revés, `tsc` fallaría.
- El paso 1 se commitea solo porque es el único cambio que puede introducir una regresión invisible en el color de fondo, y conviene detectarlo antes de mezclarlo con el teñido.
- La prueba manual va antes de la pasada final para que los fallos de fluidez y de explosión se arreglen antes de firmar el build.

## Criterios de aceptación

### No regresión de clásico

- [ ] Con la skin `clasico`, el fondo del lienzo se pinta con `#000`.
- [ ] Con la skin `clasico`, la hoja que se blita es la copia sin transformar del PNG: `tints` vale `null` y no se aplica ningún `fillRect` ni ningún `ctx.filter`.
- [ ] Con la skin `clasico`, la pala, la pelota, los siete colores de bloque y los cuatro frames de explosión de cada fila se ven exactamente como antes de esta spec.
- [ ] `public/games/arkanoid/spritesheet-breakout.png` no se modifica: `git diff --stat` no lo menciona.
- [ ] `clasico` es la skin activa la primera vez que se abre `/juegos/bloque-buster/jugar` sin clave previa en `localStorage`.

### Las tres skins

- [ ] El selector del HUD ofrece `CLÁSICO`, `NEÓN` y `RETRO` en `/juegos/bloque-buster/jugar`.
- [ ] Con `neon` el fondo del lienzo es `#05010f` y el teñido usa `tintAlpha` 0.85.
- [ ] Con `retro` el fondo del lienzo es `#1a1206` y el teñido usa `tintAlpha` 0.94.
- [ ] Con `retro` ningún sprite se pinta con halo: `shadowBlur` vale 0.
- [ ] `PALETTES` es un `Record<SkinId, Palette>` con exactamente tres claves.
- [ ] Las hojas teñidas se generan una sola vez, dentro de `loadSpritesheet`, y no dentro de `setSkin()` ni del bucle de dibujo.

### Contraste

- [ ] La pelota de `neon` contrasta **18.94:1** y la pala **14.13:1** contra el fondo `#05010f`.
- [ ] La pelota de `retro` contrasta **16.93:1** y la pala **15.18:1** contra el fondo `#1a1206`.
- [ ] El bloque más flojo de `neon` es `block_magenta`, a **5.17:1** contra `#05010f`: pasa el suelo de 4.5:1.
- [ ] El bloque más flojo de `retro` es `block_magenta`, a **4.93:1** contra `#1a1206`: pasa el suelo de 4.5:1.
- [ ] `block_gray` sube de **1.65:1** en `clasico` a **6.18:1** en `neon` y **5.37:1** en `retro`.
- [ ] La pelota de `neon` contrasta **1.52:1** contra `block_yellow`, el bloque más parecido a ella: pasa el suelo de 1.5:1.
- [ ] La pelota de `retro` contrasta **1.62:1** contra `block_yellow`, el bloque más parecido a ella: pasa el suelo de 1.5:1.
- [ ] `block_gray` (**1.65:1**), `block_magenta` (**3.24:1**) y `block_red` (**3.64:1**) de `clasico` siguen por debajo del suelo de 4.5:1: están documentados como hallazgo y no se corrigen aquí.
- [ ] El par de bloques más flojo es `red`/`magenta` a **1.12:1** en `clasico`, `green`/`gray` a **1.07:1** en `neon` y `green`/`gray` a **1.03:1** en `retro`: los tres quedan por debajo de 1.5:1 y se resuelven por la excepción de forma declarada en `## Decisiones`.

### Verificación visual de la mitad de sprites

Esta mitad no se mide con ratios porque el sprite no es un color plano; cada ítem se responde con sí o no mirando la pantalla.

- [ ] Con la skin `retro`, los bloques se distinguen del fondo y las filas contiguas se distinguen entre sí.
- [ ] Con la skin `neon`, los bloques se distinguen del fondo y las filas contiguas se distinguen entre sí.
- [ ] Con las skins `neon` y `retro`, el bisel de relieve de cada bloque sigue siendo visible: el teñido no aplana el sprite en una silueta lisa.
- [ ] Con la skin `retro`, los cuatro frames de la animación de explosión salen ámbar, no con los colores originales del PNG.
- [ ] Con la skin `neon`, la pelota se sigue viendo mientras cruza el muro de bloques.
- [ ] El borde de la pala y el de la pelota conservan su forma en las tres skins: no aparecen halos recortados ni bordes dentados nuevos.

### Cambio en caliente

- [ ] Cambiar de skin con una partida en curso conserva la puntuación, las vidas, el nivel, qué bloques siguen vivos y la posición de la pala y de la pelota: no reinicia.
- [ ] Cambiar de skin estando en pausa repinta el lienzo con la piel nueva y mantiene el juego en pausa.
- [ ] Cambiar de skin en mitad de una partida no produce ningún tirón visible: la pelota mantiene su velocidad.
- [ ] En `ArkanoidGame.tsx`, `skin` no aparece en el array de dependencias del efecto de montaje.
- [ ] En `ArkanoidGame.tsx` hay un `useEffect` cuya única dependencia es `skin`.

### Persistencia

- [ ] Elegir `retro` en `/juegos/bloque-buster/jugar` y recargar la página deja el selector en `retro`.
- [ ] Salir a `/juegos/bloque-buster` y volver a entrar a jugar deja el selector en `retro`.
- [ ] La clave escrita en `localStorage` se llama `av-skin-bloque-buster`.
- [ ] La consola del navegador no muestra ningún error de hidratación al cargar `/juegos/bloque-buster/jugar`.

### No regresión

- [ ] `rocas` conserva sus tres paletas de la SPEC 11 y `caida` y `serpentina` siguen jugándose exactamente igual que antes de esta spec.
- [ ] `/juegos/invasores/jugar` conserva su mock: ticker de score falso, enemigos CSS y guardado por toast.
- [ ] `git diff app/globals.css` no devuelve ninguna línea.
- [ ] `git diff app/_components/games/skins.ts` no devuelve ninguna línea.
- [ ] `ArkanoidGame.tsx` no declara ninguna variable mutable a nivel de módulo: la hoja activa y la paleta activa viven dentro de `createGame`.
- [ ] Salir del juego y volver a entrar no deja hojas teñidas del montaje anterior vivas: el cleanup anula el `onload` de la imagen como ya hace hoy.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.

## Decisiones

- **Teñido previo a canvas, una vez por skin al cargar. No `ctx.filter` en cada blit.** El juego ya copia el PNG a un `HTMLCanvasElement` (`ArkanoidGame.tsx:269-291`), así que generar dos hojas más es una extensión del paso que ya existe, no una pieza nueva. El coste por frame es cero, mientras que `ctx.filter` lo pagaría en cada uno de los ~70 blits por frame de un nivel lleno y tiene soporte más irregular entre navegadores.
- **Teñido con `source-atop` y un `fillRect` por sprite. No `globalCompositeOperation = "color"`.** `source-atop` respeta el canal alfa del PNG y produce un color de salida `P·(1−α) + C·α`, que es **calculable**: por eso esta spec trae ratios reales para una mitad de sprites en vez de dejarlo todo en verificación visual. `"color"` conserva la luminancia del original, y con ella conservaría el problema: `block_gray` seguiría siendo el ladrillo más oscuro de la pantalla en las tres skins.
- **El teñido abarca la fila entera de cada color, no solo el recorte del bloque.** Los cuatro frames de explosión comparten fila con su bloque (`explosionRow`, `ArkanoidGame.tsx:215-221`); tiñendo solo el bloque, un ladrillo ámbar explotaría en rojo durante los 150 ms de `EXPLOSION_DURATION`.
- **La pelota de `neon` se tiñe de blanco. No del token `--yellow`.** Con tinte amarillo, pelota y `block_yellow` quedaban a 1.02:1 y la pelota desaparecía justo mientras tunelaba por el muro, que es el momento en que más falta hace verla. En blanco el par sube a 1.52:1 y pasa el suelo por color, sin depender de la excepción de forma.
- **`retro` tiñe con α 0.94 y `neon` con α 0.85. No el mismo alpha para las dos.** Tres bloques parten de un color muy oscuro en el PNG (`block_gray` `#323142`, `block_magenta` `#632ff4`, `block_red` `#c02a3e`); con α 0.85 el `block_magenta` de `retro` se quedaba en 4.12:1, por debajo del suelo. El alpha se subió y se recalculó hasta que los siete pasaron.
- **`neon` y `retro` usan los fondos `#05010f` y `#1a1206` de las paletas homónimas de `rocas`.** Las tres skins de la plataforma deben leerse como una familia: cambiar de juego con la misma skin no debe cambiar el ambiente.
- **Excepción de forma para los pares entre bloques.** El par más flojo es 1.03:1 (`green`/`gray` en `retro`). Se acepta porque los bloques son rectángulos idénticos en una parrilla fija, cada sprite lleva su bisel de dos tonos, y **todos valen los mismos 10 puntos y caen de un impacto** (`ArkanoidGame.tsx:93`, `:707`): ninguna decisión del jugador depende de distinguir dos colores de bloque entre sí. El par que sí importa —pelota contra muro— se cubre con número.
- **`clasico` sigue pintando el PNG sin teñir ni filtrar. No pasa por el pipeline de tinte.** Es la regla dura de todo este eje y lo que hace verificable el grupo «No regresión de clásico»: si la skin por defecto pintara un solo píxel distinto, esta spec dejaría de tener testigo.
- **Los tres hallazgos de contraste de `clasico` se documentan y NO se corrigen aquí.** Corregirlos en esta spec destruiría su red de no regresión. **La corrección vive en la SPEC 15**, que declara abiertamente que rompe la invariante de `clasico` y explica qué deja de reproducir.
- **Las skins no clásicas siguen usando los sprites. No se redibujan las entidades con primitivas vectoriales.** Cambiaría la silueta del juego y no solo su color; el bisel de los bloques y el recorte de la pala son parte de la identidad de este puerto.
- **Exclusión deliberada de la animación de transición y del audio por skin.** Ninguna de las dos afecta a la legibilidad, que es lo que este eje debe garantizar.

## Riesgos

| Riesgo                                                                    | Mitigación                                                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `skin` en las deps del efecto de montaje reinicia la partida al cambiarla | Efecto aparte con `[skin]` como única dependencia, paso 6; grupo de criterios «Cambio en caliente»         |
| La skin por defecto altera algún color y se cuela una regresión           | `clasico` declara `tints: null` y no pasa por el pipeline; grupo entero «No regresión de clásico»          |
| Teñir sprites cada frame degrada la fluidez                               | Teñido previo a canvas una vez por skin al cargar, paso 3; criterio de cambio de skin sin tirón            |
| El teñido aplana el sprite y se pierde el bisel                           | `source-atop` con alpha declarada, nunca opaca; criterio de verificación visual del bisel                  |
| La explosión sale con el color del PNG y no con el de la skin             | El teñido abarca la fila entera de cada color, paso 3; criterio visual de la explosión en `retro`          |
| Una skin queda ilegible sobre el fondo oscuro                             | Suelos de contraste calculados con el script WCAG; un criterio por ratio en «Contraste»                    |
| La pelota se pierde de vista contra el muro de bloques                    | Par pelota/bloque medido: 1.52:1 en `neon` y 1.62:1 en `retro`; criterio visual de tunelado                |
| Bloques que solo se distinguen por matiz                                  | Excepción de forma declarada en `## Decisiones`; bisel de dos tonos y parrilla fija                        |
| Dos hojas teñidas más multiplican por tres la memoria de sprites          | La hoja son 559×337: las tres juntas no llegan a 2,3 MB; criterio de memoria en el paso 3                  |
| Un cambio de skin antes de que cargue el PNG deja el lienzo sin pintar    | `setSkin()` reasigna la paleta aunque no haya hoja; el fondo cambia y los sprites entran ya teñidos        |
| Una carga en vuelo toca un juego ya desmontado                            | El cleanup anula el `onload` de la imagen, como ya hace hoy; criterio de salir y volver a entrar           |
| Leer `localStorage` durante el render da error de hidratación             | Lectura en efecto, ya implementada por la SPEC 10; criterio de consola limpia                              |
| `localStorage` lanza en navegación privada                                | Acceso envuelto en `try/catch` por la SPEC 10, con salida a `clasico`                                      |
| Estado de módulo al introducir la hoja activa                             | Hoja y paleta activas se declaran dentro de `createGame`, como `AsteroidsGame.tsx:549`; criterio explícito |

## Lo que **no** entra en esta spec

- **La corrección de los hallazgos de contraste de `clasico`.** `block_gray` a 1.65:1, `block_magenta` a 3.24:1 y `block_red` a 3.64:1 se documentan y se dejan como están; el arreglo va en la SPEC 15.
- **Skins de `caida` y `serpentina`.** Van en la SPEC 12 y en la SPEC 14.
- **Redibujar las entidades con primitivas vectoriales** en las skins no clásicas.
- **Modificar, regenerar o sustituir `public/games/arkanoid/spritesheet-breakout.png`.**
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas.
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma.
- **Cambios en `app/_components/games/skins.ts`, `types.ts`, `GamePlayerScreen.tsx` o `GamePlayerScreen.module.css`.** Son de la SPEC 10; esta spec solo los consume.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`.
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.**

_Cada uno de esos, si llega, va en su propia spec._
