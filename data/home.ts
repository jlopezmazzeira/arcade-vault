// ===== data/home.ts — datos mock estáticos de la home =====

import { GAMES, type AccentColor } from "@/data/games";

type TickerRow = {
  player: string;
  game: string;
  score: number;
  when: string;
  color: AccentColor;
};

type TopRow = {
  rank: number;
  player: string;
  score: number;
};

type HomeStat = {
  n: string;
  u: string;
  s: string;
};

// `game` es texto libre, no un id de GAMES: el ticker cita juegos que no están
// en el catálogo. `when` viene ya formateado a propósito — calcular el "hace N
// min" en render desincronizaría servidor y cliente.
export const TICKER: readonly TickerRow[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, when: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, when: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, when: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Rocas", score: 41200, when: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, when: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, when: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, when: "hace 31 min", color: "yellow" },
];

export const TOP_TODAY: readonly TopRow[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

// La primera cifra sale del catálogo, no de un literal: la plantilla decía "12+"
// con 8 juegos, contradiciendo lo que la propia página muestra más abajo.
export const HOME_STATS: readonly HomeStat[] = [
  { n: String(GAMES.length), u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];
