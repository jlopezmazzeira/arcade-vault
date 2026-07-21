"use server";

import { Resend } from "resend";

export type ContactState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "sent"; name: string }
  | { status: "failed"; message: string };

// Validación laxa a propósito (ver spec): `@` con texto a ambos lados y un `.`
// después del `@`. Un regex "completo" de RFC 5322 rechaza direcciones válidas
// y sigue colando inválidas; quien decide de verdad es el servidor de correo.
function isEmailish(email: string): boolean {
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const msg = String(formData.get("msg") ?? "").trim();

  // Validación de servidor: es la que manda, porque la Server Action es un
  // endpoint público invocable sin pasar por el formulario. `required` y
  // `maxLength` del HTML son solo UX y se borran desde el inspector.
  if (!name || name.length > 80) {
    return { status: "invalid", message: "Revisa el nombre (1-80 caracteres)." };
  }
  if (!email || email.length > 160 || !isEmailish(email)) {
    return { status: "invalid", message: "Revisa el correo electrónico." };
  }
  if (!msg || msg.length > 2000) {
    return { status: "invalid", message: "Revisa el mensaje (1-2000 caracteres)." };
  }

  // Las tres variables se leen DENTRO de la acción, no en el ámbito del módulo:
  // así un entorno sin RESEND_API_KEY rompe el envío, no el build.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !from || !to) {
    console.error(
      "[contact] Falta configuración de Resend: revisa RESEND_API_KEY, CONTACT_FROM_EMAIL y CONTACT_TO_EMAIL en .env.local"
    );
    return {
      status: "failed",
      message: "No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `Nuevo mensaje de ${name} — Arcade Vault`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}\n`,
    });

    if (error) {
      // El error real solo al servidor: la respuesta cruda del proveedor puede
      // incluir detalles de cuenta o fragmentos de la clave.
      console.error("[contact] Resend devolvió error:", error);
      return {
        status: "failed",
        message: "No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.",
      };
    }

    return { status: "sent", name };
  } catch (err) {
    console.error("[contact] Excepción al enviar con Resend:", err);
    return {
      status: "failed",
      message: "No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.",
    };
  }
}
