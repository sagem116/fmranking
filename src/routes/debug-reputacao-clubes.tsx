import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bug, Search, Trash2, Plus, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAllPlayerStats } from "@/lib/fm-player-stats-db";
import { fetchAllData } from "@/lib/fm-db";
import {
  loadReputations, loadClubAliases, setReputation, removeReputation,
  setClubAlias, removeClubAlias, onReputationChanged, buildClubMatcher,
} from "@/lib/fm-club-reputation";

export const Route = createFileRoute("/debug-reputacao-clubes")({
  head: () => ({
    meta: [
      { title: "Debug · Reputação Clubes — FM World Rankings" },
      { name: "description", content: "Mapeamento de nomes longos para clubes canónicos e reputação por clube." },
    ],
  }),
  component: DebugReputacaoClubes,
});

function useStore() {
  return useSyncExternalStore(
    (cb) => onReputationChanged(cb),
    () => {
      try {
        return (window.localStorage.getItem("fm-club-reputation-v1") ?? "") + "|" +
               (window.localStorage.getItem("fm-club-name-aliases-v1") ?? "");
      } catch { return ""; }
    },
    () => "",
  );
}

function DebugReputacaoClubes() {
  useStore();
  const reps = loadReputations();
  const aliases = loadClubAliases();

  const knownQ = useQuery({
    queryKey: ["known-clubs"],
    queryFn: async () => {
      const [stats, base] = await Promise.all([fetchAllPlayerStats(), fetchAllData()]);
      const set = new Set<string>();
      for (const s of stats) if (s.club) set.add(s.club);
      for (const s of base.standings) if (s.club_name) set.add(s.club_name);
      return [...set].sort((a, b) => a.localeCompare(b, "pt-PT"));
    },
    staleTime: 5 * 60 * 1000,
  });

  const knownClubs = knownQ.data ?? [];
  const matcher = useMemo(() => buildClubMatcher(knownClubs), [knownClubs]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"reps" | "aliases" | "unmapped">("reps");
  const [newClub, setNewClub] = useState("");
  const [newRep, setNewRep] = useState("");
  const [newAliasRaw, setNewAliasRaw] = useState("");
  const [newAliasCanon, setNewAliasCanon] = useState("");

  const repRows = useMemo(() => {
    const known = new Set(knownClubs);
    return Object.entries(reps).map(([club, value]) => ({
      club,
      value,
      known: known.has(club),
    })).sort((a, b) => a.club.localeCompare(b.club, "pt-PT"));
  }, [reps, knownClubs]);

  const aliasRows = useMemo(() => Object.entries(aliases)
    .map(([raw, canonical]) => ({ raw, canonical }))
    .sort((a, b) => a.raw.localeCompare(b.raw, "pt-PT")), [aliases]);

  const unmappedKnown = useMemo(() => {
    const known = new Set(knownClubs);
    // clubs known in data but without a reputation entry (directly or via alias)
    const haveRep = new Set<string>();
    for (const k of Object.keys(reps)) haveRep.add(k);
    for (const [raw, canon] of Object.entries(aliases)) {
      if (typeof reps[canon] === "number") haveRep.add(raw);
    }
    return [...known].filter((c) => !haveRep.has(c)).sort((a, b) => a.localeCompare(b, "pt-PT"));
  }, [knownClubs, reps, aliases]);

  const filtered = <T extends Record<string, unknown>>(items: T[], pickers: ((it: T) => string)[]) => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => pickers.some((p) => p(it).toLowerCase().includes(s)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
          <Bug className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debug · Reputação Clubes</h1>
          <p className="text-sm text-muted-foreground">Reputação por clube, normalização de nomes longos e clubes ainda sem reputação.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Adicionar reputação</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Clube canónico</label>
            <Select value={newClub} onValueChange={setNewClub}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Escolher…" /></SelectTrigger>
              <SelectContent className="max-h-64">{knownClubs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Reputação</label>
            <Input value={newRep} onChange={(e) => setNewRep(e.target.value)} placeholder="ex. 9000" className="w-32" />
          </div>
          <Button
            size="sm"
            disabled={!newClub || !Number.isFinite(Number(newRep))}
            onClick={() => { setReputation(newClub, Number(newRep)); setNewClub(""); setNewRep(""); }}
          >
            <Plus className="size-4 mr-1" /> Guardar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Adicionar alias (nome longo → clube)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Nome no ficheiro</label>
            <Input value={newAliasRaw} onChange={(e) => {
              setNewAliasRaw(e.target.value);
              const m = matcher(e.target.value.trim());
              if (m && !newAliasCanon) setNewAliasCanon(m.canonical);
            }} placeholder="Sport Lisboa e Benfica" className="w-72" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Clube canónico</label>
            <Select value={newAliasCanon} onValueChange={setNewAliasCanon}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Escolher…" /></SelectTrigger>
              <SelectContent className="max-h-64">{knownClubs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!newAliasRaw.trim() || !newAliasCanon}
            onClick={() => { setClubAlias(newAliasRaw.trim(), newAliasCanon); setNewAliasRaw(""); setNewAliasCanon(""); }}
          >
            <Plus className="size-4 mr-1" /> Guardar
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === "reps" ? "secondary" : "outline"} onClick={() => setTab("reps")}>Reputações ({repRows.length})</Button>
        <Button size="sm" variant={tab === "aliases" ? "secondary" : "outline"} onClick={() => setTab("aliases")}>Aliases ({aliasRows.length})</Button>
        <Button size="sm" variant={tab === "unmapped" ? "secondary" : "outline"} onClick={() => setTab("unmapped")}>Clubes sem reputação ({unmappedKnown.length})</Button>
        <div className="ml-auto relative w-64">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar…" className="pl-8 h-9" />
        </div>
      </div>

      {tab === "reps" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Clube</th>
                  <th className="text-left p-3">Origem</th>
                  <th className="text-right p-3">Reputação</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered(repRows, [(r) => r.club]).map((r) => (
                  <tr key={r.club} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="p-3 font-medium">
                      <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline inline-flex items-center gap-1">
                        <Shield className="size-3.5 text-muted-foreground" />{r.club}
                      </Link>
                    </td>
                    <td className="p-3">{r.known ? <Badge variant="secondary">canónico</Badge> : <Badge variant="outline">só reputação</Badge>}</td>
                    <td className="p-3 text-right">
                      <Input
                        defaultValue={String(r.value)}
                        className="h-8 w-32 ml-auto text-right"
                        onBlur={(e) => {
                          const v = Number(e.target.value.replace(",", "."));
                          if (Number.isFinite(v) && v !== r.value) setReputation(r.club, v);
                        }}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeReputation(r.club)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {repRows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem reputações. Importe um ficheiro em <Link to="/importar" className="underline">Importar</Link>.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "aliases" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Nome no ficheiro</th>
                  <th className="text-left p-3">Clube canónico</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered(aliasRows, [(r) => r.raw, (r) => r.canonical]).map((r) => (
                  <tr key={r.raw} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="p-3 font-mono">{r.raw}</td>
                    <td className="p-3">
                      <Select defaultValue={r.canonical} onValueChange={(v) => { if (v !== r.canonical) setClubAlias(r.raw, v); }}>
                        <SelectTrigger className="h-8 w-72"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-64">{knownClubs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeClubAlias(r.raw)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {aliasRows.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Sem aliases.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "unmapped" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Clube</th>
                  <th className="text-right p-3">Atribuir reputação</th>
                </tr>
              </thead>
              <tbody>
                {filtered(unmappedKnown.map((c) => ({ club: c })), [(r) => r.club]).map((r) => (
                  <tr key={r.club} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="p-3 font-medium">
                      <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline">{r.club}</Link>
                    </td>
                    <td className="p-3 text-right">
                      <Input
                        placeholder="reputação"
                        className="h-8 w-32 ml-auto text-right"
                        onBlur={(e) => {
                          const v = Number(e.target.value.replace(",", "."));
                          if (Number.isFinite(v) && v > 0) setReputation(r.club, v);
                          e.target.value = "";
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {unmappedKnown.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Todos os clubes conhecidos têm reputação.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}