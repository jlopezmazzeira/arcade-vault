# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Arcade Vault** — a retro arcade portal where players compete for the highest score. Nine specs are implemented (`specs/01` … `specs/09`): the full visual shell, home, about/contact, Supabase email auth, a Supabase-backed catalog and leaderboard, and four playable games ported to React client components.

**All user-facing copy, code comments and specs are written in Spanish.** Keep writing them in Spanish.

### Routes

| Route                | What it is                                                       |
| -------------------- | ---------------------------------------------------------------- |
| `/`                  | Home (`app/HomeScreen.tsx`), hero + featured games               |
| `/biblioteca`        | Catalog grid with category filter (`LibraryBrowser.tsx`, client) |
| `/juegos/[id]`       | Game detail: description + top-12 leaderboard aside              |
| `/juegos/[id]/jugar` | Player screen: real game or mock fallback                        |
| `/salon`             | Hall of fame, tabs per game (`HallTabs.tsx`, client)             |
| `/about`             | About + contact form (email via Resend)                          |
| `/auth`              | Sign up / sign in (Supabase email+password)                      |

Pages are Server Components; only the browser-interactive pieces (`LibraryBrowser`, `HallTabs`, `AuthForm`, `GamePlayerScreen`, the games) are `"use client"`.

## Spec-driven workflow

Every feature starts as a numbered spec in `specs/NN-slug.md`, then gets implemented on its own branch and merged via PR. See `README.md`.

- **`/spec`** → writes a generic spec (`.agents/skills/spec/`, from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills)).
- **`/spec-game`** → **project-specific** skill in `.claude/skills/spec-game/` for adding a _new playable game_. It knows how a game plugs into this platform; its `platform-contract.md` is the authoritative reference (component shape, snapshot contract, registry, catalog entry, canvas scaling, standard verification). Read it before touching anything under `app/_components/games/`.
- **`/spec-impl`** → implements a spec. `specs/.spec-config.yml` has `AutoCreateBranch: true`, so it creates and switches to `spec-NN-slug` without asking.
- **`/frontend-design`** → always use it when creating HTML/UI designs.

Skills are installed with `npx skills@latest add …` and pinned in `skills-lock.json`; `spec-game` is hand-written and lives in the repo.

Para **juegos**, ese flujo va precedido del subagente `game-planner`, que es quien decide qué juego entra a continuación. Ver `## Agentes`.

## Commands

```bash
npm run dev     # Dev server (Turbopack, http://localhost:3000)
npm run build   # Production build
npm run start   # Serve the production build
npm run lint    # ESLint (flat config, core-web-vitals + typescript + prettier)
npx next typegen  # Regenerate PageProps/LayoutProps route types
```

No test runner is configured yet.

## Skills

Always use /frontend-design when you need to create HTML designs
No test runner is configured. Verification is manual: run the dev server and check the screens by hand.

## Data layer

Two different `games` modules — don't confuse them:

- **`data/games.ts`** — the original static mock. Today it is only the **source of the TypeScript types** (`Game`, `GameCategory`, `CoverArt`, `AccentColor`, `ScoreRow`) and the origin of the DB seed. Not a runtime data source anymore.
- **`lib/data/games.ts` / `lib/data/scores.ts`** — the real reads from Supabase (`getGames`, `getGame`, `getTopScores`). Server-only; they map DB rows to the `data/games.ts` types.

`data/home.ts` and `data/about.ts` are still plain static content for those pages.

### Supabase

- `lib/supabase/server.ts` — `createClient()` is **async** (Next 16 `cookies()` is a Promise). Use it in Server Components and Server Actions.
- `lib/supabase/client.ts` — browser client.
- `lib/supabase/proxy.ts` + root **`proxy.ts`** — session-cookie refresh on every request. In Next 16 the file/export is `proxy`, _not_ `middleware`.
- `lib/supabase/database.types.ts` — generated types; `Database` and `Tables<"…">`.
- `supabase/migrations/` — `001_games.sql` (catalog, read-only RLS, 8 games seeded, `position` keeps the curated order) and `002_scores.sql` (leaderboard, public read + guest/authenticated insert with a `with check` that ties `user_id` to `auth.uid()`).

