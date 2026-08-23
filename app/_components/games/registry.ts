// ============================================================================
// Registro de juegos jugables: id de data/games.ts → componente real.
//
// La carga es diferida (next/dynamic), así el código del juego NO entra en el
// bundle de las rutas que no lo juegan. Hoy están adaptados `rocas`, `caida`,
// `bloque-buster` y `serpentina`; el resto de ids no tienen entrada y
// `getPlayableGame` devuelve null, con lo que GamePlayerScreen mantiene su mock
// intacto (fallback de no-regresión).
// ============================================================================

import dynamic from "next/dynamic";
import type { ComponentType, Ref } from "react";
import type { PlayableGameHandle, PlayableGameProps } from "./AsteroidsGame";

// Componente de juego con ref imperativo (para restart()).
type PlayableGame = ComponentType<
  PlayableGameProps & { ref?: Ref<PlayableGameHandle> }
>;

export const PLAYABLE_GAMES: Record<string, PlayableGame> = {
  rocas: dynamic(() => import("./AsteroidsGame")),
  caida: dynamic(() => import("./TetrisGame")),
  "bloque-buster": dynamic(() => import("./ArkanoidGame")),
  serpentina: dynamic(() => import("./SnakeGame")),
};

export function getPlayableGame(id: string): PlayableGame | null {
  return PLAYABLE_GAMES[id] ?? null;
}
