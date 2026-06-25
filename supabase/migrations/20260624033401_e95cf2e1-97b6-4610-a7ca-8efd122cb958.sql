CREATE TABLE public.international_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  competition TEXT NOT NULL,
  team1 TEXT,
  team2 TEXT,
  result TEXT,
  coach1 TEXT,
  coach2 TEXT,
  winner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_international_season ON public.international_results(season_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.international_results TO anon, authenticated;
GRANT ALL ON public.international_results TO service_role;
ALTER TABLE public.international_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_international" ON public.international_results FOR ALL USING (true) WITH CHECK (true);