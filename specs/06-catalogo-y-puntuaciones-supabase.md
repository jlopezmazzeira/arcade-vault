# SPEC 06 — Catálogo y puntuaciones sobre Supabase (games + leaderboard)

> **Status:** Approved
> **Depends on:** SPEC 04 (Supabase + auth), SPEC 05 (juego real y modal de fin)
> **Date:** 2026-07-25
> **Objective:** Migrar el catálogo de juegos y las puntuaciones de mock estático a dos tablas Postgres en Supabase con RLS, sembrar ambas, y conectar la biblioteca, la ficha, el salón, la home y el guardado de fin de partida a esos datos reales.

## Alcance

**Dentro:**

- **Dos migraciones SQL versionadas** en `supabase/migrations/`, aplicadas con el MCP de Supabase (`apply_migration`):
  - Tabla `public.games` — fuente de verdad del catálogo. Columnas sembradas 1:1 desde `data/games.ts` (id, title, short, long, cat, cover, color, best, plays). RLS: lectura pública (`anon` + `authenticated`); sin insert/update/delete para clientes.
  - Tabla `public.scores` — puntuaciones del leaderboard. RLS: lectura pública; **insert permitido a `anon` y `authenticated`** (guardado por sesión o invitado).
- **Siembra (`seed`) de ambas tablas** dentro de las migraciones:
  - `games`: los 8 juegos de `data/games.ts`.
  - `scores`: filas iniciales por juego generadas con la lógica de `seededScores`, para que los leaderboards no arranquen vacíos.
- **`data/games.ts` deja de ser fuente de datos de runtime.** Se conserva solo como origen de la siembra y de los tipos (`Game`, `GameCategory`, `CoverArt`, `AccentColor`, `ScoreRow`). El array `GAMES` ya no se importa en páginas; las páginas leen de la BD.
- **Capa de acceso a datos** en `lib/data/`: helpers de servidor que leen `games` y `scores` con el cliente de servidor de Supabase (`lib/supabase/server.ts`).
- **Lectura real del catálogo (`games`)** en las cuatro superficies: `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/salon` y la home (`/`). El grid, la ficha, las pestañas del salón y los destacados de la home dejan de leer `data/games.ts`.
- **Lectura real de puntuaciones (`scores`)** en las dos superficies de leaderboard: el aside de `/juegos/[id]` y las tablas/podio de `/salon`.
- **Guardado real de puntuación** en el modal "FIN DEL JUEGO" (`GamePlayerScreen`): una Server Action inserta en `scores`. Con sesión, el nombre es el `display_name` (SPEC 04) y se guarda `user_id`; como invitado, el jugador escribe iniciales libres y `user_id` queda `null`.
- **Convención de migraciones**: nombre `NNN_descripcion.sql` con timestamp, comentario de cabecera, y política RLS explícita por tabla.

**Fuera de alcance (para futuras specs):**

- **`best` y `plays` derivados de datos reales.** Se siembran como columnas estáticas (los valores actuales de `data/games.ts`) y se muestran tal cual; no se recalculan desde `scores`.
- **Guardado de puntuación en los 7 juegos aún mock.** Solo `rocas` tiene juego real (SPEC 05); en el resto el modal de la rama mock mantiene su guardado toast y el score sigue siendo el ticker falso.
- **Realtime / actualización en vivo** de los leaderboards. Se leen en cada request; sin suscripción `realtime`.
- **Panel de administración** para editar el catálogo. `games` se edita por migración/seed, no por UI.
- **Paginación, filtros por fecha o "mi ranking"** en los leaderboards. Se muestran las top-N como hoy.
- **Antifraude / validación de que el score sea alcanzable.** El insert valida rangos básicos (score ≥ 0, nombre no vacío), no legitimidad de la partida.
- **Migrar `data/home.ts` y `data/about.ts`** a la BD. Solo el catálogo de juegos y las puntuaciones.
- **Tests.** Sigue sin haber runner.

## Modelo de datos

