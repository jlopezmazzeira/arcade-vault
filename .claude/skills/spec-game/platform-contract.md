# Contrato de plataforma — cómo se enchufa un juego a Arcade Vault

Referencia que consulta la skill `/spec-game`. Describe la fontanería que dejaron montada la **SPEC 05** (juego real de Asteroids) y la **SPEC 06** (catálogo y puntuaciones en Supabase).

**Idea central:** añadir un juego ya no requiere inventar arquitectura. El HUD, el marco CRT, el modal de fin, el guardado de puntuación y los leaderboards son **genéricos por `game_id`**. Un juego nuevo aporta: un componente cliente, una línea en el registro y —si su id no está en el catálogo— una migración.

---

## 1. El componente de juego

Vive en `app/_components/games/<Nombre>Game.tsx`, con su CSS scopeado al lado en `<Nombre>Game.module.css`. El molde exacto es `app/_components/games/AsteroidsGame.tsx` (826 líneas). Reglas no negociables:

- Empieza con `"use client"`.
- **Cero estado mutable a nivel de módulo.** Solo constantes, utilidades puras y clases. Todo el estado de la partida vive dentro de una fábrica:

  ```ts
  function createGame(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    hooks: GameHooks,
  ): GameController; // { start, stop, restart, setPaused }
  ```

  Motivo: React 19 en `strict` monta el efecto dos veces en desarrollo. Con estado de módulo, el segundo montaje hereda basura del primero.

- El efecto de montaje crea el juego, lo arranca y **en el cleanup lo detiene**: `cancelAnimationFrame`, `removeEventListener` de teclado y `ResizeObserver.disconnect()`. Sin esto quedan bucles vivos al navegar fuera (score fantasma, doble disparo).
- Los callbacks (`onSnapshot`, `onGameOver`) entran por **refs espejo**, no por dependencias del efecto — si no, cada render recrea la partida.
- `paused` se propaga en un `useEffect` **aparte** que llama a `setPaused()`. Si `paused` estuviera en las deps del efecto de montaje, cada pausa reiniciaría la partida.
- `restart()` se expone con `useImperativeHandle` sobre `forwardRef`. Es una orden puntual, no un estado.
- **Cap de `dt` a 50 ms** en el bucle. Al volver de una pestaña en segundo plano, un `dt` enorme teletransporta las entidades.
- El canvas **solo dibuja entidades**. El HUD, el overlay de PAUSA y el modal de fin los pone la plataforma. Dos HUD compitiendo es el error clásico al portar un juego vanilla.

---

## 2. El contrato juego ↔ plataforma

### Estado actual

Los tipos viven hoy dentro de `app/_components/games/AsteroidsGame.tsx` (líneas 21–41) y los importan `registry.ts:12` y `GamePlayerScreen.tsx:14`. `GameSnapshot` es rígido: exige `score`, `lives`, `level`, `status` y `tripleShot` — campos calcados de Asteroids que no aplican a otros juegos (Tetris no tiene vidas; Pong no tiene niveles).

### Estado objetivo

Los tipos se extraen a **`app/_components/games/types.ts`** y `GameSnapshot` pasa a tener el HUD flexible:

```ts
export type PlayableStatus = "playing" | "dead" | "gameover";

export type GameSnapshot = {
  score: number; // única métrica obligatoria
  status: PlayableStatus;
  lives?: number; // el HUD omite "Vidas" si no viene
  level?: number; // el HUD omite "Nivel" si no viene
  extra?: { label: string; value: string }[]; // Líneas, Marcador, Poder…
};

export type PlayableGameProps = {
  paused: boolean;
  onSnapshot: (s: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

export type PlayableGameHandle = { restart: () => void };
```

**Quién hace esta extracción:** la **primera spec generada que la necesite** debe incluirla como un paso propio de su plan; las specs posteriores ya solo consumen `types.ts`. Ese paso implica:

1. Crear `types.ts` con los tipos y hacer que `AsteroidsGame.tsx` los **re-exporte**, para no romper los imports existentes de `registry.ts` ni de `GamePlayerScreen.tsx`.
2. Migrar el `tripleShot: number` de Asteroids a una entrada de `extra` (`{ label: "Poder", value: "3× TRIPLE" }`), sustituyendo el bloque condicional de `GamePlayerScreen.tsx:116-123`.
3. Hacer condicional el HUD de `GamePlayerScreen.tsx:96-124`: `Vidas` y `Nivel` solo se pintan si el snapshot trae el campo; `extra` se mapea a `hud-stat` adicionales.
4. Ajustar `INITIAL_SNAPSHOT` (`GamePlayerScreen.tsx:48-54`) para que el estado inicial no invente vidas ni niveles que el juego no tenga.

**Regla de emisión:** el juego llama a `onSnapshot` **solo cuando cambia un campo**, comparándolo con el último emitido. Emitir cada frame son 60 `setState`/s y degrada el HUD.

---

## 3. El registro

`app/_components/games/registry.ts` — una línea:

```ts
export const PLAYABLE_GAMES: Record<string, PlayableGame> = {
  rocas: dynamic(() => import("./AsteroidsGame")),
  caida: dynamic(() => import("./TetrisGame")), // ← el juego nuevo
};
```

Registrar un id **conmuta automáticamente** `GamePlayerScreen` de la rama mock a la real (`GamePlayerScreen.tsx:29-40`). No hay que tocar el player por juego.

La carga es diferida con `next/dynamic`: el código del juego no entra en el bundle de las rutas que no lo juegan.

