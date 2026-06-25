import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Shield, User, Users, Globe2, Trophy, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRankings } from "@/lib/useRankings";

type Kind = "clube" | "treinador" | "jogador" | "pais" | "competicao";

interface Item {
  kind: Kind;
  label: string;
  sub?: string;
  to: string;
  params: Record<string, string>;
  score?: number;
}

const KIND_META: Record<Kind, { label: string; icon: typeof Shield; color: string }> = {
  clube: { label: "Clube", icon: Shield, color: "text-blue-400" },
  treinador: { label: "Treinador", icon: Users, color: "text-emerald-400" },
  jogador: { label: "Jogador", icon: User, color: "text-violet-400" },
  pais: { label: "País", icon: Globe2, color: "text-amber-400" },
  competicao: { label: "Competição", icon: Trophy, color: "text-gold" },
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { data, isLoading } = useRankings();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo<Item[]>(() => {
    if (!data) return [];
    const out: Item[] = [];
    const seen = new Set<string>();
    const push = (it: Item) => {
      const k = `${it.kind}|${it.label}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(it);
    };

    // Clubes (de standings/continental/clubCountry)
    Object.keys(data.data.clubCountry).forEach((name) => {
      if (!name) return;
      push({
        kind: "clube",
        label: name,
        sub: data.data.clubCountry[name] ?? undefined,
        to: "/clubes/$name",
        params: { name },
      });
    });

    // Treinadores
    const coachNat = new Map<string, string | null>();
    data.data.coaches.forEach((c) => {
      if (!c.name) return;
      if (!coachNat.has(c.name)) coachNat.set(c.name, c.nationality ?? null);
    });
    coachNat.forEach((nat, name) => {
      push({ kind: "treinador", label: name, sub: nat ?? undefined, to: "/treinadores/$name", params: { name } });
    });

    // Países (de clubCountry e internacional)
    const countries = new Set<string>();
    Object.values(data.data.clubCountry).forEach((c) => c && countries.add(c));
    (data.data.international ?? []).forEach((i) => {
      [i.team1, i.team2, i.winner, i.sf1, i.sf2, i.qf1, i.qf2, i.qf3, i.qf4].forEach((c) => c && countries.add(c));
    });
    countries.forEach((name) =>
      push({ kind: "pais", label: name, to: "/paises/$name", params: { name } }),
    );

    // Jogadores
    const players = new Map<string, string | null>();
    data.data.players.forEach((p) => {
      if (!p.name) return;
      if (!players.has(p.name)) players.set(p.name, p.club_name ?? null);
    });
    players.forEach((club, name) => {
      push({ kind: "jogador", label: name, sub: club ?? undefined, to: "/jogadores/$name", params: { name } });
    });

    // Competições — continental + internacional + ligas
    const compCont = new Set<string>();
    data.data.continental.forEach((c) => c.competition && compCont.add(c.competition));
    compCont.forEach((c) =>
      push({ kind: "competicao", label: c, sub: "Continental", to: "/competicoes/$name", params: { name: c } }),
    );
    const compIntl = new Set<string>();
    (data.data.international ?? []).forEach((c) => c.competition && compIntl.add(c.competition));
    compIntl.forEach((c) =>
      push({ kind: "competicao", label: c, sub: "Internacional", to: "/competicoes/$name", params: { name: c } }),
    );
    // Super League divisions
    const slDivs = new Set<string>();
    data.data.standings.forEach((s) => {
      if (s.module === "superleague") {
        const lab = s.division_label ?? (s.division_num != null ? `Div. ${s.division_num}` : null);
        if (lab) slDivs.add(lab);
      }
    });
    slDivs.forEach((c) =>
      push({ kind: "competicao", label: c, sub: "Super League", to: "/competicoes/$name", params: { name: c } }),
    );
    // National leagues
    const natLeagues = new Set<string>();
    data.data.standings.forEach((s) => {
      if (s.module === "national" && s.division_label) natLeagues.add(s.division_label);
    });
    natLeagues.forEach((c) =>
      push({ kind: "competicao", label: c, sub: "Liga Nacional", to: "/competicoes/$name", params: { name: c } }),
    );

    return out;
  }, [data]);

  const results = useMemo<Item[]>(() => {
    const term = norm(q.trim());
    if (!term) return [];
    const scored: Item[] = [];
    for (const it of allItems) {
      const n = norm(it.label);
      if (!n.includes(term)) continue;
      let score = 0;
      if (n === term) score = 1000;
      else if (n.startsWith(term)) score = 500;
      else score = 100 - Math.min(99, n.indexOf(term));
      scored.push({ ...it, score });
    }
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.label.localeCompare(b.label));
    return scored.slice(0, 30);
  }, [q, allItems]);

  useEffect(() => setActiveIdx(0), [q]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = containerRef.current?.querySelector("input");
        (input as HTMLInputElement | null)?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (it: Item) => {
    setOpen(false);
    setQ("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: it.to as any, params: it.params as any });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (results[activeIdx]) {
        e.preventDefault();
        go(results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Pesquisar clubes, treinadores, jogadores, países, competições…"
          className="pl-8 pr-12 h-9"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>
      {open && (q.trim() || isLoading) && (
        <div className="absolute z-50 mt-1 w-full md:w-[28rem] max-h-[60vh] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> A carregar dados…
            </div>
          )}
          {!isLoading && q.trim() && results.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">Sem resultados para “{q}”.</div>
          )}
          {!isLoading && results.length > 0 && (
            <ul className="py-1">
              {results.map((it, idx) => {
                const meta = KIND_META[it.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${it.kind}-${it.label}-${idx}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => go(it)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                        idx === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", meta.color)} />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{it.label}</span>
                        {it.sub && <span className="text-muted-foreground"> · {it.sub}</span>}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
