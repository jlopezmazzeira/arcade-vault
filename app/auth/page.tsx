import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/app/auth/AuthForm";

// Contenedor de servidor: si ya hay sesión, un formulario de login no tiene
// sentido → se redirige a /biblioteca. Si no, se renderiza el form cliente.
// Se lee con getUser() (revalida contra Auth), no getSession() (se fía de la
// cookie, manipulable).
export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/biblioteca");
  }

  return <AuthForm />;
}
