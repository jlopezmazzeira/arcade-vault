# SPEC JAM 02 — Fauna del río y de la orilla en Frogger (`ranaria`)

> **Status:** Draft
> **Depends on:** SPEC JAM 01 (puerto base de Frogger), SPEC 05 (contrato de juego y registro), SPEC 07 (`types.ts` y HUD condicional)
> **Date:** 2026-09-03
> **Objective:** Añadir al Frogger de la SPEC JAM 01 las tres entidades vivas del original —tortugas sumergibles, cocodrilos en los nenúfares y mosca bonus—, sin tocar ningún fichero de plataforma.
> **Jam:** tema «Frogger y los arcade de cruzar carriles» — spec 2 de 2

## Alcance

**Dentro:**

- **Un único fichero modificado: `app/_components/games/FroggerGame.tsx`.** No se toca `FroggerGame.module.css`, ni `registry.ts`, ni `types.ts`, ni `GamePlayerScreen.tsx`, ni `data/games.ts`, ni `app/globals.css`, ni `supabase/migrations/`.
- **Tortugas sumergibles en dos carriles del río**, las filas `4` y `2`, que en la SPEC JAM 01 son las dos que van hacia la izquierda. Cada balsa de tortugas conserva **exactamente la geometría del tronco que sustituye** —misma `len`, misma `speed`, mismo `count`, misma dirección—, así que la cobertura y la cruzabilidad del carril no cambian.
- **Ciclo de inmersión de tres fases** por balsa: a flote, parpadeando (todavía sostiene) y sumergida (mata). El ciclo completo dura 7 000 ms.
- **Desfase por balsa.** La balsa `k` de un carril arranca su ciclo con fase `k × 7000 / count`, de modo que las balsas de un mismo carril nunca comparten su fase de inmersión al completo.
- **Rampa de inmersión por nivel**: la fase sumergida empieza en 1 500 ms y crece 250 ms por nivel hasta un tope de 3 000 ms, alcanzado en el nivel 7. El parpadeo dura siempre 1 500 ms y el ciclo total sigue siendo 7 000 ms; lo que se acorta es el tiempo a flote.
- **Dibujo de la tortuga sumergida**, no su desaparición: se pinta como una silueta apagada bajo el agua, para que el jugador pueda anticipar el ciclo desde la mediana.
- **Cocodrilo en la orilla a partir del nivel 3.** Ocupa un nenúfar libre durante 5 000 ms, desaparece 7 000 ms y reaparece en otro nenúfar libre. Aterrizar sobre él resta una vida.
- **El cocodrilo nunca ocupa el último nenúfar libre.** Si solo queda uno sin ocupar, no aparece: la ronda siempre se puede terminar.
- **Mosca bonus desde el nivel 1.** Aparece cada 9 000 ms sobre un nenúfar libre y sin cocodrilo, y se queda 6 000 ms.
- **La mosca suma `200 × racha`** al llegar a su nenúfar, **además** del bono de llegada normal. Con la racha capada a ×5 de la SPEC JAM 01, el máximo por mosca es 1 000.
- **La puntuación de la SPEC JAM 01 no cambia.** Ni las filas, ni el bono de llegada, ni el bono de ronda, ni la rana extra: la mosca es un quinto evento que se suma a la tabla, no una reescritura de ella.
- **El HUD no cambia.** Se siguen emitiendo `score`, `status`, `lives`, `level` y los mismos tres `extra` (`Tiempo`, `Orilla`, `Racha`). La mosca y el cocodrilo son información diegética: se ven en el canvas.
- **Sin campos nuevos en `GameSnapshot`** y sin ninguna emisión adicional por frame: las entidades nuevas solo provocan snapshot cuando cambian `score` o `lives`.
- **No regresión explícita**: `rocas`, `caida`, `bloque-buster` y `serpentina` siguen igual, `gloton` mantiene su mock, y todo lo que la SPEC JAM 01 dejó jugable en `/juegos/ranaria/jugar` sigue comportándose igual salvo en las tres filas que esta spec toca.

**Fuera de alcance (para futuras specs):**

