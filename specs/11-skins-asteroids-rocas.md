# SPEC 11 — Skins clásico, neón y retro de Asteroids (`rocas`)

> **Status:** Approved
> **Depends on:** SPEC 10 (contrato de skins), SPEC 05 (contrato de juego y registro), SPEC 07 (extracción de `types.ts`)
> **Date:** 2026-09-05
> **Objective:** Dar a `rocas` las tres skins obligatorias extrayendo antes sus colores literales a un registro de paletas, sin que la skin `clasico` cambie ni un píxel.

## Alcance

**Dentro:**

- **`app/_components/games/AsteroidsGame.tsx`** y su paleta por skin. Es el único fichero de juego que se toca.
- **Consumo del contrato de la SPEC 10, sin recrearlo.** `SkinId`, `SKIN_IDS` y `DEFAULT_SKIN` se importan de `app/_components/games/skins.ts`; el campo `skin?: SkinId` ya existe en `PlayableGameProps`, y el selector del HUD y la persistencia en `localStorage` ya están montados. Esta spec no añade nada a ninguno de los tres.
- **Paso previo de extracción de literales.** `rocas` es un caso de literales sueltos: los ocho colores están escritos dentro de las llamadas de dibujo (`AsteroidsGame.tsx:114`, `:177`, `:227`, `:232`, `:319`, `:338`, `:378` y `:655`). El primer paso los saca a un objeto de paleta **sin cambiar ni un valor**, y se commitea solo.
- **Las tres paletas** en el módulo del juego, como un `Record<SkinId, Palette>`. `clasico` copia literalmente los valores actuales.
- **`setSkin(next: SkinId)` en el `GameController`** que devuelve `createGame`, junto a `start`, `stop`, `restart` y `setPaused` (`AsteroidsGame.tsx:747`). Reasigna la paleta activa y repinta el frame; **no toca ni una sola variable de estado de partida**.
- **Un `useEffect` aparte** en el componente React que propaga `skin` llamando a `setSkin()`, con `skin` como única dependencia. Es el mismo patrón que el efecto de `paused`.
- **Ocho superficies pintables**, todas vectoriales: fondo del canvas, nave, llama del propulsor, asteroides (los tres tamaños comparten color), bala, marco del power-up, texto `"3x"` del power-up y partículas de explosión.
- **Halo solo en `neon`**, con `shadowBlur` y `shadowColor` igual al color del trazo. `clasico` y `retro` no llevan halo.
- **No regresión explícita**: los otros tres ids que hoy están en `app/_components/games/registry.ts` — `caida`, `bloque-buster` y `serpentina` — siguen pintando exactamente igual, porque no se tocan sus ficheros. El testigo mock es **`/juegos/invasores/jugar`**, que conserva su ticker de score falso y su toast.

**Fuera de alcance (para futuras specs):**

- **Skins de los otros tres juegos registrados.** `caida` tiene sus colores en constantes con nombre, `bloque-buster` pinta desde `public/games/arkanoid/spritesheet-breakout.png` y `serpentina` mezcla vectores con `public/games/snake/fruits.png`. Cada estrategia es distinta y merece su propia spec.
- **Skins adicionales más allá de las tres.** El contrato de la SPEC 10 cierra `SKIN_IDS` en tres entradas.
- **Skin por usuario en Supabase.** La preferencia es local del navegador; no se toca `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma y son iguales para las tres skins.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`. No tienen canvas que vestir.
- **Campo de estrellas, rejilla o cualquier decorado nuevo.** Asteroids no pinta hoy ninguna superficie de decorado, y las skins solo recolorean lo que ya existe: así las tres comparten geometría exacta y la no regresión de `clasico` se puede verificar mirando solo los colores.
- **Cambiar la silueta de las entidades por skin.** El triángulo de la nave, el polígono de los asteroides y el rombo del power-up son los mismos en las tres.
- **Corregir el 1.00:1 entre entidades de la skin `clasico`.** Es un hallazgo documentado en `## Decisiones`; `clasico` es el estado actual y es intocable.
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.** Sigue sin haber runner en el proyecto.

## Modelo de datos

### (a) Contrato con la plataforma

