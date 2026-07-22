// ===== data/about.ts — datos mock estáticos del about =====

type Highlight = {
  kind: "HEART" | "BROWSER" | "PLANT"; // debe coincidir con HighlightIcon.kind
  text: string;
  color: "magenta" | "cyan" | "green"; // subconjunto de AccentColor
};

type Tip = {
  text: string;
  led: "" | "y" | "m"; // clase modificadora de .tip-led
};

// El orden importa: la fila entra escalonada de izquierda a derecha con 80 ms
// entre cada tarjeta, así que reordenar aquí reordena la animación.
export const HIGHLIGHTS: readonly Highlight[] = [
  { kind: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  { kind: "BROWSER", text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", color: "cyan" },
  { kind: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

// `led` es la clase modificadora, no un color: "" deja el verde por defecto de
// .tip-led, "y" lo pasa a amarillo y "m" a magenta.
export const TIPS: readonly Tip[] = [
  { text: "RESPUESTA EN 24-48H", led: "" },
  { text: "SUGERENCIAS BIENVENIDAS", led: "y" },
  { text: "SIN SPAM, JAMÁS", led: "m" },
];