- **Serpiente sobre la mediana.** La única fila de descanso del tablero se queda segura.
- **Rana escolta** que se recoge por el camino y multiplica el bono de llegada.
- **Tortugas en los tres carriles del río que van a la derecha** (filas `5`, `3` y `1`). Se quedan de tronco: dos carriles sumergibles ya son la mitad del río.
- **Nutria, castor o cualquier entidad que se mueva dentro de su carril** en vez de a velocidad constante.
- **Audio.** Ni el chapoteo de la inmersión ni el zumbido de la mosca.
- **Sprites.** El cocodrilo, la tortuga y la mosca son vectoriales, como todo el resto del juego.
- **Un `extra` nuevo en el HUD** que anuncie la mosca o avise del cocodrilo.
- **Controles táctiles, teclas `P`/`Escape` y multijugador.** Igual que en la SPEC JAM 01.
- **`best` y `plays` derivados** de las puntuaciones reales.
- **Promover esta spec a la serie numerada de `specs/`.** Es una candidata de jam, y además no tiene sentido sin la SPEC JAM 01.

## Modelo de datos

Esta spec **no crea tablas, ni migraciones, ni tipos**. Los «datos» son tres cosas: qué sigue emitiendo el juego, las constantes nuevas y la fila de catálogo que ya existía antes de la SPEC JAM 01.

### (a) Contrato con la plataforma

**No cambia nada.** `FroggerGame.tsx` sigue importando `PlayableStatus`, `GameSnapshot`, `PlayableGameProps` y `PlayableGameHandle` de `./types`, y sigue emitiendo los mismos campos con los mismos significados:

| Juego                      | `score` | `lives`        | `level` | `extra`                      |
| -------------------------- | ------- | -------------- | ------- | ---------------------------- |
| `rocas` (Asteroids)        | sí      | sí (3)         | sí      | `[{ label: "Poder", … }]`    |
| `caida` (Tetris)           | sí      | no             | sí      | `[{ label: "Líneas", … }]`   |
| `bloque-buster` (Arkanoid) | sí      | sí (3)         | sí      | ninguna                      |
| `serpentina` (Snake)       | sí      | no             | no      | `[{ label: "Longitud", … }]` |
| `ranaria` (Frogger)        | sí      | sí (3, máx. 5) | sí      | `[Tiempo, Orilla, Racha]`    |

Ahogarse sobre una tortuga sumergida y aterrizar sobre un cocodrilo son muertes normales: emiten `status: "dead"` y bajan `lives`, igual que las cinco condiciones de la SPEC JAM 01. La mosca solo mueve `score`.

**Regla de emisión:** `onSnapshot` se llama **solo cuando cambia un campo** respecto al último emitido, nunca por frame. Las tres entidades nuevas tienen animación propia —parpadeo, aparición, desaparición— y **ninguna de ellas es motivo de emisión**: viven enteras dentro del canvas.

### (b) Constantes del juego

Se añaden a las de la SPEC JAM 01, en el mismo bloque de `const` de `FroggerGame.tsx`:

```ts
const TURTLE_ROWS = [4, 2]; // los dos carriles del río que van a la izquierda
const DIVE_CYCLE_MS = 7_000; // ciclo completo de una balsa
const DIVE_BLINK_MS = 1_500; // parpadeo de aviso; todavía sostiene
const DIVE_UNDER_START_MS = 1_500; // fase sumergida en el nivel 1
const DIVE_UNDER_STEP_MS = 250; // + por nivel
const DIVE_UNDER_MAX_MS = 3_000; // tope, alcanzado en el nivel 7
const CROC_FROM_LEVEL = 3; // nivel en que aparece el primer cocodrilo
const CROC_SHOW_MS = 5_000; // tiempo en un nenúfar
const CROC_HIDE_MS = 7_000; // tiempo entre apariciones
const FLY_EVERY_MS = 9_000; // periodo de aparición de la mosca
const FLY_SHOW_MS = 6_000; // tiempo que se queda
const SCORE_FLY = 200; // × racha, además del bono de llegada
```

El estado nuevo dentro de `createGame` son cinco escalares y nada más: `croc: { pad: number; until: number } | null`, `fly: { pad: number; until: number } | null` y un reloj de partida `elapsed` en milisegundos, del que las balsas derivan su fase. **Las balsas no guardan estado propio**: su fase es una función pura de `elapsed`, del índice `k` y del nivel.

**Fases de una balsa**, con `under = min(1500 + 250 × (nivel − 1), 3000)` y `float = 7000 − 1500 − under`:

