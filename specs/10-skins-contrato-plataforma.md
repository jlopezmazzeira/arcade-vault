# SPEC 10 — Contrato de skins de plataforma (`clasico`, `neon`, `retro`)

> **Status:** Draft
> **Depends on:** SPEC 05 (contrato de juego y registro), SPEC 07 (extracción de `types.ts` y HUD condicional)
> **Date:** 2026-09-05
> **Objective:** Crear la pieza compartida que permite que cualquier juego adaptado se vista con las tres skins obligatorias, con selector en el HUD y preferencia persistida por juego en el navegador.

## Alcance

**Dentro:**

- Nuevo módulo **`app/_components/games/skins.ts`** con el tipo `SkinId`, la lista `SKIN_IDS` y la constante `DEFAULT_SKIN`. Es la única definición de las tres skins en todo el repo; ninguna spec posterior lo redefine.
- **Extensión de `app/_components/games/types.ts`**: `PlayableGameProps` gana `skin?: SkinId`. **Es opcional a propósito** — los cuatro juegos hoy registrados (`rocas`, `caida`, `bloque-buster`, `serpentina`) siguen compilando sin tocarlos, y ninguno queda roto entre esta spec y la suya.
- **Selector de skin en el HUD**, dentro del `div.hud-actions` de `app/_components/GamePlayerScreen.tsx:129`, junto a los botones `PAUSA`, `FIN` y `SALIR`. Tras el clic hace `e.currentTarget.blur()`, igual que los otros dos botones del HUD (`GamePlayerScreen.tsx:132-137` y `:143-146`).
- **Solo en la rama del juego real.** El selector se monta dentro de `PlayableGamePlayer`. El `hud-actions` del `MockGamePlayer` (`GamePlayerScreen.tsx:338`) **no se toca**: un mock no tiene canvas que vestir.
- Nueva hoja **`app/_components/GamePlayerScreen.module.css`** con los estilos del selector. CSS scopeado al componente; **`app/globals.css` no se toca en esta spec**.
- **Persistencia en `localStorage`**, una clave por juego: `av-skin-<game-id>`. Lectura y escritura envueltas en `try/catch`, con salida a `clasico`.
- **La lectura ocurre en un `useEffect`, nunca durante el render.** Leer `localStorage` al renderizar produce error de hidratación, porque el servidor no tiene ese valor.
- **La skin se pasa al juego como prop** (`<Playable skin={skin} … />`) y el juego decide qué hacer con ella. Un juego que aún no la lea recibe la prop y la ignora.
- **No regresión explícita**: los cuatro ids que hoy están en `app/_components/games/registry.ts` — `rocas`, `caida`, `bloque-buster` y `serpentina` — siguen pintando exactamente igual que antes de esta spec, porque ninguno lee todavía la prop. El testigo mock es **`/juegos/invasores/jugar`**, que mantiene su ticker de score falso y su toast intactos.

**Fuera de alcance (para futuras specs):**

- **La implementación de las paletas de cada juego.** Esta spec crea el contrato y el selector; vestir `rocas` es la SPEC 11, y `caida`, `bloque-buster` y `serpentina` van cada uno en la suya.
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas; añadir una cuarta cambia el contrato y merece su propia spec.
- **Skin por usuario en Supabase.** La preferencia es local del navegador; no se toca `public.games` ni se añade columna a ninguna tabla.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma y son iguales para las tres skins.
- **Skins para los juegos aún en mock** (`gloton`, `invasores`, `ranaria`, `duelo-pixel`). No tienen canvas que vestir; sus skins nacerán con su spec de juego.
- **Animación de transición al cambiar de skin.** El cambio es instantáneo, en el siguiente frame.
- **Selector de skin fuera de la pantalla de juego** (ficha del juego, biblioteca, preferencias de cuenta).
- **Audio por skin.**
- **Tests.** Sigue sin haber runner en el proyecto.

## Modelo de datos

### (a) Contrato con la plataforma

El módulo nuevo define las tres skins y nada más:

```ts
// app/_components/games/skins.ts
export type SkinId = "clasico" | "neon" | "retro";
export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];
export const DEFAULT_SKIN: SkinId = "clasico";
```

`app/_components/games/types.ts` importa `SkinId` y extiende el contrato con un campo opcional:

