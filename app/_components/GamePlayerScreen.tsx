"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { saveScore, type SaveScoreState } from "@/app/juegos/[id]/actions";
import type { Game } from "@/data/games";
import { getPlayableGame } from "./games/registry";
import type { GameSnapshot, PlayableGameHandle } from "./games/AsteroidsGame";

// Despachador: si el juego está adaptado (registro), monta el juego real y
// cablea el HUD/botones a él; si no, mantiene EXACTAMENTE el mock de siempre.
//
// `playerName` lo resuelve el servidor: el `display_name` de quien tiene sesión,
// o `null` si juega de invitado. Solo lo usa la rama del juego real, que es la
// única que guarda puntuación de verdad; el mock sigue con su toast.
export default function GamePlayerScreen({
  game,
  playerName,
}: {
  game: Game;
  playerName: string | null;
}) {
  const Playable = getPlayableGame(game.id);
  if (Playable) {
    return (
      <PlayableGamePlayer
        game={game}
        Playable={Playable}
        playerName={playerName}
      />
    );
  }
  return <MockGamePlayer game={game} />;
}

// ============================================================================
// Juego real: el HUD, PAUSA, FIN y "JUGAR DE NUEVO" se cablean al canvas.
// ============================================================================

type PlayableComponent = NonNullable<ReturnType<typeof getPlayableGame>>;

const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  status: "playing",
  tripleShot: 0,
};

function PlayableGamePlayer({
  game,
  Playable,
  playerName,
}: {
  game: Game;
  Playable: PlayableComponent;
  playerName: string | null;
}) {
  const gameRef = useRef<PlayableGameHandle>(null);
  const [snap, setSnap] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(playerName ?? "INVITADO");
  // `useActionState` no se puede resetear: al empezar otra partida se remonta el
  // formulario cambiando su `key`, y así vuelve a `idle`.
  const [runId, setRunId] = useState(0);

  // El juego solo emite snapshot al cambiar un campo → el HUD refleja el estado
  // real sin saturar React.
  const onSnapshot = useCallback((s: GameSnapshot) => setSnap(s), []);
  const onGameOver = useCallback(() => setOver(true), []);

  const restart = () => {
    gameRef.current?.restart(); // score 0, 3 vidas, nivel 1
    setPaused(false);
    setOver(false);
    setRunId((n) => n + 1);
  };

  // FIN: congela la partida (pausa) y abre el modal con la puntuación real.
  const forceEnd = () => {
    setPaused(true);
    setOver(true);
  };

  const { score, lives, level, tripleShot } = snap;

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {tripleShot > 0 && (
            <div className="hud-stat">
              <div className="l">Poder</div>
              <div className="v" style={{ color: "#0ff" }}>
                3× TRIPLE
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button
            className="btn yellow"
            onClick={(e) => {
              // Devuelve el foco a la superficie de juego para que el disparo no
              // reactive el botón por accidente.
              e.currentTarget.blur();
              setPaused((p) => !p);
            }}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            className="btn magenta"
            onClick={(e) => {
              e.currentTarget.blur();
              forceEnd();
            }}
          >
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <Playable
            ref={gameRef}
            paused={paused}
            onSnapshot={onSnapshot}
            onGameOver={onGameOver}
          />
          {paused && !over && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            <SaveScoreForm
              key={runId}
              gameId={game.id}
              score={score}
              name={name}
              setName={setName}
              hasSession={playerName !== null}
            />
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/biblioteca">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INITIAL_SAVE_STATE: SaveScoreState = { status: "idle" };

// Guardado real: el formulario envía a la Server Action `saveScore`. `game_id` y
// `score` van en campos ocultos, pero quien manda es el servidor — vuelve a
// validarlos, y con sesión ignora el nombre enviado y usa el `display_name`.
function SaveScoreForm({
  gameId,
  score,
  name,
  setName,
  hasSession,
}: {
  gameId: string;
  score: number;
  name: string;
  setName: (value: string) => void;
  hasSession: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    saveScore,
    INITIAL_SAVE_STATE,
  );

  if (state.status === "saved") {
    return <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="game_id" value={gameId} />
      <input type="hidden" name="score" value={score} />
      <div className="input-row">
        <input
          name="player_name"
          value={name}
          // Con sesión el nombre no se toca: el récord va firmado con la cuenta.
          readOnly={hasSession}
          onChange={(e) =>
            hasSession
              ? undefined
              : setName(e.target.value.toUpperCase().slice(0, 10))
          }
          placeholder="TUS INICIALES"
        />
        <button className="btn yellow" disabled={isPending}>
          {isPending ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
        </button>
      </div>
      {(state.status === "invalid" || state.status === "error") && (
        <div
          className="mono"
          style={{ marginTop: 8, fontSize: 12, color: "var(--magenta)" }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}

// ============================================================================
// Mock original (sin cambios): juegos aún no adaptados. Ticker de score falso,
// enemigos CSS y botones tal cual. NO tocar: es el seguro de no-regresión.
// ============================================================================

function MockGamePlayer({ game }: { game: Game }) {
  const [score, setScore] = useState(0);
  const [lives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);

  const level = 1 + Math.floor(score / 2500);

  const restart = () => {
    setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [over, paused]);

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor"></div>
            <div className="enemy e1"></div>
            <div className="enemy e2"></div>
            <div className="enemy e3"></div>
            <div className="player-ship"></div>
          </div>
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={() => setSaved(true)}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/biblioteca">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