| Nivel | A flote  | Parpadeo | Sumergida | % del ciclo bajo el agua |
| ----- | -------- | -------- | --------- | ------------------------ |
| 1     | 4 000 ms | 1 500 ms | 1 500 ms  | 21 %                     |
| 3     | 3 500 ms | 1 500 ms | 2 000 ms  | 29 %                     |
| 5     | 3 000 ms | 1 500 ms | 2 500 ms  | 36 %                     |
| 7 y + | 2 500 ms | 1 500 ms | 3 000 ms  | 43 %                     |

**Puntuación**, ampliando la tabla de la SPEC JAM 01 con una sola fila nueva:

| Evento                               | Fórmula   | Ejemplo           |
| ------------------------------------ | --------- | ----------------- |
| Llegar al nenúfar que tiene la mosca | `200 × r` | `r = 3` → **600** |

El resto de la tabla —`10` por fila nueva, `(50 + 10 × s) × r` por llegada, `1000 × nivel` por ronda, rana extra cada 20 000— queda **literalmente igual**.

### (c) Fila del catálogo

**Reutiliza el id `ranaria`, ya sembrado: no hay migración ni cover art nuevo.** Es la misma situación que dejó la SPEC JAM 01.

| Campo      | Valor        |
| ---------- | ------------ |
| `id`       | `ranaria`    |
| `position` | `6`          |
| `title`    | `RANARIA`    |
| `cat`      | `ARCADE`     |
| `cover`    | `cover-rana` |
| `color`    | `green`      |

`data/games.ts` no se toca y la unión `CoverArt` tampoco.

## Plan de implementación

Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.

### 1. Tortugas sumergibles

Añadir a la constante de carriles un campo `kind: "log" | "turtle"` y marcar las filas `4` y `2` como `"turtle"`, **sin tocar `dir`, `speed`, `len` ni `count`**. Escribir la función pura `raftPhase(elapsed, k, count, level): "float" | "blink" | "under"` con las fases de la tabla anterior.

En el dibujo, una balsa `"turtle"` se pinta como `count` caparazones verdes contiguos: a flote en color pleno, parpadeando alternando cada 250 ms, y sumergida como silueta apagada sobre el agua.

_Verificación:_ `npx tsc --noEmit` pasa; en el nivel 1 se ve el ciclo completo de las balsas de las filas `4` y `2`, y las balsas de un mismo carril nunca se sumergen todas a la vez.

### 2. Ahogarse sobre una tortuga sumergida

En la resolución del río de la SPEC JAM 01, la balsa que contiene el centro de la rana solo la sostiene si su fase es `"float"` o `"blink"`. Con fase `"under"`, la rana se ahoga: es una muerte normal, con su `status: "dead"`, su congelación de 700 ms y su racha a 0.

_Verificación:_ quedarse quieto sobre una balsa hasta que se sumerja resta una vida; saltar fuera durante el parpadeo la salva.

### 3. Cocodrilo en los nenúfares

Añadir el estado `croc` y su temporizador. A partir de `CROC_FROM_LEVEL`, cada `CROC_HIDE_MS` se elige al azar un nenúfar libre **siempre que quede más de uno libre**, y se ocupa `CROC_SHOW_MS`. Se dibuja como un hocico alargado con dientes, en un color distinto al del nenúfar libre. Aterrizar en ese nenúfar es muerte, y el nenúfar **no** queda ocupado.

Al subir de nivel y al reiniciar la partida, `croc` se pone a `null`.

_Verificación:_ en el nivel 1 y 2 no aparece ningún cocodrilo; en el nivel 3 aparece y aterrizar sobre él resta una vida; con cuatro nenúfares ocupados el cocodrilo no ocupa nunca el quinto.

### 4. Mosca bonus

Añadir el estado `fly` y su temporizador. Cada `FLY_EVERY_MS` se elige al azar un nenúfar libre y sin cocodrilo, y se ocupa `FLY_SHOW_MS`. Se dibuja como un punto `--yellow` que orbita el centro del nenúfar. Llegar a ese nenúfar suma `SCORE_FLY × racha` **después** de aplicar el bono de llegada, y la mosca desaparece.

Al subir de nivel y al reiniciar la partida, `fly` se pone a `null`.

_Verificación:_ llegar al nenúfar con mosca en la tercera llegada consecutiva con 20 s restantes suma exactamente `(50 + 200) × 3 + 200 × 3 = 1 350` puntos.

### 5. Prueba manual de extremo a extremo

