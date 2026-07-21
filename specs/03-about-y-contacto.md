# SPEC 03 — Página «Acerca de» y formulario de contacto

> **Status:** Approved
> **Depends on:** SPEC 02
> **Date:** 2026-07-21
> **Objective:** Portar `references/templates/home-about/about.jsx` a `/about` y hacer que su formulario de contacto envíe un correo real de texto plano al equipo mediante la API de Resend.

## Alcance

**Dentro:**

- `app/about/page.tsx`: la página portada de `about.jsx` en dos secciones —el hero "ACERCA DE ARCADE VAULT" con sus tres `highlight`, y "CONTÁCTANOS" con el formulario—, separadas por la banda divisoria de 24 píxeles animados. Componente cliente, porque usa `useReveal` y `useActionState`.
- `app/about/actions.ts`: Server Action `sendContactMessage`. Revalida los tres campos, llama a Resend y devuelve un estado discriminado de éxito o error.
- `app/_components/HighlightIcon.tsx`: los tres iconos pixel (`HEART`, `BROWSER`, `PLANT`), con `kind` tipado como unión de esos tres literales.
- `data/about.ts` con `HIGHLIGHTS` y `TIPS`, siguiendo lo que la SPEC 02 hizo con `data/home.ts`.
- El bloque `ABOUT PAGE` de `references/templates/home-about/styles.css` (líneas 1071-1150) copiado literalmente al final de `app/globals.css`. Incluye `@keyframes pxblink` y `@keyframes shake`; está verificado que ninguna clase del about vive fuera de ese rango.
- `app/_components/Nav.tsx`: se añade `isAbout` (`pathname === "/about"`) y se aplica a los dos enlaces "Acerca de", el de la barra y el del panel móvil. Es el único cambio; el enlace ya existe desde la SPEC 02.
- Dependencia nueva `resend` en `package.json`.
- Tres variables de entorno: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` y `CONTACT_TO_EMAIL`. Se documentan en un `.env.example` con valores vacíos; los valores reales los pone el usuario en `.env.local`.
- `.gitignore`: excepción `!.env.example`. La línea 34 es hoy `.env*`, que también ignora el ejemplo.
- Estado de error `[FAIL]` en la terminal, con el formulario intacto para reintentar. La plantilla no contempla el fallo: hace `setSent(name)` sin `await` ni `try/catch`.

**Fuera de alcance (para futuras specs):**

- Verificación de dominio en Resend. Se arranca con `onboarding@resend.dev`, que **solo entrega al correo de la cuenta** (ver Riesgos).
- Acuse de recibo al visitante. Solo se envía un correo, al equipo.
- Plantilla HTML del correo. Se manda `text` plano, sin `html`.
- Antispam: ni honeypot, ni límite por IP, ni captcha. Decisión consciente del usuario —"es solo para práctica"—, no un olvido. Ver Riesgos.
- Persistencia de los mensajes. No se guardan en ninguna parte; si el correo no llega, el mensaje se pierde.
- Adjuntos en el formulario.
- Las secciones `GAMEPAD` (1151-1509) y `Theme variants` (1510-1620) de la hoja de la plantilla. `about.jsx` no usa ninguna de sus clases.
- Tests. Sigue sin haber runner.

## Modelo de datos

No hay persistencia. Los mensajes enviados no se guardan en ninguna parte: viven lo que dura la llamada a Resend. El contenido de la página es mock estático, como en las SPEC 01 y 02.

```ts
// data/about.ts
type Highlight = {
  kind: "HEART" | "BROWSER" | "PLANT";  // debe coincidir con HighlightIcon.kind
  text: string;
  color: "magenta" | "cyan" | "green";  // subconjunto de AccentColor
};

type Tip = {
  text: string;
  led: "" | "y" | "m";                  // clase modificadora de .tip-led
};