El juego importa el contrato de la SPEC 10 y no define nada propio:

```ts
import { DEFAULT_SKIN, type SkinId } from "./skins";
```

`skin` llega como prop opcional de `PlayableGameProps`, ya declarada por la SPEC 10. `GamePlayerScreen` la gobierna con el selector del HUD y la persiste en `av-skin-rocas`.

**Cambiar de skin no reinicia la partida.** El `GameController` de `createGame` gana un quinto método, `setSkin(next: SkinId)`, que solo reasigna la paleta activa del closure y llama a `draw()` para repintar el frame en curso. No toca `ship`, `asteroids`, `bullets`, `powerUps`, `particles`, `score`, `lives` ni `level`. El componente lo propaga desde un **`useEffect` aparte**, exactamente como el que ya existe para `paused`:

```ts
// `skin` NUNCA entra en las deps del efecto de montaje: si entrase, cada
// cambio de skin destruiría y recrearía el juego, y el jugador perdería la
// partida al tocar el selector.
useEffect(() => {
  gameRef.current?.setSkin(skin ?? DEFAULT_SKIN);
}, [skin]);
```

La paleta activa se lee en el momento de dibujar, no se captura al construir las entidades: `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle` reciben la paleta como argumento de su `draw(ctx, palette)`. Así una entidad creada antes del cambio de skin se pinta ya con la piel nueva en el frame siguiente.

Forma del registro de paletas:

```ts
type Palette = {
  background: string;
  ship: string;
  thrust: string; // se pinta con alpha 0.85, como hoy
  asteroid: string;
  bullet: string;
  powerUp: string; // marco rotado y texto "3x"
  particle: string; // se pinta con el alpha de desvanecimiento
  glow: number; // shadowBlur; 0 en clasico y retro
};

const PALETTES: Record<SkinId, Palette> = { clasico, neon, retro };
```

### (b) Las tres paletas

Las ocho superficies pintables de `rocas` y su origen actual, comprobado con `grep`:

| #   | Superficie                    | Dónde hoy              | Valor actual                 |
| --- | ----------------------------- | ---------------------- | ---------------------------- |
| 1   | Fondo del canvas              | `draw()` `:655`        | `#000`                       |
| 2   | Nave (triángulo con muesca)   | `Ship.draw` `:319`     | `#fff`                       |
| 3   | Llama del propulsor           | `Ship.draw` `:338`     | `rgba(255, 130, 0, 0.85)`    |
| 4   | Asteroides (tamaños 1, 2 y 3) | `Asteroid.draw` `:177` | `#fff`                       |
| 5   | Bala (disco de radio 2)       | `Bullet.draw` `:114`   | `#fff`                       |
| 6   | Power-up: marco rotado 45°    | `PowerUp.draw` `:227`  | `#0ff`                       |
| 7   | Power-up: texto `"3x"`        | `PowerUp.draw` `:232`  | `#0ff`                       |
| 8   | Partículas de explosión       | `Particle.draw` `:378` | `rgba(255,255,255,${alpha})` |

`rocas` **no pinta ninguna superficie de decorado**: no hay estrellas, ni rejilla, ni tinte de tablero, ni bordes de panel. La banda de 1.1:1 – 2.5:1 no aplica a este juego.

#### `clasico` — la skin por defecto

```ts
const clasico: Palette = {
  background: "#000",
  ship: "#fff",
  thrust: "rgba(255, 130, 0, 0.85)",
  asteroid: "#fff",
  bullet: "#fff",
  powerUp: "#0ff",
  particle: "255,255,255", // se compone como rgba(255,255,255,${alpha})
  glow: 0,
};
```

Son **los valores literales que el fichero tiene hoy**, copiados uno a uno de las líneas de la tabla de arriba. Ninguno se ajusta, se normaliza ni se expande a seis dígitos en el resultado pintado.

