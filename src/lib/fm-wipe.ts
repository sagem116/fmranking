import { supabase } from "@/integrations/supabase/client";

/** Deletes ALL imported FM data. Keeps weight_profiles (config). */
export async function wipeAllData(): Promise<void> {
  const NEVER_MATCH = "00000000-0000-0000-0000-000000000000";
  // Order matters for FKs: leaves first
  const tables = [
    "players",
    "coach_assignments",
    "continental_results",
    "standings",
    "imports",
    "coaches",
    "clubs",
    "countries",
    "seasons",
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(t).delete().neq("id", NEVER_MATCH);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}
