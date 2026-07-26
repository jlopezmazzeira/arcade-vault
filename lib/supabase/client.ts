import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para el navegador. Sin estado propio: se crea uno nuevo
// donde haga falta. Lee las dos variables PÚBLICAS (prefijo NEXT_PUBLIC_), que
// por diseño viajan al cliente; la protección real es RLS en el servidor, que
// es territorio de una spec posterior.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
