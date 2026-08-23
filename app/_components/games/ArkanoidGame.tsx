"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import type {
  GameSnapshot,
  PlayableGameHandle,
  PlayableGameProps,
  PlayableStatus,
} from "./types";

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

// ── Tipos del modelo ────────────────────────────────────────────────────────

/** Los siete colores de bloque del spritesheet. */
type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

/** Celda de un patrón de nivel: posición en la rejilla 10×6, sin píxeles. */
type LevelCell = { col: number; row: number; color: BlockColor };

/** Bloque ya colocado en el lienzo. `alive: false` = roto. */
type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};

/** Explosión en curso sobre el hueco de un bloque roto. */
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms transcurridos
};

type Paddle = { x: number; y: number; w: number; h: number };

type Ball = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number; // px/s
  vy: number; // px/s
};

// ── Constantes del juego (portadas 1:1 desde game.js) ───────────────────────

/** Lienzo lógico. Es el 800×600 del original y también el 4/3 del marco CRT. */
const VIEW_W = 800;
const VIEW_H = 600;

// Paleta. `w` = 81 aunque el sprite mida 162: el original lo comprime (game.js:15).
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const PADDLE_BASE_SPEED = 400; // px/s al nivel 1 (game.js:4)

const BALL_SIZE = 16; // game.js:16

