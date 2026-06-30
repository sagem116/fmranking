import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  Trophy,
  Shield,
  Users,
  Globe2,
  Crown,
  Settings,
  Star,
  Medal,
  Award,
  TrendingUp,
  Goal,
  Activity,
  Layers,
  Handshake,
  User,
  Bug,
  History as HistoryIcon,
  GitCompareArrows,
  ChevronDown,
  SlidersHorizontal,
  BarChart3,
  Target,
  FunctionSquare,
  Filter as FilterIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ThemeToggle, useThemeInit } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useSidebarPrefs } from "@/lib/sidebar-prefs";
import { SidebarCustomizeDialog } from "./SidebarCustomizeDialog";
import { GlobalSearch } from "./GlobalSearch";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/importar", label: "Importar Época", icon: Upload },
    ],
  },
  {
    title: "Rankings",
    items: [
      { to: "/rankings", label: "Rankings Mundiais", icon: Trophy },
      { to: "/rankings-personalizados", label: "Rankings Personalizados", icon: Trophy },
      { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
      { to: "/insights", label: "Insights", icon: Sparkles },
      { to: "/ranking-historico", label: "Histórico de Rankings", icon: HistoryIcon },
      { to: "/hall-of-fame", label: "Hall of Fame", icon: Crown },
      { to: "/dominio", label: "Domínio", icon: Crown },
      { to: "/national/estatisticas-ligas", label: "Estatísticas Ligas Nacionais", icon: BarChart3 },
      { to: "/super-league/estatisticas-divisoes", label: "Estatísticas Divisões", icon: BarChart3 },
      { to: "/super-league/treinadores-paises", label: "Treinadores por País", icon: Globe2 },
      { to: "/sugestao-pesos", label: "Sugestão de Pesos", icon: SlidersHorizontal },
      { to: "/formulas-personalizadas", label: "Fórmulas Personalizadas", icon: FunctionSquare },
      { to: "/filtros-guardados", label: "Filtros Guardados", icon: FilterIcon },
    ],
  },
  {
    title: "Entidades",
    items: [
      { to: "/clubes", label: "Clubes", icon: Shield },
      { to: "/treinadores", label: "Treinadores", icon: Users },
      { to: "/paises", label: "Países", icon: Globe2 },
    ],
  },
  {
    title: "Super League",
    items: [
      { to: "/super-league/campeoes", label: "Histórico de Campeões", icon: Medal },
      { to: "/super-league/play-off-clubes", label: "Play-Off Clubes", icon: TrendingUp },
      { to: "/super-league/treinador-campeoes", label: "Treinador Campeões", icon: Award },
      { to: "/super-league/play-off-treinadores", label: "Play-Off Treinadores", icon: Goal },
    ],
  },
  {
    title: "Jogadores",
    items: [
      { to: "/super-league/jogadores-clubes", label: "Por Clube", icon: User },
      { to: "/super-league/jogadores-divisoes", label: "Por Divisão", icon: Layers },
      { to: "/national/jogadores-ligas", label: "Por Liga Nacional", icon: Layers },
      { to: "/super-league/golos", label: "Golos", icon: Goal },
      { to: "/super-league/assistencias", label: "Assistências", icon: Handshake },
      { to: "/super-league/performance", label: "Performance", icon: Activity },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { to: "/comparar", label: "Comparar", icon: GitCompareArrows },
      { to: "/conquistas", label: "Conquistas", icon: Crown },
      { to: "/desafios", label: "Desafios", icon: Target },
      { to: "/desafios-dashboard", label: "Dashboard Desafios", icon: BarChart3 },
      { to: "/configuracao", label: "Configuração", icon: Settings },
    ],
  },
];

