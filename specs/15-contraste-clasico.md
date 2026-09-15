# SPEC 15 — Corrección de contraste de la skin `clasico`

> **Status:** Approved
> **Depends on:** SPEC 13 (skins de `bloque-buster`, que monta el teñido de sprites), SPEC 14 (skins de `serpentina`, que monta el teñido perezoso de frutas), SPEC 10 (contrato de skins)
> **Date:** 2026-09-15
> **Objective:** Levantar por encima del suelo WCAG de 4.5:1 las seis superficies de la skin `clasico` que hoy quedan por debajo, aceptando de forma explícita que `clasico` deja de reproducir píxel a píxel lo que el juego pinta hoy.

> ⚠️ **Esta spec rompe la invariante de `clasico`.**

Las SPEC 11, 12, 13 y 14 se apoyan todas en la misma regla: **`clasico` reproduce exactamente lo que el juego pinta hoy.** Es lo que hace verificable el grupo «No regresión de clásico» de cada una de ellas.

**Esta spec rompe esa regla a propósito, y solo en seis superficies concretas.** No es un descuido ni un efecto colateral: es la decisión que el usuario tomó tras leer la auditoría de contraste. El resto de `clasico` —en los cuatro juegos— sigue intacto.

Léase entero el apartado `## Decisiones` antes de implementar.

## Alcance

**Dentro:**

- **`app/_components/games/ArkanoidGame.tsx`.** Tres colores de bloque de la skin `clasico` dejan de blitarse desde el PNG sin transformar y pasan por el mismo teñido de `source-atop` que la SPEC 13 monta para `neon` y `retro`: `block_gray` (**1.65:1** contra `#000`), `block_magenta` (**3.24:1**) y `block_red` (**3.64:1**).
- **`app/_components/games/SnakeGame.tsx`.** Tres recortes de fruta de la skin `clasico` dejan de blitarse desde la `HTMLImageElement` original y pasan por el mismo teñido perezoso con caché que la SPEC 14 monta para `neon` y `retro`: `sx=540` (**2.87:1** contra `#000`), `sx=1066` (**3.23:1**) y `sx=1228` (**3.60:1**).
- **El mecanismo ya existe.** Esta spec **no** inventa ninguna pieza nueva: reutiliza el `tints`/`tintAlpha` de la SPEC 13 y el `fruitTint`/`fruitTintAlpha` de la SPEC 14, cambiando su tipo para que admitan una corrección parcial en `clasico`.
- **Los PNG no se tocan.** Ni `public/games/arkanoid/spritesheet-breakout.png` ni `public/games/snake/fruits.png` se editan, se regeneran ni se sustituyen. La corrección es en tiempo de carga, en canvas, y se puede revertir borrando seis entradas de un objeto.
- **Una nota en el código, junto a cada corrección**, que diga qué superficie deja de reproducir el estado original, cuál era su ratio y cuál es el nuevo, y que remita a esta spec.
- **No regresión explícita**: los cuatro ids que hoy están en `app/_components/games/registry.ts` — `rocas`, `caida`, `bloque-buster` y `serpentina` — siguen jugándose igual en mecánica, puntuación y HUD. El testigo mock es **`/juegos/duelo-pixel/jugar`**, un id sin entrada en el registro, que conserva su mock y no muestra selector.

**Fuera de alcance (para futuras specs):**

- **Cualquier otra superficie de `clasico`.** Las seis de esta spec son exactamente las que la auditoría midió por debajo de 4.5:1. Ninguna otra se toca: ni las otras cuatro de `bloque-buster`, ni las otras diecinueve frutas, ni nada de `rocas` ni de `caida`.
- **El tinte del tablero de `caida` a 1.03:1.** Queda por debajo del piso de decorado, no por encima del techo: el riesgo es que no se vea, no que tape el juego. No afecta a la legibilidad de ninguna entidad y se deja como está.
- **Los pares entre entidades que se resuelven por excepción de forma.** Las tres specs de skins los declararon uno a uno; esta no los revisa.
- **Cambiar la identidad de color de ninguna pieza.** Un ladrillo rojo sigue siendo rojo y una fruta morada sigue siendo morada: la corrección es de brillo, no de matiz.
- **Redibujar entidades con primitivas vectoriales.**
- **Skins adicionales, skin por usuario en Supabase, teñido del chrome, audio por skin.**
- **Tests.** Sigue sin haber runner en el proyecto.

