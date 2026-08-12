# Plantilla de spec de juego

Especialización del `template.md` de `/spec` para juegos de Arcade Vault. Mismas secciones, pero con los apartados que toda spec de juego necesita ya nombrados, para que la spec generada salga con la forma de `specs/05-juego-asteroids-rocas.md`.

**No es texto para copiar literalmente** — es la forma que la spec debe respetar.

---

## Cabecera

```markdown
# SPEC NN — Adaptación del juego <Juego> (`<id>`) a la plataforma

> **Status:** Draft
> **Depends on:** SPEC 05 (contrato de juego y registro), SPEC 06 (catálogo y puntuaciones)
> **Date:** YYYY-MM-DD
> **Objective:** Una sola frase. Si necesitas dos, el juego es demasiado grande para una spec.
```

El estado se guarda **siempre en `Draft`**. Lo cambia el usuario a mano tras releerla.

---

## Alcance

Dos sub-bloques, **ambos obligatorios**.

En **Dentro** deben aparecer, además de lo específico del juego:

- El componente `app/_components/games/<Nombre>Game.tsx` y su `.module.css`.
- La línea del registro (`registry.ts`).
- La migración y el cover art, **solo si el id es nuevo**.
- La extensión del contrato a `types.ts` + HUD condicional, **solo si esta es la primera spec que lo necesita**.
- La no-regresión explícita del mock y de `rocas`.

En **Fuera** van las cosas que salieron en las preguntas y se aplazaron. Sin ese registro, durante la implementación habrá tentación de colarlas "ya que estamos". Candidatas habituales: audio, controles táctiles, multijugador, niveles extra, `best`/`plays` derivados, realtime.

---

## Modelo de datos

Tres bloques fijos:

**(a) Contrato con la plataforma.** Qué campos de `GameSnapshot` emite este juego y qué significan. Ejemplo:

```markdown
El juego emite `score`, `level` y `extra: [{ label: "Líneas", value }]`.
No emite `lives` — Tetris no tiene vidas, y el HUD omite ese hueco.
```

**(b) Constantes del juego**, portadas 1:1 desde la referencia y tipadas. Nombres y valores reales, no descripciones. Viven dentro del módulo del juego, no en `data/`.

**(c) Fila del catálogo.** O bien _"reutiliza el id `<x>`, ya sembrado: no hay migración"_, o bien la fila concreta de `public.games` (con `position`) y la nota de las 12 filas de siembra en `scores`.

---

## Plan de implementación

Pasos numerados. **Cada paso deja la app arrancable con `npm run dev` y es commiteable solo.** Si un paso pasa de 30–50 líneas, pártelo.

Orden canónico (sáltate los que no apliquen, no reordenes los que sí):

1. **Lógica pura a TypeScript, sin React.** Clases y utilidades tipadas dentro de `createGame(canvas, ctx, hooks)`. Verificación: `npx tsc --noEmit` pasa y el módulo no declara estado mutable fuera de la fábrica.
2. **Ciclo de vida React.** `forwardRef`, efecto de montaje con cleanup total, `useImperativeHandle` para `restart()`, efecto aparte para `paused`.
3. **Emisión de snapshot y game over.** Solo al cambiar un campo, comparando con el último emitido.
4. _(Si aplica)_ **Extensión del contrato:** extraer los tipos a `types.ts`, hacer opcionales `lives`/`level`, añadir `extra[]`, y volver condicional el HUD de `GamePlayerScreen`. Migrar el `tripleShot` de Asteroids a `extra`.
5. _(Si el id es nuevo)_ **Migración y cover:** `NNN_game_<id>.sql` aplicada con `apply_migration`, clase `.cover-<x>` en `globals.css` y entrada en la unión `CoverArt`.
6. **Registro.** La línea en `registry.ts`. Va **después** del componente: si no, el player importaría algo que aún no existe.
7. **Escalado del canvas** dentro del marco CRT, con CSS scopeado al módulo.
8. **Foco y teclado.** `preventDefault` solo con el juego activo; teclas soltadas al pausar.
9. **Prueba manual de extremo a extremo.** Partida completa, muerte, modal, guardado real, "JUGAR DE NUEVO", salir y volver a entrar.
10. **Pasada final.** `lint`, `tsc --noEmit`, `build`, `get_advisors`.

Cierra con un apartado corto de **"Apuntes sobre el orden"** justificando las dos o tres dependencias no obvias entre pasos.

