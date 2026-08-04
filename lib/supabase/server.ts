import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

// Cliente de Supabase para el servidor (Server Components y Server Actions).
// En Next 16 `cookies()` es asíncrono y hay que await-earlo (el shim síncrono de
// v15 se eliminó), así que `createClient()` es asíncrona.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: el refresco de la cookie de
            // sesión lo hace el `proxy`, así que aquí se puede ignorar sin riesgo.
          }
        },
      },
    },
  );
}
