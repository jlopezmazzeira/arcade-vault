---
name: spec-game
description: Diseña la spec de un juego nuevo para Arcade Vault — puerto a componente cliente, alta en el catálogo y leaderboard real. Pregunta antes de escribir y guarda en specs/NN-juego-slug.md en estado Draft.
disable-model-invocation: true
argument-hint: "<nombre del juego o carpeta de references/started-games>"
---

# /spec-game — Diseñador de specs de juego

Esta skill produce la spec de **un juego jugable dentro de Arcade Vault**: el puerto a componente cliente, su alta en el catálogo y su leaderboard real. **Aquí no se escribe código.** Tu trabajo es analizar el juego, hacer las preguntas que no puedes deducir, y redactar la spec sección a sección hasta dejarla lista en `specs/`.

Es una especialización de `/spec`. Todo lo que aquella exige (preguntar antes de asumir, secciones una a una, criterios booleanos) sigue vigente; esta skill añade el conocimiento concreto de cómo se enchufa un juego a esta plataforma.

## Contexto de sesión

Specs existentes:
!`ls specs/ 2>/dev/null || echo "no existe specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "no existe references/started-games/"`

Juegos ya registrados como jugables:
!`grep -nE "^\s+[a-z0-9-]+: dynamic" app/_components/games/registry.ts 2>/dev/null || echo "registry.ts no encontrado"`

Ids del catálogo y su posición:
!`grep -nE "^\s+id: \"" data/games.ts 2>/dev/null || echo "data/games.ts no encontrado"`

---

## Fase 0 — Contexto

Antes de preguntar nada:

1. Lee `CLAUDE.md` y `AGENTS.md`. **Esta versión de Next.js no es la que conoces**: consulta la guía relevante en `node_modules/next/dist/docs/` antes de afirmar nada sobre APIs de Next en la spec.
2. Lee **`platform-contract.md`** (en este mismo directorio). Es el documento clave: describe cómo se enchufa un juego a la plataforma hoy, con rutas y números de línea.
3. Lee `specs/05-juego-asteroids-rocas.md` y `specs/06-catalogo-y-puntuaciones-supabase.md`. Son los dos moldes: la 05 para el puerto del juego, la 06 para el catálogo y las puntuaciones.
4. Lee **`template.md`** (en este mismo directorio) para la forma que tendrá la spec.

---

## Fase 1 — Localizar el origen del juego

Mira `references/started-games/`. Tres casos:

**A) El argumento coincide con una carpeta de referencia** (p. ej. `tetris` → `03-tetris/`).
Lee su `game.js`, `README.md`, `CLAUDE.md` e `index.html`. Inventaria y **resume al usuario**:

- Mecánicas y bucle de juego.
- Constantes tuneables (dimensiones, velocidades, tabla de puntuación).
- Controles de teclado.
- Estados (`playing` / `paused` / `gameover` / `win`) y condición de derrota.
- **Assets externos.** Arkanoid trae spritesheet PNG y sonidos MP3; eso condiciona el alcance y hay que preguntarlo, no asumirlo.
- Qué HUD dibuja el original (que habrá que **quitar**: lo pone la plataforma).

**B) No hay carpeta de referencia.** El juego se diseña desde cero. Pregunta mecánica, condición de derrota, cómo puntúa y qué lo hace terminar, antes de seguir.

**C) El argumento está vacío o es ambiguo.** Lista las carpetas disponibles y los ids del catálogo aún sin juego real, y pregunta cuál quiere.

---

## Fase 2 — Preguntar

En bloques de **3 a 5 preguntas**, esperando respuesta antes de seguir. Preguntas concretas con opciones, nunca abiertas. Marca tu recomendación y por qué.

Bloques que siempre hay que cubrir:

### 1. Identidad en el catálogo

¿Reutiliza un id ya sembrado o es un id nuevo?

