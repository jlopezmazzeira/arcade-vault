import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono, Courier_Prime } from "next/font/google";
import Nav from "./_components/Nav";
import type { NavUser } from "./_components/nav-user";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description:
    "Portal de juegos retro donde los jugadores compiten por la puntuación más alta.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Se lee la sesión en servidor con getUser() (revalida contra Auth), no con
  // getSession() (se fía de la cookie). Leer cookies vuelve el layout dinámico:
  // es el precio de una nav que sabe quién está dentro en toda la app.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navUser: NavUser = user
    ? {
        email: user.email ?? "",
        // Fallback al email si el display_name no estuviera en user_metadata.
        display_name:
          (user.user_metadata?.display_name as string | undefined) ??
          user.email ??
          "",
      }
    : null;

  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${jetbrainsMono.variable} ${courierPrime.variable}`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <div id="root">
          <Nav user={navUser} />
          <main className="av-main">{children}</main>
          <footer className="av-footer">
            © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
          </footer>
        </div>
      </body>
    </html>
  );
}
