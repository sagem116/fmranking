import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
};

export type App = {
  id: string;
  name: string;
  description: string | null;
  url: string;
  username: string | null;
  password: string | null;
  icon_url: string | null;
  category_id: string | null;
  is_favorite: boolean;
  position: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchApps(): Promise<App[]> {
  const { data, error } = await supabase
    .from("apps")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as App[];
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function upsertApp(input: Partial<App> & { name: string; url: string }) {
  if (input.id) {
    const { id, ...rest } = input;
    const { error } = await supabase.from("apps").update(rest).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("apps").insert(input);
    if (error) throw error;
  }
}

export async function deleteApp(id: string) {
  const { error } = await supabase.from("apps").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFavorite(id: string, value: boolean) {
  const { error } = await supabase.from("apps").update({ is_favorite: value }).eq("id", id);
  if (error) throw error;
}

export async function touchApp(id: string) {
  const { error } = await supabase
    .from("apps")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reorderApps(ids: string[]) {
  await Promise.all(
    ids.map((id, position) =>
      supabase.from("apps").update({ position }).eq("id", id),
    ),
  );
}

export async function createCategory(name: string, color: string, position: number) {
  const { error } = await supabase.from("categories").insert({ name, color, position });
  if (error) throw error;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}