// Velocidad de saque del original (game.js:12-13). Su módulo es BALL_SPEED_BASE.
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (VIEW_W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;

const BLOCK_SCORE = 10; // puntos por bloque (game.js:140)
const INITIAL_LIVES = 3; // game.js:23

// ── Constantes nuevas de la adaptación ──────────────────────────────────────

/**
 * Progresión de velocidad: `min(2.0, 1.1^(nivel−1))`.
 *
 * A los niveles 1–5 da 1.00 / 1.10 / 1.21 / 1.331 / 1.4641, los cinco
 * multiplicadores que `levels.js` lista a mano, así que esos niveles se juegan
 * igual que en la referencia. El tope entra en el nivel 9: sin él, el bucle
 * infinito llegaría a ×6 y dejaría de ser un reto para ser un muro.
 */
const SPEED_STEP = 1.1;
const SPEED_CAP = 2.0;

const DEG = Math.PI / 180;

/**
 * Ángulo de salida de la paleta, acotado por ambos lados. El mínimo evita que
 * un golpe centrado deje la pelota vertical rebotando eternamente por la misma
 * columna; el máximo, que quede casi horizontal entre las paredes laterales.
 */
const MIN_BOUNCE_ANGLE = 15 * DEG;
const MAX_BOUNCE_ANGLE = 60 * DEG;

/** Rapidez de la pelota al nivel 1. Invariante en los rebotes: solo la escala
 *  `speedForLevel`. Es el módulo del saque original: hypot(200, 300). */
const BALL_SPEED_BASE = Math.hypot(BASE_BALL_VX, BASE_BALL_VY); // ≈ 360.6 px/s

/**
 * Desplazamiento máximo de la pelota por sub-paso de física.
 *
 * A ×2.0 con el `dt` capado a 50 ms, la pelota avanzaría 36 px por frame y
 * atravesaría bloques de 24 px de alto sin tocarlos. Es un bug que solo se
 * manifiesta del nivel 9 en adelante, o sea justo donde nadie prueba.
 */
const MAX_STEP_PX = 8;

/** Tope de `dt`: al volver de una pestaña en segundo plano la pelota no salta. */
const DT_CAP = 50; // ms

// ── Spritesheet: rects y helpers (portados de assets/spritesheet.js) ─────────

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

// ── Patrones de nivel (portados de levels.js) ───────────────────────────────
//
// Los cinco patrones de la referencia, ya SIN su `speed`: aquí la velocidad la
// calcula `speedForLevel` a partir del nivel, porque los niveles no se acaban
// en el 5 — se encadenan indefinidamente.

const LEVEL_PATTERNS: LevelCell[][] = (() => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  // 1 — parrilla completa: las 6 filas × 10 columnas (60 bloques).
  const parrilla: LevelCell[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      parrilla.push({ col, row, color: rowColors1[row] });

  // 2 — pirámide centrada que se ensancha hacia abajo (40 bloques).
  const piramide: LevelCell[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      piramide.push({ col, row, color: rowColors2[row] });

  // 3 — tablero de ajedrez: solo las casillas de paridad par (30 bloques).
  const ajedrez: LevelCell[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        ajedrez.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  // 4 — filas con huecos irregulares (39 bloques).
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const huecos: LevelCell[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        huecos.push({ col, row, color: rowColors4[row] });

  // 5 — marco perimetral con una cruz central (39 bloques).
  const marcoCruz: LevelCell[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        marcoCruz.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [parrilla, piramide, ajedrez, huecos, marcoCruz];
})();

// ── Reglas puras ────────────────────────────────────────────────────────────
//
// Reciben SIEMPRE el estado por parámetro: ninguna lee una variable de módulo.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Multiplicador de velocidad del nivel: `min(2.0, 1.1^(nivel−1))`.
 *
 * Escala por igual la pelota y la paleta, así que su relación es constante
 * durante toda la partida: los niveles altos se pierden por habilidad, no por
 * quedarse corto de control.
 */
function speedForLevel(level: number): number {
  return Math.min(SPEED_CAP, SPEED_STEP ** (level - 1));
}

/** Patrón del nivel. Los cinco se encadenan en bucle: el 6 reusa el 1. */
function patternForLevel(level: number): LevelCell[] {
  return LEVEL_PATTERNS[(level - 1) % LEVEL_PATTERNS.length];
}

/** Coloca un patrón en el lienzo: de celdas de rejilla a bloques en píxeles. */
function buildBlocks(pattern: LevelCell[]): Block[] {
  return pattern.map((cell) => ({
    x: BLOCKS_ORIGIN_X + cell.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + cell.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: cell.color,
    alive: true,
  }));
}

/** Solape de dos rectángulos alineados a los ejes (game.js:61-68). */
function collideAABB(ball: Ball, block: Block): boolean {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}

/** Deja la pelota sobre la paleta y la lanza a la velocidad del nivel. */
function resetBall(ball: Ball, paddle: Paddle, speed: number): void {
  ball.x = paddle.x + (paddle.w - ball.w) / 2;
  ball.y = paddle.y - ball.h;
  ball.vx = BASE_BALL_VX * speed;
  ball.vy = BASE_BALL_VY * speed;
}

/** Paredes izquierda, derecha y techo. El suelo NO rebota: es perder una vida. */
function bounceWalls(ball: Ball): void {
  if (ball.x <= 0) {
    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + ball.w >= VIEW_W) {
    ball.x = VIEW_W - ball.w;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y <= 0) {
    ball.y = 0;
    ball.vy = Math.abs(ball.vy);
  }
}

/** Ventana de contacto con la paleta, portada de game.js:122-128. */
function hitsPaddle(ball: Ball, paddle: Paddle): boolean {
  return (
    ball.vy > 0 &&
    ball.x + ball.w > paddle.x &&
    ball.x < paddle.x + paddle.w &&
    ball.y + ball.h >= paddle.y &&
    ball.y + ball.h <= paddle.y + paddle.h + 8
  );
}

/**
 * Rebote en la paleta: el punto de impacto decide el ángulo de salida.
 *
 * La referencia solo invierte `vy` (game.js:130), con lo que la pelota nunca
 * cambia de ángulo horizontal en toda la partida y el jugador solo decide si
 * sigue viva, no adónde va. Aquí el offset respecto al centro mapea a
 * ±MAX_BOUNCE_ANGLE, elevado a MIN_BOUNCE_ANGLE para que nunca salga vertical.
 * La rapidez no cambia: solo la dirección.
 */
function paddleBounce(ball: Ball, paddle: Paddle, speed: number): void {
  const ballCx = ball.x + ball.w / 2;
  const paddleCx = paddle.x + paddle.w / 2;
  const offset = clamp((ballCx - paddleCx) / (paddle.w / 2), -1, 1);

  let angle = offset * MAX_BOUNCE_ANGLE;
  if (Math.abs(angle) < MIN_BOUNCE_ANGLE) {
    // Con offset exactamente 0 no hay signo que conservar: se usa el de `vx`,
    // que mantiene el sentido en el que ya venía viajando la pelota.
    const sign = offset === 0 ? (ball.vx >= 0 ? 1 : -1) : Math.sign(offset);
    angle = sign * MIN_BOUNCE_ANGLE;
  }

  const mag = BALL_SPEED_BASE * speed;
  ball.vx = mag * Math.sin(angle);
  ball.vy = -mag * Math.cos(angle);
  ball.y = paddle.y - ball.h; // fuera de la paleta, para no re-colisionar
}

/**
 * Rebote en un bloque: se invierte el eje de MENOR penetración y la pelota se
 * reposiciona justo fuera del bloque por ese eje.
 *
 * La referencia invierte siempre `vy` (game.js:141), así que una pelota que
 * entra por el lateral de una columna la atraviesa horizontalmente sin que el
 * rebote tenga sentido físico. Reposicionar, además, impide que el siguiente
 * sub-paso vuelva a resolver el mismo contacto e invierta el eje dos veces.
 */
function resolveBlockBounce(ball: Ball, block: Block): void {
  const overlapX = Math.min(
    ball.x + ball.w - block.x,
    block.x + block.w - ball.x,
  );
  const overlapY = Math.min(
    ball.y + ball.h - block.y,
    block.y + block.h - ball.y,
  );

  if (overlapX < overlapY) {
    if (ball.x + ball.w / 2 < block.x + block.w / 2) {
      ball.x = block.x - ball.w;
      ball.vx = -Math.abs(ball.vx);
    } else {
      ball.x = block.x + block.w;
      ball.vx = Math.abs(ball.vx);
    }
  } else {
    if (ball.y + ball.h / 2 < block.y + block.h / 2) {
      ball.y = block.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    } else {
      ball.y = block.y + block.h;
      ball.vy = Math.abs(ball.vy);
    }
  }
}

/**
 * Avanza la pelota `dt` segundos resolviendo paredes, paleta y bloques.
 *
 * El movimiento se parte en sub-pasos de MAX_STEP_PX como mucho y las
 * colisiones se resuelven en CADA uno: es lo que impide que a velocidades
 * altas la pelota atraviese una fila entera sin tocarla. Se rompe **un bloque
 * por sub-paso**, que es la traducción correcta del `break` del original
 * (game.js:147) una vez subdividido el movimiento.
 *
 * No decide nada sobre vidas: si la pelota sale por abajo, deja de avanzar y
 * quien llama comprueba `ball.y > VIEW_H`.
 */
function stepBall(
  ball: Ball,
  paddle: Paddle,
  blocks: Block[],
  speed: number,
  dt: number,
  onBlockBroken: (block: Block) => void,
): void {
  const distance = Math.hypot(ball.vx * dt, ball.vy * dt);
  const subSteps = Math.max(1, Math.ceil(distance / MAX_STEP_PX));
  const subDt = dt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    bounceWalls(ball);
    if (hitsPaddle(ball, paddle)) paddleBounce(ball, paddle, speed);

    for (const block of blocks) {
      if (!block.alive) continue;
      if (!collideAABB(ball, block)) continue;
      block.alive = false;
      resolveBlockBounce(ball, block);
      onBlockBroken(block);
      break; // un bloque por sub-paso
    }

    if (ball.y > VIEW_H) return; // pelota perdida: no hay más que simular
  }
}

// ── Fábrica ─────────────────────────────────────────────────────────────────

/** Callbacks que la fábrica usa para emitir hacia React. */
type GameHooks = {
  onSnapshot: (s: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

/** Lo que la fábrica devuelve para gobernar el juego desde fuera. */
type GameController = {
  start: () => void;
  stop: () => void;
  restart: () => void;
  setPaused: (paused: boolean) => void;
};

/**
 * Crea una partida completa sobre `canvas`. TODO el estado mutable vive aquí
 * dentro —incluidos `sheet` y `ready`, que el original guarda en el módulo—,
 * así que dos montajes del componente no comparten ni pelota ni puntuación.
 */
function createGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  hooks: GameHooks,
): GameController {
  // ── Estado ──
  const paddle: Paddle = {
    x: (VIEW_W - PADDLE_W) / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    h: PADDLE_H,
  };
  const ball: Ball = {
    x: 0,
    y: 0,
    w: BALL_SIZE,
    h: BALL_SIZE,
    vx: 0,
    vy: 0,
  };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = INITIAL_LIVES;
  let score = 0;
  let level = 1;

  let paused = false;
  let running = false;
  let gameOver = false;

  // El spritesheet: `sheet` es el canvas intermedio ya decodificado y `ready`
  // el permiso para que `update` avance. `sheetImg` se conserva solo para poder
  // anular su `onload` en `stop()` si la carga sigue en vuelo al desmontar.
  let sheet: Spritesheet | null = null;
  let sheetImg: HTMLImageElement | null = null;
  let ready = false;

  let rafId: number | null = null;
  let lastTime: number | null = null;

  // El juego se dibuja SIEMPRE en coordenadas lógicas 800×600; el búfer real se
  // ajusta al tamaño en pantalla (× DPR) y el contexto se escala.
  let scaleX = 1;
  let scaleY = 1;
  let resizeObserver: ResizeObserver | null = null;

  const keys: Record<string, boolean> = {};

  /** ¿Se puede simular? Ni sin sprites, ni en pausa, ni con la partida acabada. */
  function isActive(): boolean {
    return running && ready && !paused && !gameOver;
  }

  /**
   * Carga un nivel: patrón, bloques y saque a la velocidad que le toca.
   *
   * Vaciar `explosions` va aquí, en la MISMA operación que construir los
   * bloques (game.js:54): si no, los restos del nivel anterior seguirían
   * flotando sobre el patrón nuevo.
   */
  function loadLevel(n: number): void {
    level = n;
    blocks = buildBlocks(patternForLevel(level));
    explosions = [];
    resetBall(ball, paddle, speedForLevel(level));
  }

  /** Suelta todas las teclas: al pausar y al reiniciar. */
  function releaseKeys(): void {
    for (const code of Object.keys(keys)) keys[code] = false;
  }

  // ── Emisión de snapshot ──
  //
  // Este es el primer juego que cabe ENTERO en los campos nativos del HUD: las
  // tres métricas que el original pinta en su canvas (Score, Nivel y las
  // pelotitas de vidas) son `score`, `level` y `lives`. No hay `extra`.
  //
  // `status` solo vale "playing" o "gameover": al perder una vida la pelota se
  // relanza en el acto, así que no hay estado intermedio que representar y
  // "dead" no se usa.
  let lastSnapshot: GameSnapshot | null = null;

  /** Emite SOLO si cambió algún campo respecto al último. Nunca por frame. */
  function emit(): void {
    const status: PlayableStatus = gameOver ? "gameover" : "playing";
    if (
      lastSnapshot &&
      lastSnapshot.score === score &&
      lastSnapshot.lives === lives &&
      lastSnapshot.level === level &&
      lastSnapshot.status === status
    ) {
      return;
    }
    const prev = lastSnapshot;
    const snap: GameSnapshot = { score, lives, level, status };
    lastSnapshot = snap;
    hooks.onSnapshot(snap);
    // El fin de partida se avisa una sola vez, en el flanco.
    if (gameOver && (!prev || prev.status !== "gameover")) {
      hooks.onGameOver(score);
    }
  }

  // ── Update ──
  function update(dt: number): void {
    const speed = speedForLevel(level);

    // Paleta. Su velocidad escala con el nivel igual que la pelota, así que la
    // relación entre ambas es constante durante toda la partida.
    const paddleSpeed = PADDLE_BASE_SPEED * speed;
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - paddleSpeed * dt);
    if (keys.ArrowRight) {
      paddle.x = Math.min(VIEW_W - paddle.w, paddle.x + paddleSpeed * dt);
    }

    // Pelota: paredes, paleta y bloques, resueltos sub-paso a sub-paso.
    stepBall(ball, paddle, blocks, speed, dt, (block) => {
      score += BLOCK_SCORE;
      explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
    });

    // Nivel limpio: el siguiente patrón, sin techo. El `win` de la referencia
    // (game.js:145) desaparece — la partida solo acaba al agotar las vidas.
    if (blocks.every((b) => !b.alive)) loadLevel(level + 1);

    // Explosiones: envejecen en ms y se descartan al agotar su duración. Sin
    // este filtro el array crecería sin límite (game.js:152-153).
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida. Si queda vida, saque inmediato desde la paleta: no hay
    // estado intermedio que representar, igual que en la referencia.
    if (ball.y > VIEW_H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameOver = true;
      } else {
        resetBall(ball, paddle, speedForLevel(level));
      }
    }
  }

  // ── Draw ──
  //
  // El canvas dibuja SOLO el juego: ni puntuación, ni nivel, ni pelotitas de
  // vidas, ni overlay de PAUSA, ni GAME OVER. Todo ese chrome del original
  // (game.js:230-248) lo pone la plataforma, y dos HUD compitiendo es el error
  // clásico al portar un juego vanilla.
  function draw(): void {
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Sin hoja no hay nada que pintar: solo el fondo. Dura lo que tarde el PNG.
    if (!sheet) return;

    for (const block of blocks) {
      if (!block.alive) continue;
      drawSprite(
        ctx,
        sheet,
        `block_${block.color}`,
        block.x,
        block.y,
        block.w,
        block.h,
      );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * EXPLOSION_FRAME_COUNT),
        EXPLOSION_FRAME_COUNT - 1,
      );
      drawFrame(
        ctx,
        sheet,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawSprite(ctx, sheet, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, sheet, "ball", ball.x, ball.y, ball.w, ball.h);
  }

  /** Ajusta el búfer al tamaño real en pantalla (× DPR) y recalcula la escala. */
  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = rect.width || VIEW_W;
    const cssH = rect.height || VIEW_H;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    scaleX = canvas.width / VIEW_W;
    scaleY = canvas.height / VIEW_H;
    // Redimensionar el búfer restablece el estado del contexto: el suavizado
    // hay que apagarlo DESPUÉS de cada reescalado, no una sola vez al crearlo.
    // El spritesheet es pixel art y con suavizado sale borroso.
    ctx.imageSmoothingEnabled = false;
    draw(); // un resize borra el búfer: repintar para no ver un parpadeo
  }

  // ── Bucle ──
  function loop(ts: number): void {
    rafId = requestAnimationFrame(loop);
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, DT_CAP);
    lastTime = ts;
    // Mientras carga el sprite, en pausa y en fin de partida NO se avanza, pero
    // se sigue dibujando: el overlay y el modal de la plataforma van encima del
    // canvas, y un resize recrearía el búfer en blanco con el bucle parado.
    if (isActive()) update(dtMs / 1000);
    draw();
    emit();
  }

  // ── Listeners de teclado ──
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key in keys) keys[e.key] = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key in keys) keys[e.key] = false;
  }

  // ── Controlador expuesto ──
  function start(): void {
    if (running) return;
    running = true;
    paused = false;
    lastTime = null;

    // La carga la posee la fábrica: el `sheet` y el `ready` son suyos, no del
    // módulo, y `stop()` puede desactivar el callback si sigue en vuelo.
    sheetImg = loadSpritesheet(SPRITE_SRC, (loaded) => {
      sheet = loaded;
      ready = true;
    });

    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    resize(); // ajusta el búfer a la resolución real y pinta el primer frame
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    emit(); // el HUD arranca con 0 puntos, 3 vidas y nivel 1
    rafId = requestAnimationFrame(loop);
  }

  function stop(): void {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    // Una carga en vuelo no debe tocar un juego ya desmontado.
    if (sheetImg) {
      sheetImg.onload = null;
      sheetImg.onerror = null;
      sheetImg = null;
    }
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    releaseKeys();
  }

  /** Partida limpia: nivel 1, 3 vidas, 0 puntos y la paleta centrada. */
  function restart(): void {
    score = 0;
    lives = INITIAL_LIVES;
    gameOver = false;
    paused = false;
    paddle.x = (VIEW_W - PADDLE_W) / 2;
    loadLevel(1); // patrón 1, explosiones vacías y saque a velocidad inicial
    releaseKeys();
    lastTime = null;
    lastSnapshot = null; // fuerza la re-emisión del snapshot inicial
    draw();
    emit();
  }

  function setPaused(next: boolean): void {
    paused = next;
    // Al pausar se sueltan las teclas: si no, una marcada como pulsada seguiría
    // moviendo la paleta sola al reanudar.
    if (paused) releaseKeys();
  }

  // Estado inicial listo antes del primer frame: nivel 1 en pantalla desde ya.
  loadLevel(1);

  return { start, stop, restart, setPaused };
}

