-- Add new module value for player stats import logging
ALTER TYPE public.module_type ADD VALUE IF NOT EXISTS 'player_stats';

-- Rename existing "Super League N" competition labels to just "N"
UPDATE public.player_stats
SET competition = regexp_replace(competition, '^Super League\s+', '')
WHERE comp_type = 'superleague' AND competition ~ '^Super League\s+';

UPDATE public.competition_stats
SET competition = regexp_replace(competition, '^Super League\s+', '')
WHERE comp_type = 'superleague' AND competition ~ '^Super League\s+';