## Modelo de datos

### (a) Contrato con la plataforma

Esta spec **no toca el contrato**. No cambia `app/_components/games/skins.ts`, no cambia `PlayableGameProps` de `app/_components/games/types.ts`, no cambia `app/_components/GamePlayerScreen.tsx` ni su módulo CSS, y no añade ni quita métodos al `GameController` de ningún juego.

`SkinId`, `SKIN_IDS`, `DEFAULT_SKIN`, `SKIN_LABELS` e `isSkinId` siguen exactamente como están.

**Cambiar de skin sigue sin reiniciar la partida.** El `setSkin()` de `ArkanoidGame.tsx` y el de `SnakeGame.tsx` siguen siendo los que montan la SPEC 13 y la SPEC 14: reasignan la paleta activa y repintan, sin tocar estado de partida, y se propagan desde un `useEffect` aparte con `skin` como única dependencia. Esta spec solo cambia **el contenido** de la entrada `clasico` de sus registros de paletas.

El único cambio de tipo es el que permite una corrección parcial:

```ts
// ArkanoidGame.tsx — antes (SPEC 13): `null` significaba «no tocar nada».
tints: Record<SpriteTintKey, string> | null;

// después (SPEC 15): un objeto parcial. `clasico` corrige tres claves y deja
// las otras seis sin tinte; `neon` y `retro` siguen declarando las nueve.
tints: Partial<Record<SpriteTintKey, string>>;
```

```ts
// SnakeGame.tsx — antes (SPEC 14): un tinte único para las 22 frutas.
fruitTint: string | null;

// después (SPEC 15): un tinte por defecto más excepciones por índice de FRUITS.
fruitTint: string | null;
fruitTintByIndex?: Record<number, { tint: string; alpha: number }>;
```

### (b) Las seis correcciones

Todas usan el mismo `source-atop` de las SPEC 13 y 14, con lo que el color de salida de un píxel es `P·(1−α) + C·α`. Los ratios de abajo salen de aplicar esa fórmula al color dominante —en `bloque-buster`— o medio —en `serpentina`— muestreado del PNG, y de pasar el resultado por el script WCAG.

#### `bloque-buster` — tres bloques de `clasico`

| Superficie      | Hoy       | Ratio hoy  | Color de realce | α    | Resultado | Ratio nuevo | Suelo | ✅  |
| --------------- | --------- | ---------- | --------------- | ---- | --------- | ----------- | ----- | --- |
| `block_gray`    | `#323142` | **1.65:1** | `#a8b2d6`       | 0.55 | `#737893` | **4.84:1**  | ≥4.5  | ✅  |
| `block_magenta` | `#632ff4` | **3.24:1** | `#b98fff`       | 0.40 | `#8555f8` | **4.65:1**  | ≥4.5  | ✅  |
| `block_red`     | `#c02a3e` | **3.64:1** | `#ef7b8b`       | 0.30 | `#ce4255` | **4.53:1**  | ≥4.5  | ✅  |

Los tres alphas son **el mínimo que cruza el suelo**, ajustados y recalculados uno a uno: con 0.50, `block_gray` se quedaba en 4.44:1; con 0.35, `block_magenta` en 4.47:1; con 0.25, `block_red` en 4.38:1.

`#ef7b8b` no es un color inventado: es **el segundo color más frecuente dentro del propio sprite de `block_red`**, su brillo de bisel. Realzar el bloque con su propia luz es lo que menos altera su identidad.

Las seis superficies restantes de `clasico` en este juego —pala, pelota, `block_cyan`, `block_yellow`, `block_green` y `block_hotpink`— **no se tocan**: ya pasaban el suelo, y siguen sin pasar por el pipeline de tinte.

| Superficie sin tocar | Color     | Fondo     | Ratio       | Suelo | ✅  |
| -------------------- | --------- | --------- | ----------- | ----- | --- |
| Pala                 | `#babac5` | `#000000` | **10.92:1** | ≥4.5  | ✅  |
| Pelota               | `#babac5` | `#000000` | **10.92:1** | ≥4.5  | ✅  |
| `block_cyan`         | `#4fc99c` | `#000000` | **10.17:1** | ≥4.5  | ✅  |
| `block_yellow`       | `#d9bd4c` | `#000000` | **11.33:1** | ≥4.5  | ✅  |
| `block_green`        | `#44aaf3` | `#000000` | **8.29:1**  | ≥4.5  | ✅  |
| `block_hotpink`      | `#fc7d1c` | `#000000` | **8.09:1**  | ≥4.5  | ✅  |

