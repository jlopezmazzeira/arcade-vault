# SPEC 04 — Fundamentos de Supabase y autenticación por email

> **Status:** Implemented
> **Depends on:** SPEC 03
> **Date:** 2026-07-25
> **Objective:** Integrar Supabase en el proyecto y sustituir el login falso de `app/auth/page.tsx` por autenticación real con email y contraseña (registro, inicio de sesión y cierre de sesión), reflejando la sesión en la barra de navegación.

## Alcance

**Dentro:**

- Dependencias nuevas en `package.json`: `@supabase/supabase-js` y `@supabase/ssr`.
- Dos variables de entorno **públicas** (con prefijo `NEXT_PUBLIC_`): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Se documentan en `.env.example`; los valores reales van en `.env.local`. A diferencia de la SPEC 03, estas SÍ son públicas por diseño.
- `lib/supabase/client.ts`: cliente de navegador (`createBrowserClient`).
- `lib/supabase/server.ts`: cliente de servidor (`createServerClient` leyendo `cookies()` — que en Next 16 es asíncrono y hay que `await`).
- `lib/supabase/proxy.ts`: helper `updateSession` que refresca la cookie de sesión, y `proxy.ts` en la raíz que lo invoca (en Next 16 el antiguo `middleware` se llama `proxy`).
- `app/auth/actions.ts`: tres Server Actions — `signUp`, `signIn`, `signOut` — que devuelven un estado discriminado de éxito/error, al estilo del `ContactState` de la SPEC 03.
- `app/auth/page.tsx`: se reescribe el envío para llamar a las Server Actions con `useActionState`, manteniendo la UI actual (pestañas, campos, estilos). El campo "Usuario" se guarda como `display_name`; en registro se piden usuario + correo + contraseña; en login, correo + contraseña. Tras éxito, redirige a `/biblioteca`. Si ya existe sesión al entrar en `/auth`, se redirige a `/biblioteca` en lugar de mostrar el formulario.
- `app/layout.tsx`: lee el usuario en servidor con el cliente de servidor y lo pasa como prop `user` a `Nav`. Esto vuelve el layout dinámico (lee cookies).
- `app/_components/Nav.tsx`: recibe `user` por prop. Cuando hay sesión muestra el `display_name` y un botón "Salir" (que llama a `signOut`); cuando no la hay, mantiene "Iniciar Sesión". En la barra y en el panel móvil.
- Configuración manual en el dashboard de Supabase: crear el proyecto y **desactivar la confirmación de email** (Auth → Providers → Email → "Confirm email" off). Se documenta como paso manual.

**Fuera de alcance (para futuras specs):**

- Cualquier tabla, esquema, tabla `profiles` o política RLS. El `display_name` vive en `user_metadata` del usuario de Auth, sin tocar la base de datos.
- Persistir juegos, puntuaciones, ticker, top de jugadores o salón de la fama. Siguen siendo mock estático de las SPEC 01–03.
- Login social (Google/GitHub). Los botones sociales de `app/auth/page.tsx` pasan a estar `disabled` con la etiqueta "PRÓXIMAMENTE"; no se conecta ningún proveedor OAuth en esta spec.
- Convertir "Jugar como invitado" en sesión anónima de Supabase. Se queda como acceso sin cuenta a rutas públicas.
- Rutas protegidas o redirecciones que bloqueen páginas por falta de sesión. La única redirección es la de `/auth` a `/biblioteca` tras autenticarse (o si ya hay sesión).
- Recuperación de contraseña, magic links, cambio de correo y pantalla de "revisa tu correo" (la confirmación va desactivada).
- Avatares, storage y realtime.
- Tests. Sigue sin haber runner.

## Modelo de datos

Esta spec **no crea tablas ni esquema en Postgres**. El único "dato" persistido es el propio usuario de Supabase Auth, con su `display_name` en `user_metadata`. Los mocks de las SPEC 01–03 no se tocan.

Variables de entorno (ambas **públicas**, con `NEXT_PUBLIC_`):

| Variable                        | Ejemplo                                  | Uso                                 |
| ------------------------------- | ---------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxxx.supabase.co`               | URL del proyecto, en ambos clientes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave anónima / publishable del proyecto | Cliente de navegador y de servidor  |

Forma del usuario en Auth (lo que se guarda al registrarse):

```ts
// Metadatos que viajan en options.data del signUp
type UserMetadata = {
  display_name: string; // el campo "Usuario" del formulario, trim() no vacío
};

