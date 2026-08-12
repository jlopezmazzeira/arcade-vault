"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import styles from "./AsteroidsGame.module.css";
import type {
  GameSnapshot,
  PlayableGameHandle,
  PlayableGameProps,
  PlayableStatus,
} from "./types";

// ============================================================================
// AsteroidsGame — puerto TypeScript del juego Asteroids de
// references/started-games/02-asteroids/game.js.
//
// El juego completo vive dentro de la fábrica `createGame`: no hay estado
// mutable a nivel de módulo (solo constantes, utilidades y clases). El
// componente React (paso 2) crea el juego, ata su ciclo de vida y expone el
// handle imperativo. El canvas SOLO dibuja entidades — el HUD, los overlays y
// el modal de fin los pone la plataforma.
// ============================================================================

// ── Contrato juego ↔ plataforma ─────────────────────────────────────────────
//
// El contrato vive en ./types. Se re-exporta aquí para no romper los imports
// que ya apuntaban a este módulo (registry.ts, GamePlayerScreen.tsx).

export type {
  GameSnapshot,
  PlayableGameHandle,
  PlayableGameProps,
  PlayableStatus,
} from "./types";

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

// ── Constantes (portadas 1:1 desde game.js) ─────────────────────────────────

const W = 800;
const H = 600;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

// Nave
const SHIP_ROT = 3.5; // rad/s
const SHIP_THRUST = 260; // px/s²
const SHIP_DRAG = 0.987;
const SHIP_COOLDOWN = 0.2;
const SHIP_INVINCIBLE = 3;

const DT_CAP = 0.05; // 50 ms — evita el "spiral of death" al volver de blur

// ── Utilidades ──────────────────────────────────────────────────────────────

type Point = { x: number; y: number };

const wrap = (v: number, max: number): number => ((v % max) + max) % max;
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);
const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));

// ── Bullet ──────────────────────────────────────────────────────────────────

class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ────────────────────────────────────────────────────────────────

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead: boolean;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) {
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── PowerUp (triple disparo) ────────────────────────────────────────────────

class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 12;
    this.ttl = POWERUP_TTL;
    this.dead = false;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
  }
}

// ── Ship ────────────────────────────────────────────────────────────────────

class Ship {
  tripleShot: number;
  x!: number;
  y!: number;
  angle!: number;
  vx!: number;
  vy!: number;
  radius!: number;
  thrusting!: boolean;
  invincible!: number;
  shootCooldown!: number;
  dead!: boolean;

  constructor() {
    this.tripleShot = 0;
    this.reset();
  }

  reset(): void {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = SHIP_INVINCIBLE;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Record<string, boolean>): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    if (keys["ArrowLeft"]) this.angle -= SHIP_ROT * dt;
    if (keys["ArrowRight"]) this.angle += SHIP_ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
      this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
    }

    this.vx *= SHIP_DRAG;
    this.vy *= SHIP_DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = SHIP_COOLDOWN;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ──────────────────────────────────────────────────

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.dead = false;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Fábrica del juego ───────────────────────────────────────────────────────
//
// Todo el estado mutable del juego vive en este closure. Devuelve un
// controlador para el ciclo de vida (arrancar/parar/reiniciar/pausar). Los
// listeners de teclado se atan en `start()` y se quitan en `stop()`, de modo
// que el cleanup del efecto React (que llama a `stop()`) no deja nada vivo.

const CONTROL_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
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

function createGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  hooks: GameHooks,
): GameController {
  // ── Input ──
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  // ── Estado del juego ──
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: PlayableStatus;
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  // ── Ciclo de vida ──
  let running = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ── Escalado del lienzo ──
  // El juego dibuja SIEMPRE en coordenadas lógicas 800×600; el búfer del canvas
  // se ajusta al tamaño real en píxeles (× devicePixelRatio) y el contexto se
  // escala, de modo que las líneas se ven nítidas a cualquier tamaño en pantalla.
  let scaleX = 1;
  let scaleY = 1;
  let resizeObserver: ResizeObserver | null = null;

  // ── Emisión de snapshot (solo al cambiar un campo) ──
  let lastSnapshot: GameSnapshot | null = null;

  function emit(): void {
    const tripleShot = ship ? Math.max(0, ship.tripleShot) : 0;
    if (
      lastSnapshot &&
      lastSnapshot.score === score &&
      lastSnapshot.lives === lives &&
      lastSnapshot.level === level &&
      lastSnapshot.status === state &&
      // El contador de triple disparo cambia continuamente: solo nos importa
      // el flanco activo/inactivo para el indicador del HUD.
      (lastSnapshot.extra?.length ?? 0) > 0 === tripleShot > 0
    ) {
      return;
    }
    const prev = lastSnapshot;
    const snap: GameSnapshot = {
      score,
      lives,
      level,
      status: state,
      // El power-up viaja ya formateado: el HUD lo pinta como un `hud-stat`
      // más, sin conocer nada de Asteroids.
      extra: tripleShot > 0 ? [{ label: "Poder", value: "3× TRIPLE" }] : [],
    };
    lastSnapshot = snap;
    hooks.onSnapshot(snap);
    if (state === "gameover" && (!prev || prev.status !== "gameover")) {
      hooks.onGameOver(score);
    }
  }

  function isActive(): boolean {
    return running && !paused && state !== "gameover";
  }

  // ── Setup ──
  function spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame(): void {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    lastSnapshot = null; // fuerza re-emisión del snapshot inicial
    spawnAsteroids(4);
  }

  function nextLevel(): void {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip(): void {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──
  function update(dt: number): void {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // Ajusta el búfer del canvas a su tamaño real en pantalla (× DPR) y recalcula
  // la escala lógica→física. Se llama al arrancar y en cada resize del marco.
  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = rect.width || W;
    const cssH = rect.height || H;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    scaleX = canvas.width / W;
    scaleY = canvas.height / H;
    // Un resize borra el búfer: repintar el frame actual para no ver un flash.
    if (ship) draw();
  }

  // ── Draw (solo entidades; el HUD lo pone la plataforma) ──
  function draw(): void {
    // Base: mapea las coordenadas lógicas 800×600 al búfer real del canvas.
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);
  }

  // ── Loop principal ──
  function loop(ts: number): void {
    rafId = requestAnimationFrame(loop);
    if (paused) {
      // Congelado: reseteamos el reloj para que no haya salto de dt al reanudar.
      lastTime = null;
      return;
    }
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, DT_CAP);
    lastTime = ts;
    update(dt);
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
    if (!keys[e.code]) {
      if (isActive()) justPressed[e.code] = true;
    }
    keys[e.code] = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    keys[e.code] = false;
  }

  // ── Controlador expuesto ──
  function start(): void {
    if (running) return;
    running = true;
    paused = false;
    lastTime = null;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    initGame();
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
  }

  function restart(): void {
    initGame();
    lastTime = null;
    draw();
    emit();
  }

  function setPaused(next: boolean): void {
    paused = next;
    if (paused) {
      // Al pausar soltamos las teclas para que no queden "pegadas" al reanudar.
      for (const code of Object.keys(keys)) keys[code] = false;
    } else {
      lastTime = null;
    }
  }

  return { start, stop, restart, setPaused };
}

// ── Componente React ────────────────────────────────────────────────────────
//
// Ata el ciclo de vida del juego: el efecto de montaje crea el juego con
// `createGame`, lo arranca y —en el cleanup— lo detiene (cancela el rAF y quita
// los listeners). Los callbacks entran por refs espejo para NO recrear el juego
// cuando cambian. `paused` se propaga en un efecto aparte, y `restart()` se
// expone como método imperativo vía `useImperativeHandle`.

const AsteroidsGame = forwardRef<PlayableGameHandle, PlayableGameProps>(
  function AsteroidsGame({ paused, onSnapshot, onGameOver }, ref) {
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

    // Efecto de montaje: crea, arranca y (cleanup) detiene el juego.
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
          width={W}
          height={H}
          className={styles.canvas}
          aria-label="Asteroids — pulveriza los asteroides"
        />
      </div>
    );
  },
);

export default AsteroidsGame;