```ts
export type PlayableGameProps = {
  paused: boolean;
  /** Piel del canvas. Opcional: un juego que no la lea sigue en `clasico`. */
  skin?: SkinId;
  onSnapshot: (s: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};
```

**Cambiar de skin no reinicia la partida.** Es la trampa central de este eje y es la misma lección que `paused` en el contrato de plataforma: si `skin` entrase en las dependencias del efecto de montaje, cada cambio destruiría y recrearía el juego, y el jugador perdería la partida al tocar el selector. El mecanismo es el mismo que el de `paused`: el `GameController` de cada juego expone un `setSkin(next: SkinId)` y el componente lo propaga desde un **`useEffect` aparte**, con `skin` como única dependencia.

`GamePlayerScreen` guarda la skin en un `useState<SkinId>(DEFAULT_SKIN)` y la pasa como prop. El estado vive en el player, no en el juego, porque también lo consume el selector del HUD.

### (b) Las tres skins

Esta spec **no fija ninguna paleta concreta**: solo declara qué significa cada id, para que las specs de juego elijan colores coherentes entre sí.

```ts
// clasico — la skin por defecto.
// Reproduce EXACTAMENTE lo que el juego pinta hoy. No es una skin nueva:
// es un nombre para el estado actual. Ningún juego la transforma.
```

```ts
// neon — saturada y de alto contraste, emparentada con los tokens de
// app/globals.css: --cyan #00f5ff, --magenta #ff006e, --green #00ff88,
// --yellow #f5ff00. Admite halo (shadowBlur + shadowColor).
```

```ts
// retro — paleta corta de fósforo CRT: ámbar, verde monocromo o gris cálido.
// Sin halo, contraste más bajo, pero siempre dentro de los suelos de abajo.
```

**Suelos de contraste que hereda toda spec de skin.** Se miden con el ratio WCAG entre el color de la entidad y **el fondo de su propia skin**, no contra `#000` por inercia: una skin retro puede tener el fondo en `#1a1206`.

| Qué se mide                                           | Suelo         |
| ----------------------------------------------------- | ------------- |
| Entidad jugable contra el fondo del canvas de su skin | ≥ 4.5:1       |
| Dos entidades que el jugador debe distinguir entre sí | ≥ 1.5:1       |
| Decorado — rejilla, tinte de tablero, bordes de panel | 1.1:1 – 2.5:1 |

**Excepción de forma.** El suelo de 1.5:1 entre entidades se cumple por color **o** porque las entidades ya se distinguen por forma, tamaño o grosor de trazo. Cuando una spec la invoque, debe escribir qué rasgo de forma hace el trabajo. Sin esta excepción la propia skin `clasico` suspendería la auditoría en varios juegos, y `clasico` es intocable por definición.

Contraste de los tokens de la plataforma sobre el fondo negro del canvas, calculado como referencia para las specs de juego que tiren de ellos:

| Token       | Color     | Fondo     | Ratio       |
| ----------- | --------- | --------- | ----------- |
| `--cyan`    | `#00f5ff` | `#000000` | **15.50:1** |
| `--green`   | `#00ff88` | `#000000` | **15.66:1** |
| `--yellow`  | `#f5ff00` | `#000000` | **19.19:1** |
| `--magenta` | `#ff006e` | `#000000` | **5.48:1**  |

`--magenta` es el único token que roza el suelo de 4.5:1: sirve para entidades, pero no admite oscurecerse. Los otros tres tienen margen de sobra.

### (c) Persistencia

- **Clave:** `av-skin-<game-id>` — por ejemplo `av-skin-rocas`. Una clave por juego, porque la skin que luce bien en Asteroids no tiene por qué ser la que se quiere en Tetris.
- **Valor:** el `SkinId` en texto plano. Al leer se valida contra `SKIN_IDS`; cualquier valor desconocido cae a `clasico`.
- **Lectura en efecto, no en render.** El primer render pinta siempre `DEFAULT_SKIN`; un `useEffect` que corre solo al montar lee `localStorage` y, si hay valor válido y distinto, actualiza el estado. Así el HTML del servidor y el del primer render del cliente coinciden y no hay error de hidratación.
- **Acceso envuelto en `try/catch`,** tanto en lectura como en escritura: en navegación privada el acceso a `localStorage` puede lanzar. Si lanza, la skin es `clasico` y el juego sigue funcionando.
- **Sin migración.** No se crea ninguna migración en `supabase/migrations/`, no se toca `public.games` y no se llama a ningún MCP de escritura. La skin es preferencia local del navegador, no dato del catálogo.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Crear `skins.ts`

