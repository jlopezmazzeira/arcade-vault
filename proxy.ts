import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// En Next 16 la convención `middleware` está deprecada y se llama `proxy`. El
// patrón oficial de Supabase se documenta como `middleware.ts`; aquí se traduce
// al nombre correcto. El runtime de `proxy` es `nodejs` y no se configura.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Excluye rutas de API, estáticos de Next, optimización de imágenes y el
  // favicon/archivos de imagen: el refresco de sesión no debe correr sobre
  // ellos (y así no bloquea CSS/JS/imágenes por error).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
