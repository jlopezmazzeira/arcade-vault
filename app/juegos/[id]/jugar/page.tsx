import { notFound } from "next/navigation";
import GamePlayerScreen from "@/app/_components/GamePlayerScreen";
import { getGame } from "@/lib/data/games";
import { createClient } from "@/lib/supabase/server";

export default async function GamePlayerPage({
  params,
}: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await params;

  const game = await getGame(id);
  if (!game) notFound();

  // Quién juega se decide en servidor, no en el navegador: con sesión manda el
  // `display_name`; sin ella, `null` y el modal pide iniciales de invitado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const playerName = user
    ? ((user.user_metadata?.display_name as string | undefined) ??
      user.email ??
      null)
    : null;

  return <GamePlayerScreen game={game} playerName={playerName} />;
}