Nuevo fichero `app/_components/games/skins.ts` con `SkinId`, `SKIN_IDS` y `DEFAULT_SKIN`, más un comentario de cabecera que explique qué es cada skin y que `clasico` es el estado actual de cada juego.

_Verificación:_ `npx tsc --noEmit` pasa y el fichero no importa nada de React.

### 2. Añadir `skin?: SkinId` a `PlayableGameProps`

En `app/_components/games/types.ts`, importar `SkinId` de `./skins` y añadir el campo **opcional** a `PlayableGameProps`. No se toca ningún componente de juego.

_Verificación:_ `npx tsc --noEmit` pasa sin cambiar `AsteroidsGame.tsx`, `TetrisGame.tsx`, `ArkanoidGame.tsx` ni `SnakeGame.tsx`, y los cuatro juegos siguen jugándose igual.

### 3. Estado de skin en `PlayableGamePlayer`

En `app/_components/GamePlayerScreen.tsx`, añadir `const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN)` dentro de `PlayableGamePlayer` y pasar `skin={skin}` al componente `<Playable>` de `GamePlayerScreen.tsx:160`. Ningún juego lo lee todavía, así que nada cambia en pantalla.

_Verificación:_ los cuatro juegos registrados se ven idénticos y la consola del navegador sigue limpia.

### 4. Selector en el HUD

Botón o grupo de botones dentro del `div.hud-actions` de la rama real, uno por entrada de `SKIN_IDS`, con la skin activa marcada visualmente y `aria-pressed` para lectores de pantalla. Tras el clic, `e.currentTarget.blur()`. Los estilos van en `app/_components/GamePlayerScreen.module.css`, importado por el componente.

_Verificación:_ en `/juegos/rocas/jugar` el selector aparece junto a `PAUSA`; tras pulsarlo, la barra espaciadora dispara en vez de reactivar el botón. `app/globals.css` sigue sin cambios en `git diff`.

### 5. Persistencia en `localStorage`

Un `useEffect` de montaje lee `av-skin-<game.id>`, valida contra `SKIN_IDS` y actualiza el estado si procede. Un segundo efecto escribe la clave cuando `skin` cambia. Ambos accesos, en `try/catch`.

_Verificación:_ elegir `retro` en `/juegos/rocas/jugar`, recargar (F5) y comprobar que sigue en `retro`; abrir `/juegos/caida/jugar` y comprobar que arranca en `clasico`, porque su clave es otra. Consola sin advertencias de hidratación.

### 6. Prueba manual de extremo a extremo

Una persona, en el navegador: entrar en `/juegos/rocas/jugar`, jugar unos segundos, recorrer las tres skins con el selector, pausar y reanudar, reiniciar tras morir, salir a la ficha del juego y volver a entrar. Repetir en `/juegos/caida/jugar`. Comprobar además que `/juegos/invasores/jugar` no muestra selector alguno y conserva su mock.

_Verificación:_ ningún paso rompe la partida ni deja errores en consola.

### 7. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Rutas de specs anteriores en 200: `/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about`, `/auth`. Sin scroll horizontal en el `body`.

_Verificación:_ los tres comandos terminan en verde y las seis rutas responden 200.

### Apuntes sobre el orden

- `skins.ts` va primero y no depende de nada: es un fichero de tipos y constantes que los pasos 2 a 5 importan.
- El campo `skin` se añade **opcional** en el paso 2 para que ningún juego tenga que cambiar en esta spec. Si fuese obligatorio, los cuatro componentes registrados dejarían de compilar de golpe y esta spec arrastraría trabajo que no es suyo.
- El paso 3 va antes que el 4 porque el selector necesita algo que conmutar: primero existe el estado, luego la UI que lo cambia.
- La persistencia (paso 5) va después del selector porque no hay forma manual de verificar que la clave se escribe hasta que se puede elegir una skin desde la pantalla.
- La prueba manual va antes de la pasada final para que los fallos de comportamiento se arreglen antes de firmar el build.

## Criterios de aceptación

### No regresión de clásico