Partida completa: ahogarse sobre una tortuga, salvarse durante el parpadeo, notar en el nivel 5 que las inmersiones duran más, morir contra un cocodrilo en el nivel 3, cazar una mosca con racha alta, completar una ronda, agotar las vidas, guardar la puntuación, comprobarla en `/juegos/ranaria` y en `/salon`, pulsar «JUGAR DE NUEVO», salir de la ruta y volver a entrar.

### 6. Pasada final

`npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación. **`get_advisors` no aplica**: esta spec no toca la base de datos.

### Apuntes sobre el orden

- **Las tortugas (1 y 2) van antes que el cocodrilo (3) y la mosca (4)** porque son las únicas que tocan una ruta de código ya existente —la resolución del río—, y por tanto las únicas que pueden romper algo que la SPEC JAM 01 daba por bueno. Conviene aislarlas en su propio commit.
- **El dibujo (1) va antes que la muerte (2)** a propósito: hasta que las tres fases no se distinguen a simple vista, no hay forma de saber si una muerte por inmersión es correcta o es un fallo de fase.
- **El cocodrilo (3) va antes que la mosca (4)** porque la mosca tiene que excluir el nenúfar del cocodrilo al elegir el suyo, y no al revés.

## Criterios de aceptación

Checklist booleano: cada ítem se responde con sí o no.

### Build y calidad

- [ ] `npm run lint` termina sin errores ni avisos.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npm run build` termina sin errores ni avisos.
- [ ] La consola de `/juegos/ranaria/jugar` no muestra errores de hidratación ni advertencias de React.

### Estructura y registro

- [ ] El único fichero modificado es `app/_components/games/FroggerGame.tsx`.
- [ ] `FroggerGame.module.css`, `registry.ts`, `types.ts`, `GamePlayerScreen.tsx`, `data/games.ts`, `app/globals.css` y `supabase/migrations/` no tienen ningún cambio.
- [ ] El módulo sigue sin declarar ninguna variable mutable a nivel de módulo.
- [ ] No se ha añadido ningún archivo bajo `public/`.
- [ ] `GameSnapshot` no ha ganado ningún campo.

### Juego real en `/juegos/ranaria/jugar`

- [ ] Las filas `4` y `2` del río llevan balsas de tortugas; las filas `5`, `3` y `1` siguen llevando troncos.
- [ ] Las balsas de las filas `4` y `2` conservan la dirección, la velocidad, el largo y el número de entidades que tenían los troncos de la SPEC JAM 01.
- [ ] Una balsa recorre las tres fases —a flote, parpadeando, sumergida— en un ciclo de **7 000 ms**.
- [ ] En el nivel 1 la fase sumergida dura **1 500 ms**; en el nivel 5, **2 500 ms**; en el nivel 7 y siguientes, **3 000 ms**.
- [ ] El parpadeo dura **1 500 ms** en todos los niveles y la rana **sigue sostenida** durante él.
- [ ] Las balsas de un mismo carril están desfasadas: nunca están todas sumergidas al mismo tiempo.
- [ ] Una balsa sumergida se sigue viendo como silueta bajo el agua y se sigue moviendo.
- [ ] Quedarse sobre una balsa hasta que se sumerja resta una vida, con la congelación de 700 ms y la racha a 0.
- [ ] En los niveles 1 y 2 no aparece ningún cocodrilo.
- [ ] Desde el nivel 3, un cocodrilo ocupa un nenúfar libre durante **5 000 ms** y reaparece **7 000 ms** después en otro.
- [ ] Cuando solo queda un nenúfar libre, el cocodrilo **no** aparece.
- [ ] Aterrizar sobre el cocodrilo resta una vida y **no** ocupa el nenúfar.
- [ ] La mosca aparece cada **9 000 ms** sobre un nenúfar libre y se queda **6 000 ms**.
- [ ] La mosca nunca aparece en el nenúfar que tiene el cocodrilo.
- [ ] Llegar al nenúfar con mosca suma `200 × racha` **además** del bono de llegada: con racha ×1, **200**; con racha ×5, **1 000**.
- [ ] Llegar al nenúfar con mosca en la tercera llegada consecutiva con 20 s restantes suma exactamente **1 350** puntos.
- [ ] Subir de nivel y pulsar «JUGAR DE NUEVO» borran el cocodrilo y la mosca.
- [ ] El HUD sigue mostrando **Puntuación**, **Vidas**, **Nivel**, **Tiempo**, **Orilla** y **Racha**, sin ningún campo nuevo.
- [ ] El parpadeo de la tortuga, la aparición del cocodrilo y la órbita de la mosca **no** provocan ninguna llamada a `onSnapshot`.

