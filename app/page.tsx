import HomeScreen from "@/app/HomeScreen";
import { getGames } from "@/lib/data/games";

// Server Component: solo lee el catálogo y se lo entrega a la home, que sigue
// siendo cliente por el hook de reveal al hacer scroll.
export default async function HomePage() {
  const games = await getGames();

  return <HomeScreen games={games} />;
}