Par que sigue importando —**pelota contra el bloque corregido más parecido**, para no perder la pelota al tunelar:

| Par                                        | Ratio      | Suelo | ✅  |
| ------------------------------------------ | ---------- | ----- | --- |
| Pelota `#babac5` vs `block_gray` `#737893` | **2.26:1** | ≥1.5  | ✅  |
| Pelota `#babac5` vs `block_red` `#ce4255`  | **2.41:1** | ≥1.5  | ✅  |

El realce **mejora** ese par respecto al estado actual, donde la pelota contra `block_gray` estaba a 6.60:1 pero el bloque era casi invisible contra el fondo: la pelota se distinguía del bloque porque el bloque no se veía.

#### `serpentina` — tres frutas de `clasico`

| Superficie      | Color medio hoy | Ratio hoy  | Color de realce | α    | Resultado | Ratio nuevo | Suelo | ✅  |
| --------------- | --------------- | ---------- | --------------- | ---- | --------- | ----------- | ----- | --- |
| Fruta `sx=540`  | `#8c259e`       | **2.87:1** | `#d9b8e8`       | 0.35 | `#a758b8` | **4.73:1**  | ≥4.5  | ✅  |
| Fruta `sx=1066` | `#8c3c9a`       | **3.23:1** | `#d9b8e8`       | 0.25 | `#9f5bae` | **4.58:1**  | ≥4.5  | ✅  |
| Fruta `sx=1228` | `#b7390b`       | **3.60:1** | `#f0a877`       | 0.25 | `#c55526` | **4.70:1**  | ≥4.5  | ✅  |

Los tres alphas son el mínimo que cruza el suelo: con 0.30 la fruta `sx=540` se quedaba en 4.39:1, y con 0.20 la `sx=1228` en 4.43:1.

Los dos colores de realce respetan el matiz de su fruta: `#d9b8e8` es un lila claro para las dos frutas moradas y `#f0a877` un naranja claro para la roja. **Ninguna cambia de familia de color.**

Las diecinueve frutas restantes **no se tocan**: ya pasaban el suelo, de 4.86:1 la más floja de ellas a 13.56:1 la más clara.

El resto de la mitad vectorial de `serpentina` en `clasico` queda **exactamente como está**:

| Superficie sin tocar | Color     | Fondo     | Ratio       | Suelo   | ✅  |
| -------------------- | --------- | --------- | ----------- | ------- | --- |
| Cabeza               | `#00ff88` | `#000000` | **15.66:1** | ≥4.5    | ✅  |
| Cuerpo               | `#00cc6a` | `#000000` | **9.85:1**  | ≥4.5    | ✅  |
| Cabeza vs cuerpo     | —         | —         | **1.59:1**  | ≥1.5    | ✅  |
| Rejilla              | `#141827` | `#000000` | **1.19:1**  | 1.1–2.5 | ✅  |

### (c) Persistencia

- **Sin cambios.** Las claves `av-skin-bloque-buster` y `av-skin-serpentina` siguen como las dejó la SPEC 10: lectura en efecto, validación con `isSkinId`, salida a `clasico` y acceso en `try/catch`.
- **La caché de frutas teñidas de la SPEC 14 pasa a tener entradas con clave `clasico:540`, `clasico:1066` y `clasico:1228`.** Sigue viviendo dentro de `createGame` y muriendo con el desmontaje. No se persiste nada.
- **Sin migración.** No se crea nada en `supabase/migrations/`, no se toca `public.games` y no se llama a ningún MCP de escritura.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Abrir el tipo `tints` de `bloque-buster` a un objeto parcial

En `app/_components/games/ArkanoidGame.tsx`, cambiar `tints: Record<SpriteTintKey, string> | null` por `tints: Partial<Record<SpriteTintKey, string>>`. `clasico` pasa de `tints: null` a `tints: {}`, y el generador de hojas recorre las claves presentes en vez de ramificar por `null`. **Sin añadir todavía ninguna clave a `clasico`.**

_Verificación:_ el juego se ve idéntico en las tres skins, `npx tsc --noEmit` y `npm run lint` pasan.

### 2. Realzar los tres bloques de `clasico`