| Skin      | Entidad         | Color                             | Fondo     | Ratio       | Suelo | ✅  |
| --------- | --------------- | --------------------------------- | --------- | ----------- | ----- | --- |
| `clasico` | Nave            | `#fff`                            | `#000000` | **21.00:1** | ≥4.5  | ✅  |
| `clasico` | Asteroides      | `#fff`                            | `#000000` | **21.00:1** | ≥4.5  | ✅  |
| `clasico` | Bala            | `#fff`                            | `#000000` | **21.00:1** | ≥4.5  | ✅  |
| `clasico` | Partícula       | `#fff` (alpha 1)                  | `#000000` | **21.00:1** | ≥4.5  | ✅  |
| `clasico` | Power-up + `3x` | `#0ff`                            | `#000000` | **16.75:1** | ≥4.5  | ✅  |
| `clasico` | Llama           | `rgba(255,130,0,.85)` = `#d96f00` | `#000000` | **6.22:1**  | ≥4.5  | ✅  |

Pares entre entidades de `clasico`:

| Par                    | Ratio      | Suelo | ✅                 |
| ---------------------- | ---------- | ----- | ------------------ |
| Nave vs asteroide      | **1.00:1** | ≥1.5  | excepción de forma |
| Bala vs nave           | **1.00:1** | ≥1.5  | excepción de forma |
| Partícula vs asteroide | **1.00:1** | ≥1.5  | excepción de forma |
| Power-up vs asteroide  | **1.25:1** | ≥1.5  | excepción de forma |
| Llama vs nave          | **2.49:1** | ≥1.5  | ✅                 |

El 1.00:1 es un **hallazgo, no un defecto a corregir en esta spec**: `clasico` reproduce el estado actual y es la red de no regresión de todo este eje. Ver `## Decisiones`.

#### `neon` — fondo `#05010f`, con halo

```ts
const neon: Palette = {
  background: "#05010f",
  ship: "#00f5ff", // token --cyan
  thrust: "rgba(255, 90, 31, 0.85)", // #ff5a1f
  asteroid: "#ff2d95", // --magenta subido para pasar el suelo de 4.5:1
  bullet: "#f5ff00", // token --yellow
  powerUp: "#ff9d00",
  particle: "168,255,240", // #a8fff0
  glow: 8,
};
```

| Skin   | Entidad         | Color                             | Fondo     | Ratio       | Suelo | ✅  |
| ------ | --------------- | --------------------------------- | --------- | ----------- | ----- | --- |
| `neon` | Nave            | `#00f5ff`                         | `#05010f` | **15.24:1** | ≥4.5  | ✅  |
| `neon` | Asteroides      | `#ff2d95`                         | `#05010f` | **5.96:1**  | ≥4.5  | ✅  |
| `neon` | Bala            | `#f5ff00`                         | `#05010f` | **18.85:1** | ≥4.5  | ✅  |
| `neon` | Power-up + `3x` | `#ff9d00`                         | `#05010f` | **9.90:1**  | ≥4.5  | ✅  |
| `neon` | Partícula       | `#a8fff0` (alpha 1)               | `#05010f` | **17.91:1** | ≥4.5  | ✅  |
| `neon` | Llama           | `rgba(255,90,31,.85)` = `#da4d1d` | `#05010f` | **4.97:1**  | ≥4.5  | ✅  |

| Par entre entidades de `neon` | Ratio      | Suelo | ✅                 |
| ----------------------------- | ---------- | ----- | ------------------ |
| Nave vs asteroide             | **2.56:1** | ≥1.5  | ✅                 |
| Bala vs asteroide             | **3.17:1** | ≥1.5  | ✅                 |
| Power-up vs asteroide         | **1.66:1** | ≥1.5  | ✅                 |
| Power-up vs nave              | **1.54:1** | ≥1.5  | ✅                 |
| Partícula vs asteroide        | **3.01:1** | ≥1.5  | ✅                 |
| Llama vs nave                 | **2.30:1** | ≥1.5  | ✅                 |
| Bala vs nave                  | **1.24:1** | ≥1.5  | excepción de forma |

El halo (`shadowBlur: 8`, `shadowColor` igual al color del trazo) solo suma brillo alrededor del núcleo: todos los ratios están calculados sobre el color del núcleo, que es lo conservador.

#### `retro` — fondo `#1a1206`, fósforo ámbar, sin halo

