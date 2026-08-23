# Arcade Vault

Plataforma de juegos retro para jugar online y competir por la mayor puntuación.
Catálogo de juegos, salón de la fama con leaderboards reales, cuentas de usuario
y cuatro juegos jugables dentro de la propia web.

Construido con **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4** y
**Supabase**.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev                  # http://localhost:3000
```

### Variables de entorno

| Variable                        | Para qué                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL del proyecto Supabase                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (pública por diseño; la protección real es RLS) |
| `RESEND_API_KEY`                | Envío del formulario de contacto                              |
| `CONTACT_FROM_EMAIL`            | Remitente del correo de contacto                              |
| `CONTACT_TO_EMAIL`              | Destinatario del correo de contacto                           |

En el dashboard de Supabase, desactiva **Auth → Providers → Email → "Confirm
email"** para que el registro entre directo sin verificación.

### Base de datos

Aplica en orden las migraciones de `supabase/migrations/`:

- `001_games.sql` — tabla `games` (catálogo), RLS de solo lectura pública y
  siembra de los 8 juegos.
- `002_scores.sql` — tabla `scores` (leaderboard), lectura pública e inserción
  para usuarios autenticados e invitados, con siembra inicial.

El catálogo no se edita desde el cliente: cualquier cambio de esquema o de datos
va por una migración nueva.

## Scripts

```bash
npm run dev       # servidor de desarrollo (Turbopack)
npm run build     # build de producción
npm run start     # sirve el build
npm run lint      # ESLint
npx next typegen  # regenera los tipos de rutas (PageProps, LayoutProps)
```

No hay test runner: la verificación es manual, levantando el servidor y
revisando las pantallas.

## Pantallas

| Ruta                 | Qué es                                     |
| -------------------- | ------------------------------------------ |
| `/`                  | Inicio: hero y juegos destacados           |
| `/biblioteca`        | Catálogo completo con filtro por categoría |
| `/juegos/[id]`       | Ficha del juego + top 12 del leaderboard   |
| `/juegos/[id]/jugar` | Pantalla de partida                        |
| `/salon`             | Salón de la fama, con pestaña por juego    |
| `/about`             | Acerca de + formulario de contacto         |
| `/auth`              | Registro e inicio de sesión                |

## Juegos

Cada juego jugable es un componente cliente en `app/_components/games/` que
dibuja **solo su canvas**: el HUD, la pausa y el modal de fin de partida los pone
la plataforma (`GamePlayerScreen`). Se comunican mediante el contrato de
`games/types.ts` (`GameSnapshot`, `PlayableGameProps`, `PlayableGameHandle`) y se
dan de alta en `games/registry.ts`, que los carga de forma diferida.

Jugables hoy: **`rocas`** (Asteroids), **`caida`** (Tetris), **`bloque-buster`**
(Arkanoid) y **`serpentina`** (Snake). Los ids del catálogo que aún no tienen
juego real caen en una pantalla de demostración.

Los originales en JavaScript de los que se portaron viven en
`references/started-games/`.

## Estructura

```
app/               rutas, componentes de UI y Server Actions
  _components/     componentes compartidos
    games/         juegos jugables + contrato + registro
data/              contenido estático y tipos del dominio
lib/data/          lecturas del catálogo y de las puntuaciones
lib/supabase/      clientes de servidor, navegador y refresco de sesión
supabase/          migraciones SQL
specs/             especificaciones numeradas
references/        juegos originales, plantillas HTML y assets de origen
proxy.ts           refresco de la cookie de sesión (en Next 16, antes middleware)
```

## Spec Driven Design

Cada funcionalidad nace como una especificación en `specs/NN-slug.md`, se
implementa en su propia rama `spec-NN-slug` y se integra por pull request.

Siguiendo las buenas prácticas recomendadas aquí:
https://github.com/Klerith/fernando-skills

### Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

- **`/spec`** — redacta una especificación nueva.
- **`/spec-impl`** — la implementa (crea la rama automáticamente, según
  `specs/.spec-config.yml`).
- **`/frontend-design`** — dirección visual al crear interfaz.
- **`/spec-game`** — skill propia del proyecto (`.claude/skills/spec-game/`) para
  diseñar la spec de un juego nuevo. Su `platform-contract.md` documenta cómo se
  enchufa un juego a la plataforma.

### Specs implementadas

| #   | Spec                                              |
| --- | ------------------------------------------------- |
| 01  | MVP visual de Arcade Vault                        |
| 02  | Página de inicio                                  |
| 03  | Página «Acerca de» y formulario de contacto       |
| 04  | Fundamentos de Supabase y autenticación por email |
| 05  | Adaptación del juego Asteroids (`rocas`)          |
| 06  | Catálogo y puntuaciones sobre Supabase            |
| 07  | Adaptación del juego Tetris (`caida`)             |
| 08  | Adaptación del juego Arkanoid (`bloque-buster`)   |
| 09  | Adaptación del juego Snake (`serpentina`)         |