Añadir a `clasico.tints` las tres claves `gray: "#a8b2d6"`, `magenta: "#b98fff"` y `red: "#ef7b8b"`, con su alpha por clave —0.55, 0.40 y 0.30—, lo que obliga a que `tintAlpha` pase a ser un alpha por clave y no uno global. Escribir al lado la nota que dice qué deja de reproducirse y remite a esta spec.

_Verificación:_ en `/juegos/bloque-buster/jugar` con `clasico`, los ladrillos grises del nivel 2 se ven contra el fondo; la pala, la pelota y los otros cuatro colores de bloque no han cambiado.

### 3. Realzar la explosión de los bloques corregidos

Los cuatro frames de explosión comparten fila con su bloque, así que el realce abarca **la fila entera**: `gray` reutiliza la fila de `red`, de modo que el realce de `red` la cubre. La fila de `magenta` se realza con su misma clave.

_Verificación:_ romper un ladrillo gris, uno morado y uno rojo en `clasico` produce una explosión del mismo brillo que el ladrillo, no un destello del color original.

### 4. Abrir el tinte de fruta de `serpentina` a excepciones por índice

En `app/_components/games/SnakeGame.tsx`, añadir el campo opcional `fruitTintByIndex` a `Palette`. `tintedFruit(index, skin)` consulta primero esa tabla y, si no hay entrada, cae al `fruitTint` global de la skin. **Sin añadir todavía ninguna entrada a `clasico`.**

_Verificación:_ el juego se ve idéntico en las tres skins, `npx tsc --noEmit` y `npm run lint` pasan.

### 5. Realzar las tres frutas oscuras de `clasico`

Añadir a `clasico.fruitTintByIndex` las tres entradas correspondientes a los recortes `sx=540`, `sx=1066` y `sx=1228` de `FRUITS`, con su color y su alpha. Escribir al lado la nota que dice qué deja de reproducirse y remite a esta spec.

_Verificación:_ en `/juegos/serpentina/jugar` con `clasico`, esas tres frutas se ven desde el otro extremo del tablero; las otras diecinueve no han cambiado.

### 6. Prueba manual de extremo a extremo

Una persona, en el navegador: en `/juegos/bloque-buster/jugar` con `clasico`, jugar el nivel 2 entero —el que trae la fila gris— y comprobar que ningún ladrillo desaparece contra el fondo; recorrer las tres skins y volver a `clasico`. En `/juegos/serpentina/jugar` con `clasico`, comer frutas hasta que salgan las tres corregidas y comprobar que se ven; recorrer las tres skins y volver a `clasico`. Comprobar que `/juegos/rocas/jugar` y `/juegos/caida/jugar` no han cambiado en ninguna de sus tres skins, y que `/juegos/duelo-pixel/jugar` conserva su mock.

_Verificación:_ ningún paso reinicia la partida, ninguna entidad cambia de familia de color y la consola del navegador queda limpia.

### 7. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas previas en 200: `/`, `/biblioteca`, `/juegos/bloque-buster`, `/juegos/serpentina`, `/salon`, `/about`, `/auth`.

_Verificación:_ los tres comandos terminan en verde y las siete rutas responden 200.

### Apuntes sobre el orden

- Los pasos 1 y 4 abren el tipo sin cambiar nada visible, y se commitean solos: así el cambio de forma del registro de paletas queda separado del cambio de aspecto, y si algo se ve raro se sabe cuál de los dos lo causó.
- El paso 2 obliga a convertir `tintAlpha` en un alpha por clave. Es el motivo por el que el paso 1 no puede llevar ya las tres claves dentro: son dos cambios de tipo distintos y conviene verlos por separado en el diff.
- El paso 3 va justo detrás del 2 porque una explosión con el color viejo sobre un ladrillo realzado es el fallo más fácil de dejar pasar: el frame dura 150 ms.
- `bloque-buster` va entero antes que `serpentina` porque su mecanismo —hojas completas generadas al cargar— es el más rígido de los dos; si el tipo parcial no encaja ahí, encaja en cualquier sitio.
- La prueba manual va antes de la pasada final para que los fallos de aspecto se arreglen antes de firmar el build.

## Criterios de aceptación

### Lo que `clasico` deja de reproducir

