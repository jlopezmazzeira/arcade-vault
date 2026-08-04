import { getGames } from "@/lib/data/games";
import LibraryBrowser from "./LibraryBrowser";

// Server Component: el catálogo se lee de `games` en el servidor y baja ya
// renderizado. El filtrado vive en `LibraryBrowser` (cliente).
export default async function LibraryPage() {
  const games = await getGames();

  return <LibraryBrowser games={games} />;
}
