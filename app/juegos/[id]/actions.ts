"use server";

import { getGame } from "@/lib/data/games";
import { createClient } from "@/lib/supabase/server";

// Unión discriminada al estilo del AuthState de la SPEC 04. Aquí sí hay
// variante de éxito (`saved`): el modal no navega a ningún sitio, se queda
// abierto mostrando la confirmación.
export type SaveScoreState =
  | { status: "idle" }
  | { status: "invalid"; message: string } // validación de servidor fallida
  | { status: "error"; message: string } // Supabase devolvió error
  | { status: "saved" };

// Cota de cordura, no antifraude: descarta valores imposibles o corruptos, no
// juzga si la partida fue legítima (eso queda fuera de esta spec).
const MAX_SCORE = 100_000_000;
const MAX_NAME = 40;

export async function saveScore(
  _prev: SaveScoreState,
  formData: FormData,
): Promise<SaveScoreState> {
  const gameId = String(formData.get("game_id") ?? "").trim();
  const rawName = String(formData.get("player_name") ?? "").trim();
  const rawScore = String(formData.get("score") ?? "").trim();

  // El juego tiene que existir. La FK ya lo garantizaría, pero comprobarlo
  // antes permite dar un mensaje con sentido en vez de un error de base.
  if (!gameId || !(await getGame(gameId))) {
    return { status: "invalid", message: "Ese juego no existe." };
  }

  const score = Number(rawScore);
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { status: "invalid", message: "La puntuación no es válida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión el nombre lo pone el servidor: se IGNORA el del formulario para
  // que nadie pueda firmar su récord con el nombre de otro.
  const playerName = user
    ? (
        (user.user_metadata?.display_name as string | undefined) ??
        user.email ??
        ""
      )
        .trim()
        .slice(0, MAX_NAME)
    : rawName;

  if (!playerName || playerName.length > MAX_NAME) {
    return {
      status: "invalid",
      message: `Escribe un nombre de 1 a ${MAX_NAME} caracteres.`,
    };
  }

  const { error } = await supabase.from("scores").insert({
    game_id: gameId,
    // Invitado: `null`. El RLS solo acepta `null` o el propio `auth.uid()`.
    user_id: user?.id ?? null,
    player_name: playerName,
    score,
  });

  if (error) {
    // Al cliente solo un mensaje genérico: la respuesta cruda de Supabase puede
    // filtrar detalles del esquema.
    console.error("[scores] insert devolvió error:", error);
    return {
      status: "error",
      message: "No se pudo guardar la puntuación. Inténtalo de nuevo.",
    };
  }

  return { status: "saved" };
}
