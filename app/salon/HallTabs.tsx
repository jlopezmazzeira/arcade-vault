"use client";

import Link from "next/link";
import { useState } from "react";
import type { Game, ScoreRow } from "@/data/games";

// Las pestañas siguen siendo cliente, pero ya no generan datos: eligen qué
// ranking mostrar del mapa que el servidor precomputó. Cambiar de pestaña no
// dispara ninguna consulta ni recarga la página.
export default function HallTabs({
  games,
  scoresByGame,
}: {
  games: Game[];
  scoresByGame: Record<string, ScoreRow[]>;
}) {
  const [tab, setTab] = useState(games[0].id);
  const rows = scoresByGame[tab] ?? [];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <PodiumSlot slot="silver" rank="02" row={rows[1]} />
        <PodiumSlot slot="gold" rank="01" row={rows[0]} />
        <PodiumSlot slot="bronze" rank="03" row={rows[2]} />
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.rank}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/biblioteca">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

// El podio ya no puede dar por hecho que hay tres filas: con datos reales un
// juego recién añadido puede tener menos. Sin `row` el hueco se mantiene (para
// no descuadrar el podio) y se pinta un guion.
function PodiumSlot({
  slot,
  rank,
  row,
}: {
  slot: "gold" | "silver" | "bronze";
  rank: string;
  row: ScoreRow | undefined;
}) {
  const isGold = slot === "gold";

  return (
    <div className={`podium-slot ${slot}`}>
      {isGold && (
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--gold)",
            letterSpacing: "0.18em",
          }}
        >
          CAMPEÓN
        </div>
      )}
      <div
        className="rank-num"
        style={isGold ? { fontSize: 36, marginTop: 4 } : undefined}
      >
        {rank}
      </div>
      <div className="name">{row?.name ?? "—"}</div>
      <div className="score" style={isGold ? { fontSize: 20 } : undefined}>
        {row ? row.score.toLocaleString("es-ES") : "—"}
      </div>
      <div className="date">{row?.date ?? "—"}</div>
    </div>
  );
}
