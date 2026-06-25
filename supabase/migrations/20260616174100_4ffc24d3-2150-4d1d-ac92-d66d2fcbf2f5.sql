CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  module text NOT NULL DEFAULT 'superleague',
  idu text,
  name text NOT NULL,
  league text,
  club_name text,
  club_id uuid,
  age integer,
  gls numeric NOT NULL DEFAULT 0,
  ast numeric NOT NULL DEFAULT 0,
  salary numeric NOT NULL DEFAULT 0,
  ra numeric NOT NULL DEFAULT 0,
  rm numeric NOT NULL DEFAULT 0,
  ca numeric NOT NULL DEFAULT 0,
  cp numeric NOT NULL DEFAULT 0,
  vp numeric NOT NULL DEFAULT 0,
  info text,
  rec text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_all_players ON public.players FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_players_season ON public.players(season_id);
CREATE INDEX idx_players_club ON public.players(club_name);