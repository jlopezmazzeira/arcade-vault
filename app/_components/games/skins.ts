// ============================================================================
// Catálogo cerrado de skins de plataforma.
//
// Es la ÚNICA definición de las tres skins en todo el repo: los juegos importan
// `SkinId` de aquí para tipar su `Record<SkinId, Palette>` y el HUD importa
// `SKIN_IDS` para pintar un control por skin. Ningún módulo redefine la lista.
//
//   clasico — la skin por defecto. Reproduce EXACTAMENTE lo que el juego pinta
//             hoy: no es una skin nueva, es un nombre para el estado actual.
//             Ningún juego la transforma, y por eso es la red de no regresión
//             de todo este eje.
//   neon    — saturada y de alto contraste, emparentada con los tokens de
//             app/globals.css (--cyan, --magenta, --green, --yellow). Admite
//             halo (shadowBlur + shadowColor).
//   retro   — paleta corta de fósforo CRT: ámbar, verde monocromo o gris
//             cálido. Sin halo y con menos contraste, pero siempre por encima
//             de los suelos WCAG que fija la spec del contrato.
//
// La skin pinta el canvas y NADA más: el marco CRT, las scanlines y los colores
// del HUD son de la plataforma y son iguales para las tres.
// ============================================================================

export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];

export const DEFAULT_SKIN: SkinId = "clasico";

/** Etiqueta corta para el selector del HUD. */
export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

/** Valida un valor llegado de `localStorage`: cualquier desconocido cae fuera. */
export function isSkinId(value: unknown): value is SkinId {
  return (
    typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value)
  );
}
