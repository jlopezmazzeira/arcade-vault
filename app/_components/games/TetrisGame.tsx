"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import styles from "./TetrisGame.module.css";
import type {
  GameSnapshot,
  PlayableGameHandle,
  PlayableGameProps,
} from "./types";

// ============================================================================
// TetrisGame — puerto TypeScript del Tetris de
// references/started-games/03-tetris/game.js.
//
// Las reglas viven en funciones puras a nivel de módulo que reciben SIEMPRE el
// estado por parámetro: no hay una sola variable mutable de módulo. El estado
// concreto lo crea la fábrica `createGame` (paso 3), de modo que dos montajes
// del componente nunca comparten tablero ni puntuación.
//
// El canvas SOLO dibuja el tablero y la vista previa — el HUD, el overlay de
// pausa y el modal de fin los pone la plataforma.
// ============================================================================

// ── Tipos del modelo ────────────────────────────────────────────────────────

/** Índice de color/pieza: las 7 estándar (I, O, T, S, Z, J, L). */
type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Cell = 0 | PieceType; // 0 = celda vacía
type Board = Cell[][]; // ROWS × COLS
type Piece = { type: PieceType; shape: Cell[][]; x: number; y: number };

/** Todo el estado de una partida. Lo instancia `createGame`, nunca el módulo. */
type GameState = {
  board: Board;
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  dropInterval: number;
  gameOver: boolean;
};

// ── Constantes de reglas (portadas 1:1 desde game.js) ───────────────────────

const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // px lógicos por celda

const COLORS: Record<PieceType, string> = {
  1: "#4dd0e1", // I — cian
  2: "#ffd54f", // O — amarillo
  3: "#ba68c8", // T — morado
  4: "#81c784", // S — verde
  5: "#e57373", // Z — rojo
  6: "#90caf9", // J — azul pálido
  7: "#ffb74d", // L — naranja
};

const PIECES: Record<PieceType, Cell[][]> = {
  1: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  2: [
    [2, 2],
    [2, 2],
  ], // O
  3: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  4: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  5: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  6: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  7: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
};

const PIECE_TYPES = Object.keys(PIECES).length; // 7

/** Puntos por 0, 1, 2, 3 y 4 líneas limpiadas de golpe; se multiplica por el nivel. */
const LINE_SCORES = [0, 100, 300, 500, 800];

/** Desplazamientos que se prueban al rotar contra una pared u otra pieza. */
const KICKS = [0, -1, 1, -2, 2];

const HARD_DROP_POINTS = 2; // por celda recorrida
const SOFT_DROP_POINTS = 1; // por fila

const LINES_PER_LEVEL = 10;
const DROP_BASE = 1000; // ms al nivel 1
const DROP_STEP = 90; // ms menos por nivel
const DROP_MIN = 100; // suelo de velocidad

const GHOST_ALPHA = 0.2;

// ── Constantes de la adaptación (composición del lienzo) ────────────────────
//
// Un único canvas de 800×600 lógicos —el mismo 4/3 que impone `.crt-screen`—
// compone el tablero y el panel de la pieza siguiente. Así hay un solo
// ResizeObserver y un solo escalado DPR, en vez de los dos canvas del original.

const VIEW_W = 800;
const VIEW_H = 600;

const BOARD_X = 250; // tablero de 300×600 centrado: ocupa x = 250–550
const BOARD_Y = 0;
const BOARD_W = COLS * BLOCK; // 300
const BOARD_H = ROWS * BLOCK; // 600

const PANEL_X = 550; // panel de SIGUIENTE, 250 px de ancho a la derecha
const PANEL_W = VIEW_W - PANEL_X;

const PREVIEW_CELL = 30; // rejilla 4×4 → 120×120, centrada en el panel
const PREVIEW_SIZE = 4 * PREVIEW_CELL;
const PREVIEW_X = PANEL_X + (PANEL_W - PREVIEW_SIZE) / 2;
const PREVIEW_Y = 250;
const PREVIEW_LABEL_Y = PREVIEW_Y - 26;

const GRID_COLOR = "rgba(0, 245, 255, 0.08)";
const BOARD_TINT = "rgba(0, 245, 255, 0.03)";
const BOARD_BORDER = "rgba(0, 245, 255, 0.25)";
const LABEL_COLOR = "#8a8fb5"; // --ink-dim