Se crean **dos tablas** en el esquema `public`. Ambas con RLS activo. Los tipos de UI actuales (`Game`, `ScoreRow`, `GameCategory`, `CoverArt`, `AccentColor`) se conservan en `data/games.ts` y las filas de la BD se mapean a ellos.

### Tabla `public.games` (fuente de verdad del catálogo)

```sql
create table public.games (
  id        text        primary key,                -- "rocas", "caida", …
  position  smallint    not null,                   -- orden curado del catálogo (0..7)
  title     text        not null,
  short     text        not null,
  long      text        not null,
  cat       text        not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover     text        not null,                    -- "cover-rocas", …
  color     text        not null check (color in ('cyan','magenta','yellow','green')),
  best      integer     not null default 0,          -- estático (sembrado); NO derivado
  plays     text        not null,                    -- "15.6K" (string, tal cual el mock)
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);
-- Sin políticas de insert/update/delete: el catálogo solo se edita por migración/seed.
```

### Tabla `public.scores` (leaderboard)

```sql
create table public.scores (
  id          bigint      generated always as identity primary key,
  game_id     text        not null references public.games(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,  -- null = invitado
  player_name text        not null check (char_length(btrim(player_name)) between 1 and 40),
  score       integer     not null check (score >= 0),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at asc);

alter table public.scores enable row level security;

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

-- Insert por sesión o invitado. Un autenticado no puede suplantar user_id ajeno;
-- un invitado (anon) debe dejar user_id null.
create policy "scores_insert_session_or_guest" on public.scores
  for insert to anon, authenticated
  with check (
    score >= 0
    and char_length(btrim(player_name)) between 1 and 40
    and (user_id is null or user_id = auth.uid())
  );
```

### Capa de acceso a datos (`lib/data/`)

```ts
// lib/data/games.ts — lecturas de servidor (cliente de servidor de Supabase)
export async function getGames(): Promise<Game[]>; // order by position
export async function getGame(id: string): Promise<Game | null>;

// lib/data/scores.ts
export async function getTopScores(
  gameId: string,
  limit = 12,
): Promise<ScoreRow[]>; // order by score desc, created_at asc; rank = índice+1
```

- `ScoreRow` se deriva de la fila: `name = player_name`, `score`, `date = created_at` formateada `dd/mm/yyyy` (`es-ES`), `rank` calculado por posición en el resultado.
- El mapeo BD→`Game` es directo columna a columna (mismos nombres salvo `position`, que solo ordena).

### Server Action de guardado (`app/juegos/[id]/actions.ts`)

```ts
// Unión discriminada, al estilo de AuthState (SPEC 04) / ContactState (SPEC 03)
export type SaveScoreState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string }
  | { status: "saved" };

export async function saveScore(
  prev: SaveScoreState,
  formData: FormData, // game_id, player_name, score
): Promise<SaveScoreState>;
```

Reglas de validación en servidor (a mano, sin Zod, como SPEC 03/04):

| Campo         | Regla                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| `game_id`     | existe en `games` (la FK lo garantiza; se valida antes para dar mensaje) |
| `player_name` | `btrim()` no vacío, ≤ 40. Con sesión se ignora y se usa `display_name`   |
| `score`       | entero, `0 ≤ score ≤ 100_000_000` (cota de cordura)                      |

### Siembra (dentro de las migraciones)

- `games`: 8 `INSERT` generados desde `GAMES` de `data/games.ts`, con `position` = índice del array.
- `scores`: por cada juego, filas generadas con la lógica de `seededScores(seed, 12)`; se emiten como `INSERT` literales con `player_name`, `score`, `game_id`, `user_id = null` y `created_at` derivada de la fecha del mock.

Notas de diseño:

1. **`best`/`plays` son columnas estáticas, no vistas derivadas.** Se siembran con los valores del mock y se muestran tal cual. Derivarlos de `scores` es otra spec (queda en "Fuera").
2. **`player_name` admite hasta 40** para encajar el `display_name` de la SPEC 04; el input de invitado mantiene su recorte a 10 mayúsculas como UX, pero la autoridad es el `check` de la columna.
3. **La FK `user_id` es `on delete set null`**: si se borra la cuenta, la puntuación sobrevive como anónima en el ranking.
4. **El orden del catálogo se preserva con `position`**, no con `order by title`, para no alterar la disposición curada actual.

## Plan de implementación

Antes de tocar código de páginas, **leer** la guía de obtención de datos en Server Components de Next 16 bajo `node_modules/next/dist/docs/01-app/…` (data fetching / caching y el uso de `PageProps<...>` con `params` asíncronos), como exige `AGENTS.md`. Para el esquema y RLS, apoyarse en la doc de Supabase vía el MCP (`search_docs`) antes de escribir las políticas.

No hay variables de entorno nuevas: se reutilizan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` de la SPEC 04. Cada paso deja la app arrancable con `npm run dev`.

1. **Migración 1 — tabla `games` + RLS + seed.**
   Crear `supabase/migrations/001_games.sql`: `create table public.games`, `enable row level security`, política `games_select_public`, y los 8 `INSERT` generados desde `GAMES` de `data/games.ts` (con `position` = índice). Aplicar con el MCP (`apply_migration`).
   Verificación: `list_tables` muestra `public.games`; `select count(*) from games` devuelve 8; `get_advisors` no marca "RLS disabled" en la tabla.

2. **Migración 2 — tabla `scores` + RLS + seed.**
   Crear `supabase/migrations/002_scores.sql`: `create table public.scores` con la FK a `games` y a `auth.users`, el índice `scores_game_score_idx`, `enable row level security`, políticas `scores_select_public` y `scores_insert_session_or_guest`, y los `INSERT` de siembra por juego (generados con la lógica de `seededScores`, `user_id null`). Aplicar con el MCP.
   Verificación: `select game_id, count(*) from scores group by game_id` da filas para los 8 juegos; `get_advisors` limpio de RLS.

3. **Tipos de la base de datos.**
   Generar los tipos con el MCP (`generate_typescript_types`) a `lib/supabase/database.types.ts` y parametrizar los clientes (`createBrowserClient<Database>`, `createServerClient<Database>`) en `lib/supabase/client.ts` y `server.ts`.
   Verificación: `npx tsc --noEmit` pasa con los clientes tipados.

4. **`lib/data/games.ts`.**
   `getGames(): Promise<Game[]>` (select ordenado por `position`) y `getGame(id): Promise<Game|null>`, usando el cliente de servidor. Mapear fila→`Game`.
   Verificación: un Server Component de prueba que llame a `getGames()` devuelve 8 juegos en el orden actual del catálogo.

5. **`lib/data/scores.ts`.**
   `getTopScores(gameId, limit=12): Promise<ScoreRow[]>` (order by `score desc, created_at asc`, limit N), mapeando a `ScoreRow` con `rank` por índice y `date` formateada `dd/mm/yyyy`.
   Verificación: `getTopScores("rocas")` devuelve filas ordenadas de mayor a menor score.

6. **Biblioteca (`app/biblioteca/page.tsx`) lee de la BD.**
   Sustituir el import de `GAMES` por `await getGames()`. Si la página filtra por categoría en cliente, pasar el array cargado en servidor al componente cliente por prop.
   Verificación: `/biblioteca` muestra los 8 juegos; filtros por categoría siguen funcionando.

7. **Ficha (`app/juegos/[id]/page.tsx`) lee juego + scores reales.**
   `const game = await getGame(id)` (`notFound()` si null) y `const scores = await getTopScores(id, 10)`. El aside "MEJORES PUNTUACIONES" renderiza `scores` reales.
   Verificación: `/juegos/rocas` muestra la ficha y un leaderboard con las filas sembradas.

8. **Pantalla de juego (`app/juegos/[id]/jugar/page.tsx`) lee de la BD y pasa el jugador.**
   `const game = await getGame(id)` (`notFound()` si null). Leer el usuario con el cliente de servidor (`getUser()`) y pasar `playerName` (= `display_name` o `null` si invitado) como prop a `GamePlayerScreen`.
   Verificación: `/juegos/rocas/jugar` monta el juego real; con sesión, el nombre del jugador llega a la pantalla.

9. **Home (`app/page.tsx`) lee destacados de la BD.**
   Sustituir el origen de los juegos destacados por `await getGames()` (recortando/seleccionando los que hoy muestra la home). No se toca `data/home.ts` para el resto de contenido.
   Verificación: `/` muestra los destacados con los mismos juegos que antes.

10. **Salón (`app/salon/page.tsx`) real, manteniendo las pestañas en cliente.**
    Convertir `salon/page.tsx` en Server Component que hace `await getGames()` y, para cada juego, `await getTopScores(id, 12)`, construyendo un mapa `gameId → ScoreRow[]`. Pasar `games` + ese mapa a un nuevo componente cliente `app/salon/HallTabs.tsx` que conserva el `useState(tab)`, el podio y la tabla, pero leyendo del mapa precomputado en vez de `seededScores`.
    Verificación: `/salon` cambia de pestaña sin recargar; cada pestaña muestra el ranking real de ese juego.

11. **Server Action de guardado (`app/juegos/[id]/actions.ts`).**
    `"use server"`. `saveScore(prev, formData)`: lee `game_id`, `player_name`, `score`; valida según la tabla del modelo; si hay sesión (`getUser()`), **ignora** `player_name` y usa `display_name` + `user_id`; si no, `user_id = null` y usa las iniciales. Inserta con el cliente de servidor; ante error devuelve `error` (mensaje genérico, real a `console.error`); ante éxito, `{ status: "saved" }`.
    Verificación: invocada con datos válidos, aparece una fila nueva en `scores`; con `player_name` vacío devuelve `invalid` sin insertar.

12. **Cablear el modal real de `GamePlayerScreen` a `saveScore`.**
    En la rama del juego real (rocas): el modal "FIN DEL JUEGO" usa `useActionState(saveScore, { status: "idle" })`. Campos ocultos `game_id` y `score`; el input de nombre se prellena con `playerName` (si sesión) o arranca en iniciales editables (invitado, recorte a 10). Botón deshabilitado mientras `isPending`; estado `saved` muestra "▸ PUNTUACIÓN GUARDADA_"; `invalid`/`error` muestran mensaje. **La rama mock (7 juegos) mantiene su guardado toast tal cual** (su score es el ticker falso; no se inserta).
    Verificación: terminar una partida de `rocas`, guardar, y ver la puntuación en `/juegos/rocas` y `/salon`; `/juegos/caida/jugar` sigue con el toast mock.

13. **Prueba manual de extremo a extremo.**
    Como invitado: jugar `rocas`, guardar con iniciales, comprobar que aparece en la ficha y el salón. Con sesión: repetir y comprobar que el nombre es el `display_name` y que la fila lleva `user_id`. Revisar que biblioteca, ficha, home y salón muestran los mismos juegos que antes (orden intacto).

14. **Pasada final.**
    `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos. Consola sin errores de hidratación en `/`, `/biblioteca`, `/juegos/rocas`, `/juegos/rocas/jugar` y `/salon`. `get_advisors` de Supabase sin alertas de seguridad (RLS activo en ambas tablas).

