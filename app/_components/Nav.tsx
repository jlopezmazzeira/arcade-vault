"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/auth/actions";
import type { NavUser } from "./nav-user";

export default function Nav({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isLibrary = pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos");
  const isHall = pathname === "/salon";
  const isAbout = pathname === "/about";
  const isAuth = pathname === "/auth";

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">ARCADE <span className="neon-magenta">VAULT</span></div>
        </Link>
        <div className="links">
          <Link className={isHome ? "active" : ""} href="/" onClick={close}>Inicio</Link>
          <Link className={isLibrary ? "active" : ""} href="/biblioteca" onClick={close}>Biblioteca</Link>
          <Link className={isHall ? "active" : ""} href="/salon" onClick={close}>Salón de la Fama</Link>
          <Link className={isAbout ? "active" : ""} href="/about" onClick={close}>Acerca de</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono neon-cyan" style={{ fontSize: 12, letterSpacing: "0.08em" }}>{user.display_name}</span>
            <form action={signOut}>
              <button className="btn ghost auth-btn" type="submit">Salir</button>
            </form>
          </div>
        ) : (
          <Link className="btn auth-btn" href="/auth" onClick={close}>Iniciar Sesión</Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link className={isHome ? "active" : ""} href="/" onClick={close}>Inicio</Link>
        <Link className={isLibrary ? "active" : ""} href="/biblioteca" onClick={close}>Biblioteca</Link>
        <Link className={isHall ? "active" : ""} href="/salon" onClick={close}>Salón de la Fama</Link>
        <Link className={isAbout ? "active" : ""} href="/about" onClick={close}>Acerca de</Link>
        {user ? (
          <>
            <div className="mono neon-cyan" style={{ fontSize: 12, marginTop: 4, letterSpacing: "0.08em" }}>{user.display_name}</div>
            <form action={signOut} onSubmit={close}>
              <button className="btn ghost" type="submit" style={{ width: "100%" }}>Salir</button>
            </form>
          </>
        ) : (
          <Link className={isAuth ? "active" : ""} href="/auth" onClick={close}>Iniciar Sesión</Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>CRÉDITOS · 03</div>
      </aside>
    </>
  );
}
