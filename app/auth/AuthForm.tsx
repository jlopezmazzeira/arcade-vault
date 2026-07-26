"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";

const INITIAL: AuthState = { status: "idle" };

export default function AuthForm() {
  const [tab, setTab] = useState<"in" | "up">("in");

  // Un hook por acción: cada pestaña tiene su propio estado y su propio pending.
  const [inState, inAction, inPending] = useActionState(signIn, INITIAL);
  const [upState, upAction, upPending] = useActionState(signUp, INITIAL);

  const isIn = tab === "in";
  const state = isIn ? inState : upState;
  const formAction = isIn ? inAction : upAction;
  const isPending = isIn ? inPending : upPending;

  const errorMessage =
    state.status === "invalid" || state.status === "error" ? state.message : null;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>ACCESO AL SISTEMA · v2.6</div>
        </div>

        <div className="auth-tabs">
          <button className={isIn ? "on" : ""} onClick={() => setTab("in")}>INICIAR SESIÓN</button>
          <button className={!isIn ? "on" : ""} onClick={() => setTab("up")}>CREAR CUENTA</button>
        </div>

        {/* `key` por pestaña: al cambiar de pestaña se remonta el form y se
            limpian los campos y el estado nativo. */}
        <form key={tab} action={formAction}>
          {!isIn && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input name="display_name" required maxLength={40} placeholder="px_kai" />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input type="email" name="email" required placeholder="jugador@vault.gg" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" name="password" required minLength={6} placeholder="••••••••" />
          </div>

          <button className="btn lg" type="submit" disabled={isPending} style={{ width: "100%", marginTop: 8 }}>
            {isPending ? "PROCESANDO…" : isIn ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>

          {errorMessage && (
            <p aria-live="polite" className="field" style={{ color: "var(--magenta)", marginTop: 12 }}>
              {errorMessage}
            </p>
          )}
        </form>

        <Link className="btn ghost" href="/biblioteca" style={{ width: "100%", marginTop: 10 }}>
          JUGAR COMO INVITADO
        </Link>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" disabled>◆  GOOGLE · PRÓXIMAMENTE</button>
          <button className="btn ghost" type="button" disabled>▣  GITHUB · PRÓXIMAMENTE</button>
        </div>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
