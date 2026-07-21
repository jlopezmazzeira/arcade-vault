"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isLibrary = pathname === "/" || pathname.startsWith("/juegos");
  const isHall = pathname === "/salon";
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
          <Link className={isLibrary ? "active" : ""} href="/" onClick={close}>Biblioteca</Link>
          <Link className={isHall ? "active" : ""} href="/salon" onClick={close}>Salón de la Fama</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        <Link className="btn auth-btn" href="/auth" onClick={close}>Iniciar Sesión</Link>
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link className={isLibrary ? "active" : ""} href="/" onClick={close}>Biblioteca</Link>
        <Link className={isHall ? "active" : ""} href="/salon" onClick={close}>Salón de la Fama</Link>
        <Link className={isAuth ? "active" : ""} href="/auth" onClick={close}>Iniciar Sesión</Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>CRÉDITOS · 03</div>
      </aside>
    </>
  );
}
