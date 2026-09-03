# Memoria de game-planner

Registro acumulativo de juegos valorados para Arcade Vault. Lo escribe el agente
`game-planner` (`.claude/agents/game-planner.md`); es **append-only**: las entradas
no se reescriben ni se borran, solo cambian de estado.

Existe sobre todo por lo **descartado**: un juego rechazado no deja ningúna huella en
el código, así que sin este fichero volvería a proponerse en cada ronda.

Estados: `propuesto` · `aceptado` · `descartado` · `implementado`.

| Fecha      | Juego     | Id destino     | Estado       | Razón / veredicto |
| ---------- | --------- | -------------- | ------------ | ----------------- |
| 2026-09-03 | Asteroids | rocas          | implementado | SPEC 05 — primer juego real de la plataforma |
| 2026-09-03 | Tetris    | caida          | implementado | SPEC 07 — cubrió PUZZLE |
| 2026-09-03 | Arkanoid  | bloque-buster  | implementado | SPEC 08 |
| 2026-09-03 | Snake     | serpentina     | implementado | SPEC 09 |
| 2026-09-03 | Space Invaders | invasores | propuesto | Ronda 1 — ganador: 4/3 nativo, score clásico de techo alto, reparte hacia SHOOTER, sin migración |
| 2026-09-03 | Pac-Man | gloton | descartado | Ronda 1 — ARCADE ya sobrerrepresentado (2 de 4 jugables) y laberinto vertical que obliga a pilarbox. Descarte de ronda, reevaluable cuando ARCADE deje de acumular |
| 2026-09-03 | Frogger | ranaria | descartado | Ronda 1 — mismo exceso de ARCADE y el techo de score más bajo de la ronda (avance por filas, partidas largas por punto). Descarte de ronda, reevaluable |
| 2026-09-03 | Pong | duelo-pixel | descartado | Ronda 1 — DESCARTE DURO por criterio 2: produce marcador de partida (best 24), no score creciente comparable; satura el leaderboard. No reevaluable sin replantear su modo de puntuación |
| 2026-09-03 | Space Invaders | invasores | propuesto | Ronda 2 bloque A — RATIFICA la propuesta de ronda 1, que seguía sin implementar. Gana los tres criterios: 4/3 nativo, HUD entero en GameSnapshot, score acumulativo de techo alto, lleva SHOOTER de 1 a 2 y no necesita migración |
| 2026-09-03 | Columns | columnas (nuevo) | descartado | Ronda 2 bloque A — acumula en PUZZLE y solapa de forma con `caida`, pagando id nuevo con 4 ids sembrados libres. Descarte de ronda |
| 2026-09-03 | Pac-Man | gloton | descartado | Ronda 2 bloque A — reconsiderado a petición; la condición de reapertura de ronda 1 (que SHOOTER o VERSUS equilibren) NO se cumple porque `invasores` sigue en mock. Reapertura reforzada: candidato preferente en cuanto `invasores` sea jugable |
| 2026-09-03 | Tron Light Cycles | estelas (nuevo) | descartado | Ronda 2 bloque A — DESCARTE DURO por criterio 2: rondas ganadas es marcador de partida, no score creciente. Precedente Pong. Agravante: id nuevo redundante con `duelo-pixel`, ya sembrado en VERSUS |
| 2026-09-03 | 2048 | dos-mil (nuevo) | descartado | Ronda 2 bloque B — ganó su bloque pero pierde el arbitraje cruzado contra `burbujas`: partidas de 10-20 min (no cortas), convergencia de expertos que comprime la cabeza del ranking, y es de 2014, ajeno a la ficción de recreativa del catálogo. Descarte de ronda |
| 2026-09-03 | Galaga | enjambre (nuevo) | descartado | Ronda 2 bloque B — mejor score de su bloque, pero sería el 3.er SHOOTER y el SEGUNDO juego de formación alienígena descendente con `invasores` aún sin implementar. Descarte de ronda |
| 2026-09-03 | Frogger | ranaria | descartado | Ronda 2 bloque B — reconsiderado a petición; las dos patas del descarte de ronda 1 (exceso de ARCADE y techo de score bajo) siguen vigentes sin cambio. Se mantiene |
| 2026-09-03 | Pong (modo rally) | duelo-pixel | descartado | Ronda 2 bloque B — DESCARTE DURO LEVANTADO A BLANDO. El rally 1P vs CPU sí convierte el marcador en score acumulativo e ilimitado: el defecto del criterio 2 queda atacado de verdad. No gana por dos frentes: la curva de dificultad hay que diseñarla (deja de ser un port) y el 2P local que promete la ficha no puede alimentar el leaderboard, porque `saveScore` es genérico por game_id y no conoce modos. Candidato VIVO y favorito de ronda 3 si una spec fija el rally como único modo puntuable |
| 2026-09-03 | Centipede | ciempies (nuevo) | descartado | Ronda 2 bloque C — ganó su bloque, pero pierde el arbitraje cruzado: es SHOOTER como `invasores`, que va primero, y su propio agente avisó de que si `invasores` aterriza antes, SHOOTER pasa a 3 y su criterio 3 se invierte. Descarte de ronda, candidato fuerte cuando SHOOTER deje de acumular |
| 2026-09-03 | Puyo Puyo | cascada (nuevo) | descartado | Ronda 2 bloque C — redundante frente a `caida` no solo en categoría sino en forma: misma silueta de pieza que cae en grilla vertical, mismo encuadre, mismo HUD, misma portada. Descarte por redundancia |
| 2026-09-03 | Q*bert | piramide (nuevo) | descartado | Ronda 2 bloque C — tercer ARCADE, y estrictamente peor que `gloton` y `ranaria` porque suma a la misma saturación Y ADEMÁS gasta id nuevo mientras ellos siguen sembrados. Descarte de ronda, por detrás de `gloton` |
| 2026-09-03 | Warlords | muralla (nuevo) | descartado | Ronda 2 bloque C — DESCARTE DURO por criterio 2: eliminación por rondas, marcador de partida. Precedente Pong. Sería el primer VERSUS, pero el criterio 3 no rescata a quien falla el 2 |
| 2026-09-03 | Puzzle Bobble | burbujas (nuevo) | propuesto | Ronda 2 bloque D — GANADOR CRUZADO de la ronda para el hueco de id nuevo. Teclado puro (cabe en §6 sin ampliarlo, y no hay una sola línea de puntero en el repo), panel lateral llena el 4/3 con el precedente de Tetris, score acumulativo con cascada exponencial sobre niveles de techo descendente, y lleva PUZZLE de 1 a 2 |
| 2026-09-03 | Missile Command | defensa-total (nuevo) | descartado | Ronda 2 bloque D — score excelente y 4/3 nativo, pero estrena input de puntero: el §6 es teclado puro, no hay equivalente de "soltar teclas al pausar" para el ratón, ni está resuelto el solape de pointerdown con los botones del HUD ni el mapeo contra el canvas escalado por DPR. Reevaluable si una spec valida antes el patrón de puntero |
| 2026-09-03 | Dig Dug | subsuelo (nuevo) | descartado | Ronda 2 bloque D — mejor encaje técnico de su bloque, pero tercer ARCADE gastando id nuevo mientras `gloton` y `ranaria`, sembrados, esperan descartados por ese mismo exceso. Descarte de ronda |
| 2026-09-03 | Endless flappy | aleteo (nuevo) | descartado | Ronda 2 bloque D — criterio 2: +1 por obstáculo es granularidad tan baja que los humanos se apelotonan entre 0 y 50 y el top-10 acaba ordenado por `created_at`, es decir por hora de llegada y no por habilidad. Defecto de Pong atenuado pero vivo, más dificultad plana. Único no-clásico, rompe la identidad retro. No reevaluable sin replantear su puntuación |
| 2026-09-03 | Bejeweled (match-3) | gemas (nuevo) | descartado | Ronda 2 bloque E — ganó su bloque, pero pierde el arbitraje cruzado contra `burbujas`, que cubre el mismo hueco de PUZZLE sin su fricción de input: match-3 es de puntero por naturaleza y necesitaría cursor de teclado añadido. Descarte de ronda, alternativa directa si `burbujas` se cae |
| 2026-09-03 | Defender | guardian (nuevo) | descartado | Ronda 2 bloque E — mejor score de toda la ronda y el único al que el 4/3 no estorba, pero el radar NO CABE en `extra[]`, que es {label,value} de texto: obligaría a pintar HUD dentro del canvas contra el §1. Más cámara con scroll/wrap (todo lo portado es pantalla fija) y tercer SHOOTER. Reevaluable si se acepta el radar como elemento diegético |
| 2026-09-03 | Donkey Kong | escalada (nuevo) | descartado | Ronda 2 bloque E — ARCADE de 2 a 3; su 3/4 vertical fuerza pilarbox con ~44 % del ancho muerto; primer plataformas con gravedad y escaleras sin precedente en el repo; y ÚNICO candidato que depende de sprites reales, cuando los cuatro portados se sostienen con vectores, bloques o grilla. Descarte de ronda |
| 2026-09-03 | 1942 (shmup vertical) | escuadron (nuevo) | descartado | Ronda 2 bloque E — aprueba criterios 1 y 2 con nota, cae por redundancia: tercer SHOOTER y segundo bucle "cañón abajo disparando a formaciones que bajan" tras `invasores`. La entrada más previsible del catálogo |

