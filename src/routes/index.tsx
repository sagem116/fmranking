import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { LayoutGrid, Layers, List, Moon, Plus, Search, Star, Sun, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppCard } from "@/components/AppCard";
import { AppDialog } from "@/components/AppDialog";
import { CategoryDialog } from "@/components/CategoryDialog";
import { useTheme } from "@/components/theme-provider";
import { fetchApps, fetchCategories, reorderApps, type App } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "App Hub — A sua biblioteca de aplicações" },
      { name: "description", content: "Homepage central com acesso rápido a todas as suas aplicações, credenciais e favoritos." },
      { property: "og:title", content: "App Hub" },
      { property: "og:description", content: "Homepage central com acesso rápido a todas as suas aplicações." },
    ],
  }),
  component: Index,
});

function Index() {
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const { data: apps = [] } = useQuery({ queryKey: ["apps"], queryFn: fetchApps });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [editing, setEditing] = useState<App | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialog, setCatDialog] = useState(false);
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("app-hub-view") as "grid" | "list") || "grid";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("app-hub-view", view);
  }, [view]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return apps.filter((a) => {
      if (onlyFav && !a.is_favorite) return false;
      if (activeCat === "favorites" && !a.is_favorite) return false;
      if (activeCat !== "all" && activeCat !== "favorites" && a.category_id !== activeCat) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        (a.username ?? "").toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q)
      );
    });
  }, [apps, query, onlyFav, activeCat]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorderMut = useMutation({
    mutationFn: reorderApps,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apps"] }),
  });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = filtered.map((a) => a.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(filtered, oldIdx, newIdx);
    // Merge into full apps list to preserve positions of hidden items
    const fullIds = apps.map((a) => a.id);
    const filteredIdSet = new Set(filtered.map((a) => a.id));
    let cursor = 0;
    const finalIds = fullIds.map((id) => (filteredIdSet.has(id) ? newOrder[cursor++].id : id));
    qc.setQueryData<App[]>(["apps"], (prev) =>
      prev ? finalIds.map((id) => prev.find((a) => a.id === id)!).filter(Boolean) : prev,
    );
    reorderMut.mutate(finalIds);
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a: App) => { setEditing(a); setDialogOpen(true); };

  const tabs = [
    { id: "all", label: "Todas", icon: Layers, count: apps.length },
    { id: "favorites", label: "Favoritos", icon: Star, count: apps.filter((a) => a.is_favorite).length },
    ...categories.map((c) => ({ id: c.id, label: c.name, icon: null as never, count: apps.filter((a) => a.category_id === c.id).length, color: c.color })),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[color:var(--glass-border)] bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-neon)] shadow-[var(--glow-purple)]">
              <Layers className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">App <span className="neon-text">Hub</span></h1>
              <p className="text-[11px] text-muted-foreground">A sua biblioteca pessoal</p>
            </div>
          </div>

          <div className="relative ml-auto max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar aplicações…"
              className="h-10 border-[color:var(--glass-border)] bg-background/50 pl-9"
            />
          </div>

          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Mudar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label="Mudar vista"
            title={view === "grid" ? "Vista em lista" : "Vista em grelha"}
          >
            {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
          <Button variant="glass" size="sm" onClick={() => setCatDialog(true)}>
            <Tag className="mr-1.5 h-4 w-4" /> Categorias
          </Button>
          <Button variant="neon" size="sm" onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova App
          </Button>
        </div>

        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:px-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveCat(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                activeCat === t.id
                  ? "border-[color:var(--neon-purple)] bg-[color:var(--neon-purple)]/15 text-foreground shadow-[var(--glow-purple)]"
                  : "border-[color:var(--glass-border)] text-muted-foreground hover:text-foreground",
              )}
              style={
                "color" in t && t.color && activeCat === t.id
                  ? { borderColor: t.color, backgroundColor: `color-mix(in oklab, ${t.color} 18%, transparent)`, boxShadow: `0 0 30px color-mix(in oklab, ${t.color} 40%, transparent)` }
                  : undefined
              }
            >
              {t.icon ? <t.icon className="h-3.5 w-3.5" /> : (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: (t as { color?: string }).color }} />
              )}
              {t.label}
              <span className="rounded-full bg-foreground/10 px-1.5 text-[10px]">{t.count}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {filtered.length === 0 ? (
          <EmptyState onAdd={openNew} hasApps={apps.length > 0} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((a) => a.id)} strategy={rectSortingStrategy}>
              <div
                className={cn(
                  "gap-4",
                  view === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "flex flex-col",
                )}
              >
                {filtered.map((a) => (
                  <AppCard
                    key={a.id}
                    app={a}
                    category={a.category_id ? catMap.get(a.category_id) : undefined}
                    variant={view}
                    onEdit={() => openEdit(a)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      <AppDialog open={dialogOpen} onOpenChange={setDialogOpen} app={editing} categories={categories} />
      <CategoryDialog open={catDialog} onOpenChange={setCatDialog} categories={categories} />
    </div>
  );
}

function EmptyState({ onAdd, hasApps }: { onAdd: () => void; hasApps: boolean }) {
  return (
    <div className="glass-panel mx-auto mt-12 max-w-lg rounded-3xl p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[image:var(--gradient-neon)] shadow-[var(--glow-purple)]">
        <Layers className="h-8 w-8 text-primary-foreground" />
      </div>
      <h2 className="text-xl font-semibold">
        {hasApps ? "Nenhuma aplicação encontrada" : "A sua biblioteca está vazia"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasApps ? "Tente ajustar os filtros ou a pesquisa." : "Adicione a sua primeira aplicação para começar."}
      </p>
      {!hasApps && (
        <Button variant="neon" className="mt-6" onClick={onAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar primeira app
        </Button>
      )}
    </div>
  );
}
