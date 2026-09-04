# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Arcade Vault** — an online gaming platform where players compete for the highest score. Currently a fresh scaffold (`app/page.tsx` still shows the default Create Next App landing); the game/competition features are not yet built.

Development follows **spec-driven design** (see `README.md`): write a spec with the `/spec` skill, then implement it with `/spec-impl`. These skills come from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), installed via `npx skills@latest add Klerith/fernando-skills`.

Para **juegos**, ese flujo va precedido del subagente `game-planner`, que es quien decide qué juego entra a continuación. Ver `## Agentes`.

## Commands

```bash
npm run dev     # Start dev server (Turbopack, http://localhost:3000)
npm run build   # Production build
npm run start   # Serve the production build
npm run lint    # ESLint (flat config, eslint-config-next core-web-vitals + typescript)
```

No test runner is configured yet.
## Skills
Always use /frontend-design when you need to create HTML designs

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

## Stack & critical version notes

This is **Next.js 16.2.10** with the App Router, **React 19.2**, and **Tailwind CSS v4** — all newer than typical training data. `AGENTS.md` requires reading the relevant guide under `node_modules/next/dist/docs/` before writing code. The v16 breaking-change guide is `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. Key differences from older Next.js that break familiar patterns:

- **Async Request APIs (hard breaking change):** `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` are Promises and *must* be awaited — the synchronous compatibility shim from v15 is fully removed. Use typed helpers like `PageProps<'/route/[slug]'>`; run `npx next typegen` to generate them.
- **`middleware` → `proxy`:** the `middleware.ts` file convention and named `middleware` export are deprecated; use `proxy` instead.
- **Turbopack is the default** dev/build bundler (no `--turbo` flag needed).
- **`revalidateTag(tag)`** now requires a second `cacheLife` profile argument.
- **`cacheLife` / `cacheTag`** are stable (drop the `unstable_` prefix).
- **`next/image`:** several default changes (`minimumCacheTTL`, `imageSizes`, `qualities`); `images.domains` and `next/legacy/image` are deprecated.

## Conventions

- **Path alias:** `@/*` maps to the repo root (`./*`) — e.g. `import x from "@/app/..."`.
- **Styling:** Tailwind v4 is configured entirely in CSS. `app/globals.css` uses `@import "tailwindcss"` and an `@theme inline` block for design tokens (colors, fonts) — there is no `tailwind.config.js`. PostCSS is wired via `@tailwindcss/postcss` in `postcss.config.mjs`.
- **Fonts:** Geist / Geist Mono loaded via `next/font/google` in `app/layout.tsx`, exposed as `--font-geist-sans` / `--font-geist-mono` CSS variables.
- **TypeScript:** `strict` mode; `moduleResolution: "bundler"`.