Apuntes sobre el orden:

- **Las migraciones (1–2) van primero**: sin tablas, la capa de datos (4–5) no tiene de dónde leer.
- **La capa `lib/data` (4–5) antes que las páginas (6–10)**: al revés, cada página importaría helpers que aún no existen.
- **La Server Action (11) antes de cablear el modal (12)**, igual que la SPEC 04 puso las acciones antes que el formulario.
- **El salón (10) es el paso más delicado**: reparte responsabilidad servidor (fetch) / cliente (pestañas) sin perder la interacción actual.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] `npx tsc --noEmit` pasa con los clientes de Supabase tipados (`Database`).
- [ ] La consola no muestra errores ni avisos de hidratación en `/`, `/biblioteca`, `/juegos/rocas`, `/juegos/rocas/jugar` ni `/salon`.

**Migraciones y esquema**

- [ ] Existen `supabase/migrations/001_games.sql` y `supabase/migrations/002_scores.sql` en el repo.
- [ ] `list_tables` muestra `public.games` y `public.scores`.
- [ ] `get_advisors` no reporta "RLS disabled" en ninguna de las dos tablas.
- [ ] `select count(*) from games` devuelve 8; cada juego tiene `position` único en 0..7.
- [ ] `select game_id, count(*) from scores group by game_id` devuelve filas para los 8 juegos.
- [ ] La FK `scores.game_id → games.id` y `scores.user_id → auth.users.id` existen; borrar un juego cascada sus scores y borrar una cuenta deja `user_id` en `null`.