Schema changes go through a new migration file, never through the client. A Supabase MCP server is configured in `.mcp.json`.

### Server Actions

- `app/auth/actions.ts` — `signUp` / `signIn` / `signOut`.
- `app/juegos/[id]/actions.ts` — `saveScore`; with a session the player name comes from the server (`display_name`), the form value is ignored.
- `app/about/actions.ts` — `sendContactMessage` via Resend.

All of them use a discriminated-union state (`{ status: "idle" | "invalid" | "error" | … }`) consumed with `useActionState`, validate on the server, and log the raw error while returning a generic message to the client.

## Games

A playable game is a client component under `app/_components/games/` that renders **only its canvas** — the HUD, pause overlay and game-over modal belong to the platform (`GamePlayerScreen.tsx`).

- **`types.ts`** — the contract: `GameSnapshot` (`score` required; `lives`/`level` optional; `extra` for pre-formatted per-game metrics), `PlayableGameProps` (`paused`, `onSnapshot`, `onGameOver`) and `PlayableGameHandle` (`restart()` via `forwardRef` + `useImperativeHandle`).
- **`registry.ts`** — maps catalog id → component, lazily via `next/dynamic`. Registered today: `rocas` (Asteroids), `caida` (Tetris), `bloque-buster` (Arkanoid), `serpentina` (Snake). Ids without an entry fall back to the mock player — that fallback is deliberate, don't remove it.
- Each game ships a sibling **CSS module** (`SnakeGame.module.css`, …); game state lives in a `createGame`-style closure, not in React state. Snapshots are emitted on change, never per frame.
- Assets go in `public/games/<game>/` (Arkanoid spritesheet, Snake fruit atlas).
- `references/started-games/` holds the original vanilla-JS games used as porting sources; `references/templates/` and `references/source-assets/` hold the original HTML designs and raw assets.

## Agentes

**Este proyecto usa el subagente `game-planner`** (`.claude/agents/game-planner.md`), en uso
activo desde el 2026-09-03. Es el primer paso del flujo para añadir un juego:

**`game-planner` → `/spec-game` → `/spec-impl`**

- `game-planner` decide **qué** juego entra a continuación y por qué: analiza el catálogo
  (`data/games.ts`), qué ids siguen en mock frente a `app/_components/games/registry.ts`, y
  evalúa los candidatos por encaje con el contrato de plataforma, competitividad del score y
  equilibrio de categorías. Termina en un veredicto y un handoff textual; **no escribe specs
  ni código**.
- Su memoria de rondas anteriores —lo propuesto, aceptado, descartado e implementado— vive en
  `references/game-planner/memoria.md`, el único fichero que escribe. Está versionada en git:
  si tocas juegos, léela antes de proponer uno, porque un juego ya descartado no deja ninguna
  otra huella en el repo.
- **No lo invoques para portar un juego ya decidido** — para eso se entra directamente por
  `/spec-game <juego>`.

**El subagente `agent-jam`** (`.claude/agents/agent-jam.md`) es la **vía rápida y paralela**
a ese flujo, para explorar sin comprometer el catálogo:

**`agent-jam <tema>` → revisión manual → mover a `specs/NN-…` → `/spec-impl`**

- Recibe **un tema** (p. ej. «juegos de laberinto de los 80»), elige el juego que mejor lo
  representa con los mismos tres criterios que `game-planner`, y escribe **dos specs completas
  de un tirón, sin preguntar nada**: `01` el puerto jugable y `02` un incremento que depende
  del `01`.
- Escribe **solo** dentro de `specs/game-jam/<game-id>/`. No toca la serie numerada de
  `specs/`, ni el código, ni `references/game-planner/memoria.md` (esa es de `game-planner`).
  Sus specs son **candidatas**: para promover una hay que moverla a `specs/NN-…` a mano.
- Como no pregunta, toda decisión que `/spec-game` consultaría queda registrada con su motivo
  en la sección `## Decisiones` de la spec. Ahí es donde hay que revisarlo.
- **No sustituye a `game-planner` + `/spec-game`** para el catálogo real: aquel deja memoria
  de lo descartado y esta skill negocia la spec contigo. `agent-jam` es para explorar un tema
  y leerlo en frío.

