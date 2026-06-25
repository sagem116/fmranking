
-- ENUM helper for modules
CREATE TYPE public.module_type AS ENUM ('superleague', 'national', 'continental');

-- Seasons
CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imports log
CREATE TABLE public.imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module module_type NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Countries
CREATE TABLE public.countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clubs
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coaches
CREATE TABLE public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nationality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, nationality)
);

-- Standings (league tables: superleague + national)
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
  played INTEGER,
  wins INTEGER,
  draws INTEGER,
  losses INTEGER,
  gf INTEGER,
  ga INTEGER,
  gd INTEGER,
  points INTEGER,
  is_champion BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_standings_season ON public.standings(season_id);
CREATE INDEX idx_standings_club ON public.standings(club_id);
CREATE INDEX idx_standings_module ON public.standings(module);

-- Continental results
CREATE TABLE public.continental_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  competition TEXT NOT NULL,
  team1 TEXT,
  team2 TEXT,
  result TEXT,
  club1_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  club2_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  winner_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_continental_season ON public.continental_results(season_id);

-- Coach assignments per season/module
CREATE TABLE public.coach_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module module_type NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  coach_name TEXT NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  club_name TEXT,
  info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coach_assign_season ON public.coach_assignments(season_id);
CREATE INDEX idx_coach_assign_coach ON public.coach_assignments(coach_id);

-- Weight profiles
CREATE TABLE public.weight_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Config weights (generic: competition / division / title / position / decay / world_formula)
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

-- GRANTS (public personal tool: anon + authenticated full access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.countries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.continental_results TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_assignments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_weights TO anon, authenticated;
GRANT ALL ON public.seasons, public.imports, public.countries, public.clubs, public.coaches, public.standings, public.continental_results, public.coach_assignments, public.weight_profiles, public.config_weights TO service_role;

-- RLS: enable + permissive policies (personal, no-auth tool)
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
