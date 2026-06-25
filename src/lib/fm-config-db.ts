import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONFIG, rowsToConfig, configToRows, type FmConfig } from "./fm-config";

export interface WeightProfile {
  id: string;
  name: string;
  is_active: boolean;
}

export interface ActiveConfig {
  profiles: WeightProfile[];
  activeId: string;
  config: FmConfig;
}

async function ensureProfile(): Promise<WeightProfile[]> {
  const { data } = await supabase.from("weight_profiles").select("id,name,is_active").order("created_at");
  if (data && data.length) return data as WeightProfile[];
  const ins = await supabase
    .from("weight_profiles")
    .insert({ name: "Padrão", is_active: true })
    .select("id,name,is_active")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return [ins.data as WeightProfile];
}

export async function fetchActiveConfig(): Promise<ActiveConfig> {
  const profiles = await ensureProfile();
  const active = profiles.find((p) => p.is_active) ?? profiles[0];
  const { data: rows } = await supabase
    .from("config_weights")
    .select("category,key,value")
    .eq("profile_id", active.id);
  const config = rows && rows.length ? rowsToConfig(rows as { category: string; key: string; value: number }[]) : DEFAULT_CONFIG;
  return { profiles, activeId: active.id, config };
}

export async function saveConfig(profileId: string, cfg: FmConfig): Promise<void> {
  await supabase.from("config_weights").delete().eq("profile_id", profileId);
  const rows = configToRows(profileId, cfg);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("config_weights").insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
}

export async function createProfile(name: string, cfg: FmConfig): Promise<string> {
  const ins = await supabase.from("weight_profiles").insert({ name, is_active: false }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  await saveConfig(ins.data.id, cfg);
  return ins.data.id;
}

export async function activateProfile(id: string): Promise<void> {
  await supabase.from("weight_profiles").update({ is_active: false }).neq("id", id);
  const { error } = await supabase.from("weight_profiles").update({ is_active: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProfile(id: string): Promise<void> {
  await supabase.from("config_weights").delete().eq("profile_id", id);
  await supabase.from("weight_profiles").delete().eq("id", id);
}