export const HIGHLIGHTS: readonly Highlight[];  // 3 filas
export const TIPS: readonly Tip[];              // 3 filas
```

```ts
// app/about/actions.ts — estado que consume useActionState
export type ContactState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "sent"; name: string }
  | { status: "failed"; message: string };

export async function sendContactMessage(
  prev: ContactState,
  formData: FormData
): Promise<ContactState>;
```

Reglas de validación en servidor (a mano, sin Zod):

| Campo   | Regla                                            |
| ------- | ------------------------------------------------ |
| `name`  | `trim()` no vacío, ≤ 80 caracteres               |
| `email` | `trim()` no vacío, ≤ 160, contiene `@` con texto a ambos lados y un `.` tras el `@` |
| `msg`   | `trim()` no vacío, ≤ 2000 caracteres             |

Variables de entorno (todas de servidor — **ninguna lleva `NEXT_PUBLIC_`**):

| Variable             | Ejemplo                    | Uso              |
| -------------------- | -------------------------- | ---------------- |
| `RESEND_API_KEY`     | `re_xxx`                   | Cliente del SDK  |
| `CONTACT_FROM_EMAIL` | `onboarding@resend.dev`    | Remitente        |
| `CONTACT_TO_EMAIL`   | correo de la cuenta Resend | Destinatario     |

Se leen **dentro** de la Server Action, no en el ámbito del módulo, para que un entorno sin `RESEND_API_KEY` no rompa el build.

Cuatro decisiones metidas en esos tipos:

1. **`ContactState` es una unión discriminada, no `{ sent, error, loading }`.** Con banderas sueltas son representables estados imposibles —`sent: true` y `error: "..."` a la vez— y el JSX acaba lleno de condiciones que se contradicen. `useActionState` ya da el `isPending` aparte, así que "cargando" no necesita variante propia.
2. **`sent` transporta el `name`.** La terminal cierra con `GRACIAS, {NAME}` en mayúsculas. Si no viaja en el estado, hay que conservar el formulario tras el éxito solo para leer ese campo.
3. **El límite de longitud es validación, no antispam.** Sin él, un `msg` de 5 MB llega hasta la API de Resend antes de que nadie lo rechace.
4. **Validación de correo laxa a propósito.** Un regex "completo" de RFC 5322 rechaza direcciones válidas y sigue aceptando inválidas. Quien decide de verdad si existe es el servidor de correo.

## Plan de implementación

Antes del paso 1, leer `node_modules/next/dist/docs/01-app/02-guides/forms.md`. Está verificado que Next 16 **no** introduce cambios de ruptura en Server Actions ni en `useActionState` —las únicas menciones en `version-16.md` son sobre `updateTag` y `refresh`, ajenas a esta spec—, pero `AGENTS.md` exige leer la guía correspondiente antes de escribir código.

Cada paso deja la aplicación arrancable con `npm run dev`.

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.example` con las tres claves y valores vacíos. Añadir `!.env.example` a `.gitignore` **después** de la línea 34 (`.env*`) — antes, la excepción no surte efecto.
   Verificación: `git check-ignore .env.example` no devuelve nada, y `git check-ignore .env.local` sí lo devuelve.

2. **CSS.** Copiar literalmente las líneas 1071-1150 de `references/templates/home-about/styles.css` al final de `app/globals.css`. Nada del CSS existente se modifica.
   Verificación: `.about-hero`, `.highlight`, `.contact-form`, `.terminal-success` y los `@keyframes pxblink` y `shake` existen en `globals.css`; `.field` sigue definida una sola vez (ya venía de la SPEC 01).

3. **`data/about.ts`.** Portar `HIGHLIGHTS` y `TIPS` desde los literales incrustados en `about.jsx`, con los tipos de la sección anterior.

4. **`app/_components/HighlightIcon.tsx`.** Los tres SVG pixel, con `kind` tipado como unión de tres literales. Sin estado, sin props más.