- [ ] Con el selector en `clasico`, `rocas` pinta exactamente los mismos colores que antes de esta spec: nave `#fff`, asteroides `#fff`, balas `#fff`, power-up `#0ff`, llama `rgba(255, 130, 0, 0.85)`, partículas `rgba(255,255,255,alpha)`, fondo `#000`.
- [ ] `caida`, `bloque-buster` y `serpentina` pintan exactamente igual que antes de esta spec, porque ninguno lee todavía la prop `skin`.
- [ ] `clasico` es el valor que aparece seleccionado la primera vez que se abre un juego, sin clave previa en `localStorage`.

### Contrato de skins

- [ ] Existe `app/_components/games/skins.ts` y exporta `SkinId`, `SKIN_IDS` y `DEFAULT_SKIN`.
- [ ] `SKIN_IDS` contiene exactamente `["clasico", "neon", "retro"]`, en ese orden.
- [ ] `DEFAULT_SKIN` vale `"clasico"`.
- [ ] `PlayableGameProps` de `app/_components/games/types.ts` declara `skin?: SkinId`, con el interrogante.
- [ ] `npx tsc --noEmit` pasa sin haber modificado ninguno de los cuatro componentes de juego.

### Selector en el HUD

- [ ] El selector aparece dentro de `hud-actions` en `/juegos/rocas/jugar`, `/juegos/caida/jugar`, `/juegos/bloque-buster/jugar` y `/juegos/serpentina/jugar`.
- [ ] El selector **no** aparece en `/juegos/invasores/jugar`, que es un id sin entrada en `registry.ts`.
- [ ] Hay un control por cada entrada de `SKIN_IDS`, y el de la skin activa está marcado visualmente y con `aria-pressed="true"`.
- [ ] Tras pulsar un control del selector, la barra espaciadora dispara en el juego en vez de reactivar el botón.
- [ ] `git diff app/globals.css` no devuelve ninguna línea.

### Cambio en caliente

- [ ] Cambiar de skin con una partida en curso conserva la puntuación y la posición de las entidades: no reinicia.
- [ ] Cambiar de skin estando en pausa mantiene el juego en pausa.
- [ ] En `GamePlayerScreen.tsx`, `skin` no aparece en el array de dependencias de ningún efecto que cree o destruya el juego.

### Persistencia

- [ ] Elegir `retro` en `/juegos/rocas/jugar` y recargar la página deja el selector en `retro`.
- [ ] Salir a `/juegos/rocas` y volver a entrar a jugar deja el selector en `retro`.
- [ ] `/juegos/caida/jugar` arranca en `clasico` aunque `rocas` esté en `retro`: son claves distintas.
- [ ] La clave escrita en `localStorage` se llama `av-skin-rocas` para el juego `rocas`.
- [ ] Un valor manipulado a mano en `localStorage` (por ejemplo `av-skin-rocas = "arcoiris"`) hace que el juego arranque en `clasico` sin lanzar ningún error.
- [ ] La consola del navegador no muestra ningún error de hidratación al cargar `/juegos/rocas/jugar`.

### No regresión

- [ ] `rocas`, `caida`, `bloque-buster` y `serpentina` conservan HUD, pausa, reinicio y guardado real de puntuación.
- [ ] `/juegos/invasores/jugar` conserva su mock: ticker de score falso, enemigos CSS y guardado por toast.
- [ ] Salir de un juego y volver a entrar arranca limpio, sin `requestAnimationFrame` ni listeners del render anterior.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores ni avisos.
- [ ] `/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about` y `/auth` responden 200.

## Decisiones