### Guardado y leaderboard

- [ ] El modal de fin sigue guardando la puntuación real en `public.scores` con `game_id = 'ranaria'`.
- [ ] No se ha escrito ninguna consulta ni Server Action nueva.

### No regresión

- [ ] Todo lo que la SPEC JAM 01 fijó sigue cumpliéndose: 16×12 casillas, 30 s de temporizador en el nivel 1, 3 vidas, rana extra a 20 000, `1000 × nivel` por ronda y racha capada a ×5.
- [ ] Los cuatro carriles de carretera y las tres filas de troncos del río se comportan exactamente igual que antes de esta spec.
- [ ] `/juegos/rocas/jugar`, `/juegos/caida/jugar`, `/juegos/bloque-buster/jugar` y `/juegos/serpentina/jugar` siguen igual.
- [ ] `/juegos/gloton/jugar` mantiene el mock intacto.
- [ ] Responden 200: `/`, `/biblioteca`, `/juegos/ranaria`, `/salon`, `/about`, `/auth`.
- [ ] Salir de `/juegos/ranaria/jugar` y volver a entrar arranca una partida limpia, sin `rAF` ni listeners del render anterior.

## Decisiones

- **Las tortugas sustituyen a los troncos de las filas `4` y `2` conservando su geometría. No se añaden carriles.** Reutilizar `dir`, `speed`, `len` y `count` significa que la cruzabilidad del río, que la SPEC JAM 01 fijó por cobertura, no se toca: lo único nuevo es el ciclo temporal. Añadir carriles habría obligado a rediseñar las 12 filas del tablero, es decir, a reescribir el `01`.
- **Dos carriles sumergibles de cinco. No los cinco.** Con los cinco, el río deja de tener rutas fiables y el juego se vuelve una lotería de fases. Dos, alternados con troncos, dan al jugador un carril seguro entre cada dos peligrosos.
- **La fase de una balsa es una función pura de `elapsed`, `k` y el nivel. No un temporizador por balsa.** Sin estado por entidad no hay nada que sincronizar al pausar, al morir ni al subir de nivel, y el desfase entre balsas sale garantizado por construcción en vez de por azar.
- **Desfase `k × 7000 / count`. No fases aleatorias.** El azar puede sumergir dos balsas contiguas a la vez y dejar un tramo intransitable durante segundos. El reparto uniforme lo hace imposible.
- **La rana sigue sostenida durante el parpadeo.** El parpadeo es un aviso, no un castigo: sin ventana de reacción, la inmersión sería una muerte aleatoria y el jugador no aprendería el ciclo.
- **La rampa de dificultad alarga la inmersión, no acorta el ciclo.** Un ciclo más rápido haría el parpadeo ilegible; alargar la fase sumergida de 21 % a 43 % del ciclo endurece el río manteniendo el aviso en 1 500 ms constantes.
- **La tortuga sumergida se sigue dibujando. No desaparece.** Ver dónde está la balsa bajo el agua es lo que permite planificar el salto desde la mediana. Borrarla convertiría la anticipación en memoria.
- **Cocodrilo a partir del nivel 3. No desde el 1.** Los dos primeros niveles son donde el jugador aprende el río; añadirle una trampa en la meta desde el principio castiga el aprendizaje. El nivel 3 es también donde la inmersión ya se ha alargado y el juego pide una amenaza nueva.
- **El cocodrilo nunca ocupa el último nenúfar libre.** Es la única regla que impide una situación sin salida: con un solo hueco y el cocodrilo encima, el jugador solo podría esperar a que se fuera, gastando el temporizador sin poder hacer nada.
- **El cocodrilo mata pero no ocupa el nenúfar.** Si lo ocupara, una muerte costaría vida **y** ronda, un doble castigo que ningún otro juego del vault aplica.
- **La mosca vale `200 × racha`. No 200 fijos.** El multiplicador de racha es la palanca de puntuación de la SPEC JAM 01, y un bono plano al lado de llegadas de 1 150 puntos sería ruido. Escalarlo con la racha mantiene la economía coherente y premia la misma habilidad.
- **La mosca excluye el nenúfar del cocodrilo.** Un cebo sobre una trampa sería una encerrona, no una decisión.
- **El HUD no gana ningún `extra`.** Ya son tres, el máximo del vault. La mosca dura 6 000 ms y está pintada en el canvas, a la vista: un campo de texto que dijera «Mosca: sí» no añadiría información y sí una emisión de snapshot cada seis segundos.
- **Ninguna entidad nueva provoca emisiones de snapshot.** El parpadeo va a 4 Hz y la órbita de la mosca por frame; si cualquiera de las dos tocara el snapshot, el HUD volvería al problema de los 60 `setState`/s que el contrato prohíbe.
- **Tortuga, cocodrilo y mosca vectoriales. Sin sprites.** El repo sigue sin ningún asset de Frogger bajo `references/`, y el `01` ya fijó el juego como 100 % vectorial.
- **Serpiente sobre la mediana y rana escolta siguen fuera.** La serpiente elimina la única fila de descanso, que es la que hace legible el tablero; la escolta obliga a arrastrar un estado por todo el recorrido. Ninguna de las dos cabe en un incremento de un solo fichero.
- **Sin audio, sin táctil y sin teclas `P`/`Escape`.** Se mantienen las exclusiones de la SPEC JAM 01 por los mismos motivos.