```ts
const retro: Palette = {
  background: "#1a1206",
  ship: "#ffdb99",
  thrust: "rgba(255, 90, 31, 0.85)", // #ff5a1f
  asteroid: "#c07a24",
  bullet: "#fff3d4",
  powerUp: "#ff9c2e",
  particle: "217,154,60", // #d99a3c
  glow: 0,
};
```

| Skin    | Entidad         | Color                             | Fondo     | Ratio       | Suelo | ✅  |
| ------- | --------------- | --------------------------------- | --------- | ----------- | ----- | --- |
| `retro` | Nave            | `#ffdb99`                         | `#1a1206` | **13.98:1** | ≥4.5  | ✅  |
| `retro` | Asteroides      | `#c07a24`                         | `#1a1206` | **5.34:1**  | ≥4.5  | ✅  |
| `retro` | Bala            | `#fff3d4`                         | `#1a1206` | **16.79:1** | ≥4.5  | ✅  |
| `retro` | Power-up + `3x` | `#ff9c2e`                         | `#1a1206` | **8.87:1**  | ≥4.5  | ✅  |
| `retro` | Partícula       | `#d99a3c` (alpha 1)               | `#1a1206` | **7.62:1**  | ≥4.5  | ✅  |
| `retro` | Llama           | `rgba(255,90,31,.85)` = `#dd4f1b` | `#1a1206` | **4.60:1**  | ≥4.5  | ✅  |

| Par entre entidades de `retro` | Ratio      | Suelo | ✅                 |
| ------------------------------ | ---------- | ----- | ------------------ |
| Nave vs asteroide              | **2.62:1** | ≥1.5  | ✅                 |
| Bala vs asteroide              | **3.14:1** | ≥1.5  | ✅                 |
| Power-up vs asteroide          | **1.66:1** | ≥1.5  | ✅                 |
| Power-up vs nave               | **1.58:1** | ≥1.5  | ✅                 |
| Llama vs nave                  | **2.35:1** | ≥1.5  | ✅                 |
| Partícula vs asteroide         | **1.43:1** | ≥1.5  | excepción de forma |
| Bala vs nave                   | **1.20:1** | ≥1.5  | excepción de forma |

Los ratios de la llama se calculan sobre el color **compuesto** sobre el fondo de su skin, porque hoy se pinta con alpha 0.85 y esa composición es lo que ve el jugador. Los de partícula se calculan a alpha 1, que es como nace la partícula antes de desvanecerse.

### (c) Persistencia

- **Clave:** `av-skin-rocas`, la que ya define la SPEC 10 como `av-skin-<game-id>`.
- **La escribe y la lee `GamePlayerScreen`, no el juego.** `AsteroidsGame.tsx` no accede a `localStorage` en ninguna línea: solo recibe la prop `skin`.
- **Lectura en efecto, nunca durante el render.** Ya resuelto por la SPEC 10; esta spec solo lo hereda y lo verifica.
- **Salida a `clasico`** si no hay valor, si el valor es desconocido o si el acceso lanza.
- **Sin migración.** No se crea nada en `supabase/migrations/`, no se toca `public.games` y no se llama a ningún MCP de escritura.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Extraer los literales a una paleta, sin cambiar ni un valor

Crear un objeto de paleta en `AsteroidsGame.tsx` con los ocho valores **exactos** de la tabla de superficies, y hacer que `Bullet.draw`, `Asteroid.draw`, `PowerUp.draw`, `Ship.draw`, `Particle.draw` y `draw()` lo reciban como argumento en vez de escribir el literal. No se introduce todavía ninguna noción de skin: hay una sola paleta y es la actual.

**Este paso se commitea solo.** Es el que hace verificable todo lo demás: si el render cambia aquí, el fallo es de la extracción y no de las paletas nuevas.

_Verificación:_ el juego se ve idéntico en `/juegos/rocas/jugar` —nave, asteroides, balas, power-up, llama y partículas— y `npx tsc --noEmit` pasa.

### 2. Definir las tres paletas

Convertir la paleta única en `const PALETTES: Record<SkinId, Palette>`, con `clasico` copiando literalmente los valores del paso 1 y `neon` y `retro` con los hex de `## Modelo de datos`. Añadir el campo `glow` y aplicarlo con `shadowBlur`/`shadowColor` solo cuando es mayor que cero. La paleta activa del closure arranca en `PALETTES[DEFAULT_SKIN]`.

