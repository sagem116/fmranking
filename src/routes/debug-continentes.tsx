import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useSyncExternalStore } from "react";
import { Bug, Search, Save, RotateCcw, Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRankings } from "@/lib/useRankings";
import {
  CONTINENTS,
  builtInContinentOf,
  continentOf,
  normalizeCountry,
} from "@/lib/fm-continents";
import {
  getContinentOverrides,
  removeContinentOverride,
  setContinentOverride,
  onOverridesChanged,
} from "@/lib/fm-country-overrides";

export const Route = createFileRoute("/debug-continentes")({
  head: () => ({
    meta: [
      { title: "Debug · Continentes — FM World Rankings" },
      {
        name: "description",
        content:
          "Validação do mapeamento país → continente e edição de overrides.",
      },
    ],
  }),
  component: DebugContinentesPage,
});

function useOverrides() {
  return useSyncExternalStore(
    (cb) => onOverridesChanged(cb),
    () => JSON.stringify(getContinentOverrides()),
    () => "{}",
  );
}

function DebugContinentesPage() {
  const { data, isLoading } = useRankings();
  useOverrides(); // re-render on override changes
  const overrides = getContinentOverrides();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "overridden">(
    "missing",
  );

  // Build set of known countries from data
  const countries = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    for (const c of Object.values(data.data.clubCountry)) if (c) set.add(c);
    for (const r of data.data.international ?? []) {
      if (r.team1) set.add(r.team1);
      if (r.team2) set.add(r.team2);
    }
    // Also include any countries referenced in overrides
    for (const k of Object.keys(overrides)) set.add(k);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data, overrides]);

  const rows = useMemo(() => {
    return countries
      .map((country) => {
        const norm = normalizeCountry(country);
        const builtin = builtInContinentOf(country);
        const resolved = continentOf(country);
        const overrideKey =
          overrides[country.trim().toLowerCase()] !== undefined
            ? country.trim().toLowerCase()
            : overrides[String(norm).trim().toLowerCase()] !== undefined
              ? String(norm).trim().toLowerCase()
              : null;
        const overridden = overrideKey !== null;
        return { country, normalized: norm, builtin, resolved, overridden, overrideKey };
      })
      .filter((r) => {
        if (filter === "missing" && r.resolved) return false;
        if (filter === "overridden" && !r.overridden) return false;
        if (q.trim()) {
          const s = q.toLowerCase();
          return r.country.toLowerCase().includes(s) ||
            String(r.normalized).toLowerCase().includes(s);
        }
        return true;
      });
  }, [countries, q, filter, overrides]);

  const stats = useMemo(() => {
    const total = countries.length;
    const missing = countries.filter((c) => !continentOf(c)).length;
    const overridden = Object.keys(overrides).length;
    return { total, missing, overridden };
  }, [countries, overrides]);

  if (isLoading) return <p className="text-muted-foreground">A carregar…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
          <Bug className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debug · Continentes</h1>
          <p className="text-sm text-muted-foreground">
            Mapeamento país → continente e edição de overrides.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Países conhecidos</p>
            <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Sem continente</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{stats.missing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Com override</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{stats.overridden}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar país…"
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            {(["missing", "all", "overridden"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === "missing" ? "Sem continente" : f === "overridden" ? "Overrides" : "Todos"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">País</th>
                <th className="text-left p-3">Normalizado</th>
                <th className="text-left p-3">Built-in</th>
                <th className="text-left p-3">Resolvido</th>
                <th className="text-left p-3">Atribuir / alterar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.country} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-medium">
                    <Link
                      to="/paises/$name"
                      params={{ name: r.country }}
                      className="hover:text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Globe2 className="size-3.5 text-muted-foreground" />
                      {r.country}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.normalized}</td>
                  <td className="p-3">
                    {r.builtin ? (
                      <Badge variant="outline">{r.builtin}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.resolved ? (
                      r.overridden ? (
                        <Badge className="bg-primary/15 text-primary border border-primary/30">
                          {r.resolved} (override)
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{r.resolved}</Badge>
                      )
                    ) : (
                      <Badge variant="destructive">Sem continente</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={r.resolved ?? ""}
                        onValueChange={(v) => setContinentOverride(r.country, v)}
                      >
                        <SelectTrigger className="h-8 w-[160px]">
                          <SelectValue placeholder="Continente…" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTINENTS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {r.overridden && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => r.overrideKey && removeContinentOverride(r.overrideKey)}
                          title="Remover override (usar built-in)"
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Sem resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}