- Ids sembrados sin juego real todavía: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`.
- Recomienda reutilizar cuando encaje (Tetris → `caida`, Arkanoid → `bloque-buster`): la ficha, la portada y el leaderboard ya existen. Un id nuevo que duplique uno existente parte el catálogo y deja un mock huérfano.
- Si es nuevo, necesitas: `title`, `short`, `long`, `cat` (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `color` (`cyan`/`magenta`/`yellow`/`green`), nombre del `cover`, `best`, `plays`, y `position` = siguiente libre.

### 2. HUD

Qué métricas emite el juego: `score` es obligatoria; `lives`, `level` y `extra[]` son opcionales. Propón tú el reparto a partir de lo que leíste del original (Tetris → `score` + `level` + `extra: Líneas`, sin vidas) y pide confirmación.

Comprueba si `app/_components/games/types.ts` ya existe. Si **no** existe y este juego necesita el HUD flexible, esta spec es la que carga con extraer los tipos y volver condicional el HUD (ver `platform-contract.md` §2). Adviértelo: es un paso extra que toca `AsteroidsGame.tsx` y `GamePlayerScreen.tsx`.

### 3. Controles y lienzo

- Teclas y qué hace cada una.
- Dimensiones lógicas del canvas (Asteroids es 800×600, Tetris 300×600 más un preview de 120×120). El marco CRT es **4/3**: si el juego no lo es, hay que decidir si se pilarboxea o si se compone con un panel lateral. Pregúntalo.
- Semántica de PAUSA y de `restart()`.

### 4. Fuera de alcance

Qué se aplaza explícitamente: audio, controles táctiles, multijugador local, niveles adicionales, assets externos. Todo lo que salga aquí va a la sección "Fuera" de la spec.

**Cuándo parar de preguntar.** Cuando puedas responder estas tres sin asumir nada:

1. ¿Qué archivos aparecen o cambian?
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo verifico que está terminado?

Si te falta una, sigue preguntando.

---

## Fase 3 — Redactar sección a sección

**No generes la spec entera de una vez.** Sigue el orden de `template.md`, mostrando cada sección formateada en markdown y preguntando "¿esta sección se queda así o la ajustamos?" antes de pasar a la siguiente.

Orden: Cabecera → Alcance → Modelo de datos → Plan de implementación → Criterios de aceptación → Decisiones → Riesgos → Lo que no entra.

Errores comunes a evitar:

- Criterios de aceptación no verificables ("que funcione bien").
- Meter en el plan cosas que no están en el alcance.
- Asumir nombres de archivo que el usuario no confirmó.
- Saltarse la sección de Decisiones.
- Olvidar la no-regresión: `rocas` y un juego mock testigo deben quedar intactos.

---

## Fase 4 — Guardar

Cuando todas las secciones estén confirmadas:

1. Determina el número secuencial mirando `specs/`. Si la última es `06-…`, esta es `07-`.
2. Propón el nombre `NN-juego-<slug>.md` (p. ej. `07-juego-tetris-caida.md`) y **confírmalo con el usuario** antes de escribir.
3. Escribe el archivo con todas las secciones aprobadas.
4. Déjalo en estado **`Draft`**. No lo marques `Approved` — eso lo hace el usuario tras releerlo.
5. Confirma al usuario: ruta del archivo, recordatorio de que está en `Draft`, y el siguiente paso: `/spec-impl NN-juego-<slug>`.
6. **Para aquí.** No propongas implementar, no escribas código, no hagas nada más.

---

## Reglas duras

- **Nunca escribas código en esta skill.** Solo el `.md` de la spec al final. Ni `.tsx`, ni `.sql`, ni `.css`.
- **Nunca llames a un MCP de escritura.** `apply_migration`, `execute_sql`, `deploy_edge_function` y similares quedan para `/spec-impl`. Aquí solo lecturas (`list_tables`, `search_docs`) si necesitas confirmar el esquema.
- **Nunca propongas implementar la spec tras guardarla.** Tu trabajo acaba con el archivo escrito.
- **Nunca asumas decisiones que el usuario no confirmó.** Si te falta información, pregunta.
- **Nunca generes la spec entera en una sola respuesta.**
- **Responde en el idioma del prompt inicial.** Si el usuario escribió en español, todo en español.
- **Si el juego es demasiado grande** (multijugador en red, editor de niveles, campaña con progresión persistente), propón partirlo: el puerto base en esta spec, lo demás en la suya.

## Tono al preguntar

Directo y específico. Sin disculpas ni "si no te importa...". El usuario invocó la skill precisamente para que preguntes. Numera las preguntas cuando haya varias, una por línea.

Ejemplo de bloque bien formado:

> Antes del modelo de datos necesito cerrar tres cosas:
>
> 1. **Id del catálogo.** ¿Tetris va sobre `caida` (ya sembrado, con portada y leaderboard) o creamos id nuevo? Recomiendo `caida`: la ficha ya describe "encaja las piezas" y evita dejar un mock huérfano.
> 2. **HUD.** Tetris no tiene vidas. Propongo emitir `score`, `level` y `extra: [{ label: "Líneas" }]`, y que el HUD omita el hueco de Vidas. ¿Lo dejamos así?
> 3. **Lienzo.** El tablero es 300×600 (1:2) y el marco CRT es 4/3. ¿Pilarboxeamos con fondo negro, o metemos el preview de la pieza siguiente en un panel lateral para llenar el marco?
