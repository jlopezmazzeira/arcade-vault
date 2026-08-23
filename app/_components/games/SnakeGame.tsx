"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import styles from "./SnakeGame.module.css";
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

/** Ruta pública del PNG copiado. Absoluta: la página se sirve desde
 *  /juegos/serpentina/jugar, así que una ruta relativa rompería. */
const SPRITE_SRC = "/games/snake/fruits.png";

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

/** ¿La tecla pide el rumbo que ya se lleva? Entonces no es un giro. */
function isSameDir(dir: Dir, next: Dir): boolean {
  return dir.col === next.col && dir.row === next.row;
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

// ── Atlas de frutas ─────────────────────────────────────────────────────────
//
// Portado 1:1 de references/source-assets/snake-assets/sprites.js: las 22
// entradas de la fila y = 136 de fruits.png (hoja de 3790×442). Todas miden 160
// de alto y entre 110 y 170 de ancho, así que NO son cuadradas — de ahí que el
// dibujo conserve la relación de aspecto en vez de estirarlas a la casilla.
//
// El `window.SPRITE_ATLAS` del original desaparece: esto es una constante del
// módulo, no estado global, y nada escribe en `window`.

/** Recorte dentro del atlas: origen y tamaño en px de la hoja. */
type FruitRect = { sx: number; sy: number; sw: number; sh: number };

const FRUITS: readonly FruitRect[] = [
  { sx: 34, sy: 136, sw: 110, sh: 160 }, // banana
  { sx: 186, sy: 136, sw: 150, sh: 160 }, // orange
  { sx: 378, sy: 136, sw: 110, sh: 160 }, // grape
  { sx: 540, sy: 136, sw: 130, sh: 160 }, // garlic
  { sx: 712, sy: 136, sw: 130, sh: 160 }, // eggplant
  { sx: 894, sy: 136, sw: 110, sh: 160 }, // strawberry
  { sx: 1066, sy: 136, sw: 110, sh: 160 }, // cherry
  { sx: 1228, sy: 136, sw: 130, sh: 160 }, // carrot
  { sx: 1400, sy: 136, sw: 130, sh: 160 }, // mushroom
  { sx: 1582, sy: 136, sw: 110, sh: 160 }, // broccoli
  { sx: 1734, sy: 136, sw: 150, sh: 160 }, // watermelon
  { sx: 1906, sy: 136, sw: 150, sh: 160 }, // pepper
  { sx: 2068, sy: 136, sw: 170, sh: 160 }, // kiwi
  { sx: 2250, sy: 136, sw: 140, sh: 160 }, // lemon
  { sx: 2432, sy: 136, sw: 130, sh: 160 }, // peach
  { sx: 2604, sy: 136, sw: 130, sh: 160 }, // peanut
  { sx: 2786, sy: 136, sw: 110, sh: 160 }, // apple
  { sx: 2948, sy: 136, sw: 130, sh: 160 }, // tomato
  { sx: 3110, sy: 136, sw: 150, sh: 160 }, // berries
  { sx: 3302, sy: 136, sw: 110, sh: 160 }, // grapes2
  { sx: 3454, sy: 136, sw: 150, sh: 160 }, // pineapple
  { sx: 3637, sy: 136, sw: 130, sh: 160 }, // melon
];

/**
 * Arranca la carga del atlas y devuelve la `Image` en vuelo.
 *
 * Función pura: no guarda nada. Quien la llama —la fábrica `createGame`— se
 * queda con la hoja y con el handle de la imagen, y puede anular su `onload` al
 * desmontar para que una carga en vuelo no toque un juego muerto.
 *
 * A diferencia de `ArkanoidGame`, la hoja NO se copia a un canvas intermedio:
 * allí es lo que hacía el original y los sprites son pixel art diminuto; aquí
 * copiar 3790×442 costaría ~6,7 MB de RAM para dibujar UN recorte por frame.
 */
function loadFruitSheet(
  src: string,
  onReady: (sheet: HTMLImageElement) => void,
): HTMLImageElement {
  const img = new Image();
  img.onload = () => onReady(img);
  img.onerror = () => {
    // No es fatal: sin hoja, la fruta se dibuja como rombo y se sigue jugando.
    console.error(`No se pudo cargar el atlas de frutas: ${src}`);
  };
  img.src = src;
  return img;
}

// ── Teclado ─────────────────────────────────────────────────────────────────
//
// Flechas y WASD, por `e.code`: es la tecla FÍSICA, así que la cruz WASD sigue
// siendo una cruz en un teclado que no sea QWERTY. Las teclas `P` / `Escape` de
// pausa NO se capturan: `paused` es estado declarativo de la plataforma, y si el
// juego lo conmutara por su cuenta el botón PAUSA/REANUDAR quedaría
// desincronizado.

const KEY_DIRS: Readonly<Record<string, Dir>> = {
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
  KeyW: { col: 0, row: -1 },
  KeyS: { col: 0, row: 1 },
  KeyA: { col: -1, row: 0 },
  KeyD: { col: 1, row: 0 },
};

/** Teclas del juego: son las que hacen `preventDefault` con la partida activa. */
const CONTROL_CODES = new Set<string>(Object.keys(KEY_DIRS));

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

/**
 * Fruta desde el atlas, centrada en su casilla y SIN deformar.
 *
 * El factor sale del lado mayor del recorte, no de cada eje por separado: con
 * recortes de 110×160 a 170×160 metidos en una casilla cuadrada de 25 px,
 * escalar por eje los estiraría. Así el lado mayor ocupa el 90 % de la casilla
 * y el menor lo que le corresponda.
 */
function drawFruitSprite(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  rect: FruitRect,
  cell: Cell,
): void {
  const k = (FRUIT_SCALE * CELL) / Math.max(rect.sw, rect.sh);
  const w = rect.sw * k;
  const h = rect.sh * k;
  const x = cell.col * CELL + (CELL - w) / 2;
  const y = cell.row * CELL + (CELL - h) / 2;
  ctx.drawImage(sheet, rect.sx, rect.sy, rect.sw, rect.sh, x, y, w, h);
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
  let fruit: Cell | null = null;
  /** Índice en FRUITS del sprite de la fruta en juego. Se sortea al aparecer:
   *  las 22 frutas valen lo mismo, la variedad es solo visual. */
  let fruitSprite = 0;

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

  // El atlas: `sheet` es la hoja ya cargada y `sheetImg` el handle, que se
  // conserva solo para poder anular su `onload` en `stop()` si la carga sigue
  // en vuelo al desmontar. A diferencia de `bloque-buster` NO hay bandera
  // `ready`: el juego no espera a la imagen, arranca con el rombo de reserva.
  let sheet: HTMLImageElement | null = null;
  let sheetImg: HTMLImageElement | null = null;

  /**
   * Coloca la siguiente fruta en una casilla libre y le sortea sprite.
   * Devuelve `false` si la rejilla está llena: no hay dónde ponerla.
   */
  function spawnFruit(): boolean {
    fruit = pickFruitCell(snake);
    if (!fruit) return false;
    fruitSprite = Math.floor(Math.random() * FRUITS.length);
    return true;
  }

  /** ¿Se puede simular? Ni en pausa ni con la partida acabada. */
  function isActive(): boolean {
    return running && !paused && !gameOver;
  }

  // ── Emisión de snapshot ──
  //
  // Snake no tiene ni vidas ni niveles: la primera colisión acaba la partida y
  // la dificultad es una rampa continua de velocidad. El snapshot lleva `score`
  // y la longitud en `extra`; el HUD omite los dos huecos que no vienen.
  //
  // `status` solo vale "playing" o "gameover": sin vidas no hay estado
  // intermedio entre chocar y terminar, así que "dead" no se usa.
  let lastSnapshot: GameSnapshot | null = null;

  /**
   * Emite SOLO si cambió `score`, la longitud o `status` respecto al último.
   * Nunca por frame: una partida de 10 frutas produce 11 llamadas —una por
   * fruta más la de muerte—, no 600.
   */
  function emit(): void {
    const status: PlayableStatus = gameOver ? "gameover" : "playing";
    const length = String(snake.length);
    if (
      lastSnapshot &&
      lastSnapshot.score === score &&
      lastSnapshot.status === status &&
      lastSnapshot.extra?.[0]?.value === length
    ) {
      return;
    }

    const prev = lastSnapshot;
    const snap: GameSnapshot = {
      score,
      status,
      extra: [{ label: "Longitud", value: length }],
    };
    lastSnapshot = snap;
    hooks.onSnapshot(snap);

    // El fin de partida se avisa una sola vez, en el flanco: el modal de fin no
    // debe reabrirse por una emisión posterior.
    if (gameOver && (!prev || prev.status !== "gameover")) {
      hooks.onGameOver(score);
    }
  }

  /**
   * Fin de partida.
   *
   * Marcar `gameOver` deja `isActive()` en falso, y como el `while` del bucle lo
   * vuelve a comprobar en cada vuelta, la serpiente NO da un paso más antes de
   * que se avise. El `requestAnimationFrame` sigue vivo a propósito —igual que
   * en los tres juegos ya adaptados—: solo dibuja, y sin él un resize detrás del
   * modal de fin dejaría el canvas en blanco.
   */
  function die(): void {
    gameOver = true;
    emit();
  }

  // ── Entrada de teclado ──

  /**
   * Encola un giro para el próximo paso.
   *
   * La cola es de UNO: encolado el primer giro válido, las teclas siguientes se
   * descartan hasta que `step()` lo consuma. Es la defensa contra el suicidio
   * clásico —dos teclas en el mismo tick invirtiendo la marcha—, porque la
   * no-inversión se comprueba contra la dirección REAL de la serpiente y esa
   * dirección no cambia hasta el paso.
   *
   * Ni el giro de 180° ni la tecla del rumbo que ya se lleva ocupan la plaza:
   * no son giros, así que descartarlos no puede robarle el turno a uno que sí
   * lo sea.
   */
  function queueTurn(next: Dir): void {
    if (queuedDir) return;
    if (isReverse(dir, next)) return;
    if (isSameDir(dir, next)) return;
    queuedDir = next;
  }

  function onKeyDown(e: KeyboardEvent): void {
    // Si el foco está en un campo de texto (p.ej. las iniciales del modal de
    // fin), el juego no toca la tecla: dejar escribir con normalidad.
    if (isTypingTarget(e.target)) return;

    if (CONTROL_CODES.has(e.code)) {
      // preventDefault SOLO con el juego activo: en pausa o en fin de partida
      // las flechas deben poder scrollear la página con normalidad.
      if (isActive()) e.preventDefault();
    }

    if (!isActive()) return;
    const next = KEY_DIRS[e.code];
    if (next) queueTurn(next);
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
      // Rejilla llena: no queda casilla libre donde poner la siguiente fruta.
      // Prácticamente inalcanzable (768 casillas), pero deja el generador
      // acotado en vez de dejarlo buscando hueco para siempre.
      if (!spawnFruit()) {
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
    if (fruit) {
      // Mientras la hoja no esté cargada —o si falló— entra el rombo de
      // reserva: la partida es jugable sin la imagen.
      if (sheet) drawFruitSprite(ctx, sheet, FRUITS[fruitSprite], fruit);
      else drawFruitFallback(ctx, fruit);
    }
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

    // La carga la posee la fábrica: la hoja es suya, no del módulo, y `stop()`
    // puede desactivar el callback si sigue en vuelo.
    sheetImg = loadFruitSheet(SPRITE_SRC, (loaded) => {
      sheet = loaded;
    });

    window.addEventListener("keydown", onKeyDown);

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
    // Una carga en vuelo no debe tocar un juego ya desmontado.
    if (sheetImg) {
      sheetImg.onload = null;
      sheetImg.onerror = null;
      sheetImg = null;
    }
    window.removeEventListener("keydown", onKeyDown);
    queuedDir = null;
  }

  /** Partida limpia: 3 segmentos en el centro, 0 puntos y 130 ms por paso. */
  function restart(): void {
    snake = buildSnake();
    dir = { ...START_DIR };
    queuedDir = null;
    spawnFruit();
    fruitsEaten = 0;
    score = 0;
    tickMs = TICK_START_MS;
    acc = 0;
    gameOver = false;
    paused = false;
    lastTime = null;
    lastSnapshot = null; // fuerza la re-emisión del snapshot inicial
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

  // Primera fruta en el tablero antes del primer frame.
  spawnFruit();

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
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className={styles.canvas}
          aria-label="Serpentina — guía la serpiente de luz por la rejilla y come fruta"
        />
      </div>
    );
  },
);

export default SnakeGame;
