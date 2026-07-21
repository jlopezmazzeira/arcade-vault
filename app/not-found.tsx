import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: "100px 20px" }}>
      <div className="pixel neon-magenta" style={{ fontSize: 48, marginBottom: 20 }}>404</div>
      <div className="pixel" style={{ fontSize: 14, marginBottom: 14 }}>PARTIDA NO ENCONTRADA</div>
      <div style={{ color: "var(--ink-faint)", marginBottom: 32 }}>
        Esta máquina no está en el salón. Puede que la hayan retirado del vault.
      </div>
      <Link className="btn lg" href="/">VOLVER AL VAULT</Link>
    </div>
  );
}