// ── Componente React ────────────────────────────────────────────────────────
//
// Ata el ciclo de vida del juego: el efecto de montaje crea la partida con
// `createGame`, la arranca y —en el cleanup— la apaga entera (rAF, listeners,
// ResizeObserver y el `onload` del spritesheet). Los callbacks entran por refs
// espejo para NO recrear el juego cuando cambian, `paused` viaja en un efecto
// aparte, y `restart()` se expone como método imperativo.

const ArkanoidGame = forwardRef<PlayableGameHandle, PlayableGameProps>(
  function ArkanoidGame({ paused, onSnapshot, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<GameController | null>(null);

    // Refs espejo de los callbacks: el juego lee `.current` en cada emisión, así
    // que un cambio de prop no obliga a recrear la partida.
    const onSnapshotRef = useRef(onSnapshot);
    const onGameOverRef = useRef(onGameOver);
    useEffect(() => {
      onSnapshotRef.current = onSnapshot;
      onGameOverRef.current = onGameOver;
    });

    // Efecto de montaje: crea, arranca y (cleanup) detiene el juego. Sin
    // dependencias, y el cleanup lo deja todo apagado, así que el doble montaje
    // de Strict Mode en desarrollo deja UNA sola partida y una sola pelota.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const game = createGame(canvas, ctx, {
        onSnapshot: (s) => onSnapshotRef.current(s),
        onGameOver: (n) => onGameOverRef.current(n),
      });
      gameRef.current = game;
      game.start();

      return () => {
        game.stop();
        gameRef.current = null;
      };
    }, []);

    // Propaga el control externo de pausa sin recrear el juego. Si `paused`
    // fuera dependencia del efecto de montaje, cada pausa reiniciaría la partida.
    useEffect(() => {
      gameRef.current?.setPaused(paused);
    }, [paused]);

    // Orden imperativa de reinicio para el botón "JUGAR DE NUEVO".
    useImperativeHandle(
      ref,
      () => ({
        restart: () => gameRef.current?.restart(),
      }),
      [],
    );

    // El escalado dentro del marco CRT llega en el paso 7, con su hoja CSS.
    return (
      <div>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          aria-label="Bloque Buster — rebota la pelota y destruye muros de neón"
        />
      </div>
    );
  },
);

export default ArkanoidGame;
