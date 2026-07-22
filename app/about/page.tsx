"use client";

import { useActionState, useState } from "react";
import HighlightIcon from "@/app/_components/HighlightIcon";
import useReveal from "@/app/_components/useReveal";
import { sendContactMessage, type ContactState } from "@/app/about/actions";
import { HIGHLIGHTS, TIPS } from "@/data/about";

const INITIAL: ContactState = { status: "idle" };

export default function AboutPage() {
  useReveal();

  const [state, formAction, isPending] = useActionState(sendContactMessage, INITIAL);

  // Ambos flags se comparan por identidad del `state` (cada resultado de la
  // acción es un objeto nuevo), así el estado solo se toca desde manejadores de
  // eventos —nunca desde un efecto— y un resultado nuevo los "resetea" solo.

  // "ENVIAR OTRO MENSAJE" marca el `sent` actual como descartado y vuelve a idle.
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  const showSuccess = state.status === "sent" && state !== dismissed;

  // El shake se dispara con cada `invalid` nuevo y se apaga cuando la animación
  // termina (onAnimationEnd), replicando el toggle de 400 ms de la plantilla sin
  // temporizador ni efecto.
  const [shakeDone, setShakeDone] = useState<ContactState | null>(null);
  const shaking = state.status === "invalid" && state !== shakeDone;

  // Valores enviados para repoblar los campos: React resetea el <form action>
  // tras la acción y el reset nativo restaura estos defaultValue. En idle/sent
  // son "" → formulario vacío.
  const values =
    state.status === "invalid" || state.status === "failed"
      ? state.values
      : { name: "", email: "", msg: "" };

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

          {showSuccess ? (
            <div className="terminal-success">
              <div className="term-bar">
                <span className="dot r"></span>
                <span className="dot y"></span>
                <span className="dot g"></span>
                <span className="term-title">VAULT-OS // TERMINAL</span>
              </div>
              <div className="term-body">
                <div className="line">
                  <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
                </div>
                <div className="line dim">[OK] Conectando con servidor…</div>
                <div className="line dim">[OK] Validando contenido…</div>
                <div className="line dim">[OK] Transmitiendo paquete…</div>
                <div className="line success" aria-live="polite">
                  &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.name.toUpperCase()}.
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="btn ghost" type="button" onClick={() => setDismissed(state)}>
                    ENVIAR OTRO MENSAJE
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {state.status === "failed" && (
                <div
                  className="terminal-success"
                  style={{
                    borderColor: "var(--magenta)",
                    boxShadow: "0 0 22px rgba(255,0,110,0.25)",
                    marginBottom: 20,
                  }}
                >
                  <div className="term-bar">
                    <span className="dot r"></span>
                    <span className="dot y"></span>
                    <span className="dot g"></span>
                    <span className="term-title">VAULT-OS // ERROR</span>
                  </div>
                  <div className="term-body">
                    <div className="line" style={{ color: "var(--magenta)" }}>
                      <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
                    </div>
                    <div className="line dim">[OK] Conectando con servidor…</div>
                    <div className="line" style={{ color: "var(--magenta)" }}>
                      [FAIL] No se pudo transmitir el paquete.
                    </div>
                    <div
                      className="success"
                      style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.45)" }}
                      aria-live="polite"
                    >
                      &gt; {state.message}
                    </div>
                  </div>
                </div>
              )}

              <form
                className={"contact-form" + (shaking ? " shake" : "")}
                action={formAction}
                onAnimationEnd={() => setShakeDone(state)}
              >
                <div className="field">
                  <label htmlFor="contact-name">NOMBRE</label>
                  <input
                    id="contact-name"
                    name="name"
                    required
                    maxLength={80}
                    placeholder="px_kai"
                    defaultValue={values.name}
                  />
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
                    defaultValue={values.email}
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
                    defaultValue={values.msg}
                  ></textarea>
                </div>
                <button
                  className="btn xl press"
                  type="submit"
                  disabled={isPending}
                  style={{ width: "100%" }}
                >
                  {isPending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
                </button>
                {state.status === "invalid" && (
                  <p aria-live="polite" className="field" style={{ color: "var(--magenta)", marginTop: 12 }}>
                    {state.message}
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
