"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Unión discriminada al estilo del ContactState de la SPEC 03. No hay variante
// `success`: el éxito redirige (redirect("/biblioteca")), así que no queda
// estado de éxito que renderizar; solo se modelan los caminos de error.
export type AuthState =
  | { status: "idle" }
  | { status: "invalid"; message: string } // validación local fallida
  | { status: "error"; message: string }; // Supabase devolvió error

// Validación de cordura (no de seguridad): `@` con texto a ambos lados. Supabase
// es la autoridad final sobre las credenciales; esto solo evita llamadas
// obviamente inválidas y da respuesta inmediata.
function isEmailish(email: string): boolean {
  const at = email.indexOf("@");
  return at > 0 && at < email.length - 1;
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  // Validación de servidor (manda ella, no el `required`/`maxLength` del HTML,
  // que se borran desde el inspector). Reglas de la tabla del modelo de datos.
  if (!displayName || displayName.length > 40) {
    return { status: "invalid", message: "Revisa el usuario (1-40 caracteres)." };
  }
  if (!email || !isEmailish(email)) {
    return { status: "invalid", message: "Revisa el correo electrónico." };
  }
  if (password.length < 6) {
    return {
      status: "invalid",
      message: "La contraseña debe tener al menos 6 caracteres.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // El "Usuario" del formulario viaja en user_metadata; sin tabla `profiles`
    // en esta spec.
    options: { data: { display_name: displayName } },
  });

  if (error) {
    // El detalle real solo al servidor: la respuesta cruda de Supabase puede
    // revelar si un correo ya existe u otros datos de cuenta.
    console.error("[auth] signUp devolvió error:", error);
    return {
      status: "error",
      message: "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    };
  }

  redirect("/biblioteca");
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !isEmailish(email)) {
    return { status: "invalid", message: "Revisa el correo electrónico." };
  }
  if (password.length < 6) {
    return {
      status: "invalid",
      message: "La contraseña debe tener al menos 6 caracteres.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[auth] signIn devolvió error:", error);
    return {
      status: "error",
      message: "Credenciales incorrectas. Inténtalo de nuevo.",
    };
  }

  redirect("/biblioteca");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
