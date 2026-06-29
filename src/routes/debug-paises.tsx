import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Bug, Search, RotateCcw, Plus, Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import {
  listBuiltInAliases,
  normalizeCountry,
} from "@/lib/fm-continents";
import {
  getAliasOverrides,
  removeAliasOverride,
  setAliasOverride,
  onOverridesChanged,
} from "@/lib/fm-country-overrides";

export const Route = createFileRoute("/debug-paises")({
  head: () => ({
    meta: [
      { title: "Debug · Países (abreviaturas) — FM World Rankings" },
      {
        name: "description",
        content: "Mapeamento entre abreviaturas de 3 letras e nomes completos.",
      },
    ],
  }),
  component: DebugPaisesPage,
});

function useOverrides() {
  return useSyncExternalStore(
    (cb) => onOverridesChanged(cb),
    () => JSON.stringify(getAliasOverrides()),
    () => "{}",
  );
}

function DebugPaisesPage() {
  const { data, isLoading } = useRankings();
  useOverrides();
  const overrides = getAliasOverrides();
  const [q, setQ] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [newCanonical, setNewCanonical] = useState("");

  // Collect all alias keys: built-in + overrides + any data tokens
  const rows = useMemo(() => {
    const builtIn = listBuiltInAliases();
    const map = new Map<
      string,
      { alias: string; canonical: string; source: "built-in" | "override" }
    >();
    for (const b of builtIn) {
      map.set(b.alias, { alias: b.alias, canonical: b.canonical, source: "built-in" });
    }
    for (const [alias, canonical] of Object.entries(overrides)) {
      map.set(alias, { alias, canonical, source: "override" });
    }
    return [...map.values()].sort((a, b) => a.alias.localeCompare(b.alias));
  }, [overrides]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) => r.alias.toLowerCase().includes(s) || r.canonical.toLowerCase().includes(s),
    );
  }, [rows, q]);

  // Names referenced in data — useful for spotting unmapped abbreviations
  const unmapped = useMemo(() => {
    if (!data) return [] as string[];
    const knownCanon = new Set(rows.map((r) => r.canonical.toLowerCase()));
    const aliasSet = new Set(rows.map((r) => r.alias));
    const set = new Set<string>();
    for (const c of Object.values(data.data.clubCountry)) if (c) set.add(c);
    for (const r of data.data.international ?? []) {
      if (r.team1) set.add(r.team1);
      if (r.team2) set.add(r.team2);
    }
    return [...set]
      .filter((name) => {
        const lower = name.trim().toLowerCase();
        // suspicious: looks like a 3-letter abbreviation but not aliased,
        // or doesn't normalize to anything in the canonical set
        const looksLikeAbbr = /^[A-Z]{3}$/.test(name.trim());
        if (looksLikeAbbr && !aliasSet.has(lower)) return true;
        const norm = String(normalizeCountry(name)).toLowerCase();
        if (norm === lower && !knownCanon.has(lower)) {
          // not in alias map and not the canonical of any
          return false;
        }
        return false;
      })
      .sort();
  }, [data, rows]);

  if (isLoading) return <p className="text-muted-foreground">A carregar…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
          <Bug className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debug · Países (abreviaturas)</h1>
          <p className="text-sm text-muted-foreground">
            Como as abreviaturas de 3 letras estão mapeadas para nomes completos.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar / alterar mapeamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Alias (ex. POR, NED)</label>
            <Input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="POR"
              className="w-32"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome canónico</label>
            <Input
              value={newCanonical}
              onChange={(e) => setNewCanonical(e.target.value)}
              placeholder="Portugal"
              className="w-64"
            />
          </div>
          <Button
            size="sm"
            disabled={!newAlias.trim() || !newCanonical.trim()}
            onClick={() => {
              setAliasOverride(newAlias.trim(), newCanonical.trim());
              setNewAlias("");
              setNewCanonical("");
            }}
          >
            <Plus className="size-4 mr-1" /> Guardar
          </Button>
        </CardContent>
      </Card>

      {unmapped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Abreviaturas detetadas sem mapeamento ({unmapped.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unmapped.map((u) => (
              <Badge
                key={u}
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setNewAlias(u)}
              >
                {u}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Mapeamentos atuais ({rows.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar…"
              className="pl-8 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">Alias</th>
                <th className="text-left p-3">Nome canónico</th>
                <th className="text-left p-3">Origem</th>
                <th className="text-left p-3">Editar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.alias} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-mono uppercase">{r.alias}</td>
                  <td className="p-3 font-medium">
                    <Link
                      to="/paises/$name"
                      params={{ name: r.canonical }}
                      className="hover:text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Globe2 className="size-3.5 text-muted-foreground" />
                      {r.canonical}
                    </Link>
                  </td>
                  <td className="p-3">
                    {r.source === "override" ? (
                      <Badge className="bg-primary/15 text-primary border border-primary/30">
                        Override
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Built-in</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        defaultValue={r.canonical}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.canonical) setAliasOverride(r.alias, v);
                        }}
                        className="h-8 w-56"
                      />
                      {r.source === "override" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAliasOverride(r.alias)}
                          title="Remover override"
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
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