// Lo que layout.tsx pasa a Nav (subconjunto del User de Supabase que usa la UI)
type NavUser = {
  email: string;
  display_name: string; // user_metadata.display_name, con fallback al email si falta
} | null; // null = sin sesión
```

Estado que consumen los formularios de `/auth` (unión discriminada, como el `ContactState` de la SPEC 03):

```ts
// app/auth/actions.ts
export type AuthState =
  | { status: "idle" }
  | { status: "invalid"; message: string } // validación local fallida
  | { status: "error"; message: string }; // Supabase devolvió error

export async function signUp(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState>;
export async function signIn(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState>;
export async function signOut(): Promise<void>; // cierra sesión y redirige
```

Reglas de validación en servidor (a mano, sin Zod, como la SPEC 03):

| Campo          | Regla                                                   |
| -------------- | ------------------------------------------------------- |
| `email`        | `trim()` no vacío, contiene `@` con texto a ambos lados |
| `password`     | longitud ≥ 6 (mínimo por defecto de Supabase)           |
| `display_name` | solo en registro: `trim()` no vacío, ≤ 40 caracteres    |

Notas de diseño:

1. **No hay estado `success` en `AuthState`.** El éxito no vuelve al formulario: la Server Action redirige (`redirect("/biblioteca")`), así que no existe estado de éxito que renderizar. Solo se representan los caminos de error.
2. **`display_name` en `user_metadata`, no en tabla.** Evita crear esquema en esta spec. Cuando llegue la spec de base de datos, se podrá materializar en una tabla `profiles` con un trigger.
3. **La validación es de cordura, no de seguridad.** Supabase es la autoridad final sobre credenciales; estas reglas solo dan respuesta inmediata y evitan llamadas obviamente inválidas.

## Plan de implementación

Antes del paso 3, leer `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (la sección `middleware` → `proxy`) y la guía de `proxy`/middleware correspondiente, además de `01-app/02-guides/forms.md` para las Server Actions. `AGENTS.md` lo exige, y aquí importa especialmente: el patrón de Supabase original usa `middleware.ts`, que en Next 16 **no** es el nombre correcto.

Cada paso deja la aplicación arrancable con `npm run dev`.

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (vacías) a `.env.example`, con un comentario de que estas SÍ son públicas. `.gitignore` ya cubre `.env*` con la excepción `!.env.example`; no se toca.
   Verificación: `git check-ignore .env.local` devuelve la ruta y `git check-ignore .env.example` no devuelve nada.

2. **Proyecto Supabase (manual).** Crear el proyecto en el dashboard. En Auth → Providers → Email, **desactivar "Confirm email"**. Copiar URL y clave anónima a `.env.local`.
   Verificación: `process.env.NEXT_PUBLIC_SUPABASE_URL` y `..._ANON_KEY` están definidas al arrancar `npm run dev`.

3. **`lib/supabase/client.ts`.** Cliente de navegador con `createBrowserClient` leyendo las dos variables públicas. Sin estado, se exporta una función `createClient()`.

4. **`lib/supabase/server.ts`.** Cliente de servidor con `createServerClient`, leyendo `cookies()` con `await` (asíncrono en Next 16) y cableando `getAll`/`setAll`. Función `createClient()` asíncrona.
   Verificación: `npx tsc --noEmit` pasa; el tipo de `cookies()` se maneja como Promise.

5. **`lib/supabase/proxy.ts` y `proxy.ts` en la raíz.** El helper `updateSession(request)` crea un cliente de servidor sobre la request/response, llama a `supabase.auth.getUser()` y devuelve la response con las cookies refrescadas. El `proxy.ts` de la raíz exporta `proxy` (no `middleware`) que delega en `updateSession`, con un `matcher` que excluye estáticos e imágenes.
   Verificación: navegar entre rutas mantiene la sesión sin que caduque; `npm run build` no avisa de convención `middleware` deprecada.

6. **`app/auth/actions.ts`.** `"use server"` al inicio. `signUp` lee email, password y display_name del `FormData`, valida según la tabla del modelo de datos, llama a `supabase.auth.signUp` pasando `options.data.display_name`, y ante éxito hace `redirect("/biblioteca")`; ante error devuelve `error` con mensaje genérico (`console.error` del real en servidor). `signIn` es análogo con `signInWithPassword`. `signOut` llama a `supabase.auth.signOut` y redirige a `/`. Todas usan el cliente de servidor.
   Verificación: con `.env.local` puesto, registrar un usuario nuevo redirige a `/biblioteca`; credenciales inválidas devuelven `error` y la página sigue en pie.

7. **`app/auth/page.tsx` — reescritura.** Mantener pestañas, campos y estilos. Conectar cada pestaña a su Server Action con `useActionState(action, { status: "idle" })`. Campos con `name` (`email`, `password`, `display_name`), `required` y `maxLength` según la tabla. Botón deshabilitado mientras `isPending`. Rama `invalid`/`error` que muestra el mensaje. Botones sociales a `disabled` con "PRÓXIMAMENTE". Si ya hay sesión al montar la ruta, redirigir a `/biblioteca` (comprobación en un Server Component contenedor o al principio de la acción de render).
   Verificación: enviar el formulario ejecuta la acción; los campos se leen del `FormData`.

8. **`app/layout.tsx`.** Leer el usuario en servidor con `createClient()` + `supabase.auth.getUser()` (no `getSession`: `getUser` revalida contra el servidor de Auth). Construir el `NavUser` (email + display_name con fallback) y pasarlo como prop `user` a `Nav`. El layout pasa a ser dinámico.
   Verificación: `/` responde 200 con y sin sesión; sin sesión `user` es `null`.

9. **`app/_components/Nav.tsx`.** Aceptar la prop `user: NavUser`. Cuando hay sesión, sustituir "Iniciar Sesión" por el `display_name` y un botón "Salir" dentro de un `<form action={signOut}>`; cuando no, dejar "Iniciar Sesión". Replicar en la barra y en el panel móvil.
   Verificación: tras registrarse, la nav muestra el nombre y "Salir"; pulsar "Salir" vuelve a "Iniciar Sesión" y aterriza en `/`.

10. **Prueba manual de extremo a extremo.** Registrar un usuario, comprobar que entra directo (sin confirmar correo), cerrar sesión, volver a entrar con las mismas credenciales, y probar contraseña incorrecta (muestra `error`, sin filtrar la respuesta cruda). Confirmar que `/auth` con sesión activa redirige a `/biblioteca`.

11. **Pasada final.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos.

Apuntes sobre el orden:

- **Los clientes (3–5) van antes que las acciones (6)**, y las acciones antes que el formulario (7): al revés, cada paso importaría algo que aún no existe y no compilaría.
- **`signOut` (6) existe antes de que `Nav` (9) lo use.** Igual que la SPEC 03 puso la acción antes que el formulario.
- **El paso 8 vuelve el layout dinámico.** Es el precio de reflejar la sesión en toda la app; se acepta a cambio de una nav que sabe quién está dentro.
- **El paso 10 es manual y no lo cubre ningún test**, igual que la prueba de correo real de la SPEC 03.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npm run build` no avisa de la convención `middleware` deprecada (se usa `proxy`).
- [ ] La consola no muestra errores ni avisos de hidratación en `/`, `/auth` ni `/biblioteca`.

**Entorno y secretos**

- [ ] `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ambas vacías.
- [ ] `git check-ignore .env.local` devuelve la ruta.
- [ ] `git check-ignore .env.example` no devuelve nada.
- [ ] `git log -p` no contiene ninguna clave real de Supabase.
- [ ] Ambas variables llevan prefijo `NEXT_PUBLIC_` (son públicas por diseño).

**Clientes y sesión**

- [ ] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts` y `proxy.ts` en la raíz.
- [ ] El servidor lee la sesión con `getUser()`, no con `getSession()`.
- [ ] Navegar entre varias rutas y recargar mantiene la sesión (la cookie se refresca en `proxy`).
- [ ] El campo `middleware` no aparece como export; el archivo raíz exporta `proxy`.

**Registro (sign up)**

- [ ] Con confirmación de email desactivada, registrar un usuario nuevo entra directo a la sesión y redirige a `/biblioteca`.
- [ ] El `display_name` introducido queda en `user_metadata` del usuario (visible en el dashboard de Auth).
- [ ] Registrarse con `display_name` vacío o solo espacios devuelve `invalid` y no llama a Supabase.
- [ ] Registrarse con contraseña de menos de 6 caracteres devuelve `invalid`.
- [ ] Registrarse con un correo ya existente devuelve `error` sin exponer la respuesta cruda de Supabase.

**Inicio de sesión (sign in)**

- [ ] Con credenciales correctas, iniciar sesión redirige a `/biblioteca`.
- [ ] Con contraseña incorrecta, se muestra `error` y el formulario sigue en pie.
- [ ] Durante el envío el botón está deshabilitado.
- [ ] El mensaje de `error` no filtra la respuesta cruda de Supabase; el detalle real aparece en la consola del **servidor**.

**Cierre de sesión (sign out)**

- [ ] Con sesión activa, la nav muestra el `display_name` y un botón "Salir" (barra y panel móvil).
- [ ] Pulsar "Salir" cierra la sesión, la nav vuelve a "Iniciar Sesión" y aterriza en `/`.
- [ ] Sin sesión, la nav muestra "Iniciar Sesión" y ningún `display_name`.

**Ruta `/auth`**

- [ ] Sin sesión, `/auth` muestra el formulario.
- [ ] Con sesión activa, entrar en `/auth` redirige a `/biblioteca`.
- [ ] Los botones sociales están `disabled` y muestran "PRÓXIMAMENTE".
- [ ] "Jugar como invitado" sigue llevando a `/biblioteca` sin crear sesión.

**No regresión**

- [ ] Las rutas de las SPEC 01–03 (`/`, `/biblioteca`, `/juegos/caida`, `/salon`, `/about`) siguen respondiendo 200.
- [ ] El formulario de contacto de `/about` sigue funcionando igual (no se toca).
- [ ] Ninguna regla de `globals.css` ha cambiado.

## Decisiones

**Alcance del corte**

- **Sí:** esta spec es solo _fundamentos + Auth por email_. Persistir juegos, puntuaciones y salón de la fama, el realtime y el storage van en specs posteriores que dependan de esta.
- **No:** meter toda la integración de Supabase (auth + base de datos + realtime) en un solo spec. Toca cuatro dominios; daría una rama imposible de revisar y que nunca cierra.
- **Sí:** arrancar el proyecto Supabase de cero. Es el primero; no hay proyecto previo que reutilizar.

**Modelo de autenticación**

- **Sí:** email + contraseña, con el "usuario" como `display_name`. Es el modelo nativo de Supabase Auth; no obliga a inventar una capa de mapeo.
- **No:** login por username mapeado a email por detrás. Requiere una tabla de lookup y consultas extra — justo el esquema de base de datos que esta spec aplaza.
- **Sí:** `display_name` en `user_metadata`, sin tabla `profiles`. Cero esquema de Postgres en esta spec. Cuando llegue la spec de base de datos se podrá materializar en una tabla con un trigger.
- **No:** crear ya una tabla `profiles` con RLS. Es territorio de la spec de base de datos; adelantarlo aquí mezcla dos cortes.

**Confirmación de email**

- **Sí:** desactivar la confirmación de email. El proyecto es de práctica; confirmar añade fricción y depende del envío de correos, que ya dio trabajo en la SPEC 03.
- **No:** activar confirmación con pantalla de "revisa tu correo". Correcto para producción, pero mete un flujo y una vista extra que no aportan a la práctica ahora mismo.

**Integración con Next 16**

- **Sí:** `@supabase/ssr` con los tres clientes (navegador, servidor y `proxy`). Es el patrón oficial y el único que refresca la cookie de sesión de forma fiable en el App Router.
- **Sí:** `proxy.ts` en vez de `middleware.ts`. En Next 16 `middleware` está deprecado; el patrón de Supabase de la documentación usa el nombre viejo y hay que traducirlo.
- **Sí:** leer el usuario con `getUser()`, no `getSession()`. `getUser()` revalida contra el servidor de Auth; `getSession()` se fía de la cookie, que se puede manipular.
- **Sí:** el layout pasa a dinámico al leer cookies. Es el coste de una nav que sabe quién está dentro; se acepta.

**Formularios y estado**

- **Sí:** Server Actions con `useActionState`, como la SPEC 03. Mismo patrón ya probado en el proyecto; no expone endpoint público propio ni obliga a escribir `fetch` desde el cliente.
- **Sí:** `AuthState` como unión discriminada sin variante `success`. El éxito redirige, así que no hay estado de éxito que renderizar; solo se modelan los caminos de error.
- **Sí:** validación a mano, sin Zod. Son tres campos; misma decisión que la SPEC 03.
- **Sí:** al cliente solo un mensaje genérico; el error real a `console.error` del servidor. La respuesta cruda de Supabase puede incluir detalles de cuenta.

**UI**

- **Sí:** botones sociales `disabled` con "PRÓXIMAMENTE". Un botón que no hace nada engaña; deshabilitado y etiquetado deja claro que llega después sin conectarlo hoy.
- **Sí:** la sesión se refleja en `Nav` vía prop desde el layout. Al login/logout la Server Action redirige, el layout servidor se re-renderiza y la nav se actualiza sin `onAuthStateChange` en cliente.
- **Sí:** "Jugar como invitado" se queda sin sesión. Convertirlo en sesión anónima de Supabase es una decisión de otro corte; hoy la biblioteca es pública igual.
- **Sí:** `/auth` redirige a `/biblioteca` si ya hay sesión. Un formulario de login para alguien que ya entró no tiene sentido.

## Riesgos

| Riesgo                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Confusión `middleware` vs `proxy`.** El patrón oficial de Supabase se documenta con `middleware.ts`; copiarlo literal en Next 16 usa un nombre deprecado y el refresco de sesión puede no aplicarse. | El paso 5 exige leer la sección `middleware`→`proxy` de `version-16.md` antes de escribir. Criterio de aceptación que verifica que el archivo raíz exporta `proxy`, no `middleware`.                 |
| **`getSession()` en lugar de `getUser()`.** `getSession()` se fía de la cookie sin revalidar; en servidor es manipulable y da una sensación de seguridad falsa.                                        | Decisión explícita de usar `getUser()` en layout y `proxy`. Criterio de aceptación que lo comprueba.                                                                                                 |
| **Sesión que caduca sola** si el `proxy` no refresca la cookie. El usuario aparece deslogueado sin motivo.                                                                                             | El `proxy.ts` con `updateSession` en cada request es justo lo que refresca el token. Criterio que navega y recarga comprobando que la sesión persiste.                                               |
| **`cookies()` tratado como síncrono.** En Next 16 es una Promise; sin `await` el cliente de servidor lee cookies vacías y toda sesión parece ausente.                                                  | El paso 4 marca el `await` explícito. `npx tsc --noEmit` cazaría el tipo Promise mal usado.                                                                                                          |
| **Correo entra en la sesión sin confirmar por olvidar el ajuste del dashboard.** Con la confirmación activa, el registro no entra directo y el paso 10 "falla" sin código de por medio.                | Paso 2 manual explícito de desactivar "Confirm email". Documentado como requisito, no como código.                                                                                                   |
| **Exponer la respuesta cruda de Supabase al cliente** (detalles de cuenta, correos existentes).                                                                                                        | Al cliente solo mensaje genérico; el real a `console.error` del servidor. Criterio de aceptación explícito. Mismo patrón que la SPEC 03.                                                             |
| **Tratar `NEXT_PUBLIC_SUPABASE_ANON_KEY` como secreto** y no ponerle el prefijo, rompiendo el cliente de navegador. O al revés, creer que por ser pública no importa quién la use.                     | Documentada en `.env.example` como pública por diseño, protegida por RLS en el servidor. La spec deja claro que RLS (la protección real) es de otro corte: hasta entonces no hay tablas que exponer. |
| **El layout dinámico afecta al render de todas las rutas.** Al leer cookies, `/` y compañía dejan de ser estáticas.                                                                                    | Aceptado. Es una app pequeña de práctica; el coste de re-render por request es irrelevante frente a tener la sesión visible en toda la app.                                                          |
| **Enviar la Server Action sin pasar por el formulario.** `required` y `maxLength` son UX y se borran desde el inspector.                                                                               | La validación de servidor de la tabla del modelo de datos es la que manda, y Supabase es la autoridad final sobre credenciales.                                                                      |
| **Sin persistencia de perfil, el `display_name` solo vive en `user_metadata`.** Si una futura spec necesita consultarlo por SQL, no está en ninguna tabla.                                             | Aceptado a propósito. La spec de base de datos lo materializará en `profiles` con un trigger sobre `auth.users`; hoy no hay consulta que lo necesite.                                                |

## Lo que **no** entra en esta spec

- Cualquier tabla, esquema o política RLS en Postgres.
- Persistir juegos, puntuaciones, ticker, top o salón de la fama.
- Login social (Google/GitHub) conectado.
- Sesión anónima para "Jugar como invitado".
- Rutas protegidas por sesión.
- Recuperación de contraseña, magic links y cambio de correo.
- Confirmación de email y su pantalla de "revisa tu correo".
- Avatares, storage y realtime.
- Tests.

Cada uno de esos, si llega, va en su propia spec.
