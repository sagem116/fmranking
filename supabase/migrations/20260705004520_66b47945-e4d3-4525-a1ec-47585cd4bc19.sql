DROP POLICY IF EXISTS "club_reputation_season writable to authenticated" ON public.club_reputation_season;
DROP POLICY IF EXISTS "club_reputation_season readable to everyone" ON public.club_reputation_season;
CREATE POLICY "public read club_reputation_season" ON public.club_reputation_season FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public write club_reputation_season" ON public.club_reputation_season FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_reputation_season TO anon, authenticated;
GRANT ALL ON public.club_reputation_season TO service_role;