**El subagente `skin-designer`** (`.claude/agents/skin-designer.md`) trabaja en un **eje
transversal** a los dos anteriores: no decide qué juego entra, sino que **todo juego ya
jugable se pueda vestir**:

**`skin-designer` → auditoría → aprobación → `specs/NN-skins-…` → `/spec-impl`**

- Audita que toda entrada de `app/_components/games/registry.ts` ofrezca las **tres skins
  obligatorias**: `clasico` (la por defecto, que reproduce exactamente lo que el juego pinta
  hoy), `neon` y `retro`. Los juegos aún en mock no se auditan: no tienen canvas que vestir.
- **La skin pinta el canvas y nada más.** El marco CRT, las scanlines y el HUD son de la
  plataforma e iguales para las tres; `app/globals.css` no se toca. La única superficie de
  chrome es el selector en el HUD, que define la spec de contrato.
- «Se ve bien en oscuro» se verifica con **ratios de contraste WCAG calculados**, no a ojo:
  ≥ 4.5:1 para entidades jugables contra el fondo de su propia skin, ≥ 1.5:1 entre entidades
  que hay que distinguir (con excepción si ya difieren por forma) y 1.1–2.5:1 para el decorado.
- **Pregunta antes de escribir**: enseña la auditoría y el plan de specs, y solo escribe tras
  aprobación. A diferencia de `agent-jam`, sus specs entran en la **serie numerada** de
  `specs/`, no en una carpeta de candidatas.
- No tiene fichero de memoria, y es deliberado: el estado de las skins se lee entero desde el
  código en cada ronda. No escribe código, ni CSS, ni SQL.

## Stack & critical version notes

**Next.js 16.2.10** (App Router), **React 19.2**, **Tailwind CSS v4**, `@supabase/ssr` + `supabase-js`, `resend` — all newer than typical training data. `AGENTS.md` requires reading the relevant guide under `node_modules/next/dist/docs/` before writing code; the v16 breaking-change guide is `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.

- **Async Request APIs (hard breaking change):** `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` are Promises and _must_ be awaited — the synchronous compatibility shim from v15 is fully removed. Use typed helpers like `PageProps<'/route/[slug]'>`; run `npx next typegen` to generate them.
- **`middleware` → `proxy`:** the `middleware.ts` file convention and named `middleware` export are deprecated; use `proxy` instead.
- **Turbopack is the default** dev/build bundler (no `--turbo` flag needed).
- **Async Request APIs (hard breaking change):** `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are Promises and _must_ be awaited — the v15 sync shim is gone. Use the generated helpers, e.g. `PageProps<"/juegos/[id]/jugar">`; run `npx next typegen`.
- **`revalidateTag(tag)`** now requires a second `cacheLife` profile argument.
- **`cacheLife` / `cacheTag`** are stable (no `unstable_` prefix).
- **`next/image`:** changed defaults (`minimumCacheTTL`, `imageSizes`, `qualities`); `images.domains` and `next/legacy/image` are deprecated.

## Conventions

- **Path alias:** `@/*` maps to the repo root (`./*`) — e.g. `@/lib/data/games`.
- **Styling:** Tailwind v4, configured entirely in CSS. `app/globals.css` defines the neon theme on `:root` (`--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--gold`…) and re-exports it to Tailwind through `@theme inline` (`bg-bg-2`, `text-ink-dim`, `font-pixel`…). There is no `tailwind.config.js`. Hand-written `av-*` classes (`.av-bg`, `.av-main`, `.player-hud`, …) also live in `globals.css`.
- **Fonts:** `Press Start 2P` (pixel), `JetBrains Mono` and `Courier Prime` via `next/font/google` in `app/layout.tsx`, exposed as `--font-press-start` / `--font-jetbrains-mono` / `--font-courier-prime` and consumed through `--pixel` / `--mono`.
- **Formatting:** Prettier (`.prettierrc`) with `prettier-plugin-tailwindcss` pointed at `app/globals.css`; double quotes, semicolons, trailing commas.
- **TypeScript:** `strict`; `moduleResolution: "bundler"`.
- **Env:** copy `.env.example` → `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public by design (RLS is the real protection); `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` are server-only.