## Detalle

### Siembra inicial — 2026-09-03

Las cuatro entradas de arriba se registran retroactivamente al crear el agente, a
partir de `app/_components/games/registry.ts` y de las specs 05/07/08/09. No hubo
ronda de evaluación: son hechos, no decisiones de este agente.

Ids del catálogo aún sin juego real en este momento: `gloton`, `invasores`,
`ranaria`, `duelo-pixel`.

### Ronda 1 — 2026-09-03

Primera ronda real de evaluación del agente. Estado de partida: 4 ids jugables
(`rocas`, `caida`, `bloque-buster`, `serpentina`) y 4 aún en mock (`gloton`,
`invasores`, `ranaria`, `duelo-pixel`). Reparto jugable: ARCADE 2, PUZZLE 1,
SHOOTER 1, VERSUS 0. Material de `references/started-games/` ya consumido por
completo (02-asteroids, 03-tetris, 04-arkanoid); ningún candidato de esta ronda
parte de código previo, igual que ocurrió con Snake.

Candidatos evaluados: los 4 ids del catalogo que siguen en mock. No se propuso
ningún id nuevo: con cuatro huecos sembrados, inventar id solo añadiría
migración, clase `.cover-<x>` y entrada en `CoverArt` sin ganar nada.

**Veredicto: Space Invaders -> `invasores`.** Único candidato que gana en los
tres criterios a la vez. Contrato: 4/3 nativo (no hay que decidir pilarbox ni
panel lateral, a diferencia de `gloton` y `ranaria`), HUD que cae entero en
`GameSnapshot` (`score` + `lives` + `level` como oleada, `extra` opcional para
la formacion), y el bucle es el mismo patrón de entidades/balas/colisiones ya
resuelto en `AsteroidsGame.tsx`, sin assets, audio ni red. Score: acumulativo
clásico (30/20/10 por fila + OVNI de bonus) con oleadas infinitas de dificultad
creciente, techo alto y partidas cortas. Equilibrio: lleva SHOOTER de 1 a 2 en
vez de llevar ARCADE de 2 a 3.

