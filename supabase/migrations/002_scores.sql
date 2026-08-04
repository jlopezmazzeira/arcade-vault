-- 002_scores.sql — SPEC 06
-- Crea `public.scores`, el leaderboard, y lo siembra para que ningún ranking
-- arranque vacío.
--
-- RLS: lectura pública, e insert abierto a `anon` y `authenticated` — el modal
-- de fin de partida permite guardar como invitado sin obligar a iniciar sesión.
-- El `with check` es la última línea de defensa aunque alguien llame a la API
-- REST saltándose la Server Action: acota `score` y `player_name`, y ata
-- `user_id` a `auth.uid()`, así que un invitado no puede inventarse un dueño ni
-- un autenticado firmar como otro.
--
-- `player_name` va desnormalizado en la fila (no solo `user_id`) para leer el
-- ranking sin join a `auth.users` y para que las filas de invitado tengan
-- nombre. El límite de 40 encaja el `display_name` de la SPEC 04.

create table public.scores (
  id          bigint      generated always as identity primary key,
  game_id     text        not null references public.games(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,
  player_name text        not null check (char_length(btrim(player_name)) between 1 and 40),
  score       integer     not null check (score >= 0),
  created_at  timestamptz not null default now()
);

-- Cubre la consulta del leaderboard: filtrar por juego y ordenar por score.
create index scores_game_score_idx on public.scores (game_id, score desc, created_at asc);

alter table public.scores enable row level security;

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_session_or_guest" on public.scores
  for insert to anon, authenticated
  with check (
    score >= 0
    and char_length(btrim(player_name)) between 1 and 40
    and (user_id is null or user_id = (select auth.uid()))
  );

-- ===== Siembra: 12 filas por juego, generadas con la lógica de `seededScores`
-- de data/games.ts (semilla = longitud del id * 23 + 7, la misma que usaba el
-- salón). `user_id` null: son partidas de invitado del mock. =====

insert into public.scores (game_id, user_id, player_name, score, created_at) values
  -- bloque-buster (semilla 306)
  ('bloque-buster', null, 'RGB_QUEEN', 275088, '2026-05-20T00:00:00Z'),
  ('bloque-buster', null, 'GLITCHA', 232454, '2026-06-20T00:00:00Z'),
  ('bloque-buster', null, 'Z3R0COOL', 232104, '2026-03-05T00:00:00Z'),
  ('bloque-buster', null, 'DROID_X', 214488, '2026-05-20T00:00:00Z'),
  ('bloque-buster', null, 'MAGENTA88', 210081, '2026-08-19T00:00:00Z'),
  ('bloque-buster', null, 'VAULT_07', 209958, '2026-10-01T00:00:00Z'),
  ('bloque-buster', null, 'CYBER_LU', 174442, '2026-05-16T00:00:00Z'),
  ('bloque-buster', null, 'NEONFOX', 160117, '2026-05-20T00:00:00Z'),
  ('bloque-buster', null, 'PIXEL_DAD', 140654, '2026-01-19T00:00:00Z'),
  ('bloque-buster', null, 'ARKADYA', 112969, '2026-11-19T00:00:00Z'),
  ('bloque-buster', null, 'VECTORX', 35990, '2026-01-10T00:00:00Z'),
  ('bloque-buster', null, 'PX_KAI', 4146, '2026-02-13T00:00:00Z'),
  -- caida (semilla 122)
  ('caida', null, 'PIXEL_DAD', 278245, '2026-05-27T00:00:00Z'),
  ('caida', null, 'Z3R0COOL', 225057, '2026-01-20T00:00:00Z'),
  ('caida', null, 'NEONFOX', 222599, '2026-04-28T00:00:00Z'),
  ('caida', null, 'ARKADYA', 216608, '2026-02-06T00:00:00Z'),
  ('caida', null, 'VAULT_07', 195074, '2026-05-17T00:00:00Z'),
  ('caida', null, 'RETROVIRA', 193429, '2026-07-11T00:00:00Z'),
  ('caida', null, 'CYBER_LU', 179935, '2026-12-23T00:00:00Z'),
  ('caida', null, 'VECTORX', 108899, '2026-12-08T00:00:00Z'),
  ('caida', null, 'PX_KAI', 102080, '2026-03-09T00:00:00Z'),
  ('caida', null, 'DROID_X', 58663, '2026-11-16T00:00:00Z'),
  ('caida', null, 'JOY_STK', 49834, '2026-01-12T00:00:00Z'),
  ('caida', null, 'GLITCHA', 39744, '2026-06-05T00:00:00Z'),
  -- serpentina (semilla 237)
  ('serpentina', null, 'DROID_X', 270582, '2026-03-22T00:00:00Z'),
  ('serpentina', null, 'RGB_QUEEN', 259517, '2026-02-16T00:00:00Z'),
  ('serpentina', null, 'ARKADYA', 255001, '2026-01-20T00:00:00Z'),
  ('serpentina', null, 'NEONFOX', 238365, '2026-04-10T00:00:00Z'),
  ('serpentina', null, 'VAULT_07', 192053, '2026-03-18T00:00:00Z'),
  ('serpentina', null, 'JOY_STK', 131767, '2026-04-05T00:00:00Z'),
  ('serpentina', null, 'SCANLINE', 123815, '2026-06-15T00:00:00Z'),
  ('serpentina', null, 'PX_KAI', 120785, '2026-03-17T00:00:00Z'),
  ('serpentina', null, 'CYBER_LU', 110896, '2026-03-16T00:00:00Z'),
  ('serpentina', null, 'MAGENTA88', 94783, '2026-06-07T00:00:00Z'),
  ('serpentina', null, 'PIXEL_DAD', 44169, '2026-01-24T00:00:00Z'),
  ('serpentina', null, 'VECTORX', 23452, '2026-05-28T00:00:00Z'),
  -- gloton (semilla 145)
  ('gloton', null, 'JOY_STK', 279079, '2026-01-26T00:00:00Z'),
  ('gloton', null, 'PIXEL_DAD', 267110, '2026-01-10T00:00:00Z'),
  ('gloton', null, 'PX_KAI', 214662, '2026-05-01T00:00:00Z'),
  ('gloton', null, 'DROID_X', 203174, '2026-11-16T00:00:00Z'),
  ('gloton', null, 'VECTORX', 202488, '2026-03-28T00:00:00Z'),
  ('gloton', null, 'RGB_QUEEN', 195723, '2026-09-11T00:00:00Z'),
  ('gloton', null, 'MAGENTA88', 191010, '2026-04-12T00:00:00Z'),
  ('gloton', null, 'SCANLINE', 186887, '2026-08-05T00:00:00Z'),
  ('gloton', null, 'ATARI_KID', 183133, '2026-04-05T00:00:00Z'),
  ('gloton', null, 'BIT_LORD', 143287, '2026-04-07T00:00:00Z'),
  ('gloton', null, 'RETROVIRA', 128647, '2026-07-27T00:00:00Z'),
  ('gloton', null, 'VAULT_07', 67068, '2026-12-13T00:00:00Z'),
  -- invasores (semilla 214)
  ('invasores', null, 'NEONFOX', 286640, '2026-05-28T00:00:00Z'),
  ('invasores', null, 'ATARI_KID', 261239, '2026-10-25T00:00:00Z'),
  ('invasores', null, 'ARKADYA', 245303, '2026-06-11T00:00:00Z'),
  ('invasores', null, 'MAGENTA88', 238189, '2026-10-28T00:00:00Z'),
  ('invasores', null, 'RGB_QUEEN', 198521, '2026-04-22T00:00:00Z'),
  ('invasores', null, 'BIT_LORD', 195542, '2026-09-25T00:00:00Z'),
  ('invasores', null, 'VECTORX', 170503, '2026-02-15T00:00:00Z'),
  ('invasores', null, 'VAULT_07', 140256, '2026-10-17T00:00:00Z'),
  ('invasores', null, 'PX_KAI', 47871, '2026-09-03T00:00:00Z'),
  ('invasores', null, 'M00NRYU', 29677, '2026-01-01T00:00:00Z'),
  ('invasores', null, 'JOY_STK', 22397, '2026-08-27T00:00:00Z'),
  ('invasores', null, 'RETROVIRA', 1000, '2026-03-25T00:00:00Z'),
  -- rocas (semilla 122)
  ('rocas', null, 'PIXEL_DAD', 278245, '2026-05-27T00:00:00Z'),
  ('rocas', null, 'Z3R0COOL', 225057, '2026-01-20T00:00:00Z'),
  ('rocas', null, 'NEONFOX', 222599, '2026-04-28T00:00:00Z'),
  ('rocas', null, 'ARKADYA', 216608, '2026-02-06T00:00:00Z'),
  ('rocas', null, 'VAULT_07', 195074, '2026-05-17T00:00:00Z'),
  ('rocas', null, 'RETROVIRA', 193429, '2026-07-11T00:00:00Z'),
  ('rocas', null, 'CYBER_LU', 179935, '2026-12-23T00:00:00Z'),
  ('rocas', null, 'VECTORX', 108899, '2026-12-08T00:00:00Z'),
  ('rocas', null, 'PX_KAI', 102080, '2026-03-09T00:00:00Z'),
  ('rocas', null, 'DROID_X', 58663, '2026-11-16T00:00:00Z'),
  ('rocas', null, 'JOY_STK', 49834, '2026-01-12T00:00:00Z'),
  ('rocas', null, 'GLITCHA', 39744, '2026-06-05T00:00:00Z'),
  -- ranaria (semilla 168)
  ('ranaria', null, 'ATARI_KID', 274036, '2026-02-28T00:00:00Z'),
  ('ranaria', null, 'CYBER_LU', 248743, '2026-10-10T00:00:00Z'),
  ('ranaria', null, 'Z3R0COOL', 221737, '2026-01-26T00:00:00Z'),
  ('ranaria', null, 'RETROVIRA', 171321, '2026-09-26T00:00:00Z'),
  ('ranaria', null, 'MAGENTA88', 149988, '2026-08-07T00:00:00Z'),
  ('ranaria', null, 'BIT_LORD', 138861, '2026-03-01T00:00:00Z'),
  ('ranaria', null, 'M00NRYU', 116754, '2026-07-16T00:00:00Z'),
  ('ranaria', null, 'VAULT_07', 112288, '2026-03-25T00:00:00Z'),
  ('ranaria', null, 'DROID_X', 109893, '2026-07-26T00:00:00Z'),
  ('ranaria', null, 'GLITCHA', 102992, '2026-12-15T00:00:00Z'),
  ('ranaria', null, 'VECTORX', 85560, '2026-10-25T00:00:00Z'),
  ('ranaria', null, 'PX_KAI', 49903, '2026-04-03T00:00:00Z'),
  -- duelo-pixel (semilla 260)
  ('duelo-pixel', null, 'SCANLINE', 281190, '2026-11-23T00:00:00Z'),
  ('duelo-pixel', null, 'GLITCHA', 231848, '2026-07-18T00:00:00Z'),
  ('duelo-pixel', null, 'VECTORX', 210992, '2026-07-02T00:00:00Z'),
  ('duelo-pixel', null, 'ARKADYA', 151133, '2026-10-14T00:00:00Z'),
  ('duelo-pixel', null, 'PIXEL_DAD', 129572, '2026-06-05T00:00:00Z'),
  ('duelo-pixel', null, 'JOY_STK', 93040, '2026-08-10T00:00:00Z'),
  ('duelo-pixel', null, 'RGB_QUEEN', 85990, '2026-11-09T00:00:00Z'),
  ('duelo-pixel', null, 'Z3R0COOL', 79598, '2026-04-05T00:00:00Z'),
  ('duelo-pixel', null, 'M00NRYU', 75621, '2026-03-20T00:00:00Z'),
  ('duelo-pixel', null, 'NEONFOX', 67338, '2026-04-24T00:00:00Z'),
  ('duelo-pixel', null, 'VAULT_07', 65201, '2026-07-06T00:00:00Z'),
  ('duelo-pixel', null, 'BIT_LORD', 61481, '2026-11-19T00:00:00Z');