Los ids **sin** entrada en el registro siguen viendo el mock (ticker de score falso, enemigos CSS, guardado por toast). Esa rama —`MockGamePlayer`, `GamePlayerScreen.tsx:285-422`— es el seguro de no-regresión: **no se toca**.

---

## 4. Leaderboard y guardado: nada que escribir por juego

Ya son genéricos por `game_id`:

| Pieza                                      | Qué hace                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/data/scores.ts` → `getTopScores`      | Top-N por `game_id`, `score desc, created_at asc`. Alimenta el aside de `/juegos/[id]` y las pestañas de `/salon`                        |
| `lib/data/games.ts` → `getGame/getGames`   | Catálogo desde `public.games`, ordenado por `position`                                                                                   |
| `app/juegos/[id]/actions.ts` → `saveScore` | Server Action del modal de fin. Con sesión ignora el nombre del formulario y usa `display_name` + `user_id`; de invitado, `user_id null` |

Con solo registrar el juego, el modal de fin pasa a guardar de verdad con la puntuación real de la partida. **No se escribe ninguna consulta nueva.**

---

## 5. Alta en el catálogo (solo si el id es nuevo)

Los 8 ids ya sembrados: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`. Si el juego encaja en uno, **no hay migración**: solo componente + registro.

Si el id es nuevo, hace falta `supabase/migrations/NNN_game_<id>.sql` con el formato de `002_scores.sql`:

```sql
insert into public.games (id, position, title, short, long, cat, cover, color, best, plays)
values ('pong-neon', 8, 'PONG NEÓN', '…', '…', 'VERSUS', 'cover-pong', 'cyan', 0, '0');

insert into public.scores (game_id, user_id, player_name, score, created_at) values
  ('pong-neon', null, 'RGB_QUEEN', 275088, '2026-05-20T00:00:00Z'),
  …  -- 12 filas
```

- **`position` = siguiente libre.** Hay un índice único `games_position_idx`; una posición repetida hace fallar la migración.
- **Siembra de `scores`:** 12 filas con `user_id null`, generadas con la lógica de `seededScores` (`data/games.ts:120-155`), para que el ranking no arranque vacío.
- **`best` y `plays` son estáticos**, no derivados de `scores` (decisión de la SPEC 06).
- La migración se aplica con el MCP `apply_migration` **durante `/spec-impl`**, nunca al escribir la spec.

### Cover art

Un id nuevo necesita dos cosas:

1. Una clase `.cover-<x>` en `app/globals.css` (las ocho existentes están entre las líneas 428 y 540; son gradientes CSS puros con `::before`/`::after`, sin imágenes).
2. Una entrada en la unión `CoverArt` de `data/games.ts:6-14`.

Esto es una **excepción explícita** a la regla "no tocar `globals.css`" de las SPEC 05/06: esa regla protege el chrome de la pantalla de juego, y las portadas del catálogo ya viven ahí desde la SPEC 01. La spec generada debe declarar la excepción en su sección de Decisiones.

---

## 6. Teclado y foco

Portado de `AsteroidsGame.tsx:402-700`, se repite en cada juego:

- **`isTypingTarget(e.target)`** — si el foco está en un `input` (las iniciales del modal de fin), el juego no toca la tecla.
- **`preventDefault` solo con el juego activo** (`isActive()`: ni en pausa ni en game over). Si no, `Space` y las flechas scrollean la página; y en pausa el juego seguiría capturando teclas.
- Al pausar se **sueltan todas las teclas** (`keys[code] = false`), para que no queden pegadas al reanudar.
- Los botones del HUD hacen `e.currentTarget.blur()` tras el clic (`GamePlayerScreen.tsx:128-133`), para que el disparo no reactive el botón por accidente.
- Los listeners se atan a `window` en `start()` y se quitan en `stop()`.

---

## 7. Escalado del canvas dentro del CRT

Patrón de `AsteroidsGame.module.css`:

```css
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
.canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
```

- El contenedor `.crt-screen` de `globals.css:654` ya impone `position: relative`, `aspect-ratio: 4/3` y `overflow: hidden`.
- El búfer del canvas se redimensiona a la **resolución real × DPR** (capado a 2) con un `ResizeObserver`, y el contexto se escala — así el navegador no reescala el bitmap y las líneas quedan nítidas (`AsteroidsGame.tsx:640-660`).
- Las **coordenadas lógicas del juego no cambian**: solo escala la presentación.
- Si el juego no es 4/3 (Tetris es 1/2), hay que decidir en la spec si se pilarboxea dentro del marco o si se compone con un panel lateral (preview de pieza) para llenarlo.
- El CSS nuevo va **siempre en el módulo**, nunca en `globals.css`.

---

## 8. Verificación estándar

Toda spec de juego hereda esta batería:

- `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos.
- Consola sin errores de hidratación en `/juegos/<id>/jugar`.
- `get_advisors` (MCP de Supabase) sin alertas de RLS, si hubo migración.
- Rutas de specs anteriores en 200: `/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about`, `/auth`.
- Sin scroll horizontal en el `body` por culpa del canvas.
- **No regresión doble:**
  - `rocas` sigue funcionando igual (HUD, pausa, reinicio, power-up, guardado real).
  - Un juego aún mock mantiene su ticker y su toast. El testigo habitual es `/juegos/caida/jugar`; si el juego nuevo _es_ `caida`, elegir otro id sin registrar.
- Salir del juego y volver a entrar arranca limpio: sin `rAF` ni listeners del render anterior.
