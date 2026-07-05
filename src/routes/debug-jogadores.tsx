import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Bug, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { buildPlayerKey, computeGoals, computeAssists, computePerformance } from "@/lib/fm-players";

export const Route = createFileRoute("/debug-jogadores")({
  head: () => ({ meta: [{ title: "Debug · Jogadores — FM World Rankings" }] }),
  component: DebugJogadores,
});

function DebugJogadores() {
  const { data, isLoading } = useRankings();
  const { data: psData } = usePlayerStatsData();
  const stats = useMemo(() => {
    if (!psData) return null;
    const ps = psData.players;
    const noClub = ps.filter((p) => !p.club || !p.club.trim());
    const noNat = ps.filter((p) => !p.nationality || !p.nationality.trim());
    const badVp = ps.filter((p) => p.vp < 0 || (p.vp !== 0 && p.vp < 100));
    const badSal = ps.filter((p) => p.salary < 0);
    // Duplicates: same IDU across the same season with different club/name
    const bySeasonIdu = new Map<string, { names: Set<string>; clubs: Set<string> }>();
    for (const p of ps) {
      if (!p.idu) continue;
      const k = `${p.season_year}|${p.idu}`;
      let e = bySeasonIdu.get(k);
      if (!e) { e = { names: new Set(), clubs: new Set() }; bySeasonIdu.set(k, e); }
      e.names.add(p.player_name); if (p.club) e.clubs.add(p.club);
    }
    const duplicates: { key: string; names: string[]; clubs: string[] }[] = [];
    for (const [key, v] of bySeasonIdu) if (v.names.size > 1 || v.clubs.size > 1) duplicates.push({ key, names: [...v.names], clubs: [...v.clubs] });
    // Inconsistent: player with same name but different nationalities across seasons
    const byName = new Map<string, Set<string>>();
    for (const p of ps) {
      if (!p.player_name || !p.nationality) continue;
      let s = byName.get(p.player_name); if (!s) { s = new Set(); byName.set(p.player_name, s); }
      s.add(p.nationality);
    }
    const inconsistent: { name: string; nats: string[] }[] = [];
    for (const [name, s] of byName) if (s.size > 1) inconsistent.push({ name, nats: [...s] });
    return { noClub, noNat, badVp, badSal, duplicates, inconsistent };
  }, [psData]);

  if (isLoading || !data) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }

  const players = data.data.players;
  const { warnings } = buildPlayerKey(players);
  const dupUid = warnings.filter((w) => w.reason === "duplicate-uid");
  const noUid = warnings.filter((w) => w.reason === "no-uid");

  const goals = computeGoals(players);
  const assists = computeAssists(players);
  const perf = computePerformance(players);

  const seasons = [...new Set(players.map((p) => p.season_year))].sort((a, b) => a - b);
  const totalRecords = players.length;
  const uniqueIdus = new Set(players.filter((p) => p.idu).map((p) => p.idu)).size;
  const noIduCount = players.filter((p) => !p.idu).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Jogadores
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Unificação por IDU/UID e rankings de jogadores</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Registos totais" value={totalRecords} />
        <Stat label="Épocas" value={seasons.length} />
        <Stat label="IDUs únicos" value={uniqueIdus} />
        <Stat label="Sem IDU" value={noIduCount} tone={noIduCount ? "warn" : "ok"} />
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Sem clube" value={stats.noClub.length} tone={stats.noClub.length ? "warn" : "ok"} />
          <Stat label="Sem nacionalidade" value={stats.noNat.length} tone={stats.noNat.length ? "warn" : "ok"} />
          <Stat label="Duplicados (IDU/época)" value={stats.duplicates.length} tone={stats.duplicates.length ? "warn" : "ok"} />
          <Stat label="Dados inconsistentes" value={stats.inconsistent.length} tone={stats.inconsistent.length ? "warn" : "ok"} />
          <Stat label="V.P. inválido" value={stats.badVp.length} tone={stats.badVp.length ? "warn" : "ok"} />
          <Stat label="Salário inválido" value={stats.badSal.length} tone={stats.badSal.length ? "warn" : "ok"} />
        </div>
      )}

      {stats && (
        <>
          <ListCard title="Jogadores sem clube" items={stats.noClub.slice(0, 400).map((p) => `${p.player_name} · ${p.season_year}${p.nationality ? " · " + p.nationality : ""}`)} total={stats.noClub.length} />
          <ListCard title="Jogadores sem nacionalidade" items={stats.noNat.slice(0, 400).map((p) => `${p.player_name} · ${p.season_year}${p.club ? " · " + p.club : ""}`)} total={stats.noNat.length} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> Duplicados por IDU na mesma época ({stats.duplicates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.duplicates.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma duplicação encontrada.</p> : (
                <div className="max-h-[300px] overflow-y-auto space-y-1 text-xs">
                  {stats.duplicates.slice(0, 200).map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <code className="font-mono text-[10px]">{d.key}</code>
                      <span className="text-muted-foreground">{d.names.join(" · ")}</span>
                      {d.clubs.length > 0 && <Badge variant="outline" className="text-[10px]">{d.clubs.join(", ")}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> Nacionalidade inconsistente ({stats.inconsistent.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.inconsistent.length === 0 ? <p className="text-sm text-muted-foreground">Sem inconsistências.</p> : (
                <div className="max-h-[280px] overflow-y-auto text-xs space-y-1">
                  {stats.inconsistent.slice(0, 200).map((r) => (
                    <div key={r.name} className="flex gap-2">
                      <Link to="/jogadores/$name" params={{ name: r.name }} className="font-medium hover:text-primary">{r.name}</Link>
                      <span className="text-muted-foreground">{r.nats.join(" · ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <ListCard title="Valores de mercado inválidos ou fora do intervalo" items={stats.badVp.slice(0, 400).map((p) => `${p.player_name} · ${p.season_year} · ${p.vp}`)} total={stats.badVp.length} />
          <ListCard title="Salários inválidos" items={stats.badSal.slice(0, 400).map((p) => `${p.player_name} · ${p.season_year} · ${p.salary}`)} total={stats.badSal.length} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="size-4 text-primary" /> Como são unidos os jogadores
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>1. Cada jogador é unido entre épocas pela coluna <b>IDU/UID</b>.</p>
          <p>2. Se um IDU aparecer associado a vários nomes diferentes, é considerado <b>ambíguo</b> e usa-se o fallback <b>Nome + Clube</b>.</p>
          <p>3. Se o jogador não tiver IDU, usa-se também o fallback <b>Nome + Clube</b>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> IDUs ambíguos ({dupUid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dupUid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum IDU repetido em jogadores diferentes.</p>
          ) : (
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                  <tr>
                    <th className="text-left py-2 pr-3">IDU</th>
                    <th className="text-left py-2 pr-3">Nomes encontrados</th>
                    <th className="text-left py-2 pr-3">Clubes</th>
                  </tr>
                </thead>
                <tbody>
                  {dupUid.map((w, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1.5 pr-3 font-mono text-xs">{w.idu}</td>
                      <td className="py-1.5 pr-3">{w.names.join(" · ")}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{w.clubs.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Jogadores sem IDU ({noUid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {noUid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os jogadores têm IDU.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-[240px] overflow-y-auto">
              {noUid.slice(0, 500).map((w, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {w.names[0]} {w.clubs[0] ? <span className="text-muted-foreground ml-1">· {w.clubs[0]}</span> : null}
                </Badge>
              ))}
              {noUid.length > 500 && (
                <span className="text-xs text-muted-foreground">… e mais {noUid.length - 500}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankCard title="Golos (total)" rows={goals.rows.slice(0, 100).map((r) => ({ name: r.name, value: r.total }))} unit="gls" />
        <RankCard title="Assistências (total)" rows={assists.rows.slice(0, 100).map((r) => ({ name: r.name, value: r.total }))} unit="ast" />
        <RankCard title="Performance (G+A)" rows={perf.slice(0, 100).map((r) => ({ name: r.name, value: r.total }))} unit="pts" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "ok" | "warn" }) {
  const color = tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString("pt-PT")}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function RankCard({ title, rows, unit }: { title: string; rows: { name: string; value: number }[]; unit: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name + i} className="border-b border-border/30">
                  <td className="py-1 pr-2 text-muted-foreground w-8">{i + 1}</td>
                  <td className="py-1 pr-2 truncate">{r.name}</td>
                  <td className="py-1 text-right tabular-nums font-semibold">
                    {r.value.toLocaleString("pt-PT")} <span className="text-muted-foreground text-xs">{unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ListCard({ title, items, total }: { title: string; items: string[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" /> {title} ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ocorrências.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-[240px] overflow-y-auto">
            {items.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}
            {total > items.length && <span className="text-xs text-muted-foreground">… e mais {total - items.length}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