- **Un módulo `skins.ts` propio. No meter `SkinId` dentro de `types.ts`.** `types.ts` describe el contrato de datos entre juego y plataforma; la lista de skins es un catálogo cerrado que también consume el HUD. Separarlos deja claro quién importa qué, y `types.ts` puede importar de `skins.ts` sin ciclo.
- **`skin` opcional en `PlayableGameProps`. No obligatorio.** Con el campo obligatorio, esta spec rompería la compilación de los cuatro juegos registrados y tendría que vestirlos todos de golpe. Opcional, cada juego se viste en su propia spec y el estado intermedio siempre compila y siempre juega.
- **La skin se propaga por un `useEffect` aparte que llama a `setSkin()`. No por las dependencias del efecto de montaje.** Es la misma lección que `paused` en el contrato de plataforma: con `skin` en las deps del montaje, cada cambio de skin destruye y recrea el juego, y el jugador pierde la partida al tocar el selector.
- **La skin pinta el canvas y nada más. No el chrome.** El marco CRT, las scanlines y los colores del HUD son de la plataforma y son iguales para las tres skins. Teñir el chrome multiplicaría la superficie a verificar y arrastraría `app/globals.css`, que estas specs no tocan.
- **Estilos del selector en `GamePlayerScreen.module.css`. No en `app/globals.css`.** La regla de las SPEC 05 y 06 protege el chrome global; un control nuevo de la pantalla de juego se scopea al componente, como ya hacen los cuatro módulos CSS de `app/_components/games/`.
- **Persistencia en `localStorage`. No en Supabase.** La skin es una preferencia estética del navegador, no un dato del catálogo ni de la cuenta: guardarla en `public.games` la haría global para todos los jugadores, y guardarla por usuario exigiría migración, RLS y sesión iniciada para algo que también debe funcionar de invitado.
- **Una clave por juego (`av-skin-<game-id>`). No una clave global.** La paleta que funciona en un juego vectorial no tiene por qué funcionar en uno de sprites, y el jugador espera que su elección se recuerde por juego.
- **Lectura de `localStorage` en un efecto. No durante el render.** El servidor no tiene acceso a `localStorage`: leerlo al renderizar produce HTML distinto en servidor y cliente, y React lo reporta como error de hidratación.
- **El selector solo en la rama real. No en el mock.** `MockGamePlayer` es el seguro de no regresión del contrato de plataforma y no pinta ningún canvas: darle un selector sería una promesa falsa.
- **Exclusión deliberada de la animación de transición y del audio por skin.** Ninguna de las dos afecta a la legibilidad, que es lo que este eje debe garantizar; ambas se pueden añadir después sin tocar el contrato.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `skin` en las deps del efecto de montaje reinicia la partida al cambiarla     | La skin se propaga por un efecto aparte que llama a `setSkin()`; grupo de criterios «Cambio en caliente»               |
| La skin por defecto altera algún color y se cuela una regresión               | `skin` es opcional y ningún juego la lee en esta spec; grupo entero «No regresión de clásico» con los valores actuales |
| Leer `localStorage` durante el render da error de hidratación                 | Lectura en el efecto de montaje del paso 5, con salida a `clasico`; criterio de consola sin errores de hidratación     |
| `localStorage` lanza en navegación privada                                    | Acceso a lectura y escritura envuelto en `try/catch`, con salida a `clasico`; paso 5 del plan                          |
| Un valor corrupto en `localStorage` deja el juego sin pintar                  | Validación contra `SKIN_IDS` al leer; criterio del valor manipulado a mano                                             |
| El botón del selector se queda con el foco y la barra espaciadora lo reactiva | `e.currentTarget.blur()` tras el clic, como los botones `PAUSA` y `FIN`; criterio de foco del grupo «Selector»         |
| Añadir el selector desplaza o rompe el layout de `hud-actions`                | Estilos scopeados en el módulo CSS del paso 4; prueba manual del paso 6 en los cuatro juegos registrados               |
| Tocar `GamePlayerScreen` rompe la rama mock                                   | Todos los cambios van dentro de `PlayableGamePlayer`; criterio del testigo `/juegos/invasores/jugar`                   |

## Lo que **no** entra en esta spec

- **Las paletas concretas de cada juego.** Esta spec crea el contrato; vestir `rocas` es la SPEC 11, y `caida`, `bloque-buster` y `serpentina` van cada uno en la suya.
- **Skins adicionales más allá de las tres.** `SKIN_IDS` tiene exactamente tres entradas.
- **Skin por usuario en Supabase.** Sin migración, sin columna nueva y sin tocar `public.games`.
- **Teñido del marco CRT, de las scanlines y de los colores del HUD.** Son de la plataforma y son iguales para las tres skins.
- **Skins para los juegos aún en mock:** `gloton`, `invasores`, `ranaria` y `duelo-pixel`.
- **Animación de transición al cambiar de skin.**
- **Selector de skin fuera de la pantalla de juego.**
- **Audio por skin.**
- **Tests.**

_Cada uno de esos, si llega, va en su propia spec._