_Verificación:_ sin tocar el selector, el juego sigue pintando `clasico` y se ve idéntico al paso 1.

### 3. `setSkin()` en el `GameController`

Añadir `setSkin(next: SkinId)` al objeto que devuelve `createGame` (`AsteroidsGame.tsx:747`). Reasigna la paleta activa y llama a `draw()`. No toca ninguna variable de estado de partida ni el reloj del bucle.

_Verificación:_ `npx tsc --noEmit` pasa y el `GameController` expone los cinco métodos: `start`, `stop`, `restart`, `setPaused` y `setSkin`.

### 4. El `useEffect` aparte que propaga `skin`

En el componente React, un efecto con `[skin]` como única dependencia que llama a `gameRef.current?.setSkin(skin ?? DEFAULT_SKIN)`. **`skin` no se añade a las dependencias del efecto de montaje.** El componente ya acepta la prop porque la SPEC 10 la declaró opcional en `PlayableGameProps`.

_Verificación:_ con una partida en curso y varios asteroides en pantalla, cambiar de skin en el selector cambia los colores en el frame siguiente y la puntuación, las vidas y las posiciones de las entidades siguen siendo las mismas.

### 5. Prueba manual de extremo a extremo

Una persona, en el navegador: entrar en `/juegos/rocas/jugar` y jugar hasta romper un asteroide grande y hasta que salga un power-up. Recorrer las tres skins con el selector, en juego y en pausa. Morir y reiniciar con la skin no clásica activa. Recargar la página. Salir a `/juegos/rocas` y volver a entrar. Comprobar por último que `/juegos/caida/jugar` y `/juegos/invasores/jugar` no han cambiado.

_Verificación:_ ningún paso reinicia la partida por sorpresa ni deja errores en la consola.

### 6. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas de specs anteriores en 200: `/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about`, `/auth`. Sin scroll horizontal en el `body`.

_Verificación:_ los tres comandos terminan en verde y las seis rutas responden 200.

### Apuntes sobre el orden

- La extracción del paso 1 va sola y primero porque `rocas` tiene los colores escritos dentro de las llamadas de dibujo: mezclarla con las paletas nuevas haría imposible saber si una diferencia visual viene de mover un literal o de elegir un color.
- El paso 1 no introduce `SkinId` a propósito: así se puede verificar la identidad del render antes de que exista ninguna rama por skin.
- El paso 3 va antes del 4 porque el efecto necesita un método al que llamar; al revés, el efecto llamaría a algo que no existe y la compilación fallaría.
- La paleta se pasa como argumento de `draw` y no se captura en el constructor de las entidades, para que los asteroides creados antes del cambio de skin también se repinten. Si se capturase, una partida cambiada de skin quedaría con entidades de dos pieles a la vez.
- El halo se aplica en el paso 2 junto a las paletas y no en un paso propio: es un campo más de `Palette` y su valor es cero en dos de las tres skins.
- La prueba manual va antes de la pasada final para que los fallos de comportamiento se arreglen antes de firmar el build.

## Criterios de aceptación

### No regresión de clásico

- [ ] Con la skin `clasico`, el juego pinta exactamente los mismos colores que antes de esta spec.
- [ ] La nave se pinta con `strokeStyle` `#fff` y `lineWidth` 1.5.
- [ ] Los asteroides de los tres tamaños se pintan con `strokeStyle` `#fff` y `lineWidth` 1.5.
- [ ] Las balas se pintan con `fillStyle` `#fff`.
- [ ] El marco del power-up y su texto `"3x"` se pintan con `#0ff`, con `lineWidth` 2 el marco y `bold 12px monospace` el texto.
- [ ] La llama del propulsor se pinta con `rgba(255, 130, 0, 0.85)`.
- [ ] Las partículas se pintan con `rgba(255,255,255,${alpha})`, con el mismo desvanecimiento de hoy.
- [ ] El fondo del canvas se pinta con `#000`.
- [ ] Con `clasico` no se aplica `shadowBlur` en ninguna llamada de dibujo.
- [ ] Tras el paso 1 del plan, y antes de existir ninguna skin, el juego se ve idéntico al estado anterior a esta spec.

