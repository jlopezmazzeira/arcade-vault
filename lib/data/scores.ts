import type { ScoreRow } from "@/data/games";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Lecturas del leaderboard. Alimenta el aside de la ficha y las pestañas del
// salón; ambas superficies leen de `scores`, no de `seededScores`.

type ScoreDbRow = Pick<
  Tables<"scores">,
  "player_name" | "score" | "created_at"
>;

// Fecha fijada a UTC: las filas sembradas son medianoche UTC, y sin fijar la
// zona el formateo dependería de la del servidor, que podría restar un día.
const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

// El `rank` no vive en la BD: es la posición dentro de este resultado, así que
// se calcula al mapear. A igualdad de puntos desempata la fila más antigua (el
// segundo `order` de la consulta): quien lo consiguió primero manda.
export async function getTopScores(
  gameId: string,
  limit = 12,
): Promise<ScoreRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[getTopScores]", error);
    throw new Error("No se pudieron cargar las puntuaciones.");
  }

  return data.map((row: ScoreDbRow, index) => ({
    rank: index + 1,
    name: row.player_name,
    score: row.score,
    date: DATE_FORMAT.format(new Date(row.created_at)),
  }));
}
