import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { fmtPts } from "@/lib/fmt";
import type { BonusAchievementType } from "@/lib/fm-rankings";

export const Route = createFileRoute("/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — FM World Rankings" },
      { name: "description", content: "Registo de Dobradinhas, Tripletes e Quadruples conquistados." },
    ],
  }),
  component: ConquistasPage,
});

const TYPE_LABEL: Record<BonusAchievementType, string> = {
  "dobradinha": "Dobradinha",
  "dobradinha-int": "Dobradinha Internacional",
  "triplete": "Triplete",
  "quadruple": "Quadruple",
};

const TYPE_TONE: Record<BonusAchievementType, string> = {
  "dobradinha": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "dobradinha-int": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "triplete": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "quadruple": "bg-gold/15 text-gold border-gold/40",
};

function ConquistasPage() {
  const { data, isLoading } = useRankings();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const achievements = data?.ranks.bonusAchievements ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return achievements
      .filter((a) => typeFilter === "all" || a.type === typeFilter)
      .filter((a) => {
        if (!s) return true;
        return (
          a.club.toLowerCase().includes(s) ||
          (a.coach ?? "").toLowerCase().includes(s) ||
          (a.country ?? "").toLowerCase().includes(s) ||
          a.competitions.some((c) => c.toLowerCase().includes(s))
        );
      })
      .sort((a, b) => b.season - a.season || a.club.localeCompare(b.club));
  }, [achievements, typeFilter, search]);

  const counts = useMemo(() => {
    const c = { dobradinha: 0, "dobradinha-int": 0, triplete: 0, quadruple: 0 } as Record<BonusAchievementType, number>;
    for (const a of achievements) c[a.type]++;
    return c;
  }, [achievements]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="size-6 text-gold" /> Conquistas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de Dobradinhas, Tripletes e Quadruples conquistados — ano, treinador, clube, competições e bónus alcançado.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(counts) as BonusAchievementType[]).map((t) => (
          <Card key={t}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{TYPE_LABEL[t]}</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{counts[t]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <label className="text-xs text-muted-foreground">Tipo de conquista</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="dobradinha">Dobradinha</SelectItem>
                <SelectItem value="dobradinha-int">Dobradinha Internacional</SelectItem>
                <SelectItem value="triplete">Triplete</SelectItem>
                <SelectItem value="quadruple">Quadruple</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Pesquisa (clube, treinador, país, competição)</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" placeholder="Pesquisar…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Clube</TableHead>
                <TableHead>Treinador</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Competições</TableHead>
                <TableHead className="text-right">Bónus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nenhuma conquista encontrada para os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a, idx) => (
                  <TableRow key={`${a.season}-${a.club}-${a.type}-${idx}`}>
                    <TableCell className="tabular-nums">{a.season}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_TONE[a.type]}>{TYPE_LABEL[a.type]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to="/clubes/$name" params={{ name: a.club }} className="hover:underline">{a.club}</Link>
                    </TableCell>
                    <TableCell>
                      {a.coach ? (
                        <Link to="/treinadores/$name" params={{ name: a.coach }} className="hover:underline">{a.coach}</Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {a.country ? (
                        <Link to="/paises/$name" params={{ name: a.country }} className="hover:underline">{a.country}</Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.competitions.join(" + ")}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtPts(a.bonus)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