### Las tres skins

- [ ] El selector del HUD ofrece `clasico`, `neon` y `retro` en `/juegos/rocas/jugar`.
- [ ] Con `neon`, la nave es `#00f5ff`, los asteroides `#ff2d95`, las balas `#f5ff00`, el power-up `#ff9d00`, las partículas `#a8fff0`, la llama `#ff5a1f` al 0.85 de alpha y el fondo `#05010f`.
- [ ] Con `retro`, la nave es `#ffdb99`, los asteroides `#c07a24`, las balas `#fff3d4`, el power-up `#ff9c2e`, las partículas `#d99a3c`, la llama `#ff5a1f` al 0.85 de alpha y el fondo `#1a1206`.
- [ ] El texto `"3x"` del power-up usa el mismo color que su marco en las tres skins.
- [ ] Los asteroides de tamaño 1, 2 y 3 usan el mismo color dentro de una misma skin.
- [ ] `neon` aplica halo (`shadowBlur` mayor que cero) y `retro` no aplica ninguno.
- [ ] Ninguna skin añade estrellas, rejilla ni ninguna forma que `clasico` no pinte.

### Contraste

- [ ] La nave de `neon` contrasta **15.24:1** contra su fondo `#05010f`.
- [ ] Los asteroides de `neon` contrastan **5.96:1** contra su fondo `#05010f`.
- [ ] Las balas de `neon` contrastan **18.85:1** contra su fondo `#05010f`.
- [ ] El power-up de `neon` contrasta **9.90:1** contra su fondo `#05010f`.
- [ ] Las partículas de `neon` contrastan **17.91:1** contra su fondo `#05010f` en su primer frame.
- [ ] La llama de `neon`, compuesta a `#da4d1d`, contrasta **4.97:1** contra su fondo `#05010f`.
- [ ] En `neon`, la nave contrasta **2.56:1** con los asteroides y el power-up contrasta **1.54:1** con la nave y **1.66:1** con los asteroides.
- [ ] La nave de `retro` contrasta **13.98:1** contra su fondo `#1a1206`.
- [ ] Los asteroides de `retro` contrastan **5.34:1** contra su fondo `#1a1206`.
- [ ] Las balas de `retro` contrastan **16.79:1** contra su fondo `#1a1206`.
- [ ] El power-up de `retro` contrasta **8.87:1** contra su fondo `#1a1206`.
- [ ] Las partículas de `retro` contrastan **7.62:1** contra su fondo `#1a1206` en su primer frame.
- [ ] La llama de `retro`, compuesta a `#dd4f1b`, contrasta **4.60:1** contra su fondo `#1a1206`.
- [ ] En `retro`, la nave contrasta **2.62:1** con los asteroides y el power-up contrasta **1.58:1** con la nave y **1.66:1** con los asteroides.

### Cambio en caliente

- [ ] Cambiar de skin con una partida en curso conserva la puntuación y la posición de las entidades: no reinicia.
- [ ] Cambiar de skin con asteroides ya en pantalla los repinta todos con la piel nueva, sin dejar ninguno con la anterior.
- [ ] Cambiar de skin estando en pausa mantiene el juego en pausa y repinta el frame congelado.
- [ ] En `AsteroidsGame.tsx`, `skin` no aparece en el array de dependencias del efecto de montaje.
- [ ] El `GameController` que devuelve `createGame` expone `setSkin` además de `start`, `stop`, `restart` y `setPaused`.
- [ ] Reiniciar tras morir con `neon` activa vuelve a arrancar en `neon`, no en `clasico`.

### Persistencia

- [ ] Elegir `retro` en `/juegos/rocas/jugar` y recargar la página deja el juego en `retro`.
- [ ] Salir a `/juegos/rocas` y volver a entrar a jugar deja el juego en `retro`.
- [ ] La consola del navegador no muestra ningún error de hidratación al cargar `/juegos/rocas/jugar`.
- [ ] `AsteroidsGame.tsx` no contiene ninguna referencia a `localStorage`.

### No regresión

