
-- Extend player_stats with the new per-player metrics
ALTER TABLE public.player_stats
  ADD COLUMN IF NOT EXISTS xg              double precision,
  ADD COLUMN IF NOT EXISTS pass_pct        double precision,
  ADD COLUMN IF NOT EXISTS tackles_per90   double precision,
  ADD COLUMN IF NOT EXISTS fouls_per90     double precision,
  ADD COLUMN IF NOT EXISTS shot_pct        double precision,
  ADD COLUMN IF NOT EXISTS yellows         integer,
  ADD COLUMN IF NOT EXISTS reds            integer,
  ADD COLUMN IF NOT EXISTS avg_rating      double precision;

-- Extend competition_stats with averages of the new metrics
ALTER TABLE public.competition_stats
  ADD COLUMN IF NOT EXISTS xg_avg              double precision,
  ADD COLUMN IF NOT EXISTS pass_pct_avg        double precision,
  ADD COLUMN IF NOT EXISTS tackles_per90_avg   double precision,
  ADD COLUMN IF NOT EXISTS fouls_per90_avg     double precision,
  ADD COLUMN IF NOT EXISTS shot_pct_avg        double precision,
  ADD COLUMN IF NOT EXISTS yellows_avg         double precision,
  ADD COLUMN IF NOT EXISTS reds_avg            double precision,
  ADD COLUMN IF NOT EXISTS avg_rating_avg      double precision;

-- New "Competição" column on standings (from Super League / Ligas Nacionais)
ALTER TABLE public.standings
  ADD COLUMN IF NOT EXISTS competition text;

-- Clubs: continent (from Clube Pais). Country_id already exists.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS continent text;

-- Coaches: full attribute set. All nullable to remain backwards-compatible.
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS idu                 text,
  ADD COLUMN IF NOT EXISTS age                 integer,
  ADD COLUMN IF NOT EXISTS tactical_style      text,
  ADD COLUMN IF NOT EXISTS play_style          text,
  ADD COLUMN IF NOT EXISTS attacking_formation text,
  ADD COLUMN IF NOT EXISTS defensive_formation text,
  ADD COLUMN IF NOT EXISTS preferred_formation text,
  ADD COLUMN IF NOT EXISTS secondary_formation text,
  ADD COLUMN IF NOT EXISTS mentality           text,
  ADD COLUMN IF NOT EXISTS marking_type        text,
  ADD COLUMN IF NOT EXISTS pressing_type       text,
  ADD COLUMN IF NOT EXISTS training_type       text,
  ADD COLUMN IF NOT EXISTS personality         text,
  ADD COLUMN IF NOT EXISTS press_relationship  text,
  ADD COLUMN IF NOT EXISTS rm                  double precision,
  ADD COLUMN IF NOT EXISTS rc                  double precision,
  ADD COLUMN IF NOT EXISTS ca                  double precision,
  ADD COLUMN IF NOT EXISTS cp                  double precision,
  ADD COLUMN IF NOT EXISTS is_national_team    boolean,
  ADD COLUMN IF NOT EXISTS national_team       text;

-- Coach assignments: role and salary per season
ALTER TABLE public.coach_assignments
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS club_role    text,
  ADD COLUMN IF NOT EXISTS intl_role    text,
  ADD COLUMN IF NOT EXISTS salary       double precision,
  ADD COLUMN IF NOT EXISTS intl_salary  double precision,
  ADD COLUMN IF NOT EXISTS rm           double precision,
  ADD COLUMN IF NOT EXISTS rc           double precision,
  ADD COLUMN IF NOT EXISTS ca           double precision,
  ADD COLUMN IF NOT EXISTS cp           double precision;

-- Competition reputation: track per season (backwards-compatible: existing rows have season_year null = "global default")
ALTER TABLE public.competition_reputation
  ADD COLUMN IF NOT EXISTS season_year integer;

-- Allow multiple rows per (competition, season_year). The old PK is `competition`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_reputation_pkey') THEN
    ALTER TABLE public.competition_reputation DROP CONSTRAINT competition_reputation_pkey;
  END IF;
END $$;
ALTER TABLE public.competition_reputation
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
UPDATE public.competition_reputation SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.competition_reputation ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS competition_reputation_comp_season_uniq
  ON public.competition_reputation (competition, COALESCE(season_year, -1));

-- New table: per-season reputation / attendance / season-ticket-holders per club
CREATE TABLE IF NOT EXISTS public.club_reputation_season (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id                uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  season_year              integer NOT NULL,
  club_name                text NOT NULL,
  club_id                  uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  reputation               double precision,
  avg_attendance           double precision,
  season_ticket_holders    double precision,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_year, club_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_reputation_season TO authenticated;
GRANT SELECT ON public.club_reputation_season TO anon;
GRANT ALL ON public.club_reputation_season TO service_role;
ALTER TABLE public.club_reputation_season ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_reputation_season readable to everyone"
  ON public.club_reputation_season FOR SELECT USING (true);
CREATE POLICY "club_reputation_season writable to authenticated"
  ON public.club_reputation_season FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS club_reputation_season_year_idx ON public.club_reputation_season (season_year);
CREATE INDEX IF NOT EXISTS club_reputation_season_club_idx ON public.club_reputation_season (club_name);

CREATE TRIGGER trg_club_reputation_season_updated_at
  BEFORE UPDATE ON public.club_reputation_season
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend module_type enum for the new competitions import kind
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'module_type' AND e.enumlabel = 'competitions'
  ) THEN
    ALTER TYPE public.module_type ADD VALUE 'competitions';
  END IF;
END $$;