const DEBUG_ITEMS: NavItem[] = [
  { to: "/debug-treinadores", label: "Treinadores", icon: Bug },
  { to: "/debug-continentais", label: "Continentais", icon: Bug },
  { to: "/debug-pontos", label: "Pontos", icon: Bug },
  { to: "/debug-clubes", label: "Clubes", icon: Bug },
  { to: "/debug-jogadores", label: "Jogadores", icon: Bug },
  { to: "/debug-continentes", label: "Continentes", icon: Bug },
  { to: "/debug-paises", label: "Países", icon: Bug },
  { to: "/debug-reputacao-clubes", label: "Reputação Clubes", icon: Bug },
];

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      key={item.to}
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-gold/10 text-gold border border-gold/30 shadow-[0_0_18px_-6px_oklch(0.82_0.17_88/0.5)]"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-gold")} />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useThemeInit();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [debugOpen, setDebugOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [prefs, setPrefs] = useSidebarPrefs();

  // Apply prefs -> orderedGroups
  const orderedGroups = useMemo(() => {
    const ord =
      prefs.groupOrder && prefs.groupOrder.length
        ? [
            ...prefs.groupOrder.filter((t) => NAV_GROUPS.some((g) => g.title === t)),
            ...NAV_GROUPS.map((g) => g.title).filter((t) => !prefs.groupOrder!.includes(t)),
          ]
        : NAV_GROUPS.map((g) => g.title);
    return ord
      .map((title) => {
        const g = NAV_GROUPS.find((x) => x.title === title)!;
        const gp = prefs.groups[title] || {};
        if (gp.hidden) return null;
        const hidden = new Set(gp.hiddenItems ?? []);
        const order = gp.order ?? [];
        const byTo = new Map(g.items.map((i) => [i.to, i]));
        const items: NavItem[] = [];
        for (const to of order) {
          const it = byTo.get(to);
          if (it && !hidden.has(it.to)) items.push(it);
        }
        for (const it of g.items) {
          if (!order.includes(it.to) && !hidden.has(it.to)) items.push(it);
        }
        if (!items.length) return null;
        return { title, items, collapsed: !!gp.collapsed };
      })
      .filter((x): x is { title: string; items: NavItem[]; collapsed: boolean } => !!x);
  }, [prefs]);

  const orderedDebug = useMemo(() => {
    if (prefs.debugHidden) return [];
    const hidden = new Set(prefs.debugItemsHidden ?? []);
    const order = prefs.debugItemsOrder ?? [];
    const byTo = new Map(DEBUG_ITEMS.map((i) => [i.to, i]));
    const items: NavItem[] = [];
    for (const to of order) {
      const it = byTo.get(to);
      if (it && !hidden.has(it.to)) items.push(it);
    }
    for (const it of DEBUG_ITEMS) {
      if (!order.includes(it.to) && !hidden.has(it.to)) items.push(it);
    }
    return items;
  }, [prefs]);

  const toggleGroupCollapsed = (title: string) => {
    const g = prefs.groups[title] || {};
    setPrefs({
      ...prefs,
      groups: { ...prefs.groups, [title]: { ...g, collapsed: !g.collapsed } },
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
          <Star className="size-6 text-gold gold-glow" />
          <div className="leading-tight flex-1 min-w-0">
            <p className="font-display text-sm font-bold gold-shimmer">FM World</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Rankings</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            title="Personalizar sidebar"
            onClick={() => setCustomizeOpen(true)}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {orderedGroups.map((group) => (
            <div key={group.title}>
              <button
                onClick={() => toggleGroupCollapsed(group.title)}
                className="flex w-full items-center justify-between px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              >
                <span>{group.title}</span>
                <ChevronDown className={cn("size-3 transition-transform", group.collapsed && "-rotate-90")} />
              </button>
              {!group.collapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                    return <SidebarLink key={item.to} item={item} active={active} />;
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Debug — colapsável */}
          {orderedDebug.length > 0 && (
            <div>
              <button
                onClick={() => setDebugOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              >
                <span>Debug</span>
                <ChevronDown className={cn("size-3 transition-transform", debugOpen && "rotate-180")} />
              </button>
              {debugOpen && (
                <div className="space-y-0.5">
                  {orderedDebug.map((item) => {
                    const active = pathname.startsWith(item.to);
                    return <SidebarLink key={item.to} item={item} active={active} />;
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="px-4 py-3 text-[11px] text-muted-foreground border-t border-sidebar-border">
          Base de dados histórica de Football Manager
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 md:px-6 backdrop-blur">
          <div className="md:hidden flex items-center gap-2">
            <Star className="size-5 text-primary" />
            <span className="font-bold text-sm">FM World</span>
          </div>
          <GlobalSearch />
          <nav className="md:hidden flex items-center gap-1 overflow-x-auto">
            {[...orderedGroups.flatMap((g) => g.items), ...orderedDebug].map((item) => (
              <Link key={item.to} to={item.to} className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground whitespace-nowrap">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden size-8"
              title="Personalizar sidebar"
              onClick={() => setCustomizeOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <Toaster richColors position="top-right" />

      <SidebarCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        groups={NAV_GROUPS.map((g) => ({ title: g.title, items: g.items.map((i) => ({ to: i.to, label: i.label })) }))}
        debugItems={DEBUG_ITEMS.map((i) => ({ to: i.to, label: i.label }))}
        prefs={prefs}
        onChange={setPrefs}
      />
    </div>
    </TooltipProvider>
  );
}
