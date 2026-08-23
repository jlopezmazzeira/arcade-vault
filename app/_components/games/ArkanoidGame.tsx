"use client";

// ============================================================================
// ArkanoidGame — puerto TypeScript del Arkanoid de
// references/started-games/04-arkanoid/ (game.js, levels.js y
// assets/spritesheet.js).
//
// Todo el dibujo de este juego sale del spritesheet: paleta, pelota, siete
// colores de bloque y las explosiones de 4 frames. El original guarda la imagen
// en dos variables de módulo (`ssImg`, `ssLoaded`, spritesheet.js:27-28); aquí
// NO hay estado mutable de módulo: el sheet lo posee la fábrica `createGame` y
// los helpers de dibujo lo reciben por parámetro.
//
// El canvas SOLO dibuja el juego — el HUD, el overlay de pausa y el modal de
// fin los pone la plataforma.
// ============================================================================

// ── Spritesheet: tipos, rects y helpers (portados de assets/spritesheet.js) ──

/** Los siete colores de bloque del spritesheet. */
type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

/** Recorte dentro del spritesheet: origen y tamaño en px de la hoja. */
type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

/** Nombres dibujables, con la convención `block_<color>` del original. */
type SpriteName = "paddle" | "ball" | `block_${BlockColor}`;

/**
 * El sheet ya decodificado. Es un `<canvas>` y no la `Image`: el original copia
 * el PNG a un canvas intermedio (spritesheet.js:38-44) para evitar el coste de
 * decodificación repetida en algunos navegadores. Ese paso se conserva.
 */
type Spritesheet = HTMLCanvasElement;

/** Ruta pública del PNG copiado. Absoluta: la página se sirve desde
 *  /juegos/bloque-buster/jugar, así que la relativa del original rompería. */
const SPRITE_SRC = "/games/arkanoid/spritesheet-breakout.png";

const SPRITES: {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<BlockColor, SpriteRect>;
} = {
  // OJO: el sprite mide 162 px de ancho, pero la paleta del juego mide 81
  // (game.js:15) — el original lo comprime a la mitad a propósito. `sw` es el
  // ancho del sprite; `w`, el de la paleta. No son lo mismo.
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

/** Duración total de la animación de explosión, en ms (spritesheet.js:11). */
const EXPLOSION_DURATION = 150;

/** Frames de la animación de explosión. */
const EXPLOSION_FRAME_COUNT = 4;

/** Fila de 4 frames por color. `gray` reutiliza la de `red`, como el original. */
const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

/** Los 4 frames de una fila de explosión: 32 px de paso desde sx = 256. */
function explosionRow(sy: number): SpriteRect[] {
  return Array.from({ length: EXPLOSION_FRAME_COUNT }, (_, i) => ({
    sx: 256 + i * 32,
    sy,
    sw: 32,
    sh: 16,
  }));
}

/** Resuelve un nombre dibujable a su recorte en la hoja. */
function spriteRect(name: SpriteName): SpriteRect {
  if (name === "paddle" || name === "ball") return SPRITES[name];
  // El prefijo `block_` está garantizado por el tipo; solo hay que quitarlo.
  return SPRITES.blocks[name.slice(6) as BlockColor];
}

/**
 * Dibuja un sprite por nombre. A diferencia del original
 * (spritesheet.js:56-66), el sheet entra por parámetro en vez de leerse de una
 * variable de módulo: así dos partidas no comparten nada.
 */
function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: Spritesheet,
  name: SpriteName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const sp = spriteRect(name);
  ctx.drawImage(sheet, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}

/** Dibuja un frame suelto de animación (spritesheet.js:51-54). */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: Spritesheet,
  frame: SpriteRect,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

/**
 * Arranca la carga del spritesheet y devuelve la `Image` en vuelo.
 *
 * Función pura: no guarda nada: quien la llama —la fábrica `createGame`— se
 * queda con el `sheet` y con el handle de la imagen, y puede anular su
 * `onload` al desmontar para que una carga en vuelo no toque un juego muerto.
 */
function loadSpritesheet(
  src: string,
  onReady: (sheet: Spritesheet) => void,
): HTMLImageElement {
  const img = new Image();
  img.onload = () => {
    // Copia a un canvas intermedio, como spritesheet.js:38-44.
    const off = document.createElement("canvas");
    off.width = img.width;
    off.height = img.height;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.drawImage(img, 0, 0);
    onReady(off);
  };
  img.onerror = () => {
    console.error(`No se pudo cargar el spritesheet: ${src}`);
  };
  img.src = src;
  return img;
}
