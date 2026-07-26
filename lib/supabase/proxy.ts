import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la cookie de sesión en cada request. Crea un cliente de servidor
// sobre la request/response, llama a `getUser()` (que REVALIDA contra el
// servidor de Auth, a diferencia de `getSession()`, que solo se fía de la
// cookie) y devuelve la response con las cookies actualizadas. Sin esto, el
// token caduca y el usuario aparece deslogueado sin motivo.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No metas lógica entre createServerClient y getUser: un despiste aquí puede
  // provocar cierres de sesión aleatorios difíciles de depurar.
  await supabase.auth.getUser();

  return supabaseResponse;
}
