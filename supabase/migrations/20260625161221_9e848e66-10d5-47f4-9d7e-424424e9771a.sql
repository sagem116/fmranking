
CREATE TYPE public.module_type AS ENUM ('superleague', 'national', 'continental');

CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module module_type NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nationality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, nationality)
);

CREATE TABLE public.standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module module_type NOT NULL,
  division_label TEXT,
  division_num INTEGER,
  position INTEGER,
  info TEXT,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  club_name TEXT NOT NULL,
  played INTEGER, wins INTEGER, draws INTEGER, losses INTEGER,
  gf INTEGER, ga INTEGER, gd INTEGER, points INTEGER,
  is_champion BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_standings_season ON public.standings(season_id);
CREATE INDEX idx_standings_club ON public.standings(club_id);
CREATE INDEX idx_standings_module ON public.standings(module);

CREATE TABLE public.continental_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  competition TEXT NOT NULL,
  team1 TEXT, team2 TEXT, result TEXT,
  club1_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  club2_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  winner_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  sf1 text, sf2 text, qf1 text, qf2 text, qf3 text, qf4 text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_continental_season ON public.continental_results(season_id);

CREATE TABLE public.coach_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module module_type NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  coach_name TEXT NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  club_name TEXT, info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coach_assign_season ON public.coach_assignments(season_id);
CREATE INDEX idx_coach_assign_coach ON public.coach_assignments(coach_id);

CREATE TABLE public.weight_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.config_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.weight_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, category, key)
);
CREATE INDEX idx_config_profile ON public.config_weights(profile_id);

CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module text NOT NULL DEFAULT 'superleague',
  idu text, name text NOT NULL, league text, club_name text, club_id uuid,
  age integer,
  gls numeric NOT NULL DEFAULT 0, ast numeric NOT NULL DEFAULT 0,
  salary numeric NOT NULL DEFAULT 0,
  ra numeric NOT NULL DEFAULT 0, rm numeric NOT NULL DEFAULT 0,
  ca numeric NOT NULL DEFAULT 0, cp numeric NOT NULL DEFAULT 0, vp numeric NOT NULL DEFAULT 0,
  info text, rec text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_season ON public.players(season_id);
CREATE INDEX idx_players_club ON public.players(club_name);

CREATE TABLE public.international_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  competition TEXT NOT NULL,
  team1 TEXT, team2 TEXT, result TEXT,
  coach1 TEXT, coach2 TEXT, winner TEXT,
  sf1 text, sf1_coach text, sf2 text, sf2_coach text,
  qf1 text, qf1_coach text, qf2 text, qf2_coach text,
  qf3 text, qf3_coach text, qf4 text, qf4_coach text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_international_season ON public.international_results(season_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.seasons, public.imports, public.countries, public.clubs, public.coaches,
  public.standings, public.continental_results, public.coach_assignments,
  public.weight_profiles, public.config_weights, public.players, public.international_results
  TO anon, authenticated;
GRANT ALL ON
  public.seasons, public.imports, public.countries, public.clubs, public.coaches,
  public.standings, public.continental_results, public.coach_assignments,
  public.weight_profiles, public.config_weights, public.players, public.international_results
  TO service_role;

-- RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continental_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.international_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_seasons" ON public.seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_imports" ON public.imports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_countries" ON public.countries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_clubs" ON public.clubs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_coaches" ON public.coaches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_standings" ON public.standings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_continental" ON public.continental_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_coach_assign" ON public.coach_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_weight_profiles" ON public.weight_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_config_weights" ON public.config_weights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_players" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_international" ON public.international_results FOR ALL USING (true) WITH CHECK (true);