/** Tope de `dt`: al volver de una pestaña en segundo plano la pieza no cae de golpe. */
const DT_CAP = 50; // ms

// ── Teclado ─────────────────────────────────────────────────────────────────
//
// Repetición propia (DAS) en vez de la del sistema operativo: la nativa arranca
// a los ~500 ms y varía por máquina, que en un juego de caída es la diferencia
// entre jugable e injugable a partir del nivel 8.

const DAS_DELAY = 170; // ms hasta que arranca la repetición
const DAS_REPEAT = 50; // ms entre repeticiones

/** Teclas que repiten mientras se mantienen pulsadas. */
const DAS_CODES = ["ArrowLeft", "ArrowRight", "ArrowDown"] as const;

/** Teclas del juego: son las que hacen `preventDefault` con la partida activa. */
const CONTROL_CODES = new Set<string>([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
]);

/** ¿El evento va dirigido a un control de texto que debe recibir la tecla? */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

// ── Reglas puras ────────────────────────────────────────────────────────────

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}

function randomPiece(): Piece {
  // `random` uniforme sobre las 7 piezas, como el original (no hay bolsa de 7).
  const type = (Math.floor(Math.random() * PIECE_TYPES) + 1) as PieceType;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

/** ¿La forma choca con las paredes, el suelo o un bloque ya fijado? */
function collide(
  board: Board,
  shape: Cell[][],
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      // Por encima del techo (ny < 0) no hay tablero que consultar.
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

/** Transpone y voltea: rotación de 90° en sentido horario. */
function rotateCW(shape: Cell[][]): Cell[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Cell[][] = Array.from({ length: cols }, () =>
    new Array<Cell>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

/** Rota probando los kicks en orden; si ninguno cabe, la rotación se descarta. */
function tryRotate(s: GameState): void {
  const rotated = rotateCW(s.current.shape);
  for (const kick of KICKS) {
    if (!collide(s.board, rotated, s.current.x + kick, s.current.y)) {
      s.current.shape = rotated;
      s.current.x += kick;
      return;
    }
  }
}

/** Vuelca la pieza actual sobre el tablero. */
function merge(s: GameState): void {
  const { shape, x, y } = s.current;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) s.board[y + r][x + c] = shape[r][c];
    }
  }
}

/**
 * Elimina las filas completas y aplica puntuación, nivel y velocidad.
 *
 * El recorrido es de abajo arriba con `splice` + `unshift`, y compensa el
 * índice con `r++` tras eliminar una fila: sin ese ajuste, la fila que baja a
 * ocupar el hueco no se revisaría. Portado literalmente del original.
 */
function clearLines(s: GameState): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (s.board[r].every((v) => v !== 0)) {
      s.board.splice(r, 1);
      s.board.unshift(new Array<Cell>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    s.lines += cleared;
    // El original puntúa con el nivel ANTERIOR a recalcularlo.
    s.score += (LINE_SCORES[cleared] ?? 0) * s.level;
    s.level = Math.floor(s.lines / LINES_PER_LEVEL) + 1;
    s.dropInterval = dropIntervalFor(s.level);
  }
  return cleared;
}

function dropIntervalFor(level: number): number {
  return Math.max(DROP_MIN, DROP_BASE - (level - 1) * DROP_STEP);
}

/** Fila en la que aterrizaría la pieza actual si cayera ya (pieza fantasma). */
function ghostY(s: GameState): number {
  let gy = s.current.y;
  while (!collide(s.board, s.current.shape, s.current.x, gy + 1)) gy++;
  return gy;
}

function moveHorizontal(s: GameState, dx: number): void {
  if (!collide(s.board, s.current.shape, s.current.x + dx, s.current.y)) {
    s.current.x += dx;
  }
}

/** Caída instantánea hasta el ghost: 2 puntos por celda y fija la pieza. */
function hardDrop(s: GameState): void {
  const gy = ghostY(s);
  s.score += (gy - s.current.y) * HARD_DROP_POINTS;
  s.current.y = gy;
  lockPiece(s);
}

/** Una fila abajo: 1 punto. Si no puede bajar, fija la pieza. */
function softDrop(s: GameState): void {
  if (!collide(s.board, s.current.shape, s.current.x, s.current.y + 1)) {
    s.current.y++;
    s.score += SOFT_DROP_POINTS;
  } else {
    lockPiece(s);
  }
}

function lockPiece(s: GameState): void {
  merge(s);
  clearLines(s);
  spawn(s);
}

/** La siguiente pasa a actual. Si ya nace colisionando, la partida termina. */
function spawn(s: GameState): void {
  s.current = s.next;
  s.next = randomPiece();
  if (collide(s.board, s.current.shape, s.current.x, s.current.y)) {
    s.gameOver = true;
  }
}

/** Partida limpia: tablero vacío, puntuación 0, nivel 1 y velocidad inicial. */
function createInitialState(): GameState {
  const s: GameState = {
    board: createBoard(),
    current: randomPiece(), // reemplazada de inmediato por `spawn`
    next: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    dropInterval: DROP_BASE,
    gameOver: false,
  };
  spawn(s);
  return s;
}

// ── Dibujo ──────────────────────────────────────────────────────────────────

/**
 * Único helper de celda de todo el dibujo. Recibe el origen en píxeles, así que
 * las coordenadas de juego (rejilla 10×20) nunca llevan el desplazamiento del
 * tablero: el tablero, el ghost, la pieza y la vista previa comparten código y
 * no se pueden descuadrar entre sí.
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  col: number,
  row: number,
  type: Cell,
  size: number,
  alpha = 1,
): void {
  if (!type) return;
  const x = originX + col * size;
  const y = originY + row * size;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[type];
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  // Brillo superior: da volumen al bloque, como en el original.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x + 1, y + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}

/** Rejilla tenue sobre TODO el lienzo, alineada a la celda de 30 px. */
function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = BLOCK; x < VIEW_W; x += BLOCK) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, VIEW_H);
  }
  for (let y = BLOCK; y < VIEW_H; y += BLOCK) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW_W, y + 0.5);
  }
  ctx.stroke();
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
 * dentro: dos montajes del componente no comparten nada.
 */
function createGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  hooks: GameHooks,
): GameController {
  // ── Estado ──
  let state = createInitialState();
  let paused = false;
  let running = false;
  let dropAccum = 0;
  let lastTime: number | null = null;
  let rafId: number | null = null;

  // El canvas se dibuja SIEMPRE en coordenadas lógicas 800×600; el búfer real
  // se ajusta al tamaño en pantalla (× DPR) y el contexto se escala, de modo
  // que el tablero se ve nítido a cualquier tamaño del marco CRT.
  let scaleX = 1;
  let scaleY = 1;
  let resizeObserver: ResizeObserver | null = null;

  // Teclas pulsadas y temporizadores del DAS, contados con el `dt` del bucle.
  const keys: Record<string, boolean> = {};
  const dasTimer: Record<string, number> = {};
  const dasRepeating: Record<string, boolean> = {};

  // Familia del rótulo `SIGUIENTE`: la fuente pixel de la plataforma. Se lee del
  // token CSS porque next/font genera el nombre real en build.
  let labelFont = "14px monospace";

  function readLabelFont(): void {
    const pixel = getComputedStyle(document.documentElement)
      .getPropertyValue("--pixel")
      .trim();
    labelFont = `14px ${pixel || "monospace"}`;
  }

  function isActive(): boolean {
    return running && !paused && !state.gameOver;
  }

  // ── Emisión de snapshot (solo al cambiar un campo, nunca por frame) ──
  //
  // Tetris NO emite `lives`: no tiene vidas, y el HUD omite ese hueco. Las
  // líneas viajan en `extra` ya formateadas, así que el HUD solo pinta.
  let lastSnapshot: GameSnapshot | null = null;
  let lastLines = -1;

  function emit(): void {
    const status = state.gameOver ? "gameover" : "playing";
    if (
      lastSnapshot &&
      lastSnapshot.score === state.score &&
      lastSnapshot.level === state.level &&
      lastLines === state.lines &&
      lastSnapshot.status === status
    ) {
      return;
    }
    const prev = lastSnapshot;
    const snap: GameSnapshot = {
      score: state.score,
      level: state.level,
      status,
      extra: [{ label: "Líneas", value: String(state.lines) }],
    };
    lastSnapshot = snap;
    lastLines = state.lines;
    hooks.onSnapshot(snap);
    // El fin de partida se avisa una sola vez, en el flanco.
    if (state.gameOver && (!prev || prev.status !== "gameover")) {
      hooks.onGameOver(state.score);
    }
  }

  // ── Update ──
  function stepDown(): void {
    if (
      !collide(
        state.board,
        state.current.shape,
        state.current.x,
        state.current.y + 1,
      )
    ) {
      state.current.y++;
    } else {
      lockPiece(state);
    }
  }

  /** Acción de una tecla de dirección. Solo se llama con la partida activa. */
  function actuar(code: string): void {
    if (code === "ArrowLeft") moveHorizontal(state, -1);
    else if (code === "ArrowRight") moveHorizontal(state, 1);
    else if (code === "ArrowDown") softDrop(state);
  }

  /**
   * Repetición propia: la primera acción sale en el `keydown`; a partir de ahí
   * se cuenta con el `dt` del bucle, así respeta la pausa y el cap de `dt` sin
   * un `setInterval` aparte que hubiera que limpiar en paralelo.
   */
  function updateDAS(dt: number): void {
    for (const code of DAS_CODES) {
      if (!keys[code]) continue;
      dasTimer[code] = (dasTimer[code] ?? 0) + dt;
      if (!dasRepeating[code]) {
        if (dasTimer[code] >= DAS_DELAY) {
          dasRepeating[code] = true;
          dasTimer[code] -= DAS_DELAY;
          actuar(code);
        }
      } else {
        while (dasTimer[code] >= DAS_REPEAT) {
          dasTimer[code] -= DAS_REPEAT;
          actuar(code);
        }
      }
    }
  }

  /** Suelta todas las teclas y resetea el DAS: al pausar y al reiniciar. */
  function soltarTeclas(): void {
    for (const code of Object.keys(keys)) keys[code] = false;
    for (const code of Object.keys(dasTimer)) {
      dasTimer[code] = 0;
      dasRepeating[code] = false;
    }
  }

  function update(dt: number): void {
    updateDAS(dt);
    dropAccum += dt;
    if (dropAccum >= state.dropInterval) {
      // Restar (no poner a cero) conserva el resto: a niveles altos, con
      // `dropInterval` de 100–190 ms, ponerlo a cero haría la caída real más
      // lenta que la nominal.
      dropAccum -= state.dropInterval;
      stepDown();
    }
  }

  // ── Draw ──
  function drawBoard(): void {
    ctx.fillStyle = BOARD_TINT;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.strokeStyle = BOARD_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X + 1, BOARD_Y + 1, BOARD_W - 2, BOARD_H - 2);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawCell(ctx, BOARD_X, BOARD_Y, c, r, state.board[r][c], BLOCK);
      }
    }
  }

  function drawPiece(): void {
    const { shape, x, y } = state.current;
    // Ghost primero: la pieza real se pinta encima cuando se solapan.
    const gy = ghostY(state);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawCell(
          ctx,
          BOARD_X,
          BOARD_Y,
          x + c,
          gy + r,
          shape[r][c],
          BLOCK,
          GHOST_ALPHA,
        );
      }
    }
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawCell(ctx, BOARD_X, BOARD_Y, x + c, y + r, shape[r][c], BLOCK);
      }
    }
  }

  function drawPanel(): void {
    ctx.font = labelFont;
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SIGUIENTE", PANEL_X + PANEL_W / 2, PREVIEW_LABEL_Y);

    ctx.strokeStyle = BOARD_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      PREVIEW_X + 0.5,
      PREVIEW_Y + 0.5,
      PREVIEW_SIZE - 1,
      PREVIEW_SIZE - 1,
    );

    // La forma se centra en la rejilla 4×4, como el `drawNext` del original.
    const shape = state.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawCell(
          ctx,
          PREVIEW_X,
          PREVIEW_Y,
          offX + c,
          offY + r,
          shape[r][c],
          PREVIEW_CELL,
        );
      }
    }
  }

  // Ajusta el búfer del canvas a su tamaño real en pantalla (× DPR) y recalcula
  // la escala lógica→física. Se llama al arrancar y en cada resize del marco.
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
    // Un resize borra el búfer: repintar para no ver un parpadeo en negro.
    draw();
  }

  function draw(): void {
    // Base: mapea las coordenadas lógicas 800×600 al búfer real del canvas.
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawGrid(ctx);
    drawBoard();
    drawPiece();
    drawPanel();
  }

  // ── Bucle ──
  function loop(ts: number): void {
    rafId = requestAnimationFrame(loop);
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, DT_CAP);
    lastTime = ts;
    // En pausa y en fin de partida NO se avanza, pero se sigue dibujando: el
    // overlay y el modal de la plataforma van encima del canvas, y un resize
    // recrearía el búfer en blanco si el bucle estuviera parado.
    if (isActive()) update(dt);
    draw();
    emit();
  }

  // ── Listeners de teclado ──
  function onKeyDown(e: KeyboardEvent): void {
    // Si el foco está en un campo de texto (p.ej. las iniciales del modal de
    // fin), el juego no toca la tecla: dejar escribir con normalidad.
    if (isTypingTarget(e.target)) return;
    if (CONTROL_CODES.has(e.code)) {
      // preventDefault solo con el juego activo, para no bloquear el scroll de
      // la página cuando está en pausa o en fin de partida.
      if (isActive()) e.preventDefault();
    }
    // `keydown` se repite solo por el sistema operativo: nos quedamos con el
    // primer flanco y hacemos la repetición nosotros.
    if (keys[e.code]) return;
    // Con el juego inactivo la tecla NI SIQUIERA se registra: si se registrara,
    // una tecla pulsada durante la pausa quedaría "pegada" y empezaría a
    // repetir sola al reanudar. Si el jugador la mantiene, el propio sistema
    // operativo enviará más `keydown` y se recogerá el primero tras reanudar.
    if (!isActive()) return;
    keys[e.code] = true;

    switch (e.code) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowDown":
        // Primera acción inmediata; la repetición la cuenta el bucle.
        dasTimer[e.code] = 0;
        dasRepeating[e.code] = false;
        actuar(e.code);
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate(state); // una rotación por pulsación, sin repetición
        break;
      case "Space":
        hardDrop(state); // una pieza por pulsación: nada de encadenar
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    keys[e.code] = false;
    dasTimer[e.code] = 0;
    dasRepeating[e.code] = false;
  }

  // ── Controlador expuesto ──
  function start(): void {
    if (running) return;
    running = true;
    paused = false;
    lastTime = null;
    dropAccum = 0;
    readLabelFont();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    resize(); // ajusta el búfer a la resolución real y pinta el primer frame
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    emit();
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
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    soltarTeclas();
  }

  function restart(): void {
    state = createInitialState();
    dropAccum = 0;
    lastTime = null;
    paused = false;
    lastSnapshot = null; // fuerza la re-emisión del snapshot inicial
    lastLines = -1;
    soltarTeclas();
    draw();
    emit();
  }

  function setPaused(next: boolean): void {
    paused = next;
    // Al pausar se sueltan las teclas: si no, una marcada como pulsada seguiría
    // repitiendo al reanudar y movería la pieza sola.
    if (paused) soltarTeclas();
  }

  return { start, stop, restart, setPaused };
}