5. **`app/about/page.tsx` — hero y banda divisoria.** Componente cliente que llama a `useReveal`. Hero con kicker, título, párrafo de misión y la fila de tres `highlight` con su `transitionDelay` escalonado de 80 ms; después la banda de 24 píxeles animados, `aria-hidden="true"`. Sin formulario todavía.
   Verificación: `/about` responde 200 y deja de mostrar el 404. Los tres highlights aparecen escalonados.

6. **`app/about/actions.ts`.** Server Action `sendContactMessage` con `"use server"` al inicio del archivo. Lee los tres campos del `FormData`, revalida según la tabla del modelo de datos y, si pasa, instancia el cliente de Resend y envía. Lee las tres variables de entorno **dentro** de la función. Devuelve `failed` —no lanza— cuando falta `RESEND_API_KEY`, cuando Resend responde error, o cuando la llamada revienta. El error real se registra con `console.error` en servidor; al cliente solo va un mensaje genérico.
   Verificación: sin `.env.local`, enviar el formulario devuelve `failed` y la página sigue en pie.

7. **`app/about/page.tsx` — formulario.** La sección "CONTÁCTANOS" con la columna de intro (kicker, título, subtítulo, tres `tip` desde `TIPS`) y el `<form action={formAction}>` conectado con `useActionState(sendContactMessage, { status: "idle" })`. Los tres campos llevan `name`, `required` y `maxLength` acordes a la tabla de validación. El botón se deshabilita mientras `isPending`.
   Verificación: los campos son controlados por el DOM, no por `useState`; el formulario se envía y la acción se ejecuta.

8. **Estados de resultado.** Tres ramas sobre `state.status`:
   - `sent` → la terminal `VAULT-OS`, con las líneas `[OK]`, el `GRACIAS, {NAME}` en mayúsculas y el botón "ENVIAR OTRO MENSAJE" que vuelve a `idle`.
   - `failed` → la misma terminal en variante `[FAIL]`, **con el formulario todavía visible debajo** para reintentar sin reescribir nada.
   - `invalid` → dispara la clase `shake` durante 400 ms, igual que la plantilla.

   Verificación: con clave inválida en `.env.local` sale `[FAIL]` y los datos escritos siguen en los campos.

9. **`app/_components/Nav.tsx`.** Añadir `isAbout = pathname === "/about"` y aplicarlo a los dos enlaces "Acerca de" (barra y panel móvil).
   Verificación: en `/about` solo "Acerca de" está marcado activo.

10. **`prefers-reduced-motion` y salvaguarda sin JS.** Extender los bloques ya existentes de `globals.css` (líneas 1284 y 1306) con las animaciones nuevas: `pxblink` de la banda divisoria y `shake` del formulario.
    Verificación: con "reducir movimiento" activo, la banda no parpadea y el formulario no se agita. Con JS desactivado, el about se ve entero.

11. **Prueba de envío real.** Con `.env.local` completo, enviar un mensaje y confirmar que llega a `CONTACT_TO_EMAIL`, que el asunto identifica al remitente y que responder desde el cliente de correo va al visitante.

12. **Pasada final.** `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores ni avisos.

Cuatro apuntes sobre el orden:

- **El paso 5 quita el 404 antes de que exista el formulario.** `/about` queda utilizable —hero, misión, highlights— desde el primer commit visible, y la SPEC 02 deja de tener un enlace roto tres pasos antes de terminar.
- **La acción (6) va antes que el formulario (7).** Al revés, el paso 7 dejaría un `<form>` apuntando a algo inexistente: un commit que no compila.
- **El paso 6 se verifica *sin* `.env.local`.** Es el camino que más se va a recorrer en desarrollo y el que la plantilla original ni contempla.
- **El paso 11 es manual y no lo cubre ningún test.** No hay runner, y aunque lo hubiera, que Resend entregue de verdad no se comprueba con un mock.

Un detalle del paso 7 que cambia respecto a la plantilla: **los campos dejan de ser controlados**. `about.jsx` los lleva con `useState`; con `useActionState` los lee el `FormData`, así que sobra el estado. Menos código y el formulario sigue funcionando durante la hidratación.

## Criterios de aceptación

**Build y calidad**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` no reporta errores ni avisos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] La consola no muestra errores ni avisos de hidratación en `/about`.
- [ ] `npm run build` completa con `.env.local` ausente.

