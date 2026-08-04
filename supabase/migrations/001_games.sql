-- 001_games.sql — SPEC 06
-- Crea `public.games`, la fuente de verdad del catálogo, con RLS de solo
-- lectura pública y la siembra de los 8 juegos de `data/games.ts`.
--
-- El catálogo NO se edita desde el cliente: no hay políticas de
-- insert/update/delete, así que la anon key (que viaja al navegador) solo puede
-- leer. Los cambios de catálogo van por migración.
--
-- `position` preserva el orden curado del array `GAMES` (índice 0..7); leer
-- ordenando por `title` habría reordenado el catálogo alfabéticamente.
-- `best` y `plays` son columnas estáticas sembradas desde el mock, no valores
-- derivados de `scores` (eso es otra spec).

create table public.games (
  id         text        primary key,
  position   smallint    not null,
  title      text        not null,
  short      text        not null,
  long       text        not null,
  cat        text        not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text        not null,
  color      text        not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best       integer     not null default 0,
  plays      text        not null,
  created_at timestamptz not null default now()
);

-- El orden curado tiene que ser inequívoco: dos juegos no pueden compartir hueco.
create unique index games_position_idx on public.games (position);

alter table public.games enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

-- ===== Siembra: los 8 juegos de data/games.ts, position = índice del array =====

insert into public.games (id, position, title, short, long, cat, cover, color, best, plays) values
  (
    'bloque-buster', 0, 'BLOQUE BUSTER',
    'Rebota la pelota y destruye muros de neón.',
    'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
    'ARCADE', 'cover-bricks', 'cyan', 28450, '12.4K'
  ),
  (
    'caida', 1, 'CAÍDA',
    'Encaja las piezas antes de que el techo te aplaste.',
    'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
    'PUZZLE', 'cover-tetro', 'magenta', 184220, '31.8K'
  ),
  (
    'serpentina', 2, 'SERPENTINA',
    'Crece sin morder tu propia cola.',
    'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
    'ARCADE', 'cover-snake', 'green', 7820, '9.1K'
  ),
  (
    'gloton', 3, 'GLOTÓN',
    'Devora puntos y escapa de los fantasmas.',
    'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
    'ARCADE', 'cover-glot', 'yellow', 96400, '27.2K'
  ),
  (
    'invasores', 4, 'INVASORES',
    'Defiende el planeta de filas alienígenas.',
    'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
    'SHOOTER', 'cover-invaders', 'green', 54190, '18.0K'
  ),
  (
    'rocas', 5, 'ASTEROIDS',
    'Pulveriza asteroides en gravedad cero.',
    'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir asteroides en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
    'SHOOTER', 'cover-rocas', 'yellow', 41200, '15.6K'
  ),
  (
    'ranaria', 6, 'RANARIA',
    'Cruza la autopista de pixeles.',
    'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
    'ARCADE', 'cover-rana', 'green', 18900, '6.4K'
  ),
  (
    'duelo-pixel', 7, 'DUELO PIXEL',
    'Dos paletas. Una pelota. Reflejos máximos.',
    'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
    'VERSUS', 'cover-duelo', 'cyan', 24, '4.2K'
  );
