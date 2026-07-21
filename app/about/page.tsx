"use client";

import { useActionState } from "react";
import HighlightIcon from "@/app/_components/HighlightIcon";
import useReveal from "@/app/_components/useReveal";
import { sendContactMessage, type ContactState } from "@/app/about/actions";
import { HIGHLIGHTS, TIPS } from "@/data/about";

const INITIAL: ContactState = { status: "idle" };

export default function AboutPage() {
  useReveal();

  const [state, formAction, isPending] = useActionState(sendContactMessage, INITIAL);

  return (
    <div className="about fade-in">
      {/* ABOUT */}
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.kind}
              className={"highlight " + h.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <HighlightIcon kind={h.kind} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divider banner */}
      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      {/* CONTACT */}
      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              {TIPS.map((tip) => (
                <div className="tip" key={tip.text}>
                  <span className={"tip-led" + (tip.led ? " " + tip.led : "")}></span>
                  {tip.text}
                </div>
              ))}
            </div>
          </div>

          <form className="contact-form" action={formAction}>
            <div className="field">
              <label htmlFor="contact-name">NOMBRE</label>
              <input id="contact-name" name="name" required maxLength={80} placeholder="px_kai" />
            </div>
            <div className="field">
              <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                maxLength={160}
                placeholder="jugador@vault.gg"
              />
            </div>
            <div className="field">
              <label htmlFor="contact-msg">MENSAJE</label>
              <textarea
                id="contact-msg"
                name="msg"
                rows={5}
                required
                maxLength={2000}
                placeholder="Cuéntanos qué tienes en mente…"
              ></textarea>
            </div>
            <button className="btn xl press" type="submit" disabled={isPending} style={{ width: "100%" }}>
              {isPending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
            </button>
            <p aria-live="polite" className="contact-status">
              {state.status === "invalid" || state.status === "failed" ? state.message : ""}
              {state.status === "sent" ? `GRACIAS, ${state.name.toUpperCase()}.` : ""}
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