---

## Criterios de aceptación

Checklist booleano, agrupado como en las SPEC 05/06. Cada ítem se responde con sí o no.

- **Build y calidad** — `build`, `lint`, `tsc`, consola sin errores de hidratación.
- **Estructura y registro** — los archivos existen, `"use client"`, sin estado de módulo, `getPlayableGame("<id>")` devuelve componente.
- **Juego real en `/juegos/<id>/jugar`** — mecánicas concretas y verificables: qué tecla hace qué, cuántos puntos da cada cosa, cuándo sube de nivel, cuándo termina la partida.
- **Catálogo y BD** _(si hay migración)_ — `list_tables`, `select count(*)`, `position` única, `get_advisors` limpio, la portada se ve en `/biblioteca`.
- **Guardado y leaderboard** — el modal guarda la puntuación real; aparece en `/juegos/<id>` y en `/salon`; con sesión lleva `display_name` y `user_id`.
- **No regresión** — `rocas` intacto, un juego mock intacto, rutas previas en 200, `globals.css` sin cambios salvo el cover declarado.

Antipatrones: ❌ "que funcione bien", ❌ "buena UX", ❌ "sin bugs". ✅ "Destruir un asteroide grande suma 100 puntos y lo parte en dos medianos".

---

## Decisiones

Pares **Sí** / **No** con motivo breve. Mínimos esperados en toda spec de juego:

- **Id del catálogo:** reutilizar uno sembrado vs. crear uno nuevo, y por qué.
- **Alcance del puerto:** portar la referencia completa vs. recortar. (En la SPEC 05 se decidió portar todo, incluido un power-up que el README no mencionaba.)
- **Campos del HUD:** cuáles emite y cuáles se omiten deliberadamente.
- **Excepción de `globals.css`**, si hay cover nuevo.
- **Exclusiones deliberadas:** por qué audio / táctil / multijugador quedan fuera.

Es la sección con más valor dentro de tres meses. Una decisión sin motivo es la primera que alguien cuestiona.

---

## Riesgos

Tabla `| Riesgo | Mitigación |`. Estos se repiten en casi todo juego — reutilízalos redactados y añade los propios del juego:

| Riesgo                                                             | Mitigación                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `rAF` y listeners que sobreviven al desmontaje (bucles fantasma)   | Cleanup completo en el efecto de montaje; criterio de aceptación explícito          |
| Estado global de módulo al portar el `game.js` original            | Todo dentro de `createGame`; criterio que lo prohíbe                                |
| Doble montaje de React Strict Mode en desarrollo                   | El cleanup hace el efecto idempotente: montar→desmontar→montar deja un solo juego   |
| `onSnapshot` llamado cada frame (60 `setState`/s)                  | Emitir solo al cambiar un campo, comparando con el último                           |
| `Space`/flechas scrollean la página o roban foco                   | `preventDefault` solo con el juego activo; `isTypingTarget` para el input del modal |
| `paused` en las deps del efecto de montaje reinicia la partida     | Efecto aparte que llama a `setPaused()`                                             |
| Salto de posición al volver de una pestaña en segundo plano        | Cap de `dt` a 50 ms                                                                 |
| `position` duplicada en `games` (índice único) al añadir el juego  | Consultar la última `position` antes de escribir la migración                       |
| Siembra no idempotente: reaplicar la migración duplicaría `scores` | Migración de creación única; no se ejecuta dos veces sobre el mismo proyecto        |
| Regresión del mock al tocar `GamePlayerScreen`                     | Solo se toca la rama del juego real; criterio que verifica un juego mock testigo    |

Si el juego no añade riesgos propios y ninguno de estos aplica, omite la sección.

---

## Lo que **no** entra en esta spec

Repetición final y explícita de las exclusiones del Alcance. Es deliberadamente redundante: sirve de recordatorio a quien lee solo las últimas líneas.

Cierra con: _"Cada uno de esos, si llega, va en su propia spec."_

---

## Reglas globales del documento

- **Una idea por frase.**
- **Nombres concretos.** Si dices "el registro", di `app/_components/games/registry.ts`.
- **Sin TODOs.** Un TODO en una spec es una decisión que no se tomó.
- **Sin código ejecutable largo.** Fragmentos cortos para ilustrar estructuras, no funciones completas.
- **Markdown estándar**, que renderice en GitHub sin sorpresas.