- [ ] Con la skin `clasico` de `bloque-buster`, `block_gray` se pinta realzado con `#a8b2d6` a alpha 0.55 y **ya no** con el color original del PNG.
- [ ] Con la skin `clasico` de `bloque-buster`, `block_magenta` se pinta realzado con `#b98fff` a alpha 0.40 y **ya no** con el color original del PNG.
- [ ] Con la skin `clasico` de `bloque-buster`, `block_red` se pinta realzado con `#ef7b8b` a alpha 0.30 y **ya no** con el color original del PNG.
- [ ] Con la skin `clasico` de `serpentina`, el recorte `sx=540` se pinta realzado con `#d9b8e8` a alpha 0.35 y **ya no** con el color original del PNG.
- [ ] Con la skin `clasico` de `serpentina`, el recorte `sx=1066` se pinta realzado con `#d9b8e8` a alpha 0.25 y **ya no** con el color original del PNG.
- [ ] Con la skin `clasico` de `serpentina`, el recorte `sx=1228` se pinta realzado con `#f0a877` a alpha 0.25 y **ya no** con el color original del PNG.
- [ ] Junto a cada una de las seis correcciones hay una nota en el código que cita su ratio anterior, su ratio nuevo y esta spec.

### Lo que `clasico` sigue reproduciendo exactamente

- [ ] Con la skin `clasico` de `bloque-buster`, la pala y la pelota se pintan desde el PNG sin ningún tinte.
- [ ] Con la skin `clasico` de `bloque-buster`, `block_cyan`, `block_yellow`, `block_green` y `block_hotpink` se pintan desde el PNG sin ningún tinte.
- [ ] Con la skin `clasico` de `bloque-buster`, el fondo del lienzo sigue siendo `#000`.
- [ ] Con la skin `clasico` de `serpentina`, las otras diecinueve frutas se blitan desde la `HTMLImageElement` original, sin canvas teñido.
- [ ] Con la skin `clasico` de `serpentina`, el fondo sigue siendo `#000`, la rejilla `#141827`, la cabeza `#00ff88`, el cuerpo `#00cc6a`, los ojos `#000` y el rombo de reserva `#00ff88`.
- [ ] La skin `clasico` de `rocas` sigue pintando nave `#fff`, asteroides `#fff`, balas `#fff`, power-up `#0ff`, llama `rgba(255, 130, 0, 0.85)` y fondo `#000`.
- [ ] La skin `clasico` de `caida` sigue pintando las siete piezas con `#4dd0e1`, `#ffd54f`, `#ba68c8`, `#81c784`, `#e57373`, `#90caf9` y `#ffb74d`, y su decorado con los cuatro valores de siempre.
- [ ] `public/games/arkanoid/spritesheet-breakout.png` y `public/games/snake/fruits.png` no se modifican: `git diff --stat` no los menciona.

### Contraste

- [ ] `block_gray` de `clasico` sube de **1.65:1** a **4.84:1** contra `#000000`.
- [ ] `block_magenta` de `clasico` sube de **3.24:1** a **4.65:1** contra `#000000`.
- [ ] `block_red` de `clasico` sube de **3.64:1** a **4.53:1** contra `#000000`.
- [ ] La fruta `sx=540` de `clasico` sube de **2.87:1** a **4.73:1** contra `#000000`.
- [ ] La fruta `sx=1066` de `clasico` sube de **3.23:1** a **4.58:1** contra `#000000`.
- [ ] La fruta `sx=1228` de `clasico` sube de **3.60:1** a **4.70:1** contra `#000000`.
- [ ] Las seis superficies corregidas pasan el suelo de 4.5:1; ninguna de las seis lo supera por más de 0.5, porque el realce es el mínimo que cruza.
- [ ] La pelota de `clasico` contrasta **2.26:1** contra `block_gray` realzado y **2.41:1** contra `block_red` realzado: los dos pasan el suelo de 1.5:1.
- [ ] Ninguna superficie que ya pasaba el suelo se ha tocado: los seis ratios de la tabla «Superficie sin tocar» de `bloque-buster` son los mismos de antes de esta spec.

### Identidad de color

- [ ] `block_red` sigue leyéndose como rojo, `block_magenta` como morado y `block_gray` como gris azulado: ninguno cambia de familia de color.
- [ ] Las frutas `sx=540` y `sx=1066` siguen leyéndose como moradas y la `sx=1228` como roja anaranjada.
- [ ] El bisel de relieve de los tres bloques realzados sigue siendo visible: el realce no los aplana en una silueta lisa.
- [ ] Las tres frutas realzadas conservan su recorte: no aparece ningún halo rectangular alrededor.

### Las tres skins y el cambio en caliente