- [ ] `caida`, `bloque-buster` y `serpentina` siguen pintando exactamente igual: sus ficheros no aparecen en el diff de esta spec.
- [ ] `/juegos/invasores/jugar` conserva su mock: ticker de score falso, enemigos CSS y guardado por toast.
- [ ] `git diff app/globals.css` no devuelve ninguna línea.
- [ ] `rocas` conserva HUD, pausa, reinicio, power-up de triple disparo y guardado real de puntuación.
- [ ] Salir de `rocas` y volver a entrar arranca limpio, sin `requestAnimationFrame` ni listeners del render anterior.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.
- [ ] `/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about` y `/auth` responden 200.

## Decisiones

- **Extracción de literales como paso propio y commiteable solo. No mezclada con las paletas.** `rocas` tiene los ocho colores escritos dentro de las llamadas de dibujo, en siete sitios distintos del fichero. Si la extracción y las skins entran juntas, cualquier diferencia visual es indistinguible entre «se movió mal un literal» y «el color nuevo no gusta».
- **Paleta pasada como argumento de `draw`. No capturada en el constructor de la entidad.** Con la captura, los asteroides creados antes del cambio de skin seguirían pintándose con la piel vieja y la partida quedaría con dos pieles a la vez.
- **`clasico` copia los valores literales, incluidas las formas cortas `#fff` y `#0ff` y la cadena `rgba(255, 130, 0, 0.85)`.** Reescribirlas expandidas sería equivalente para el canvas, pero rompe la comparación textual línea a línea que hace verificable la no regresión.
- **Hallazgo: en `clasico`, nave, asteroides, balas y partículas comparten `#fff` y contrastan 1.00:1 entre sí.** Está por debajo del suelo de 1.5:1 y **no se corrige**: `clasico` es el estado actual y es la red de no regresión de todo este eje. Se documenta aquí para que quede constancia y lo decida el usuario en su propia spec si alguna vez quiere tocarlo. El power-up, en `#0ff`, contrasta **1.25:1** con los asteroides, también por debajo del suelo y también intocable.
- **Excepción de forma, bala vs nave en `neon` (1.24:1) y en `retro` (1.20:1).** La bala es un disco relleno de 2 px de radio sin contorno; la nave es un triángulo hueco de unos 32 px de largo con muesca trasera y trazo de 1.5 px. Además la bala nace de la propia nave y se aleja de ella: no hay ninguna situación de juego en la que haga falta separarlas para sobrevivir. Subir el contraste de la bala respecto a la nave obligaría a oscurecer una de las dos por debajo del suelo de 4.5:1 contra el fondo.
- **Excepción de forma, partícula vs asteroide en `retro` (1.43:1).** La partícula es un trazo de 1 px de grosor y menos de 7 px de largo que se desvanece con alpha en menos de 1.1 s; el asteroide es un polígono cerrado de 8 a 13 vértices y de 16 a 50 px de radio. Además las partículas solo aparecen donde un asteroide acaba de morir, es decir, donde ya no hay nada que esquivar. La paleta de fósforo ámbar de `retro` es monocroma por definición, así que sus entidades se separan por brillo y por forma, no por matiz.
- **Las entidades difieren también en grosor y relleno, no solo en matiz.** Nave y asteroides van a trazo de 1.5 px, el power-up a trazo de 2 px, la bala es un disco relleno y la partícula un trazo de 1 px. Un jugador con daltonismo separa las cuatro sin depender del color.
- **Paleta `neon` anclada a los tokens de `app/globals.css`.** La nave usa `--cyan` `#00f5ff` y las balas `--yellow` `#f5ff00` tal cual. Los asteroides usan `#ff2d95` en vez de `--magenta` `#ff006e` porque el token puro se queda en **5.48:1** contra `#000000` y baja aún más contra el fondo `#05010f` de esta skin; `#ff2d95` llega a **5.96:1** conservando el matiz magenta. El power-up usa `#ff9d00`, que es el único valor probado que pasa a la vez el suelo de 1.5:1 contra la nave (**1.54:1**) y contra los asteroides (**1.66:1**).
- **Paleta `retro` de fósforo ámbar sobre `#1a1206`. No verde monocromo ni gris cálido.** Asteroids original es un vectorial en blanco sobre negro; el ámbar es el fósforo de monitor que más se le asocia y deja una escala de brillos amplia para separar seis superficies dentro de un solo matiz. El fondo no es `#000` a propósito: un negro puro con entidades ámbar no lee como fósforo.
- **Halo solo en `neon`.** El contrato de la SPEC 10 dice que `neon` admite halo y que `retro` no lo lleva. En `clasico` un halo sería, por definición, una regresión.
- **Sin decorado nuevo en ninguna skin.** Asteroids no pinta hoy estrellas ni rejilla, y añadirlas en `neon` o `retro` haría que las tres skins dejasen de compartir geometría, con lo que la no regresión de `clasico` ya no se podría verificar mirando solo colores. Por eso la banda de decorado de 1.1:1 – 2.5:1 no aparece en las tablas de esta spec.
- **Persistencia en `localStorage`, no en Supabase.** Ya decidido en la SPEC 10 y heredado aquí sin cambios: la skin es preferencia local del navegador, no dato del catálogo. Esta spec no crea ninguna migración.
- **Exclusiones deliberadas: siluetas por skin, transición animada y audio.** Ninguna afecta a la legibilidad, que es lo que este eje garantiza, y las tres se pueden añadir después sin tocar nada de lo que esta spec deja escrito.

