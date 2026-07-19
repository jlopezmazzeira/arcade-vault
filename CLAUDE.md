# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Arcade Vault** — an online gaming platform where players compete for the highest score. Currently a fresh scaffold (`app/page.tsx` still shows the default Create Next App landing); the game/competition features are not yet built.

Development follows **spec-driven design** (see `README.md`): write a spec with the `/spec` skill, then implement it with `/spec-impl`. These skills come from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), installed via `npx skills@latest add Klerith/fernando-skills`.

## Commands

```bash
npm run dev     # Start dev server (Turbopack, http://localhost:3000)
npm run build   # Production build
npm run start   # Serve the production build
npm run lint    # ESLint (flat config, eslint-config-next core-web-vitals + typescript)
```

No test runner is configured yet.

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
