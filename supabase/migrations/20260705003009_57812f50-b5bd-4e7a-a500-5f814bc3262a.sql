
ALTER TABLE public.competition_reputation
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS continent text;
