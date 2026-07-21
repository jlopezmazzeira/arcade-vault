"use client";

import Link from "next/link";
import FloatingSilhouettes from "@/app/_components/FloatingSilhouettes";
import FeatureIcon, { type FeatureIconKind } from "@/app/_components/FeatureIcon";
import MiniCard from "@/app/_components/MiniCard";
import useReveal from "@/app/_components/useReveal";
import { GAMES } from "@/data/games";
import { HOME_STATS, TICKER, TOP_TODAY } from "@/data/home";

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

      {/* RECENT ACTIVITY / LEADERBOARD */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule"></div>
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {TICKER.map((r, i) => (
                <div key={r.player} className="tick-row" style={{ animationDelay: i * 60 + "ms" }}>
                  <span className={"tk-p neon-" + r.color}>{r.player}</span>
                  <span className="tk-mid">▸ {r.game}</span>
                  <span className="tk-s">+{r.score.toLocaleString("es-ES")}</span>
                  <span className="tk-t">{r.when}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link className="lb-link" href="/salon">VER SALÓN →</Link>
            </div>
            <div className="top-list">
              {TOP_TODAY.map((r, i) => (
                <div key={r.rank} className={"top-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
                  <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
                  <span className="tp-bar"><span className="tp-fill" style={{ width: 100 - i * 16 + "%" }}></span></span>
                  <span className="tp-p">{r.player}</span>
                  <span className="tp-s">{r.score.toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              <li>✔ Acceso a todos los juegos</li>
              <li>✔ Ranking global y salón de la fama</li>
              <li>✔ Sin anuncios entre partidas</li>
              <li>✔ Guarda tus puntuaciones</li>
              <li>✔ Nuevos juegos cada mes</li>
              <li>✔ Funciona en cualquier navegador</li>
            </ul>
            <Link className="btn xl pulse" style={{ width: "100%" }} href="/auth">EMPEZAR GRATIS →</Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">FREE<br/>PLAY</div>
          </div>

          <div className="pricing-faq">
            <div className="faq-item">
              <div className="faq-q pixel">¿REALMENTE ES GRATIS?</div>
              <div className="faq-a">Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No hay versión &quot;premium&quot; escondida.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q pixel">¿NECESITO CREAR CUENTA?</div>
              <div className="faq-a">No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el ranking, regístrate en 10 segundos.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q pixel">¿CÓMO SOBREVIVEN SIN COBRAR?</div>
              <div className="faq-a">Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que aceptamos.</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link className="btn xl pulse final-cta" href="/biblioteca">INSERTAR MONEDA →</Link>
        <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
      </section>
    </div>
  );
}
