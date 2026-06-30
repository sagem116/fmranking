
CREATE TABLE public.competition_reputation (
  competition text PRIMARY KEY,
  reputation numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_reputation TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_reputation TO anon;
GRANT ALL ON public.competition_reputation TO service_role;

ALTER TABLE public.competition_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read competition_reputation"
  ON public.competition_reputation FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "public write competition_reputation"
  ON public.competition_reputation FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_competition_reputation_updated_at
  BEFORE UPDATE ON public.competition_reputation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
