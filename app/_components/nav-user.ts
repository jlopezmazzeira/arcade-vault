// Subconjunto del User de Supabase que la UI de la barra necesita. `null`
// significa "sin sesión". El `display_name` sale de user_metadata, con fallback
// al email si faltara.
export type NavUser = {
  email: string;
  display_name: string;
} | null;
