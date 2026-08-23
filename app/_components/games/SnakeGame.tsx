"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import type {
  GameSnapshot,
  PlayableGameHandle,
  PlayableGameProps,
  PlayableStatus,
} from "./types";

// ============================================================================
// SnakeGame — Snake original del vault. A diferencia de `rocas`, `caida` y
// `bloque-buster`, este juego NO es un puerto: no hay carpeta en
// references/started-games/ para Snake, y lo único que aporta la referencia es
// el atlas de frutas. La mecánica —tick, puntuación y colisiones— está definida
// con números concretos en la SPEC 09.
//
// Todo el estado mutable vive dentro de `createGame`: el `window.SPRITE_ATLAS`
// del sprites.js original desaparece, y el módulo solo declara constantes y
// funciones puras.
//
// El canvas dibuja SOLO el juego — el HUD, el overlay de pausa y el modal de
// fin los pone la plataforma.
// ============================================================================

// ── Tipos del modelo ────────────────────────────────────────────────────────

/** Casilla de la rejilla. NO son píxeles: el juego razona en casillas. */
type Cell = { col: number; row: number };

/** Dirección de marcha, en casillas por paso. Uno de los cuatro versores. */
type Dir = { col: number; row: number };

// ── Constantes del juego ────────────────────────────────────────────────────

const CELL = 25; // px lógicos por casilla
const COLS = 32; // 32 × 25 = 800
const ROWS = 24; // 24 × 25 = 600

/** Lienzo lógico. Es 4/3 nativo: llena el marco CRT sin pilarbox. */
const VIEW_W = COLS * CELL; // 800
const VIEW_H = ROWS * CELL; // 600

const TICK_START_MS = 130; // paso inicial
const TICK_STEP_MS = 4; // se resta por cada fruta comida
const TICK_MIN_MS = 60; // suelo de velocidad

const START_LENGTH = 3;
const START_CELL: Cell = { col: 16, row: 12 }; // cabeza; cuerpo hacia la izquierda
const START_DIR: Dir = { col: 1, row: 0 }; // derecha

/** Puntos por fruta = SCORE_BASE + SCORE_STEP × frutasComidas (ya incrementadas). */
const SCORE_BASE = 10;
const SCORE_STEP = 2;

const FRUIT_SCALE = 0.9; // la fruta ocupa el 90 % de su casilla

/** Tope de `dt`: al volver de una pestaña en segundo plano la serpiente no
 *  ejecuta una ráfaga de pasos, como mucho uno extra. */
const DT_CAP = 50; // ms

// Colores del canvas, con el token de globals.css anotado al lado.
const SNAKE_HEAD = "#00ff88"; // --green
const SNAKE_BODY = "#00cc6a"; // --green oscurecido
const GRID_LINE = "#141827"; // rejilla tenue de fondo
const BACKGROUND = "#000";

// ── Reglas puras ────────────────────────────────────────────────────────────
//
// Reciben SIEMPRE el estado por parámetro: ninguna lee una variable de módulo.

/** ¿Dos casillas (o dos direcciones) son la misma? */
function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

/** ¿La casilla se sale de la rejilla? Los muros son mortales: no hay wrap. */
function isOutside(cell: Cell): boolean {
  return cell.col < 0 || cell.col >= COLS || cell.row < 0 || cell.row >= ROWS;
}

/** ¿`cell` cae sobre algún segmento de la serpiente? */
function hitsSnake(snake: readonly Cell[], cell: Cell): boolean {
  return snake.some((seg) => sameCell(seg, cell));
}

/** Giro de 180°: el que invertiría la marcha y mataría en el acto. */
function isReverse(dir: Dir, next: Dir): boolean {
  return dir.col === -next.col && dir.row === -next.row;
}

/** Serpiente inicial: START_LENGTH segmentos desde START_CELL hacia la izquierda. */
function buildSnake(): Cell[] {
  return Array.from({ length: START_LENGTH }, (_, i) => ({
    col: START_CELL.col - i,
    row: START_CELL.row,
  }));
}

/**
 * Casilla libre al azar para la siguiente fruta.
 *
 * Recorre las casillas libres y elige entre ELLAS, no al azar en toda la
 * rejilla reintentando: con la rejilla casi llena, el reintento se convierte en
 * un bucle que puede no terminar. Sin casilla libre devuelve `null`, y quien
 * llama termina la partida.
 */
function pickFruitCell(snake: readonly Cell[]): Cell | null {
  const free: Cell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = { col, row };
      if (!hitsSnake(snake, cell)) free.push(cell);
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

// ── Dibujo vectorial ────────────────────────────────────────────────────────

/** Rejilla tenue de fondo: da referencia de casilla sin competir con el juego. */
function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 1; col < COLS; col++) {
    // El medio píxel deja la línea nítida en vez de repartida entre dos filas.
    const x = col * CELL + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW_H);
  }
  for (let row = 1; row < ROWS; row++) {
    const y = row * CELL + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
  }
  ctx.stroke();
}

