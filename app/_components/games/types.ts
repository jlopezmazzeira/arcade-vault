// ============================================================================
// Contrato juego ↔ plataforma.
//
// Todo juego adaptado (registry.ts) habla con GamePlayerScreen a través de
// estos cuatro tipos. La única métrica obligatoria es `score`: `lives` y
// `level` son opcionales porque no todo juego los tiene (Tetris no tiene
// vidas), y las métricas propias de cada juego viajan ya formateadas en
// `extra`, de modo que el HUD solo pinta y nunca necesita ramas por juego.
// ============================================================================

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
  /** El juego avisa de cada cambio relevante (no en cada frame). */
  onSnapshot: (s: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

/** Handle imperativo para los botones de la plataforma. */
export type PlayableGameHandle = {
  restart: () => void;
};
