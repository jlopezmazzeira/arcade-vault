"use client";

import Link from "next/link";
import FloatingSilhouettes from "@/app/_components/FloatingSilhouettes";
import FeatureIcon, { type FeatureIconKind } from "@/app/_components/FeatureIcon";
import MiniCard from "@/app/_components/MiniCard";
import useReveal from "@/app/_components/useReveal";
import { GAMES } from "@/data/games";
import { HOME_STATS } from "@/data/home";

const FEATURES: readonly {
  kind: FeatureIconKind;
  title: string;
  desc: string;
  color: string;
}[] = [
  { kind: "GAMEPAD", title: "JUEGOS CLÁSICOS", desc: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.", color: "cyan" },
  { kind: "FREE", title: "100% GRATIS", desc: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.", color: "yellow" },
  { kind: "TROPHY", title: "LADDER BOARDS", desc: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.", color: "magenta" },
  { kind: "ROCKET", title: "SIEMPRE CRECIENDO", desc: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.", color: "green" },
];

export default function HomePage() {
  useReveal();

  return (
    <div className="home fade-in">
      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">▸ INSERTA UNA MONEDA<span className="blink">_</span></div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.<br/>
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link className="btn xl pulse" href="/biblioteca">▶  EXPLORAR JUEGOS</Link>
            <Link className="btn xl magenta" href="/auth">✦  CREAR CUENTA</Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={f.kind} className={"feature-card " + f.color} style={{ transitionDelay: i * 80 + "ms" }}>
              <FeatureIcon kind={f.kind} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMES PREVIEW */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule"></div>
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn lg" href="/biblioteca">VER TODOS LOS JUEGOS →</Link>
        </div>
      </section>

      {/* STATS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {HOME_STATS.map((st, i) => (
            <div key={st.u} className="stat-block" style={{ transitionDelay: i * 90 + "ms" }}>
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.u}</div>
              <div className="stat-s">{st.s}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