- [ ] `neon` y `retro` de `bloque-buster` y de `serpentina` pintan exactamente los mismos colores que declaran la SPEC 13 y la SPEC 14: esta spec no las toca.
- [ ] Cambiar de skin con una partida en curso en `bloque-buster` o en `serpentina` sigue conservando puntuación, vidas y posición de las entidades: no reinicia.
- [ ] En `ArkanoidGame.tsx` y en `SnakeGame.tsx`, `skin` sigue sin aparecer en el array de dependencias del efecto de montaje.
- [ ] El cambio de skin sigue sin producir ningún tirón visible en ninguno de los dos juegos.

### No regresión

- [ ] `rocas` y `caida` no se tocan: `git diff app/_components/games/AsteroidsGame.tsx` y `git diff app/_components/games/TetrisGame.tsx` no devuelven ninguna línea.
- [ ] `/juegos/duelo-pixel/jugar` conserva su mock y no muestra selector de skin.
- [ ] `git diff app/globals.css` no devuelve ninguna línea.
- [ ] `git diff app/_components/games/skins.ts`, `git diff app/_components/games/types.ts` y `git diff app/_components/GamePlayerScreen.tsx` no devuelven ninguna línea.
- [ ] `bloque-buster` y `serpentina` conservan mecánica, puntuación, HUD, pausa, reinicio y guardado real de puntuación.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.

## Decisiones

