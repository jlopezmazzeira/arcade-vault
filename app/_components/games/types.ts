// ============================================================================
// Contrato juego ↔ plataforma.
//
// Todo juego adaptado (registry.ts) habla con GamePlayerScreen a través de
// estos cuatro tipos. La única métrica obligatoria es `score`: `lives` y
// `level` son opcionales porque no todo juego los tiene (Tetris no tiene
// vidas), y las métricas propias de cada juego viajan ya formateadas en
// `extra`, de modo que el HUD solo pinta y nunca necesita ramas por juego.
// ============================================================================

import type { SkinId } from "./skins";

export type PlayableStatus = "playing" | "dead" | "gameover";

export type GameSnapshot = {
  /** Única métrica obligatoria. */
  score: number;
  status: PlayableStatus;
  /** El HUD omite "Vidas" si no viene. */
  lives?: number;
  /** El HUD omite "Nivel" si no viene. */
  level?: number;
  /** Métricas propias del juego, ya formateadas: Líneas, Poder… */
  extra?: { label: string; value: string }[];
};

export type PlayableGameProps = {
  /** Control externo (botón PAUSA). */
  paused: boolean;
  /**
   * Piel del canvas, gobernada por el selector del HUD. Es OPCIONAL a
   * propósito: un juego que todavía no la lea recibe la prop, la ignora y
   * sigue pintando su `clasico` de siempre.
   */
  skin?: SkinId;
  /** El juego avisa de cada cambio relevante (no en cada frame). */
  onSnapshot: (s: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

/** Handle imperativo para los botones de la plataforma. */
export type PlayableGameHandle = {
  restart: () => void;
};