**Lectura del catálogo (games como fuente de verdad)**

- [ ] `/biblioteca` muestra los 8 juegos leídos de la BD, en el mismo orden que antes.
- [ ] Los filtros por categoría de `/biblioteca` siguen funcionando.
- [ ] `/juegos/rocas` muestra la ficha con datos leídos de la BD; un id inexistente da `notFound()` (404).
- [ ] `/` (home) muestra los mismos juegos destacados que antes, leídos de la BD.
- [ ] `/salon` lista los 8 juegos en las pestañas, leídos de la BD.
- [ ] Ninguna página de runtime importa el array `GAMES` de `data/games.ts` (solo se usa para tipos y siembra).

**Lectura de puntuaciones (leaderboards reales)**

- [ ] El aside "MEJORES PUNTUACIONES" de `/juegos/[id]` muestra filas reales de `scores`, ordenadas de mayor a menor.
- [ ] `/salon` muestra podio y tabla con puntuaciones reales por juego; cambiar de pestaña actualiza el ranking sin recargar la página.
- [ ] Los leaderboards no salen vacíos al arrancar (siembra aplicada).

**Guardado real (modal FIN, juego real `rocas`)**

- [ ] Terminar una partida de `rocas` y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `scores` con el `score` real de la partida.
- [ ] Como invitado, la fila se guarda con las iniciales escritas y `user_id = null`.
- [ ] Con sesión, la fila se guarda con el `display_name` y `user_id` = id del usuario (el input no permite suplantar otro nombre).
- [ ] La puntuación guardada aparece en `/juegos/rocas` y en `/salon` tras recargar.
- [ ] Guardar con nombre vacío o solo espacios devuelve `invalid` y no inserta.
- [ ] Guardar con un `score` fuera de rango (negativo o > cota) devuelve `invalid` y no inserta.
- [ ] Durante el envío el botón está deshabilitado; tras éxito se muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] El mensaje de error no filtra la respuesta cruda de Supabase; el detalle real va a `console.error` del servidor.

**No regresión**

- [ ] `/juegos/caida/jugar` (y cualquier juego aún mock) mantiene su modal con guardado **toast mock**, sin insertar en `scores`.
- [ ] El juego real de `rocas` (SPEC 05) sigue funcionando igual (HUD, pausa, reinicio, power-up).
- [ ] `app/globals.css` no cambia; cualquier CSS nuevo va scopeado.
- [ ] Las rutas de specs anteriores (`/`, `/biblioteca`, `/juegos/rocas`, `/salon`, `/about`, `/auth`) siguen respondiendo 200.
- [ ] No hay claves reales de Supabase en el repo ni en las migraciones.

## Decisiones

**Alcance del corte**

