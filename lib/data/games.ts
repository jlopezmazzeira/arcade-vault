import type { AccentColor, CoverArt, Game, GameCategory } from "@/data/games";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Lecturas del catálogo. `games` es la fuente de verdad desde la SPEC 06:
// `data/games.ts` solo aporta los tipos (y el origen de la siembra), ya no
// datos de runtime.

// Todas las columnas que la UI necesita. `position` se queda fuera a propósito:
// solo sirve para ordenar, no llega a la pantalla. `created_at` tampoco se usa.
const COLUMNS = "id, title, short, long, cat, cover, color, best, plays";

type GameRow = Pick<
  Tables<"games">,
  | "id"
  | "title"
  | "short"
  | "long"
  | "cat"
  | "cover"
  | "color"
  | "best"
  | "plays"
>;

// Mapeo columna a columna. Los `as` son seguros porque la BD acota el dominio:
// `cat` y `color` tienen CHECK con exactamente los valores de esas uniones, y
// `cover` se sembró desde el mismo array del que salen los tipos.
function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as GameCategory,
    cover: row.cover as CoverArt,
    color: row.color as AccentColor,
    best: row.best,
    plays: row.plays,
  };
}

// Ordena por `position`, el orden curado del catálogo. Ordenar por `title`
// habría reordenado la parrilla alfabéticamente.
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("games")
    .select(COLUMNS)
    .order("position", { ascending: true });

  if (error) {
    console.error("[getGames]", error);
    throw new Error("No se pudo cargar el catálogo de juegos.");
  }

  return data.map(toGame);
}

// `null` cuando el id no existe: quien llama decide si eso es un `notFound()`.
// `maybeSingle()` en vez de `single()` para que "no hay fila" no sea un error.
export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("games")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getGame]", error);
    throw new Error("No se pudo cargar el juego.");
  }

  return data ? toGame(data) : null;
}