// ── Componente React ────────────────────────────────────────────────────────
//
// Ata el ciclo de vida del juego: el efecto de montaje crea el juego con
// `createGame`, lo arranca y —en el cleanup— lo detiene (cancela el rAF y, a
// partir de los pasos 7 y 8, desconecta el ResizeObserver y quita los listeners
// de teclado). Los callbacks entran por refs espejo para NO recrear el juego
// cuando cambian. `paused` se propaga en un efecto aparte, y `restart()` se
// expone como método imperativo vía `useImperativeHandle`.

const TetrisGame = forwardRef<PlayableGameHandle, PlayableGameProps>(
  function TetrisGame({ paused, onSnapshot, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<GameController | null>(null);

    // Refs espejo de los callbacks: el juego lee `.current` en cada emisión, así
    // que un cambio de prop no obliga a recrear el juego.
    const onSnapshotRef = useRef(onSnapshot);
    const onGameOverRef = useRef(onGameOver);
    useEffect(() => {
      onSnapshotRef.current = onSnapshot;
      onGameOverRef.current = onGameOver;
    });

    // Efecto de montaje: crea, arranca y (cleanup) detiene el juego. Sin
    // dependencias, y el cleanup lo deja todo apagado: el doble montaje de
    // Strict Mode en desarrollo deja un solo juego corriendo.
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

    // Propaga el control externo de pausa sin recrear el juego.
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

    return (
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className={styles.canvas}
          aria-label="Caída — encaja las piezas antes de que el techo te aplaste"
        />
      </div>
    );
  },
);

export default TetrisGame;