- **Sí:** meter catálogo (`games`) y puntuaciones (`scores`) en una sola spec. El leaderboard necesita que `games` exista para su FK; separarlos obligaba a coordinar dos ramas para una sola vertical de "salir del mock". Decisión explícita del usuario tras plantearle la división.
- **No:** partir en SPEC 06 (games) + 07 (leaderboard). Más limpio de revisar, pero se descartó por preferir una sola entrega.
- **Sí:** `best`/`plays` estáticos, sembrados desde el mock. Derivarlos de `scores` (máximo real, recuento de partidas) es una vertical aparte con sus propias consultas y triggers.

**Fuente de verdad del catálogo**

- **Sí:** `games` en Postgres como única fuente de runtime; `data/games.ts` queda como origen de la siembra y de los tipos. Una sola fuente evita el "split-brain" de tener catálogo en dos sitios.
- **No:** tabla `games` mínima (solo id + título) dejando la presentación en `data/games.ts`. Habría duplicado la identidad del juego en dos lugares y dejado la ficha leyendo de dos orígenes.
- **No:** no crear tabla `games` y usar `game_id` como texto suelto. Sin FK, una puntuación podría apuntar a un juego inexistente.
- **Sí:** columna `position` para preservar el orden curado. `order by title` habría reordenado el catálogo alfabéticamente, cambiando la disposición actual.

**Identidad y escritura de puntuaciones**

- **Sí:** insert permitido a `anon` y `authenticated` (sesión o invitado). Mantiene el flujo actual del modal (arranca en `INVITADO`, iniciales libres) sin obligar a iniciar sesión para puntuar.
- **No:** insert solo autenticado. Habría bloqueado el guardado de invitado, que hoy es el comportamiento por defecto.
- **Sí:** con sesión, el nombre es el `display_name` y se guarda `user_id`; el servidor ignora el nombre enviado. Evita que un usuario logueado suplante otro nombre y ata la puntuación a su cuenta.
- **Sí:** `player_name` desnormalizado en la fila (no solo `user_id`). El leaderboard se lee sin `join` a `auth.users`, y las filas de invitado (sin cuenta) siguen teniendo nombre.
- **Sí:** RLS `with check (user_id is null or user_id = auth.uid())`. Un invitado no puede inventar `user_id`; un autenticado no puede firmar como otro.
- **Sí:** `on delete set null` en `user_id`. Borrar la cuenta no borra el récord histórico; se vuelve anónimo en el ranking.

**Persistencia y migraciones**

- **Sí:** SQL versionado en `supabase/migrations/`, aplicado con el MCP (`apply_migration`). Queda historial reproducible en git, a diferencia de tocar el dashboard a mano.
- **No:** SQL solo en el dashboard. Sin rastro en el repo; imposible de revisar en PR o reproducir en otro proyecto.
- **Sí:** siembra dentro de las migraciones. Los leaderboards no arrancan vacíos y la demo es inmediata; la lógica de `seededScores` ya existía y se reutiliza para generar los `INSERT`.

**Lectura y páginas**

- **Sí:** capa `lib/data/` con helpers de servidor. Centraliza las consultas y mantiene las páginas declarativas; un solo sitio que tocar si cambia el esquema.
- **Sí:** el salón pasa a Server Component que precomputa un mapa `gameId → scores` y delega las pestañas a un cliente. Conserva la interacción actual (cambio de pestaña sin recargar) sin convertir cada cambio de pestaña en un fetch.
- **No:** fetch por pestaña vía Server Action al hacer clic. Más llamadas y estado de carga para 8 rankings pequeños que caben en un solo render.
- **Sí:** tipar los clientes de Supabase con `Database` generado. `tsc` caza errores de columnas/tablas antes de runtime.

**Guardado en juegos mock**

- **Sí:** solo `rocas` (juego real) inserta puntuación real; los 7 mock mantienen su toast. Su "score" es un ticker aleatorio; insertarlo ensuciaría el ranking con datos falsos.
- **No:** cablear el guardado real en los 7 mock. Cada uno se conectará cuando tenga juego real (su propia spec), como hizo la SPEC 05 con `rocas`.

## Riesgos

