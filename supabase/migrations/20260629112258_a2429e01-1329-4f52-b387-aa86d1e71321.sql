
CREATE TABLE public.player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year integer NOT NULL,
  comp_type text NOT NULL CHECK (comp_type IN ('superleague','national','continental','international')),
  competition text NOT NULL,
  country text,
  continent text,
  player_name text NOT NULL,
  idu text,
  nationality text,
  club text,
  gls numeric DEFAULT 0,
  ast numeric DEFAULT 0,
  games numeric DEFAULT 0,
  hdj numeric DEFAULT 0,
  ca numeric DEFAULT 0,
  cp numeric DEFAULT 0,
  vp numeric DEFAULT 0,
  salary numeric DEFAULT 0,
  ra numeric DEFAULT 0,
  rm numeric DEFAULT 0,
  rc numeric DEFAULT 0,
  age numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_stats TO anon, authenticated;
GRANT ALL ON public.player_stats TO service_role;

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read player_stats" ON public.player_stats FOR SELECT USING (true);
CREATE POLICY "public write player_stats" ON public.player_stats FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_player_stats_season_comp ON public.player_stats (season_year, comp_type);
CREATE INDEX idx_player_stats_idu ON public.player_stats (idu);
CREATE INDEX idx_player_stats_competition ON public.player_stats (competition);
CREATE INDEX idx_player_stats_club ON public.player_stats (club);

CREATE TABLE public.competition_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year integer NOT NULL,
  comp_type text NOT NULL CHECK (comp_type IN ('superleague','national','continental','international')),
  competition text NOT NULL,
  country text,
  continent text,
  n_players integer DEFAULT 0,
  ca_avg numeric DEFAULT 0,
  cp_avg numeric DEFAULT 0,
  vp_avg numeric DEFAULT 0,
  salary_avg numeric DEFAULT 0,
  ra_avg numeric DEFAULT 0,
  rm_avg numeric DEFAULT 0,
  rc_avg numeric DEFAULT 0,
  age_avg numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_year, comp_type, competition)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_stats TO anon, authenticated;
GRANT ALL ON public.competition_stats TO service_role;

ALTER TABLE public.competition_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read competition_stats" ON public.competition_stats FOR SELECT USING (true);
CREATE POLICY "public write competition_stats" ON public.competition_stats FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_comp_stats_season_comp ON public.competition_stats (season_year, comp_type);