**Descartes razonados:**

- **Pac-Man (`gloton`)** — el mejor score de la ronda junto al ganador (cadena
  de fantasmas 200/400/800/1600, frutas, techo altísimo), pero pierde en los
  otros dos criterios: es el tercer ARCADE de cuatro juegos y su laberinto es
  vertical, así que arrastra la decision de encuadre del §7 del contrato. Se
  registra como descarte **de ronda**, no definitivo: en cuanto SHOOTER o
  VERSUS equilibren el reparto, vuelve a ser el candidato más fuerte.
- **Frogger (`ranaria`)** — encaja tecnicamente (carriles de velocidad
  constante, colisión AABB, `extra` para el temporizador) pero suma el mismo
  exceso de ARCADE y su puntuación es la más floja: avance por filas y bonus de
  tiempo dan un goteo lento con techo bajo. No es motivo de descarte por si
  solo —el número sí es comparable— pero pierde contra `invasores` en el
  criterio 2. Descarte de ronda, reevaluable.
- **Pong (`duelo-pixel`)** — descarte duro. Es el candidato más atractivo por
  equilibrio (sería el único VERSUS) y el más simple de portar, pero su
  resultado es un marcador de partida, no una puntuación creciente: `best: 24`
  en el catalogo frente a los 184.220 de `caida` lo delata. Un leaderboard que
  se satura en 11-0 no ordena a nadie, y el modo local a dos jugadores no tiene
  autor único para la fila del ranking. El criterio 2 lo declara motivo de
  descarte, no matiz. Volver a proponerlo exige antes replantear cómo puntúa.