| Riesgo                                                                                                                                             | Mitigación                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Olvidar `enable row level security`** en alguna tabla. Sin RLS, la `anon key` (pública, viaja al navegador) deja leer/escribir todo sin control. | Cada migración activa RLS y define políticas explícitas. Criterio de aceptación con `get_advisors` que verifica que ninguna tabla queda con "RLS disabled".                                                                  |
| **Política de insert demasiado abierta.** Al permitir `anon`, un script podría inyectar miles de puntuaciones basura en el leaderboard.            | El `with check` acota `score` y `player_name`; ata `user_id` a `auth.uid()`. Antifraude real y rate-limiting quedan declarados en "Fuera" como spec propia; hoy el riesgo se asume para no bloquear el guardado de invitado. |
| **Un autenticado suplantando `user_id` ajeno** al insertar directamente contra la API.                                                             | RLS `with check (user_id is null or user_id = auth.uid())`: la base rechaza el insert aunque no pase por la Server Action.                                                                                                   |
| **Confiar en el nombre enviado por el cliente** con sesión (podría firmar como otro).                                                              | La Server Action ignora el `player_name` del formulario cuando hay sesión y usa el `display_name` leído en servidor.                                                                                                         |
| **`data/games.ts` y la tabla `games` divergen** tras la migración (alguien edita el TS creyendo que sigue vivo).                                   | El array `GAMES` deja de importarse en runtime; criterio de aceptación que lo verifica. `data/games.ts` queda solo como origen de siembra y tipos, documentado en el Alcance.                                                |
| **Perder el orden curado del catálogo** al leer de la BD sin `order by` estable.                                                                   | Columna `position` sembrada con el índice del array; `getGames()` ordena por `position`. Criterio que comprueba el orden idéntico al anterior.                                                                               |
| **El salón hace N fetch por render** (uno por juego) y se nota en el TTFB.                                                                         | Son 8 consultas top-12 con índice `(game_id, score desc)`; baratas y precomputadas en un solo render de servidor. Si creciera, se movería a una consulta única con `rank() over (partition by game_id)` (fuera de alcance).  |
| **`params` tratado como síncrono** en las páginas migradas. En Next 16 es una Promise; sin `await` la ruta rompe.                                  | Uso de `PageProps<...>` y `await params`, como en las specs 04–05. `npx tsc --noEmit` caza el tipo Promise mal usado.                                                                                                        |
| **Siembra no idempotente**: reaplicar la migración duplica filas de `scores`.                                                                      | Las migraciones son de creación única (`create table`); reaplicarlas falla en "ya existe" en vez de duplicar. No se ejecutan dos veces sobre el mismo proyecto.                                                              |
| **Filtrar la respuesta cruda de Supabase** al cliente en el error de guardado (detalles de esquema/cuenta).                                        | Al cliente solo un mensaje genérico; el detalle real a `console.error` del servidor. Mismo patrón que SPEC 03/04, con criterio de aceptación.                                                                                |
| **Regresión del guardado mock** en los 7 juegos al tocar `GamePlayerScreen`.                                                                       | Solo la rama del juego real (rocas) se cablea a `saveScore`; la rama mock se deja intacta. Criterio de no-regresión que verifica que `caida` sigue con toast.                                                                |
| **Fuga de claves reales** en los archivos de migración (si se pega una URL/clave del proyecto).                                                    | Las migraciones son solo DDL/DML de esquema y datos de siembra; no contienen credenciales. Criterio que verifica que no hay claves reales en el repo.                                                                        |

## Lo que **no** entra en esta spec

- `best`/`plays` derivados de datos reales (siguen estáticos sembrados).
- Guardado real de puntuación en los 7 juegos aún mock.
- Realtime / leaderboards en vivo.
- Panel de administración del catálogo.
- Paginación, filtros por fecha o "mi ranking" en los leaderboards.
- Antifraude, validación de partida legítima y rate-limiting.
- Migrar `data/home.ts` y `data/about.ts` a la BD.
- Tests.

Cada uno de esos, si llega, va en su propia spec.