- **Esta spec rompe la invariante «`clasico` reproduce exactamente lo que el juego pinta hoy». Lo hace a propósito y el usuario lo aceptó.** Qué deja de reproducir, exactamente: tres de los nueve sprites de `bloque-buster` (`block_gray`, `block_magenta` y `block_red`, con sus filas de explosión) y tres de los veintidós recortes de `serpentina` (`sx=540`, `sx=1066` y `sx=1228`). Nada más. **Por qué se aceptó:** un ladrillo a 1.65:1 sobre negro es invisible en un monitor mal calibrado o con luz ambiente, y una fruta a 2.87:1 obliga a buscarla en un juego que se gana viéndola rápido. La invariante existe para impedir que una spec de skins degrade el juego por descuido, no para congelar un defecto de legibilidad que la propia auditoría midió. Se rompe una vez, en una spec que no hace nada más, y queda escrito en su título y en su primer apartado.
- **La corrección va en tiempo de carga, en canvas. No editando los PNG.** Los assets se quedan como están, y revertir esta spec es borrar seis entradas de dos objetos. Si se editaran los PNG, `clasico` dejaría de poder volver a su estado original sin recuperar un binario de git.
- **El realce es el mínimo alpha que cruza el suelo de 4.5:1, y está calculado, no estimado.** Los seis valores se ajustaron y recalcularon con el script WCAG hasta cruzar: 0.50 dejaba `block_gray` en 4.44:1, 0.35 dejaba `block_magenta` en 4.47:1, 0.25 dejaba `block_red` en 4.38:1, 0.30 dejaba la fruta `sx=540` en 4.39:1 y 0.20 dejaba la `sx=1228` en 4.43:1. Realzar de más habría sido convertir `clasico` en una cuarta skin.
- **El color de realce respeta el matiz de cada pieza. No unifica nada.** Un ladrillo rojo se realza con `#ef7b8b`, que es **su propio brillo de bisel** —el segundo color más frecuente dentro de ese sprite—; las dos frutas moradas con un lila claro y la roja con un naranja claro. Ninguna pieza cambia de familia de color, y hay un grupo de criterios entero para comprobarlo.
- **El realce abarca la fila entera de cada bloque corregido, no solo su recorte.** Los cuatro frames de explosión comparten fila; realzando solo el bloque, un ladrillo gris aclarado estallaría con el destello oscuro original durante los 150 ms de la animación.
- **`tints` pasa de `Record | null` a `Partial<Record>` y `tintAlpha` de global a por clave.** Es lo que permite que `clasico` corrija tres claves y deje las otras seis intactas. Con el tipo de la SPEC 13, corregir una sola clave obligaba a declarar las nueve, y `clasico` habría acabado tiñendo la pala y la pelota sin necesidad.
- **`serpentina` usa una tabla de excepciones por índice, no un tinte global para `clasico`.** Un `fruitTint` global aplicado a `clasico` habría teñido las veintidós frutas, incluidas las diecinueve que ya pasaban el suelo: sería una skin nueva disfrazada de corrección.
- **El tinte del tablero de `caida` a 1.03:1 NO se corrige.** Queda por debajo del piso de decorado, no por encima del techo: el problema es que casi no se ve, no que compita con las piezas. Ninguna entidad jugable depende de él y las siete piezas pasan el suelo de sobra contra ese mismo tablero.
- **`rocas` y `caida` no se abren en esta spec.** Sus `clasico` no tienen ninguna superficie por debajo del suelo de 4.5:1, así que tocarlos sería romper la invariante sin nada que ganar. Hay un criterio que exige que su `git diff` esté vacío.
- **Esta spec depende de la 13 y de la 14, y va después de las dos.** Reutiliza el pipeline de teñido de sprites que monta la 13 y el teñido perezoso con caché que monta la 14: sin ellas tendría que construir las dos piezas desde cero, y entonces no sería una corrección de contraste sino otra spec de skins.
- **Exclusión deliberada de cualquier otra superficie.** Las seis de esta spec son exactamente las que la auditoría midió por debajo de 4.5:1. Ampliar la lista «ya que estamos» convertiría una corrección acotada en un rediseño.

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| El realce se extiende a superficies que ya pasaban el suelo                 | `tints` y `fruitTintByIndex` son parciales; grupo entero «Lo que `clasico` sigue reproduciendo exactamente»               |
| Una pieza cambia de familia de color y deja de parecer la de siempre        | Color de realce del mismo matiz, en un caso el propio bisel del sprite; grupo «Identidad de color»                        |
| El realce aplana el sprite y se pierde el bisel                             | `source-atop` con el alpha mínimo que cruza el suelo; criterio visual del bisel                                           |
| La explosión sale con el color viejo sobre un ladrillo realzado             | El realce abarca la fila entera, paso 3; criterio de explosión del mismo brillo que el ladrillo                           |
| Se realza de más y `clasico` acaba pareciendo una cuarta skin               | Alpha mínimo calculado con el script; criterio de que ninguno supera el suelo por más de 0.5                              |
| Romper la invariante aquí se toma como permiso para romperla en otras specs | Título, primer apartado y `## Decisiones` la acotan a seis superficies; criterio de `git diff` vacío en `rocas` y `caida` |
| Cambiar el tipo de `tints` rompe las paletas `neon` y `retro` de la SPEC 13 | `Partial<Record>` admite las nueve claves que ya declaran; criterio de que `neon` y `retro` no cambian                    |
| `skin` en las deps del efecto de montaje reinicia la partida                | Los efectos de la SPEC 13 y la SPEC 14 no se tocan; criterio de dependencia única mantenido                               |
| La corrección se aplica en cada frame y degrada la fluidez                  | Reutiliza el teñido al cargar de la SPEC 13 y el perezoso cacheado de la SPEC 14; criterio de cambio sin tirón            |
| Editar los PNG haría irreversible la corrección                             | La corrección es en canvas; criterio de `git diff --stat` sin los dos PNG                                                 |
| Nadie recuerda dentro de seis meses por qué `clasico` no es el original     | Nota en el código junto a cada una de las seis correcciones, con ratios y referencia a esta spec                          |

## Lo que **no** entra en esta spec

- **Cualquier superficie de `clasico` distinta de las seis nombradas.** Ni las otras cuatro de `bloque-buster`, ni las otras diecinueve frutas de `serpentina`, ni nada de `rocas` ni de `caida`.
- **El tinte del tablero de `caida` a 1.03:1.** Queda por debajo del piso de decorado y no afecta a la legibilidad de ninguna entidad.
- **Los pares entre entidades resueltos por excepción de forma.** Las SPEC 12, 13 y 14 los declararon uno a uno.
- **Cambiar la identidad de color de ninguna pieza.** La corrección es de brillo, no de matiz.
- **Cambios en las skins `neon` y `retro`.** Son las de la SPEC 13 y la SPEC 14 y quedan intactas.
- **Modificar, regenerar o sustituir `public/games/arkanoid/spritesheet-breakout.png` o `public/games/snake/fruits.png`.**
- **Cambios en `app/_components/games/skins.ts`, `types.ts`, `GamePlayerScreen.tsx`, `GamePlayerScreen.module.css` o `app/globals.css`.**
- **Redibujar entidades con primitivas vectoriales.**
- **Skins adicionales más allá de las tres.**
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.**
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.**

_Cada uno de esos, si llega, va en su propia spec._