**Entorno y secretos**

- [ ] `.env.example` existe, lista las tres claves y ninguna tiene valor.
- [ ] `git check-ignore .env.example` no devuelve nada.
- [ ] `git check-ignore .env.local` devuelve la ruta.
- [ ] `git log -p` no contiene ninguna clave de Resend.
- [ ] Ninguna de las tres variables lleva prefijo `NEXT_PUBLIC_`.
- [ ] Buscar `re_` en el bundle de cliente (`.next/static`) no da resultados.

**Ruta y navegación**

- [ ] `/about` responde 200 y ya no muestra `not-found.tsx`.
- [ ] En `/about` solo "Acerca de" está marcado activo, en barra y panel móvil.
- [ ] En `/`, `/biblioteca`, `/juegos/caida` y `/salon` "Acerca de" **no** está activo.
- [ ] Las rutas de las SPEC 01 y 02 siguen respondiendo 200.

**Contenido**

- [ ] El hero muestra kicker, título, párrafo de misión y 3 highlights.
- [ ] Cada highlight muestra su icono pixel y su color: magenta, cian y verde.
- [ ] Los highlights entran escalonados, con 80 ms de diferencia entre ellos.
- [ ] La banda divisoria muestra 24 píxeles parpadeando en cascada.
- [ ] La columna de contacto muestra 3 tips con sus LED de distinto color.

**Formulario — validación**

- [ ] Enviar con los tres campos vacíos no llama a Resend.
- [ ] Enviar con un campo solo de espacios se rechaza igual que vacío.
- [ ] Un `msg` de más de 2000 caracteres se rechaza en servidor.
- [ ] Un correo sin `@` se rechaza en servidor.
- [ ] Quitando `required` desde las herramientas del navegador y enviando vacío, la acción responde `invalid` y no llama a Resend.

**Formulario — envío correcto**

- [ ] Con `.env.local` válido, enviar muestra la terminal `VAULT-OS` con las líneas `[OK]` y `GRACIAS, {NOMBRE}` en mayúsculas.
- [ ] Durante el envío el botón está deshabilitado.
- [ ] "ENVIAR OTRO MENSAJE" devuelve el formulario vacío y listo para escribir.

**Formulario — envío fallido**

- [ ] Sin `RESEND_API_KEY`, enviar muestra la terminal en variante `[FAIL]`.
- [ ] Con `RESEND_API_KEY` inválida, enviar muestra `[FAIL]`.
- [ ] En `[FAIL]` el formulario sigue visible y conserva lo escrito.
- [ ] El mensaje de `[FAIL]` no expone la respuesta cruda de Resend ni la clave.
- [ ] El error real aparece en la consola del **servidor**, no en la del navegador.

**Correo recibido**

- [ ] Llega un correo a `CONTACT_TO_EMAIL`.
- [ ] El asunto identifica al remitente del formulario.
- [ ] El cuerpo es texto plano y contiene nombre, correo y mensaje completos.
- [ ] No se envía ningún correo al visitante.
- [ ] Pulsar "responder" en el cliente de correo dirige al correo del visitante, no a `CONTACT_FROM_EMAIL`.

**Animación y accesibilidad**

- [ ] Al cargar `/about` sin hacer scroll, la sección de contacto está oculta.
- [ ] Al hacer scroll cada sección aparece una vez y no se re-anima al subir.
- [ ] Con "reducir movimiento" activo, todo se ve de entrada, la banda no parpadea y el formulario no se agita.
- [ ] Con JavaScript desactivado, `/about` se ve entera.
- [ ] Cada campo tiene su `<label>` asociado por `htmlFor`/`id`.
- [ ] Tabulando por `/about` se ve indicador de foco en campos y botones.
- [ ] Ninguna regla preexistente de `globals.css` ha cambiado.