/**
 * Fruta de reserva: rombo verde inscrito en la casilla.
 *
 * Es lo que se ve mientras `fruits.png` carga y lo que queda si la carga falla:
 * la partida es jugable sin la imagen.
 */
function drawFruitFallback(ctx: CanvasRenderingContext2D, cell: Cell): void {
  const cx = cell.col * CELL + CELL / 2;
  const cy = cell.row * CELL + CELL / 2;
  const r = (CELL * FRUIT_SCALE) / 2;
  ctx.fillStyle = SNAKE_HEAD;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

/** Los dos ojos de la cabeza, colocados según hacia dónde mira. */
function drawEyes(ctx: CanvasRenderingContext2D, head: Cell, dir: Dir): void {
  const cx = head.col * CELL + CELL / 2;
  const cy = head.row * CELL + CELL / 2;
  const forward = CELL * 0.22; // separación hacia el morro
  const side = CELL * 0.2; // separación entre ojos, perpendicular a la marcha
  const r = CELL * 0.09;

  // El eje perpendicular a la marcha es la dirección girada 90°.
  const px = -dir.row;
  const py = dir.col;

  ctx.fillStyle = BACKGROUND;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      cx + dir.col * forward + px * side * sign,
      cy + dir.row * forward + py * side * sign,
      r,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/** Serpiente entera: cuerpo en verde oscuro, cabeza en `--green` con ojos. */
function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: readonly Cell[],
  dir: Dir,
): void {
  // Un margen de 1 px por lado separa visualmente los segmentos contiguos.
  const pad = 1;
  const size = CELL - pad * 2;

  ctx.fillStyle = SNAKE_BODY;
  for (let i = 1; i < snake.length; i++) {
    ctx.fillRect(
      snake[i].col * CELL + pad,
      snake[i].row * CELL + pad,
      size,
      size,
    );
  }

  const head = snake[0];
  ctx.fillStyle = SNAKE_HEAD;
  ctx.fillRect(head.col * CELL + pad, head.row * CELL + pad, size, size);
  drawEyes(ctx, head, dir);
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
 * dentro, así que dos montajes del componente no comparten ni serpiente ni
 * puntuación.
 */
function createGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  hooks: GameHooks,
): GameController {
  // ── Estado ──
  let snake: Cell[] = buildSnake();
  let dir: Dir = { ...START_DIR };
  /** Cola de UN solo giro por tick: la defensa contra el suicidio por doble
   *  pulsación. Dos teclas en el mismo tick no pueden invertir la marcha. */
  let queuedDir: Dir | null = null;
  let fruit: Cell | null = pickFruitCell(snake);

  let fruitsEaten = 0;
  let score = 0;
  let tickMs = TICK_START_MS;
  /** Acumulador del tick: el movimiento es por paso fijo, no por frame. En
   *  144 Hz la serpiente avanza exactamente igual que en 60 Hz. */
  let acc = 0;

  let paused = false;
  let running = false;
  let gameOver = false;

  let rafId: number | null = null;
  let lastTime: number | null = null;

  // El juego se dibuja SIEMPRE en coordenadas lógicas 800×600; el búfer real se
  // ajusta al tamaño en pantalla (× DPR) y el contexto se escala.
  let scaleX = 1;
  let scaleY = 1;
  let resizeObserver: ResizeObserver | null = null;

  /** ¿Se puede simular? Ni en pausa ni con la partida acabada. */
  function isActive(): boolean {
    return running && !paused && !gameOver;
  }

  // ── Emisión de snapshot ──
  //
  // Snake no tiene ni vidas ni niveles: la primera colisión acaba la partida y
  // la dificultad es una rampa continua de velocidad. El snapshot lleva `score`
  // y la longitud en `extra`; el HUD omite los dos huecos que no vienen.
  function emit(): void {
    const status: PlayableStatus = gameOver ? "gameover" : "playing";
    hooks.onSnapshot({
      score,
      status,
      extra: [{ label: "Longitud", value: String(snake.length) }],
    });
    if (gameOver) hooks.onGameOver(score);
  }

  /** Fin de partida: se detiene el avance y se emite el estado final. */
  function die(): void {
    gameOver = true;
    emit();
  }

  // ── Un paso de la serpiente ──
  //
  // Se ejecuta una vez cada `tickMs`, NO una vez por frame.
  function step(): void {
    // El giro encolado se consume al principio del paso: así una tecla pulsada
    // a mitad de tick no cambia el rumbo hasta el paso siguiente.
    if (queuedDir) {
      dir = queuedDir;
      queuedDir = null;
    }

    const head = snake[0];
    const next: Cell = { col: head.col + dir.col, row: head.row + dir.row };

    // Muro mortal: salir de la rejilla acaba la partida.
    if (isOutside(next)) {
      die();
      return;
    }

    // Autocolisión contra CUALQUIER segmento, la cola incluida: es la lectura
    // literal de "entrar en una casilla ocupada por el propio cuerpo mata".
    if (hitsSnake(snake, next)) {
      die();
      return;
    }

    snake.unshift(next);

    if (fruit && sameCell(next, fruit)) {
      // Comer: la cola NO se recorta (la serpiente crece un segmento), se
      // acelera el paso y se suman los puntos de esta fruta.
      fruitsEaten++;
      score += SCORE_BASE + SCORE_STEP * fruitsEaten;
      tickMs = Math.max(TICK_MIN_MS, tickMs - TICK_STEP_MS);
      fruit = pickFruitCell(snake);
      // Rejilla llena: no queda casilla libre donde poner la siguiente fruta.
      // Prácticamente inalcanzable (768 casillas), pero deja el generador
      // acotado en vez de dejarlo buscando hueco para siempre.
      if (!fruit) {
        die();
        return;
      }
      emit();
    } else {
      snake.pop();
    }
  }

  // ── Draw ──
  function draw(): void {
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    drawGrid(ctx);
    if (fruit) drawFruitFallback(ctx, fruit);
    drawSnake(ctx, snake, dir);
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
    draw(); // un resize borra el búfer: repintar para no ver un parpadeo
  }

  // ── Bucle ──
  function loop(ts: number): void {
    rafId = requestAnimationFrame(loop);
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, DT_CAP);
    lastTime = ts;

    if (isActive()) {
      acc += dtMs;
      // `while` y no `if`: con el `dt` capado a 50 ms y el tick mínimo en
      // 60 ms, como mucho entra una segunda vuelta. Nunca una ráfaga.
      while (acc >= tickMs && isActive()) {
        acc -= tickMs;
        step();
      }
    }

    // En pausa y en fin de partida NO se avanza, pero se sigue dibujando: el
    // overlay y el modal de la plataforma van encima del canvas, y un resize
    // recrearía el búfer en blanco con el bucle parado.
    draw();
  }

  // ── Controlador expuesto ──
  function start(): void {
    if (running) return;
    running = true;
    paused = false;
    lastTime = null;

    resize(); // ajusta el búfer a la resolución real y pinta el primer frame
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    emit(); // el HUD arranca con 0 puntos y longitud 3
    rafId = requestAnimationFrame(loop);
  }

  /**
   * Apaga la partida entera. Es lo que corre en el cleanup del efecto de
   * montaje, y de que lo deje todo apagado depende que el doble montaje de
   * Strict Mode en desarrollo deje UNA sola partida viva.
   */
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
  }

  /** Partida limpia: 3 segmentos en el centro, 0 puntos y 130 ms por paso. */
  function restart(): void {
    snake = buildSnake();
    dir = { ...START_DIR };
    queuedDir = null;
    fruit = pickFruitCell(snake);
    fruitsEaten = 0;
    score = 0;
    tickMs = TICK_START_MS;
    acc = 0;
    gameOver = false;
    paused = false;
    lastTime = null;
    draw();
    emit();
  }

  function setPaused(next: boolean): void {
    paused = next;
    if (paused) {
      // Se vacía la cola: un giro encolado antes de la pausa no debe
      // dispararse al reanudar, cuando el jugador ya no lo espera.
      queuedDir = null;
      // El acumulador también: si no, el tiempo "pausado" no cuenta pero el
      // resto de tick acumulado dispararía un paso instantáneo al reanudar.
      acc = 0;
    }
  }

  return { start, stop, restart, setPaused };
}

// ── Componente React ────────────────────────────────────────────────────────
//
// Ata el ciclo de vida del juego: el efecto de montaje crea la partida con
// `createGame`, la arranca y —en el cleanup— la apaga entera (rAF y
// ResizeObserver hoy; los listeners de teclado se suman en el paso 6). Los
// callbacks entran por refs espejo para NO recrear el juego cuando cambian,
// `paused` viaja en un efecto aparte, y `restart()` se expone como método
// imperativo.

const SnakeGame = forwardRef<PlayableGameHandle, PlayableGameProps>(
  function SnakeGame({ paused, onSnapshot, onGameOver }, ref) {
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
    // de Strict Mode en desarrollo deja UNA sola partida y una sola serpiente.
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

    return (
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        aria-label="Serpentina — guía la serpiente de luz por la rejilla y come fruta"
      />
    );
  },
);

export default SnakeGame;