Nota sobre el coste, como dato informativo y no como criterio: ningúno de los
cuatro necesitaba migracion ni clase de portada (los 8 ids ya están sembrados
por `001_games.sql`), y el orden de esfuerzo real era Pong < Frogger <
Invaders < Pac-Man. No influyó en el veredicto.

### Ronda 2 — lista corta de 20 candidatos — 2026-09-03

Los 20 juegos que el usuario puso sobre la mesa para esta ronda, registrados **antes**
de los veredictos para que no se pierdan: 16 de ellos son ids nuevos y, si se
descartan, no dejarían ninguna otra huella en el repo.

Estado `candidato` = en evaluación, todavía sin veredicto. No es uno de los cuatro
estados de la tabla principal: esas filas solo se escriben cuando hay decisión.

La ronda se ejecutó con 5 agentes `game-planner` en paralelo, uno por bloque de 4,
cada bloque mezclando categorías para forzar trade-off real. Ninguno escribió este
fichero (5 escrituras simultáneas sobre un append-only lo corromperían): devolvieron
sus filas como texto y se consolidan en un único append posterior.

| Bloque | Juego | Id destino | Nuevo | Cat | Nota |
| ------ | ----- | ---------- | ----- | --- | ---- |
| A | Space Invaders | `invasores` | no | SHOOTER | Ya `propuesto` en ronda 1; se revalida |
| A | Columns | `columnas` | **sí** | PUZZLE | |
| A | Pac-Man | `gloton` | no | ARCADE | Reevaluación de descarte de ronda 1, pedida por nombre |
| A | Tron Light Cycles | `estelas` | **sí** | VERSUS | |
| B | Galaga | `enjambre` | **sí** | SHOOTER | |
| B | 2048 | `dos-mil` | **sí** | PUZZLE | |
| B | Frogger | `ranaria` | no | ARCADE | Reevaluación de descarte de ronda 1, pedida por nombre |
| B | Pong (modo rally) | `duelo-pixel` | no | VERSUS | Reevaluación del **descarte duro**: ¿arregla el rally el score no comparable? |
| C | Centipede | `ciempies` | **sí** | SHOOTER | |
| C | Puyo Puyo | `cascada` | **sí** | PUZZLE | Riesgo de redundancia con `caida` |
| C | Q*bert | `piramide` | **sí** | ARCADE | Isométrico: arrastra §7 (encuadre CRT) |
| C | Warlords | `muralla` | **sí** | VERSUS | Riesgo de marcador de partida, como Pong |
| D | Missile Command | `defensa-total` | **sí** | SHOOTER | Requiere puntero, rompe el input solo-teclado |
| D | Puzzle Bobble | `burbujas` | **sí** | PUZZLE | |
| D | Dig Dug | `subsuelo` | **sí** | ARCADE | |
| D | Endless flappy | `aleteo` | **sí** | ARCADE | No es clásico de recreativa: encaje de identidad dudoso |
| E | Defender | `guardian` | **sí** | SHOOTER | Scroll lateral + radar: arrastra §7 y `extra[]` |
| E | Bejeweled | `gemas` | **sí** | PUZZLE | |
| E | Donkey Kong | `escalada` | **sí** | ARCADE | Plataformeo: patrón nuevo, no portado aún |
| E | Shmup vertical (1942) | `escuadron` | **sí** | SHOOTER | Riesgo de redundancia con `rocas` e `invasores` |