## Decisiones

**Transporte y formulario**

- **Sí:** Server Action con `useActionState`. No expone endpoint público, el estado de envío y error viene del propio hook, y no hay que escribir `fetch` desde el cliente.
- **No:** Route Handler en `app/api/contact/route.ts`. Más convencional y probable con `curl`, pero es un endpoint abierto que cualquiera puede golpear y que habría que defender aparte — justo lo que esta spec aplaza.
- **Sí:** campos no controlados, leídos del `FormData`. La plantilla los lleva con `useState`; con `useActionState` ese estado es redundante y el formulario además funciona durante la hidratación.
- **Sí:** `ContactState` como unión discriminada. Con banderas sueltas (`sent`/`error`/`loading`) son representables estados imposibles y el JSX se llena de condiciones contradictorias.
- **Sí:** validación a mano, sin Zod. Son tres campos; meter una dependencia en un proyecto que hoy solo tiene Next y React no lo compensa.
- **Sí:** validar en cliente **y** en servidor. El cliente da respuesta inmediata; el servidor es el que manda, porque una Server Action es un endpoint público que cualquiera puede invocar sin pasar por el formulario.

**Correo**

- **Sí:** SDK `resend`. Dependencia pequeña y tipada; evita escribir a mano el manejo de códigos de respuesta.
- **No:** `fetch` directo a `api.resend.com`. Cero dependencias nuevas, pero el manejo de errores queda a nuestro cargo sin ganancia real.
- **Sí:** texto plano, sin `html`. Se valoró una plantilla HTML con estética arcade y se descartó: la fuente pixel no sobrevive a Gmail —elimina `@font-face`—, así que "arcade" habría acabado siendo `monospace` sobre fondo oscuro. Para tres campos, no justifica una plantilla que mantener.
- **No:** React Email. Son ~15 paquetes nuevos para un único correo.
- **Sí:** `reply_to` con el correo del visitante. Responder desde la bandeja le llega directamente, sin copiar y pegar la dirección.
- **Sí:** solo un correo, al equipo. El acuse de recibo al visitante duplica contenido y dispara la conversación sobre plantillas que acabamos de cerrar.
- **Sí:** el error real solo en `console.error` del servidor; al cliente un mensaje genérico. La respuesta cruda de un proveedor puede incluir detalles de cuenta o fragmentos de la clave.

**Entorno y secretos**

- **Sí:** las tres variables sin `NEXT_PUBLIC_`. Ese prefijo las incrusta en el bundle de cliente: sería publicar la clave de la API.
- **Sí:** leerlas dentro de la Server Action, no en el ámbito del módulo. Así un entorno sin `RESEND_API_KEY` rompe el envío, no el build.
- **Sí:** falta de clave → `[FAIL]` en tiempo de envío. Descartado hacer fallar el arranque: dejaría el proyecto sin levantar para cualquiera que clone el repo solo a mirar la interfaz.
- **Sí:** `onboarding@resend.dev` como remitente inicial. Verificar dominio es trabajo de infraestructura ajeno a esta spec, y bloquearía la implementación entera esperando DNS.

**Antispam**

- **Sí:** ninguna defensa en esta spec. Decisión explícita del usuario: el proyecto es de práctica y no se despliega público a corto plazo.
- **No:** honeypot y límite de longitud como antispam. El límite de longitud sí entra, pero como validación de cordura, no como defensa.
- **No:** límite por IP en memoria. En serverless con varias instancias es aproximado, y da una sensación de protección que no corresponde con lo que realmente hace.
- **Pendiente:** si el sitio se publica, esto es lo primero que hay que revisar. Un formulario abierto sin defensas quema cuota de Resend y llena la bandeja.

**Contenido y estilos**