## Riesgos

| Riesgo                                                                                    | Mitigación                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Tramo intransitable** si varias balsas de un carril se sumergen a la vez                | Desfase `k × 7000 / count` por construcción; criterio de aceptación que lo verifica                    |
| **Muerte percibida como injusta** al sumergirse la balsa sin aviso                        | Fase de parpadeo de 1 500 ms constante en todos los niveles, durante la cual la rana sigue sostenida   |
| **Situación sin salida** con el cocodrilo sobre el último nenúfar libre                   | El cocodrilo no aparece si solo queda un hueco; criterio de aceptación dedicado                        |
| **Doble castigo** si el cocodrilo, además de matar, ocupara el nenúfar                    | Aterrizar sobre él resta vida y deja el nenúfar libre; criterio explícito                              |
| **Cebo sobre trampa**: mosca y cocodrilo en el mismo nenúfar                              | La mosca elige entre nenúfares libres **y sin cocodrilo**; criterio explícito                          |
| `onSnapshot` disparado por el parpadeo o por la órbita de la mosca (60 `setState`/s)      | Ninguna entidad nueva toca el snapshot; criterio que lo verifica                                       |
| **Fase desincronizada tras una pausa larga**, con la balsa saltando de fase               | La fase deriva de `elapsed`, que solo avanza con el juego activo y con el `dt` capado a 50 ms del `01` |
| **Regresión de la cruzabilidad del río** al tocar dos de sus cinco carriles               | Las balsas heredan `dir`, `speed`, `len` y `count` del tronco que sustituyen; criterio explícito       |
| **Cocodrilo o mosca que sobreviven al cambio de ronda** y se quedan sobre la orilla nueva | Ambos se ponen a `null` al subir de nivel y en `restart()`; criterio de aceptación dedicado            |
| `rAF` y listeners que sobreviven al desmontaje                                            | Sin cambios en el ciclo de vida: se hereda el cleanup del paso 2 de la SPEC JAM 01                     |
| Estado mutable a nivel de módulo al añadir `croc` y `fly`                                 | Ambos viven dentro de `createGame`; criterio de estructura heredado del `01`                           |
| Regresión del mock al tocar `GamePlayerScreen`                                            | Esta spec **no toca** `GamePlayerScreen.tsx`; criterio con `/juegos/gloton/jugar` como testigo         |

## Lo que **no** entra en esta spec

- **Serpiente sobre la mediana.**
- **Rana escolta** que multiplique el bono de llegada.
- **Tortugas en las filas `5`, `3` y `1`** del río, que se quedan de tronco.
- **Entidades que se muevan dentro de su carril** en vez de a velocidad constante.
- **Audio.** Ni chapoteo, ni zumbido.
- **Sprites.** Todo sigue siendo vectorial.
- **Un `extra` nuevo en el HUD** para la mosca o el cocodrilo.
- **Controles táctiles, teclas `P`/`Escape` y multijugador.**
- **`best` y `plays` derivados** de las puntuaciones reales.
- **Promover esta spec a la serie numerada de `specs/`.**

_Cada uno de esos, si llega, va en su propia spec._