Recordatorio de coste para los 16 ids nuevos (dato informativo, **no** criterio): cada
uno exige migración `supabase/migrations/NNN_game_<id>.sql` con `position` libre, clase
`.cover-<x>` en `globals.css` y entrada en la unión `CoverArt` de `data/games.ts` (§5
del contrato). Los 4 ids existentes no exigen nada de eso.

### Ronda 2 — veredictos consolidados — 2026-09-03

Ronda ejecutada por **cinco agentes `game-planner` en paralelo**, uno por bloque de 4
candidatos (los 20 de la lista corta de arriba). Ningún agente escribió este fichero;
devolvieron sus filas como texto y el agente principal consolidó en este único append.
Cada bloque mezclaba categorías para forzar trade-off real dentro del bloque.

**Reconciliación previa:** `registry.ts` sigue con los mismos 4 ids. Ninguna entrada
pasa a `implementado`. Reparto jugable sin cambios desde la ronda 1: ARCADE 2 ·
PUZZLE 1 · SHOOTER 1 · VERSUS 0.

#### Ganadores por bloque y arbitraje cruzado

| Bloque | Ganador del bloque | Cat | Resultado del arbitraje |
| ------ | ------------------ | --- | ----------------------- |
| A | Space Invaders → `invasores` | SHOOTER | **GANADOR DE LA RONDA** |
| B | 2048 → `dos-mil` | PUZZLE | Descartado en el cruce |
| C | Centipede → `ciempies` | SHOOTER | Descartado en el cruce |
| D | Puzzle Bobble → `burbujas` | PUZZLE | **SEGUNDO**, para el hueco de id nuevo |
| E | Bejeweled → `gemas` | PUZZLE | Descartado en el cruce |

Los cinco ganadores se repartieron en solo **dos categorías** (SHOOTER y PUZZLE).
Ningún bloque logró desbloquear VERSUS: los dos que lo intentaron —Tron (`estelas`,
bloque A) y Warlords (`muralla`, bloque C)— cayeron en descarte duro por el mismo
motivo exacto que Pong en la ronda 1. **VERSUS no está vacío por falta de candidatos,
sino porque el género produce marcadores de partida y no scores crecientes.** La única
vía abierta es la que dejó el bloque B al levantar el descarte de Pong: un modo de
puntuación rediseñado.

**Arbitraje: `invasores` primero.** No por ser mejor que `ciempies` o `burbujas`, sino
porque es una **deuda de la ronda 1 que distorsiona el criterio 3 de todos los demás**.
Cuatro de los cinco bloques tuvieron que razonar alrededor de él: C dejó el caveat
explícito de que si `invasores` aterriza antes, SHOOTER pasa a 3 y su propio veredicto
se invierte; B descartó Galaga por duplicar su subgénero; D descartó Missile Command
por apilarse sobre él; E lo contó como comprometido y concluyó que PUZZLE era la única
categoría infrarrepresentada desbloqueada. Mientras siga propuesto y sin implementar,
toda ronda futura evalúa el equilibrio sobre datos falsos. Además consume un id ya
sembrado: cero migración, cero `position`, cero portada.