- **Sí:** `data/about.ts` con `HIGHLIGHTS` y `TIPS`. Son solo seis entradas, pero las SPEC 01 y 02 ya separaron datos de UI; hacer la excepción aquí es la clase de inconsistencia que nadie recuerda haber decidido.
- **Sí:** copiar solo el bloque `ABOUT PAGE` (1071-1150). Traer `GAMEPAD` y `Theme variants` serían ~470 líneas de CSS muerto.
- **Sí:** copia literal, sin reescribir a utilidades Tailwind. Misma decisión que las SPEC 01 y 02, por el mismo motivo.
- **Sí:** `HighlightIcon.kind` como unión de tres literales. Con `string`, un typo devuelve `null` y el icono desaparece sin error.
- **Sí:** reutilizar el `useReveal` de la SPEC 02 tal cual, sin tocarlo.
- **Sí:** en `[FAIL]`, mantener el formulario visible bajo la terminal. Ocultarlo obligaría a reescribir el mensaje entero por un fallo que probablemente sea transitorio.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **`onboarding@resend.dev` solo entrega al correo de la cuenta Resend.** Con cualquier otro `CONTACT_TO_EMAIL`, la API responde 200 y el correo nunca llega: un fallo silencioso que parece éxito. | Documentado en `.env.example` junto a la variable. El paso 11 exige confirmar la recepción real, no que la API devuelva 200. |
| **Filtrar `RESEND_API_KEY` al bundle de cliente.** No rompe nada, no da error: solo publica la clave. | Ninguna variable lleva `NEXT_PUBLIC_`; se leen dentro de la Server Action. Criterio que busca `re_` en `.next/static`. |
| **Commitear `.env.local`.** | `.gitignore` ya cubre `.env*`; la excepción `!.env.example` se añade después de esa línea, nunca antes. Criterios con `git check-ignore` para ambos archivos. |
| **Formulario abierto sin antispam.** Los bots lo encuentran solos y cada envío quema cuota de Resend. | Aceptado a propósito mientras el proyecto no se despliegue público. Registrado como **Pendiente** en Decisiones, no como resuelto. |
| **Los mensajes no se guardan.** Si Resend falla tras validar, el texto del visitante se pierde. | En `[FAIL]` el formulario sigue visible y conserva lo escrito, así que el reintento no obliga a reescribir. Es mitigación parcial: si el visitante cierra la pestaña, se pierde igual. |
| **Server Action invocable sin pasar por el formulario.** `required` y `maxLength` son UX, se borran desde el inspector en dos clics. | La validación de servidor de la tabla del modelo de datos es la que manda. Criterio explícito que quita `required` y comprueba que la acción responde `invalid`. |
| **La respuesta cruda de Resend expuesta al cliente.** Puede incluir detalles de cuenta o fragmentos de la clave. | El error real solo va a `console.error` del servidor; al cliente, mensaje genérico. |
| **Copiar de más al portar el CSS** y redefinir reglas ya migradas. | El rango es 1071-1150, verificado como autocontenido. Criterio que comprueba que `.field` sigue definida una sola vez. |
| **La página entera es cliente** por `useActionState` y `useReveal`, incluido el hero estático. | Aceptado. Partirla en un Server Component con isla de formulario añade indirección para ahorrar unos pocos KB en una página de dos secciones. |
| **`.reveal` arranca en `opacity: 0`.** Si el JS falla, la sección de contacto queda en blanco de forma permanente y silenciosa. | La regla bajo `@media (scripting: none)` de la SPEC 02 ya la cubre; el paso 10 verifica que sigue aplicando al about. |

## Lo que **no** entra en esta spec

- Verificación de dominio en Resend.
- Acuse de recibo al visitante.
- Plantilla HTML del correo.
- Antispam de cualquier tipo.
- Persistencia de los mensajes enviados.
- Adjuntos en el formulario.
- El CSS de `GAMEPAD` y `Theme variants`.
- Reescritura de estilos a Tailwind.
- Tests.

Cada uno de esos, si llega, va en su propia spec.
