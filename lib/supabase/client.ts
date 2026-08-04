import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

// Cliente de Supabase para el navegador. Sin estado propio: se crea uno nuevo
// donde haga falta. Lee las dos variables PÚBLICAS (prefijo NEXT_PUBLIC_), que
// por diseño viajan al cliente; la protección real es el RLS de las tablas
// (SPEC 06), no el secreto de la clave.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