**Segundo, `burbujas`.** De los tres candidatos PUZZLE con id nuevo, gana por input y
por escalado. Es teclado puro (ángulo con flechas, disparo con Space) y cabe en el §6
sin ampliarlo — hecho verificado: no hay una sola línea de `pointerdown`/`pointermove`
en los cuatro `*Game.tsx`. `gemas` es de puntero por naturaleza y necesitaría cursor de
teclado añadido; `dos-mil` tiene partidas de 10-20 minutos, cabeza de ranking comprimida
por convergencia de expertos, y es de 2014. Los tres resuelven el 4/3 con el mismo panel
lateral que validó Tetris.

#### Hallazgos de plataforma (valen más allá de esta ronda)

1. **`extra[]` no admite gráficos.** Es `{ label: string; value: string }[]`: texto
   plano. Cualquier juego con minimapa, radar o scanner (Defender, y por extensión
   cualquier shooter con vista de mundo) no puede representarlo en el HUD y obligaría a
   pintarlo dentro del canvas, contra la regla del §1. Es una excepción defendible como
   elemento diegético, pero **ninguna spec la ha validado todavía**.
2. **El input de puntero no existe en la plataforma.** Cero ocurrencias en los cuatro
   juegos. Estrenarlo no es añadir un listener: hay que mapear coordenadas de cliente a
   lógicas contra un canvas escalado por DPR y `ResizeObserver`, decidir el equivalente
   de «al pausar se sueltan todas las teclas», y resolver el solape de `pointerdown` con
   los botones del HUD. Bloquea de facto a Missile Command y encarece cualquier match-3.
3. **`types.ts` YA está extraído.** `app/_components/games/types.ts` existe con el HUD
   flexible. El «estado objetivo» del §2 del contrato ya es el estado actual: ninguna
   spec nueva carga ese paso. Dos bloques lo dieron por pendiente y se equivocaban.
4. **La granularidad del score es un criterio, no solo su techo.** `getTopScores` ordena
   por `score desc, created_at asc`, así que un juego de puntuación gruesa (+1 por
   obstáculo) llena el top-10 de empates que acaban ordenados por hora de llegada. Es el
   defecto de Pong en versión atenuada, y descartó a `aleteo`.
5. **Gastar id nuevo en una categoría saturada es doblemente incoherente**, porque
   `gloton` y `ranaria` están sembrados y descartados por ese mismo exceso. Hundió a
   `piramide`, `subsuelo` y `escalada` con el mismo argumento en tres bloques distintos.

#### Estado de recursos para el siguiente id nuevo

Siguiente migración libre: **`003_*`** (existen `001_games.sql` y `002_scores.sql`).
Siguiente `position` libre: **8** (0..7 sembradas, con índice único
`games_position_idx`: dos ids nuevos a la vez requieren 8 y 9). Los cinco bloques
reclamaron `003` y `position 8` a la vez; queda arbitrado aquí a favor de `burbujas`,
que es el único id nuevo que sigue vivo.

#### Handoff

```
1.  /spec-game Space Invaders     (id `invasores`, ya sembrado, sin migración)
2.  /spec-game Puzzle Bobble      (id `burbujas`, NUEVO: 003 + position 8 +
                                   .cover-burbujas + unión CoverArt)
```

Reevaluables en ronda 3, por orden de fuerza: `gloton` (Pac-Man, preferente en cuanto
`invasores` sea jugable), `duelo-pixel` (Pong rally, si una spec fija el rally como
único modo puntuable — desbloquearía VERSUS), `ciempies`, `gemas`, `guardian`.