## Riesgos

| Riesgo                                                                    | Mitigación                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `skin` en las deps del efecto de montaje reinicia la partida al cambiarla | Efecto aparte que llama a `setSkin()` (paso 4); grupo entero de criterios «Cambio en caliente»                           |
| La skin por defecto altera algún color y se cuela una regresión           | `clasico` copia los valores actuales literalmente (paso 2); grupo entero «No regresión de clásico», ítem a ítem          |
| La extracción del paso 1 cambia un valor sin querer                       | El paso se commitea solo y su verificación es que el render sea idéntico antes de existir ninguna skin                   |
| Entidades creadas antes del cambio de skin se quedan con la piel vieja    | La paleta se pasa como argumento de `draw`, no se captura en el constructor; criterio de repintado de asteroides         |
| Leer `localStorage` durante el render da error de hidratación             | La lectura la hace `GamePlayerScreen` en un efecto (SPEC 10); criterio de consola sin errores de hidratación             |
| `localStorage` lanza en navegación privada                                | Acceso envuelto en `try/catch`, con salida a `clasico` (SPEC 10); criterio de `AsteroidsGame.tsx` sin `localStorage`     |
| Una skin queda ilegible sobre el fondo oscuro                             | Suelos de contraste calculados con el script WCAG; un criterio por cada ratio en el grupo «Contraste»                    |
| Entidades que solo se distinguen por matiz                                | Excepciones de forma declaradas en `## Decisiones`; las entidades difieren además en grosor de trazo y en relleno        |
| El halo de `neon` empasta las entidades y baja el contraste percibido     | `shadowBlur` acotado a 8 y ratios calculados sobre el color del núcleo; prueba manual del paso 5                         |
| El halo de `neon` degrada la fluidez con muchas partículas en pantalla    | Prueba manual del paso 5 rompiendo un asteroide grande, que es el pico de partículas; el halo se aplica en una sola skin |
| Tocar `AsteroidsGame.tsx` rompe los otros juegos o el mock                | Solo se toca ese fichero; criterios del testigo `/juegos/invasores/jugar` y de los tres juegos registrados               |

## Lo que **no** entra en esta spec

- **Skins de `caida`, `bloque-buster` y `serpentina`.** Constantes con nombre, spritesheet y mixto: tres estrategias distintas, tres specs distintas.
- **Skins adicionales más allá de las tres.**
- **Skin por usuario en Supabase.** Sin migración y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.**
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`.
- **Campo de estrellas, rejilla o cualquier decorado nuevo en el canvas de `rocas`.**
- **Cambiar la silueta de las entidades por skin.**
- **Corregir el 1.00:1 entre entidades de la skin `clasico`.**
- **Animación de transición al cambiar de skin.**
- **Audio por skin.**
- **Tests.**

_Cada uno de esos, si llega, va en su propia spec._
