import type { ScoreRow } from "@/data/games";
import { getGames } from "@/lib/data/games";
import { getTopScores } from "@/lib/data/scores";
import HallTabs from "./HallTabs";

// Server Component: precomputa el ranking de los 8 juegos en un solo render y
// se lo pasa entero al cliente. Así cambiar de pestaña es instantáneo, sin un
// fetch por clic. Son 8 consultas top-12 sobre el índice (game_id, score desc),
// y van en paralelo, no en cadena.
export default async function HallOfFamePage() {
  const games = await getGames();

  const rankings = await Promise.all(
    games.map(async (g) => [g.id, await getTopScores(g.id, 12)] as const),
  );
  const scoresByGame: Record<string, ScoreRow[]> = Object.fromEntries(rankings);

  return <HallTabs games={games} scoresByGame={scoresByGame} />;
}
